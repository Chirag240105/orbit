import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ConsentDialog } from "../../components/ConsentDialog";
import { FilePicker } from "../../components/FilePicker";
import { Badge, Button, ErrorState, Field, inputCls } from "../../components/ui";
import { api, consentDetails, type ConsentDetails } from "../../lib/api";
import type { AgentRun, ProjectNotesRequest, Workspace } from "../../types/api";

const STEP_LABEL = { read: "Read authorized files", analyze: "Analyze", draft: "Draft notes", propose: "Propose the file", remember: "Remember project context" };

/** The project agent: read -> analyze -> draft -> propose -> remember. Every write still needs approval below. */
export function AgentPanel({ ws }: { ws: Workspace }) {
  const qc = useQueryClient();
  const [goal, setGoal] = useState("");
  const [notesPath, setNotesPath] = useState("ORBIT_NOTES.md");
  const [files, setFiles] = useState<string[]>([]);
  const [consent, setConsent] = useState<{ req: ProjectNotesRequest; details: ConsentDetails } | null>(null);
  const [run, setRun] = useState<AgentRun | null>(null);
  const start = useMutation({
    mutationFn: (req: ProjectNotesRequest) => api.projectNotes(ws.id, req),
    onSuccess: (r) => { setRun(r); qc.invalidateQueries({ queryKey: ["changes"] }); qc.invalidateQueries({ queryKey: ["memories"] }); qc.invalidateQueries({ queryKey: ["conversations"] }); },
    onError: (e, req) => { const d = consentDetails(e); if (d) setConsent({ req, details: d }); },
  });
  const confirmMemory = useMutation({
    mutationFn: (id: number) => api.patchMemory(id, { confirmed: true }),
    onSuccess: (m) => { setRun((r) => (r ? { ...r, memory: m } : r)); qc.invalidateQueries({ queryKey: ["memories"] }); },
  });
  const submit = () => { setRun(null); start.mutate({ goal: goal.trim(), notes_path: notesPath.trim(), file_paths: files }); };
  const showError = start.error && !consentDetails(start.error);

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">Give ORBIT a goal. It reads only the files you pick (plus the project layout), writes Markdown notes, and proposes the file. Nothing is written until you approve it below.</p>
      <Field label="Goal"><textarea className={inputCls} rows={2} value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Understand the authentication flow and write notes a new teammate can follow" /></Field>
      <div className="grid gap-3 sm:grid-cols-[1fr_14rem]">
        <div><p className="mb-1 text-sm text-muted">Files to read (up to 8)</p><FilePicker workspaceId={ws.id} question={goal} selected={files} onChange={setFiles} max={8} /></div>
        <Field label="Save notes as"><input className={`${inputCls} font-mono`} value={notesPath} onChange={(e) => setNotesPath(e.target.value)} /></Field>
      </div>
      <Button variant="primary" disabled={goal.trim().length < 3 || !notesPath.trim().endsWith(".md") || start.isPending} onClick={submit}>{start.isPending ? "Working…" : "Run project agent"}</Button>
      {showError && <ErrorState error={start.error} retry={submit} />}
      {run && (
        <div className="rounded-md border border-line p-3" aria-live="polite">
          <ol className="space-y-1.5 text-sm">
            {run.steps.map((s) => (
              <li key={s.name} className="flex gap-2">
                <span aria-hidden className={s.status === "done" ? "text-ok" : "text-muted"}>{s.status === "done" ? "✓" : "–"}</span>
                <span><span className="font-medium">{STEP_LABEL[s.name]}.</span> <span className="text-muted">{s.detail}</span></span>
              </li>
            ))}
          </ol>
          <div className="mt-2 flex flex-wrap gap-1.5">{run.provider.is_demo ? <Badge color="warn">Demo output, not model inference</Badge> : <Badge>{run.provider.model}</Badge>}{run.context.external && <Badge color="warn">Sent to hosted model</Badge>}</div>
          {run.warnings.map((w) => <p key={w} className="mt-2 text-xs text-warn">{w}</p>)}
          <p className="mt-2 text-sm">Review <span className="font-mono">{run.change.rel_path}</span> under <b>Proposed changes</b>.</p>
          {run.memory && (
            <div className="mt-3 rounded-md bg-raised p-3 text-sm">
              <p className="text-muted">Suggested project memory:</p>
              <p className="mt-1">{run.memory.content}</p>
              {run.memory.confirmed ? <p className="mt-2 text-xs text-ok">Confirmed. ORBIT will use it in later sessions.</p>
                : <Button className="mt-2" disabled={confirmMemory.isPending} onClick={() => confirmMemory.mutate(run.memory!.id)}>Confirm memory</Button>}
            </div>
          )}
        </div>
      )}
      <ConsentDialog details={consent?.details ?? null} onCancel={() => setConsent(null)} onConfirm={() => { const c = consent!; setConsent(null); start.mutate({ ...c.req, consent_external: true }); }} />
    </div>
  );
}
