// 3D 를 불러오는 동안, 또는 3D 를 그릴 수 없는 기기에서 보여 주는 대체 화면 (DESIGN.md 4-2, 11장)
//  - 스노우볼 주제에 맞는 배경 그림을 먼저 깝니다(.stage-backdrop): 크리스마스는 마을, 새해는 해돋이, 생일은 하늘.
//    3D 배경과 같은 그림 · 같은 맞춤이라, 3D 로 바뀔 때 배경이 움직이지 않습니다.
//  - 스노우볼 자리에는 은은한 빛(.stage-glow)만 둡니다. 3D 가 준비되면 이 화면이 걷히며 스노우볼이 배경 위로 서서히 나타납니다.
//    예전에는 기본 크리스마스 스노우볼을 흐리게 한 그림을 두었는데, 다른 주제 · 꾸민 스노우볼에서는 다른 스노우볼이 보였다가 바뀌어서 뺐습니다 (이민정).
//  - kind 를 모르는 순간(데이터를 받기 전)에는 그림 없이 밤하늘 색만 깝니다. 서버가 주제를 먼저 알려 주면 그 그림을 씁니다
//    (app/globe/[id]/page.tsx 가 --stage-web · --stage-mobile 값을 내려 줌).
//  - 3D 를 못 쓰는 기기에서 명판(plate)을 보여 줘야 할 때는 원형 빛과 받침대 모양을 그리고 그 위에 명판을 둡니다.
//    명판은 3D 가 없어도 그대로 보여서, 닉네임 입력이 막히지 않습니다.
//  - poster={false}: 스노우볼이 없는 화면(기념 메시지)에서는 배경만 깝니다.

import type { ReactNode } from "react";
import type { GlobeKind } from "@/lib/theme";

export default function StageFallback({
  message,
  plate,
  poster = true,
  kind,
  centerFromTop = 0.46,
  height = 0.56,
}: {
  message?: string;
  plate?: ReactNode;
  poster?: boolean; // 스노우볼 자리의 빛을 보여 줄지
  kind?: GlobeKind; // 스노우볼 주제. 모르면 비워 둡니다
  centerFromTop?: number;
  height?: number;
}) {
  return (
    <div className={`stage-backdrop ${kind ? `stage-kind-${kind}` : ""} absolute inset-0 overflow-hidden`} aria-hidden={plate ? undefined : true}>
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
        poster && <div className="stage-glow" />
      )}
      {/* 금방 끝나는 로딩에서는 문구가 깜박이지 않게, 조금 기다린 뒤에 나타납니다 */}
      {message && (
        <p className={`stage-loading-text ${poster && !plate ? "stage-loading-text-on-glow" : ""}`}>
          <span className="rounded-full bg-night-900/75 px-4 py-1.5 text-[15px] font-medium text-ink shadow-[0_4px_12px_rgba(0,0,0,0.35)]">{message}</span>
        </p>
      )}
    </div>
  );
}
