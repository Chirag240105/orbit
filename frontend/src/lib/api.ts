import type * as T from "../types/api";
import { readSSE } from "./sse";

export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number, public details?: Record<string, unknown> | null) {
    super(message);
  }
}

const UNREACHABLE = "Can't reach the ORBIT backend. Start it with `python scripts/dev.py` (or uvicorn in /backend).";

async function send(method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<Response> {
  try {
    return await fetch(`/api${path}`, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined, signal });
  } catch (e) {
    if ((e as Error)?.name === "AbortError") throw new ApiError("cancelled", "Request cancelled.", 0);
    throw new ApiError("backend_unreachable", UNREACHABLE, 0);
  }
}

async function failure(res: Response): Promise<ApiError> {
  const data = await res.json().catch(() => null);
  const e = data?.error;
  return new ApiError(e?.code ?? "unknown_error", e?.message ?? `Request failed (${res.status}).`, res.status, e?.details);
}

export async function request<R>(method: string, path: string, body?: unknown): Promise<R> {
  const res = await send(method, path, body);
  if (res.status === 204) return undefined as R;
  if (!res.ok) throw await failure(res);
  return (await res.json().catch(() => null)) as R;
}

export type StreamHandlers = { onToken?: (text: string) => void; onStatus?: (status: string) => void; signal?: AbortSignal };

/** POST an event-stream endpoint. Errors before streaming starts (consent, permissions) throw like request();
 * an `error` event throws an ApiError with its code; resolves with the `done` event's data. */
async function streamEvents<D>(path: string, body: unknown, onEvent: (event: string, data: unknown) => void, signal?: AbortSignal): Promise<D> {
  const res = await send("POST", path, body, signal);
  if (!res.ok) throw await failure(res);
  if (!res.body) throw new ApiError("internal_error", "The server sent no stream.", res.status);
  try {
    for await (const ev of readSSE(res.body)) {
      if (ev.event === "done") return ev.data as D;
      if (ev.event === "error") { const e = ev.data as { code: string; message: string }; throw new ApiError(e.code, e.message, 502); }
      onEvent(ev.event, ev.data);
    }
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if ((e as Error)?.name === "AbortError" || signal?.aborted) throw new ApiError("cancelled", "Request cancelled.", 0);
    throw new ApiError("backend_unreachable", "The connection closed before the answer finished.", 0);
  }
  throw new ApiError("internal_error", "The stream ended without a result.", 0);
}

/** POST /api/chat/stream: resolves with the validated ChatResponse. */
export const chatStream = (req: T.ChatRequest, { onToken, onStatus, signal }: StreamHandlers = {}) =>
  streamEvents<T.ChatResponse>("/chat/stream", req, (event, data) => {
    if (event === "token") onToken?.((data as { text: string }).text);
    else if (event === "status") onStatus?.((data as { status: string }).status);
  }, signal);

/** POST /api/workspaces/{id}/agent/loop (agent mode): one `step` event per tool call, then the result. */
export const agentLoop = (workspaceId: number, req: T.AgentLoopRequest, { onStep, signal }: { onStep?: (s: T.AgentLoopStep) => void; signal?: AbortSignal } = {}) =>
  streamEvents<T.AgentLoopDone>(`/workspaces/${workspaceId}/agent/loop`, req, (event, data) => { if (event === "step") onStep?.(data as T.AgentLoopStep); }, signal);

const q = (o: Record<string, string>) => new URLSearchParams(o).toString();

export const api = {
  health: () => request<T.Health>("GET", "/health"),
  settings: () => request<T.SettingsInfo>("GET", "/settings"),
  chat: (b: T.ChatRequest) => request<T.ChatResponse>("POST", "/chat", b),
  chatStream,
  agentLoop,
  conversations: () => request<T.Conversation[]>("GET", "/conversations"),
  messages: (id: number) => request<T.Message[]>("GET", `/conversations/${id}/messages`),
  deleteConversation: (id: number) => request<void>("DELETE", `/conversations/${id}`),
  deleteAllConversations: () => request<void>("DELETE", "/conversations"),
  memories: (search = "") => request<T.Memory[]>("GET", `/memories?${q({ q: search })}`),
  addMemory: (b: { content: string; type?: T.Memory["type"]; source?: "user" | "chat_suggestion" }) => request<T.Memory>("POST", "/memories", b),
  patchMemory: (id: number, b: Partial<Pick<T.Memory, "content" | "type" | "confirmed">>) => request<T.Memory>("PATCH", `/memories/${id}`, b),
  deleteMemory: (id: number) => request<void>("DELETE", `/memories/${id}`),
  deleteAllMemories: () => request<void>("DELETE", "/memories"),
  skills: () => request<T.Skill[]>("GET", "/skills"),
  toggleSkill: (name: string, enabled: boolean) => request<{ name: string; enabled: boolean }>("PATCH", `/skills/${name}`, { enabled }),
  workspaces: () => request<T.Workspace[]>("GET", "/workspaces"),
  addWorkspace: (path: string) => request<T.Workspace>("POST", "/workspaces", { path }),
  setWrite: (id: number, allow_write: boolean) => request<T.Workspace>("PATCH", `/workspaces/${id}`, { allow_write }),
  removeWorkspace: (id: number) => request<void>("DELETE", `/workspaces/${id}`),
  tree: (id: number) => request<T.FileEntry[]>("GET", `/workspaces/${id}/tree`),
  summary: (id: number) => request<T.WorkspaceSummary>("GET", `/workspaces/${id}/summary`),
  search: (id: number, query: string) => request<T.SearchHit[]>("GET", `/workspaces/${id}/search?${q({ q: query })}`),
  suggest: (id: number, question: string) => request<T.FileSuggestion[]>("GET", `/workspaces/${id}/suggest?${q({ q: question })}`),
  readFile: (id: number, path: string) => request<{ path: string; content: string }>("GET", `/workspaces/${id}/file?${q({ path })}`),
  propose: (id: number, b: { path: string; new_content: string; description: string }) => request<T.Change>("POST", `/workspaces/${id}/changes`, b),
  draft: (id: number, b: T.DraftRequest) => request<T.DraftResult>("POST", `/workspaces/${id}/draft`, b),
  projectNotes: (id: number, b: T.ProjectNotesRequest) => request<T.AgentRun>("POST", `/workspaces/${id}/agent/notes`, b),
  changes: (status?: string) => request<T.Change[]>("GET", `/changes${status ? `?${q({ status })}` : ""}`),
  approve: (id: number) => request<T.Change>("POST", `/changes/${id}/approve`),
  reject: (id: number) => request<T.Change>("POST", `/changes/${id}/reject`),
  tasks: () => request<T.Task[]>("GET", "/tasks"),
  addTask: (b: T.TaskInput) => request<T.Task>("POST", "/tasks", b),
  patchTask: (id: number, b: Partial<T.TaskInput>) => request<T.Task>("PATCH", `/tasks/${id}`, b),
  deleteTask: (id: number) => request<void>("DELETE", `/tasks/${id}`),
  explainComponent: (b: T.ComponentExplainRequest) => request<T.ComponentExplanation>("POST", "/learn/explain", b),
};

/** Consent details the backend sends with 409 consent_required. */
export type ConsentDetails = { files: string[]; layout?: boolean; agent?: boolean; max_files?: number; chars: number; redactions: number; model: string; provider: string };
export const consentDetails = (e: unknown): ConsentDetails | null =>
  e instanceof ApiError && e.code === "consent_required" && e.details ? (e.details as unknown as ConsentDetails) : null;
