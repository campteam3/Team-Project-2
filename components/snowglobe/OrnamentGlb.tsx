"use client";

// 오너먼트 모델(public/models/ornaments.glb)을 읽고 색을 입히는 부분입니다. (이민정 님 SnowGlobeGlb.tsx 에서 옮김, 차명근)
// 스노우볼에 달린 오너먼트(SnowGlobeGlb.tsx 의 Ornaments)와, 오너먼트 하나만 크게 보여 주는 장면(기념 메시지, FEEDBACK F1)이 함께 씁니다.
// 이 파일은 스노우볼 모델(snowglobe.glb, 약 900KB)을 불러오지 않습니다. 기념 메시지 화면이 오너먼트 모델(약 40KB)만 받게 하려고 따로 뗐습니다.

import { useGLTF } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { OrnamentShape } from "@/lib/snowglobe";
import { ornamentOptionIndex } from "@/lib/theme";
import { applyNewYearLook, isNewYearShape } from "./NewYearOrnamentLook";

export const ORNAMENT_URL = "/models/ornaments.glb";
// 새해 스노우볼 전용 오너먼트(복주머니 · 방패연 · 노리개). 새해 스노우볼을 그릴 때에만 받습니다. (차명근)
export const NEWYEAR_ORNAMENT_URL = "/models/ornaments-newyear.glb";
// 생일 스노우볼 전용 토핑(머랭 키스 · 사탕 구슬 · 젤리 별). 생일 스노우볼을 그릴 때에만 받습니다. (김미영)
export const BIRTHDAY_ORNAMENT_URL = "/models/ornaments-birthday.glb";
const TEMPLATE_NAMES: Record<OrnamentShape, string> = {
  ball: "t_Orn_Ball",
  star: "t_Orn_Star",
  heart: "t_Orn_Heart",
  cane: "t_Orn_Cane",
  gift: "t_Orn_Gift",
  pouch: "t_Orn_Pouch",
  kite: "t_Orn_Kite",
  norigae: "t_Orn_Norigae",
  kiss: "t_Orn_Kiss",
  candy: "t_Orn_Candy",
  jelly: "t_Orn_Jelly",
};
const NEWYEAR_SHAPES: OrnamentShape[] = ["pouch", "kite", "norigae"];
const BIRTHDAY_SHAPES: OrnamentShape[] = ["kiss", "candy", "jelly"];
// 그 모양의 원형이 들어 있는 파일
export const ornamentUrl = (shape: OrnamentShape) => (NEWYEAR_SHAPES.includes(shape) ? NEWYEAR_ORNAMENT_URL : BIRTHDAY_SHAPES.includes(shape) ? BIRTHDAY_ORNAMENT_URL : ORNAMENT_URL);

export type TemplatePart = {
  shape: OrnamentShape;
  geometry: THREE.BufferGeometry;
  role: "main" | "accent" | "metal";
  material: THREE.MeshStandardMaterial;
  origin: THREE.Matrix4; // 모델 파일 안에서 이 부분이 놓인 자리 (새해 오너먼트의 질감이 씁니다)
};

// 오너먼트 원형(볼 · 별 · 하트 · 지팡이 사탕 · 선물 상자, 새해는 복주머니 · 방패연 · 노리개)을 부분별로 꺼냅니다. 본체 색과 무늬 색은 오너먼트마다 바꿉니다.
// url 파일에 없는 모양은 빈 목록입니다 (그리지 않음).
export function useOrnamentTemplates(url: string = ORNAMENT_URL) {
  const { scene } = useGLTF(url);
  return useMemo(() => {
    const templates: Record<OrnamentShape, TemplatePart[]> = { ball: [], star: [], heart: [], cane: [], gift: [], pouch: [], kite: [], norigae: [], kiss: [], candy: [], jelly: [] };
    for (const shape of Object.keys(TEMPLATE_NAMES) as OrnamentShape[]) {
      scene.getObjectByName(TEMPLATE_NAMES[shape])?.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh) return;
        const material = mesh.material as THREE.MeshStandardMaterial;
        const role = material.name.startsWith("Orn_Main") ? "main" : material.name.startsWith("Orn_Accent") ? "accent" : "metal";
        mesh.updateWorldMatrix(true, false);
        templates[shape].push({ shape, geometry: mesh.geometry, role, material, origin: mesh.matrixWorld.clone() });
      });
    }
    return templates;
  }, [scene]);
}

