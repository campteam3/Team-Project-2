// 스노우볼 트리의 오너먼트 자리와, 메시지를 어느 자리에 달지 정하는 규칙입니다.
// 자리 값은 Blender 원본(design/blender/snowglobe.blend)에서 내보낸 lib/snowglobe-slots.json 에 있습니다.
// 좌표는 모델 원본 그대로입니다: 유리 구의 가운데가 (0, 0.55, 0), 반지름 1.

import birthdaySlotData from "@/lib/birthday-slots.json";
import newyearSlotData from "@/lib/newyear-slots.json";
import slotData from "@/lib/snowglobe-slots.json";
import type { GlobeKind } from "@/lib/theme";

// DB 의 shape 칸에 들어가는 이름. 볼 · 별 · 하트 · 지팡이 사탕 · 선물 상자는 크리스마스, 복주머니 · 방패연 · 노리개는 새해,
// 머랭 키스 · 사탕 구슬 · 젤리 별은 생일 스노우볼(케이크에 올리는 토핑) 전용입니다.
export const ORNAMENT_SHAPES = ["ball", "star", "heart", "cane", "gift", "pouch", "kite", "norigae", "kiss", "candy", "jelly"] as const;
export type OrnamentShape = (typeof ORNAMENT_SHAPES)[number];
// 사탕 = 지팡이 사탕, 선물 = 선물 상자 (이민정). 휴대폰 한 줄에 다섯 개가 들어가게 짧게 부릅니다
export const SHAPE_LABEL: Record<OrnamentShape, string> = { ball: "볼", star: "별", heart: "하트", cane: "사탕", gift: "선물", pouch: "복주머니", kite: "방패연", norigae: "노리개", kiss: "머랭", candy: "사탕", jelly: "젤리 별" };

const BASIC_SHAPES: readonly OrnamentShape[] = ["ball", "star", "heart", "cane", "gift"];
const NEWYEAR_SHAPES: readonly OrnamentShape[] = ["pouch", "kite", "norigae"];
const BIRTHDAY_SHAPES: readonly OrnamentShape[] = ["kiss", "candy", "jelly"];
const SHAPE_LISTS = [BASIC_SHAPES, NEWYEAR_SHAPES, BIRTHDAY_SHAPES];

// 그 주제의 스노우볼에서 고를 수 있는 모양
export const shapesFor = (kind: GlobeKind = "christmas"): readonly OrnamentShape[] => (kind === "newyear" ? NEWYEAR_SHAPES : kind === "birthday" ? BIRTHDAY_SHAPES : BASIC_SHAPES);

// 모양이 어느 주제의 것인지 (기념 메시지는 주제를 따로 저장하지 않아서, 받는 화면의 배경을 모양으로 정합니다. 차명근)
export const kindOfShape = (shape: string | undefined): GlobeKind =>
  (NEWYEAR_SHAPES as readonly string[]).includes(shape ?? "") ? "newyear" : (BIRTHDAY_SHAPES as readonly string[]).includes(shape ?? "") ? "birthday" : "christmas";

// 매다는 모양(볼 · 지팡이 사탕 · 선물 상자)인지. 별 · 하트는 경사면에 얹는 쿠키 모양이고, 새해 모양은 양털에 붙이는 브로치라 얹는 자리로 봅니다.
// 생일 스노우볼에서는 케이크 윗면에 올리는 토핑(머랭 키스 · 사탕 구슬)이 hang 자리, 옆면에 붙이는 젤리 별이 slope 자리를 씁니다.
const HANGING: readonly OrnamentShape[] = ["ball", "cane", "gift", "kiss", "candy"];
const hangs = (shape: OrnamentShape) => HANGING.includes(shape);

// 모르는 이름이나 그 주제에 없는 모양이 오면 그 주제의 첫 모양(크리스마스는 볼, 새해는 복주머니)으로 그립니다.
// kind 를 안 넘기면 이름만 확인합니다 (오너먼트 하나만 보여 주는 화면).
// 다른 주제의 모양은 같은 순서의 모양으로 바꿉니다 (볼 ↔ 복주머니, 별 ↔ 방패연, 하트 · 사탕 · 선물 ↔ 노리개). 기념 메시지로 받은 오너먼트를 다른 주제의 스노우볼에 달 때 씁니다.
export function toShape(value: string | undefined, kind?: GlobeKind): OrnamentShape {
  const allowed = kind ? shapesFor(kind) : ORNAMENT_SHAPES;
  if (value !== undefined && (allowed as readonly string[]).includes(value)) return value as OrnamentShape;
  const order = Math.max(...SHAPE_LISTS.map((list) => list.indexOf(value as OrnamentShape)));
  return allowed[Math.min(Math.max(order, 0), allowed.length - 1)];
}

