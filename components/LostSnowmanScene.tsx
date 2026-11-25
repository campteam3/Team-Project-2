"use client";

// 404 의 3D 장면 (LostSnowman 이 불러옵니다): 길 잃은 눈사람 + 별 · 편지 · 오너먼트가 서로 다른 속도로 떠다닙니다.
// Three.js 기본 도형만 씁니다(실제 사용자 스노우볼 모델은 쓰지 않음). 색은 LostSnowman 의 대체 그림(SVG)과 같습니다.
// greeted: 인사하면 눈사람이 오른팔을 들어 흔들고 살짝 뛰어오릅니다.
// animate=false(움직임 줄이기 · 멈춤 · 탭이 안 보일 때)이면 그리기를 멈춥니다.

import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";

type Props = { animate: boolean; greeted: boolean; fallback: ReactNode };

const C = {
  body: "#E3EAE8",
  head: "#F5F1EA",
  hat: "#C85B60",
  hatBand: "#A13D4A",
  pom: "#E79794",
  eye: "#263349",
  carrot: "#EAAA69",
  scarf: "#5A9F9F",
  scarfTail: "#77B3AE",
  arm: "#A58976",
  button: "#526170",
  star: "#F2C46D",
  ornament: "#CA666D",
  cap: "#E3CA95",
  letter: "#F0DDC0",
  letterLine: "#B59879",
  ball: "#77B3AE",
};

const clay = (color: string) => <meshStandardMaterial color={color} roughness={0.75} metalness={0} />;

function starGeometry() {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    const r = i % 2 === 0 ? 1 : 0.45;
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.35, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.08, bevelSegments: 4 });
  g.center();
  return g;
}

// 떠다니기: 물건마다 속도 · 폭 · 위상을 다르게 줍니다 (Spring/Summer 404 참고)
function Floating({ children, position, speed, amp, spin, phase = 0 }: { children: ReactNode; position: [number, number, number]; speed: number; amp: number; spin: number; phase?: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    const t = clock.elapsedTime * speed + phase;
    g.position.y = position[1] + Math.sin(t) * amp;
    g.position.x = position[0] + Math.cos(t * 0.7) * amp * 0.4;
    g.rotation.z = Math.sin(t * 0.8) * 0.25;
    g.rotation.y += spin * 0.01;
  });
  return (
    <group ref={ref} position={position}>
      {children}
    </group>
  );
}

