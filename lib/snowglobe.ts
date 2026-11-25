// 스노우볼 트리의 오너먼트 자리와, 메시지를 어느 자리에 달지 정하는 규칙입니다.
// 자리 값은 Blender 원본(design/blender/snowglobe.blend)에서 내보낸 lib/snowglobe-slots.json 에 있습니다.
// 좌표는 모델 원본 그대로입니다: 유리 구의 가운데가 (0, 0.55, 0), 반지름 1.

import slotData from "@/lib/snowglobe-slots.json";

// DB 의 shape 칸에 들어가는 이름. 모르는 이름이 오면 볼로 그립니다.
export const ORNAMENT_SHAPES = ["ball", "star", "heart"] as const;
export type OrnamentShape = (typeof ORNAMENT_SHAPES)[number];

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
  // 기본 장식이면 null
  ornament: T | null;
};

export const SLOTS = slotData.slots as unknown as Slot[];
export const GLASS = slotData.glass as { center: [number, number, number]; radius: number };

// 한 스노우볼에 달 수 있는 메시지 수. DB 의 제한(supabase/migrations 의 ornament_limit)과 같아야 합니다.
export const MAX_ORNAMENTS = SLOTS.length;

const DEFAULT_COLORS: Record<string, string> = { red: "#b3121f", gold: "#e9ad3f", cream: "#efe6d0" };

type DefaultOrnament = { slot: number; shape: OrnamentShape; color: string };
const DEFAULTS = slotData.defaults as DefaultOrnament[];
const DEFAULT_SLOTS = new Set(DEFAULTS.map((item) => item.slot));

// 메시지가 한쪽에 몰리지 않도록 자리를 건너뛰며 채우는 순서
const FILL_ORDER = [...SLOTS].sort((a, b) => ((a.id * 17) % SLOTS.length) - ((b.id * 17) % SLOTS.length));
// 볼은 매다는 자리를 먼저, 별 · 하트는 얹는 자리를 먼저 씁니다. 자리가 모자라면 다른 종류의 자리도 씁니다.
const HANG_FIRST = [...FILL_ORDER].sort((a, b) => Number(a.kind === "slope") - Number(b.kind === "slope"));
const SLOPE_FIRST = [...FILL_ORDER].sort((a, b) => Number(a.kind === "hang") - Number(b.kind === "hang"));

// 자리의 방향(quaternion)으로 벡터를 돌립니다.
function rotate([x, y, z]: [number, number, number], [qx, qy, qz, qw]: Slot["quaternion"]): [number, number, number] {
  const tx = 2 * (qy * z - qz * y);
  const ty = 2 * (qz * x - qx * z);
  const tz = 2 * (qx * y - qy * x);
  return [x + qw * tx + (qy * tz - qz * ty), y + qw * ty + (qz * tx - qx * tz), z + qw * tz + (qx * ty - qy * tx)];
}

// 그 자리에 그 모양을 놓을 때의 위치와 크기
function fit(slot: Slot, shape: OrnamentShape): { position: [number, number, number]; scale: number } {
  if (shape !== "ball") return { position: slot.position, scale: slot.cookieScale };
  if (slot.ballScale !== null) return { position: slot.position, scale: slot.ballScale };
  // 볼을 얹는 자리에 놓을 때: 쿠키가 누울 자리에 볼이 경사면에 기대어 놓이도록 옮깁니다.
  const scale = slot.cookieScale * 0.8;
  const [dx, dy, dz] = rotate([0, 1.5 * scale - 1.2625 * slot.cookieScale, scale], slot.quaternion);
  return { position: [slot.position[0] + dx, slot.position[1] + dy, slot.position[2] + dz], scale };
}

// 메시지 오너먼트를 자리에 배치합니다. 순서(먼저 달린 것부터)대로 자리를 고르므로, 새 오너먼트가 달려도 기존 것은 움직이지 않습니다.
// 자리가 모자라면 기본 장식 자리를 쓰고, 자리 수(MAX_ORNAMENTS)를 넘는 메시지는 달지 않습니다.
export function placeOrnaments<T extends OrnamentLike>(ornaments: T[]): PlacedOrnament<T>[] {
  const used = new Set<number>();
  const placed: PlacedOrnament<T>[] = [];

  for (const ornament of ornaments) {
    const shape = toShape(ornament.shape);
    const wanted = wantedSlot(ornament.position);
    const order = shape === "ball" ? HANG_FIRST : SLOPE_FIRST;
    const free = (slot: Slot) => !used.has(slot.id);

    const slot =
      (wanted && free(wanted) ? wanted : undefined) ??
      order.find((candidate) => free(candidate) && !DEFAULT_SLOTS.has(candidate.id)) ??
      order.find(free);
    if (!slot) continue;

    used.add(slot.id);
    placed.push({ key: `message-${ornament.id}`, slot, shape, color: ornament.color, metallic: false, ...fit(slot, shape), ornament });
  }

  for (const item of DEFAULTS) {
    if (used.has(item.slot)) continue;
    const slot = SLOTS[item.slot];
    placed.push({
      key: `default-${item.slot}`,
      slot,
      shape: item.shape,
      color: DEFAULT_COLORS[item.color] ?? item.color,
      metallic: item.color === "gold",
      ...fit(slot, item.shape),
      ornament: null,
    });
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
