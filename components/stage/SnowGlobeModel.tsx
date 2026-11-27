"use client";

// 스노우볼 3D 모델. 모든 화면(오프닝 · 만들기 · 친구 흐름)이 이 파일로 스노우볼을 그립니다.
// ─────────────────────────────────────────────────────────────
// 안쪽은 Blender 로 만든 모델(public/models/snowglobe.glb)과 오너먼트 39자리 규칙(lib/snowglobe.ts)입니다.
// 모델 · 재질 · 오너먼트 그리기는 components/snowglobe/SnowGlobeGlb.tsx 에 있습니다. (이민정)
// 바깥(StageScene)이 쓰는 값은 MODEL, NAMEPLATE, NAMEPLATE_WIDTH, ornamentPosition 입니다.
// 좌표는 유리 구의 가운데가 원점, 반지름 1 입니다.
// ─────────────────────────────────────────────────────────────

import { type ThreeElements } from "@react-three/fiber";
import { Suspense, useEffect, useSyncExternalStore } from "react";
import { GlowDust } from "@/components/SnowGlobeAtmosphere";
import { GlobeExtras, GlobeInnerLights, GlobeModel, Ornaments } from "@/components/snowglobe/SnowGlobeGlb";
import { GLASS, ornamentSpot, placeOrnaments, shapesFor, type OrnamentLike, type OrnamentShape } from "@/lib/snowglobe";
import { hasProp, themeColor, trunkColor, type GlobeKind, type GlobeTheme } from "@/lib/theme";

// 모델 원본은 유리 구의 가운데가 y = 0.55 입니다. 이만큼 내려서 구의 가운데를 원점에 둡니다.
const LIFT = -GLASS.center[1];

export const MODEL = {
  top: 1.02, // 유리 구 맨 위
  bottom: -1.21, // 받침대 맨 아래
  width: 2.42, // 가장 넓은 곳(받침대 굽)의 지름
  glassRadius: 1,
  floorY: -0.42, // 구 안 눈 바닥
};

// 받침대 앞면 명판의 가운데 (이름 · 닉네임 입력칸이 붙는 곳)
export const NAMEPLATE: [number, number, number] = [0, -0.88, 1.04];
export const NAMEPLATE_WIDTH = 0.76; // 명판 가로 길이 (글자가 이보다 길면 "…"으로 자릅니다)

// 지금 그리고 있는 오너먼트들의 자리. 바깥에서 ornamentPosition 으로 물어볼 때 씁니다.
const spots = {
  kind: "christmas" as GlobeKind, // 스노우볼 주제 (자리 묶음이 주제마다 다릅니다)
  ornaments: [] as OrnamentLike[],
  placed: [] as [number, number, number][],
  next: new Map<OrnamentShape, [number, number, number]>(),
};
const FALLBACK: [number, number, number] = [0, 0.3, 0.4];
const lifted = ([x, y, z]: [number, number, number]): [number, number, number] => [x, y + LIFT, z];

function remember(ornaments: OrnamentLike[], kind: GlobeKind) {
  spots.kind = kind;
  spots.ornaments = ornaments;
  spots.placed = [];
  spots.next.clear();
  const byOrnament = new Map(placeOrnaments(ornaments, kind).map((item) => [item.ornament, item.position]));
  for (const ornament of ornaments) spots.placed.push(lifted(byOrnament.get(ornament) ?? FALLBACK));
}

// index 번째 오너먼트가 달린 자리입니다. 순서(먼저 달린 것부터)대로 자리가 정해지고, 새 오너먼트가 달려도 기존 것은 움직이지 않습니다.
// 아직 달리지 않은 다음 오너먼트(index 가 지금 개수와 같을 때)는 shape 모양으로 달린다고 보고 알려 줍니다. shape 를 안 넘기면 그 주제의 첫 모양(볼 · 복주머니)입니다.
export function ornamentPosition(index: number, shape: OrnamentShape = shapesFor(spots.kind)[0]): [number, number, number] {
  const known = spots.placed[index];
  if (known) return known;
  let next = spots.next.get(shape);
  if (!next) {
    next = lifted(ornamentSpot(spots.ornaments, spots.ornaments.length, shape, spots.kind) ?? FALLBACK);
    spots.next.set(shape, next);
  }
  return next;
}

const NONE: OrnamentLike[] = [];

