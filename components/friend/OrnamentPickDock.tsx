"use client";

// 11 오너먼트 고르기 도크: 돌아가기 · 모양 3개(볼 · 별 · 하트) · 색 6개 · 다음
// 넓은 화면에서는 한 줄, 휴대폰에서는 세 줄(모양 / 색 / 돌아가기 + 다음)로 놓입니다.
// 모양 이름은 이민정 님의 lib/snowglobe.ts 의 ORNAMENT_SHAPES 를 그대로 씁니다.

import { Button, IconButton } from "@/components/ui/Button";
import { Dock } from "@/components/ui/Dock";
import { Icon } from "@/components/ui/Icons";
import { ORNAMENT_SHAPES, type OrnamentShape } from "@/lib/snowglobe";
import { ORNAMENT_OPTIONS } from "@/lib/theme";

const SHAPE_LABEL: Record<OrnamentShape, string> = { ball: "볼", star: "별", heart: "하트" };

type Props = {
  shape: OrnamentShape;
  onShape: (shape: OrnamentShape) => void;
  colorId: string;
  onPick: (id: string) => void;
  onBack: () => void;
  onNext: () => void;
};

export default function OrnamentPickDock({ shape, onShape, colorId, onPick, onBack, onNext }: Props) {
  return (
    <Dock label="오너먼트 고르기" className="max-sm:w-full max-sm:flex-col max-sm:items-stretch max-sm:rounded-[28px]">
      <IconButton icon="arrow-left" label="돌아가기" onClick={onBack} className="max-sm:hidden" />

      <div className="flex items-center justify-between gap-1 sm:ml-1 sm:justify-start" role="group" aria-label="오너먼트 모양">
        {ORNAMENT_SHAPES.map((s) => {
          const selected = s === shape;
          return (
            <button
              key={s}
              type="button"
              aria-pressed={selected}
              onClick={() => onShape(s)}
              className={`inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full px-4 text-[15px] transition duration-200 ease-soft sm:flex-none ${
                selected ? "bg-glass-strong font-bold text-ink ring-2 ring-inset ring-accent" : "font-medium text-ink-sub hover:text-ink"
              }`}
            >
              <Icon name={s} size={18} />
              {SHAPE_LABEL[s]}
            </button>
          );
        })}
      </div>

      <span className="mx-1.5 hidden h-7 w-px bg-glass-strong sm:block" aria-hidden="true" />

      <div className="flex items-center justify-between gap-0.5 sm:justify-start" role="group" aria-label="오너먼트 색">
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

      <div className="flex items-center justify-between gap-2 sm:ml-1">
        <IconButton icon="arrow-left" label="돌아가기" onClick={onBack} className="sm:hidden" />
        <Button onClick={onNext}>다음</Button>
      </div>
    </Dock>
  );
}
