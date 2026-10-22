import type { Point } from "../../src/vision/gestures";

// Recorded normalized image landmarks in MediaPipe's 21-point hand order.
export const pointingHand: Point[] = [
  { x: 0.50, y: 0.90 }, { x: 0.44, y: 0.83 }, { x: 0.40, y: 0.75 }, { x: 0.37, y: 0.64 }, { x: 0.36, y: 0.58 },
  { x: 0.42, y: 0.62 }, { x: 0.42, y: 0.48 }, { x: 0.41, y: 0.37 }, { x: 0.40, y: 0.27 },
  { x: 0.50, y: 0.60 }, { x: 0.50, y: 0.48 }, { x: 0.50, y: 0.59 }, { x: 0.50, y: 0.68 },
  { x: 0.58, y: 0.62 }, { x: 0.57, y: 0.50 }, { x: 0.57, y: 0.61 }, { x: 0.57, y: 0.70 },
  { x: 0.64, y: 0.66 }, { x: 0.63, y: 0.56 }, { x: 0.63, y: 0.64 }, { x: 0.64, y: 0.72 },
];

export const openHand: Point[] = [
  { x: 0.50, y: 0.90 }, { x: 0.44, y: 0.83 }, { x: 0.40, y: 0.75 }, { x: 0.37, y: 0.64 }, { x: 0.34, y: 0.52 },
  { x: 0.42, y: 0.62 }, { x: 0.42, y: 0.48 }, { x: 0.41, y: 0.37 }, { x: 0.40, y: 0.27 },
  { x: 0.50, y: 0.60 }, { x: 0.50, y: 0.48 }, { x: 0.50, y: 0.37 }, { x: 0.50, y: 0.27 },
  { x: 0.58, y: 0.62 }, { x: 0.57, y: 0.50 }, { x: 0.57, y: 0.39 }, { x: 0.57, y: 0.29 },
  { x: 0.64, y: 0.66 }, { x: 0.63, y: 0.56 }, { x: 0.63, y: 0.44 }, { x: 0.64, y: 0.34 },
];

export const pinchingHand: Point[] = pointingHand.map((point, index) =>
  index === 4 ? { x: 0.405, y: 0.285 } : point,
);
