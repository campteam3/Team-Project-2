"use client";

// 생일 케이크의 촛불. 모델에 들어 있는 불꽃 모양(굳은 모형처럼 보임)을 숨기고, 그 자리에 일렁이는 불꽃을 그립니다. (김미영)
//  - 불꽃: 늘 화면을 향하는 얇은 판에, 물방울 모양 불꽃을 셰이더로 그립니다. 초마다 다른 박자로 흔들리고 길이가 조금씩 달라집니다.
//    심지 쪽은 푸르고, 가운데는 희고 밝으며, 가장자리로 갈수록 주황으로 옅어집니다.
//  - 빛무리: 불꽃 둘레의 은은한 빛 (트리 꼭대기 별처럼, 밝은 부분은 장면의 빛 번짐이 더 번지게 합니다).
//  - 불빛: 케이크 윗면을 비추는 빛이 불꽃에 맞춰 조금씩 흔들립니다.
// 자리는 lib/birthday-slots.json 의 flames (scripts/blender/export_birthday.py 가 모델에서 뽑음). 좌표는 모델 원본 그대로입니다.

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import birthdaySlotData from "@/lib/birthday-slots.json";

type Flame = { position: [number, number, number]; height: number };
const FLAMES = (birthdaySlotData as unknown as { flames: Flame[] }).flames;

// 불꽃 판의 크기: 모델 불꽃 높이의 몇 배 (일렁이며 길어질 여유를 둡니다)
const TALL = 2.3;
const WIDE = 1.5;
// 빛무리의 반지름 (불꽃 높이의 몇 배)
const HALO = 3.4;

const VERTEX = /* glsl */ `
  uniform vec2 uSize;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    // 판의 가운데 아래(불꽃이 심지에 닿는 곳)를 기준으로, 늘 화면을 향하되 위아래는 세계의 위쪽을 따릅니다.
    vec4 base = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    float scale = length(modelViewMatrix[0].xyz);
    vec3 up = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
    base.xyz += vec3(1.0, 0.0, 0.0) * position.x * uSize.x * scale + up * position.y * uSize.y * scale;
    gl_Position = projectionMatrix * base;
  }
`;

const FLAME_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uSeed;
  varying vec2 vUv;
  float hash(float n) { return fract(sin(n) * 43758.5453); }
  float noise(float x) {
    float i = floor(x);
    float f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(hash(i), hash(i + 1.0), f);
  }
  void main() {
    float t = uTime + uSeed * 17.0;
    // 길이가 조금씩 달라집니다 (느린 숨 + 빠른 떨림)
    float tall = 0.8 + 0.12 * noise(t * 2.3) + 0.08 * noise(t * 9.0 + 4.0);
    float y = vUv.y / tall;
    // 위로 갈수록 크게 흔들립니다. 심지 쪽은 거의 움직이지 않습니다.
    float sway = (noise(t * 3.1 + 7.0) - 0.5) * 0.34 + (noise(t * 11.0 + y * 3.0) - 0.5) * 0.16;
    float x = (vUv.x - 0.5) * 2.0 - sway * y * y;
    // 물방울 모양: 아래가 통통하고 위로 뾰족하게 모입니다
    float width = 0.8 * pow(clamp(y, 0.0, 1.0), 0.42) * pow(clamp(1.0 - y, 0.0, 1.0), 0.78) + 0.02;
    float d = abs(x) / width;
    float inside = (1.0 - smoothstep(0.55, 1.0, d)) * step(0.0, y) * (1.0 - step(1.0, y));
    if (inside < 0.004) discard;
    // 가운데의 희고 밝은 속불꽃 (아래쪽에 몰려 있습니다)
    float core = (1.0 - smoothstep(0.0, 0.62, d)) * (1.0 - smoothstep(0.35, 0.95, y));
    vec3 outer = mix(vec3(1.0, 0.36, 0.04), vec3(1.0, 0.62, 0.12), 1.0 - smoothstep(0.2, 0.9, y));
    vec3 color = mix(outer, vec3(1.0, 0.93, 0.62), smoothstep(0.0, 0.75, core));
    color = mix(color, vec3(1.0, 0.97, 0.82), smoothstep(0.7, 1.0, core));
    // 심지 바로 위의 푸른 불
    float blue = (1.0 - smoothstep(0.0, 0.2, y)) * 0.75;
    color = mix(color, vec3(0.3, 0.55, 1.0), blue * (1.0 - core * 0.5));
    float alpha = inside * mix(0.95, 0.55, blue);
    // 밝은 곳은 빛 번짐이 생기도록 1 보다 밝게 내보냅니다
    gl_FragColor = vec4(color * (1.05 + 0.7 * core) * alpha, alpha);
  }
