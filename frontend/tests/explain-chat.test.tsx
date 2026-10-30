/**
 * Tests for the FloatingExplainChat component:
 *
 * 1. Render with open=true → window present, input pre-filled, zero API calls
 * 2. Selecting a different part while open → draft unchanged, zero API calls
 * 3. "Use this part" → draft updated, still zero API calls
 * 4. Press Send → exactly one chatStream call; Send disabled while "busy"
 * 5. Stop button → aborts the in-flight request
 * 6. Close → no API call; component unmounts
 * 7. Untrusted synthetic click guard — the isTrusted check is in VisualLearningPage,
 *    tested here by confirming FloatingExplainChat itself never auto-calls chatStream
 */

import { fireEvent, render, screen, waitFor, act } from "@testing-library/react";
import { FloatingExplainChat, buildDraft, type ComponentContext } from "../src/vision/ExplainDrawer";

// ── Test fixtures ────────────────────────────────────────────────────────────

const makeCtx = (label = "API Gateway", scene = "Netflix"): ComponentContext => ({
  sceneTitle: scene,
  label,
  kind: "gateway",
  zone: "vpc",
  summary: "Routes all incoming traffic.",
  details: "Terminates TLS, rate-limits, routes.",
  apis: "GET /api/*",
  failureMode: "Single point of failure if not HA.",
  scaling: "Horizontally scaled Envoy fleet.",
});

const otherCtx = makeCtx("CDN Edge", "Netflix");

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockQc = {
  invalidateQueries: vi.fn(),
};

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQueryClient: () => mockQc,
  };
});

// chatStream mock — resolves with a minimal ChatResponse
const mockChatStream = vi.fn();
vi.mock("../src/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/api")>();
  return {
    ...actual,
    chatStream: (...args: unknown[]) => mockChatStream(...args),
  };
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeChatResponse() {
  return {
    conversation_id: 42,
    message_id: 1,
    skill: "general_qa",
    output: {
      answer: "The API Gateway routes all traffic through Envoy proxies.",
      key_points: ["TLS termination", "Rate limiting"],
      follow_ups: ["What happens on gateway failure?"],
    },
    provider: { name: "nvidia", model: "nemotron", is_demo: false },
    context: { memory_ids: [], files: [], chars_sent: 0, redactions: 0, external: false },
    proposed_tasks: [],
    warnings: [],
    intent: "chat" as const,
    tool_calls: [],
    pending_actions: [],
  };
}

function renderChat(props: Partial<React.ComponentProps<typeof FloatingExplainChat>> = {}) {
  const ctx = makeCtx();
  return render(
    <FloatingExplainChat
      open={true}
      onClose={vi.fn()}
      explainContext={ctx}
      currentContext={ctx}
      onMemorySaved={vi.fn()}
      {...props}
    />,
  );
}

// ── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

describe("FloatingExplainChat — no auto-send", () => {
  it("renders the window and pre-fills the draft on open — zero API calls", () => {
    renderChat();

    // Window is present
    expect(screen.getByTestId("explain-chat-window")).toBeInTheDocument();

    // Input is pre-filled with the draft
    const input = screen.getByTestId("explain-draft-input") as HTMLTextAreaElement;
    expect(input.value).toContain("API Gateway");
    expect(input.value).toContain("Netflix");

    // No API call made
    expect(mockChatStream).not.toHaveBeenCalled();
  });

  it("does NOT send when opened — not even after the useEffect runs", async () => {
    renderChat();
    // Wait a tick for all effects to settle
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(mockChatStream).not.toHaveBeenCalled();
  });

  it("shows the context chip with 'Nothing is sent until you press Send'", () => {
    renderChat();
    expect(screen.getByText(/Nothing is sent until you press Send/i)).toBeInTheDocument();
  });
});

