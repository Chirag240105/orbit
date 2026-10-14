import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Button, ConfirmDialog, EmptyState, ErrorState, Field, PageHeader, Panel, Skeleton, inputCls } from "../../components/ui";
import { api } from "../../lib/api";
import { timeAgo } from "../../lib/format";
import type { Memory } from "../../types/api";

const TYPES: Memory["type"][] = ["fact", "preference", "project", "other"];
const SOURCE_LABEL: Record<string, string> = { user: "You added", chat_suggestion: "Suggested in chat", agent: "Suggested by the project agent" };
type Filters = { type: string; source: string; status: string };
const NO_FILTERS: Filters = { type: "", source: "", status: "" };

export const applyFilters = (items: Memory[], f: Filters) =>
  items.filter((m) => (!f.type || m.type === f.type) && (!f.source || (f.source === "user" ? m.source === "user" : m.source !== "user"))
    && (!f.status || (f.status === "confirmed") === m.confirmed));

export function MemoryPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [draft, setDraft] = useState("");
  const [type, setType] = useState<Memory["type"]>("fact");
  const [editing, setEditing] = useState<{ id: number; content: string } | null>(null);
  const [del, setDel] = useState<Memory | "all" | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["memories", search], queryFn: () => api.memories(search) });
  const refresh = () => qc.invalidateQueries({ queryKey: ["memories"] });
  const add = useMutation({ mutationFn: () => api.addMemory({ content: draft.trim(), type }), onSuccess: () => { setDraft(""); refresh(); } });
  const patch = useMutation({ mutationFn: (v: { id: number; b: Partial<Memory> }) => api.patchMemory(v.id, v.b), onSuccess: () => { setEditing(null); refresh(); } });
  const confirmMany = useMutation({ mutationFn: (ids: number[]) => Promise.all(ids.map((id) => api.patchMemory(id, { confirmed: true }))), onSuccess: () => { setPicked(new Set()); refresh(); } });
  const remove = useMutation({ mutationFn: () => (del === "all" ? api.deleteAllMemories() : api.deleteMemory((del as Memory).id)), onSuccess: () => { setDel(null); refresh(); } });
  const shown = data ? applyFilters(data, filters) : [];
  const unconfirmed = shown.filter((m) => !m.confirmed);
  const filtering = filters.type || filters.source || filters.status;
  const toggle = (id: number) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const select = (label: string, key: keyof Filters, options: [string, string][]) => (
    <select aria-label={label} className="rounded-md border border-line bg-bg px-2 py-1.5 text-sm" value={filters[key]} onChange={(e) => setFilters({ ...filters, [key]: e.target.value })}>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );

  return (
    <div className="max-w-3xl">
      <PageHeader title="Memory" description="Only things you save or confirm here are used by ORBIT. When you chat, matching memories are included in the request, and are sent to the hosted model if one is configured." action={data?.length ? <Button variant="danger" onClick={() => setDel("all")}>Delete all</Button> : undefined} />
      <Panel title="Add a memory" className="mb-5">
        <div className="space-y-3">
          <Field label="What should ORBIT remember?"><textarea className={inputCls} rows={2} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="e.g. I use pnpm and prefer TypeScript strict mode" /></Field>
          <div className="flex flex-wrap items-center gap-2">
            <select aria-label="Memory type" className="rounded-md border border-line bg-bg px-2 py-1.5 text-sm" value={type} onChange={(e) => setType(e.target.value as Memory["type"])}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select>
            <Button variant="primary" disabled={!draft.trim() || add.isPending} onClick={() => add.mutate()}>Save memory</Button>
          </div>
          {add.error && <ErrorState error={add.error} />}
        </div>
      </Panel>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input aria-label="Search memories" className={`${inputCls} min-w-0 flex-1 basis-48`} placeholder="Search memories" value={search} onChange={(e) => setSearch(e.target.value)} />
        {select("Filter by type", "type", [["", "Any type"], ...TYPES.map((t): [string, string] => [t, t])])}
        {select("Filter by source", "source", [["", "Any source"], ["user", "Added by you"], ["suggested", "Suggested by ORBIT"]])}
        {select("Filter by status", "status", [["", "Any status"], ["confirmed", "Confirmed"], ["unconfirmed", "Unconfirmed"]])}
        {filtering && <Button variant="ghost" onClick={() => setFilters(NO_FILTERS)}>Clear filters</Button>}
      </div>
      {unconfirmed.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-warn/40 bg-warn/10 px-3 py-2 text-sm">
          <span>{unconfirmed.length} suggestion(s) waiting. Unconfirmed memories are never used.</span>
          <span className="ml-auto flex gap-2">
            <Button disabled={!picked.size || confirmMany.isPending} onClick={() => confirmMany.mutate([...picked])}>Confirm selected ({picked.size})</Button>
            <Button disabled={confirmMany.isPending} onClick={() => confirmMany.mutate(unconfirmed.map((m) => m.id))}>Confirm all shown</Button>
          </span>
        </div>
      )}
      {confirmMany.error && <ErrorState error={confirmMany.error} />}
      {isLoading ? <Skeleton className="h-20" /> : error ? <ErrorState error={error} retry={() => refetch()} /> : !shown.length ? (
        <EmptyState title={search || filtering ? "No matches" : "Nothing remembered yet"}>{search || filtering ? "Try a different search or clear the filters." : "Add a memory above, or save one that ORBIT suggests in chat."}</EmptyState>
      ) : (
        <ul className="space-y-2">
          {shown.map((m) => (
            <li key={m.id} className="rounded-lg border border-line bg-surface p-3">
              {editing?.id === m.id ? (
                <div className="space-y-2">
                  <textarea aria-label="Edit memory" className={inputCls} rows={2} value={editing.content} onChange={(e) => setEditing({ id: m.id, content: e.target.value })} />
                  <div className="flex gap-2"><Button variant="primary" disabled={!editing.content.trim()} onClick={() => patch.mutate({ id: m.id, b: { content: editing.content.trim() } })}>Save</Button><Button onClick={() => setEditing(null)}>Cancel</Button></div>
                </div>
              ) : (
                <div className="flex gap-3">
                  {!m.confirmed && <input type="checkbox" className="mt-1" aria-label={`Select "${m.content}"`} checked={picked.has(m.id)} onChange={() => toggle(m.id)} />}
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm">{m.content}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                      <Badge>{m.type}</Badge><Badge>{SOURCE_LABEL[m.source] ?? "Suggested by ORBIT"}</Badge>
                      {!m.confirmed && <Badge color="warn">Unconfirmed, not used</Badge>}
                      <span>Updated {timeAgo(m.updated_at)}</span>
                      <span className="ml-auto flex gap-1">
                        {!m.confirmed && <Button variant="ghost" onClick={() => patch.mutate({ id: m.id, b: { confirmed: true } })}>Confirm</Button>}
                        <Button variant="ghost" onClick={() => setEditing({ id: m.id, content: m.content })}>Edit</Button>
                        <Button variant="ghost" onClick={() => setDel(m)}>Delete</Button>
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog open={!!del} danger title={del === "all" ? "Delete all memories?" : "Delete this memory?"} body="This can't be undone." confirmLabel="Delete" onCancel={() => setDel(null)} onConfirm={() => remove.mutate()} />
    </div>
  );
}