const CREAM = "#fff5e2";
const WHITE = "#fff9f0"; // 볼 무늬의 흰색
const ROSE = "#f2779b";

// 오너먼트 색을 맑고 화사한 파스텔 톤으로 바꿉니다. 흰색 · 크림색처럼 색기가 거의 없는 색은 그대로 둡니다.
export function pastel(color: string) {
  const result = new THREE.Color(color);
  const hsl = { h: 0, s: 0, l: 0 };
  result.getHSL(hsl);
  if (hsl.s < 0.18) return result;
  const s = THREE.MathUtils.lerp(hsl.s, 1, 0.75);
  const l = THREE.MathUtils.lerp(hsl.l, 0.62, 0.7);
  return result.setHSL(hsl.h, s, l);
}

// 볼 오너먼트의 무늬 (이민정). 모델은 민무늬 공이고, 무늬는 그릴 때 색으로 입힙니다.
//  - swirl: 두 색이 같은 굵기로 비스듬히 감기는 줄무늬 (사탕 지팡이처럼)
//  - bands: 두 번째 색 바탕에 본체 색 세로 띠 (띠 가장자리는 조금 짙게)
//  - plain: 무늬 없이 본체 색 하나 (표면 재질만 입힙니다)
export type BallPattern = "swirl" | "bands" | "plain";

const GOLD = "#e3bd74"; // 금색. 반짝이 가루를 입힌 듯한 차분한 금색입니다
const DEEP_RED = "#b3101d"; // 금색과 짝을 이루는 짙은 빨강

// 볼의 모습. 고르는 색(lib/theme.ts 의 ORNAMENT_OPTIONS)의 순서와 같습니다.
// 빨강 · 금색 · 빨강 + 금색에만 무늬가 있고, 파랑 · 초록 · 분홍은 민무늬입니다 (여섯 색 모두 무늬가 있으면 트리가 어지러워 보여서)
//  - color: 본체 색. 비우면 고른 색을 그대로 씁니다(화사하게 보정)
//  - second: 무늬의 두 번째 색(민무늬에는 없음). gold: 금속처럼 반짝이는 부분("body" 본체, "second" 두 번째 색)
//  - satin: 유리 같은 광택 대신, 빛이 넓고 부드럽게 퍼지는 고운 펄(새틴) 표면
type BallLook = { pattern: BallPattern; color?: string; second?: string; gold?: "body" | "second"; satin?: boolean };
const BALL_LOOKS: BallLook[] = [
  { pattern: "swirl", second: WHITE }, // 빨강: 빨강 + 흰색 줄무늬
  { pattern: "bands", color: GOLD, second: WHITE, gold: "body" }, // 금색: 흰 바탕에 금색 띠
  { pattern: "swirl", color: DEEP_RED, second: GOLD, gold: "second" }, // 짙은 빨강 + 금색 줄무늬
  { pattern: "plain", color: "#6f9cf2", satin: true }, // 펄이 들어간 파랑: 민무늬 파스텔 파랑, 고운 펄 표면
  { pattern: "plain", satin: true }, // 초록: 민무늬, 고운 펄 표면
  { pattern: "plain", satin: true }, // 분홍: 민무늬, 고운 펄 표면
];

// 볼이 아닌 모양(별 · 하트 · 지팡이 사탕 · 선물 상자)의 모습. 순서는 볼과 같습니다.
// 본체는 별 · 하트의 쿠키, 지팡이 사탕의 색 줄, 선물 상자의 상자이고, 무늬는 아이싱, 지팡이 사탕의 흰 줄, 선물 상자의 리본입니다. 금색과 빨강 + 금색만 따로 정하고, 나머지는 고른 색 그대로입니다 (본체는 고른 색, 아이싱은 크림색)
//  - color: 본체 색. gold: 금색으로 그릴 부분("body" 본체, "accent" 아이싱)
type CookieLook = { color: string; gold: "body" | "accent" };
const COOKIE_LOOKS: (CookieLook | undefined)[] = [
  undefined, // 빨강
  { color: GOLD, gold: "body" }, // 금색 본체에 크림색 아이싱
  { color: DEEP_RED, gold: "accent" }, // 짙은 빨강 본체에 금색 아이싱
];

