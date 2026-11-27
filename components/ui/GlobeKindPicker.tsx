"use client";

// 스노우볼 고르기 (크리스마스 · 새해 …). 화면 왼쪽 위의 아래 화살표 버튼을 누르면 그 아래로 아이콘 목록이 펼쳐집니다. (차명근)
// 설계: docs/superpowers/specs/2026-11-27-newyear-globe-design.md 3-3
//  - 목록은 글자 없이 아이콘입니다. 그래서 버튼마다 aria-label · title 로 이름을 답니다.
//  - 지금 고른 것은 테두리로 표시합니다. 바깥을 누르거나 Esc 를 누르면 닫힙니다.
//  - 고를 수 있는 주제는 lib/theme.ts 의 AVAILABLE_KINDS 입니다.

import { useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "@/components/ui/Icons";
import { AVAILABLE_KINDS, KIND_LABEL, type GlobeKind } from "@/lib/theme";

const KIND_ICON: Record<GlobeKind, IconName> = { christmas: "tree", birthday: "cake", newyear: "sheep" };

export default function GlobeKindPicker({ kind, onPick }: { kind: GlobeKind; onPick: (kind: GlobeKind) => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="flex flex-col items-start gap-2">
      <button
        type="button"
        aria-label={`스노우볼 고르기 (지금: ${KIND_LABEL[kind]})`}
        title="스노우볼 고르기"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="glass inline-flex size-11 items-center justify-center rounded-full text-ink transition duration-200 ease-soft hover:bg-glass-strong active:scale-[0.97]"
      >
        <Icon name="chevron-down" className={`transition-transform duration-200 ease-soft ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        // 제목 위에 펼쳐지므로 바탕을 조금 짙게 해서 뒤의 글자가 비치지 않게 합니다
        <div role="group" aria-label="스노우볼 종류" className="glass flex animate-rise flex-col gap-1 rounded-full bg-night-900/80 p-1">
          {AVAILABLE_KINDS.map((item) => {
            const selected = item === kind;
            return (
              <button
                key={item}
                type="button"
                aria-label={KIND_LABEL[item]}
                title={KIND_LABEL[item]}
                aria-pressed={selected}
                onClick={() => {
                  onPick(item);
                  setOpen(false);
                }}
                className={`inline-flex size-11 items-center justify-center rounded-full transition duration-200 ease-soft active:scale-[0.97] ${
                  selected ? "bg-glass-strong text-ink ring-2 ring-inset ring-accent" : "text-ink-sub hover:bg-glass hover:text-ink"
                }`}
              >
                <Icon name={KIND_ICON[item]} size={22} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
