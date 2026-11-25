// 없는 주소로 들어왔을 때 (app/not-found.tsx 가 씁니다)
// 스노우볼을 보여 주면 "내 스노우볼인가?" 하고 헷갈릴 수 있어서, 3D 없이 밤하늘 바탕에 도형 트리 하나만 둡니다.
// "404" 같은 개발 용어는 쓰지 않고, 갈 길은 "처음으로" 하나만 줍니다.
// 친구 링크의 닉네임이 틀린 경우(/globe/없는닉네임)는 GlobeStatus 의 "찾지 못했어요" 화면이 따로 맡습니다.

import { ButtonLink } from "@/components/ui/Button";

// 도형 트리: 삼각형 세 단 + 줄기 + 별. 장식 그림이라 화면 읽기 프로그램에서는 건너뜁니다.
function SimpleTree() {
  return (
    <svg viewBox="0 0 160 200" className="h-auto w-[120px] sm:w-[150px]" aria-hidden="true">
      <polygon points="80,22 86,36 101,36 89,45 93,60 80,51 67,60 71,45 59,36 74,36" fill="var(--color-glow)" />
      <polygon points="80,52 122,104 38,104" fill="#3C8E63" />
      <polygon points="80,80 134,142 26,142" fill="#2F7A54" />
      <polygon points="80,110 146,180 14,180" fill="#1F5A40" />
      <rect x="72" y="180" width="16" height="14" rx="2" fill="#7A5233" />
    </svg>
  );
}

export default function NotFoundView() {
  return (
    <main className="flex min-h-dvh w-full flex-col items-center bg-gradient-to-b from-night-900 to-night-700 px-4 pb-[max(env(safe-area-inset-bottom),32px)] pt-[18vh] text-center sm:px-8">
      <header className="max-w-[900px] animate-fade">
        <h1 className="text-balance text-[22px] font-bold leading-[1.3] tracking-[-0.02em] sm:text-[28px]">
          이 주소에는 스노우볼이 없어요
        </h1>
        <p className="mt-2 text-pretty text-[15px] text-ink-sub">
          주소가 바뀌었거나 잘못 적힌 것 같아요. 친구에게 받은 링크라면 다시 확인해 주세요
        </p>
      </header>

      <div className="mt-12 animate-rise sm:mt-14">
        <SimpleTree />
      </div>

      <ButtonLink href="/" className="mt-12 animate-rise sm:mt-14">
        처음으로
      </ButtonLink>
    </main>
  );
}
