"use client";

// 오너먼트 모델(public/models/ornaments.glb)을 읽고 색을 입히는 부분입니다. (이민정 님 SnowGlobeGlb.tsx 에서 옮김, 차명근)
// 스노우볼에 달린 오너먼트(SnowGlobeGlb.tsx 의 Ornaments)와, 오너먼트 하나만 크게 보여 주는 장면(기념 메시지, FEEDBACK F1)이 함께 씁니다.
// 이 파일은 스노우볼 모델(snowglobe.glb, 약 900KB)을 불러오지 않습니다. 기념 메시지 화면이 오너먼트 모델(약 40KB)만 받게 하려고 따로 뗐습니다.

import { useGLTF } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { OrnamentShape } from "@/lib/snowglobe";

export const ORNAMENT_URL = "/models/ornaments.glb";
// 새해 스노우볼 전용 오너먼트(복주머니 · 방패연 · 노리개). 새해 스노우볼을 그릴 때에만 받습니다. (차명근)
export const NEWYEAR_ORNAMENT_URL = "/models/ornaments-newyear.glb";
const TEMPLATE_NAMES: Record<OrnamentShape, string> = {
  ball: "t_Orn_Ball",
  star: "t_Orn_Star",
  heart: "t_Orn_Heart",
  pouch: "t_Orn_Pouch",
  kite: "t_Orn_Kite",
  norigae: "t_Orn_Norigae",
};
const NEWYEAR_SHAPES: OrnamentShape[] = ["pouch", "kite", "norigae"];
// 그 모양의 원형이 들어 있는 파일
export const ornamentUrl = (shape: OrnamentShape) => (NEWYEAR_SHAPES.includes(shape) ? NEWYEAR_ORNAMENT_URL : ORNAMENT_URL);

export type TemplatePart = { geometry: THREE.BufferGeometry; role: "main" | "accent" | "metal"; material: THREE.MeshStandardMaterial };

// 오너먼트 원형을 부분별로 꺼냅니다. 본체 색과 무늬 색은 오너먼트마다 바꿉니다.
// url 파일에 없는 모양은 빈 목록입니다 (그리지 않음).
export function useOrnamentTemplates(url: string = ORNAMENT_URL) {
  const { scene } = useGLTF(url);
  return useMemo(() => {
    const templates: Record<OrnamentShape, TemplatePart[]> = { ball: [], star: [], heart: [], pouch: [], kite: [], norigae: [] };
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

// 오너먼트 하나의 재질(본체 · 무늬)을 만듭니다. 화면에서 사라지면 정리합니다.
export function useOrnamentMaterials(parts: TemplatePart[], color: string, metallic: boolean, highlight: boolean) {
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
