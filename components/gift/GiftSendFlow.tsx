"use client";

// 기념 메시지 보내기 (FEEDBACK F1, 차명근): 고르기 → 쓰기 → 링크
// 받는 사람 이름은 받지 않습니다. 링크를 연 사람은 누구나 열어 읽고, 각자 자기 스노우볼에 달 수 있습니다.
// 설계: docs/superpowers/specs/2026-11-27-gift-message-design.md

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";
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

// 보낸 뒤의 "내 스노우볼도 만들기": 유리 면 보조 버튼을 작게 (빨간 주 버튼은 링크 복사 하나)
const pillClass =
  "pointer-events-auto inline-flex h-11 animate-fade items-center rounded-full border border-glass-border bg-glass px-5 text-[14px] font-semibold text-ink transition duration-200 ease-soft hover:bg-glass-strong active:scale-[0.97]";

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
  const [shared, setShared] = useState(false); // 링크 복사 · 카카오톡 보내기를 눌렀는지
  const [notice, say] = useNotice();
  const color = ORNAMENT_OPTIONS.find((o) => o.id === colorId)!.color;

  // 다 보낸 뒤 이 화면을 떠났다가 다시 오면 처음 단계부터 시작합니다.
  // Next.js 는 떠난 화면을 숨겨 두었다가 그대로 다시 보여 주기 때문입니다 (문서: Preserving UI state > Resetting stale status messages)
  const sent = useRef(false);
  useLayoutEffect(() => {
    return () => {
      if (!sent.current) return;
      sent.current = false;
      setStep("pick");
      setMessage("");
      setGiftId("");
      setError("");
      setShared(false);
    };
  }, []);

  // 다른 친구에게 하나 더: 보내는 사람 이름은 그대로 두고 처음 단계로
  const sendAnother = () => {
    sent.current = false;
    setMessage("");
    setGiftId("");
    setError("");
    setShared(false);
    setStep("pick");
  };

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
    sent.current = true;
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
      title="마음을 오너먼트에 담았어요"
      subtitle={"링크를 보내면 받은 사람이 열어 보고\n자기 스노우볼에 달 수 있어요"}
      notice={notice}
      below={
        <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-x-2">
          <button type="button" onClick={sendAnother} className={linkClass}>
            하나 더 보내기
          </button>
          {/* 링크를 보내기 전에는 글자 링크로 두고, 보낸 뒤에만 버튼 모양으로 강조합니다 (김미영) */}
          <Link href="/new" className={shared ? pillClass : linkClass}>
            내 스노우볼도 만들기
          </Link>
        </div>
      }
    >
      <div key={step} className="flex w-full animate-rise justify-center">
        <ShareDock url={url} title={`${sentBy}님이 기념 메시지를 보냈어요`} onNotice={say} share={SHARE_TEXT} onShared={() => setShared(true)} />
      </div>
    </Stage>
  );
}
