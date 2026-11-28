"use client";

// 오너먼트 하나만 크게 보여 주는 3D 장면 (기념 메시지, FEEDBACK F1, 차명근)
// 보내기 화면(고르는 대로 바뀜)과 받기 화면(누르면 메시지가 열림)이 함께 씁니다.
// 스노우볼에 마음을 달 때 오너먼트를 고르는 화면(FriendFlow)도 씁니다: 달릴 오너먼트를 크게 보며 고릅니다.
// 배경 · 조명은 스노우볼 화면(StageScene)과 같고, 오너먼트는 스노우볼에 달린 것과 같은 모델 · 재질입니다.
// 스노우볼 모델은 불러오지 않습니다 (OrnamentGlb.tsx 만 씀).
// 끌어서 돌리고 기울여 보고, 휠 · 두 손가락으로 확대 · 축소할 수 있습니다. 손을 떼고 잠시 뒤에는 다시 천천히 돕니다 (이민정).

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import * as THREE from "three";
import { DayLights, NightBloom, NightLights } from "@/components/SnowGlobeAtmosphere";
import type { BackdropScene } from "@/components/stage/backdropShared";
import { SingleOrnament } from "@/components/snowglobe/OrnamentGlb";
import VillageBackdrop from "@/components/stage/VillageBackdrop";
import type { OrnamentShape } from "@/lib/snowglobe";

// 오너먼트 높이(장면 단위). 카메라(z 7, 시야 35도)에서 화면 높이의 약 35%
const TARGET_HEIGHT = 1.55;
// 화면 가운데보다 조금 위에 둡니다 (아래쪽에 도크 · 메시지 카드가 놓임)
const CENTER_Y = 0.45;

// 돌려 보기 · 확대 (이민정)
const ZOOM_MIN = 0.6;
const ZOOM_MAX = 1.8;
const ZOOM_DROP = 0.45; // 확대하면 제목과 도크 사이에 들어오도록 이만큼씩(배율 1 당) 아래로 내립니다
const TILT_MAX = 0.7; // 위아래로 기울일 수 있는 범위 (약 40도)
const SPIN_SPEED = 0.5; // 저절로 도는 속도
const RESUME_AFTER = 2500; // 손을 뗀 뒤 다시 저절로 돌기까지 (ms)
const CLICK_SLOP = 6; // 이만큼(px) 넘게 끌었으면 누른 것으로 치지 않습니다

// sunrise: 새해 스노우볼에서 열었을 때 배경을 일출로 맞춥니다
// scene: 생일 스노우볼 등 주제별 배경 (주면 sunrise 보다 먼저 봅니다)
type Props = { shape: OrnamentShape; color: string; onOpen?: () => void; sunrise?: boolean; scene?: BackdropScene };

// 움직임 줄이기 설정 (무대 바깥에서 넘겨받지 않고 여기서 직접 읽습니다)
function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  return reduced;
}

