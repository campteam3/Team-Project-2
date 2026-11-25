import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // 링크 미리보기 정보(og 태그)를 항상 <head> 에 넣습니다.
  // 기본값은 정해진 봇에게만 그렇게 하는데, 그 목록에 카카오톡 미리보기 봇 이름이 따로 없어서 모두에게 적용합니다.
  htmlLimitedBots: /.*/,
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
