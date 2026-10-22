import { RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { createContext, useContext, useMemo, useRef } from "react";
import * as THREE from "three";
import type { ComponentKind } from "./scenes";

/**
 * Stylized, procedural 3D models for each component kind. Every model is built
 * from four shared per-part materials so selection, hover and isolation can
 * restyle a whole model by changing a handful of material values.
 *
 * Models sit on y = 0 (the pedestal top), fit inside a ~1.6 unit footprint, and
 * stay under ~1.45 units tall so labels can sit at a fixed height.
 */
export type PartMaterials = {
  /** Dark graphite chassis. */
  body: THREE.MeshPhysicalMaterial;
  /** Light, color-tinted metal for secondary surfaces. */
  trim: THREE.MeshPhysicalMaterial;
  /** Emissive neon in the component's color. */
  accent: THREE.MeshStandardMaterial;
  /** Translucent tinted glass. */
  glass: THREE.MeshPhysicalMaterial;
};

type ModelProps = { m: PartMaterials };

/** 1 for normal motion, 0 when the viewer prefers reduced motion. */
export const MotionContext = createContext(1);
const useMotion = () => useContext(MotionContext);

/** Runs a per-frame callback with a motion-scaled clock (frozen at 0 for reduced motion). */
function useAnim(cb: (t: number) => void) {
  const motion = useMotion();
  useFrame((state) => cb(state.clock.elapsedTime * motion));
}

function User({ m }: ModelProps) {
  const halo = useRef<THREE.Mesh>(null);
  useAnim((t) => { if (halo.current) { halo.current.rotation.z = t * 0.8; halo.current.position.y = 1.2 + Math.sin(t * 2) * 0.03; } });
  return (
    <group>
      <mesh position={[0, 0.42, 0]} material={m.trim}><capsuleGeometry args={[0.26, 0.38, 8, 20]} /></mesh>
      <mesh position={[0, 0.42, 0.24]} material={m.accent}><boxGeometry args={[0.16, 0.06, 0.04]} /></mesh>
      <mesh position={[0, 0.98, 0]} material={m.trim}><sphereGeometry args={[0.2, 32, 32]} /></mesh>
      <mesh ref={halo} position={[0, 1.2, 0]} rotation={[Math.PI / 2.4, 0, 0]} material={m.accent}><torusGeometry args={[0.24, 0.018, 8, 48]} /></mesh>
    </group>
  );
}

function Client({ m }: ModelProps) {
  const bars = useRef<THREE.Group>(null);
  useAnim((t) => bars.current?.children.forEach((bar, i) => { bar.scale.x = 0.55 + 0.45 * Math.abs(Math.sin(t * 1.3 + i * 1.1)); }));
  return (
    <group>
      <mesh position={[0, 0.03, 0]} material={m.body}><cylinderGeometry args={[0.36, 0.42, 0.06, 32]} /></mesh>
      <mesh position={[0, 0.28, -0.05]} material={m.trim}><boxGeometry args={[0.1, 0.46, 0.08]} /></mesh>
      <RoundedBox args={[1.45, 0.9, 0.1]} radius={0.05} position={[0, 0.85, 0]} material={m.body} />
      <mesh position={[0, 0.85, 0.052]} material={m.glass}><planeGeometry args={[1.32, 0.77]} /></mesh>
      <mesh position={[-0.42, 0.85, 0.058]} material={m.accent}><planeGeometry args={[0.3, 0.6]} /></mesh>
      <group ref={bars} position={[-0.18, 0, 0.058]}>
        {[1.06, 0.92, 0.78, 0.64].map((y) => (
          <mesh key={y} position={[0.32, y, 0]} material={m.trim}><planeGeometry args={[0.66, 0.06]} /></mesh>
        ))}
      </group>
    </group>
  );
}

function Edge({ m }: ModelProps) {
  const rings = useRef<THREE.Group>(null);
  const sats = useRef<THREE.Group>(null);
  useAnim((t) => {
    if (rings.current) rings.current.rotation.y = t * 0.35;
    if (sats.current) sats.current.rotation.y = -t * 0.9;
  });
  return (
    <group position={[0, 0.72, 0]}>
      <mesh material={m.body}><sphereGeometry args={[0.4, 48, 48]} /></mesh>
      <mesh material={m.glass} scale={1.08}><icosahedronGeometry args={[0.4, 1]} /></mesh>
      <group ref={rings}>
        <mesh rotation={[Math.PI / 2, 0, 0]} material={m.accent}><torusGeometry args={[0.47, 0.012, 8, 64]} /></mesh>
        <mesh rotation={[0, 0, 0]} material={m.accent}><torusGeometry args={[0.47, 0.012, 8, 64]} /></mesh>
        <mesh rotation={[0, Math.PI / 2, 0]} material={m.trim}><torusGeometry args={[0.47, 0.01, 8, 64]} /></mesh>
      </group>
      <group ref={sats} rotation={[0.35, 0, 0.2]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} material={m.trim}><torusGeometry args={[0.68, 0.006, 6, 80]} /></mesh>
        {[0, 2.1, 4.2].map((a) => <mesh key={a} position={[Math.cos(a) * 0.68, 0, Math.sin(a) * 0.68]} material={m.accent}><sphereGeometry args={[0.045, 16, 16]} /></mesh>)}
      </group>
    </group>
  );
}

function Gateway({ m }: ModelProps) {
  const beam = useRef<THREE.Mesh>(null);
  useAnim((t) => { if (beam.current) beam.current.position.y = 0.62 + Math.sin(t * 2.2) * 0.4; });
  return (
    <group>
      <RoundedBox args={[1.5, 0.1, 0.62]} radius={0.04} position={[0, 0.05, 0]} material={m.body} />
      {[-0.56, 0.56].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <RoundedBox args={[0.26, 1.15, 0.5]} radius={0.06} position={[0, 0.67, 0]} material={m.body} />
          <mesh position={[0, 0.67, 0.252]} material={m.accent}><planeGeometry args={[0.05, 0.9]} /></mesh>
        </group>
      ))}
      <RoundedBox args={[1.5, 0.24, 0.56]} radius={0.06} position={[0, 1.3, 0]} material={m.trim} />
      <mesh position={[0, 1.3, 0.284]} material={m.accent}><planeGeometry args={[0.9, 0.05]} /></mesh>
      <mesh position={[0, 0.65, 0]} material={m.glass}><planeGeometry args={[0.86, 1.1]} /></mesh>
      <mesh ref={beam} position={[0, 0.62, 0]} material={m.accent}><boxGeometry args={[0.86, 0.03, 0.06]} /></mesh>
    </group>
  );
}

