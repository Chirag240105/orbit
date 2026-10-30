import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useActiveWorkspace } from "../../app/WorkspaceContext";
import { ConfirmDialog, EmptyState, ErrorState, PageHeader, Button, inputCls } from "../../components/ui";
import { ApiError, api, chatStream } from "../../lib/api";
import { timeAgo } from "../../lib/format";
import type { ChatRequest, Message } from "../../types/api";
import { OutputView } from "./OutputView";

type Consent = { req: ChatRequest; files: string[]; chars: number; redactions: number; model: string };

export function ChatPage() {
  const qc = useQueryClient();
  const nav = useLocation().state as { file?: string; prompt?: string } | null;
  const { activeId } = useActiveWorkspace();
  const [convId, setConvId] = useState<number | null>(null);
  const [thread, setThread] = useState<Message[]>([]);
  const [text, setText] = useState(nav?.prompt ?? "");
  const [skill, setSkill] = useState(nav?.file ? "explain_code" : "");
  const [file, setFile] = useState(nav?.file ?? "");
  const [consent, setConsent] = useState<Consent | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [streamStage, setStreamStage] = useState<string | null>(null);
  const [streamEvents, setStreamEvents] = useState<string[]>([]);
  const end = useRef<HTMLDivElement>(null);
  const health = useQuery({ queryKey: ["health"], queryFn: api.health });
  const convs = useQuery({ queryKey: ["conversations"], queryFn: api.conversations });
  const skills = useQuery({ queryKey: ["skills"], queryFn: api.skills });
  useEffect(() => { end.current?.scrollIntoView?.({ block: "end" }); }, [thread]);

  const open = async (id: number) => { setConvId(id); setError(null); setThread(await api.messages(id)); };
  const send = useMutation({
    mutationFn: (req: ChatRequest) => chatStream(req, (event, data) => {
      if (event === "token") setStreamStage((s) => s ?? "Generating…");
      if (event === "stage") setStreamStage(String(data.label ?? "Working…"));
      if (event === "processing_complete") setStreamStage("Formatting answer…");
      const memoryIds = data.memory_ids;
      if (event === "memory_recalled" && Array.isArray(memoryIds)) setStreamEvents((e) => [...e, `${memoryIds.length} memories recalled`]);
      if (event === "tool_call") setStreamEvents((e) => [...e, `Tool ${String(data.name)}: ${String(data.status)}`]);
      if (event === "pending_action") setStreamEvents((e) => [...e, `Action ${String(data.tool_name)} awaits approval`]);
    }),
    onSuccess: async (r) => { setStreamStage(null); setStreamEvents([]); setConvId(r.conversation_id); setThread(await api.messages(r.conversation_id)); qc.invalidateQueries({ queryKey: ["conversations"] }); },
    onError: (e, req) => {
      if (e instanceof ApiError && e.code === "consent_required" && e.details) {
        const d = e.details as { files: string[]; chars: number; redactions: number; model: string };
        setConsent({ req, files: d.files, chars: d.chars, redactions: d.redactions, model: d.model });
      } else setError(e);
      setStreamStage(null);
    },
  });

  const p = health.data?.provider;
  const blocked = health.isSuccess && !p?.configured;
  const submit = () => {
    if (!text.trim()) return;
    const req: ChatRequest = { message: text.trim(), conversation_id: convId, skill: skill || null, workspace_id: file.trim() ? activeId : null, file_paths: file.trim() ? [file.trim()] : [] };
    setError(null);
    setStreamStage(null); setStreamEvents([]);
    setThread((t) => [...t, { id: -Date.now(), role: "user", content: req.message, skill: null, meta: null, created_at: new Date().toISOString() }]);
    setText("");
    send.mutate(req);
  };

  return (
    <div className="flex h-full min-h-[32rem] flex-col gap-4 lg:flex-row">
      <aside className="w-full shrink-0 lg:w-60" aria-label="Conversations">
        <Button className="mb-3 w-full" onClick={() => { setConvId(null); setThread([]); setError(null); }}>New conversation</Button>
        {convs.isLoading ? null : convs.data?.length ? (
          <ul className="space-y-1">
            {convs.data.map((c) => (
              <li key={c.id}><button onClick={() => open(c.id)} className={`w-full rounded-md px-3 py-2 text-left text-sm hover:bg-raised ${c.id === convId ? "bg-raised" : ""}`}><span className="line-clamp-1">{c.title}</span><span className="text-xs text-muted">{timeAgo(c.updated_at)}</span></button></li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted">No conversations yet.</p>}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <PageHeader title="AI Workspace" description="Ask a question, summarize text, plan a goal, or explain a file. ORBIT picks a skill, or you can choose one." />
        {blocked && (
          <div role="status" className="mb-3 rounded-lg border border-warn/40 bg-warn/10 p-4 text-sm">
            <p className="font-medium text-warn">No model is configured</p>
            <p className="mt-1">Add <code className="font-mono">NVIDIA_API_KEY</code> to <code className="font-mono">.env</code> and restart the backend, or configure <code className="font-mono">LLM_PROVIDER=nebius</code> with <code className="font-mono">NEBIUS_API_KEY</code>. To try the interface without a model, set <code className="font-mono">ORBIT_DEMO_MODE=true</code>; demo replies are labeled and are not AI output.</p>
          </div>
        )}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1" aria-live="polite">
          {thread.length === 0 && <EmptyState title="Start a conversation">Try "Plan how to launch my side project in 4 weeks" or "Summarize: …" with pasted text.</EmptyState>}
          {thread.map((m) => (
            <div key={m.id} className={m.role === "user" ? "ml-auto max-w-[85%] rounded-lg bg-raised px-4 py-2.5 text-sm" : "max-w-[92%] rounded-lg border border-line bg-surface px-4 py-3"}>
              {m.role === "user" ? String(m.content) : <OutputView msg={m} />}
            </div>
          ))}
          {send.isPending && <div role="status" className="flex items-center gap-2 text-sm text-muted">{streamStage && <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-xs"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />{streamStage}</span>}{streamEvents.map((event, i) => <span key={`${event}-${i}`} className="ml-2 rounded bg-raised px-2 py-1">{event}</span>)}</div>}
          {error != null && <ErrorState error={error} />}
          <div ref={end} />
        </div>
        <div className="mt-3 rounded-lg border border-line bg-surface p-3">
          <label htmlFor="msg" className="sr-only">Message</label>
          <textarea id="msg" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(); }} rows={3} placeholder="Message ORBIT (Ctrl+Enter to send)" className={inputCls} />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <select aria-label="Skill" value={skill} onChange={(e) => setSkill(e.target.value)} className="rounded-md border border-line bg-bg px-2 py-1.5 text-sm">
              <option value="">Skill: automatic</option>
              {skills.data?.filter((s) => s.enabled).map((s) => <option key={s.name} value={s.name}>{s.title}</option>)}
            </select>
            <input aria-label="Workspace file path" value={file} onChange={(e) => setFile(e.target.value)} disabled={!activeId} placeholder={activeId ? "File in workspace, e.g. src/app.py" : "Authorize a workspace to attach a file"} className={`${inputCls} !w-64`} />
            <Button variant="primary" className="ml-auto" disabled={blocked || send.isPending || !text.trim()} onClick={submit}>Send</Button>
          </div>
        </div>
      </div>
      <ConfirmDialog
        open={!!consent} title="Send file excerpts to a hosted model?" confirmLabel="Send"
        body={consent && <>These files leave your computer for <b>{consent.model}</b>: {consent.files.join(", ")} (about {consent.chars.toLocaleString()} characters{consent.redactions ? `, ${consent.redactions} likely secret(s) redacted` : ""}). Redaction is best effort.</>}
        onCancel={() => setConsent(null)}
        onConfirm={() => { const c = consent!; setConsent(null); setThread((t) => t); send.mutate({ ...c.req, consent_external: true }); }}
      />
    </div>
  );
}
