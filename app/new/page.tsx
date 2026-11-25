import { Suspense } from "react";
import OwnerFlow from "@/components/owner/OwnerFlow";

// 스노우볼 만들기: 02 꾸미기 → 03 정보 입력 → 04 완성 · 공유
export default function NewGlobePage() {
  return (
    <Suspense fallback={null}>
      <OwnerFlow />
    </Suspense>
  );
}
