"use client";

// Blender 에서 만든 스노우볼 모델과 오너먼트입니다. 어느 3D 장면(<Canvas>) 안에든 끼워 쓸 수 있습니다.
// 좌표는 모델 원본 그대로입니다: 유리 구의 가운데가 (0, 0.55, 0), 반지름 1, 받침대 맨 아래가 y = -0.655.

import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { BEFORE_TONE_MAPPING_GLSL, backdropUniforms } from "@/components/stage/backdropShared";
import bakedBulbSeats from "@/lib/tree-bulb-seats.json";
import { placeOrnaments, type OrnamentLike, type PlacedOrnament } from "@/lib/snowglobe";
import type { GlobeKind } from "@/lib/theme";
// 오너먼트 모델을 읽고 색을 입히는 부분은 OrnamentGlb.tsx 로 옮겼습니다 (기념 메시지 화면도 함께 씀, 차명근)
import { NEWYEAR_ORNAMENT_URL, ORNAMENT_URL, OrnamentParts, useOrnamentMaterials, useOrnamentTemplates, type TemplatePart } from "./OrnamentGlb";

const MODEL_URL = "/models/snowglobe.glb";
// 새해 스노우볼(2027 정미년): 양 · 2027 · 한옥 담장 · 소반 위 떡국 · 황토 마당. 유리 · 받침대 · 명판은 크리스마스 모델과 같은 모양입니다.
// 원본은 design/blender/newyear.blend, 만드는 스크립트는 scripts/blender/ 에 있습니다. (차명근)
const NEWYEAR_URL = "/models/newyear.glb";
export const globeModelUrl = (kind: GlobeKind = "christmas") => (kind === "newyear" ? NEWYEAR_URL : MODEL_URL);
// 추가 소품(루돌프 · 과자집). 고른 사람만 내려받도록 스노우볼 본체와 다른 파일에 둡니다 (이민정)
const PROPS_URL = "/models/props.glb";

// 유리: 두께가 느껴지는 유리 구. 가운데는 맑고, 가장자리로 갈수록 유리가 두꺼워 보입니다.
//  - 가장자리 띠: 유리 뒤의 배경이 굴절되어 안쪽으로 당겨져(뒤집혀) 보이고, 색이 살짝 갈라집니다.
//  - 반사: 배경 그림이 거울 공처럼 곡면을 따라 휘어 비치고, 가로등 · 창문 불빛은 더 또렷하게 맺힙니다.
//  - 넓고 부드러운 창빛, 가장자리의 밝은 빛, 옅은 푸른 기운으로 유리의 부피를 냅니다.
// back 이 true 면 유리 안쪽 뒷면(건너편 벽)에 비친 옅은 반사를 그립니다.
function createGlassMaterial(back: boolean) {
  return new THREE.ShaderMaterial({
    transparent: true,
    premultipliedAlpha: true,
    depthWrite: false,
    side: back ? THREE.BackSide : THREE.FrontSide,
    uniforms: {
      uBack: { value: back ? 1 : 0 },
      // 유리 구의 가운데와 반지름 (메시 안의 좌표). 모델을 읽은 뒤 fitGlass 가 채웁니다.
      uCenter: { value: new THREE.Vector3(0, 0, 0) },
      uRadius: { value: 1 },
      // 배경 그림 (배경이 받아 온 것을 함께 씁니다. 그림 배경이 없는 장면에서는 비치지 않습니다)
      uBackdropMap: backdropUniforms.uBackdropMap,
      uBackdropShow: backdropUniforms.uBackdropShow,
      uBackdropViewAspect: backdropUniforms.uBackdropViewAspect,
      uBackdropImageAspect: backdropUniforms.uBackdropImageAspect,
    },
    vertexShader: /* glsl */ `
      uniform vec3 uCenter;
      uniform float uRadius;
      varying vec3 vNormal;
      varying vec3 vView;
      varying vec4 vClip;
      varying vec2 vGlobeSize;
      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vView = normalize(-viewPosition.xyz);
        gl_Position = projectionMatrix * viewPosition;
        vClip = gl_Position;
        // 화면에서 유리 구가 차지하는 반지름 (화면 절반을 1 로 본 값, 가로 · 세로)
        vec4 centerView = modelViewMatrix * vec4(uCenter, 1.0);
        float radiusView = uRadius * length(modelViewMatrix[0].xyz);
        vGlobeSize = vec2(projectionMatrix[0][0], projectionMatrix[1][1]) * radiusView / max(-centerView.z, 0.0001);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uBack;
      uniform sampler2D uBackdropMap;
      uniform float uBackdropShow;
      uniform float uBackdropViewAspect;
      uniform float uBackdropImageAspect;
      varying vec3 vNormal;
      varying vec3 vView;
      varying vec4 vClip;
      varying vec2 vGlobeSize;
      ${BEFORE_TONE_MAPPING_GLSL}
      float band(float x, float center, float halfWidth, float soft) {
        return smoothstep(center - halfWidth - soft, center - halfWidth + soft, x)
          * (1.0 - smoothstep(center + halfWidth - soft, center + halfWidth + soft, x));
      }
      // 반사 방향 r 이 창(네모난 조명) 안에 들어오는 정도
      float softbox(vec3 r, float azimuth, float elevation, float halfW, float halfH, float soft) {
        return band(atan(r.x, r.z), azimuth, halfW, soft) * band(asin(clamp(r.y, -1.0, 1.0)), elevation, halfH, soft);
      }
      // 화면의 한 점(화면 절반을 1 로 본 좌표)에 보이는 배경 그림의 색. 배경(PhotoBackdrop)과 같은 방식으로 맞춥니다.
      vec3 backdropAt(vec2 point, float blur) {
        vec2 uv = point * 0.5;
        if (uBackdropViewAspect > uBackdropImageAspect) uv.y *= uBackdropImageAspect / uBackdropViewAspect;
        else uv.x *= uBackdropViewAspect / uBackdropImageAspect;
        return texture2D(uBackdropMap, uv + 0.5, blur).rgb;
      }
      // 가로등 · 창문 같은 불빛은 실제로는 그림에 보이는 것보다 훨씬 밝으므로, 밝은 곳일수록 더 밝게 돌려줍니다.
      vec3 lit(vec3 picture, float boost) {
        float glow = smoothstep(0.3, 0.85, dot(picture, vec3(0.3, 0.6, 0.1)));
        return beforeToneMapping(picture) * (1.0 + boost * glow);
      }
      void main() {
        vec3 n = normalize(vNormal) * (uBack > 0.5 ? -1.0 : 1.0);
        vec3 v = normalize(vView);
        float facing = clamp(dot(n, v), 0.0, 1.0);
        float fresnel = 0.04 + 0.96 * pow(1.0 - facing, 5.0);
        vec3 r = reflect(-v, n);
        float front = 1.0 - uBack;
        float strength = uBack > 0.5 ? 0.3 : 1.0;
        // 가운데에서 가장자리까지의 거리 (0 = 가운데, 1 = 테두리)와 바깥 방향
        float rim = clamp(length(n.xy), 0.0, 1.0);
        vec2 side = n.xy / max(rim, 0.0001);

        // 1) 두꺼운 유리의 가장자리 띠: 유리 뒤 배경이 굴절되어 안쪽으로 당겨져 보입니다.
        //    테두리에 가까울수록 더 많이 당겨져, 띠 안에서 배경이 뒤집힌 채 눌려 보입니다. 빨강과 파랑은 조금 다르게 꺾여 색이 갈라집니다.
        vec2 point = vClip.xy / vClip.w;
        float deep = smoothstep(0.8, 1.0, rim);
        vec2 pull = side * vGlobeSize * (0.1 + 0.34 * deep);
        vec3 bent = vec3(
          backdropAt(point - pull * 1.08, 1.0).r,
          backdropAt(point - pull, 1.0).g,
          backdropAt(point - pull * 0.92, 1.0).b
        );
        vec3 thick = lit(bent, 2.2) * 1.05;
        float thickAlpha = smoothstep(0.82, 0.955, rim) * 0.9 * uBackdropShow * front;

        // 2) 유리에 비친 배경 그림: 거울 공처럼 반사 방향으로 그림을 읽습니다. 가운데는 거의 비치지 않고 가장자리로 갈수록 진해집니다.
        float ballM = 2.0 * sqrt(r.x * r.x + r.y * r.y + (r.z + 1.0) * (r.z + 1.0));
        vec2 ballUv = r.xy / max(ballM, 0.0001) + 0.5;
        vec3 scene = lit(texture2D(uBackdropMap, ballUv, 2.0).rgb, 3.0);
        float mirror = (0.04 + 0.96 * pow(1.0 - facing, 2.2)) * uBackdropShow * mix(0.9, 0.22, uBack);

        // 3) 흰 반사광: 왼쪽 위의 넓고 부드러운 창빛과 그 안의 또렷한 창, 오른쪽 가는 창.
        //    트리를 가리지 않도록 모두 유리 가장자리 쪽(가운데에서 테두리까지의 0.75~0.85 지점)에 맺히게 합니다.
        float sheen = softbox(r, -1.8, 0.8, 0.62, 0.3, 0.1) * 0.1;
        float windowA = softbox(r, -1.84, 0.85, 0.27, 0.17, 0.02) * 0.62;
        float windowB = softbox(r, 1.89, 0.47, 0.09, 0.36, 0.018) * 0.4;
        float windows = sheen + windowA + windowB;
        vec3 windowTint = vec3(1.0, 0.97, 0.95);
        // 창 위쪽이 더 밝고 아래로 갈수록 옅어지게
        float reflection = windows * (0.4 + 0.6 * fresnel) * (0.75 + 0.5 * clamp(r.y, 0.0, 1.0));

        // 4) 유리의 부피: 가장자리로 갈수록 짙어지는 옅은 푸른 기운과, 테두리 안쪽을 따라 도는 밝은 빛
        float body = (0.012 + 0.075 * pow(rim, 10.0)) * front;
        vec3 bodyColor = vec3(0.62, 0.74, 1.0);
        // 빛이 유리를 지나 맺히는 밝은 초승달: 오른쪽 아래가 가장 밝고, 왼쪽 위에 옅게 하나 더
        float glowR = band(rim, 0.93, 0.03, 0.03) * smoothstep(0.35, 0.95, dot(side, normalize(vec2(0.78, -0.62))));
        float glowL = band(rim, 0.94, 0.02, 0.025) * smoothstep(0.55, 0.98, dot(side, normalize(vec2(-0.85, 0.5))));
        vec3 rimLight = (vec3(1.0, 0.95, 0.86) * glowR * 0.75 + vec3(0.86, 0.92, 1.0) * glowL * 0.3) * front;

        // 작고 날카로운 반짝임
        float sparkle = pow(max(dot(r, normalize(vec3(-0.5, 0.62, 0.6))), 0.0), 1400.0) * 2.2;

        // 테두리 선: 무지갯빛이 살짝 도는 밝은 선
        float edgeLine = pow(1.0 - facing, 14.0);
        vec3 iris = 0.5 + 0.5 * cos(6.2832 * (side.y * 0.35 + 0.92 + vec3(0.0, 0.33, 0.67)));
        vec3 edgeColor = mix(vec3(0.9, 0.95, 1.0), iris, 0.35);

        // 뒤에서 앞으로 겹칩니다: 굴절된 가장자리 → 비친 배경 → 푸른 기운 · 빛 · 반사광
        vec3 color = thick * thickAlpha;
        float alpha = thickAlpha;
        color = color * (1.0 - mirror) + scene * mirror;
        alpha = alpha * (1.0 - mirror) + mirror;
        color += bodyColor * body + rimLight
          + (windowTint * reflection + vec3(1.0) * sparkle) * strength
          + edgeColor * edgeLine * 0.7 * front;
        alpha += body + dot(rimLight, vec3(0.33)) * 0.6
          + (reflection * 0.9 + sparkle) * strength
          + (edgeLine * 0.45 + 0.003) * front;
        gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0));
        #include <colorspace_fragment>
      }
    `,
  });
}

