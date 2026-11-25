"use client";

// 모든 화면의 공통 틀 (DESIGN.md 4장)
//   뒤: 화면 전체 3D 무대 (마을 + 스노우볼)
//   앞: 위쪽 띠(전체 화면 · 소리 · 눈 버튼) + 제목, 아래쪽 안내 문구 + 도크
// UI 는 위쪽 띠와 아래쪽에만 두고, 스노우볼 위에 겹치지 않습니다.

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import type { Ornament } from "@/lib/api";
import type { GlobeTheme } from "@/lib/theme";
import { IconButton } from "@/components/ui/Button";
import StageFallback from "./StageFallback";
import type { GlobeLayout } from "./StageScene";

// 음악 파일이 생기면 true 로 바꿉니다. 지금은 버튼을 숨겨 둡니다.
const SHOW_SOUND = false;

const StageScene = dynamic(() => import("./StageScene"), {
  ssr: false,
  loading: () => <StageFallback message="스노우볼을 불러오고 있어요" />,
});

// 스노우볼은 제목과 아래쪽 UI 사이 빈 공간(위아래 24px 여백)을 꽉 채울 만큼 크게 그립니다.
// height 는 상한 역할만 하고, 실제 크기는 빈 공간과 화면 너비 중 좁은 쪽에 맞춰집니다 (StageScene 의 getSafeArea).
const DESKTOP: GlobeLayout = { height: 0.9, centerFromTop: 0.45 };
const MOBILE: GlobeLayout = { height: 0.9, centerFromTop: 0.46 };

type MotionPermission = { requestPermission?: () => Promise<"granted" | "denied"> };

export type StageProps = {
  theme: GlobeTheme;
  ornaments?: Pick<Ornament, "id" | "color">[];
  title: string;
  subtitle?: string;
  display?: boolean; // 오프닝처럼 큰 제목
  hint?: string;
  hintMobile?: string;
  plate?: ReactNode; // 받침대 명판에 붙일 내용
  pin?: ReactNode; // 오너먼트 하나 위에 띄울 내용 (예시 말풍선)
  pinKey?: number; // 바뀔 때마다 앞쪽 오너먼트를 새로 고릅니다
  pinId?: string; // 말풍선을 붙일 오너먼트를 직접 정할 때
  highlightId?: string; // 빛나게 보여 줄 오너먼트
  arrivingId?: string; // 지금 막 달리는 오너먼트
  focusId?: string; // 이 오너먼트가 정면에 오도록 스노우볼을 돌립니다
  lockFront?: boolean;
  layout?: { desktop?: Partial<GlobeLayout>; mobile?: Partial<GlobeLayout> };
  children?: ReactNode; // 아래쪽: 도크 · 버튼
  below?: ReactNode; // 도크 아래 작은 글자 링크
};

function supportsWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

