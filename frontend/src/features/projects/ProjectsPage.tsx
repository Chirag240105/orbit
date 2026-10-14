import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useActiveWorkspace } from "../../app/WorkspaceContext";
import { ConsentDialog } from "../../components/ConsentDialog";
import { Badge, Button, ConfirmDialog, EmptyState, ErrorState, Field, PageHeader, Panel, Skeleton, inputCls } from "../../components/ui";
import { api, consentDetails, type ConsentDetails } from "../../lib/api";
import type { Change, DraftRequest, Workspace } from "../../types/api";
import { AgentModePanel } from "./AgentModePanel";
import { AgentPanel } from "./AgentPanel";
import { DiffView } from "./DiffView";
import { FileTree } from "./FileTree";

const STATUS_COLOR = { applied: "ok", pending: "warn", rejected: "neutral", stale: "danger" } as const;

function Changes({ ws }: { ws: Workspace }) {
  const qc = useQueryClient();
  const { data, error, refetch } = useQuery({ queryKey: ["changes"], queryFn: () => api.changes() });
  const [confirm, setConfirm] = useState<Change | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const [showDone, setShowDone] = useState(false);
  const done = () => { setConfirm(null); qc.invalidateQueries({ queryKey: ["changes"] }); };
  const approve = useMutation({ mutationFn: (c: Change) => api.approve(c.id), onSuccess: () => { setErr(null); done(); }, onError: (e) => { setErr(e); done(); } });
  const reject = useMutation({ mutationFn: (c: Change) => api.reject(c.id), onSuccess: done, onError: setErr });
  if (error) return <ErrorState error={error} retry={() => refetch()} />;
  const mine = data?.filter((c) => c.workspace_id === ws.id) ?? [];
  const pending = mine.filter((c) => c.status === "pending"), decided = mine.filter((c) => c.status !== "pending");
  if (!mine.length) return <p className="text-sm text-muted">No proposed changes. Preview a file and propose an edit, ask ORBIT to draft one, or run the project agent.</p>;
  return (
    <div className="space-y-3">
      {err != null && <ErrorState error={err} />}
      {pending.length === 0 && <p className="text-sm text-muted">Nothing is waiting for approval.</p>}
      {[...pending, ...(showDone ? decided : [])].map((c) => (
        <div key={c.id} className="rounded-md border border-line p-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="break-all font-mono">{c.rel_path}</span>
            <Badge color={STATUS_COLOR[c.status]}>{c.status === "applied" ? "applied and verified" : c.status}</Badge>
            {c.origin === "ai" && <Badge color="accent">AI draft</Badge>}
            {c.description && <span className="text-muted">{c.description}</span>}
          </div>
          <div className="mt-2"><DiffView before={c.original_content} after={c.new_content} /></div>
          {c.status === "pending" && <div className="mt-3 flex gap-2"><Button variant="primary" onClick={() => setConfirm(c)}>Review and approve</Button><Button onClick={() => reject.mutate(c)}>Reject</Button></div>}
        </div>
      ))}
      {decided.length > 0 && <Button variant="ghost" aria-expanded={showDone} onClick={() => setShowDone((v) => !v)}>{showDone ? "Hide decided changes" : `Show ${decided.length} decided change(s)`}</Button>}
      <ConfirmDialog open={!!confirm} title="Write this change to disk?" confirmLabel="Approve and write" onCancel={() => setConfirm(null)} onConfirm={() => approve.mutate(confirm!)}
        body={<>This will {confirm?.original_content === null ? "create" : "overwrite"} <span className="font-mono">{confirm?.rel_path}</span> in <b>{ws.name}</b>. ORBIT checks the file hasn't changed since the proposal and verifies the result on disk. {ws.allow_write ? "" : "Write access is currently off for this workspace, so this will be refused until you turn it on."}</>} />
    </div>
  );
}

function DraftBox({ ws, path, onDone }: { ws: Workspace; path: string; onDone: () => void }) {
  const qc = useQueryClient();
  const [instruction, setInstruction] = useState("");
  const [consent, setConsent] = useState<{ req: DraftRequest; details: ConsentDetails } | null>(null);
  const draft = useMutation({
    mutationFn: (req: DraftRequest) => api.draft(ws.id, req),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["changes"] }); onDone(); },
    onError: (e, req) => { const d = consentDetails(e); if (d) setConsent({ req, details: d }); },
  });
  return (
    <div className="space-y-2 rounded-md border border-line p-3">
      <Field label={`Ask ORBIT to edit ${path}`}><textarea className={inputCls} rows={2} value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="Add docstrings to every function" /></Field>
      <div className="flex gap-2"><Button variant="primary" disabled={instruction.trim().length < 3 || draft.isPending} onClick={() => draft.mutate({ path, instruction: instruction.trim() })}>{draft.isPending ? "Drafting…" : "Draft change"}</Button><Button onClick={onDone}>Cancel</Button></div>
      <p className="text-xs text-muted">The draft becomes a proposal. Secrets are hidden from the model and put back locally.</p>
      {draft.error && !consentDetails(draft.error) && <ErrorState error={draft.error} />}
      <ConsentDialog details={consent?.details ?? null} onCancel={() => setConsent(null)} onConfirm={() => { const c = consent!; setConsent(null); draft.mutate({ ...c.req, consent_external: true }); }} />
    </div>
  );
}