// 유리 메시의 모양에서 구의 가운데와 반지름을 읽어 재질에 알려 줍니다.
// 유리는 아래쪽이 받침대에 잘린 구라서, 가장 넓은 곳의 너비가 지름이고 맨 위에서 반지름만큼 내려온 곳이 가운데입니다.
function fitGlass(mesh: THREE.Mesh, materials: THREE.ShaderMaterial[]) {
  mesh.geometry.computeBoundingBox();
  const box = mesh.geometry.boundingBox;
  if (!box) return;
  const radius = (box.max.x - box.min.x) / 2;
  for (const material of materials) {
    material.uniforms.uCenter.value.set((box.min.x + box.max.x) / 2, box.max.y - radius, (box.min.z + box.max.z) / 2);
    material.uniforms.uRadius.value = radius;
  }
}

type ShaderExtras = {
  // 가장자리로 갈수록 빛이 스며든 것처럼 은은하게 밝아짐 (부드러운 클레이 느낌)
  rim?: { color: string; strength: number };
  // 표면에 잔 입자감 (눈처럼 포슬포슬한 느낌)
  grain?: { scale: number; strength: number };
  // 볼터치: 두 점에서 부드럽게 번지는 색. 점의 자리는 모델 파일 기준 좌표이고, matrix 는 그 메시를 모델 파일 기준으로 옮기는 값입니다.
  blush?: { points: [[number, number, number], [number, number, number]]; radius: number; color: string; strength: number; matrix: { value: THREE.Matrix4 } };
  // 털 겹: 같은 메시를 바깥으로 조금씩 부풀려 여러 겹 그리고, 겹마다 잔 가닥 무늬만 남깁니다 (복실복실한 보풀).
  // layer: 0 = 바탕, 1 = 가장 바깥 겹. length · scale 은 메시 자체 좌표 기준입니다.
  fur?: { layer: number; length: number; scale: number };
  // 반짝임: 표면의 잔 알갱이가 보는 각도에 따라 빛을 튕겨 반짝입니다 (쌓인 눈). 스노우볼을 돌리면 반짝이는 자리가 바뀝니다.
  sparkle?: { scale: number; strength: number };
  // 멍석: 짚으로 꼰 새끼줄을 둥글게 돌려 엮은 깔개의 무늬. 가운데에서 바깥으로 고리가 이어지고, 고리마다 꼬임 결이 있습니다.
  // rings: 가운데에서 가장자리까지의 고리 수(메시 자체 좌표 기준), twist: 고리 한 칸 길이에 들어가는 꼬임 수, groove: 골의 색
  straw?: { rings: number; twist: number; groove: string; depth: number };
  // 바닥 그림자: 새해 스노우볼의 마당에 양과 소품의 그림자를 칠합니다. 그림자를 실제로 계산하지 않고(휴대폰에서 무거움)
  // 물체가 놓인 자리 아래를 부드럽게 어둡게 하는 방식이라 더 그리는 것이 없습니다.
  // matrix: 마당 메시를 모델 파일 기준 좌표로 옮기는 값, wall · soban: 담장 · 떡국 상이 보이는지 (0 또는 1)
  ground?: { matrix: { value: THREE.Matrix4 }; wall: { value: number }; soban: { value: number }; yut: { value: number }; bokjori: { value: number } };
};

// 그림자 자리는 모델 파일 기준 좌표(x, z)입니다. Blender 의 (x, y) → (x, -y). 소품을 옮기면 여기도 고칩니다 (scripts/blender/*.py)
const GROUND_GLSL = /* glsl */ `
  varying vec3 vGroundPos;
  uniform float uGroundWall;
  uniform float uGroundSoban;
  uniform float uGroundYut;
  uniform float uGroundBokjori;
  float groundBlob(vec2 p, vec2 center, vec2 radius, float inner) {
    return 1.0 - smoothstep(inner, 1.0, length((p - center) / radius));
  }
  // 그 자리의 그림자 짙기 (0 = 없음)
  float groundShade() {
    vec2 p = vGroundPos.xz;
    // 양: 몸통 아래가 가장 짙고, 머리 아래는 옅게
    float shade = 0.5 * groundBlob(p, vec2(0.0, -0.12), vec2(0.43, 0.52), 0.35);
    shade = max(shade, 0.3 * groundBlob(p, vec2(0.0, 0.14), vec2(0.3, 0.3), 0.3));
    // 담장: 반지름 0.775 의 호(142도 ~ 232도)를 따라 길게
    float angle = degrees(atan(-p.y, p.x));
    angle = angle < 0.0 ? angle + 360.0 : angle;
    float along = 1.0 - smoothstep(43.0, 49.0, abs(angle - 187.0));
    float across = 1.0 - smoothstep(0.05, 0.15, abs(length(p) - 0.775));
    shade = max(shade, 0.5 * along * across * uGroundWall);
    // 떡국 상, 윷가락을 놓은 조각보, 복조리
    shade = max(shade, 0.45 * groundBlob(p, vec2(0.455, 0.39), vec2(0.21, 0.21), 0.4) * uGroundSoban);
    shade = max(shade, 0.26 * groundBlob(p, vec2(0.61, -0.03), vec2(0.25, 0.25), 0.55) * uGroundYut);
    shade = max(shade, 0.34 * groundBlob(p, vec2(0.5, -0.5), vec2(0.17, 0.13), 0.3) * uGroundBokjori);
    return shade;
  }
`;

const STRAW_GLSL = /* glsl */ `
  varying vec3 vStrawPos;
  uniform float uStrawRings;
  uniform float uStrawTwist;
  // 멍석의 높낮이 (0 = 골, 1 = 새끼줄의 등)
  float strawHeight() {
    float radius = length(vStrawPos.xz) * uStrawRings;
    float row = floor(radius);
    float across = fract(radius);
    float angle = atan(vStrawPos.z, vStrawPos.x);
    // 고리가 클수록 꼬임 수도 늘어 꼬임 하나의 크기가 비슷합니다. 이웃한 고리는 꼬임이 엇갈립니다
    float count = floor((row + 1.0) * uStrawTwist);
    float braid = 0.5 + 0.5 * sin(angle * count + across * 4.2 + row * 2.4);
    float rope = sin(across * 3.14159);
    return rope * (0.62 + 0.38 * braid);
  }
`;

const FUR_GLSL = /* glsl */ `
  varying vec3 vFurPos;
  uniform float uFurLayer;
  uniform float uFurScale;
  float furHash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float furNoise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(furHash(i), furHash(i + vec3(1, 0, 0)), f.x), mix(furHash(i + vec3(0, 1, 0)), furHash(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(furHash(i + vec3(0, 0, 1)), furHash(i + vec3(1, 0, 1)), f.x), mix(furHash(i + vec3(0, 1, 1)), furHash(i + vec3(1, 1, 1)), f.x), f.y),
      f.z);
  }
  // 곱슬한 가닥 무늬 (0~1): 자리를 굵은 잡음으로 휘어 가닥이 말려 보이게 합니다
  float furStrand() {
    vec3 p = vFurPos * uFurScale;
    vec3 curl = vec3(furNoise(p * 0.3), furNoise(p * 0.3 + 11.3), furNoise(p * 0.3 + 27.1)) - 0.5;
    return furNoise(p + curl * 2.4);
  }
`;

const GRAIN_GLSL = /* glsl */ `
  varying vec3 vGrainPos;
  uniform float uGrainScale;
  uniform float uGrainStrength;
  float grainHash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float grainNoise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(grainHash(i), grainHash(i + vec3(1, 0, 0)), f.x), mix(grainHash(i + vec3(0, 1, 0)), grainHash(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(grainHash(i + vec3(0, 0, 1)), grainHash(i + vec3(1, 0, 1)), f.x), mix(grainHash(i + vec3(0, 1, 1)), grainHash(i + vec3(1, 1, 1)), f.x), f.y),
      f.z);
  }
`;

