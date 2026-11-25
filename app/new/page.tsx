import { Suspense } from "react";
import EntryForm from "@/components/EntryForm";

// 스노우볼 만들기
export default function NewGlobePage() {
  return (
    <Suspense fallback={null}>
      <EntryForm mode="create" />
    </Suspense>
  );
}