const RED_GOLD_OPTION = 2; // 고르는 색 가운데 "빨강과 금색"의 순서
const SWIRL_COUNT = 5; // 비스듬한 줄무늬: 한 바퀴에 본체 색 줄 수
const BAND_COUNT = 8; // 세로 띠: 한 바퀴에 띠 수
const BAND_WIDTH = 0.6; // 세로 띠가 차지하는 비율 (나머지는 흰 바탕)
const BAND_EDGE = 0.1; // 띠 가장자리의 짙은 선이 띠에서 차지하는 비율
// 금색 부분은 오너먼트 고리처럼 금속으로 그립니다. 다만 공은 면이 넓어 어두운 밤 배경이 그대로 비치면 검게 죽으므로,
// 금속 느낌을 조금 낮추고 짙은 금색 빛(GOLD_FILL)으로 어두운 곳을 채웁니다
const GOLD_METAL = 0.6;
const GOLD_ROUGH = 0.45;
const GOLD_FILL = "#b4863a";
const GOLD_GLOW = 0.6; // 금색 부분이 스스로 내는 빛
const GOLD_GLOW_HIGHLIGHT = 0.95; // 빛나게 보여 줄 때
const GLITTER_CELLS = 56; // 금색 반짝이 가루의 알갱이 크기 (공의 반지름을 이만큼으로 나눈 칸)
// 새틴(고운 펄) 표면: 유리 같은 코팅을 줄이고 조금 거칠게 해서 빛이 넓게 퍼지게 합니다
const SATIN_METAL = 0.3;
const SATIN_ROUGH = 0.5;
const SATIN_GLOW = 0.32; // 어두운 밤 배경에서 색이 죽지 않게 제 색으로 내는 빛
const SATIN_GLOW_HIGHLIGHT = 0.7; // 빛나게 보여 줄 때
const SATIN_CELLS = 80; // 고운 입자의 크기 (공의 반지름을 이만큼으로 나눈 칸)

