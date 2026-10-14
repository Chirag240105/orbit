import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ConsentDialog } from "../../components/ConsentDialog";
import { Badge, Button, ErrorState, Field, inputCls } from "../../components/ui";
import { api, consentDetails, type ConsentDetails } from "../../lib/api";
import type { AgentLoopDone, AgentLoopRequest, AgentLoopStep, Workspace } from "../../types/api";

const TOOL_LABEL: Record<string, string> = {
  list_files: "List files", search_files: "Search", suggest_files: "Rank files", read_file: "Read",
  propose_change: "Propose change", finish: "Finish", invalid: "Unusable reply",
};

/** AG-02: the model chooses its own steps. Opt-in (Skills), consent first, read-only tools plus proposals only. */
export function AgentModePanel({ ws }: { ws: Workspace }) {
  const qc = useQueryClient();
  const skills = useQuery({ queryKey: ["skills"], queryFn: api.skills });
  const [goal, setGoal] = useState("");
  const [maxSteps, setMaxSteps] = useState(8);
  const [steps, setSteps] = useState<AgentLoopStep[]>([]);
  const [done, setDone] = useState<AgentLoopDone | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [consent, setConsent] = useState<{ req: AgentLoopRequest; details: ConsentDetails } | null>(null);
  const abort = useRef<AbortController | null>(null);
  const enabled = skills.data?.find((s) => s.name === "agent_mode")?.enabled;

  const run = async (req: AgentLoopRequest) => {
    setSteps([]); setDone(null); setError(null); setRunning(true);
    const ctrl = new AbortController();
    abort.current = ctrl;
    try {
      const result = await api.agentLoop(ws.id, req, { signal: ctrl.signal, onStep: (s) => setSteps((all) => [...all, s]) });
      setDone(result);
      qc.invalidateQueries({ queryKey: ["changes"] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
    } catch (e) {
      const d = consentDetails(e);
      if (d) setConsent({ req, details: d });
      else setError(e);
    } finally {
      setRunning(false);
    }
  };

  if (skills.isLoading) return null;
  if (!enabled) return (
    <p className="text-sm text-muted">
      Agent mode lets the model choose its own steps: rank, search and read files here, then propose changes for your approval. It can never write by itself.
      It is off by default. <Link to="/skills" className="underline hover:text-text">Turn it on in Skills</Link>.
    </p>
  );
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">The model decides which tools to use (list, search, rank, read, propose). Every step is shown. Proposals appear under <b>Proposed changes</b> and need your approval.</p>
      <Field label="What should the agent do?"><textarea className={inputCls} rows={2} value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Find where passwords are checked and propose clearer error messages" /></Field>
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Step limit">
          <select className="rounded-md border border-line bg-bg px-2 py-1.5 text-sm" value={maxSteps} onChange={(e) => setMaxSteps(Number(e.target.value))}>
            {[4, 8, 12].map((n) => <option key={n} value={n}>{n} steps</option>)}
          </select>
        </Field>
        {running
          ? <Button variant="danger" onClick={() => abort.current?.abort()}>Stop agent</Button>
          : <Button variant="primary" disabled={goal.trim().length < 3} onClick={() => run({ goal: goal.trim(), max_steps: maxSteps })}>Run agent</Button>}
      </div>
      {(steps.length > 0 || running) && (
        <ol className="space-y-2" aria-live="polite" aria-label="Agent steps">
          {steps.map((s) => (
            <li key={s.n} className="rounded-md border border-line p-2.5 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted">Step {s.n}</span>
                <Badge color={s.tool === "finish" ? "accent" : s.ok ? "ok" : "danger"}>{TOOL_LABEL[s.tool] ?? s.tool}</Badge>
                {Object.entries(s.args).map(([k, v]) => <span key={k} className="break-all font-mono text-xs text-muted">{k}={v}</span>)}
                {!s.ok && <span className="text-xs text-danger">refused</span>}
              </div>
              {s.thought && <p className="mt-1 text-text/90">{s.thought}</p>}
              {s.observation && <details className="mt-1"><summary className="cursor-pointer text-xs text-muted">Result</summary><pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded bg-bg p-2 font-mono text-xs">{s.observation}</pre></details>}
            </li>
          ))}
          {running && <li className="text-sm text-muted">The agent is working…</li>}
        </ol>
      )}
      {error != null && <ErrorState error={error} />}
      {done && (
        <div className="rounded-md border border-line p-3 text-sm">
          <div className="mb-1 flex flex-wrap gap-1.5">{done.provider.is_demo ? <Badge color="warn">Demo: scripted, not model inference</Badge> : <Badge>{done.provider.model}</Badge>}<Badge>{done.steps} step(s), {done.reads} file(s) read</Badge></div>
          <p className="whitespace-pre-wrap leading-relaxed">{done.answer}</p>
          {done.proposals.length > 0 && <p className="mt-2">Proposed for your approval: {done.proposals.map((c) => <span key={c.id} className="mr-2 font-mono">{c.rel_path}</span>)}</p>}
          {done.warnings.map((w) => <p key={w} className="mt-2 text-xs text-warn">{w}</p>)}
        </div>
      )}
      <ConsentDialog details={consent?.details ?? null} onCancel={() => setConsent(null)} onConfirm={() => { const c = consent!; setConsent(null); void run({ ...c.req, consent_external: true }); }} />
    </div>
  );
}
