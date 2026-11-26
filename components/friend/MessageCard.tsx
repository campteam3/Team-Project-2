"use client";

// 12 메시지 쓰기 카드 (DESIGN.md 8장 팝오버 카드): 보내는 사람 · 메시지 · 색 바꾸기 + 오너먼트 달기
// 넓은 화면에서는 스노우볼이 위로 작게 물러나고, 휴대폰에서는 스노우볼 위에 겹쳐 올라옵니다 (FEEDBACK B5).
// 받침대 위에 겹치므로 글자가 묻히지 않게 도크와 같은 어두운 유리를 씁니다. 카드가 스노우볼을 덜 가리도록 "색 바꾸기"도 카드 안에 둡니다.
// 키보드가 올라오면(kb:) 보이는 영역 안에 다 들어오도록 여백과 메시지 칸을 줄입니다.
// 메시지 칸 아래에는 기본 문구를 골라 시작하는 버튼 줄이 있습니다 (FEEDBACK F2, 차명근). 문구는 lib/message-templates.ts

import type { FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { MESSAGE_MAX, SENDER_MAX } from "@/lib/api";
import { MESSAGE_TEMPLATES, findTemplate } from "@/lib/message-templates";

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

  // 기본 문구는 메시지 칸이 비었거나, 고른 문구를 아직 고치지 않았을 때만 누를 수 있습니다.
  // 직접 쓰기 시작하면 감추고(쓴 글을 덮어쓰지 않도록), 칸을 비우면 다시 보입니다.
  // 감출 때도 자리는 남겨 둡니다. 글자를 치는 순간 카드 높이가 바뀌면 휴대폰에서 입력칸이 아래로 튑니다.
  const picked = findTemplate(message);
  const showTemplates = message.trim() === "" || !!picked;

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

      {/* 기본 문구 (FEEDBACK F2): 누르면 메시지 칸이 그 문구로 채워지고, 그대로 달거나 고쳐 쓸 수 있습니다.
          휴대폰은 한 줄로 두고 옆으로 넘겨 보게 해서 카드가 길어지지 않게 합니다(키보드가 올라와도 한 줄).
          넓은 화면은 옆으로 넘기기 어려워서 줄을 바꿔 모두 보이게 합니다. */}
      {(
        <div
          aria-hidden={!showTemplates}
          inert={!showTemplates}
          className={`-mt-1 flex flex-col gap-2 transition-opacity duration-200 kb:-mt-0.5 kb:gap-1.5 ${showTemplates ? "opacity-100" : "invisible opacity-0"}`}
        >
          <p id="template-hint" className="text-[13px] text-ink-sub">
            무엇을 쓸지 고민되면 골라서 시작해 보세요
          </p>
          <div
            role="group"
            aria-labelledby="template-hint"
            className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-0.5 [scrollbar-width:none] kb:-mx-4 kb:px-4 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden"
          >
            {MESSAGE_TEMPLATES.map((template) => {
              const on = picked?.id === template.id;
              return (
                <button
                  key={template.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onMessage(template.text)}
                  className={`h-10 shrink-0 whitespace-nowrap rounded-full border px-4 text-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink ${
                    on ? "border-transparent bg-glass-strong font-bold text-ink ring-2 ring-inset ring-accent" : "border-glass-border text-ink-sub hover:bg-glass hover:text-ink"
                  }`}
                >
                  {template.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="-mt-1 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex gap-2.5">
        <Button variant="secondary" icon="arrow-left" onClick={onBack} className="!px-4">
          색 바꾸기
        </Button>
        {/* 좁은 휴대폰(320px)에서도 "오너먼트 달기"가 여유 있게 들어오도록 좌우 여백을 줄입니다 (FEEDBACK C1) */}
        <Button type="submit" disabled={busy} className="min-w-0 flex-1 !px-3">
          {busy ? "달고 있어요" : "오너먼트 달기"}
        </Button>
      </div>
    </form>
  );
}
