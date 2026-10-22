import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useState } from "react";
import { Badge, Button, ConfirmDialog, EmptyState, ErrorState, Field, PageHeader, Panel, Skeleton, inputCls } from "../../components/ui";
import { api } from "../../lib/api";
import { timeAgo } from "../../lib/format";
import type { Memory } from "../../types/api";

const TYPES = ["USER", "PROJECT", "TASK", "PREFERENCE", "DECISION", "EVENT", "CODE_CONTEXT", "VISION"];
const typeLabel = (t: string) => t.charAt(0) + t.slice(1).toLowerCase().replace("_", " ");

export function MemoryPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [type, setType] = useState("USER");
  const [filter, setFilter] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: number; content: string } | null>(null);
  const [del, setDel] = useState<Memory | "all" | null>(null);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["memories", search], queryFn: () => api.memories(search) });
  const refresh = () => qc.invalidateQueries({ queryKey: ["memories"] });
  const add = useMutation({ mutationFn: () => api.addMemory({ content: draft.trim(), type }), onSuccess: () => { setDraft(""); refresh(); } });
  const patch = useMutation({ mutationFn: (v: { id: number; b: Partial<Memory> }) => api.patchMemory(v.id, v.b), onSuccess: () => { setEditing(null); refresh(); } });
  const remove = useMutation({ mutationFn: () => (del === "all" ? api.deleteAllMemories() : api.deleteMemory((del as Memory).id)), onSuccess: () => { setDel(null); refresh(); } });
  const counts = TYPES.map((t) => [t, data?.filter((m) => m.type === t).length ?? 0] as const).filter(([, n]) => n > 0);
  const shown = filter ? data?.filter((m) => m.type === filter) : data;

  return (
    <div>
      <PageHeader title="Memory" description="Only things you save or confirm here are used by ORBIT. When you chat, matching memories are included in the request, and are sent to the hosted model if one is configured." action={data?.length ? <Button variant="danger" onClick={() => setDel("all")}>Delete all</Button> : undefined} />
      <div className="grid items-start gap-5 xl:grid-cols-[22rem_1fr]">
        {/* The form and filters stay beside the list on wide screens, so the list gets the remaining width. */}
        <aside className="space-y-4 xl:sticky xl:top-0">
          <Panel title="Add a memory">
            <div className="space-y-3">
              <Field label="What should ORBIT remember?"><textarea className={inputCls} rows={3} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="e.g. I'm preparing for system-design interviews" /></Field>
              <div className="flex items-center gap-2">
                <select aria-label="Memory type" className="min-w-0 flex-1 rounded-lg border border-line bg-bg px-2.5 py-1.5 text-sm" value={type} onChange={(e) => setType(e.target.value)}>{TYPES.map((t) => <option key={t} value={t}>{typeLabel(t)}</option>)}</select>
                <Button variant="primary" disabled={!draft.trim() || add.isPending} onClick={() => add.mutate()}>Save memory</Button>
              </div>
            </div>
          </Panel>
          {counts.length > 0 && (
            <Panel title="Filter by type">
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter memories by type">
                <button onClick={() => setFilter(null)} aria-pressed={filter === null} className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${filter === null ? "border-accent bg-accent-soft text-text" : "border-line text-muted hover:border-muted hover:text-text"}`}>All · {data?.length ?? 0}</button>
                {counts.map(([t, n]) => (
                  <button key={t} onClick={() => setFilter(filter === t ? null : t)} aria-pressed={filter === t} className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${filter === t ? "border-accent bg-accent-soft text-text" : "border-line text-muted hover:border-muted hover:text-text"}`}>{typeLabel(t)} · {n}</button>
                ))}
              </div>
            </Panel>
          )}
        </aside>
        <section aria-label="Saved memories" className="min-w-0">
          <div className="relative mb-4">
            <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input aria-label="Search memories" className={`${inputCls} pl-9`} placeholder="Search memories" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {isLoading ? <div className="grid gap-3 lg:grid-cols-2"><Skeleton className="h-24" /><Skeleton className="h-24" /></div> : error ? <ErrorState error={error} retry={() => refetch()} /> : !shown?.length ? (
            <EmptyState title={search || filter ? "No matches" : "Nothing remembered yet"}>{search || filter ? "Try a different search or filter." : "Add a memory, or press Remember on a part in Visual Learning."}</EmptyState>
          ) : (
            <ul className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
              {shown.map((m) => (
                <li key={m.id} className="flex flex-col rounded-xl border border-line bg-surface p-4">
                  {editing?.id === m.id ? (
                    <div className="space-y-2">
                      <textarea aria-label="Edit memory" className={inputCls} rows={3} value={editing.content} onChange={(e) => setEditing({ id: m.id, content: e.target.value })} />
                      <div className="flex gap-2"><Button variant="primary" disabled={!editing.content.trim()} onClick={() => patch.mutate({ id: m.id, b: { content: editing.content.trim() } })}>Save</Button><Button onClick={() => setEditing(null)}>Cancel</Button></div>
                    </div>
                  ) : (
                    <>
                      <p className="flex-1 text-sm leading-relaxed">{m.content}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                        <Badge color={m.type === "VISION" ? "accent" : "neutral"}>{typeLabel(m.type)}</Badge>
                        <Badge>{m.source === "user" ? "You added" : "Suggested by ORBIT"}</Badge>
                        {!m.confirmed && <Badge color="warn">Unconfirmed, not used</Badge>}
                        <span>{timeAgo(m.updated_at)}</span>
                      </div>
                      <div className="mt-2 flex gap-1 border-t border-line pt-2">
                        {!m.confirmed && <Button variant="ghost" onClick={() => patch.mutate({ id: m.id, b: { confirmed: true } })}>Confirm</Button>}
                        <Button variant="ghost" onClick={() => setEditing({ id: m.id, content: m.content })}>Edit</Button>
                        <Button variant="ghost" className="ml-auto hover:text-danger" onClick={() => setDel(m)}>Delete</Button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <ConfirmDialog open={!!del} danger title={del === "all" ? "Delete all memories?" : "Delete this memory?"} body="This can't be undone." confirmLabel="Delete" onCancel={() => setDel(null)} onConfirm={() => remove.mutate()} />
    </div>
  );
}
