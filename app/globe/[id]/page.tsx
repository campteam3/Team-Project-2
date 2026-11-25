import type { Metadata } from "next";
import { Suspense } from "react";
import GlobeView from "@/components/GlobeView";
import { OG_IMAGE, SITE_NAME } from "@/lib/site";

// 링크 미리보기: "○○ 님의 스노우볼". 닉네임은 주소에 있는 값이라 DB 를 부르지 않습니다.
export async function generateMetadata({ params }: PageProps<"/globe/[id]">): Promise<Metadata> {
  const { id } = await params;
  let nickname = id;
  try {
    nickname = decodeURIComponent(id);
  } catch {
    // 풀 수 없는 주소면 그대로 씁니다
  }
  nickname = nickname.trim().slice(0, 20);

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

// 스노우볼 보기: /globe/스노우볼주소
export default function GlobePage() {
  return (
    <Suspense fallback={null}>
      <GlobeView />
    </Suspense>
  );
}
