import { AR } from "js-aruco2";

/** CV-01: printed ArUco markers select a curated scene. This is marker recognition only, not object recognition.
 * Detection runs in the browser on frames that are never stored or uploaded. */
export const MARKER_DICTIONARY = "ARUCO_MIP_36h12";
// Codes in this dictionary differ in at least 12 bits, so up to 5 wrong bits can be corrected without ambiguity.
// The library default (accept anything under 12) also matched noise, e.g. a phantom #129 next to #1 in tests.
const MAX_HAMMING = 6; // the library accepts distance < this, i.e. up to 5 wrong bits
export type Pixels = { width: number; height: number; data: Uint8ClampedArray };

let detector: AR.Detector | null = null;
export function detectMarkers(image: Pixels): number[] {
  detector ??= new AR.Detector({ dictionaryName: MARKER_DICTIONARY, maxHammingDistance: MAX_HAMMING });
  return [...new Set(detector.detect(image).map((m) => m.id))];
}

export const markerSvg = (id: number) => new AR.Dictionary(MARKER_DICTIONARY).generateSVG(id);

/** Accept a marker only after it is seen in `needed` consecutive frames, so a glimpse doesn't switch scenes. */
export class MarkerVote {
  private last: number | null = null;
  private count = 0;
  constructor(private needed = 3) {}
  push(ids: number[], known: (id: number) => boolean): number | null {
    const id = ids.find(known) ?? null;
    if (id === null || id !== this.last) { this.last = id; this.count = id === null ? 0 : 1; }
    else this.count++;
    return id !== null && this.count === this.needed ? id : null;
  }
}
