"use client";

// 12 메시지 쓰기 카드 (DESIGN.md 8장 팝오버 카드): 보내는 사람 · 메시지 · 색 바꾸기 + 달기
// 넓은 화면에서는 스노우볼이 위로 작게 물러나고, 휴대폰에서는 스노우볼 위에 겹쳐 올라옵니다 (FEEDBACK B5).
// 받침대 위에 겹치므로 글자가 묻히지 않게 도크와 같은 어두운 유리를 씁니다. 카드가 스노우볼을 덜 가리도록 "색 바꾸기"도 카드 안에 둡니다.
// 키보드가 올라오면(kb:) 보이는 영역 안에 다 들어오도록 여백과 메시지 칸을 줄입니다.

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
  onBack: () => void; // 색 바꾸기 (11 로 돌아가기)
  onSubmit: () => void;
};

const field =
  "glass w-full px-5 text-base text-ink outline-none placeholder:text-ink-sub/70 focus:ring-2 focus:ring-ink";

export default function MessageCard({ sender, onSender, message, onMessage, error, busy, onBack, onSubmit }: Props) {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <form
      onSubmit={submit}
      noValidate
      className="glass glass-shadow pointer-events-auto flex w-full max-w-[480px] flex-col gap-4 rounded-3xl bg-night-900/70 p-5 kb:max-h-[calc(var(--vv-h)-24px)] kb:gap-2.5 kb:overflow-y-auto kb:p-4 sm:p-6"
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
          className={`${field} min-h-28 resize-none rounded-2xl py-3 leading-[1.6] kb:h-[76px] kb:min-h-0 kb:py-2.5`}
        />
      </label>

      {error && (
        <p role="alert" className="-mt-1 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex gap-2.5">
        <Button variant="secondary" icon="arrow-left" onClick={onBack} className="px-5">
          색 바꾸기
        </Button>
        <Button type="submit" disabled={busy} className="min-w-0 flex-1">
          {busy ? "달고 있어요" : "달기"}
        </Button>
      </div>
    </form>
  );
}
