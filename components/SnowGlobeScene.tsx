"use client";

// 스노우볼 3D 장면입니다. 모델은 Blender 에서 만들어 public/models 에 내보낸 파일을 씁니다.
// 드래그로 돌려 보기, 흔들면 눈 내리기, 오너먼트 누르면 메시지 보기.

import { Environment, Lightformer, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Ornament } from "@/lib/api";
import { GLASS } from "@/lib/snowglobe";
import SnowGlobeAtmosphere, { GlowDust, createDotTexture } from "./SnowGlobeAtmosphere";
import { GlobeModel, Ornaments } from "./snowglobe/SnowGlobeGlb";

const SNOW_COUNT = 600;
const SNOW_RADIUS = GLASS.radius - 0.05;
const [CENTER_X, CENTER_Y, CENTER_Z] = GLASS.center;

// 눈 바닥의 높이(가운데가 볼록). Blender 의 눈 바닥 모양과 맞춘 근삿값입니다.
function floorHeight(x: number, z: number) {
  const dist = Math.hypot(x, z);
  const edge = Math.min(1, Math.max(0, (dist - 0.6) / 0.28));
  return 0.106 + 0.066 * Math.max(0, 1 - (dist / 0.9) ** 2) - 0.05 * edge * edge;
}

// 처음에는 눈이 바닥에 쌓여 있습니다.
function createSnow() {
  const positions = new Float32Array(SNOW_COUNT * 3);
  for (let i = 0; i < SNOW_COUNT; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.sqrt(Math.random()) * 0.74;
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;
    positions[i * 3] = x;
    positions[i * 3 + 1] = floorHeight(x, z);
    positions[i * 3 + 2] = z;
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
        vel[y] += Math.random() * kick * dt * 18;
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
      const dx = pos[x] - CENTER_X;
      const dy = pos[y] - CENTER_Y;
      const dz = pos[z] - CENTER_Z;
      const length = Math.hypot(dx, dy, dz);
      if (length > SNOW_RADIUS) {
        const scale = SNOW_RADIUS / length;
        pos[x] = CENTER_X + dx * scale;
        pos[y] = CENTER_Y + dy * scale;
        pos[z] = CENTER_Z + dz * scale;
        vel[x] *= -0.2;
        vel[y] *= -0.2;
        vel[z] *= -0.2;
      }
      // 바닥에 쌓이기
      const floor = floorHeight(pos[x], pos[z]);
      if (pos[y] < floor) {
        pos[y] = floor;
        vel[x] = 0;
        vel[y] = 0;
        vel[z] = 0;
      }
    }
    energy.current = kick * Math.exp(-dt * 2.5);
    attribute.needsUpdate = true;
  });

  // 눈 입자는 네모가 아니라 동그랗게
  const dot = useMemo(() => createDotTexture(), []);

  return (
    <points>
      <bufferGeometry ref={geometry} />
      <pointsMaterial color="#ffffff" map={dot} size={0.036} sizeAttenuation transparent opacity={0.95} depthWrite={false} />
    </points>
  );
}

// 화면 비율이 바뀌어도 스노우볼 전체가 보이도록 카메라 거리를 맞춥니다.
const VIEW_TARGET = new THREE.Vector3(0, 0.45, 0);
function FitCamera() {
  const camera = useThree((state) => state.camera);
  const aspect = useThree((state) => state.size.width / state.size.height);

  useEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;
    // 세로: 높이의 절반 + 앞으로 튀어나온 받침대만큼 여유 / 가로: 받침대 둘레가 다 들어오게
    const halfV = THREE.MathUtils.degToRad(camera.fov) / 2;
    const halfH = Math.atan(Math.tan(halfV) * aspect);
    // 가장자리는 배경이 흐려지며 사라지는 구간이라 그만큼 여유를 더 둡니다.
    const distance = Math.max(1.16 / Math.tan(halfV) + 1.1, 1.28 / Math.sin(halfH)) * 1.1;
    const offset = camera.position.clone().sub(VIEW_TARGET).setLength(distance);
    camera.position.copy(VIEW_TARGET).add(offset);
    camera.updateProjectionMatrix();
  }, [camera, aspect]);

  return null;
}

