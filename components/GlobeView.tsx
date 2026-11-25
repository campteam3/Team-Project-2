"use client";

// 스노우볼 보기 화면의 실험 버전입니다. 샘플 데이터를 씁니다.

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { SAMPLE_ORNAMENTS } from "@/lib/sample-data";
import type { GlobeOrnament, OrnamentShape } from "@/lib/snowglobe";

// 샘플 메시지에는 아직 모양이 없어서, 화면 확인용으로 볼·별·하트를 번갈아 붙입니다.
const DEMO_SHAPES: OrnamentShape[] = ["ball", "star", "heart", "ball", "ball"];
const DEMO_ORNAMENTS: GlobeOrnament[] = SAMPLE_ORNAMENTS.map((ornament, index) => ({
  ...ornament,
  shape: DEMO_SHAPES[index % DEMO_SHAPES.length],
}));

// 3D 장면은 브라우저에서만 그립니다.
const SnowGlobeScene = dynamic(() => import("./SnowGlobeScene"), {
  ssr: false,
  loading: () => <p className="text-sm text-slate-300">스노우볼을 불러오는 중…</p>,
});

type MotionPermission = { requestPermission?: () => Promise<"granted" | "denied"> };

export default function GlobeView() {
  const { id } = useParams<{ id: string }>();
  const [shakeSignal, setShakeSignal] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const lastShake = useRef(0);

  const ornaments = DEMO_ORNAMENTS;
  const selected = ornaments.find((ornament) => ornament.id === selectedId) ?? null;

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

  return (
    <main className="flex min-h-dvh flex-col items-center bg-gradient-to-b from-slate-900 to-slate-800 px-4 py-6 text-white">
      <p className="text-xs text-slate-400">실험 화면 · 스노우볼 주소: {id}</p>

      <div className="flex w-full max-w-md flex-1 items-center justify-center" style={{ minHeight: 360 }}>
        <div className="h-[60dvh] max-h-[520px] min-h-[320px] w-full touch-none">
          <SnowGlobeScene
            ornaments={ornaments}
            shakeSignal={shakeSignal}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>
      </div>

      <section className="w-full max-w-md space-y-3">
        <div className="min-h-24 rounded-2xl bg-white/10 p-4" aria-live="polite">
          {selected ? (
            <>
              <p className="text-sm text-slate-300">{selected.from} 님이 보낸 메시지</p>
              <p className="mt-1 break-words text-base">{selected.message}</p>
            </>
          ) : (
            <p className="text-sm text-slate-300">
              스노우볼을 드래그해서 돌려 보고, 오너먼트를 눌러 메시지를 읽어 보세요.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={shake}
          className="w-full rounded-2xl bg-white py-3 font-semibold text-slate-900 active:scale-[0.98]"
        >
          흔들기 ❄️
        </button>
      </section>
    </main>
  );
}
