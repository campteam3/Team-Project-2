"use client";

// 잠깐 떴다 사라지는 알림 ("링크를 복사했어요" 등).
// 문구는 Stage 의 notice 로 넘깁니다. 안내 알약 자리에 같은 모양으로 뜨고, 사라지면 원래 안내 문구가 돌아옵니다.

import { useCallback, useEffect, useRef, useState } from "react";

export function useNotice(duration = 2500) {
  const [notice, setNotice] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const say = useCallback(
    (message: string) => {
      setNotice(message);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setNotice(""), duration);
    },
    [duration],
  );

  return [notice, say] as const;
}
