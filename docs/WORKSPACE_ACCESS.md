# Workspace access

**Authorizing:** Projects → enter an absolute folder path. The backend resolves it (`realpath`), rejects drive roots, the home folder, and top-level system folders, and stores it.

**Reading:** every path goes through `resolve_inside(root, rel)`: reject absolute paths and `..`, resolve symlinks, require the result to be inside the root, reject excluded directories (`.git`, `node_modules`, `.ssh`, …) and file names (`.env*`, `*.pem`, `*.key`, `id_rsa*`, `credentials*`, `*secret*`, …; `.env.example` is allowed). Then: extension allowlist (`.md .txt .js .jsx .ts .tsx .py .json .yaml .yml .toml .ini .cfg .html .css .sql`), size limit (default 200 KB), no binary.

**Searching, listing, suggesting:** only files that pass the same rules; symlinks are skipped. `suggest` ranks files for a question by file-name matches and BM25 over content, entirely on this computer, and explains each suggestion. The user picks which suggestions to use.

**Summary:** file counts, folders, config files, and dependency names parsed from `package.json`, `pyproject.toml` and `requirements.txt`. Skills that use it (project overview, project agent) send it to a hosted model only after consent.

**Writing:** `propose` (or an AI draft, or the project agent) stores a proposal only. `approve` needs (1) workspace `allow_write`, (2) explicit confirmation, (3) unchanged file hash. The write is atomic (temp file + rename). On Linux/macOS each directory is opened with `O_NOFOLLOW` relative to the previous one, so a directory swapped for a symlink after the check cannot redirect the write (SEC-04). On Windows the path is re-verified just before the rename. The written file's hash is then checked against the approved content.

**Sending to a model:** only files you select (plus the layout for project skills), redacted, capped at `max_context_chars`, and only after you confirm when the provider is hosted. When the model drafts a file, secrets are replaced by numbered placeholders and put back locally, so they never leave and are not lost.

**Folder picker (SEC-02):** a web page cannot get an absolute path from a native folder dialog (browsers hide it on purpose), so you type the path and the backend validates it. A real picker needs the desktop packaging in `DEPLOYMENT.md`.

**Known gaps:** the Windows write path narrows but does not close the check-then-write window; redaction is best effort.
