/** QA-02: each primary screen in its loading, empty, error and success states, against a mocked API (MSW). */
import { screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { HomePage } from "../src/features/home/HomePage";
import { MemoryPage } from "../src/features/memory/MemoryPage";
import { ProjectsPage } from "../src/features/projects/ProjectsPage";
import { SettingsPage } from "../src/features/settings/SettingsPage";
import { SkillsPage } from "../src/features/skills/SkillsPage";
import { TasksPage } from "../src/features/tasks/TasksPage";
import { HEALTH, fail, offline, ok, pending, renderPage, server } from "./helpers";

const NOW = new Date().toISOString();
const MEMORY = { id: 1, content: "I deploy with Docker", type: "fact", source: "user", confirmed: true, created_at: NOW, updated_at: NOW };
const TASK = { id: 1, title: "Write the demo script", notes: "", status: "todo", priority: "high", due: null, source: "user", created_at: NOW };
const WORKSPACE = { id: 1, name: "example-project", path: "/code/example-project", allow_write: false, created_at: NOW };
const SKILL = { name: "general_qa", title: "General question answering", description: "Answer a question.", required_permissions: ["memory.read"], requires_files: false, uses_workspace_summary: false, invocation: "chat", enabled: true, input_schema: { properties: { message: { type: "string" } }, required: ["message"] }, output_schema: { properties: { answer: { type: "string" } }, required: ["answer"] } };
const WORKFLOW = { ...SKILL, name: "project_notes", title: "Write project notes (agent)", invocation: "workflow", required_permissions: ["workspace.read", "workspace.propose"] };
const SETTINGS = { provider: { ...HEALTH.provider, hosted: false }, limits: { max_file_bytes: 200000, max_context_chars: 24000 }, model_routing: false, tools: [{ name: "read_file", description: "Read one permitted text file", permissions: ["workspace.read"], requires_confirmation: false }], privacy: ["Camera video stays in your browser."] };

type Case = { name: string; ui: ReactElement; data: () => void; empty: () => void; error: () => void; loading: () => void; success: RegExp; emptyText: RegExp };

const cases: Case[] = [
  {
    name: "Home", ui: <HomePage />,
    data: () => server.use(ok("/conversations", [{ id: 1, title: "Plan my launch", updated_at: NOW }]), ok("/workspaces", [WORKSPACE]), ok("/changes", []), ok("/tasks", [{ ...TASK, status: "proposed" }])),
    empty: () => server.use(ok("/conversations", []), ok("/workspaces", []), ok("/changes", []), ok("/tasks", [])),
    error: () => server.use(offline("/conversations"), ok("/workspaces", []), ok("/changes", []), ok("/tasks", [])),
    loading: () => server.use(pending("/conversations"), pending("/workspaces"), pending("/changes"), pending("/tasks")),
    success: /Plan my launch/, emptyText: /No projects authorized/,
  },
  {
    name: "Memory", ui: <MemoryPage />,
    data: () => server.use(ok("/memories", [MEMORY])), empty: () => server.use(ok("/memories", [])),
    error: () => server.use(fail("/memories", "internal_error", "Database is locked.")), loading: () => server.use(pending("/memories")),
    success: /I deploy with Docker/, emptyText: /Nothing remembered yet/,
  },
  {
    name: "Skills", ui: <SkillsPage />,
    data: () => server.use(ok("/skills", [SKILL, WORKFLOW])), empty: () => server.use(ok("/skills", [])),
    error: () => server.use(fail("/skills", "unauthorized", "Missing or invalid local API token.", 401)), loading: () => server.use(pending("/skills")),
    success: /Agent workflows/, emptyText: /No skills match/,
  },
  {
    name: "Tasks", ui: <TasksPage />,
    data: () => server.use(ok("/tasks", [TASK])), empty: () => server.use(ok("/tasks", [])),
    error: () => server.use(offline("/tasks")), loading: () => server.use(pending("/tasks")),
    success: /Write the demo script/, emptyText: /No tasks yet/,
  },
  {
    name: "Projects", ui: <ProjectsPage />,
    data: () => server.use(ok("/workspaces", [WORKSPACE])), empty: () => server.use(ok("/workspaces", [])),
    error: () => server.use(offline("/workspaces")), loading: () => server.use(pending("/workspaces")),
    success: /Choose a workspace/, emptyText: /No authorized folders/,
  },
  {
    name: "Settings", ui: <SettingsPage />,
    data: () => server.use(ok("/health", HEALTH), ok("/settings", SETTINGS), ok("/workspaces", [WORKSPACE])),
    empty: () => server.use(ok("/health", HEALTH), ok("/settings", SETTINGS), ok("/workspaces", [])),
    error: () => server.use(ok("/health", HEALTH), fail("/settings", "unauthorized", "Missing or invalid local API token.", 401), ok("/workspaces", [])),
    loading: () => server.use(pending("/health"), pending("/settings"), pending("/workspaces")),
    success: /example-project/, emptyText: /None\. Manage workspaces in Projects/,
  },
];

describe.each(cases)("$name screen", (c) => {
  it("shows a loading placeholder", () => {
    c.loading();
    const { container } = renderPage(c.ui);
    expect(container.querySelector(".animate-pulse")).not.toBeNull();
  });
  it("shows an empty state", async () => {
    c.empty();
    renderPage(c.ui);
    expect(await screen.findByText(c.emptyText)).toBeInTheDocument();
  });
  it("shows a clear error with a recovery step", async () => {
    c.error();
    renderPage(c.ui);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/Backend not reachable|couldn't verify|Something went wrong on the server/);
    expect(alert.querySelector("button, a")).not.toBeNull();
  });
  it("shows data on success", async () => {
    c.data();
    renderPage(c.ui);
    await waitFor(() => expect(document.body.textContent).toMatch(c.success));
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
