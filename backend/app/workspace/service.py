import errno
import hashlib
import json
import math
import os
import re
import tomllib
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


# ---------- ranked retrieval (BE-03) ----------
_IDENT = re.compile(r"[A-Z]+(?=[A-Z][a-z])|[A-Z]?[a-z]+|[A-Z]+|\d+")
_RANK_STOP = {
    "the", "and", "for", "with", "that", "this", "what", "how", "are", "you", "can", "does", "from", "about",
    "have", "was", "will", "into", "please", "where", "which", "file", "files", "code", "project", "explain",
    "show", "find", "tell", "work", "works", "use", "used", "using", "identify", "understand", "create", "notes",
}


def _terms(text: str) -> list[str]:
    """Split identifiers (camelCase, snake_case, kebab-case) into lowercase words."""
    return [w.lower() for w in _IDENT.findall(text) if len(w) > 2 and w.lower() not in _RANK_STOP]


def _stem(w: str) -> str:
    return w[:5]


def _related(a: str, b: str) -> bool:
    """'auth' ~ 'authentication', 'route' ~ 'routes'."""
    return a.startswith(b) or b.startswith(a) if min(len(a), len(b)) >= 3 else a == b


def rank_files(root: str, question: str, max_bytes: int, limit: int = 8) -> list[dict]:
    """Score authorized files for a question using file names and BM25 over content. Local only:
    nothing is sent anywhere, and the caller decides which suggestions to use."""
    q = list(dict.fromkeys(_terms(question)))
    if not q:
        return []
    docs: list[tuple[str, Path, Counter, int]] = []
    for rel, full in _walk(root):
        counts: Counter = Counter()
        if full.stat().st_size <= max_bytes:
            try:
                counts = Counter(_stem(t) for t in _terms(full.read_text("utf-8", errors="ignore")[:100_000]))
            except OSError:
                pass
        docs.append((rel, full, counts, sum(counts.values())))
    if not docs:
        return []

    def tf(counts: Counter, term: str) -> int:
        if len(term) >= 5:
            return counts.get(_stem(term), 0)
        return sum(v for k, v in counts.items() if k.startswith(term))

    n, avg_len = len(docs), (sum(d[3] for d in docs) / len(docs)) or 1.0
    df = {t: sum(1 for d in docs if tf(d[2], t)) for t in q}
    out = []
    for rel, _, counts, length in docs:
        parts = rel.lower().split("/")
        stem_words, dir_words = _terms(Path(parts[-1]).stem), [w for p in parts[:-1] for w in _terms(p)]
        name_hits = [t for t in q if any(_related(t, w) for w in stem_words)]
        dir_hits = [t for t in q if t not in name_hits and any(_related(t, w) for w in dir_words)]
        score, content_hits = 3.0 * len(name_hits) + 1.0 * len(dir_hits), []
        for t in q:
            f = tf(counts, t)
            if f:
                idf = math.log(1 + (n - df[t] + 0.5) / (df[t] + 0.5))
                score += idf * f * 2.2 / (f + 1.2 * (0.25 + 0.75 * length / avg_len))
                content_hits.append(f"{t} ×{f}")
        if score > 0:
            reasons = ([f"name matches {', '.join(name_hits)}"] if name_hits else []) + (
                [f"folder matches {', '.join(dir_hits)}"] if dir_hits else []) + (
                [f"mentions {', '.join(content_hits[:3])}"] if content_hits else [])
            out.append({"path": rel, "score": round(score, 3), "reasons": reasons})
    out.sort(key=lambda r: (-r["score"], r["path"]))
    return out[:limit]


# ---------- summary ----------
def _dependencies(root: str, files: list[tuple[str, Path]], max_bytes: int) -> dict[str, list[str]]:
    """Dependency names from top-level manifests, parsed locally. Never raises on a malformed manifest."""
    deps: dict[str, list[str]] = {}
    present = {rel for rel, _ in files}
    try:
        if "package.json" in present:
            data = json.loads(read_text(root, "package.json", max_bytes))
            names = sorted({*data.get("dependencies", {}), *data.get("devDependencies", {})})
            if names:
                deps["package.json"] = names
        if "pyproject.toml" in present:
            data = tomllib.loads(read_text(root, "pyproject.toml", max_bytes))
            project = data.get("project", {})
            raw = list(project.get("dependencies", [])) + [d for ds in project.get("optional-dependencies", {}).values() for d in ds]
            names = sorted({re.split(r"[\s<>=!~;\[(]", d, maxsplit=1)[0] for d in raw if d.strip()})
            if names:
                deps["pyproject.toml"] = names
        if "requirements.txt" in present:
            lines = read_text(root, "requirements.txt", max_bytes).splitlines()
            names = sorted({re.split(r"[\s<>=!~;\[]", ln.strip(), maxsplit=1)[0] for ln in lines if ln.strip() and not ln.lstrip().startswith(("#", "-"))})
            if names:
                deps["requirements.txt"] = names
    except (AppError, ValueError, tomllib.TOMLDecodeError, AttributeError):
        pass
    return deps


