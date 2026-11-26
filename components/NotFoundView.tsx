import Link from "next/link";
import LostSnowman from "./LostSnowman";

// 일반 404 전용. 친구 스노우볼 링크의 오류 처리는 GlobeStatus가 맡습니다.
export default function NotFoundView() {
  return (
    <main className="flex min-h-dvh w-full items-center justify-center overflow-hidden bg-gradient-to-b from-night-900 to-night-700 px-6 py-10 sm:px-10 sm:py-16">
      <div className="grid w-full max-w-[1120px] items-center gap-8 md:grid-cols-2 md:gap-16">
        <LostSnowman />
        <div className="flex animate-rise flex-col items-center text-center md:items-start md:text-left">
          <p className="mb-4 text-[13px] font-medium tracking-[0.04em] text-ink-sub">조금 엉뚱한 곳에 도착했어요</p>
          <h1 className="text-balance text-[32px] font-bold leading-[1.3] tracking-[-0.035em] sm:text-[44px] lg:text-[48px]">
            페이지는 없고,<br />눈사람만 있네요.
          </h1>
          <p className="mt-5 text-pretty text-[15px] leading-[1.8] text-ink-sub sm:mt-6 sm:text-base">
            찾으시는 페이지가 없거나 주소가 바뀌었어요.
            <br className="hidden sm:block" /> 처음으로 돌아가 다시 시작해 볼까요?
          </p>
          <Link href="/" className="mt-8 inline-flex h-12 items-center justify-center gap-3 rounded-full border border-ink/70 px-7 text-[15px] font-semibold text-ink transition duration-200 ease-soft hover:bg-ink hover:text-night-900 active:scale-[0.97] sm:mt-10 sm:h-[52px] sm:text-base">
            처음으로
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>
      </div>
    </main>
  );
}

