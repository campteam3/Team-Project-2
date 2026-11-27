import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import GlobeView from "@/components/GlobeView";
import ModelPreload from "@/components/ModelPreload";
import GlobeStatus from "@/components/stage/GlobeStatus";
import { getGlobe } from "@/lib/api";
import { OG_IMAGE, SITE_NAME } from "@/lib/site";
import { toKind } from "@/lib/theme";

// 주소의 닉네임 (풀 수 없는 주소면 그대로, 20자까지)
function nicknameOf(id: string) {
  let nickname = id;
  try {
    nickname = decodeURIComponent(id);
  } catch {
    // 풀 수 없는 주소면 그대로 씁니다
  }
  return nickname.trim().slice(0, 20);
}

// 링크 미리보기: "○○ 님의 스노우볼". 닉네임은 주소에 있는 값이라 DB 를 부르지 않습니다.
export async function generateMetadata({ params }: PageProps<"/globe/[id]">): Promise<Metadata> {
  const { id } = await params;
  const nickname = nicknameOf(id);

  const isDemo = nickname.toLowerCase() === "demo";
  const title = isDemo ? "샘플 스노우볼" : `${nickname} 님의 스노우볼`;
  const description = isDemo
    ? "친구들의 메시지가 오너먼트로 달리는 스노우볼을 미리 구경해 보세요."
    : `${nickname} 님의 스노우볼에 마음을 담은 오너먼트를 달아 주세요.`;

  return {
    title,
    description,
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: "ko_KR",
      title,
      description,
      url: `/globe/${encodeURIComponent(nickname.toLowerCase())}`,
      images: [OG_IMAGE],
    },
    twitter: { card: "summary_large_image", title, description, images: [OG_IMAGE.url] },
  };
}

// 위의 미리보기 정보가 주소(닉네임)에 따라 달라진다는 것을 Next.js 에 알려 주는 표시입니다.
// 화면에는 아무것도 그리지 않습니다. 지우면 개발 서버에서 오류 표시("Next.js encountered URL data
// in generateMetadata()")가 뜹니다. (Next.js 문서: generateMetadata > With Cache Components)
async function Connection() {
  await connection();
  return null;
}

function DynamicMarker() {
  return (
    <Suspense>
      <Connection />
    </Suspense>
  );
}

// 이 스노우볼의 종류(크리스마스 · 새해)에 맞는 3D 모델만 미리 받습니다 (차명근).
// 종류는 DB 에 있어서 서버에서 한 번 읽습니다. 못 읽으면(없는 닉네임 · 연결 오류) 크리스마스 모델을 받습니다.
// 샘플(demo)은 크리스마스입니다.
async function GlobeModelPreload({ params }: { params: PageProps<"/globe/[id]">["params"] }) {
  const { id } = await params;
  const nickname = nicknameOf(id);
  if (nickname.toLowerCase() === "demo") return <ModelPreload />;
  const result = await getGlobe(nickname);
  const kind = result.ok && result.data ? toKind(result.data.theme?.kind) : "christmas";
  return <ModelPreload kind={kind} />;
}

// 스노우볼 보기: /globe/스노우볼주소
export default function GlobePage({ params }: PageProps<"/globe/[id]">) {
  return (
    <>
      <Suspense>
        <GlobeModelPreload params={params} />
      </Suspense>
      <Suspense fallback={<GlobeStatus kind="loading" />}>
        <GlobeView />
      </Suspense>
      <DynamicMarker />
    </>
  );
}
