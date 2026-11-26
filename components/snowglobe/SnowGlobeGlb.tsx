"use client";

// Blender 에서 만든 스노우볼 모델과 오너먼트입니다. 어느 3D 장면(<Canvas>) 안에든 끼워 쓸 수 있습니다.
// 좌표는 모델 원본 그대로입니다: 유리 구의 가운데가 (0, 0.55, 0), 반지름 1, 받침대 맨 아래가 y = -0.655.

import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { BEFORE_TONE_MAPPING_GLSL, backdropUniforms } from "@/components/stage/backdropShared";
import { placeOrnaments, type OrnamentLike, type OrnamentShape, type PlacedOrnament } from "@/lib/snowglobe";

const MODEL_URL = "/models/snowglobe.glb";
const ORNAMENT_URL = "/models/ornaments.glb";
const TEMPLATE_NAMES: Record<OrnamentShape, string> = { ball: "t_Orn_Ball", star: "t_Orn_Star", heart: "t_Orn_Heart" };

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
};

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
  material.customProgramCacheKey = () => JSON.stringify(extras);
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

// 전구 줄 모양은 트리 색을 바꿔도 같으므로, 한 번 만든 것을 다시 씁니다 (겉면을 찾는 계산이 무겁습니다)
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
function colorBulbs(source: THREE.BufferGeometry, seat?: BulbSeat) {
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
  // 구슬마다 크기와 놓일 자리(가운데)를 정합니다.
  // 크기는 줄을 따라 큰 것 - 작은 것 - 중간 - 작은 것 순서이고, 같은 크기끼리도 아주 조금씩 다릅니다 (±5%).
  const scales = new Float32Array(bulbCount);
  const seats = new Float32Array(bulbCount * 3);
  const seated = new Uint8Array(bulbCount); // 트리 겉면을 찾아 얹었는지
  const spot = new THREE.Vector3();
  for (let bulb = 0; bulb < bulbCount; bulb++) {
    const scale = BULB_SCALES[bulb % BULB_SCALES.length] * (0.95 + 0.1 * bulbRandom(bulb, 1));
    scales[bulb] = scale;
    const cx = centers[bulb * 3];
    const cy = centers[bulb * 3 + 1];
    const cz = centers[bulb * 3 + 2];
    spot.set(cx, cy, cz);
    seated[bulb] = seat?.(spot, axisX, axisZ, radius[bulb] * scale) ? 1 : 0;
    if (!seated[bulb]) {
      // 겉면을 찾지 못하면 가운데 축에서 멀어지는 쪽으로 내밉니다
      const away = Math.hypot(cx - axisX, cz - axisZ) || 1;
      const out = radius[bulb] * scale * BULB_OUT;
      spot.set(cx + ((cx - axisX) / away) * out, cy - out * 0.12, cz + ((cz - axisZ) / away) * out);
    }
    seats.set([spot.x, spot.y, spot.z], bulb * 3);
  }
  // 줄이 가지 사이 골이나 위층 가지 밑으로 깊이 들어간 곳은, 양옆 전구만큼 바깥으로 당겨 줄이 골을 건너가게 합니다.
  // (그대로 두면 그 전구들이 틈 사이로 조각처럼 잘려 보입니다)
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
  // 받침대 명패에 그릴 글자. 비우면 빈 명패입니다 (글자를 화면에서 따로 얹을 때).
  title?: string;
  // 꾸미기 색. 비우면 모델 기본색입니다.
  treeColor?: string;
  trunkColor?: string; // 트리 색에 어울리는 나무 기둥 색
  baseColor?: string;
  // 꾸미기 소품. 별은 항상 트리 꼭대기에 있습니다.
  showGifts?: boolean;
  showSnowman?: boolean;
};

