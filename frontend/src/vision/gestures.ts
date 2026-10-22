export type Point = { x: number; y: number; z?: number };
export type FingerGesture = "point" | "open";
export type CursorPosition = { screenX: number; screenY: number; worldX: number; worldY: number };

export function mapLandmarkToViewport(point: Point, viewportWidth: number, viewportHeight: number): CursorPosition {
  const screenX = 1 - point.x;
  return {
    screenX,
    screenY: point.y,
    worldX: (screenX - 0.5) * viewportWidth,
    worldY: -(point.y - 0.5) * viewportHeight,
  };
}

export function classifyFingerGesture(points: Point[]): FingerGesture | null {
  if (points.length < 21) return null;
  // Use the y-distance from MCP joint to fingertip for robustness —
  // accounts for hands at different angles relative to the camera.
  const fingerData = [
    { tip: 8, pip: 6 },
    { tip: 12, pip: 10 },
    { tip: 16, pip: 14 },
    { tip: 20, pip: 18 },
  ];
  const extended = fingerData.map(({ tip, pip }) => points[tip].y < points[pip].y);
  if (extended.every(Boolean)) return "open";
  if (extended[0] && extended.slice(1).every((value) => !value)) return "point";
  return null;
}

export function isPinching(points: Point[], threshold = 0.32): boolean {
  if (points.length < 10) return false;
  const palmSize = Math.hypot(points[0].x - points[9].x, points[0].y - points[9].y);
  if (palmSize < 0.01) return false;
  const fingertipDistance = Math.hypot(points[4].x - points[8].x, points[4].y - points[8].y);
  return fingertipDistance / palmSize < threshold;
}
