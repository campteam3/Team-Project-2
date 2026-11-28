// 스노우볼 꾸미기 선택지와 기본값.
// DB 의 globes.theme(jsonb)에 { tree, prop, base, snow } 모양으로 저장합니다. (이슈 #10)
// 트리 · 받침대의 색 값은 3D 스노우볼에 그대로 입히는 색이고, 고르기 버튼의 동그라미에도 같은 색을 칠합니다. (FEEDBACK E2, 이민정)
// 기본값(초록 트리, 레드 받침대)만 모델 원래 색을 쓰므로, 그 둘의 값은 버튼에 칠하는 색입니다.
// 이미 저장된 스노우볼이 있으니 남아 있는 선택지의 id 는 바꾸지 않습니다. 없어진 선택지("deep" 짙은 초록)를 골랐던 스노우볼은 기본값으로 보입니다.
// 휴대폰 꾸미기 도크는 선택지를 한 줄에 놓고, 3개를 넘으면 옆으로 밀어서 넘깁니다.

export type ThemePart = "tree" | "prop" | "base" | "snow";

// trunk: 트리 색에만 씁니다. 그 트리 색에 어울리는 나무 기둥 색 (없으면 모델 원래 기둥 색)
// icon: 소품 고르기 버튼에 보일 그림 (없으면 꾸미기 도크가 id 로 찾습니다)
export type ThemeOption = { id: string; label: string; color: string; trunk?: string; icon?: string };

// 스노우볼 주제. DB 의 theme 에 kind 로 저장하고, 없거나 모르는 값이면 크리스마스입니다. (새해 스노우볼, 차명근 · 이슈 #83)
export const GLOBE_KINDS = ["christmas", "birthday", "newyear"] as const;
export type GlobeKind = (typeof GLOBE_KINDS)[number];
export const KIND_LABEL: Record<GlobeKind, string> = { christmas: "크리스마스", birthday: "생일", newyear: "새해" };
// 지금 고를 수 있는 주제
export const AVAILABLE_KINDS: GlobeKind[] = ["christmas", "birthday", "newyear"];
export const toKind = (value: unknown): GlobeKind => ((GLOBE_KINDS as readonly unknown[]).includes(value) ? (value as GlobeKind) : "christmas");

export type GlobeTheme = Record<ThemePart, string> & { kind: GlobeKind };

type ThemePartInfo = { key: ThemePart; label: string; options: ThemeOption[] };

export const THEME_PARTS: ThemePartInfo[] = [
  {
    key: "tree",
    label: "트리",
    options: [
      // 나무 기둥은 원래 초록 트리에 맞춘 붉은 갈색이라, 다른 색 트리에는 그 색에 어울리는 기둥 색을 함께 입힙니다.
      { id: "green", label: "초록", color: "#38B562" },
      { id: "frost", label: "흰색", color: "#EEF3F3", trunk: "#B9A594" }, // 자작나무 같은 밝은 회갈색
      { id: "mint", label: "민트", color: "#86D8C4", trunk: "#A98B76" }, // 부드러운 코코아색
      { id: "pink", label: "분홍", color: "#F4A9C2", trunk: "#94707C" }, // 분홍 기운이 도는 회갈색
      { id: "black", label: "검정", color: "#2B2E35", trunk: "#382E2C" }, // 아주 짙은 고동색 (안쪽의 따뜻한 조명을 받아 화면에서는 더 밝게 보입니다)
    ],
  },
  {
    key: "prop",
    label: "소품",
    // 별은 트리 꼭대기에 항상 있고, 트리 아래 소품만 고릅니다 (#14 에서 이민정 님과 정함)
    // 소품은 하나만 고르는 것이 아니라 켜고 끄는 것입니다: 네 가지를 저마다 켜고 끕니다 (김미영 · 이민정).
    // 저장하는 값은 예전과 같은 글자 하나입니다: "both"(눈사람 + 선물 상자, 기본) · "gift" · "snowman" · "none"(없음). 아래 hasProp · toggleProp 참고
    // 루돌프("reindeer") · 과자집("house")도 hasProp · toggleProp 가 받습니다. 여기 options 에 넣으면 고르기 버튼이 생깁니다 (이슈 #75).
    options: [
      // 버튼 순서: 선물 상자 · 과자집, 눈사람 · 루돌프 (김미영, 이슈 #75)
      { id: "gift", label: "선물 상자", color: "#C8363D" },
      { id: "house", label: "과자집", color: "#BD7D4D" },
      { id: "snowman", label: "눈사람", color: "#F5F1EA" },
      { id: "reindeer", label: "루돌프", color: "#DFA682" },
    ],
  },
  {
    key: "base",
    label: "받침대",
    options: [
      { id: "red", label: "레드", color: "#ED4034" },
      { id: "wood", label: "나무", color: "#4B2F21" },
      { id: "night", label: "남색", color: "#18274F" },
      { id: "white", label: "흰색", color: "#F2EFE9" },
      { id: "pink", label: "분홍", color: "#F6C6D3" },
      { id: "green", label: "초록", color: "#1B4D3C" },
      { id: "black", label: "검정", color: "#28292E" },
    ],
  },
  {
    key: "snow",
    label: "눈 색깔", // "눈"만 적으면 처음 보는 사람이 무엇을 고르는지 알기 어려워서 바꿨습니다
    options: [
      { id: "white", label: "하얀 눈", color: "#FFFFFF" },
      { id: "gold", label: "금빛 눈", color: "#F6D79A" },
      { id: "blue", label: "푸른 눈", color: "#A9C8F0" },
    ],
  },
];

