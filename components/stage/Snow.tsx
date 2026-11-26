"use client";

// 스노우볼 안에서 흩날리는 눈. (이민정)
// 유리 안에 찬 물이 눈을 실어 나르는 것처럼 움직입니다.
//  - 흔들면 물이 크게 뒤집히며 돌고, 눈이 그 흐름을 타고 떠오릅니다.
//  - 스노우볼을 돌리면 물은 조금 늦게 따라와서 눈이 휘돕니다.
//  - 물이 잦아들면 눈송이마다 다른 속도로 살랑이며 가라앉습니다.
//  - 가만히 두어도 눈송이 몇 개는 위에서 다시 내려옵니다.
// 좌표는 스노우볼 모델과 같습니다 (유리 구의 가운데가 원점, 반지름 1).

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { MODEL } from "./SnowGlobeModel";

const COUNT = 640;
const AMBIENT_RATIO = 0.12; // 가만히 있어도 계속 내리는 눈송이의 비율
const R = MODEL.glassRadius * 0.94; // 눈이 닿는 유리 안쪽 면

// 아래 값은 Blender 원본(design/blender/snowglobe.blend)에서 잰 것입니다.
// 트리: 꼭대기에서 아래로 갈수록 넓어지는 원뿔로 어림합니다.
const TREE_TOP = 0.78;
const TREE_BOTTOM = -0.27;
const TREE_SLOPE = 0.44;
// 눈 바닥: 가운데가 살짝 솟은 언덕. r2 = 가운데에서 떨어진 거리의 제곱
const groundAt = (r2: number) => -0.345 - 0.085 * r2;

const AIR = 0; // 떠 있음
const REST = 1; // 바닥에 앉음 (쌓인 눈에 스며들어 보이지 않게 됩니다)
const FADING = 2; // 바닥에 닿아 사라지는 중 (계속 내리는 눈송이만)

type Flakes = {
  pos: Float32Array;
  vel: Float32Array;
  size: Float32Array; // 지름
  alpha: Float32Array; // 밝기
  fade: Float32Array; // 나타남 · 사라짐 (0~1)
  fall: Float32Array; // 가라앉는 속도
  follow: Float32Array; // 물의 흐름을 따라가는 빠르기
  sway: Float32Array; // 좌우로 살랑이는 크기
  wake: Float32Array; // 이 세기보다 세게 흔들려야 바닥에서 떠오릅니다
  seed: Float32Array; // 눈송이마다 다른 박자 (4개씩)
  state: Uint8Array;
  ambient: Uint8Array;
};

const rand = (min: number, max: number) => min + Math.random() * (max - min);

// 유리 안 공중의 한 점에 눈송이를 놓습니다
function placeInAir(f: Flakes, i: number, yMin: number, yMax: number) {
  const y = rand(yMin, yMax);
  const r = Math.sqrt(Math.random()) * Math.sqrt(R * R - y * y) * 0.92;
  const a = Math.random() * Math.PI * 2;
  f.pos[i * 3] = Math.cos(a) * r;
  f.pos[i * 3 + 1] = y;
  f.pos[i * 3 + 2] = Math.sin(a) * r;
  f.vel[i * 3] = f.vel[i * 3 + 1] = f.vel[i * 3 + 2] = 0;
}

function createFlakes(resting: boolean): Flakes {
  const f: Flakes = {
    pos: new Float32Array(COUNT * 3),
    vel: new Float32Array(COUNT * 3),
    size: new Float32Array(COUNT),
    alpha: new Float32Array(COUNT),
    fade: new Float32Array(COUNT).fill(1),
    fall: new Float32Array(COUNT),
    follow: new Float32Array(COUNT),
    sway: new Float32Array(COUNT),
    wake: new Float32Array(COUNT),
    seed: new Float32Array(COUNT * 4),
    state: new Uint8Array(COUNT),
    ambient: new Uint8Array(COUNT),
  };
  for (let i = 0; i < COUNT; i++) {
    // 작은 눈송이가 대부분이고 큰 눈송이는 드뭅니다
    const pick = Math.random();
    const size = pick < 0.66 ? rand(0.012, 0.02) : pick < 0.93 ? rand(0.02, 0.031) : rand(0.031, 0.042);
    f.size[i] = size;
    f.alpha[i] = rand(0.65, 1);
    f.fall[i] = rand(0.07, 0.16) + size * 2; // 큰 눈송이가 조금 더 빨리 가라앉습니다
    f.follow[i] = rand(3, 8);
    f.sway[i] = rand(0.03, 0.09);
    f.wake[i] = 0.04 + Math.pow(Math.random(), 1.5) * 0.5;
    f.seed[i * 4] = Math.random() * Math.PI * 2;
    f.seed[i * 4 + 1] = Math.random() * Math.PI * 2;
    f.seed[i * 4 + 2] = Math.random() * Math.PI * 2;
    f.seed[i * 4 + 3] = rand(0.9, 2.1);
    f.ambient[i] = Math.random() < AMBIENT_RATIO ? 1 : 0;
    if (resting) {
      const r = Math.sqrt(Math.random()) * 0.82;
      const a = Math.random() * Math.PI * 2;
      f.pos[i * 3] = Math.cos(a) * r;
      f.pos[i * 3 + 1] = groundAt(r * r);
      f.pos[i * 3 + 2] = Math.sin(a) * r;
      f.state[i] = REST;
      f.fade[i] = 0;
    } else {
      placeInAir(f, i, -0.3, 0.85);
    }
  }
  return f;
}

