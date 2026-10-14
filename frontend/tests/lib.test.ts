import { AR } from "js-aruco2";
import { diffLines, diffStats } from "../src/lib/diff";
import { errorHelp } from "../src/lib/errors";
import { MARKER_DICTIONARY, MarkerVote, detectMarkers, markerSvg } from "../src/lib/markers";
import { streamPreview } from "../src/lib/preview";
import { readSSE } from "../src/lib/sse";
import { buildTree } from "../src/features/projects/FileTree";
import { applyFilters } from "../src/features/memory/MemoryPage";
import { sceneForMarker, scenes, stepsOf, subjects } from "../src/features/visual-learning/scenes";
import type { Memory } from "../src/types/api";

const bytes = (...parts: string[]) => new ReadableStream<Uint8Array>({ start(c) { parts.forEach((p) => c.enqueue(new TextEncoder().encode(p))); c.close(); } });
const all = async <T,>(gen: AsyncGenerator<T>) => { const out: T[] = []; for await (const x of gen) out.push(x); return out; };

describe("readSSE (FE-04)", () => {
  it("parses events split across chunks and CRLF line endings", async () => {
    const evs = await all(readSSE(bytes('event: token\ndata: {"te', 'xt": "Hel"}\n\nevent: token\r\ndata: {"text": "lo"}\r\n\r\n', 'event: done\ndata: {"ok": true}\n\n')));
    expect(evs).toEqual([{ event: "token", data: { text: "Hel" } }, { event: "token", data: { text: "lo" } }, { event: "done", data: { ok: true } }]);
  });
  it("keeps multi-byte characters split between chunks", async () => {
    const enc = new TextEncoder().encode('event: token\ndata: {"text": "é"}\n\n');
    const stream = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(enc.slice(0, 27)); c.enqueue(enc.slice(27)); c.close(); } });
    expect((await all(readSSE(stream)))[0].data).toEqual({ text: "é" });
  });
});

describe("streamPreview (FE-04)", () => {
  it("shows the growing main field of a JSON reply", () => {
    expect(streamPreview('{"answer": "Kubernetes runs')).toBe("Kubernetes runs");
    expect(streamPreview('{"summary": "line one\\nline two')).toBe("line one\nline two");
    expect(streamPreview('{"answer": "cut \\')).toBe("cut ");
    expect(streamPreview('{"key_points": [')).toBe("");
  });
  it("shows plain text as-is", () => expect(streamPreview("Just text")).toBe("Just text"));
});

describe("diffLines (FE-06)", () => {
  it("marks additions and removals with line numbers", () => {
    const d = diffLines("a\nb\nc\n", "a\nB\nc\nd\n");
    expect(d.map((l) => `${l.kind}:${l.text}`)).toEqual(["same:a", "del:b", "add:B", "same:c", "add:d"]);
    expect(d[2]).toMatchObject({ newNo: 2 });
    expect(d[1]).toMatchObject({ oldNo: 2 });
    expect(diffStats(d)).toEqual({ added: 2, removed: 1 });
  });
  it("treats a new file as all additions and ignores CRLF differences", () => {
    expect(diffStats(diffLines("", "x\ny\n"))).toEqual({ added: 2, removed: 0 });
    expect(diffStats(diffLines("a\r\nb\r\n", "a\nb\n"))).toEqual({ added: 0, removed: 0 });
  });
  it("handles large inputs without an LCS table", () => {
    const big = (n: number, tag: string) => Array.from({ length: n }, (_, i) => `${tag}${i}`).join("\n");
    expect(diffStats(diffLines(big(3000, "a"), big(3000, "b")))).toEqual({ added: 3000, removed: 3000 });
  });
});

describe("errorHelp (IN-03)", () => {
  it("has a title for every backend error code the UI can meet, and a fallback", () => {
    for (const code of ["backend_unreachable", "unauthorized", "provider_not_configured", "provider_auth_failed", "provider_rate_limited", "provider_empty_response", "rate_limited", "file_too_large", "stale_change", "consent_required_missing"])
      expect(errorHelp(code).title.length).toBeGreaterThan(3);
    expect(errorHelp("something_new")).toEqual({ title: "Something went wrong", retry: true });
  });
});

