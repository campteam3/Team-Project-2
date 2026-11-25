"use client";

// 12 메시지 쓰기 카드 (DESIGN.md 8장 팝오버 카드): 보내는 사람 · 메시지 · 달기
// 도크 위로 올라오고, 그동안 스노우볼은 위로 작게 물러납니다.

import type { FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { MESSAGE_MAX, SENDER_MAX } from "@/lib/api";

type Props = {
  sender: string;
  onSender: (value: string) => void;
  message: string;
  onMessage: (value: string) => void;
  error: string;
  busy: boolean;
  onSubmit: () => void;
};

const field =
  "glass w-full px-5 text-base text-ink outline-none placeholder:text-ink-sub/70 focus:ring-2 focus:ring-ink";

export default function MessageCard({ sender, onSender, message, onMessage, error, busy, onSubmit }: Props) {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <form
      onSubmit={submit}
      noValidate
      className="glass glass-shadow pointer-events-auto flex w-full max-w-[480px] flex-col gap-4 rounded-3xl p-5 sm:p-6"
    >
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium text-ink">보내는 사람</span>
        <input
          value={sender}
          onChange={(e) => onSender(e.target.value)}
          maxLength={SENDER_MAX}
          autoComplete="nickname"
          placeholder="이름이나 별명"
          className={`${field} h-12 rounded-full`}
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="flex items-baseline justify-between text-sm font-medium text-ink">
          메시지
          <span className="text-[13px] font-normal tabular-nums text-ink-sub" aria-live="polite">
            {message.length}/{MESSAGE_MAX}
          </span>
        </span>
        <textarea
          value={message}
          onChange={(e) => onMessage(e.target.value)}
          maxLength={MESSAGE_MAX}
          rows={4}
          placeholder="전하고 싶은 말을 적어 주세요"
          className={`${field} min-h-28 resize-none rounded-2xl py-3 leading-[1.6]`}
        />
      </label>

      {error && (
        <p role="alert" className="-mt-1 text-sm text-danger">
          {error}
        </p>
      )}

      <Button type="submit" disabled={busy} className="w-full">
        {busy ? "달고 있어요" : "달기"}
      </Button>
    </form>
  );
}
