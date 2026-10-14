import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../../lib/api";
import { Badge, Button } from "../../components/ui";
import type { Message, ProposedTask } from "../../types/api";

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : undefined);
const list = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

function Bullets({ title, items, ordered }: { title: string; items: string[]; ordered?: boolean }) {
  if (!items.length) return null;
  const L = ordered ? "ol" : "ul";
  return (
    <div className="mt-3">
      <p className="text-xs font-medium text-muted">{title}</p>
      <L className={`mt-1 space-y-1 pl-5 text-sm ${ordered ? "list-decimal" : "list-disc"}`}>{items.map((t, i) => <li key={i}>{t}</li>)}</L>
    </div>
  );
}

const ROUTING: Record<string, string> = { model: "chosen by the model", keywords: "chosen by keywords", explicit: "you chose it", default: "default" };

export function OutputView({ msg }: { msg: Message }) {
  const qc = useQueryClient();
  const out = (typeof msg.content === "object" ? msg.content : {}) as Record<string, unknown>;
  const [done, setDone] = useState<string | null>(null);
  const main = str(out.answer) ?? str(out.summary) ?? str(out.overview) ?? str(out.explanation);
  const clarify = str(out.clarifying_question);
  const memory = str(out.suggested_memory);
  const diagram = str(out.diagram);
  const example = str(out.real_world_example);
  const tasks = (Array.isArray(out.tasks) ? out.tasks : []) as ProposedTask[];
  const remember = useMutation({ mutationFn: () => api.addMemory({ content: memory!, source: "chat_suggestion" }), onSuccess: () => { setDone("memory"); qc.invalidateQueries({ queryKey: ["memories"] }); } });
  const propose = useMutation({
    mutationFn: () => Promise.all(tasks.map((t) => api.addTask({ title: t.title, notes: t.notes, priority: ["high", "medium", "low"].includes(t.priority) ? t.priority : "medium", status: "proposed", source: "plan" }))),
    onSuccess: () => { setDone("tasks"); qc.invalidateQueries({ queryKey: ["tasks"] }); },
  });
  const p = msg.meta?.provider, c = msg.meta?.context;
  return (
    <div className="min-w-0">
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        {msg.skill && <span title={c?.routing ? `Skill ${ROUTING[c.routing] ?? c.routing}` : undefined}><Badge color="accent">Skill: {msg.skill}</Badge></span>}
        {p?.is_demo ? <Badge color="warn">Demo output, not model inference</Badge> : p && <Badge>{p.model}</Badge>}
        {c?.memory_ids?.length ? <Badge>{c.memory_ids.length} memory used</Badge> : null}
        {c?.files?.length ? <Badge>{c.files.length} file(s){c.redactions ? `, ${c.redactions} secret(s) redacted` : ""}</Badge> : null}
        {c?.layout && <Badge>Project layout</Badge>}
        {c?.external && (c.files?.length || c.layout) ? <Badge color="warn">Workspace data sent to hosted model</Badge> : null}
      </div>
      {clarify && <p className="rounded-md border border-warn/40 bg-warn/10 p-3 text-sm">{clarify}</p>}
      {main && <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{main}</p>}
      {diagram && (
        <div className="mt-3">
          <p className="text-xs font-medium text-muted">Diagram</p>
          <pre className="mt-1 overflow-x-auto rounded bg-bg p-3 font-mono text-xs leading-snug">{diagram}</pre>
        </div>
      )}
      {example && (
        <div className="mt-3">
          <p className="text-xs font-medium text-muted">Real-world example</p>
          <p className="mt-1 whitespace-pre-wrap text-sm">{example}</p>
        </div>
      )}
      <Bullets title="Key points" items={list(out.key_points)} />
      <Bullets title="Components" items={list(out.components)} />
      <Bullets title="How data flows" items={list(out.data_flow)} ordered />
      <Bullets title="Dependencies" items={list(out.dependencies)} />
      <Bullets title="Risks" items={list(out.risks)} />
      <Bullets title="Suggested next steps" items={list(out.next_steps)} />
      <Bullets title="Interview questions" items={list(out.interview_questions)} ordered />
      <Bullets title="You could ask next" items={list(out.follow_ups)} />
      {tasks.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium text-muted">Proposed tasks (not saved until you approve them)</p>
          <ul className="mt-1 space-y-1 text-sm">{tasks.map((t, i) => <li key={i}><Badge color={t.priority === "high" ? "danger" : "neutral"}>{t.priority}</Badge> {t.title}</li>)}</ul>
          <Button className="mt-2" disabled={propose.isPending || done === "tasks"} onClick={() => propose.mutate()}>{done === "tasks" ? "Sent to Tasks and Plans" : "Send to Tasks and Plans"}</Button>
        </div>
      )}
      {memory && (
        <div className="mt-3 rounded-md border border-line p-3 text-sm">
          <p className="text-muted">ORBIT suggests remembering:</p>
          <p className="mt-1">{memory}</p>
          <Button className="mt-2" disabled={remember.isPending || done === "memory"} onClick={() => remember.mutate()}>{done === "memory" ? "Saved, confirm it in Memory" : "Save to memory"}</Button>
        </div>
      )}
      {msg.meta?.warnings?.map((w, i) => <p key={i} className="mt-3 text-xs text-warn">{w}</p>)}
    </div>
  );
}