describe("FloatingExplainChat — different part selected while open", () => {
  it("does NOT change the draft when currentContext changes — zero API calls", async () => {
    const ctx = makeCtx();
    const { rerender } = renderChat({ explainContext: ctx, currentContext: ctx });

    const input = screen.getByTestId("explain-draft-input") as HTMLTextAreaElement;
    const originalDraft = input.value;
    expect(originalDraft).toContain("API Gateway");

    // User selects a different part — only currentContext changes
    rerender(
      <FloatingExplainChat
        open={true}
        onClose={vi.fn()}
        explainContext={ctx}
        currentContext={otherCtx}
        onMemorySaved={vi.fn()}
      />,
    );

    // Draft is unchanged
    expect(input.value).toBe(originalDraft);

    // "Use this part" button appears
    expect(screen.getByText("Use this part")).toBeInTheDocument();

    // Zero API calls
    expect(mockChatStream).not.toHaveBeenCalled();
  });

  it("'Use this part' updates draft to the new part — still zero API calls", async () => {
    const ctx = makeCtx();
    const { rerender } = renderChat({ explainContext: ctx, currentContext: ctx });

    rerender(
      <FloatingExplainChat
        open={true}
        onClose={vi.fn()}
        explainContext={ctx}
        currentContext={otherCtx}
        onMemorySaved={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText("Use this part"));

    const input = screen.getByTestId("explain-draft-input") as HTMLTextAreaElement;
    expect(input.value).toContain("CDN Edge");

    expect(mockChatStream).not.toHaveBeenCalled();
  });
});

describe("FloatingExplainChat — Send button", () => {
  it("clicking Send fires exactly one chatStream call with the draft text", async () => {
    mockChatStream.mockResolvedValueOnce(makeChatResponse());

    renderChat();

    const sendBtn = screen.getByTestId("explain-send-btn");
    expect(sendBtn).not.toBeDisabled();

    fireEvent.click(sendBtn);

    expect(mockChatStream).toHaveBeenCalledTimes(1);
    const [req] = mockChatStream.mock.calls[0] as [import("../src/types/api").ChatRequest, ...unknown[]];
    expect(req.message).toContain("API Gateway");
  });

  it("Send is disabled while a request is in-flight", async () => {
    // Never resolves during this test
    let resolveStream!: (v: unknown) => void;
    mockChatStream.mockReturnValueOnce(new Promise((r) => { resolveStream = r; }));

    renderChat();
    fireEvent.click(screen.getByTestId("explain-send-btn"));

    // Send button replaced by Stop button while streaming
    await waitFor(() =>
      expect(screen.queryByTestId("explain-send-btn")).not.toBeInTheDocument(),
    );
    expect(screen.getByTestId("explain-stop-btn")).toBeInTheDocument();

    // Cleanup — resolve so no hanging promise
    resolveStream(makeChatResponse());
  });

  it("Stop button aborts the stream — no subsequent UI crash", async () => {
    mockChatStream.mockImplementationOnce(
      (_req: unknown, _onEvent: unknown) =>
        new Promise((_res, _rej) => {
          // Simulate in-flight request that never resolves
        }),
    );

    renderChat();
    fireEvent.click(screen.getByTestId("explain-send-btn"));

    await waitFor(() =>
      expect(screen.getByTestId("explain-stop-btn")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByTestId("explain-stop-btn"));

    // After stopping, Send button should come back
    await waitFor(() =>
      expect(screen.getByTestId("explain-send-btn")).toBeInTheDocument(),
    );
  });
});

describe("FloatingExplainChat — close and minimise", () => {
  it("Close calls onClose with no API call", () => {
    const onClose = vi.fn();
    renderChat({ onClose });

    fireEvent.click(screen.getByLabelText("Close"));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockChatStream).not.toHaveBeenCalled();
  });

  it("Minimise hides the message list and input — no API call", () => {
    renderChat();
    fireEvent.click(screen.getByLabelText("Minimise"));
    expect(screen.queryByTestId("explain-draft-input")).not.toBeInTheDocument();
    expect(mockChatStream).not.toHaveBeenCalled();
  });
});

describe("buildDraft helper", () => {
  it("includes label, kind, zone and sceneTitle", () => {
    const draft = buildDraft(makeCtx());
    expect(draft).toContain("API Gateway");
    expect(draft).toContain("gateway");
    expect(draft).toContain("Netflix");
  });
});

// ── Structured streaming: no raw JSON shown during processing ──────────

describe("Structured streaming — no partial JSON in the UI", () => {
  it("shows a stage label spinner, not raw JSON, while a structured call is running", async () => {
    // Simulate a slow stream: first emit a stage event, then resolve
    let resolveStream!: (v: unknown) => void;
    mockChatStream.mockImplementationOnce((_req, onEvent) =>
      new Promise((res) => {
        resolveStream = res;
        // The backend emits a "stage" event but NO "token" events for structured calls
        setTimeout(() => onEvent?.("stage", { label: "Building answer…", task: "fast" }), 10);
      }),
    );

    renderChat();
    fireEvent.click(screen.getByTestId("explain-send-btn"));

    // The spinner should show "Building answer…" not raw JSON
    await waitFor(() =>
      expect(screen.getByText("Building answer…")).toBeInTheDocument(),
    );

    // No raw JSON fragments should be visible
    expect(screen.queryByText(/{/)).not.toBeInTheDocument();
    expect(screen.queryByText(/"summary"/)).not.toBeInTheDocument();

    // Cleanup — resolve so no hanging promise
    resolveStream(makeChatResponse());
  });

  it("renders structured answer only after done — never partial JSON", async () => {
    const cleanOutput = {
      summary: "The Redis cache stores hot data in memory for sub-millisecond reads.",
      sections: [{ heading: "What it does", bullets: ["Caches query results."] }],
      key_takeaway: "Redis is the speed layer; PostgreSQL is the source of truth.",
      follow_ups: ["What happens on cache eviction?", "How to handle cache stampede?", "TTL strategy?"],
      suggested_memory: null,
    };

    mockChatStream.mockResolvedValueOnce({ ...makeChatResponse(), output: cleanOutput });

    renderChat();
    fireEvent.click(screen.getByTestId("explain-send-btn"));

    // While streaming: only spinner or stage label, no JSON content
    expect(screen.queryByText("The Redis cache stores hot data")).not.toBeInTheDocument();

    // After done: structured answer appears
    await waitFor(() =>
      expect(screen.getByText("The Redis cache stores hot data in memory for sub-millisecond reads.")).toBeInTheDocument(),
    );

    // Key takeaway callout visible
    expect(screen.getByText("Redis is the speed layer; PostgreSQL is the source of truth.")).toBeInTheDocument();
  });
});

// ── StructuredAnswer rendering ────────────────────────────────────────────

describe("StructuredAnswer rendering via FloatingExplainChat", () => {
  it("renders summary text from clean output", async () => {
    const cleanOutput = {
      summary: "The CDN distributes assets globally via edge PoPs.",
      sections: [
        { heading: "What it does", bullets: ["Caches images at ISPs.", "Reduces origin load."] },
        { heading: "How it can fail", bullets: ["Cache poisoning risk."] },
      ],
      key_takeaway: "The CDN is why Netflix can stream to 260M users.",
      follow_ups: ["What if a PoP goes offline?", "How does invalidation work?", "Stale content tradeoff?"],
      suggested_memory: null,
    };

    // Simulate a sent+received conversation
    mockChatStream.mockResolvedValueOnce({ ...makeChatResponse(), output: cleanOutput });

    renderChat();
    fireEvent.click(screen.getByTestId("explain-send-btn"));

    await waitFor(() =>
      expect(screen.queryByTestId("explain-stop-btn")).not.toBeInTheDocument(),
    );

    expect(screen.getByText("The CDN distributes assets globally via edge PoPs.")).toBeInTheDocument();
    expect(screen.getByText("The CDN is why Netflix can stream to 260M users.")).toBeInTheDocument();
    expect(screen.getByText("Caches images at ISPs.")).toBeInTheDocument();
  });

  it("follow-up chip click fills the draft input — nothing is sent", async () => {
    const cleanOutput = {
      summary: "The API Gateway routes traffic.",
      sections: [],
      key_takeaway: "",
      follow_ups: ["What if the gateway is down?", "How to add circuit breaking?", "Canary strategy?"],
      suggested_memory: null,
    };

    mockChatStream.mockResolvedValueOnce({ ...makeChatResponse(), output: cleanOutput });

    renderChat();
    fireEvent.click(screen.getByTestId("explain-send-btn"));

    await waitFor(() =>
      expect(screen.getByText("What if the gateway is down?")).toBeInTheDocument(),
    );

    // Before clicking chip: only 1 chatStream call (the Send)
    expect(mockChatStream).toHaveBeenCalledTimes(1);

    // Click a follow-up chip
    fireEvent.click(screen.getByText("What if the gateway is down?"));

    // Draft input updated
    const input = screen.getByTestId("explain-draft-input") as HTMLTextAreaElement;
    expect(input.value).toBe("What if the gateway is down?");

    // Still only 1 API call — chip click does NOT send
    expect(mockChatStream).toHaveBeenCalledTimes(1);
  });

  it("schema-echo output does NOT show raw JSON keys like 'type' or 'items'", async () => {
    const schemaEchoOutput = {
      answer: { title: "Web Client", type: "string", description: "The browser interface." },
      key_points: { items: ["Streams tokens.", "Uses SSE."], title: "Key Points", type: "array" },
      follow_ups: { items: ["Q1?", "Q2?"], type: "array" },
      suggested_memory: null,
    };

    mockChatStream.mockResolvedValueOnce({ ...makeChatResponse(), output: schemaEchoOutput });

    renderChat();
    fireEvent.click(screen.getByTestId("explain-send-btn"));

    await waitFor(() =>
      expect(screen.queryByTestId("explain-stop-btn")).not.toBeInTheDocument(),
    );

    // "type" as a raw JSON key must not be visible to the user
    expect(screen.queryByText(/"type":\s*"string"/)).not.toBeInTheDocument();
    expect(screen.queryByText(/"type":\s*"array"/)).not.toBeInTheDocument();
    // The actual description content should appear
    expect(screen.getByText(/browser interface/i)).toBeInTheDocument();
  });
});
