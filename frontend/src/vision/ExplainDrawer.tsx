/**
 * FloatingExplainChat — manual-only AI chat panel for Visual Learning Studio.
 *
 * RULES (enforced here):
 *  1. Selecting a part NEVER opens this window and NEVER sends anything.
 *  2. Gestures NEVER open this window.
 *  3. This window opens ONLY when the user explicitly clicks the "Explain" button
 *     in the Explanation panel (checked via event.isTrusted in VisualLearningPage).
 *  4. On open the text input is pre-filled with a draft prompt and focused.
 *     NOTHING IS SENT until the user presses Send (or Enter).
 *  5. If the user selects a different part while the window is open, the draft is
 *     NOT changed and nothing is sent. A "Use this part" button lets them swap the
 *     draft at will — still without sending.
 *  6. One request per Send. While streaming, Send is disabled and a Stop button
 *     (AbortController) appears.
 *  7. Close / Minimize never deletes the conversation.
 */

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import {
  X,
  Minus,
  ChevronRight,
  SendHorizontal,
  Brain,
  Loader2,
  Lightbulb,
  AlertTriangle,
  MessageCircleQuestion,
  BookOpen,
  RefreshCw,
  Square,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError, api, chatStream } from "../lib/api";
import { Button, inputCls } from "../components/ui";
import type { ChatRequest, ChatResponse } from "../types/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ComponentContext {
  sceneTitle: string;
  label: string;
  kind: string;
  zone: string;
  summary: string;
  details?: string;
  apis?: string | null;
  dataModel?: string | null;
  failureMode?: string | null;
  tradeOffs?: string | null;
  scaling?: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** The part that was selected when Explain was clicked (the "committed" context). */
  explainContext: ComponentContext | null;
  /** The currently selected part in the scene — may differ from explainContext. */
  currentContext: ComponentContext | null;
  onMemorySaved?: () => void;
}

type DrawerMsg =
  | { role: "user"; text: string }
  | { role: "assistant"; streaming: true; streamText: string; stageLabel?: string }
  | { role: "assistant"; streaming: false; output: ChatResponse["output"]; rawText: string; showRaw?: boolean };

// ---------------------------------------------------------------------------
// Draft builder — only constructs the string, never sends it
// ---------------------------------------------------------------------------

export function buildDraft(ctx: ComponentContext): string {
  return (
    `Explain "${ctx.label}" (${ctx.kind} · ${ctx.zone}) in the context of "${ctx.sceneTitle}": ` +
    `what it does, how it connects to its neighbours, how it can fail, and how it scales.`
  );
}

// ---------------------------------------------------------------------------
// Types for the clean output shape (mirrors backend CleanOutput)
// ---------------------------------------------------------------------------

interface AnswerSection {
  heading: string;
  bullets: string[];
}

interface CleanOutput {
  summary: string;
  sections: AnswerSection[];
  key_takeaway?: string;
  follow_ups?: string[];
  suggested_memory?: string | null;
  _raw?: string; // only in debug panel
}

