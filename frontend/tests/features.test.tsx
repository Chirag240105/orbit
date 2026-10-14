/** FE-05 memory filters and bulk confirm, the project agent panel, AI drafts, file suggestions (BE-03),
 * and Visual Learning (AI-09 explanations, WebGL fallback, markers page). */
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { FilePicker } from "../src/components/FilePicker";
import { MemoryPage } from "../src/features/memory/MemoryPage";
import { ProjectsPage } from "../src/features/projects/ProjectsPage";
import { MarkersPage } from "../src/features/visual-learning/MarkersPage";
import { VisualLearningPage } from "../src/features/visual-learning/VisualLearningPage";
import { api, ok, renderPage, server, sseStream } from "./helpers";

const NOW = new Date().toISOString();
const mem = (id: number, content: string, extra: object = {}) => ({ id, content, type: "fact", source: "user", confirmed: true, created_at: NOW, updated_at: NOW, ...extra });

describe("Memory filters and bulk confirm (FE-05)", () => {
  const items = [mem(1, "I use pnpm"), mem(2, "[backend] Issues signed tokens", { type: "project", source: "agent", confirmed: false }), mem(3, "Prefers dark mode", { type: "preference", source: "chat_suggestion", confirmed: false })];

  it("filters by type, source and status together with search", async () => {
    server.use(ok("/memories", items));
    renderPage(<MemoryPage />);
    await screen.findByText("I use pnpm");
    fireEvent.change(screen.getByLabelText("Filter by source"), { target: { value: "suggested" } });
    expect(screen.queryByText("I use pnpm")).toBeNull();
    fireEvent.change(screen.getByLabelText("Filter by type"), { target: { value: "project" } });
    expect(screen.getByText("[backend] Issues signed tokens")).toBeInTheDocument();
    expect(screen.queryByText("Prefers dark mode")).toBeNull();
    fireEvent.change(screen.getByLabelText("Filter by status"), { target: { value: "confirmed" } });
    expect(await screen.findByText("No matches")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByText("I use pnpm")).toBeInTheDocument();
  });

  it("confirms selected suggestions in one action, each still deletable", async () => {
    const patched: number[] = [];
    server.use(ok("/memories", items), http.patch(api("/memories/:id"), ({ params }) => { patched.push(Number(params.id)); return HttpResponse.json(mem(Number(params.id), "x")); }));
    renderPage(<MemoryPage />);
    expect(await screen.findByText(/2 suggestion\(s\) waiting/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Select "Prefers dark mode"'));
    fireEvent.click(screen.getByRole("button", { name: "Confirm selected (1)" }));
    await waitFor(() => expect(patched).toEqual([3]));
    fireEvent.click(screen.getByRole("button", { name: "Confirm all shown" }));
    await waitFor(() => expect(patched.sort()).toEqual([2, 3, 3]));
    expect(screen.getAllByRole("button", { name: "Delete" })).toHaveLength(3);
  });
});

describe("FilePicker (BE-03)", () => {
  it("suggests files with reasons and lets the user pick them", async () => {
    server.use(ok("/workspaces/1/suggest", [{ path: "app/auth/login.py", score: 4.2, reasons: ["name matches login"] }, { path: "app/auth/tokens.py", score: 2, reasons: ["mentions token ×3"] }]));
    const picked: string[][] = [];
    renderPage(<FilePicker workspaceId={1} question="how does login work" selected={[]} onChange={(f) => picked.push(f)} />);
    fireEvent.click(screen.getByRole("button", { name: "Suggest files" }));
    expect(await screen.findByText("name matches login")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: /login\.py/ }));
    expect(picked).toEqual([["app/auth/login.py"]]);
  });
});

