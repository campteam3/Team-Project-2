"use client";

import dynamic from "next/dynamic";
import { Component, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

// 오류 안내와 홈 링크는 3D 다운로드를 기다리지 않습니다.
const Scene = dynamic(() => import("./LostSnowmanScene"), {
  ssr: false,
  loading: () => <SnowmanFallback />,
});

function subscribeMotion(callback: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}
function subscribeVisibility(callback: () => void) {
  document.addEventListener("visibilitychange", callback);
  return () => document.removeEventListener("visibilitychange", callback);
}

function SnowmanFallback() {
  return (
    <svg className="lost-fallback" viewBox="0 0 440 420" fill="none" aria-hidden="true">
      <g transform="rotate(-12 218 210)">
        <ellipse cx="214" cy="263" rx="65" ry="73" fill="#E3EAE8" />
        <circle cx="214" cy="166" r="45" fill="#F5F1EA" />
        <path d="M170 154a44 44 0 0 1 88 0" fill="#C85B60" />
        <rect x="167" y="147" width="94" height="17" rx="8" fill="#A13D4A" />
        <circle cx="214" cy="105" r="12" fill="#E79794" />
        <circle cx="202" cy="180" r="3.5" fill="#263349" />
        <circle cx="229" cy="180" r="3.5" fill="#263349" />
        <path d="m215 185 28 8-28 3z" fill="#EAAA69" />
        <path d="M207 204q9 7 17 0" stroke="#526170" strokeWidth="3" strokeLinecap="round" />
        <path d="m163 247-31-34-15 2m15-2 3-16m124 50 30-41 16 2m-16-2-1-17" stroke="#A58976" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="172" y="209" width="85" height="20" rx="10" fill="#5A9F9F" />
        <rect x="236" y="219" width="20" height="45" rx="8" fill="#77B3AE" transform="rotate(-12 236 219)" />
        <circle cx="214" cy="256" r="4" fill="#526170" />
        <circle cx="214" cy="279" r="4" fill="#526170" />
      </g>
      <path d="m85 97 7 17 18 2-14 12 4 18-16-10-16 10 5-18-14-12 18-2z" fill="#F2C46D" />
      <circle cx="347" cy="154" r="23" fill="#CA666D" />
      <rect x="340" y="126" width="14" height="9" rx="3" fill="#E3CA95" />
      <g transform="rotate(19 340 300)">
        <rect x="307" y="278" width="66" height="45" rx="5" fill="#F0DDC0" />
        <path d="m309 281 31 23 31-23" stroke="#B59879" strokeWidth="2" />
      </g>
      <circle cx="95" cy="296" r="17" fill="#77B3AE" />
    </svg>
  );
}

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <SnowmanFallback /> : this.props.children; }
}

// 눈사람을 누르면 말풍선이 차례로 저절로 넘어갑니다. 다 끝나면 처음 말로 돌아옵니다.
const IDLE_LINE = "저도 길을 잃었어요…";
const TALK_LINES = ["안녕하세요!", "저도 여기서 길을 잃었어요…", "그래도 만나서 반가워요.", "처음으로 가면 스노우볼을 만들 수 있어요!"];
const LINE_MS = 2400;

export default function LostSnowman() {
  const [line, setLine] = useState(-1); // -1 = 처음 말, 0~ = 인사 중
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const reducedMotion = useSyncExternalStore(subscribeMotion, () => window.matchMedia("(prefers-reduced-motion: reduce)").matches, () => true);
  const visible = useSyncExternalStore(subscribeVisibility, () => document.visibilityState === "visible", () => false);
  const animate = !reducedMotion && visible;
  const talking = line >= 0;

  const play = (index: number) => {
    clearTimeout(timer.current);
    setLine(index);
    timer.current = setTimeout(() => play(index + 1 < TALK_LINES.length ? index + 1 : -1), LINE_MS);
  };
  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <figure className="lost-figure">
      <div key={line} className="lost-speech animate-fade" role="status" aria-live="polite" aria-atomic="true">
        {talking ? TALK_LINES[line] : IDLE_LINE}
      </div>
      <button type="button" className="lost-illustration" onClick={() => play(0)} aria-label="눈사람에게 인사하기">
        <span className="lost-orbit" aria-hidden="true" />
        <span className="lost-canvas" aria-hidden="true">
          <SceneBoundary>
            <Scene animate={animate} greeted={talking} fallback={<SnowmanFallback />} />
          </SceneBoundary>
        </span>
        <span className="lost-hint">
          눈사람에게 인사해 보세요<span aria-hidden="true"> ↗</span>
        </span>
      </button>
    </figure>
  );
}
