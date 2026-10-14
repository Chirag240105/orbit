import hashlib
import os
from collections import Counter
from pathlib import Path

from app.core.errors import AppError
from app.workspace.policy import (
    ALLOWED_EXTENSIONS,
    EXCLUDED_DIRS,
    check_readable_file,
    check_writable_target,
    is_excluded_name,
    resolve_inside,
)

CONFIG_FILES = {
    "package.json", "pyproject.toml", "requirements.txt", "tsconfig.json", "vite.config.ts", "Dockerfile",
    "docker-compose.yml", "README.md", ".env.example", "tailwind.config.js", "alembic.ini",
}


def _walk(root: str, limit: int = 1000):
    root_p = Path(os.path.realpath(root))
    n = 0
    for dirpath, dirs, files in os.walk(root_p, followlinks=False):
        dirs[:] = sorted(d for d in dirs if d not in EXCLUDED_DIRS and not os.path.islink(os.path.join(dirpath, d)))
        for f in sorted(files):
            full = Path(dirpath) / f
            if is_excluded_name(f) or full.suffix.lower() not in ALLOWED_EXTENSIONS or full.is_symlink():
                continue
            yield full.relative_to(root_p).as_posix(), full
            n += 1
            if n >= limit:
                return


def list_files(root: str, limit: int = 1000) -> list[dict]:
    return [{"path": rel, "size": full.stat().st_size} for rel, full in _walk(root, limit)]


def read_text(root: str, rel: str, max_bytes: int) -> str:
    path = resolve_inside(root, rel)
    check_readable_file(path, max_bytes)
    data = path.read_bytes()
    if b"\x00" in data:
        raise AppError("unsupported_file", "Binary files are not supported.", 415)
    return data.decode("utf-8", errors="replace")


def search(root: str, query: str, max_bytes: int, limit: int = 40) -> list[dict]:
    q = query.strip().lower()
    if not q:
        return []
    out: list[dict] = []
    for rel, full in _walk(root):
        if q in rel.lower():
            out.append({"path": rel, "line": None, "snippet": None})
        elif full.stat().st_size <= max_bytes:
            try:
                for i, line in enumerate(full.read_text("utf-8", errors="ignore").splitlines(), 1):
                    if q in line.lower():
                        from app.security.redaction import redact
                        out.append({"path": rel, "line": i, "snippet": redact(line.strip()[:160])[0]})
                        break
            except OSError:
                continue
        if len(out) >= limit:
            break
    return out


def summarize(root: str) -> dict:
    files = list(_walk(root))
    exts = Counter(f.suffix.lower() for _, f in files)
    tops = Counter(rel.split("/")[0] for rel, _ in files if "/" in rel)
    return {
        "file_count": len(files),
        "by_extension": dict(exts.most_common()),
        "top_level_folders": dict(tops.most_common(12)),
        "config_files": sorted({Path(rel).name for rel, _ in files if Path(rel).name in CONFIG_FILES}),
        "note": "Computed locally from file names only. No file content was read and nothing was sent to a model.",
    }


def file_hash(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def apply_write(root: str, rel: str, content: str, max_bytes: int) -> None:
    path = resolve_inside(root, rel, must_exist=False)
    check_writable_target(path, max_bytes, content)
    path.parent.mkdir(parents=True, exist_ok=True)
    resolve_inside(root, rel, must_exist=False)  # re-check after mkdir
    tmp = path.with_name(path.name + ".orbit-tmp")
    tmp.write_text(content, encoding="utf-8")
    os.replace(tmp, path)
