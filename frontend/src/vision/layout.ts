import type { GeneratedScene } from "../types/api";
import { componentKinds, type ComponentKind, type Scene, type SceneComponent, type SystemDesignOverview } from "./scenes";

/** A part as authored in the system library: no coordinates, step, or shape needed. */
export type PartSpec = Omit<SceneComponent, "position" | "size" | "shape" | "step" | "color" | "zone"> & {
  kind: ComponentKind;
  color?: string;
  zone?: SceneComponent["zone"];
  /** Pin the part to a flow column instead of the computed one. */
  layer?: number;
};

export type SystemSpec = {
  id: string;
  title: string;
  description: string;
  overview: SystemDesignOverview;
  /** Listed in learning order; the first part starts step 1. */
  parts: PartSpec[];
};

const KIND_COLOR: Partial<Record<ComponentKind, string>> = {
  user: "#6c9eff", mobile: "#6c9eff", client: "#5fc59a", edge: "#4fb3c9", gateway: "#e3b25c", agent: "#e3b25c",
  ai: "#c792ea", database: "#c792ea", cache: "#4fb3c9", queue: "#e3b25c", payment: "#ed8a72", warehouse: "#a68cf0",
  security: "#f0706a", ledger: "#c792ea", memory: "#b4e36b", network: "#ed8a72", output: "#4fb3c9", gpu: "#76b900",
  vector: "#a68cf0", monitor: "#6c9eff",
};
const SERVICE_COLORS = ["#5fc59a", "#4fb3c9", "#a68cf0", "#ed8a72", "#e3b25c", "#6c9eff"];
const SHAPE: Partial<Record<ComponentKind, SceneComponent["shape"]>> = {
  database: "cylinder", cache: "cylinder", vector: "cylinder", ledger: "cylinder",
  user: "sphere", edge: "sphere", ai: "sphere", network: "sphere",
};

export const COLUMN_GAP = 3.4;
export const ROW_GAP = 2.8;
const MAX_ROWS = 5;

/**
 * Assigns each part a flow column by longest path from the entry points, so a
 * request reads left to right. Back edges (cycles such as a crawler feeding its
 * own frontier) are ignored for layering so they cannot stretch the layout.
 */
export function layerParts(parts: Pick<PartSpec, "id" | "connectsTo" | "layer">[]): Map<string, number> {
  const ids = new Set(parts.map((p) => p.id));
  const out = new Map(parts.map((p) => [p.id, p.connectsTo.filter((t) => ids.has(t))]));
  const incoming = new Map(parts.map((p) => [p.id, 0]));
  parts.forEach((p) => out.get(p.id)!.forEach((t) => incoming.set(t, incoming.get(t)! + 1)));

  // Drop back edges found by depth-first search, leaving a DAG.
  const forward = new Map(parts.map((p) => [p.id, [] as string[]]));
  const state = new Map<string, 0 | 1 | 2>();
  const visit = (id: string) => {
    state.set(id, 1);
    for (const t of out.get(id)!) {
      if (state.get(t) === 1) continue;
      forward.get(id)!.push(t);
      if (!state.get(t)) visit(t);
    }
    state.set(id, 2);
  };
  const roots = parts.filter((p) => incoming.get(p.id) === 0 || p.layer === 0);
  [...roots, ...parts].forEach((p) => { if (!state.get(p.id)) visit(p.id); });

  // Longest path over the DAG, in topological order.
  const indeg = new Map(parts.map((p) => [p.id, 0]));
  forward.forEach((ts) => ts.forEach((t) => indeg.set(t, indeg.get(t)! + 1)));
  const queue = parts.filter((p) => indeg.get(p.id) === 0).map((p) => p.id);
  const layer = new Map(parts.map((p) => [p.id, p.layer ?? 0]));
  const pinned = new Set(parts.filter((p) => p.layer !== undefined).map((p) => p.id));
  while (queue.length) {
    const id = queue.shift()!;
    for (const t of forward.get(id)!) {
      if (!pinned.has(t)) layer.set(t, Math.max(layer.get(t)!, layer.get(id)! + 1));
      indeg.set(t, indeg.get(t)! - 1);
      if (indeg.get(t) === 0) queue.push(t);
    }
  }
  return layer;
}

