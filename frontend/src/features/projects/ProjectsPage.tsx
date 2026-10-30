import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useActiveWorkspace } from "../../app/WorkspaceContext";
import { Badge, Button, ConfirmDialog, EmptyState, ErrorState, Field, PageHeader, Panel, Skeleton, inputCls } from "../../components/ui";
import { ApiError, api } from "../../lib/api";
import { kb } from "../../lib/format";
import type { Change, CodeExplainResult, SceneResponse, Workspace } from "../../types/api";

function Changes({ ws }: { ws: Workspace }) {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["changes"], queryFn: () => api.changes() });
  const [confirm, setConfirm] = useState<Change | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const done = () => { setConfirm(null); qc.invalidateQueries({ queryKey: ["changes"] }); };
  const approve = useMutation({ mutationFn: (c: Change) => api.approve(c.id), onSuccess: () => { setErr(null); done(); }, onError: (e) => { setErr(e); setConfirm(null); qc.invalidateQueries({ queryKey: ["changes"] }); } });
  const reject = useMutation({ mutationFn: (c: Change) => api.reject(c.id), onSuccess: done });
  const mine = data?.filter((c) => c.workspace_id === ws.id) ?? [];
  if (!mine.length) return <p className="text-sm text-muted">No proposed changes. Preview a file and choose "Propose a change".</p>;
  return (
    <div className="space-y-3">
      {err != null && <ErrorState error={err} />}
      {mine.map((c) => (
        <div key={c.id} className="rounded-md border border-line p-3">
          <div className="flex flex-wrap items-center gap-2 text-sm"><span className="font-mono">{c.rel_path}</span><Badge color={c.status === "applied" ? "ok" : c.status === "pending" ? "warn" : "neutral"}>{c.status}</Badge>{c.description && <span className="text-muted">{c.description}</span>}</div>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            <div><p className="mb-1 text-xs text-muted">Current</p><pre className="max-h-48 overflow-auto rounded bg-bg p-2 font-mono text-xs">{c.original_content ?? "(new file)"}</pre></div>
            <div><p className="mb-1 text-xs text-muted">Proposed</p><pre className="max-h-48 overflow-auto rounded bg-bg p-2 font-mono text-xs">{c.new_content}</pre></div>
          </div>
          {c.status === "pending" && <div className="mt-3 flex gap-2"><Button variant="primary" onClick={() => setConfirm(c)}>Review and approve</Button><Button onClick={() => reject.mutate(c)}>Reject</Button></div>}
        </div>
      ))}
      <ConfirmDialog open={!!confirm} title="Write this change to disk?" confirmLabel="Approve and write" body={<>This will overwrite <span className="font-mono">{confirm?.rel_path}</span> in <b>{ws.name}</b>. {ws.allow_write ? "" : "Write access is currently off for this workspace, so this will be refused until you turn it on."}</>} onCancel={() => setConfirm(null)} onConfirm={() => approve.mutate(confirm!)} />
    </div>
  );
}

