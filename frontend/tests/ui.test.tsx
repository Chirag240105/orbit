import { fireEvent, render, screen } from "@testing-library/react";
import { Button, EmptyState, ErrorState } from "../src/components/ui";
import { ApiError, request } from "../src/lib/api";
import { kb, timeAgo } from "../src/lib/format";
import { stepsOf, subjects, threeTierScene } from "../src/features/visual-learning/scenes";

describe("ui primitives", () => {
  it("Button fires onClick and respects disabled", () => {
    const fn = vi.fn();
    const { rerender } = render(<Button onClick={fn}>Go</Button>);
    fireEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(fn).toHaveBeenCalledTimes(1);
    rerender(<Button disabled onClick={fn}>Go</Button>);
    expect(screen.getByRole("button", { name: "Go" })).toBeDisabled();
  });
  it("EmptyState renders title and hint", () => {
    render(<EmptyState title="Nothing yet">Add one.</EmptyState>);
    expect(screen.getByText("Nothing yet")).toBeInTheDocument();
  });
  it("ErrorState explains an unreachable backend", () => {
    render(<ErrorState error={new ApiError("backend_unreachable", "Can't reach it", 0)} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Backend not reachable");
  });
});

describe("api client", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("maps backend error envelopes to ApiError", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 409, json: async () => ({ error: { code: "consent_required", message: "Confirm", details: { chars: 5 } } }) }));
    await expect(request("POST", "/chat", {})).rejects.toMatchObject({ code: "consent_required", status: 409, details: { chars: 5 } });
  });
  it("reports an unreachable backend", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fail")));
    await expect(request("GET", "/health")).rejects.toMatchObject({ code: "backend_unreachable" });
  });
  it("returns undefined for 204", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 204 }));
    await expect(request("DELETE", "/memories")).resolves.toBeUndefined();
  });
});

describe("format helpers", () => {
  it("formats relative time and sizes", () => {
    expect(timeAgo(new Date(Date.now() - 5 * 60000).toISOString())).toBe("5 min ago");
    expect(kb(2500)).toBe("2.5 KB");
  });
});

describe("curated scene data", () => {
  it("has unique ids, valid connections, and explanations for every component", () => {
    const ids = new Set(threeTierScene.components.map((c) => c.id));
    expect(ids.size).toBe(threeTierScene.components.length);
    for (const c of threeTierScene.components) {
      expect(c.summary.length).toBeGreaterThan(10);
      expect(c.details.length).toBeGreaterThan(40);
      c.connectsTo.forEach((t) => expect(ids.has(t)).toBe(true));
    }
  });
  it("orders learning steps uniquely", () => {
    const steps = stepsOf(threeTierScene).map((c) => c.step);
    expect(new Set(steps).size).toBe(steps.length);
  });
  it("marks unsupported subjects explicitly", () => {
    expect(subjects.some((s) => !s.supported && !s.scene)).toBe(true);
  });
});
