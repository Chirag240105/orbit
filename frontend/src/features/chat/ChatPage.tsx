import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useActiveWorkspace } from "../../app/WorkspaceContext";
import { ConsentDialog } from "../../components/ConsentDialog";
import { FilePicker } from "../../components/FilePicker";
import { Button, ConfirmDialog, EmptyState, ErrorState, PageHeader, inputCls } from "../../components/ui";
import { api, consentDetails, type ConsentDetails } from "../../lib/api";
import { timeAgo } from "../../lib/format";
import { streamPreview } from "../../lib/preview";
import type { ChatRequest, Conversation, Message } from "../../types/api";
import { OutputView } from "./OutputView";

type NavState = { file?: string; prompt?: string; conversationId?: number } | null;
const STATUS: Record<string, string> = { thinking: "The model is reasoning…", validating: "Checking the answer's structure…" };

export function ChatPage() {
  const qc = useQueryClient();
  const nav = useLocation().state as NavState;
  const { activeId } = useActiveWorkspace();
  const [convId, setConvId] = useState<number | null>(null);
  const [thread, setThread] = useState<Message[]>([]);
  const [text, setText] = useState(nav?.prompt ?? "");
  const [skill, setSkill] = useState(nav?.file ? "explain_code" : "");
  const [files, setFiles] = useState<string[]>(nav?.file ? [nav.file] : []);
  const [showFiles, setShowFiles] = useState(!!nav?.file);
  const [consent, setConsent] = useState<{ req: ChatRequest; details: ConsentDetails } | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [live, setLive] = useState<{ raw: string; status: string } | null>(null);
  const [remove, setRemove] = useState<Conversation | null>(null);
  const abort = useRef<AbortController | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const health = useQuery({ queryKey: ["health"], queryFn: api.health });
  const convs = useQuery({ queryKey: ["conversations"], queryFn: api.conversations });
  const skills = useQuery({ queryKey: ["skills"], queryFn: api.skills });
  useEffect(() => { end.current?.scrollIntoView?.({ block: "end" }); }, [thread, live?.raw]);
  useEffect(() => () => abort.current?.abort(), []);

  const open = async (id: number) => {
    abort.current?.abort();
    setConvId(id); setError(null); setLive(null);
    try { setThread(await api.messages(id)); } catch (e) { setError(e); }
  };
  useEffect(() => { if (nav?.conversationId) void open(nav.conversationId); }, [nav?.conversationId]);

  const run = async (req: ChatRequest) => {
    setError(null);
    setLive({ raw: "", status: "" });
    const ctrl = new AbortController();
    abort.current = ctrl;
    try {
      const r = await api.chatStream(req, { signal: ctrl.signal, onToken: (t) => setLive((l) => ({ raw: (l?.raw ?? "") + t, status: "" })), onStatus: (s) => setLive((l) => ({ raw: l?.raw ?? "", status: s })) });
      setConvId(r.conversation_id);
      setThread(await api.messages(r.conversation_id));
      qc.invalidateQueries({ queryKey: ["conversations"] });
    } catch (e) {
      const d = consentDetails(e);
      if (d) setConsent({ req, details: d });
      else setError(e);
    } finally {
      setLive(null);
      if (abort.current === ctrl) abort.current = null;
    }
  };
  const delConv = useMutation({
    mutationFn: (c: Conversation) => api.deleteConversation(c.id),
    onSuccess: (_, c) => { if (c.id === convId) { setConvId(null); setThread([]); } setRemove(null); qc.invalidateQueries({ queryKey: ["conversations"] }); },
  });

  const p = health.data?.provider;
  const blocked = health.isSuccess && !p?.configured;
  const busy = live !== null;
  const submit = () => {
    if (!text.trim() || busy) return;
    const req: ChatRequest = { message: text.trim(), conversation_id: convId, skill: skill || null, workspace_id: activeId, file_paths: activeId ? files : [] };
    setThread((t) => [...t, { id: -Date.now(), role: "user", content: req.message, skill: null, meta: null, created_at: new Date().toISOString() }]);
    setText("");
    void run(req);
  };
  const preview = live ? streamPreview(live.raw) : "";

  return (
    <div className="flex h-full min-h-[32rem] flex-col gap-4 lg:flex-row">
      <aside className="w-full shrink-0 lg:w-60" aria-label="Conversations">
        <Button className="mb-3 w-full" onClick={() => { abort.current?.abort(); setConvId(null); setThread([]); setError(null); }}>New conversation</Button>
        {convs.isLoading ? null : convs.error ? <ErrorState error={convs.error} retry={() => convs.refetch()} /> : convs.data?.length ? (
          <ul className="max-h-48 space-y-1 overflow-y-auto lg:max-h-none">
            {convs.data.map((c) => (
              <li key={c.id} className={`group flex items-center rounded-md hover:bg-raised ${c.id === convId ? "bg-raised" : ""}`}>
                <button onClick={() => open(c.id)} aria-current={c.id === convId ? "true" : undefined} className="min-w-0 flex-1 px-3 py-2 text-left text-sm"><span className="line-clamp-1 break-all">{c.title}</span><span className="text-xs text-muted">{timeAgo(c.updated_at)}</span></button>
                <button aria-label={`Delete conversation ${c.title}`} onClick={() => setRemove(c)} className="mr-1 rounded px-2 py-1 text-muted opacity-60 hover:text-danger group-hover:opacity-100 focus:opacity-100">×</button>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted">No conversations yet.</p>}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <PageHeader title="AI Workspace" description="Ask a question, learn a topic, summarize text, plan a goal, or explain your project. ORBIT picks a skill, or you can choose one." />
        {blocked && (
          <div role="status" className="mb-3 rounded-lg border border-warn/40 bg-warn/10 p-4 text-sm">
            <p className="font-medium text-warn">No model is configured</p>
            <p className="mt-1">Add <code className="font-mono">NEBIUS_API_KEY</code> to <code className="font-mono">.env</code> and restart the backend. To try the interface without a model, set <code className="font-mono">ORBIT_DEMO_MODE=true</code>; demo replies are labeled and are not AI output.</p>
          </div>
        )}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1" aria-live="polite" aria-busy={busy}>
          {thread.length === 0 && !busy && <EmptyState title="Start a conversation">Try "Explain Kubernetes like I'm a beginner, with a diagram and interview questions" or "Plan how to launch my side project in 4 weeks".</EmptyState>}
          {thread.map((m) => (
            <div key={m.id} className={m.role === "user" ? "ml-auto max-w-[85%] whitespace-pre-wrap break-words rounded-lg bg-raised px-4 py-2.5 text-sm" : "max-w-full rounded-lg border border-line bg-surface px-4 py-3 sm:max-w-[92%]"}>
              {m.role === "user" ? String(m.content) : <OutputView msg={m} />}
            </div>
          ))}
          {busy && (
            <div className="max-w-full rounded-lg border border-dashed border-line px-4 py-3 sm:max-w-[92%]" data-testid="live-answer">
              <p className="mb-1 text-xs text-muted">{STATUS[live.status] ?? (preview ? "Receiving (not yet validated)…" : "ORBIT is working…")}</p>
              {preview && <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-text/90">{preview}</p>}
              <Button variant="ghost" className="mt-2" onClick={() => abort.current?.abort()}>Stop</Button>
            </div>
          )}
          {error != null && <ErrorState error={error} />}
          <div ref={end} />
        </div>
        <div className="mt-3 rounded-lg border border-line bg-surface p-3">
          <label htmlFor="msg" className="sr-only">Message</label>
          <textarea id="msg" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(); }} rows={3} placeholder="Message ORBIT (Ctrl+Enter to send)" className={inputCls} />
          {showFiles && activeId && <div className="mt-2"><FilePicker workspaceId={activeId} question={text} selected={files} onChange={setFiles} /></div>}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <select aria-label="Skill" value={skill} onChange={(e) => setSkill(e.target.value)} className="max-w-full rounded-md border border-line bg-bg px-2 py-1.5 text-sm">
              <option value="">Skill: automatic</option>
              {skills.data?.filter((s) => s.enabled && s.invocation === "chat").map((s) => <option key={s.name} value={s.name}>{s.title}</option>)}
            </select>
            <Button variant="ghost" aria-expanded={showFiles} disabled={!activeId} title={activeId ? undefined : "Authorize a workspace in Projects to attach files"} onClick={() => setShowFiles((v) => !v)}>
              {files.length && activeId ? `Files (${files.length})` : "Attach files"}
            </Button>
            {busy
              ? <Button variant="danger" className="ml-auto" onClick={() => abort.current?.abort()}>Stop</Button>
              : <Button variant="primary" className="ml-auto" disabled={blocked || !text.trim()} onClick={submit}>Send</Button>}
          </div>
        </div>
      </div>
      <ConsentDialog details={consent?.details ?? null} onCancel={() => setConsent(null)} onConfirm={() => { const c = consent!; setConsent(null); void run({ ...c.req, consent_external: true }); }} />
      <ConfirmDialog open={!!remove} danger title="Delete this conversation?" body={<>“{remove?.title}” and its messages will be removed. This can't be undone.</>} confirmLabel="Delete" onCancel={() => setRemove(null)} onConfirm={() => delConv.mutate(remove!)} />
    </div>
  );
}
