"use client";

// 스노우볼 3D 자리(임시 모델).
// ─────────────────────────────────────────────────────────────
// 이민정 님의 3D 스노우볼(GLB)이 나오면 이 파일만 바꿉니다.
//   1) 파일을 public/models/snowglobe.glb 에 둡니다.
//   2) 아래 Placeholder 대신 drei 의 useGLTF("/models/snowglobe.glb") 로 장면을 불러옵니다.
//   3) 꾸미기 색은 GLB 안의 이름이 Tree / Prop_star / Prop_gift / Prop_snowman / Base 인
//      메시의 material.color 를 theme 값으로 바꿔 줍니다.
//   4) 크기와 기준점은 아래 MODEL 값과 맞춰 주세요. 바깥(StageScene)은 이 값으로
//      화면 크기와 위치를 계산하고, 명판 입력칸을 NAMEPLATE 위치에 붙입니다.
// ─────────────────────────────────────────────────────────────

import { useFrame, type ThreeElements } from "@react-three/fiber";
import * as THREE from "three";
import { useMemo, useRef } from "react";
import type { Ornament } from "@/lib/api";
import { themeColor, type GlobeTheme } from "@/lib/theme";

export const MODEL = {
  top: 1.02, // 유리 구 맨 위
  bottom: -1.16, // 받침대 맨 아래
  glassRadius: 1,
  floorY: -0.56, // 구 안 눈 바닥
};

// 받침대 앞면 명판의 가운데 (이름 · 닉네임 입력칸이 붙는 곳)
export const NAMEPLATE: [number, number, number] = [0, -0.95, 0.86];
export const NAMEPLATE_WIDTH = 0.56; // 명판 가로 길이 (글자가 이보다 길면 "…"으로 자릅니다)

// 오너먼트를 트리 표면에 나선으로 배치합니다.
// 위치는 "몇 번째로 달렸는지"만으로 정해집니다. 새 오너먼트가 달려도 기존 오너먼트는 움직이지 않습니다.
export function ornamentPosition(index: number): [number, number, number] {
  const f = (index * 0.61803398875 + 0.21) % 1; // 고르게 흩어지는 수열
  const height = 0.06 + 0.8 * (1 - Math.sqrt(1 - f)); // 넓은 아래쪽에 더 많이
  const radius = 0.42 * (1 - height) + 0.04;
  const angle = index * 2.39996; // 황금각
  return [Math.cos(angle) * radius, -0.48 + height * 0.95, Math.sin(angle) * radius];
}

// 새 오너먼트가 달리는 움직임이 시작되는 곳 (구 위쪽 가운데)
const DROP_FROM: [number, number, number] = [0, 0.86, 0];
const DROP_SECONDS = 1.6;

