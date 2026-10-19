import type * as T from "../types/api";

export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number, public details?: Record<string, unknown> | null) {
    super(message);
  }
}

const TOKEN_KEY = "orbit.accessToken";
export const readAuthToken = () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } };
export const saveAuthToken = (token: string | null) => { try { token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY); } catch { /* storage unavailable */ } };

export async function request<R>(method: string, path: string, body?: unknown): Promise<R> {
  let res: Response;
  try {
    const token = readAuthToken();
    const headers: Record<string, string> = {};
    if (body) headers["Content-Type"] = "application/json";
    if (token) headers.Authorization = `Bearer ${token}`;
    res = await fetch(`/api${path}`, { method, headers: Object.keys(headers).length ? headers : undefined, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError("backend_unreachable", "Can't reach the ORBIT backend. Start it with `uvicorn app.main:app_factory --factory` in /backend.", 0);
  }
  if (res.status === 204) return undefined as R;
  if (res.status === 401 && !path.startsWith("/auth/")) {
    saveAuthToken(null);
    window.dispatchEvent(new Event("orbit:auth-expired"));
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const e = data?.error;
    throw new ApiError(e?.code ?? "unknown_error", e?.message ?? `Request failed (${res.status}).`, res.status, e?.details);
  }
  return data as R;
}

const q = (o: Record<string, string>) => new URLSearchParams(o).toString();

export const api = {
  health: () => request<T.Health>("GET", "/health"),
  settings: () => request<T.SettingsInfo>("GET", "/settings"),
  chat: (b: T.ChatRequest) => request<T.ChatResponse>("POST", "/chat", b),
  conversations: () => request<T.Conversation[]>("GET", "/conversations"),
  messages: (id: number) => request<T.Message[]>("GET", `/conversations/${id}/messages`),
  deleteConversation: (id: number) => request<void>("DELETE", `/conversations/${id}`),
  deleteAllConversations: () => request<void>("DELETE", "/conversations"),
  memories: (search = "") => request<T.Memory[]>("GET", `/memories?${q({ q: search })}`),
  addMemory: (b: { content: string; type?: string; source?: string }) => request<T.Memory>("POST", "/memories", b),
  patchMemory: (id: number, b: Partial<Pick<T.Memory, "content" | "type" | "confirmed">>) => request<T.Memory>("PATCH", `/memories/${id}`, b),
  deleteMemory: (id: number) => request<void>("DELETE", `/memories/${id}`),
  deleteAllMemories: () => request<void>("DELETE", "/memories"),
  skills: () => request<T.Skill[]>("GET", "/skills"),
  toggleSkill: (name: string, enabled: boolean) => request<{ enabled: boolean }>("PATCH", `/skills/${name}`, { enabled }),
  workspaces: () => request<T.Workspace[]>("GET", "/workspaces"),
  addWorkspace: (path: string) => request<T.Workspace>("POST", "/workspaces", { path }),
  setWrite: (id: number, allow_write: boolean) => request<T.Workspace>("PATCH", `/workspaces/${id}`, { allow_write }),
  removeWorkspace: (id: number) => request<void>("DELETE", `/workspaces/${id}`),
  tree: (id: number) => request<T.FileEntry[]>("GET", `/workspaces/${id}/tree`),
  summary: (id: number) => request<T.WorkspaceSummary>("GET", `/workspaces/${id}/summary`),
  search: (id: number, query: string) => request<T.SearchHit[]>("GET", `/workspaces/${id}/search?${q({ q: query })}`),
  readFile: (id: number, path: string) => request<{ path: string; content: string }>("GET", `/workspaces/${id}/file?${q({ path })}`),
  propose: (id: number, b: { path: string; new_content: string; description: string }) => request<T.Change>("POST", `/workspaces/${id}/changes`, b),
  changes: (status?: string) => request<T.Change[]>("GET", `/changes${status ? `?status=${status}` : ""}`),
  approve: (id: number) => request<T.Change>("POST", `/changes/${id}/approve`),
  reject: (id: number) => request<T.Change>("POST", `/changes/${id}/reject`),
  tasks: () => request<T.Task[]>("GET", "/tasks"),
  addTask: (b: Partial<T.Task> & { title: string }) => request<T.Task>("POST", "/tasks", b),
  patchTask: (id: number, b: Partial<T.Task>) => request<T.Task>("PATCH", `/tasks/${id}`, b),
  deleteTask: (id: number) => request<void>("DELETE", `/tasks/${id}`),
  authenticate: (mode: "login" | "register", email: string, password: string) => request<{ access_token: string; token_type: string }>("POST", `/auth/${mode}`, { email, password }),
};
