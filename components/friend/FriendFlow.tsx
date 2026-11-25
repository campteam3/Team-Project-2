"use client";

// 친구 흐름 (와이어프레임 10~13): 친구 스노우볼 → 오너먼트 고르기 → 메시지 쓰기 → 달리는 장면 · 완료
// 한 화면 안에서 단계만 바뀌므로 3D 는 한 번만 불러옵니다.
// DB 호출은 기존 OrnamentForm 과 같은 addOrnament 를 그대로 씁니다. 메시지 내용은 주인만 읽습니다.
//
// 개발용 미리보기: /globe/demo?preview=friend 이면 샘플 스노우볼에 저장 없이 달아 봅니다. (&full=1 이면 가득 찬 상태)
// 가득 참: 오너먼트가 MAX_ORNAMENTS(트리 자리 수 = DB 한도 39)개면 마음 달기 대신 "나도 스노우볼 만들기"를 권합니다.

import Link from "next/link";
import { useEffect, useState } from "react";
import Stage from "@/components/stage/Stage";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Dock } from "@/components/ui/Dock";
import { addOrnament, type Globe, type Ornament } from "@/lib/api";
import { MAX_ORNAMENTS, type OrnamentShape } from "@/lib/snowglobe";
import { ORNAMENT_OPTIONS, parseTheme } from "@/lib/theme";
import MessageCard from "./MessageCard";
import OrnamentPickDock from "./OrnamentPickDock";

type Step = "view" | "pick" | "write" | "done";

const PENDING = "pending"; // 고르는 중인 내 오너먼트(아직 저장 전)
const HINT = "드래그로 돌리고, 스크롤로 크게 볼 수 있어요";
const HINT_MOBILE = "폰을 흔들면 눈이 내리고, 두 손가락으로 크게 볼 수 있어요";

// 스노우볼 이름: 이름을 따로 정하지 않았으면(= 닉네임) "○○의 스노우볼"로 보여 줍니다
export function globeName(globe: Pick<Globe, "title" | "nickname">) {
  return globe.title.trim().toLowerCase() === globe.nickname ? `${globe.title}의 스노우볼` : globe.title;
}

export function PinLabel({ text }: { text: string }) {
  return (
    <span className="relative block animate-rise whitespace-nowrap rounded-full border border-glass-border bg-night-900/90 px-3 py-1.5 text-xs font-bold text-glow shadow-[0_6px_18px_rgba(0,0,0,0.45)]">
      {text}
      <span className="absolute left-1/2 top-full -mt-px size-0 -translate-x-1/2 border-x-[6px] border-t-[6px] border-x-transparent border-t-night-900/90" aria-hidden="true" />
    </span>
  );
}

type Props = {
  nickname: string;
  globe: Globe;
  preview?: boolean;
  onAdded: () => Promise<void>;
};

