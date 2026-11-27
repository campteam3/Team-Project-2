"use client";

// 받은 기념 메시지 카드: 보낸 사람 · 날짜 · 메시지 (FEEDBACK F1, 차명근)
// 모양은 주인이 메시지를 읽는 카드(MessageViewer)와 맞췄습니다. 메시지는 글자 그대로 보여 줍니다(줄바꿈 유지).

import type { Gift } from "@/lib/api";
import { ornamentSwatch } from "@/lib/theme";

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

export default function GiftMessageCard({ gift }: { gift: Gift }) {
  const date = formatDate(gift.created_at);
  return (
    <article
      data-gift-card
      aria-live="polite"
      className="glass glass-shadow pointer-events-auto flex w-full max-w-[480px] animate-rise flex-col gap-3 rounded-3xl bg-night-900/70 p-5 sm:p-6"
    >
      <header className="flex items-center gap-3">
        <span className="size-4 shrink-0 rounded-full border border-glass-border" style={{ background: ornamentSwatch(gift.color) }} aria-hidden="true" />
        <p className="min-w-0 flex-1 truncate text-base font-bold text-ink">{gift.sender_name}</p>
        {date && <p className="shrink-0 text-[13px] tabular-nums text-ink-sub">{date}</p>}
      </header>
      <p className="max-h-[28dvh] overflow-y-auto whitespace-pre-wrap break-words text-base leading-[1.7] text-ink">{gift.message}</p>
    </article>
  );
}
