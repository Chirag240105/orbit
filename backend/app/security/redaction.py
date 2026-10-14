"""Best-effort secret redaction before any text leaves the machine. NOT a guarantee."""
import re

_PATTERNS: list[tuple[str, re.Pattern]] = [
    ("private_key", re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----.*?-----END [A-Z ]*PRIVATE KEY-----", re.S)),
    ("aws_access_key", re.compile(r"\bAKIA[0-9A-Z]{16}\b")),
    ("github_token", re.compile(r"\bgh[pousr]_[A-Za-z0-9]{30,}\b")),
    ("api_key_sk", re.compile(r"\bsk-[A-Za-z0-9_\-]{20,}\b")),
    ("jwt", re.compile(r"\beyJ[A-Za-z0-9_\-]{8,}\.[A-Za-z0-9_\-]{8,}\.[A-Za-z0-9_\-]{8,}\b")),
    ("bearer", re.compile(r"(?i)\bbearer\s+[A-Za-z0-9._\-]{16,}")),
    (
        "assignment",
        re.compile(r"""(?ix)((?:api[_-]?key|secret|token|passw(?:or)?d|auth)[\w\-]*\s*[:=]\s*)(['"]?)[^\s'"]{6,}\2"""),
    ),
]


def redact(text: str) -> tuple[str, int]:
    count = 0
    for name, pat in _PATTERNS:
        if name == "assignment":
            text, n = pat.subn(lambda m: f"{m.group(1)}[REDACTED]", text)
        else:
            text, n = pat.subn("[REDACTED]", text)
        count += n
    return text, count


def fence_untrusted(label: str, text: str) -> str:
    """Wrap retrieved/untrusted content so it cannot close its own fence."""
    safe = text.replace("</untrusted", "<\\/untrusted")
    return f'<untrusted_data source="{label}">\n{safe}\n</untrusted_data>'