export const DEFAULT_THEME: GlobeTheme = { tree: "green", prop: "both", base: "red", snow: "white", kind: "christmas" };

// 그 주제로 처음 만들 때의 테마
// 새해 스노우볼은 소품 네 가지(담장 · 떡국 · 윷 · 복조리)를 모두 켠 채로 시작합니다
// 생일 스노우볼은 화이트 케이크 · 연보라 받침대로 시작합니다 (김미영)
export const defaultTheme = (kind: GlobeKind): GlobeTheme =>
  kind === "birthday"
    ? { ...DEFAULT_THEME, kind, tree: "white", base: "lavender", prop: "none" }
    : { ...DEFAULT_THEME, kind, prop: kind === "newyear" ? "both+yut+bokjori" : DEFAULT_THEME.prop };

// 새해 스노우볼의 꾸미기: 트리 · 눈이 없어서 소품과 받침대만 고릅니다.
// 소품 값은 크리스마스와 같은 것을 씁니다: 담장(+까치) = 눈사람 자리("snowman"), 떡국(+소반) = 선물 자리("gift").
const NEWYEAR_PARTS: ThemePartInfo[] = [
  {
    key: "prop",
    label: "소품",
    options: [
      { id: "snowman", label: "담장", color: "#4A4B52", icon: "/icons/prop-wall.svg" },
      { id: "gift", label: "떡국", color: "#F5F1EA", icon: "/icons/prop-tteokguk.svg" },
      // 윷가락 · 복조리는 저마다 제 자리가 있어서 다른 소품과 함께 켤 수 있습니다
      { id: "yut", label: "윷", color: "#6E4129", icon: "/icons/prop-yut.svg" },
      { id: "bokjori", label: "복조리", color: "#EAD3A0", icon: "/icons/prop-bokjori.svg" },
    ],
  },
  THEME_PARTS.find((p) => p.key === "base")!,
];

// 생일 스노우볼의 꾸미기: 케이크 색과 받침대 색만 고릅니다. 풍선 · 선물 상자는 늘 있습니다. (김미영)
// 케이크 색은 트리 자리("tree")에 저장합니다. 케이크 색마다 아이싱 · 풍선 색이 함께 바뀝니다 (아래 BIRTHDAY_CAKES).
// 받침대는 모델 원래 색인 연보라가 기본이고, 나머지는 크리스마스 받침대와 같은 색입니다.
const BIRTHDAY_PARTS: ThemePartInfo[] = [
  {
    key: "tree",
    label: "케이크",
    options: [
      { id: "white", label: "화이트", color: "#F7ECDB" },
      { id: "pink", label: "핑크", color: "#F7C1D2" },
      { id: "sky", label: "하늘", color: "#B9D8F4" },
      { id: "green", label: "초록", color: "#C4E6C5" },
      { id: "brown", label: "초코", color: "#9A6747" },
    ],
  },
  {
    key: "base",
    label: "받침대",
    options: [{ id: "lavender", label: "연보라", color: "#A9B7EE" }, ...THEME_PARTS.find((p) => p.key === "base")!.options],
  },
];

// 생일 케이크 색마다의 짝: 케이크 몸통(body) · 흘러내린 아이싱과 조개 크림(icing) · 색이 바뀌는 풍선 두 개(balloons, 밝은 톤 · 진한 톤).
// 풍선 색이 없으면 모델 원래 색(분홍)입니다. 은색 · 흰색 풍선은 어느 케이크에서나 같습니다. (김미영이 정한 짝, 2026-11-27)
export const BIRTHDAY_CAKES: Record<string, { body: string; icing: string; balloons?: [string, string] }> = {
  white: { body: "#F7ECDB", icing: "#F2CF8E" },
  pink: { body: "#F7C1D2", icing: "#EC7FA5", balloons: ["#E5524D", "#C8363D"] },
  sky: { body: "#B9D8F4", icing: "#6EA6E2", balloons: ["#9CCBF3", "#6EA6E2"] },
  green: { body: "#C4E6C5", icing: "#78C486", balloons: ["#E5524D", "#C8363D"] },
  brown: { body: "#9A6747", icing: "#5B3524" },
};
export const birthdayCake = (theme: GlobeTheme) => BIRTHDAY_CAKES[theme.tree] ?? BIRTHDAY_CAKES.white;

