import { useMemo, useState } from "react";
import { diffLines, diffStats, type DiffLine } from "../../lib/diff";

const CONTEXT = 3;
type Row = { type: "line"; line: DiffLine } | { type: "gap"; id: number; lines: DiffLine[] };

/** Unchanged runs longer than 2×CONTEXT are folded, keeping CONTEXT lines around each change. */
function fold(lines: DiffLine[]): Row[] {
  const rows: Row[] = [];
  let i = 0, gapId = 0;
  while (i < lines.length) {
    if (lines[i].kind !== "same") { rows.push({ type: "line", line: lines[i++] }); continue; }
    let j = i;
    while (j < lines.length && lines[j].kind === "same") j++;
    const run = lines.slice(i, j);
    const head = i === 0 ? 0 : CONTEXT, tail = j === lines.length ? 0 : CONTEXT;
    if (run.length > head + tail + 2) {
      run.slice(0, head).forEach((l) => rows.push({ type: "line", line: l }));
      rows.push({ type: "gap", id: gapId++, lines: run.slice(head, run.length - tail) });
      run.slice(run.length - tail).forEach((l) => rows.push({ type: "line", line: l }));
    } else run.forEach((l) => rows.push({ type: "line", line: l }));
    i = j;
  }
  return rows;
}

const STYLE = { add: "bg-ok/10 text-ok", del: "bg-danger/10 text-danger", same: "text-text/80" };
const SIGN = { add: "+", del: "−", same: " " };

export function DiffView({ before, after }: { before: string | null; after: string }) {
  const lines = useMemo(() => diffLines(before ?? "", after), [before, after]);
  const stats = diffStats(lines);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const rows = useMemo(() => fold(lines), [lines]);

  return (
    <div>
      <p className="mb-1 text-xs text-muted">
        {before === null ? "New file" : "Changes"}: <span className="text-ok">+{stats.added}</span> <span className="text-danger">−{stats.removed}</span>
      </p>
      <div className="max-h-80 overflow-auto rounded border border-line bg-bg font-mono text-xs" role="table" aria-label="Proposed changes, line by line">
        {rows.flatMap((r) =>
          r.type === "gap" && !expanded.has(r.id)
            ? [<button key={`g${r.id}`} onClick={() => setExpanded((s) => new Set(s).add(r.id))} className="block w-full bg-raised/60 px-2 py-0.5 text-left text-muted hover:text-text">⋯ Show {r.lines.length} unchanged lines</button>]
            : (r.type === "gap" ? r.lines : [r.line]).map((l, k) => (
              <div key={`${r.type === "gap" ? `g${r.id}-` : ""}${l.kind}${l.oldNo ?? ""}-${l.newNo ?? ""}-${k}`} role="row" className={`flex whitespace-pre ${STYLE[l.kind]}`}>
                <span role="cell" className="w-10 shrink-0 select-none pr-1 text-right text-muted">{l.oldNo ?? ""}</span>
                <span role="cell" className="w-10 shrink-0 select-none pr-1 text-right text-muted">{l.newNo ?? ""}</span>
                <span role="cell" aria-label={l.kind === "add" ? "added" : l.kind === "del" ? "removed" : undefined} className="w-4 shrink-0 select-none">{SIGN[l.kind]}</span>
                <span role="cell" className="pr-2">{l.text || " "}</span>
              </div>
            )),
        )}
      </div>
    </div>
  );
}
