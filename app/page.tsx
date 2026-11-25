import Link from "next/link";

// 랜딩 자리입니다. 디자인이 정해지면 바꿉니다.
export default function Home() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-gradient-to-b from-slate-900 to-slate-800 px-6 text-center text-white">
      <h1 className="text-3xl font-bold">스노우볼 롤링페이퍼</h1>
      <p className="max-w-sm text-slate-300">
        내 스노우볼을 만들어 링크를 보내면, 친구들이 메시지를 담은 오너먼트를 달아 줍니다.
      </p>
      <Link href="/globe/demo" className="rounded-2xl bg-white px-6 py-3 font-semibold text-slate-900">
        실험용 스노우볼 보기
      </Link>
    </main>
  );
}