// 트리에 달 오너먼트. DB 의 오너먼트(lib/api 의 Ornament)를 그대로 넣을 수 있고, id 와 색만 있어도 됩니다.
export type OrnamentLike = { id: string; color: string; shape?: string; position?: unknown };

export type Slot = {
  id: number;
  // hang: 갈래 끝에 매다는 자리, slope: 경사면에 얹는 자리 (새해 스노우볼의 양 몸통은 모두 slope)
  kind: "hang" | "slope";
  tier: number;
  position: [number, number, number];
  quaternion: [number, number, number, number];
  ballScale: number | null;
  cookieScale: number;
};

export type PlacedOrnament<T extends OrnamentLike = OrnamentLike> = {
  key: string;
  slot: Slot;
  shape: OrnamentShape;
  color: string;
  metallic: boolean;
  // 오너먼트를 놓을 위치와 크기 (자리 값에서 계산)
  position: [number, number, number];
  scale: number;
  // 달린 메시지. 기본 장식을 달던 때에는 null 이었고, 지금은 항상 값이 있습니다.
  ornament: T | null;
};

export const SLOTS = slotData.slots as unknown as Slot[];
export const GLASS = slotData.glass as { center: [number, number, number]; radius: number };

// 한 스노우볼에 달 수 있는 메시지 수. DB 의 제한(supabase/migrations 의 ornament_limit)과 같아야 합니다.
export const MAX_ORNAMENTS = SLOTS.length;

// 예전에는 처음부터 기본 장식이 달려 있었습니다. 친구가 단 오너먼트와 구별이 안 된다는 피드백(FEEDBACK B1)으로 더 달지 않습니다.

// 오너먼트는 정면(명판이 있는 쪽, +z)부터 답니다: 앞쪽 → 옆 → 뒤.
// 정면에서 벗어난 각도(0 = 정면, π = 뒤)
const offFront = (slot: Slot) => Math.abs(Math.atan2(slot.position[0], slot.position[2]));
// 0: 앞쪽(정면에서 60도 안), 1: 옆, 2: 뒤
const side = (slot: Slot) => (offFront(slot) < Math.PI / 3 ? 0 : offFront(slot) < (Math.PI * 2) / 3 ? 1 : 2);

// 한 스노우볼의 자리 묶음: 자리, 자리 사이의 거리, 자리마다의 기본 점수
type SlotSet = { slots: Slot[]; apart: number[][]; score: Record<Slot["kind"], number[]> };

// strict: 모양에 맞지 않는 종류의 자리는 맞는 자리가 다 찰 때까지 쓰지 않습니다 (생일 케이크: 머랭 키스가 옆면에 붙지 않게)
function createSlotSet(slots: Slot[], strict = false): SlotSet {
  // 자리 사이의 거리 (자리 번호는 slots 의 순서와 같습니다)
  const apart = slots.map((a) => slots.map((b) => Math.hypot(a.position[0] - b.position[0], a.position[1] - b.position[1], a.position[2] - b.position[2])));
  // 자리마다의 기본 점수: 앞쪽일수록, 모양에 맞는 종류(kind)일수록, 정면에 가까울수록 높습니다.
  // 볼 · 지팡이 사탕 · 선물 상자는 매다는 자리가, 별 · 하트는 얹는 자리가 맞는 자리입니다. 앞쪽에 맞는 자리가 없으면 앞쪽의 다른 종류 자리를 쓰고, 그다음에 옆 · 뒤로 넘어갑니다.
  const baseScore = (kind: Slot["kind"]) => slots.map((slot) => -side(slot) * 10 - Number(slot.kind !== kind) * (strict ? 1000 : 5) - offFront(slot) * 0.3);
  return { slots, apart, score: { hang: baseScore("hang"), slope: baseScore("slope") } };
}

const TREE_SET = createSlotSet(SLOTS);
// 새해 스노우볼: 양 몸통의 자리 (design/blender/newyear.blend 의 Slot_00 ~ Slot_38)
const NEWYEAR_SET = createSlotSet(newyearSlotData.slots as unknown as Slot[]);
// 생일 스노우볼: 케이크 윗면(hang) · 옆면(slope)의 자리 (scripts/blender/export_birthday.py 가 design/blender/birthdayglobe.blend 에서 뽑음)
// 자리가 종류마다 넉넉해서, 한 가지 토핑만 골라도 거의 모두 제 종류 자리에 놓입니다.
const BIRTHDAY_SET = createSlotSet(birthdaySlotData.slots as unknown as Slot[], true);
const slotSet = (kind: GlobeKind = "christmas") => (kind === "newyear" ? NEWYEAR_SET : kind === "birthday" ? BIRTHDAY_SET : TREE_SET);

// 그 주제 스노우볼의 오너먼트 자리
export const slotsFor = (kind?: GlobeKind) => slotSet(kind).slots;

