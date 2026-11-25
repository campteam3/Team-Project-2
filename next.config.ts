import type { NextConfig } from "next";

// 앞부분은 Next.js 16.4 의 기본 목록(html-bots)과 같고, 마지막 줄이 추가한 이름입니다.
const LINK_PREVIEW_BOTS = new RegExp(
  [
    "[\\w-]+-Google|Google-[\\w-]+|Chrome-Lighthouse|Slurp|DuckDuckBot|baiduspider|yandex|sogou|bitlybot|tumblr|vkShare",
    "quora link preview|redditbot|ia_archiver|Bingbot|BingPreview|applebot|facebookexternalhit|facebookcatalog|Twitterbot",
    "LinkedInBot|Slackbot|Discordbot|WhatsApp|SkypeUriPreview|Yeti|googleweblight",
    "kakaotalk-scrap|kakaostory-og-reader|naverbot|TelegramBot|Iframely|Embedly",
  ].join("|"),
  "i",
);

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // 링크 미리보기를 가져가는 봇에게는 미리보기 정보(og 태그)를 <head> 에 넣어 줍니다.
  // Next.js 기본 목록에 카카오톡 · 네이버 · 텔레그램 등의 봇 이름을 더했습니다.
  // (모든 요청에 적용하면(/.*/) 개발 서버에서 "static shell" 오류 표시가 뜹니다)
  htmlLimitedBots: LINK_PREVIEW_BOTS,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
