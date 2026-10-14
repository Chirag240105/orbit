/** CV-02: turn MediaPipe hand landmarks into scene controls. Pure logic, no camera or model here, so it is testable.
 *   pinch (thumb + index) and move  -> rotate
 *   two fingers (index + middle) up/down -> zoom in/out
 *   open palm held for 1 second     -> reset the view
 * Landmark indices follow MediaPipe's hand model: 0 wrist, 4 thumb tip, 8 index tip, 12 middle tip, 16 ring tip,
 * 20 pinky tip; PIP joints 6, 10, 14, 18; middle-finger base 9. Coordinates are normalized to the image (0..1). */
export type Point = { x: number; y: number; z?: number };
export type Pose = "pinch" | "two" | "open" | "none";
export type GestureEvent = { type: "rotate"; dx: number; dy: number } | { type: "zoom"; amount: number } | { type: "reset" };

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const extended = (h: Point[], tip: number, pip: number) => dist(h[0], h[tip]) > dist(h[0], h[pip]) * 1.1;

export function classify(hand: Point[] | null): Pose {
  if (!hand || hand.length < 21) return "none";
  const scale = dist(hand[0], hand[9]) || 1e-6;
  if (dist(hand[4], hand[8]) < 0.35 * scale) return "pinch";
  const [i, m, r, p] = [extended(hand, 8, 6), extended(hand, 12, 10), extended(hand, 16, 14), extended(hand, 20, 18)];
  if (i && m && r && p) return "open";
  if (i && m && !r && !p) return "two";
  return "none";
}

export const POSE_LABEL: Record<Pose, string> = { pinch: "Pinch: rotating", two: "Two fingers: zooming", open: "Open palm: hold to reset", none: "No gesture" };

/** Stateful: a pose must hold for `stable` frames before it acts, movement under `deadzone` is ignored, and reset
 * fires once per open-palm hold. The camera image is mirrored for the user, so horizontal movement is flipped. */
export class GestureTracker {
  private pose: Pose = "none";
  private frames = 0;
  private last: Point | null = null;
  private openSince: number | null = null;
  private resetDone = false;

  constructor(private opts = { stable: 2, deadzone: 0.004, rotateGain: 1.6, zoomGain: 6, holdMs: 1000 }) {}

  get current(): Pose {
    return this.frames >= this.opts.stable ? this.pose : "none";
  }

  update(hand: Point[] | null, now: number): GestureEvent | null {
    const pose = classify(hand);
    if (pose !== this.pose) {
      this.pose = pose;
      this.frames = 1;
      this.last = null;
      this.openSince = pose === "open" ? now : null;
      this.resetDone = false;
      return null;
    }
    this.frames++;
    if (this.frames < this.opts.stable || !hand) return null;
    if (pose === "open") {
      if (!this.resetDone && this.openSince !== null && now - this.openSince >= this.opts.holdMs) {
        this.resetDone = true;
        return { type: "reset" };
      }
      return null;
    }
    const anchor = pose === "pinch" ? { x: (hand[4].x + hand[8].x) / 2, y: (hand[4].y + hand[8].y) / 2 } : pose === "two" ? hand[8] : null;
    if (!anchor) return null;
    const prev = this.last;
    this.last = anchor;
    if (!prev) return null;
    const dx = -(anchor.x - prev.x), dy = anchor.y - prev.y;
    if (pose === "pinch" && Math.hypot(dx, dy) > this.opts.deadzone) return { type: "rotate", dx: dx * this.opts.rotateGain, dy: dy * this.opts.rotateGain };
    if (pose === "two" && Math.abs(dy) > this.opts.deadzone) return { type: "zoom", amount: -dy * this.opts.zoomGain };
    return null;
  }
}
