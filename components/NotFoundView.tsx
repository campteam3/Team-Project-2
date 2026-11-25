// 없는 주소로 들어왔을 때 (app/not-found.tsx 가 씁니다)
// 배치는 김미영이 준 레퍼런스(우주에 뜬 우주인 + 오른쪽 큰 글자)를 따릅니다:
//   왼쪽: 밤하늘에 둥둥 떠 있는 "빈" 스노우볼 하나 (3D 가 아닌 그림 — 진짜 스노우볼과 헷갈리지 않게 안은 비움)
//   오른쪽: 작은 감탄 → 큰 제목 → 설명 → 테두리 버튼 하나
// "404" 같은 개발 용어는 쓰지 않습니다. 휴대폰에서는 위(스노우볼) · 아래(글자)로 쌓습니다.
// 친구 링크의 닉네임이 틀린 경우(/globe/없는닉네임)는 GlobeStatus 의 "찾지 못했어요" 화면이 따로 맡습니다.

import Link from "next/link";

// 빈 스노우볼 그림: 그림자 · 그라데이션 없는 납작한(플랫) 도형 — 유리 원 + 눈 바닥 + 레드 받침대.
// 장식이라 화면 읽기 프로그램에서는 건너뜁니다.
function EmptySnowGlobe() {
  return (
    <svg viewBox="0 0 200 230" className="h-auto w-[200px] animate-float motion-reduce:animate-none sm:w-[320px]" aria-hidden="true">
      {/* 유리 원 */}
      <circle cx="100" cy="92" r="80" fill="#ffffff" fillOpacity="0.08" stroke="#ffffff" strokeOpacity="0.4" strokeWidth="2" />
      {/* 유리 반사 (납작한 선 하나) */}
      <path d="M54 64 A56 56 0 0 1 94 34" fill="none" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="5" strokeLinecap="round" />
      {/* 눈 바닥 */}
      <path d="M40 150 Q100 136 160 150 Z" fill="#F5F1EA" />
      {/* 받침대 */}
      <rect x="36" y="150" width="128" height="12" rx="6" fill="#C8363D" />
      <path d="M44 162 H156 L168 214 H32 Z" fill="#C8363D" />
      <path d="M38 188 H162" stroke="#F2C46D" strokeWidth="3" />
    </svg>
  );
}

export default function NotFoundView() {
  return (
    <main className="flex min-h-dvh w-full items-center justify-center bg-gradient-to-b from-night-900 to-night-700 px-6 py-16 sm:px-12">
      <div className="flex w-full max-w-[1040px] flex-col items-center gap-10 sm:flex-row sm:justify-between sm:gap-16">
        <div className="flex flex-1 justify-center">
          <EmptySnowGlobe />
        </div>

        <div className="flex flex-1 animate-rise flex-col items-center text-center sm:items-start sm:text-left">
          <p className="text-[22px] font-bold sm:text-[28px]">앗!</p>
          <h1 className="mt-2 text-balance text-[32px] font-bold leading-[1.25] tracking-[-0.02em] sm:mt-3 sm:text-[52px]">
            이 주소에는
            <br />
            스노우볼이 없어요
          </h1>
          <p className="mt-4 text-pretty text-[15px] leading-[1.6] text-ink-sub sm:mt-6 sm:text-base">
            주소가 바뀌었거나 잘못 적힌 것 같아요.
            <br />
            친구에게 받은 링크라면 다시 확인해 주세요.
          </p>
          <Link
            href="/"
            className="mt-8 inline-flex h-12 items-center justify-center rounded-full border-2 border-ink px-8 text-[15px] font-bold text-ink transition duration-200 ease-soft hover:bg-ink hover:text-night-900 active:scale-[0.97] sm:mt-10 sm:h-[52px] sm:text-base"
          >
            처음으로
          </Link>
        </div>
      </div>
    </main>
  );
}
