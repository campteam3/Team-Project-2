// /globe/demo 에서 쓰는 샘플 데이터입니다. 실제 개인정보는 넣지 않습니다.

import type { Globe } from "./api";

const at = "2026-11-25T00:00:00Z";
const ornament = (id: string, sender_name: string, message: string, color: string) => ({
  id,
  sender_name,
  message,
  color,
  shape: "ball",
  position: null,
  created_at: at,
});

export const SAMPLE_GLOBE: Globe = {
  nickname: "demo",
  title: "샘플 스노우볼",
  theme: {},
  created_at: at,
  ornaments: [
    ornament("1", "하늘", "올 한 해 정말 고생 많았어! 내년에도 같이 달리자.", "#e5484d"),
    ornament("2", "바다", "덕분에 수업이 훨씬 재미있었어. 고마워.", "#f5a524"),
    ornament("3", "구름", "메리 크리스마스!", "#3e63dd"),
    ornament("4", "노을", "발표 때 떨지 말고, 준비한 만큼만 하자. 우리 팀 최고.", "#30a46c"),
    ornament("5", "별", "따뜻한 연말 보내.", "#d6409f"),
  ],
};
