// 배경 그림을 배경(PhotoBackdrop)과 유리(SnowGlobeGlb)가 함께 쓰기 위한 값입니다. (이민정)
//  - 배경이 그림을 받아 오면 여기에 넣고, 유리는 같은 그림을 읽어 표면에 비춥니다.
//  - 그림 배경이 없는 장면에서는 uBackdropShow 가 0 이라 유리에 아무것도 비치지 않습니다.

import * as THREE from "three";

// 가로로 긴 화면은 web, 세로로 긴 화면은 mobile 그림을 씁니다.
// 원본(PNG)은 design/backgrounds/ 에 있습니다. 그림을 바꾸면 webp 로 줄여서 넣고, 아래 가로세로 비율도 고칩니다.
export const BACKDROP_IMAGES = {
  web: { url: "/backgrounds/village-web.webp", aspect: 1672 / 941 },
  mobile: { url: "/backgrounds/village-mobile.webp", aspect: 941 / 1672 },
};

export const backdropUniforms = {
  uBackdropMap: { value: null as THREE.Texture | null },
  uBackdropShow: { value: 0 }, // 그림이 서서히 나타나는 정도 (0~1)
};

// 장면 마지막의 색 보정(NightBloom 의 ACES)을 거꾸로 계산하는 셰이더 함수.
// 이 값을 내보내면 보정을 거친 뒤에 그림의 원래 색이 됩니다.
export const BEFORE_TONE_MAPPING_GLSL = /* glsl */ `
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
`;