function Service({ m }: ModelProps) {
  const leds = useRef<THREE.Group>(null);
  useAnim((t) => leds.current?.children.forEach((led, i) => {
    const on = Math.sin(t * (3 + (i % 3)) + i * 1.7) > -0.2;
    led.scale.setScalar(on ? 1 : 0.25);
  }));
  const slabs = [0.2, 0.52, 0.84];
  return (
    <group>
      {slabs.map((y) => (
        <group key={y} position={[0, y, 0]}>
          <RoundedBox args={[1.2, 0.27, 0.8]} radius={0.05} material={m.body} />
          <mesh position={[0.12, 0, 0.402]} material={m.trim}><planeGeometry args={[0.7, 0.12]} /></mesh>
          <mesh position={[0.12, 0, 0.404]} material={m.accent}><planeGeometry args={[0.66, 0.025]} /></mesh>
        </group>
      ))}
      <group ref={leds}>
        {slabs.flatMap((y) => [0, 1, 2].map((i) => (
          <mesh key={`${y}-${i}`} position={[-0.47 + i * 0.07, y, 0.41]} material={m.accent}><sphereGeometry args={[0.022, 10, 10]} /></mesh>
        )))}
      </group>
      <mesh position={[0, 1.02, 0]} material={m.accent}><boxGeometry args={[1.0, 0.025, 0.6]} /></mesh>
    </group>
  );
}

