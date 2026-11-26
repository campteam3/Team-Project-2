"use client";

// 모든 화면의 공통 틀 (DESIGN.md 4장)
//   뒤: 화면 전체 3D 무대 (마을 + 스노우볼)
//   앞: 위쪽 띠(전체 화면 · 소리 · 눈 버튼) + 제목, 아래쪽 안내 문구 + 도크
// UI 는 위쪽 띠와 아래쪽에만 두고, 스노우볼 위에 겹치지 않습니다.

import dynamic from "next/dynamic";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

import type { Ornament } from "@/lib/api";
import type { GlobeTheme } from "@/lib/theme";
import { isBgmOn, isBgmOnServer, subscribeBgm, toggleBgm } from "@/lib/bgm";
import { IconButton } from "@/components/ui/Button";
import StageFallback from "./StageFallback";
import type { GlobeLayout } from "./StageScene";

// 소리 버튼 (차명근 연결): 배경 음악을 켜고 끕니다. 재생은 lib/bgm.ts 가 맡습니다.
const SHOW_SOUND = true;

const StageScene = dynamic(() => import("./StageScene"), {
  ssr: false,
  loading: () => <StageFallback message="스노우볼을 불러오고 있어요" />,
});

// 스노우볼은 제목과 아래쪽 UI 사이 빈 공간(위아래 24px 여백)을 꽉 채울 만큼 크게 그립니다.
// height 는 상한 역할만 하고, 실제 크기는 빈 공간과 화면 너비 중 좁은 쪽에 맞춰집니다 (StageScene 의 getSafeArea).
const DESKTOP: GlobeLayout = { height: 0.9, centerFromTop: 0.45 };
const MOBILE: GlobeLayout = { height: 0.9, centerFromTop: 0.46 };

const HINT_PILL =
  "max-w-full rounded-full bg-night-900/75 px-4 py-1.5 text-center text-[15px] font-medium text-ink shadow-[0_4px_12px_rgba(0,0,0,0.35)] backdrop-blur-sm";

type MotionPermission = { requestPermission?: () => Promise<"granted" | "denied"> };

