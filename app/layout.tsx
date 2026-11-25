import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/site";

// 링크를 붙여 넣었을 때 보이는 미리보기 정보. 이미지는 app/opengraph-image.png 를 자동으로 씁니다.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "ko_KR",
    title: SITE_TAGLINE,
    description: SITE_DESCRIPTION,
    url: "/",
  },
  twitter: { card: "summary_large_image", title: SITE_TAGLINE, description: SITE_DESCRIPTION },
};

export const viewport: Viewport = {
  themeColor: "#0b1020",
  viewportFit: "cover",
};

// 글꼴: Pretendard (DESIGN.md 3장). 한글 글자를 필요한 만큼만 나눠 받는 CDN 판을 씁니다.
const PRETENDARD =
  "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link rel="stylesheet" href={PRETENDARD} />
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
