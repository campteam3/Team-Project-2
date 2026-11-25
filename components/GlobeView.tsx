"use client";

// 스노우볼 보기 화면. DB 에 연결되어 있습니다.
//  - 친구: 스노우볼을 보고 오너먼트를 답니다. 메시지 내용은 볼 수 없습니다.
//  - 주인: 메시지를 읽고, 오너먼트를 지우고, 공유 링크를 복사합니다.
// 동작만 하는 최소 형태입니다. 모양은 DESIGN.md 에 맞춰 자유롭게 바꾸세요.
// 친구 화면(10~13)과 상태 화면은 시안 C 로 바꿨습니다: components/friend/FriendFlow, components/stage/GlobeStatus (김미영)
// 개발용: /globe/demo?preview=friend 이면 샘플 스노우볼을 친구 입장에서 봅니다(저장하지 않음).
// ?flow=2 이면 친구 흐름 두 번째 버전(오너먼트에 집중)을 보여 줍니다. A/B 비교용.

import dynamic from "next/dynamic";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { closeGlobe, deleteOrnament, getGlobe, getMessages, type Globe } from "@/lib/api";
import { clearOwnerToken, globePath, loadOwnerToken } from "@/lib/owner-token";
import { SAMPLE_GLOBE } from "@/lib/sample-data";
import FriendFlow from "./friend/FriendFlow";
import FriendFlowFocus from "./friend/FriendFlowFocus";
import GlobeStatus from "./stage/GlobeStatus";

// 3D 장면은 브라우저에서만 그립니다.
const SnowGlobeScene = dynamic(() => import("./SnowGlobeScene"), {
  ssr: false,
  loading: () => <p className="text-sm text-slate-300">스노우볼을 불러오고 있어요</p>,
});

type MotionPermission = { requestPermission?: () => Promise<"granted" | "denied"> };

type View =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "error"; message: string }
  | { status: "ready"; globe: Globe; isOwner: boolean; token: string | null };

const DEMO = "demo";

function decode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

async function loadView(nickname: string, previewFriend = false): Promise<View> {
  if (nickname === DEMO) return { status: "ready", globe: SAMPLE_GLOBE, isOwner: !previewFriend, token: null };

  const globe = await getGlobe(nickname);
  if (!globe.ok) return { status: "error", message: globe.message };
  if (!globe.data) return { status: "missing" };

  const token = loadOwnerToken(nickname);
  if (token) {
    const messages = await getMessages(nickname, token);
    if (messages.ok) {
      return { status: "ready", globe: { ...globe.data, ornaments: messages.data }, isOwner: true, token };
    }
    if (messages.code === "invalid_owner_token") clearOwnerToken(nickname);
  }
  return { status: "ready", globe: globe.data, isOwner: false, token: null };
}