const VERTEX = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute float aFade;
  attribute float aSeed;
  uniform float uScale;
  uniform float uMinPx;
  uniform float uTime;
  uniform float uTwinkle;
  varying float vAlpha;
  varying float vPx;
  varying float vTurn;

  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    // 스노우볼을 키우거나 줄이면 눈송이도 같은 비율로 달라집니다
    float px = aSize * length(modelMatrix[0].xyz) * uScale * projectionMatrix[1][1] / -mv.z;
    gl_PointSize = max(px, uMinPx);
    vPx = gl_PointSize;
    // 눈송이가 천천히 돕니다
    vTurn = aSeed + uTwinkle * uTime * (aSeed - 3.14) * 0.25;
    // 눈송이가 빛을 받아 살짝 반짝입니다
    float twinkle = 1.0 - uTwinkle * 0.22 * (0.5 + 0.5 * sin(uTime * (1.4 + aSeed * 0.5) + aSeed * 7.0));
    vAlpha = aAlpha * aFade * twinkle * clamp(px / uMinPx, 0.5, 1.0);
  }
`;

const FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;
  varying float vPx;
  varying float vTurn;

  void main() {
    vec2 p = (gl_PointCoord - 0.5) * 2.0;
    float d = length(p);
    // 작게 보일 때: 가장자리가 부드러운 동그라미
    float soft = 1.0 - smoothstep(0.35, 1.0, d);
    // 크게 보일 때(큰 눈송이, 확대했을 때): 여섯 갈래 눈 결정
    float fold = mod(atan(p.y, p.x) + vTurn, 1.0472) - 0.5236;
    float across = d * abs(sin(fold)); // 가장 가까운 갈래에서 떨어진 거리
    float along = d * cos(fold);
    float line = max(0.1, 3.0 / vPx);
    float arms = (1.0 - smoothstep(line * 0.5, line, across)) * (1.0 - smoothstep(0.75, 1.0, d));
    // 갈래 중간의 작은 곁가지
    float twig = (1.0 - smoothstep(line * 0.5, line, abs(across - (along - 0.5) * 0.9))) * step(0.5, along) * (1.0 - smoothstep(0.7, 0.85, d));
    float core = 1.0 - smoothstep(0.1, 0.34, d);
    float crystal = max(max(arms, twig), core);
    float a = mix(soft, crystal, smoothstep(9.0, 14.0, vPx)) * vAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(uColor, a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

type Props = {
  color: string;
  shakeSignal: number;
  reducedMotion: boolean;
  takeDragKick: () => number; // 빠르게 드래그하면 눈이 날립니다
};

export default function Snow({ color, shakeSignal, reducedMotion, takeDragKick }: Props) {
  const points = useRef<THREE.Points>(null);
  const geometry = useRef<THREE.BufferGeometry>(null);
  const material = useRef<THREE.ShaderMaterial>(null);
  const flakes = useRef<Flakes | null>(null);
  // 유리 안 물의 상태
  const flow = useRef({
    energy: 0, // 흔들림 세기 (0~1)
    tumble: 0, // 물이 위아래로 뒤집히는 빠르기
    tumbleAngle: 0, // 뒤집히는 방향
    waterSpin: 0, // 물이 도는 빠르기
    lastRot: Number.NaN, // 직전 프레임의 스노우볼 각도
    time: 0,
    reduced: false,
  });

  const uniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color("#ffffff") },
      uScale: { value: 400 },
      uMinPx: { value: 2 },
      uTime: { value: 0 },
      uTwinkle: { value: 1 },
    }),
    [],
  );

  useEffect(() => {
    flow.current.reduced = reducedMotion;
    if (reducedMotion) {
      flow.current.tumble = 0;
      flow.current.waterSpin = 0;
    }
  }, [reducedMotion]);

  // 처음에는 눈이 구 안에 흩어져 있다가 천천히 내려앉습니다 (움직임 줄이기에서는 처음부터 바닥에)
  useEffect(() => {
    const geo = geometry.current;
    if (!geo) return;
    const f = createFlakes(flow.current.reduced);
    flakes.current = f;
    const position = new THREE.BufferAttribute(f.pos, 3);
    const fade = new THREE.BufferAttribute(f.fade, 1);
    position.setUsage(THREE.DynamicDrawUsage);
    fade.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute("position", position);
    geo.setAttribute("aFade", fade);
    geo.setAttribute("aSize", new THREE.BufferAttribute(f.size, 1));
    geo.setAttribute("aAlpha", new THREE.BufferAttribute(f.alpha, 1));
    geo.setAttribute("aSeed", new THREE.BufferAttribute(Float32Array.from({ length: COUNT }, (_, i) => f.seed[i * 4]), 1));
    flow.current.energy = flow.current.reduced ? 0 : 0.25;
  }, []);

  useEffect(() => {
    material.current?.uniforms.uColor.value.set(color);
  }, [color]);

  // 흔들기: 물이 한쪽으로 크게 뒤집히면서 돕니다
  useEffect(() => {
    if (shakeSignal <= 0) return;
    const w = flow.current;
    w.energy = 1;
    if (w.reduced) return;
    w.tumble = rand(3.2, 4.6);
    w.tumbleAngle = Math.random() * Math.PI * 2;
    w.waterSpin += (Math.random() < 0.5 ? -1 : 1) * rand(1.2, 2.8);
  }, [shakeSignal]);

  useFrame((state, delta) => {
    const f = flakes.current;
    const geo = geometry.current;
    const mat = material.current;
    const pts = points.current;
    if (!f || !geo || !mat || !pts) return;
    const w = flow.current;
    const reduced = w.reduced;
    const dt = Math.min(delta, 0.05);
    w.time += dt;
    const t = w.time;

    w.energy = Math.max(w.energy, takeDragKick() * 0.55);
    const energy = w.energy;

    // 스노우볼이 돌면 안의 물은 조금 늦게 따라옵니다. 그 차이만큼 눈이 휘돕니다.
    const rotY = pts.parent ? pts.parent.rotation.y : 0;
    const turned = Number.isNaN(w.lastRot) || delta > 0.1 ? 0 : rotY - w.lastRot;
    w.lastRot = rotY;
    const globeSpin = reduced ? 0 : THREE.MathUtils.clamp(turned / dt, -7, 7);
    w.waterSpin += (globeSpin - w.waterSpin) * (1 - Math.exp(-dt / 1.3));
    const spin = reduced ? 0 : w.waterSpin - globeSpin;

    w.tumbleAngle += dt * 1.4;
    const tx = Math.cos(w.tumbleAngle) * w.tumble;
    const tz = Math.sin(w.tumbleAngle) * w.tumble;
    const calm = energy < 0.08 && w.tumble < 0.3;
    const ripple = energy * 0.85;
    const fallScale = reduced ? 5 : 1;

    const { pos, vel, seed } = f;
    for (let i = 0; i < COUNT; i++) {
      const x = i * 3;
      const y = x + 1;
      const z = x + 2;

      if (f.state[i] !== AIR) {
        if (energy > f.wake[i]) {
          // 바닥에 있던 눈이 떠오릅니다
          f.state[i] = AIR;
          f.fade[i] = Math.max(f.fade[i], 0.6);
          vel[x] = rand(-0.5, 0.5) * energy;
          vel[y] = rand(0.4, 1.3) * energy;
          vel[z] = rand(-0.5, 0.5) * energy;
        } else if (f.state[i] === FADING) {
          f.fade[i] -= dt / 0.7;
          if (f.fade[i] <= 0) {
            // 위쪽에서 다시 내려옵니다
            f.fade[i] = 0;
            f.state[i] = AIR;
            placeInAir(f, i, 0.4, 0.85);
          }
          continue;
        } else {
          // 내려앉은 눈은 쌓인 눈에 스며들듯 옅어집니다
          if (f.fade[i] > 0) f.fade[i] = Math.max(0, f.fade[i] - dt / 1.5);
          continue;
        }
      }
      if (f.fade[i] < 1) f.fade[i] = Math.min(1, f.fade[i] + dt / 1.2);

      const px = pos[x];
      const py = pos[y];
      const pz = pos[z];
      const a = seed[i * 4];
      const b = seed[i * 4 + 1];
      const c = seed[i * 4 + 2];
      const beat = seed[i * 4 + 3];

      // 물의 큰 흐름: 세로축으로 돌기 + 위아래로 뒤집히기
      let ux = spin * pz - tz * py;
      let uy = tz * px - tx * pz;
      let uz = -spin * px + tx * py;
      // 잔물결: 눈송이마다 다른 박자로 부드럽게 밀립니다. 흔들린 직후에는 위로 떠오르는 쪽이 큽니다.
      if (ripple > 0.01) {
        ux += ripple * (Math.sin(t * beat * 2.1 + a) + 0.5 * Math.sin(t * beat * 4.7 + b));
        uy += ripple * (0.55 + 0.7 * Math.sin(t * beat * 1.7 + c));
        uz += ripple * (Math.sin(t * beat * 2.4 + b) + 0.5 * Math.sin(t * beat * 5.3 + c));
      }
      // 살랑이며 가라앉기
      if (!reduced) {
        ux += f.sway[i] * Math.sin(t * beat + a);
        uz += f.sway[i] * Math.cos(t * beat * 0.83 + c);
      }
      uy -= f.fall[i] * fallScale * (1 + 0.3 * Math.sin(t * beat * 1.3 + b));

      // 눈은 물의 흐름을 조금 늦게 따라갑니다
      const k = 1 - Math.exp(-dt * f.follow[i]);
      let vx = vel[x] + (ux - vel[x]) * k;
      let vy = vel[y] + (uy - vel[y]) * k;
      let vz = vel[z] + (uz - vel[z]) * k;
      let nx = px + vx * dt;
      let ny = py + vy * dt;
      let nz = pz + vz * dt;

      // 유리: 튕기지 않고 면을 따라 미끄러집니다
      const dist = Math.hypot(nx, ny, nz);
      if (dist > R) {
        const s = R / dist;
        const out = (vx * nx + vy * ny + vz * nz) / dist;
        if (out > 0) {
          vx -= (out * nx) / dist;
          vy -= (out * ny) / dist;
          vz -= (out * nz) / dist;
        }
        nx *= s;
        ny *= s;
        nz *= s;
      }

      // 트리: 뚫고 지나가지 않고 겉을 타고 내려옵니다
      if (ny < TREE_TOP && ny > TREE_BOTTOM) {
        const limit = (TREE_TOP - ny) * TREE_SLOPE;
        const r = Math.hypot(nx, nz);
        if (r < limit) {
          const dx = r > 1e-4 ? nx / r : 1;
          const dz = r > 1e-4 ? nz / r : 0;
          const inward = vx * dx + vz * dz;
          if (inward < 0) {
            vx -= inward * dx;
            vz -= inward * dz;
          }
          nx = dx * limit;
          nz = dz * limit;
        }
      }

      // 바닥
      const ground = groundAt(nx * nx + nz * nz);
      if (ny <= ground) {
        ny = ground;
        if (vy < 0) vy = 0;
        if (calm || energy < f.wake[i] * 0.6) {
          vx = vy = vz = 0;
          f.state[i] = f.ambient[i] && !reduced ? FADING : REST;
        }
      }

      pos[x] = nx;
      pos[y] = ny;
      pos[z] = nz;
      vel[x] = vx;
      vel[y] = vy;
      vel[z] = vz;
    }

    w.energy = energy * Math.exp(-dt * (reduced ? 3 : 0.9));
    w.tumble *= Math.exp(-dt / 0.9);

    geo.attributes.position.needsUpdate = true;
    geo.attributes.aFade.needsUpdate = true;
    mat.uniforms.uScale.value = state.gl.domElement.height * 0.5;
    mat.uniforms.uMinPx.value = 1.6 * state.viewport.dpr;
    mat.uniforms.uTime.value = t;
    mat.uniforms.uTwinkle.value = reduced ? 0 : 1;
  });

  return (
    <points ref={points} frustumCulled={false}>
      <bufferGeometry ref={geometry} />
      <shaderMaterial
        ref={material}
        vertexShader={VERTEX}
        fragmentShader={FRAGMENT}
        uniforms={uniforms}
        transparent
        depthWrite={false}
      />
    </points>
  );
}