def summarize(root: str, max_bytes: int = 200_000) -> dict:
    files = list(_walk(root))
    exts = Counter(f.suffix.lower() for _, f in files)
    tops = Counter(rel.split("/")[0] for rel, _ in files if "/" in rel)
    return {
        "file_count": len(files),
        "by_extension": dict(exts.most_common()),
        "top_level_folders": dict(tops.most_common(12)),
        "config_files": sorted({Path(rel).name for rel, _ in files if Path(rel).name in CONFIG_FILES}),
        "dependencies": _dependencies(root, files, max_bytes),
        "note": "Computed locally from file names and dependency manifests. Nothing was sent to a model.",
    }


# ---------- writing ----------
def file_hash(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def content_hash(content: str) -> str:
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


# POSIX: walk with directory file descriptors and O_NOFOLLOW so a directory swapped for a symlink
# after the policy check cannot redirect the write (SEC-04). Elsewhere: re-verify right before replacing.
_DIR_FD_WRITES = all(hasattr(os, f) for f in ("O_NOFOLLOW", "O_DIRECTORY")) and {os.open, os.mkdir, os.rename, os.unlink, os.stat} <= os.supports_dir_fd


def _escaped() -> AppError:
    return AppError("path_not_allowed", "The path changed while writing and now leaves the workspace. Nothing was written.", 409)


def _write_with_dir_fds(root: Path, parts: tuple[str, ...], data: bytes) -> None:
    dir_flags = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW
    fd = os.open(root, os.O_RDONLY | os.O_DIRECTORY)
    try:
        for part in parts[:-1]:
            try:
                nxt = os.open(part, dir_flags, dir_fd=fd)
            except FileNotFoundError:
                os.mkdir(part, 0o755, dir_fd=fd)
                nxt = os.open(part, dir_flags, dir_fd=fd)
            os.close(fd)
            fd = nxt
        name, tmp = parts[-1], parts[-1] + ".orbit-tmp"
        try:
            mode = os.stat(name, dir_fd=fd, follow_symlinks=False).st_mode & 0o777
        except FileNotFoundError:
            mode = 0o644
        try:
            os.unlink(tmp, dir_fd=fd)
        except FileNotFoundError:
            pass
        tfd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, mode, dir_fd=fd)
        try:
            view = memoryview(data)
            while view:
                view = view[os.write(tfd, view):]
        finally:
            os.close(tfd)
        os.rename(tmp, name, src_dir_fd=fd, dst_dir_fd=fd)  # POSIX rename atomically replaces
    except OSError as exc:
        if exc.errno in (errno.ELOOP, errno.ENOTDIR):  # a path component became a symlink
            raise _escaped() from None
        raise
    finally:
        os.close(fd)


def _write_checked(root: Path, path: Path, data: bytes) -> None:
    """Fallback without dir fds (Windows): a narrower window, not a closed one. See docs/SECURITY_MODEL.md."""

    def verify() -> None:
        try:
            Path(os.path.realpath(path.parent)).relative_to(root)
        except ValueError:
            raise _escaped() from None
        if any(p.is_symlink() for p in (path.parent, *path.parent.parents) if p == root or root in p.parents):
            raise _escaped()

    path.parent.mkdir(parents=True, exist_ok=True)
    verify()
    tmp = path.with_name(path.name + ".orbit-tmp")
    tmp.write_bytes(data)
    try:
        verify()
    except AppError:
        tmp.unlink(missing_ok=True)
        raise
    os.replace(tmp, path)


def apply_write(root: str, rel: str, content: str, max_bytes: int) -> None:
    path = resolve_inside(root, rel, must_exist=False)
    check_writable_target(path, max_bytes, content)
    real_root = Path(os.path.realpath(root))
    data = content.encode("utf-8")  # bytes: no newline translation, so the hash check below is exact
    if _DIR_FD_WRITES:
        _write_with_dir_fds(real_root, path.relative_to(real_root).parts, data)
    else:
        _write_checked(real_root, path, data)
    written = resolve_inside(root, rel)
    if file_hash(written) != hashlib.sha256(data).hexdigest():
        raise AppError("write_verification_failed", "The file on disk does not match the approved content after writing.", 500)