/** Turns a system spec into a renderable scene with computed positions, steps, colors, and shapes. */
export function defineSystem(spec: SystemSpec): Scene {
  const layers = layerParts(spec.parts);
  // Parts with no links at all (for example monitoring) go to the last column instead of crowding the entry.
  const linked = new Set(spec.parts.flatMap((p) => (p.connectsTo.length ? [p.id, ...p.connectsTo] : [])));
  const last = Math.max(0, ...layers.values());
  spec.parts.forEach((p) => { if (!linked.has(p.id) && p.layer === undefined) layers.set(p.id, last); });
  const columns = new Map<number, PartSpec[]>();
  spec.parts.forEach((p) => {
    const l = layers.get(p.id)!;
    columns.set(l, [...(columns.get(l) ?? []), p]);
  });

  // Order each column by the average row of its parents to reduce crossing lines.
  const row = new Map<string, number>();
  const parentsOf = (id: string) => spec.parts.filter((p) => p.connectsTo.includes(id));
  const sortedLayers = [...columns.keys()].sort((a, b) => a - b);
  const placed: { id: string; x: number; z: number }[] = [];
  let column = 0;
  for (const l of sortedLayers) {
    const members = columns.get(l)!;
    const keyed = members.map((p, i) => {
      const rows = parentsOf(p.id).map((q) => row.get(q.id)).filter((r): r is number => r !== undefined);
      return { p, key: rows.length ? rows.reduce((a, b) => a + b, 0) / rows.length : i - members.length / 2, i };
    }).sort((a, b) => a.key - b.key || a.i - b.i);
    // Very tall columns wrap into an extra column so nothing gets crowded.
    for (let start = 0; start < keyed.length; start += MAX_ROWS) {
      const chunk = keyed.slice(start, start + MAX_ROWS);
      chunk.forEach(({ p }, i) => {
        const r = i - (chunk.length - 1) / 2;
        row.set(p.id, r);
        placed.push({ id: p.id, x: column * COLUMN_GAP, z: r * ROW_GAP });
      });
      column += 1;
    }
  }
  const offsetX = ((column - 1) * COLUMN_GAP) / 2;
  const pos = new Map(placed.map((p) => [p.id, [p.x - offsetX, 0.5, p.z] as [number, number, number]]));

  let serviceIndex = 0;
  const components: SceneComponent[] = spec.parts.map(({ layer: _layer, color, zone, ...p }, i) => ({
    ...p,
    color: color ?? (p.kind === "service" ? SERVICE_COLORS[serviceIndex++ % SERVICE_COLORS.length] : KIND_COLOR[p.kind] ?? "#5fc59a"),
    zone: zone ?? "vpc",
    shape: SHAPE[p.kind] ?? "box",
    size: [1.4, 0.8, 1],
    position: pos.get(p.id)!,
    step: i + 1,
  }));
  return { id: spec.id, title: spec.title, description: spec.description, overview: spec.overview, components };
}

/** Builds a renderable scene from a model-generated design, laid out automatically. */
export function sceneFromGenerated(topic: string, generated: GeneratedScene): Scene {
  const known = new Set<string>(componentKinds);
  const opt = (v: string | null | undefined) => v ?? undefined;
  const slug = topic.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "system";
  return defineSystem({
    id: `generated-${slug}`,
    title: generated.title,
    description: generated.description,
    overview: generated.overview,
    parts: generated.parts.map((p) => ({
      id: p.id, label: p.label, zone: p.zone, connectsTo: p.connectsTo, summary: p.summary, details: p.details,
      kind: (known.has(p.kind) ? p.kind : "service") as ComponentKind,
      apis: opt(p.apis), dataModel: opt(p.dataModel), failureMode: opt(p.failureMode), tradeOffs: opt(p.tradeOffs), scaling: opt(p.scaling),
    })),
  });
}