// 그 주제의 꾸미기 화면에 보일 선택지
export const themeParts = (kind: GlobeKind): ThemePartInfo[] => (kind === "newyear" ? NEWYEAR_PARTS : kind === "birthday" ? BIRTHDAY_PARTS : THEME_PARTS);

// kind 를 넘기면 그 주제의 선택지에서 먼저 찾습니다 (생일 스노우볼의 케이크 · 받침대 색)
export function themeOption(part: ThemePart, id: string, kind?: GlobeKind): ThemeOption {
  const own = kind ? themeParts(kind).find((p) => p.key === part)?.options.find((o) => o.id === id) : undefined;
  if (own) return own;
  const options = THEME_PARTS.find((p) => p.key === part)!.options;
  return options.find((o) => o.id === id) ?? options[0];
}

// 소품은 저마다 켜고 끕니다. 크리스마스 스노우볼은 네 가지를 함께 놓을 수 있습니다. (루돌프 · 과자집 추가, 네 가지 함께 놓기: 이민정)
//  - 눈사람("snowman") · 선물 상자("gift"): 앞쪽 제자리(눈사람 자리 · 선물 자리)에 놓입니다.
//    선물 상자는 트리 뒤쪽에도 작은 묶음이 하나 더 놓입니다 (SnowGlobeGlb.tsx 의 BACK_GIFTS)
//  - 루돌프("reindeer") · 과자집("house"): 앞자리가 비어 있으면 거기에(루돌프는 눈사람 자리, 과자집은 선물 자리),
//    차 있으면 옆 · 뒤 자리에 놓입니다 (components/snowglobe/SnowGlobeGlb.tsx 의 GlobeExtras)
//  - 새해 스노우볼의 윷("yut") · 복조리("bokjori")는 저마다 따로 자리가 있습니다 (차명근)
export type PropItem = "gift" | "snowman" | "reindeer" | "house" | "yut" | "bokjori";
// 저장하는 값에 적는 순서
const PROP_ORDER: PropItem[] = ["snowman", "reindeer", "gift", "house", "yut", "bokjori"];

// 놓인 소품 → 저장하는 값. 놓인 것을 위 순서대로 "+" 로 이어 적습니다 (예: "reindeer+house", "snowman+house", "bokjori").
// 예전부터 쓰던 값은 그대로입니다: 눈사람 + 선물 상자는 "both" 로 줄여 적고(예: "both+yut+bokjori", "both+reindeer+house"), 아무것도 없으면 "none".
function propValue(items: PropItem[]): string {
  const placed = PROP_ORDER.filter((item) => items.includes(item));
  const both = placed.includes("snowman") && placed.includes("gift");
  const names = both ? ["both", ...placed.filter((item) => item !== "snowman" && item !== "gift")] : placed;
  return names.join("+") || "none";
}

// 저장할 수 있는 값 전부 (소품 6가지를 저마다 켜고 끈 64가지)
const PROP_VALUES = Array.from({ length: 2 ** PROP_ORDER.length }, (_, bits) => propValue(PROP_ORDER.filter((_, index) => bits & (1 << index))));

// 저장된 값 → 놓인 소품. 모르는 값은 예전처럼 둘 다(눈사람 + 선물 상자)로 봅니다.
function propItems(prop: string): PropItem[] {
  if (prop === "none") return [];
  if (!PROP_VALUES.includes(prop)) return ["snowman", "gift"];
  return prop.split("+").flatMap((item) => (item === "both" ? ["snowman", "gift"] : [item])) as PropItem[];
}

// 소품 값에 이 소품이 들어 있는지
export const hasProp = (prop: string, item: PropItem) => propItems(prop).includes(item);

// 소품 하나를 켜거나 끈 뒤의 소품 값. 다른 소품은 그대로입니다.
export function toggleProp(prop: string, item: PropItem): string {
  const items = propItems(prop);
  return propValue(items.includes(item) ? items.filter((other) => other !== item) : [...items, item]);
}

export const themeColor = (theme: GlobeTheme, part: ThemePart) => themeOption(part, theme[part], theme.kind).color;

