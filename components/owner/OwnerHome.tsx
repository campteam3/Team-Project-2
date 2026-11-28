"use client";

// 주인 화면 (와이어프레임 05~07)
//   05 내 스노우볼(열기 전): 도착한 오너먼트 수 + "스노우볼 열기"
//   06 열고 난 뒤: 오너먼트를 눌러 읽기, 읽은 수, 링크 공유
//   07 메시지 열람: 카드 + 이전 · 다음 · 닫기, 주인은 지울 수 있음. 고른 오너먼트는 빛나고 정면으로 돌아옵니다
//   빈 상태: 오너먼트가 0개면 링크 공유를 권합니다
// 다른 화면(오프닝 · 만들기 · 친구)과 같은 무대(Stage)를 써서, 겨울밤 배경이 화면 전체에 깔립니다.

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import Stage from "@/components/stage/Stage";
import { useNotice } from "@/components/stage/useNotice";
import { Button } from "@/components/ui/Button";
import { Dock } from "@/components/ui/Dock";
import { closeGlobe, deleteOrnament, type Globe } from "@/lib/api";
import { copyText, showLinkToCopy } from "@/lib/copy";
import { clearOwnerToken, globePath } from "@/lib/owner-token";
import { giftResult } from "@/lib/gift-link";
import { loadReadState, saveReadState, type ReadState } from "@/lib/read-state";
import { MAX_ORNAMENTS } from "@/lib/snowglobe";
import { parseTheme } from "@/lib/theme";
import { globeName } from "@/components/friend/FriendFlow";
import ShareDock from "./ShareDock";
import MessageViewer from "./MessageViewer";

// 주인 화면에서 나가는 글자 링크. "이 기기에서 나가기"는 딱딱하게 읽혀서 바꿨습니다 (FEEDBACK C2)
const LEAVE_LABEL = "내 스노우볼에서 나가기";

type Props = {
  nickname: string;
  globe: Globe; // 주인으로 열었으므로 메시지 내용이 들어 있습니다
  token: string | null;
  isDemo: boolean;
  onRefresh: () => Promise<void>;
  // 아래 두 값은 예전 화면용으로 GlobeView 가 넘겨 줍니다. 지금은 무대(Stage)가 흔들기를 직접 처리합니다.
  shakeSignal?: number;
  onShake?: () => void;
};

