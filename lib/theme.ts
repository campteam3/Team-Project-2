// 스노우볼 꾸미기 선택지와 기본값.
// DB 의 globes.theme(jsonb)에 { tree, prop, base, snow } 모양으로 저장합니다. (이슈 #10)
// 트리 · 받침대의 색 값은 3D 스노우볼에 그대로 입히는 색이고, 고르기 버튼의 동그라미에도 같은 색을 칠합니다. (FEEDBACK E2, 이민정)
// 기본값(초록 트리, 레드 받침대)만 모델 원래 색을 쓰므로, 그 둘의 값은 버튼에 칠하는 색입니다.
// 이미 저장된 스노우볼이 있으니 남아 있는 선택지의 id 는 바꾸지 않습니다. 없어진 선택지("deep" 짙은 초록)를 골랐던 스노우볼은 기본값으로 보입니다.
// 휴대폰 꾸미기 도크는 선택지를 한 줄에 놓고, 3개를 넘으면 옆으로 밀어서 넘깁니다.

export type ThemePart = "tree" | "prop" | "base" | "snow";

// trunk: 트리 색에만 씁니다. 그 트리 색에 어울리는 나무 기둥 색 (없으면 모델 원래 기둥 색)
export type ThemeOption = { id: string; label: string; color: string; trunk?: string };

export type GlobeTheme = Record<ThemePart, string>;

export const THEME_PARTS: { key: ThemePart; label: string; options: ThemeOption[] }[] = [
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
    // 소품은 하나만 고르는 것이 아니라 켜고 끄는 것입니다: 둘 다 · 하나만 · 둘 다 없이 (김미영).
    // 저장하는 값은 예전과 같은 글자 하나입니다: "both"(둘 다, 기본) · "gift" · "snowman" · "none"(없음). 아래 hasProp · toggleProp 참고
    options: [
      { id: "gift", label: "선물 상자", color: "#C8363D" },
      { id: "snowman", label: "눈사람", color: "#F5F1EA" },
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

export const DEFAULT_THEME: GlobeTheme = { tree: "green", prop: "both", base: "red", snow: "white" };

export function themeOption(part: ThemePart, id: string): ThemeOption {
  const options = THEME_PARTS.find((p) => p.key === part)!.options;
  return options.find((o) => o.id === id) ?? options[0];
}

// 소품 값("both" · "gift" · "snowman" · "none")에 이 소품이 들어 있는지. 모르는 값은 예전처럼 둘 다로 봅니다.
export type PropItem = "gift" | "snowman";
const PROP_VALUES = ["both", "gift", "snowman", "none"];
export const hasProp = (prop: string, item: PropItem) => prop !== "none" && prop !== (item === "gift" ? "snowman" : "gift");

// 소품 하나를 켜거나 끈 뒤의 소품 값
export function toggleProp(prop: string, item: PropItem): string {
  const gift = item === "gift" ? !hasProp(prop, "gift") : hasProp(prop, "gift");
  const snowman = item === "snowman" ? !hasProp(prop, "snowman") : hasProp(prop, "snowman");
  return gift && snowman ? "both" : gift ? "gift" : snowman ? "snowman" : "none";
}

export const themeColor = (theme: GlobeTheme, part: ThemePart) => themeOption(part, theme[part]).color;

// 고른 트리 색에 어울리는 나무 기둥 색. 기본 트리는 모델 원래 색을 쓰므로 undefined 입니다.
export const trunkColor = (theme: GlobeTheme) => themeOption("tree", theme.tree).trunk;

// DB 에서 읽은 값(모양을 믿을 수 없음)을 안전한 테마로 바꿉니다.
export function parseTheme(value: unknown): GlobeTheme {
  const source = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const theme = { ...DEFAULT_THEME };
  for (const part of THEME_PARTS) {
    const id = source[part.key];
    const known = part.key === "prop" ? PROP_VALUES.includes(id as string) : part.options.some((o) => o.id === id);
    if (typeof id === "string" && known) theme[part.key] = id;
  }
  return theme;
}

// 친구가 다는 오너먼트 색 6가지 (와이어프레임 11 "모양 6개" 자리).
// 모양은 3D 모델(이민정)과 api(addOrnament 의 shape)가 준비되면 추가합니다.
export const ORNAMENT_OPTIONS: ThemeOption[] = [
  { id: "red", label: "빨강", color: "#C8363D" },
  { id: "gold", label: "금빛", color: "#F2C46D" },
  { id: "snow", label: "눈빛", color: "#F5F1EA" },
  { id: "sky", label: "하늘", color: "#8FB8E8" },
  { id: "pine", label: "초록", color: "#3C8E63" },
  { id: "rose", label: "분홍", color: "#E58FA8" },
];
