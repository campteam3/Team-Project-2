"use client";

// 친구 흐름 두 번째 버전 (?flow=2): 오너먼트에 집중하는 흐름
//   10  친구 스노우볼 (첫 번째 버전과 같음)
//   11′ 오너먼트 고르기: 스노우볼은 아래로 내려가고, 커다란 오너먼트 6개만 떠 있습니다
//   12′ 메시지 쓰기: 고른 오너먼트가 작아지며 위로 올라가고, 아래에서 메시지 카드가 올라옵니다
//   13′ 달기: "달기"를 누르면 저장하고, 아래에서 스노우볼이 올라와 오너먼트가 트리의 제자리에 달립니다
//   완료: 첫 번째 버전과 같은 "나도 만들기 / 더 구경하기"
// 첫 번째 버전(FriendFlow)과 A/B 로 비교합니다 (디자인 지표: 과업 성공률 · 소요 시간).

import Link from "next/link";
import { useState } from "react";
import Stage from "@/components/stage/Stage";
import type { ShowcaseState } from "@/components/stage/OrnamentShowcase";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Dock } from "@/components/ui/Dock";
import { addOrnament, type Globe, type Ornament } from "@/lib/api";
import { ORNAMENT_OPTIONS, parseTheme } from "@/lib/theme";
import { PinLabel, globeName } from "./FriendFlow";
import MessageCard from "./MessageCard";
import OrnamentPickDock from "./OrnamentPickDock";

type Step = "view" | "pick" | "write" | "attach" | "done";

const HINT = "드래그로 돌리고, 흔들면 눈이 내려요";
const HINT_MOBILE = "폰을 흔들거나 드래그해서 눈을 내려보세요";
// 오너먼트를 고르고 쓰는 동안 스노우볼은 화면 아래로 내려가 있습니다
const GLOBE_BELOW = { desktop: { centerFromTop: 1.55 }, mobile: { centerFromTop: 1.55 } };

type Props = {
  nickname: string;
  globe: Globe;
  preview?: boolean;
  onAdded: () => Promise<void>;
};

export default function FriendFlowFocus({ nickname, globe, preview = false, onAdded }: Props) {
  const [step, setStep] = useState<Step>("view");
  const [colorId, setColorId] = useState(ORNAMENT_OPTIONS[0].id);
  const [sender, setSender] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [mine, setMine] = useState<Ornament | null>(null);

  const theme = parseTheme(globe.theme);
  const name = globeName(globe);
  const color = ORNAMENT_OPTIONS.find((o) => o.id === colorId)!.color;

  // 날아가는 동안에는 내 오너먼트를 트리에 그리지 않습니다 (진열장의 오너먼트가 그 자리로 날아갑니다)
  const base = mine ? globe.ornaments.filter((o) => o.id !== mine.id) : globe.ornaments;
  const ornaments = step === "attach" || !mine ? base : [...base, mine];
  const count = base.length + (mine ? 1 : 0);

  const plate = <span className="pointer-events-none whitespace-nowrap text-[15px] font-bold text-night-900">{name}</span>;

  const showcase = (mode: ShowcaseState["mode"]): ShowcaseState => ({
    mode,
    options: ORNAMENT_OPTIONS,
    selectedId: colorId,
    targetIndex: base.length,
    onPick: setColorId,
    onAttached: () => {
      setStep("done");
      if (!preview) void onAdded(); // 다 달린 뒤에 목록을 다시 불러옵니다
    },
  });

  const submit = async () => {
    if (busy) return;
    if (!sender.trim()) return setError("보내는 사람 이름을 적어 주세요.");
    if (!message.trim()) return setError("메시지를 적어 주세요.");
    setError("");

    if (preview) {
      setMine({ id: `preview-${Date.now()}`, color, sender_name: sender, shape: "ball", position: null, created_at: "" });
    } else {
      setBusy(true);
      const result = await addOrnament(nickname, sender, message, color);
      setBusy(false);
      if (!result.ok) return setError(result.message); // 저장에 실패하면 달리는 장면 없이 카드에 안내합니다
      setMine(result.data);
    }
    setMessage("");
    setStep("attach");
  };

  if (step === "view" || step === "done") {
    const done = step === "done";
    return (
      <Stage
        theme={theme}
        ornaments={ornaments}
        plate={plate}
        hint={done ? undefined : HINT}
        hintMobile={done ? undefined : HINT_MOBILE}
        title={done ? "오너먼트를 달았어요" : name}
        subtitle={
          done
            ? `${name} 주인이 열어 보면 메시지를 읽을 수 있어요`
            : count > 0
              ? `오너먼트 ${count}개가 달려 있어요`
              : "아직 오너먼트가 없어요. 첫 번째로 마음을 달아 주세요"
        }
        highlightId={mine?.id}
        focusId={done ? mine?.id : undefined}
        pinId={done ? mine?.id : undefined}
        pin={done && mine ? <PinLabel text="내 오너먼트" /> : undefined}
        below={
          done ? undefined : (
            <Link
              href={`/login?nickname=${encodeURIComponent(nickname)}`}
              className="pointer-events-auto px-2 py-1 text-[13px] text-ink-sub underline underline-offset-4 hover:text-ink"
            >
              이 스노우볼의 주인이에요
            </Link>
          )
        }
      >
        <div key={step} className="flex w-full animate-rise justify-center">
          {done ? (
            <Dock label="다음 할 일">
              <ButtonLink href="/">나도 만들기</ButtonLink>
              <Button variant="secondary" onClick={() => setStep("view")}>
                더 구경하기
              </Button>
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
        theme={theme}
        ornaments={ornaments}
        title="오너먼트를 골라 주세요"
        subtitle="1 / 2 단계"
        hint="오너먼트를 눌러 골라 주세요"
        hintMobile="오너먼트를 눌러 골라 주세요"
        layout={GLOBE_BELOW}
        showcase={showcase("pick")}
      >
        <div key={step} className="flex w-full animate-rise justify-center">
          <OrnamentPickDock colorId={colorId} onPick={setColorId} onBack={() => setStep("view")} onNext={() => setStep("write")} />
        </div>
      </Stage>
    );
  }

  if (step === "write") {
    return (
      <Stage
        theme={theme}
        ornaments={ornaments}
        title="마음을 적어 주세요"
        subtitle="2 / 2 단계 · 메시지는 스노우볼 주인만 읽을 수 있어요"
        layout={GLOBE_BELOW}
        showcase={showcase("write")}
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
          <Dock label="오너먼트 바꾸기">
            <Button variant="secondary" icon="arrow-left" onClick={() => setStep("pick")}>
              오너먼트 바꾸기
            </Button>
          </Dock>
        </div>
      </Stage>
    );
  }

  // 13′ 달리는 장면: 스노우볼이 올라오고 오너먼트가 날아가 달립니다 (끝나면 onAttached → done)
  return (
    <Stage theme={theme} ornaments={ornaments} plate={plate} title="오너먼트를 달고 있어요" subtitle={name} showcase={showcase("attach")} />
  );
}
