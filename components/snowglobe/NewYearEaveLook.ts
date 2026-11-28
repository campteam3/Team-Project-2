// 새해 스노우볼 받침대의 기와 처마(Base_Eave)에 그릴 때 얹는 무늬입니다. (차명근)
//  - 기와(W_Eave_Tile): 기와가 포개진 턱. 수키와와 암키와 골의 턱이 반 장씩 어긋납니다
//  - 막새(W_Eave_Gold): 테두리 한 줄, 가운데 씨방, 꽃잎 여덟 장의 연꽃무늬 돋을새김
// 무늬의 자리는 모델의 UV 로 압니다 (scripts/blender/base_eave.py 가 넣습니다. 그림을 입히는 UV 가 아닙니다).
// 형태로 만들지 않고 색의 밝기로만 그려 모델 파일이 커지지 않습니다. 화면에서 작게 보일 때는 무늬를 끕니다.

import type * as THREE from "three";

const VERTEX_DECLARE = "varying vec2 vEaveUv;";
const VERTEX_BODY = "vEaveUv = uv;";

const LOOKS = {
  tile: {
    color: [
      "float eaveSuki = step(0.5, vEaveUv.x);",
      "float eaveAt = vEaveUv.y + 0.5 * (1.0 - eaveSuki);", // 암키와 골은 반 장 어긋나게
      "float eaveT = fract(eaveAt);",
      "float eaveOn = 1.0 - smoothstep(0.1, 0.3, fwidth(eaveAt));",
      // 윗장의 끝(턱)은 밝고, 그 바로 아래는 윗장에 가려 어둡습니다
      "float eaveShade = 1.0 + 0.5 * smoothstep(0.86, 0.98, eaveT) - 0.55 * (1.0 - smoothstep(0.0, 0.16, eaveT));",
      // 기와마다 조금씩 다른 농담
      "float eaveTone = fract(sin(floor(eaveAt) * 12.9898 + floor(vEaveUv.x + 0.5) * 78.233) * 43758.5453);",
      "diffuseColor.rgb *= mix(1.0, eaveShade * (0.9 + 0.2 * eaveTone), eaveOn);",
    ],
    glow: ["totalEmissiveRadiance *= mix(1.0, eaveShade, eaveOn);"],
  },
  gold: {
    color: [
      "float eaveR = length(vEaveUv);",
      "float eaveSoft = fwidth(eaveR) * 1.2 + 0.001;",
      "float eaveOn = 1.0 - smoothstep(0.08, 0.22, fwidth(eaveR));",
      "float eavePetal = abs(cos(atan(vEaveUv.x, vEaveUv.y) * 4.0));", // 꽃잎 여덟 장: 꽃잎 가운데에서 1, 사이에서 0
      "float eaveReach = 0.3 + 0.36 * pow(eavePetal, 0.55);",
      // 돋은 곳(1): 테두리, 씨방, 꽃잎. 나머지는 파인 바닥(0)
      "float eaveRaised = smoothstep(0.8 - eaveSoft, 0.8 + eaveSoft, eaveR);",
      "eaveRaised = max(eaveRaised, 1.0 - smoothstep(0.17 - eaveSoft, 0.17 + eaveSoft, eaveR));",
      "eaveRaised = max(eaveRaised, smoothstep(0.24 - eaveSoft, 0.24 + eaveSoft, eaveR) * (1.0 - smoothstep(eaveReach - eaveSoft, eaveReach + eaveSoft, eaveR)));",
      "float eaveShade = mix(1.0, mix(0.2, 1.0, eaveRaised), eaveOn * step(eaveR, 1.5));",
      "diffuseColor.rgb *= eaveShade;",
    ],
    glow: ["totalEmissiveRadiance *= eaveShade;"],
  },
};

export function applyEaveLook(material: THREE.MeshStandardMaterial, part: keyof typeof LOOKS) {
  const look = LOOKS[part];
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\n" + VERTEX_DECLARE)
      .replace("#include <begin_vertex>", "#include <begin_vertex>\n" + VERTEX_BODY);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\n" + VERTEX_DECLARE)
      .replace("#include <color_fragment>", ["#include <color_fragment>", ...look.color].join("\n"))
      .replace("#include <emissivemap_fragment>", ["#include <emissivemap_fragment>", ...look.glow].join("\n"));
  };
  material.customProgramCacheKey = () => "newyear-eave-" + part;
}
