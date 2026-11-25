// 3D 를 불러오는 동안, 또는 3D 를 그릴 수 없는 기기에서 보여 주는 대체 화면 (DESIGN.md 4-2, 11장)
// 스노우볼 자리를 비워 두지 않고 같은 크기의 은은한 원형 빛과 받침대 모양을 둡니다.
// 명판(plate)은 3D 가 없어도 그대로 보여서, 닉네임 입력이 막히지 않습니다.

import type { ReactNode } from "react";

export default function StageFallback({
  message,
  plate,
  centerFromTop = 0.46,
  height = 0.56,
}: {
  message?: string;
  plate?: ReactNode;
  centerFromTop?: number;
  height?: number;
}) {
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden={plate ? undefined : true}>
      <div
        className="absolute left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
        style={{ top: `${centerFromTop * 100}%`, height: `min(${height * 100}dvh, 92vw)` }}
      >
        <div
          className="aspect-square h-[78%] rounded-full border border-white/30"
          style={{ background: "radial-gradient(circle at 38% 30%, rgb(58 78 134 / 0.55), rgb(11 16 32 / 0.2) 70%)" }}
        />
        <div className="relative -mt-[6%] flex h-[22%] w-[62%] items-center justify-center rounded-b-[40%] bg-[#6a2e30]">
          {plate}
        </div>
        {message && <p className="mt-6 text-center text-sm text-ink-sub">{message}</p>}
      </div>
    </div>
  );
}
