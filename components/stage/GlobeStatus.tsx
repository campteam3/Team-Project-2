"use client";

// /globe/닉네임 의 상태 화면: 불러오는 중 · 없는 스노우볼 · 오류 (DESIGN.md 11장)
// 3D 를 불러오기 전이므로 같은 크기의 대체 스노우볼 위에 안내를 둡니다.

import { Button, ButtonLink } from "@/components/ui/Button";
import { Dock } from "@/components/ui/Dock";
import StageFallback from "./StageFallback";

type Props =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "error"; message: string; onRetry: () => void };

export default function GlobeStatus(props: Props) {
  const title =
    props.kind === "loading" ? "" : props.kind === "missing" ? "이 닉네임의 스노우볼을 찾지 못했어요" : "스노우볼을 불러오지 못했어요";
  const subtitle =
    props.kind === "missing" ? "링크의 닉네임이 맞는지 다시 확인해 주세요" : props.kind === "error" ? props.message : "";

  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <StageFallback message={props.kind === "loading" ? "스노우볼을 불러오고 있어요" : undefined} />
      {props.kind !== "loading" && (
        <div className="relative z-10 flex h-full flex-col px-4 pb-[max(env(safe-area-inset-bottom),20px)] pt-14 sm:px-8 sm:pb-8 sm:pt-10">
          <header className="mx-auto max-w-[900px] animate-fade text-center">
            <h1 className="text-balance text-[22px] font-bold leading-[1.3] tracking-[-0.02em] sm:text-[28px]">{title}</h1>
            <p className="mt-2 text-pretty text-[15px] text-ink-sub">{subtitle}</p>
          </header>
          <div className="flex-1" />
          <Dock label={props.kind === "missing" ? "다음 할 일" : "다시 시도"}>
            {props.kind === "missing" ? (
              <ButtonLink href="/">내 스노우볼 만들기</ButtonLink>
            ) : (
              <Button onClick={props.onRetry}>다시 시도하기</Button>
            )}
          </Dock>
        </div>
      )}
    </main>
  );
}