export default function GlobeView() {
  const { id } = useParams<{ id: string }>();
  const nickname = decode(id).trim().toLowerCase();
  const isDemo = nickname === DEMO;
  const searchParams = useSearchParams();
  const previewFriend = isDemo && searchParams.get("preview") === "friend";

  const [view, setView] = useState<View>({ status: "loading" });
  const [shakeSignal, setShakeSignal] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const lastShake = useRef(0);

  useEffect(() => {
    let cancelled = false;
    loadView(nickname, previewFriend).then((next) => {
      if (!cancelled) setView(next);
    });
    return () => {
      cancelled = true;
    };
  }, [nickname, previewFriend]);

  const refresh = async () => setView(await loadView(nickname, previewFriend));

  // 휴대폰을 흔들면 눈이 내립니다.
  useEffect(() => {
    const onMotion = (event: DeviceMotionEvent) => {
      const a = event.accelerationIncludingGravity;
      if (!a) return;
      const strength = Math.hypot(a.x ?? 0, a.y ?? 0, a.z ?? 0);
      const now = Date.now();
      if (strength > 22 && now - lastShake.current > 700) {
        lastShake.current = now;
        setShakeSignal((count) => count + 1);
      }
    };
    window.addEventListener("devicemotion", onMotion);
    return () => window.removeEventListener("devicemotion", onMotion);
  }, []);

  const shake = async () => {
    setShakeSignal((count) => count + 1);
    // iPhone 은 버튼을 누른 순간에만 흔들기 권한을 물어볼 수 있습니다. 거부해도 버튼은 계속 동작합니다.
    const motion = (globalThis as { DeviceMotionEvent?: MotionPermission }).DeviceMotionEvent;
    try {
      await motion?.requestPermission?.();
    } catch {
      // 권한을 받지 못해도 그대로 진행
    }
  };

  if (view.status === "loading") return <GlobeStatus kind="loading" />;
  if (view.status === "missing") return <GlobeStatus kind="missing" />;
  if (view.status === "error") return <GlobeStatus kind="error" message={view.message} onRetry={refresh} />;

  const { globe, isOwner, token } = view;

  // 친구 화면 (10~13)
  if (!isOwner) {
    const Flow = searchParams.get("flow") === "2" ? FriendFlowFocus : FriendFlow;
    return <Flow nickname={nickname} globe={globe} preview={previewFriend} onAdded={refresh} />;
  }
  const selected = globe.ornaments.find((ornament) => ornament.id === selectedId) ?? null;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin + globePath(nickname));
      setNotice("링크를 복사했어요");
    } catch {
      setNotice("링크를 복사하지 못했어요. 주소창의 주소를 직접 복사해 주세요");
    }
  };

  const leave = async () => {
    if (token) await closeGlobe(token);
    clearOwnerToken(nickname);
    setSelectedId(null);
    setNotice("");
    await refresh();
  };

  const remove = async () => {
    if (!selected || !token) return;
    if (!window.confirm("이 오너먼트를 지울까요? 지우면 되돌릴 수 없어요.")) return;
    const result = await deleteOrnament(nickname, token, selected.id);
    setNotice(result.ok ? "오너먼트를 지웠어요" : result.message);
    setSelectedId(null);
    await refresh();
  };

  return (
    <main className="flex min-h-dvh flex-col items-center bg-gradient-to-b from-slate-900 to-slate-800 px-4 py-6 text-white">
      <header className="text-center">
        <h1 className="text-xl font-bold">{globe.title}</h1>
        <p className="mt-1 text-xs text-slate-400">
          {isDemo ? "샘플 스노우볼이에요" : isOwner ? "내 홈 · 메시지를 읽을 수 있어요" : `오너먼트 ${globe.ornaments.length}개`}
        </p>
      </header>

      <div className="flex w-full max-w-md items-center justify-center">
        <div className="h-[55dvh] max-h-[520px] min-h-[300px] w-full touch-none">
          <SnowGlobeScene
            ornaments={globe.ornaments}
            shakeSignal={shakeSignal}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>
      </div>

      <section className="w-full max-w-md space-y-3">
        <div className="min-h-24 rounded-3xl border border-white/15 bg-white/10 p-5" aria-live="polite">
          {selected ? (
            <>
              <p className="text-sm text-slate-300">{selected.sender_name} 님이 달아 준 오너먼트</p>
              {isOwner ? (
                <p className="mt-1 whitespace-pre-wrap break-words text-base">{selected.message}</p>
              ) : (
                <p className="mt-1 text-base text-slate-300">메시지는 스노우볼 주인만 읽을 수 있어요.</p>
              )}
              {isOwner && !isDemo && (
                <button type="button" onClick={remove} className="mt-3 text-sm text-red-300 underline">
                  이 오너먼트 지우기
                </button>
              )}
            </>
          ) : globe.ornaments.length === 0 ? (
            <p className="text-sm text-slate-300">
              {isOwner
                ? "아직 오너먼트가 없어요. 링크를 보내 친구를 불러 보세요."
                : "아직 오너먼트가 없어요. 첫 번째로 달아 보세요."}
            </p>
          ) : (
            <p className="text-sm text-slate-300">
              스노우볼을 드래그해서 돌려 보고, 오너먼트를 눌러 보세요.
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={shake}
          className="h-12 w-full rounded-full border border-white/20 bg-white/10 font-semibold active:scale-[0.97]"
        >
          흔들기
        </button>

        <p className="min-h-5 text-center text-sm text-slate-200" role="status">
          {notice}
        </p>

        {isOwner && !isDemo && (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={copyLink}
              className="h-12 flex-1 rounded-full bg-white font-semibold text-slate-900"
            >
              링크 복사
            </button>
            <button
              type="button"
              onClick={leave}
              className="h-12 rounded-full border border-white/20 bg-white/10 px-5 font-semibold"
            >
              나가기
            </button>
          </div>
        )}

      </section>
    </main>
  );
}
