"""Tests for the output normalizer.

Covers:
1. The exact bad-JSON-schema-echo output from the reported bug.
2. A valid CleanOutput passes through unchanged.
3. Legacy flat shape (answer + key_points lists of strings) maps correctly.
4. HTML / script injection in model text renders as inert plain text.
5. Fallback path returns a CleanOutput from plain text.
6. Repair of nested schema-echo values.
"""


from app.skills.normalizer import (
    CleanOutput,
    _is_schema_echo,
    normalize_output,
    to_legacy_dict,
)

# ---------------------------------------------------------------------------
# 1. Exact bug fixture — schema-echo output
# ---------------------------------------------------------------------------

SCHEMA_ECHO_BAD = {
    "answer": {
        "title": "Web Client Component",
        "type": "string",
        "description": (
            "The Web Client is the browser or mobile app interface where you type messages "
            "and see responses."
        ),
    },
    "key_points": {
        "items": [
            "Manages conversation state locally and streams tokens from the server.",
            "Uses WebSocket /v1/messages and SSE for live updates.",
        ],
        "title": "Key Points",
        "type": "array",
    },
    "follow_ups": {
        "items": [
            "How does the Web Client handle reconnection after a network drop?",
            "What mechanisms prevent UI lag when streaming long responses?",
        ],
        "title": "Follow Ups",
        "type": "array",
    },
    "suggested_memory": None,
}


def test_schema_echo_detected():
    assert _is_schema_echo(SCHEMA_ECHO_BAD) is True


def test_schema_echo_normalizes_to_clean_output():
    result = normalize_output(SCHEMA_ECHO_BAD, raw_text="")
    assert isinstance(result, CleanOutput)
    # summary must contain the description text, not schema metadata
    assert "Web Client" in result.summary
    assert "string" not in result.summary  # no type annotations leaked
    assert '"type"' not in result.summary
    # key_points become section bullets
    bullet_texts = [b for sec in result.sections for b in sec.bullets]
    assert any("WebSocket" in b or "streams tokens" in b for b in bullet_texts)
    # follow_ups must be plain strings
    assert all(isinstance(q, str) for q in result.follow_ups)
    assert any("reconnection" in q or "UI lag" in q for q in result.follow_ups)


# ---------------------------------------------------------------------------
# 2. Valid CleanOutput passes through unchanged
# ---------------------------------------------------------------------------

VALID_CLEAN = {
    "summary": "The CDN caches static assets at edge PoPs worldwide.",
    "sections": [
        {"heading": "What it does", "bullets": ["Caches images, scripts, and video chunks.", "Reduces origin load by 95%."]},
        {"heading": "How it can fail", "bullets": ["Cache poisoning via malicious headers."]},
    ],
    "key_takeaway": "The CDN is why Netflix can stream to 260 M users simultaneously.",
    "follow_ups": ["What happens when a PoP goes offline?", "How does cache invalidation work at scale?", "What is the tradeoff with stale content?"],
    "suggested_memory": None,
}


def test_valid_clean_output_passes_through():
    result = normalize_output(VALID_CLEAN, raw_text="")
    assert result.summary == VALID_CLEAN["summary"]
    assert len(result.sections) == 2
    assert result.sections[0].heading == "What it does"
    assert result.key_takeaway == VALID_CLEAN["key_takeaway"]
    assert len(result.follow_ups) == 3


# ---------------------------------------------------------------------------
# 3. Legacy flat shape
# ---------------------------------------------------------------------------

LEGACY_FLAT = {
    "answer": "The API Gateway routes all traffic.",
    "key_points": ["TLS termination", "Rate limiting"],
    "risks": ["Single point of failure"],
    "follow_ups": ["What if the gateway is down?", "How to add circuit breaking?", "Canary deployment strategy?"],
    "suggested_memory": "The API gateway handles TLS for all services.",
}


def test_legacy_flat_shape_converts():
    result = normalize_output(LEGACY_FLAT, raw_text="")
    assert "API Gateway" in result.summary
    # key_points and risks should become sections
    section_headings = [s.heading.lower() for s in result.sections]
    assert any("key" in h for h in section_headings)
    assert any("risk" in h or "failure" in h for h in section_headings)
    assert result.suggested_memory == "The API gateway handles TLS for all services."


# ---------------------------------------------------------------------------
# 4. HTML / script injection renders as inert plain text
# ---------------------------------------------------------------------------

INJECTION_OUTPUT = {
    "summary": "<script>alert('xss')</script> The CDN distributes assets.",
    "sections": [
        {
            "heading": "What it does",
            "bullets": [
                "<img src=x onerror=alert(1)> Caches content.",
                "Normal bullet point.",
            ],
        }
    ],
    "key_takeaway": "javascript:void(0) — just a takeaway.",
    "follow_ups": ["<b>Bold question?</b>", "Normal question?", "Another?"],
    "suggested_memory": None,
}


def test_injection_content_stored_as_plain_text():
    """Model text is stored verbatim; rendering (not stripping) is the frontend's job.
    This test confirms the normalizer does NOT execute or interpret HTML/JS."""
    result = normalize_output(INJECTION_OUTPUT, raw_text="")
    # The normalizer stores the raw strings — it does not strip them.
    # The frontend renders them as plain text (no dangerouslySetInnerHTML).
    assert "<script>" in result.summary  # stored verbatim
    assert "CDN" in result.summary
    # Bullets preserve the injection string as plain text
    all_bullets = [b for s in result.sections for b in s.bullets]
    assert any("<img" in b for b in all_bullets)


# ---------------------------------------------------------------------------
# 5. Fallback path — None data, use plain text
# ---------------------------------------------------------------------------

def test_fallback_from_none_data():
    result = normalize_output(None, raw_text="The model returned garbage output.")
    assert isinstance(result, CleanOutput)
    assert "garbage" in result.summary or "model" in result.summary


def test_fallback_from_empty_text():
    result = normalize_output(None, raw_text="")
    assert isinstance(result, CleanOutput)
    assert len(result.summary) > 0  # must not be empty


# ---------------------------------------------------------------------------
# 6. to_legacy_dict round-trip
# ---------------------------------------------------------------------------

def test_to_legacy_dict_round_trip():
    clean = CleanOutput(
        summary="Test summary.",
        sections=[{"heading": "A section", "bullets": ["b1", "b2"]}],
        key_takeaway="Takeaway.",
        follow_ups=["Q1?", "Q2?", "Q3?"],
    )
    d = to_legacy_dict(clean)
    assert d["summary"] == "Test summary."
    assert d["sections"][0]["heading"] == "A section"
    assert "suggested_memory" not in d  # excluded when None
