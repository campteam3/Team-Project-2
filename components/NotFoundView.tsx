// 없는 주소로 들어왔을 때 (app/not-found.tsx 가 씁니다)
// 배치는 김미영이 준 레퍼런스(우주에 뜬 우주인 + 오른쪽 큰 글자)를 따릅니다:
//   왼쪽: 밤하늘에 둥둥 떠 있는 "빈" 스노우볼 하나 (3D 가 아닌 그림 — 진짜 스노우볼과 헷갈리지 않게 안은 비움)
//   오른쪽: 작은 감탄 → 큰 제목 → 설명 → 테두리 버튼 하나
// "404" 같은 개발 용어는 쓰지 않습니다. 휴대폰에서는 위(스노우볼) · 아래(글자)로 쌓습니다.
// 친구 링크의 닉네임이 틀린 경우(/globe/없는닉네임)는 GlobeStatus 의 "찾지 못했어요" 화면이 따로 맡습니다.

import Link from "next/link";

// 빈 스노우볼 그림: 유리 구 + 얇은 눈 바닥 + 레드 받침대. 장식이라 화면 읽기 프로그램에서는 건너뜁니다.
function EmptySnowGlobe() {
  return (
    <svg viewBox="0 0 200 240" className="h-auto w-[150px] animate-float motion-reduce:animate-none sm:w-[220px]" aria-hidden="true">
      <defs>
        <radialGradient id="nf-glass" cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.04" />
          <stop offset="75%" stopColor="#ffffff" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.24" />
        </radialGradient>
        <linearGradient id="nf-base" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#C8363D" />
          <stop offset="100%" stopColor="#7A1F24" />
        </linearGradient>
      </defs>
      {/* 눈 바닥 (유리 안 아래쪽) */}
      <ellipse cx="100" cy="152" rx="62" ry="11" fill="#F5F1EA" opacity="0.85" />
      {/* 유리 구 */}
      <circle cx="100" cy="92" r="80" fill="url(#nf-glass)" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="1.5" />
      {/* 유리 반사광 */}
      <path d="M52 62 A58 58 0 0 1 96 30" fill="none" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="5" strokeLinecap="round" />
      <circle cx="140" cy="54" r="3" fill="#ffffff" opacity="0.5" />
      {/* 받침대 */}
      <path d="M44 160 H156 L170 214 H30 Z" fill="url(#nf-base)" />
      <rect x="40" y="156" width="120" height="8" rx="4" fill="#9E2A30" />
      <path d="M37 186 H163" stroke="#F2C46D" strokeOpacity="0.8" strokeWidth="2" />
      <ellipse cx="100" cy="214" rx="70" ry="7" fill="#5E171B" />
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
          <p className="mt-4 max-w-[400px] text-pretty text-[15px] leading-[1.6] text-ink-sub sm:mt-6 sm:text-base">
            주소가 바뀌었거나 잘못 적힌 것 같아요. 친구에게 받은 링크라면 다시 확인해 주세요.
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
