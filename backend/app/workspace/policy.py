"""File-access policy. The ONLY code allowed to turn a user/model-supplied path into a real path."""
import fnmatch
import os
from pathlib import Path, PurePosixPath

from app.core.errors import AppError

ALLOWED_EXTENSIONS = {
    ".md", ".txt", ".js", ".jsx", ".ts", ".tsx", ".py", ".json", ".yaml", ".yml",
    ".toml", ".ini", ".cfg", ".html", ".css", ".sql",
}
EXCLUDED_DIRS = {".git", "node_modules", "__pycache__", ".venv", "venv", ".ssh", ".aws", ".gnupg", "dist", "build", ".next"}
EXCLUDED_FILE_PATTERNS = [
    ".env", ".env.*", "*.pem", "*.key", "*.p12", "*.pfx", "id_rsa*", "id_ed25519*", "id_ecdsa*",
    "credentials*", "*secret*", ".npmrc", ".pypirc", ".netrc", "*.sqlite", "*.db", "*.keystore",
]
# Safe to read even though they match a pattern above.
EXCLUDE_ALLOWLIST = {".env.example"}


def is_excluded_name(name: str) -> bool:
    low = name.lower()
    if low in EXCLUDE_ALLOWLIST:
        return False
    return any(fnmatch.fnmatch(low, p) for p in EXCLUDED_FILE_PATTERNS)


def validate_workspace_root(raw: str) -> Path:
    if not raw or "\x00" in raw:
        raise AppError("invalid_path", "Enter a folder path.", 400)
    p = Path(raw).expanduser()
    if not p.is_absolute():
        raise AppError("invalid_path", "Use an absolute folder path.", 400)
    real = Path(os.path.realpath(p))
    if not real.is_dir():
        raise AppError("invalid_path", "That folder does not exist.", 400)
    if real == Path(real.anchor) or real == Path.home().resolve() or len(real.parts) <= 2:
        raise AppError(
            "workspace_too_broad",
            "Choose a specific project folder, not a drive root, home folder, or top-level system folder.",
            400,
        )
    return real


def resolve_inside(root: str | Path, rel: str, *, must_exist: bool = True) -> Path:
    """Canonicalize `rel` under `root`. Rejects traversal, absolute paths, NULs, and symlink escapes."""
    if not rel or "\x00" in rel:
        raise AppError("invalid_path", "Path is required.", 400)
    pure = PurePosixPath(rel.replace("\\", "/"))
    if pure.is_absolute() or (len(rel) > 1 and rel[1] == ":") or ".." in pure.parts:
        raise AppError("path_not_allowed", "Path must be relative and stay inside the workspace.", 403)
    real_root = Path(os.path.realpath(root))
    target = Path(os.path.realpath(real_root / pure))
    try:
        target.relative_to(real_root)
    except ValueError:
        raise AppError("path_not_allowed", "Path resolves outside the workspace.", 403) from None
    rel_parts = target.relative_to(real_root).parts
    if any(part in EXCLUDED_DIRS for part in rel_parts[:-1]) or (rel_parts and is_excluded_name(rel_parts[-1])):
        raise AppError("path_excluded", "This path is excluded for security reasons.", 403)
    if must_exist and not target.exists():
        raise AppError("not_found", "File not found.", 404)
    return target


def check_readable_file(path: Path, max_bytes: int) -> None:
    if path.suffix.lower() not in ALLOWED_EXTENSIONS:
        raise AppError("unsupported_file", f"Unsupported file type '{path.suffix or 'none'}'.", 415)
    if not path.is_file():
        raise AppError("not_found", "Not a file.", 404)
    if path.stat().st_size > max_bytes:
        raise AppError("file_too_large", f"File exceeds the {max_bytes // 1000} KB limit.", 413)


def check_writable_target(path: Path, max_bytes: int, content: str) -> None:
    if path.suffix.lower() not in ALLOWED_EXTENSIONS:
        raise AppError("unsupported_file", "Unsupported file type for writing.", 415)
    if len(content.encode("utf-8")) > max_bytes:
        raise AppError("file_too_large", "New content exceeds the size limit.", 413)
