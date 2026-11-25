"use client";

// 화면 전체를 채우는 3D 무대: 마을(배경) + 스노우볼 + 눈.
//  - 스노우볼만 드래그로 돌아가고, 마을은 움직이지 않습니다.
//  - layout 값으로 스노우볼이 화면에서 차지하는 높이와 위치를 정합니다 (DESIGN.md 4-2: 60% 이상).
//  - 매 프레임 받침대 명판의 화면 좌표를 onPlateMove 로 알려 줍니다.
//    명판 위 글자 · 닉네임 입력칸은 Stage 가 일반 HTML 로 그 자리에 둡니다
//    (drei 의 Html 은 React 19.3 과 충돌해 쓰지 않습니다).

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { Ornament } from "@/lib/api";
import { themeColor, type GlobeTheme } from "@/lib/theme";
import SnowGlobeModel, {
  MODEL,
  NAMEPLATE,
  NAMEPLATE_WIDTH,
  ornamentPosition,
} from "./SnowGlobeModel";
import { NightBloom, NightLights } from "@/components/SnowGlobeAtmosphere";
import VillageBackdrop from "./VillageBackdrop";

export type GlobeLayout = {
  height: number; // 스노우볼(구+받침대)이 차지할 화면 높이 비율
  centerFromTop: number; // 스노우볼 가운데가 놓일 위치(화면 위에서부터 비율)
};

export type StageSceneProps = {
  theme: GlobeTheme;
  ornaments?: Pick<Ornament, "id" | "color">[];
  layout: GlobeLayout;
  onPlateMove?: (x: number, y: number, visibility: number, width: number) => void; // 명판 가운데의 화면 좌표(px)와 보이는 정도(0~1)
  pinKey?: number; // 값이 바뀔 때마다 앞쪽을 향한 오너먼트 하나를 새로 고릅니다
  pinId?: string; // 말풍선을 붙일 오너먼트를 직접 정할 때 (pinKey 보다 우선)
  highlightId?: string;
  arrivingId?: string;
  onPinMove?: (x: number, y: number, visibility: number) => void; // 고른 오너먼트 바로 위의 화면 좌표와 보이는 정도
  lockFront?: boolean; // 명판에 입력할 때는 앞면을 고정합니다
  focusId?: string; // 이 오너먼트가 정면에 오도록 돌립니다 (친구가 고른 · 단 오너먼트)
  // 화면 위 UI(제목) 아래 끝과 화면 아래 UI(안내 · 도크 · 입력) 위 끝의 px 좌표.
  // 스노우볼은 이 사이의 빈 공간 안에서만 크기와 위치를 잡아, 어떤 화면 크기에서도 UI 와 겹치지 않습니다.
  // plateHalf: 명판 위 글자 · 입력칸 높이의 절반(px). 명판은 아래쪽 UI 와 겹치지 않게 지킵니다.
  getSafeArea?: () => { top: number; bottom: number; plateHalf: number } | null;
  shakeSignal: number;
  reducedMotion: boolean;
};

const SNOW_COUNT = 420;
const UI_OVERLAP = 0.3; // 스노우볼 몸체가 아래쪽 UI 뒤로 들어가도 되는 비율
const SAFE_GAP = 24; // UI 와 스노우볼 사이 최소 간격(px) · DESIGN.md 4-2

type SnowProps = {
  color: string;
  shakeSignal: number;
  reducedMotion: boolean;
  takeDragKick: () => number; // 빠르게 드래그하면 눈이 날립니다
};

