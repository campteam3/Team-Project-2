---
version: 1
slug: "app-page-tsx"
primary_target: "app/page.tsx"
related_targets: []
---

# 주인 흐름 01~04 · 시안 A

## Scope
- 화면: 01 오프닝, 02 꾸미기, 03 정보 입력, 04 완성·공유 (웹 1440×1024 기준, 반응형)
- Mode: operate (생성 → 공유 과업)
- 산출물: Figma 시안 A (파일 cyLZBDJgSdH22ftR5AqzOO), 이후 코드로 옮김
- 시안 B 후보로 남긴 구조: 받침대 명판(입력이 받침대에서 일어남), 상단 진행 리본 + 하단 고정 시트

## Audience · task
- 처음 온 20대(첫 대상 캠프 동기)가 설명 없이 스노우볼을 만들고 링크를 복사한다
- 디자인 지표: 생성~공유 과업 성공률, 소요 시간. A/B 는 화면 구성 방식만 다르게 비교

## Constraints from the user
- 01: "이게 뭔지 + 바로 시작". 오너먼트가 달린 예시 스노우볼로 결과를 먼저 보여 준다
- 피할 것: 입력 단계가 길게 느껴짐, UI 가 스노우볼을 가림, 흔한 앱 화면처럼 보임, 공유 방법을 못 찾음

## Direction contract

THESIS: 화면 전체가 스노우볼 무대이고 UI 는 아래 알약 도크 한 줄로만 말한다. 폼 화면 · 설정 화면 · 좌우 분할이라는 생성 흐름의 기본 배치를 거부한다.

OWN-WORLD: 밤하늘 #0B1020→#1A2340 위 따뜻한 흰 글자, 반투명 유리 알약 도크와 24px 유리 카드, 레드 #C8363D 는 한 화면에 주 버튼 하나와 선택 테두리에만. 불빛 골드는 장식에만. Pretendard 400/600/700.

STORY: 01 에서 친구 마음이 오너먼트로 달린 스노우볼을 보고 무엇인지 알고 바로 시작 → 02 도크에서 고르면 스노우볼이 즉시 바뀜 → 03 카드 하나에 이름 · 비밀번호 두 칸 → 04 링크가 도크 한가운데 놓이고 "링크 복사"가 주 버튼.

FIRST VIEWPORT: 01 · 스노우볼이 가운데 화면 높이 약 62%, 위쪽 가운데 한 줄 제목, 그 아래 보조 한 줄, 아래 가운데 유리 도크 안 레드 주 버튼 "내 스노우볼 만들기". 왼쪽 위 전체 화면, 오른쪽 위 소리 · 눈 아이콘.

FORM: 하단 도크 + 팝오버(와이어프레임 v2 계승). 내 목록 7개 중 2번. seed:b614bd739f653391. 시그니처 움직임: 카드가 올라오면 스노우볼이 같은 곡선으로 위로 작게 물러나고, 카드가 내려가면 돌아온다.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
