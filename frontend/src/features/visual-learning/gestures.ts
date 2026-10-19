export type Point = { x: number; y: number; z?: number };
export type FingerGesture = "point" | "open";

export function classifyFingerGesture(points: Point[]): FingerGesture | null {
  if (points.length < 21) return null;
  const extended = [8, 12, 16, 20].map((tip, index) => points[tip].y < points[[6, 10, 14, 18][index]].y);
  if (extended.every(Boolean)) return "open";
  if (extended[0] && extended.slice(1).every((value) => !value)) return "point";
  return null;
}

export function isPinching(points: Point[], threshold = 0.055): boolean {
  return points.length >= 9 && Math.hypot(points[4].x - points[8].x, points[4].y - points[8].y) < threshold;
}