function Agent({ m }: ModelProps) {
  const head = useRef<THREE.Group>(null);
  const eyes = useRef<THREE.Group>(null);
  useAnim((t) => {
    if (head.current) { head.current.rotation.y = Math.sin(t * 0.7) * 0.35; head.current.position.y = 0.7 + Math.sin(t * 1.6) * 0.04; }
    // Blink briefly every few seconds.
    if (eyes.current) eyes.current.scale.y = (t % 3.6) < 0.12 ? 0.15 : 1;
  });
  return (
    <group>
      <mesh position={[0, 0.12, 0]} material={m.body}><cylinderGeometry args={[0.32, 0.44, 0.24, 32]} /></mesh>
      <mesh position={[0, 0.25, 0]} material={m.accent}><torusGeometry args={[0.33, 0.015, 8, 48]} /></mesh>
      <group ref={head} position={[0, 0.7, 0]}>
        <RoundedBox args={[0.9, 0.72, 0.76]} radius={0.2} smoothness={5} material={m.trim} />
        <RoundedBox args={[0.74, 0.3, 0.06]} radius={0.06} position={[0, 0.02, 0.37]} material={m.body} />
        <group ref={eyes} position={[0, 0.02, 0.405]}>
          {[-0.17, 0.17].map((x) => <mesh key={x} position={[x, 0, 0]} material={m.accent}><capsuleGeometry args={[0.045, 0.06, 4, 12]} /></mesh>)}
        </group>
        <mesh position={[0, 0.48, 0]} material={m.body}><cylinderGeometry args={[0.018, 0.018, 0.24, 8]} /></mesh>
        <mesh position={[0, 0.62, 0]} material={m.accent}><sphereGeometry args={[0.06, 16, 16]} /></mesh>
        {[-0.46, 0.46].map((x) => <mesh key={x} position={[x, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={m.body}><cylinderGeometry args={[0.1, 0.1, 0.06, 20]} /></mesh>)}
      </group>
    </group>
  );
}

function AiCore({ m }: ModelProps) {
  const core = useRef<THREE.Group>(null);
  const orbitA = useRef<THREE.Group>(null);
  const orbitB = useRef<THREE.Group>(null);
  useAnim((t) => {
    if (core.current) { core.current.rotation.y = t * 0.4; core.current.rotation.x = t * 0.25; core.current.position.y = 0.78 + Math.sin(t * 1.4) * 0.05; }
    if (orbitA.current) orbitA.current.rotation.y = t * 1.1;
    if (orbitB.current) orbitB.current.rotation.y = -t * 0.8;
  });
  return (
    <group>
      <mesh position={[0, 0.06, 0]} material={m.body}><cylinderGeometry args={[0.3, 0.38, 0.12, 6]} /></mesh>
      <group ref={core} position={[0, 0.78, 0]}>
        <mesh material={m.glass}><icosahedronGeometry args={[0.42, 0]} /></mesh>
        <mesh material={m.accent}><icosahedronGeometry args={[0.2, 1]} /></mesh>
      </group>
      <group position={[0, 0.78, 0]}>
        <group ref={orbitA} rotation={[0.5, 0, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} material={m.trim}><torusGeometry args={[0.62, 0.008, 6, 80]} /></mesh>
          {[0, Math.PI].map((a) => <mesh key={a} position={[Math.cos(a) * 0.62, 0, Math.sin(a) * 0.62]} material={m.accent}><sphereGeometry args={[0.05, 16, 16]} /></mesh>)}
        </group>
        <group ref={orbitB} rotation={[-0.6, 0, 0.3]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} material={m.trim}><torusGeometry args={[0.55, 0.008, 6, 80]} /></mesh>
          <mesh position={[0.55, 0, 0]} material={m.accent}><sphereGeometry args={[0.04, 16, 16]} /></mesh>
        </group>
      </group>
    </group>
  );
}

function Database({ m }: ModelProps) {
  const seams = useRef<THREE.Group>(null);
  useAnim((t) => seams.current?.children.forEach((seam, i) => {
    // A pulse travels up the stack like data being written.
    const pulse = Math.max(0, Math.sin(t * 2.4 - i * 1.2));
    seam.scale.set(1 + pulse * 0.04, 1, 1 + pulse * 0.04);
  }));
  const disks = [0.16, 0.5, 0.84];
  return (
    <group>
      {disks.map((y) => (
        <group key={y} position={[0, y, 0]}>
          <mesh material={m.body}><cylinderGeometry args={[0.55, 0.55, 0.3, 48]} /></mesh>
          <mesh position={[0, 0.151, 0]} rotation={[-Math.PI / 2, 0, 0]} material={m.trim}><ringGeometry args={[0.38, 0.5, 48]} /></mesh>
        </group>
      ))}
      <group ref={seams}>
        {[0.33, 0.67, 1.0].map((y) => <mesh key={y} position={[0, y, 0]} material={m.accent}><cylinderGeometry args={[0.565, 0.565, 0.035, 48]} /></mesh>)}
      </group>
      <mesh position={[0, 1.02, 0]} material={m.glass}><cylinderGeometry args={[0.36, 0.36, 0.02, 40]} /></mesh>
    </group>
  );
}

function Cache({ m }: ModelProps) {
  const bolt = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Mesh>(null);
  const boltGeometry = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0.06, 0.32); s.lineTo(-0.16, -0.02); s.lineTo(-0.01, -0.02); s.lineTo(-0.08, -0.32);
    s.lineTo(0.17, 0.06); s.lineTo(0.02, 0.06); s.lineTo(0.12, 0.32); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 2 });
    g.center();
    return g;
  }, []);
  useAnim((t) => {
    if (bolt.current) { bolt.current.rotation.y = t * 1.2; bolt.current.position.y = 0.92 + Math.sin(t * 2) * 0.05; }
    if (ring.current) ring.current.rotation.z = t * 3;
  });
  return (
    <group>
      <mesh position={[0, 0.18, 0]} material={m.body}><cylinderGeometry args={[0.58, 0.62, 0.36, 48]} /></mesh>
      <mesh position={[0, 0.37, 0]} rotation={[-Math.PI / 2, 0, 0]} material={m.accent}><ringGeometry args={[0.44, 0.5, 48]} /></mesh>
      <mesh position={[0, 0.37, 0]} rotation={[-Math.PI / 2, 0, 0]} material={m.trim}><circleGeometry args={[0.4, 48]} /></mesh>
      <mesh ref={ring} position={[0, 0.2, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.accent}><torusGeometry args={[0.68, 0.012, 6, 6]} /></mesh>
      <mesh ref={bolt} position={[0, 0.92, 0]} geometry={boltGeometry} material={m.accent} />
    </group>
  );
}

