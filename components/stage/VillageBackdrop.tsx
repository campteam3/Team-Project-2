"use client";

// 스노우볼 뒤 배경. 모든 화면이 이 파일로 배경을 그립니다.
// ─────────────────────────────────────────────────────────────
// 안쪽은 겨울밤 배경(components/SnowGlobeAtmosphere.tsx)입니다: 밤하늘, 흐릿한 눈 덮인 나무, 뭉개진 불빛.
// 배경은 스노우볼과 따로 움직이지 않는 장식입니다. (이민정)
// ─────────────────────────────────────────────────────────────

import SnowGlobeAtmosphere from "@/components/SnowGlobeAtmosphere";

export default function VillageBackdrop() {
  return <SnowGlobeAtmosphere />;
}
