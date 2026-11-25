// 없는 주소로 들어왔을 때 (app/not-found.tsx 가 씁니다)
// 배치는 김미영이 준 레퍼런스(우주에 뜬 우주인 + 오른쪽 큰 글자)를 따릅니다:
//   왼쪽: 밤하늘에 둥둥 떠 있는 "빈" 스노우볼 하나 (3D 가 아닌 그림 — 진짜 스노우볼과 헷갈리지 않게 안은 비움)
//   오른쪽: 큰 제목 → 설명 → 테두리 버튼 하나
// "404" 같은 개발 용어는 쓰지 않습니다. 휴대폰에서는 위(스노우볼) · 아래(글자)로 쌓습니다.
// 친구 링크의 닉네임이 틀린 경우(/globe/없는닉네임)는 GlobeStatus 의 "찾지 못했어요" 화면이 따로 맡습니다.

import Link from "next/link";

// 텅 빈 스노우볼 그림: Figma AI 벡터 생성(팀 와이어프레임 파일의 "empty-glass-globe" · "pedestal")을 그대로 옮겼습니다.
// 납작한 도형, 그림자 · 그라데이션 없음. 유리 안에는 아무것도 없어 "비어 있다"는 느낌을 줍니다.
// 장식이라 화면 읽기 프로그램에서는 건너뜁니다.
function EmptySnowGlobe() {
  return (
    <svg viewBox="55 34 370 414" className="h-auto w-[210px] animate-float motion-reduce:animate-none sm:w-[320px]" fill="none" aria-hidden="true">
      <g transform="translate(59.75 38.75)">
        <path
          d="M180.25 359.25C279.109 359.25 359.25 279.109 359.25 180.25C359.25 81.391 279.109 1.25 180.25 1.25C81.391 1.25 1.25 81.391 1.25 180.25C1.25 279.109 81.391 359.25 180.25 359.25Z"
          fill="white"
          fillOpacity="0.035"
          strokeWidth="2.5"
          stroke="#F5EAD2"
        />
        <path d="M45.25 126.25C59.25 80.25 93.25 48.25 135.25 37.25" strokeWidth="3" strokeLinecap="round" stroke="#F5EAD2" strokeOpacity="0.8" />
      </g>
      <g transform="translate(91 374)">
        <path
          d="M20.109 1H278.109C285.109 1 290.109 6 291.109 13L298.109 55C299.109 63 293.109 69 285.109 69H13.109C5.10904 69 -0.890961 63 0.109039 55L7.10904 13C8.10904 6 13.109 1 20.109 1Z"
          fill="#C8363D"
        />
        <path
          d="M287.109 0H11.109C9.45219 0 8.10904 1.34315 8.10904 3C8.10904 4.65685 9.45219 6 11.109 6H287.109C288.766 6 290.109 4.65685 290.109 3C290.109 1.34315 288.766 0 287.109 0Z"
          fill="#F2C46D"
        />
      </g>
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
          <h1 className="text-balance text-[32px] font-bold leading-[1.25] tracking-[-0.02em] sm:text-[52px]">
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
