import { Html, Line, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { Scene, SceneComponent, Vec3 } from "./scenes";

export type ViewPreset = "overview" | "top" | "front";
/** Imperative camera moves for gesture control (CV-02). Angles in fractions of a half turn. */
export type SceneControls = { rotate: (dx: number, dy: number) => void; zoom: (amount: number) => void };

export function webglAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

const NO_WEBGL = "The 3D view couldn't start. Your browser or device may not support WebGL. Try enabling hardware acceleration or another browser; the parts list and explanations still work.";

class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <div role="alert" className="flex h-full items-center justify-center p-6 text-center text-sm">{NO_WEBGL}</div> : this.props.children;
  }
}

function Part({ c, selected, dimmed, onSelect }: { c: SceneComponent; selected: boolean; dimmed: boolean; onSelect: () => void }) {
  const [hover, setHover] = useState(false);
  const geo = c.shape === "sphere" ? <sphereGeometry args={[c.size[0], 32, 32]} /> : c.shape === "cylinder" ? <cylinderGeometry args={[c.size[0], c.size[0], c.size[1], 32]} /> : <boxGeometry args={c.size} />;
  return (
    <group position={c.position}>
      <mesh onClick={(e) => { e.stopPropagation(); onSelect(); }} onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = "pointer"; }} onPointerOut={() => { setHover(false); document.body.style.cursor = ""; }}>
        {geo}
        <meshStandardMaterial color={c.color} transparent opacity={dimmed ? 0.08 : 1} emissive={c.color} emissiveIntensity={selected ? 0.55 : hover ? 0.25 : 0} />
      </mesh>
      {!dimmed && (
        <Html position={[0, c.size[1] / 2 + 0.45, 0]} center distanceFactor={13} zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
          <div className={`whitespace-nowrap rounded px-1.5 py-0.5 text-[12px] leading-tight ${selected ? "bg-[#76b900] text-black" : "bg-black/75 text-white"}`}>{c.label}</div>
        </Html>
      )}
    </group>
  );
}

const presetPosition = (scene: Scene, view: ViewPreset): Vec3 => {
  const [x, y, z] = scene.camera.target;
  if (view === "top") return [x, y + 18, z + 0.01];
  if (view === "front") return [x, y + 2.5, z + 16];
  return scene.camera.position;
};

export function SceneCanvas({ scene, selectedId, isolatedId, view, viewKey, onSelect, onReady, onControls }: { scene: Scene; selectedId: string | null; isolatedId: string | null; view: ViewPreset; viewKey: number; onSelect: (id: string) => void; onReady: () => void; onControls?: (c: SceneControls | null) => void }) {
  const controls = useRef<OrbitControlsImpl>(null);
  const byId = Object.fromEntries(scene.components.map((c) => [c.id, c]));
  const [supported] = useState(webglAvailable);
  useEffect(() => {
    const ctl = controls.current;
    if (!ctl) return;
    ctl.object.position.set(...presetPosition(scene, view));
    ctl.target.set(...scene.camera.target);
    ctl.update();
  }, [scene, view, viewKey]);
  useEffect(() => {
    if (!onControls) return;
    onControls({
      rotate: (dx, dy) => {
        const ctl = controls.current;
        if (!ctl) return;
        ctl.setAzimuthalAngle(ctl.getAzimuthalAngle() + dx * Math.PI);
        ctl.setPolarAngle(Math.min(Math.PI / 2.05, Math.max(0.15, ctl.getPolarAngle() + dy * Math.PI)));
        ctl.update();
      },
      zoom: (amount) => {
        const ctl = controls.current;
        if (!ctl) return;
        const step = 1 + Math.min(0.5, Math.abs(amount));
        if (amount > 0) ctl.dollyIn(step);
        else ctl.dollyOut(step);
        ctl.update();
      },
    });
    return () => onControls(null);
  }, [onControls]);
  if (!supported) return <div role="alert" className="flex h-full items-center justify-center p-6 text-center text-sm">{NO_WEBGL}</div>;
  return (
    <Boundary>
      <Canvas camera={{ position: scene.camera.position, fov: 45 }} onCreated={onReady} aria-label={`Interactive 3D scene: ${scene.title}. Use the parts list for keyboard access.`}>
        <color attach="background" args={["#0a0c0b"]} />
        <ambientLight intensity={0.7} />
        <directionalLight position={[6, 10, 5]} intensity={1.1} />
        <mesh position={scene.region.center} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={scene.region.size} />
          <meshStandardMaterial color="#76b900" transparent opacity={0.06} />
        </mesh>
        {/* front-left corner: nearest the default camera and away from the components */}
        <Html position={scene.region.labelAt ?? [scene.region.center[0] - scene.region.size[0] / 2 + 0.3, 0.1, scene.region.center[2] + scene.region.size[1] / 2 - 0.3]} style={{ pointerEvents: "none" }}>
          <div className="whitespace-nowrap text-[11px] text-[#76b900]">{scene.region.label}</div>
        </Html>
        <gridHelper args={[26, 26, "#2c322d", "#181c19"]} position={[0, -0.06, 0]} />
        {scene.components.flatMap((c) => c.connectsTo.map((t) => (
          <Line key={`${c.id}-${t}`} points={[c.position, byId[t].position]} color="#566180" lineWidth={1} transparent opacity={isolatedId && isolatedId !== c.id && isolatedId !== t ? 0.1 : 0.7} />
        )))}
        {scene.components.map((c) => <Part key={c.id} c={c} selected={selectedId === c.id} dimmed={!!isolatedId && isolatedId !== c.id} onSelect={() => onSelect(c.id)} />)}
        <OrbitControls ref={controls} makeDefault enableDamping target={scene.camera.target} minDistance={4} maxDistance={34} />
      </Canvas>
    </Boundary>
  );
}
