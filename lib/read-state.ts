// 주인이 스노우볼을 "열었는지"와 "어떤 오너먼트를 읽었는지"를 이 브라우저에 기록합니다.
// DB 에는 이 값을 저장하는 곳이 없어서, 다른 기기에서는 처음(열기 전)부터 보입니다.
// 저장소를 쓸 수 없는 브라우저(시크릿 모드 등)에서도 오류 없이 지나갑니다.

export type ReadState = { opened: boolean; read: string[] };

const key = (nickname: string) => `snowglobe:read:${nickname.trim().toLowerCase()}`;
const EMPTY: ReadState = { opened: false, read: [] };

export function loadReadState(nickname: string): ReadState {
  try {
    const raw = window.localStorage.getItem(key(nickname));
    if (!raw) return EMPTY;
    const value = JSON.parse(raw) as Partial<ReadState>;
    return { opened: value.opened === true, read: Array.isArray(value.read) ? value.read.filter((id) => typeof id === "string") : [] };
  } catch {
    return EMPTY;
  }
}

export function saveReadState(nickname: string, state: ReadState) {
  try {
    window.localStorage.setItem(key(nickname), JSON.stringify(state));
  } catch {
    // 저장하지 못하면 이번 방문에서만 기억합니다
  }
}
