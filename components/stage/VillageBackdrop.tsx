"use client";

// 스노우볼 뒤 배경. 모든 화면이 이 파일로 배경을 그립니다.
// ─────────────────────────────────────────────────────────────
// 안쪽은 그림 배경(PhotoBackdrop.tsx)입니다: 눈 내린 마을의 밤. 그림 파일은 public/backgrounds/ 에 있습니다.
// 배경은 스노우볼과 따로 움직이지 않는 장식입니다. (이민정)
// 예전에 코드로 그리던 겨울밤 배경은 components/SnowGlobeAtmosphere.tsx 에 남아 있습니다.
// ─────────────────────────────────────────────────────────────

import PhotoBackdrop from "./PhotoBackdrop";

export default function VillageBackdrop() {
  return <PhotoBackdrop />;
}