function Workbench({ ws }: { ws: Workspace }) {
  const qc = useQueryClient();
  const nav = useNavigate();
  const [file, setFile] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("");
  const [mode, setMode] = useState<"view" | "edit" | "draft">("view");
  const [draft, setDraft] = useState({ content: "", note: "" });
  const [writeConfirm, setWriteConfirm] = useState(false);
  const tree = useQuery({ queryKey: ["tree", ws.id], queryFn: () => api.tree(ws.id) });
  const summary = useQuery({ queryKey: ["summary", ws.id], queryFn: () => api.summary(ws.id) });
  const hits = useQuery({ queryKey: ["search", ws.id, term], queryFn: () => api.search(ws.id, term), enabled: !!term });
  const content = useQuery({ queryKey: ["file", ws.id, file], queryFn: () => api.readFile(ws.id, file!), enabled: !!file });
  const propose = useMutation({ mutationFn: () => api.propose(ws.id, { path: file!, new_content: draft.content, description: draft.note }), onSuccess: () => { setMode("view"); qc.invalidateQueries({ queryKey: ["changes"] }); } });
  const setWrite = useMutation({ mutationFn: (v: boolean) => api.setWrite(ws.id, v), onSuccess: () => { setWriteConfirm(false); qc.invalidateQueries({ queryKey: ["workspaces"] }); } });
  const pick = (p: string) => { setFile(p); setMode("view"); };
  const s = summary.data;
  const deps = s ? Object.entries(s.dependencies) : [];

  return (
    <div className="space-y-4">
      <Panel title="Project overview" action={<Button variant={ws.allow_write ? "danger" : "secondary"} onClick={() => (ws.allow_write ? setWrite.mutate(false) : setWriteConfirm(true))}>{ws.allow_write ? "Turn off write access" : "Allow writes"}</Button>}>
        {summary.isLoading ? <Skeleton className="h-10" /> : summary.error ? <ErrorState error={summary.error} retry={() => summary.refetch()} /> : s ? (
          <div className="space-y-1 text-sm">
            <p><b>{s.file_count}</b> supported files. {Object.entries(s.by_extension).slice(0, 6).map(([e, n]) => `${e} ${n}`).join(", ")}</p>
            {s.config_files.length > 0 && <p className="text-muted">Config files: {s.config_files.join(", ")}</p>}
            {Object.keys(s.top_level_folders).length > 0 && <p className="text-muted">Top folders: {Object.keys(s.top_level_folders).join(", ")}</p>}
            {deps.map(([manifest, names]) => <p key={manifest} className="text-muted"><span className="font-mono">{manifest}</span>: {names.slice(0, 15).join(", ")}{names.length > 15 ? ` and ${names.length - 15} more` : ""}</p>)}
            <p className="pt-1 text-xs text-muted">{s.note}</p>
          </div>
        ) : null}
      </Panel>
      <Panel title="Project agent: write notes"><AgentPanel ws={ws} /></Panel>
      <Panel title={<>Agent mode <span className="ml-1 font-normal text-muted">(experimental)</span></>}><AgentModePanel ws={ws} /></Panel>
      <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <Panel title="Files">
          <form className="mb-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); setTerm(query.trim()); }}>
            <input aria-label="Search files" className={`${inputCls} min-w-0`} placeholder="Search names and content" value={query} onChange={(e) => { setQuery(e.target.value); if (!e.target.value) setTerm(""); }} /><Button type="submit">Search</Button>
          </form>
          <div className="max-h-96 overflow-auto">
            {tree.isLoading ? <Skeleton className="h-24" /> : tree.error ? <ErrorState error={tree.error} retry={() => tree.refetch()} /> : term ? (
              hits.error ? <ErrorState error={hits.error} /> : hits.data?.length ? (
                <ul className="space-y-0.5 text-sm">{hits.data.map((h, i) => (
                  <li key={i}><button className="w-full rounded px-2 py-1 text-left hover:bg-raised" onClick={() => pick(h.path)}><span className="font-mono text-xs">{h.path}{h.line ? `:${h.line}` : ""}</span>{h.snippet && <span className="block truncate text-xs text-muted">{h.snippet}</span>}</button></li>
                ))}</ul>
              ) : <p className="px-2 text-sm text-muted">{hits.isLoading ? "Searching…" : "No matches."}</p>
            ) : tree.data?.length ? <FileTree files={tree.data} selected={file} onSelect={pick} /> : <p className="px-2 text-sm text-muted">No supported files in this folder.</p>}
          </div>
        </Panel>
        <Panel title={file ?? "File preview"} action={file && mode === "view" && (
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => nav("/chat", { state: { file, prompt: `Explain ${file}` } })}>Explain with ORBIT</Button>
            <Button onClick={() => setMode("draft")}>Draft with AI</Button>
            <Button disabled={!content.data} onClick={() => { setDraft({ content: content.data!.content, note: "" }); setMode("edit"); }}>Edit manually</Button>
          </div>
        )}>
          {!file ? <p className="text-sm text-muted">Select a file to preview it. Files like .env and private keys are never listed or readable.</p>
            : content.isLoading ? <Skeleton className="h-32" /> : content.error ? <ErrorState error={content.error} retry={() => content.refetch()} />
            : mode === "edit" ? (
              <div className="space-y-3">
                <Field label="New content"><textarea className={`${inputCls} font-mono`} rows={14} value={draft.content} onChange={(e) => setDraft({ ...draft, content: e.target.value })} /></Field>
                <Field label="What does this change do?"><input className={inputCls} value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} /></Field>
                <div className="flex gap-2"><Button variant="primary" disabled={propose.isPending || draft.content === content.data?.content} onClick={() => propose.mutate()}>Submit for approval</Button><Button onClick={() => setMode("view")}>Cancel</Button></div>
                <p className="text-xs text-muted">Submitting only creates a proposal. Nothing is written until you approve it below.</p>
                {propose.error && <ErrorState error={propose.error} />}
              </div>
            ) : (
              <div className="space-y-3">
                {mode === "draft" && <DraftBox ws={ws} path={file} onDone={() => setMode("view")} />}
                <pre className="max-h-[28rem] overflow-auto rounded bg-bg p-3 font-mono text-xs leading-relaxed">{content.data?.content}</pre>
              </div>
            )}
        </Panel>
      </div>
      <Panel title="Proposed changes"><Changes ws={ws} /></Panel>
      <ConfirmDialog open={writeConfirm} title="Allow ORBIT to write files in this workspace?" confirmLabel="Allow writes" body="Writes still happen only when you approve a specific proposed change. You can turn this off at any time." onCancel={() => setWriteConfirm(false)} onConfirm={() => setWrite.mutate(true)} />
    </div>
  );
}

