"use client";

// 배경 음악을 처음 화면을 눌렀을 때 시작합니다. 화면에는 아무것도 그리지 않습니다.
// 모든 화면에서 한 번만 돌도록 app/layout.tsx 에 둡니다. 화면을 옮겨 다녀도 음악은 끊기지 않습니다.
// (브라우저는 사용자가 누르기 전에는 소리를 막습니다. 아이폰은 "눌렀다 뗀" 동작만 인정해서 click · touchend 를 씁니다)

import { useEffect } from "react";
import { startBgm, syncBgmWithVisibility } from "@/lib/bgm";

const GESTURES = ["click", "touchend", "keydown"] as const;

export default function BgmAutoStart() {
  useEffect(() => {
    const start = () => {
      startBgm();
      GESTURES.forEach((name) => window.removeEventListener(name, start, true));
    };
    // 버튼 자체의 동작(소리 끄기 등)보다 먼저 돌도록 capture 로 듣습니다
    GESTURES.forEach((name) => window.addEventListener(name, start, true));
    document.addEventListener("visibilitychange", syncBgmWithVisibility);
    return () => {
      GESTURES.forEach((name) => window.removeEventListener(name, start, true));
      document.removeEventListener("visibilitychange", syncBgmWithVisibility);
    };
  }, []);

  return null;
}