// three.js 기본 재질에 위 효과를 덧붙입니다.
function applyShaderExtras(material: THREE.MeshStandardMaterial, extras: ShaderExtras) {
  material.onBeforeCompile = (shader) => {
    let vertex = shader.vertexShader;
    let fragment = shader.fragmentShader;
    if (extras.grain) {
      shader.uniforms.uGrainScale = { value: extras.grain.scale };
      shader.uniforms.uGrainStrength = { value: extras.grain.strength };
      vertex = vertex
        .replace("#include <common>", "#include <common>\nvarying vec3 vGrainPos;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvGrainPos = position;");
      fragment = fragment.replace("#include <common>", `#include <common>\n${GRAIN_GLSL}`).replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
        vec3 grainPoint = vGrainPos * uGrainScale;
        vec3 grainVector = vec3(grainNoise(grainPoint), grainNoise(grainPoint + 17.3), grainNoise(grainPoint + 41.7)) - 0.5;
        normal = normalize(normal + grainVector * uGrainStrength);`,
      );
    }
    if (extras.fur) {
      shader.uniforms.uFurLayer = { value: extras.fur.layer };
      shader.uniforms.uFurLength = { value: extras.fur.length };
      shader.uniforms.uFurScale = { value: extras.fur.scale };
      vertex = vertex
        .replace("#include <common>", "#include <common>\nvarying vec3 vFurPos;\nuniform float uFurLayer;\nuniform float uFurLength;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvFurPos = position;\ntransformed += normalize(objectNormal) * uFurLength * uFurLayer;");
      fragment = fragment
        .replace("#include <common>", `#include <common>\n${FUR_GLSL}`)
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
          float furStrandValue = furStrand();
// 바깥 겹일수록 가닥이 조금씩 줄어듭니다. 너무 많이 솎으면 털끝이 삐죽삐죽해 보여서, 끝 겹에도 가닥을 넉넉히 남겨 보송하게 합니다
          if (uFurLayer > 0.0 && furStrandValue < 0.14 + 0.4 * uFurLayer) discard;
          // 가닥 사이 골은 어둡고 털끝은 밝게
          diffuseColor.rgb *= mix(0.74 + 0.2 * furStrandValue, 1.08, uFurLayer);`,
        );
    }
    if (extras.straw) {
      shader.uniforms.uStrawRings = { value: extras.straw.rings };
      shader.uniforms.uStrawTwist = { value: extras.straw.twist };
      shader.uniforms.uStrawGroove = { value: new THREE.Color(extras.straw.groove) };
      shader.uniforms.uStrawDepth = { value: extras.straw.depth };
      vertex = vertex
        .replace("#include <common>", "#include <common>\nvarying vec3 vStrawPos;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvStrawPos = position;");
      fragment = fragment
        .replace("#include <common>", `#include <common>\n${STRAW_GLSL}\nuniform vec3 uStrawGroove;\nuniform float uStrawDepth;`)
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
          float strawH = strawHeight();
          diffuseColor.rgb = mix(uStrawGroove, diffuseColor.rgb, smoothstep(0.0, 0.75, strawH));`,
        )
        .replace(
          "#include <normal_fragment_maps>",
          `#include <normal_fragment_maps>
          // 높낮이를 따라 겉면을 기울여 새끼줄이 도톰해 보이게 합니다
          vec3 strawSx = dFdx(-vViewPosition);
          vec3 strawSy = dFdy(-vViewPosition);
          vec3 strawR1 = cross(strawSy, normal);
          vec3 strawR2 = cross(normal, strawSx);
          float strawDet = dot(strawSx, strawR1);
          vec2 strawSlope = vec2(dFdx(strawH), dFdy(strawH)) * uStrawDepth;
          normal = normalize(abs(strawDet) * normal - sign(strawDet) * (strawSlope.x * strawR1 + strawSlope.y * strawR2));`,
        );
    }
    if (extras.ground) {
      shader.uniforms.uGroundMatrix = extras.ground.matrix;
      shader.uniforms.uGroundWall = extras.ground.wall;
      shader.uniforms.uGroundSoban = extras.ground.soban;
      shader.uniforms.uGroundYut = extras.ground.yut;
      shader.uniforms.uGroundBokjori = extras.ground.bokjori;
      vertex = vertex
        .replace("#include <common>", "#include <common>\nuniform mat4 uGroundMatrix;\nvarying vec3 vGroundPos;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvGroundPos = (uGroundMatrix * vec4(position, 1.0)).xyz;");
      fragment = fragment.replace("#include <common>", `#include <common>\n${GROUND_GLSL}`).replace(
        "#include <opaque_fragment>",
        `// 그늘진 곳은 어둡고 살짝 푸르스름하게
        outgoingLight *= mix(vec3(1.0), vec3(0.42, 0.38, 0.46), groundShade());
        #include <opaque_fragment>`,
      );
    }
    if (extras.sparkle) {
      shader.uniforms.uSparkleScale = { value: extras.sparkle.scale };
      shader.uniforms.uSparkleStrength = { value: extras.sparkle.strength };
      vertex = vertex
        .replace("#include <common>", "#include <common>\nvarying vec3 vSparklePos;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvSparklePos = position;");
      fragment = fragment
        .replace(
          "#include <common>",
          `#include <common>
          varying vec3 vSparklePos;
          uniform float uSparkleScale;
          uniform float uSparkleStrength;
          float sparkleHash(vec3 p) {
            p = fract(p * 0.3183099 + 0.1);
            p *= 17.0;
            return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
          }`,
        )
        .replace(
          "#include <opaque_fragment>",
          `// 알갱이마다 제멋대로 기운 작은 면이 있다고 보고, 그 면이 눈 쪽으로 빛을 튕길 때만 밝힙니다
          vec3 sparkleCell = floor(vSparklePos * uSparkleScale);
          vec3 sparkleTilt = vec3(sparkleHash(sparkleCell), sparkleHash(sparkleCell + 7.1), sparkleHash(sparkleCell + 13.7)) - 0.5;
          float sparkleFacing = dot(normalize(normalize(normal) + sparkleTilt * 1.6), normalize(vViewPosition));
          float sparkleGlint = smoothstep(0.985, 1.0, sparkleFacing) * step(0.55, sparkleHash(sparkleCell + 3.3));
          outgoingLight += vec3(1.0, 0.97, 0.92) * sparkleGlint * uSparkleStrength;
          #include <opaque_fragment>`,
        );
    }
    if (extras.blush) {
      shader.uniforms.uBlushMatrix = extras.blush.matrix;
      shader.uniforms.uBlushA = { value: new THREE.Vector3(...extras.blush.points[0]) };
      shader.uniforms.uBlushB = { value: new THREE.Vector3(...extras.blush.points[1]) };
      shader.uniforms.uBlushRadius = { value: extras.blush.radius };
      shader.uniforms.uBlushColor = { value: new THREE.Color(extras.blush.color) };
      shader.uniforms.uBlushStrength = { value: extras.blush.strength };
      vertex = vertex
        .replace("#include <common>", "#include <common>\nuniform mat4 uBlushMatrix;\nvarying vec3 vBlushPos;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvBlushPos = (uBlushMatrix * vec4(position, 1.0)).xyz;");
      fragment = fragment
        .replace(
          "#include <common>",
          "#include <common>\nvarying vec3 vBlushPos;\nuniform vec3 uBlushA;\nuniform vec3 uBlushB;\nuniform float uBlushRadius;\nuniform vec3 uBlushColor;\nuniform float uBlushStrength;",
        )
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
          float blushNear = min(distance(vBlushPos, uBlushA), distance(vBlushPos, uBlushB));
          float blushAmount = 1.0 - smoothstep(0.0, uBlushRadius, blushNear);
          diffuseColor.rgb = mix(diffuseColor.rgb, uBlushColor, blushAmount * uBlushStrength);`,
        );
    }
    if (extras.rim) {
      shader.uniforms.uRimColor = { value: new THREE.Color(extras.rim.color) };
      shader.uniforms.uRimStrength = { value: extras.rim.strength };
      fragment = fragment
        .replace("#include <common>", "#include <common>\nuniform vec3 uRimColor;\nuniform float uRimStrength;")
        .replace(
          "#include <opaque_fragment>",
          `float rimAmount = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 2.4);
          outgoingLight += uRimColor * rimAmount * uRimStrength;
          #include <opaque_fragment>`,
        );
    }
    shader.vertexShader = vertex;
    shader.fragmentShader = fragment;
  };
  material.customProgramCacheKey = () => JSON.stringify({ ...extras, blush: extras.blush && { ...extras.blush, matrix: 0 }, ground: Boolean(extras.ground) });
}

// 광택 없는 매끈한 클레이: 번쩍임과 주변 반사를 줄입니다.
function makeMatte(material: THREE.MeshStandardMaterial, roughness: number, reflection: number) {
  material.roughness = roughness;
  material.metalness = 0;
  material.envMapIntensity = reflection;
  if (material instanceof THREE.MeshPhysicalMaterial) {
    material.clearcoat = 0;
    material.sheen = 0;
  }
}

// 받침대와 빨간 선물 상자가 함께 쓰는 부드러운 빨강
// 받침대와 빨간 선물 상자의 빨강. 예전 값(#dc4f45)에서 밝기는 그대로 두고 채도를 올렸습니다 (이민정)
const SOFT_RED = "#ed4034";

// 아주 약한 유광: 클레이 느낌은 그대로 두고, 빛을 받는 곳에만 부드러운 윤기가 돕니다.
function makeSoftGloss(material: THREE.MeshStandardMaterial) {
  material.roughness = 0.5;
  material.metalness = 0;
  material.envMapIntensity = 0.4;
  if (material instanceof THREE.MeshPhysicalMaterial) {
    material.clearcoat = 0.3;
    material.clearcoatRoughness = 0.35;
    material.sheen = 0;
  }
}

// 은은한 윤기: 무광과 약한 유광 사이. 번쩍이지 않고 빛을 받는 곳만 부드럽게 윤이 납니다. (루돌프)
function makeSatin(material: THREE.MeshStandardMaterial) {
  material.roughness = 0.58;
  material.metalness = 0;
  material.envMapIntensity = 0.32;
  if (material instanceof THREE.MeshPhysicalMaterial) {
    material.clearcoat = 0.22;
    material.clearcoatRoughness = 0.38;
    material.sheen = 0;
  }
}

// 금속: 주변 빛을 또렷하게 비추는 밝은 금. 어두운 밤 배경이 비쳐 탁해지지 않도록 반사를 키웁니다.
function makeGold(material: THREE.MeshStandardMaterial, roughness: number) {
  material.color.set("#ffcc66");
  material.metalness = 1;
  material.roughness = roughness;
  material.envMapIntensity = 2.6;
  material.emissive.set("#5a3606");
  material.emissiveIntensity = 0.35;
  if (material instanceof THREE.MeshPhysicalMaterial) {
    material.clearcoat = 0;
    material.sheen = 0;
  }
}

// 루돌프 볼터치가 쓰는 값: 털 메시를 모델 파일 기준 좌표로 옮기는 행렬. 모델을 불러올 때 GlobeExtras 가 채웁니다.
const reindeerBlushMatrix = { value: new THREE.Matrix4() };
const REINDEER_FUR = "W_RD_Fur";

