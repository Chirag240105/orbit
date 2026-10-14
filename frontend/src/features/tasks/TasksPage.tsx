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
  const refresh = () => qc.invalidateQueries({ queryKey: ["tasks"] });
  const add = useMutation({ mutationFn: () => api.addTask({ title: title.trim(), priority, due: due || null }), onSuccess: () => { setTitle(""); setDue(""); refresh(); } });
  const patch = useMutation({ mutationFn: (v: { id: number; b: Partial<Task> }) => api.patchTask(v.id, v.b), onSuccess: refresh });
  const del = useMutation({ mutationFn: (id: number) => api.deleteTask(id), onSuccess: refresh });
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
      <PageHeader title="Tasks and Plans" description="Plans from the AI Workspace arrive here as proposals. Nothing becomes a task until you approve it." />
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
