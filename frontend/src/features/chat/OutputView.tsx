import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../../lib/api";
import { Badge, Button } from "../../components/ui";
import type { Message, ProposedTask } from "../../types/api";

const str = (v: unknown) => (typeof v === "string" ? v : undefined);
const list = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

function Bullets({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="mt-3">
      <p className="text-xs font-medium text-muted">{title}</p>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">{items.map((t, i) => <li key={i}>{t}</li>)}</ul>
    </div>
  );
}

export function OutputView({ msg }: { msg: Message }) {
  const qc = useQueryClient();
  const out = (typeof msg.content === "object" ? msg.content : {}) as Record<string, unknown>;
  const [done, setDone] = useState<string | null>(null);
  const [why, setWhy] = useState(false);
  const [actionStates, setActionStates] = useState<Record<number, string>>({});
  const memories = useQuery({ queryKey: ["memories"], queryFn: () => api.memories() });
  const main = str(out.answer) ?? str(out.summary) ?? str(out.overview);
  const clarify = str(out.clarifying_question);
  const memory = str(out.suggested_memory);
  const tasks = (Array.isArray(out.tasks) ? out.tasks : []) as ProposedTask[];
  const remember = useMutation({ mutationFn: () => api.addMemory({ content: memory!, source: "chat_suggestion" }), onSuccess: () => { setDone("memory"); qc.invalidateQueries({ queryKey: ["memories"] }); } });
  const propose = useMutation({
    mutationFn: () => Promise.all(tasks.map((t) => api.addTask({ title: t.title, notes: t.notes, priority: (["high", "medium", "low"].includes(t.priority) ? t.priority : "medium") as ProposedTask["priority"], status: "proposed", source: "plan" }))),
    onSuccess: () => { setDone("tasks"); qc.invalidateQueries({ queryKey: ["tasks"] }); },
  });
  const p = msg.meta?.provider, c = msg.meta?.context;
  const pendingActions = msg.meta?.pending_actions ?? [];
  const decide = useMutation({
    mutationFn: ({ id, approve }: { id: number; approve: boolean }) => approve ? api.approveAction(id) : api.rejectAction(id),
    onSuccess: (r) => { setActionStates((s) => ({ ...s, [r.id]: r.status })); qc.invalidateQueries({ queryKey: ["tasks"] }); qc.invalidateQueries({ queryKey: ["memories"] }); },
  });
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        {msg.skill && <Badge color="accent">Skill: {msg.skill}</Badge>}
        {p?.is_demo ? <Badge color="warn">Demo output, not model inference</Badge> : p && <Badge>{p.model}</Badge>}
        {c?.memory_ids?.length ? <Badge>{c.memory_ids.length} memory used</Badge> : null}
        {c?.files?.length ? <Badge>{c.files.length} file(s){c.redactions ? `, ${c.redactions} secret(s) redacted` : ""}</Badge> : null}
        {c?.external && <Badge color="warn">Sent to hosted model</Badge>}
      </div>
      {clarify && <p className="rounded-md border border-warn/40 bg-warn/10 p-3 text-sm">{clarify}</p>}
      {main && <p className="whitespace-pre-wrap text-sm leading-relaxed">{main}</p>}
      {!!c?.memory_ids?.length && <div className="mt-2 flex flex-wrap gap-1" aria-label="Recalled memories">{c.memory_ids.map((id) => <span key={id} className="rounded-full border border-line px-2 py-0.5 text-xs text-muted">{memories.data?.find((m) => m.id === id)?.content ?? `Memory #${id}`}</span>)}</div>}
      {pendingActions.map((action) => <div key={action.pending_action_id} className="mt-3 rounded-md border border-warn/40 bg-warn/10 p-3 text-sm"><p><b>{action.tool_name}</b> is waiting for approval.</p>{action.draft?.blocks.map((block, i) => <p key={i} className="mt-1">{block.starts_at.slice(11, 16)}–{block.ends_at.slice(11, 16)} · {block.title}</p>)}{actionStates[action.pending_action_id] ? <Badge>{actionStates[action.pending_action_id]}</Badge> : <div className="mt-2 flex gap-2"><Button disabled={decide.isPending} onClick={() => decide.mutate({ id: action.pending_action_id, approve: false })}>Reject</Button><Button variant="primary" disabled={decide.isPending} onClick={() => decide.mutate({ id: action.pending_action_id, approve: true })}>Approve</Button></div>}</div>)}
      <Bullets title="Key points" items={list(out.key_points)} />
      <Bullets title="Risks" items={list(out.risks)} />
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
      <button className="mt-3 text-xs text-muted underline" onClick={() => setWhy((v) => !v)} aria-expanded={why}>Why this answer</button>
      {why && <div className="mt-2 rounded-md bg-raised p-3 text-xs text-muted"><p>Intent: {msg.meta?.intent ?? "chat"}; skill: {msg.skill ?? "none"}.</p><p>Provider: {p?.name ?? "unknown"} ({p?.model ?? "model unavailable"}).</p><p>Memory records used: {c?.memory_ids?.length ?? 0}; selected files: {c?.files?.length ?? 0}.</p>{msg.meta?.tool_calls?.map((tool, i) => <p key={i}>Tool {tool.name}: {tool.status}</p>)}</div>}
      {msg.meta?.warnings?.map((w, i) => <p key={i} className="mt-3 text-xs text-warn">{w}</p>)}
    </div>
  );
}
