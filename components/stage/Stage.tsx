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
import { saveGlobeImage } from "@/lib/save-image";
import { IconButton } from "@/components/ui/Button";
import SavedImage from "./SavedImage";
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

// 화면 키보드 높이: 한 번 올라온 뒤에는 그 값을 기억해 다음에 미리 맞춥니다. 처음에는 어림값을 씁니다.
const KEYBOARD_GUESS = 300;
const KEYBOARD_KEY = "snowglobe:keyboard";
let lastKeyboard = 0;
// 화면 키보드가 없는 기기 (차명근): PC 브라우저의 휴대폰 모드(F12)는 손가락 입력을 흉내 내서 위의 예상이 켜지는데,
// 키보드는 올라오지 않아 입력칸만 1.2초 동안 위로 튀었다가 돌아옵니다. 그래서
//  - Windows 에서는 처음부터 예상하지 않습니다 (휴대폰 모드여도 운영체제 이름은 Windows 로 남습니다)
//  - 그 밖의 기기도, 예상했는데 키보드가 올라오지 않은 적이 있으면 기억해 두고 다음부터 예상하지 않습니다
//    (맥의 휴대폰 모드, 블루투스 키보드를 쓰는 태블릿 등). 키보드가 실제로 올라오면 기억을 지우고 다시 예상합니다.
// 예상하지 않아도 키보드가 실제로 올라오면 그때 맞추므로, 화면이 가려지지는 않습니다.
const NO_KEYBOARD_KEY = "snowglobe:no-keyboard";
// 키보드 위에 떠 있는 줄(이전 · 다음 · 완료)처럼 입력칸을 가리는 높이. 브라우저가 화면을 민 만큼으로 알아냅니다.
let keyboardClear = 0;

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
  plate?: ReactNode; // 받침대 명판에 붙일 내용 (닉네임 입력칸처럼 누르거나 적는 것)
  plateText?: string; // 받침대 명판에 새길 이름. 3D 명판 면에 그려져 스노우볼과 함께 돕니다 (plate 가 있으면 plate 가 먼저)
  pin?: ReactNode; // 오너먼트 하나 위에 띄울 내용 (예시 말풍선)
  pinKey?: number; // 바뀔 때마다 앞쪽 오너먼트를 새로 고릅니다
  pinId?: string; // 말풍선을 붙일 오너먼트를 직접 정할 때
  scene?: ReactNode; // 주면 스노우볼 대신 이 3D 장면을 무대에 그립니다 (기념 메시지의 "오너먼트 하나만 크게", FEEDBACK F1, 차명근)
  morePinIds?: string[]; // 같은 말풍선(pin)을 더 붙일 오너먼트들 (친구가 먼저 단 내 오너먼트, FEEDBACK A6)
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
  saveAs?: string; // 값을 주면 위쪽에 "이미지로 저장" 버튼이 생깁니다. 저장할 파일 이름으로 씁니다 (FEEDBACK E4, 차명근)
  onNotice?: (message: string) => void; // 저장 결과 알림을 띄울 함수 (화면의 useNotice 에서 받은 say)
  notice?: string; // 잠깐 뜨는 알림 ("링크를 복사했어요"). 안내 알약 자리에 같은 모양으로 뜹니다 (useNotice). 알림을 쓰는 화면은 없을 때 "" 를 넘깁니다
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
  const { theme, ornaments, title, subtitle, display, hint, hintMobile, plate, plateText, pin, pinKey, pinId, morePinIds, highlightId, arrivingId, focusId, lockFront, holdGlobe, children, below, notice, saveAs, onNotice, onSelectOrnament, extraShake = 0, scene } = props;
  const hasScene = !!scene;
  // 명판에 새길 이름은 3D 명판 면에 직접 그립니다 (FEEDBACK B4: 글자가 명판에 붙어 함께 돌게).
  // 같은 글자를 보이지 않게 화면에도 두어 명판이 아래쪽 UI 와 겹치지 않게 재는 데 쓰고, 3D 를 못 쓰는 기기에서는 이 글자를 보여 줍니다.
  const engraved = !plate && !!plateText;
  const plateContent =
    plate ?? (plateText ? <span className="plate-text pointer-events-none text-[15px] font-bold text-night-900">{plateText}</span> : undefined);
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [mobile, setMobile] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  // 스노우볼을 만지기 시작하면(돌리기 · 확대) 안내 문구를 흐리게 물려, 받침대와 명판을 가리지 않게 합니다 (FEEDBACK A4).
  // 어느 안내 문구에서 물렸는지 기억해서, 문구가 바뀌면(다음 단계) 다시 보입니다.
  const [quietHint, setQuietHint] = useState<string | null>(null);
  const hintKey = `${hint ?? ""}|${hintMobile ?? ""}`;
  const quiet = quietHint === hintKey;
  const [shakeSignal, setShakeSignal] = useState(0);
  const soundOn = useSyncExternalStore(subscribeBgm, isBgmOn, isBgmOnServer); // 배경 음악을 켜 둔 상태인지
  const [saving, setSaving] = useState(false); // 이미지를 만드는 중인지
  const [savedUrl, setSavedUrl] = useState(""); // 화면에 띄울 저장용 이미지 (공유 창을 열 수 없는 휴대폰 브라우저에서만)
  const closeSaved = useCallback(() => setSavedUrl(""), []);

  // 이미지로 저장 (FEEDBACK E4): 3D 무대에 지금 보이는 모습을 한 장으로 만듭니다 (lib/save-image.ts)
  const saveImage = async () => {
    const canvas = sceneEl.current?.querySelector("canvas");
    if (!canvas || !saveAs || saving) return;
    setSaving(true);
    const result = await saveGlobeImage(canvas, saveAs);
    setSaving(false);
    if (result.status === "downloaded") onNotice?.("이미지를 저장했어요");
    else if (result.status === "show") setSavedUrl(result.url);
    else if (result.status === "failed") onNotice?.("이미지를 만들지 못했어요. 다시 시도해 주세요");
  };
  const lastShake = useRef(0);
  const plateEl = useRef<HTMLDivElement>(null);
  const mainEl = useRef<HTMLElement>(null);
  const sceneEl = useRef<HTMLDivElement>(null);
  const fixedEl = useRef<HTMLDivElement>(null);
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
    let open = false;
    let guessedAt = 0; // 키보드가 올라올 것을 미리 예상한 시각 (0: 예상 안 함, -1: 이번 입력칸에서는 다시 예상하지 않음)
    const coarse = window.matchMedia("(pointer: coarse)"); // 손가락으로 쓰는 기기
    const still = window.matchMedia("(prefers-reduced-motion: reduce)"); // 움직임 줄이기
    // 전에 이 기기에서 잰 키보드 높이가 있으면 처음부터 그 값으로 맞춥니다 (같은 화면 방향일 때만)
    if (!lastKeyboard) {
      try {
        const [w, h] = (localStorage.getItem(KEYBOARD_KEY) ?? "").split(":").map(Number);
        if (w === Math.round(width) && h > 120) lastKeyboard = h;
      } catch {
        // 읽지 못하면 어림값을 씁니다
      }
    }
    let noKeyboard = /^win/i.test(navigator.platform);
    if (!noKeyboard) {
      try {
        noKeyboard = localStorage.getItem(NO_KEYBOARD_KEY) === "1";
      } catch {
        // 읽지 못하면 예상합니다
      }
    }
    const rememberNoKeyboard = (value: boolean) => {
      noKeyboard = value;
      try {
        if (value) localStorage.setItem(NO_KEYBOARD_KEY, "1");
        else localStorage.removeItem(NO_KEYBOARD_KEY);
      } catch {
        // 저장하지 못해도 이번 화면에서는 기억합니다
      }
    };
    let touchedAt = -1e9; // 마지막으로 화면을 누른 시각과 누른 곳
    let touched: EventTarget | null = null;
    let realAt = 0; // 키보드가 실제로 다 올라온 것을 처음 본 시각
    let heldTop = 0; // 지금 UI 를 내려 둔 값
    let pulls = 0; // 이번에 키보드가 올라온 뒤 화면을 제자리로 되돌린 횟수
    let pulledAt = 0;
    // 기기에서 값을 직접 볼 때: 주소 끝에 vvdebug 를 붙이면 화면 위쪽에 숫자가 보입니다 (예: /new?preview=1&vvdebug)
    let debug: HTMLElement | null = null;
    if (window.location.search.includes("vvdebug")) {
      debug = document.createElement("pre");
      debug.style.cssText = "position:fixed;left:4px;top:4px;z-index:99;margin:0;padding:4px 6px;background:#000c;color:#0f0;font:11px/1.3 monospace;pointer-events:none";
      el.appendChild(debug);
    }
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
      const now = performance.now();
      const real = typing && !zoomed && full - vv.height > 120; // 실제로 올라옴
      if (real) {
        guessedAt = 0;
        if (noKeyboard) rememberNoKeyboard(false); // 키보드가 실제로 올라오는 기기입니다
        if (Math.abs(lastKeyboard - (full - vv.height)) > 1) {
          lastKeyboard = full - vv.height;
          try {
            localStorage.setItem(KEYBOARD_KEY, `${Math.round(width)}:${Math.round(lastKeyboard)}`);
          } catch {
            // 저장하지 못해도 이번 화면에서는 기억합니다
          }
        }
      } else if (!typing) guessedAt = 0;
      else if (guessedAt > 0 && now - guessedAt > 1200) {
        guessedAt = -1; // 예상했지만 올라오지 않음 (블루투스 키보드, PC 의 휴대폰 모드 등)
        rememberNoKeyboard(true);
      }
      const wasOpen = open;
      open = real || (typing && guessedAt > 0);
      // 카드가 스노우볼 위에 떠 있는 단계(12 메시지 쓰기)에서는, 키보드가 올라올 때 카드가 한 번에 튀어 보이지 않게
      // 새 자리에서 서서히 나타나게 합니다. 얼마나 옮겨졌는지 알려고 옮기기 전 위치를 먼저 재 둡니다.
      const foot = footerEl.current;
      const fade = open && !wasOpen && hold.current && !!foot && !still.matches;
      const footBefore = fade ? foot.getBoundingClientRect().top : 0;
      // 처음 올라올 때는 바로 맞추고(브라우저가 화면을 밀기 전에 끝나야 함), 그 뒤 높이가 바뀌거나 내려갈 때는 부드럽게 움직입니다
      el.style.setProperty("--vv-t", open && !wasOpen ? "0ms" : "220ms");
      el.toggleAttribute("data-kb", open);
      if (open && !wasOpen) el.style.setProperty("--kb-clear", `${keyboardClear}px`);
      if (!real) realAt = 0;
      else if (!realAt) realAt = now;
      const settled = real && now - realAt > 500; // 키보드가 다 올라오고 자리를 잡은 뒤
      if (open) {
        // 1) 밀려 올라간 화면을 제자리로 되돌려 봅니다. UI 를 보이는 영역 안에 맞췄으므로 되돌려도 입력칸은 보입니다.
        //    (브라우저가 다시 밀어 올리면 서로 다투지 않게 횟수와 간격을 제한합니다)
        if (!settled && (vv.offsetTop > 1 || window.scrollY > 1) && pulls < 8 && now - pulledAt > 250) {
          pulls += 1;
          pulledAt = now;
          window.scrollTo(0, 0);
        }
        // 2) 그래도 밀려 있으면 그만큼 UI 와 무대를 내립니다.
        //    좌표 기준이 브라우저마다 달라서(보이는 영역 기준 / 화면 전체 기준), 화면에 고정된 기준점(fixedEl)으로 보정합니다.
        const origin = fixedEl.current?.getBoundingClientRect().top ?? 0;
        const pushed = Math.max(0, Math.round(vv.offsetTop + origin - el.getBoundingClientRect().top));
        // 3) 자리를 잡은 뒤 입력칸을 옮길 때 브라우저가 조금 미는 것은 그대로 둡니다 (되돌리면 서로 다퉈서 끊겨 보입니다).
        //    대신 밀린 만큼을 기억해 두었다가, 다음에 키보드가 올라올 때 아래 여백으로 미리 비워 밀리지 않게 합니다.
        const drift = pushed - heldTop;
        if (settled && Math.abs(drift) <= 120) {
          if (drift > 3) keyboardClear = Math.min(96, Math.max(keyboardClear, drift + 8));
        } else heldTop = pushed;
        el.style.setProperty("--vv-top", `${heldTop}px`);
        // 아직 올라오는 중이면 지난번 키보드 높이(처음이면 어림값)로 미리 맞춥니다
        const height = real ? vv.height : Math.max(220, full - (lastKeyboard || KEYBOARD_GUESS));
        el.style.setProperty("--vv-h", `${Math.round(height)}px`);
        if (fade && footBefore - foot.getBoundingClientRect().top > 8) {
          // 자리는 바로 옮기고(입력칸 위치가 처음부터 맞아야 브라우저가 화면을 밀지 않습니다) 새 자리에서 서서히 나타납니다.
          // 미끄러져 올라오게도 해 봤지만, 움직이는 도중 화면이 밀려 덜컥거렸습니다 (아이폰에서 김미영 확인)
          foot.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: "ease-out" });
        }
        // 키보드가 올라와 있는 동안에는 매 프레임 다시 잽니다 (앱 안 브라우저는 밀림이 바뀌어도 알려 주지 않을 때가 있습니다)
        frame = requestAnimationFrame(apply);
      } else {
        pulls = 0;
        heldTop = 0;
        el.style.removeProperty("--kb-clear");
        el.style.removeProperty("--vv-top");
        el.style.removeProperty("--vv-h");
      }
      if (debug) {
        const origin = fixedEl.current?.getBoundingClientRect().top ?? 0;
        debug.textContent = `open ${open} guess ${guessedAt > 0} nokb ${noKeyboard} kb ${lastKeyboard.toFixed(0)} clear ${keyboardClear} held ${heldTop} pulls ${pulls}
vv top ${vv.offsetTop.toFixed(0)} h ${vv.height.toFixed(0)} full ${full.toFixed(0)}
scrollY ${window.scrollY.toFixed(0)} inner ${window.innerHeight}
main ${el.getBoundingClientRect().top.toFixed(0)} fixed ${origin.toFixed(0)}
--vv-top ${el.style.getPropertyValue("--vv-top") || "-"}`;
      }
      setKeyboard(open);
    };
    const queue = () => {
      if (!frame) frame = requestAnimationFrame(apply);
    };
    // 입력칸을 누른 바로 그 순간에 키보드 자리를 비워 둡니다.
    // 키보드가 다 올라온 뒤에 맞추면, 브라우저가 먼저 화면을 밀어 올렸다가 우리가 다시 옮겨서 두 번 움직여 끊겨 보입니다.
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target;
      const input = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
      // 손가락으로 그 입력칸(또는 입력칸을 감싼 이름표)을 방금 누른 경우만 예상합니다.
      // 화면이 열리며 저절로 잡히는 초점은 키보드를 올리지 않습니다.
      const tapped =
        touched instanceof Node &&
        performance.now() - touchedAt < 700 &&
        (target === touched || !!(target as Element).closest("label")?.contains(touched));
      if (input && coarse.matches && !noKeyboard && !open && tapped) {
        guessedAt = performance.now();
        cancelAnimationFrame(frame);
        apply();
      } else queue();
    };
    const onTouch = (event: Event) => {
      touchedAt = performance.now();
      touched = event.target;
    };
    window.addEventListener("pointerdown", onTouch, true);
    window.addEventListener("pointerup", onTouch, true);
    vv.addEventListener("resize", queue);
    vv.addEventListener("scroll", queue);
    window.addEventListener("focusin", onFocusIn);
    window.addEventListener("focusout", queue);
    return () => {
      cancelAnimationFrame(frame);
      debug?.remove();
      vv.removeEventListener("resize", queue);
      vv.removeEventListener("scroll", queue);
      window.removeEventListener("pointerdown", onTouch, true);
      window.removeEventListener("pointerup", onTouch, true);
      window.removeEventListener("focusin", onFocusIn);
      window.removeEventListener("focusout", queue);
    };
  }, []);
  const pinEl = useRef<HTMLDivElement>(null);
  const morePinEls = useRef<(HTMLDivElement | null)[]>([]);

  const movePin = useCallback((x: number, y: number, visibility: number, slot = 0) => {
    const el = slot === 0 ? pinEl.current : morePinEls.current[slot - 1];
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
    if (hasScene) return; // 스노우볼이 없는 장면(기념 메시지)에서는 흔들기를 쓰지 않으므로 권한도 묻지 않습니다
    window.addEventListener("devicemotion", onMotion);
    window.addEventListener("touchend", ask);
    window.addEventListener("click", ask);
    return () => {
      window.removeEventListener("devicemotion", onMotion);
      stopAsking();
    };
  }, [shake, hasScene]);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => {});
  };

  const layout: GlobeLayout = mobile
    ? { ...MOBILE, ...props.layout?.mobile }
    : { ...DESKTOP, ...props.layout?.desktop };

  const mobileHint = hintMobile ?? hint;
  // 알림이 떠 있을 때는 항상 또렷하게, 안내만 있을 때는 스노우볼을 만지는 동안 흐리게
  const pillFade = `transition-opacity duration-400 ${quiet && !notice ? "opacity-0" : "opacity-100"}`;

  return (
    <main ref={mainEl} data-kb={keyboard ? "" : undefined} className="relative h-dvh w-full overflow-hidden">
      {/* 화면에 고정된 기준점 (키보드에 밀린 정도를 잴 때 씁니다) */}
      <div ref={fixedEl} className="pointer-events-none fixed left-0 top-0 size-0" aria-hidden="true" />
      {/* 뒤: 3D 무대 + 무대를 따라다니는 명판 · 말풍선. 키보드에 밀려 올라간 만큼 내려 제자리에 보이게 합니다 */}
      <div
        ref={sceneEl}
        className="absolute inset-0 z-0 [translate:0_var(--vv-top,0px)]"
        onPointerDown={() => setQuietHint(hintKey)}
        onWheel={() => setQuietHint(hintKey)}
      >
      <div className="absolute inset-0 z-0">
        {webgl === false ? (
          scene ? (
            <StageFallback />
          ) : (
            <StageFallback plate={plateContent} centerFromTop={layout.centerFromTop} height={layout.height} />
          )
        ) : webgl && scene ? (
          scene
        ) : webgl ? (
          <StageScene
            theme={theme}
            ornaments={ornaments}
            layout={layout}
            plateText={engraved ? plateText : undefined}
            onPlateMove={plateContent ? movePlate : undefined}
            pinKey={pinKey}
            pinId={pinId}
            morePinIds={pin ? morePinIds : undefined}
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
      {plateContent && webgl && !scene && (
        <div ref={plateEl} className={`absolute left-0 top-0 z-[5] opacity-0 will-change-transform ${engraved ? "invisible" : ""}`}>
          {plateContent}
        </div>
      )}

      {/* 예시 말풍선: 3D 오너먼트 위치를 따라갑니다 */}
      {pin && webgl && !scene && (
        <div ref={pinEl} className="pointer-events-none absolute left-0 top-0 z-[6] opacity-0 transition-opacity duration-400 will-change-transform">
          {pin}
        </div>
      )}
      {pin &&
        webgl &&
        !scene &&
        morePinIds?.map((id, i) => (
          <div
            key={id}
            ref={(el) => {
              morePinEls.current[i] = el;
            }}
            className="pointer-events-none absolute left-0 top-0 z-[6] opacity-0 transition-opacity duration-400 will-change-transform"
          >
            {pin}
          </div>
        ))}
      </div>

      {/* 앞: UI */}
      <div className="pointer-events-none absolute inset-x-0 top-[var(--vv-top,0px)] z-10 flex h-[var(--vv-h,100%)] flex-col [transition:height_var(--vv-t,0ms)_var(--ease-soft)] px-4 pb-[max(env(safe-area-inset-bottom),20px)] pt-4 kb:pb-[calc(0.75rem+var(--kb-clear,0px))] kb:pt-3 sm:px-8 sm:pb-8 sm:pt-8">
        {/* 전체 화면 버튼은 넓은 화면에서만 보입니다. 휴대폰은 이미 화면을 꽉 채우고, 아이폰은 전체 화면이 되지 않습니다 (FEEDBACK C6) */}
        <div className="pointer-events-auto absolute left-8 top-8 max-sm:hidden kb:hidden">
          <IconButton icon="maximize" label="전체 화면" onClick={toggleFullscreen} />
        </div>
        <div className="pointer-events-auto absolute right-4 top-4 flex gap-2 kb:hidden sm:right-8 sm:top-8">
          {saveAs && webgl && <IconButton icon="download" label="이미지로 저장" disabled={saving} onClick={saveImage} />}
          {SHOW_SOUND && (
            <IconButton
              icon={soundOn ? "volume" : "volume-off"}
              label={soundOn ? "소리 끄기" : "소리 켜기"}
              aria-pressed={soundOn}
              onClick={toggleBgm}
            />
          )}
          {/* 스노우볼이 없는 장면(scene)에서는 눈 버튼을 숨깁니다 */}
          {!scene && <IconButton icon="snowflake" label="눈 내리기" onClick={shake} />}
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
          {/* 알림(notice)은 안내 알약 자리에 같은 모양으로 잠깐 떴다가 원래 안내로 돌아옵니다.
              안내가 없는 화면도 알림을 쓰면 자리를 미리 비워 둡니다. 알림이 뜰 때 스노우볼이 밀리거나 명판을 가리지 않습니다 */}
          <p role="status" className="sr-only">
            {notice}
          </p>
          {(mobileHint || notice !== undefined) && (
            <p
              key={notice ? "notice" : "hint"}
              aria-hidden={!!notice}
              className={`${HINT_PILL} ${pillFade} kb:hidden sm:hidden ${notice || mobileHint ? "" : "invisible"}`}
            >
              {notice || mobileHint || "\u00a0"}
            </p>
          )}
          {(hint || notice !== undefined) && (
            <p
              key={notice ? "notice-wide" : "hint-wide"}
              aria-hidden={!!notice}
              className={`${HINT_PILL} ${pillFade} hidden sm:block ${notice || hint ? "" : "invisible"}`}
            >
              {notice || hint || "\u00a0"}
            </p>
          )}
          {children}
          {below && <div className="contents kb:hidden">{below}</div>}
        </footer>
      </div>
      {savedUrl && saveAs && <SavedImage url={savedUrl} name={saveAs} onClose={closeSaved} />}
    </main>
  );
}