export default function Stage(props: StageProps) {
  const { theme, ornaments, title, subtitle, display, hint, hintMobile, plate, pin, pinKey, pinId, highlightId, arrivingId, focusId, lockFront, children, below } = props;
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [mobile, setMobile] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [shakeSignal, setShakeSignal] = useState(0);
  const lastShake = useRef(0);
  const plateEl = useRef<HTMLDivElement>(null);
  const headerEl = useRef<HTMLElement>(null);
  const footerEl = useRef<HTMLElement>(null);

  // 3D 장면이 매 프레임 묻는 "UI 사이 빈 공간" (제목 아래 끝 ~ 아래쪽 UI 위 끝, px)
  const getSafeArea = useCallback(() => {
    const head = headerEl.current?.getBoundingClientRect();
    const foot = footerEl.current?.getBoundingClientRect();
    if (!head || !foot) return null;
    return { top: head.bottom, bottom: foot.top, plateHalf: (plateEl.current?.offsetHeight ?? 0) / 2 };
  }, []);
  const pinEl = useRef<HTMLDivElement>(null);

  const movePin = useCallback((x: number, y: number, visibility: number) => {
    const el = pinEl.current;
    if (!el) return;
    el.style.transform = `translate(${x}px, ${y}px) translate(-50%, calc(-100% - 10px))`;
    el.style.opacity = String(visibility);
  }, []);

  // 3D 장면이 알려 주는 명판 좌표에 명판 글자 · 입력칸을 옮깁니다
  const movePlate = useCallback((x: number, y: number, visibility: number, width: number) => {
    const el = plateEl.current;
    if (!el) return;
    // 명판 글자는 명판 너비(좌우 여백 제외)를 넘으면 "…"으로 잘립니다 (.plate-text)
    el.style.setProperty("--plate-w", `${Math.max(48, width - 16)}px`);
    el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    el.style.opacity = String(visibility);
    el.style.pointerEvents = visibility > 0.6 ? "auto" : "none";
  }, []);

  const shake = useCallback(() => {
    const now = Date.now();
    if (now - lastShake.current < 600) return;
    lastShake.current = now;
    setShakeSignal((n) => n + 1);
  }, []);

  useEffect(() => {
    // 브라우저에서만 알 수 있는 값을 처음 한 번 읽습니다
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWebgl(supportsWebGL());
    const small = window.matchMedia("(max-width: 767px)");
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      setMobile(small.matches);
      setReducedMotion(motion.matches);
    };
    sync();
    small.addEventListener("change", sync);
    motion.addEventListener("change", sync);
    return () => {
      small.removeEventListener("change", sync);
      motion.removeEventListener("change", sync);
    };
  }, []);

  // 휴대폰 흔들기. 아이폰은 처음 화면을 누를 때 권한을 한 번 묻습니다.
  useEffect(() => {
    const onMotion = (e: DeviceMotionEvent) => {
      const a = e.acceleration ?? e.accelerationIncludingGravity;
      if (!a) return;
      const force = Math.hypot(a.x ?? 0, a.y ?? 0, a.z ?? 0);
      if (force > (e.acceleration ? 14 : 24)) shake();
    };
    const ask = () => {
      const Motion = (window as unknown as { DeviceMotionEvent?: MotionPermission }).DeviceMotionEvent;
      Motion?.requestPermission?.().catch(() => {
        // 거부해도 드래그와 눈 버튼으로 눈을 내릴 수 있습니다
      });
    };
    window.addEventListener("devicemotion", onMotion);
    window.addEventListener("pointerdown", ask, { once: true });
    return () => {
      window.removeEventListener("devicemotion", onMotion);
      window.removeEventListener("pointerdown", ask);
    };
  }, [shake]);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => {});
  };

  const layout: GlobeLayout = mobile
    ? { ...MOBILE, ...props.layout?.mobile }
    : { ...DESKTOP, ...props.layout?.desktop };

  return (
    <main className="relative h-dvh w-full overflow-hidden">
      {/* 뒤: 3D 무대 */}
      <div className="absolute inset-0 z-0">
        {webgl === false ? (
          <StageFallback plate={plate} centerFromTop={layout.centerFromTop} height={layout.height} />
        ) : webgl ? (
          <StageScene
            theme={theme}
            ornaments={ornaments}
            layout={layout}
            onPlateMove={plate ? movePlate : undefined}
            pinKey={pinKey}
            pinId={pinId}
            highlightId={highlightId}
            arrivingId={arrivingId}
            focusId={focusId}
            getSafeArea={getSafeArea}
            onPinMove={pin ? movePin : undefined}
            lockFront={lockFront}
            shakeSignal={shakeSignal}
            reducedMotion={reducedMotion}
          />
        ) : (
          <StageFallback />
        )}
      </div>

      {/* 명판 글자 · 입력칸: 3D 받침대 명판 위치를 따라갑니다 */}
      {plate && webgl && (
        <div ref={plateEl} className="absolute left-0 top-0 z-[5] opacity-0 will-change-transform">
          {plate}
        </div>
      )}

      {/* 예시 말풍선: 3D 오너먼트 위치를 따라갑니다 */}
      {pin && webgl && (
        <div ref={pinEl} className="pointer-events-none absolute left-0 top-0 z-[6] opacity-0 transition-opacity duration-400 will-change-transform">
          {pin}
        </div>
      )}

      {/* 앞: UI */}
      <div className="pointer-events-none relative z-10 flex h-full flex-col px-4 pb-[max(env(safe-area-inset-bottom),20px)] pt-4 sm:px-8 sm:pb-8 sm:pt-8">
        <div className="pointer-events-auto absolute left-4 top-4 sm:left-8 sm:top-8">
          <IconButton icon="maximize" label="전체 화면" onClick={toggleFullscreen} />
        </div>
        <div className="pointer-events-auto absolute right-4 top-4 flex gap-2 sm:right-8 sm:top-8">
          {SHOW_SOUND && <IconButton icon="volume" label="소리" />}
          <IconButton icon="snowflake" label="눈 내리기" onClick={shake} />
        </div>

        <header ref={headerEl} key={title} className="mx-auto mt-14 max-w-[900px] animate-fade text-center sm:mt-1.5">
          <h1
            className={`text-balance font-bold tracking-[-0.02em] text-ink ${
              display ? "text-[28px] leading-[1.3] sm:text-[40px]" : "text-[22px] leading-[1.3] sm:text-[28px]"
            }`}
          >
            {title}
          </h1>
          {subtitle && (
            <p className={`mt-2 text-pretty text-ink-sub ${display ? "text-[15px] sm:mt-3.5 sm:text-[17px]" : "text-[15px]"}`}>
              {subtitle}
            </p>
          )}
        </header>

        <div className="flex-1" />

        <footer ref={footerEl} className="flex flex-col items-center gap-3">
          {(hintMobile ?? hint) && <p className="text-center text-[15px] text-ink-sub sm:hidden">{hintMobile ?? hint}</p>}
          {hint && <p className="hidden text-center text-[15px] text-ink-sub sm:block">{hint}</p>}
          {children}
          {below}
        </footer>
      </div>
    </main>
  );
}