export type StageProps = {
  theme: GlobeTheme;
  ornaments?: (Pick<Ornament, "id" | "color"> & { shape?: string })[];
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
  onSelectOrnament?: (id: string) => void; // 오너먼트를 눌렀을 때 (주인 화면)
  extraShake?: number; // 바깥에서 눈을 날리고 싶을 때 이 값을 늘립니다 (예: 스노우볼 열기)
  arrivingId?: string; // 지금 막 달리는 오너먼트
  focusId?: string; // 이 오너먼트가 정면에 오도록 스노우볼을 돌립니다
  lockFront?: boolean;
  holdGlobe?: boolean; // 휴대폰에서 스노우볼을 직전 크기 · 자리에 그대로 두고, 아래쪽 UI 가 그 위로 올라오게 합니다 (12 메시지 쓰기)
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
  const { theme, ornaments, title, subtitle, display, hint, hintMobile, plate, pin, pinKey, pinId, highlightId, arrivingId, focusId, lockFront, holdGlobe, children, below, onSelectOrnament, extraShake = 0 } = props;
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [mobile, setMobile] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [shakeSignal, setShakeSignal] = useState(0);
  const soundOn = useSyncExternalStore(subscribeBgm, isBgmOn, isBgmOnServer); // 배경 음악을 켜 둔 상태인지
  const lastShake = useRef(0);
  const plateEl = useRef<HTMLDivElement>(null);
  const mainEl = useRef<HTMLElement>(null);
  const sceneEl = useRef<HTMLDivElement>(null);
  const headerEl = useRef<HTMLElement>(null);
  const footerEl = useRef<HTMLElement>(null);
  const [keyboard, setKeyboard] = useState(false); // 휴대폰 화면 키보드가 올라와 있는지
  const hold = useRef(false);
  const heldArea = useRef<{ top: number; bottom: number; plateHalf: number; width: number } | null>(null);

  // 아래쪽 UI 가 바뀐 화면이 그려지기 전에 켜야, 바뀐 UI 로 빈 공간을 다시 재지 않습니다
  useLayoutEffect(() => {
    hold.current = !!holdGlobe && mobile;
  }, [holdGlobe, mobile]);

  // 3D 장면이 매 프레임 묻는 "UI 사이 빈 공간" (제목 아래 끝 ~ 아래쪽 UI 위 끝, 3D 무대 위 끝에서부터 px)
  const getSafeArea = useCallback(() => {
    // 스노우볼을 그대로 두는 단계: 직전에 잰 빈 공간을 그대로 돌려줍니다 (화면 너비가 바뀌면 다시 잽니다)
    const held = heldArea.current;
    if (hold.current && held && held.width === window.innerWidth) return held;
    const head = headerEl.current?.getBoundingClientRect();
    const foot = footerEl.current?.getBoundingClientRect();
    if (!head || !foot) return null;
    const sceneTop = sceneEl.current?.getBoundingClientRect().top ?? 0;
    const area = {
      top: head.bottom - sceneTop,
      bottom: foot.top - sceneTop,
      plateHalf: (plateEl.current?.offsetHeight ?? 0) / 2,
      width: window.innerWidth,
    };
    if (!hold.current) heldArea.current = area;
    return area;
  }, []);

  // 화면 키보드 (FEEDBACK A2).
  // 아이폰은 키보드가 올라와도 화면 높이(dvh)가 그대로이고, 대신 보이는 영역이 입력칸 쪽으로 밀려 올라갑니다.
  // 그래서 보이는 영역(visualViewport)의 위치 · 높이를 읽어,
  //   - UI 층은 보이는 영역 안에 다시 맞추고 (--vv-top · --vv-h)
  //   - 3D 무대는 밀려 올라간 만큼 내려서 제자리에 보이게 합니다.
  // 키보드가 올라온 동안 main 에 data-kb 가 붙고, 덜 중요한 요소는 kb: 로 숨겨 자리를 만듭니다 (globals.css).
  useEffect(() => {
    const vv = window.visualViewport;
    const el = mainEl.current;
    if (!vv || !el) return;
    let width = vv.width;
    let full = vv.height; // 키보드가 없을 때의 높이
    let frame = 0;
    const apply = () => {
      frame = 0;
      if (Math.abs(vv.width - width) > 1) {
        width = vv.width; // 화면을 돌렸으면 다시 잽니다
        full = vv.height;
      }
      const zoomed = vv.scale > 1.01; // 페이지를 손가락으로 확대한 경우는 키보드가 아닙니다
      if (!zoomed) full = Math.max(full, vv.height);
      const active = document.activeElement;
      const typing = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement;
      const open = typing && !zoomed && full - vv.height > 120;
      if (open) {
        const top = Math.max(0, vv.offsetTop - el.getBoundingClientRect().top);
        el.style.setProperty("--vv-top", `${top}px`);
        el.style.setProperty("--vv-h", `${vv.height}px`);
      } else {
        el.style.removeProperty("--vv-top");
        el.style.removeProperty("--vv-h");
      }
      setKeyboard(open);
    };
    const queue = () => {
      if (!frame) frame = requestAnimationFrame(apply);
    };
    vv.addEventListener("resize", queue);
    vv.addEventListener("scroll", queue);
    window.addEventListener("focusin", queue);
    window.addEventListener("focusout", queue);
    return () => {
      cancelAnimationFrame(frame);
      vv.removeEventListener("resize", queue);
      vv.removeEventListener("scroll", queue);
      window.removeEventListener("focusin", queue);
      window.removeEventListener("focusout", queue);
    };
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

  // 휴대폰 흔들기. 아이폰은 화면을 눌렀다 뗄 때 "동작 및 방향 접근" 권한을 묻습니다. (FEEDBACK A3)
  // 아이폰 사파리는 손이 닿는 순간(pointerdown · touchstart)에는 권한 창을 띄워 주지 않고,
  // 눌렀다 뗀 동작(touchend · click)에서만 띄워 줍니다. 허용이든 거부든 답이 정해질 때까지 누를 때마다 다시 묻습니다.
  useEffect(() => {
    const onMotion = (e: DeviceMotionEvent) => {
      const a = e.acceleration ?? e.accelerationIncludingGravity;
      if (!a) return;
      const force = Math.hypot(a.x ?? 0, a.y ?? 0, a.z ?? 0);
      if (force > (e.acceleration ? 14 : 24)) shake();
    };
    const stopAsking = () => {
      window.removeEventListener("touchend", ask);
      window.removeEventListener("click", ask);
    };
    let asking = false; // 권한 창이 떠 있는 동안에는 다시 묻지 않습니다 (한 번 누르면 touchend 와 click 이 연달아 옵니다)
    function ask() {
      const Motion = (window as unknown as { DeviceMotionEvent?: MotionPermission }).DeviceMotionEvent;
      if (!Motion?.requestPermission) return stopAsking(); // 권한을 묻지 않는 기기(안드로이드 · PC)
      if (asking) return;
      asking = true;
      Motion.requestPermission()
        .then(stopAsking) // 허용 · 거부가 정해졌습니다. 거부해도 드래그와 눈 버튼으로 눈을 내릴 수 있습니다
        .catch(() => {
          // 브라우저가 이번 동작을 "누른 것"으로 인정하지 않았습니다. 다음에 누를 때 다시 묻습니다
        })
        .finally(() => {
          asking = false;
        });
    }
    window.addEventListener("devicemotion", onMotion);
    window.addEventListener("touchend", ask);
    window.addEventListener("click", ask);
    return () => {
      window.removeEventListener("devicemotion", onMotion);
      stopAsking();
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
    <main ref={mainEl} data-kb={keyboard ? "" : undefined} className="relative h-dvh w-full overflow-hidden">
      {/* 뒤: 3D 무대 + 무대를 따라다니는 명판 · 말풍선. 키보드에 밀려 올라간 만큼 내려 제자리에 보이게 합니다 */}
      <div ref={sceneEl} className="absolute inset-0 z-0 [translate:0_var(--vv-top,0px)]">
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
            onSelectOrnament={onSelectOrnament}
            arrivingId={arrivingId}
            focusId={focusId}
            getSafeArea={getSafeArea}
            onPinMove={pin ? movePin : undefined}
            lockFront={lockFront}
            shakeSignal={shakeSignal + extraShake}
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
      </div>

      {/* 앞: UI */}
      <div className="pointer-events-none absolute inset-x-0 top-[var(--vv-top,0px)] z-10 flex h-[var(--vv-h,100%)] flex-col px-4 pb-[max(env(safe-area-inset-bottom),20px)] pt-4 kb:pb-3 kb:pt-3 sm:px-8 sm:pb-8 sm:pt-8">
        <div className="pointer-events-auto absolute left-4 top-4 kb:hidden sm:left-8 sm:top-8">
          <IconButton icon="maximize" label="전체 화면" onClick={toggleFullscreen} />
        </div>
        <div className="pointer-events-auto absolute right-4 top-4 flex gap-2 kb:hidden sm:right-8 sm:top-8">
          {SHOW_SOUND && (
            <IconButton
              icon={soundOn ? "volume" : "volume-off"}
              label={soundOn ? "소리 끄기" : "소리 켜기"}
              aria-pressed={soundOn}
              onClick={toggleBgm}
            />
          )}
          <IconButton icon="snowflake" label="눈 내리기" onClick={shake} />
        </div>

        {/* 키보드가 올라오면 제목은 접어 둡니다 (자리는 남겨 스노우볼 위치 계산에 씁니다) */}
        <header ref={headerEl} key={title} className="mx-auto mt-14 max-w-[900px] animate-fade text-center kb:mt-0 kb:h-0 kb:overflow-hidden sm:mt-1.5">
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

        <footer ref={footerEl} className="flex min-h-0 flex-col items-center gap-3">
          {/* 안내 문구는 받침대 위에 겹칠 때가 있어, 어두운 알약 바탕을 깔아 어디서든 읽히게 합니다 */}
          {(hintMobile ?? hint) && <p className={`${HINT_PILL} kb:hidden sm:hidden`}>{hintMobile ?? hint}</p>}
          {hint && <p className={`${HINT_PILL} hidden sm:block`}>{hint}</p>}
          {children}
          {below && <div className="contents kb:hidden">{below}</div>}
        </footer>
      </div>
    </main>
  );
}
