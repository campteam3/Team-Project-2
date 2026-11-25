import { Suspense } from "react";
import GlobeView from "@/components/GlobeView";

// 스노우볼 보기: /globe/스노우볼주소
export default function GlobePage() {
  return (
    <Suspense fallback={null}>
      <GlobeView />
    </Suspense>
  );
}
