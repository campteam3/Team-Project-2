// 스노우볼 트리의 오너먼트 자리와, 메시지를 어느 자리에 달지 정하는 규칙입니다.
// 자리 값은 Blender 원본(design/blender/snowglobe.blend)에서 내보낸 lib/snowglobe-slots.json 에 있습니다.

import type { Ornament } from "@/lib/api";
import slotData from "@/lib/snowglobe-slots.json";

// DB 의 shape 칸에 들어가는 이름. 모르는 이름이 오면 볼로 그립니다.
export const ORNAMENT_SHAPES = ["ball", "star", "heart"] as const;
export type OrnamentShape = (typeof ORNAMENT_SHAPES)[number];

export function toShape(value: string): OrnamentShape {
  return (ORNAMENT_SHAPES as readonly string[]).includes(value) ? (value as OrnamentShape) : "ball";
}

// DB 의 position 칸: 비어 있으면 자동 배치, { slot: 자리번호 } 가 있으면 그 자리를 먼저 씁니다.
function wantedSlot(position: unknown): Slot | undefined {
  const value =
    typeof position === "number" ? position : position && typeof position === "object" ? (position as { slot?: unknown }).slot : undefined;
  return typeof value === "number" && Number.isInteger(value) ? SLOTS[value] : undefined;
}

export type Slot = {
  id: number;
  // hang: 갈래 끝에 매다는 자리(볼·별·하트), slope: 경사면에 얹는 자리(별·하트)
  kind: "hang" | "slope";
  tier: number;
  position: [number, number, number];
  quaternion: [number, number, number, number];
  ballScale: number | null;
  cookieScale: number;
};

export type PlacedOrnament = {
  key: string;
  slot: Slot;
  shape: OrnamentShape;
  color: string;
  metallic: boolean;
  // 기본 장식이면 null
  ornament: Ornament | null;
};

export const SLOTS = slotData.slots as unknown as Slot[];
export const GLASS = slotData.glass as { center: [number, number, number]; radius: number };

const DEFAULT_COLORS: Record<string, string> = { red: "#b3121f", gold: "#e9ad3f", cream: "#efe6d0" };

type DefaultOrnament = { slot: number; shape: OrnamentShape; color: string };
const DEFAULTS = slotData.defaults as DefaultOrnament[];

// 메시지가 한쪽에 몰리지 않도록 자리를 건너뛰며 채우는 순서
const FILL_ORDER = [...SLOTS].sort((a, b) => ((a.id * 17) % SLOTS.length) - ((b.id * 17) % SLOTS.length));

function fits(shape: OrnamentShape, slot: Slot) {
  return shape === "ball" ? slot.kind === "hang" : true;
}

// 메시지 오너먼트를 자리에 배치합니다. 자리가 모자라면 기본 장식 자리를 쓰고, 그래도 모자라면 남는 메시지는 달지 않습니다.
export function placeOrnaments(ornaments: Ornament[]): PlacedOrnament[] {
  const defaultSlots = new Map(DEFAULTS.map((item) => [item.slot, item]));
  const used = new Set<number>();
  const placed: PlacedOrnament[] = [];

  for (const ornament of ornaments) {
    const shape = toShape(ornament.shape);
    const wanted = wantedSlot(ornament.position);
    // 별·하트는 얹는 자리를 먼저 써서, 볼만 달 수 있는 자리를 아낍니다.
    const order =
      shape === "ball" ? FILL_ORDER : [...FILL_ORDER].sort((a, b) => Number(a.kind === "hang") - Number(b.kind === "hang"));
    const free = (slot: Slot) => !used.has(slot.id) && fits(shape, slot);

    const slot =
      (wanted && free(wanted) ? wanted : undefined) ??
      order.find((candidate) => free(candidate) && !defaultSlots.has(candidate.id)) ??
      order.find(free);
    if (!slot) continue;

    used.add(slot.id);
    placed.push({ key: `message-${ornament.id}`, slot, shape, color: ornament.color, metallic: false, ornament });
  }

  for (const item of DEFAULTS) {
    if (used.has(item.slot)) continue;
    placed.push({
      key: `default-${item.slot}`,
      slot: SLOTS[item.slot],
      shape: item.shape,
      color: DEFAULT_COLORS[item.color] ?? item.color,
      metallic: item.color === "gold",
      ornament: null,
    });
  }
  return placed;
}

// 한 번에 달 수 있는 메시지 수
export const MAX_ORNAMENTS = SLOTS.length;
