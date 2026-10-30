# FEEDBACK — NVIDIA Build Platform and Nebius Onboarding

Feedback from building ORBIT for the NVIDIA × Nebius Personal AI Hackathon.
All observations are based on actual integration work during the submission period.

---

## NVIDIA build.nvidia.com / Nemotron API

### What worked well

**OpenAI-compatible endpoint.** The `https://integrate.api.nvidia.com/v1` endpoint follows the OpenAI chat-completions schema closely. Switching to it required changing only the base URL and auth header; no library changes were needed. This made porting the existing provider layer straightforward.

**Thinking control via `chat_template_kwargs`.** The `enable_thinking` flag (`chat_template_kwargs: { enable_thinking: false }`) reliably suppresses the reasoning preamble for JSON-producing tasks (scene generation, tool argument extraction). This allowed clean separation: structured tasks get deterministic low-temperature responses without think-tag pollution, while conversational tasks can use thinking with a lower budget for better answers.

**`reasoning_content` in streaming deltas.** For streaming requests, reasoning content arrives in a separate `reasoning_content` field on the delta, distinct from `content`. This is a clean design that lets the application handle thinking traces without polluting the visible chat output. ORBIT uses this to show a collapsed "reasoning trace" in the debug panel.

**Model routing quality.** `nemotron-3.5-lightning-30b-a3b` is noticeably fast for intent classification and memory importance gates — latency is low enough that routing overhead is not felt by users. The larger `super-vl-120b-a12b` model produces well-structured, accurate system-design JSON that validates on the first attempt most of the time.

**Streaming reliability.** SSE streaming worked steadily in our testing. The `[DONE]` terminator and `stream_options: { include_usage: true }` for token counting both function as documented.

### Issues and friction

**Early-access model availability.** Some model IDs listed in the hackathon brief return HTTP 404 from the `/models` endpoint. `nvidia/nemotron-3.5-super-vl-120b-a12b` was not present in the catalogue during our development window, though other Nemotron 3.5 variants were. The fallback chain (planner → fallback → fast) is essential for a stable demo. We recommend verifying model IDs with `scripts/list_models.py` before a live demo.

**Empty `content` when thinking budget is exceeded.** On very long context inputs, the model occasionally returns a valid HTTP 200 response with an empty `content` field while `reasoning_content` is populated. This is a silent failure mode. ORBIT detects empty content and advances the fallback chain, but this can add 5–15 seconds of latency to a single turn. A clear API-level signal (e.g., a finish reason code) would improve observability.

**Rate limits not exposed clearly.** Rate-limit errors return HTTP 429 with a JSON error body, but the `Retry-After` header is not consistently present. ORBIT falls back to a 1-second sleep before retrying, then advances the fallback chain, which works but is not optimal. A stable `Retry-After` header or a `X-RateLimit-Reset` header would allow better backoff.

**`seed` parameter in requests.** The `seed` parameter is listed as supported but does not guarantee reproducible outputs for structured generation tasks in practice. This is acceptable for a creative model; just worth noting for debugging.

**JSON reliability under high temperature.** When `enable_thinking: true` and temperature > 0.3, structured JSON output from scene generation sometimes includes extraneous text before or after the JSON object. The `_extract_json` extraction and Pydantic repair-retry loop catches this in nearly all cases, but it adds one extra round-trip in maybe 10–20% of complex scene requests.

---

## Nebius Token Factory Onboarding

### Card verification blocker

The team (based in India) could not complete account verification because the Nebius platform requires credit or debit card verification and the supported card types and payment methods were not available to the team members during the hackathon period. This is a known friction point for participants from countries where Nebius has limited payment processor coverage.

**Impact on submission:** ORBIT is built to support Nebius as a pure configuration switch. Setting `LLM_PROVIDER=nebius` and `NEBIUS_API_KEY=<key>` is sufficient to switch the provider; no code changes are needed. The demo runs on NVIDIA's hosted API. We could not verify live Nebius behavior because access could not be established before the submission deadline.

### What would help

- Allow hackathon participants to request a temporary API key directly through the hackathon portal, bypassing card verification for a time-limited evaluation credential.
- Clarify in the hackathon brief which countries and payment methods are supported, so teams can plan around the limitation.
- Provide a shared "hackathon pool" NEBIUS_API_KEY with limited quota (e.g., 10,000 tokens) for teams that could not complete verification, specifically for submission verification purposes.

---

## Summary Table

| Area | Experience |
|---|---|
| NVIDIA endpoint compatibility | ✓ OpenAI-compatible, minimal porting effort |
| Thinking control (`enable_thinking`) | ✓ Works reliably, clean separation |
| `reasoning_content` in streaming | ✓ Correct and useful |
| Model catalogue availability | ⚠ Some IDs in brief not yet in `/models` endpoint |
| Empty-content silent failure | ⚠ Needs a clearer API signal |
| 429 handling (`Retry-After`) | ⚠ Header inconsistently present |
| Nebius onboarding | ✗ Card verification blocked for India-based team |
| Nebius as config switch | ✓ Implemented; waiting for access to verify |
