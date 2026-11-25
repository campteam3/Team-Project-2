"use client";

// Blender 에서 만든 스노우볼 모델과 오너먼트입니다. 어느 3D 장면(<Canvas>) 안에든 끼워 쓸 수 있습니다.
// 좌표는 모델 원본 그대로입니다: 유리 구의 가운데가 (0, 0.55, 0), 반지름 1, 받침대 맨 아래가 y = -0.655.

import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { placeOrnaments, type OrnamentLike, type OrnamentShape, type PlacedOrnament } from "@/lib/snowglobe";

const MODEL_URL = "/models/snowglobe.glb";
const ORNAMENT_URL = "/models/ornaments.glb";
const TEMPLATE_NAMES: Record<OrnamentShape, string> = { ball: "t_Orn_Ball", star: "t_Orn_Star", heart: "t_Orn_Heart" };

// 유리: 가운데는 완전히 맑고, 창 모양 반사광이 구의 곡면을 따라 또렷하게 맺히며, 테두리에 가는 밝은 선이 돕니다.
// 반사는 "보는 방향이 유리에 튕겨 나간 방향"으로 계산해서 실제 유리처럼 휘어 보입니다.
// back 이 true 면 유리 안쪽 뒷면(건너편 벽)에 비친 옅은 반사를 그립니다.
function createGlassMaterial(back: boolean) {
  return new THREE.ShaderMaterial({
    transparent: true,
    premultipliedAlpha: true,
    depthWrite: false,
    side: back ? THREE.BackSide : THREE.FrontSide,
    uniforms: { uBack: { value: back ? 1 : 0 } },
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vView = normalize(-viewPosition.xyz);
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uBack;
      varying vec3 vNormal;
      varying vec3 vView;
      float band(float x, float center, float halfWidth, float soft) {
        return smoothstep(center - halfWidth - soft, center - halfWidth + soft, x)
          * (1.0 - smoothstep(center + halfWidth - soft, center + halfWidth + soft, x));
      }
      // 반사 방향 r 이 창(네모난 조명) 안에 들어오는 정도
      float softbox(vec3 r, float azimuth, float elevation, float halfW, float halfH, float soft) {
        return band(atan(r.x, r.z), azimuth, halfW, soft) * band(asin(clamp(r.y, -1.0, 1.0)), elevation, halfH, soft);
      }
      // 반사 방향 r 근처의 작은 동그란 불빛
      float glint(vec3 r, vec3 direction, float size) {
        return smoothstep(size, size * 0.35, acos(clamp(dot(r, normalize(direction)), -1.0, 1.0)));
      }
      void main() {
        vec3 n = normalize(vNormal) * (uBack > 0.5 ? -1.0 : 1.0);
        vec3 v = normalize(vView);
        float facing = clamp(dot(n, v), 0.0, 1.0);
        float fresnel = 0.04 + 0.96 * pow(1.0 - facing, 5.0);
        vec3 r = reflect(-v, n);

        // 창 모양 반사광: 왼쪽 위 큰 창, 오른쪽 길쭉한 창, 아래쪽에 비친 바닥
        float windows = softbox(r, -0.78, 0.66, 0.30, 0.30, 0.03) * 0.95
          + softbox(r, 0.98, 0.42, 0.11, 0.44, 0.025) * 0.6
          + softbox(r, -0.15, -0.8, 0.55, 0.1, 0.06) * 0.22;
        // 창 위쪽이 더 밝고 아래로 갈수록 옅어지게
        float reflection = windows * (0.3 + 0.7 * fresnel) * (0.75 + 0.5 * clamp(r.y, 0.0, 1.0));

        // 유리에 비친 주변 불빛 (따뜻한 색 위주로 몇 가지 색)
        vec3 lights = vec3(1.0, 0.72, 0.36) * glint(r, vec3(-0.9, 0.15, -0.4), 0.16)
          + vec3(1.0, 0.55, 0.45) * glint(r, vec3(0.85, 0.3, -0.45), 0.13) * 0.9
          + vec3(1.0, 0.82, 0.5) * glint(r, vec3(0.45, -0.5, -0.75), 0.15) * 0.8
          + vec3(0.6, 0.8, 1.0) * glint(r, vec3(-0.55, 0.62, -0.55), 0.1) * 0.7
          + vec3(1.0, 0.7, 0.8) * glint(r, vec3(0.15, 0.85, -0.5), 0.09) * 0.6;
        lights *= 0.55 + 0.45 * fresnel;

        // 작고 날카로운 반짝임
        float sparkle = pow(max(dot(r, normalize(vec3(-0.5, 0.62, 0.6))), 0.0), 1400.0) * 2.2;

        // 테두리: 가는 밝은 선, 그 안쪽은 두꺼운 유리처럼 살짝 어둡게
        float edgeLine = pow(1.0 - facing, 7.0);
        float edgeShade = smoothstep(0.42, 0.04, facing) * 0.14;
        vec3 iris = 0.5 + 0.5 * cos(6.2832 * (edgeLine * 1.2 + vec3(0.0, 0.33, 0.67)));
        vec3 edgeColor = mix(vec3(0.86, 0.93, 1.0), iris, 0.22);

        float strength = uBack > 0.5 ? 0.3 : 1.0;
        vec3 color = (vec3(0.93, 0.97, 1.0) * reflection + lights + vec3(1.0) * sparkle) * strength
          + edgeColor * edgeLine * (uBack > 0.5 ? 0.0 : 0.95);
        float alpha = (reflection * 0.9 + dot(lights, vec3(0.33)) + sparkle) * strength
          + (uBack > 0.5 ? 0.0 : edgeShade + edgeLine * 0.55 + 0.006);
        gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0));
        #include <colorspace_fragment>
      }
    `,
  });
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

const TREE_MATERIAL = "W_Ceramic_Green";
const BASE_MATERIAL = "W_Base_RedMat";

type Tune = (material: THREE.MeshStandardMaterial) => void;

// 재질 이름별로 웹에서 다듬는 값. Blender 에서 넘어온 색 위에 덧입힙니다.
const MATERIAL_TUNES: Record<string, Tune> = {
  // 트리: 매끈하지만 광이 없는 부드러운 클레이
  W_Ceramic_Green: (material) => {
    material.color.set("#2a9c4a");
    makeMatte(material, 0.8, 0.22);
    material.emissive.set("#0b3d1b");
    material.emissiveIntensity = 0.3;
    applyShaderExtras(material, { rim: { color: "#8ff0aa", strength: 0.2 } });
  },
  W_Ceramic_Trunk: (material) => {
    material.color.set("#124526");
    makeMatte(material, 0.82, 0.2);
  },
  // 받침대: 트리와 같은 질감
  W_Base_RedMat: (material) => {
    material.color.set("#b5161f");
    makeMatte(material, 0.78, 0.22);
    material.emissive.set("#3a0508");
    material.emissiveIntensity = 0.3;
    applyShaderExtras(material, { rim: { color: "#ff9a94", strength: 0.18 } });
  },
  W_Base_Holly: (material) => {
    makeMatte(material, 0.8, 0.2);
    material.emissive.set("#06260f");
    material.emissiveIntensity = 0.3;
    applyShaderExtras(material, { rim: { color: "#8ff0aa", strength: 0.14 } });
  },
  W_Base_HollyVein: (material) => makeMatte(material, 0.8, 0.2),
  W_Base_HollyRed: (material) => makeMatte(material, 0.6, 0.35),
  // 눈: 광택 없이 포슬포슬하게
  W_Snow_Sparkle: (material) => {
    material.color.set("#f1f5ff");
    makeMatte(material, 1, 0.15);
    material.emissive.set("#1c2c5c");
    material.emissiveIntensity = 0.14;
    applyShaderExtras(material, { grain: { scale: 75, strength: 0.5 } });
  },
  // 눈사람: 눈과 같은 질감, 니트는 광택 없는 천
  W_SM_Body: (material) => {
    material.color.set("#f6f8ff");
    makeMatte(material, 1, 0.12);
    material.emissive.set("#1c2c5c");
    material.emissiveIntensity = 0.12;
    applyShaderExtras(material, { grain: { scale: 95, strength: 0.6 }, rim: { color: "#dfe9ff", strength: 0.12 } });
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

const BULB_SCALE = 1.7;

// 전구 줄은 구슬 수백 개가 한 덩어리로 붙어 있습니다. 서로 이어진 면끼리 묶어 구슬을 구분하고 구슬마다 색을 줍니다.
function colorBulbs(source: THREE.BufferGeometry) {
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
  const position = geometry.getAttribute("position");
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
  const colors = new Float32Array(count * 3);
  const color = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const bulb = bulbIndex[i];
    const [hex, brightness] = BULB_COLORS[bulb % BULB_COLORS.length];
    color.set(hex).multiplyScalar(brightness);
    colors.set([color.r, color.g, color.b], i * 3);
    // 색이 보이도록 구슬을 제자리에서 조금 키웁니다.
    const cx = centers[bulb * 3] / sizes[bulb];
    const cy = centers[bulb * 3 + 1] / sizes[bulb];
    const cz = centers[bulb * 3 + 2] / sizes[bulb];
    position.setXYZ(
      i,
      cx + (position.getX(i) - cx) * BULB_SCALE,
      cy + (position.getY(i) - cy) * BULB_SCALE,
      cz + (position.getZ(i) - cz) * BULB_SCALE,
    );
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geometry;
}

// 받침대 명패에 들어갈 글자 그림. 스노우볼 이름이 길면 글자를 줄여서 한 줄에 맞춥니다.
function createNameplateTexture(title: string) {
  const width = 1024;
  const height = 322;
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
    context.roundRect(26, 26, width - 52, height - 52, 110);
    context.stroke();

    const text = title.trim();
    if (text) {
      const family = getComputedStyle(document.body).fontFamily || "sans-serif";
      let size = 150;
      do {
        context.font = `700 ${size}px ${family}`;
        size -= 6;
      } while (context.measureText(text).width > width * 0.8 && size > 36);
      context.fillStyle = "#7a1a22";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(text, width / 2, height / 2 + size * 0.04);
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
export function GlobeModel({ title = "", treeColor, baseColor, showGifts = true, showSnowman = true }: GlobeLook) {
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
    // 트리에 두른 점 줄은 여러 색의 작은 전구처럼 스스로 빛나게 (빛 번짐이 걸립니다)
    const bulbs = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
    const tuned = new Map<string, THREE.MeshStandardMaterial>();
    const glassMeshes: THREE.Mesh[] = [];

    copy.traverse((child) => {
      // 꾸미기 소품: 고른 것만 보입니다.
      if (child.name.startsWith("w_Gift_")) child.visible = showGifts;
      if (child.name.startsWith("w_Snowman")) child.visible = showSnowman;

      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (mesh.name.startsWith("w_Glass_Dome")) {
        glassMeshes.push(mesh);
        return;
      }
      if (mesh.name.startsWith("w_Tree_Garland")) {
        mesh.geometry = colorBulbs(mesh.geometry);
        mesh.material = bulbs;
        return;
      }
      if (mesh.name.startsWith("w_Base_NameplateFrame")) return;
      if (mesh.name.startsWith("w_Base_Nameplate")) {
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
      const tune = MATERIAL_TUNES[material.name];
      if (!tune) return;
      let next = tuned.get(material.name);
      if (!next) {
        next = material.clone();
        tune(next);
        if (material.name === TREE_MATERIAL && treeColor) recolor(next, treeColor, 0.2);
        if (material.name === BASE_MATERIAL && baseColor) recolor(next, baseColor, 0.18);
        tuned.set(material.name, next);
      }
      mesh.material = next;
    });
    // 유리는 건너편 안쪽 면을 먼저, 앞면을 나중에 그립니다.
    for (const mesh of glassMeshes) {
      const inner = mesh.clone();
      inner.material = glassBack;
      inner.renderOrder = 9;
      mesh.parent?.add(inner);
      mesh.material = glassFront;
      mesh.renderOrder = 10;
    }
    return copy;
  }, [scene, nameplate, treeColor, baseColor, showGifts, showSnowman]);

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

const CREAM = "#efe6d0";
const DARK_RED = "#8a1420";

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
    if (main) {
      main.color.set(color);
      if (metallic) {
        // 어두운 밤 배경이 비쳐 갈색으로 죽지 않도록 스스로 살짝 빛나게
        main.metalness = 0.8;
        main.roughness = 0.28;
        main.emissive.set(color);
        main.emissiveIntensity = 0.28;
      }
      if (highlight) {
        main.emissive.set(color);
        main.emissiveIntensity = 0.5;
      }
    }
    const accent = accentBase?.clone();
    if (accent) {
      // 무늬는 본체 색과 구분되게: 밝은 본체에는 짙은 빨강, 어두운 본체에는 크림색
      const hsl = { h: 0, s: 0, l: 0 };
      new THREE.Color(color).getHSL(hsl);
      accent.color.set(hsl.l > 0.6 ? DARK_RED : CREAM);
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

  const baseScale = placed.scale;
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
