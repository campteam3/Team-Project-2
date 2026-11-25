// 카카오톡 공유. 카카오 JavaScript SDK 를 필요할 때 불러와 씁니다.
// 키는 .env.local 과 Vercel 환경 변수의 NEXT_PUBLIC_KAKAO_JS_KEY 에 둡니다. (등록한 도메인에서만 동작하는 공개용 키)
// 키가 없거나, SDK 를 못 불러오거나, 등록되지 않은 주소(예: PR 미리보기 주소)이면 false 를 돌려주고
// 부르는 쪽에서 기본 공유 창이나 링크 복사로 넘어갑니다.

import { OG_IMAGE, SITE_URL } from "./site";

// 버전을 고정하고 파일이 바뀌지 않았는지 확인하는 값(integrity)을 함께 둡니다. 버전을 올리면 둘 다 바꿉니다.
const SDK_URL = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.9/kakao.min.js";
const SDK_INTEGRITY = "sha384-JpLApTkB8lPskhVMhT+m5Ln8aHlnS0bsIexhaak0jOhAkMYedQoVghPfSpjNi9K1";

type KakaoLink = { mobileWebUrl: string; webUrl: string };
type KakaoSdk = {
  init: (key: string) => void;
  isInitialized: () => boolean;
  Share: {
    sendDefault: (options: {
      objectType: "feed";
      content: { title: string; description: string; imageUrl: string; link: KakaoLink };
      buttons: { title: string; link: KakaoLink }[];
    }) => void;
  };
};

declare global {
  interface Window {
    Kakao?: KakaoSdk;
  }
}

let loading: Promise<KakaoSdk | null> | null = null;

// SDK 를 불러옵니다. 공유 화면이 열릴 때 미리 불러 두면, 버튼을 눌렀을 때 바로 공유 창이 뜹니다.
export function loadKakao(): Promise<KakaoSdk | null> {
  const key = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
  if (!key || typeof window === "undefined") return Promise.resolve(null);

  loading ??= new Promise<KakaoSdk | null>((resolve) => {
    const ready = () => {
      const sdk = window.Kakao;
      if (!sdk) return resolve(null);
      try {
        if (!sdk.isInitialized()) sdk.init(key);
        resolve(sdk);
      } catch {
        resolve(null);
      }
    };
    if (window.Kakao) return ready();

    const script = document.createElement("script");
    script.src = SDK_URL;
    script.integrity = SDK_INTEGRITY;
    script.crossOrigin = "anonymous";
    script.async = true;
    script.onload = ready;
    script.onerror = () => {
      loading = null; // 다음에 다시 시도할 수 있게
      resolve(null);
    };
    document.head.appendChild(script);
  });
  return loading;
}

// 카카오톡 공유 창을 엽니다. 열었으면 true.
export async function shareKakao(url: string, title: string): Promise<boolean> {
  // 카카오에 등록한 주소가 아니면 공유 창에서 오류가 나므로 시도하지 않습니다.
  if (!url.startsWith(SITE_URL)) return false;

  const sdk = await loadKakao();
  if (!sdk) return false;

  const link = { mobileWebUrl: url, webUrl: url };
  try {
    sdk.Share.sendDefault({
      objectType: "feed",
      content: {
        title,
        description: "스노우볼에 마음을 담은 오너먼트를 달아 주세요.",
        imageUrl: `${SITE_URL}${OG_IMAGE.url}`,
        link,
      },
      buttons: [{ title: "오너먼트 달러 가기", link }],
    });
    return true;
  } catch {
    return false;
  }
}
