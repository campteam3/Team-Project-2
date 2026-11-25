"use client";

// 01 오프닝 (시안 C = 시안 A 의 01)
// 처음 온 사람이 "이게 뭔지"를 알고 바로 시작합니다.
// 오너먼트가 달린 예시 스노우볼에서, 앞쪽 오너먼트 하나가 몇 초마다 메시지 말풍선을 보여 줍니다.
// "오너먼트 하나 = 친구 메시지 하나"를 설명 대신 보여 주는 장치입니다.

import Link from "next/link";
import { useEffect, useState } from "react";
import Stage from "@/components/stage/Stage";
import { ButtonLink } from "@/components/ui/Button";
import { Dock } from "@/components/ui/Dock";
import { SAMPLE_GLOBE } from "@/lib/sample-data";
import { DEFAULT_THEME } from "@/lib/theme";

// 예시용 오너먼트(가짜 데이터, 색만 있음)
const EXAMPLE = ["#C8363D", "#F2C46D", "#F5F1EA", "#8FB8E8", "#C8363D", "#F2C46D", "#F5F1EA", "#C8363D", "#8FB8E8", "#F2C46D", "#C8363D", "#F5F1EA"].map(
  (color, i) => ({ id: `example-${i}`, color }),
);

// 말풍선에 돌아가며 보여 줄 예시 메시지 (sample-data 의 가짜 메시지)
const MESSAGES = SAMPLE_GLOBE.ornaments.map((o) => ({ sender: o.sender_name, message: o.message ?? "" }));
const CYCLE = 5000; // 말풍선이 바뀌는 간격
const VISIBLE = 2500; // 말풍선이 떠 있는 시간 (나머지는 스노우볼만 보이게 쉽니다)
const FIRST = 800; // 화면을 열고 첫 말풍선까지

function ExampleBubble({ sender, message }: { sender: string; message: string }) {
  return (
    <div className="relative w-max max-w-[184px] animate-rise rounded-xl border border-glass-border bg-night-900/90 px-3 py-2 shadow-[0_6px_18px_rgba(0,0,0,0.45)]">
      <p className="flex items-center gap-1.5 text-xs">
        <span className="rounded-full bg-glow/15 px-1.5 py-px font-bold text-glow">예시</span>
        <span className="font-bold text-ink">{sender}</span>
      </p>
      <p className="mt-1 text-[13px] leading-[1.45] text-ink">{message}</p>
      {/* 말꼬리: 오너먼트를 가리킵니다 */}
      <span className="absolute left-1/2 top-full -mt-px size-0 -translate-x-1/2 border-x-[6px] border-t-[6px] border-x-transparent border-t-night-900/90" aria-hidden="true" />
    </div>
  );
}

export default function OpeningView() {
  const [turn, setTurn] = useState(0);
  const [shown, setShown] = useState(false);

  // 5초마다 다음 메시지를 2.5초 동안만 보여 줍니다
  useEffect(() => {
    let hide: ReturnType<typeof setTimeout> | undefined;
    const show = () => {
      setTurn((n) => n + 1);
      setShown(true);
      clearTimeout(hide);
      hide = setTimeout(() => setShown(false), VISIBLE);
    };
    const first = setTimeout(show, FIRST);
    const id = setInterval(show, CYCLE);
    return () => {
      clearTimeout(first);
      clearTimeout(hide);
      clearInterval(id);
    };
  }, []);

  const current = MESSAGES[turn % MESSAGES.length];

  return (
    <Stage
      theme={DEFAULT_THEME}
      ornaments={EXAMPLE}
      display
      title="친구들의 마음이 모여 내 스노우볼이 돼요"
      subtitle="스노우볼을 만들어 링크를 보내면, 친구들이 메시지를 담은 오너먼트를 달아 줘요"
      hint="드래그로 돌리고, 흔들면 눈이 내려요"
      hintMobile="폰을 흔들거나 드래그해서 눈을 내려보세요"
      layout={{ desktop: { centerFromTop: 0.47 }, mobile: { centerFromTop: 0.48 } }}
      // 명판에 실제 이름처럼 보여 줘서 "여기에 내 이름이 새겨진다"를 처음부터 알게 합니다
      plate={<span className="pointer-events-none whitespace-nowrap text-[15px] font-bold text-night-900">지수의 스노우볼</span>}
      pinKey={turn}
      pin={shown ? <ExampleBubble key={turn} sender={current.sender} message={current.message} /> : undefined}
      below={
        <Link href="/login" className="pointer-events-auto px-2 py-1 text-[13px] text-ink-sub underline underline-offset-4 hover:text-ink">
          이미 스노우볼이 있어요
        </Link>
      }
    >
      <Dock label="시작하기">
        <ButtonLink href="/new">내 스노우볼 만들기</ButtonLink>
      </Dock>
    </Stage>
  );
}