// 고른 트리 색에 어울리는 나무 기둥 색. 기본 트리는 모델 원래 색을 쓰므로 undefined 입니다.
export const trunkColor = (theme: GlobeTheme) => themeOption("tree", theme.tree).trunk;

// DB 에서 읽은 값(모양을 믿을 수 없음)을 안전한 테마로 바꿉니다.
export function parseTheme(value: unknown): GlobeTheme {
  const source = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const kind = toKind(source.kind);
  // 생일 스노우볼은 선택지(케이크 · 받침대 색)와 기본값이 따로 있습니다
  const theme = kind === "birthday" ? defaultTheme(kind) : { ...DEFAULT_THEME, kind };
  const own = kind === "birthday" ? themeParts(kind) : [];
  for (const part of THEME_PARTS) {
    const id = source[part.key];
    const options = own.find((p) => p.key === part.key)?.options ?? part.options;
    const known = part.key === "prop" ? PROP_VALUES.includes(id as string) : options.some((o) => o.id === id);
    if (typeof id === "string" && known) theme[part.key] = id;
  }
  return theme;
}

// 친구가 다는 오너먼트 색 6가지 (와이어프레임 11 "모양 6개" 자리).
// 모양은 3D 모델(이민정)과 api(addOrnament 의 shape)가 준비되면 추가합니다.
// color 는 DB 에 저장하는 값이라 바꾸지 않습니다 (이미 달린 오너먼트가 이 값으로 저장되어 있음).
// 3D 오너먼트의 실제 모습은 이 순서대로 정해집니다 (components/snowglobe/OrnamentGlb.tsx): 빨강, 금색, 빨강 + 금색, 파랑, 초록, 분홍.
// 화면에 보이는 색 버튼은 아래 ornamentSwatch 가 그 모습에 맞춰 그립니다 (이민정).
export const ORNAMENT_OPTIONS: ThemeOption[] = [
  { id: "red", label: "빨강", color: "#C8363D" },
  { id: "gold", label: "금색", color: "#F2C46D" },
  { id: "snow", label: "빨강과 금색", color: "#F5F1EA" },
  { id: "sky", label: "파랑", color: "#8FB8E8" },
  { id: "pine", label: "초록", color: "#3C8E63" },
  { id: "rose", label: "분홍", color: "#E58FA8" },
];

// 저장된 색이 몇 번째 선택지인지. 목록에 없는 색(예전 데이터 · 샘플)은 가장 가까운 색을 따릅니다.
// 3D 쪽과 같은 답이 나오도록, 3D 가 쓰는 방식(빛의 세기로 바꾼 값)으로 거리를 잽니다.
function channels(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  const full = value.length === 3 ? [...value].map((c) => c + c).join("") : value;
  const linear = (index: number) => {
    const c = parseInt(full.slice(index, index + 2), 16) / 255;
    if (Number.isNaN(c)) return 0;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return [linear(0), linear(2), linear(4)];
}
export function ornamentOptionIndex(color: string): number {
  const [r, g, b] = channels(color);
  let best = 0;
  let bestGap = Infinity;
  ORNAMENT_OPTIONS.forEach((option, index) => {
    const [or, og, ob] = channels(option.color);
    const gap = (or - r) ** 2 + (og - g) ** 2 + (ob - b) ** 2;
    if (gap < bestGap) {
      bestGap = gap;
      best = index;
    }
  });
  return best;
}

// 색 버튼 · 메시지 카드의 색 점에 보여 줄 색. 3D 오너먼트의 모습에 맞춥니다 (비어 있으면 저장된 색 그대로)
const ORNAMENT_SWATCHES: (string | [string, string] | undefined)[] = [
  undefined, // 빨강
  "#DDB04E", // 금색
  ["#B3101D", "#DDB04E"], // 빨강 + 금색 줄무늬
  "#7FA8F0", // 파랑
];

// 색 버튼 · 색 점의 CSS 배경. shine: 왼쪽 위에 흰 빛을 얹습니다 (색 버튼)
export function ornamentSwatch(color: string, shine = false): string {
  const look = ORNAMENT_SWATCHES[ornamentOptionIndex(color)];
  const base = Array.isArray(look)
    ? `repeating-linear-gradient(135deg, ${look[0]} 0 14%, ${look[1]} 14% 28%)`
    : (look ?? color);
  if (!shine) return base;
  if (Array.isArray(look)) return `radial-gradient(circle at 35% 30%, rgb(255 255 255 / 0.5), transparent 45%), ${base}`;
  return `radial-gradient(circle at 35% 30%, rgb(255 255 255 / 0.7), ${base} 45%)`;
}
