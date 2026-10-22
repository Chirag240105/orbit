import { describe, expect, it } from "vitest";
import { ecommerceScene, subjects, threeTierScene, createTopicScene, stepsOf } from "../src/vision/scenes";

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
