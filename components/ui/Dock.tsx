// 하단 도크: 화면 아래 가운데 유리 알약 바 (DESIGN.md 8장)
// 모바일에서는 좌우 16px 안쪽으로 넓어지고, 넘치면 가로로 밀어서 넘깁니다.

import type { ReactNode } from "react";

export function Dock({ children, label, className = "" }: { children: ReactNode; label: string; className?: string }) {
  return (
    <div
      role="group"
      aria-label={label}
      className={`glass glass-shadow pointer-events-auto mx-auto flex max-w-full items-center gap-1.5 overflow-x-auto rounded-full p-2.5 [scrollbar-width:none] ${className}`}
    >
      {children}
    </div>
  );
}
