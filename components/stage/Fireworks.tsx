"use client";

// 새해 스노우볼의 폭죽과 금가루. 눈(Snow.tsx) 대신 그립니다. (차명근)
//  - 평소: 5~8초에 한 번쯤 유리 안 위쪽에서 작은 폭죽이 하나 터집니다.
//  - 흔들면: 여러 곳에서 폭죽이 연달아 터지고, 불꽃이 금가루가 되어 황토 마당 위로 천천히 내려앉습니다.
//  - 움직임 줄이기(prefers-reduced-motion): 폭죽 없이 금가루만 조용히 내려앉습니다.
// 입자는 정해진 개수(COUNT)를 돌려 쓰므로, 오래 켜 두거나 계속 흔들어도 늘어나지 않습니다.
// 좌표는 스노우볼 모델과 같습니다 (유리 구의 가운데가 원점, 반지름 1).

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { MODEL } from "./SnowGlobeModel";

const COUNT = 900;
const R = MODEL.glassRadius * 0.92; // 입자가 닿는 유리 안쪽 면
// 황토 마당: 가운데가 살짝 솟은 언덕 (Snow.tsx 의 눈 바닥과 같은 모양). r2 = 가운데에서 떨어진 거리의 제곱
const groundAt = (r2: number) => -0.335 - 0.085 * r2;

const DEAD = 0;
const SPARK = 1; // 터져 나가는 불꽃
const DUST = 2; // 천천히 내려앉는 금가루
const SETTLED = 3; // 마당에 앉아 옅어지는 중

const GOLD = new THREE.Color("#ffd98a");
// 폭죽 색: 금색이 기본이고 빨강 · 분홍이 조금 섞입니다
const BURST_COLORS = ["#ffd98a", "#ffd98a", "#ffc65c", "#ff6b6f", "#ffa3c0"].map((hex) => new THREE.Color(hex));

const rand = (min: number, max: number) => min + Math.random() * (max - min);

const VERTEX = /* glsl */ `
  uniform float uScale;
  attribute vec3 aColor;
  attribute float aSize;
  attribute float aAlpha;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float modelScale = length(modelMatrix[0].xyz);
    gl_PointSize = max(aSize * modelScale * uScale * projectionMatrix[1][1] / -mv.z, 1.5);
    vColor = aColor;
    vAlpha = aAlpha;
  }
`;

const FRAGMENT = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0 || vAlpha < 0.01) discard;
    // 가운데가 밝고 가장자리로 부드럽게 번지는 빛 알갱이
    float glow = pow(1.0 - d, 2.0) + 0.6 * (1.0 - smoothstep(0.0, 0.3, d));
    gl_FragColor = vec4(vColor * 1.6, min(glow * vAlpha, 1.0));
  }
