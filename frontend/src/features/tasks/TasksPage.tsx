import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Button, EmptyState, ErrorState, Field, PageHeader, Panel, Skeleton, inputCls } from "../../components/ui";
import { api } from "../../lib/api";
import type { Task } from "../../types/api";

const COLS: { key: Task["status"]; label: string }[] = [{ key: "todo", label: "To do" }, { key: "doing", label: "In progress" }, { key: "done", label: "Done" }];
const NEXT: Record<string, Task["status"]> = { todo: "doing", doing: "done" };

export function TasksPage() {
  const qc = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["tasks"], queryFn: api.tasks });
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Task["priority"]>("medium");
  const [due, setDue] = useState("");
  const [planText, setPlanText] = useState("");
  const [planDate, setPlanDate] = useState(() => {
    const now = new Date(); return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
  });
  const [draft, setDraft] = useState<Awaited<ReturnType<typeof api.generateSchedule>> | null>(null);
  const plan = useQuery({ queryKey: ["schedule", planDate], queryFn: () => api.schedule(planDate) });
  const refresh = () => qc.invalidateQueries({ queryKey: ["tasks"] });
  const add = useMutation({ mutationFn: () => api.addTask({ title: title.trim(), priority, due: due || null }), onSuccess: () => { setTitle(""); setDue(""); refresh(); } });
  const patch = useMutation({ mutationFn: (v: { id: number; b: Partial<Task> }) => api.patchTask(v.id, v.b), onSuccess: refresh });
  const del = useMutation({ mutationFn: (id: number) => api.deleteTask(id), onSuccess: refresh });
  const generate = useMutation({ mutationFn: () => api.generateSchedule({ request: planText.trim(), date: planDate }), onSuccess: setDraft });
  const decideSchedule = useMutation({
    mutationFn: (approve: boolean) => approve ? api.approveAction(draft!.pending_action_id) : api.rejectAction(draft!.pending_action_id),
    onSuccess: () => { setDraft(null); setPlanText(""); qc.invalidateQueries({ queryKey: ["schedule", planDate] }); refresh(); },
  });
  const proposed = data?.filter((t) => t.status === "proposed") ?? [];

  const Row = ({ t }: { t: Task }) => (
    <li className="rounded-md border border-line bg-bg p-2.5 text-sm">
      <p>{t.title}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
        <Badge color={t.priority === "high" ? "danger" : "neutral"}>{t.priority}</Badge>
        {t.due && <span>Due {t.due}</span>}
        <span className="ml-auto flex gap-1">
          {NEXT[t.status] && <Button variant="ghost" onClick={() => patch.mutate({ id: t.id, b: { status: NEXT[t.status] } })}>{t.status === "todo" ? "Start" : "Mark done"}</Button>}
          <Button variant="ghost" onClick={() => del.mutate(t.id)}>Delete</Button>
        </span>
      </div>
    </li>
  );

  return (
    <div>
      <PageHeader title="Tasks and Plans" description="Turn a natural-language day plan into timed blocks, then approve before ORBIT saves tasks and schedule records." />
      <Panel title="Plan a day" className="mb-5">
        <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); if (planText.trim()) generate.mutate(); }}>
          <div className="min-w-56 flex-1"><Field label="What is on your day?"><textarea className={inputCls} rows={2} value={planText} onChange={(e) => setPlanText(e.target.value)} placeholder="Tomorrow I have a meeting at 11. Finish the backend, review the frontend PR, and prepare the presentation." /></Field></div>
          <Field label="Date"><input type="date" className={inputCls} value={planDate} onChange={(e) => setPlanDate(e.target.value)} /></Field>
          <Button type="submit" variant="primary" disabled={!planText.trim() || generate.isPending}>Generate schedule</Button>
        </form>
        {generate.error && <ErrorState error={generate.error} />}
        {draft && <div className="mt-4 rounded-md border border-line p-3">
          <h3 className="text-sm font-semibold">Proposed schedule · {draft.date} ({draft.timezone})</h3>
          <ul className="mt-2 space-y-2">{draft.blocks.map((block, i) => <li key={block.title + i} className="rounded bg-bg p-2 text-sm"><b>{block.starts_at.slice(11, 16)}–{block.ends_at.slice(11, 16)}</b> · {block.title}<p className="text-xs text-muted">{block.rationale}</p></li>)}</ul>
          {draft.conflicts.map((conflict, i) => <p key={i} className="mt-2 text-xs text-warn">{conflict.title}: {conflict.reason.replaceAll("_", " ")}</p>)}
          <div className="mt-3 flex gap-2"><Button disabled={decideSchedule.isPending} onClick={() => decideSchedule.mutate(false)}>Reject</Button><Button variant="primary" disabled={decideSchedule.isPending} onClick={() => decideSchedule.mutate(true)}>Approve schedule</Button></div>
        </div>}
        <div className="mt-4 border-t border-line pt-3"><h3 className="text-sm font-semibold">Saved schedule · {planDate}</h3>{plan.isLoading ? <Skeleton className="mt-2 h-10" /> : plan.error ? <ErrorState error={plan.error} retry={() => plan.refetch()} /> : !plan.data?.length ? <p className="mt-2 text-sm text-muted">No saved blocks for this day.</p> : <ul className="mt-2 space-y-1">{plan.data.map((block) => <li key={block.id} className="text-sm"><b>{block.starts_at.slice(11, 16)}–{block.ends_at.slice(11, 16)}</b> · {block.title} <span className="text-xs text-muted">{block.rationale}</span></li>)}</ul>}</div>
      </Panel>
      {isLoading ? <Skeleton className="h-24" /> : error ? <ErrorState error={error} retry={() => refetch()} /> : (
        <>
          {proposed.length > 0 && (
            <Panel title={`Proposed by ORBIT (${proposed.length})`} className="mb-5">
              <ul className="space-y-2">
                {proposed.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center gap-2 text-sm"><Badge color="warn">{t.priority}</Badge><span className="flex-1">{t.title}</span>
                    <Button variant="primary" onClick={() => patch.mutate({ id: t.id, b: { status: "todo" } })}>Approve</Button><Button onClick={() => del.mutate(t.id)}>Dismiss</Button></li>
                ))}
              </ul>
            </Panel>
          )}
          <Panel title="Add a task" className="mb-5">
            <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); if (title.trim()) add.mutate(); }}>
              <div className="min-w-56 flex-1"><Field label="Task"><input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs doing?" /></Field></div>
              <Field label="Priority"><select className={inputCls} value={priority} onChange={(e) => setPriority(e.target.value as Task["priority"])}><option>high</option><option>medium</option><option>low</option></select></Field>
              <Field label="Due"><input type="date" className={inputCls} value={due} onChange={(e) => setDue(e.target.value)} /></Field>
              <Button type="submit" variant="primary" disabled={!title.trim() || add.isPending}>Add task</Button>
            </form>
          </Panel>
          {!data?.some((t) => t.status !== "proposed") ? <EmptyState title="No tasks yet">Add one above, or ask ORBIT to "plan" a goal in the AI Workspace.</EmptyState> : (
            <div className="grid gap-4 md:grid-cols-3">
              {COLS.map((c) => (
                <section key={c.key} aria-label={c.label}><h2 className="mb-2 text-sm font-semibold">{c.label}</h2>
                  <ul className="space-y-2">{data.filter((t) => t.status === c.key).map((t) => <Row key={t.id} t={t} />)}</ul></section>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
