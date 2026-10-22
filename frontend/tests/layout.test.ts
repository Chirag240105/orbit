import { describe, expect, it } from "vitest";
import { COLUMN_GAP, defineSystem, layerParts, sceneFromGenerated } from "../src/vision/layout";
import type { GeneratedScene } from "../src/types/api";

// The connection graph of a real Gemini-generated Uber design.
const uberLinks: Record<string, string[]> = {
  "rider-app": ["api-gateway"], "driver-app": ["api-gateway", "websocket-gateway"], "api-gateway": ["auth-service", "trip-service", "dispatch-engine"],
  "websocket-gateway": ["location-service"], "auth-service": ["user-db"], "location-service": ["spatial-index", "event-stream"], "spatial-index": [],
  "dispatch-engine": ["spatial-index", "routing-service", "surge-service", "notification-service", "trip-service"], "routing-service": ["spatial-index"],
  "surge-service": ["redis-surge-cache"], "redis-surge-cache": [], "trip-service": ["trip-db", "event-stream", "payment-service"],
  "event-stream": ["analytics-pipeline"], "analytics-pipeline": ["surge-service"], "payment-service": ["payment-gateway"], "payment-gateway": [],
  "notification-service": ["third-party-push"], "third-party-push": [], "trip-db": [], "user-db": [], "system-monitor": [],
};

const generated: GeneratedScene = {
  title: "Uber", description: "A proposed ride-hailing design.",
  overview: { requirements: ["Match riders and drivers"], assumptions: [], architecture: "Services.", requestFlow: ["Rider requests a trip"] },
  parts: Object.entries(uberLinks).map(([id, connectsTo]) => ({
    id, label: id, kind: id.includes("db") ? "database" : id.endsWith("-app") ? "mobile" : "made-up-kind", zone: id.endsWith("-app") ? "internet" : "vpc",
    connectsTo, summary: `${id}.`, details: `${id} details.`, apis: null, failureMode: id === "trip-db" ? "Shard hot spots." : null,
  })),
};

describe("layerParts", () => {
  it("places each part after everything that sends to it", () => {
    const layers = layerParts(Object.entries(uberLinks).map(([id, connectsTo]) => ({ id, connectsTo })));
    for (const [from, tos] of Object.entries(uberLinks)) for (const to of tos) expect(layers.get(to)!).toBeGreaterThan(layers.get(from)!);
    expect(layers.get("rider-app")).toBe(0);
  });

  it("ignores back edges so cycles cannot stretch the layout", () => {
    const layers = layerParts([
      { id: "web", connectsTo: ["crawler"] }, { id: "crawler", connectsTo: ["frontier", "store"] },
      { id: "frontier", connectsTo: ["crawler"] }, { id: "store", connectsTo: [] },
    ]);
    expect([layers.get("web"), layers.get("crawler"), layers.get("frontier"), layers.get("store")]).toEqual([0, 1, 2, 2]);
  });
});

describe("sceneFromGenerated", () => {
  const scene = sceneFromGenerated("Uber", generated);

  it("builds a valid scene with steps in authored order", () => {
    expect(scene.id).toBe("generated-uber");
    expect(scene.components.map((c) => c.step)).toEqual(scene.components.map((_, i) => i + 1));
    const ids = new Set(scene.components.map((c) => c.id));
    scene.components.forEach((c) => c.connectsTo.forEach((t) => expect(ids.has(t)).toBe(true)));
  });

  it("maps unknown kinds to a service and drops empty fields", () => {
    const dispatch = scene.components.find((c) => c.id === "dispatch-engine")!;
    expect(dispatch.kind).toBe("service");
    expect(dispatch.apis).toBeUndefined();
    expect(scene.components.find((c) => c.id === "trip-db")!.failureMode).toBe("Shard hot spots.");
  });

  it("lays parts out left to right without overlapping pedestals", () => {
    const parts = scene.components;
    for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) {
      expect(Math.hypot(parts[i].position[0] - parts[j].position[0], parts[i].position[2] - parts[j].position[2])).toBeGreaterThanOrEqual(2.4);
    }
    const x = (id: string) => scene.components.find((c) => c.id === id)!.position[0];
    expect(x("rider-app")).toBeLessThan(x("api-gateway"));
    expect(x("api-gateway")).toBeLessThan(x("trip-service"));
  });

  it("parks unconnected parts in the last column", () => {
    const maxX = Math.max(...scene.components.map((c) => c.position[0]));
    expect(scene.components.find((c) => c.id === "system-monitor")!.position[0]).toBe(maxX);
  });

  it("keeps the layout centred", () => {
    const xs = scene.components.map((c) => c.position[0]);
    expect(Math.min(...xs) + Math.max(...xs)).toBeCloseTo(0, 5);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThanOrEqual(COLUMN_GAP);
  });
});

describe("defineSystem", () => {
  it("honours pinned layers", () => {
    const scene = defineSystem({
      id: "t", title: "T", description: "d", overview: { requirements: ["r"], assumptions: [], architecture: "a", requestFlow: ["s"] },
      parts: [
        { id: "a", label: "A", kind: "user", connectsTo: ["b"], summary: "s", details: "d" },
        { id: "b", label: "B", kind: "service", connectsTo: ["c"], summary: "s", details: "d" },
        { id: "c", label: "C", kind: "mobile", connectsTo: [], summary: "s", details: "d", layer: 0 },
      ],
    });
    const x = (id: string) => scene.components.find((c) => c.id === id)!.position[0];
    expect(x("c")).toBe(x("a"));
  });
});
