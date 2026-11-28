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
import { useNotice } from "@/components/stage/useNotice";
import { Icon } from "@/components/ui/Icons";
import { NICKNAME_RULE, addGiftToGlobe, createGlobe, getGlobe, type Ornament } from "@/lib/api";
import { giftParam } from "@/lib/gift-link";
import { globePath, loadOwnerToken, saveOwnerToken } from "@/lib/owner-token";
import { defaultTheme, themeParts, toKind, type GlobeTheme, type ThemePart } from "@/lib/theme";
import CustomizeDock from "./CustomizeDock";
import NameplateForm, { NameplateInput } from "./NameplateForm";
import ShareDock from "./ShareDock";

type Step = "customize" | "info" | "share";

const NICKNAME_PATTERN = /^[0-9A-Za-z가-힣_-]{2,20}$/;

export default function OwnerFlow() {
  const search = useSearchParams();
  const preview = search.get("preview") === "1";
  // 받은 기념 메시지에서 왔으면(/new?gift=<번호>) 다 만든 뒤 그 오너먼트를 답니다 (FEEDBACK F1, 차명근)
  const gift = giftParam(search);
  const [giftOrnaments, setGiftOrnaments] = useState<Ornament[] | undefined>(undefined);
  const [giftFailed, setGiftFailed] = useState(false); // 만든 뒤 받은 오너먼트를 달지 못함 → 다시 달기 버튼
  const [step, setStep] = useState<Step>("customize");
  // 홈 화면에서 고른 스노우볼 주제 (/new?kind=newyear). 없으면 크리스마스입니다 (차명근)
  const kind = toKind(search.get("kind"));
  const [theme, setTheme] = useState<GlobeTheme>(() => defaultTheme(kind));
  const [part, setPart] = useState<ThemePart>(() => themeParts(kind)[0].key);
  // 홈에서 다른 주제를 고르고 다시 오면 그 주제로 처음부터 시작합니다.
  // Next.js 는 떠난 화면을 숨겨 두었다가 그대로 다시 보여 주므로, 처음 열 때 정한 주제(예: 생일)가 남아 있었습니다 (차명근)
  const [startedKind, setStartedKind] = useState(kind);
  if (kind !== startedKind) {
    setStartedKind(kind);
    setTheme(defaultTheme(kind));
    setPart(themeParts(kind)[0].key);
    setStep("customize");
  }
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState("");
  const [notice, say] = useNotice();

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
    if (!result.ok) {
      setBusy(false);
      return setError(result.message);
    }
    saveOwnerToken(result.data.nickname, result.data.owner_token);
    setPassword("");
    // 받은 오너먼트를 먼저 달고 완성 화면으로 갑니다. 스노우볼은 이미 만들어졌으므로 달지 못해도 완성 화면으로 가고, 다시 달기 버튼을 남깁니다
    if (gift) await attachGift(result.data.nickname, result.data.owner_token);
    setBusy(false);
    setCreated(result.data.nickname);
    setStep("share");
  };

  const attachGift = async (name: string, token: string) => {
    if (!gift) return;
    const added = await addGiftToGlobe(gift, name, token);
    if (!added.ok) {
      setGiftFailed(true);
      return say(added.message);
    }
    setGiftFailed(false);
    const globe = await getGlobe(name);
    if (globe.ok && globe.data) setGiftOrnaments(globe.data.ornaments);
    say(added.data.already ? "이미 달려 있어요" : "받은 오너먼트를 달았어요");
  };

  const retryGift = async () => {
    const token = loadOwnerToken(created);
    if (!token || busy) return;
    setBusy(true);
    await attachGift(created, token);
    setBusy(false);
  };

  if (step === "customize") {
    return (
      <Stage
        theme={theme}
        title="스노우볼을 꾸며 주세요"
        subtitle={gift ? "1 / 2 단계 · 다 만들면 받은 오너먼트가 달려요" : "1 / 2 단계"}
        hint="고르는 대로 바로 바뀌어요. 드래그로 돌리고, 스크롤로 크게 볼 수 있어요"
        hintMobile="고르는 대로 바로 바뀌어요"
        plateText="내 스노우볼"
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
        onBack={() => setStep("customize")}
        title="마지막으로 알려 주세요"
        subtitle="2 / 2 단계"
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
      ornaments={giftOrnaments}
      subtitle="링크를 보내면 친구들이 오너먼트에 마음을 담아 달아 줘요"
      notice={notice}
      saveAs={`${created}의 스노우볼`}
      onNotice={say}
      plateText={`${created}의 스노우볼`}
      below={
        <div className="contents">
          {giftFailed && (
            <button
              type="button"
              onClick={retryGift}
              disabled={busy}
              className="pointer-events-auto -my-1.5 inline-flex min-h-11 items-center px-3 text-[15px] font-medium text-glow underline underline-offset-4 disabled:opacity-50"
            >
              받은 오너먼트 다시 달기
            </button>
          )}
        <Link
          href={globePath(created)}
          className="pointer-events-auto -my-1.5 inline-flex min-h-11 items-center gap-1.5 px-3 text-[15px] font-medium text-ink-sub hover:text-ink"
        >
          내 스노우볼 보기
          <Icon name="arrow-right" size={16} />
        </Link>
        </div>
      }
    >
      {/* 휴대폰에서는 링크 주소를 따로 보여 주지 않습니다. 복사 · 카카오톡 버튼이면 충분합니다 (FEEDBACK C5). 넓은 화면은 도크 안에 주소가 보입니다 */}
      <div key={step} className="flex w-full animate-rise flex-col items-center gap-3">
        <ShareDock url={url} title={`${created}의 스노우볼`} onNotice={say} />
      </div>
    </Stage>
  );
}