function parseCleanOutput(output: Record<string, unknown>): CleanOutput {
  // Already clean shape (has summary as a plain string)
  if (typeof output.summary === "string" && output.summary.length > 0) {
    return output as unknown as CleanOutput;
  }

  // Helper: unwrap a nested schema-echo value to plain string
  function flatStr(v: unknown): string {
    if (typeof v === "string") return v.trim();
    if (v && typeof v === "object") {
      const obj = v as Record<string, unknown>;
      // {"description": "..."} or {"title": "...", "type": ...} → take description or first string
      for (const key of ["description", "default", "example", "title"]) {
        if (typeof obj[key] === "string" && (obj[key] as string).length > 0) {
          return (obj[key] as string).trim();
        }
      }
      // fallback: first string value longer than 10 chars
      for (const val of Object.values(obj)) {
        if (typeof val === "string" && val.length > 10) return val.trim();
      }
    }
    return "";
  }

  // Helper: unwrap a nested list (handles {"items": [...], ...} schema shape)
  function flatList(v: unknown): string[] {
    if (Array.isArray(v)) {
      return (v as unknown[]).flatMap((item) => {
        if (typeof item === "string") return [item.trim()];
        if (item && typeof item === "object") {
          const s = flatStr(item);
          return s ? [s] : [];
        }
        return [];
      });
    }
    if (v && typeof v === "object") {
      const obj = v as Record<string, unknown>;
      if (Array.isArray(obj.items)) return flatList(obj.items);
      if (Array.isArray(obj.examples)) return flatList(obj.examples);
    }
    return [];
  }

  // Legacy shape: answer + key_points + follow_ups
  const summary = flatStr(output.answer ?? output.summary ?? output.overview ?? "");
  const sections: AnswerSection[] = [];
  const kp = flatList(output.key_points);
  const risks = flatList(output.risks);
  if (kp.length) sections.push({ heading: "Key points", bullets: kp });
  if (risks.length) sections.push({ heading: "Risks & failure modes", bullets: risks });

  // Preserve any sections the model returned
  if (Array.isArray(output.sections)) {
    for (const sec of output.sections as unknown[]) {
      if (sec && typeof sec === "object") {
        const s = sec as Record<string, unknown>;
        const heading = flatStr(s.heading ?? s.title ?? "Details");
        const bullets = flatList(s.bullets ?? s.items ?? []);
        if (heading && bullets.length) sections.push({ heading, bullets });
      }
    }
  }

  const followUps = flatList(output.follow_ups);

  return {
    summary: summary || "Response received.",
    sections,
    key_takeaway: flatStr(output.key_takeaway ?? ""),
    follow_ups: followUps,
    suggested_memory: typeof output.suggested_memory === "string" ? output.suggested_memory : null,
    _raw: typeof output._raw === "string" ? output._raw : undefined,
  };
}

// Map a section heading to an icon colour and icon char to keep it visual
const SECTION_STYLES: Record<string, { tone: string; icon: React.ElementType }> = {
  "what it does": { tone: "var(--color-accent)", icon: BookOpen },
  "how it connects": { tone: "#a78bfa", icon: Lightbulb },
  "how it can fail": { tone: "var(--color-danger)", icon: AlertTriangle },
  "how it scales": { tone: "var(--color-ok)", icon: Lightbulb },
  "key points": { tone: "var(--color-ok)", icon: Lightbulb },
  "risks": { tone: "var(--color-danger)", icon: AlertTriangle },
  "risks & failure modes": { tone: "var(--color-danger)", icon: AlertTriangle },
  "risks and failure modes": { tone: "var(--color-danger)", icon: AlertTriangle },
};

function sectionStyle(heading: string): { tone: string; icon: React.ElementType } {
  const key = heading.toLowerCase();
  for (const [k, v] of Object.entries(SECTION_STYLES)) {
    if (key.includes(k)) return v;
  }
  return { tone: "var(--color-muted)", icon: Lightbulb };
}

// ---------------------------------------------------------------------------
// Structured answer renderer — renders CleanOutput, never raw JSON
// ---------------------------------------------------------------------------

