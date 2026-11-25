// 주인 토큰을 이 브라우저에 저장합니다. 비밀번호는 저장하지 않습니다.
// 저장소를 쓸 수 없는 브라우저(시크릿 모드 등)에서도 오류 없이 지나갑니다.

const key = (nickname: string) => `snowglobe:owner:${nickname.trim().toLowerCase()}`;

export function loadOwnerToken(nickname: string): string | null {
  try {
    return window.localStorage.getItem(key(nickname));
  } catch {
    return null;
  }
}

export function saveOwnerToken(nickname: string, token: string) {
  try {
    window.localStorage.setItem(key(nickname), token);
  } catch {
    // 저장하지 못하면 이번 방문에서만 주인으로 남습니다
  }
}

export function clearOwnerToken(nickname: string) {
  try {
    window.localStorage.removeItem(key(nickname));
  } catch {
    // 지울 것이 없으면 그대로 둡니다
  }
}

// 닉네임을 주소에 넣을 때 쓰는 경로
export const globePath = (nickname: string) => `/globe/${encodeURIComponent(nickname.trim().toLowerCase())}`;
