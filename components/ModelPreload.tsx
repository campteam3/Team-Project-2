// 스노우볼 3D 모델을 화면 코드보다 먼저 받기 시작합니다 (FEEDBACK A8).
// 예전에는 app/layout.tsx 에 있어 모든 페이지가 받았는데, 기념 메시지 화면(/gift/*)은 스노우볼이 없어서
// 스노우볼을 그리는 페이지에만 둡니다 (FEEDBACK F1, 차명근). React 가 이 <link> 를 <head> 로 올립니다.
export default function ModelPreload() {
  return <link rel="preload" href="/models/snowglobe.glb" as="fetch" crossOrigin="anonymous" />;
}
