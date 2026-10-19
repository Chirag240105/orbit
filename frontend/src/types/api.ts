export type Provider = { name: string; model: string; configured: boolean; is_demo: boolean };
export type Health = { status: string; version: string; database: string; provider: Provider & { demo_mode: boolean } };
export type Memory = { id: number; content: string; type: string; source: string; confirmed: boolean; created_at: string; updated_at: string };
export type Conversation = { id: number; title: string; updated_at: string };
export type ContextUsed = { memory_ids: number[]; files: string[]; chars_sent: number; redactions: number; external: boolean };
export type ProposedTask = { title: string; priority: "high" | "medium" | "low"; notes: string };
export type ChatRequest = { message: string; conversation_id?: number | null; skill?: string | null; workspace_id?: number | null; file_paths?: string[]; consent_external?: boolean };
export type ChatResponse = {
  conversation_id: number; message_id: number; skill: string; output: Record<string, unknown>;
  provider: { name: string; model: string; is_demo: boolean }; context: ContextUsed; proposed_tasks: ProposedTask[]; warnings: string[];
  intent: "chat" | "plan_day" | "task_op" | "memory_op" | "code_q" | "vision_ctx"; tool_calls: { name: string; status: string }[]; pending_actions: Record<string, unknown>[];
};
export type PendingAction = { pending_action_id: number; tool_name: string; status: "pending"; draft?: { blocks: ScheduleBlock[]; conflicts: { title: string; reason: string }[]; date: string; timezone: string } };
export type Message = { id: number; role: "user" | "assistant"; content: string | Record<string, unknown>; skill: string | null; meta: { provider?: ChatResponse["provider"]; context?: ContextUsed; warnings?: string[]; intent?: ChatResponse["intent"]; tool_calls?: ChatResponse["tool_calls"]; pending_actions?: PendingAction[] } | null; created_at: string };
export type Skill = { name: string; title: string; description: string; required_permissions: string[]; requires_files: boolean; enabled: boolean; input_schema: SchemaDoc; output_schema: SchemaDoc };
export type SchemaDoc = { properties?: Record<string, { type?: string; description?: string; title?: string }>; required?: string[] };
export type Workspace = { id: number; name: string; path: string; allow_write: boolean; created_at: string };
export type FileEntry = { path: string; size: number };
export type SearchHit = { path: string; line: number | null; snippet: string | null };
export type WorkspaceSummary = { file_count: number; by_extension: Record<string, number>; top_level_folders: Record<string, number>; config_files: string[]; note: string };
export type Change = { id: number; workspace_id: number; rel_path: string; description: string; original_content: string | null; new_content: string; status: "pending" | "applied" | "rejected" | "stale"; created_at: string; decided_at: string | null };
export type Task = { id: number; title: string; notes: string; status: "proposed" | "todo" | "doing" | "done"; priority: "high" | "medium" | "low"; due: string | null; source: string; created_at: string };
export type ScheduleBlock = { id?: number; title: string; starts_at: string; ends_at: string; rationale: string; task_title?: string | null; task_id?: number | null };
export type ScheduleDraft = { date: string; timezone: string; blocks: ScheduleBlock[]; conflicts: { title: string; reason: string }[]; pending_action_id: number };
export type SettingsInfo = {
  provider: Provider & { hosted: boolean }; limits: { max_file_bytes: number; max_context_chars: number };
  tools: { name: string; description: string; permissions: string[]; requires_confirmation: boolean }[]; privacy: string[];
};
