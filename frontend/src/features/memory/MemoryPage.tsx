import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Button, ConfirmDialog, EmptyState, ErrorState, Field, PageHeader, Panel, Skeleton, inputCls } from "../../components/ui";
import { api } from "../../lib/api";
import { timeAgo } from "../../lib/format";
import type { Memory } from "../../types/api";

export function MemoryPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [type, setType] = useState("USER");
  const [editing, setEditing] = useState<{ id: number; content: string } | null>(null);
  const [del, setDel] = useState<Memory | "all" | null>(null);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["memories", search], queryFn: () => api.memories(search) });
  const refresh = () => qc.invalidateQueries({ queryKey: ["memories"] });
  const add = useMutation({ mutationFn: () => api.addMemory({ content: draft.trim(), type }), onSuccess: () => { setDraft(""); refresh(); } });
  const patch = useMutation({ mutationFn: (v: { id: number; b: Partial<Memory> }) => api.patchMemory(v.id, v.b), onSuccess: () => { setEditing(null); refresh(); } });
  const remove = useMutation({ mutationFn: () => (del === "all" ? api.deleteAllMemories() : api.deleteMemory((del as Memory).id)), onSuccess: () => { setDel(null); refresh(); } });

  return (
    <div className="max-w-3xl">
      <PageHeader title="Memory" description="Only things you save or confirm here are used by ORBIT. When you chat, matching memories are included in the request, and are sent to the hosted model if one is configured." action={data?.length ? <Button variant="danger" onClick={() => setDel("all")}>Delete all</Button> : undefined} />
      <Panel title="Add a memory" className="mb-5">
        <div className="space-y-3">
          <Field label="What should ORBIT remember?"><textarea className={inputCls} rows={2} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="e.g. I use pnpm and prefer TypeScript strict mode" /></Field>
          <div className="flex items-center gap-2">
            <select aria-label="Memory type" className="rounded-md border border-line bg-bg px-2 py-1.5 text-sm" value={type} onChange={(e) => setType(e.target.value)}>{["USER", "PROJECT", "TASK", "PREFERENCE", "DECISION", "EVENT", "CODE_CONTEXT", "VISION"].map((t) => <option key={t}>{t}</option>)}</select>
            <Button variant="primary" disabled={!draft.trim() || add.isPending} onClick={() => add.mutate()}>Save memory</Button>
          </div>
        </div>
      </Panel>
      <input aria-label="Search memories" className={`${inputCls} mb-4`} placeholder="Search memories" value={search} onChange={(e) => setSearch(e.target.value)} />
      {isLoading ? <Skeleton className="h-20" /> : error ? <ErrorState error={error} retry={() => refetch()} /> : !data?.length ? (
        <EmptyState title={search ? "No matches" : "Nothing remembered yet"}>{search ? "Try a different search." : "Add a memory above, or save one that ORBIT suggests in chat."}</EmptyState>
      ) : (
        <ul className="space-y-2">
          {data.map((m) => (
            <li key={m.id} className="rounded-lg border border-line bg-surface p-3">
              {editing?.id === m.id ? (
                <div className="space-y-2">
                  <textarea aria-label="Edit memory" className={inputCls} rows={2} value={editing.content} onChange={(e) => setEditing({ id: m.id, content: e.target.value })} />
                  <div className="flex gap-2"><Button variant="primary" disabled={!editing.content.trim()} onClick={() => patch.mutate({ id: m.id, b: { content: editing.content.trim() } })}>Save</Button><Button onClick={() => setEditing(null)}>Cancel</Button></div>
                </div>
              ) : (
                <>
                  <p className="text-sm">{m.content}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                    <Badge>{m.type}</Badge><Badge>{m.source === "user" ? "You added" : "Suggested by ORBIT"}</Badge>
                    {!m.confirmed && <Badge color="warn">Unconfirmed, not used</Badge>}
                    <span>Updated {timeAgo(m.updated_at)}</span>
                    <span className="ml-auto flex gap-1">
                      {!m.confirmed && <Button variant="ghost" onClick={() => patch.mutate({ id: m.id, b: { confirmed: true } })}>Confirm</Button>}
                      <Button variant="ghost" onClick={() => setEditing({ id: m.id, content: m.content })}>Edit</Button>
                      <Button variant="ghost" onClick={() => setDel(m)}>Delete</Button>
                    </span>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog open={!!del} danger title={del === "all" ? "Delete all memories?" : "Delete this memory?"} body="This can't be undone." confirmLabel="Delete" onCancel={() => setDel(null)} onConfirm={() => remove.mutate()} />
    </div>
  );
}
