import { Environment, Grid, Html, Lightformer, Line, OrbitControls, Sparkles, useCursor } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Component, createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { kindOf, type Scene, type SceneComponent } from "./scenes";
import type { HandTrackState } from "./CameraPanel";
import { createPartMaterials, getGlowTexture, MotionContext, PartModel } from "./models";

class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? (
      <div role="alert" className="flex h-full items-center justify-center p-6 text-center text-sm">The 3D view couldn't start. Your browser or device may not support WebGL. Try enabling hardware acceleration or another browser.</div>
    ) : this.props.children;
  }
}

const BG = "#05111a";
const PEDESTAL_RADIUS = 0.95;
const LABEL_HEIGHT = 1.9;

function usePrefersReducedMotion() {
  const query = "(prefers-reduced-motion: reduce)";
  const [reduced, setReduced] = useState(() => typeof window !== "undefined" && !!window.matchMedia?.(query).matches);
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return;
    const update = () => setReduced(mq.matches);
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

/** Hit targets of every part, so the hand pointer can raycast without walking the whole scene. */
const HitRegistry = createContext<Map<string, THREE.Object3D> | null>(null);
const DWELL_MS = 650;
const SELECT_COOLDOWN_MS = 1100;

const easeOutBack = (x: number) => 1 + 2.2 * Math.pow(x - 1, 3) + 1.2 * Math.pow(x - 1, 2);
const easeInOutCubic = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const ground = (c: SceneComponent) => new THREE.Vector3(c.position[0], 0, c.position[2]);

function Part({ c, index, selected, dimmed, handHover, crowded, onSelect }: { c: SceneComponent; index: number; selected: boolean; dimmed: boolean; handHover: boolean; crowded: boolean; onSelect: () => void }) {
  const motion = useContext(MotionContext);
  const registry = useContext(HitRegistry);
  const [mouseHover, setHover] = useState(false);
  useCursor(mouseHover && !dimmed);
  const hover = mouseHover || handHover;
  const materials = useMemo(() => createPartMaterials(c.color), [c.color]);
  const glow = useMemo(() => new THREE.MeshBasicMaterial({ map: getGlowTexture(), color: c.color, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), [c.color]);
  const pulse = useMemo(() => new THREE.MeshBasicMaterial({ color: c.color, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }), [c.color]);
  useEffect(() => () => { Object.values(materials).forEach((m) => m.dispose()); glow.dispose(); pulse.dispose(); }, [materials, glow, pulse]);

  // Isolation fades every other part to a ghost.
  useEffect(() => {
    const f = dimmed ? 0.1 : 1;
    for (const m of [materials.body, materials.trim, materials.accent]) { m.transparent = dimmed; m.opacity = f; m.depthWrite = !dimmed; m.needsUpdate = true; }
    materials.glass.opacity = 0.38 * f;
  }, [dimmed, materials]);

  const root = useRef<THREE.Group>(null);
  const lift = useRef<THREE.Group>(null);
  const pulseRing = useRef<THREE.Mesh>(null);
  const bornAt = useRef<number | null>(null);
  const emphasis = useRef(1);
  const label = useRef<HTMLDivElement>(null);
  const worldPos = useMemo(() => new THREE.Vector3(), []);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    bornAt.current ??= t;
    // Parts pop in one after another when a scene loads.
    const appear = motion ? THREE.MathUtils.clamp((t - bornAt.current - index * 0.08) / 0.55, 0, 1) : 1;
    emphasis.current = THREE.MathUtils.damp(emphasis.current, selected ? 1.12 : hover ? 1.06 : 1, 10, dt);
    root.current?.scale.setScalar(Math.max(0.001, easeOutBack(appear) * emphasis.current));
    if (lift.current) {
      const target = (selected ? 0.2 : hover ? 0.1 : 0) + Math.sin(t * 1.2 * motion + index) * 0.03 * motion;
      lift.current.position.y = THREE.MathUtils.damp(lift.current.position.y, target, 8, dt);
    }
    const dim = dimmed ? 0.15 : 1;
    materials.accent.emissiveIntensity = THREE.MathUtils.damp(materials.accent.emissiveIntensity, selected ? 2.2 : hover ? 1.7 : 1.1, 8, dt);
    glow.opacity = THREE.MathUtils.damp(glow.opacity, (selected ? 0.95 : hover ? 0.65 : 0.38) * dim, 8, dt);
    if (pulseRing.current) {
      const p = (t * 0.7) % 1;
      pulseRing.current.scale.setScalar(1 + p * 1.1);
      pulse.opacity = selected && !dimmed ? (1 - p) * 0.55 : 0;
    }
    // Crowded scenes show only step numbers from far away; names return on zoom, hover, or selection.
    if (label.current && root.current) {
      root.current.getWorldPosition(worldPos);
      const compact = crowded && !selected && !hover && state.camera.position.distanceTo(worldPos) > 15;
      if (label.current.classList.contains("is-compact") !== compact) label.current.classList.toggle("is-compact", compact);
    }
  });

  return (
    <group position={ground(c)}>
      <group ref={root}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.095, 0]} material={glow}><planeGeometry args={[4.2, 4.2]} /></mesh>
        <mesh position={[0, -0.05, 0]} material={materials.body}><cylinderGeometry args={[PEDESTAL_RADIUS, PEDESTAL_RADIUS + 0.06, 0.1, 64]} /></mesh>
        <mesh position={[0, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]} material={materials.accent}><ringGeometry args={[PEDESTAL_RADIUS - 0.05, PEDESTAL_RADIUS - 0.01, 64]} /></mesh>
        <mesh ref={pulseRing} position={[0, -0.09, 0]} rotation={[-Math.PI / 2, 0, 0]} material={pulse}><ringGeometry args={[PEDESTAL_RADIUS, PEDESTAL_RADIUS + 0.05, 64]} /></mesh>
        <group ref={lift}><PartModel kind={kindOf(c)} materials={materials} /></group>
        {/* An invisible, generous hit target so small or animated models stay easy to click. */}
        <mesh
          ref={(mesh) => { if (mesh) registry?.set(c.id, mesh); else registry?.delete(c.id); }}
          userData={{ partId: c.id }}
          position={[0, 0.75, 0]}
          onClick={(e) => { e.stopPropagation(); onSelect(); }}
          onPointerOver={(e) => { e.stopPropagation(); setHover(true); }}
          onPointerOut={() => setHover(false)}
        >
          <cylinderGeometry args={[PEDESTAL_RADIUS, PEDESTAL_RADIUS, 1.7, 16]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>
      {!dimmed && (
        <Html position={[0, LABEL_HEIGHT, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
          <div ref={label} className={`scene-label ${selected ? "is-selected" : ""} ${hover ? "is-hover" : ""}`} style={{ "--c": c.color } as React.CSSProperties}>
            <span className="scene-label-step">{c.step}</span><span className="scene-label-text">{c.label}</span>
          </div>
        </Html>
      )}
    </group>
  );
}

/** A curved, color-graded connection with data packets travelling from source to target. */
function Flow({ from, to, index, emphasis, faded }: { from: SceneComponent; to: SceneComponent; index: number; emphasis: boolean; faded: boolean }) {
  const motion = useContext(MotionContext);
  const { curve, points, colors, arrowPos, arrowQuat, cFrom, cTo } = useMemo(() => {
    const a = ground(from);
    const b = ground(to);
    const dir = b.clone().sub(a).setY(0);
    const dist = dir.length();
    dir.normalize();
    const inset = Math.min(PEDESTAL_RADIUS + 0.05, dist * 0.3);
    const start = a.clone().addScaledVector(dir, inset).setY(0.3);
    const end = b.clone().addScaledVector(dir, -inset - 0.1).setY(0.3);
    const mid = start.clone().lerp(end, 0.5).setY(0.55 + dist * 0.14);
    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    const points = curve.getPoints(48);
    const cFrom = new THREE.Color(from.color);
    const cTo = new THREE.Color(to.color);
    const colors = points.map((_, i) => cFrom.clone().lerp(cTo, i / (points.length - 1)).toArray() as [number, number, number]);
    const tangent = curve.getTangentAt(1);
    return { curve, points, colors, cFrom, cTo, arrowPos: end, arrowQuat: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent) };
  }, [from, to]);

  const packetCount = emphasis ? 3 : 2;
  const packets = useRef<(THREE.Group | null)[]>([]);
  const packetMats = useMemo(() => Array.from({ length: 3 }, () => new THREE.MeshBasicMaterial({ color: "white", toneMapped: false, transparent: true })), []);
  const haloMats = useMemo(() => Array.from({ length: 3 }, () => new THREE.SpriteMaterial({ map: getGlowTexture(), color: "white", transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })), []);
  useEffect(() => () => { packetMats.forEach((m) => m.dispose()); haloMats.forEach((m) => m.dispose()); }, [packetMats, haloMats]);
  const tmp = useMemo(() => new THREE.Color(), []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    packets.current.forEach((g, i) => {
      if (!g) return;
      if (faded || i >= packetCount) { g.visible = false; return; }
      g.visible = true;
      // Reduced motion parks packets at evenly spaced points instead of moving them.
      const p = motion ? (t * (emphasis ? 0.55 : 0.32) + i / packetCount + index * 0.17) % 1 : (i + 0.5) / packetCount;
      g.position.copy(curve.getPointAt(p));
      tmp.copy(cFrom).lerp(cTo, p);
      packetMats[i].color.copy(tmp);
      haloMats[i].color.copy(tmp);
      const fade = Math.min(1, Math.min(p, 1 - p) * 6);
      packetMats[i].opacity = fade;
      haloMats[i].opacity = fade * (emphasis ? 0.9 : 0.6);
    });
  });

  const opacity = faded ? 0.06 : emphasis ? 1 : 0.5;
  return (
    <group>
      <Line points={points} vertexColors={colors} color="white" lineWidth={emphasis ? 2.6 : 1.5} transparent opacity={opacity} toneMapped={false} />
      <mesh position={arrowPos} quaternion={arrowQuat}>
        <coneGeometry args={[0.08, 0.22, 16]} />
        <meshBasicMaterial color={to.color} transparent opacity={opacity} toneMapped={false} />
      </mesh>
      {Array.from({ length: 3 }).map((_, i) => (
        <group key={i} ref={(el) => { packets.current[i] = el; }} visible={false}>
          <mesh material={packetMats[i]}><sphereGeometry args={[emphasis ? 0.07 : 0.055, 12, 12]} /></mesh>
          <sprite material={haloMats[i]} scale={emphasis ? 0.55 : 0.4} />
        </group>
      ))}
    </group>
  );
}