// DB 의 position 칸: 비어 있으면 자동 배치, { slot: 자리번호 } 가 있으면 그 자리를 먼저 씁니다.
function wantedSlot(position: unknown, slots: Slot[]): Slot | undefined {
  const value =
    typeof position === "number" ? position : position && typeof position === "object" ? (position as { slot?: unknown }).slot : undefined;
  return typeof value === "number" && Number.isInteger(value) ? slots[value] : undefined;
}

// 비어 있는 자리 중 가장 좋은 자리. 한곳에 몰리지 않게, 이미 달린 오너먼트에서 먼 자리에 점수를 더 줍니다.
function pickSlot(set: SlotSet, kind: Slot["kind"], used: Set<number>): Slot | undefined {
  let best: Slot | undefined;
  let bestScore = -Infinity;
  for (const slot of set.slots) {
    if (used.has(slot.id)) continue;
    let near = 0.6;
    for (const id of used) near = Math.min(near, set.apart[slot.id][id]);
    const score = set.score[kind][slot.id] + near;
    if (score > bestScore) {
      bestScore = score;
      best = slot;
    }
  }
  return best;
}

// 자리의 방향(quaternion)으로 벡터를 돌립니다.
function rotate([x, y, z]: [number, number, number], [qx, qy, qz, qw]: Slot["quaternion"]): [number, number, number] {
  const tx = 2 * (qy * z - qz * y);
  const ty = 2 * (qz * x - qx * z);
  const tz = 2 * (qx * y - qy * x);
  return [x + qw * tx + (qy * tz - qz * ty), y + qw * ty + (qz * tx - qx * tz), z + qw * tz + (qx * ty - qy * tx)];
}

// 모양마다 더 키우는 배율. 지팡이 사탕은 가늘어서 볼과 같은 크기로는 트리에서 잘 안 보입니다.
const SHAPE_SCALE: Partial<Record<OrnamentShape, number>> = { cane: 1.4 };

// 그 자리에 그 모양을 놓을 때의 위치와 크기
function fit(slot: Slot, shape: OrnamentShape): { position: [number, number, number]; scale: number } {
  if (!hangs(shape)) return { position: slot.position, scale: slot.cookieScale };
  const grow = SHAPE_SCALE[shape] ?? 1;
  if (slot.ballScale !== null) return { position: slot.position, scale: slot.ballScale * grow };
  // 매다는 모양을 얹는 자리에 놓을 때: 쿠키가 누울 자리에 경사면에 기대어 놓이도록 옮깁니다.
  const scale = slot.cookieScale * 0.8;
  const [dx, dy, dz] = rotate([0, 1.5 * scale - 1.2625 * slot.cookieScale, scale], slot.quaternion);
  return { position: [slot.position[0] + dx, slot.position[1] + dy, slot.position[2] + dz], scale: scale * grow };
}

// 메시지 오너먼트를 자리에 배치합니다. 순서(먼저 달린 것부터)대로 자리를 고르므로, 새 오너먼트가 달려도 기존 것은 움직이지 않습니다.
// 트리에는 메시지 오너먼트만 달립니다. 자리 수(MAX_ORNAMENTS)를 넘는 메시지는 달지 않습니다.
// kind: 스노우볼 주제. 주제마다 자리 묶음과 달 수 있는 모양이 다릅니다 (안 넘기면 크리스마스).
export function placeOrnaments<T extends OrnamentLike>(ornaments: T[], kind: GlobeKind = "christmas"): PlacedOrnament<T>[] {
  const set = slotSet(kind);
  const used = new Set<number>();
  const placed: PlacedOrnament<T>[] = [];

  for (const ornament of ornaments) {
    const shape = toShape(ornament.shape, kind);
    const wanted = wantedSlot(ornament.position, set.slots);
    const slot = (wanted && !used.has(wanted.id) ? wanted : undefined) ?? pickSlot(set, hangs(shape) ? "hang" : "slope", used);
    if (!slot) continue;

    used.add(slot.id);
    placed.push({ key: `message-${ornament.id}`, slot, shape, color: ornament.color, metallic: false, ...fit(slot, shape), ornament });
  }

  return placed;
}

// index 번째 메시지 오너먼트가 놓이는 위치. 아직 달리지 않은 다음 오너먼트(index 가 개수와 같을 때)는 shape 모양으로 달린다고 보고 계산합니다.
export function ornamentSpot(ornaments: OrnamentLike[], index: number, shape?: OrnamentShape, kind: GlobeKind = "christmas"): [number, number, number] | null {
  const list = index < ornaments.length ? ornaments : [...ornaments.slice(0, index), { id: "__next", color: "#ffffff", shape: shape ?? shapesFor(kind)[0] }];
  const target = list[index];
  if (!target) return null;
  return placeOrnaments(list, kind).find((item) => item.ornament === target)?.position ?? null;
}
