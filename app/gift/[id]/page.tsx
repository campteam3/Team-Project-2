import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import GiftView from "@/components/gift/GiftView";
import { OG_IMAGE, SITE_NAME } from "@/lib/site";

// 받은 기념 메시지 /gift/<번호> (FEEDBACK F1)
// 링크 미리보기는 DB 를 읽지 않고 모두 같은 글자로 둡니다. 카카오톡 공유 카드는 보낼 때 보내는 사람 이름을 넣습니다.
const TITLE = "기념 메시지가 도착했어요";
const DESCRIPTION = "눌러서 메시지를 열어 보세요.";

export async function generateMetadata({ params }: PageProps<"/gift/[id]">): Promise<Metadata> {
  const { id } = await params;
  return {
    title: TITLE,
    description: DESCRIPTION,
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: "ko_KR",
      title: TITLE,
      description: DESCRIPTION,
      url: `/gift/${encodeURIComponent(id)}`,
      images: [OG_IMAGE],
    },
    twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: [OG_IMAGE.url] },
  };
}

// 미리보기 정보가 주소에 따라 달라진다는 표시입니다 (app/globe/[id]/page.tsx 와 같은 방식)
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

export default function GiftPage() {
  return (
    <>
      <Suspense fallback={null}>
        <GiftView />
      </Suspense>
      <DynamicMarker />
    </>
  );
}
