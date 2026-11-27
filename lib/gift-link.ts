// 받은 기념 메시지를 내 스노우볼에 달 때, 그 번호를 만들기 · 로그인 화면에 넘기는 주소 규칙 (FEEDBACK F1, 차명근)
// 예: /new?gift=<번호>, /login?gift=<번호>

const KEY = "gift";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 주소에서 기념 메시지 번호를 읽습니다. 형식이 틀리면 없는 것으로 봅니다.
export function giftParam(search: Pick<URLSearchParams, "get">): string | null {
  const value = (search.get(KEY) ?? "").trim();
  return UUID.test(value) ? value : null;
}

// 달고 나서 스노우볼 화면으로 갈 때는 번호 대신 결과("added" · "already")를 붙여 알림을 띄웁니다
export type GiftResult = "added" | "already";
export function giftResult(search: Pick<URLSearchParams, "get">): GiftResult | null {
  const value = search.get(KEY);
  return value === "added" || value === "already" ? value : null;
}

// 주소 뒤에 기념 메시지 번호(또는 결과)를 붙입니다
export function withGift(path: string, giftId: string): string {
  return `${path}${path.includes("?") ? "&" : "?"}${KEY}=${encodeURIComponent(giftId)}`;
}
