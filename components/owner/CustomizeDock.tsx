"use client";

// 02 꾸미기 도크 (시안 C = 시안 A 의 02)
//  - 넓은 화면: 한 줄 도크 (꾸밀 곳 4개 · 선택지 3개 · 완료)
//  - 휴대폰: 도크 두 개. 위 도크는 꾸밀 곳 4칸, 아래 도크는 고른 곳의 선택지 3칸 + 완료.
//    두 도크는 같은 너비 · 같은 칸 나눔으로 정렬하고, 선택지에는 이름을 함께 보여 줍니다.

import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { Dock } from "@/components/ui/Dock";
import { THEME_PARTS, type GlobeTheme, type ThemeOption, type ThemePart } from "@/lib/theme";

// 소품은 색이 아니라 모양으로 고르므로 그림 아이콘으로 보여 줍니다 (처음 보는 사람도 눌러 보지 않고 알 수 있게)
// 아이콘: public/icons/prop-*.svg (Figma AI 벡터, Figma 파일의 "Icons · 꾸미기 소품" 판)
const PROP_ICON: Record<string, string> = { gift: "/icons/prop-gift.svg", snowman: "/icons/prop-snowman.svg", both: "/icons/prop-both.svg" };

type Props = {
  theme: GlobeTheme;
  part: ThemePart;
  onPart: (part: ThemePart) => void;
  onPick: (part: ThemePart, id: string) => void;
  onNext: () => void;
};

// 선택지 하나의 그림 (소품은 아이콘, 나머지는 색 동그라미)
function OptionMark({ part, option, size }: { part: ThemePart; option: ThemeOption; size: number }) {
  if (part === "prop") {
    return <Image src={PROP_ICON[option.id] ?? PROP_ICON.gift} alt="" width={size + 4} height={size + 4} unoptimized />;
  }
  return <span className="rounded-full border border-glass-border" style={{ background: option.color, width: size, height: size }} />;
}

// "눈 색깔"처럼 이름에 이미 색이 들어 있으면 "색"을 한 번 더 붙이지 않습니다
const sheetTitle = (part: ThemePart, label: string) => (part === "prop" ? "소품 고르기" : label.includes("색") ? `${label} 고르기` : `${label} 색 고르기`);

// 꾸미기를 마치는 버튼. "다음"은 다음 꾸밀 곳으로 넘어가는 버튼처럼 읽혀서 바꿨습니다 (FEEDBACK B3)
const DONE_LABEL = "완료";

export default function CustomizeDock({ theme, part, onPart, onPick, onNext }: Props) {
  const current = THEME_PARTS.find((p) => p.key === part)!;

  return (
    <>
      {/* 넓은 화면: 한 줄 도크 */}
      <Dock label="스노우볼 꾸미기" className="max-sm:hidden">
        <div className="flex items-center gap-1" role="group" aria-label="꾸밀 곳">
          {THEME_PARTS.map((p) => {
            const selected = p.key === part;
            return (
              <button
                key={p.key}
                type="button"
                aria-pressed={selected}
                onClick={() => onPart(p.key)}
                className={`h-11 shrink-0 rounded-full px-5 text-[15px] transition duration-200 ease-soft ${
                  selected ? "bg-glass-strong font-bold text-ink ring-2 ring-inset ring-accent" : "font-medium text-ink-sub hover:text-ink"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        <span className="mx-1.5 h-7 w-px bg-glass-strong" aria-hidden="true" />

        <div className="flex items-center gap-1" role="group" aria-label={sheetTitle(part, current.label)}>
          {current.options.map((o) => {
            const selected = theme[part] === o.id;
            return (
              <button
                key={o.id}
                type="button"
                aria-pressed={selected}
                aria-label={`${current.label}: ${o.label}`}
                title={o.label}
                onClick={() => onPick(part, o.id)}
                className={`flex size-11 items-center justify-center rounded-full transition duration-200 ease-soft ${
                  selected ? "ring-2 ring-inset ring-accent" : "hover:bg-glass"
                }`}
              >
                <OptionMark part={part} option={o} size={32} />
              </button>
            );
          })}
        </div>
        <Button onClick={onNext} className="ml-1">
          {DONE_LABEL}
        </Button>
      </Dock>

      {/* 휴대폰: 도크 두 개 — 위는 꾸밀 곳 4칸, 아래는 고른 곳의 선택지 3칸 + 완료 (항상 보임) */}
      <div className="flex w-full flex-col gap-2 sm:hidden">
        <Dock label="꾸밀 곳" className="w-full">
          <div className="grid w-full grid-cols-4 gap-1" role="group" aria-label="꾸밀 곳">
            {THEME_PARTS.map((p) => {
              const selected = p.key === part;
              return (
                <button
                  key={p.key}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onPart(p.key)}
                  className={`h-11 rounded-full text-[15px] transition duration-200 ease-soft ${
                    selected ? "bg-glass-strong font-bold text-ink ring-2 ring-inset ring-accent" : "font-medium text-ink-sub"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </Dock>

        <Dock label={sheetTitle(part, current.label)} className="w-full !rounded-[28px]">
          <div className="grid min-w-0 flex-1 grid-cols-3 gap-1" role="group" aria-label={sheetTitle(part, current.label)}>
            {current.options.map((o) => {
              const selected = theme[part] === o.id;
              return (
                <button
                  key={o.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onPick(part, o.id)}
                  className={`flex min-h-[62px] flex-col items-center justify-center gap-1 rounded-2xl px-1 transition duration-200 ease-soft ${
                    selected ? "bg-glass-strong ring-2 ring-inset ring-accent" : ""
                  }`}
                >
                  <OptionMark part={part} option={o} size={28} />
                  <span className={`max-w-full truncate text-xs ${selected ? "font-bold text-ink" : "text-ink-sub"}`}>{o.label}</span>
                </button>
              );
            })}
          </div>
          <Button onClick={onNext} className="ml-1 !h-[62px] !rounded-[20px] !px-4">
            {DONE_LABEL}
          </Button>
        </Dock>
      </div>
    </>
  );
}