export default function OwnerHome({ nickname, globe, token, isDemo, onRefresh }: Props) {
  const [state, setState] = useState<ReadState>(() => loadReadState(nickname));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [notice, say] = useNotice(); // "링크를 복사했어요" 같은 알림. 안내 알약 자리에 뜹니다

  // 받은 기념 메시지를 달고 들어왔으면(?gift=added · already) 한 번 알리고 주소에서 지웁니다 (FEEDBACK F1, 차명근)
  const arrived = giftResult(useSearchParams());
  useEffect(() => {
    if (!arrived) return;
    say(arrived === "already" ? "이미 달려 있어요" : "받은 오너먼트를 달았어요");
    window.history.replaceState(null, "", globePath(nickname));
  }, [arrived, nickname, say]);
  const [openShake, setOpenShake] = useState(0);

  const ornaments = globe.ornaments;
  const total = ornaments.length;
  const opened = state.opened || total === 0;
  const readCount = ornaments.filter((o) => state.read.includes(o.id)).length;
  const index = selectedId ? ornaments.findIndex((o) => o.id === selectedId) : -1;
  const selected = index >= 0 ? ornaments[index] : null;
  const name = globeName(globe);
  const url = `${window.location.origin}${globePath(nickname)}`;

  const update = (next: ReadState) => {
    setState(next);
    saveReadState(nickname, next);
  };

  // 05 → 06: 한 번 열면 이 브라우저에서는 계속 열린 상태입니다. 열 때 눈이 날립니다.
  const open = () => {
    update({ ...state, opened: true });
    setOpenShake((n) => n + 1);
  };

  const select = (id: string) => {
    if (!opened) return say("먼저 스노우볼을 열어 주세요");
    setSelectedId(id);
    if (!state.read.includes(id)) update({ opened: true, read: [...state.read, id] });
  };

  // 아직 안 읽은 첫 메시지부터 엽니다 (모두 읽었으면 첫 메시지)
  const readNext = () => {
    const next = ornaments.find((o) => !state.read.includes(o.id)) ?? ornaments[0];
    if (next) select(next.id);
  };

  const move = (delta: number) => {
    if (!total) return;
    select(ornaments[(index + delta + total) % total].id);
  };

  const remove = async () => {
    if (!selected || !token) return;
    if (!window.confirm(`${selected.sender_name} 님의 오너먼트를 지울까요? 지우면 되돌릴 수 없어요.`)) return;
    setDeleting(true);
    const result = await deleteOrnament(nickname, token, selected.id);
    setDeleting(false);
    say(result.ok ? "오너먼트를 지웠어요" : result.message);
    if (result.ok) {
      setSelectedId(null);
      await onRefresh();
    }
  };

  const leave = async () => {
    if (token) await closeGlobe(token);
    clearOwnerToken(nickname);
    await onRefresh(); // 이제 친구 화면으로 보입니다
  };

  const copyLink = async () => {
    if (await copyText(url)) say("링크를 복사했어요");
    else showLinkToCopy(url);
  };

  const full = total >= MAX_ORNAMENTS; // 자리가 모두 찼음. 하나를 지우면 다시 자리가 생깁니다
  const subtitle =
    full && opened
      ? `오너먼트 ${total}개로 가득 찼어요 · ${readCount}개 읽었어요`
      : full
        ? `오너먼트 ${total}개로 가득 찼어요`
        : total === 0
      ? "아직 오너먼트가 없어요"
      : !opened
        ? `오너먼트 ${total}개가 도착했어요`
        : readCount === total
          ? `오너먼트 ${total}개를 모두 읽었어요`
          : `${total}개 중 ${readCount}개 읽었어요`;

  const hint =
    total === 0
      ? "링크를 보내 친구를 불러 보세요"
      : !opened
        ? "열면 오너먼트를 눌러 메시지를 읽을 수 있어요"
        : selected
          ? undefined
          : "오너먼트를 눌러 메시지를 읽어 보세요";

  return (
    <Stage
      theme={parseTheme(globe.theme)}
      ornaments={ornaments}
      title={name}
      subtitle={subtitle}
      hint={hint}
      hintMobile={hint}
      notice={notice}
      saveAs={name}
      onNotice={say}
      plateText={name}
      highlightId={selected?.id}
      focusId={selected?.id}
      // 읽는 메시지의 오너먼트 쪽으로 확대합니다. 고정은 아니어서 다시 줄일 수 있습니다 (이민정)
      focusZoom
      onSelectOrnament={select}
      extraShake={openShake}
      below={
        !isDemo && token && !selected ? (
          <button
            type="button"
            onClick={leave}
            className="pointer-events-auto -my-1.5 inline-flex min-h-11 items-center px-3 text-[13px] text-ink-sub underline underline-offset-4 hover:text-ink"
          >
            {LEAVE_LABEL}
          </button>
        ) : undefined
      }
    >
      {selected ? (
        <div key="viewer" className="flex w-full flex-col items-center gap-4">
          <MessageViewer
            ornament={selected}
            index={index}
            total={total}
            canDelete={!isDemo && !!token}
            deleting={deleting}
            onDelete={remove}
          />
          <Dock label="메시지 넘기기">
            <Button variant="secondary" icon="arrow-left" onClick={() => move(-1)} disabled={total < 2}>
              이전
            </Button>
            <Button variant="secondary" onClick={() => setSelectedId(null)}>
              닫기
            </Button>
            <Button onClick={() => move(1)} disabled={total < 2}>
              다음
            </Button>
          </Dock>
        </div>
      ) : !opened ? (
        <div key="closed" className="flex w-full animate-rise justify-center">
          <Dock label="스노우볼 열기">
            <Button onClick={open}>스노우볼 열기</Button>
            <Button variant="secondary" icon="copy" onClick={copyLink}>
              링크 복사
            </Button>
          </Dock>
        </div>
      ) : (
        <div key="share" className="flex w-full animate-rise flex-col items-center gap-3">
          {/* 휴대폰에서는 작은 오너먼트를 정확히 누르기 어려워, 버튼으로도 메시지를 열 수 있게 합니다 */}
          {total > 0 && (
            <Button variant="secondary" icon="message" onClick={readNext} className="pointer-events-auto">
              {readCount < total ? "안 읽은 메시지 읽기" : "메시지 다시 읽기"}
            </Button>
          )}
          <ShareDock url={url} title={name} onNotice={say} />
        </div>
      )}
    </Stage>
  );
}
