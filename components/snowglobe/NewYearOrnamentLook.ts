// 새해 오너먼트 세 가지(복주머니 · 방패연 · 매듭 노리개)의 재질 느낌입니다. (차명근)
// 모델은 매끈한 덩어리라서 그대로 그리면 플라스틱처럼 보입니다. 고른 색은 그대로 두고, 그 위에 결과 광택을 그릴 때 얹습니다.
//  - 복주머니: 비단(공단). 세로 실 방향으로 길게 퍼지는 광택, 실의 굵기 차이로 생기는 결. 끈은 꼰 실
//  - 방패연: 한지. 광택 없이 얼룩지고, 닥 섬유가 군데군데 비칩니다. 살은 대나무 색
//  - 매듭 노리개: 매듭은 꼰 끈, 술은 가는 비단실 가닥, 술 머리는 실로 감은 모습. 가락지는 옥처럼 매끈하게
// 텍스처 이미지는 쓰지 않습니다 (모델 파일 크기가 늘지 않게). 화면에서 작게 보일 때는 가는 결을 꺼서 지글거리지 않게 합니다.
//
// 자리는 모델을 만들 때의 좌표로 나눕니다 (scripts/blender/ornaments_v2.py 의 값. 웹에서는 위가 +Y, 앞이 +Z).
// 모델의 모양을 바꾸면 아래 숫자(술이 시작되는 높이, 가락지 자리, 연의 테두리 등)도 함께 맞춰야 합니다.

import * as THREE from "three";

export type NewYearShape = "pouch" | "kite" | "norigae";
const SHAPES: string[] = ["pouch", "kite", "norigae"];
export const isNewYearShape = (shape: string | undefined): shape is NewYearShape => !!shape && SHAPES.includes(shape);

const BAMBOO = "#c9a467"; // 방패연의 대나무 살

const VERTEX_DECLARE = "uniform mat4 uNyOrigin;\nvarying vec3 vNyPos;\nvarying vec3 vNyUp;";
// vNyPos: 모델을 만들 때의 좌표, vNyUp: 오너먼트의 위쪽 방향(화면 기준). 실이 흐르는 방향으로 씁니다
const VERTEX_BODY = "vNyPos = (uNyOrigin * vec4(position, 1.0)).xyz;\nvNyUp = normalize(normalMatrix * vec3(0.0, 1.0, 0.0));";

