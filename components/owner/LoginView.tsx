"use client";

// 08 내 스노우볼로 들어가기 (/login)
// 다른 화면과 같은 무대(Stage)를 씁니다.
//  - 닉네임을 아는 경우(/login?nickname=…, 친구 화면의 "이 스노우볼의 주인이에요"에서 옴):
//    그 스노우볼을 실제 모습(꾸미기 · 오너먼트)으로 보여 주고 비밀번호만 받습니다.
//  - 모르는 경우: 03 처럼 받침대 명판이 곧 닉네임 입력칸입니다.
// DB 호출(openGlobe · openFailureMessage · saveOwnerToken)은 기존 EntryForm 과 같은 방식을 그대로 씁니다.

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import Stage from "@/components/stage/Stage";
import { Button, ButtonLink } from "@/components/ui/Button";
import { getGlobe, openFailureMessage, openGlobe, type Globe } from "@/lib/api";
import { globePath, saveOwnerToken } from "@/lib/owner-token";
import { DEFAULT_THEME, parseTheme } from "@/lib/theme";
import { globeName } from "@/components/friend/FriendFlow";
import { FORM_ID, NameplateInput } from "./NameplateForm";

const COLUMN = "w-[232px] max-w-full sm:w-[264px]"; // 03 과 같은 기둥 너비

const linkClass =
  "pointer-events-auto -my-1.5 inline-flex min-h-11 items-center px-3 text-[13px] text-ink-sub underline underline-offset-4 hover:text-ink";

export default function LoginView() {
  const router = useRouter();
  const known = (useSearchParams().get("nickname") ?? "").trim();
  const [globe, setGlobe] = useState<Globe | null>(null);
  const [missing, setMissing] = useState(false); // 주소의 닉네임으로 스노우볼을 찾지 못함
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // 닉네임을 알면 그 스노우볼을 불러와 실제 모습으로 보여 줍니다 (메시지 내용은 오지 않음)
  useEffect(() => {
    if (!known) return;
    let alive = true;
    getGlobe(known).then((result) => {
      if (!alive) return;
      if (result.ok && result.data) setGlobe(result.data);
      else {
        setMissing(true);
        setNickname(known);
      }
    });
    return () => {
      alive = false;
    };
  }, [known]);

  const askName = !known || missing; // 명판에 닉네임을 직접 적는 경우
  const name = askName ? nickname.trim() : known;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (!name) return setError("받침대 명판에 닉네임을 적어 주세요.");
    if (password.length < 4) return setError("비밀번호는 4자 이상으로 적어 주세요.");

    setBusy(true);
    setError("");
    const result = await openGlobe(name, password);
    if (!result.ok) {
      setBusy(false);
      return setError(result.message);
    }
    if (!result.data.ok) {
      setBusy(false);
      setPassword("");
      return setError(openFailureMessage(result.data));
    }
    saveOwnerToken(name, result.data.owner_token);
    router.push(globePath(name));
  };

  const title = askName ? "내 스노우볼로 들어가기" : globe ? globeName(globe) : known;
  const subtitle = missing
    ? "이 닉네임의 스노우볼을 찾지 못했어요. 닉네임을 다시 적어 주세요"
    : askName
      ? "만들 때 정한 닉네임과 비밀번호를 적어 주세요"
      : "만들 때 정한 비밀번호를 적어 주세요";

  return (
    <Stage
      theme={globe && !askName ? parseTheme(globe.theme) : DEFAULT_THEME}
      ornaments={askName ? undefined : globe?.ornaments}
      title={title}
      subtitle={subtitle}
      hintMobile={askName ? "받침대 명판에 닉네임을 적어 주세요" : undefined}
      plate={
        askName ? (
          <NameplateInput value={nickname} onChange={setNickname} prompt="여기에 닉네임을 적어 주세요" srLabel="닉네임" />
        ) : (
          <span className="plate-text pointer-events-none text-[15px] font-bold text-night-900">{globe ? globeName(globe) : `${known}의 스노우볼`}</span>
        )
      }
      lockFront
      layout={askName ? { desktop: { centerFromTop: 0.4 }, mobile: { centerFromTop: 0.4 } } : undefined}
      below={
        askName ? (
          <Link href="/new" className={linkClass}>
            아직 스노우볼이 없어요
          </Link>
        ) : (
          <Link href="/login" className={linkClass}>
            다른 닉네임으로 들어가기
          </Link>
        )
      }
    >
      <form
        key={askName ? "ask" : "known"}
        id={FORM_ID}
        onSubmit={submit}
        noValidate
        className="pointer-events-auto flex w-full max-w-[480px] animate-rise flex-col items-center gap-3"
      >
        <label className={`${COLUMN} flex flex-col gap-2`}>
          {/* 받침대 위에 겹치는 자리라 글자 이름표 대신 칸 안 안내로 보여 줍니다 */}
          <span className="sr-only">비밀번호</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            maxLength={24}
            autoFocus={!askName}
            autoComplete="current-password"
            placeholder="비밀번호 (4자 이상)"
            className="glass h-12 w-full rounded-full px-5 text-base text-ink outline-none placeholder:text-ink-sub/70 focus:ring-2 focus:ring-ink"
          />
        </label>

        <p role="alert" className="min-h-5 text-center text-sm text-danger">
          {error}
        </p>

        <div className="flex items-center gap-3">
          <ButtonLink variant="secondary" icon="arrow-left" href={known && !missing ? globePath(known) : "/"}>
            돌아가기
          </ButtonLink>
          <Button type="submit" disabled={busy}>
            {busy ? "확인하고 있어요" : "들어가기"}
          </Button>
        </div>
      </form>
    </Stage>
  );
}
