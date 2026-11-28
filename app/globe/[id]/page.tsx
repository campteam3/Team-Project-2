import type { Metadata } from "next";
import { connection } from "next/server";
import { cache, Suspense } from "react";
import GlobeView from "@/components/GlobeView";
import ModelPreload from "@/components/ModelPreload";
import GlobeStatus from "@/components/stage/GlobeStatus";
import { getGlobe } from "@/lib/api";
import { OG_IMAGE, SITE_NAME } from "@/lib/site";
import { itemWord, toKind, type GlobeKind } from "@/lib/theme";

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

// 이 스노우볼의 주제(크리스마스 · 새해 · 생일). DB 에 있어서 서버에서 읽습니다. 못 읽으면(없는 닉네임 · 연결 오류) 크리스마스로 봅니다.
// 링크 미리보기 글자와 모델 미리 받기가 함께 쓰므로, 요청 하나에서는 DB 를 한 번만 읽게 묶어 둡니다 (cache). 샘플(demo)은 크리스마스입니다.
const kindOf = cache(async (nickname: string): Promise<GlobeKind> => {
  if (nickname.toLowerCase() === "demo") return "christmas";
  const result = await getGlobe(nickname);
  return result.ok && result.data ? toKind(result.data.theme?.kind) : "christmas";
});

// 링크 미리보기: "○○ 님의 스노우볼". 설명 글자의 낱말은 주제를 따릅니다: 크리스마스는 "오너먼트", 생일 · 새해는 "장식" (이민정)
export async function generateMetadata({ params }: PageProps<"/globe/[id]">): Promise<Metadata> {
  const { id } = await params;
  const nickname = nicknameOf(id);

  const isDemo = nickname.toLowerCase() === "demo";
  const title = isDemo ? "샘플 스노우볼" : `${nickname} 님의 스노우볼`;
  const description = isDemo
    ? "친구들의 메시지가 오너먼트로 달리는 스노우볼을 미리 구경해 보세요."
    : `${nickname} 님의 스노우볼에 마음을 담은 ${itemWord(await kindOf(nickname)).obj} 달아 주세요.`;

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
  const kind = await kindOf(nickname);
  // 로딩 화면의 배경 그림도 이 주제에 맞춥니다. 화면 코드는 데이터를 받기 전이라 주제를 모르므로, 서버가 먼저 알려 줍니다
  // (app/globals.css 의 .stage-backdrop 이 이 값을 읽습니다. 이민정)
  const picture = BACKDROP_PICTURE[kind];
  return (
    <>
      <ModelPreload kind={kind} />
      <style>{`:root{--stage-web:url("/backgrounds/${picture}-web.webp");--stage-mobile:url("/backgrounds/${picture}-mobile.webp")}`}</style>
    </>
  );
}

// 주제별 배경 그림 파일 이름 (components/stage/backdropShared.ts 와 같게. 그쪽은 3D 코드라 여기서 불러오지 않음)
const BACKDROP_PICTURE: Record<GlobeKind, string> = { christmas: "village", newyear: "sunrise", birthday: "birthday" };

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
