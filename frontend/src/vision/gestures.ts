export type Point = { x: number; y: number; z?: number };
export type FingerGesture = "point" | "open";
export type CursorPosition = { screenX: number; screenY: number; worldX: number; worldY: number };
/** Every pose ORBIT recognizes from one hand. */
export type HandPose = "point" | "open" | "pinch" | "thumbs_up" | "fist";

export function mapLandmarkToViewport(point: Point, viewportWidth: number, viewportHeight: number): CursorPosition {
  const screenX = 1 - point.x;
  return {
    screenX,
    screenY: point.y,
    worldX: (screenX - 0.5) * viewportWidth,
    worldY: -(point.y - 0.5) * viewportHeight,
  };
}

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const FINGERS = [
  { tip: 8, pip: 6 },
  { tip: 12, pip: 10 },
  { tip: 16, pip: 14 },
  { tip: 20, pip: 18 },
];

/**
 * Index, middle, ring and pinky extension. A finger counts as extended when its
 * tip is clearly further from the wrist than its middle joint, which works for
 * tilted and sideways hands, not only upright ones.
 */
function extendedFingers(points: Point[]) {
  const wrist = points[0];
  return FINGERS.map(({ tip, pip }) => dist(wrist, points[tip]) > dist(wrist, points[pip]) * 1.08);
}

export function classifyFingerGesture(points: Point[]): FingerGesture | null {
  if (points.length < 21) return null;
  const extended = extendedFingers(points);
  if (extended.every(Boolean)) return "open";
  if (extended[0] && extended.slice(1).every((value) => !value)) return "point";
  return null;
}

/** Thumb-to-index fingertip distance relative to palm size (wrist to middle knuckle). */
export function pinchRatio(points: Point[]): number {
  if (points.length < 10) return Infinity;
  const palmSize = dist(points[0], points[9]);
  if (palmSize < 0.01) return Infinity;
  return dist(points[4], points[8]) / palmSize;
}

export function isPinching(points: Point[], threshold = 0.32): boolean {
  return pinchRatio(points) < threshold;
}

/**
 * Classifies one frame of landmarks. `wasPinching` adds hysteresis so a pinch
 * held near the threshold does not flicker on and off.
 */
export function classifyHandPose(points: Point[], wasPinching = false): HandPose | null {
  if (points.length < 21) return null;
  if (pinchRatio(points) < (wasPinching ? 0.42 : 0.3)) return "pinch";
  const extended = extendedFingers(points);
  if (extended.every(Boolean)) return "open";
  if (extended[0] && !extended[1] && !extended[2] && !extended[3]) return "point";
  if (extended.every((value) => !value)) {
    const palm = dist(points[0], points[9]);
    // Thumbs up: thumb tip well above the index knuckle and above its own joint.
    const thumbUp = points[4].y < points[3].y && points[4].y < points[5].y - palm * 0.35;
    return thumbUp ? "thumbs_up" : "fist";
  }
  return null;
}

export type GestureEvent =
  | { type: "swipe"; direction: "left" | "right" }
  | { type: "tap" }
  | { type: "hold"; pose: "open" | "thumbs_up" };

/** Continuous per-frame hand state, in mirrored 0..1 stage coordinates. */
export type HandFrame = {
  visible: boolean;
  pose: HandPose | null;
  pinching: boolean;
  cursor: { x: number; y: number };
  /** Cursor movement since the previous frame. */
  delta: { x: number; y: number };
  /** Progress (0..1) of an open-palm or thumbs-up hold, for on-screen feedback. */
  holdPose: "open" | "thumbs_up" | null;
  holdProgress: number;
};

export const HOLD_MS = { open: 1000, thumbs_up: 700 } as const;
const TAP_MAX_MS = 450;
const TAP_MAX_TRAVEL = 0.06;
const SWIPE_WINDOW_MS = 350;
const SWIPE_MIN_DX = 0.25;
const SWIPE_COOLDOWN_MS = 900;
const HOLD_STILLNESS = 0.07;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * Turns raw landmark frames into a smoothed cursor plus discrete gestures.
 * Pure and time-injected, so it can be driven by recorded fixtures in tests.
 */
export class GestureEngine {
  private margin: { x: number; y: number };
  private candidate: HandPose | null = null;
  private candidateFrames = 0;
  private pose: HandPose | null = null;
  private cursor: { x: number; y: number } | null = null;
  private pinchStart: { at: number; travel: number } | null = null;
  private history: { x: number; y: number; at: number }[] = [];
  private lastSwipeAt = -Infinity;
  private hold: { pose: "open" | "thumbs_up"; at: number; x: number; y: number; fired: boolean } | null = null;

  constructor(options: { margin?: { x: number; y: number } } = {}) {
    // The hand rarely reaches the frame edges, so the central area maps to the full stage.
    this.margin = options.margin ?? { x: 0.14, y: 0.12 };
  }

