import { describe, expect, it } from "vitest";
import { componentKinds, ecommerceScene, kindLabels, kindOf, llmPlatformScene, matchCuratedSubject, subjects, threeTierScene, createTopicScene, stepsOf } from "../src/vision/scenes";

function validateScene(scene: typeof threeTierScene) {
  const ids = new Set(scene.components.map((c) => c.id));
  expect(ids.size).toBe(scene.components.length); // no duplicate IDs

  for (const c of scene.components) {
    expect(c.id).toBeTruthy();
    expect(c.label).toBeTruthy();
    expect(c.summary).toBeTruthy();
    expect(c.details).toBeTruthy();
    expect(["box", "cylinder", "sphere"]).toContain(c.shape);
    expect(c.color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(c.position).toHaveLength(3);
    expect(c.size).toHaveLength(3);
    expect(c.step).toBeGreaterThan(0);
    // Every component resolves to a known 3D model archetype.
    expect(componentKinds).toContain(kindOf(c));
    // All connectsTo targets must exist
    for (const t of c.connectsTo) {
      expect(ids.has(t)).toBe(true);
    }
  }

  // Steps should be sequential
  const steps = stepsOf(scene);
  expect(steps.length).toBe(scene.components.length);
  for (let i = 0; i < steps.length; i++) {
    expect(steps[i].step).toBe(i + 1);
  }
}

describe("three-tier scene", () => {
  it("has valid component data", () => validateScene(threeTierScene));
});

describe("ecommerce scene", () => {
  it("has valid component data", () => validateScene(ecommerceScene));

  it("includes structured learning content for key components", () => {
    const catalog = ecommerceScene.components.find((c) => c.id === "catalog")!;
    expect(catalog.apis).toBeTruthy();
    expect(catalog.dataModel).toBeTruthy();
    expect(catalog.failureMode).toBeTruthy();
    expect(catalog.scaling).toBeTruthy();
  });

  it("has a system-design overview", () => {
    expect(ecommerceScene.overview).toBeDefined();
    expect(ecommerceScene.overview!.requirements.length).toBeGreaterThan(0);
    expect(ecommerceScene.overview!.assumptions.length).toBeGreaterThan(0);
    expect(ecommerceScene.overview!.architecture).toBeTruthy();
    expect(ecommerceScene.overview!.requestFlow.length).toBeGreaterThan(0);
  });

  it("covers the e-commerce request flow: catalog, cart, order, payment, inventory", () => {
    const ids = new Set(ecommerceScene.components.map((c) => c.id));
    expect(ids.has("customer")).toBe(true);
    expect(ids.has("cdn")).toBe(true);
    expect(ids.has("api-gateway")).toBe(true);
    expect(ids.has("catalog")).toBe(true);
    expect(ids.has("cart")).toBe(true);
    expect(ids.has("order")).toBe(true);
    expect(ids.has("payment")).toBe(true);
    expect(ids.has("inventory")).toBe(true);
    expect(ids.has("db")).toBe(true);
    expect(ids.has("cache")).toBe(true);
    expect(ids.has("queue")).toBe(true);
  });
});

describe("subjects list", () => {
  it("includes the ecommerce scene as supported", () => {
    const ecommerce = subjects.find((s) => s.id === "ecommerce-amazon");
    expect(ecommerce).toBeDefined();
    expect(ecommerce!.supported).toBe(true);
    expect(ecommerce!.scene).toBeDefined();
  });

  it("includes the three-tier scene as supported", () => {
    const threeTier = subjects.find((s) => s.id === "three-tier-web-app");
    expect(threeTier).toBeDefined();
    expect(threeTier!.supported).toBe(true);
  });
});

describe("createTopicScene", () => {
  it("creates a valid scene for a custom topic", () => {
    const scene = createTopicScene("banking system");
    validateScene(scene);
    expect(scene.title.toLowerCase()).toContain("banking");
  });

  it("creates a valid scene for a generic topic", () => {
    const scene = createTopicScene("restaurant");
    validateScene(scene);
    expect(scene.components.length).toBeGreaterThan(0);
  });
});

describe("component kinds", () => {
  it("has a display label for every kind", () => {
    for (const kind of componentKinds) expect(kindLabels[kind]).toBeTruthy();
  });

  it("falls back to a kind derived from the shape", () => {
    const base = threeTierScene.components[0];
    expect(kindOf({ ...base, kind: undefined, shape: "cylinder" })).toBe("database");
    expect(kindOf({ ...base, kind: undefined, shape: "sphere" })).toBe("user");
    expect(kindOf({ ...base, kind: undefined, shape: "box" })).toBe("service");
    expect(kindOf({ ...base, kind: "cache" })).toBe("cache");
  });
});

describe("LLM platform scene", () => {
  it("has valid component data", () => validateScene(llmPlatformScene));

  it("covers the full serving, retrieval and ingestion paths", () => {
    expect(llmPlatformScene.components.length).toBeGreaterThanOrEqual(20);
    const ids = new Set(llmPlatformScene.components.map((c) => c.id));
    for (const id of ["api-gateway", "rate-limiter", "orchestrator", "embedder", "vector-db", "router", "gpu-a", "kv-cache", "ingest-queue"]) expect(ids.has(id)).toBe(true);
    expect(llmPlatformScene.components.filter((c) => c.zone === "gpu").length).toBeGreaterThanOrEqual(3);
    expect(llmPlatformScene.overview?.requestFlow.length).toBeGreaterThan(0);
  });

  it("keeps pedestals from overlapping", () => {
    const parts = llmPlatformScene.components;
    for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) {
      const d = Math.hypot(parts[i].position[0] - parts[j].position[0], parts[i].position[2] - parts[j].position[2]);
      expect(d).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("matchCuratedSubject", () => {
  it("routes known topics to full hand-built scenes", () => {
    expect(matchCuratedSubject("LLM serving platform with retrieval (a ChatGPT-style system)")).toBe(llmPlatformScene.id);
    expect(matchCuratedSubject("how does ChatGPT work")).toBe(llmPlatformScene.id);
    expect(matchCuratedSubject("RAG pipeline")).toBe(llmPlatformScene.id);
    expect(matchCuratedSubject("Amazon")).toBe(ecommerceScene.id);
  });

  it("does not match words that merely contain a keyword", () => {
    expect(matchCuratedSubject("cloud storage")).toBeNull();
    expect(matchCuratedSubject("banking system")).toBeNull();
  });
});
