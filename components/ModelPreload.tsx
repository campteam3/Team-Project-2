"use client";

// 스노우볼 3D 모델을 화면 코드보다 먼저 받기 시작합니다 (FEEDBACK A8).
// 예전에는 app/layout.tsx 에 있어 모든 페이지가 받았는데, 기념 메시지 화면(/gift/*)은 스노우볼이 없어서
// 스노우볼을 그리는 페이지에만 둡니다 (FEEDBACK F1, 차명근).
// 새해 스노우볼은 모델이 따로 있어서(newyear.glb), 어느 모델을 받을지 kind 로 고릅니다.
// 주소는 components/snowglobe/SnowGlobeGlb.tsx 의 globeModelUrl 과 같아야 합니다 (그쪽은 3D 코드라 여기서 불러오지 않음).
//
// 클라이언트 컴포넌트로 둔 까닭 (차명근): 서버 컴포넌트에 <link rel="preload"> 를 두면, 다른 화면의 링크가 이 페이지를
// 미리 불러올 때(Next.js 의 prefetch)도 그 지시가 따라와 실행됩니다. 그래서 새해 스노우볼 화면에서도 /login 미리 불러오기 때문에
// 크리스마스 모델(약 900KB)을 받았습니다. 클라이언트 컴포넌트의 preload() 는 처음 열 때는 서버 HTML 에 그대로 들어가고,
// 미리 불러오기에는 따라가지 않으며, 실제로 그 페이지로 옮겨 갈 때 실행됩니다.

import { preload } from "react-dom";
import type { GlobeKind } from "@/lib/theme";

const modelUrl = (kind: GlobeKind) => (kind === "newyear" ? "/models/newyear.glb" : kind === "birthday" ? "/models/birthday.glb" : "/models/snowglobe.glb");

export default function ModelPreload({ kind = "christmas" }: { kind?: GlobeKind }) {
  preload(modelUrl(kind), { as: "fetch", crossOrigin: "anonymous" });
  return null;
}
