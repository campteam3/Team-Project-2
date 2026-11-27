// 스노우볼 트리의 오너먼트 자리와, 메시지를 어느 자리에 달지 정하는 규칙입니다.
// 자리 값은 Blender 원본(design/blender/snowglobe.blend)에서 내보낸 lib/snowglobe-slots.json 에 있습니다.
// 좌표는 모델 원본 그대로입니다: 유리 구의 가운데가 (0, 0.55, 0), 반지름 1.

import slotData from "@/lib/snowglobe-slots.json";

// DB 의 shape 칸에 들어가는 이름. 모르는 이름이 오면 볼로 그립니다.
export const ORNAMENT_SHAPES = ["ball", "star", "heart", "cane", "gift"] as const;
export type OrnamentShape = (typeof ORNAMENT_SHAPES)[number];

// 매다는 모양(볼 · 지팡이 사탕 · 선물 상자)인지. 별 · 하트는 경사면에 얹는 쿠키 모양입니다.
const hangs = (shape: OrnamentShape) => shape !== "star" && shape !== "heart";

export function toShape(value: string | undefined): OrnamentShape {
  return value !== undefined && (ORNAMENT_SHAPES as readonly string[]).includes(value) ? (value as OrnamentShape) : "ball";
}

// 트리에 달 오너먼트. DB 의 오너먼트(lib/api 의 Ornament)를 그대로 넣을 수 있고, id 와 색만 있어도 됩니다.
export type OrnamentLike = { id: string; color: string; shape?: string; position?: unknown };

// DB 의 position 칸: 비어 있으면 자동 배치, { slot: 자리번호 } 가 있으면 그 자리를 먼저 씁니다.
function wantedSlot(position: unknown): Slot | undefined {
  const value =
    typeof position === "number" ? position : position && typeof position === "object" ? (position as { slot?: unknown }).slot : undefined;
  return typeof value === "number" && Number.isInteger(value) ? SLOTS[value] : undefined;
}

export type Slot = {
  id: number;
  // hang: 갈래 끝에 매다는 자리, slope: 경사면에 얹는 자리
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
// 자리 사이의 거리 (자리 번호는 SLOTS 의 순서와 같습니다)
const APART = SLOTS.map((a) => SLOTS.map((b) => Math.hypot(a.position[0] - b.position[0], a.position[1] - b.position[1], a.position[2] - b.position[2])));
// 자리마다의 기본 점수: 앞쪽일수록, 모양에 맞는 종류(kind)일수록, 정면에 가까울수록 높습니다.
// 볼 · 지팡이 사탕 · 선물 상자는 매다는 자리가, 별 · 하트는 얹는 자리가 맞는 자리입니다. 앞쪽에 맞는 자리가 없으면 앞쪽의 다른 종류 자리를 쓰고, 그다음에 옆 · 뒤로 넘어갑니다.
const baseScore = (kind: Slot["kind"]) => SLOTS.map((slot) => -side(slot) * 10 - Number(slot.kind !== kind) * 5 - offFront(slot) * 0.3);
const BASE_SCORE = { hang: baseScore("hang"), slope: baseScore("slope") };

// 비어 있는 자리 중 가장 좋은 자리. 한곳에 몰리지 않게, 이미 달린 오너먼트에서 먼 자리에 점수를 더 줍니다.
function pickSlot(kind: Slot["kind"], used: Set<number>): Slot | undefined {
  let best: Slot | undefined;
  let bestScore = -Infinity;
  for (const slot of SLOTS) {
    if (used.has(slot.id)) continue;
    let near = 0.6;
    for (const id of used) near = Math.min(near, APART[slot.id][id]);
    const score = BASE_SCORE[kind][slot.id] + near;
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
export function placeOrnaments<T extends OrnamentLike>(ornaments: T[]): PlacedOrnament<T>[] {
  const used = new Set<number>();
  const placed: PlacedOrnament<T>[] = [];

  for (const ornament of ornaments) {
    const shape = toShape(ornament.shape);
    const wanted = wantedSlot(ornament.position);
    const slot = (wanted && !used.has(wanted.id) ? wanted : undefined) ?? pickSlot(hangs(shape) ? "hang" : "slope", used);
    if (!slot) continue;

    used.add(slot.id);
    placed.push({ key: `message-${ornament.id}`, slot, shape, color: ornament.color, metallic: false, ...fit(slot, shape), ornament });
  }

  return placed;
}

// index 번째 메시지 오너먼트가 놓이는 위치. 아직 달리지 않은 다음 오너먼트(index 가 개수와 같을 때)는 shape 모양으로 달린다고 보고 계산합니다.
export function ornamentSpot(ornaments: OrnamentLike[], index: number, shape: OrnamentShape = "ball"): [number, number, number] | null {
  const list = index < ornaments.length ? ornaments : [...ornaments.slice(0, index), { id: "__next", color: "#ffffff", shape }];
  const target = list[index];
  if (!target) return null;
  return placeOrnaments(list).find((item) => item.ornament === target)?.position ?? null;
}
