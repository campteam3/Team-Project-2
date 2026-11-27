"use client";

// 화면 전체를 채우는 3D 무대: 마을(배경) + 스노우볼 + 눈.
//  - 스노우볼만 드래그로 돌아가고, 마을은 움직이지 않습니다.
//  - 확대한 동안에는 위아래로 끌어 스노우볼을 기울여, 위에서 내려다보거나 아래에서 올려다볼 수 있습니다 (FEEDBACK D3).
//  - 사진 찍기 화면(photo)에서는 저절로 돌지 않고, 더 크게 확대하고 어느 크기에서든 기울일 수 있습니다. 가리킨 곳을 향해 커집니다 (이민정).
//  - layout 값으로 스노우볼이 화면에서 차지하는 높이와 위치를 정합니다 (DESIGN.md 4-2: 60% 이상).
//  - 매 프레임 받침대 명판의 화면 좌표를 onPlateMove 로 알려 줍니다.
//    명판 위 글자 · 닉네임 입력칸은 Stage 가 일반 HTML 로 그 자리에 둡니다
//    (drei 의 Html 은 React 19.3 과 충돌해 쓰지 않습니다).

import { useProgress } from "@react-three/drei";
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
import Snow from "./Snow";
import VillageBackdrop from "./VillageBackdrop";
import { backdropUniforms } from "./backdropShared";
import { toShape } from "@/lib/snowglobe";

export type GlobeLayout = {
  height: number; // 스노우볼(구+받침대)이 차지할 화면 높이 비율
  centerFromTop: number; // 스노우볼 가운데가 놓일 위치(화면 위에서부터 비율)
};

export type StageSceneProps = {
  theme: GlobeTheme;
  ornaments?: (Pick<Ornament, "id" | "color"> & { shape?: string })[];
  layout: GlobeLayout;
  plateText?: string; // 받침대 명판에 새길 이름 (3D 명판 면에 그립니다)
  onPlateMove?: (x: number, y: number, visibility: number, width: number) => void; // 명판 가운데의 화면 좌표(px)와 보이는 정도(0~1)
  pinKey?: number; // 값이 바뀔 때마다 앞쪽을 향한 오너먼트 하나를 새로 고릅니다
  pinId?: string; // 말풍선을 붙일 오너먼트를 직접 정할 때 (pinKey 보다 우선)
  highlightId?: string;
  onSelectOrnament?: (id: string) => void; // 주인 화면: 오너먼트를 눌러 메시지 읽기
  arrivingId?: string;
  morePinIds?: string[]; // 같은 말풍선을 더 붙일 오너먼트들 (친구가 먼저 단 내 오너먼트, FEEDBACK A6)
  // 고른 오너먼트 바로 위의 화면 좌표와 보이는 정도. slot 0 은 pinId · pinKey 로 고른 것, 1 부터는 morePinIds 순서입니다
  onPinMove?: (x: number, y: number, visibility: number, slot?: number) => void;
  lockFront?: boolean; // 명판에 입력할 때는 앞면을 고정합니다
  photo?: boolean; // 사진 찍기 화면: 저절로 돌지 않고, 각도 · 크기를 마음대로 맞출 수 있습니다 (이민정)
  focusId?: string; // 이 오너먼트가 정면에 오도록 돌립니다 (친구가 고른 · 단 오너먼트)
  // 화면 위 UI(제목) 아래 끝과 화면 아래 UI(안내 · 도크 · 입력) 위 끝의 px 좌표.
  // 스노우볼은 이 사이의 빈 공간 안에서만 크기와 위치를 잡아, 어떤 화면 크기에서도 UI 와 겹치지 않습니다.
  // plateHalf: 명판 위 글자 · 입력칸 높이의 절반(px). 명판은 아래쪽 UI 와 겹치지 않게 지킵니다.
  getSafeArea?: () => { top: number; bottom: number; plateHalf: number } | null;
  shakeSignal: number;
  reducedMotion: boolean;
  onReady?: () => void; // 스노우볼과 배경이 다 그려졌을 때 한 번
};

const UI_OVERLAP = 0.3; // 스노우볼 몸체가 아래쪽 UI 뒤로 들어가도 되는 비율
const SAFE_GAP = 24; // UI 와 스노우볼 사이 최소 간격(px) · DESIGN.md 4-2

// 확대 · 축소 범위 (빈 공간에 꼭 맞는 크기 대비)
const ZOOM_MIN = 0.6;
const ZOOM_MAX = 2;