  reset() {
    this.candidate = null; this.candidateFrames = 0; this.pose = null; this.cursor = null;
    this.pinchStart = null; this.history = []; this.hold = null;
  }

  update(points: Point[] | null, now: number): { frame: HandFrame; events: GestureEvent[] } {
    const events: GestureEvent[] = [];
    if (!points || points.length < 21) {
      this.reset();
      return { frame: { visible: false, pose: null, pinching: false, cursor: { x: 0.5, y: 0.5 }, delta: { x: 0, y: 0 }, holdPose: null, holdProgress: 0 }, events };
    }

    // Require two matching frames before switching pose, to ignore single-frame noise.
    const raw = classifyHandPose(points, this.pose === "pinch");
    if (raw === this.candidate) this.candidateFrames += 1;
    else { this.candidate = raw; this.candidateFrames = 1; }
    const previousPose = this.pose;
    if (this.candidateFrames >= 2) this.pose = this.candidate;
    const pinching = this.pose === "pinch";

    // Cursor follows the index fingertip, or the pinch midpoint while the fingers actually touch.
    // Using this frame's raw pose avoids a jump toward the thumb on the frame a pinch is released.
    const anchor = raw === "pinch" ?{ x: (points[4].x + points[8].x) / 2, y: (points[4].y + points[8].y) / 2 } : points[8];
    const mirroredX = 1 - anchor.x;
    const target = {
      x: clamp01((mirroredX - this.margin.x) / (1 - 2 * this.margin.x)),
      y: clamp01((anchor.y - this.margin.y) / (1 - 2 * this.margin.y)),
    };
    const prev = this.cursor ?? target;
    // Adaptive smoothing: steady when the hand is still, responsive when it moves fast.
    const speed = Math.hypot(target.x - prev.x, target.y - prev.y);
    const alpha = Math.min(0.85, 0.22 + speed * 9);
    const cursor = { x: prev.x + (target.x - prev.x) * alpha, y: prev.y + (target.y - prev.y) * alpha };
    const delta = { x: cursor.x - prev.x, y: cursor.y - prev.y };
    this.cursor = cursor;

    // Quick pinch-and-release without much movement is a tap (select); a longer pinch is a grab.
    if (pinching && previousPose !== "pinch") this.pinchStart = { at: now, travel: 0 };
    if (pinching && raw === "pinch" && this.pinchStart) this.pinchStart.travel += Math.hypot(delta.x, delta.y);
    if (!pinching && previousPose === "pinch" && this.pinchStart) {
      if (now - this.pinchStart.at <= TAP_MAX_MS && this.pinchStart.travel <= TAP_MAX_TRAVEL) events.push({ type: "tap" });
      this.pinchStart = null;
    }

    // Swipes are fast horizontal sweeps of a non-pinching hand.
    if (pinching) this.history = [];
    else {
      this.history.push({ x: mirroredX, y: anchor.y, at: now });
      while (this.history.length && now - this.history[0].at > SWIPE_WINDOW_MS) this.history.shift();
      const first = this.history[0];
      const dx = mirroredX - first.x;
      const dy = anchor.y - first.y;
      if (now - first.at >= 80 && Math.abs(dx) >= SWIPE_MIN_DX && Math.abs(dy) < Math.abs(dx) * 0.6 && now - this.lastSwipeAt > SWIPE_COOLDOWN_MS) {
        events.push({ type: "swipe", direction: dx > 0 ? "right" : "left" });
        this.lastSwipeAt = now;
        this.history = [];
        this.hold = null;
      }
    }

    // Holds: keep an open palm or thumbs up still to confirm.
    let holdProgress = 0;
    const holdPose = this.pose === "open" || this.pose === "thumbs_up" ? this.pose : null;
    if (!holdPose || now - this.lastSwipeAt < SWIPE_COOLDOWN_MS) this.hold = null;
    else {
      const moved = this.hold ? Math.hypot(cursor.x - this.hold.x, cursor.y - this.hold.y) : 0;
      if (!this.hold || this.hold.pose !== holdPose || moved > HOLD_STILLNESS) this.hold = { pose: holdPose, at: now, x: cursor.x, y: cursor.y, fired: false };
      holdProgress = this.hold.fired ? 0 : clamp01((now - this.hold.at) / HOLD_MS[holdPose]);
      if (!this.hold.fired && holdProgress >= 1) {
        events.push({ type: "hold", pose: holdPose });
        this.hold.fired = true;
        holdProgress = 0;
      }
    }

    return { frame: { visible: true, pose: this.pose, pinching, cursor, delta, holdPose: this.hold && !this.hold.fired ? holdPose : null, holdProgress }, events };
  }
}

/** MediaPipe hand skeleton, as pairs of landmark indices. */
export const HAND_CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];
