// 3D 를 불러오는 동안, 또는 3D 를 그릴 수 없는 기기에서 보여 주는 대체 화면 (DESIGN.md 4-2, 11장)
//  - 마을 배경 그림을 먼저 깔고(.stage-backdrop), 스노우볼 자리에 기본 스노우볼을 흐리게 한 그림(.stage-poster)을 둡니다.
//    완성 화면과 같은 자리 · 비슷한 크기라서, 3D 가 준비되면 그대로 또렷해지는 것처럼 보입니다.
//    그림은 public/backgrounds/globe-poster.webp (기본 스노우볼을 캡처해 흐리게 한 것).
//  - 3D 를 못 쓰는 기기에서 명판(plate)을 보여 줘야 할 때는 원형 빛과 받침대 모양을 그리고 그 위에 명판을 둡니다.
//    명판은 3D 가 없어도 그대로 보여서, 닉네임 입력이 막히지 않습니다.
//  - poster={false}: 스노우볼이 없는 화면(기념 메시지)에서는 배경만 깝니다.

import type { ReactNode } from "react";

export default function StageFallback({
  message,
  plate,
  poster = true,
  centerFromTop = 0.46,
  height = 0.56,
}: {
  message?: string;
  plate?: ReactNode;
  poster?: boolean;
  centerFromTop?: number;
  height?: number;
}) {
  return (
    <div className="stage-backdrop absolute inset-0 overflow-hidden" aria-hidden={plate ? undefined : true}>
      {plate ? (
        <div
          className="absolute left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
          style={{ top: `${centerFromTop * 100}%`, height: `min(${height * 100}dvh, 92vw)` }}
        >
          <div
            className="aspect-square h-[78%] rounded-full border border-white/30"
            style={{ background: "radial-gradient(circle at 38% 30%, rgb(58 78 134 / 0.55), rgb(11 16 32 / 0.2) 70%)" }}
          />
          <div className="relative -mt-[6%] flex h-[22%] w-[62%] items-center justify-center rounded-b-[40%] bg-[#6a2e30]">{plate}</div>
        </div>
      ) : (
        poster && (
          <div className="stage-poster">
            {/* eslint-disable-next-line @next/next/no-img-element -- 문서와 함께 바로 보여야 해서 일반 img 로 둡니다 */}
            <img src="/backgrounds/globe-poster.webp" alt="" width={480} height={494} decoding="async" className="size-full" />
          </div>
        )
      )}
      {/* 금방 끝나는 로딩에서는 문구가 깜박이지 않게, 조금 기다린 뒤에 나타납니다 */}
      {message && (
        <p className={`stage-loading-text ${poster && !plate ? "stage-loading-text-on-poster" : ""}`}>
          <span className="rounded-full bg-night-900/75 px-4 py-1.5 text-[15px] font-medium text-ink shadow-[0_4px_12px_rgba(0,0,0,0.35)]">{message}</span>
        </p>
      )}
    </div>
  );
}
