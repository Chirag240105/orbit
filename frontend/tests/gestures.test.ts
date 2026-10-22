import { describe, expect, it } from "vitest";
import { classifyFingerGesture, isPinching, mapLandmarkToViewport } from "../src/vision/gestures";
import { openHand, pinchingHand, pointingHand } from "./fixtures/hand-landmarks";

describe("local hand gesture rules", () => {
  it("recognizes pointing and open palm poses", () => {
    expect(classifyFingerGesture(pointingHand)).toBe("point");
    expect(classifyFingerGesture(openHand)).toBe("open");
  });

  it("ignores incomplete and ambiguous poses", () => {
    expect(classifyFingerGesture(pointingHand.slice(0, 12))).toBeNull();
    expect(classifyFingerGesture(pointingHand.map((p, i) => i === 12 ? { ...p, y: 0.3 } : p))).toBeNull();
  });

  it("recognizes a pinch from thumb and index fingertip distance", () => {
    expect(isPinching(pinchingHand)).toBe(true);
    expect(isPinching(openHand)).toBe(false);
  });

  it("mirrors landmark coordinates and maps them into viewport world space", () => {
    expect(mapLandmarkToViewport({ x: 0.25, y: 0.75 }, 800, 600)).toEqual({
      screenX: 0.75, screenY: 0.75, worldX: 200, worldY: -150,
    });
  });
});
