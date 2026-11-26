"use client";

// 04 완성 · 공유 도크 (시안 C = 시안 A 의 04): 링크 · 링크 복사 · 카카오톡
// 링크 복사가 이 화면의 주 버튼입니다(DESIGN.md: 레드는 한 화면에 하나).

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Dock } from "@/components/ui/Dock";
import { Icon } from "@/components/ui/Icons";
import { copyText, showLinkToCopy } from "@/lib/copy";
import { loadKakao, shareKakao } from "@/lib/kakao";

// ─────────────────────────────────────────────────────────────
// 카카오톡 공유 (차명근 연결): lib/kakao.ts 의 shareKakao 가 카카오 공유 창을 엽니다.
// 키가 없거나 등록되지 않은 주소(로컬 · PR 미리보기)에서는 false 가 돌아와서,
// 휴대폰 기본 공유 창(여기서 카카오톡을 고를 수 있음)을 열고, 그것도 안 되면 링크를 복사합니다.
// true 를 돌려주면 공유 창을 연 것입니다.
// ─────────────────────────────────────────────────────────────
async function shareToKakao(url: string, title: string): Promise<boolean> {
  if (await shareKakao(url, title)) return true;
  if (typeof navigator !== "undefined" && "share" in navigator) {
    try {
      await navigator.share({ title, text: "내 스노우볼에 오너먼트를 달아 줘!", url });
      return true;
    } catch {
      return false; // 공유 창을 닫은 경우
    }
  }
  return false;
}

// 화면에는 한글 닉네임을 읽을 수 있게 풀어서 보여 줍니다. 복사되는 링크는 그대로입니다.
function readable(url: string) {
  try {
    return decodeURI(url).replace(/^https?:\/\//, "");
  } catch {
    return url.replace(/^https?:\/\//, "");
  }
}

export function ShareLinkText({ url }: { url: string }) {
  return <span className="truncate">{readable(url)}</span>;
}

// onNotice: 결과 알림("링크를 복사했어요")을 보여 줄 함수. 화면의 useNotice 에서 받아 Stage 의 notice 로 넘깁니다.
// 알림을 도크 위에 따로 띄우면 안내 문구와 겹쳐서(FEEDBACK A4), 안내 알약 자리 하나로 모았습니다.
export default function ShareDock({ url, title, onNotice: show }: { url: string; title: string; onNotice: (message: string) => void }) {

  // 카카오 SDK 를 미리 불러 둡니다. 버튼을 누른 뒤에 불러오면 브라우저가 공유 창을 막을 수 있습니다.
  useEffect(() => {
    void loadKakao();
  }, []);

  // 복사가 안 되면 링크를 직접 골라 복사할 수 있는 창을 띄웁니다 (lib/copy.ts)
  const onCopy = async () => {
    if (await copyText(url)) show("링크를 복사했어요");
    else showLinkToCopy(url);
  };

  const onKakao = async () => {
    if (await shareToKakao(url, title)) return;
    if (await copyText(url)) show("링크를 복사했어요. 카카오톡에 붙여 넣어 주세요");
    else showLinkToCopy(url);
  };

  return (
    <div className="relative flex w-full flex-col items-center">
      {/* 아주 좁은 화면(400px 미만)에서는 두 버튼을 위아래로 쌓아 잘리지 않게 합니다 */}
      <Dock label="링크 공유" className="max-[400px]:w-full max-[400px]:flex-col max-[400px]:items-stretch max-[400px]:rounded-[28px]">
        <div className="hidden h-12 max-w-[420px] items-center gap-2.5 rounded-full bg-night-900/70 pl-5 pr-6 text-base font-medium text-ink sm:flex sm:h-[52px]">
          <Icon name="link" size={18} className="shrink-0" />
          <ShareLinkText url={url} />
        </div>
        <Button icon="copy" onClick={onCopy}>
          링크 복사
        </Button>
        <Button variant="secondary" icon="message" onClick={onKakao}>
          카카오톡으로 보내기
        </Button>
      </Dock>
    </div>
  );
}
