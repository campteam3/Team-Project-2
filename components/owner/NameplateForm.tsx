"use client";

// 03 정보 입력 (시안 C = 시안 B 의 03: 받침대 명판이 곧 닉네임 입력칸)
//  - NameplateInput: 3D 받침대 명판 위치에 붙는 닉네임 입력칸 (Stage 의 plate 로 넘깁니다)
//  - NameplateForm: 받침대 아래 비밀번호 · 안내 · 버튼
// 두 부분은 화면에서 떨어져 있지만 form 속성("owner-form")으로 하나의 폼입니다.
// 키보드가 올라오면(kb:) 이름표 · 안내 글을 숨겨, 명판 · 비밀번호 · 버튼이 보이는 영역 안에 들어오게 합니다.

import type { FormEvent } from "react";
import { Button } from "@/components/ui/Button";

export const FORM_ID = "owner-form";

// 03 은 가운데 한 줄 기둥으로 정렬합니다. 명판과 비밀번호 칸은 같은 너비를 씁니다.
const COLUMN = "w-[232px] max-w-full sm:w-[264px]"; // 휴대폰에서는 받침대가 작아져 기둥도 좁힙니다
// 명판은 기둥 너비에서 시작해, 닉네임이 길어지면 화면 너비 안에서 넓어집니다 (FEEDBACK A5: 글자가 잘리지 않게)
const PLATE = "min-w-[232px] max-w-[calc(100vw-2rem)] sm:min-w-[264px]";
const PLACEHOLDER = "닉네임 입력";

type InputProps = {
  value: string;
  onChange: (value: string) => void;
  prompt?: string; // 명판 위 말풍선 안내 (닉네임을 적기 전까지만 보입니다)
  srLabel?: string; // 화면 읽기 프로그램용 이름
};

// 명판이 입력칸이라는 것을 알아챌 수 있게 (FEEDBACK B2):
//  - 닉네임 자리는 명판 안의 밝은 칸 + 점선 밑줄로 "적는 곳"임을 보여 줍니다
//  - 비어 있는 동안에는 명판 위에 말풍선 안내가 뜹니다 (화면 크기와 상관없이)
export function NameplateInput({
  value,
  onChange,
  prompt = "여기에 닉네임을 새겨 주세요",
  srLabel = "닉네임 (친구에게 보낼 링크가 돼요)",
}: InputProps) {
  // 닉네임이 길어지면 글자를 줄여 명판 안에 다 보이게 합니다 (최대 20자)
  const size = value.length > 14 ? "text-[13px]" : value.length > 8 ? "text-[15px]" : "text-lg";

  return (
    <div className="relative flex flex-col items-center">
      {!value && (
        <p
          className="pointer-events-none absolute bottom-full mb-3 animate-rise whitespace-nowrap rounded-full border border-glass-border bg-night-900/90 px-3.5 py-1.5 text-sm font-bold text-glow shadow-[0_6px_18px_rgba(0,0,0,0.45)]"
          aria-hidden="true"
        >
          {prompt}
          <span className="absolute left-1/2 top-full -mt-px size-0 -translate-x-1/2 border-x-[7px] border-t-[7px] border-x-transparent border-t-night-900/90" />
        </p>
      )}
      <label
        className={`${PLATE} ${size} flex h-[52px] cursor-text items-center justify-center gap-1.5 rounded-xl bg-glow px-3.5 shadow-[0_0_24px_rgba(242,196,109,0.45),0_6px_16px_rgba(0,0,0,0.35)] outline outline-2 outline-offset-2 outline-ink focus-within:outline-[3px]`}
      >
        <span className="sr-only">{srLabel}</span>
        {/* 닉네임 칸: 안 보이는 글자(같은 내용)가 너비를 정하고, 입력칸이 그 너비를 그대로 씁니다. 그래서 적은 만큼만 넓어지고 잘리지 않습니다 */}
        <span className="inline-grid min-w-0 grid-cols-[minmax(0,1fr)] items-center overflow-hidden rounded-lg border-b-2 border-dashed border-night-900/50 bg-white/45 px-2.5 py-1 transition-colors duration-200 focus-within:border-solid focus-within:border-night-900 focus-within:bg-white/70">
          <span className="invisible col-start-1 row-start-1 whitespace-pre font-bold" aria-hidden="true">
            {value || PLACEHOLDER}
          </span>
          <input
            form={FORM_ID}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            maxLength={20}
            size={1}
            autoFocus
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder={PLACEHOLDER}
            className="col-start-1 row-start-1 w-full min-w-0 bg-transparent font-bold text-night-900 caret-night-900 outline-none placeholder:font-medium placeholder:text-night-700/70"
          />
        </span>
        <span className="shrink-0 whitespace-nowrap font-medium text-night-700" aria-hidden="true">
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
        {/* 넓은 화면에서는 이 자리가 받침대 위라 글자가 묻혀서, 이름표는 휴대폰에서만 보이고 칸 안 안내로 대신합니다 */}
        <span className="text-sm font-medium text-ink kb:sr-only sm:sr-only">
          비밀번호 <span className="font-normal text-ink-sub">(4자 이상)</span>
        </span>
        <input
          type="password"
          value={password}
          onChange={(e) => onPassword(e.target.value)}
          maxLength={24}
          autoComplete="new-password"
          placeholder="비밀번호 (4자 이상)"
          // 받침대 위에 겹쳐도 잘 보이도록 진한 바탕 + 밝은 테두리 (08 로그인과 같은 모양)
          className="h-12 w-full rounded-full border border-ink/45 bg-night-900/85 px-5 text-base text-ink shadow-[0_6px_20px_rgba(0,0,0,0.45)] outline-none backdrop-blur-md placeholder:text-ink-sub focus:border-ink focus:ring-2 focus:ring-ink"
        />
      </label>

      <p className="text-balance text-center text-[13px] leading-[1.6] text-ink-sub kb:hidden">
        닉네임이 그대로 링크가 돼요 · …/globe/{shown}
        <br />
        비밀번호는 잊으면 다시 찾을 수 없으니 꼭 기억해 주세요
      </p>

      <p role="alert" className="min-h-5 text-center text-sm text-danger kb:min-h-0">
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
