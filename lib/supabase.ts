import { createClient } from "@supabase/supabase-js";

// 이 프로젝트의 테이블과 함수는 snowglobe 스키마에 있습니다. (db.md 참고)
const connect = (url: string, key: string) => createClient(url, key, { db: { schema: "snowglobe" } });

let client: ReturnType<typeof connect> | null = null;

// Supabase 연결을 돌려줍니다. .env.local 에 값이 없으면 null 을 돌려주므로,
// 키가 없는 PC 에서도 화면 작업은 샘플 데이터로 계속할 수 있습니다.
// 사용 예: getSupabase()?.rpc("get_globe", { p_nickname: "test123" })
export function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  client ??= connect(url, key);
  return client;
}
