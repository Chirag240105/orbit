import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../lib/api";
import type { FileSuggestion } from "../types/api";
import { Button, ErrorState, inputCls } from "./ui";

/** Choose workspace files to include. "Suggest files" ranks files locally for the question (BE-03);
 * nothing is sent anywhere until the request itself is confirmed. */
export function FilePicker({ workspaceId, question, selected, onChange, max = 5 }: { workspaceId: number; question: string; selected: string[]; onChange: (files: string[]) => void; max?: number }) {
  const [path, setPath] = useState("");
  const [hits, setHits] = useState<FileSuggestion[] | null>(null);
  const suggest = useMutation({ mutationFn: () => api.suggest(workspaceId, question), onSuccess: setHits });
  const add = (p: string) => { const v = p.trim(); if (v && !selected.includes(v) && selected.length < max) onChange([...selected, v]); };
  const toggle = (p: string) => (selected.includes(p) ? onChange(selected.filter((f) => f !== p)) : add(p));
  const full = selected.length >= max;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <form className="flex min-w-0 flex-1 gap-2" onSubmit={(e) => { e.preventDefault(); add(path); setPath(""); }}>
          <input aria-label="Add a file by path" value={path} onChange={(e) => setPath(e.target.value)} placeholder="File path, e.g. src/app.py" className={`${inputCls} min-w-0`} disabled={full} />
          <Button type="submit" disabled={!path.trim() || full}>Add</Button>
        </form>
        <Button onClick={() => suggest.mutate()} disabled={question.trim().length < 3 || suggest.isPending} title="Rank files on this computer by relevance to your message">{suggest.isPending ? "Finding…" : "Suggest files"}</Button>
      </div>
      {selected.length > 0 && (
        <ul aria-label="Selected files" className="flex flex-wrap gap-1.5">
          {selected.map((f) => (
            <li key={f} className="flex items-center gap-1 rounded bg-raised py-0.5 pl-2 pr-1 font-mono text-xs">
              {f}<button aria-label={`Remove ${f}`} className="rounded px-1 text-muted hover:text-danger" onClick={() => toggle(f)}>×</button>
            </li>
          ))}
        </ul>
      )}
      {suggest.error && <ErrorState error={suggest.error} />}
      {hits && (hits.length === 0 ? <p className="text-xs text-muted">No file matched. Add one by path instead.</p> : (
        <fieldset className="rounded-md border border-line p-2">
          <legend className="px-1 text-xs text-muted">Suggested (ranked locally{full ? `; max ${max} files` : ""})</legend>
          <ul className="max-h-40 space-y-1 overflow-y-auto">
            {hits.map((h) => (
              <li key={h.path}>
                <label className="flex cursor-pointer items-start gap-2 text-xs">
                  <input type="checkbox" className="mt-0.5" checked={selected.includes(h.path)} disabled={!selected.includes(h.path) && full} onChange={() => toggle(h.path)} />
                  <span className="min-w-0"><span className="font-mono">{h.path}</span><span className="block text-muted">{h.reasons.join(" · ")}</span></span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      ))}
    </div>
  );
}
