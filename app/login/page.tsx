import { Suspense } from "react";
import ModelPreload from "@/components/ModelPreload";
import GlobeStatus from "@/components/stage/GlobeStatus";
import LoginView from "@/components/owner/LoginView";

// 닉네임 + 비밀번호로 내 홈에 들어가기 (08, 김미영: 무대 화면 LoginView 로 바꿈. EntryForm 은 그대로 둠)
export default function LoginPage() {
  return (
    <>
      <ModelPreload />
      <Suspense fallback={<GlobeStatus kind="loading" />}>
        <LoginView />
      </Suspense>
    </>
  );
}