// 유리 안의 따뜻한 불빛: 트리 아래 눈을 비추는 빛과 꼭대기 별의 빛. 모델과 같은 자리에 둡니다.
export function GlobeInnerLights() {
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
export function GlobeModel({ title = "", treeColor, trunkColor, baseColor, showGifts = true, showSnowman = true }: GlobeLook) {
  const { scene } = useGLTF(MODEL_URL);

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

    copy.traverse((child) => {
      // 꾸미기 소품: 고른 것만 보입니다.
      if (child.name.startsWith("w_Gift_")) child.visible = showGifts;
      if (child.name.startsWith("w_Snowman")) child.visible = showSnowman;
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
    // 전구: 색 · 크기를 주고 트리 겉면에 얹습니다
    if (garlandMeshes.length) {
      copy.updateMatrixWorld(true);
      for (const mesh of garlandMeshes) {
        let geometry = bulbGeometries.get(mesh.geometry);
        if (!geometry) {
          geometry = colorBulbs(mesh.geometry, createBulbSeat(mesh, treeMeshes));
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
  }, [scene, nameplate, treeColor, trunkColor, baseColor, showGifts, showSnowman]);

  return <primitive object={model} />;
}

type TemplatePart = { geometry: THREE.BufferGeometry; role: "main" | "accent" | "metal"; material: THREE.MeshStandardMaterial };

// 오너먼트 원형(볼·별·하트)을 부분별로 꺼냅니다. 본체 색과 무늬 색은 오너먼트마다 바꿉니다.
function useOrnamentTemplates() {
  const { scene } = useGLTF(ORNAMENT_URL);
  return useMemo(() => {
    const templates: Record<OrnamentShape, TemplatePart[]> = { ball: [], star: [], heart: [] };
    for (const shape of Object.keys(TEMPLATE_NAMES) as OrnamentShape[]) {
      scene.getObjectByName(TEMPLATE_NAMES[shape])?.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh) return;
        const material = mesh.material as THREE.MeshStandardMaterial;
        const role = material.name.startsWith("Orn_Main") ? "main" : material.name.startsWith("Orn_Accent") ? "accent" : "metal";
        templates[shape].push({ geometry: mesh.geometry, role, material });
      });
    }
    return templates;
  }, [scene]);
}

const CREAM = "#fff5e2";
const ROSE = "#f2779b";

// 메시지 오너먼트는 처음부터 달려 있던 기본 장식보다 크게 답니다.
const MESSAGE_SCALE = 1.25;

// 오너먼트 색을 맑고 화사한 파스텔 톤으로 바꿉니다. 흰색 · 크림색처럼 색기가 거의 없는 색은 그대로 둡니다.
function pastel(color: string) {
  const result = new THREE.Color(color);
  const hsl = { h: 0, s: 0, l: 0 };
  result.getHSL(hsl);
  if (hsl.s < 0.18) return result;
  const s = THREE.MathUtils.lerp(hsl.s, 1, 0.75);
  const l = THREE.MathUtils.lerp(hsl.l, 0.62, 0.7);
  return result.setHSL(hsl.h, s, l);
}

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

  const materials = useMemo(() => {
    const mainBase = parts.find((part) => part.role === "main")?.material;
    const accentBase = parts.find((part) => part.role === "accent")?.material;
    const main = mainBase?.clone();
    const body = pastel(color);
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
    }
    const accent = accentBase?.clone();
    if (accent) {
      // 무늬는 본체 색과 구분되게: 흰색에 가까운 본체에는 분홍, 그 밖에는 크림색
      const hsl = { h: 0, s: 0, l: 0 };
      body.getHSL(hsl);
      accent.color.set(hsl.l > 0.82 ? ROSE : CREAM);
      accent.emissive.copy(accent.color);
      accent.emissiveIntensity = 0.2;
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
      {parts.map((part, index) => (
        <mesh
          key={index}
          geometry={part.geometry}
          material={
            part.role === "main" ? (materials.main ?? part.material) : part.role === "accent" ? (materials.accent ?? part.material) : part.material
          }
        />
      ))}
    </group>
  );
}

// 메시지 오너먼트와 기본 장식을 트리 자리에 답니다.
export function Ornaments({
  ornaments,
  selectedId = null,
  highlightId,
  arrivingId,
  reducedMotion = false,
  onSelect,
}: {
  ornaments: OrnamentLike[];
  selectedId?: string | null;
  highlightId?: string;
  arrivingId?: string;
  reducedMotion?: boolean;
  onSelect?: (id: string) => void;
}) {
  const templates = useOrnamentTemplates();
  const placed = useMemo(() => placeOrnaments(ornaments), [ornaments]);

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


useGLTF.preload(MODEL_URL);
useGLTF.preload(ORNAMENT_URL);
