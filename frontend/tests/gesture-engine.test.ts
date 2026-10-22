import { describe, expect, it } from "vitest";
import { classifyHandPose, GestureEngine, HOLD_MS, type GestureEvent, type Point } from "../src/vision/gestures";
import { fist, openHand, pinchingHand, pointingHand, thumbsUp } from "./fixtures/hand-landmarks";

const FRAME_MS = 33;
const move = (points: Point[], dx: number, dy = 0) => points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
/** Rotates a hand around its wrist, as when the hand is tilted sideways. */
const rotate = (points: Point[], radians: number) => {
  const { x: cx, y: cy } = points[0];
  const cos = Math.cos(radians), sin = Math.sin(radians);
  return points.map((p) => ({ x: cx + (p.x - cx) * cos - (p.y - cy) * sin, y: cy + (p.x - cx) * sin + (p.y - cy) * cos }));
};

/** Feeds frames to an engine and collects every event. */
function run(engine: GestureEngine, frames: (Point[] | null)[], startAt = 0) {
  const events: GestureEvent[] = [];
  let now = startAt;
  let last = engine.update(null, now).frame;
  for (const frame of frames) {
    now += FRAME_MS;
    const out = engine.update(frame, now);
    events.push(...out.events);
    last = out.frame;
  }
  return { events, last, now };
}
const repeat = (points: Point[], count: number) => Array.from({ length: count }, () => points);

describe("hand pose classification", () => {
  it("recognizes every supported pose", () => {
    expect(classifyHandPose(pointingHand)).toBe("point");
    expect(classifyHandPose(openHand)).toBe("open");
    expect(classifyHandPose(pinchingHand)).toBe("pinch");
    expect(classifyHandPose(thumbsUp)).toBe("thumbs_up");
    expect(classifyHandPose(fist)).toBe("fist");
  });

  it("still recognizes pointing and open palms when the hand is tilted", () => {
    expect(classifyHandPose(rotate(pointingHand, 0.9))).toBe("point");
    expect(classifyHandPose(rotate(openHand, -0.9))).toBe("open");
  });

  it("keeps a held pinch through small jitter near the threshold", () => {
    const loosened = pinchingHand.map((p, i) => (i === 4 ? { x: p.x + 0.1, y: p.y } : p));
    expect(classifyHandPose(loosened, false)).not.toBe("pinch");
    expect(classifyHandPose(loosened, true)).toBe("pinch");
  });
});

describe("gesture engine", () => {
  it("reports a hidden hand when no landmarks arrive", () => {
    expect(new GestureEngine().update(null, 0).frame.visible).toBe(false);
  });

  it("mirrors the index fingertip into stage coordinates", () => {
    const { last } = run(new GestureEngine({ margin: { x: 0, y: 0 } }), repeat(pointingHand, 20));
    expect(last.pose).toBe("point");
    // Index tip is at x = 0.40 in the camera image, which mirrors to 0.60 on screen.
    expect(last.cursor.x).toBeCloseTo(0.6, 2);
    expect(last.cursor.y).toBeCloseTo(0.27, 2);
  });

  it("ignores a single-frame pose glitch", () => {
    const { last } = run(new GestureEngine(), [...repeat(pointingHand, 5), openHand]);
    expect(last.pose).toBe("point");
  });

  it("turns a quick pinch and release into a tap", () => {
    const { events } = run(new GestureEngine(), [...repeat(pointingHand, 4), ...repeat(pinchingHand, 5), ...repeat(pointingHand, 4)]);
    expect(events).toEqual([{ type: "tap" }]);
  });

  it("treats a long pinch as a grab, not a tap", () => {
    const { events, last } = run(new GestureEngine(), [...repeat(pointingHand, 4), ...repeat(pinchingHand, 30)]);
    expect(last.pinching).toBe(true);
    const after = run(new GestureEngine(), [...repeat(pointingHand, 4), ...repeat(pinchingHand, 30), ...repeat(pointingHand, 4)]);
    expect(events).toEqual([]);
    expect(after.events).toEqual([]);
  });

  it("detects a fast horizontal swipe in mirrored screen direction", () => {
    // Moving left in the camera image is moving right on the mirrored screen.
    const sweep = Array.from({ length: 8 }, (_, i) => move(openHand, -i * 0.05));
    const { events } = run(new GestureEngine(), [...repeat(openHand, 3), ...sweep]);
    expect(events).toContainEqual({ type: "swipe", direction: "right" });
  });

  it("does not swipe on slow drift", () => {
    const drift = Array.from({ length: 40 }, (_, i) => move(openHand, -i * 0.006));
    const { events } = run(new GestureEngine(), drift);
    expect(events.filter((e) => e.type === "swipe")).toEqual([]);
  });

  it("fires an open-palm hold once after the hand stays still", () => {
    const frames = Math.ceil(HOLD_MS.open / FRAME_MS) + 10;
    const { events } = run(new GestureEngine(), repeat(openHand, frames * 2));
    expect(events).toEqual([{ type: "hold", pose: "open" }]);
  });

  it("restarts a hold when the hand moves", () => {
    const frames = Array.from({ length: 60 }, (_, i) => move(openHand, (i % 2 ? 1 : -1) * 0.05 * (i % 4 < 2 ? 1 : 0)));
    const { events } = run(new GestureEngine(), frames);
    expect(events.filter((e) => e.type === "hold")).toEqual([]);
  });

  it("fires a thumbs-up hold", () => {
    const frames = Math.ceil(HOLD_MS.thumbs_up / FRAME_MS) + 5;
    const { events } = run(new GestureEngine(), repeat(thumbsUp, frames));
    expect(events).toEqual([{ type: "hold", pose: "thumbs_up" }]);
  });
});
