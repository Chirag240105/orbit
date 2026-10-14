// API types are generated from the backend's OpenAPI contract (FE-03). Do not edit generated.ts by hand:
//   cd backend && python -m app.openapi_export && cd ../frontend && npm run gen:types
// This file only gives the generated schemas short names, and narrows the few fields the backend sends as
// free-form JSON (message meta, skill schemas).
import type { components } from "./generated";

type S = components["schemas"];
/** Request bodies: fields with a server-side default are optional to send. */
type Body<T, Required extends keyof T> = Partial<T> & Pick<T, Required>;

export type Health = S["HealthOut"];
export type SettingsInfo = S["SettingsOut"];
export type Provider = Omit<S["HealthProvider"], "demo_mode">;
export type Memory = S["MemoryOut"];
export type Conversation = S["ConversationOut"];
export type ContextUsed = S["ContextUsed"];
export type ProposedTask = S["ProposedTask"];
export type ChatRequest = Body<S["ChatRequest"], "message">;
export type ChatResponse = S["ChatResponse"];
export type Workspace = S["WorkspaceOut"];
export type FileEntry = S["FileEntry"];
export type SearchHit = S["SearchHit"];
export type FileSuggestion = S["FileSuggestion"];
export type WorkspaceSummary = S["WorkspaceSummary"];
export type Change = S["ChangeOut"];
export type Task = S["TaskOut"];
export type TaskInput = Body<S["TaskIn"], "title">;
export type AgentRun = S["AgentRunOut"];
export type AgentStep = S["AgentStep"];
export type ProjectNotesRequest = Body<S["ProjectNotesIn"], "goal">;
export type DraftRequest = Body<S["DraftIn"], "path" | "instruction">;
export type DraftResult = S["DraftOut"];
export type AgentLoopRequest = Body<S["AgentLoopIn"], "goal">;
/** One tool call (or the final `finish`) in an agent-mode run; args are shortened for display. */
export type AgentLoopStep = { n: number; thought: string; tool: string; args: Record<string, string>; ok: boolean; observation: string };
export type AgentLoopDone = { conversation_id: number; answer: string; steps: number; reads: number; proposals: Change[]; provider: ChatResponse["provider"]; warnings: string[] };
export type ComponentExplainRequest = Body<S["ComponentExplainIn"], "scene" | "component">;
export type ComponentExplanation = S["ComponentExplainOut"];

export type MessageMeta = { provider?: ChatResponse["provider"]; context?: ContextUsed; warnings?: string[]; change_id?: number };
export type Message = Omit<S["MessageOut"], "meta"> & { meta: MessageMeta | null };

export type SchemaDoc = { properties?: Record<string, { type?: string; description?: string; title?: string }>; required?: string[] };
export type Skill = Omit<S["SkillOut"], "input_schema" | "output_schema"> & { input_schema: SchemaDoc; output_schema: SchemaDoc };

/** Server-sent events from POST /api/chat/stream. */
export type StreamEvent =
  | { event: "status"; data: { status: "thinking" | "validating" } }
  | { event: "token"; data: { text: string } }
  | { event: "done"; data: ChatResponse }
  | { event: "error"; data: { code: string; message: string } };
