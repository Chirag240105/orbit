import { useMutation, useQueryClient } from "@tanstack/react-query";
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
      {msg.meta?.warnings?.map((w, i) => <p key={i} className="mt-3 text-xs text-warn">{w}</p>)}
    </div>
  );
}
