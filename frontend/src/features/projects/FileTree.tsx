import { useMemo, useState } from "react";
import { kb } from "../../lib/format";
import type { FileEntry } from "../../types/api";

type Dir = { name: string; path: string; dirs: Map<string, Dir>; files: FileEntry[] };

export function buildTree(files: FileEntry[]): Dir {
  const root: Dir = { name: "", path: "", dirs: new Map(), files: [] };
  for (const f of files) {
    const parts = f.path.split("/");
    let d = root;
    for (const part of parts.slice(0, -1)) {
      const path = d.path ? `${d.path}/${part}` : part;
      if (!d.dirs.has(part)) d.dirs.set(part, { name: part, path, dirs: new Map(), files: [] });
      d = d.dirs.get(part)!;
    }
    d.files.push(f);
  }
  return root;
}

const countFiles = (d: Dir): number => d.files.length + [...d.dirs.values()].reduce((n, c) => n + countFiles(c), 0);

/** Collapsible folder tree. Folders start closed, so large projects only render what is open. */
export function FileTree({ files, selected, onSelect }: { files: FileEntry[]; selected: string | null; onSelect: (path: string) => void }) {
  const root = useMemo(() => buildTree(files), [files]);
  const [open, setOpen] = useState<Set<string>>(() => new Set(selected ? selected.split("/").slice(0, -1).map((_, i, a) => a.slice(0, i + 1).join("/")) : []));
  const toggle = (p: string) => setOpen((s) => { const n = new Set(s); if (n.has(p)) n.delete(p); else n.add(p); return n; });

  const render = (d: Dir, depth: number) => (
    <ul className={depth ? "ml-3 border-l border-line pl-1" : ""}>
      {[...d.dirs.values()].sort((a, b) => a.name.localeCompare(b.name)).map((c) => (
        <li key={c.path}>
          <button aria-expanded={open.has(c.path)} onClick={() => toggle(c.path)} className="flex w-full items-center gap-1 rounded px-2 py-1 text-left text-xs hover:bg-raised">
            <span aria-hidden className="w-3 text-muted">{open.has(c.path) ? "▾" : "▸"}</span>
            <span className="truncate font-mono">{c.name}/</span>
            <span className="ml-auto shrink-0 text-muted">{countFiles(c)}</span>
          </button>
          {open.has(c.path) && render(c, depth + 1)}
        </li>
      ))}
      {d.files.map((f) => (
        <li key={f.path}>
          <button onClick={() => onSelect(f.path)} aria-current={selected === f.path ? "true" : undefined} className={`flex w-full justify-between gap-2 rounded px-2 py-1 pl-6 text-left text-xs hover:bg-raised ${selected === f.path ? "bg-raised text-text" : ""}`}>
            <span className="truncate font-mono">{f.path.split("/").pop()}</span>
            <span className="shrink-0 text-muted">{kb(f.size)}</span>
          </button>
        </li>
      ))}
    </ul>
  );

  return (
    <div>
      {root.dirs.size > 0 && (
        <div className="mb-1 flex gap-2 text-xs">
          <button className="text-muted hover:text-text" onClick={() => setOpen(new Set(files.flatMap((f) => f.path.split("/").slice(0, -1).map((_, i, a) => a.slice(0, i + 1).join("/")))))}>Expand all</button>
          <button className="text-muted hover:text-text" onClick={() => setOpen(new Set())}>Collapse all</button>
        </div>
      )}
      <nav aria-label="Project files">{render(root, 0)}</nav>
    </div>
  );
}
