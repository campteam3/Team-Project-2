"use client";

// 오너먼트 진열 장면 (친구 흐름 두 번째 버전, ?flow=2)
//   pick  : 스노우볼은 화면 아래로 내려가 있고, 커다란 오너먼트 6개가 떠 있습니다. 눌러서 고릅니다.
//   write : 고른 오너먼트만 작아지며 위로 올라가고, 나머지는 사라집니다.
//   attach: 아래에서 스노우볼이 올라오면, 오너먼트가 천천히 작아지며 트리의 제자리로 날아가 달립니다.
// 모양 6개가 준비되면(3D 모델 · api 의 shape) 공 대신 그 모델을 같은 자리에 그립니다.

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { ornamentPosition } from "./SnowGlobeModel";

export type ShowcaseMode = "pick" | "write" | "attach";

export type ShowcaseState = {
  mode: ShowcaseMode;
  options: { id: string; color: string; label: string }[];
  selectedId: string;
  targetIndex: number; // 트리에 달릴 자리 (몇 번째 오너먼트인지)
  onPick: (id: string) => void;
  onAttached: () => void; // 날아가 달리는 움직임이 끝났을 때
};

const ORNAMENT_RADIUS = 0.052; // SnowGlobeModel 안의 오너먼트 반지름
const HOLD = 0.7; // 스노우볼이 올라오는 동안 위에서 기다리는 시간(초)
const FLY = 1.8; // 트리까지 날아가는 시간(초)
// 메시지 카드 윗변이 화면 아래에서 떨어진 거리(px). 카드(MessageCard)와 도크 높이가 바뀌면 함께 고칩니다.
const CARD_FROM_BOTTOM = { desktop: 489, mobile: 459 };
const OVERLAP = 0.3; // 오너먼트 지름 중 카드 뒤로 겹치는 비율

type Props = {
  state: ShowcaseState;
  globe: React.RefObject<THREE.Group | null>;
  reducedMotion: boolean;
};