function Queue({ m }: ModelProps) {
  const msgs = useRef<THREE.Group>(null);
  const COUNT = 4;
  useAnim((t) => msgs.current?.children.forEach((msg, i) => {
    // Messages slide left-to-right on a loop and shrink in/out at the rail ends.
    const p = (t * 0.25 + i / COUNT) % 1;
    msg.position.x = -0.62 + p * 1.24;
    msg.scale.setScalar(Math.min(1, Math.min(p, 1 - p) * 8));
  }));
  return (
    <group>
      <RoundedBox args={[1.6, 0.14, 0.6]} radius={0.05} position={[0, 0.07, 0]} material={m.body} />
      {[-0.24, 0.24].map((z) => <mesh key={z} position={[0, 0.16, z]} material={m.accent}><boxGeometry args={[1.5, 0.03, 0.03]} /></mesh>)}
      {[-0.74, 0.74].map((x) => <RoundedBox key={x} args={[0.12, 0.42, 0.6]} radius={0.04} position={[x, 0.28, 0]} material={m.trim} />)}
      <group ref={msgs} position={[0, 0.33, 0]}>
        {Array.from({ length: COUNT }).map((_, i) => (
          <RoundedBox key={i} args={[0.26, 0.26, 0.34]} radius={0.04} material={i % 2 ? m.trim : m.accent} />
        ))}
      </group>
    </group>
  );
}

function Payment({ m }: ModelProps) {
  const card = useRef<THREE.Group>(null);
  const coin = useRef<THREE.Mesh>(null);
  useAnim((t) => {
    if (card.current) { card.current.rotation.y = -0.35 + Math.sin(t * 0.8) * 0.3; card.current.position.y = 0.8 + Math.sin(t * 1.5) * 0.04; }
    if (coin.current) coin.current.rotation.y = t * 2.4;
  });
  return (
    <group>
      <mesh position={[0, 0.06, 0]} material={m.body}><cylinderGeometry args={[0.3, 0.38, 0.12, 32]} /></mesh>
      <group ref={card} position={[0, 0.8, 0]} rotation={[-0.12, 0, 0.05]}>
        <RoundedBox args={[1.1, 0.68, 0.05]} radius={0.02} smoothness={4} material={m.trim} />
        <mesh position={[0, 0.17, 0.027]} material={m.body}><planeGeometry args={[1.1, 0.14]} /></mesh>
        <RoundedBox args={[0.18, 0.14, 0.02]} radius={0.01} position={[-0.34, -0.05, 0.03]} material={m.accent} />
        {[0, 1, 2, 3].map((i) => <mesh key={i} position={[-0.1 + i * 0.16, -0.2, 0.027]} material={m.body}><planeGeometry args={[0.12, 0.04]} /></mesh>)}
      </group>
      <mesh ref={coin} position={[0.55, 0.42, 0.25]} rotation={[0, 0, Math.PI / 2]} material={m.accent}><cylinderGeometry args={[0.16, 0.16, 0.04, 32]} /></mesh>
    </group>
  );
}

