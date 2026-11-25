import { Suspense } from "react";
import EntryForm from "@/components/EntryForm";

// 닉네임 + 비밀번호로 내 홈에 들어가기
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <EntryForm mode="login" />
    </Suspense>
  );
}