function roundedRect(w: number, h: number, r: number) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/** Renders a line of text into a texture, sized in world units for a 0.32-unit-tall floor marking. */
function textTexture(text: string, color: string) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const font = "600 48px 'IBM Plex Mono', ui-monospace, monospace";
  let w = 900;
  if (ctx) { ctx.font = font; w = Math.ceil(ctx.measureText(text).width) + 24; }
  canvas.width = w; canvas.height = 72;
  if (ctx) {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textBaseline = "middle";
    ctx.fillText(text, 12, 38);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  const height = 0.32;
  return { texture, width: (w / 72) * height, height };
}

/** True when a floor-label strip would sit under any part's pedestal. */
function stripHitsPedestal(x0: number, x1: number, z: number, halfHeight: number, all: SceneComponent[]) {
  return all.some((c) => {
    const dx = Math.max(x0 - c.position[0], 0, c.position[0] - x1);
    const dz = Math.max(Math.abs(c.position[2] - z) - halfHeight, 0);
    return Math.hypot(dx, dz) < PEDESTAL_RADIUS + 0.1;
  });
}

/**
 * A floor platform drawn around a group of components (the private network, a GPU cluster),
 * sized from the scene itself, with its name painted on whichever corner is free of parts.
 */
function Zone({ members, all, label, color, labelColor, pad, opacity, layer }: { members: SceneComponent[]; all: SceneComponent[]; label: string; color: string; labelColor: string; pad: number; opacity: number; layer: number }) {
  const motion = useContext(MotionContext);
  const zone = useMemo(() => {
    if (!members.length) return null;
    const xs = members.map((c) => c.position[0]);
    const zs = members.map((c) => c.position[2]);
    const minX = Math.min(...xs) - pad, maxX = Math.max(...xs) + pad, minZ = Math.min(...zs) - pad, maxZ = Math.max(...zs) + pad;
    const shape = roundedRect(maxX - minX, maxZ - minZ, 0.6);
    const outline = shape.getPoints(24).map((p) => new THREE.Vector3(p.x, 0, -p.y));
    return { cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2, minX, maxX, minZ, maxZ, shape, outline };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members.map((c) => `${c.position[0]},${c.position[2]}`).join("|"), pad]);
  const floorLabel = useMemo(() => textTexture(label, labelColor), [label, labelColor]);
  useEffect(() => () => floorLabel.texture.dispose(), [floorLabel]);
  const labelPos = useMemo(() => {
    if (!zone) return null;
    const w = floorLabel.width;
    const half = floorLabel.height / 2;
    const candidates: [number, number][] = [
      [zone.minX + 0.35, zone.maxZ - 0.4], [zone.minX + 0.35, zone.minZ + 0.4],
      [zone.maxX - 0.35 - w, zone.maxZ - 0.4], [zone.maxX - 0.35 - w, zone.minZ + 0.4],
    ];
    const [x0, z] = candidates.find(([cx, cz]) => !stripHitsPedestal(cx, cx + w, cz, half, all)) ?? candidates[0];
    return [x0 + w / 2 - zone.cx, z - zone.cz] as const;
  }, [zone, floorLabel, all]);
  const line = useRef<{ material: { dashOffset: number } } | null>(null);
  useFrame((_, dt) => { if (line.current && motion) line.current.material.dashOffset -= dt * 0.6; });
  if (!zone || !labelPos) return null;
  return (
    <group position={[zone.cx, -0.098 + layer * 0.003, zone.cz]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <shapeGeometry args={[zone.shape]} />
        <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
      </mesh>
      <Line ref={line as never} points={zone.outline} color={color} lineWidth={1.2} dashed dashSize={0.35} gapSize={0.2} transparent opacity={0.55} />
      <mesh position={[labelPos[0], 0.004, labelPos[1]]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[floorLabel.width, floorLabel.height]} />
        <meshBasicMaterial map={floorLabel.texture} transparent opacity={0.85} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

type CameraAnim = { fromPos: THREE.Vector3; toPos: THREE.Vector3; fromTarget: THREE.Vector3; toTarget: THREE.Vector3; t: number; duration: number };

/** Frames the scene on load and reset, and glides toward the selected part. */
function CameraRig({ scene, selectedId, resetKey, controls, anim }: { scene: Scene; selectedId: string | null; resetKey: number; controls: React.RefObject<OrbitControlsImpl | null>; anim: React.MutableRefObject<CameraAnim | null> }) {
  const motion = useContext(MotionContext);
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  // Read at scene load only, so resizing the window does not restart the fly-in.
  const aspectRef = useRef(1.6);
  aspectRef.current = useThree((s) => s.size.width / Math.max(1, s.size.height));
  const home = useMemo(() => {
    const xs = scene.components.map((c) => c.position[0]);
    const zs = scene.components.map((c) => c.position[2]);
    const center = new THREE.Vector3((Math.min(...xs) + Math.max(...xs)) / 2, 0.4, (Math.min(...zs) + Math.max(...zs)) / 2);
    // Fit the bounding sphere of all pedestals; a slight forward target keeps the nearest row in frame.
    const radius = Math.max(...scene.components.map((c) => Math.hypot(c.position[0] - center.x, c.position[2] - center.z))) + 1.3;
    const target = center.clone().add(new THREE.Vector3(0, 0, radius * 0.1));
    // Large scenes get a steeper, closer view so deep rows spread apart instead of stacking.
    const large = scene.components.length > 12;
    // Wide left-to-right layouts are viewed nearly head-on so the flow reads horizontally.
    const xs0 = Math.max(...xs) - Math.min(...xs), zs0 = Math.max(...zs) - Math.min(...zs);
    const dir = new THREE.Vector3(xs0 > zs0 * 1.4 ? 0.12 : 0.4, large ? 1.5 : 0.95, 1).normalize();
    const vHalf = THREE.MathUtils.degToRad(camera.fov / 2);
    let distance = radius / Math.sin(vHalf) * (large ? 0.76 : 0.78);
    // Wide left-to-right layouts (generated systems) fit their width to the canvas instead of a circle.
    const halfW = (Math.max(...xs) - Math.min(...xs)) / 2 + 1.4;
    const halfD = (Math.max(...zs) - Math.min(...zs)) / 2 + 1.4;
    if (halfW > halfD * 1.4) {
      const hHalf = Math.atan(Math.tan(vHalf) * aspectRef.current);
      const fitWidth = halfW / Math.tan(hHalf);
      const fitDepth = (halfD * dir.y + 1.4) / Math.tan(vHalf);
      distance = Math.min(distance, Math.max(fitWidth, fitDepth) * 1.12);
    }
    const pos = target.clone().add(dir.multiplyScalar(Math.max(10, distance)));
    return { target, pos };
  }, [scene, camera.fov]);

  const go = (toPos: THREE.Vector3, toTarget: THREE.Vector3, duration: number) => {
    const ctrl = controls.current;
    if (!ctrl) return;
    if (!motion) { camera.position.copy(toPos); ctrl.target.copy(toTarget); ctrl.update(); anim.current = null; return; }
    anim.current = { fromPos: camera.position.clone(), toPos, fromTarget: ctrl.target.clone(), toTarget, t: 0, duration };
  };

  // Fly in from further out whenever a new scene loads.
  useEffect(() => {
    const ctrl = controls.current;
    if (!ctrl) return;
    camera.position.copy(home.target.clone().add(home.pos.clone().sub(home.target).multiplyScalar(1.7)).add(new THREE.Vector3(0, 3, 0)));
    ctrl.target.copy(home.target);
    ctrl.update();
    go(home.pos, home.target, 1.8);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [home]);

  const firstReset = useRef(true);
  useEffect(() => {
    if (firstReset.current) { firstReset.current = false; return; }
    go(home.pos, home.target, 1.1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  useEffect(() => {
    const c = scene.components.find((x) => x.id === selectedId);
    const ctrl = controls.current;
    if (!c || !ctrl) return;
    const toTarget = new THREE.Vector3(c.position[0], 0.7, c.position[2]);
    // Keep the current viewing angle, but move in to a comfortable distance.
    const offset = camera.position.clone().sub(ctrl.target);
    const distance = THREE.MathUtils.clamp(offset.length(), 6.5, 9.5);
    go(toTarget.clone().add(offset.normalize().multiplyScalar(distance)), toTarget, 0.9);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, scene]);

  useFrame((_, dt) => {
    const a = anim.current;
    const ctrl = controls.current;
    if (!a || !ctrl) return;
    a.t = Math.min(1, a.t + dt / a.duration);
    const e = easeInOutCubic(a.t);
    camera.position.lerpVectors(a.fromPos, a.toPos, e);
    ctrl.target.lerpVectors(a.fromTarget, a.toTarget, e);
    ctrl.update();
    if (a.t >= 1) anim.current = null;
  });
  return null;
}

/** Pinch-and-drag rotates the camera like a mouse drag, using the engine's smoothed hand movement. */
function HandCameraControl({ handTrackRef, controls, anim }: { handTrackRef: React.RefObject<HandTrackState | null>; controls: React.RefObject<OrbitControlsImpl | null>; anim: React.MutableRefObject<CameraAnim | null> }) {
  const lastFrame = useRef(0);
  useFrame(() => {
    const hand = handTrackRef.current;
    const ctrl = controls.current;
    if (!hand?.active || !hand.visible || !hand.pinching || !ctrl || hand.frameSeq === lastFrame.current) return;
    lastFrame.current = hand.frameSeq;
    anim.current = null;
    const ROTATE_SPEED = 5;
    ctrl.setAzimuthalAngle(ctrl.getAzimuthalAngle() - hand.delta.x * ROTATE_SPEED);
    ctrl.setPolarAngle(THREE.MathUtils.clamp(ctrl.getPolarAngle() - hand.delta.y * ROTATE_SPEED * 0.7, 0.25, ctrl.maxPolarAngle));
    ctrl.update();
  });
  return null;
}

/**
 * Moves the on-screen hand cursor, raycasts it into the scene to find the part
 * under it, and selects by pointing-and-holding (dwell) or by a quick pinch tap.
 */
function HandPointer({ handTrackRef, cursorRef, onHover, onSelect }: { handTrackRef: React.RefObject<HandTrackState | null>; cursorRef?: React.RefObject<HTMLDivElement | null>; onHover: (id: string | null) => void; onSelect: (id: string, via: "dwell" | "tap") => void }) {
  const registry = useContext(HitRegistry);
  const camera = useThree((s) => s.camera);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const ndc = useMemo(() => new THREE.Vector2(), []);
  const hovered = useRef<string | null>(null);
  const dwellStart = useRef(0);
  const dwellDone = useRef(false);
  const lastSelectAt = useRef(-Infinity);
  const lastTap = useRef(0);

  useFrame(() => {
    const hand = handTrackRef.current;
    const el = cursorRef?.current;
    const now = performance.now();
    if (!hand?.active || !hand.visible) {
      if (el) el.hidden = true;
      if (hovered.current) { hovered.current = null; onHover(null); }
      if (hand) lastTap.current = hand.tapSeq;
      return;
    }
    let id: string | null = null;
    if (registry?.size) {
      ndc.set(hand.cursor.x * 2 - 1, -(hand.cursor.y * 2 - 1));
      raycaster.setFromCamera(ndc, camera);
      const hit = raycaster.intersectObjects([...registry.values()], false)[0];
      id = (hit?.object.userData.partId as string | undefined) ?? null;
    }
    if (id !== hovered.current) {
      hovered.current = id;
      dwellStart.current = now;
      dwellDone.current = false;
      onHover(id);
    }
    // Dwell only counts while pointing, and pauses briefly after a selection so the camera glide can't chain-select.
    const pointing = hand.pose === "point";
    const cooling = now - lastSelectAt.current < SELECT_COOLDOWN_MS;
    if (!pointing || cooling) dwellStart.current = now;
    let progress = hand.holdProgress;
    if (id && pointing && !dwellDone.current && !cooling) {
      progress = Math.min(1, (now - dwellStart.current) / DWELL_MS);
      if (progress >= 1) { dwellDone.current = true; lastSelectAt.current = now; progress = 0; onSelect(id, "dwell"); }
    }
    if (hand.tapSeq !== lastTap.current) {
      lastTap.current = hand.tapSeq;
      if (id) { dwellDone.current = true; lastSelectAt.current = now; onSelect(id, "tap"); }
    }
    if (el) {
      el.hidden = false;
      const parent = el.parentElement;
      el.style.transform = `translate3d(${hand.cursor.x * (parent?.clientWidth ?? 0)}px, ${hand.cursor.y * (parent?.clientHeight ?? 0)}px, 0)`;
      el.style.setProperty("--p", progress.toFixed(3));
      el.dataset.pose = hand.holdPose && hand.holdProgress > 0 ? hand.holdPose : hand.pose ?? "";
      el.dataset.hover = id ? "1" : "0";
    }
  });
  return null;
}

function Atmosphere() {
  return (
    <>
      <color attach="background" args={[BG]} />
      <fog attach="fog" args={[BG, 20, 46]} />
      <ambientLight intensity={0.25} />
      <directionalLight position={[6, 10, 6]} intensity={1.2} />
      <directionalLight position={[-6, 4, -4]} intensity={0.5} color="#5ccfe6" />
      <pointLight position={[0, 3, 0]} intensity={8} distance={14} color="#a78bfa" />
      {/* Lightformers bake a studio-style environment locally, so reflections need no HDR download. */}
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={2.4} position={[0, 6, -8]} scale={[12, 4, 1]} color="#8ff0d8" />
        <Lightformer form="rect" intensity={1.4} position={[-8, 2, 0]} rotation-y={Math.PI / 2} scale={[16, 1.2, 1]} color="#ffffff" />
        <Lightformer form="rect" intensity={1.2} position={[8, 2, 2]} rotation-y={-Math.PI / 2} scale={[16, 1.2, 1]} color="#a78bfa" />
        <Lightformer form="ring" intensity={2} position={[3, 7, 6]} scale={3} color="#ffffff" />
      </Environment>
      <Grid
        position={[0, -0.1, 0]}
        infiniteGrid
        cellSize={0.5}
        cellThickness={0.5}
        cellColor="#0e2330"
        sectionSize={2.5}
        sectionThickness={1}
        sectionColor="#1b3c4c"
        fadeDistance={42}
        fadeStrength={1.6}
      />
      <Sparkles count={70} scale={[26, 7, 26]} position={[0, 3, 0]} size={1.6} speed={0.25} opacity={0.35} color="#9cf5dc" />
    </>
  );
}

export function SceneCanvas({ scene, selectedId, isolatedId, resetKey, onSelect, onHandSelect, onClear, onReady, handTrackRef, handCursorRef }: { scene: Scene; selectedId: string | null; isolatedId: string | null; resetKey: number; onSelect: (id: string) => void; onHandSelect?: (id: string, via: "dwell" | "tap") => void; onClear?: () => void; onReady: () => void; handTrackRef?: React.RefObject<HandTrackState | null>; handCursorRef?: React.RefObject<HTMLDivElement | null> }) {
  const controls = useRef<OrbitControlsImpl>(null);
  const anim = useRef<CameraAnim | null>(null);
  const fallbackRef = useRef<HandTrackState | null>(null);
  const activeHandRef = handTrackRef ?? fallbackRef;
  const reducedMotion = usePrefersReducedMotion();
  const registry = useMemo(() => new Map<string, THREE.Object3D>(), []);
  const [handHoverId, setHandHoverId] = useState<string | null>(null);
  const byId = Object.fromEntries(scene.components.map((c) => [c.id, c]));
  let edgeIndex = 0;
  return (
    <Boundary>
      <Canvas
        dpr={[1, 1.75]}
        camera={{ position: [10, 9, 15], fov: 42, near: 0.1, far: 200 }}
        onCreated={onReady}
        onPointerMissed={() => onClear?.()}
        aria-label="Interactive 3D architecture. Use the component list for keyboard access."
      >
        {/* Context does not cross the Canvas boundary, so the provider lives inside it. */}
        <MotionContext.Provider value={reducedMotion ? 0 : 1}>
          <HitRegistry.Provider value={registry}>
            <Atmosphere />
            <group key={scene.id}>
              <Zone members={scene.components.filter((c) => c.zone !== "internet")} all={scene.components} label="PRIVATE NETWORK · VPC" color="#5ccfe6" labelColor="#8fe3f2" pad={1.35} opacity={0.05} layer={0} />
              <Zone members={scene.components.filter((c) => c.zone === "gpu")} all={scene.components} label="GPU INFERENCE CLUSTER" color="#76b900" labelColor="#9fd94a" pad={1.15} opacity={0.07} layer={1} />
              {scene.components.flatMap((c) => c.connectsTo.map((t) => {
                const related = isolatedId === c.id || isolatedId === t;
                return (
                  <Flow key={`${c.id}-${t}`} from={c} to={byId[t]} index={edgeIndex++} emphasis={selectedId === c.id || selectedId === t} faded={!!isolatedId && !related} />
                );
              }))}
              {scene.components.map((c, i) => (
                <Part key={c.id} c={c} index={i} selected={selectedId === c.id} dimmed={!!isolatedId && isolatedId !== c.id} handHover={handHoverId === c.id} crowded={scene.components.length > 14} onSelect={() => onSelect(c.id)} />
              ))}
            </group>
            <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={0.08} minDistance={4} maxDistance={34} maxPolarAngle={Math.PI / 2.15} onStart={() => { anim.current = null; }} />
            <CameraRig scene={scene} selectedId={selectedId} resetKey={resetKey} controls={controls} anim={anim} />
            <HandCameraControl handTrackRef={activeHandRef} controls={controls} anim={anim} />
            <HandPointer handTrackRef={activeHandRef} cursorRef={handCursorRef} onHover={setHandHoverId} onSelect={(id, via) => (onHandSelect ?? onSelect)(id, via)} />
          </HitRegistry.Provider>
        </MotionContext.Provider>
      </Canvas>
    </Boundary>
  );
}