function Cart({ m }: ModelProps) {
  const items = useRef<THREE.Group>(null);
  useAnim((t) => items.current?.children.forEach((item, i) => { item.position.y = 0.72 + Math.abs(Math.sin(t * 1.8 + i * 1.3)) * 0.06; }));
  return (
    <group rotation={[0, -0.4, 0]}>
      {/* A four-sided tapered cylinder gives a square, open basket. */}
      <mesh position={[0, 0.6, 0]} rotation={[0, Math.PI / 4, 0]} material={m.trim}><cylinderGeometry args={[0.62, 0.46, 0.5, 4, 1, true]} /></mesh>
      <mesh position={[0, 0.86, 0]} rotation={[0, Math.PI / 4, 0]} material={m.accent}><torusGeometry args={[0.62, 0.02, 6, 4]} /></mesh>
      <mesh position={[0, 0.355, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 4]} material={m.body}><circleGeometry args={[0.46, 4]} /></mesh>
      <mesh position={[-0.52, 0.92, 0]} rotation={[0, 0, -0.5]} material={m.body}><cylinderGeometry args={[0.03, 0.03, 0.5, 10]} /></mesh>
      <mesh position={[-0.66, 1.14, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.accent}><cylinderGeometry args={[0.035, 0.035, 0.5, 12]} /></mesh>
      {[[-0.28, -0.28], [0.28, -0.28], [-0.28, 0.28], [0.28, 0.28]].map(([x, z]) => (
        <group key={`${x}${z}`}>
          <mesh position={[x, 0.22, z]} material={m.body}><cylinderGeometry args={[0.02, 0.02, 0.24, 8]} /></mesh>
          <mesh position={[x, 0.08, z]} rotation={[0, 0, Math.PI / 2]} material={m.body}><cylinderGeometry args={[0.08, 0.08, 0.05, 20]} /></mesh>
        </group>
      ))}
      <group ref={items}>
        <RoundedBox args={[0.26, 0.26, 0.26]} radius={0.04} position={[-0.12, 0.72, -0.08]} material={m.accent} />
        <RoundedBox args={[0.2, 0.34, 0.2]} radius={0.04} position={[0.16, 0.72, 0.1]} material={m.glass} />
      </group>
    </group>
  );
}

function Warehouse({ m }: ModelProps) {
  const top = useRef<THREE.Group>(null);
  useAnim((t) => { if (top.current) top.current.position.y = 0.73 + Math.sin(t * 1.4) * 0.03; });
  const crate = (key: string, pos: [number, number, number], mat: THREE.Material) => (
    <group key={key} position={pos}>
      <RoundedBox args={[0.5, 0.46, 0.5]} radius={0.04} material={mat} />
      <mesh position={[0, 0.232, 0]} rotation={[-Math.PI / 2, 0, 0]} material={m.accent}><planeGeometry args={[0.1, 0.5]} /></mesh>
      <mesh position={[0, 0, 0.252]} material={m.accent}><planeGeometry args={[0.1, 0.46]} /></mesh>
    </group>
  );
  return (
    <group>
      <RoundedBox args={[1.4, 0.06, 0.8]} radius={0.02} position={[0, 0.03, 0]} material={m.body} />
      {crate("a", [-0.3, 0.29, 0], m.trim)}
      {crate("b", [0.3, 0.29, 0], m.body)}
      <group ref={top}>{crate("c", [0, 0.73, 0], m.trim)}</group>
      <mesh position={[0, 1.12, 0]} material={m.glass}><boxGeometry args={[0.18, 0.18, 0.18]} /></mesh>
    </group>
  );
}

function Security({ m }: ModelProps) {
  const shield = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const geometry = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0.5);
    s.bezierCurveTo(0.15, 0.45, 0.3, 0.42, 0.4, 0.4);
    s.lineTo(0.4, 0.05);
    s.bezierCurveTo(0.4, -0.25, 0.2, -0.4, 0, -0.52);
    s.bezierCurveTo(-0.2, -0.4, -0.4, -0.25, -0.4, 0.05);
    s.lineTo(-0.4, 0.4);
    s.bezierCurveTo(-0.3, 0.42, -0.15, 0.45, 0, 0.5);
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 3, curveSegments: 24 });
    g.center();
    return g;
  }, []);
  useAnim((t) => {
    if (shield.current) { shield.current.rotation.y = Math.sin(t * 0.6) * 0.5; shield.current.position.y = 0.78 + Math.sin(t * 1.5) * 0.04; }
    if (ring.current) ring.current.rotation.z = t * 0.9;
  });
  return (
    <group>
      <mesh position={[0, 0.06, 0]} material={m.body}><cylinderGeometry args={[0.34, 0.42, 0.12, 32]} /></mesh>
      <mesh ref={ring} position={[0, 0.16, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.accent}><torusGeometry args={[0.5, 0.012, 6, 12]} /></mesh>
      <group ref={shield} position={[0, 0.78, 0]}>
        <mesh geometry={geometry} material={m.trim} />
        <mesh geometry={geometry} material={m.body} scale={[0.78, 0.78, 1.15]} />
        <mesh position={[0, 0.06, 0.1]} rotation={[Math.PI / 2, 0, 0]} material={m.accent}><cylinderGeometry args={[0.09, 0.09, 0.04, 24]} /></mesh>
        <mesh position={[0, -0.08, 0.1]} material={m.accent}><boxGeometry args={[0.07, 0.18, 0.04]} /></mesh>
      </group>
    </group>
  );
}

function Ledger({ m }: ModelProps) {
  const book = useRef<THREE.Group>(null);
  useAnim((t) => { if (book.current) { book.current.position.y = 0.72 + Math.sin(t * 1.3) * 0.04; book.current.rotation.y = -0.4 + Math.sin(t * 0.5) * 0.2; } });
  const half = (side: 1 | -1) => (
    <group key={side} rotation={[0, 0, side * -0.22]}>
      <group position={[side * 0.4, 0, 0]}>
        <RoundedBox args={[0.8, 0.05, 1.0]} radius={0.02} position={[0, -0.04, 0]} material={m.body} />
        <mesh position={[0, 0.03, 0]} material={m.trim}><boxGeometry args={[0.74, 0.08, 0.94]} /></mesh>
        {[-0.3, -0.15, 0, 0.15, 0.3].map((z, i) => (
          <mesh key={z} position={[0, 0.072, z]} rotation={[-Math.PI / 2, 0, 0]} material={i === 2 ? m.accent : m.body}><planeGeometry args={[0.56, 0.035]} /></mesh>
        ))}
      </group>
    </group>
  );
  return (
    <group>
      <mesh position={[0, 0.06, 0]} material={m.body}><cylinderGeometry args={[0.3, 0.38, 0.12, 32]} /></mesh>
      <group ref={book} position={[0, 0.72, 0]} rotation={[0.5, -0.4, 0]}>
        {half(1)}{half(-1)}
        <mesh position={[0, 0.1, 0.52]} material={m.accent}><boxGeometry args={[0.06, 0.02, 0.22]} /></mesh>
      </group>
    </group>
  );
}

