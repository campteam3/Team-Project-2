"use client";

// 스노우볼 뒤에 까는 그림 배경(눈 내린 마을의 밤)입니다. (이민정)
//  - 가로로 긴 화면은 public/backgrounds/village-web.webp, 세로로 긴 화면은 village-mobile.webp 를 씁니다 (backdropShared.ts).
//  - 그림은 화면을 꽉 채우고(넘치는 쪽은 잘라 냄), 스노우볼을 돌려도 움직이지 않습니다.
//  - 장면의 마지막 색 보정(NightBloom)을 거치면 그림이 어둡고 탁해지므로, 미리 반대로 보정해 원래 색이 나오게 합니다.
//  - 받아 온 그림은 유리(SnowGlobeGlb)도 함께 읽어서, 유리 표면에 배경이 비칩니다.

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { BEFORE_TONE_MAPPING_GLSL, backdropImages, backdropUniforms, type BackdropScene } from "./backdropShared";

// 그림을 받기 전에 보이는 밤하늘 색 (그림 위쪽 하늘과 비슷한 색)
const NIGHT = "#0b1635";

function createParameters(): THREE.ShaderMaterialParameters {
  return {
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uMap: backdropUniforms.uBackdropMap,
      uShow: backdropUniforms.uBackdropShow,
      uViewAspect: backdropUniforms.uBackdropViewAspect,
      uImageAspect: backdropUniforms.uBackdropImageAspect,
      uNight: { value: new THREE.Color(NIGHT) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        // 카메라와 상관없이 화면 전체를 덮습니다.
        gl_Position = vec4(position.xy, 1.0, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform float uShow;
      uniform float uViewAspect;
      uniform float uImageAspect;
      uniform vec3 uNight;
      varying vec2 vUv;
      ${BEFORE_TONE_MAPPING_GLSL}
      void main() {
        // 화면을 꽉 채우도록 맞추고, 넘치는 쪽은 가운데를 기준으로 잘라 냅니다.
        vec2 uv = vUv - 0.5;
        if (uViewAspect > uImageAspect) uv.y *= uImageAspect / uViewAspect;
        else uv.x *= uViewAspect / uImageAspect;
        vec3 color = mix(uNight, texture2D(uMap, uv + 0.5).rgb, uShow);
        gl_FragColor = vec4(beforeToneMapping(color), 1.0);
      }
    `,
  };
}

// sunrise: 새해 스노우볼의 일출 배경 (차명근)
// scene: 생일 스노우볼의 파티 배경처럼 주제별 그림을 고릅니다 (없으면 sunrise 로 정함)
export default function PhotoBackdrop({ sunrise = false, scene }: { sunrise?: boolean; scene?: BackdropScene }) {
  const size = useThree((state) => state.size);
  const kind = size.width < size.height ? "mobile" : "web";
  const picture = backdropImages(scene ?? (sunrise ? "sunrise" : "village"))[kind];
  const material = useRef<THREE.ShaderMaterial>(null);
  const parameters = useMemo(() => createParameters(), []);
  // 받아 온 그림. 다음 프레임에 재질에 끼웁니다.
  const image = useRef<{ texture: THREE.Texture; aspect: number } | null>(null);

  // 화면 모양(가로 · 세로)에 맞는 그림을 받아 옵니다.
  useEffect(() => {
    let cancelled = false;
    let loaded: THREE.Texture | null = null;
    new THREE.TextureLoader().load(picture.url, (texture) => {
      if (cancelled) {
        texture.dispose();
        return;
      }
      texture.colorSpace = THREE.SRGBColorSpace;
      // 유리에 비칠 때는 흐릿하게 읽으므로 작은 크기의 그림(밉맵)도 만들어 둡니다.
      texture.generateMipmaps = true;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      loaded = texture;
      image.current = { texture, aspect: picture.aspect };
    });
    return () => {
      cancelled = true;
      if (loaded && image.current?.texture === loaded) image.current = null;
      if (loaded && backdropUniforms.uBackdropMap.value === loaded) {
        backdropUniforms.uBackdropMap.value = null;
        backdropUniforms.uBackdropShow.value = 0;
      }
      loaded?.dispose();
    };
  }, [picture]);

  useFrame((state, delta) => {
    const uniforms = material.current?.uniforms;
    if (!uniforms) return;
    uniforms.uViewAspect.value = state.size.width / state.size.height;
    const texture = image.current?.texture ?? null;
    if (uniforms.uMap.value !== texture) {
      uniforms.uMap.value = texture;
      uniforms.uImageAspect.value = image.current?.aspect ?? 1;
      uniforms.uShow.value = 0;
    }
    if (texture && uniforms.uShow.value < 1) uniforms.uShow.value = Math.min(1, uniforms.uShow.value + delta / 0.5);
  });

  return (
    <mesh renderOrder={-3} frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial ref={material} args={[parameters]} />
    </mesh>
  );
}
