"use client";

// 스노우볼 보기 화면. DB 에 연결되어 있습니다.
//  - 친구: 스노우볼을 보고 오너먼트를 답니다. 메시지 내용은 볼 수 없습니다.
//  - 주인: 메시지를 읽고, 오너먼트를 지우고, 공유 링크를 복사합니다.
// 동작만 하는 최소 형태입니다. 모양은 DESIGN.md 에 맞춰 자유롭게 바꾸세요.
// 친구 화면(10~13)과 상태 화면은 시안 C 로 바꿨습니다: components/friend/FriendFlow, components/stage/GlobeStatus (김미영)
// 주인 화면(05~07)은 components/owner/OwnerHome 으로 옮겼습니다. 메시지 열기 · 지우기 · 나가기 호출은 그대로입니다 (김미영)
// 개발용: /globe/demo?preview=friend 이면 샘플 스노우볼을 친구 입장에서 봅니다(저장하지 않음).

import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getGlobe, getMessages, type Globe } from "@/lib/api";
import { clearOwnerToken, loadOwnerToken } from "@/lib/owner-token";
import { SAMPLE_GLOBE } from "@/lib/sample-data";
import FriendFlow from "./friend/FriendFlow";
import OwnerHome from "./owner/OwnerHome";
import GlobeStatus from "./stage/GlobeStatus";


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
  if (!isOwner) return <FriendFlow nickname={nickname} globe={globe} preview={previewFriend} onAdded={refresh} />;
  // 주인 화면 (05~07) · 이민정 님 3D 장면을 그대로 씁니다 (김미영)
  return (
    <OwnerHome
      nickname={nickname}
      globe={globe}
      token={token}
      isDemo={isDemo}
      shakeSignal={shakeSignal}
      onShake={shake}
      onRefresh={refresh}
    />
  );
}
