from pathlib import Path

p = Path("backend/app/services/model_gateway.py")
text = p.read_text(encoding="utf-8")

old_block = """                    if response.status_code in (401, 403):
                        raise AppError("provider_auth_failed", "The model provider rejected its API key. Check NVIDIA_API_KEY.", 502)
                    if response.status_code >= 400:
                        log.warning("model_call_failed model=%s status=%d body=%s", model_candidate, response.status_code, response.text[:200])
                        last_error = AppError("provider_error", f"Model {model_candidate} returned {response.status_code}", response.status_code)
                        continue"""

new_block = """                    if response.status_code in (401, 403):
                        raise AppError("provider_auth_failed", "The model provider rejected its API key. Check NVIDIA_API_KEY.", 502)
                    if response.status_code == 429:
                        log.warning("model_call_failed 429 model=%s", model_candidate)
                        last_error = AppError("provider_rate_limited", "The model provider is rate limiting requests. Try again shortly.", 502)
                        continue
                    if response.status_code == 404:
                        last_error = AppError("provider_model_not_found", f"Model {model_candidate} not found.", 502)
                        continue
                    if response.status_code >= 400:
                        log.warning("model_call_failed model=%s status=%d body=%s", model_candidate, response.status_code, response.text[:200])
                        last_error = AppError("provider_error", f"The model provider returned an error ({response.status_code}).", 502)
                        continue"""

assert old_block in text
text = text.replace(old_block, new_block)

old_end = """        # If all candidates in chain failed:
        log.error("all_models_failed chain=%s last_error=%s", models_to_try, last_error)
        raise AppError(
            "provider_unavailable",
            "AI service temporarily unavailable. Please try again shortly.",
            503,
        )"""

new_end = """        # If all candidates in chain failed:
        log.error("all_models_failed chain=%s last_error=%s", models_to_try, last_error)
        if isinstance(last_error, AppError):
            raise last_error
        raise AppError(
            "provider_unavailable",
            "AI service temporarily unavailable. Please try again shortly.",
            503,
        )"""

assert old_end in text
text = text.replace(old_end, new_end)

old_empty = """                    if not content and not reasoning_content:
                        log.warning("empty_content from model=%s, trying next in fallback chain", model_candidate)
                        last_error = AppError("provider_empty_response", "Model returned empty answer.", 502)
                        continue"""

new_empty = """                    if not content:
                        log.warning("empty_content from model=%s, trying next in fallback chain", model_candidate)
                        last_error = AppError("provider_empty_response", "The model returned no answer; reasoning may have used the token budget. Try again.", 502)
                        continue"""

assert old_empty in text
text = text.replace(old_empty, new_empty)

p.write_text(text, encoding="utf-8")
print("model_gateway.py successfully patched.")

