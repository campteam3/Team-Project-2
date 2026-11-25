import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

// Supabase 연결을 돌려줍니다. .env.local 에 값이 없으면 null 을 돌려주므로,
// 키가 없는 PC 에서도 화면 작업은 샘플 데이터로 계속할 수 있습니다.
export function getSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  client ??= createClient(url, key);
  return client;
}