`;

type Props = { shakeSignal: number; reducedMotion: boolean };

export default function Fireworks({ shakeSignal, reducedMotion }: Props) {
  const geometry = useRef<THREE.BufferGeometry>(null);
  const material = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uScale: { value: 400 } }), []);

  const state = useRef({
    pos: new Float32Array(COUNT * 3),
    vel: new Float32Array(COUNT * 3),
    color: new Float32Array(COUNT * 3),
    size: new Float32Array(COUNT),
    alpha: new Float32Array(COUNT),
    life: new Float32Array(COUNT), // 남은 시간(초)
    span: new Float32Array(COUNT), // 처음 주어진 시간(초)
    seed: new Float32Array(COUNT),
    mode: new Uint8Array(COUNT),
    toDust: new Uint8Array(COUNT), // 불꽃이 다 타면 금가루로 바뀔지
    cursor: 0, // 다음에 쓸 입자 (끝까지 쓰면 가장 오래된 것부터 다시 씁니다)
    nextBurst: 1.2, // 다음 평소 폭죽까지 남은 시간
    queue: [] as number[], // 흔들었을 때 연달아 터질 폭죽들의 남은 시간
    drizzle: 0, // 움직임 줄이기: 다음 금가루까지 남은 시간
    time: 0,
    reduced: reducedMotion,
  });

  useEffect(() => {
    const geo = geometry.current;
    if (!geo) return;
    const s = state.current;
    for (const [name, array, itemSize] of [
      ["position", s.pos, 3],
      ["aColor", s.color, 3],
      ["aSize", s.size, 1],
      ["aAlpha", s.alpha, 1],
    ] as const) {
      const attribute = new THREE.BufferAttribute(array, itemSize);
      attribute.setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute(name, attribute);
    }
  }, []);

  useEffect(() => {
    state.current.reduced = reducedMotion;
  }, [reducedMotion]);

  // 흔들기: 1.2초 동안 여섯 발쯤 연달아 터집니다 (움직임 줄이기에서는 금가루만 한 번 흩뿌립니다)
  useEffect(() => {
    if (shakeSignal <= 0) return;
    const s = state.current;
    if (s.reduced) {
      for (let n = 0; n < 90; n++) spawnDust(s, rand(-0.1, 0.75));
      return;
    }
    const shots = 5 + Math.floor(Math.random() * 3);
    s.queue = Array.from({ length: shots }, (_, n) => (n * 1.2) / shots + rand(0, 0.12));
  }, [shakeSignal]);

  useFrame((three, delta) => {
    const s = state.current;
    const geo = geometry.current;
    const mat = material.current;
    if (!geo || !mat || !geo.attributes.position) return;
    const dt = Math.min(delta, 0.05);
    s.time += dt;

    if (s.reduced) {
      s.queue.length = 0;
      s.drizzle -= dt;
      if (s.drizzle <= 0) {
        spawnDust(s, rand(0.3, 0.8));
        s.drizzle = rand(0.25, 0.5);
      }
    } else {
      s.nextBurst -= dt;
      if (s.nextBurst <= 0) {
        burst(s, 46, 0.35);
        s.nextBurst = rand(5, 8);
      }
      if (s.queue.length) {
        s.queue = s.queue.map((left) => left - dt);
        for (const left of s.queue) if (left <= 0) burst(s, 62, 0.75);
        s.queue = s.queue.filter((left) => left > 0);
        s.nextBurst = Math.max(s.nextBurst, 5); // 방금 많이 터졌으니 평소 폭죽은 잠시 쉽니다
      }
    }

    const { pos, vel, color, alpha, life, span, seed, mode } = s;
    for (let i = 0; i < COUNT; i++) {
      if (mode[i] === DEAD) continue;
      const x = i * 3;
      life[i] -= dt;
      if (life[i] <= 0) {
        if (mode[i] === SPARK && s.toDust[i]) {
          // 불꽃이 식어 금가루가 됩니다
          mode[i] = DUST;
          life[i] = span[i] = rand(4, 7);
          color[x] = GOLD.r;
          color[x + 1] = GOLD.g;
          color[x + 2] = GOLD.b;
          s.size[i] *= 0.7;
        } else {
          mode[i] = DEAD;
          alpha[i] = 0;
          continue;
        }
      }
      if (mode[i] === SPARK) {
        const drag = Math.exp(-2.2 * dt);
        vel[x] *= drag;
        vel[x + 1] = vel[x + 1] * drag - 0.22 * dt;
        vel[x + 2] *= drag;
        const left = life[i] / span[i];
        alpha[i] = Math.pow(left, 0.5) * (0.75 + 0.25 * Math.sin(s.time * 30 + seed[i]));
      } else if (mode[i] === DUST) {
        // 물속의 금가루처럼 살랑이며 천천히 가라앉습니다
        const ease = 1 - Math.exp(-1.5 * dt);
        vel[x] += (Math.sin(s.time * 0.9 + seed[i]) * 0.03 - vel[x]) * ease;
        vel[x + 1] += (-0.075 - vel[x + 1]) * ease;
        vel[x + 2] += (Math.cos(s.time * 0.7 + seed[i] * 1.7) * 0.03 - vel[x + 2]) * ease;
        const age = span[i] - life[i];
        alpha[i] = Math.min(1, age * 2, life[i]) * (0.45 + 0.4 * Math.abs(Math.sin(s.time * 2.2 + seed[i])));
      } else {
        alpha[i] = Math.max(0, life[i] / span[i]) * 0.5;
        continue;
      }
      let px = pos[x] + vel[x] * dt;
      let py = pos[x + 1] + vel[x + 1] * dt;
      let pz = pos[x + 2] + vel[x + 2] * dt;
      // 유리를 뚫지 않게 안쪽 면에서 멈춥니다
      const distance = Math.hypot(px, py, pz);
      if (distance > R) {
        const k = R / distance;
        px *= k;
        py *= k;
        pz *= k;
        vel[x] *= 0.3;
        vel[x + 2] *= 0.3;
      }
      // 마당에 닿으면 앉아서 옅어집니다
      const ground = groundAt(px * px + pz * pz) + 0.012;
      if (py < ground) {
        py = ground;
        mode[i] = SETTLED;
        life[i] = span[i] = 1.8;
      }
      pos[x] = px;
      pos[x + 1] = py;
      pos[x + 2] = pz;
    }

    geo.attributes.position.needsUpdate = true;
    geo.attributes.aColor.needsUpdate = true;
    geo.attributes.aSize.needsUpdate = true;
    geo.attributes.aAlpha.needsUpdate = true;
    mat.uniforms.uScale.value = three.gl.domElement.height * 0.5;
  });

  return (
    <points frustumCulled={false} renderOrder={5}>
      <bufferGeometry ref={geometry} />
      <shaderMaterial ref={material} vertexShader={VERTEX} fragmentShader={FRAGMENT} uniforms={uniforms} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}

type State = {
  pos: Float32Array;
  vel: Float32Array;
  color: Float32Array;
  size: Float32Array;
  alpha: Float32Array;
  life: Float32Array;
  span: Float32Array;
  seed: Float32Array;
  mode: Uint8Array;
  toDust: Uint8Array;
  cursor: number;
};

function take(s: State) {
  const i = s.cursor;
  s.cursor = (s.cursor + 1) % COUNT;
  s.seed[i] = Math.random() * 6.283;
  return i;
}

// 폭죽 한 발: 유리 안 위쪽, 가운데(2027 과 양)를 비켜난 자리에서 사방으로 퍼집니다.
// dustShare: 불꽃 가운데 금가루로 남는 비율
function burst(s: State, sparks: number, dustShare: number) {
  const angle = Math.random() * Math.PI * 2;
  const radius = rand(0.42, 0.6);
  const cx = Math.cos(angle) * radius;
  const cy = rand(0.3, 0.58);
  const cz = Math.sin(angle) * radius;
  const tint = BURST_COLORS[Math.floor(Math.random() * BURST_COLORS.length)];
  const speed = rand(0.55, 0.8);
  for (let n = 0; n < sparks; n++) {
    const i = take(s);
    const x = i * 3;
    // 공 모양으로 고르게 퍼지는 방향
    const u = Math.random() * 2 - 1;
    const turn = Math.random() * Math.PI * 2;
    const flat = Math.sqrt(1 - u * u);
    const v = speed * rand(0.75, 1.05);
    s.pos[x] = cx;
    s.pos[x + 1] = cy;
    s.pos[x + 2] = cz;
    s.vel[x] = Math.cos(turn) * flat * v;
    s.vel[x + 1] = u * v + 0.08;
    s.vel[x + 2] = Math.sin(turn) * flat * v;
    const mix = Math.random() < 0.25 ? GOLD : tint;
    s.color[x] = mix.r;
    s.color[x + 1] = mix.g;
    s.color[x + 2] = mix.b;
    s.size[i] = rand(0.028, 0.045);
    s.life[i] = s.span[i] = rand(0.9, 1.4);
    s.alpha[i] = 1;
    s.mode[i] = SPARK;
    s.toDust[i] = Math.random() < dustShare ? 1 : 0;
  }
}

// 금가루 한 알을 유리 안 공중에 놓습니다 (움직임 줄이기용)
function spawnDust(s: State, y: number) {
  const i = take(s);
  const x = i * 3;
  const angle = Math.random() * Math.PI * 2;
  const radius = Math.sqrt(Math.random()) * Math.sqrt(Math.max(0, R * R - y * y)) * 0.9;
  s.pos[x] = Math.cos(angle) * radius;
  s.pos[x + 1] = y;
  s.pos[x + 2] = Math.sin(angle) * radius;
  s.vel[x] = s.vel[x + 1] = s.vel[x + 2] = 0;
  s.color[x] = GOLD.r;
  s.color[x + 1] = GOLD.g;
  s.color[x + 2] = GOLD.b;
  s.size[i] = rand(0.018, 0.028);
  s.life[i] = s.span[i] = rand(5, 8);
  s.alpha[i] = 0;
  s.mode[i] = DUST;
  s.toDust[i] = 0;
}