const FRAGMENT_DECLARE = `
uniform vec3 uNyBamboo;
varying vec3 vNyPos;
varying vec3 vNyUp;
float nyHash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
float nyNoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(nyHash(i), nyHash(i + vec3(1.0, 0.0, 0.0)), f.x), mix(nyHash(i + vec3(0.0, 1.0, 0.0)), nyHash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
    mix(mix(nyHash(i + vec3(0.0, 0.0, 1.0)), nyHash(i + vec3(1.0, 0.0, 1.0)), f.x), mix(nyHash(i + vec3(0.0, 1.0, 1.0)), nyHash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
    f.z);
}
float nyFbm(vec3 p) { return (nyNoise(p) * 0.5 + nyNoise(p * 2.03) * 0.25 + nyNoise(p * 4.01) * 0.125 + nyNoise(p * 8.07) * 0.0625) / 0.9375; }
// 줄무늬(sin)가 화면의 한 점보다 촘촘해지면 0 으로 (작게 보일 때 가는 결을 끕니다)
float nyFade(float v) { return 1.0 - smoothstep(0.22, 0.6, fwidth(v) / 6.2832); }
// 꼰 끈: 비스듬히 감긴 가닥의 골. 0(골) ~ 1(가닥의 등)
float nyRope(vec3 p, float turns) {
  float v = dot(p, vec3(0.62, 0.62, 0.48)) * turns;
  return mix(0.6, 0.5 + 0.5 * sin(v), nyFade(v));
}
// 한지의 닥 섬유: 길고 가는 선이 여러 방향으로 흩어져 있습니다
float nyFiber(vec2 q) {
  float fine = 1.0 - smoothstep(0.12, 0.4, fwidth(q.x) * 46.0);
  q += (vec2(nyNoise(vec3(q * 3.0, 11.0)), nyNoise(vec3(q * 3.0, 17.0))) - 0.5) * 0.16; // 섬유가 곧지 않고 살짝 휘게
  float a = pow(1.0 - abs(nyNoise(vec3(q.x * 5.0 + q.y * 2.0, q.y * 46.0 - q.x * 8.0, 2.0)) * 2.0 - 1.0), 16.0);
  float b = pow(1.0 - abs(nyNoise(vec3(q.y * 5.0 - q.x * 2.0, q.x * 46.0 + q.y * 8.0, 5.0)) * 2.0 - 1.0), 16.0);
  float c = pow(1.0 - abs(nyNoise(vec3((q.x + q.y) * 4.0, (q.x - q.y) * 34.0, 9.0)) * 2.0 - 1.0), 16.0);
  return (a + b + c * 0.7) * fine;
}
// 한지 색: 얼룩지고, 섬유가 희게 비치고, 티가 군데군데 박혀 있습니다. w: 종이인 정도(0 이면 그대로)
vec3 nyHanji(vec3 color, vec2 q, float mottle, float fiber, float w) {
  vec3 paper = mix(color, vec3(0.96, 0.9, 0.78), 0.1) * (0.82 + 0.26 * mottle);
  paper = mix(paper, vec3(1.0, 0.96, 0.88), fiber * 0.22);
  float speck = step(0.988, nyHash(floor(vec3(q * 70.0, 1.0)))) * (1.0 - smoothstep(0.12, 0.4, fwidth(q.x) * 70.0));
  return mix(color, paper * (1.0 - 0.28 * speck), w);
}
// 실 방향(t)을 따라 길게 퍼지는 광택. 비단 · 실 가닥처럼 결이 한쪽으로 난 표면에 생깁니다
float nySilk(vec3 n, vec3 t, vec3 v, float shift, float power) {
  t = normalize(t - n * dot(n, t) + n * shift);
  vec3 l = normalize(vec3(0.3, 0.75, 0.6));
  vec3 h = normalize(l + v);
  float th = dot(t, h);
  return pow(sqrt(max(1.0 - th * th, 0.0)), power) * clamp(dot(n, l) * 0.6 + 0.4, 0.0, 1.0);
}
// 천의 가장자리가 부옇게 밝아지는 정도
float nyRim(vec3 n, vec3 v) { return pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 3.0); }
`;

// 그릴 때 끼워 넣는 부분: color(색 · 결), rough(거칠기), glow(광택 · 비침)
type Look = { color: string[]; rough?: string[]; glow: string[] };

