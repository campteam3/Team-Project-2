"use client";

// 404 배경: 마우스를 움직이거나 누르면 그 자리에 겨울 물건(오너먼트 볼 · 별 · 하트, 선물 상자)이 생겨 떨어지고 바닥에 쌓입니다.
// 레퍼런스: Spring/Summer 404 (김미영 제공). 물리 라이브러리 없이 2D 원 충돌로 간단히 계산하고, 그리기만 3D 로 합니다.
// 화면 좌표(px) = 3D 좌표가 되도록 정사영 카메라(zoom 1)를 씁니다.

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

type Kind = "ball" | "star" | "heart" | "gift";
type Toy = { id: number; kind: Kind; color: string; r: number };
type Body = { x: number; y: number; vx: number; vy: number; spin: number; angle: number; tiltX: number; tiltY: number; yaw: number };

const KINDS: Kind[] = ["ball", "ball", "star", "heart", "gift"];
const COLORS = ["#C8363D", "#F2C46D", "#F5F1EA", "#8FB8E8", "#3C8E63", "#E58FA8"]; // 오너먼트 색 6가지와 같음
const MAX_TOYS = 70; // 넘으면 가장 오래된 것부터 사라집니다
const GRAVITY = 1600; // px/s²
const SPAWN_GAP = 80; // 마우스가 이만큼(px) 움직일 때마다 하나

const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];

// ---- 모양 (한 번만 만들어 함께 씁니다) ----
function starShape() {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    const rad = i % 2 === 0 ? 1 : 0.45;
    const x = Math.cos(a) * rad;
    const y = Math.sin(a) * rad;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  s.closePath();
  return s;
}

function heartShape() {
  const s = new THREE.Shape();
  s.moveTo(0, -0.9);
  s.bezierCurveTo(-0.2, -0.65, -1, -0.2, -1, 0.3);
  s.bezierCurveTo(-1, 0.75, -0.55, 0.95, -0.25, 0.85);
  s.bezierCurveTo(-0.1, 0.8, 0, 0.65, 0, 0.55);
  s.bezierCurveTo(0, 0.65, 0.1, 0.8, 0.25, 0.85);
  s.bezierCurveTo(0.55, 0.95, 1, 0.75, 1, 0.3);
  s.bezierCurveTo(1, -0.2, 0.2, -0.65, 0, -0.9);
  return s;
}

function useGeometries() {
  return useMemo(() => {
    const extrude = (shape: THREE.Shape) => {
      const g = new THREE.ExtrudeGeometry(shape, { depth: 0.45, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.1, bevelSegments: 4, curveSegments: 16 });
      g.center();
      return g;
    };
    return {
      ball: new THREE.SphereGeometry(1, 32, 24),
      cap: new THREE.CylinderGeometry(0.22, 0.22, 0.25, 16),
      star: extrude(starShape()),
      heart: extrude(heartShape()),
      box: new THREE.BoxGeometry(1.45, 1.45, 1.45),
      ribbonA: new THREE.BoxGeometry(1.5, 1.5, 0.3),
      ribbonB: new THREE.BoxGeometry(0.3, 1.5, 1.5),
    };
  }, []);
}

function ToyMesh({ toy, geo, setRef }: { toy: Toy; geo: ReturnType<typeof useGeometries>; setRef: (g: THREE.Group | null) => void }) {
  const mat = <meshStandardMaterial color={toy.color} roughness={0.28} metalness={0.25} />;
  return (
    <group ref={setRef} scale={toy.r}>
      {toy.kind === "ball" && (
        <>
          <mesh geometry={geo.ball}>{mat}</mesh>
          <mesh geometry={geo.cap} position={[0, 1.02, 0]}>
            <meshStandardMaterial color="#F2C46D" roughness={0.3} metalness={0.7} />
          </mesh>
        </>
      )}
      {toy.kind === "star" && <mesh geometry={geo.star}>{mat}</mesh>}
      {toy.kind === "heart" && <mesh geometry={geo.heart}>{mat}</mesh>}
      {toy.kind === "gift" && (
        <>
          <mesh geometry={geo.box}>{mat}</mesh>
          <mesh geometry={geo.ribbonA}>
            <meshStandardMaterial color="#F2C46D" roughness={0.35} metalness={0.4} />
          </mesh>
          <mesh geometry={geo.ribbonB}>
            <meshStandardMaterial color="#F2C46D" roughness={0.35} metalness={0.4} />
          </mesh>
        </>
      )}
    </group>
  );
}

