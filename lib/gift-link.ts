// 받은 기념 메시지를 내 스노우볼에 달 때, 그 번호를 만들기 · 로그인 화면에 넘기는 주소 규칙 (FEEDBACK F1, 차명근)
// 예: /new?gift=<번호>, /login?gift=<번호>

const KEY = "gift";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 주소에서 기념 메시지 번호를 읽습니다. 형식이 틀리면 없는 것으로 봅니다.
export function giftParam(search: Pick<URLSearchParams, "get">): string | null {
  const value = (search.get(KEY) ?? "").trim();
  return UUID.test(value) ? value : null;
}

// 주소 뒤에 기념 메시지 번호를 붙입니다
export function withGift(path: string, giftId: string): string {
  return `${path}${path.includes("?") ? "&" : "?"}${KEY}=${encodeURIComponent(giftId)}`;
}