// 볼 본체 재질에 무늬를 입힙니다. 공의 가운데에서 본 방향(경도 · 위도)으로 줄을 나눕니다.
//  - second: 무늬의 두 번째 색, secondGlow: 그 색이 스스로 내는 빛 (본체 색의 빛과 섞이지 않게 따로 줍니다)
//  - secondMetal · secondRough: 두 번째 색 부분의 금속 느낌(0~1)과 거칠기. satin: 넓게 퍼지는 광택과 고운 입자를 더합니다
function applyBallPattern(
  material: THREE.MeshStandardMaterial,
  geometry: THREE.BufferGeometry,
  look: { pattern: BallPattern; second: THREE.Color; secondGlow: THREE.Color; secondMetal: number; secondRough: number; satin: boolean; glitter?: "body" | "second" },
) {
  const { pattern, satin, glitter } = look;
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  const center = geometry.boundingBox?.getCenter(new THREE.Vector3()) ?? new THREE.Vector3();
  const band = Math.cos(Math.PI * BAND_WIDTH).toFixed(4);
  const inner = Math.cos(Math.PI * BAND_WIDTH * (1 - BAND_EDGE * 2)).toFixed(4);
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uBallCenter = { value: center };
    shader.uniforms.uBallSecond = { value: look.second };
    shader.uniforms.uBallSecondGlow = { value: look.secondGlow };
    shader.uniforms.uBallSecondMetal = { value: look.secondMetal };
    shader.uniforms.uBallSecondRough = { value: look.secondRough };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform vec3 uBallCenter;\nvarying vec3 vBallDir;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvBallDir = position - uBallCenter;");
    const mix = {
      swirl: [
        "float ballWave = sin(float(" + SWIRL_COUNT + ") * (ballLng + ballLat));",
        "float ballSoft = fwidth(ballWave) * 0.75 + 0.0001;",
        "float ballSecond = smoothstep(-ballSoft, ballSoft, ballWave);",
        "float ballEdge = 0.0;",
      ],
      bands: [
        "float ballWave = cos(float(" + BAND_COUNT + ") * ballLng);",
        "float ballSoft = fwidth(ballWave) * 0.75 + 0.0001;",
        "float ballBand = smoothstep(" + band + " - ballSoft, " + band + " + ballSoft, ballWave);",
        "float ballSecond = 1.0 - ballBand;",
        "float ballEdge = ballBand * (1.0 - smoothstep(" + inner + " - ballSoft, " + inner + " + ballSoft, ballWave));",
      ],
      plain: ["float ballSecond = 0.0;", "float ballEdge = 0.0;"],
    }[pattern];
    // 새틴: 빛 받는 가운데가 넓고 부드럽게 밝아지고, 아주 고운 입자가 보는 각도에 따라 은은하게 반짝입니다.
    // 화면에서 작게 보일 때는 입자를 끕니다(지글거림 방지). 그때도 넓은 광택은 남습니다
    const glow = satin
      ? [
          "vec3 satinView = normalize(vViewPosition);",
          "float satinFace = clamp(dot(normal, satinView), 0.0, 1.0);",
          "totalEmissiveRadiance += (1.0 - ballSecond) * pow(satinFace, 2.5) * emissive;",
          "vec3 satinRand = ballHash(floor(ballDir * float(" + SATIN_CELLS + ")));",
          "vec3 satinFacet = normalize(normal + (satinRand - 0.5) * 1.5);",
          "float satinSpark = pow(max(dot(satinFacet, normalize(satinView + vec3(0.25, 0.6, 0.75))), 0.0), 14.0);",
          "float satinFine = 1.0 - smoothstep(0.35, 0.9, fwidth(ballDir.x) * float(" + SATIN_CELLS + "));",
          "totalEmissiveRadiance += satinSpark * satinFine * vec3(0.8, 0.86, 1.0) * 0.4;",
        ]
      : [];
    // 반짝이 가루(금색 부분에만): 알갱이마다 밝기가 조금씩 다르고, 보는 각도에 따라 반짝입니다. 작게 보일 때는 끕니다
    const glitterMask = glitter === "second" ? "ballSecond" : "(1.0 - ballSecond)";
    const grain = glitter
      ? [
          "vec3 glitterRand = ballHash(floor(ballDir * float(" + GLITTER_CELLS + ")));",
          "float glitterFine = 1.0 - smoothstep(0.35, 0.9, fwidth(ballDir.x) * float(" + GLITTER_CELLS + "));",
          "diffuseColor.rgb *= 1.0 + " + glitterMask + " * glitterFine * (glitterRand.x - 0.5) * 0.6;",
        ]
      : [];
    const sparkle = glitter
      ? [
          "vec3 glitterFacet = normalize(normal + (glitterRand - 0.5) * 1.6);",
          "float glitterSpark = pow(max(dot(glitterFacet, normalize(normalize(vViewPosition) + vec3(0.25, 0.6, 0.75))), 0.0), 16.0);",
          "totalEmissiveRadiance += " + glitterMask + " * glitterSpark * glitterFine * vec3(1.0, 0.9, 0.62) * 0.9;",
        ]
      : [];
    const hash =
      "vec3 ballHash(vec3 p) { return fract(sin(vec3(dot(p, vec3(12.9898, 78.233, 37.719)), dot(p, vec3(39.346, 11.135, 83.155)), dot(p, vec3(73.156, 52.235, 9.151)))) * 43758.5453); }";
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform vec3 uBallSecond;\nuniform vec3 uBallSecondGlow;\nuniform float uBallSecondMetal;\nuniform float uBallSecondRough;\nvarying vec3 vBallDir;\n" + hash)
      .replace(
        "#include <color_fragment>",
        [
          "#include <color_fragment>",
          "vec3 ballDir = normalize(vBallDir);",
          "float ballLng = atan(ballDir.x, ballDir.z);",
          "float ballLat = acos(clamp(ballDir.y, -1.0, 1.0));",
          ...mix,
          "diffuseColor.rgb = mix(diffuseColor.rgb * (1.0 - 0.3 * ballEdge), uBallSecond, ballSecond);",
          ...grain,
        ].join("\n"),
      )
      .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, uBallSecondRough, ballSecond);")
      .replace("#include <metalnessmap_fragment>", "#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, uBallSecondMetal, ballSecond);")
      .replace(
        "#include <emissivemap_fragment>",
        ["#include <emissivemap_fragment>", "totalEmissiveRadiance = mix(totalEmissiveRadiance, uBallSecondGlow, ballSecond);", ...glow, ...sparkle].join("\n"),
      );
  };
  material.customProgramCacheKey = () => "ball-" + pattern + (satin ? "-satin" : "") + (glitter ? "-glitter-" + glitter : "");
}