/** Renders a marker the way generateSVG draws it: 1 white cell margin, 1 black border cell, bits (1 = white). */
function markerImage(id: number, cell = 10) {
  const dict = new AR.Dictionary(MARKER_DICTIONARY);
  const bits = dict.codeList[id], size = dict.markSize - 2, cells = size + 4, w = cells * cell + 40;
  const data = new Uint8ClampedArray(w * w * 4).fill(255);
  for (let cy = 1; cy < cells - 1; cy++) for (let cx = 1; cx < cells - 1; cx++) {
    const inner = cy > 1 && cy < cells - 2 && cx > 1 && cx < cells - 2;
    const v = inner && bits[(cy - 2) * size + (cx - 2)] === "1" ? 255 : 0;
    for (let y = 0; y < cell; y++) for (let x = 0; x < cell; x++) {
      const i = ((20 + cy * cell + y) * w + 20 + cx * cell + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = v;
    }
  }
  return { width: w, height: w, data };
}

describe("markers (CV-01)", () => {
  it("detects each scene's marker in a synthetic image", () => {
    for (const s of scenes) expect(detectMarkers(markerImage(s.markerId))).toEqual([s.markerId]);
  });
  it("finds nothing in a blank frame", () => {
    expect(detectMarkers({ width: 120, height: 120, data: new Uint8ClampedArray(120 * 120 * 4).fill(200) })).toEqual([]);
  });
  it("needs consecutive frames before switching", () => {
    const vote = new MarkerVote(3), known = (id: number) => id === 2;
    expect([vote.push([2], known), vote.push([2], known), vote.push([2], known), vote.push([2], known)]).toEqual([null, null, 2, null]);
    expect([vote.push([], known), vote.push([2], known), vote.push([7], known)]).toEqual([null, null, null]);
  });
  it("generates printable SVG markers", () => expect(markerSvg(1)).toMatch(/^<svg[\s\S]*<\/svg>$/));
});

describe("curated scenes (FE-08)", () => {
  it.each(scenes)("$title has unique ids, valid links, explanations, and ordered steps", (scene) => {
    const ids = new Set(scene.components.map((c) => c.id));
    expect(ids.size).toBe(scene.components.length);
    for (const c of scene.components) {
      expect(c.summary.length).toBeGreaterThan(10);
      expect(c.details.length).toBeGreaterThan(40);
      c.connectsTo.forEach((t) => expect(ids.has(t)).toBe(true));
    }
    expect(stepsOf(scene).map((c) => c.step)).toEqual(scene.components.map((_, i) => i + 1));
  });
  it("maps markers to scenes uniquely and lists both scenes as supported", () => {
    expect(new Set(scenes.map((s) => s.markerId)).size).toBe(scenes.length);
    expect(sceneForMarker(2)?.id).toBe("event-driven-serverless");
    expect(subjects.filter((s) => s.supported).length).toBe(2);
  });
});

describe("file tree and memory filters", () => {
  it("nests files under folders", () => {
    const t = buildTree([{ path: "a/b/c.py", size: 1 }, { path: "a/d.py", size: 1 }, { path: "e.md", size: 1 }]);
    expect(t.files.map((f) => f.path)).toEqual(["e.md"]);
    expect(t.dirs.get("a")!.dirs.get("b")!.files[0].path).toBe("a/b/c.py");
  });
  it("combines memory filters", () => {
    const m = (id: number, type: Memory["type"], source: string, confirmed: boolean) => ({ id, type, source, confirmed, content: "", created_at: "", updated_at: "" });
    const items = [m(1, "fact", "user", true), m(2, "project", "agent", false), m(3, "project", "chat_suggestion", true)];
    expect(applyFilters(items, { type: "project", source: "suggested", status: "" }).map((x) => x.id)).toEqual([2, 3]);
    expect(applyFilters(items, { type: "project", source: "suggested", status: "unconfirmed" }).map((x) => x.id)).toEqual([2]);
  });
});