const LOOKS: Record<NewYearShape, Record<"main" | "accent", Look>> = {
  pouch: {
    // 주머니 천: 세로로 흐르는 공단
    main: {
      color: [
        "float nyAng = atan(vNyPos.x, vNyPos.z - 0.14);",
        "float nyWarp = nyAng * 150.0;",
        "float nySlub = nyFbm(vec3(nyAng * 24.0, vNyPos.y * 2.5, 3.0));", // 실 굵기 차이로 생기는 세로 결
        "float nyCrease = nyFbm(vNyPos * 3.2);", // 천이 구겨진 얼룩
        "diffuseColor.rgb *= 0.74 + 0.3 * nySlub + 0.1 * (nyCrease - 0.5) + 0.05 * sin(nyWarp) * nyFade(nyWarp);",
      ],
      glow: [
        "vec3 nyView = normalize(vViewPosition);",
        "float nyShine = nySilk(normal, vNyUp, nyView, (nySlub - 0.5) * 0.8, 44.0);",
        "totalEmissiveRadiance += nyShine * mix(diffuseColor.rgb, vec3(1.0), 0.3) * 0.34;",
        "totalEmissiveRadiance += nyRim(normal, nyView) * diffuseColor.rgb * 0.14;",
      ],
    },
    // 끈과 매듭은 꼰 실, 끈 끝의 술은 실 가닥, 배의 둥근 장식은 매끈한 비단
    accent: {
      color: [
        "float nyBadge = step(0.545, vNyPos.z) * (1.0 - step(0.33, length(vNyPos.xy - vec2(0.0, -0.3))));",
        "float nyTassel = (1.0 - nyBadge) * (1.0 - smoothstep(-0.09, -0.05, vNyPos.y));",
        "float nyCord = (1.0 - nyBadge) * (1.0 - nyTassel);",
        "float nyThread = atan(abs(vNyPos.x) - 0.19, vNyPos.z - 0.44) * 16.0;",
        "float nyShade = mix(1.0, mix(0.66, 1.08, nyRope(vNyPos, 190.0)), nyCord);",
        "nyShade = mix(nyShade, mix(0.9, 0.9 + 0.2 * sin(nyThread), nyFade(nyThread)), nyTassel);",
        "diffuseColor.rgb *= nyShade;",
      ],
      rough: ["roughnessFactor = mix(roughnessFactor, 0.38, nyBadge);"],
      glow: ["totalEmissiveRadiance += nyRim(normal, normalize(vViewPosition)) * diffuseColor.rgb * 0.22;"],
    },
  },
  kite: {
    // 연 종이와 가운데 꼬리: 한지
    main: {
      color: [
        "float nyMottle = nyFbm(vec3(vNyPos.xy * 5.0, 0.7));",
        "float nyThin = nyFiber(vNyPos.xy);",
        "diffuseColor.rgb = nyHanji(diffuseColor.rgb, vNyPos.xy, nyMottle, nyThin, 1.0);",
      ],
      // 종이가 얇은 곳은 빛이 더 비칩니다
      glow: ["totalEmissiveRadiance *= 0.55 + 0.95 * nyMottle;", "totalEmissiveRadiance += nyThin * 0.03;"],
    },
    // 테두리 · 방구멍 테 · 꼭지 · 양옆 꼬리는 한지, 나머지(살)는 대나무
    accent: {
      color: [
        "vec2 nyQ = vNyPos.xy;",
        "float nyTail = 1.0 - step(-0.66, nyQ.y);",
        "float nyTape = max(step(0.67, abs(nyQ.x)), max(step(0.93, nyQ.y), 1.0 - step(-0.57, nyQ.y)));",
        "float nyHole = 1.0 - step(0.06, abs(length(nyQ - vec2(0.0, 0.18)) - 0.286));",
        "float nyDot = 1.0 - step(0.17, length(nyQ - vec2(0.0, 0.596)));",
        "float nyPaper = clamp(nyTail + nyTape + nyHole + nyDot, 0.0, 1.0);",
        "float nyMottle = nyFbm(vec3(nyQ * 5.0, 0.7));",
        "vec3 nyStick = uNyBamboo * (0.8 + 0.4 * nyFbm(vNyPos * 26.0));", // 대나무의 얼룩과 결
        "diffuseColor.rgb = mix(nyStick, nyHanji(diffuseColor.rgb, nyQ, nyMottle, nyFiber(nyQ), 1.0), nyPaper);",
      ],
      rough: ["roughnessFactor = mix(0.5, roughnessFactor, nyPaper);"],
      glow: ["totalEmissiveRadiance = mix(uNyBamboo * 0.1, totalEmissiveRadiance * (0.55 + 0.95 * nyMottle), nyPaper);"],
    },
  },
  norigae: {
    // 위는 꼰 끈으로 맺은 매듭, 가운데는 실로 감은 술 머리, 아래는 가는 비단실 술
    main: {
      color: [
        "float nyTassel = 1.0 - smoothstep(-0.52, -0.5, vNyPos.y);",
        "float nyKnot = step(-0.25, vNyPos.y);",
        "float nyHead = (1.0 - nyTassel) * (1.0 - nyKnot);",
        "float nyThread = atan(vNyPos.x, vNyPos.z - 0.12) * 72.0;", // 술 둘레의 실 가닥
        "float nyThreadOn = nyFade(nyThread);",
        "float nyStrand = nyHash(vec3(floor(nyThread / 6.2832 + 0.25), 3.0, 7.0));", // 가닥마다 조금씩 다른 밝기
        "float nyLong = nyFbm(vec3(nyThread * 0.35, vNyPos.y * 3.0, 1.0));", // 가닥이 겹치며 생기는 세로 얼룩
        "float nyWrap = vNyPos.y * 380.0;",
        "float nyShade = nyKnot * mix(0.66, 1.08, nyRope(vNyPos, 150.0));",
        "nyShade += nyHead * mix(0.92, 0.92 + 0.16 * sin(nyWrap), nyFade(nyWrap));",
        "nyShade += nyTassel * (0.8 + 0.3 * nyLong) * mix(0.95, (0.62 + 0.46 * (0.5 + 0.5 * sin(nyThread))) * (0.84 + 0.32 * nyStrand), nyThreadOn);",
        "diffuseColor.rgb *= nyShade;",
      ],
      glow: [
        "vec3 nyView = normalize(vViewPosition);",
        "float nyShine = nySilk(normal, vNyUp, nyView, (nyStrand - 0.5) * 0.5 * nyThreadOn + (nyLong - 0.5) * 0.6, 16.0);",
        "totalEmissiveRadiance += nyTassel * nyShine * mix(diffuseColor.rgb, vec3(1.0), 0.45) * 0.6;",
        "totalEmissiveRadiance += (1.0 - nyTassel) * nyRim(normal, nyView) * diffuseColor.rgb * 0.25;",
      ],
    },
    // 끈과 가운데 매듭은 꼰 실, 가락지는 옥처럼 매끈하게
    accent: {
      color: [
        "float nyJade = 1.0 - step(0.085, abs(length(vNyPos.xy - vec2(0.0, -0.1)) - 0.15));",
        "diffuseColor.rgb *= mix(mix(0.66, 1.08, nyRope(vNyPos, 170.0)), 1.0, nyJade);",
      ],
      rough: ["roughnessFactor = mix(roughnessFactor, 0.16, nyJade);"],
      glow: ["totalEmissiveRadiance += (1.0 - nyJade) * nyRim(normal, normalize(vViewPosition)) * diffuseColor.rgb * 0.2;"],
    },
  },
};

