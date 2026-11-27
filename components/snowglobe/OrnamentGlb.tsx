"use client";

// 오너먼트 모델(public/models/ornaments.glb)을 읽고 색을 입히는 부분입니다. (이민정 님 SnowGlobeGlb.tsx 에서 옮김, 차명근)
// 스노우볼에 달린 오너먼트(SnowGlobeGlb.tsx 의 Ornaments)와, 오너먼트 하나만 크게 보여 주는 장면(기념 메시지, FEEDBACK F1)이 함께 씁니다.
// 이 파일은 스노우볼 모델(snowglobe.glb, 약 900KB)을 불러오지 않습니다. 기념 메시지 화면이 오너먼트 모델(약 40KB)만 받게 하려고 따로 뗐습니다.

import { useGLTF } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { OrnamentShape } from "@/lib/snowglobe";
import { ornamentOptionIndex } from "@/lib/theme";

export const ORNAMENT_URL = "/models/ornaments.glb";
const TEMPLATE_NAMES: Record<OrnamentShape, string> = { ball: "t_Orn_Ball", star: "t_Orn_Star", heart: "t_Orn_Heart" };

export type TemplatePart = {
  shape: OrnamentShape;
  geometry: THREE.BufferGeometry;
  role: "main" | "accent" | "metal";
  material: THREE.MeshStandardMaterial;
};

// 오너먼트 원형(볼·별·하트)을 부분별로 꺼냅니다. 본체 색과 무늬 색은 오너먼트마다 바꿉니다.
export function useOrnamentTemplates() {
  const { scene } = useGLTF(ORNAMENT_URL);
  return useMemo(() => {
    const templates: Record<OrnamentShape, TemplatePart[]> = { ball: [], star: [], heart: [] };
    for (const shape of Object.keys(TEMPLATE_NAMES) as OrnamentShape[]) {
      scene.getObjectByName(TEMPLATE_NAMES[shape])?.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh) return;
        const material = mesh.material as THREE.MeshStandardMaterial;
        const role = material.name.startsWith("Orn_Main") ? "main" : material.name.startsWith("Orn_Accent") ? "accent" : "metal";
        templates[shape].push({ shape, geometry: mesh.geometry, role, material });
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
export type BallPattern = "swirl" | "bands";

const GOLD = "#e3bd74"; // 금색. 반짝이 가루를 입힌 듯한 차분한 금색입니다
const DEEP_RED = "#b3101d"; // 금색과 짝을 이루는 짙은 빨강

// 볼의 모습. 고르는 색(lib/theme.ts 의 ORNAMENT_OPTIONS)의 순서와 같고, 줄무늬와 띠를 번갈아 답니다.
//  - color: 본체 색. 비우면 고른 색을 그대로 씁니다(화사하게 보정)
//  - second: 무늬의 두 번째 색. gold: 금속처럼 반짝이는 부분("body" 본체, "second" 두 번째 색)
//  - satin: 유리 같은 광택 대신, 빛이 넓고 부드럽게 퍼지는 고운 펄(새틴) 표면
type BallLook = { pattern: BallPattern; color?: string; second: string; gold?: "body" | "second"; satin?: boolean };
const BALL_LOOKS: BallLook[] = [
  { pattern: "swirl", second: WHITE }, // 빨강: 빨강 + 흰색 줄무늬
  { pattern: "bands", color: GOLD, second: WHITE, gold: "body" }, // 금색: 흰 바탕에 금색 띠
  { pattern: "swirl", color: DEEP_RED, second: GOLD, gold: "second" }, // 짙은 빨강 + 금색 줄무늬
  { pattern: "bands", color: "#6f9cf2", second: WHITE, satin: true }, // 펄이 들어간 파랑: 흰 바탕에 파스텔 파랑 띠, 고운 펄 표면
  { pattern: "swirl", second: WHITE, satin: true }, // 초록: 초록 + 흰색 줄무늬, 고운 펄 표면
  { pattern: "bands", second: WHITE, satin: true }, // 분홍: 흰 바탕에 분홍 띠, 고운 펄 표면
];

// 별 · 하트(쿠키 모양)의 모습. 순서는 볼과 같습니다. 금색과 빨강 + 금색만 따로 정하고, 나머지는 고른 색 그대로입니다 (본체는 고른 색, 아이싱은 크림색)
//  - color: 본체 색. gold: 금색으로 그릴 부분("body" 본체, "accent" 아이싱)
type CookieLook = { color: string; gold: "body" | "accent" };
const COOKIE_LOOKS: (CookieLook | undefined)[] = [
  undefined, // 빨강
  { color: GOLD, gold: "body" }, // 금색 본체에 크림색 아이싱
  { color: DEEP_RED, gold: "accent" }, // 짙은 빨강 본체에 금색 아이싱
];

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
    const look = mainPart?.shape === "ball" ? BALL_LOOKS[option] : undefined;
    // 별 · 하트는 금색과 빨강 + 금색만 따로 정합니다 (COOKIE_LOOKS)
    const cookie = mainPart && mainPart.shape !== "ball" ? COOKIE_LOOKS[option] : undefined;
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
      if (cookie?.gold === "body") makeGold(main, highlight);
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
        const second = new THREE.Color(look.second);
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
        makeGold(accent, highlight);
      }
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
  const templates = useOrnamentTemplates();
  const parts = templates[shape];
  const materials = useOrnamentMaterials(parts, color, false, false);
  return <OrnamentParts parts={parts} materials={materials} />;
}

useGLTF.preload(ORNAMENT_URL);