// 양(새해 스노우볼)의 털 (차명근)
const SHEEP_WOOL = "W_Sheep_Wool";
const SHEEP_FACE = "W_Sheep_Face";
const SHEEP_LEG = "W_Sheep_Leg";
const SHEEP_FUR = 0.0105; // 털 겹이 자라는 길이 (모델 단위). scripts/blender/sheep_v2.py 의 FUR 와 같게
const SHEEP_FUR_LAYERS = 6; // 바깥으로 더 그리는 겹의 수
const SHEEP_FUR_DENSITY = 200; // 1 단위 길이에 들어가는 가닥 무늬의 수
// 다리(펠트)에는 짧은 보풀을 세웁니다: 겹 수 · 길이 · 촘촘함. 얼굴과 귀 앞면은 보풀 없이 매끈합니다
const SHEEP_FELT = { layers: 3, length: 0.0045, density: 260 };
const SHEEP_YARD = "W_Yard";
// 마당의 그림자가 쓰는 값: 마당 메시가 모델 안에서 놓인 자리, 담장 · 떡국 상이 보이는지 (GlobeModel 이 채웁니다)
const yardShade = { matrix: { value: new THREE.Matrix4() }, wall: { value: 1 }, soban: { value: 1 }, yut: { value: 1 }, bokjori: { value: 1 } };
// 볼터치 자리를 맞추려면 얼굴 메시가 모델 안에서 놓인 자리를 알아야 합니다 (GlobeModel 이 채웁니다)
const sheepBlushMatrix = { value: new THREE.Matrix4() };

// 복조리의 대나무
function bambooLook(material: THREE.MeshStandardMaterial) {
  makeSatin(material);
  material.emissive.copy(material.color).multiplyScalar(0.2);
  material.emissiveIntensity = 0.5;
}

// 조각보의 천: 광택 없이, 고운 짜임이 보이게
function clothLook(material: THREE.MeshStandardMaterial) {
  makeMatte(material, 0.95, 0.1);
  material.emissive.copy(material.color).multiplyScalar(0.25);
  material.emissiveIntensity = 0.5;
  applyShaderExtras(material, { grain: { scale: 220, strength: 0.3 } });
}

// 얼굴과 귀 앞면: 털 질감 없이 매끈한 펠트. 볼터치가 있습니다.
function faceLook(material: THREE.MeshStandardMaterial) {
  material.color.set("#fbf0da");
  makeMatte(material, 0.9, 0.12);
  material.emissive.set("#5a452c");
  material.emissiveIntensity = 0.2;
  applyShaderExtras(material, {
    rim: { color: "#fff6e6", strength: 0.26 },
    // 볼터치: 두 볼에서 부드럽게 번지는 분홍 (자리는 모델 파일 기준 좌표. Blender 의 (x, y, z) → (x, z, -y))
    blush: { points: [[-0.112, 0.69, 0.295], [0.112, 0.69, 0.295]], radius: 0.043, color: "#f59aa2", strength: 0.6, matrix: sheepBlushMatrix },
  });
}

// 다리의 펠트 재질: 짧은 보풀이 있습니다. layer · size 는 woolLook 과 같습니다.
function feltLook(material: THREE.MeshStandardMaterial, layer: number, size: number) {
  material.color.set("#fbf0da");
  makeMatte(material, 0.95, 0.1);
  material.emissive.set("#5a452c");
  material.emissiveIntensity = 0.2;
  applyShaderExtras(material, {
    grain: { scale: 150 * size, strength: 0.16 },
    rim: { color: "#fff6e6", strength: 0.26 },
    fur: { layer, length: SHEEP_FELT.length / size, scale: SHEEP_FELT.density * size },
  });
}

// 양털 재질. layer: 0 = 바탕, 1 = 가장 바깥 겹. size: 그 메시의 크기 배율(압축하면서 메시 좌표가 바뀌므로 맞춰 줍니다)
function woolLook(material: THREE.MeshStandardMaterial, layer: number, size: number) {
  material.color.set("#f9ecd2");
  makeMatte(material, 1, 0.1);
  material.emissive.set("#5a452c");
  material.emissiveIntensity = 0.22;
  applyShaderExtras(material, {
    grain: { scale: 90 * size, strength: 0.35 },
    rim: { color: "#fff3dc", strength: 0.34 },
    fur: { layer, length: SHEEP_FUR / size, scale: SHEEP_FUR_DENSITY * size },
  });
}

const TREE_MATERIAL = "W_Ceramic_Green";
const TRUNK_MATERIAL = "W_Ceramic_Trunk";
const BASE_MATERIAL = "W_Base_RedMat";

type Tune = (material: THREE.MeshStandardMaterial) => void;