export default function OrnamentShowcase({ state, globe, reducedMotion }: Props) {
  const { camera, size } = useThree();
  const balls = useRef<(THREE.Group | null)[]>([]);
  const attach = useRef<{ start: number | null; from: THREE.Vector3; fromScale: number; done: boolean }>({
    start: null,
    from: new THREE.Vector3(),
    fromScale: 1,
    done: false,
  });
  const target = useRef(new THREE.Vector3());
  const { mode, options, selectedId, targetIndex, onAttached } = state;

  // 달기 단계가 새로 시작될 때마다 움직임을 처음부터
  useEffect(() => {
    attach.current.start = null;
    attach.current.done = false;
  }, [mode]);

  useFrame(({ clock }, delta) => {
    const cam = camera as THREE.PerspectiveCamera;
    const vh = 2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * cam.position.z;
    const vw = vh * (size.width / size.height);
    const narrow = size.width / size.height < 0.8;

    // 진열 자리: 넓은 화면은 한 줄, 좁은 화면은 3개씩 두 줄
    const perRow = narrow ? 3 : 6;
    const spacing = Math.min(narrow ? 0.9 : 0.78, (vw * 0.82) / perRow);
    const R = spacing * 0.34;
    const slot = (i: number) => {
      const row = Math.floor(i / perRow);
      const col = i % perRow;
      const x = (col - (perRow - 1) / 2) * spacing;
      const y = narrow ? vh * (0.5 - (row === 0 ? 0.36 : 0.53)) : vh * (0.5 - 0.46);
      return [x, y] as const;
    };
    // 메시지를 쓰는 동안 오너먼트가 머무는 곳: 지름의 30% 가 메시지 카드 뒤로 겹치게 둡니다.
    // 카드는 화면 아래에 붙어 있으므로, 화면 아래에서 카드 윗변까지의 거리(px)를 기준으로 계산합니다.
    const smallRadius = narrow ? 0.26 : 0.32;
    const pxPerUnit = size.height / vh;
    const cardTopPx = size.height - CARD_FROM_BOTTOM[narrow ? "mobile" : "desktop"];
    const centerPx = cardTopPx + OVERLAP * 2 * smallRadius * pxPerUnit - smallRadius * pxPerUnit;
    const top = new THREE.Vector3(0, vh / 2 - centerPx / pxPerUnit, 0.4);
    const smallScale = smallRadius / R;
    const k = 1 - Math.exp(-delta * (reducedMotion ? 60 : 5));
    const t = clock.elapsedTime;

    options.forEach((o, i) => {
      const g = balls.current[i];
      if (!g) return;
      const selected = o.id === selectedId;

      if (mode === "pick") {
        const [x, y] = slot(i);
        const bob = reducedMotion ? 0 : Math.sin(t * 1.4 + i) * 0.04;
        g.position.lerp(new THREE.Vector3(x, y + bob, 0.4), k);
        g.scale.setScalar(THREE.MathUtils.lerp(g.scale.x, (selected ? 1.25 : 1) * R, k));
        g.visible = true;
        return;
      }

      if (!selected) {
        g.scale.setScalar(THREE.MathUtils.lerp(g.scale.x, 0, k));
        g.visible = g.scale.x > 0.002;
        return;
      }

      if (mode === "write") {
        g.position.lerp(top, k);
        g.scale.setScalar(THREE.MathUtils.lerp(g.scale.x, smallScale * R, k));
        g.visible = true;
        return;
      }

      // attach: 위에서 잠시 기다렸다가 트리의 제자리로 날아갑니다
      const a = attach.current;
      const gl = globe.current;
      if (!gl || a.done) return;
      if (a.start === null) {
        a.start = t;
        a.from.copy(g.position);
        a.fromScale = g.scale.x;
      }
      gl.updateMatrixWorld();
      const dest = gl.localToWorld(target.current.set(...ornamentPosition(targetIndex)));
      const destScale = ORNAMENT_RADIUS * gl.scale.x;
      const p = reducedMotion ? 1 : THREE.MathUtils.clamp((t - a.start - HOLD) / FLY, 0, 1);
      const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; // 천천히 출발해 천천히 멈춤
      g.position.lerpVectors(a.from, dest, e);
      g.position.y += Math.sin(e * Math.PI) * 0.35 * (1 - e * 0.5); // 살짝 포물선
      g.scale.setScalar(THREE.MathUtils.lerp(a.fromScale, destScale, e));
      if (p >= 1) {
        a.done = true;
        g.visible = false;
        onAttached();
      }
    });
  });

  return (
    <group name="OrnamentShowcase">
      {options.map((o, i) => {
        const selected = o.id === selectedId;
        return (
          <group
            key={o.id}
            ref={(el) => {
              balls.current[i] = el;
            }}
            position={[0, -4, 0.4]}
            scale={0.001}
            onClick={(e) => {
              if (mode !== "pick") return;
              e.stopPropagation();
              state.onPick(o.id);
            }}
            onPointerOver={() => mode === "pick" && (document.body.style.cursor = "pointer")}
            onPointerOut={() => (document.body.style.cursor = "")}
          >
            {/* 반지름 1 기준으로 만들고, 바깥에서 크기를 정합니다 */}
            <mesh>
              <sphereGeometry args={[1, 48, 48]} />
              <meshStandardMaterial
                color={o.color}
                metalness={0.45}
                roughness={0.22}
                emissive={selected ? o.color : "#000000"}
                emissiveIntensity={selected ? 0.35 : 0}
              />
            </mesh>
            <mesh position={[0, 1.05, 0]}>
              <cylinderGeometry args={[0.22, 0.26, 0.22, 24]} />
              <meshStandardMaterial color="#C9B38A" metalness={0.7} roughness={0.3} />
            </mesh>
            <mesh position={[0, 1.24, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.1, 0.03, 8, 24]} />
              <meshStandardMaterial color="#C9B38A" metalness={0.7} roughness={0.3} />
            </mesh>
            {selected && mode === "pick" && (
              // 고른 오너먼트: 도크의 선택 표시와 같은 금빛 고리
              <mesh>
                <torusGeometry args={[1.38, 0.035, 12, 96]} />
                <meshBasicMaterial color="#F2C46D" toneMapped={false} />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}