function Memory({ m }: ModelProps) {
  const crystal = useRef<THREE.Mesh>(null);
  const core = useRef<THREE.Mesh>(null);
  useAnim((t) => {
    if (crystal.current) { crystal.current.rotation.y = t * 0.9; crystal.current.position.y = 0.88 + Math.sin(t * 1.6) * 0.06; }
    if (core.current) core.current.scale.setScalar(0.92 + Math.sin(t * 2.5) * 0.08);
  });
  const pins = [-0.3, -0.15, 0, 0.15, 0.3];
  return (
    <group>
      <RoundedBox args={[1.0, 0.16, 1.0]} radius={0.04} position={[0, 0.2, 0]} material={m.body} />
      {pins.flatMap((p) => [
        <mesh key={`n${p}`} position={[p, 0.16, 0.55]} material={m.trim}><boxGeometry args={[0.06, 0.04, 0.12]} /></mesh>,
        <mesh key={`s${p}`} position={[p, 0.16, -0.55]} material={m.trim}><boxGeometry args={[0.06, 0.04, 0.12]} /></mesh>,
        <mesh key={`e${p}`} position={[0.55, 0.16, p]} material={m.trim}><boxGeometry args={[0.12, 0.04, 0.06]} /></mesh>,
        <mesh key={`w${p}`} position={[-0.55, 0.16, p]} material={m.trim}><boxGeometry args={[0.12, 0.04, 0.06]} /></mesh>,
      ])}
      <RoundedBox args={[0.56, 0.06, 0.56]} radius={0.02} position={[0, 0.3, 0]} material={m.trim} />
      <mesh ref={core} position={[0, 0.335, 0]} rotation={[-Math.PI / 2, 0, 0]} material={m.accent}><planeGeometry args={[0.36, 0.36]} /></mesh>
      <mesh ref={crystal} position={[0, 0.88, 0]} material={m.glass}><octahedronGeometry args={[0.26, 0]} /></mesh>
    </group>
  );
}

/** A thin cylinder spanning two points. */
function Strut({ a, b, radius, material }: { a: THREE.Vector3; b: THREE.Vector3; radius: number; material: THREE.Material }) {
  const { mid, quat, len } = useMemo(() => {
    const dir = b.clone().sub(a);
    return { mid: a.clone().add(b).multiplyScalar(0.5), len: dir.length(), quat: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()) };
  }, [a, b]);
  return <mesh position={mid} quaternion={quat} material={material}><cylinderGeometry args={[radius, radius, len, 6]} /></mesh>;
}

