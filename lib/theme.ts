// 스노우볼 꾸미기 선택지와 기본값.
// DB 의 globes.theme(jsonb)에 { tree, prop, base, snow } 모양으로 저장합니다. (이슈 #10)
// 색 값은 3D 스노우볼(이민정) 작업이 나오면 그 모델에 맞춰 바꿉니다.

export type ThemePart = "tree" | "prop" | "base" | "snow";

export type ThemeOption = { id: string; label: string; color: string };

export type GlobeTheme = Record<ThemePart, string>;

export const THEME_PARTS: { key: ThemePart; label: string; options: ThemeOption[] }[] = [
  {
    key: "tree",
    label: "트리",
    options: [
      { id: "green", label: "초록", color: "#3C8E63" },
      { id: "deep", label: "짙은 초록", color: "#1F5A40" },
      { id: "frost", label: "눈 덮인", color: "#D7E6E4" },
    ],
  },
  {
    key: "prop",
    label: "소품",
    options: [
      { id: "star", label: "금빛 별", color: "#F2C46D" },
      { id: "gift", label: "선물 상자", color: "#C8363D" },
      { id: "snowman", label: "눈사람", color: "#F5F1EA" },
    ],
  },
  {
    key: "base",
    label: "받침대",
    options: [
      { id: "red", label: "레드", color: "#7A3434" },
      { id: "wood", label: "나무", color: "#7A5233" },
      { id: "night", label: "밤하늘", color: "#2B3760" },
    ],
  },
  {
    key: "snow",
    label: "눈",
    options: [
      { id: "white", label: "하얀 눈", color: "#FFFFFF" },
      { id: "gold", label: "금빛 눈", color: "#F6D79A" },
      { id: "blue", label: "푸른 눈", color: "#A9C8F0" },
    ],
  },
];

export const DEFAULT_THEME: GlobeTheme = { tree: "green", prop: "star", base: "red", snow: "white" };

export function themeOption(part: ThemePart, id: string): ThemeOption {
  const options = THEME_PARTS.find((p) => p.key === part)!.options;
  return options.find((o) => o.id === id) ?? options[0];
}

export const themeColor = (theme: GlobeTheme, part: ThemePart) => themeOption(part, theme[part]).color;

// DB 에서 읽은 값(모양을 믿을 수 없음)을 안전한 테마로 바꿉니다.
export function parseTheme(value: unknown): GlobeTheme {
  const source = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const theme = { ...DEFAULT_THEME };
  for (const part of THEME_PARTS) {
    const id = source[part.key];
    if (typeof id === "string" && part.options.some((o) => o.id === id)) theme[part.key] = id;
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
