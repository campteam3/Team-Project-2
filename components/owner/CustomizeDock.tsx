"use client";

// 02 꾸미기 도크 (시안 C = 시안 A 의 02): 꾸밀 곳 4개 · 색 3개 · 다음
// 넓은 화면에서는 한 줄, 휴대폰에서는 두 줄(꾸밀 곳 / 색 + 다음)로 놓입니다.

import { Button } from "@/components/ui/Button";
import { Dock } from "@/components/ui/Dock";
import { THEME_PARTS, type GlobeTheme, type ThemePart } from "@/lib/theme";

type Props = {
  theme: GlobeTheme;
  part: ThemePart;
  onPart: (part: ThemePart) => void;
  onPick: (part: ThemePart, id: string) => void;
  onNext: () => void;
};

export default function CustomizeDock({ theme, part, onPart, onPick, onNext }: Props) {
  const current = THEME_PARTS.find((p) => p.key === part)!;

  return (
    <Dock label="스노우볼 꾸미기" className="max-sm:w-full max-sm:flex-col max-sm:items-stretch max-sm:rounded-[28px]">
      <div className="flex items-center justify-between gap-1 sm:justify-start" role="group" aria-label="꾸밀 곳">
        {THEME_PARTS.map((p) => {
          const selected = p.key === part;
          return (
            <button
              key={p.key}
              type="button"
              aria-pressed={selected}
              onClick={() => onPart(p.key)}
              className={`h-11 shrink-0 rounded-full px-4 text-[15px] transition duration-200 ease-soft sm:px-5 ${
                selected
                  ? "bg-glass-strong font-bold text-ink ring-2 ring-inset ring-accent"
                  : "font-medium text-ink-sub hover:text-ink"
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <span className="mx-1.5 hidden h-7 w-px bg-glass-strong sm:block" aria-hidden="true" />

      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1" role="group" aria-label={`${current.label} 색`}>
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
                <span className="size-8 rounded-full border border-glass-border" style={{ backgroundColor: o.color }} />
              </button>
            );
          })}
        </div>
        <Button onClick={onNext} className="sm:ml-1">
          다음
        </Button>
      </div>
    </Dock>
  );
}
