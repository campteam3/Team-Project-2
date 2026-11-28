"use client";

// 스노우볼 뒤 배경. 모든 화면이 이 파일로 배경을 그립니다.
// ─────────────────────────────────────────────────────────────
// 안쪽은 그림 배경(PhotoBackdrop.tsx)입니다: 눈 내린 마을의 밤. 그림 파일은 public/backgrounds/ 에 있습니다.
// 배경은 스노우볼과 따로 움직이지 않는 장식입니다. (이민정)
// 예전에 코드로 그리던 겨울밤 배경은 components/SnowGlobeAtmosphere.tsx 에 남아 있습니다.
// ─────────────────────────────────────────────────────────────

import type { GlobeKind } from "@/lib/theme";
import type { BackdropScene } from "./backdropShared";
import PhotoBackdrop from "./PhotoBackdrop";

// 스노우볼 주제에 맞는 배경 그림
export const backdropScene = (kind?: GlobeKind): BackdropScene => (kind === "newyear" ? "sunrise" : kind === "birthday" ? "birthday" : "village");

// sunrise: 새해 스노우볼은 눈 내린 마을 대신 일출 그림을 깝니다 (차명근)
// scene: 생일 스노우볼의 파티 배경 등 주제별 그림 (김미영). 주면 sunrise 보다 먼저 봅니다.
// instant: 그림을 서서히 나타내지 않고 바로 그립니다 (첫 접속의 대체 화면이 덮고 있는 동안)
export default function VillageBackdrop({ sunrise = false, scene, instant = false }: { sunrise?: boolean; scene?: BackdropScene; instant?: boolean }) {
  return <PhotoBackdrop sunrise={sunrise} scene={scene} instant={instant} />;
}
