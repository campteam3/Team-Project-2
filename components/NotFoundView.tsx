"use client";

// 404: 없는 주소로 들어왔을 때 (app/not-found.tsx 가 씁니다)
// 다른 화면과 같은 무대(Stage) 위에, 명판에 "404" 를 새기고 처음 화면 · 내 스노우볼로 가는 길을 줍니다.
// 친구 링크의 닉네임이 틀린 경우(/globe/없는닉네임)는 GlobeStatus 의 "찾지 못했어요" 화면이 따로 맡습니다.

import Stage from "@/components/stage/Stage";
import { ButtonLink } from "@/components/ui/Button";
import { Dock } from "@/components/ui/Dock";
import { DEFAULT_THEME } from "@/lib/theme";

export default function NotFoundView() {
  return (
    <Stage
      theme={DEFAULT_THEME}
      title="이 주소에는 스노우볼이 없어요"
      subtitle="주소가 바뀌었거나 잘못 적힌 것 같아요. 친구에게 받은 링크라면 다시 확인해 주세요"
      plate={<span className="plate-text pointer-events-none text-[15px] font-bold text-night-900">404</span>}
    >
      <div className="flex w-full animate-rise justify-center">
        <Dock label="다음 할 일">
          <ButtonLink href="/">처음으로</ButtonLink>
          <ButtonLink href="/login" variant="secondary">
            내 스노우볼로 들어가기
          </ButtonLink>
        </Dock>
      </div>
    </Stage>
  );
}
