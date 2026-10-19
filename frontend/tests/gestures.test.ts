import { describe, expect, it } from "vitest";
import { classifyFingerGesture, isPinching, type Point } from "../src/features/visual-learning/gestures";

function hand(extended: number[] = []): Point[] {
  const points = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5 }));
  for (const [i, tip] of [8, 12, 16, 20].entries()) {
    points[[6, 10, 14, 18][i]].y = 0.45;
    points[tip].y = extended.includes(i) ? 0.3 : 0.6;
  }
  return points;
}

describe("local hand gesture rules", () => {
  it("recognizes pointing and open palm poses", () => {
    expect(classifyFingerGesture(hand([0]))).toBe("point");
    expect(classifyFingerGesture(hand([0, 1, 2, 3]))).toBe("open");
  });

  it("ignores incomplete and ambiguous poses", () => {
    expect(classifyFingerGesture(hand().slice(0, 12))).toBeNull();
    expect(classifyFingerGesture(hand([0, 1]))).toBeNull();
  });

  it("recognizes a pinch from thumb and index fingertip distance", () => {
    const points = hand();
    points[4] = { x: 0.5, y: 0.5 };
    points[8] = { x: 0.53, y: 0.53 };
    expect(isPinching(points)).toBe(true);
    points[8] = { x: 0.7, y: 0.7 };
    expect(isPinching(points)).toBe(false);
  });
});