// 재질의 기본 값. 천 · 끈은 광택을 낮추고 부연 윤기(sheen)를 주고, 한지는 광택을 없앱니다
const BASE: Record<NewYearShape, Record<"main" | "accent", { roughness: number; sheen: number; glow: number }>> = {
  pouch: { main: { roughness: 0.5, sheen: 0.35, glow: 0.8 }, accent: { roughness: 0.7, sheen: 0.4, glow: 1 } },
  kite: { main: { roughness: 0.96, sheen: 0, glow: 1.5 }, accent: { roughness: 0.96, sheen: 0, glow: 1.5 } },
  norigae: { main: { roughness: 0.56, sheen: 0.6, glow: 1 }, accent: { roughness: 0.7, sheen: 0.4, glow: 1 } },
};

// 새해 오너먼트의 재질에 질감을 입힙니다. 색(material.color)과 스스로 내는 빛은 부르는 쪽에서 먼저 정합니다.
//  - origin: 모델 파일 안에서 이 부분이 놓인 자리 (압축된 좌표를 만들 때의 좌표로 되돌립니다)
export function applyNewYearLook(material: THREE.MeshStandardMaterial, shape: NewYearShape, role: "main" | "accent", origin: THREE.Matrix4) {
  const look = LOOKS[shape][role];
  const base = BASE[shape][role];
  material.metalness = 0;
  material.roughness = base.roughness;
  material.emissiveIntensity *= base.glow;
  const cloth = material as THREE.MeshPhysicalMaterial;
  if (cloth.isMeshPhysicalMaterial) {
    cloth.clearcoat = 0; // 유리 같은 코팅을 없앱니다 (플라스틱처럼 보이던 까닭)
    cloth.sheen = base.sheen;
    cloth.sheenRoughness = 0.45;
    cloth.sheenColor.copy(material.color).lerp(new THREE.Color("#ffffff"), 0.35);
  }
  const bamboo = new THREE.Color(BAMBOO);
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uNyOrigin = { value: origin };
    shader.uniforms.uNyBamboo = { value: bamboo };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\n" + VERTEX_DECLARE)
      .replace("#include <begin_vertex>", "#include <begin_vertex>\n" + VERTEX_BODY);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\n" + FRAGMENT_DECLARE)
      .replace("#include <color_fragment>", ["#include <color_fragment>", ...look.color].join("\n"))
      .replace("#include <roughnessmap_fragment>", ["#include <roughnessmap_fragment>", ...(look.rough ?? [])].join("\n"))
      .replace("#include <emissivemap_fragment>", ["#include <emissivemap_fragment>", ...look.glow].join("\n"));
  };
  material.customProgramCacheKey = () => "newyear-" + shape + "-" + role;
}