function Snowman({ greeted }: { greeted: boolean }) {
  const root = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);
  const hop = useRef(0);
  const lastGreeted = useRef(greeted);

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime;
    if (lastGreeted.current !== greeted) {
      lastGreeted.current = greeted;
      hop.current = 1; // 인사할 때마다 한 번 뛰어오름
    }
    hop.current = Math.max(0, hop.current - delta * 1.6);
    const g = root.current;
    if (g) {
      g.position.y = Math.sin(t * 0.9) * 0.12 + Math.sin(hop.current * Math.PI) * 0.35;
      g.rotation.z = -0.21 + Math.sin(t * 0.6) * 0.05; // -12° 기울어져 둥둥
      g.rotation.y = Math.sin(t * 0.4) * 0.25 + (greeted ? 0.25 : 0);
    }
    const arm = rightArm.current;
    if (arm) {
      const target = greeted ? 1.9 + Math.sin(t * 9) * 0.35 : 0.7; // 들어서 흔들기 / 내리기
      arm.rotation.z = THREE.MathUtils.lerp(arm.rotation.z, target, 1 - Math.exp(-delta * 8));
    }
  });

  return (
    <group ref={root}>
      {/* 몸 · 머리 */}
      <mesh position={[0, -0.65, 0]} scale={[1, 1.1, 1]}>
        <sphereGeometry args={[0.95, 40, 32]} />
        {clay(C.body)}
      </mesh>
      <mesh position={[0, 0.62, 0]}>
        <sphereGeometry args={[0.62, 40, 32]} />
        {clay(C.head)}
      </mesh>

      {/* 모자 */}
      <mesh position={[0, 0.98, 0]}>
        <sphereGeometry args={[0.55, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        {clay(C.hat)}
      </mesh>
      <mesh position={[0, 0.98, 0]}>
        <torusGeometry args={[0.56, 0.1, 16, 40]} />
        {clay(C.hatBand)}
      </mesh>
      <mesh position={[0, 1.6, 0]}>
        <sphereGeometry args={[0.15, 20, 16]} />
        {clay(C.pom)}
      </mesh>

      {/* 얼굴 */}
      <mesh position={[-0.2, 0.68, 0.55]}>
        <sphereGeometry args={[0.055, 16, 12]} />
        {clay(C.eye)}
      </mesh>
      <mesh position={[0.2, 0.68, 0.55]}>
        <sphereGeometry args={[0.055, 16, 12]} />
        {clay(C.eye)}
      </mesh>
      <mesh position={[0.05, 0.55, 0.68]} rotation={[Math.PI / 2, 0, 0.15]}>
        <coneGeometry args={[0.08, 0.45, 16]} />
        {clay(C.carrot)}
      </mesh>

      {/* 목도리 */}
      <mesh position={[0, 0.12, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.6, 0.13, 16, 40]} />
        {clay(C.scarf)}
      </mesh>
      <mesh position={[0.35, -0.25, 0.55]} rotation={[0.2, 0, -0.2]}>
        <boxGeometry args={[0.22, 0.6, 0.1]} />
        {clay(C.scarfTail)}
      </mesh>

      {/* 단추 */}
      {[-0.35, -0.75].map((y) => (
        <mesh key={y} position={[0, y, 0.93]}>
          <sphereGeometry args={[0.07, 16, 12]} />
          {clay(C.button)}
        </mesh>
      ))}

      {/* 팔: 왼팔은 고정, 오른팔은 인사 */}
      <group position={[-0.85, -0.35, 0]} rotation={[0, 0, -0.7]}>
        <mesh position={[-0.45, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.05, 0.05, 0.9, 10]} />
          {clay(C.arm)}
        </mesh>
      </group>
      <group ref={rightArm} position={[0.85, -0.35, 0]} rotation={[0, 0, 0.7]}>
        <mesh position={[0.45, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.05, 0.05, 0.9, 10]} />
          {clay(C.arm)}
        </mesh>
        <mesh position={[0.85, 0.12, 0]} rotation={[0, 0, 0.8]}>
          <cylinderGeometry args={[0.035, 0.035, 0.3, 8]} />
          {clay(C.arm)}
        </mesh>
      </group>
    </group>
  );
}

function Props3D() {
  const star = useMemo(() => starGeometry(), []);
  return (
    <>
      <Floating position={[-2.1, 1.7, -0.5]} speed={0.9} amp={0.18} spin={0.6}>
        <mesh geometry={star} scale={0.42}>
          <meshStandardMaterial color={C.star} roughness={0.45} metalness={0.2} />
        </mesh>
      </Floating>
      <Floating position={[2.15, 0.95, -0.3]} speed={0.65} amp={0.24} spin={0.3} phase={1.3}>
        <mesh>
          <sphereGeometry args={[0.36, 32, 24]} />
          <meshStandardMaterial color={C.ornament} roughness={0.35} metalness={0.15} />
        </mesh>
        <mesh position={[0, 0.4, 0]}>
          <cylinderGeometry args={[0.09, 0.09, 0.12, 16]} />
          {clay(C.cap)}
        </mesh>
      </Floating>
      <Floating position={[2.0, -1.55, 0.2]} speed={0.5} amp={0.2} spin={0} phase={2.4}>
        <group rotation={[0.2, -0.3, 0.33]}>
          <mesh>
            <boxGeometry args={[0.95, 0.65, 0.05]} />
            {clay(C.letter)}
          </mesh>
          <mesh position={[-0.22, 0.1, 0.03]} rotation={[0, 0, -0.62]}>
            <boxGeometry args={[0.55, 0.03, 0.01]} />
            {clay(C.letterLine)}
          </mesh>
          <mesh position={[0.22, 0.1, 0.03]} rotation={[0, 0, 0.62]}>
            <boxGeometry args={[0.55, 0.03, 0.01]} />
            {clay(C.letterLine)}
          </mesh>
        </group>
      </Floating>
      <Floating position={[-2.0, -1.3, 0]} speed={1.15} amp={0.14} spin={0.5} phase={0.7}>
        <mesh>
          <sphereGeometry args={[0.26, 28, 20]} />
          {clay(C.ball)}
        </mesh>
      </Floating>
    </>
  );
}

function supportsWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

export default function LostSnowmanScene({ animate, greeted, fallback }: Props) {
  const [webgl] = useState(supportsWebGL); // 이 파일은 브라우저에서만 불러옵니다(ssr: false)
  if (!webgl) return <>{fallback}</>;

  return (
    <Canvas
      camera={{ position: [0, 0, 8], fov: 38 }}
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true }}
      frameloop={animate ? "always" : "demand"}
      style={{ width: "100%", height: "100%" }}
    >
      <ambientLight intensity={1.2} />
      <directionalLight position={[-3, 5, 6]} intensity={2.2} />
      <directionalLight position={[4, -2, 3]} intensity={0.6} color="#8FB8E8" />
      <Snowman greeted={greeted} />
      <Props3D />
    </Canvas>
  );
}