describe("Projects: agent, drafts and approvals", () => {
  const WS = { id: 1, name: "backend", path: "/code/backend", allow_write: true, created_at: NOW };
  const CHANGE = { id: 5, workspace_id: 1, rel_path: "ORBIT_NOTES.md", description: "Agent notes: auth", original_content: null, new_content: "# Auth\n", status: "pending", origin: "ai", created_at: NOW, decided_at: null };
  const RUN = {
    conversation_id: 3, output: {}, markdown: "# Auth\n", change: CHANGE, memory: mem(9, "[backend] Uses signed tokens", { type: "project", source: "agent", confirmed: false }),
    provider: { name: "nebius", model: "nvidia/test", is_demo: false }, context: { memory_ids: [], files: ["app/auth/login.py"], layout: true, chars_sent: 900, redactions: 1, external: true, routing: "explicit" }, warnings: [],
    steps: [
      { name: "read", status: "done", detail: "Read the project layout and 1 selected file(s) locally; redacted 1 likely secret(s)." },
      { name: "analyze", status: "done", detail: "Analyzed with nvidia/test." }, { name: "draft", status: "done", detail: "Drafted ORBIT_NOTES.md (2 lines)." },
      { name: "propose", status: "done", detail: "Created a proposed change. Nothing is written until you approve it." }, { name: "remember", status: "done", detail: "Suggested a project memory." },
    ],
  };
  function workspace(changes: object[] = [], skills: object[] = []) {
    server.use(
      ok("/workspaces", [WS]), ok("/workspaces/1/tree", [{ path: "app/auth/login.py", size: 300 }]),
      ok("/workspaces/1/summary", { file_count: 1, by_extension: { ".py": 1 }, top_level_folders: { app: 1 }, config_files: [], dependencies: { "pyproject.toml": ["fastapi"] }, note: "Computed locally." }),
      ok("/changes", changes), ok("/skills", skills),
    );
  }

  it("runs the project agent after consent and shows its steps and memory suggestion", async () => {
    workspace();
    const bodies: Record<string, unknown>[] = [];
    server.use(http.post(api("/workspaces/1/agent/notes"), async ({ request }) => {
      const b = (await request.json()) as Record<string, unknown>;
      bodies.push(b);
      if (!b.consent_external) return HttpResponse.json({ error: { code: "consent_required", message: "Confirm", details: { files: [], layout: true, chars: 400, redactions: 0, provider: "nebius", model: "nvidia/test" } } }, { status: 409 });
      return HttpResponse.json(RUN, { status: 201 });
    }));
    renderPage(<ProjectsPage />, { activeWorkspace: 1 });
    expect(await screen.findByText(/pyproject\.toml/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Goal"), { target: { value: "Explain the auth flow" } });
    fireEvent.click(screen.getByRole("button", { name: "Run project agent" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Send" }));
    expect(await screen.findByText("Remember project context.")).toBeInTheDocument();
    expect(screen.getByText(/redacted 1 likely secret/)).toBeInTheDocument();
    expect(screen.getByText("[backend] Uses signed tokens")).toBeInTheDocument();
    expect(bodies).toEqual([{ goal: "Explain the auth flow", notes_path: "ORBIT_NOTES.md", file_paths: [] }, { goal: "Explain the auth flow", notes_path: "ORBIT_NOTES.md", file_paths: [], consent_external: true }]);
  });

  it("shows proposed changes as a diff with an AI label, and approves after confirmation", async () => {
    workspace([{ ...CHANGE, original_content: "# Old\n" }]);
    let approved = false;
    server.use(http.post(api("/changes/5/approve"), () => { approved = true; return HttpResponse.json({ ...CHANGE, status: "applied" }); }));
    renderPage(<ProjectsPage />, { activeWorkspace: 1 });
    expect(await screen.findByText("AI draft")).toBeInTheDocument();
    expect(screen.getByText("# Old")).toBeInTheDocument();
    expect(screen.getByText("# Auth")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Review and approve" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Approve and write" }));
    await waitFor(() => expect(approved).toBe(true));
  });

  it("drafts a change with AI from the file preview", async () => {
    workspace();
    let body: Record<string, unknown> = {};
    server.use(ok("/workspaces/1/file", { path: "app/auth/login.py", content: "def login(): ...\n" }),
      http.post(api("/workspaces/1/draft"), async ({ request }) => { body = (await request.json()) as Record<string, unknown>; return HttpResponse.json({ change: CHANGE, summary: "Added docs", provider: RUN.provider, context: RUN.context, warnings: [] }, { status: 201 }); }));
    renderPage(<ProjectsPage />, { activeWorkspace: 1 });
    fireEvent.click(await screen.findByRole("button", { name: /app\// }));
    fireEvent.click(await screen.findByRole("button", { name: /auth\// }));
    fireEvent.click(screen.getByRole("button", { name: /login\.py/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Draft with AI" }));
    fireEvent.change(screen.getByLabelText("Ask ORBIT to edit app/auth/login.py"), { target: { value: "Add a docstring" } });
    fireEvent.click(screen.getByRole("button", { name: "Draft change" }));
    await waitFor(() => expect(body).toEqual({ path: "app/auth/login.py", instruction: "Add a docstring" }));
  });
});

describe("Agent mode (AG-02)", () => {
  const WS = { id: 1, name: "backend", path: "/code/backend", allow_write: false, created_at: NOW };
  const base = (enabled: boolean) => server.use(
    ok("/workspaces", [WS]), ok("/workspaces/1/tree", []), ok("/changes", []),
    ok("/workspaces/1/summary", { file_count: 0, by_extension: {}, top_level_folders: {}, config_files: [], dependencies: {}, note: "" }),
    ok("/skills", [{ name: "agent_mode", title: "Agent mode", description: "", required_permissions: [], requires_files: false, uses_workspace_summary: true, invocation: "workflow", enabled, input_schema: {}, output_schema: {} }]),
  );

  it("is off until enabled in Skills", async () => {
    base(false);
    renderPage(<ProjectsPage />, { activeWorkspace: 1 });
    expect(await screen.findByRole("link", { name: "Turn it on in Skills" })).toHaveAttribute("href", "/skills");
    expect(screen.queryByRole("button", { name: "Run agent" })).toBeNull();
  });

  it("asks for consent, then shows each step live and the proposals", async () => {
    base(true);
    const bodies: Record<string, unknown>[] = [];
    const proposal = { id: 4, workspace_id: 1, rel_path: "app/auth/login.py", description: "Agent: clearer errors", original_content: "a\n", new_content: "b\n", status: "pending", origin: "ai", created_at: NOW, decided_at: null };
    server.use(http.post(api("/workspaces/1/agent/loop"), async ({ request }) => {
      const b = (await request.json()) as Record<string, unknown>;
      bodies.push(b);
      if (!b.consent_external) return HttpResponse.json({ error: { code: "consent_required", message: "Confirm", details: { files: [], layout: true, agent: true, max_files: 8, chars: 48000, redactions: 0, provider: "nebius", model: "nvidia/test" } } }, { status: 409 });
      return new HttpResponse(sseStream([
        ["step", { n: 1, thought: "Find the login code", tool: "suggest_files", args: { query: "login" }, ok: true, observation: "[...]" }],
        ["step", { n: 2, thought: "", tool: "apply_change", args: {}, ok: false, observation: "error: 'apply_change' is not an available tool." }],
        ["step", { n: 3, thought: "Done", tool: "finish", args: {}, ok: true, observation: "" }],
        ["done", { conversation_id: 9, answer: "I proposed clearer error messages.", steps: 3, reads: 1, proposals: [proposal], provider: { name: "nebius", model: "nvidia/test", is_demo: false }, warnings: [] }],
      ]), { headers: { "content-type": "text/event-stream" } });
    }));
    renderPage(<ProjectsPage />, { activeWorkspace: 1 });
    fireEvent.change(await screen.findByLabelText("What should the agent do?"), { target: { value: "Improve login errors" } });
    fireEvent.click(screen.getByRole("button", { name: "Run agent" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("up to 8 files the agent chooses");
    fireEvent.click(within(dialog).getByRole("button", { name: "Send" }));
    expect(await screen.findByText("I proposed clearer error messages.")).toBeInTheDocument();
    const trace = screen.getByRole("list", { name: "Agent steps" });
    expect(within(trace).getByText("Rank files")).toBeInTheDocument();
    expect(within(trace).getByText("refused")).toBeInTheDocument();
    expect(screen.getAllByText("app/auth/login.py").length).toBeGreaterThan(0);
    expect(bodies.map((b) => b.consent_external ?? false)).toEqual([false, true]);
  });
});

describe("Visual Learning", () => {
  it("falls back to a clear message without WebGL, while parts and explanations still work", async () => {
    renderPage(<VisualLearningPage />);
    expect(screen.getByRole("alert")).toHaveTextContent("may not support WebGL");
    fireEvent.click(screen.getByRole("button", { name: "Load balancer" }));
    expect(screen.getByText("Spreads requests across healthy app servers.")).toBeInTheDocument();
  });

  it("switches to the second scene and steps through it", () => {
    renderPage(<VisualLearningPage />);
    fireEvent.click(screen.getByRole("tab", { name: /Event-driven serverless/ }));
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(screen.getByText("Step 1 of 10")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getAllByText("API gateway").length).toBeGreaterThan(0);
  });

  it("labels AI explanations, or curated text when no model is used (AI-09)", async () => {
    server.use(http.post(api("/learn/explain"), () => HttpResponse.json({ explanation: "It spreads traffic.", analogy: "A host seating guests.", failure_impact: "Requests fail.", ai_generated: true, provider: { name: "nebius", model: "nvidia/test", is_demo: false }, warnings: [] })));
    renderPage(<VisualLearningPage />);
    fireEvent.click(screen.getByRole("button", { name: "Load balancer" }));
    fireEvent.click(screen.getByRole("button", { name: "Explain more with AI" }));
    expect(await screen.findByText("AI-generated: nvidia/test")).toBeInTheDocument();
    expect(screen.getByText("A host seating guests.")).toBeInTheDocument();
  });

  it("prints one marker per scene", () => {
    const { container } = renderPage(<MarkersPage />);
    expect(container.querySelectorAll("figure svg")).toHaveLength(2);
    expect(screen.getByText("Marker #2")).toBeInTheDocument();
  });
});
