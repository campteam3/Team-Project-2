"use client";

// 스노우볼 3D 장면입니다. 모델은 Blender 에서 만들어 public/models 에 내보낸 파일을 씁니다.
// 드래그로 돌려 보기, 흔들면 눈 내리기, 오너먼트 누르면 메시지 보기.

import { Environment, Lightformer, OrbitControls, useGLTF } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { GLASS, placeOrnaments, type GlobeOrnament, type OrnamentShape, type PlacedOrnament } from "@/lib/snowglobe";

const MODEL_URL = "/models/snowglobe.glb";
const ORNAMENT_URL = "/models/ornaments.glb";
const TEMPLATE_NAMES: Record<OrnamentShape, string> = { ball: "t_Orn_Ball", star: "t_Orn_Star", heart: "t_Orn_Heart" };

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

  return (
    <points>
      <bufferGeometry ref={geometry} />
      <pointsMaterial color="#ffffff" size={0.028} sizeAttenuation transparent opacity={0.95} depthWrite={false} />
    </points>
  );
}

// 유리: 가운데는 맑고 가장자리로 갈수록 밝아지며, 반사광 두 줄이 맺힙니다. 가볍게 그리려고 직접 계산합니다.
function createGlassMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vView = normalize(-viewPosition.xyz);
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vec3 n = normalize(vNormal);
        vec3 v = normalize(vView);
        float rim = pow(1.0 - max(dot(n, v), 0.0), 3.0);
        float key = pow(max(dot(n, normalize(normalize(vec3(-0.55, 0.65, 0.6)) + v)), 0.0), 220.0);
        float fill = pow(max(dot(n, normalize(normalize(vec3(0.6, 0.35, 0.7)) + v)), 0.0), 320.0) * 0.6;
        float sheen = pow(max(dot(n, normalize(normalize(vec3(-0.5, 0.7, 0.5)) + v)), 0.0), 14.0) * 0.1;
        float highlight = key + fill;
        vec3 color = mix(vec3(0.78, 0.88, 1.0), vec3(1.0), clamp(highlight + rim * 0.4, 0.0, 1.0));
        float alpha = clamp(0.025 + rim * 0.5 + sheen + highlight, 0.0, 1.0);
        gl_FragColor = vec4(color, alpha);
        #include <colorspace_fragment>
      }
    `,
  });
}

const TREE_MATERIAL = "W_Ceramic_Green";

// 스노우볼 본체. 유리와 트리 색만 웹에 맞게 바꿉니다.
function GlobeModel() {
  const { scene } = useGLTF(MODEL_URL);

  const model = useMemo(() => {
    const copy = scene.clone(true);
    const glass = createGlassMaterial();
    let tree: THREE.MeshStandardMaterial | null = null;
    copy.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (mesh.name.startsWith("w_Glass_Dome")) {
        mesh.material = glass;
        mesh.renderOrder = 10;
        return;
      }
      const material = mesh.material as THREE.MeshStandardMaterial;
      if (!Array.isArray(material) && material.name === TREE_MATERIAL) {
        // Blender 에서는 그늘 색이 섞여 진하게 보이던 초록을 웹에서도 비슷하게
        tree ??= Object.assign(material.clone(), { roughness: 0.42 });
        tree.color.set("#1f7a36");
        mesh.material = tree;
      }
    });
    return copy;
  }, [scene]);

  return <primitive object={model} />;
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
    const distance = Math.max(1.16 / Math.tan(halfV) + 1.1, 1.28 / Math.sin(halfH));
    const offset = camera.position.clone().sub(VIEW_TARGET).setLength(distance);
    camera.position.copy(VIEW_TARGET).add(offset);
    camera.updateProjectionMatrix();
  }, [camera, aspect]);

  return null;
}

type TemplatePart = { geometry: THREE.BufferGeometry; role: "main" | "accent" | "metal"; material: THREE.MeshStandardMaterial };

// 오너먼트 원형(볼·별·하트)을 부분별로 꺼냅니다. 본체 색과 무늬 색은 오너먼트마다 바꿉니다.
function useOrnamentTemplates() {
  const { scene } = useGLTF(ORNAMENT_URL);
  return useMemo(() => {
    const templates: Record<OrnamentShape, TemplatePart[]> = { ball: [], star: [], heart: [] };
    for (const shape of Object.keys(TEMPLATE_NAMES) as OrnamentShape[]) {
      scene.getObjectByName(TEMPLATE_NAMES[shape])?.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh) return;
        const material = mesh.material as THREE.MeshStandardMaterial;
        const role = material.name.startsWith("Orn_Main") ? "main" : material.name.startsWith("Orn_Accent") ? "accent" : "metal";
        templates[shape].push({ geometry: mesh.geometry, role, material });
      });
    }
    return templates;
  }, [scene]);
}

const CREAM = "#efe6d0";
const DARK_RED = "#8a1420";

function OrnamentItem({
  placed,
  parts,
  selected,
  onSelect,
}: {
  placed: PlacedOrnament;
  parts: TemplatePart[];
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const { slot, shape, color, metallic, ornament } = placed;

  const materials = useMemo(() => {
    const mainBase = parts.find((part) => part.role === "main")?.material;
    const accentBase = parts.find((part) => part.role === "accent")?.material;
    const main = mainBase?.clone();
    if (main) {
      main.color.set(color);
      if (metallic) {
        main.metalness = 1;
        main.roughness = 0.2;
      }
    }
    const accent = accentBase?.clone();
    if (accent) {
      // 무늬는 본체 색과 구분되게: 밝은 본체에는 짙은 빨강, 어두운 본체에는 크림색
      const hsl = { h: 0, s: 0, l: 0 };
      new THREE.Color(color).getHSL(hsl);
      accent.color.set(hsl.l > 0.6 ? DARK_RED : CREAM);
    }
    return { main, accent };
  }, [parts, color, metallic]);

  useEffect(
    () => () => {
      materials.main?.dispose();
      materials.accent?.dispose();
    },
    [materials],
  );

  const baseScale = shape === "ball" ? (slot.ballScale ?? slot.cookieScale) : slot.cookieScale;

  return (
    <group
      position={slot.position}
      quaternion={slot.quaternion}
      scale={baseScale * (selected ? 1.35 : 1)}
      onClick={
        ornament
          ? (event) => {
              event.stopPropagation();
              onSelect(ornament.id);
            }
          : undefined
      }
    >
      {parts.map((part, index) => (
        <mesh
          key={index}
          geometry={part.geometry}
          material={
            part.role === "main" ? (materials.main ?? part.material) : part.role === "accent" ? (materials.accent ?? part.material) : part.material
          }
        />
      ))}
    </group>
  );
}

function Ornaments({
  ornaments,
  selectedId,
  onSelect,
}: {
  ornaments: GlobeOrnament[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const templates = useOrnamentTemplates();
  const placed = useMemo(() => placeOrnaments(ornaments), [ornaments]);

  return (
    <>
      {placed.map((item) => (
        <OrnamentItem
          key={item.key}
          placed={item}
          parts={templates[item.shape]}
          selected={item.ornament !== null && item.ornament.id === selectedId}
          onSelect={onSelect}
        />
      ))}
    </>
  );
}

type SceneProps = {
  ornaments: GlobeOrnament[];
  shakeSignal: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export default function SnowGlobeScene({ ornaments, shakeSignal, selectedId, onSelect }: SceneProps) {
  return (
    <Canvas camera={{ position: [0, 1.15, 6.2], fov: 32 }} dpr={[1, 2]}>
      <FitCamera />
      <ambientLight intensity={0.45} />
      <directionalLight position={[-2.5, 4, 3.5]} intensity={1.7} />
      <directionalLight position={[3, 2, 2]} intensity={0.5} color="#cfe0ff" />

      {/* 금색에 비치는 주변 빛. 외부 이미지를 받지 않고 장면 안에서 만듭니다. */}
      <Environment resolution={256} environmentIntensity={0.75}>
        <mesh scale={30}>
          <sphereGeometry args={[1, 16, 16]} />
          <meshBasicMaterial color="#2a3352" side={THREE.BackSide} />
        </mesh>
        <Lightformer form="rect" intensity={2.2} position={[0, 7, 0]} scale={[7, 7, 1]} />
        <Lightformer form="rect" intensity={2.6} color="#ffe2b8" position={[-6, 2, 3]} scale={[1.4, 7, 1]} />
        <Lightformer form="rect" intensity={2} color="#cfe0ff" position={[6, 1.5, 2]} scale={[1.2, 6, 1]} />
        <Lightformer form="ring" intensity={2} position={[0, 2, 7]} scale={2.5} />
      </Environment>

      <Suspense fallback={null}>
        <GlobeModel />
        <Ornaments ornaments={ornaments} selectedId={selectedId} onSelect={onSelect} />
      </Suspense>

      <Snow shakeSignal={shakeSignal} />

      <OrbitControls target={[VIEW_TARGET.x, VIEW_TARGET.y, VIEW_TARGET.z]} enablePan={false} enableZoom={false} minPolarAngle={0.9} maxPolarAngle={1.75} />
    </Canvas>
  );
}

useGLTF.preload(MODEL_URL);
useGLTF.preload(ORNAMENT_URL);
