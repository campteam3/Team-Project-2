import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "스노우볼 롤링페이퍼",
  description: "친구들이 메시지 오너먼트를 달아 주는 나만의 3D 스노우볼",
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