type SceneProps = {
  // 받침대 명패에 적을 스노우볼 이름
  title?: string;
  ornaments: Ornament[];
  shakeSignal: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
};

// 장면 가장자리가 페이지 배경으로 자연스럽게 사라지게 합니다.
const EDGE_FADE =
  "linear-gradient(to right, transparent, rgba(0,0,0,0.75) 5%, #000 11%, #000 89%, rgba(0,0,0,0.75) 95%, transparent), linear-gradient(to bottom, transparent, rgba(0,0,0,0.75) 4%, #000 9%, #000 91%, rgba(0,0,0,0.75) 96%, transparent)";

export default function SnowGlobeScene({ title = "", ornaments, shakeSignal, selectedId, onSelect }: SceneProps) {
  // 움직임 줄이기를 켠 기기에서는 반짝임을 멈춥니다.
  const reducedMotion = useMemo(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);

  return (
    <Canvas
      camera={{ position: [0, 1.15, 6.2], fov: 32 }}
      dpr={[1, 2]}
      style={{ maskImage: EDGE_FADE, WebkitMaskImage: EDGE_FADE, maskComposite: "intersect", WebkitMaskComposite: "source-in" }}
    >
      <FitCamera />

      {/* 겨울밤: 푸른 달빛 + 따뜻한 불빛 */}
      <ambientLight intensity={0.55} color="#5a6aa8" />
      <directionalLight position={[3, 5, -2]} intensity={1.1} color="#a9c2ff" />
      <directionalLight position={[-2.5, 2.5, 4]} intensity={1.5} color="#ffd7a3" />
      <pointLight position={[0.25, 0.42, 0.75]} intensity={0.55} distance={2.4} color="#ffb265" />
      <pointLight position={[0, 1.44, 0.22]} intensity={0.3} distance={1.3} color="#ffc777" />

      {/* 금색과 유약에 비치는 주변 빛. 외부 이미지를 받지 않고 장면 안에서 만듭니다. */}
      <Environment resolution={256} environmentIntensity={0.7}>
        <mesh scale={30}>
          <sphereGeometry args={[1, 16, 16]} />
          <meshBasicMaterial color="#1b2444" side={THREE.BackSide} />
        </mesh>
        <Lightformer form="rect" intensity={1.4} color="#b8ccff" position={[0, 7, 0]} scale={[7, 7, 1]} />
        <Lightformer form="rect" intensity={2.6} color="#ffd9a8" position={[-6, 2, 3]} scale={[1.4, 7, 1]} />
        <Lightformer form="rect" intensity={1.8} color="#ffc98a" position={[6, 1.5, 2]} scale={[1, 4, 1]} />
        <Lightformer form="ring" intensity={1.5} color="#ffe6c4" position={[0, 2, 7]} scale={2.5} />
      </Environment>

      <SnowGlobeAtmosphere />

      <Suspense fallback={null}>
        <GlobeModel title={title} />
        <Ornaments ornaments={ornaments} selectedId={selectedId} onSelect={onSelect} />
      </Suspense>

      {/* 유리 안에서 은은하게 깜빡이는 여러 색의 작은 빛 */}
      <GlowDust still={reducedMotion} />
      <Snow shakeSignal={shakeSignal} />

      <OrbitControls target={[VIEW_TARGET.x, VIEW_TARGET.y, VIEW_TARGET.z]} enablePan={false} enableZoom={false} minPolarAngle={0.9} maxPolarAngle={1.75} />

      {/* 밝은 불빛만 번지게 하고, 마지막에 화면 색으로 맞춥니다. */}
      <EffectComposer multisampling={4}>
        <Bloom mipmapBlur luminanceThreshold={0.8} luminanceSmoothing={0.25} intensity={0.75} radius={0.85} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      </EffectComposer>
    </Canvas>
  );
}
