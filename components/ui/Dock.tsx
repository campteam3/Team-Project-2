// 하단 도크: 화면 아래 가운데 유리 알약 바 (DESIGN.md 8장)
// 모바일에서는 좌우 16px 안쪽으로 넓어지고, 넘치면 가로로 밀어서 넘깁니다.
// 넓은 화면에서는 받침대 위에 겹칠 때가 있어, 투명 유리 대신 어두운 유리(밤하늘색 70%)로 글자가 묻히지 않게 합니다.

import type { ReactNode } from "react";

export function Dock({ children, label, className = "" }: { children: ReactNode; label: string; className?: string }) {
  return (
    <div
      role="group"
      aria-label={label}
      className={`glass-shadow pointer-events-auto border border-glass-border bg-night-900/70 backdrop-blur-[16px] backdrop-saturate-[1.4] mx-auto flex max-w-full items-center gap-1.5 overflow-x-auto rounded-full p-2.5 [scrollbar-width:none] ${className}`}
    >
      {children}
    </div>
  );
}
