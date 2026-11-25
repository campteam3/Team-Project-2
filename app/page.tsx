import Link from "next/link";

// 랜딩 자리입니다. 디자인이 정해지면 바꿉니다.
export default function Home() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-gradient-to-b from-slate-900 to-slate-800 px-6 text-center text-white">
      <h1 className="text-3xl font-bold">스노우볼 롤링페이퍼</h1>
      <p className="max-w-sm text-slate-300">
        내 스노우볼을 만들어 링크를 보내면, 친구들이 메시지를 담은 오너먼트를 달아 줘요.
      </p>
      <div className="flex w-full max-w-xs flex-col gap-3">
        <Link href="/new" className="rounded-full bg-white px-6 py-3 font-semibold text-slate-900">
          내 스노우볼 만들기
        </Link>
        <Link href="/login" className="rounded-full border border-white/20 bg-white/10 px-6 py-3 font-semibold">
          내 홈으로 들어가기
        </Link>
        <Link href="/globe/demo" className="text-sm text-slate-300 underline">
          샘플 스노우볼 보기
        </Link>
      </div>
    </main>
  );
}
