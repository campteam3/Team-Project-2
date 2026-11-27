import type { Metadata } from "next";
import { Suspense } from "react";
import GiftSendFlow from "@/components/gift/GiftSendFlow";

export const metadata: Metadata = { title: "기념 메시지 보내기" };

// 기념 메시지 보내기 (FEEDBACK F1)
export default function GiftNewPage() {
  return (
    <Suspense fallback={null}>
      <GiftSendFlow />
    </Suspense>
  );
}