`;

const HALO_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uSeed;
  varying vec2 vUv;
  float hash(float n) { return fract(sin(n) * 43758.5453); }
  float noise(float x) {
    float i = floor(x);
    float f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(hash(i), hash(i + 1.0), f);
  }
  void main() {
    float t = uTime + uSeed * 17.0;
    float r = length((vUv - 0.5) * 2.0);
    float glow = pow(clamp(1.0 - r, 0.0, 1.0), 2.4);
    float flicker = 0.8 + 0.2 * noise(t * 6.0);
    float alpha = glow * 0.62 * flicker;
    gl_FragColor = vec4(vec3(1.0, 0.62, 0.22) * alpha, alpha);
  }
`;

// 모든 불꽃이 함께 쓰는 시계 (그릴 때마다 지금 시각을 넣습니다)
const flameClock = { value: 0 };

function flameMaterial(fragmentShader: string, size: [number, number], seed: number) {
  return new THREE.ShaderMaterial({
    transparent: true,
    premultipliedAlpha: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { uTime: flameClock, uSeed: { value: seed }, uSize: { value: new THREE.Vector2(...size) } },
    vertexShader: VERTEX,
    fragmentShader,
  });
}

// still: 움직임 줄이기. 불꽃이 흔들리지 않고 멈춰 있습니다.
export default function CandleFlames({ still = false }: { still?: boolean }) {
  const light = useRef<THREE.PointLight>(null);

  const { flameGeometry, haloGeometry, items, center } = useMemo(() => {
    // 불꽃 판: 가운데 아래가 원점. 빛무리 판: 가운데가 원점.
    const flameGeometry = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
    const haloGeometry = new THREE.PlaneGeometry(1, 1);
    const items = FLAMES.map((flame, index) => {
      const h = flame.height;
      return {
        position: flame.position,
        height: h,
        flame: flameMaterial(FLAME_FRAGMENT, [h * WIDE, h * TALL], index + 1),
        halo: flameMaterial(HALO_FRAGMENT, [h * HALO * 2, h * HALO * 2], index + 1),
      };
    });
    const center = new THREE.Vector3();
    for (const flame of FLAMES) center.add(new THREE.Vector3(...flame.position));
    if (FLAMES.length) center.divideScalar(FLAMES.length);
    return { flameGeometry, haloGeometry, items, center };
  }, []);

  useFrame(({ clock }) => {
    const time = still ? 0 : clock.elapsedTime;
    flameClock.value = time;
    if (light.current) light.current.intensity = 0.55 + (still ? 0 : Math.sin(time * 9) * 0.05 + Math.sin(time * 23.7) * 0.04);
  });

  return (
    <>
      {items.map((item, index) => (
        <group key={index} position={item.position}>
          {/* 유리(9 · 10)보다 먼저 그려, 유리의 반사광이 불꽃 위에 겹치게 합니다 */}
          <mesh geometry={haloGeometry} material={item.halo} position={[0, item.height * 0.45, 0]} renderOrder={5} frustumCulled={false} />
          <mesh geometry={flameGeometry} material={item.flame} renderOrder={6} frustumCulled={false} />
        </group>
      ))}
      <pointLight ref={light} position={[center.x, center.y + 0.12, center.z]} intensity={0.55} distance={1.7} color="#ffb766" />
    </>
  );
}
