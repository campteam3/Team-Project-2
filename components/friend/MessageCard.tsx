"use client";

// 12 메시지 쓰기 카드 (DESIGN.md 8장 팝오버 카드): 보내는 사람 · 메시지 · 색 바꾸기 + 오너먼트 달기
// 스노우볼은 고르던 크기 · 자리 그대로 두고, 카드가 그 위에 겹쳐 올라옵니다 (FEEDBACK B5. 넓은 화면도 같게: 이슈 #67).
// 받침대 위에 겹치므로 글자가 묻히지 않게 도크와 같은 어두운 유리를 씁니다. 카드가 스노우볼을 덜 가리도록 "색 바꾸기"도 카드 안에 둡니다.
// 키보드가 올라오면(kb:) 보이는 영역 안에 다 들어오도록 여백과 메시지 칸을 줄입니다.
// 메시지 칸 아래에는 기본 문구를 골라 시작하는 버튼 줄이 있습니다 (FEEDBACK F2, 차명근). 문구는 lib/message-templates.ts
// 메시지 칸 오른쪽 아래에는 쓴 글을 한 번에 비우는 동그란 × 버튼(전체 지우기)이 있습니다.

import type { FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icons";
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

  // 고른 문구를 아직 고치지 않았으면 그 버튼을 선택된 모양으로 보여 줍니다.
  const picked = findTemplate(message);
  const hasMessage = message.length > 0;

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

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline gap-3 text-sm font-medium text-ink">
          <label htmlFor="message-text" className="mr-auto">
            메시지
          </label>
          <span className="text-[13px] font-normal tabular-nums text-ink-sub" aria-live="polite">
            {message.length}/{MESSAGE_MAX}
          </span>
        </div>
        <div className="relative">
          {/* 오른쪽 여백을 넓혀 글이 지우기 버튼 밑으로 들어가지 않게 합니다 */}
          <textarea
            id="message-text"
            value={message}
            onChange={(e) => onMessage(e.target.value)}
            maxLength={MESSAGE_MAX}
            rows={4}
            placeholder="전하고 싶은 말을 적어 주세요"
            className={`${field} block min-h-28 resize-none rounded-2xl py-3 !pr-12 leading-[1.6] kb:h-[76px] kb:min-h-0 kb:py-2.5`}
          />
          {/* 전체 지우기: 메시지 칸 오른쪽 아래의 동그란 × 버튼. 지울 글이 있을 때만 보입니다.
              동그라미는 28px 이고 누르는 자리는 44px 입니다. 눌러도 키보드가 내려가지 않게 입력칸의 포커스를 그대로 둡니다. */}
          {hasMessage && (
            <button
              type="button"
              aria-label="메시지 전체 지우기"
              title="전체 지우기"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onMessage("")}
              className="group absolute bottom-0.5 right-0.5 flex size-11 items-center justify-center rounded-full focus-visible:outline-none"
            >
              <span className="flex size-7 items-center justify-center rounded-full bg-glass-strong text-ink-sub transition-colors duration-200 group-hover:bg-ink/25 group-hover:text-ink group-focus-visible:ring-2 group-focus-visible:ring-ink group-active:scale-[0.94]">
                <Icon name="x" size={14} strokeWidth={2.25} />
              </span>
            </button>
          )}
        </div>
      </div>

      {/* 기본 문구 (FEEDBACK F2): 누르면 메시지 칸이 그 문구로 채워지고, 그대로 달거나 고쳐 쓸 수 있습니다.
          직접 쓰는 중에도 항상 보입니다 (DESIGN.md 원칙 4: 고를 것은 항상 보이게).
          휴대폰은 한 줄로 두고 옆으로 넘겨 보게 해서 카드가 길어지지 않게 합니다(키보드가 올라와도 한 줄).
          더 있다는 것을 알 수 있게 버튼이 카드 안쪽 여백(--edge)으로 넘어가면 양끝에서 흐려집니다 (02 꾸미기 도크와 같은 표시).
          넓은 화면은 옆으로 넘기기 어려워서 줄을 바꿔 모두 보이게 합니다. */}
      <div className="-mt-1 flex flex-col gap-2 kb:-mt-0.5 kb:gap-1.5">
        <p id="template-hint" className="text-[13px] text-ink-sub">
          무엇을 쓸지 고민되면 골라서 시작해 보세요
        </p>
        <div
          role="group"
          aria-labelledby="template-hint"
          className="-mx-5 flex gap-2 overflow-x-auto overscroll-x-contain px-5 pb-0.5 [--edge:20px] [mask-image:linear-gradient(to_right,transparent,black_var(--edge),black_calc(100%-var(--edge)-16px),transparent)] [scrollbar-width:none] kb:-mx-4 kb:px-4 kb:[--edge:16px] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:[mask-image:none] [&::-webkit-scrollbar]:hidden"
        >
          {MESSAGE_TEMPLATES.map((template) => {
            const on = picked?.id === template.id;
            return (
              <button
                key={template.id}
                type="button"
                aria-pressed={on}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onMessage(template.text)}
                className={`h-10 shrink-0 whitespace-nowrap rounded-full border px-4 text-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink ${
                  on ? "border-transparent bg-glass-strong font-bold text-ink ring-2 ring-inset ring-accent" : "border-glass-border text-ink-sub hover:bg-glass hover:text-ink"
                }`}
              >
                {template.label}
              </button>
            );
          })}
          {/* 끝까지 넘겼을 때 마지막 버튼이 흐려진 가장자리 밖으로 나오게 하는 여백 */}
          <span className="w-2 shrink-0 sm:hidden" aria-hidden="true" />
        </div>
      </div>

      {error && (
        <p role="alert" className="-mt-1 text-sm text-danger">
          {error}
        </p>
      )}

      {/* 기본 문구 버튼과 사이를 넓게 둡니다(32px, 키보드가 올라오면 20px). 항상 보이는 문구 버튼을
          "오너먼트 달기"를 누르려다 잘못 눌러, 직접 쓴 글이 문구로 바뀌는 일을 줄입니다. */}
      <div className="mt-4 flex gap-2.5 kb:mt-2.5">
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