// 재질 이름별로 웹에서 다듬는 값. Blender 에서 넘어온 색 위에 덧입힙니다.
const MATERIAL_TUNES: Record<string, Tune> = {
  // 트리: 매끈하고 아주 약하게 윤이 나는 부드러운 클레이
  W_Ceramic_Green: (material) => {
    material.color.set("#38b562");
    makeSoftGloss(material);
    material.emissive.set("#0f4b47");
    material.emissiveIntensity = 0.3;
    applyShaderExtras(material, { rim: { color: "#bdf2cf", strength: 0.22 } });
  },
  W_Ceramic_Trunk: (material) => {
    material.color.set("#a8644e");
    makeSoftGloss(material);
    material.emissive.set("#3d1a12");
    material.emissiveIntensity = 0.3;
  },
  // 받침대: 트리와 같은 질감
  W_Base_RedMat: (material) => {
    material.color.set(SOFT_RED);
    makeSoftGloss(material);
    material.emissive.set("#521512");
    material.emissiveIntensity = 0.3;
    applyShaderExtras(material, { rim: { color: "#ffb0a2", strength: 0.15 } });
  },
  // 빨간 선물 상자: 받침대와 같은 빨강
  W_Gift_Red: (material) => {
    material.color.set(SOFT_RED);
  },
  W_Base_Holly: (material) => {
    makeMatte(material, 0.8, 0.2);
    material.emissive.set("#06260f");
    material.emissiveIntensity = 0.3;
    applyShaderExtras(material, { rim: { color: "#8ff0aa", strength: 0.14 } });
  },
  W_Base_HollyVein: (material) => makeMatte(material, 0.8, 0.2),
  // 받침대의 금색 테두리, 눈송이, 명패 테두리
  W_Gold: (material) => makeGold(material, 0.16),
  W_Base_ReliefGold: (material) => makeGold(material, 0.24),
  W_Base_HollyRed: (material) => makeMatte(material, 0.6, 0.35),
  // ── 새해 스노우볼 (차명근) ──
  // 양털: 광택 없이 포근하게. 따뜻한 조명 아래에서 누렇게 죽지 않도록 제 색으로 살짝 밝힙니다.
  // 양모 펠트 인형처럼: 털은 크림색에 보풀이 인 듯한 결, 얼굴 · 귀 · 다리는 결이 고운 펠트
  // 털의 바탕 겹입니다. 바깥 털 겹은 GlobeModel 이 woolLook 으로 더 그립니다.
  // 털 · 펠트의 바탕 겹입니다. 바깥 털 겹은 GlobeModel 이 woolLook · feltLook 으로 더 그립니다.
  W_Sheep_Wool: (material) => woolLook(material, 0, 1),
  W_Sheep_Face: (material) => faceLook(material),
  W_Sheep_Leg: (material) => feltLook(material, 0, 1),
  // 귀 안쪽: 분홍빛이 도는 살
  W_Sheep_EarInner: (material) => {
    material.color.set("#f6b9b3");
    makeMatte(material, 0.95, 0.1);
    material.emissive.set("#5a2a26");
    material.emissiveIntensity = 0.22;
    applyShaderExtras(material, { grain: { scale: 150, strength: 0.16 } });
  },
  W_Sheep_Hoof: (material) => {
    makeMatte(material, 0.9, 0.1);
    material.emissive.set("#4a3520");
    material.emissiveIntensity = 0.2;
  },
  // 눈은 까만 유리구슬처럼 반짝이게
  W_Sheep_Eye: (material) => {
    material.color.set("#120f0d");
    material.roughness = 0.08;
    material.metalness = 0;
    material.envMapIntensity = 1.6;
  },
  W_Sheep_Blush: (material) => makeMatte(material, 0.95, 0.1),
  W_Sheep_Nose: (material) => makeMatte(material, 0.9, 0.1),
  W_Sheep_Mouth: (material) => makeMatte(material, 0.9, 0.1),
  // 마당: 짚으로 엮은 둥근 멍석을 깐 것처럼 (볏짚색에 새끼줄 고리 무늬)
  W_Yard: (material) => {
    material.color.set("#d2a866");
    makeMatte(material, 1, 0.04);
    material.emissive.set("#5a3a14");
    material.emissiveIntensity = 0.3;
    // 굴곡을 크게 주면 옆에서 비추는 푸른 조명이 걸려 초록빛이 돌아서, 굴곡은 아주 얕게 두고 짙은 갈색으로만 무늬를 냅니다
    applyShaderExtras(material, { straw: { rings: 13, twist: 6, groove: "#8f6232", depth: 0.04 }, ground: yardShade });
  },
  // 붉은 2027: 일출 배경 위에서도 묻히지 않게 스스로 빛납니다
  W_Year_Red: (material) => {
    material.color.set("#e02d3f");
    makeSoftGloss(material);
    material.emissive.set("#ff2a3c");
    material.emissiveIntensity = 0.55;
  },
  // 한옥 담장: 돌 · 회벽은 광택 없이, 기와는 먹색에 아주 약한 윤기
  W_Wall_Stone: (material) => {
    makeMatte(material, 0.95, 0.1);
    applyShaderExtras(material, { grain: { scale: 60, strength: 0.45 } });
  },
  W_Wall_Plaster: (material) => {
    makeMatte(material, 0.95, 0.1);
    material.emissive.set("#3d2f1c");
    material.emissiveIntensity = 0.15;
  },
  W_Wall_Tile: (material) => {
    makeSatin(material);
    material.emissive.set("#12141c");
    material.emissiveIntensity = 0.3;
  },
  W_Wall_TileEnd: (material) => {
    makeSatin(material);
    material.emissive.set("#161922");
    material.emissiveIntensity = 0.3;
  },
  W_Wall_StoneDark: (material) => {
    makeMatte(material, 0.95, 0.1);
    applyShaderExtras(material, { grain: { scale: 60, strength: 0.45 } });
  },
  // 기와 위에 쌓인 눈: 포슬포슬하고, 알갱이가 빛을 받아 반짝입니다
  W_Wall_Snow: (material) => {
    material.color.set("#f3f6ff");
    makeMatte(material, 1, 0.15);
    material.emissive.set("#2a3866");
    material.emissiveIntensity = 0.16;
    applyShaderExtras(material, { grain: { scale: 80, strength: 0.5 }, rim: { color: "#e6eeff", strength: 0.2 }, sparkle: { scale: 260, strength: 2.4 } });
  },
  W_Magpie_Beak: (material) => makeSatin(material),
  // 윷가락과 조각보: 나무는 은은한 윤기, 천은 광택 없이
  W_Yut_Back: (material) => {
    makeSatin(material);
    material.emissive.set("#2a140b");
    material.emissiveIntensity = 0.3;
  },
  W_Yut_Belly: (material) => {
    makeSatin(material);
    material.emissive.set("#4a3a20");
    material.emissiveIntensity = 0.2;
  },
  W_Yut_Mark: (material) => makeMatte(material, 0.9, 0.1),
  W_Cloth_Red: (material) => clothLook(material),
  W_Cloth_Blue: (material) => clothLook(material),
  W_Cloth_Yellow: (material) => clothLook(material),
  W_Cloth_Green: (material) => clothLook(material),
  W_Cloth_Pink: (material) => clothLook(material),
  // 복조리: 대나무는 은은한 윤기, 색실은 천처럼
  W_Bokjori_Bamboo: (material) => bambooLook(material),
  W_Bokjori_BambooDark: (material) => bambooLook(material),
  W_Bokjori_Red: (material) => clothLook(material),
  W_Bokjori_Green: (material) => clothLook(material),
  W_Bokjori_Purple: (material) => clothLook(material),
  W_Bokjori_Yellow: (material) => clothLook(material),
  W_Bokjori_Pink: (material) => clothLook(material),
  W_Magpie_Black: (material) => makeSatin(material),
  W_Magpie_White: (material) => makeMatte(material, 0.8, 0.15),
  W_Magpie_Blue: (material) => {
    makeSoftGloss(material);
    material.emissive.set("#16306e");
    material.emissiveIntensity = 0.35;
  },
  // 소반은 옻칠한 나무, 그릇은 흰 사기
  W_Soban_Wood: (material) => {
    makeSoftGloss(material);
    material.emissive.set("#2a100b");
    material.emissiveIntensity = 0.3;
  },
  W_Bowl_White: (material) => {
    makeSoftGloss(material);
    material.emissive.set("#3a3630");
    material.emissiveIntensity = 0.15;
  },
  W_Tteokguk_Soup: (material) => makeSoftGloss(material),
  W_Tteokguk_Tteok: (material) => makeSatin(material),
  W_Tteokguk_Egg: (material) => makeMatte(material, 0.8, 0.15),
  W_Tteokguk_Gim: (material) => makeMatte(material, 0.8, 0.15),
  W_Tteokguk_Green: (material) => makeMatte(material, 0.8, 0.15),
  // 눈: 광택 없이 포슬포슬하게
  W_Snow_Sparkle: (material) => {
    material.color.set("#f1f5ff");
    makeMatte(material, 1, 0.15);
    material.emissive.set("#1c2c5c");
    material.emissiveIntensity = 0.14;
    applyShaderExtras(material, { grain: { scale: 75, strength: 0.5 } });
  },
  // 눈사람: 갓 뭉친 눈처럼 곱고 부드럽게, 니트는 광택 없는 천
  W_SM_Body: (material) => {
    material.color.set("#f6f8ff");
    makeMatte(material, 1, 0.12);
    material.emissive.set("#1c2c5c");
    material.emissiveIntensity = 0.12;
    applyShaderExtras(material, { grain: { scale: 60, strength: 0.16 }, rim: { color: "#dfe9ff", strength: 0.2 } });
  },
  W_SM_KnitRed: (material) => {
    makeMatte(material, 0.95, 0.1);
    applyShaderExtras(material, { grain: { scale: 160, strength: 0.35 } });
  },
  W_SM_KnitCream: (material) => {
    makeMatte(material, 0.95, 0.1);
    applyShaderExtras(material, { grain: { scale: 160, strength: 0.35 } });
  },
  W_SM_Coal: (material) => makeMatte(material, 0.8, 0.2),
  W_SM_Carrot: (material) => makeMatte(material, 0.8, 0.2),
  W_SM_Twig: (material) => makeMatte(material, 0.9, 0.1),
  // 루돌프: 매끈하고 은은하게 윤기가 도는 재질 (트리보다는 덜 번쩍이게). 밤 조명에서 칙칙해지지 않도록 제 색으로 조금 밝힙니다.
  W_RD_Fur: (material) => {
    makeSatin(material);
    material.emissive.set("#a8562f");
    material.emissiveIntensity = 0.4;
    // 양쪽 볼의 은은한 분홍 볼터치 (입체가 아니라 색으로만). 자리는 Blender 에서 잰 볼 겉면의 두 점입니다.
    applyShaderExtras(material, {
      blush: { points: [[-0.4342, 0.3543, 0.7013], [-0.274, 0.3617, 0.643]], radius: 0.036, color: "#ee6f7c", strength: 0.6, matrix: reindeerBlushMatrix },
    });
  },
  W_RD_Cream: (material) => {
    makeSatin(material);
    material.emissive.set("#8a6a4c");
    material.emissiveIntensity = 0.35;
  },
  W_RD_Blush: (material) => {
    makeSatin(material);
    material.emissive.set("#c9566a");
    material.emissiveIntensity = 0.5;
  },
  W_RD_Hoof: (material) => makeSatin(material),
  W_RD_Antler: (material) => makeSatin(material),
  // 눈: 유리알처럼 반짝이는 유광. 오른쪽 위의 흰 하이라이트(W_RD_EyeGlint)는 모델에 붙어 있어 어느 조명에서도 보입니다.
  W_RD_Eye: (material) => {
    material.roughness = 0.08;
    material.metalness = 0;
    material.envMapIntensity = 1.2;
    if (material instanceof THREE.MeshPhysicalMaterial) {
      material.clearcoat = 1;
      material.clearcoatRoughness = 0.04;
    }
  },
  W_RD_EyeGlint: (material) => {
    material.color.set("#ffffff");
    material.emissive.set("#ffffff");
    material.emissiveIntensity = 0.9;
  },
  // 코: 스스로 환하게 빛나는 빨강
  W_RD_Nose: (material) => {
    makeSatin(material);
    material.color.set("#f0121c");
    material.emissive.set("#ff0026");
    material.emissiveIntensity = 1.9;
  },
  // 과자집(W_GH_*)은 따로 다듬지 않습니다. Blender 에서 선물 상자와 같은 재질 값(거칠기 0.36, 얇은 코팅)을 주어 그대로 씁니다.
};

// 전구 줄의 색. 따뜻한 흰빛이 많고, 사이사이 여러 색이 섞입니다. 뒤의 수는 밝기입니다.
const BULB_COLORS: [string, number][] = [
  ["#ffdc9a", 1.45],
  ["#ff5a4c", 1.5],
  ["#ffdc9a", 1.45],
  ["#ffb648", 1.5],
  ["#5fd98c", 1.4],
  ["#ffdc9a", 1.45],
  ["#5aa6ff", 1.9],
  ["#ffb648", 1.5],
  ["#ff7fb5", 1.55],
];

// 전구 크기: 모델의 구슬을 이만큼 키웁니다. 줄을 따라 큰 것 - 작은 것 - 중간 - 작은 것 순서가 되풀이됩니다. (이민정)
// 모델에서 구슬은 줄을 따라 차례로 놓여 있어서(이웃한 번호가 이웃한 구슬), 번호 순서대로 크기를 정하면 됩니다.
const BULB_SCALES = [2.2, 1.25, 1.65, 1.25];
// 전구를 트리 겉면에 얹을 때, 전구 가운데를 겉면에서 띄우는 거리 (전구 반지름의 몇 배). 1 이면 겉면에 딱 닿고, 조금 작으면 살짝 박힙니다.
const BULB_SIT = 0.82;
// 겉면을 찾지 못한 전구를 바깥쪽으로 내미는 정도 (전구 반지름의 몇 배)
const BULB_OUT = 1.05;

// 전구를 트리 겉면에 얹을 자리를 찾습니다. 제자리에서 키우기만 하면 전구가 트리의 볼록한 곳에 파묻혀 조각처럼 잘려 보이기 때문입니다.
// 전구 둘레에서 세 방향(가운데 축 쪽, 비스듬히 아래, 바로 아래)으로 선을 그어 가장 가까운 트리 겉면을 찾고,
// 그 겉면이 향하는 쪽으로 전구 반지름만큼 띄워 놓습니다. 그래서 가지 위에서는 위에 얹히고, 가지 옆에서는 옆에 붙습니다.
// 좌표는 전구 줄 메시 안의 좌표로 주고받습니다. 찾지 못하면 false 를 돌려줍니다.
type BulbSeat = (center: THREE.Vector3, axisX: number, axisZ: number, reach: number) => boolean;

function createBulbSeat(garland: THREE.Mesh, trees: THREE.Mesh[]): BulbSeat {
  const raycaster = new THREE.Raycaster();
  const from = new THREE.Vector3();
  const inward = new THREE.Vector3();
  const aim = new THREE.Vector3();
  const world = new THREE.Vector3();
  const best = new THREE.Vector3();
  const facing = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const worldScale = garland.getWorldScale(new THREE.Vector3()).x;
  const START = 0.14; // 선을 긋기 시작하는 곳: 전구에서 이만큼 물러난 자리
  const NEAR = 0.09; // 원래 자리에서 이보다 먼 겉면은 쓰지 않습니다 (다른 층의 가지 등)
  const OUTSIDE = 0.4; // 가려지는지 볼 때 선을 긋기 시작하는 곳: 전구에서 바깥으로 이만큼
  return (center, axisX, axisZ, reach) => {
    garland.localToWorld(world.copy(center));
    garland.localToWorld(from.set(axisX, center.y, axisZ));
    inward.copy(from).sub(world);
    inward.y = 0;
    if (inward.lengthSq() < 1e-10) return false;
    inward.normalize();
    let nearest = Infinity;
    for (const down of [0, 0.8, 1]) {
      if (down === 1) aim.set(0, -1, 0);
      else aim.copy(inward).multiplyScalar(1 - down).setY(-down).normalize();
      from.copy(world).addScaledVector(aim, -START);
      raycaster.set(from, aim);
      raycaster.far = START + NEAR;
      const hit = raycaster.intersectObjects(trees, false)[0];
      if (!hit || !hit.face) continue;
      const apart = hit.point.distanceTo(world);
      if (apart >= nearest) continue;
      nearest = apart;
      best.copy(hit.point);
      normal.copy(hit.face.normal).transformDirection(hit.object.matrixWorld);
      if (normal.dot(aim) > 0) normal.negate();
      facing.copy(normal);
    }
    if (nearest > NEAR) return false;
    const size = reach * worldScale;
    world.copy(best).addScaledVector(facing, size * BULB_SIT);
    // 옆에서 봤을 때 다른 가지(위층 가지의 처진 끝 등)에 가려지는 자리면, 가리고 있는 겉면의 바깥으로 옮깁니다.
    // 바깥에서 전구를 향해 수평으로 선을 그어, 전구에 닿기 전에 트리에 먼저 닿는지 봅니다.
    from.copy(world).addScaledVector(inward, -OUTSIDE);
    raycaster.set(from, inward);
    raycaster.far = OUTSIDE - size * 0.4;
    const cover = raycaster.intersectObjects(trees, false)[0];
    if (cover?.face) {
      normal.copy(cover.face.normal).transformDirection(cover.object.matrixWorld);
      if (normal.dot(inward) > 0) normal.negate();
      world.copy(cover.point).addScaledVector(normal, size * BULB_SIT);
    }
    center.copy(garland.worldToLocal(world));
    return true;
  };
}

