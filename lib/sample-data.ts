// 실험 화면용 샘플 데이터입니다. DB 가 연결되면 실제 데이터로 바꿉니다.
// 실제 개인정보는 넣지 않습니다.

export type Ornament = {
  id: string;
  from: string;
  message: string;
  color: string;
};

export const SAMPLE_ORNAMENTS: Ornament[] = [
  { id: "1", from: "하늘", message: "올 한 해 정말 고생 많았어! 내년에도 같이 달리자.", color: "#e5484d" },
  { id: "2", from: "바다", message: "덕분에 수업이 훨씬 재미있었어. 고마워 ⛄", color: "#f5a524" },
  { id: "3", from: "구름", message: "메리 크리스마스!", color: "#3e63dd" },
  { id: "4", from: "노을", message: "발표 때 떨지 말고, 준비한 만큼만 하자. 우리 팀 최고.", color: "#30a46c" },
  { id: "5", from: "별", message: "🎄✨", color: "#d6409f" },
];
