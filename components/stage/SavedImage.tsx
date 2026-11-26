"use client";

// 저장할 이미지를 화면에 크게 띄웁니다. (FEEDBACK E4, 차명근)
// 휴대폰에서 공유 창을 열 수 없는 브라우저(카카오톡 안 브라우저 등)에서만 뜹니다.
// 이미지를 길게 누르면 휴대폰의 "사진에 저장"이 나옵니다.

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";

export default function SavedImage({ url, name, onClose }: { url: string; name: string; onClose: () => void }) {
  // 닫을 때 이미지 주소를 지워 메모리를 돌려줍니다. Esc 로도 닫습니다.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      URL.revokeObjectURL(url);
    };
  }, [url, onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="스노우볼 이미지"
      className="pointer-events-auto fixed inset-0 z-50 flex animate-fade flex-col items-center justify-center gap-4 bg-night-900/90 p-5 backdrop-blur-sm"
    >
      <p className="text-center text-[15px] font-medium text-ink">이미지를 길게 눌러 저장해 주세요</p>
      {/* 길게 눌러 저장하려면 진짜 img 여야 합니다. 방금 만든 이미지라 next/image 로 줄일 필요가 없습니다 */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={`${name} 이미지`} className="max-h-[70dvh] max-w-full rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)]" />
      <Button variant="secondary" onClick={onClose}>
        닫기
      </Button>
    </div>
  );
}