// 전구가 놓일 자리는 미리 계산해 lib/tree-bulb-seats.json 에 넣어 두고, 화면에서는 읽기만 합니다.
// 겉면을 찾는 계산(위의 createBulbSeat)은 전구 하나마다 트리 전체를 훑어서, 화면을 열 때마다 하면 몇 초가 걸리기 때문입니다.
//  - count: 전구 수, check: 모델이 바뀌었는지 알아보는 값(원래 전구 자리들의 합), seats: 전구마다 x, y, z
//  - 트리 · 전구 줄 모델이나 전구 크기(BULB_SCALES)를 바꾸면 다시 계산해야 합니다:
//    개발 서버에서 /globe/demo?bake-bulbs 를 열면 브라우저 콘솔에 "BULB_SEATS" 로 시작하는 한 줄이 찍힙니다. 그 뒤의 내용을 파일에 넣습니다.
//  - 파일이 모델과 맞지 않으면 겉면 계산 없이 바깥으로 내밀기만 하고, 콘솔에 알립니다.
type BakedSeats = { count: number; check: number; seats: number[] };

// 전구 줄 모양은 트리 색을 바꿔도 같으므로, 한 번 만든 것을 다시 씁니다
const bulbGeometries = new WeakMap<THREE.BufferGeometry, THREE.BufferGeometry>();