function OrnamentBall({
  index,
  color,
  highlight,
  arriving,
  reducedMotion,
}: {
  index: number;
  color: string;
  highlight: boolean;
  arriving: boolean;
  reducedMotion: boolean;
}) {
  const ref = useRef<THREE.Group>(null);
  const start = useRef<number | null>(null);
  const target = ornamentPosition(index);

  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    if (arriving && !reducedMotion) {
      start.current ??= clock.elapsedTime;
      const t = Math.min(1, (clock.elapsedTime - start.current) / DROP_SECONDS);
      const e = 1 - Math.pow(1 - t, 3); // 천천히 멈춤
      g.position.set(
        THREE.MathUtils.lerp(DROP_FROM[0], target[0], e),
        THREE.MathUtils.lerp(DROP_FROM[1], target[1], e),
        THREE.MathUtils.lerp(DROP_FROM[2], target[2], e),
      );
    }
    const pulse = highlight && !reducedMotion ? 1 + Math.sin(clock.elapsedTime * 2.4) * 0.08 : 1;
    g.scale.setScalar((highlight ? 1.3 : 1) * pulse);
  });

  return (
    <group ref={ref} position={arriving && !reducedMotion ? DROP_FROM : target}>
      <mesh>
        <sphereGeometry args={[0.052, 24, 24]} />
        <meshStandardMaterial
          color={color}
          metalness={0.45}
          roughness={0.25}
          emissive={highlight ? color : "#000000"}
          emissiveIntensity={highlight ? 0.45 : 0}
        />
      </mesh>
      {highlight && (
        <mesh>
          <sphereGeometry args={[0.085, 24, 24]} />
          <meshBasicMaterial color="#F2C46D" transparent opacity={0.22} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

type Props = ThreeElements["group"] & {
  theme: GlobeTheme;
  ornaments?: Pick<Ornament, "id" | "color">[];
  highlightId?: string; // 빛나게 보여 줄 오너먼트 (친구가 고른 것)
  arrivingId?: string; // 지금 막 달리는 오너먼트
  reducedMotion?: boolean;
};

export default function SnowGlobeModel({ theme, ornaments = [], highlightId, arrivingId, reducedMotion = false, ...group }: Props) {
  const tree = themeColor(theme, "tree");
  const base = themeColor(theme, "base");
  const baseDark = useMemo(() => new THREE.Color(base).multiplyScalar(0.62), [base]);

  return (
    <group {...group}>
      {/* 받침대 */}
      <mesh name="Base" position={[0, -0.94, 0]}>
        <cylinderGeometry args={[0.78, 0.88, 0.44, 64]} />
        <meshStandardMaterial color={base} roughness={0.55} metalness={0.05} />
      </mesh>
      <mesh position={[0, -0.71, 0]}>
        <cylinderGeometry args={[0.8, 0.8, 0.04, 64]} />
        <meshStandardMaterial color={baseDark} roughness={0.5} />
      </mesh>
      {/* 명판(금빛 판). 글자는 바깥에서 HTML 로 붙입니다 */}
      <mesh name="Nameplate" position={[NAMEPLATE[0], NAMEPLATE[1], NAMEPLATE[2] - 0.02]} rotation={[-0.11, 0, 0]}>
        <boxGeometry args={[NAMEPLATE_WIDTH, 0.15, 0.03]} />
        <meshStandardMaterial color="#F2C46D" roughness={0.35} metalness={0.5} emissive="#F2C46D" emissiveIntensity={0.15} />
      </mesh>

      {/* 구 안 눈 바닥 */}
      <mesh position={[0, MODEL.floorY - 0.03, 0]}>
        <cylinderGeometry args={[0.8, 0.76, 0.08, 64]} />
        <meshStandardMaterial color="#E6ECF6" roughness={1} />
      </mesh>

      {/* 트리 */}
      <group name="Tree">
        <mesh position={[0, -0.5, 0]}>
          <cylinderGeometry args={[0.05, 0.06, 0.14, 12]} />
          <meshStandardMaterial color="#5A3A2A" roughness={0.9} />
        </mesh>
        {[
          [0.46, 0.56, -0.2],
          [0.36, 0.46, 0.09],
          [0.25, 0.38, 0.34],
        ].map(([r, h, y]) => (
          <mesh key={y} position={[0, y, 0]}>
            <coneGeometry args={[r, h, 40]} />
            <meshStandardMaterial color={tree} roughness={0.75} />
          </mesh>
        ))}
      </group>

      {/* 소품 */}
      {theme.prop === "star" && (
        <mesh name="Prop_star" position={[0, 0.6, 0]}>
          <octahedronGeometry args={[0.08, 0]} />
          <meshStandardMaterial color="#F2C46D" emissive="#F2C46D" emissiveIntensity={0.9} roughness={0.3} />
        </mesh>
      )}
      {theme.prop === "gift" && (
        <group name="Prop_gift" position={[0.36, -0.46, 0.3]} rotation={[0, 0.5, 0]}>
          <mesh>
            <boxGeometry args={[0.18, 0.16, 0.18]} />
            <meshStandardMaterial color="#C8363D" roughness={0.5} />
          </mesh>
          <mesh>
            <boxGeometry args={[0.19, 0.17, 0.04]} />
            <meshStandardMaterial color="#F2C46D" roughness={0.4} />
          </mesh>
        </group>
      )}
      {theme.prop === "snowman" && (
        <group name="Prop_snowman" position={[-0.38, -0.44, 0.28]}>
          <mesh>
            <sphereGeometry args={[0.1, 24, 24]} />
            <meshStandardMaterial color="#F5F1EA" roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.14, 0]}>
            <sphereGeometry args={[0.07, 24, 24]} />
            <meshStandardMaterial color="#F5F1EA" roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.14, 0.07]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.014, 0.06, 8]} />
            <meshStandardMaterial color="#E08A3C" />
          </mesh>
        </group>
      )}

      {/* 오너먼트 (친구 메시지 하나에 하나) */}
      {ornaments.map((o, i) => (
        <OrnamentBall
          key={o.id}
          index={i}
          color={o.color}
          highlight={o.id === highlightId}
          arriving={o.id === arrivingId}
          reducedMotion={reducedMotion}
        />
      ))}

      {/* 유리 구. 안쪽 면을 살짝 밝혀 테두리가 보이게 합니다 */}
      <mesh renderOrder={2}>
        <sphereGeometry args={[MODEL.glassRadius, 64, 64]} />
        <meshStandardMaterial color="#cfe0ff" transparent opacity={0.1} roughness={0.05} metalness={0.2} depthWrite={false} />
      </mesh>
      <mesh renderOrder={1}>
        <sphereGeometry args={[MODEL.glassRadius * 1.003, 64, 64]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.06} side={THREE.BackSide} depthWrite={false} />
      </mesh>
    </group>
  );
}