function FloatingOrnament({ shape, color, onOpen }: Props) {
  const reducedMotion = useReducedMotion();
  const spin = useRef<THREE.Group>(null);
  const fit = useRef<THREE.Group>(null);
  const [hover, setHover] = useState(false);
  const { gl } = useThree();
  // 사용자가 맞춘 보기: 확대 배율, 기울기, 끌던 속도, 끄는 중인지, 마지막으로 만진 시각, 이번에 끈 거리, 저절로 도는 속도
  const view = useRef({ zoom: 1, tilt: 0, velocity: 0, dragging: false, touchedAt: -1e9, moved: 0, spin: SPIN_SPEED });

  // 끌어서 돌리기 · 기울이기, 휠 · 두 손가락으로 확대 · 축소, 두 번 눌러 처음으로
  useEffect(() => {
    const target = gl.domElement;
    const v = view.current;
    const pointers = new Map<number, { x: number; y: number }>();
    let pinch = 0; // 두 손가락 사이 거리 (px)
    let last = { x: 0, y: 0 };
    let movedAt = 0; // 마지막으로 끈 시각
    const setZoom = (z: number) => {
      v.zoom = THREE.MathUtils.clamp(z, ZOOM_MIN, ZOOM_MAX);
      v.touchedAt = performance.now();
    };
    const gap = () => {
      const [a, b] = [...pointers.values()];
      return Math.hypot(a.x - b.x, a.y - b.y);
    };
    const down = (e: PointerEvent) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      target.setPointerCapture(e.pointerId);
      v.touchedAt = performance.now();
      if (pointers.size === 2) {
        v.dragging = false;
        pinch = gap();
        return;
      }
      v.dragging = true;
      v.moved = 0;
      v.velocity = 0;
      last = { x: e.clientX, y: e.clientY };
    };
    const move = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size >= 2) {
        const d = gap();
        if (pinch > 0) setZoom(v.zoom * (d / pinch));
        pinch = d;
        return;
      }
      if (!v.dragging || !spin.current) return;
      const dx = e.clientX - last.x;
      const dy = e.clientY - last.y;
      last = { x: e.clientX, y: e.clientY };
      v.moved += Math.abs(dx) + Math.abs(dy);
      v.velocity = dx * 0.01;
      spin.current.rotation.y += v.velocity;
      v.tilt = THREE.MathUtils.clamp(v.tilt + dy * 0.008, -TILT_MAX, TILT_MAX);
      movedAt = v.touchedAt = performance.now();
    };
    const up = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      pinch = 0;
      v.dragging = false;
      v.touchedAt = performance.now();
      if (v.touchedAt - movedAt > 80) v.velocity = 0; // 멈췄다가 뗀 경우에는 더 돌지 않습니다 (맞춘 각도 그대로)
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault(); // 트랙패드 오므리기(ctrl + 휠)로 페이지 전체가 확대되지 않게
      const unit = e.deltaMode === 1 ? 16 : 1;
      setZoom(v.zoom * Math.exp(-e.deltaY * unit * (e.ctrlKey ? 0.01 : 0.0015)));
    };
    const reset = () => {
      v.zoom = 1;
      v.tilt = 0;
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
  }, [gl]);

  // 모양마다 크기가 달라서, 그린 뒤 크기를 재 화면에 같은 크기로 맞춥니다 (가운데도 맞춤)
  // 바깥 group 이 돌고 떠다니므로 화면 좌표가 아니라 오너먼트 자체의 좌표(모양 데이터)로 잽니다
  useLayoutEffect(() => {
    const group = fit.current;
    if (!group) return;
    const box = new THREE.Box3();
    for (const child of group.children) {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) continue;
      mesh.geometry.computeBoundingBox();
      if (!mesh.geometry.boundingBox) continue;
      mesh.updateMatrix();
      box.union(mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrix));
    }
    if (box.isEmpty()) return;
    const size = box.getSize(new THREE.Vector3());
    const scale = TARGET_HEIGHT / Math.max(size.y, size.x, 1e-6);
    const center = box.getCenter(new THREE.Vector3());
    group.scale.setScalar(scale);
    group.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
  }, [shape, color]);

  // 모양을 바꾸면 앞면부터 다시 돕니다. 별 · 하트는 앞뒤가 있는 모양이라, 돌던 각도 그대로 바뀌면 옆이나 뒤부터 보입니다 (이슈 #73, 이민정)
  useLayoutEffect(() => {
    if (spin.current) spin.current.rotation.y = 0;
    view.current.tilt = 0;
    view.current.velocity = 0;
  }, [shape]);

  useFrame(({ clock }, delta) => {
    const item = spin.current;
    if (!item) return;
    const v = view.current;
    const idle = !v.dragging && performance.now() - v.touchedAt > RESUME_AFTER;
    // 손을 뗀 뒤에는 끌던 힘으로 조금 더 돌다가 멈추고, 잠시 뒤 다시 천천히 돕니다 (움직임 줄이기에서는 저절로 돌지 않습니다)
    if (!v.dragging) {
      item.rotation.y += v.velocity;
      v.velocity *= Math.exp(-delta * 4);
      v.spin = THREE.MathUtils.lerp(v.spin, idle && !reducedMotion ? SPIN_SPEED : 0, 1 - Math.exp(-delta * 2));
      item.rotation.y += delta * v.spin;
      if (idle) v.tilt = THREE.MathUtils.lerp(v.tilt, 0, 1 - Math.exp(-delta * 2)); // 다시 돌 때는 똑바로 섭니다
    } else v.spin = 0;
    const follow = 1 - Math.exp(-delta * (reducedMotion ? 60 : 12));
    item.rotation.x = THREE.MathUtils.lerp(item.rotation.x, v.tilt, follow);
    const target = (hover ? 1.06 : 1) * v.zoom;
    item.scale.setScalar(THREE.MathUtils.lerp(item.scale.x, target, 1 - Math.exp(-delta * 10)));
    const centerY = CENTER_Y - Math.max(0, item.scale.x - 1) * ZOOM_DROP;
    item.position.y = reducedMotion ? centerY : centerY + Math.sin(clock.elapsedTime * 1.4) * 0.06;
  });

  return (
    <group
      ref={spin}
      position={[0, CENTER_Y, 0]}
      onClick={(event) => {
        event.stopPropagation();
        if (view.current.moved > CLICK_SLOP) return; // 돌리려고 끈 것은 누른 것으로 치지 않습니다
        onOpen?.();
      }}
      onPointerOver={() => {
        setHover(true);
        if (onOpen) document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHover(false);
        document.body.style.cursor = "";
      }}
    >
      <group ref={fit}>
        <SingleOrnament shape={shape} color={color} />
      </group>
      {/* 오너먼트 앞을 은은하게 밝히는 빛 (밤 배경에서 색이 죽지 않게) */}
      <pointLight position={[0, 0.4, 2.2]} intensity={1.4} distance={6} color="#fff1d6" />
    </group>
  );
}

export default function GiftOrnamentScene({ sunrise = false, scene, ...props }: Props) {
  return (
    <Canvas camera={{ position: [0, 0, 7], fov: 35 }} dpr={[1, 2]} gl={{ alpha: true, antialias: true }} style={{ touchAction: "none" }} aria-hidden="true">
      {scene === "birthday" ? <DayLights /> : <NightLights />}
      <VillageBackdrop sunrise={sunrise} scene={scene} />
      <Suspense fallback={null}>
        <FloatingOrnament {...props} />
      </Suspense>
      <NightBloom />
    </Canvas>
  );
}