function Snow({ color, shakeSignal, reducedMotion, takeDragKick }: SnowProps) {
  const geometry = useRef<THREE.BufferGeometry>(null);
  const velocities = useRef<Float32Array | null>(null);
  const energy = useRef(0);

  // 처음에는 눈이 구 안에 흩어져 있다가 천천히 내려앉습니다
  useEffect(() => {
    const pos = new Float32Array(SNOW_COUNT * 3);
    for (let i = 0; i < SNOW_COUNT; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * 0.82;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = MODEL.floorY + Math.random() * 1.4;
      pos[i * 3 + 2] = Math.sin(a) * r;
    }
    geometry.current?.setAttribute(
      "position",
      new THREE.BufferAttribute(pos, 3),
    );
    velocities.current = new Float32Array(SNOW_COUNT * 3);
  }, []);

  useEffect(() => {
    energy.current = reducedMotion ? 0 : 0.35;
  }, [reducedMotion]);

  useEffect(() => {
    if (shakeSignal > 0) energy.current = 1;
  }, [shakeSignal]);

  useFrame((_, delta) => {
    const attribute = geometry.current?.getAttribute("position") as
      THREE.BufferAttribute | undefined;
    const vel = velocities.current;
    if (!attribute || !vel) return;
    const pos = attribute.array as Float32Array;
    const dt = Math.min(delta, 0.05);
    energy.current = Math.max(energy.current, takeDragKick());
    const kick = energy.current;
    const R = MODEL.glassRadius * 0.94;
    for (let i = 0; i < SNOW_COUNT; i++) {
      const x = i * 3,
        y = x + 1,
        z = x + 2;
      if (kick > 0.05) {
        vel[x] += (Math.random() - 0.5) * kick * dt * 12;
        vel[y] += Math.random() * kick * dt * 14;
        vel[z] += (Math.random() - 0.5) * kick * dt * 12;
      }
      vel[y] -= (reducedMotion ? 2 : 0.18) * dt; // 눈은 천천히 내려앉습니다
      vel[x] *= 0.98;
      vel[y] *= 0.98;
      vel[z] *= 0.98;
      pos[x] += vel[x] * dt;
      pos[y] += vel[y] * dt;
      pos[z] += vel[z] * dt;
      const len = Math.hypot(pos[x], pos[y], pos[z]);
      if (len > R) {
        const s = R / len;
        pos[x] *= s;
        pos[y] *= s;
        pos[z] *= s;
        vel[x] *= -0.2;
        vel[y] *= -0.2;
        vel[z] *= -0.2;
      }
      if (pos[y] < MODEL.floorY) {
        pos[y] = MODEL.floorY;
        vel[x] = vel[y] = vel[z] = 0;
      }
    }
    energy.current = kick * Math.exp(-dt * 1.6);
    attribute.needsUpdate = true;
  });

  return (
    <points>
      <bufferGeometry ref={geometry} />
      <pointsMaterial
        color={color}
        size={0.024}
        sizeAttenuation
        transparent
        opacity={0.95}
        depthWrite={false}
      />
    </points>
  );
}

