"use client";

// 11 오너먼트 고르기 도크: 돌아가기 · 모양 5개(볼 · 별 · 하트 · 사탕 · 선물, 새해 스노우볼은 복주머니 · 방패연 · 노리개) · 색 6개 · 다음
// 넓은 화면(960px 이상)에서는 한 줄, 그보다 좁으면 세 줄(모양 / 색 / 돌아가기 + 다음)로 놓입니다.
// 모양이 다섯 개가 되어 한 줄에 다 놓으려면 도크 너비 약 870px(좌우 여백까지 약 930px)이 필요합니다. 그래서 태블릿 세로 화면도 세 줄로 놓습니다 (이민정).
// 세 줄일 때 모양 칸은 그림 위 · 이름 아래로 쌓아 다섯 개가 같은 너비로 들어갑니다 (02 꾸미기 도크의 선택지와 같은 모양).
// 모양 이름은 이민정 님의 lib/snowglobe.ts 의 ORNAMENT_SHAPES 를 그대로 씁니다.

import { Button, IconButton } from "@/components/ui/Button";
import { Dock } from "@/components/ui/Dock";
import { Icon } from "@/components/ui/Icons";
import { SHAPE_LABEL, shapesFor, type OrnamentShape } from "@/lib/snowglobe";
import { ORNAMENT_OPTIONS, ornamentSwatch, type GlobeKind } from "@/lib/theme";

type Props = {
  kind?: GlobeKind; // 오너먼트를 달 스노우볼의 주제. 주제마다 고를 수 있는 모양이 다릅니다 (안 넘기면 볼 · 별 · 하트)
  shape: OrnamentShape;
  onShape: (shape: OrnamentShape) => void;
  colorId: string;
  onPick: (id: string) => void;
  onBack: () => void;
  onNext: () => void;
};

export default function OrnamentPickDock({ kind, shape, onShape, colorId, onPick, onBack, onNext }: Props) {
  return (
    <Dock label="오너먼트 고르기" className="max-[959px]:w-full max-[959px]:max-w-[440px] max-[959px]:flex-col max-[959px]:items-stretch max-[959px]:rounded-[28px]">
      <IconButton icon="arrow-left" label="돌아가기" onClick={onBack} className="max-[959px]:hidden" />

      <div className="flex items-center justify-between gap-1 min-[960px]:ml-1 min-[960px]:justify-start" role="group" aria-label="오너먼트 모양">
        {shapesFor(kind).map((s) => {
          const selected = s === shape;
          return (
            <button
              key={s}
              type="button"
              aria-pressed={selected}
              onClick={() => onShape(s)}
              className={`inline-flex min-h-[56px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl text-xs transition duration-200 ease-soft min-[960px]:h-11 min-[960px]:min-h-0 min-[960px]:flex-none min-[960px]:flex-row min-[960px]:gap-1.5 min-[960px]:rounded-full min-[960px]:px-4 min-[960px]:text-[15px] ${
                selected ? "bg-glass-strong font-bold text-ink ring-2 ring-inset ring-accent" : "font-medium text-ink-sub hover:text-ink"
              }`}
            >
              <Icon name={s} size={18} />
              {SHAPE_LABEL[s]}
            </button>
          );
        })}
      </div>

      <span className="mx-1.5 hidden h-7 w-px bg-glass-strong min-[960px]:block" aria-hidden="true" />

      <div className="flex items-center justify-between gap-0.5 min-[960px]:justify-start" role="group" aria-label="오너먼트 색">
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
                // 색 버튼은 3D 오너먼트의 실제 모습에 맞춘 색으로 보여 줍니다 (lib/theme.ts 의 ornamentSwatch, 이민정)
                style={{ background: ornamentSwatch(o.color, true) }}
              />
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-2 min-[960px]:ml-1">
        <IconButton icon="arrow-left" label="돌아가기" onClick={onBack} className="min-[960px]:hidden" />
        <Button onClick={onNext}>다음</Button>
      </div>
    </Dock>
  );
}