// 전구마다 정해진 0~1 사이의 값 (볼 때마다 같은 전구가 같은 크기 · 같은 박자로 반짝이도록)
const bulbRandom = (bulb: number, salt: number) => {
  const x = Math.sin(bulb * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

// 전구가 반짝이는 박자를 흘려보내는 시계. 전구 줄을 그릴 때마다 지금 시각을 넣습니다.
const bulbClock = { value: 0 };

// 전구 재질: 스스로 빛나고(빛 번짐이 걸립니다), 전구마다 다른 박자로 이따금 잠깐 밝게 반짝입니다.
// 평소에는 조금 차분하게 켜져 있다가, 3~10초에 한 번쯤 반짝였다 돌아옵니다. '움직임 줄이기'에서는 반짝이지 않습니다.
function createBulbMaterial() {
  const material = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uBulbClock = bulbClock;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float aTwinkle;\nuniform float uBulbClock;\nvarying float vBulbGlow;")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        float bulbWave = 0.5 + 0.5 * sin(uBulbClock * (0.6 + fract(aTwinkle * 7.31) * 1.4) + aTwinkle * 6.2832);
        vBulbGlow = 0.78 + 1.5 * pow(bulbWave, 10.0);`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vBulbGlow;")
      .replace("#include <color_fragment>", "#include <color_fragment>\ndiffuseColor.rgb *= vBulbGlow;");
  };
  material.customProgramCacheKey = () => "tree-bulbs-twinkle";
  return material;
}

// 전구 줄은 구슬 수백 개가 한 덩어리로 붙어 있습니다. 서로 이어진 면끼리 묶어 구슬을 구분하고 구슬마다 색 · 크기 · 반짝이는 박자를 줍니다.
function colorBulbs(source: THREE.BufferGeometry, baked?: BakedSeats, seat?: BulbSeat, onSeats?: (seats: BakedSeats) => void) {
  const geometry = source.clone();
  const index = geometry.getIndex();
  const count = geometry.getAttribute("position").count;
  const parent = new Int32Array(count).map((_, i) => i);
  const find = (i: number) => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  if (index) {
    for (let i = 0; i < index.count; i += 3) {
      const a = find(index.getX(i));
      parent[find(index.getX(i + 1))] = a;
      parent[find(index.getX(i + 2))] = a;
    }
  }
  // 모델은 압축되어 있어서 좌표가 -1~1 범위의 정수로 들어 있습니다. 그대로 고치면 범위를 넘는 값이 잘려서,
  // 바깥으로 옮기거나 키운 전구가 벽에 눌린 것처럼 길게 찌그러집니다. 자유롭게 고칠 수 있는 실수 좌표로 바꿔 둡니다.
  const packed = geometry.getAttribute("position");
  const position = new THREE.BufferAttribute(new Float32Array(count * 3), 3);
  for (let i = 0; i < count; i++) position.setXYZ(i, packed.getX(i), packed.getY(i), packed.getZ(i));
  geometry.setAttribute("position", position);
  const bulbOf = new Map<number, number>();
  const bulbIndex = new Int32Array(count);
  const centers: number[] = [];
  const sizes: number[] = [];
  for (let i = 0; i < count; i++) {
    const root = find(i);
    let bulb = bulbOf.get(root);
    if (bulb === undefined) {
      bulb = bulbOf.size;
      bulbOf.set(root, bulb);
      centers.push(0, 0, 0);
      sizes.push(0);
    }
    bulbIndex[i] = bulb;
    centers[bulb * 3] += position.getX(i);
    centers[bulb * 3 + 1] += position.getY(i);
    centers[bulb * 3 + 2] += position.getZ(i);
    sizes[bulb] += 1;
  }
  // 구슬마다 가운데와 원래 반지름을 구하고, 트리의 가운데 축(구슬들의 한가운데)도 구합니다.
  const bulbCount = sizes.length;
  const radius = new Float32Array(bulbCount);
  let axisX = 0;
  let axisZ = 0;
  for (let bulb = 0; bulb < bulbCount; bulb++) {
    centers[bulb * 3] /= sizes[bulb];
    centers[bulb * 3 + 1] /= sizes[bulb];
    centers[bulb * 3 + 2] /= sizes[bulb];
    axisX += centers[bulb * 3] / bulbCount;
    axisZ += centers[bulb * 3 + 2] / bulbCount;
  }
  for (let i = 0; i < count; i++) {
    const bulb = bulbIndex[i];
    const far = Math.hypot(position.getX(i) - centers[bulb * 3], position.getY(i) - centers[bulb * 3 + 1], position.getZ(i) - centers[bulb * 3 + 2]);
    if (far > radius[bulb]) radius[bulb] = far;
  }
  // 구슬마다 크기를 정합니다: 줄을 따라 큰 것 - 작은 것 - 중간 - 작은 것 순서이고, 같은 크기끼리도 아주 조금씩 다릅니다 (±5%).
  const scales = new Float32Array(bulbCount);
  for (let bulb = 0; bulb < bulbCount; bulb++) scales[bulb] = BULB_SCALES[bulb % BULB_SCALES.length] * (0.95 + 0.1 * bulbRandom(bulb, 1));

  // 구슬이 놓일 자리(가운데). 미리 계산해 둔 값이 이 모델의 것이면 그대로 씁니다.
  let check = 0;
  for (let i = 0; i < bulbCount * 3; i++) check += centers[i];
  check = Math.round(check * 1000);
  const seats = new Float32Array(bulbCount * 3);
  if (baked && !seat && baked.count === bulbCount && Math.abs(baked.check - check) <= 2 && baked.seats.length === bulbCount * 3) {
    seats.set(baked.seats);
  } else {
    if (!seat) console.warn("전구 자리 파일(lib/tree-bulb-seats.json)이 모델과 맞지 않습니다. /globe/demo?bake-bulbs 로 다시 계산해 주세요.");
    const spot = new THREE.Vector3();
    for (let bulb = 0; bulb < bulbCount; bulb++) {
      const scale = scales[bulb];
      const cx = centers[bulb * 3];
      const cy = centers[bulb * 3 + 1];
      const cz = centers[bulb * 3 + 2];
      spot.set(cx, cy, cz);
      if (!seat?.(spot, axisX, axisZ, radius[bulb] * scale)) {
        // 겉면을 찾지 못하면(또는 찾지 않을 때) 가운데 축에서 멀어지는 쪽으로 내밉니다
        const away = Math.hypot(cx - axisX, cz - axisZ) || 1;
        const out = radius[bulb] * scale * BULB_OUT;
        spot.set(cx + ((cx - axisX) / away) * out, cy - out * 0.12, cz + ((cz - axisZ) / away) * out);
      }
      seats.set([spot.x, spot.y, spot.z], bulb * 3);
    }
    // 줄이 가지 사이 골이나 위층 가지 밑으로 깊이 들어간 곳은, 양옆 전구만큼 바깥으로 당겨 줄이 골을 건너가게 합니다.
    const reachOut = new Float32Array(bulbCount); // 가운데 축에서 떨어진 거리
    const linked = new Uint8Array(bulbCount); // 다음 번호의 전구와 줄로 이어져 있는지
    const gaps: number[] = [];
    for (let bulb = 0; bulb < bulbCount; bulb++) {
      reachOut[bulb] = Math.hypot(seats[bulb * 3] - axisX, seats[bulb * 3 + 2] - axisZ);
      if (bulb + 1 < bulbCount) {
        gaps.push(Math.hypot(centers[bulb * 3] - centers[bulb * 3 + 3], centers[bulb * 3 + 1] - centers[bulb * 3 + 4], centers[bulb * 3 + 2] - centers[bulb * 3 + 5]));
      }
    }
    const usualGap = [...gaps].sort((x, y) => x - y)[Math.floor(gaps.length / 2)] ?? 0;
    for (let bulb = 0; bulb + 1 < bulbCount; bulb++) linked[bulb] = gaps[bulb] < usualGap * 2.5 ? 1 : 0;
    const BRIDGE = 7; // 양옆으로 이만큼의 전구를 살핍니다
    for (let bulb = 0; bulb < bulbCount; bulb++) {
      let left = reachOut[bulb];
      for (let j = bulb - 1; j >= Math.max(0, bulb - BRIDGE) && linked[j]; j--) left = Math.max(left, reachOut[j]);
      let right = reachOut[bulb];
      for (let j = bulb + 1; j <= Math.min(bulbCount - 1, bulb + BRIDGE) && linked[j - 1]; j++) right = Math.max(right, reachOut[j]);
      const bridged = Math.min(left, right);
      if (bridged > reachOut[bulb] && reachOut[bulb] > 1e-6) {
        const pull = bridged / reachOut[bulb];
        seats[bulb * 3] = axisX + (seats[bulb * 3] - axisX) * pull;
        seats[bulb * 3 + 2] = axisZ + (seats[bulb * 3 + 2] - axisZ) * pull;
      }
    }
    onSeats?.({ count: bulbCount, check, seats: Array.from(seats, (v) => Math.round(v * 100000) / 100000) });
  }
  const colors = new Float32Array(count * 3);
  const twinkles = new Float32Array(count);
  const color = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const bulb = bulbIndex[i];
    twinkles[i] = bulbRandom(bulb, 2);
    const [hex, brightness] = BULB_COLORS[bulb % BULB_COLORS.length];
    color.set(hex).multiplyScalar(brightness);
    colors.set([color.r, color.g, color.b], i * 3);
    // 구슬을 키워서 정한 자리로 옮깁니다
    const scale = scales[bulb];
    position.setXYZ(
      i,
      seats[bulb * 3] + (position.getX(i) - centers[bulb * 3]) * scale,
      seats[bulb * 3 + 1] + (position.getY(i) - centers[bulb * 3 + 1]) * scale,
      seats[bulb * 3 + 2] + (position.getZ(i) - centers[bulb * 3 + 2]) * scale,
    );
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("aTwinkle", new THREE.BufferAttribute(twinkles, 1));
  // 전구를 옮겼으니 화면 밖 판정에 쓰는 둘레도 다시 잽니다
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

// 받침대 명패에 새길 글자 그림. 명패 면에 입혀서 스노우볼과 함께 돕니다 (FEEDBACK B4).
// 이름이 길면 글자를 줄이고, 가장 작은 크기에서도 넘치면 뒤를 "…"으로 줄입니다.
function createNameplateTexture(title: string) {
  // 명패 모양(가로 0.84, 세로 0.17)과 같은 비율입니다.
  const width = 1536;
  const height = 312;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (context) {
    const paper = context.createLinearGradient(0, 0, 0, height);
    paper.addColorStop(0, "#f8efdc");
    paper.addColorStop(1, "#ead9b9");
    context.fillStyle = paper;
    context.fillRect(0, 0, width, height);
    // 안쪽 가는 금색 선
    context.strokeStyle = "#c79a3e";
    context.lineWidth = 5;
    context.beginPath();
    context.roundRect(24, 24, width - 48, height - 48, 70);
    context.stroke();

    const text = title.trim();
    if (text) {
      const family = getComputedStyle(document.body).fontFamily || "sans-serif";
      const limit = width * 0.84;
      const fits = (value: string) => context.measureText(value).width <= limit;
      let size = 152;
      context.font = `700 ${size}px ${family}`;
      while (!fits(text) && size > 84) {
        size -= 4;
        context.font = `700 ${size}px ${family}`;
      }
      let shown = text;
      if (!fits(text)) {
        const letters = Array.from(text);
        while (letters.length > 1 && !fits(letters.join("").trimEnd() + "…")) letters.pop();
        shown = letters.join("").trimEnd() + "…";
      }
      context.textAlign = "center";
      context.textBaseline = "middle";
      const y = height / 2 + size * 0.04;
      // 새긴 글자처럼 보이게: 아래쪽에 밝은 턱을 먼저 그리고 그 위에 어두운 글자를 얹습니다
      context.fillStyle = "rgba(255, 255, 255, 0.85)";
      context.fillText(shown, width / 2, y + size * 0.035);
      context.fillStyle = "#141b33";
      context.fillText(shown, width / 2, y);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false; // 모델 파일(glTF)의 그림 방향에 맞춤
  texture.anisotropy = 8;
  return texture;
}

export type GlobeLook = {
  // 스노우볼 주제. 새해면 새해 모델을 그립니다 (안 넘기면 크리스마스).
  kind?: GlobeKind;
  // 받침대 명패에 그릴 글자. 비우면 빈 명패입니다 (글자를 화면에서 따로 얹을 때).
  title?: string;
  // 꾸미기 색. 비우면 모델 기본색입니다.
  treeColor?: string;
  trunkColor?: string; // 트리 색에 어울리는 나무 기둥 색
  baseColor?: string;
  // 꾸미기 소품. 별은 항상 트리 꼭대기에 있습니다.
  // 새해 스노우볼에서는 선물 자리가 떡국(+소반), 눈사람 자리가 담장(+까치)입니다.
  showGifts?: boolean;
  showSnowman?: boolean;
  // 새해 스노우볼의 윷가락(조각보) · 복조리
  showYut?: boolean;
  showBokjori?: boolean;
};

// 유리 안의 따뜻한 불빛: 트리 아래 눈을 비추는 빛과 꼭대기 별의 빛. 모델과 같은 자리에 둡니다.
// 새해 스노우볼은 양 다리 바로 앞에 불빛이 놓이지 않게, 위에서 은은하게 비추는 빛 하나만 둡니다 (차명근)
export function GlobeInnerLights({ kind = "christmas" }: { kind?: GlobeKind }) {
  if (kind === "newyear") return <pointLight position={[0.1, 1.3, 0.7]} intensity={0.4} distance={2.2} color="#ffd9a6" />;
  return (
    <>
      <pointLight position={[0.25, 0.42, 0.75]} intensity={0.55} distance={2.4} color="#ffb265" />
      <pointLight position={[0, 1.44, 0.22]} intensity={0.3} distance={1.3} color="#ffc777" />
    </>
  );
}

// 꾸미기 색을 입힙니다. 가장자리에 스며드는 빛도 그 색에 맞춥니다.
function recolor(material: THREE.MeshStandardMaterial, color: string, rimStrength: number) {
  material.color.set(color);
  material.emissive.set(color).multiplyScalar(0.35);
  material.emissiveIntensity = 0.3;
  const rim = `#${new THREE.Color(color).lerp(new THREE.Color("#ffffff"), 0.55).getHexString()}`;
  applyShaderExtras(material, { rim: { color: rim, strength: rimStrength } });
}

// 스노우볼 본체. 유리, 전구 줄, 별, 명패와 재질 값을 웹에 맞게 바꿉니다.
export function GlobeModel({ kind = "christmas", title = "", treeColor, trunkColor, baseColor, showGifts = true, showSnowman = true, showYut = true, showBokjori = true }: GlobeLook) {
  const { scene } = useGLTF(globeModelUrl(kind));

  // 글꼴이 늦게 불러와지면 명패 글자를 그 글꼴로 다시 그립니다.
  const [fontsReady, setFontsReady] = useState(false);
  useEffect(() => {
    let alive = true;
    document.fonts.ready.then(() => {
      if (alive) setFontsReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const nameplate = useMemo(() => {
    const texture = createNameplateTexture(title);
    const material = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.7,
      envMapIntensity: 0.2,
      // 밤 조명에서도 글자가 읽히도록 스스로 살짝 밝게
      emissive: "#ffffff",
      emissiveMap: texture,
      emissiveIntensity: 0.22,
    });
    return { texture, material };
    // fontsReady 가 바뀌면 다시 그립니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, fontsReady]);

  useEffect(
    () => () => {
      nameplate.texture.dispose();
      nameplate.material.dispose();
    },
    [nameplate],
  );

  const model = useMemo(() => {
    const copy = scene.clone(true);
    const glassFront = createGlassMaterial(false);
    const glassBack = createGlassMaterial(true);
    // 트리에 두른 점 줄은 여러 색의 작은 전구처럼 스스로 빛나고, 이따금 반짝입니다
    const bulbs = createBulbMaterial();
    const stillBulbs = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tuned = new Map<string, THREE.MeshStandardMaterial>();
    const glassMeshes: THREE.Mesh[] = [];
    const garlandMeshes: THREE.Mesh[] = [];
    const treeMeshes: THREE.Mesh[] = [];
    const furShells: [THREE.Mesh, THREE.Mesh][] = [];

    copy.traverse((child) => {
      // 꾸미기 소품: 고른 것만 보입니다.
      if (child.name.startsWith("w_Gift_")) child.visible = showGifts;
      if (child.name.startsWith("w_Snowman")) child.visible = showSnowman;
      // 새해 스노우볼의 소품: 담장(+까치), 떡국(+소반)
      if (child.name.startsWith("w_HanokWall") || child.name.startsWith("w_Magpie")) child.visible = showSnowman;
      if (child.name.startsWith("w_Soban") || child.name.startsWith("w_Tteokguk")) child.visible = showGifts;
      if (child.name.startsWith("w_Yut")) child.visible = showYut;
      if (child.name.startsWith("w_Bokjori")) child.visible = showBokjori;
      // 트리에 미리 붙어 있던 고리는 숨깁니다. 오너먼트는 제 꼭지(금속 부분)를 달고 걸립니다. (FEEDBACK B1)
      if (child.name.startsWith("w_Tree_Hooks")) child.visible = false;

      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (mesh.name.startsWith("w_Glass_Dome")) {
        glassMeshes.push(mesh);
        return;
      }
      if (mesh.name.startsWith("w_Tree_Garland")) {
        garlandMeshes.push(mesh);
        mesh.material = bulbs;
        // 그릴 때마다 반짝임의 시계를 지금 시각으로 맞춥니다 (움직임 줄이기에서는 멈춰 둡니다)
        mesh.onBeforeRender = () => {
          if (!stillBulbs) bulbClock.value = performance.now() / 1000;
        };
        return;
      }
      if (mesh.name.startsWith("w_Base_Nameplate") && !mesh.name.startsWith("w_Base_NameplateFrame")) {
        mesh.material = nameplate.material;
        return;
      }
      const material = mesh.material as THREE.MeshStandardMaterial;
      if (Array.isArray(material)) return;
      if (mesh.name.startsWith("w_Tree_Star")) {
        const star = material.clone();
        star.emissive.set("#ffb648");
        star.emissiveIntensity = 1.5;
        mesh.material = star;
        return;
      }
      // Blender 가 내보낼 때 재질 이름 뒤에 ".001" 같은 번호를 붙이는 일이 있어, 번호를 떼고 찾습니다.
      const name = material.name.replace(/\.\d+$/, "");
      if (name === TREE_MATERIAL) treeMeshes.push(mesh);
      const tune = MATERIAL_TUNES[name];
      if (!tune) return;
      if (name === SHEEP_FACE) {
        mesh.updateWorldMatrix(true, false);
        sheepBlushMatrix.value.copy(mesh.matrixWorld);
      }
      if (name === SHEEP_YARD) {
        mesh.updateWorldMatrix(true, false);
        yardShade.matrix.value.copy(mesh.matrixWorld);
      }
      if (name === SHEEP_WOOL || name === SHEEP_LEG) {
        // 양털 · 펠트: 바탕 겹 위에 바깥으로 부풀린 털 겹을 여러 장 더 그립니다
        const look = name === SHEEP_WOOL ? woolLook : feltLook;
        const layers = name === SHEEP_WOOL ? SHEEP_FUR_LAYERS : SHEEP_FELT.layers;
        mesh.updateWorldMatrix(true, false);
        const size = mesh.getWorldScale(new THREE.Vector3()).x;
        const base = material.clone();
        look(base, 0, size);
        mesh.material = base;
        for (let layer = 1; layer <= layers; layer++) {
          const shell = mesh.clone();
          shell.name = "";
          const fur = material.clone();
          look(fur, layer / layers, size);
          shell.material = fur;
          furShells.push([mesh, shell]);
        }
        return;
      }
      let next = tuned.get(name);
      if (!next) {
        next = material.clone();
        tune(next);
        if (name === TREE_MATERIAL && treeColor) recolor(next, treeColor, 0.2);
        if (name === TRUNK_MATERIAL && trunkColor) recolor(next, trunkColor, 0.1);
        if (name === BASE_MATERIAL && baseColor) recolor(next, baseColor, 0.18);
        tuned.set(name, next);
      }
      mesh.material = next;
    });
    for (const [mesh, shell] of furShells) mesh.parent?.add(shell);
    // 전구: 색 · 크기를 주고, 미리 계산해 둔 자리(트리 겉면 위)에 놓습니다
    if (garlandMeshes.length) {
      copy.updateMatrixWorld(true);
      for (const mesh of garlandMeshes) {
        let geometry = bulbGeometries.get(mesh.geometry);
        if (!geometry) {
          const bake = process.env.NODE_ENV !== "production" && typeof window !== "undefined" && window.location.search.includes("bake-bulbs");
          geometry = bake
            ? colorBulbs(mesh.geometry, undefined, createBulbSeat(mesh, treeMeshes), (seats) => console.log("BULB_SEATS " + JSON.stringify(seats)))
            : colorBulbs(mesh.geometry, bakedBulbSeats as BakedSeats);
          bulbGeometries.set(mesh.geometry, geometry);
        }
        mesh.geometry = geometry;
      }
    }
    // 유리는 건너편 안쪽 면을 먼저, 앞면을 나중에 그립니다.
    for (const mesh of glassMeshes) {
      fitGlass(mesh, [glassFront, glassBack]);
      const inner = mesh.clone();
      inner.material = glassBack;
      inner.renderOrder = 9;
      mesh.parent?.add(inner);
      mesh.material = glassFront;
      mesh.renderOrder = 10;
    }
    return copy;
  }, [scene, nameplate, treeColor, trunkColor, baseColor, showGifts, showSnowman, showYut, showBokjori]);

  // 새해 스노우볼의 마당 그림자: 꾸미기에서 끈 소품은 그림자도 지웁니다
  useEffect(() => {
    yardShade.wall.value = showSnowman ? 1 : 0;
    yardShade.soban.value = showGifts ? 1 : 0;
    yardShade.yut.value = showYut ? 1 : 0;
    yardShade.bokjori.value = showBokjori ? 1 : 0;
  }, [showSnowman, showGifts, showYut, showBokjori]);

  // 새해 스노우볼의 2027: 스노우볼과 함께 돌고, 공중에서 천천히 살짝 오르내립니다.
  const year = useRef<{ object: THREE.Object3D; y: number } | null>(null);
  useEffect(() => {
    const object = model.getObjectByName("w_Year2027");
    year.current = object ? { object, y: object.position.y } : null;
  }, [model]);
  useFrame(({ clock }) => {
    const item = year.current;
    if (!item) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    item.object.position.y = item.y + (still ? 0 : Math.sin(clock.elapsedTime * 0.9) * 0.012);
  });

  return <primitive object={model} />;
}

type ExtraLook = { showReindeer?: boolean; showGingerHouse?: boolean };

// 추가 소품: 눈사람 자리의 루돌프, 선물 자리의 과자집. 이 컴포넌트를 그릴 때에만 props.glb 를 내려받습니다.
export function GlobeExtras({ showReindeer = false, showGingerHouse = false }: ExtraLook) {
  const { scene } = useGLTF(PROPS_URL);
  const model = useMemo(() => {
    const copy = scene.clone(true);
    const tuned = new Map<string, THREE.MeshStandardMaterial>();
    copy.updateMatrixWorld(true);
    copy.traverse((child) => {
      if (child.name.startsWith("w_Reindeer")) child.visible = showReindeer;
      if (child.name.startsWith("w_GingerHouse")) child.visible = showGingerHouse;
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      const material = mesh.material as THREE.MeshStandardMaterial;
      if (Array.isArray(material)) return;
      const name = material.name.replace(/\.\d+$/, "");
      const tune = MATERIAL_TUNES[name];
      if (!tune) return;
      // 볼터치 자리를 맞추려면 털 메시가 모델 안에서 놓인 자리를 알아야 합니다
      if (name === REINDEER_FUR) reindeerBlushMatrix.value.copy(mesh.matrixWorld);
      let next = tuned.get(name);
      if (!next) {
        next = material.clone();
        tune(next);
        tuned.set(name, next);
      }
      mesh.material = next;
    });
    return copy;
  }, [scene, showReindeer, showGingerHouse]);

  return <primitive object={model} />;
}

// 메시지 오너먼트는 처음부터 달려 있던 기본 장식보다 크게 답니다.
const MESSAGE_SCALE = 1.25;

// 새 오너먼트가 달리는 움직임이 시작되는 곳 (유리 안 위쪽 가운데)
const DROP_FROM: [number, number, number] = [0, 1.38, 0];
const DROP_SECONDS = 1.6;

function OrnamentItem({
  placed,
  parts,
  selected,
  highlight,
  arriving,
  reducedMotion,
  onSelect,
}: {
  placed: PlacedOrnament;
  parts: TemplatePart[];
  selected: boolean;
  highlight: boolean; // 빛나게 보여 줄 오너먼트 (방금 고른 것)
  arriving: boolean; // 지금 막 달리는 오너먼트
  reducedMotion: boolean;
  onSelect?: (id: string) => void;
}) {
  const { slot, color, metallic, ornament } = placed;
  const group = useRef<THREE.Group>(null);
  const arriveStart = useRef<number | null>(null);

  const materials = useOrnamentMaterials(parts, color, metallic, highlight);

  const baseScale = placed.scale * (ornament ? MESSAGE_SCALE : 1);
  const [homeX, homeY, homeZ] = placed.position;

  useFrame(({ clock }) => {
    const item = group.current;
    if (!item) return;
    // 달리는 중이면 위에서 제자리로 천천히 내려옵니다.
    if (arriving && !reducedMotion) {
      arriveStart.current ??= clock.elapsedTime;
      const t = Math.min(1, (clock.elapsedTime - arriveStart.current) / DROP_SECONDS);
      const eased = 1 - (1 - t) ** 3;
      item.position.set(
        THREE.MathUtils.lerp(DROP_FROM[0], homeX, eased),
        THREE.MathUtils.lerp(DROP_FROM[1], homeY, eased),
        THREE.MathUtils.lerp(DROP_FROM[2], homeZ, eased),
      );
    } else {
      arriveStart.current = null;
      item.position.set(homeX, homeY, homeZ);
    }
    const pulse = highlight && !reducedMotion ? 1 + Math.sin(clock.elapsedTime * 2.4) * 0.08 : 1;
    item.scale.setScalar(baseScale * (selected ? 1.35 : highlight ? 1.3 : 1) * pulse);
  });

  return (
    <group
      ref={group}
      position={placed.position}
      quaternion={slot.quaternion}
      scale={baseScale}
      onClick={
        ornament && onSelect
          ? (event) => {
              event.stopPropagation();
              onSelect(ornament.id);
            }
          : undefined
      }
    >
      <OrnamentParts parts={parts} materials={materials} />
    </group>
  );
}

// 메시지 오너먼트와 기본 장식을 트리 자리에 답니다.
export function Ornaments({
  ornaments,
  kind = "christmas",
  selectedId = null,
  highlightId,
  arrivingId,
  reducedMotion = false,
  onSelect,
}: {
  ornaments: OrnamentLike[];
  kind?: GlobeKind; // 스노우볼 주제: 자리 묶음과 오너먼트 원형 파일이 주제마다 다릅니다
  selectedId?: string | null;
  highlightId?: string;
  arrivingId?: string;
  reducedMotion?: boolean;
  onSelect?: (id: string) => void;
}) {
  const templates = useOrnamentTemplates(kind === "newyear" ? NEWYEAR_ORNAMENT_URL : ORNAMENT_URL);
  const placed = useMemo(() => placeOrnaments(ornaments, kind), [ornaments, kind]);

  return (
    <>
      {placed.map((item) => (
        <OrnamentItem
          key={item.key}
          placed={item}
          parts={templates[item.shape]}
          selected={item.ornament !== null && item.ornament.id === selectedId}
          highlight={item.ornament !== null && item.ornament.id === highlightId}
          arriving={item.ornament !== null && item.ornament.id === arrivingId}
          reducedMotion={reducedMotion}
          onSelect={onSelect}
        />
      ))}
    </>
  );
}

// 스노우볼 모델 미리 받기는 페이지의 <ModelPreload> 가 맡습니다 (components/ModelPreload.tsx).
// 여기서 useGLTF.preload(MODEL_URL) 를 하면 새해 스노우볼을 볼 때도 크리스마스 모델(약 900KB)을 함께 받게 되어 뺐습니다 (차명근).
