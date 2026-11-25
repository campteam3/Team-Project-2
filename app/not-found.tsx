import type { Metadata } from "next";
import NotFoundView from "@/components/NotFoundView";

// 없는 주소로 들어왔을 때의 404 화면 (김미영)
export const metadata: Metadata = { title: "찾을 수 없는 주소" };

export default function NotFound() {
  return <NotFoundView />;
}