// 재질 전체를 볼의 금색 부분과 같은 금색(금속 느낌 + 반짝이 가루)으로 만듭니다. 색은 부르는 쪽에서 GOLD 로 정합니다
function makeGold(material: THREE.MeshStandardMaterial, highlight: boolean) {
  material.metalness = GOLD_METAL;
  material.roughness = GOLD_ROUGH;
  material.emissive.set(GOLD_FILL);
  material.emissiveIntensity = highlight ? GOLD_GLOW_HIGHLIGHT : GOLD_GLOW;
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vGlitterAt;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvGlitterAt = position;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vGlitterAt;\nvec3 glitterHash(vec3 p) { return fract(sin(vec3(dot(p, vec3(12.9898, 78.233, 37.719)), dot(p, vec3(39.346, 11.135, 83.155)), dot(p, vec3(73.156, 52.235, 9.151)))) * 43758.5453); }",
      )
      .replace(
        "#include <color_fragment>",
        [
          "#include <color_fragment>",
          "vec3 glitterRand = glitterHash(floor(vGlitterAt * float(" + GLITTER_CELLS + ")));",
          "float glitterFine = 1.0 - smoothstep(0.35, 0.9, fwidth(vGlitterAt.x) * float(" + GLITTER_CELLS + "));",
          "diffuseColor.rgb *= 1.0 + glitterFine * (glitterRand.x - 0.5) * 0.6;",
        ].join("\n"),
      )
      .replace(
        "#include <emissivemap_fragment>",
        [
          "#include <emissivemap_fragment>",
          "vec3 glitterFacet = normalize(normal + (glitterRand - 0.5) * 1.6);",
          "float glitterSpark = pow(max(dot(glitterFacet, normalize(normalize(vViewPosition) + vec3(0.25, 0.6, 0.75))), 0.0), 16.0);",
          "totalEmissiveRadiance += glitterSpark * glitterFine * vec3(1.0, 0.9, 0.62) * 0.9;",
        ].join("\n"),
      );
  };
  material.customProgramCacheKey = () => "gold-glitter";
}