// [테스트용] 추가 소품(루돌프 · 과자집) 미리 보기. 주소 끝에 ?props=test 를 붙이면 눈사람 자리에 루돌프, 선물 자리에 과자집이 보입니다 (?props=off 로 끔).
// 켠 것은 그 탭에서 기억합니다. 꾸미기 화면에 고르기 버튼이 생기면(이슈 #75) 이 부분은 지웁니다. (이민정)
const PROPS_TEST_KEY = "props-test";
const noSubscribe = () => () => {};
function readPropsTest() {
  try {
    const asked = new URLSearchParams(window.location.search).get("props");
    if (asked === "test") window.sessionStorage.setItem(PROPS_TEST_KEY, "1");
    if (asked === "off") window.sessionStorage.removeItem(PROPS_TEST_KEY);
    return window.sessionStorage.getItem(PROPS_TEST_KEY) === "1";
  } catch {
    return false;
  }
}

type Props = ThreeElements["group"] & {
  theme: GlobeTheme;
  ornaments?: OrnamentLike[]; // DB 의 오너먼트를 그대로 넣으면 모양(shape)대로 그립니다. id 와 색만 있으면 볼입니다.
  highlightId?: string; // 빛나게 보여 줄 오너먼트 (친구가 고른 것)
  selectedId?: string | null; // 주인이 눌러 읽고 있는 오너먼트 (김미영: 주인 화면용 전달)
  onSelect?: (id: string) => void; // 오너먼트를 눌렀을 때 (김미영: 주인 화면용 전달)
  arrivingId?: string; // 지금 막 달리는 오너먼트
  plateText?: string; // 받침대 명판에 새길 이름
  reducedMotion?: boolean;
};

export default function SnowGlobeModel({ theme, ornaments = NONE, highlightId, selectedId, onSelect, arrivingId, plateText, reducedMotion = false, ...group }: Props) {
  const kind = theme.kind;
  useEffect(() => {
    remember(ornaments, kind);
  }, [ornaments, kind]);

  // 꾸미기: 기본값(초록 트리, 레드 받침대)은 모델 원래 색을 쓰고, 다른 선택지는 lib/theme.ts 의 색을 입힙니다.
  const treeColor = theme.tree === "green" ? undefined : themeColor(theme, "tree");
  const baseColor = theme.base === "red" ? undefined : themeColor(theme, "base");
  // 소품: 별은 항상 트리 꼭대기에 있습니다. 눈사람 자리에는 눈사람이나 루돌프, 선물 자리에는 선물 상자나 과자집이 놓입니다 (lib/theme.ts 의 hasProp).
  // [테스트용] 스위치를 켜면 고른 것과 상관없이 눈사람 대신 루돌프, 선물 대신 과자집을 보입니다
  const extras = useSyncExternalStore(noSubscribe, readPropsTest, () => false);
  const showSnowman = hasProp(theme.prop, "snowman") && !extras;
  const showGifts = hasProp(theme.prop, "gift") && !extras;
  // 루돌프 · 과자집은 크리스마스 스노우볼에만 있습니다
  const showReindeer = kind !== "newyear" && (hasProp(theme.prop, "reindeer") || (extras && hasProp(theme.prop, "snowman")));
  const showGingerHouse = kind !== "newyear" && (hasProp(theme.prop, "house") || (extras && hasProp(theme.prop, "gift")));

  return (
    <group {...group}>
      <group position={[0, LIFT, 0]}>
        <Suspense fallback={null}>
          <GlobeModel kind={kind} title={plateText} treeColor={treeColor} trunkColor={trunkColor(theme)} baseColor={baseColor} showGifts={kind === "newyear" ? hasProp(theme.prop, "gift") : showGifts} showSnowman={kind === "newyear" ? hasProp(theme.prop, "snowman") : showSnowman} />
          <Ornaments ornaments={ornaments} kind={kind} highlightId={highlightId} selectedId={selectedId} onSelect={onSelect} arrivingId={arrivingId} reducedMotion={reducedMotion} />
        </Suspense>
        {/* 추가 소품은 보일 때에만 파일을 내려받고, 받는 동안 스노우볼은 그대로 보입니다 */}
        {(showReindeer || showGingerHouse) && (
          <Suspense fallback={null}>
            <GlobeExtras showReindeer={showReindeer} showGingerHouse={showGingerHouse} />
          </Suspense>
        )}
        <GlobeInnerLights kind={kind} />
        <GlowDust still={reducedMotion} />
      </group>
    </group>
  );
}
