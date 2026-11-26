"use client";

// 02 꾸미기 도크 (시안 C = 시안 A 의 02)
//  - 넓은 화면: 한 줄 도크 (꾸밀 곳 4개 · 선택지 · 완료)
//  - 휴대폰: 도크 두 개. 위 도크는 꾸밀 곳 4칸, 아래 도크는 고른 곳의 선택지(그림 + 이름) + 완료.
//    선택지는 세 개까지 한 줄에 나눠 놓고, 트리(5색) · 받침대(7색)처럼 더 많으면 옆으로 밀어서 넘깁니다 (이슈 #62).
//    밀어 넘기는 칸은 너비 52px · 사이 10px 입니다. 더 있다는 것을 알 수 있게 끝 칸이 걸쳐 보이고 오른쪽 끝이 흐려집니다.
//  - 소품은 하나만 고르는 것이 아니라 켜고 끕니다: 선물 상자 · 눈사람을 둘 다, 하나만, 둘 다 없이.

import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { Dock } from "@/components/ui/Dock";
import { hasProp, THEME_PARTS, toggleProp, type GlobeTheme, type PropItem, type ThemeOption, type ThemePart } from "@/lib/theme";

// 소품은 색이 아니라 모양으로 고르므로 그림 아이콘으로 보여 줍니다 (처음 보는 사람도 눌러 보지 않고 알 수 있게)
// 아이콘: public/icons/prop-*.svg (Figma AI 벡터, Figma 파일의 "Icons · 꾸미기 소품" 판)
const PROP_ICON: Record<string, string> = { gift: "/icons/prop-gift.svg", snowman: "/icons/prop-snowman.svg" };

type Props = {
  theme: GlobeTheme;
  part: ThemePart;
  onPart: (part: ThemePart) => void;
  onPick: (part: ThemePart, id: string) => void;
  onNext: () => void;
};

// 선택지 하나의 그림 (소품은 아이콘, 나머지는 색 동그라미)
// outlined: 소품 아이콘도 색 동그라미와 같은 크기 · 같은 테두리의 동그라미 안에 넣습니다 (넓은 화면 도크: 고르지 않은 소품도 색 동그라미처럼 보이게)
function OptionMark({ part, option, size, outlined }: { part: ThemePart; option: ThemeOption; size: number; outlined?: boolean }) {
  if (part === "prop" && outlined) {
    return (
      <span className="flex items-center justify-center rounded-full border border-glass-border" style={{ width: size, height: size }}>
        {/* 아이콘 파일은 그림 둘레에 여백이 있어, 동그라미보다 크게 놓아야 그림이 색 동그라미만큼 차 보입니다 */}
        <Image src={PROP_ICON[option.id] ?? PROP_ICON.gift} alt="" width={size + 8} height={size + 8} loading="eager" unoptimized className="max-w-none shrink-0" />
      </span>
    );
  }
  if (part === "prop") {
    return <Image src={PROP_ICON[option.id] ?? PROP_ICON.gift} alt="" width={size + 4} height={size + 4} loading="eager" unoptimized />;
  }
  return <span className="rounded-full border border-glass-border" style={{ background: option.color, width: size, height: size }} />;
}

// "눈 색깔"처럼 이름에 이미 색이 들어 있으면 "색"을 한 번 더 붙이지 않습니다
const sheetTitle = (part: ThemePart, label: string) => (part === "prop" ? "소품 고르기" : label.includes("색") ? `${label} 고르기` : `${label} 색 고르기`);

// 꾸미기를 마치는 버튼. "다음"은 다음 꾸밀 곳으로 넘어가는 버튼처럼 읽혀서 바꿨습니다 (FEEDBACK B3)
const DONE_LABEL = "완료";

export default function CustomizeDock({ theme, part, onPart, onPick, onNext }: Props) {
  const current = THEME_PARTS.find((p) => p.key === part)!;
  // 소품은 여러 개를 켜고 끄고, 나머지는 하나만 고릅니다
  const isOn = (id: string) => (part === "prop" ? hasProp(theme.prop, id as PropItem) : theme[part] === id);
  const pick = (id: string) => onPick(part, part === "prop" ? toggleProp(theme.prop, id as PropItem) : id);
  const slides = current.options.length > 3; // 휴대폰: 세 칸을 넘으면 옆으로 밀어서 넘깁니다
  const groupLabel = part === "prop" ? "소품 고르기 (여러 개 고를 수 있어요)" : sheetTitle(part, current.label);

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

        <div className="flex items-center gap-1" role="group" aria-label={groupLabel}>
          {current.options.map((o) => {
            const selected = isOn(o.id);
            return (
              <button
                key={o.id}
                type="button"
                aria-pressed={selected}
                aria-label={`${current.label}: ${o.label}`}
                title={o.label}
                onClick={() => pick(o.id)}
                className={`flex size-11 items-center justify-center rounded-full transition duration-200 ease-soft ${
                  selected ? "ring-2 ring-inset ring-accent" : "hover:bg-glass"
                }`}
              >
                <OptionMark part={part} option={o} size={32} outlined />
              </button>
            );
          })}
        </div>
        <Button onClick={onNext} className="ml-1">
          {DONE_LABEL}
        </Button>
      </Dock>

      {/* 휴대폰: 도크 두 개 — 위는 꾸밀 곳 4칸, 아래는 고른 곳의 선택지 한 줄(그림만) + 완료 (항상 보임) */}
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

        <Dock label={groupLabel} className="w-full !rounded-[28px]">
          {/* key: 꾸밀 곳을 바꾸면 밀어 둔 자리를 처음으로 되돌립니다 */}
          <div
            key={part}
            className={`flex min-w-0 flex-1 snap-x gap-2.5 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
              slides ? "[mask-image:linear-gradient(to_right,black_calc(100%-28px),transparent)]" : ""
            }`}
            role="group"
            aria-label={groupLabel}
          >
            {current.options.map((o) => {
              const selected = isOn(o.id);
              return (
                <button
                  key={o.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => pick(o.id)}
                  className={`flex min-h-[62px] shrink-0 snap-start flex-col items-center justify-center gap-1 rounded-2xl px-1 transition duration-200 ease-soft ${
                    selected ? "bg-glass-strong ring-2 ring-inset ring-accent" : ""
                  }`}
                  style={{ width: slides ? 52 : `calc((100% - ${(current.options.length - 1) * 10}px) / ${current.options.length})` }}
                >
                  <OptionMark part={part} option={o} size={28} />
                  <span className={`max-w-full truncate text-xs ${selected ? "font-bold text-ink" : "text-ink-sub"}`}>{o.label}</span>
                </button>
              );
            })}
            {/* 끝까지 밀었을 때 마지막 칸이 흐려진 가장자리 밖으로 나오게 하는 여백 */}
            {slides && <span className="w-4 shrink-0" aria-hidden="true" />}
          </div>
          <Button onClick={onNext} className="ml-1 !h-[62px] !rounded-[20px] !px-4">
            {DONE_LABEL}
          </Button>
        </Dock>
      </div>
    </>
  );
}
