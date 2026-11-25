"use client";

// 3D 가 되는지 확인하기 위한 실험 장면입니다. 디자인이 정해지면 자유롭게 바꾸거나 새로 만드세요.
// 확인한 것: 드래그로 돌려 보기, 흔들면 눈 내리기, 오너먼트 누르기.

import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { Ornament } from "@/lib/sample-data";

const SNOW_COUNT = 500;
const GLOBE_RADIUS = 0.94;
const FLOOR_Y = -0.56;

// 처음에는 눈이 바닥에 쌓여 있습니다.
function createSnow() {
  const positions = new Float32Array(SNOW_COUNT * 3);
  for (let i = 0; i < SNOW_COUNT; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.sqrt(Math.random()) * 0.72;
    positions[i * 3] = Math.cos(angle) * dist;
    positions[i * 3 + 1] = FLOOR_Y;
    positions[i * 3 + 2] = Math.sin(angle) * dist;
  }
  return { positions, velocities: new Float32Array(SNOW_COUNT * 3) };
}

function Snow({ shakeSignal }: { shakeSignal: number }) {
  const geometry = useRef<THREE.BufferGeometry>(null);
  const velocities = useRef<Float32Array | null>(null);
  const energy = useRef(0);

  useEffect(() => {
    const snow = createSnow();
    geometry.current?.setAttribute("position", new THREE.BufferAttribute(snow.positions, 3));
    velocities.current = snow.velocities;
  }, []);

  // 흔들 때마다 눈을 위로 날립니다.
  useEffect(() => {
    if (shakeSignal > 0) energy.current = 1;
  }, [shakeSignal]);

  useFrame((_, delta) => {
    const attribute = geometry.current?.getAttribute("position") as THREE.BufferAttribute | undefined;
    const vel = velocities.current;
    if (!attribute || !vel) return;
    const pos = attribute.array as Float32Array;
    const dt = Math.min(delta, 0.05);
    const kick = energy.current;

    for (let i = 0; i < SNOW_COUNT; i++) {
      const x = i * 3;
      const y = x + 1;
      const z = x + 2;

      if (kick > 0.05) {
        vel[x] += (Math.random() - 0.5) * kick * dt * 14;
        vel[y] += Math.random() * kick * dt * 16;
        vel[z] += (Math.random() - 0.5) * kick * dt * 14;
      }
      vel[y] -= 0.9 * dt; // 중력
      vel[x] *= 0.985;
      vel[y] *= 0.985;
      vel[z] *= 0.985;

      pos[x] += vel[x] * dt;
      pos[y] += vel[y] * dt;
      pos[z] += vel[z] * dt;

      // 유리 구슬 밖으로 나가지 않게
      const length = Math.hypot(pos[x], pos[y], pos[z]);
      if (length > GLOBE_RADIUS) {
        const scale = GLOBE_RADIUS / length;
        pos[x] *= scale;
        pos[y] *= scale;
        pos[z] *= scale;
        vel[x] *= -0.2;
        vel[y] *= -0.2;
        vel[z] *= -0.2;
      }
      // 바닥에 쌓이기
      if (pos[y] < FLOOR_Y) {
        pos[y] = FLOOR_Y;
        vel[x] = 0;
        vel[y] = 0;
        vel[z] = 0;
      }
    }
    energy.current = kick * Math.exp(-dt * 2.5);
    attribute.needsUpdate = true;
  });

  return (
    <points>
      <bufferGeometry ref={geometry} />
      <pointsMaterial color="#ffffff" size={0.025} sizeAttenuation transparent opacity={0.95} />
    </points>
  );
}

// 오너먼트를 트리 표면에 나선으로 배치합니다.
function ornamentPosition(index: number, total: number): [number, number, number] {
  const height = total > 1 ? 0.12 + (index / (total - 1)) * 0.7 : 0.4;
  const radius = 0.4 * (1 - height) + 0.05;
  const angle = index * 2.4;
  return [Math.cos(angle) * radius, -0.5 + height * 0.95, Math.sin(angle) * radius];
}

type SceneProps = {
  ornaments: Ornament[];
  shakeSignal: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export default function SnowGlobeScene({ ornaments, shakeSignal, selectedId, onSelect }: SceneProps) {
  return (
    <Canvas camera={{ position: [0, 0.35, 3.6], fov: 40 }} dpr={[1, 2]}>
      <ambientLight intensity={0.9} />
      <directionalLight position={[2, 3, 2]} intensity={1.4} />

      {/* 받침대 */}
      <mesh position={[0, -1.0, 0]}>
        <cylinderGeometry args={[0.78, 0.9, 0.36, 48]} />
        <meshStandardMaterial color="#7a4b2a" roughness={0.6} />
      </mesh>

      {/* 눈 바닥 */}
      <mesh position={[0, FLOOR_Y - 0.03, 0]}>
        <cylinderGeometry args={[0.78, 0.74, 0.06, 48]} />
        <meshStandardMaterial color="#f4f8ff" roughness={1} />
      </mesh>

      {/* 트리 */}
      <mesh position={[0, -0.02, 0]}>
        <coneGeometry args={[0.42, 1.0, 32]} />
        <meshStandardMaterial color="#2f7d4f" roughness={0.8} />
      </mesh>

      {ornaments.map((ornament, index) => (
        <mesh
          key={ornament.id}
          position={ornamentPosition(index, ornaments.length)}
          scale={selectedId === ornament.id ? 1.5 : 1}
          onClick={(event) => {
            event.stopPropagation();
            onSelect(ornament.id);
          }}
        >
          <sphereGeometry args={[0.065, 24, 24]} />
          <meshStandardMaterial color={ornament.color} metalness={0.4} roughness={0.25} />
        </mesh>
      ))}

      <Snow shakeSignal={shakeSignal} />

      {/* 유리 구슬 */}
      <mesh>
        <sphereGeometry args={[1, 64, 64]} />
        <meshStandardMaterial color="#cfe8ff" transparent opacity={0.16} roughness={0.05} depthWrite={false} />
      </mesh>

      <OrbitControls enablePan={false} enableZoom={false} minPolarAngle={0.9} maxPolarAngle={1.9} />
    </Canvas>
  );
}
