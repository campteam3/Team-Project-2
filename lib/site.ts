// 사이트 이름과 주소. 링크 미리보기(제목 · 설명 · 이미지 주소)에 씁니다.

export const SITE_NAME = "스노우볼 롤링페이퍼";
export const SITE_TAGLINE = "친구 마음이 쌓이는 스노우볼";
export const SITE_DESCRIPTION = "링크를 보내면 친구들이 메시지를 담은 오너먼트를 달아 줘요.";

// 미리보기 이미지 (app/opengraph-image.jpg). 페이지에서 openGraph 를 따로 정할 때는 이 값을 함께 넣어야 이미지가 빠지지 않습니다.
// 이미지에는 글자를 넣지 않습니다. 카카오톡 등은 이미지를 정사각형으로 잘라 보여 주기도 해서 글자가 잘리고,
// 제목과 설명은 카드 아래에 글자로 따로 나오기 때문입니다.
// 이미지를 바꿀 때는 주소 끝의 숫자(?v=2)를 하나 올려 주세요. 카카오톡이 같은 주소의 이미지를 한동안 기억합니다.
// (파일 이름은 Next.js 가 정한 이름이라 바꾸면 안 됩니다)
export const OG_IMAGE = { url: "/opengraph-image.jpg?v=2", width: 1200, height: 630, alt: SITE_TAGLINE };

// 미리보기 이미지 주소는 항상 실제 배포 주소를 가리키게 합니다.
// (PR 미리보기 주소는 로그인해야 열려서, 그 주소의 이미지는 카카오톡 등이 가져가지 못합니다)
const production = process.env.VERCEL_PROJECT_PRODUCTION_URL;
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (production ? `https://${production}` : "https://snowglobe-rolling-paper.vercel.app");
