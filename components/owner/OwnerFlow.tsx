"use client";

// /new 주인 흐름 (시안 C): 02 꾸미기 → 03 정보 입력 → 04 완성 · 공유
// 한 페이지 안에서 단계만 바뀌므로 3D 장면은 한 번만 불러옵니다.
// DB 호출(createGlobe · saveOwnerToken)은 기존 EntryForm 과 같은 방식을 그대로 씁니다.
//
// 개발용 미리보기: /new?preview=1 이면 DB 에 저장하지 않고 04 까지 넘어갑니다.
// (.env.local 에 DB 키가 없는 PC 에서 화면을 확인할 때 씁니다)

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import Stage from "@/components/stage/Stage";
import { Icon } from "@/components/ui/Icons";
import { NICKNAME_RULE, createGlobe } from "@/lib/api";
import { globePath, saveOwnerToken } from "@/lib/owner-token";
import { DEFAULT_THEME, type GlobeTheme, type ThemePart } from "@/lib/theme";
import CustomizeDock from "./CustomizeDock";
import NameplateForm, { NameplateInput } from "./NameplateForm";
import ShareDock, { ShareLinkText } from "./ShareDock";

type Step = "customize" | "info" | "share";

const NICKNAME_PATTERN = /^[0-9A-Za-z가-힣_-]{2,20}$/;

function plateLabel(text: string) {
  return <span className="plate-text pointer-events-none text-[15px] font-bold text-night-900">{text}</span>;
}

export default function OwnerFlow() {
  const preview = useSearchParams().get("preview") === "1";
  const [step, setStep] = useState<Step>("customize");
  const [theme, setTheme] = useState<GlobeTheme>(DEFAULT_THEME);
  const [part, setPart] = useState<ThemePart>("tree");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState("");

  const submit = async () => {
    if (busy) return;
    const name = nickname.trim();
    if (!name) return setError("받침대 명판에 닉네임을 적어 주세요.");
    if (!NICKNAME_PATTERN.test(name)) return setError(`닉네임은 ${NICKNAME_RULE}로 정해 주세요.`);
    if (password.length < 4) return setError("비밀번호는 4자 이상으로 적어 주세요.");

    setError("");
    if (preview) {
      setCreated(name.toLowerCase());
      return setStep("share");
    }

    setBusy(true);
    // 꾸민 값(트리 · 소품 · 받침대 · 눈)을 함께 저장합니다 (#10, PR #13). 이름은 비워서 닉네임이 이름이 됩니다.
    const result = await createGlobe(name, password, undefined, theme);
    setBusy(false);
    if (!result.ok) return setError(result.message);
    saveOwnerToken(result.data.nickname, result.data.owner_token);
    setPassword("");
    setCreated(result.data.nickname);
    setStep("share");
  };

  if (step === "customize") {
    return (
      <Stage
        theme={theme}
        title="스노우볼을 꾸며 주세요"
        subtitle="1 / 2 단계"
        hint="고르는 대로 바로 바뀌어요. 드래그해서 돌려 보세요"
        hintMobile="고르는 대로 바로 바뀌어요"
        plate={plateLabel("내 스노우볼")}
      >
        <div key={step} className="flex w-full animate-rise justify-center">
          <CustomizeDock
            theme={theme}
            part={part}
            onPart={setPart}
            onPick={(p, id) => setTheme((t) => ({ ...t, [p]: id }))}
            onNext={() => setStep("info")}
          />
        </div>
      </Stage>
    );
  }

  if (step === "info") {
    return (
      <Stage
        theme={theme}
        title="마지막으로 알려 주세요"
        subtitle="2 / 2 단계"
        hintMobile="받침대 명판에 닉네임을 새겨 주세요"
        plate={<NameplateInput value={nickname} onChange={setNickname} />}
        lockFront
        layout={{ desktop: { centerFromTop: 0.4 }, mobile: { centerFromTop: 0.4 } }}
      >
        <div key={step} className="flex w-full animate-rise justify-center">
          <NameplateForm
            password={password}
            onPassword={setPassword}
            nickname={nickname}
            error={error}
            busy={busy}
            onBack={() => {
              setError("");
              setStep("customize");
            }}
            onSubmit={submit}
          />
        </div>
      </Stage>
    );
  }

  const url = `${window.location.origin}${globePath(created)}`;
  return (
    <Stage
      theme={theme}
      title="스노우볼이 완성됐어요"
      subtitle="링크를 보내면 친구들이 오너먼트에 마음을 담아 달아 줘요"
      plate={plateLabel(`${created}의 스노우볼`)}
      below={
        <Link
          href={globePath(created)}
          className="pointer-events-auto -my-1.5 inline-flex min-h-11 items-center gap-1.5 px-3 text-[15px] font-medium text-ink-sub hover:text-ink"
        >
          내 스노우볼 보기
          <Icon name="arrow-right" size={16} />
        </Link>
      }
    >
      <div key={step} className="flex w-full animate-rise flex-col items-center gap-3">
        <p className="flex max-w-full items-center gap-2 text-sm text-ink-sub sm:hidden">
          <Icon name="link" size={16} className="shrink-0" />
          <ShareLinkText url={url} />
        </p>
        <ShareDock url={url} title={`${created}의 스노우볼`} />
      </div>
    </Stage>
  );
}