function StructuredAnswer({
  output,
  onFollowUp,
  showRaw,
  onToggleRaw,
}: {
  output: Record<string, unknown>;
  onFollowUp?: (q: string) => void;
  showRaw?: boolean;
  onToggleRaw?: () => void;
}) {
  const clean = parseCleanOutput(output);
  const isEmpty = !clean.summary && clean.sections.length === 0;

  return (
    <div className="space-y-0">
      {/* Summary lead */}
      {clean.summary ? (
        <p className="text-sm leading-[1.72] text-text">{clean.summary}</p>
      ) : isEmpty ? (
        <p className="text-sm text-muted">Response received.</p>
      ) : null}

      {/* Section cards */}
      {clean.sections.map((sec, i) => {
        const { tone, icon: Icon } = sectionStyle(sec.heading);
        return (
          <div key={i} className="mt-4 first:mt-3 rounded-lg border border-line/60 bg-bg/50 px-3.5 py-3">
            <div className="mb-2 flex items-center gap-1.5">
              <Icon size={12} style={{ color: tone }} aria-hidden />
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: tone }}>
                {sec.heading}
              </span>
            </div>
            <ul className="space-y-1.5">
              {sec.bullets.map((bullet, j) => (
                <li key={j} className="flex items-start gap-2 text-sm text-text/90">
                  <span
                    className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: tone }}
                    aria-hidden
                  />
                  {/* Render as plain text — no dangerouslySetInnerHTML */}
                  {bullet}
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      {/* Key takeaway callout */}
      {clean.key_takeaway && (
        <div className="mt-4 rounded-lg border-l-2 border-accent bg-accent/8 px-3.5 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-accent">Key takeaway</p>
          <p className="mt-1 text-sm text-text">{clean.key_takeaway}</p>
        </div>
      )}

      {/* Follow-up chips — clicking fills the input, NEVER auto-sends */}
      {clean.follow_ups && clean.follow_ups.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
            <MessageCircleQuestion size={11} aria-hidden />
            Dig deeper
          </p>
          <div className="flex flex-wrap gap-1.5" role="list">
            {clean.follow_ups.map((q, i) => (
              <button
                key={i}
                role="listitem"
                type="button"
                onClick={() => onFollowUp?.(q)}
                className="rounded-full border border-line bg-bg px-3 py-1.5 text-left text-xs text-muted transition-colors hover:border-accent/50 hover:bg-accent/8 hover:text-text focus:outline-none focus:ring-1 focus:ring-accent"
                aria-label={`Use as follow-up: ${q}`}
              >
                {q}
              </button>
            ))}
          </div>
          {onFollowUp && (
            <p className="mt-1.5 text-[10px] text-muted/60">Click a question to fill the input — nothing sends until you press Send.</p>
          )}
        </div>
      )}

      {/* Raw output toggle — debug only, collapsed by default */}
      {clean._raw && (
        <div className="mt-4">
          <button
            type="button"
            onClick={onToggleRaw}
            className="text-[10px] text-muted/50 hover:text-muted transition-colors"
          >
            {showRaw ? "▲ Hide raw output" : "▼ Raw output (debug)"}
          </button>
          {showRaw && (
            <pre className="mt-1 max-h-40 overflow-auto rounded bg-bg p-2 font-mono text-[10px] text-muted/70 whitespace-pre-wrap">
              {clean._raw}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Message bubbles
// ---------------------------------------------------------------------------

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[82%] rounded-xl bg-accent/15 px-3.5 py-2.5 text-sm text-text">
        {text}
      </div>
    </div>
  );
}

function AssistantBubble({
  msg,
  onFollowUp,
  onToggleRaw,
}: {
  msg: DrawerMsg & { role: "assistant" };
  onFollowUp?: (q: string) => void;
  onToggleRaw?: () => void;
}) {
  return (
    <div className="flex justify-start gap-2">
      <span className="mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent/20 text-[10px] font-bold text-accent">
        AI
      </span>
      <div className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-4 py-3">
        {msg.streaming ? (
          msg.streamText ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-text">
              {msg.streamText}
            </p>
          ) : (
            <span className="flex items-center gap-1.5 text-sm text-muted">
              <Loader2 size={13} className="animate-spin" />
              {msg.stageLabel ?? "Thinking…"}
            </span>
          )
        ) : (
          <StructuredAnswer
            output={msg.output}
            onFollowUp={onFollowUp}
            showRaw={msg.showRaw}
            onToggleRaw={onToggleRaw}
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function FloatingExplainChat({
  open,
  onClose,
  explainContext,
  currentContext,
  onMemorySaved,
}: Props) {
  const qc = useQueryClient();

  // Conversation state
  const [messages, setMessages] = useState<DrawerMsg[]>([]);
  const [convId, setConvId] = useState<number | null>(null);

  // Draft / input state — completely independent of selection/gestures
  const [draft, setDraft] = useState("");
  const [minimised, setMinimised] = useState(false);

  // Request state
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savedIdx, setSavedIdx] = useState<number | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Track the committed context key so we know when a new Explain was triggered
  const prevExplainKey = useRef<string | null>(null);

  // ── Effect: when the drawer opens for a NEW part, reset messages and pre-fill draft.
  //            NOTHING IS SENT here. This is the only effect that touches draft.
  useEffect(() => {
    if (!open || !explainContext) return;
    const key = `${explainContext.sceneTitle}::${explainContext.label}`;
    if (prevExplainKey.current === key) {
      // Same part re-opened → just unfocus minimised state, keep existing conversation
      setMinimised(false);
      setTimeout(() => inputRef.current?.focus(), 150);
      return;
    }
    prevExplainKey.current = key;
    // New part — reset conversation, pre-fill draft, do NOT send
    abortRef.current?.abort();
    abortRef.current = null;
    setMessages([]);
    setConvId(null);
    setErrorMsg(null);
    setSavedIdx(null);
    setBusy(false);
    setMinimised(false);
    setDraft(buildDraft(explainContext));
    setTimeout(() => {
      if (inputRef.current?.focus) inputRef.current.focus();
      if (inputRef.current?.select) inputRef.current.select();
    }, 150);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, explainContext?.sceneTitle, explainContext?.label]);

  // ── Scroll to bottom when messages change
  useEffect(() => {
    if (!minimised && bottomRef.current?.scrollIntoView) {
      bottomRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages, minimised]);

  // ── Is the currently selected part different from the committed explain context?
  const pendingContext =
    currentContext &&
    explainContext &&
    (currentContext.label !== explainContext.label ||
      currentContext.sceneTitle !== explainContext.sceneTitle)
      ? currentContext
      : null;

  // ── Use this part: replace draft with the new part's prompt, do NOT send
  const useThisPart = () => {
    if (!pendingContext) return;
    setDraft(buildDraft(pendingContext));
    if (inputRef.current?.focus) inputRef.current.focus();
    if (inputRef.current?.select) inputRef.current.select();
  };

  // ── New chat: reset conversation (keeps the window open)
  const newChat = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setMessages([]);
    setConvId(null);
    setErrorMsg(null);
    setSavedIdx(null);
    setBusy(false);
    if (explainContext) setDraft(buildDraft(explainContext));
    setTimeout(() => {
      if (inputRef.current?.focus) inputRef.current.focus();
    }, 100);
  };

  // ── Stop: abort the in-flight stream
  const stopStream = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
    setMessages((prev) => {
      const updated = [...prev];
      const last = updated[updated.length - 1];
      if (last?.role === "assistant" && last.streaming) {
        updated[updated.length - 1] = {
          role: "assistant",
          streaming: false,
          output: { answer: last.streamText || "(Stopped before completing.)" },
          rawText: last.streamText || "(Stopped before completing.)",
        };
      }
      return updated;
    });
  };

  // ── Send: the only function that makes a network call
  const doSend = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;

    const userMsg: DrawerMsg = { role: "user", text: trimmed };
    const streamingMsg: DrawerMsg = { role: "assistant", streaming: true, streamText: "" };
    setMessages((prev) => [...prev, userMsg, streamingMsg]);
    setDraft("");
    setBusy(true);
    setErrorMsg(null);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const req: ChatRequest = {
      message: trimmed,
      conversation_id: convId,
      skill: "general_qa",
    };

    try {
      const result = await chatStream(req, (event, data) => {
        if (ctrl.signal.aborted) return;
        if (event === "token") {
          const chunk = String(data.text ?? "");
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last?.role === "assistant" && last.streaming) {
              updated[updated.length - 1] = {
                ...last,
                streamText: last.streamText + chunk,
              };
            }
            return updated;
          });
        }
        if (event === "stage") {
          // Update the spinner label to reflect what's happening server-side
          const label = String(data.label ?? "Working…");
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last?.role === "assistant" && last.streaming) {
              updated[updated.length - 1] = { ...last, stageLabel: label };
            }
            return updated;
          });
        }
        // processing_complete: structured call finished on server side — keep spinner until "done"
      });

      if (ctrl.signal.aborted) return;

      setConvId(result.conversation_id);
      setMessages((prev) => {
        const updated = [...prev];
        const lastIdx = updated.length - 1;
        if (updated[lastIdx]?.role === "assistant") {
          updated[lastIdx] = {
            role: "assistant",
            streaming: false,
            output: result.output,
            rawText: parseCleanOutput(result.output).summary.slice(0, 480),
          };
        }
        return updated;
      });
      qc.invalidateQueries({ queryKey: ["conversations"] });
    } catch (e) {
      if (ctrl.signal.aborted) return; // user stopped it
      const code = e instanceof ApiError ? e.code : "";
      const msg =
        code === "provider_unavailable" || code === "provider_not_configured"
          ? "AI service unavailable. Set NVIDIA_API_KEY in .env and restart."
          : code === "provider_rate_limited" || (e instanceof ApiError && e.status === 429)
            ? "Rate limit reached — wait a moment then try again."
            : e instanceof Error
              ? e.message
              : "Something went wrong.";
      setErrorMsg(msg);
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.role === "assistant" && last.streaming) {
          updated[updated.length - 1] = {
            role: "assistant",
            streaming: false,
            output: { answer: msg },
            rawText: msg,
          };
        }
        return updated;
      });
    } finally {
      if (!ctrl.signal.aborted) setBusy(false);
      abortRef.current = null;
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    doSend(draft);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      doSend(draft);
    }
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  const saveLastAnswer = async () => {
    const entry = [...messages]
      .map((m, i) => ({ m, i }))
      .reverse()
      .find(({ m }) => m.role === "assistant" && !m.streaming);
    if (!entry || entry.m.role !== "assistant" || entry.m.streaming || !explainContext) return;
    try {
      const snippet = entry.m.rawText.slice(0, 480);
      await api.addMemory({
        content: `Visual Learning — ${explainContext.sceneTitle} / ${explainContext.label}: ${snippet}`,
        type: "VISION",
        source: "visual-learning",
      });
      qc.invalidateQueries({ queryKey: ["memories"] });
      setSavedIdx(entry.i);
      onMemorySaved?.();
    } catch {
      setErrorMsg("Could not save to memory.");
    }
  };

  const hasAnswer = messages.some((m) => m.role === "assistant" && !m.streaming);

  if (!open) return null;

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className="fixed inset-0 z-40 bg-bg/60 backdrop-blur-sm lg:hidden"
        onClick={onClose}
        aria-hidden
      />

      {/* Floating panel */}
      <div
        data-testid="explain-chat-window"
        role="dialog"
        aria-modal="false"
        aria-label="Explain component"
        className={[
          // Mobile: full-width bottom sheet
          "fixed bottom-0 left-0 right-0 z-50 flex flex-col bg-surface border-t border-line shadow-2xl",
          "transition-all duration-300 ease-in-out",
          minimised ? "max-h-[3.25rem]" : "max-h-[80vh]",
          // Desktop: right-aligned floating panel over the canvas
          "lg:absolute lg:bottom-auto lg:left-auto lg:right-0 lg:top-0",
          "lg:w-[26rem] lg:border-t-0 lg:border-l",
          minimised ? "lg:max-h-[3.25rem]" : "lg:max-h-full",
          "lg:overflow-hidden",
        ].join(" ")}
      >
        {/* ── Header ── */}
        <div className="flex shrink-0 items-center justify-between border-b border-line px-3.5 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <span className="text-[0.82rem] font-semibold truncate text-text">
              {explainContext?.label ?? "Explain"}
            </span>
            {explainContext && (
              <span className="hidden shrink-0 text-[11px] text-muted sm:inline">
                {explainContext.sceneTitle}
              </span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {hasAnswer && !minimised && (
              <Button
                variant="ghost"
                onClick={saveLastAnswer}
                title="Save answer to memory"
                className="px-1.5 py-1 text-[11px]"
                aria-label="Save answer to memory"
              >
                <Brain size={12} className="mr-1 inline" />
                Save
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={newChat}
              title="Start new chat"
              className="px-1.5 py-1 text-[11px]"
              aria-label="Start new chat"
              disabled={busy}
            >
              <RefreshCw size={12} className="mr-1 inline" />
              New
            </Button>
            <button
              onClick={() => setMinimised((m) => !m)}
              aria-label={minimised ? "Expand" : "Minimise"}
              className="rounded-md p-1.5 text-muted transition-colors hover:bg-raised hover:text-text"
            >
              <Minus size={14} />
            </button>
            <button
              onClick={onClose}
              aria-label="Close"
              className="rounded-md p-1.5 text-muted transition-colors hover:bg-raised hover:text-text"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {!minimised && (
          <>
            {/* ── Context chip ── */}
            <div className="shrink-0 border-b border-line bg-bg/60 px-3.5 py-2 text-[11px]">
              <span className="text-muted">
                Context:{" "}
                <span className="font-medium text-text">
                  {explainContext?.label}
                </span>
                {" · "}
                <span className="text-muted">{explainContext?.sceneTitle}</span>
              </span>
              <span className="ml-2 text-muted/60">· Nothing is sent until you press Send.</span>

              {/* "Use this part" — appears when the selected part differs from explain context */}
              {pendingContext && (
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="text-muted/70">
                    Viewing: <strong className="text-text">{pendingContext.label}</strong>
                  </span>
                  <button
                    onClick={useThisPart}
                    className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-accent hover:bg-accent/20 transition-colors"
                  >
                    Use this part
                  </button>
                </div>
              )}
            </div>

            {/* ── Messages ── */}
            <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto p-3.5">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-sm text-muted">
                  <ChevronRight size={20} className="text-accent/40" />
                  <p>
                    Edit the draft below if you like, then press{" "}
                    <strong className="text-text">Send</strong> to ask.
                  </p>
                </div>
              )}

              {messages.map((msg, i) =>
                msg.role === "user" ? (
                  <UserBubble key={i} text={msg.text} />
                ) : (
                  <div key={i}>
                    <AssistantBubble
                      msg={msg}
                      onFollowUp={(q) => setDraft(q)}
                      onToggleRaw={() =>
                        setMessages((prev) =>
                          prev.map((m, mi) =>
                            mi === i && m.role === "assistant" && !m.streaming
                              ? { ...m, showRaw: !m.showRaw }
                              : m,
                          ),
                        )
                      }
                    />
                    {savedIdx === i && (
                      <p className="ml-8 mt-1 text-[11px] text-ok">✓ Saved to memory</p>
                    )}
                  </div>
                ),
              )}

              {errorMsg && (
                <div
                  role="alert"
                  className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-xs text-danger"
                >
                  {errorMsg}
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* ── Input ── */}
            <form
              onSubmit={handleSubmit}
              className="shrink-0 border-t border-line px-3 pb-3 pt-2.5"
            >
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  data-testid="explain-draft-input"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Edit the draft or ask a follow-up… (Enter sends, Shift+Enter = newline)"
                  rows={3}
                  disabled={busy}
                  aria-label="Chat input"
                  className={`${inputCls} flex-1 resize-none py-2 text-xs`}
                />
                {busy ? (
                  <Button
                    type="button"
                    variant="danger"
                    onClick={stopStream}
                    aria-label="Stop"
                    className="shrink-0 px-3 py-2"
                    data-testid="explain-stop-btn"
                  >
                    <Square size={13} />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={!draft.trim()}
                    aria-label="Send"
                    className="shrink-0 px-3 py-2"
                    data-testid="explain-send-btn"
                  >
                    <SendHorizontal size={14} />
                  </Button>
                )}
              </div>
              <p className="mt-1.5 text-[10px] text-muted">
                Powered by NVIDIA Nemotron · conversations appear in AI Workspace history
              </p>
            </form>
          </>
        )}
      </div>
    </>
  );
}
