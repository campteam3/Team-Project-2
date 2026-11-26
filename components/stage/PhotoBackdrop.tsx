"use client";

// 스노우볼 뒤에 까는 그림 배경(눈 내린 마을의 밤)입니다. (이민정)
//  - 가로로 긴 화면은 public/backgrounds/village-web.webp, 세로로 긴 화면은 village-mobile.webp 를 씁니다.
//    원본(PNG)은 design/backgrounds/ 에 있습니다. 그림을 바꾸면 webp 로 줄여서 넣고, 아래 IMAGES 의 가로세로 비율도 고칩니다.
//  - 그림은 화면을 꽉 채우고(넘치는 쪽은 잘라 냄), 스노우볼을 돌려도 움직이지 않습니다.
//  - 장면의 마지막 색 보정(NightBloom)을 거치면 그림이 어둡고 탁해지므로, 미리 반대로 보정해 원래 색이 나오게 합니다.

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

const IMAGES = {
  web: { url: "/backgrounds/village-web.webp", aspect: 1672 / 941 },
  mobile: { url: "/backgrounds/village-mobile.webp", aspect: 941 / 1672 },
};

// 그림을 받기 전에 보이는 밤하늘 색 (그림 위쪽 하늘과 비슷한 색)
const NIGHT = "#0b1635";

function createParameters(): THREE.ShaderMaterialParameters {
  return {
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uMap: { value: null },
      uShow: { value: 0 }, // 그림이 서서히 나타나는 정도 (0~1)
      uViewAspect: { value: 1 },
      uImageAspect: { value: 1 },
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

      // 장면 마지막의 색 보정(ACES)을 거꾸로 계산합니다. 이 값을 내보내면 보정 뒤에 원래 색이 됩니다.
      vec3 beforeToneMapping(vec3 color) {
        const mat3 inputMat = mat3(
          vec3(0.59719, 0.07600, 0.02840),
          vec3(0.35458, 0.90834, 0.13383),
          vec3(0.04823, 0.01566, 0.83777)
        );
        const mat3 outputMat = mat3(
          vec3(1.60475, -0.10208, -0.00327),
          vec3(-0.53108, 1.10813, -0.07276),
          vec3(-0.07367, -0.00605, 1.07602)
        );
        vec3 y = clamp(inverse(outputMat) * color, 0.0, 0.96);
        vec3 a = 0.983729 * y - 1.0;
        vec3 b = 0.4329510 * y - 0.0245786;
        vec3 c = 0.238081 * y + 0.000090537;
        vec3 x = (-b - sqrt(max(b * b - 4.0 * a * c, 0.0))) / (2.0 * a);
        return max(inverse(inputMat) * x, 0.0) * 0.6;
      }

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

export default function PhotoBackdrop() {
  const size = useThree((state) => state.size);
  const kind = size.width < size.height ? "mobile" : "web";
  const material = useRef<THREE.ShaderMaterial>(null);
  const parameters = useMemo(() => createParameters(), []);
  // 받아 온 그림. 다음 프레임에 재질에 끼웁니다.
  const image = useRef<{ texture: THREE.Texture; aspect: number } | null>(null);

  // 화면 모양(가로 · 세로)에 맞는 그림을 받아 옵니다.
  useEffect(() => {
    let cancelled = false;
    let loaded: THREE.Texture | null = null;
    new THREE.TextureLoader().load(IMAGES[kind].url, (texture) => {
      if (cancelled) {
        texture.dispose();
        return;
      }
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.generateMipmaps = false;
      texture.minFilter = THREE.LinearFilter;
      loaded = texture;
      image.current = { texture, aspect: IMAGES[kind].aspect };
    });
    return () => {
      cancelled = true;
      if (loaded && image.current?.texture === loaded) image.current = null;
      loaded?.dispose();
    };
  }, [kind]);

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
