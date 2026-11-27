"use client";

// 기념 메시지 보내기 (FEEDBACK F1, 차명근): 고르기 → 쓰기 → 링크
// 받는 사람 이름은 받지 않습니다. 링크를 연 사람은 누구나 열어 읽고, 각자 자기 스노우볼에 달 수 있습니다.
// 설계: docs/superpowers/specs/2026-11-27-gift-message-design.md

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import MessageCard from "@/components/friend/MessageCard";
import OrnamentPickDock from "@/components/friend/OrnamentPickDock";
import ShareDock from "@/components/owner/ShareDock";
import GiftOrnamentScene from "@/components/gift/GiftOrnamentScene";
import Stage from "@/components/stage/Stage";
import { useNotice } from "@/components/stage/useNotice";
import { createGift } from "@/lib/api";
import type { OrnamentShape } from "@/lib/snowglobe";
import { DEFAULT_THEME, ORNAMENT_OPTIONS } from "@/lib/theme";

type Step = "pick" | "write" | "done";

const SHARE_TEXT = {
  description: "눌러서 오너먼트를 열어 보세요.",
  button: "메시지 열어 보기",
  text: "기념 메시지를 보냈어요. 눌러서 열어 봐!",
};

const linkClass =
  "pointer-events-auto -my-1.5 inline-flex min-h-11 items-center px-3 text-[13px] text-ink-sub underline underline-offset-4 hover:text-ink";

export default function GiftSendFlow() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("pick");
  const [shape, setShape] = useState<OrnamentShape>("ball");
  const [colorId, setColorId] = useState(ORNAMENT_OPTIONS[0].id);
  const [sender, setSender] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [giftId, setGiftId] = useState("");
  const [sentBy, setSentBy] = useState("");
  const [notice, say] = useNotice();
  const color = ORNAMENT_OPTIONS.find((o) => o.id === colorId)!.color;

  const scene = <GiftOrnamentScene shape={shape} color={color} />;

  const submit = async () => {
    if (busy) return;
    if (!sender.trim()) return setError("보내는 사람 이름을 적어 주세요.");
    if (!message.trim()) return setError("메시지를 적어 주세요.");
    setError("");
    setBusy(true);
    const result = await createGift(sender, message, color, shape);
    setBusy(false);
    if (!result.ok) return setError(result.message);
    setGiftId(result.data.id);
    setSentBy(sender.trim());
    setStep("done");
  };

  if (step === "pick") {
    return (
      <Stage theme={DEFAULT_THEME} scene={scene} title="어떤 오너먼트로 보낼까요?" subtitle="1 / 2 단계" hint="고르는 대로 바로 바뀌어요" hintMobile="고르는 대로 바로 바뀌어요">
        <div key={step} className="flex w-full animate-rise justify-center">
          <OrnamentPickDock
            shape={shape}
            onShape={setShape}
            colorId={colorId}
            onPick={setColorId}
            onBack={() => router.push("/")}
            onNext={() => setStep("write")}
          />
        </div>
      </Stage>
    );
  }

  if (step === "write") {
    return (
      <Stage theme={DEFAULT_THEME} scene={scene} title="마음을 적어 주세요" subtitle="2 / 2 단계 · 링크를 받은 사람이 열어 볼 수 있어요" holdGlobe>
        <div key={step} className="flex min-h-0 w-full animate-rise justify-center">
          <MessageCard
            sender={sender}
            onSender={setSender}
            message={message}
            onMessage={setMessage}
            error={error}
            busy={busy}
            onBack={() => setStep("pick")}
            onSubmit={submit}
            submitLabel="보내기"
            busyLabel="만들고 있어요"
          />
        </div>
      </Stage>
    );
  }

  const url = `${window.location.origin}/gift/${giftId}`;
  return (
    <Stage
      theme={DEFAULT_THEME}
      scene={scene}
      title="기념 메시지를 만들었어요"
      subtitle="링크를 보내면 받은 사람이 열어 보고 자기 스노우볼에 달 수 있어요"
      notice={notice}
      below={
        <Link href="/new" className={linkClass}>
          내 스노우볼도 만들기
        </Link>
      }
    >
      <div key={step} className="flex w-full animate-rise justify-center">
        <ShareDock url={url} title={`${sentBy}님이 기념 메시지를 보냈어요`} onNotice={say} share={SHARE_TEXT} />
      </div>
    </Stage>
  );
}