export default function FriendFlow({ nickname, globe, preview = false, onAdded }: Props) {
  const [step, setStep] = useState<Step>("view");
  const [colorId, setColorId] = useState(ORNAMENT_OPTIONS[0].id);
  const [shape, setShape] = useState<OrnamentShape>("ball");
  const [sender, setSender] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [mine, setMine] = useState<Ornament | null>(null); // 방금 단 내 오너먼트
  const [landed, setLanded] = useState(false); // 달리는 움직임이 끝났는지

  // 달리는 움직임(1.6초)이 끝난 뒤 "내 오너먼트" 말풍선을 보여 줍니다
  useEffect(() => {
    if (step !== "done") return;
    const id = setTimeout(() => setLanded(true), 1700);
    return () => clearTimeout(id);
  }, [step]);

  const theme = parseTheme(globe.theme);
  const name = globeName(globe);
  const color = ORNAMENT_OPTIONS.find((o) => o.id === colorId)!.color;
  const count = globe.ornaments.length + (mine && !globe.ornaments.some((o) => o.id === mine.id) ? 1 : 0);

  // 3D 에 그릴 오너먼트: 기존 + (고르는 중이면) 미리 보기 + (달았으면) 내 오너먼트
  const ornaments = [...globe.ornaments];
  if (mine && !ornaments.some((o) => o.id === mine.id)) ornaments.push(mine);
  if (step === "pick" || step === "write") ornaments.push({ id: PENDING, color, sender_name: "", shape, position: null, created_at: "" });

  const full = count >= MAX_ORNAMENTS; // 자리가 모두 찼음

  const plate = <span className="plate-text pointer-events-none text-[15px] font-bold text-night-900">{name}</span>;

  const submit = async () => {
    if (busy) return;
    if (!sender.trim()) return setError("보내는 사람 이름을 적어 주세요.");
    if (!message.trim()) return setError("메시지를 적어 주세요.");
    setError("");

    if (preview) {
      setMine({ id: `preview-${Date.now()}`, color, sender_name: sender, shape, position: null, created_at: "" });
    } else {
      setBusy(true);
      const result = await addOrnament(nickname, sender, message, color, shape); // 모양도 함께 저장 (#12 · PR #13)
      setBusy(false);
      if (!result.ok) {
        // 쓰는 사이에 다른 친구가 마지막 자리를 채웠으면, 오류 문구 대신 가득 찬 화면으로 돌아갑니다 (쓴 글은 지우지 않음)
        if (result.code === "globe_full") {
          setStep("view");
          await onAdded();
          return;
        }
        return setError(result.message);
      }
      setMine(result.data);
      void onAdded(); // 목록을 다시 불러옵니다 (메시지 내용은 오지 않음)
    }
    setMessage("");
    setLanded(false);
    setStep("done");
  };

  const common = { theme, ornaments, plate, hint: HINT, hintMobile: HINT_MOBILE };

  if (step === "view") {
    return (
      <Stage
        {...common}
        title={name}
        subtitle={
          full
            ? `오너먼트 ${count}개로 가득 찼어요`
            : count > 0
              ? `오너먼트 ${count}개가 달려 있어요`
              : "아직 오너먼트가 없어요. 첫 번째로 마음을 달아 주세요"
        }
        hint={full ? "자리가 모두 찼어요. 이제 마음은 더 달 수 없어요" : HINT}
        hintMobile={full ? "자리가 모두 찼어요. 이제 마음은 더 달 수 없어요" : HINT_MOBILE}
        highlightId={mine?.id}
        below={
          <Link
            href={`/login?nickname=${encodeURIComponent(nickname)}`}
            className="pointer-events-auto -my-1.5 inline-flex min-h-11 items-center px-3 text-[13px] text-ink-sub underline underline-offset-4 hover:text-ink"
          >
            이 스노우볼의 주인이에요
          </Link>
        }
      >
        <div key={step} className="flex w-full animate-rise justify-center">
          {full ? (
            <Dock label="다음 할 일">
              <ButtonLink href="/new">나도 스노우볼 만들기</ButtonLink>
            </Dock>
          ) : (
            <Dock label="마음 달기">
              <Button onClick={() => setStep("pick")}>{mine ? "하나 더 달기" : "마음 달기"}</Button>
            </Dock>
          )}
        </div>
      </Stage>
    );
  }

  if (step === "pick") {
    return (
      <Stage
        {...common}
        title="오너먼트를 골라 주세요"
        subtitle="1 / 2 단계"
        hint="고른 오너먼트가 트리에서 빛나고 있어요"
        hintMobile="고른 오너먼트가 트리에서 빛나고 있어요"
        highlightId={PENDING}
        focusId={PENDING}
        pinId={PENDING}
        pin={<PinLabel text="내 오너먼트" />}
      >
        <div key={step} className="flex w-full animate-rise justify-center">
          <OrnamentPickDock
            shape={shape}
            onShape={setShape}
            colorId={colorId}
            onPick={setColorId}
            onBack={() => setStep("view")}
            onNext={() => setStep("write")}
          />
        </div>
      </Stage>
    );
  }

  if (step === "write") {
    return (
      <Stage
        {...common}
        title="마음을 적어 주세요"
        plate={undefined} // 스노우볼이 작아지는 동안에는 명판 글자가 넘치지 않게 숨깁니다
        subtitle="2 / 2 단계 · 메시지는 스노우볼 주인만 읽을 수 있어요"
        hint={undefined}
        hintMobile={undefined}
        highlightId={PENDING}
        focusId={PENDING}
        layout={{ desktop: { centerFromTop: 0.3 }, mobile: { centerFromTop: 0.25 } }}
      >
        <div key={step} className="flex w-full animate-rise flex-col items-center gap-4">
          <MessageCard
            sender={sender}
            onSender={setSender}
            message={message}
            onMessage={setMessage}
            error={error}
            busy={busy}
            onSubmit={submit}
          />
          <Dock label="색 바꾸기">
            <Button variant="secondary" icon="arrow-left" onClick={() => setStep("pick")}>
              색 바꾸기
            </Button>
          </Dock>
        </div>
      </Stage>
    );
  }

  // 13 달리는 장면 · 완료
  return (
    <Stage
      {...common}
      title="오너먼트를 달았어요"
      subtitle={`${name} 주인이 열어 보면 메시지를 읽을 수 있어요`}
      hint={undefined}
      hintMobile={undefined}
      highlightId={mine?.id}
      arrivingId={mine?.id}
      focusId={mine?.id}
      pinId={landed ? mine?.id : undefined}
      pin={landed ? <PinLabel text="내 오너먼트" /> : undefined}
    >
      <div key={step} className="flex w-full animate-rise justify-center">
        <Dock label="다음 할 일">
          <ButtonLink href="/">나도 만들기</ButtonLink>
          <Button variant="secondary" onClick={() => setStep("view")}>
            더 구경하기
          </Button>
        </Dock>
      </div>
    </Stage>
  );
}
