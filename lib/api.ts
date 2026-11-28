// DB 함수 호출 모음. 함수 목록과 오류 이름은 db.md 6번을 보세요.
// 모든 함수는 { ok: true, data } 또는 { ok: false, code, message } 를 돌려줍니다.
// message 는 화면에 그대로 보여 줄 수 있는 안내 문구입니다.

import { getSupabase } from "./supabase";

export type Ornament = {
  id: string;
  sender_name: string;
  shape: string;
  color: string;
  position: unknown;
  created_at: string;
  message?: string; // 주인이 읽을 때만 들어 있습니다
};

export type Globe = {
  nickname: string;
  title: string;
  theme: Record<string, unknown>;
  created_at: string;
  ornaments: Ornament[];
};

// 먼저 보내는 기념 메시지 (FEEDBACK F1). 링크(/gift/<id>)를 가진 누구나 읽습니다.
export type Gift = {
  id: string;
  sender_name: string;
  message: string;
  shape: string;
  color: string;
  created_at: string;
};

export type OpenResult =
  | { ok: true; owner_token: string }
  | { ok: false; reason: "invalid_password"; attempts_left: number }
  | { ok: false; reason: "locked"; retry_after_seconds: number }
  | { ok: false; reason: "globe_not_found" };

export type Result<T> = { ok: true; data: T } | { ok: false; code: string; message: string };

export const MESSAGE_MAX = 200; // DESIGN.md 기준. DB 도 200자까지 받습니다 (supabase/migrations 의 message_limit_200)
export const SENDER_MAX = 20;
export const NICKNAME_RULE = "한글, 영문, 숫자, _ , - 로 2~20자";

const MESSAGES: Record<string, string> = {
  invalid_nickname: `닉네임은 ${NICKNAME_RULE}로 정해 주세요.`,
  nickname_taken: "이미 쓰고 있는 닉네임이에요. 다른 닉네임을 정해 주세요.",
  invalid_title: "스노우볼 이름은 30자 안으로 정해 주세요.",
  invalid_password_format: "비밀번호는 4자 이상으로 정해 주세요.",
  invalid_theme: "꾸미기 값을 저장하지 못했어요.",
  globe_not_found: "스노우볼을 찾지 못했어요. 닉네임을 다시 확인해 주세요.",
  invalid_sender_name: `이름을 1~${SENDER_MAX}자로 적어 주세요.`,
  invalid_message: `메시지를 1~${MESSAGE_MAX}자로 적어 주세요.`,
  invalid_shape: "장식 모양을 다시 골라 주세요.",
  invalid_color: "장식 색을 다시 골라 주세요.",
  invalid_position: "장식 위치를 저장하지 못했어요.",
  globe_full: "이 스노우볼은 장식이 가득 찼어요.",
  gift_not_found: "기념 메시지를 찾지 못했어요. 링크를 다시 확인해 주세요.",
  // 욕설이 들어 있으면 DB 가 막습니다 (목록은 supabase/migrations 의 banned_words). 닉네임 · 이름 · 메시지 모두 같은 안내를 씁니다
  banned_word: "금지어가 포함되어 있어 등록할 수 없어요. 다른 말로 적어 주세요.",
  too_many_requests: "잠시 뒤에 다시 달아 주세요. 한꺼번에 많이 달 수 없어요.",
  invalid_owner_token: "다시 들어와 주세요. 닉네임과 비밀번호를 입력하면 돼요.",
  not_configured: "DB 연결 설정이 없어요. .env.local 을 확인해 주세요.",
  network: "연결이 불안정해요. 잠시 뒤에 다시 시도해 주세요.",
};

const fail = (code: string): { ok: false; code: string; message: string } => ({
  ok: false,
  code,
  message: MESSAGES[code] ?? MESSAGES.network,
});

async function call<T>(fn: string, args: Record<string, unknown>): Promise<Result<T>> {
  const supabase = getSupabase();
  if (!supabase) return fail("not_configured");
  try {
    const { data, error } = await supabase.rpc(fn, args);
    if (error) return fail(error.message in MESSAGES ? error.message : "network");
    return { ok: true, data: data as T };
  } catch {
    return fail("network");
  }
}

export const isNicknameAvailable = (nickname: string) =>
  call<boolean>("is_nickname_available", { p_nickname: nickname });

// theme: 꾸미기 값 (예: { tree: "green", prop: "star", base: "red", snow: "white" }). 값 목록은 lib/theme.ts
export const createGlobe = (
  nickname: string,
  password: string,
  title?: string,
  theme?: Record<string, unknown>,
) =>
  call<{ nickname: string; owner_token: string }>("create_globe", {
    p_nickname: nickname,
    p_password: password,
    p_title: title?.trim() || null,
    p_theme: theme ?? null,
  });

export const openGlobe = (nickname: string, password: string) =>
  call<OpenResult>("open_globe", { p_nickname: nickname, p_password: password });

export const getGlobe = (nickname: string) => call<Globe | null>("get_globe", { p_nickname: nickname });

// shape: 오너먼트 모양 ("ball" · "star" · "heart" · "cane" · "gift"). 값 목록은 lib/snowglobe.ts 의 ORNAMENT_SHAPES
export const addOrnament = (
  nickname: string,
  senderName: string,
  message: string,
  color: string,
  shape?: string,
) =>
  call<Ornament>("add_ornament", {
    p_nickname: nickname,
    p_sender_name: senderName,
    p_message: message,
    p_color: color,
    p_shape: shape ?? "ball",
  });

export const getMessages = (nickname: string, ownerToken: string) =>
  call<Ornament[]>("get_messages", { p_nickname: nickname, p_owner_token: ownerToken });

export const deleteOrnament = (nickname: string, ownerToken: string, ornamentId: string) =>
  call<boolean>("delete_ornament", {
    p_nickname: nickname,
    p_owner_token: ownerToken,
    p_ornament_id: ornamentId,
  });

export const closeGlobe = (ownerToken: string) => call<boolean>("close_globe", { p_owner_token: ownerToken });

// ── 기념 메시지 먼저 보내기 (FEEDBACK F1) ──

export const createGift = (senderName: string, message: string, color: string, shape?: string) =>
  call<{ id: string }>("create_gift", {
    p_sender_name: senderName,
    p_message: message,
    p_color: color,
    p_shape: shape ?? "ball",
  });

// 없거나 형식이 틀린 번호는 data 가 null 입니다 (오류 아님)
export const getGift = (id: string) => call<Gift | null>("get_gift", { p_id: id });

// 기념 메시지를 내 스노우볼에 답니다. 이미 달았으면 already 가 true 입니다.
export const addGiftToGlobe = (id: string, nickname: string, ownerToken: string) =>
  call<{ ornament_id: string; already: boolean }>("add_gift_to_globe", {
    p_id: id,
    p_nickname: nickname,
    p_owner_token: ownerToken,
  });

// 비밀번호로 열기 결과를 화면 문구로 바꿉니다.
export function openFailureMessage(result: Exclude<OpenResult, { ok: true }>): string {
  if (result.reason === "invalid_password") {
    return `비밀번호가 맞지 않아요. ${result.attempts_left}번 더 틀리면 10분 동안 잠겨요.`;
  }
  if (result.reason === "locked") {
    const minutes = Math.max(1, Math.ceil(result.retry_after_seconds / 60));
    return `여러 번 틀려서 잠겼어요. 약 ${minutes}분 뒤에 다시 시도해 주세요.`;
  }
  return MESSAGES.globe_not_found;
}
