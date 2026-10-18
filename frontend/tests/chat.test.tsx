/** FE-04: streaming chat. Partial text shows before validation, Stop cancels, consent and errors stay inline. */
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { ChatPage } from "../src/features/chat/ChatPage";
import { HEALTH, api, ok, renderPage, server, sseStream } from "./helpers";

const NOW = new Date().toISOString();
const DONE = {
  conversation_id: 7, message_id: 2, skill: "learn_topic",
  output: { explanation: "Kubernetes runs containers for you.", diagram: "[pod] -> [node]", interview_questions: ["What is a pod?"], key_points: [] },
  provider: { name: "nebius", model: "nvidia/test", is_demo: false }, context: { memory_ids: [], files: [], layout: false, chars_sent: 10, redactions: 0, external: true, routing: "keywords" },
  proposed_tasks: [], warnings: [],
};
const MESSAGES = [
  { id: 1, role: "user", content: "Teach me Kubernetes", skill: null, meta: null, created_at: NOW },
  { id: 2, role: "assistant", content: DONE.output, skill: "learn_topic", meta: { provider: DONE.provider, context: DONE.context, warnings: [] }, created_at: NOW },
];

function base() {
  server.use(ok("/health", { ...HEALTH, provider: { ...HEALTH.provider, is_demo: false, name: "nebius" } }), ok("/conversations", []), ok("/skills", []), ok("/conversations/7/messages", MESSAGES));
}
const send = (text: string) => {
  fireEvent.change(screen.getByLabelText("Message"), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
};

it("streams readable partial text, then shows the validated answer", async () => {
  base();
  server.use(http.post(api("/chat/stream"), () => new HttpResponse(sseStream([
    ["status", { status: "thinking" }], ["token", { text: '{"explanation": "Kubernetes runs ' }], ["token", { text: 'containers' }],
    ["status", { status: "validating" }], ["done", DONE],
  ], { gapMs: 40 }), { headers: { "content-type": "text/event-stream" } })));
  renderPage(<ChatPage />);
  send("Teach me Kubernetes");
  expect(await screen.findByText(/Kubernetes runs containers$/)).toBeInTheDocument(); // partial, not raw JSON
  expect(screen.getByTestId("live-answer")).not.toHaveTextContent("{");
  expect(await screen.findByText("Kubernetes runs containers for you.")).toBeInTheDocument();
  expect(screen.getByText("[pod] -> [node]")).toBeInTheDocument();
  expect(screen.getByText("What is a pod?")).toBeInTheDocument();
  expect(screen.queryByTestId("live-answer")).toBeNull();
});

it("Stop cancels a running answer", async () => {
  base();
  server.use(http.post(api("/chat/stream"), () => new HttpResponse(sseStream([["token", { text: "Thinking about it" }]], { holdOpen: true }), { headers: { "content-type": "text/event-stream" } })));
  renderPage(<ChatPage />);
  send("long question");
  await screen.findByText("Thinking about it");
  fireEvent.click(screen.getAllByRole("button", { name: "Stop" })[0]);
  expect(await screen.findByText("Stopped")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument();
});

it("asks for consent before sending workspace data, then resends with consent", async () => {
  base();
  const bodies: Record<string, unknown>[] = [];
  server.use(
    http.post(api("/chat/stream"), async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      bodies.push(body);
      if (!body.consent_external) return HttpResponse.json({ error: { code: "consent_required", message: "Confirm", details: { files: ["src/app.py"], layout: true, chars: 1200, redactions: 2, provider: "nebius", model: "nvidia/test" } } }, { status: 409 });
      return new HttpResponse(sseStream([["done", DONE]]), { headers: { "content-type": "text/event-stream" } });
    }),
  );
  renderPage(<ChatPage />);
  send("explain the architecture of this project");
  const dialog = await screen.findByRole("dialog");
  expect(dialog).toHaveTextContent("src/app.py");
  expect(dialog).toHaveTextContent("project layout");
  expect(dialog).toHaveTextContent("2 likely secret(s) redacted");
  fireEvent.click(within(dialog).getByRole("button", { name: "Send" }));
  await screen.findByText("Kubernetes runs containers for you.");
  expect(bodies.map((b) => b.consent_external ?? false)).toEqual([false, true]);
});

it("shows a mid-stream error inline with a recovery hint", async () => {
  base();
  server.use(http.post(api("/chat/stream"), () => new HttpResponse(sseStream([["error", { code: "provider_empty_response", message: "The model returned no answer." }]]), { headers: { "content-type": "text/event-stream" } })));
  renderPage(<ChatPage />);
  send("hi");
  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent("The model returned no answer");
  expect(alert).toHaveTextContent("NEBIUS_MAX_TOKENS");
});

it("opens the conversation passed from Home", async () => {
  base();
  renderPage(<ChatPage />, { route: { pathname: "/chat", state: { conversationId: 7 } } });
  expect(await screen.findByText("Kubernetes runs containers for you.")).toBeInTheDocument();
});

it("disables Send when no model is configured", async () => {
  server.use(ok("/health", { ...HEALTH, provider: { ...HEALTH.provider, configured: false, is_demo: false } }), ok("/conversations", []), ok("/skills", []));
  renderPage(<ChatPage />);
  expect(await screen.findByText("No model is configured")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Message"), { target: { value: "hi" } });
  await waitFor(() => expect(screen.getByRole("button", { name: "Send" })).toBeDisabled());
});

it("Enter sends the message; Shift+Enter does not", async () => {
  base();
  const bodies: unknown[] = [];
  server.use(http.post(api("/chat/stream"), async ({ request }) => {
    bodies.push(await request.json());
    return new HttpResponse(sseStream([["done", DONE]]), { headers: { "content-type": "text/event-stream" } });
  }));
  renderPage(<ChatPage />);
  const box = screen.getByLabelText("Message");
  fireEvent.change(box, { target: { value: "Teach me Kubernetes" } });
  fireEvent.keyDown(box, { key: "Enter", shiftKey: true });
  expect(box).toHaveValue("Teach me Kubernetes");
  fireEvent.keyDown(box, { key: "Enter" });
  expect(await screen.findByText("Kubernetes runs containers for you.")).toBeInTheDocument();
  expect(bodies).toHaveLength(1);
  expect(box).toHaveValue("");
});