export function ProjectsPage() {
  const qc = useQueryClient();
  const { activeId, setActiveId } = useActiveWorkspace();
  const [path, setPath] = useState("");
  const [remove, setRemove] = useState<Workspace | null>(null);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["workspaces"], queryFn: api.workspaces });
  const add = useMutation({ mutationFn: () => api.addWorkspace(path.trim()), onSuccess: (w) => { setPath(""); setActiveId(w.id); qc.invalidateQueries({ queryKey: ["workspaces"] }); } });
  const del = useMutation({ mutationFn: (w: Workspace) => api.removeWorkspace(w.id), onSuccess: (_, w) => { if (activeId === w.id) setActiveId(null); setRemove(null); qc.invalidateQueries(); } });
  const active = data?.find((w) => w.id === activeId);

  return (
    <div>
      <PageHeader title="Projects" description="Authorize a folder so ORBIT can list, search and explain its files. Access is read-only until you allow writes, and secrets like .env files are always excluded." />
      <Panel title="Authorize a folder" className="mb-5">
        <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); if (path.trim()) add.mutate(); }}>
          <div className="min-w-0 flex-1 basis-64"><Field label="Absolute folder path"><input className={inputCls} value={path} onChange={(e) => setPath(e.target.value)} placeholder="D:\code\my-project or /home/you/code/my-project" /></Field></div>
          <Button type="submit" variant="primary" disabled={!path.trim() || add.isPending}>Authorize folder</Button>
        </form>
        {add.error && <div className="mt-3"><ErrorState error={add.error} /></div>}
        <p className="mt-2 text-xs text-muted">A browser can't open a native folder picker that returns a path, so you type it and the local backend checks it (see docs/WORKSPACE_ACCESS.md).</p>
      </Panel>
      {isLoading ? <Skeleton className="h-16" /> : error ? <ErrorState error={error} retry={() => refetch()} /> : !data?.length ? (
        <EmptyState title="No authorized folders">Authorize a project folder above to start exploring it. To try ORBIT safely, use the repository's examples/example-project folder.</EmptyState>
      ) : (
        <>
          <div className="mb-5 flex flex-wrap gap-2" role="tablist" aria-label="Workspaces">
            {data.map((w) => (
              <div key={w.id} className={`flex items-center rounded-md border ${w.id === activeId ? "border-accent bg-accent/10" : "border-line"}`}>
                <button role="tab" aria-selected={w.id === activeId} className="px-3 py-1.5 text-sm" onClick={() => setActiveId(w.id)}>{w.name}</button>
                <button aria-label={`Remove ${w.name}`} className="px-2 text-muted hover:text-danger" onClick={() => setRemove(w)}>×</button>
              </div>
            ))}
          </div>
          {active ? <Workbench key={active.id} ws={active} /> : <EmptyState title="Choose a workspace">Select one of the folders above.</EmptyState>}
        </>
      )}
      <ConfirmDialog open={!!remove} danger title="Remove this workspace?" confirmLabel="Remove" body="ORBIT loses access to the folder and its proposed changes are discarded. Your files are not touched." onCancel={() => setRemove(null)} onConfirm={() => del.mutate(remove!)} />
    </div>
  );
}
