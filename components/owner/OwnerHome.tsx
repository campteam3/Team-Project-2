"use client";

// 주인 화면 (와이어프레임 05~07)
//   05 내 스노우볼(열기 전): 도착한 오너먼트 수 + "스노우볼 열기"
//   06 열고 난 뒤: 오너먼트를 눌러 읽기, 읽은 수, 링크 공유
//   07 메시지 열람: 카드 + 이전 · 다음 · 닫기, 주인은 지울 수 있음
//   빈 상태: 오너먼트가 0개면 링크 공유를 권합니다
// 3D 는 이민정 님의 Blender 모델 장면(components/SnowGlobeScene)을 고치지 않고 그대로 씁니다.
// 화면을 제목 / 3D 상자 / 아래쪽 UI 로 나눠 쌓아서, 3D 가 UI 와 겹치지 않습니다.
// (모델을 components/stage 로 합치면 다른 화면처럼 Stage 위로 옮깁니다 · #14)

import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import { Button, IconButton } from "@/components/ui/Button";
import { Dock } from "@/components/ui/Dock";
import { closeGlobe, deleteOrnament, type Globe } from "@/lib/api";
import { clearOwnerToken, globePath } from "@/lib/owner-token";
import { loadReadState, saveReadState, type ReadState } from "@/lib/read-state";
import { globeName } from "@/components/friend/FriendFlow";
import ShareDock from "./ShareDock";
import MessageViewer from "./MessageViewer";

const SnowGlobeScene = dynamic(() => import("@/components/SnowGlobeScene"), {
  ssr: false,
  loading: () => <p className="flex h-full items-center justify-center text-sm text-ink-sub">스노우볼을 불러오고 있어요</p>,
});

type Props = {
  nickname: string;
  globe: Globe; // 주인으로 열었으므로 메시지 내용이 들어 있습니다
  token: string | null;
  isDemo: boolean;
  shakeSignal: number;
  onShake: () => void;
  onRefresh: () => Promise<void>;
};

export default function OwnerHome({ nickname, globe, token, isDemo, shakeSignal, onShake, onRefresh }: Props) {
  const [state, setState] = useState<ReadState>(() => loadReadState(nickname));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const ornaments = globe.ornaments;
  const total = ornaments.length;
  const opened = state.opened || total === 0;
  const readCount = ornaments.filter((o) => state.read.includes(o.id)).length;
  const index = selectedId ? ornaments.findIndex((o) => o.id === selectedId) : -1;
  const selected = index >= 0 ? ornaments[index] : null;
  const name = globeName(globe);
  const url = `${window.location.origin}${globePath(nickname)}`;

  const say = (message: string) => {
    setNotice(message);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setNotice(""), 2500);
  };

  const update = (next: ReadState) => {
    setState(next);
    saveReadState(nickname, next);
  };

  // 05 → 06: 한 번 열면 이 브라우저에서는 계속 열린 상태입니다
  const open = () => {
    update({ ...state, opened: true });
    onShake();
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
    try {
      await navigator.clipboard.writeText(url);
      say("링크를 복사했어요");
    } catch {
      say("복사하지 못했어요. 주소창의 주소를 복사해 주세요");
    }
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => {});
  };

  const subtitle =
    total === 0
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
    <main className="relative flex h-dvh w-full flex-col overflow-hidden px-4 pb-[max(env(safe-area-inset-bottom),20px)] pt-4 sm:px-8 sm:pb-8 sm:pt-8">
      <div className="absolute left-4 top-4 z-10 sm:left-8 sm:top-8">
        <IconButton icon="maximize" label="전체 화면" onClick={toggleFullscreen} />
      </div>
      <div className="absolute right-4 top-4 z-10 sm:right-8 sm:top-8">
        <IconButton icon="snowflake" label="눈 내리기" onClick={onShake} />
      </div>

      <header className="mx-auto mt-14 max-w-[900px] text-center sm:mt-1.5">
        <h1 className="text-balance text-[22px] font-bold leading-[1.3] tracking-[-0.02em] text-ink sm:text-[28px]">{name}</h1>
        <p key={subtitle} className="mt-2 animate-fade text-[15px] text-ink-sub">
          {subtitle}
        </p>
      </header>

      {/* 3D: 이 상자 안에서만 그려집니다 */}
      <div className="relative my-3 min-h-0 flex-1">
        <div className={`absolute inset-0 touch-none transition-opacity duration-700 ease-soft ${opened ? "" : "opacity-80"}`}>
          <SnowGlobeScene
            title={globe.title} // 받침대 명패에 적을 이름 (이민정 님 장면)
            ornaments={ornaments}
            shakeSignal={shakeSignal}
            selectedId={selectedId}
            onSelect={select}
          />
        </div>
      </div>

      <footer className="flex flex-col items-center gap-3">
        {hint && <p className="text-center text-[15px] text-ink-sub">{hint}</p>}
        <p role="status" className={`text-center text-sm text-ink transition-opacity duration-400 ${notice ? "opacity-100" : "opacity-0"}`}>
          {notice || " "}
        </p>

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
              <Button variant="secondary" icon="message" onClick={readNext}>
                {readCount < total ? "안 읽은 메시지 읽기" : "메시지 다시 읽기"}
              </Button>
            )}
            <ShareDock url={url} title={name} />
          </div>
        )}

        {!isDemo && token && !selected && (
          <button
            type="button"
            onClick={leave}
            className="pointer-events-auto -my-1.5 inline-flex min-h-11 items-center px-3 text-[13px] text-ink-sub underline underline-offset-4 hover:text-ink"
          >
            이 기기에서 나가기
          </button>
        )}
      </footer>
    </main>
  );
}