function Globe(props: StageSceneProps) {
  const {
    theme,
    ornaments = [],
    layout,
    onPlateMove,
    pinKey = 0,
    pinId,
    onPinMove,
    lockFront,
    focusId,
    shakeSignal,
    reducedMotion,
  } = props;
  const focusIndex = focusId ? ornaments.findIndex((o) => o.id === focusId) : -1;
  const holdRotation = lockFront || focusIndex >= 0; // 정해진 방향으로 돌리는 동안에는 드래그로 돌리지 않습니다
  const group = useRef<THREE.Group>(null);
  const { camera, size, gl } = useThree();
  const drag = useRef({ active: false, x: 0, velocity: 0 });
  const dragKick = useRef(0);
  const platePoint = useRef(new THREE.Vector3());
  const pin = useRef({ key: -1, index: 0 });
  const takeDragKick = () => {
    const k = dragKick.current;
    dragKick.current = 0;
    return k;
  };

  // 드래그로 돌리기 (마을은 그대로)
  useEffect(() => {
    const target = gl.domElement;
    const down = (e: PointerEvent) => {
      if (holdRotation) return;
      drag.current.active = true;
      drag.current.x = e.clientX;
      target.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!drag.current.active || !group.current) return;
      const dx = e.clientX - drag.current.x;
      drag.current.x = e.clientX;
      drag.current.velocity = dx * 0.008;
      group.current.rotation.y += drag.current.velocity;
      if (Math.abs(dx) > 14) dragKick.current = Math.min(1, Math.abs(dx) / 40);
    };
    const up = () => (drag.current.active = false);
    target.addEventListener("pointerdown", down);
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", up);
    target.addEventListener("pointercancel", up);
    return () => {
      target.removeEventListener("pointerdown", down);
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", up);
      target.removeEventListener("pointercancel", up);
    };
  }, [gl, holdRotation]);

  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;
    // 화면 높이 비율 → 3D 크기 · 위치
    const cam = camera as THREE.PerspectiveCamera;
    const dist = cam.position.z;
    const vh = 2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * dist;
    const vw = vh * (size.width / size.height);
    const modelH = MODEL.top - MODEL.bottom;
    let scale = Math.min((layout.height * vh) / modelH, (vw * 0.88) / MODEL.width);
    const mid = (MODEL.top + MODEL.bottom) / 2;
    let y = vh * (0.5 - layout.centerFromTop) - mid * scale;

    // UI 사이 빈 공간에 맞추기 (스노우볼을 화면 밖으로 내린 단계는 제외)
    const safe = layout.centerFromTop < 1 ? props.getSafeArea?.() : null;
    if (safe) {
      const toWorld = vh / size.height;
      const bandTop = vh / 2 - (safe.top + SAFE_GAP) * toWorld;
      const bandBottom = vh / 2 - (safe.bottom - SAFE_GAP) * toWorld;
      // 원근 때문에 받침대 앞쪽이 모델 아래 끝보다 조금 더 내려와 보여서 여유를 둡니다
      const visTop = MODEL.top + 0.02;
      const visBottom = MODEL.bottom - 0.12;
      const visH = visTop - visBottom;
      // 스노우볼 몸체는 아래쪽 UI 뒤로 높이의 30% 까지 들어가도 됩니다.
      // 단, 명판(이름 글자 · 닉네임 입력칸)은 아래쪽 UI 위에 남깁니다.
      const behind = UI_OVERLAP * visH;
      const [, plateY, plateZ] = NAMEPLATE;
      const plateHalf = safe.plateHalf * toWorld;
      // 크기 s 일 때 스노우볼을 둘 수 있는 높이 범위.
      // 명판은 받침대 앞면(카메라 쪽)에 있어 원근 때문에 화면에서 더 아래로 보이므로 그만큼 보정합니다.
      const range = (sc: number) => {
        const yMax = bandTop - visTop * sc; // 맨 위는 제목 아래
        let yMin = bandBottom - (visBottom + behind) * sc; // 몸체는 UI 뒤로 30% 까지
        if (safe.plateHalf > 0) {
          const persp = dist / (dist - plateZ * sc); // 명판이 화면에서 커 보이는 비율
          yMin = Math.max(yMin, (bandBottom + plateHalf) / persp - plateY * sc); // 명판은 UI 위
        }
        return [yMin, yMax] as const;
      };
      // 겹치지 않는 가장 큰 크기를 찾습니다 (이분 탐색)
      let lo = 0.05;
      let hi = scale;
      if (range(hi)[0] > range(hi)[1]) {
        for (let i = 0; i < 18; i++) {
          const midS = (lo + hi) / 2;
          const [a, b] = range(midS);
          if (a <= b) lo = midS;
          else hi = midS;
        }
        scale = lo;
      }
      const [yMin, yMax] = range(scale);
      y = vh * (0.5 - layout.centerFromTop) - mid * scale;
      y = THREE.MathUtils.clamp(y, Math.min(yMin, yMax), yMax);
    }
    const k = 1 - Math.exp(-delta * (reducedMotion ? 60 : 4)); // 부드럽게 따라가기
    g.scale.setScalar(THREE.MathUtils.lerp(g.scale.x || scale, scale, k));
    g.position.y = THREE.MathUtils.lerp(g.position.y, y, k);

    if (focusIndex >= 0 && !lockFront) {
      // 고른 오너먼트가 정면에 오는 각도 중 지금과 가장 가까운 곳으로 돌아갑니다
      const [ox, , oz] = ornamentPosition(focusIndex);
      const want = Math.atan2(-ox, oz);
      const target =
        want + Math.round((g.rotation.y - want) / (Math.PI * 2)) * Math.PI * 2;
      g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, target, k);
      drag.current.velocity = 0;
    } else if (lockFront) {
      // 가장 가까운 앞면(0, 2π, …)으로 돌아옵니다
      const front = Math.round(g.rotation.y / (Math.PI * 2)) * Math.PI * 2;
      g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, front, k);
      drag.current.velocity = 0;
    } else if (!drag.current.active) {
      g.rotation.y += drag.current.velocity;
      drag.current.velocity *= Math.exp(-delta * 3);
      if (!reducedMotion && Math.abs(drag.current.velocity) < 0.0005)
        g.rotation.y += delta * 0.08; // 천천히 저절로 돕니다
    }

    // 명판 위치를 화면 좌표로 알려 줍니다. 명판이 뒤로 돌아가면 보이는 정도가 0 이 됩니다.
    if (onPlateMove) {
      g.updateMatrixWorld();
      const p = platePoint.current.set(...NAMEPLATE);
      g.localToWorld(p).project(camera);
      const facing = Math.cos(g.rotation.y);
      onPlateMove(
        ((p.x + 1) / 2) * size.width,
        ((1 - p.y) / 2) * size.height,
        THREE.MathUtils.clamp((facing - 0.7) / 0.2, 0, 1), // 정면에 가까울 때만 글자를 보여 줍니다
        NAMEPLATE_WIDTH * g.scale.x * (size.height / vh), // 명판 너비(px)
      );
    }

    // 예시 말풍선: 오너먼트 하나의 화면 위치를 알려 줍니다
    if (onPinMove && ornaments.length) {
      const n = ornaments.length;
      const facingOf = (i: number) => {
        const [x, , z] = ornamentPosition(i);
        const r = Math.hypot(x, z) || 1;
        return (-x * Math.sin(g.rotation.y) + z * Math.cos(g.rotation.y)) / r; // 1 이면 정면
      };
      const fixed = pinId ? ornaments.findIndex((o) => o.id === pinId) : -1;
      if (fixed >= 0) {
        pin.current = { key: pinKey, index: fixed };
      } else if (pin.current.key !== pinKey) {
        // 새 차례: 지금 가장 앞을 향한 오너먼트 중 위쪽 절반에 있는 것을 고릅니다 (바로 전 것은 피함)
        let best = 0;
        let bestScore = -Infinity;
        for (let i = 0; i < n; i++) {
          const score =
            facingOf(i) +
            (i === pin.current.index ? -1 : 0) +
            (ornamentPosition(i)[1] > -0.1 ? 0.3 : 0);
          if (score > bestScore) {
            bestScore = score;
            best = i;
          }
        }
        pin.current = { key: pinKey, index: best };
      }
      const [x, y, z] = ornamentPosition(pin.current.index);
      g.updateMatrixWorld();
      const p = platePoint.current.set(x, y + 0.07, z);
      g.localToWorld(p).project(camera);
      onPinMove(
        ((p.x + 1) / 2) * size.width,
        ((1 - p.y) / 2) * size.height,
        THREE.MathUtils.clamp((facingOf(pin.current.index) - 0.1) / 0.5, 0, 1),
      );
    }
  });

  return (
    <>
      <group ref={group}>
        <SnowGlobeModel
          theme={theme}
          ornaments={ornaments}
          highlightId={props.highlightId}
          arrivingId={props.arrivingId}
          reducedMotion={reducedMotion}
        />
        <Snow
          color={themeColor(theme, "snow")}
          shakeSignal={shakeSignal}
          reducedMotion={reducedMotion}
          takeDragKick={takeDragKick}
        />
      </group>
    </>
  );
}

export default function StageScene(props: StageSceneProps) {
  return (
    <Canvas
      camera={{ position: [0, 0, 7], fov: 35 }}
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true }}
      style={{ touchAction: "pan-y" }}
      aria-hidden="true"
    >
      {/* 겨울밤 조명과 빛 번짐은 배경(SnowGlobeAtmosphere)에 맞춘 값입니다. (이민정) */}
      <NightLights />
      <VillageBackdrop />
      <Globe {...props} />
      <NightBloom />
    </Canvas>
  );
}