// 확대한 동안 위아래로 끌어 기울일 수 있는 범위 (FEEDBACK D3, 이민정). 원래 크기로 돌아오면 똑바로 섭니다.
const TILT_FROM = 1.03; // 이 배율보다 크게 확대했을 때만 기울일 수 있습니다
const TILT_UP = 0.6; // 위에서 내려다보는 쪽으로 최대 (약 34도)
const TILT_DOWN = -0.3; // 아래에서 올려다보는 쪽으로 최대 (약 17도)

// 사진 찍기 화면에서는 오너먼트 하나를 가까이 담을 수 있게 더 크게 확대합니다 (이민정)
const PHOTO_ZOOM_MAX = 3.5;

function Globe(props: StageSceneProps) {
  const {
    theme,
    ornaments = [],
    layout,
    onPlateMove,
    pinKey = 0,
    pinId,
    morePinIds,
    onPinMove,
    lockFront,
    focusId,
    photo = false,
    shakeSignal,
    reducedMotion,
  } = props;
  const focusIndex = focusId ? ornaments.findIndex((o) => o.id === focusId) : -1;
  // n 번째 오너먼트의 자리. 아직 달리지 않은 오너먼트(미리보기)는 모양에 따라 자리가 달라서 모양을 함께 넘깁니다.
  const spotOf = (i: number) => ornamentPosition(i, toShape(ornaments[i]?.shape ?? "ball"));
  const holdRotation = lockFront || focusIndex >= 0; // 정해진 방향으로 돌리는 동안에는 드래그로 돌리지 않습니다
  const group = useRef<THREE.Group>(null);
  const { camera, size, gl } = useThree();
  const drag = useRef({ active: false, x: 0, y: 0, velocity: 0 });
  const tilt = useRef(0); // 기울인 각도 (0 = 똑바로, + = 위에서 내려다봄)
  const touchMode = useRef("pan-y"); // 캔버스에 지금 걸어 둔 touch-action 값
  const dragKick = useRef(0);
  const platePoint = useRef(new THREE.Vector3());
  const pin = useRef({ key: -1, index: 0 });
  const takeDragKick = () => {
    const k = dragKick.current;
    dragKick.current = 0;
    return k;
  };

  // 확대 · 축소 배율 (1 = 빈 공간에 꼭 맞는 크기). 입력 단계(lockFront)에서는 입력칸이 가려지지 않게 1 로 고정합니다.
  const zoom = useRef(1);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef(0); // 두 손가락 사이 거리 (px)
  const pinchAt = useRef({ x: 0, y: 0 }); // 두 손가락의 가운데 (px)
  useEffect(() => {
    if (lockFront) zoom.current = 1;
  }, [lockFront]);

  // 사진 찍기 화면: 확대한 곳이 화면 가운데에 오도록 스노우볼을 옮긴 거리 (장면 단위, 스노우볼 가운데 기준)
  const pan = useRef({ x: 0, y: 0 });
  // 매 프레임 재 두는 값: 화면 1px 의 장면 길이, 옮기기 전 스노우볼 가운데 높이
  const view = useRef({ toWorld: 0, centerY: 0 });
  // 사진 찍기 화면을 닫으면 들어오기 전 크기로 돌아갑니다
  useEffect(() => {
    if (!photo) return;
    const before = zoom.current;
    return () => {
      zoom.current = before;
      pan.current = { x: 0, y: 0 };
    };
  }, [photo]);

  // 드래그로 돌리기 (마을은 그대로) · 마우스 휠 / 트랙패드 / 두 손가락으로 확대 · 축소 · 두 번 눌러 원래 크기
  useEffect(() => {
    const target = gl.domElement;
    // at: 확대 · 축소의 기준이 되는 화면 위치. 사진 찍기 화면에서는 그곳이 제자리에 머물도록 스노우볼을 함께 옮깁니다
    const setZoom = (z: number, at?: { x: number; y: number }) => {
      if (lockFront) return;
      const next = THREE.MathUtils.clamp(z, ZOOM_MIN, photo ? PHOTO_ZOOM_MAX : ZOOM_MAX);
      if (photo && at && view.current.toWorld > 0) {
        const rect = target.getBoundingClientRect();
        const px = (at.x - rect.left - rect.width / 2) * view.current.toWorld;
        const py = -(at.y - rect.top - rect.height / 2) * view.current.toWorld - view.current.centerY;
        const ratio = next / zoom.current;
        pan.current.x = px + (pan.current.x - px) * ratio;
        pan.current.y = py + (pan.current.y - py) * ratio;
      }
      zoom.current = next;
    };
    const middle = () => {
      const [a, b] = [...pointers.current.values()];
      return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    };
    const gap = () => {
      const [a, b] = [...pointers.current.values()];
      return Math.hypot(a.x - b.x, a.y - b.y);
    };
    const down = (e: PointerEvent) => {
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      target.setPointerCapture(e.pointerId);
      if (pointers.current.size === 2) {
        // 두 손가락: 돌리기를 멈추고 확대 · 축소로
        drag.current.active = false;
        pinch.current = gap();
        pinchAt.current = middle();
        return;
      }
      if (holdRotation) return;
      drag.current.active = true;
      drag.current.x = e.clientX;
      drag.current.y = e.clientY;
    };
    const move = (e: PointerEvent) => {
      if (!pointers.current.has(e.pointerId)) return;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.current.size >= 2) {
        const d = gap();
        const at = middle();
        if (pinch.current > 0) {
          setZoom(zoom.current * (d / pinch.current), at);
          if (photo) {
            // 두 손가락을 함께 끌면 스노우볼도 따라 움직입니다
            pan.current.x += (at.x - pinchAt.current.x) * view.current.toWorld;
            pan.current.y -= (at.y - pinchAt.current.y) * view.current.toWorld;
          }
        }
        pinch.current = d;
        pinchAt.current = at;
        return;
      }
      if (!drag.current.active || !group.current) return;
      const dx = e.clientX - drag.current.x;
      const dy = e.clientY - drag.current.y;
      drag.current.x = e.clientX;
      drag.current.y = e.clientY;
      drag.current.velocity = dx * 0.008;
      group.current.rotation.y += drag.current.velocity;
      // 확대한 동안: 아래로 끌면 스노우볼 위쪽이 앞으로 기울어 위에서 내려다보게 됩니다
      if (photo || zoom.current > TILT_FROM) tilt.current = THREE.MathUtils.clamp(tilt.current + dy * 0.006, TILT_DOWN, TILT_UP);
      if (Math.abs(dx) > 14) dragKick.current = Math.min(1, Math.abs(dx) / 40);
    };
    const up = (e: PointerEvent) => {
      pointers.current.delete(e.pointerId);
      pinch.current = 0;
      drag.current.active = false;
    };
    const wheel = (e: WheelEvent) => {
      if (lockFront) return;
      e.preventDefault(); // 트랙패드 오므리기(ctrl + 휠)로 페이지 전체가 확대되지 않게
      const unit = e.deltaMode === 1 ? 16 : 1; // 줄 단위 휠은 px 로 바꿉니다
      setZoom(zoom.current * Math.exp(-e.deltaY * unit * (e.ctrlKey ? 0.01 : 0.0015)), { x: e.clientX, y: e.clientY });
    };
    const reset = () => {
      setZoom(1);
      pan.current = { x: 0, y: 0 };
      tilt.current = 0;
    };
    target.addEventListener("pointerdown", down);
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", up);
    target.addEventListener("pointercancel", up);
    target.addEventListener("wheel", wheel, { passive: false });
    target.addEventListener("dblclick", reset);
    return () => {
      target.removeEventListener("pointerdown", down);
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", up);
      target.removeEventListener("pointercancel", up);
      target.removeEventListener("wheel", wheel);
      target.removeEventListener("dblclick", reset);
    };
  }, [gl, holdRotation, lockFront, photo]);

  useFrame((frame, delta) => {
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
    // 확대 · 축소: 스노우볼 가운데를 기준으로 키웁니다 (키우면 UI 뒤로 겹쳐도 됨, 사용자가 고른 크기)
    const center = y + mid * scale;
    if (zoom.current !== 1) {
      scale *= zoom.current;
      y = center - mid * scale;
    }
    // 사진 찍기 화면: 확대한 만큼만 옮길 수 있습니다 (스노우볼 안의 어느 곳이든 화면에 담을 수 있는 만큼). 원래 크기에서는 가운데로 돌아옵니다
    view.current.toWorld = vh / size.height;
    view.current.centerY = center;
    const reach = photo && zoom.current > 1 ? 1 - 1 / zoom.current : 0;
    const reachX = (MODEL.width / 2) * scale * reach;
    const reachY = (modelH / 2) * scale * reach;
    pan.current.x = THREE.MathUtils.clamp(pan.current.x, -reachX, reachX);
    pan.current.y = THREE.MathUtils.clamp(pan.current.y, -reachY, reachY);
    const k = 1 - Math.exp(-delta * (reducedMotion ? 60 : 4)); // 부드럽게 따라가기
    g.scale.setScalar(THREE.MathUtils.lerp(g.scale.x || scale, scale, k));
    g.position.x = THREE.MathUtils.lerp(g.position.x, pan.current.x, k);
    g.position.y = THREE.MathUtils.lerp(g.position.y, y + pan.current.y, k);

    // 기울이기: 확대한 동안에만. 원래 크기로 돌아오거나 방향을 고정하는 단계에서는 똑바로 섭니다.
    const canTilt = (photo || zoom.current > TILT_FROM) && !holdRotation;
    if (!canTilt) tilt.current = 0;
    const tiltK = drag.current.active ? 1 - Math.exp(-delta * (reducedMotion ? 60 : 16)) : k; // 끄는 동안에는 손을 바로 따라갑니다
    g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, tilt.current, tiltK);
    // 확대한 동안에는 위아래로 끄는 손가락을 페이지 스크롤 대신 스노우볼이 받습니다
    const touch = canTilt ? "none" : "pan-y";
    if (touchMode.current !== touch) {
      touchMode.current = touch;
      frame.gl.domElement.style.touchAction = touch;
    }

    if (focusIndex >= 0 && !lockFront) {
      // 고른 오너먼트가 정면에 오는 각도 중 지금과 가장 가까운 곳으로 돌아갑니다
      const [ox, , oz] = spotOf(focusIndex);
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
      if (!reducedMotion && !photo && Math.abs(drag.current.velocity) < 0.0005)
        g.rotation.y += delta * 0.08; // 천천히 저절로 돕니다 (사진 찍기 화면에서는 맞춘 각도 그대로 멈춰 있습니다)
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
        const [x, , z] = spotOf(i);
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
            (spotOf(i)[1] > -0.1 ? 0.3 : 0);
          if (score > bestScore) {
            bestScore = score;
            best = i;
          }
        }
        pin.current = { key: pinKey, index: best };
      }
      const [x, y, z] = spotOf(pin.current.index);
      g.updateMatrixWorld();
      const p = platePoint.current.set(x, y + 0.07, z);
      g.localToWorld(p).project(camera);
      onPinMove(
        ((p.x + 1) / 2) * size.width,
        ((1 - p.y) / 2) * size.height,
        THREE.MathUtils.clamp((facingOf(pin.current.index) - 0.1) / 0.5, 0, 1),
      );
      // 더 붙일 말풍선들: 같은 방법으로 자리를 알려 줍니다. 목록에 없는 것은 숨깁니다
      morePinIds?.forEach((id, i) => {
        const index = ornaments.findIndex((o) => o.id === id);
        if (index < 0) return onPinMove(0, 0, 0, i + 1);
        const [mx, my, mz] = spotOf(index);
        const q = platePoint.current.set(mx, my + 0.07, mz);
        g.localToWorld(q).project(camera);
        onPinMove(
          ((q.x + 1) / 2) * size.width,
          ((1 - q.y) / 2) * size.height,
          THREE.MathUtils.clamp((facingOf(index) - 0.1) / 0.5, 0, 1),
          i + 1,
        );
      });
    }
  });

  return (
    <>
      <group ref={group}>
        <SnowGlobeModel
          theme={theme}
          ornaments={ornaments}
          highlightId={props.highlightId}
          selectedId={props.onSelectOrnament ? (props.highlightId ?? null) : undefined}
          onSelect={props.onSelectOrnament}
          arrivingId={props.arrivingId}
          plateText={props.plateText}
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

// 스노우볼과 배경 그림이 다 그려졌을 때 한 번 알려 줍니다. Stage 가 이때 대체 화면(흐린 스노우볼 그림)을 걷어 냅니다.
// 모델을 받는 중이거나 배경 그림이 아직 나타나는 중이면 기다립니다. 받지 못하는 경우에도 화면이 가려진 채 남지 않게 10초 뒤에는 알립니다.
const READY_FRAMES = 3; // 다 받은 뒤 화면에 실제로 그려질 때까지 기다리는 프레임 수
const READY_TIMEOUT = 10;
function ReadyWatch({ onReady }: { onReady: () => void }) {
  const calm = useRef(0);
  const done = useRef(false);
  useFrame((state) => {
    if (done.current) return;
    const late = state.clock.elapsedTime > READY_TIMEOUT;
    const { active, loaded } = useProgress.getState();
    const loadedAll = !active && loaded > 0 && backdropUniforms.uBackdropShow.value >= 1;
    if (!loadedAll && !late) {
      calm.current = 0;
      return;
    }
    if (++calm.current < READY_FRAMES && !late) return;
    done.current = true;
    onReady();
  });
  return null;
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
      {props.onReady && <ReadyWatch onReady={props.onReady} />}
    </Canvas>
  );
}
