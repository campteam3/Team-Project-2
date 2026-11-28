"use client";

// 01 오프닝 (시안 C = 시안 A 의 01)
// 처음 온 사람이 "이게 뭔지"를 알고 바로 시작합니다.
// 오너먼트가 달린 예시 스노우볼에서, 앞쪽 오너먼트 하나가 몇 초마다 메시지 말풍선을 보여 줍니다.
// "오너먼트 하나 = 친구 메시지 하나"를 설명 대신 보여 주는 장치입니다.

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Stage from "@/components/stage/Stage";
import { ButtonLink } from "@/components/ui/Button";
import { Dock } from "@/components/ui/Dock";
import { SAMPLE_GLOBE } from "@/lib/sample-data";
import GlobeKindPicker from "@/components/ui/GlobeKindPicker";
import { defaultTheme, type GlobeKind } from "@/lib/theme";

// 예시용 오너먼트(가짜 데이터, 모양 · 색 · 자리만 있음). 다섯 모양을 섞어 24개: 앞쪽 14 · 옆 5 · 뒤 5 (볼 · 별 · 사탕 · 선물 5개씩, 하트 4개)
// 세 번째 값은 트리의 자리 번호(lib/snowglobe-slots.json)입니다. 순서대로 자동으로 달면 옆을 다 채워야 뒤로 넘어가서, 자리를 직접 정했습니다.
// 자리는 이웃한 것끼리 모양도 색도 겹치지 않게 골랐습니다. 초록은 트리 색에 묻히지 않는 선물 상자에만 씁니다.
const RED = "#C8363D";
const GOLD = "#F2C46D";
const RED_GOLD = "#F5F1EA"; // 빨강과 금색 (lib/theme.ts 의 ORNAMENT_OPTIONS)
const BLUE = "#8FB8E8";
const GREEN = "#3C8E63";
const PINK = "#E58FA8";
const EXAMPLE = (
  [
    // 앞쪽
    ["star", RED_GOLD, 38],
    ["star", GOLD, 33],
    ["star", RED, 32],
    ["gift", RED, 13],
    ["cane", GOLD, 20],
    ["cane", RED_GOLD, 6],
    ["heart", PINK, 36],
    ["heart", GOLD, 5],
    ["gift", PINK, 27],
    ["ball", BLUE, 14],
    ["heart", RED, 21],
    ["cane", BLUE, 12],
    ["ball", RED, 26],
    ["gift", GREEN, 19],
    // 옆
    ["ball", RED_GOLD, 0],
    ["gift", RED, 3],
    ["star", RED_GOLD, 29],
    ["cane", PINK, 15],
    ["ball", PINK, 11],
    // 뒤
    ["gift", RED_GOLD, 9],
    ["cane", BLUE, 24],
    ["ball", GOLD, 2],
    ["heart", GOLD, 37],
    ["star", BLUE, 1],
  ] as const
  // position 은 Stage 를 거쳐 lib/snowglobe.ts 의 placeOrnaments 까지 그대로 전해져, 그 자리에 달립니다
).map(([shape, color, slot], i) => ({ id: `example-${i}`, shape, color, position: { slot } }));

// 말풍선에 돌아가며 보여 줄 예시 메시지. 스노우볼 주제마다 그 주제에 맞는 글을 보여 줍니다 (이민정)
// 크리스마스는 sample-data 의 가짜 메시지 그대로이고, 생일 · 새해는 같은 가짜 이름으로 여기에 적었습니다. 실제 사람의 글이 아닙니다.
const MESSAGES: Record<GlobeKind, { sender: string; message: string }[]> = {
  christmas: SAMPLE_GLOBE.ornaments.map((o) => ({ sender: o.sender_name, message: o.message ?? "" })),
  birthday: [
    { sender: "하늘", message: "생일 축하해! 올해도 좋은 일만 가득하길." },
    { sender: "바다", message: "태어나 줘서 고마워. 오늘은 네가 주인공이야." },
    { sender: "구름", message: "생일 축하해!" },
    { sender: "노을", message: "케이크는 내가 살게. 주말에 꼭 보자." },
    { sender: "별", message: "행복한 하루 보내." },
  ],
  newyear: [
    { sender: "하늘", message: "새해 복 많이 받아! 올해도 같이 달리자." },
    { sender: "바다", message: "지난 한 해 덕분에 든든했어. 고마워." },
    { sender: "구름", message: "해피 뉴 이어!" },
    { sender: "노을", message: "올해는 바라는 일 다 이루어지길 바랄게." },
    { sender: "별", message: "건강하고 따뜻한 한 해 보내." },
  ],
};
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
  // 왼쪽 위 버튼으로 고른 스노우볼 주제. 만들기(/new)도 이 주제로 시작합니다 (차명근)
  const [kind, setKind] = useState<GlobeKind>("christmas");
  const theme = useMemo(() => defaultTheme(kind), [kind]);
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

  const messages = MESSAGES[kind];
  const current = messages[turn % messages.length];

  return (
    <Stage
      theme={theme}
      topLeft={<GlobeKindPicker kind={kind} onPick={setKind} />}
      ornaments={EXAMPLE}
      display
      // 문구: Impeccable clarify 로 다듬음. 제목은 "무엇인지", 설명은 제목에 없는 "어떻게"만 (각각 한 줄)
      title="친구 마음이 쌓이는 스노우볼"
      subtitle="링크를 보내면 친구들이 오너먼트를 달아 줘요"
      hint="드래그로 돌리고, 스크롤로 크게 볼 수 있어요"
      hintMobile={kind === "newyear" || kind === "birthday" ? "폰을 흔들어 폭죽을 터뜨려 보세요" : "폰을 흔들어 눈을 내려 보세요"}
      layout={{ desktop: { centerFromTop: 0.47 }, mobile: { centerFromTop: 0.48 } }}
      // 명판에 실제 이름처럼 보여 줘서 "여기에 내 이름이 새겨진다"를 처음부터 알게 합니다
      plateText="지수의 스노우볼"
      pinKey={turn}
      pin={shown ? <ExampleBubble key={turn} sender={current.sender} message={current.message} /> : undefined}
      below={
        <Link href="/login" className="pointer-events-auto -my-1.5 inline-flex min-h-11 items-center px-3 text-[13px] text-ink-sub underline underline-offset-4 hover:text-ink">
          이미 스노우볼이 있어요
        </Link>
      }
    >
      {/* 기념 메시지 보내기 (FEEDBACK F1, 차명근): 빨간 주 버튼은 하나라 보조 버튼으로. 아주 좁은 화면(400px 미만)에서는 위아래로 쌓습니다 */}
      <Dock label="시작하기" className="max-[400px]:w-full max-[400px]:flex-col max-[400px]:items-stretch max-[400px]:rounded-[28px]">
        <ButtonLink href={kind === "christmas" ? "/new" : `/new?kind=${kind}`}>내 스노우볼 만들기</ButtonLink>
        {/* 기념 메시지도 홈에 떠 있는 스노우볼의 오너먼트 · 배경으로 시작합니다 (차명근) */}
        <ButtonLink href={kind === "christmas" ? "/gift/new" : `/gift/new?kind=${kind}`} variant="secondary">
          기념 메시지 보내기
        </ButtonLink>
      </Dock>
    </Stage>
  );
}
