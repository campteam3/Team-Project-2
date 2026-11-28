"use client";

// 07 메시지 열람 카드 (DESIGN.md 8장 팝오버 카드 · 메시지 카드)
// 보낸 사람 · 단 날짜 · 메시지, 그리고 지우기. 이전 · 다음 · 닫기는 아래 도크에 있습니다.

import type { Ornament } from "@/lib/api";
import { ornamentSwatch } from "@/lib/theme";

type Props = {
  ornament: Ornament;
  index: number;
  total: number;
  canDelete: boolean;
  deleting: boolean;
  onDelete: () => void;
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

export default function MessageViewer({ ornament, index, total, canDelete, deleting, onDelete }: Props) {
  const date = formatDate(ornament.created_at);

  return (
    <article
      aria-live="polite"
      // 읽는 동안 스노우볼이 오너먼트 쪽으로 확대되어 카드 뒤에 흰 눈 · 빨간 받침대가 놓이므로, 바탕을 짙게 깔아 글자가 읽히게 합니다 (이민정)
      className="glass glass-shadow pointer-events-auto flex w-full max-w-[480px] animate-rise flex-col gap-3 rounded-3xl bg-night-900/70 p-5 sm:p-6"
    >
      <header className="flex items-center gap-3">
        <span className="size-4 shrink-0 rounded-full border border-glass-border" style={{ background: ornamentSwatch(ornament.color) }} aria-hidden="true" />
        <p className="min-w-0 flex-1 truncate text-base font-bold text-ink">{ornament.sender_name}</p>
        <p className="shrink-0 text-[13px] tabular-nums text-ink-sub">
          {date && <span>{date} · </span>}
          {index + 1} / {total}
        </p>
      </header>

      <p className="max-h-[32dvh] overflow-y-auto whitespace-pre-wrap break-words text-base leading-[1.7] text-ink">
        {ornament.message?.trim() || "메시지를 불러오지 못했어요."}
      </p>

      {canDelete && (
        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          className="-mb-2 inline-flex min-h-11 items-center self-end px-1 text-[13px] text-danger underline underline-offset-4 disabled:opacity-40"
        >
          {deleting ? "지우고 있어요" : "이 오너먼트 지우기"}
        </button>
      )}
    </article>
  );
}
