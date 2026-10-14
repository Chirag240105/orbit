"""Best-effort secret redaction before any text leaves the machine. NOT a guarantee.

Trade-offs: patterns favour catching secrets over avoiding false positives. The entropy check only
fires on long tokens that mix upper case, lower case and digits, so hex hashes, UUIDs and ordinary
identifiers pass through, while lockfile integrity hashes (sha512-...) are redacted. Patterns that
name a `secret` group only replace that part, so `password = "..."` keeps its variable name.
"""
import math
import re
from collections import Counter
from collections.abc import Callable

_PATTERNS: list[tuple[str, re.Pattern]] = [
    ("private_key", re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----.*?-----END [A-Z ]*PRIVATE KEY-----", re.S)),
    ("aws_access_key", re.compile(r"\b(?:AKIA|ASIA)[0-9A-Z]{16}\b")),
    ("github_token", re.compile(r"\bgh[pousr]_[A-Za-z0-9]{30,}\b|\bgithub_pat_[A-Za-z0-9_]{40,}\b")),
    ("api_key_sk", re.compile(r"\bsk-[A-Za-z0-9_\-]{20,}\b")),
    ("stripe_key", re.compile(r"\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b")),
    ("slack_token", re.compile(r"\bxox[abposr]-[A-Za-z0-9\-]{10,}\b")),
    ("slack_webhook", re.compile(r"https://hooks\.slack\.com/services/[A-Za-z0-9/]+")),
    ("google_api_key", re.compile(r"\bAIza[0-9A-Za-z_\-]{35}\b")),
    ("npm_token", re.compile(r"\bnpm_[A-Za-z0-9]{36}\b")),
    ("huggingface_token", re.compile(r"\bhf_[A-Za-z0-9]{30,}\b")),
    ("jwt", re.compile(r"\beyJ[A-Za-z0-9_\-]{8,}\.[A-Za-z0-9_\-]{8,}\.[A-Za-z0-9_\-]{8,}\b")),
    ("bearer", re.compile(r"(?i)\bbearer\s+(?P<secret>[A-Za-z0-9._\-]{16,})")),
    # scheme://user:password@host -> only the password is replaced
    ("url_password", re.compile(r"\b[a-z][a-z0-9+.\-]*://[^\s:/@]+:(?P<secret>[^\s@/]+)@", re.I)),
    ("azure_account_key", re.compile(r"(?i)\bAccountKey=(?P<secret>[^;\s'\"]+)")),
    (
        "assignment",
        re.compile(
            r"""(?ix)(?:api[_-]?key|secret|token|passw(?:or)?d|auth)[\w\-]*\s*[:=]\s*(?P<q>['"]?)(?P<secret>[^\s'"]{6,})(?P=q)"""
        ),
    ),
]
_CANDIDATE = re.compile(r"(?<![A-Za-z0-9+/=_\-])[A-Za-z0-9+/=_\-]{32,}(?![A-Za-z0-9+/=_\-])")
_PLACEHOLDER = re.compile(r"^\[REDACTED(?:_\d+)?\]$")
# Random base64 of n chars scores close to log2(n) bits per char; CamelCase identifiers score lower.
# The cap keeps very long tokens from needing near-perfect randomness.
ENTROPY_FACTOR, ENTROPY_CAP = 0.85, 4.5


def shannon_entropy(s: str) -> float:
    n = len(s)
    return -sum(c / n * math.log2(c / n) for c in Counter(s).values()) if n else 0.0


def looks_random(token: str) -> bool:
    """Long token mixing upper, lower and digits with high entropy: likely a generated secret."""
    return (
        len(token) >= 32
        and any(c.isupper() for c in token)
        and any(c.islower() for c in token)
        and sum(c.isdigit() for c in token) >= 2
        and shannon_entropy(token) >= min(ENTROPY_CAP, ENTROPY_FACTOR * math.log2(len(token)))
    )


def _apply(text: str, placeholder: Callable[[str], str]) -> tuple[str, int]:
    count = 0

    def replace(m: re.Match) -> str:
        nonlocal count
        has_group = "secret" in m.re.groupindex and m.group("secret") is not None
        start, end = (m.start("secret"), m.end("secret")) if has_group else (m.start(), m.end())
        secret = m.string[start:end]
        if _PLACEHOLDER.match(secret):  # already redacted by an earlier pattern
            return m.group(0)
        count += 1
        return m.string[m.start() : start] + placeholder(secret) + m.string[end : m.end()]

    for _, pat in _PATTERNS:
        text = pat.sub(replace, text)
    text = _CANDIDATE.sub(lambda m: replace(m) if looks_random(m.group(0)) else m.group(0), text)
    return text, count


def redact(text: str) -> tuple[str, int]:
    """Replace likely secrets with [REDACTED]. Returns (text, number of redactions)."""
    return _apply(text, lambda _: "[REDACTED]")


def redact_reversible(text: str) -> tuple[str, dict[str, str]]:
    """Like redact(), but with numbered placeholders so secrets can be put back into a model-drafted
    file (see restore()). The mapping never leaves this process."""
    mapping: dict[str, str] = {}

    def placeholder(secret: str) -> str:
        key = f"[REDACTED_{len(mapping) + 1}]"
        mapping[key] = secret
        return key

    text, _ = _apply(text, placeholder)
    return text, mapping


def restore(text: str, mapping: dict[str, str]) -> str:
    for key, secret in mapping.items():
        text = text.replace(key, secret)
    return text


_STRUCTURAL_TAGS = re.compile(r"<(/?)(untrusted_data|user_request)", re.I)


def fence_untrusted(label: str, text: str) -> str:
    """Wrap retrieved/untrusted content so it cannot close its own fence or imitate ORBIT's prompt structure
    (an injected <user_request> or </untrusted_data> is escaped to <\\user_request / <\\/untrusted_data)."""
    safe = _STRUCTURAL_TAGS.sub(lambda m: f"<\\{m.group(1)}{m.group(2)}", text)
    return f'<untrusted_data source="{label}">\n{safe}\n</untrusted_data>'
