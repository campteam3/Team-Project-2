"use client";

// 오너먼트 하나만 크게 보여 주는 3D 장면 (기념 메시지, FEEDBACK F1, 차명근)
// 보내기 화면(고르는 대로 바뀜)과 받기 화면(누르면 메시지가 열림)이 함께 씁니다.
// 배경 · 조명은 스노우볼 화면(StageScene)과 같고, 오너먼트는 스노우볼에 달린 것과 같은 모델 · 재질입니다.
// 스노우볼 모델은 불러오지 않습니다 (OrnamentGlb.tsx 만 씀).

import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import * as THREE from "three";
import { NightBloom, NightLights } from "@/components/SnowGlobeAtmosphere";
import { SingleOrnament } from "@/components/snowglobe/OrnamentGlb";
import VillageBackdrop from "@/components/stage/VillageBackdrop";
import type { OrnamentShape } from "@/lib/snowglobe";

// 오너먼트 높이(장면 단위). 카메라(z 7, 시야 35도)에서 화면 높이의 약 35%
const TARGET_HEIGHT = 1.55;
// 화면 가운데보다 조금 위에 둡니다 (아래쪽에 도크 · 메시지 카드가 놓임)
const CENTER_Y = 0.45;

type Props = { shape: OrnamentShape; color: string; onOpen?: () => void };

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

  useFrame(({ clock }, delta) => {
    const item = spin.current;
    if (!item) return;
    if (reducedMotion) {
      item.rotation.y = 0;
      item.position.y = CENTER_Y;
      return;
    }
    item.rotation.y += delta * 0.5;
    item.position.y = CENTER_Y + Math.sin(clock.elapsedTime * 1.4) * 0.06;
    const target = hover ? 1.06 : 1;
    item.scale.setScalar(THREE.MathUtils.lerp(item.scale.x, target, 1 - Math.exp(-delta * 10)));
  });

  return (
    <group
      ref={spin}
      position={[0, CENTER_Y, 0]}
      onClick={(event) => {
        event.stopPropagation();
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

export default function GiftOrnamentScene(props: Props) {
  return (
    <Canvas camera={{ position: [0, 0, 7], fov: 35 }} dpr={[1, 2]} gl={{ alpha: true, antialias: true }} aria-hidden="true">
      <NightLights />
      <VillageBackdrop />
      <Suspense fallback={null}>
        <FloatingOrnament {...props} />
      </Suspense>
      <NightBloom />
    </Canvas>
  );
}
