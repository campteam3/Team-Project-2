// 손에 든 오너먼트와, 손에서 트리로 날아가 달리는 움직임이 함께 쓰는 값 (마음 달기 2단계 → 완료, 이민정)
// 3D 코드(SnowGlobeGlb · StageScene)와 화면 코드(FriendFlow)가 같이 읽으므로, three 를 불러오지 않는 가벼운 파일로 따로 둡니다.

export const HAND_HEIGHT = 1.55; // 화면에서 보이는 높이 (GiftOrnamentScene 의 TARGET_HEIGHT 와 같게)
export const HAND_Y = 0.45; // 화면 가운데보다 조금 위 (GiftOrnamentScene 의 CENTER_Y 와 같게)

// 손에 든 오너먼트를 띄울 자리와 크기 (화면 가운데 기준, 스노우볼이 놓이는 깊이에서 잰 길이).
// 메시지 카드에 가리지 않는 빈 곳을 무대(StageScene)가 매 프레임 적어 줍니다. 적어 주지 않으면 화면 가운데 조금 위입니다.
export const handSpot = { x: 0, y: HAND_Y, height: HAND_HEIGHT };

export const FLY_WAIT = 0.3; // 스노우볼이 올라오기를 잠깐 기다렸다가
export const FLY_SECONDS = 1.35; // 날아가는 시간
export const LAND_POP = 0.35; // 달린 뒤 살짝 커졌다 돌아오는 시간
export const FLY_TOTAL = FLY_WAIT + FLY_SECONDS + LAND_POP; // 화면 쪽이 "다 달렸다"고 볼 때 씁니다 (초)
