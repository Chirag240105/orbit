import { Html, Line, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Component, useRef, useState, type ReactNode } from "react";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { Scene, SceneComponent } from "./scenes";

class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? (
      <div role="alert" className="flex h-full items-center justify-center p-6 text-center text-sm">The 3D view couldn't start. Your browser or device may not support WebGL. Try enabling hardware acceleration or another browser.</div>
    ) : this.props.children;
  }
}

function Part({ c, selected, dimmed, onSelect }: { c: SceneComponent; selected: boolean; dimmed: boolean; onSelect: () => void }) {
  const [hover, setHover] = useState(false);
  const geo = c.shape === "sphere" ? <sphereGeometry args={[c.size[0], 32, 32]} /> : c.shape === "cylinder" ? <cylinderGeometry args={[c.size[0], c.size[0], c.size[1], 32]} /> : <boxGeometry args={c.size} />;
  return (
    <group position={c.position}>
      <mesh onClick={(e) => { e.stopPropagation(); onSelect(); }} onPointerOver={() => setHover(true)} onPointerOut={() => setHover(false)}>
        {geo}
        <meshStandardMaterial color={c.color} transparent opacity={dimmed ? 0.08 : 1} emissive={c.color} emissiveIntensity={selected ? 0.55 : hover ? 0.25 : 0} />
      </mesh>
      {!dimmed && (
        <Html position={[0, c.size[1] / 2 + 0.55, 0]} center distanceFactor={11} style={{ pointerEvents: "none" }}>
          <div className={`whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] ${selected ? "bg-accent text-black" : "bg-black/70 text-white"}`}>{c.label}</div>
        </Html>
      )}
    </group>
  );
}

export function SceneCanvas({ scene, selectedId, isolatedId, resetKey, onSelect, onReady }: { scene: Scene; selectedId: string | null; isolatedId: string | null; resetKey: number; onSelect: (id: string) => void; onReady: () => void }) {
  const controls = useRef<OrbitControlsImpl>(null);
  const byId = Object.fromEntries(scene.components.map((c) => [c.id, c]));
  const lastReset = useRef(resetKey);
  if (lastReset.current !== resetKey) { lastReset.current = resetKey; controls.current?.reset(); }
  return (
    <Boundary>
      <Canvas camera={{ position: [9, 8, 13], fov: 45 }} onCreated={onReady} aria-label="Interactive 3D cloud architecture. Use the component list for keyboard access.">
        <color attach="background" args={["#0b0f17"]} />
        <ambientLight intensity={0.7} />
        <directionalLight position={[6, 10, 5]} intensity={1.1} />
        <mesh position={[0, -0.05, -0.8]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[12, 9.5]} />
          <meshStandardMaterial color="#6c9eff" transparent opacity={0.07} />
        </mesh>
        <Html position={[-5.4, 0.1, -4.6]} style={{ pointerEvents: "none" }}><div className="whitespace-nowrap text-[11px] text-accent">Private network (VPC)</div></Html>
        <gridHelper args={[24, 24, "#2a3448", "#1b2333"]} position={[0, -0.06, 0]} />
        {scene.components.flatMap((c) => c.connectsTo.map((t) => (
          <Line key={`${c.id}-${t}`} points={[c.position, byId[t].position]} color="#566180" lineWidth={1} transparent opacity={isolatedId && isolatedId !== c.id && isolatedId !== t ? 0.1 : 0.7} />
        )))}
        {scene.components.map((c) => <Part key={c.id} c={c} selected={selectedId === c.id} dimmed={!!isolatedId && isolatedId !== c.id} onSelect={() => onSelect(c.id)} />)}
        <OrbitControls ref={controls} makeDefault enableDamping target={[0, 0.5, 1.5]} minDistance={4} maxDistance={32} />
      </Canvas>
    </Boundary>
  );
}
