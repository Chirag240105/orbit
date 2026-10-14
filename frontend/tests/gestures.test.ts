/** CV-02: gesture classification and tracking on synthetic hands (MediaPipe's 21-point layout). */
import { GestureTracker, classify, type Point } from "../src/lib/gestures";

type Finger = "up" | "down";
/** A right hand facing the camera; wrist at the bottom, palm height 0.2 (image units), shifted by (ox, oy). */
function hand({ index = "up", middle = "up", ring = "up", pinky = "up", pinch = false }: { index?: Finger; middle?: Finger; ring?: Finger; pinky?: Finger; pinch?: boolean }, ox = 0, oy = 0): Point[] {
  const pts: Point[] = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.8 }));
  const set = (i: number, x: number, y: number) => { pts[i] = { x: x + ox, y: y + oy }; };
  set(0, 0.5, 0.8);
  const fingers: [number, number, number, Finger][] = [[5, 0.44, 8, index], [9, 0.5, 12, middle], [13, 0.56, 16, ring], [17, 0.62, 20, pinky]];
  for (const [base, x, tip, state] of fingers) {
    set(base, x, 0.6);
    set(base + 1, x, 0.5); // PIP
    set(base + 2, x, state === "up" ? 0.42 : 0.62);
    set(tip, x, state === "up" ? 0.35 : 0.66);
  }
  set(1, 0.42, 0.75); set(2, 0.38, 0.7); set(3, 0.35, 0.65);
  if (pinch) set(4, pts[8].x - ox + 0.01, pts[8].y - oy + 0.01);
  else set(4, 0.3, 0.6);
  return pts;
}

describe("classify", () => {
  it("recognizes the three gestures and ignores a fist", () => {
    expect(classify(hand({}))).toBe("open");
    expect(classify(hand({ ring: "down", pinky: "down" }))).toBe("two");
    expect(classify(hand({ pinch: true }))).toBe("pinch");
    expect(classify(hand({ index: "down", middle: "down", ring: "down", pinky: "down" }))).toBe("none");
    expect(classify(null)).toBe("none");
    expect(classify([{ x: 0, y: 0 }])).toBe("none");
  });
});

describe("GestureTracker", () => {
  const frames = (t: GestureTracker, hands: (Point[] | null)[], step = 70) => hands.map((h, i) => t.update(h, i * step));

  it("needs a stable pose before acting, then rotates with pinch movement (mirrored horizontally)", () => {
    const t = new GestureTracker();
    const out = frames(t, [hand({ pinch: true }), hand({ pinch: true }), hand({ pinch: true }, 0, 0), hand({ pinch: true }, -0.05, 0.02)]);
    expect(out.slice(0, 3)).toEqual([null, null, null]);
    expect(out[3]).toMatchObject({ type: "rotate" });
    const r = out[3] as { dx: number; dy: number };
    expect(r.dx).toBeGreaterThan(0); // hand moved left in the raw image = the user's right
    expect(r.dy).toBeGreaterThan(0);
    expect(t.current).toBe("pinch");
  });

  it("ignores jitter inside the dead zone", () => {
    const t = new GestureTracker();
    const out = frames(t, [hand({ pinch: true }), hand({ pinch: true }), hand({ pinch: true }, 0.001, 0.001), hand({ pinch: true }, 0.002, 0)]);
    expect(out.filter(Boolean)).toEqual([]);
  });

  it("zooms in when two fingers move up and out when they move down", () => {
    const two = (oy: number) => hand({ ring: "down", pinky: "down" }, 0, oy);
    const t = new GestureTracker();
    const out = frames(t, [two(0), two(0), two(0), two(-0.04), two(0.02)]);
    expect((out[3] as { amount: number }).amount).toBeGreaterThan(0);
    expect((out[4] as { amount: number }).amount).toBeLessThan(0);
  });

  it("resets once after an open palm is held for a second", () => {
    const t = new GestureTracker();
    const out = frames(t, Array.from({ length: 20 }, () => hand({})), 100);
    expect(out.filter((e) => e?.type === "reset")).toHaveLength(1);
    expect(out.findIndex((e) => e?.type === "reset")).toBe(10);
  });

  it("starts over when the pose changes or the hand leaves", () => {
    const t = new GestureTracker();
    frames(t, [hand({ pinch: true }), hand({ pinch: true }), hand({ pinch: true })]);
    expect(t.update(null, 500)).toBeNull();
    expect(t.current).toBe("none");
    expect(t.update(hand({ pinch: true }, 0.2, 0), 600)).toBeNull(); // first frame of a new pinch: no jump from the old position
  });
});