function Network({ m }: ModelProps) {
  const graph = useRef<THREE.Group>(null);
  const nodes = useMemo(() => [
    new THREE.Vector3(0.55, 0.15, 0), new THREE.Vector3(-0.3, 0.3, 0.45), new THREE.Vector3(-0.3, -0.2, -0.45), new THREE.Vector3(0.1, -0.35, 0.4), new THREE.Vector3(0.15, 0.42, -0.35),
  ], []);
  const center = useMemo(() => new THREE.Vector3(), []);
  useAnim((t) => { if (graph.current) { graph.current.rotation.y = t * 0.4; graph.current.position.y = 0.8 + Math.sin(t * 1.4) * 0.04; } });
  return (
    <group>
      <mesh position={[0, 0.06, 0]} material={m.body}><cylinderGeometry args={[0.3, 0.38, 0.12, 32]} /></mesh>
      <group ref={graph} position={[0, 0.8, 0]}>
        <mesh material={m.trim}><sphereGeometry args={[0.2, 32, 32]} /></mesh>
        {nodes.map((n, i) => (
          <group key={i}>
            <Strut a={center} b={n} radius={0.012} material={m.trim} />
            <Strut a={n} b={nodes[(i + 1) % nodes.length]} radius={0.007} material={m.accent} />
            <mesh position={n} material={m.accent}><sphereGeometry args={[0.07, 16, 16]} /></mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

function Output({ m }: ModelProps) {
  const doc = useRef<THREE.Group>(null);
  useAnim((t) => { if (doc.current) { doc.current.position.y = 0.78 + Math.sin(t * 1.4) * 0.05; doc.current.rotation.y = Math.sin(t * 0.6) * 0.3; } });
  return (
    <group>
      <mesh position={[0, 0.06, 0]} material={m.body}><cylinderGeometry args={[0.3, 0.38, 0.12, 32]} /></mesh>
      <group ref={doc} position={[0, 0.78, 0]}>
        <RoundedBox args={[0.78, 1.0, 0.06]} radius={0.03} material={m.trim} />
        {[0.3, 0.18, 0.06, -0.06].map((y, i) => <mesh key={y} position={[i === 0 ? -0.08 : 0, y, 0.032]} material={m.body}><planeGeometry args={[i === 0 ? 0.42 : 0.58, 0.05]} /></mesh>)}
        <group position={[0.18, -0.28, 0.06]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} material={m.accent}><cylinderGeometry args={[0.16, 0.16, 0.04, 32]} /></mesh>
          <mesh position={[-0.035, -0.015, 0.025]} rotation={[0, 0, Math.PI / 4]} material={m.body}><boxGeometry args={[0.1, 0.03, 0.02]} /></mesh>
          <mesh position={[0.03, 0.01, 0.025]} rotation={[0, 0, -Math.PI / 3.6]} material={m.body}><boxGeometry args={[0.17, 0.03, 0.02]} /></mesh>
        </group>
      </group>
    </group>
  );
}

function Gpu({ m }: ModelProps) {
  const fans = useRef<THREE.Group>(null);
  const leds = useRef<THREE.Group>(null);
  useAnim((t) => {
    fans.current?.children.forEach((fan) => { fan.rotation.y = -t * 6; });
    leds.current?.children.forEach((led, i) => { led.scale.x = 0.3 + 0.7 * Math.abs(Math.sin(t * 2.2 + i * 0.6)); });
  });
  return (
    <group>
      {/* A server tray holding one graphics card, seen from above so the fans read clearly. */}
      <RoundedBox args={[1.5, 0.16, 0.95]} radius={0.04} position={[0, 0.08, 0]} material={m.body} />
      <group position={[0, 0.42, 0]}>
        <RoundedBox args={[1.42, 0.22, 0.78]} radius={0.05} material={m.trim} />
        {/* Heatsink fins along the back edge. */}
        {Array.from({ length: 9 }).map((_, i) => (
          <mesh key={i} position={[-0.6 + i * 0.15, 0.17, -0.3]} material={m.body}><boxGeometry args={[0.04, 0.12, 0.14]} /></mesh>
        ))}
        <group ref={fans}>
          {[-0.34, 0.34].map((x) => (
            <group key={x} position={[x, 0.115, 0.06]}>
              {Array.from({ length: 7 }).map((_, i) => (
                <mesh key={i} rotation={[0, (i / 7) * Math.PI * 2, 0]} position={[0, 0.01, 0]} material={m.body}>
                  <boxGeometry args={[0.26, 0.012, 0.07]} />
                </mesh>
              ))}
            </group>
          ))}
        </group>
        {[-0.34, 0.34].map((x) => (
          <group key={x} position={[x, 0.116, 0.06]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} material={m.accent}><ringGeometry args={[0.27, 0.3, 40]} /></mesh>
            <mesh position={[0, 0.02, 0]} material={m.accent}><cylinderGeometry args={[0.06, 0.06, 0.02, 20]} /></mesh>
          </group>
        ))}
        <mesh position={[0, 0, 0.392]} material={m.accent}><planeGeometry args={[1.2, 0.04]} /></mesh>
      </group>
      <group ref={leds} position={[0.2, 0.17, 0.48]}>
        {[0, 1, 2, 3].map((i) => <mesh key={i} position={[i * 0.12, 0, 0]} material={m.accent}><boxGeometry args={[0.08, 0.03, 0.01]} /></mesh>)}
      </group>
    </group>
  );
}

function VectorIndex({ m }: ModelProps) {
  const cloud = useRef<THREE.Group>(null);
  const query = useRef<THREE.Mesh>(null);
  // A deterministic point cloud with a cluster of nearest neighbours around the query point.
  const { points, neighbours, q } = useMemo(() => {
    let seed = 7;
    const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const pts = Array.from({ length: 34 }, () => new THREE.Vector3((rand() - 0.5) * 0.9, (rand() - 0.5) * 0.9, (rand() - 0.5) * 0.9));
    const qp = new THREE.Vector3(0.12, 0.1, 0.05);
    const near = [...pts].sort((a, b) => a.distanceTo(qp) - b.distanceTo(qp)).slice(0, 4);
    return { points: pts, neighbours: near, q: qp };
  }, []);
  useAnim((t) => {
    if (cloud.current) cloud.current.rotation.y = t * 0.35;
    if (query.current) query.current.scale.setScalar(1 + Math.sin(t * 3) * 0.2);
  });
  return (
    <group>
      <mesh position={[0, 0.06, 0]} material={m.body}><cylinderGeometry args={[0.42, 0.5, 0.12, 32]} /></mesh>
      <group ref={cloud} position={[0, 0.78, 0]}>
        <mesh material={m.glass}><boxGeometry args={[1.0, 1.0, 1.0]} /></mesh>
        {points.map((p, i) => <mesh key={i} position={p} material={neighbours.includes(p) ? m.accent : m.trim}><sphereGeometry args={[neighbours.includes(p) ? 0.04 : 0.026, 10, 10]} /></mesh>)}
        <mesh ref={query} position={q} material={m.accent}><octahedronGeometry args={[0.07, 0]} /></mesh>
        {neighbours.map((n, i) => <Strut key={i} a={q} b={n} radius={0.006} material={m.accent} />)}
      </group>
    </group>
  );
}

function Monitor({ m }: ModelProps) {
  const bars = useRef<THREE.Group>(null);
  const pulse = useRef<THREE.Mesh>(null);
  useAnim((t) => {
    bars.current?.children.forEach((bar, i) => {
      const h = 0.25 + 0.75 * Math.abs(Math.sin(t * 1.1 + i * 0.9));
      bar.scale.y = h;
      bar.position.y = -0.22 + 0.2 * h;
    });
    if (pulse.current) { const p = (t * 0.8) % 1; pulse.current.scale.setScalar(0.6 + p); }
  });
  return (
    <group>
      <mesh position={[0, 0.06, 0]} material={m.body}><cylinderGeometry args={[0.3, 0.38, 0.12, 32]} /></mesh>
      <mesh position={[0, 0.3, -0.05]} material={m.trim}><boxGeometry args={[0.08, 0.4, 0.06]} /></mesh>
      <group position={[0, 0.86, 0]} rotation={[-0.12, 0, 0]}>
        <RoundedBox args={[1.3, 0.8, 0.08]} radius={0.04} material={m.body} />
        <mesh position={[0, 0, 0.042]} material={m.glass}><planeGeometry args={[1.18, 0.68]} /></mesh>
        <group ref={bars} position={[-0.3, 0, 0.05]}>
          {Array.from({ length: 6 }).map((_, i) => (
            <mesh key={i} position={[i * 0.1 - 0.25, 0, 0]} material={i === 3 ? m.trim : m.accent}><boxGeometry args={[0.06, 0.4, 0.01]} /></mesh>
          ))}
        </group>
        <group position={[0.36, 0.04, 0.05]}>
          <mesh material={m.accent}><ringGeometry args={[0.1, 0.13, 32]} /></mesh>
          <mesh ref={pulse} material={m.trim}><ringGeometry args={[0.16, 0.175, 32]} /></mesh>
        </group>
      </group>
    </group>
  );
}

function Mobile({ m }: ModelProps) {
  const phone = useRef<THREE.Group>(null);
  const rows = useRef<THREE.Group>(null);
  useAnim((t) => {
    if (phone.current) { phone.current.rotation.y = -0.35 + Math.sin(t * 0.7) * 0.25; phone.current.position.y = 0.82 + Math.sin(t * 1.5) * 0.04; }
    // Chat bubbles or list rows sliding in, like a live feed.
    rows.current?.children.forEach((row, i) => { row.scale.x = 0.5 + 0.5 * Math.abs(Math.sin(t * 0.9 + i * 0.8)); });
  });
  return (
    <group>
      <mesh position={[0, 0.06, 0]} material={m.body}><cylinderGeometry args={[0.3, 0.38, 0.12, 32]} /></mesh>
      <group ref={phone} position={[0, 0.82, 0]} rotation={[-0.1, -0.35, 0]}>
        <RoundedBox args={[0.6, 1.12, 0.07]} radius={0.06} smoothness={5} material={m.body} />
        <mesh position={[0, 0, 0.037]} material={m.glass}><planeGeometry args={[0.52, 1.0]} /></mesh>
        <mesh position={[0, 0.45, 0.04]} material={m.body}><boxGeometry args={[0.16, 0.035, 0.01]} /></mesh>
        <group ref={rows} position={[0, 0, 0.042]}>
          {[0.28, 0.12, -0.04, -0.2].map((y, i) => (
            <mesh key={y} position={[i % 2 ? 0.08 : -0.08, y, 0]} material={i % 2 ? m.accent : m.trim}><planeGeometry args={[0.3, 0.1]} /></mesh>
          ))}
        </group>
        <mesh position={[0, -0.4, 0.042]} material={m.accent}><planeGeometry args={[0.36, 0.06]} /></mesh>
      </group>
    </group>
  );
}

const MODELS: Record<ComponentKind, (p: ModelProps) => JSX.Element> = {
  gpu: Gpu, vector: VectorIndex, monitor: Monitor, mobile: Mobile,
  user: User, client: Client, edge: Edge, gateway: Gateway, service: Service, agent: Agent, ai: AiCore,
  database: Database, cache: Cache, queue: Queue, payment: Payment, cart: Cart, warehouse: Warehouse,
  security: Security, ledger: Ledger, memory: Memory, network: Network, output: Output,
};

export function PartModel({ kind, materials }: { kind: ComponentKind; materials: PartMaterials }) {
  const Model = MODELS[kind];
  return <Model m={materials} />;
}

/** Builds the four shared materials for one part, tinted with its color. */
export function createPartMaterials(color: string): PartMaterials {
  const tint = new THREE.Color("#dfe6f3").lerp(new THREE.Color(color), 0.28);
  return {
    body: new THREE.MeshPhysicalMaterial({ color: "#1a2132", metalness: 0.6, roughness: 0.34, clearcoat: 0.8, clearcoatRoughness: 0.25, side: THREE.DoubleSide }),
    trim: new THREE.MeshPhysicalMaterial({ color: tint, metalness: 0.35, roughness: 0.28, clearcoat: 0.6, side: THREE.DoubleSide }),
    accent: new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.1, toneMapped: false }),
    glass: new THREE.MeshPhysicalMaterial({ color, emissive: color, emissiveIntensity: 0.25, transparent: true, opacity: 0.38, roughness: 0.08, metalness: 0.1, depthWrite: false, side: THREE.DoubleSide }),
  };
}

let glowTexture: THREE.Texture | null = null;
/** A soft radial gradient used for ground glows and packet halos. */
export function getGlowTexture() {
  if (glowTexture) return glowTexture;
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.35, "rgba(255,255,255,0.35)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  glowTexture = new THREE.CanvasTexture(canvas);
  return glowTexture;
}