// 오너먼트 하나의 재질(본체 · 무늬)을 만듭니다. 화면에서 사라지면 정리합니다.
export function useOrnamentMaterials(parts: TemplatePart[], color: string, metallic: boolean, highlight: boolean) {
  const materials = useMemo(() => {
    const mainBase = parts.find((part) => part.role === "main")?.material;
    const accentBase = parts.find((part) => part.role === "accent")?.material;
    const main = mainBase?.clone();
    // 볼은 고른 색의 순서에 따라 색 · 무늬가 정해집니다 (BALL_LOOKS)
    const mainPart = parts.find((part) => part.role === "main");
    const option = ornamentOptionIndex(color);
    // 생일 토핑(머랭 키스 · 사탕 구슬 · 젤리 별)은 본체 하나뿐이라 무늬 부분이 없습니다. 빨강 + 금색을 고르면 볼처럼 줄무늬를 색으로 입힙니다 (차명근)
    const striped = !!mainPart && BIRTHDAY_SHAPES.includes(mainPart.shape) && option === RED_GOLD_OPTION;
    const look = mainPart?.shape === "ball" ? BALL_LOOKS[option] : striped ? BALL_LOOKS[RED_GOLD_OPTION] : undefined;
    // 볼이 아닌 모양은 금색과 빨강 + 금색만 따로 정합니다 (COOKIE_LOOKS)
    const cookie = mainPart && mainPart.shape !== "ball" ? COOKIE_LOOKS[option] : undefined;
    // 새해 오너먼트(복주머니 · 방패연 · 노리개)는 천 · 한지 · 실의 질감을 입힙니다. 금색도 금속이 아니라 금색 천 · 종이로 그립니다
    const mainShape = mainPart?.shape;
    const newYear = isNewYearShape(mainShape) ? mainShape : undefined;
    const fixed = look?.color ?? cookie?.color;
    const body = fixed ? new THREE.Color(fixed) : pastel(color);
    if (main) {
      main.color.copy(body);
      // 어두운 밤 배경이 비쳐 칙칙해지지 않도록 제 색으로 은은하게 빛나게
      main.metalness = 0;
      main.roughness = 0.26;
      main.emissive.copy(body);
      main.emissiveIntensity = 0.2;
      if (metallic) {
        // 어두운 밤 배경이 비쳐 갈색으로 죽지 않도록 스스로 살짝 빛나게
        main.metalness = 0.8;
        main.roughness = 0.28;
        main.emissive.set(color);
        main.emissiveIntensity = 0.28;
      }
      if (highlight) {
        main.emissive.copy(body);
        main.emissiveIntensity = 0.55;
      }
      if (cookie?.gold === "body" && !newYear) makeGold(main, highlight);
      if (newYear && mainPart) applyNewYearLook(main, newYear, "main", mainPart.origin);
      // 볼에는 무늬를 입힙니다
      if (look && mainPart) {
        const glow = main.emissiveIntensity; // 금속이 아닌 부분이 스스로 내는 빛
        const rough = main.roughness;
        const goldGlow = highlight ? GOLD_GLOW_HIGHLIGHT : GOLD_GLOW;
        if (look.gold === "body") {
          main.metalness = GOLD_METAL;
          main.roughness = GOLD_ROUGH;
          main.emissive.set(GOLD_FILL);
          main.emissiveIntensity = goldGlow;
        }
        const satinGlow = highlight ? SATIN_GLOW_HIGHLIGHT : SATIN_GLOW;
        if (look.satin) {
          main.metalness = SATIN_METAL;
          main.roughness = SATIN_ROUGH;
          main.emissiveIntensity = satinGlow;
          const coated = main as THREE.MeshPhysicalMaterial;
          if (coated.isMeshPhysicalMaterial) {
            coated.clearcoat = 0.12;
            coated.clearcoatRoughness = 0.45;
          }
        }
        const second = new THREE.Color(look.second ?? WHITE);
        applyBallPattern(main, mainPart.geometry, {
          pattern: look.pattern,
          second,
          secondGlow: look.gold === "second" ? new THREE.Color(GOLD_FILL).multiplyScalar(goldGlow) : second.clone().multiplyScalar(glow),
          secondMetal: look.gold === "second" ? GOLD_METAL : 0,
          secondRough: look.gold === "second" ? GOLD_ROUGH : look.satin ? SATIN_ROUGH : rough,
          satin: !!look.satin,
          glitter: look.gold,
        });
      }
    }
    const accent = accentBase?.clone();
    if (accent) {
      // 무늬는 본체 색과 구분되게: 흰색에 가까운 본체에는 분홍, 그 밖에는 크림색
      const hsl = { h: 0, s: 0, l: 0 };
      body.getHSL(hsl);
      accent.color.set(hsl.l > 0.82 ? ROSE : CREAM);
      accent.emissive.copy(accent.color);
      accent.emissiveIntensity = 0.2;
      if (cookie?.gold === "accent") {
        accent.color.set(GOLD);
        if (newYear) accent.emissive.copy(accent.color);
        else makeGold(accent, highlight);
      }
      const accentPart = parts.find((part) => part.role === "accent");
      if (newYear && accentPart) applyNewYearLook(accent, newYear, "accent", accentPart.origin);
    }
    return { main, accent };
  }, [parts, color, metallic, highlight]);

  useEffect(
    () => () => {
      materials.main?.dispose();
      materials.accent?.dispose();
    },
    [materials],
  );

  return materials;
}

// 오너먼트의 부분들을 그립니다 (본체 · 무늬는 바꾼 재질, 금속 고리는 원래 재질)
export function OrnamentParts({ parts, materials }: { parts: TemplatePart[]; materials: ReturnType<typeof useOrnamentMaterials> }) {
  return (
    <>
      {parts.map((part, index) => (
        <mesh
          key={index}
          geometry={part.geometry}
          material={
            part.role === "main" ? (materials.main ?? part.material) : part.role === "accent" ? (materials.accent ?? part.material) : part.material
          }
        />
      ))}
    </>
  );
}

// 오너먼트 하나를 원점에 그립니다. 스노우볼에 달린 메시지 오너먼트와 같은 재질 규칙입니다. 크기 · 위치는 바깥 group 에서 정합니다.
export function SingleOrnament({ shape, color }: { shape: OrnamentShape; color: string }) {
  const templates = useOrnamentTemplates(ornamentUrl(shape));
  const parts = templates[shape];
  const materials = useOrnamentMaterials(parts, color, false, false);
  return <OrnamentParts parts={parts} materials={materials} />;
}

useGLTF.preload(ORNAMENT_URL);
