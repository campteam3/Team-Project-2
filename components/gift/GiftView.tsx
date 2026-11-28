"use client";

// 받은 기념 메시지 화면 /gift/<번호> (FEEDBACK F1, 차명근)
// 오너먼트 하나가 크게 떠 있고, 누르면 메시지가 열립니다. 아래에서 내 스노우볼에 달 수 있습니다.
// 스노우볼이 없으면 만들기(/new?gift=), 있으면 로그인(/login?gift=)으로 가고, 거기서 다 끝나면 자동으로 달립니다.

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import NotFoundView from "@/components/NotFoundView";
import GiftMessageCard from "@/components/gift/GiftMessageCard";
import GiftOrnamentScene from "@/components/gift/GiftOrnamentScene";
import Stage from "@/components/stage/Stage";
import StageFallback from "@/components/stage/StageFallback";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Dock } from "@/components/ui/Dock";
import { getGift, type Gift } from "@/lib/api";
import { withGift } from "@/lib/gift-link";
import { backdropScene } from "@/components/stage/VillageBackdrop";
import { kindOfShape, toShape } from "@/lib/snowglobe";
import { DEFAULT_THEME, defaultTheme, itemWord } from "@/lib/theme";

type View = { status: "loading" } | { status: "missing" } | { status: "error"; message: string } | { status: "ready"; gift: Gift };

const linkClass =
  "pointer-events-auto -my-1.5 inline-flex min-h-11 items-center px-3 text-[13px] text-ink-sub underline underline-offset-4 hover:text-ink";

export default function GiftView() {
  const { id } = useParams<{ id: string }>();
  const [view, setView] = useState<View>({ status: "loading" });
  const [opened, setOpened] = useState(false);

  const load = useCallback(async () => {
    const result = await getGift(id);
    if (!result.ok) return setView({ status: "error", message: result.message });
    setView(result.data ? { status: "ready", gift: result.data } : { status: "missing" });
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    getGift(id).then((result) => {
      if (cancelled) return;
      if (!result.ok) setView({ status: "error", message: result.message });
      else setView(result.data ? { status: "ready", gift: result.data } : { status: "missing" });
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (view.status === "loading") {
    return (
      <main className="relative h-dvh w-full overflow-hidden">
        <StageFallback poster={false} message="기념 메시지를 불러오고 있어요" />
      </main>
    );
  }
  if (view.status === "missing") return <NotFoundView kind="gift" />;
  if (view.status === "error") {
    return (
      <Stage theme={DEFAULT_THEME} scene={<StageFallback poster={false} kind="christmas" />} title="기념 메시지를 불러오지 못했어요" subtitle={view.message}>
        <Dock label="다시 시도">
          <Button onClick={load}>다시 시도하기</Button>
        </Dock>
      </Stage>
    );
  }

  const { gift } = view;
  // 보낸 오너먼트의 주제(새해 · 생일 모양이면 그 주제)에 맞춰 배경을 깔고, 만들기도 그 주제로 시작합니다 (차명근)
  const kind = kindOfShape(gift.shape);
  const item = itemWord(kind); // 크리스마스는 "오너먼트", 생일 · 새해는 "장식"
  return (
    <Stage
      theme={defaultTheme(kind)}
      scene={<GiftOrnamentScene shape={toShape(gift.shape)} color={gift.color} onOpen={() => setOpened(true)} scene={backdropScene(kind)} />}
      title={`${gift.sender_name}님이 보낸 ${item.noun}`}
      subtitle={opened ? `이 ${item.obj} 내 스노우볼에 달아 간직해 보세요` : "눌러서 열어 보세요"}
      hint={opened ? undefined : `${item.obj} 누르면 메시지가 열려요`}
      hintMobile={opened ? undefined : `${item.obj} 누르면 메시지가 열려요`}
      below={
        <Link href={withGift("/login", gift.id)} className={linkClass}>
          이미 스노우볼이 있어요
        </Link>
      }
    >
      <div className="flex w-full flex-col items-center gap-3">
        {opened && <GiftMessageCard gift={gift} />}
        <Dock label="내 스노우볼에 달기">
          {!opened && (
            <Button variant="secondary" onClick={() => setOpened(true)}>
              메시지 열기
            </Button>
          )}
          <ButtonLink href={withGift(kind === "christmas" ? "/new" : `/new?kind=${kind}`, gift.id)}>내 스노우볼에 달기</ButtonLink>
        </Dock>
      </div>
    </Stage>
  );
}
