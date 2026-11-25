"use client";

// 11 오너먼트 고르기 도크: 돌아가기 · 색 6개 · 다음
// 넓은 화면에서는 한 줄, 휴대폰에서는 두 줄(색 / 돌아가기 + 다음)로 놓입니다.

import { Button, IconButton } from "@/components/ui/Button";
import { Dock } from "@/components/ui/Dock";
import { ORNAMENT_OPTIONS } from "@/lib/theme";

type Props = { colorId: string; onPick: (id: string) => void; onBack: () => void; onNext: () => void };

export default function OrnamentPickDock({ colorId, onPick, onBack, onNext }: Props) {
  return (
    <Dock label="오너먼트 고르기" className="max-sm:w-full max-sm:flex-col max-sm:items-stretch max-sm:rounded-[28px]">
      <IconButton icon="arrow-left" label="돌아가기" onClick={onBack} className="max-sm:hidden" />
      <div className="flex items-center justify-between gap-0.5 sm:mx-1 sm:justify-start" role="group" aria-label="오너먼트 색">
        {ORNAMENT_OPTIONS.map((o) => {
          const selected = o.id === colorId;
          return (
            <button
              key={o.id}
              type="button"
              aria-pressed={selected}
              aria-label={`오너먼트 색: ${o.label}`}
              title={o.label}
              onClick={() => onPick(o.id)}
              className={`flex size-11 items-center justify-center rounded-full transition duration-200 ease-soft ${
                selected ? "ring-2 ring-inset ring-accent" : "hover:bg-glass"
              }`}
            >
              <span
                className="size-8 rounded-full border border-glass-border"
                style={{ background: `radial-gradient(circle at 35% 30%, rgb(255 255 255 / 0.7), ${o.color} 45%)` }}
              />
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between gap-2">
        <IconButton icon="arrow-left" label="돌아가기" onClick={onBack} className="sm:hidden" />
        <Button onClick={onNext}>다음</Button>
      </div>
    </Dock>
  );
}
