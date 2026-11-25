"use client";

// 스노우볼 뒤 "눈 쌓인 마을" 3D 자리(임시).
// ─────────────────────────────────────────────────────────────
// 키비주얼이 정해지면 이 파일만 바꿉니다. GLB 로 만들면
// public/models/village.glb 를 useGLTF 로 불러와 아래 <group> 자리에 넣으면 됩니다.
// 마을은 스노우볼과 따로 움직이지 않는 장식입니다(쌓일수록 변하는 마을은 범위 밖).
// 로딩 시간이 늘지 않도록 집 · 나무는 단순한 도형 몇 개로만 만듭니다.
// ─────────────────────────────────────────────────────────────

import { useMemo } from "react";
import * as THREE from "three";

const HOUSES: [x: number, z: number, w: number, h: number, rot: number][] = [
  [-7.4, -7.0, 0.9, 0.7, 0.3],
  [-5.8, -8.6, 0.7, 0.55, -0.2],
  [-4.4, -6.6, 1.0, 0.75, 0.15],
  [-9.2, -9.0, 0.8, 0.6, 0],
  [4.5, -6.8, 0.95, 0.72, -0.25],
  [6.0, -8.4, 0.75, 0.58, 0.2],
  [7.6, -7.0, 1.05, 0.8, -0.1],
  [9.4, -8.8, 0.8, 0.6, 0.1],
];
const PINES: [x: number, z: number, s: number][] = [
  [-10.2, -7.4, 1.1],
  [-3.4, -8.8, 0.8],
  [-6.6, -10.4, 1.2],
  [3.4, -8.6, 0.9],
  [8.8, -10.6, 1.3],
  [11.0, -7.2, 1.0],
];
const GROUND_Y = -2.1;

function Stars() {
  const geometry = useMemo(() => {
    const count = 260;
    const pos = new Float32Array(count * 3);
    let seed = 7;
    const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (rnd() - 0.5) * 60;
      pos[i * 3 + 1] = rnd() * 22 - 2;
      pos[i * 3 + 2] = -22;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);
  return (
    <points geometry={geometry}>
      <pointsMaterial color="#F5F1EA" size={0.07} sizeAttenuation transparent opacity={0.7} depthWrite={false} />
    </points>
  );
}

function House({ x, z, w, h, rot }: { x: number; z: number; w: number; h: number; rot: number }) {
  return (
    <group position={[x, GROUND_Y + h / 2, z]} rotation={[0, rot, 0]}>
      <mesh>
        <boxGeometry args={[w, h, w * 0.8]} />
        <meshStandardMaterial color="#141c38" roughness={1} />
      </mesh>
      {/* 눈 덮인 지붕 */}
      <mesh position={[0, h / 2 + h * 0.28, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[w * 0.82, h * 0.56, 4]} />
        <meshStandardMaterial color="#c9d3e8" roughness={1} />
      </mesh>
      {/* 불 켜진 창 */}
      {[-0.22, 0.22].map((dx) => (
        <mesh key={dx} position={[dx * w, 0.02, w * 0.4 + 0.005]}>
          <planeGeometry args={[w * 0.18, h * 0.26]} />
          <meshBasicMaterial color="#F2C46D" toneMapped={false} />
        </mesh>
      ))}
      <pointLight position={[0, 0, w * 0.6]} color="#F2C46D" intensity={0.6} distance={2.2} />
    </group>
  );
}

export default function VillageBackdrop() {
  return (
    <group name="Village">
      <Stars />
      {/* 먼 언덕과 가까운 눈밭 */}
      <mesh position={[0, GROUND_Y - 0.02, -10]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[80, 24]} />
        <meshStandardMaterial color="#1c2546" roughness={1} />
      </mesh>
      {/* 가까운 눈 언덕: 넓고 낮게 깔아 화면 아래를 부드럽게 채웁니다 */}
      <mesh position={[0, GROUND_Y - 6.9, -4]} scale={[26, 6.6, 6]}>
        <sphereGeometry args={[1, 64, 32]} />
        <meshStandardMaterial color="#2a3560" roughness={1} />
      </mesh>
      {HOUSES.map(([x, z, w, h, rot]) => (
        <House key={`${x}${z}`} x={x} z={z} w={w} h={h} rot={rot} />
      ))}
      {PINES.map(([x, z, s]) => (
        <mesh key={`${x}${z}`} position={[x, GROUND_Y + 0.6 * s, z]}>
          <coneGeometry args={[0.38 * s, 1.2 * s, 7]} />
          <meshStandardMaterial color="#0f1730" roughness={1} />
        </mesh>
      ))}
    </group>
  );
}
