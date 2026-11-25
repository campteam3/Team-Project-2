"use client";

// 03 정보 입력 (시안 C = 시안 B 의 03: 받침대 명판이 곧 닉네임 입력칸)
//  - NameplateInput: 3D 받침대 명판 위치에 붙는 닉네임 입력칸 (Stage 의 plate 로 넘깁니다)
//  - NameplateForm: 받침대 아래 비밀번호 · 안내 · 버튼
// 두 부분은 화면에서 떨어져 있지만 form 속성("owner-form")으로 하나의 폼입니다.

import type { FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icons";

export const FORM_ID = "owner-form";

// 03 은 가운데 한 줄 기둥으로 정렬합니다. 명판과 비밀번호 칸은 같은 너비를 씁니다.
const COLUMN = "w-[232px] max-w-full sm:w-[264px]"; // 휴대폰에서는 받침대가 작아져 기둥도 좁힙니다

type InputProps = {
  value: string;
  onChange: (value: string) => void;
  prompt?: string; // 넓은 화면에서 명판 왼쪽에 붙는 안내
  srLabel?: string; // 화면 읽기 프로그램용 이름
};

export function NameplateInput({
  value,
  onChange,
  prompt = "여기에 닉네임을 새겨 주세요",
  srLabel = "닉네임 (친구에게 보낼 링크가 돼요)",
}: InputProps) {
  return (
    <div className="relative flex items-center">
      <p className="absolute right-full mr-4 hidden items-center gap-2 whitespace-nowrap rounded-full bg-night-900/80 px-3 py-1.5 text-sm font-medium text-ink shadow-[0_4px_12px_rgba(0,0,0,0.35)] lg:flex" aria-hidden="true">
        {/* 받침대 장식 위에서도 읽히도록 어두운 바탕을 깝니다 */}
        {prompt}
        <Icon name="arrow-right" size={18} />
      </p>
      <label className={`${COLUMN} flex h-[52px] items-center justify-center rounded-xl bg-glow px-5 shadow-[0_0_24px_rgba(242,196,109,0.45),0_6px_16px_rgba(0,0,0,0.35)] outline outline-2 outline-offset-2 outline-ink focus-within:outline-[3px]`}>
        <span className="sr-only">{srLabel}</span>
        <input
          form={FORM_ID}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={20}
          autoFocus
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="닉네임"
          className="min-w-[3.5em] max-w-[9em] shrink bg-transparent text-right text-lg font-bold text-night-900 caret-night-900 outline-none [field-sizing:content] placeholder:font-medium placeholder:text-night-700/55"
        />
        <span className="shrink-0 whitespace-nowrap text-lg font-medium text-night-700" aria-hidden="true">
          의 스노우볼
        </span>
      </label>
    </div>
  );
}

type FormProps = {
  password: string;
  onPassword: (value: string) => void;
  nickname: string;
  error: string;
  busy: boolean;
  onBack: () => void;
  onSubmit: () => void;
};

export default function NameplateForm({ password, onPassword, nickname, error, busy, onBack, onSubmit }: FormProps) {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();
  };
  const shown = nickname.trim() || "닉네임";

  return (
    <form id={FORM_ID} onSubmit={submit} noValidate className="pointer-events-auto flex w-full max-w-[480px] flex-col items-center gap-3">
      <label className={`${COLUMN} flex flex-col gap-2`}>
        <span className="text-sm font-medium text-ink">
          비밀번호 <span className="font-normal text-ink-sub">(4자 이상)</span>
        </span>
        <input
          type="password"
          value={password}
          onChange={(e) => onPassword(e.target.value)}
          maxLength={24}
          autoComplete="new-password"
          placeholder="4자 이상"
          className="glass h-12 w-full rounded-full px-5 text-base text-ink outline-none placeholder:text-ink-sub/70 focus:ring-2 focus:ring-ink"
        />
      </label>

      <p className="text-balance text-center text-[13px] leading-[1.6] text-ink-sub">
        닉네임이 그대로 링크가 돼요 · …/globe/{shown}
        <br />
        비밀번호는 잊으면 다시 찾을 수 없으니 꼭 기억해 주세요
      </p>

      <p role="alert" className="min-h-5 text-center text-sm text-danger">
        {error}
      </p>

      <div className="flex items-center gap-3">
        <Button variant="secondary" icon="arrow-left" onClick={onBack}>
          꾸미기로 돌아가기
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "만들고 있어요" : "스노우볼 완성하기"}
        </Button>
      </div>
    </form>
  );
}