function Workbench({ ws }: { ws: Workspace }) {
  const qc = useQueryClient();
  const nav = useNavigate();
  const [file, setFile] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("");
  const [draft, setDraft] = useState<{ content: string; note: string } | null>(null);
  const [writeConfirm, setWriteConfirm] = useState(false);
  const [codeResult, setCodeResult] = useState<CodeExplainResult | null>(null);
  const [codeConsent, setCodeConsent] = useState<{ body: { mode: "file" | "project" | "flow"; workspace_id: number; path?: string }; details?: { files?: string[]; chars?: number; redactions?: number; model?: string } } | null>(null);
  const tree = useQuery({ queryKey: ["tree", ws.id], queryFn: () => api.tree(ws.id) });
  const summary = useQuery({ queryKey: ["summary", ws.id], queryFn: () => api.summary(ws.id) });
  const hits = useQuery({ queryKey: ["search", ws.id, term], queryFn: () => api.search(ws.id, term), enabled: !!term });
  const content = useQuery({ queryKey: ["file", ws.id, file], queryFn: () => api.readFile(ws.id, file!), enabled: !!file });
  const propose = useMutation({ mutationFn: () => api.propose(ws.id, { path: file!, new_content: draft!.content, description: draft!.note }), onSuccess: () => { setDraft(null); qc.invalidateQueries({ queryKey: ["changes"] }); } });
  const setWrite = useMutation({ mutationFn: (v: boolean) => api.setWrite(ws.id, v), onSuccess: () => { setWriteConfirm(false); qc.invalidateQueries({ queryKey: ["workspaces"] }); } });
  const explain = useMutation({
    mutationFn: (body: { mode: "file" | "project" | "flow"; workspace_id: number; path?: string; consent_external?: boolean }) => api.explainCode(body),
    onSuccess: (result) => { setCodeResult(result); setCodeConsent(null); if (result.stored_memory_id) qc.invalidateQueries({ queryKey: ["memories"] }); },
    onError: (error, body) => {
      if (error instanceof ApiError && error.code === "consent_required") setCodeConsent({ body, details: error.details as { files?: string[]; chars?: number; redactions?: number; model?: string } });
    },
  });
  const visualize = useMutation({
    mutationFn: () => api.generateSceneFromWorkspace(ws.id),
    onSuccess: (res: SceneResponse) => {
      nav("/visual", { state: { generatedScene: res } });
    },
  });
  const s = summary.data;

  return (
    <div className="space-y-4">
      <Panel title="Project overview" action={<div className="flex gap-2"><Button onClick={() => explain.mutate({ mode: "project", workspace_id: ws.id })}>Explain project</Button><Button onClick={() => explain.mutate({ mode: "flow", workspace_id: ws.id })}>Trace flow</Button><Button variant="primary" disabled={visualize.isPending} onClick={() => visualize.mutate()} title="Generate an interactive 3D architecture scene from this codebase">{visualize.isPending ? "Generating scene…" : "✦ Visualize design"}</Button><Button variant={ws.allow_write ? "danger" : "secondary"} onClick={() => (ws.allow_write ? setWrite.mutate(false) : setWriteConfirm(true))}>{ws.allow_write ? "Turn off write access" : "Allow writes"}</Button></div>}>
        {summary.isLoading ? <Skeleton className="h-10" /> : s ? (
          <div className="text-sm"><p><b>{s.file_count}</b> supported files. {Object.entries(s.by_extension).slice(0, 6).map(([e, n]) => `${e} ${n}`).join(", ")}</p>
            {s.config_files.length > 0 && <p className="mt-1 text-muted">Config files found: {s.config_files.join(", ")}</p>}
            {Object.keys(s.top_level_folders).length > 0 && <p className="mt-1 text-muted">Top folders: {Object.keys(s.top_level_folders).join(", ")}</p>}
            <p className="mt-2 text-xs text-muted">{s.note}</p></div>
        ) : null}
      </Panel>
      {codeResult && <Panel title={"Code explanation · " + codeResult.mode}><p className="whitespace-pre-wrap text-sm">{codeResult.summary}</p><ul className="mt-2 space-y-1 text-sm">{codeResult.files.map((f) => <li key={f.path}><b>{f.path}</b>: {f.summary}</li>)}</ul>{codeResult.flow_steps.length > 0 && <ol className="mt-2 list-decimal pl-5 text-sm">{codeResult.flow_steps.map((step, i) => <li key={i}>{step}</li>)}</ol>}{codeResult.risks.length > 0 && <p className="mt-2 text-sm text-warn">Risks: {codeResult.risks.join("; ")}</p>}<p className="mt-2 text-xs text-muted">{codeResult.external ? "Sent to the hosted model after redaction and your confirmation." : "Demo placeholder output."} {codeResult.redactions} likely secret(s) redacted.{codeResult.stored_memory_id ? " A project summary was suggested for Memory confirmation." : ""}</p></Panel>}
      {visualize.error && <div className="mb-2"><ErrorState error={visualize.error} retry={() => visualize.reset()} /></div>}
      {explain.error && explain.error instanceof ApiError && explain.error.code !== "consent_required" && <ErrorState error={explain.error} />}
      <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
        <Panel title="Files">
          <form className="mb-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); setTerm(query.trim()); }}>
            <input aria-label="Search files" className={inputCls} placeholder="Search names and content" value={query} onChange={(e) => { setQuery(e.target.value); if (!e.target.value) setTerm(""); }} /><Button type="submit">Search</Button>
          </form>
          {tree.isLoading ? <Skeleton className="h-24" /> : tree.error ? <ErrorState error={tree.error} /> : (
            <ul className="max-h-96 space-y-0.5 overflow-auto text-sm">
              {term ? (hits.data?.length ? hits.data.map((h, i) => (
                <li key={i}><button className="w-full rounded px-2 py-1 text-left hover:bg-raised" onClick={() => { setFile(h.path); setDraft(null); }}><span className="font-mono text-xs">{h.path}{h.line ? `:${h.line}` : ""}</span>{h.snippet && <span className="block truncate text-xs text-muted">{h.snippet}</span>}</button></li>
              )) : <li className="px-2 text-muted">{hits.isLoading ? "Searching…" : "No matches."}</li>)
              : tree.data?.length ? tree.data.map((f) => (
                <li key={f.path}><button onClick={() => { setFile(f.path); setDraft(null); }} className={`flex w-full justify-between rounded px-2 py-1 text-left hover:bg-raised ${file === f.path ? "bg-raised" : ""}`}><span className="truncate font-mono text-xs">{f.path}</span><span className="ml-2 shrink-0 text-xs text-muted">{kb(f.size)}</span></button></li>
              )) : <li className="px-2 text-muted">No supported files in this folder.</li>}
            </ul>
          )}
        </Panel>
        <Panel title={file ?? "File preview"} action={file && <div className="flex gap-2"><Button onClick={() => explain.mutate({ mode: "file", workspace_id: ws.id, path: file })}>Explain file</Button><Button onClick={() => explain.mutate({ mode: "flow", workspace_id: ws.id, path: file })}>Trace flow</Button><Button onClick={() => nav("/chat", { state: { file, prompt: `Explain ${file}` } })}>Ask in chat</Button><Button disabled={!content.data} onClick={() => setDraft({ content: content.data!.content, note: "" })}>Propose a change</Button></div>}>
          {!file ? <p className="text-sm text-muted">Select a file to preview it. Files like .env and private keys are never listed or readable.</p> : content.isLoading ? <Skeleton className="h-32" /> : content.error ? <ErrorState error={content.error} /> : draft ? (
            <div className="space-y-3">
              <Field label="New content"><textarea className={`${inputCls} font-mono`} rows={14} value={draft.content} onChange={(e) => setDraft({ ...draft, content: e.target.value })} /></Field>
              <Field label="What does this change do?"><input className={inputCls} value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} /></Field>
              <div className="flex gap-2"><Button variant="primary" disabled={propose.isPending || draft.content === content.data?.content} onClick={() => propose.mutate()}>Submit for approval</Button><Button onClick={() => setDraft(null)}>Cancel</Button></div>
              <p className="text-xs text-muted">Submitting only creates a proposal. Nothing is written until you approve it below.</p>
              {propose.error && <ErrorState error={propose.error} />}
            </div>
          ) : <pre className="max-h-[28rem] overflow-auto rounded bg-bg p-3 font-mono text-xs leading-relaxed">{content.data?.content}</pre>}
        </Panel>
      </div>
      <Panel title="Proposed changes"><Changes ws={ws} /></Panel>
      <ConfirmDialog open={!!codeConsent} title="Send redacted code to the hosted model?" confirmLabel="Explain code" body={codeConsent && <>These excerpts leave your computer for <b>{codeConsent.details?.model}</b>: {codeConsent.details?.files?.join(", ")} ({codeConsent.details?.chars?.toLocaleString()} characters, {codeConsent.details?.redactions ?? 0} likely secret(s) redacted). Redaction is best effort.</>} onCancel={() => setCodeConsent(null)} onConfirm={() => { const body = codeConsent!.body; setCodeConsent(null); explain.mutate({ ...body, consent_external: true }); }} />
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
          <div className="min-w-72 flex-1"><Field label="Absolute folder path"><input className={inputCls} value={path} onChange={(e) => setPath(e.target.value)} placeholder="/home/you/code/my-project" /></Field></div>
          <Button type="submit" variant="primary" disabled={!path.trim() || add.isPending}>Authorize folder</Button>
        </form>
        {add.error && <div className="mt-3"><ErrorState error={add.error instanceof ApiError ? add.error : add.error} /></div>}
        <p className="mt-2 text-xs text-muted">The browser can't read your disk directly, so you enter the path and the local backend checks it.</p>
      </Panel>
      {isLoading ? <Skeleton className="h-16" /> : error ? <ErrorState error={error} retry={() => refetch()} /> : !data?.length ? (
        <EmptyState title="No authorized folders">Authorize a project folder above to start exploring it.</EmptyState>
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
