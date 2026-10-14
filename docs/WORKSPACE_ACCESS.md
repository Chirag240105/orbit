# Workspace access

**Authorizing:** Projects → enter an absolute folder path. The backend resolves it (`realpath`), rejects drive roots, the home folder, and top-level system folders, and stores it.

**Reading:** every path goes through `resolve_inside(root, rel)`: reject absolute paths and `..`, resolve symlinks, require the result to be inside the root, reject excluded directories (`.git`, `node_modules`, `.ssh`, …) and file names (`.env*`, `*.pem`, `*.key`, `id_rsa*`, `credentials*`, `*secret*`, …; `.env.example` is allowed). Then: extension allowlist (`.md .txt .js .jsx .ts .tsx .py .json .yaml .yml .toml .ini .cfg .html .css .sql`), size limit (default 200 KB), no binary.

**Searching/listing:** only files that pass the same rules; symlinks are skipped.

**Writing:** `propose` stores a proposal only. `approve` needs (1) workspace `allow_write`, (2) explicit confirmation, (3) unchanged file hash. The write is atomic (temp file + replace).

**Sending to a model:** only files you select, redacted, capped at `max_context_chars`, and only after you confirm when the provider is hosted.

**Known gaps:** a symlink swapped between the check and the write (SEC-04); no folder-picker (the browser can't read paths); redaction is best effort.
