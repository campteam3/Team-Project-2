// 메시지 기본 문구 (FEEDBACK F2, 차명근)
//
// 설문에서 15명 중 6명이 "뭐라고 써야 할지 모르겠다"고 답했습니다. 메시지 쓰기 화면(12)에서
// 아래 문구를 골라 시작하고, 고른 뒤에는 자유롭게 고칠 수 있습니다.
//
// - label: 고르기 버튼에 보이는 짧은 이름. text: 메시지 칸에 채워지는 글.
// - 이모지는 쓰지 않습니다 (DESIGN.md 10장). 글자 수는 메시지 한도(200자)보다 훨씬 짧게 둡니다.
// - 받는 사람 이름은 넣지 않습니다. 한국어 조사(아/야, 이/가)가 이름마다 달라 어색해지기 쉽습니다.
// - 금지어 필터(supabase/migrations 의 banned_words)에 걸리는 말이 없어야 합니다. 문구를 바꾸면 한 번 달아 보세요.
// - 순서: 이 서비스가 가장 많이 쓰일 때(연말)부터. 설문의 "축하 메시지를 보낸 일" 순위(생일 · 새해 · 연말 · 수료)도 참고했습니다.

export type MessageTemplate = { id: string; label: string; text: string };

export const MESSAGE_TEMPLATES: MessageTemplate[] = [
  { id: "year-end", label: "연말 인사", text: "올 한 해 정말 고생 많았어. 남은 연말 따뜻하고 행복하게 보내!" },
  { id: "thanks", label: "고마워", text: "늘 고마워. 네 덕분에 힘이 났던 순간이 정말 많았어." },
  { id: "new-year", label: "새해 인사", text: "새해 복 많이 받아. 하고 싶은 일 다 이루는 한 해가 되길 바랄게!" },
  { id: "cheer", label: "응원해", text: "어디서 무엇을 하든 응원할게. 지금처럼만 하면 다 잘될 거야." },
  { id: "graduate", label: "수료 축하", text: "수료 축하해! 그동안 정말 잘 해냈어. 앞으로의 길도 응원할게." },
  { id: "birthday", label: "생일 축하", text: "생일 축하해! 오늘 하루는 누구보다 행복하게 보내길 바라." },
];

// 지금 메시지 칸의 글이 기본 문구 중 하나와 같으면 그 문구를 돌려줍니다 (고른 뒤 아직 고치지 않은 상태)
export function findTemplate(message: string) {
  const text = message.trim();
  return MESSAGE_TEMPLATES.find((template) => template.text === text);
}