function Toys() {
  const { size } = useThree();
  const geo = useGeometries();
  const [toys, setToys] = useState<Toy[]>([]);
  const bodies = useRef(new Map<number, Body>());
  const groups = useRef(new Map<number, THREE.Group>());
  const nextId = useRef(0);
  const sizeRef = useRef(size);
  useEffect(() => {
    sizeRef.current = size;
  }, [size]);

  // 물건 하나 만들기 (화면 좌표 → 3D 좌표: 가운데가 0, 위가 +)
  const spawnRef = useRef((clientX: number, clientY: number, vx = 0, vy = 0) => {
    const { width, height } = sizeRef.current;
    const small = width < 640;
    const id = nextId.current++;
    const kind = pick(KINDS);
    const toy: Toy = { id, kind, color: kind === "gift" ? pick(["#C8363D", "#3C8E63", "#8FB8E8"]) : pick(COLORS), r: (small ? 18 : 26) + Math.random() * (small ? 10 : 16) };
    bodies.current.set(id, {
      x: clientX - width / 2,
      y: height / 2 - clientY,
      vx: vx + (Math.random() - 0.5) * 120,
      vy: vy + 60 + Math.random() * 120,
      spin: (Math.random() - 0.5) * 6,
      angle: Math.random() * Math.PI * 2,
      tiltX: (Math.random() - 0.5) * 0.6, // 살짝만 기울여 입체감 (옆면만 보이지 않게)
      tiltY: (Math.random() - 0.5) * 1.2,
      yaw: (Math.random() - 0.5) * 0.7,
    });
    setToys((list) => {
      const next = [...list, toy];
      while (next.length > MAX_TOYS) {
        const old = next.shift()!;
        bodies.current.delete(old.id);
      }
      return next;
    });
  });

  // 처음에 몇 개를 위에서 떨어뜨려 빈 화면이 아니게 합니다
  useEffect(() => {
    const { width } = sizeRef.current;
    const timers = Array.from({ length: width < 640 ? 8 : 14 }, (_, i) =>
      setTimeout(() => spawnRef.current(Math.random() * width, -40), 150 + i * 160),
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  // 마우스 · 손가락 움직임을 따라 만들기 (화면 위 글자 · 버튼은 그대로 눌림)
  useEffect(() => {
    let last: { x: number; y: number; t: number } | null = null;
    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" && e.buttons === 0) return;
      const now = performance.now();
      if (!last) {
        last = { x: e.clientX, y: e.clientY, t: now };
        return;
      }
      const dx = e.clientX - last.x;
      const dy = e.clientY - last.y;
      if (Math.hypot(dx, dy) < SPAWN_GAP) return;
      const dt = Math.max(16, now - last.t) / 1000;
      spawnRef.current(e.clientX, e.clientY, THREE.MathUtils.clamp(dx / dt, -600, 600) * 0.3, THREE.MathUtils.clamp(-dy / dt, -600, 600) * 0.3);
      last = { x: e.clientX, y: e.clientY, t: now };
    };
    const down = (e: PointerEvent) => {
      spawnRef.current(e.clientX, e.clientY);
      last = { x: e.clientX, y: e.clientY, t: performance.now() };
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerdown", down);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerdown", down);
    };
  }, []);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const { width, height } = size;
    const list = toys.map((t) => [t, bodies.current.get(t.id)] as const).filter((p): p is readonly [Toy, Body] => !!p[1]);

    // 떨어지기 · 벽 · 바닥
    for (const [t, b] of list) {
      b.vy -= GRAVITY * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      const floor = -height / 2 + t.r;
      if (b.y < floor) {
        b.y = floor;
        b.vy = Math.abs(b.vy) > 120 ? -b.vy * 0.35 : 0;
        b.vx *= 0.9;
        b.spin = -b.vx / t.r; // 바닥에서는 구르기
      }
      const wall = width / 2 - t.r;
      if (b.x < -wall || b.x > wall) {
        b.x = THREE.MathUtils.clamp(b.x, -wall, wall);
        b.vx = -b.vx * 0.4;
      }
    }

    // 서로 부딪혀 쌓이기 (원끼리 밀어내기)
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 0; i < list.length; i++) {
        const [ti, bi] = list[i];
        for (let j = i + 1; j < list.length; j++) {
          const [tj, bj] = list[j];
          const dx = bj.x - bi.x;
          const dy = bj.y - bi.y;
          const min = (ti.r + tj.r) * 0.92;
          const d2 = dx * dx + dy * dy;
          if (d2 >= min * min || d2 === 0) continue;
          const d = Math.sqrt(d2);
          const nx = dx / d;
          const ny = dy / d;
          const push = (min - d) / 2;
          bi.x -= nx * push;
          bi.y -= ny * push;
          bj.x += nx * push;
          bj.y += ny * push;
          const rel = (bj.vx - bi.vx) * nx + (bj.vy - bi.vy) * ny;
          if (rel < 0) {
            const k = rel * 0.65;
            bi.vx += nx * k;
            bi.vy += ny * k;
            bj.vx -= nx * k;
            bj.vy -= ny * k;
          }
        }
      }
    }

    for (const [t, b] of list) {
      b.angle += b.spin * dt;
      b.spin *= 0.99;
      const g = groups.current.get(t.id);
      if (!g) continue;
      g.position.set(b.x, b.y, 0);
      g.rotation.set(b.tiltX, b.yaw, b.angle);
    }
  });

  return (
    <>
      {toys.map((toy) => (
        <ToyMesh
          key={toy.id}
          toy={toy}
          geo={geo}
          setRef={(g) => {
            if (g) groups.current.set(toy.id, g);
            else groups.current.delete(toy.id);
          }}
        />
      ))}
    </>
  );
}

export default function FallingToys() {
  return (
    <Canvas
      orthographic
      camera={{ zoom: 1, position: [0, 0, 500], near: 1, far: 2000 }}
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true }}
      className="!pointer-events-none !fixed inset-0"
      aria-hidden="true"
    >
      <ambientLight intensity={1.1} />
      <directionalLight position={[-300, 500, 600]} intensity={2.4} />
      <pointLight position={[300, 200, 300]} intensity={1.2} distance={0} decay={0} color="#F2C46D" />
      <Toys />
    </Canvas>
  );
}
