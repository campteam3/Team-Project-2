# 새해 스노우볼 (2027 정미년) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 스노우볼 주제(`theme.kind`)에 `"newyear"` 를 더해, 새해 모델 · 전용 오너먼트 세 가지 · 폭죽 효과 · 고르기 버튼이 동작하게 한다.

**Architecture:** 주제 값 하나(`theme.kind`)가 모델 · 오너먼트 자리 · 오너먼트 모양 목록 · 효과 · 배경 · 꾸미기 선택지를 가른다. 새해 쪽은 **새 파일**로 만들고(`NewYearGlb.tsx`, `Fireworks.tsx`, `GlobeKindPicker.tsx`), 기존 파일(다른 팀원 담당)에는 "주제에 따라 고르는" 몇 줄만 넣는다. Blender 모델이 오기 전에는 **임시 모델**(이름 규칙만 맞춘 단순 도형)로 코드 전체를 먼저 돌려 보고, 진짜 glb 가 오면 파일만 바꾼다.

**Tech Stack:** Next.js 16 (App Router) · React Three Fiber · three 0.187 · gltf-transform (임시 모델 스크립트) · Blender Python (자리 내보내기)

**Spec:** `docs/superpowers/specs/2026-11-27-newyear-globe-design.md`

## 진행 상황 (2026-11-27)

계획을 쓴 뒤 작업자가 "Blender 를 설치해서 직접 진행"하라고 해서, 임시 모델 대신 **Blender 스크립트로 진짜 모델을 바로 만들었습니다.** 그래서 아래 계획과 달라진 점:

- Task 2 (임시 모델): 하지 않음. 대신 `scripts/blender/build_newyear.py`(장면 만들기) · `export_newyear.py`(glb · 자리 내보내기)로 `design/blender/newyear.blend`, `public/models/newyear.glb` · `ornaments-newyear.glb`, `lib/newyear-slots.json` 을 만듦. Blender MCP 는 쓰지 않고 Blender 를 화면 없이(`-b`) 스크립트로 돌림.
- Task 4: `NewYearGlb.tsx` 를 따로 만들지 않고 `GlobeModel` 에 `kind` 를 넘겨 파일만 바꿔 읽게 함 (유리 · 받침대 · 명판 코드를 그대로 씀). `?kind=` 미리 보기 스위치는 만들지 않음.
- Task 8: 일출 배경을 코드로 그린 SVG(`scripts/make-sunrise-backdrop.mjs`)로 만듦.
- Task 0 ~ 8 끝남 (이슈 #83). 받침대 문양은 햇살 문양 원 + 매듭 띠로 정했고, 기존 금색 눈송이 장식도 함께 뺌.
- 남은 것: 모델 다듬기(양 얼굴 · 털, 담장 길이, 오너먼트 생김새), 새해일 때 조명 색, `/new` 의 새해 모델 미리 받기, 실제 휴대폰 확인, 생일 담당과 `kind` 이름 맞추기.

## Global Constraints

- 마감: 2026-11-29(일) 23:59. 빠듯하면 spec 8번 순서로 줄인다 (노리개→엽전, 까치 빼기, 평소 폭죽 빼기, 일출 배경 대신 색만).
- `theme.kind`: `"christmas" | "birthday" | "newyear"`, 없거나 모르는 값이면 `"christmas"`. DB 는 바꾸지 않는다 (`theme` jsonb 2000바이트 제한 안).
- 이미 저장된 스노우볼(주제 값 없음)은 지금과 똑같이 보여야 한다.
- 오너먼트 자리 39개 (`ornament_limit` 과 같음). 새해 모양 이름: `pouch` · `kite` · `norigae`. 크리스마스 · 생일에서는 고를 수 없다.
- 담장 = 눈사람 자리 값(`snowman`), 떡국 = 선물 자리 값(`gift`) 을 그대로 쓴다. 양 · 2027 · 바닥 · 배경은 끄지 않는다.
- 좌표: 유리 중심 (0, 0.55, 0), 반지름 1, Y 가 위. 오브젝트 `w_` · 재질 `W_` 접두어 (spec 6번 이름 그대로).
- `prefers-reduced-motion`: 폭죽 없이 금가루만.
- 다른 팀원 파일(`Stage.tsx`, `StageScene.tsx`, `SnowGlobeGlb.tsx`, `OpeningView.tsx`, `CustomizeDock.tsx`, `OrnamentPickDock.tsx`)을 고치기 전에 이슈로 알린다 (작업자 승인 뒤 올림).
- Next.js 16: 화면 코드를 쓰기 전 `node_modules/next/dist/docs/` 의 해당 문서를 확인한다.
- 자동 테스트 틀이 없다. 확인은 `npm run lint` · `npm run build` · 브라우저 미리 보기(`/globe/demo?kind=newyear`)로 한다.
- 키 · 개인정보 · 참고 그림(스톡 이미지)은 커밋하지 않는다.

## Review Focus

1. **주제 값이 없는 예전 스노우볼** → 크리스마스로 보이고, 모양 · 자리 · 눈 효과가 하나도 달라지지 않는다 (Task 1, 4 에서 `/globe/demo` 를 전후 비교).
2. **새해 스노우볼에 `ball`/`star`/`heart`, 크리스마스에 `pouch` 오너먼트**(기념 메시지 `/gift` 로 넘어온 경우) → 깨지지 않고 그 주제의 첫 모양으로 그린다 (Task 1 의 `toShape(value, kind)`).
3. **`newyear.glb` 를 못 받았거나 오브젝트 이름이 빠짐**(까치를 뺀 모델 등) → 없는 것만 안 보이고 나머지는 그대로 나온다 (Task 4: 이름으로 찾되 없으면 건너뜀).
4. **주제를 바꾼 직후**(홈에서 크리스마스 → 새해) → 새 모델을 받는 동안 화면이 비지 않고, 받은 뒤 눈/폭죽이 서로 남지 않는다 (Task 6, 7).
5. **흔들기 연타 · 오래 켜 둠** → 폭죽 입자 수가 정해진 상한을 넘지 않는다 (Task 6: 고정 크기 버퍼를 돌려 씀).

---

## 파일 구조

| 파일 | 새로/고침 | 책임 |
| --- | --- | --- |
| `lib/theme.ts` | 고침 | `GlobeKind`, `theme.kind` 읽기 · 기본값, 주제별 소품 이름표 |
| `lib/snowglobe.ts` | 고침 | 주제별 자리 묶음 · 모양 목록, `placeOrnaments(ornaments, kind)` |
| `lib/newyear-slots.json` | 새로 | 새해 자리 39개 (`snowglobe-slots.json` 과 같은 형식) |
| `scripts/blender/export_slots.py` | 새로 | Blender 의 `Slot_00`~`Slot_38` Empty → 자리 json |
| `scripts/make-newyear-placeholder.mjs` | 새로 | 임시 `newyear.glb` · 임시 오너먼트 · 임시 자리 만들기 (진짜 모델이 오면 지움) |
| `components/snowglobe/NewYearGlb.tsx` | 새로 | 새해 모델 읽기, 재질 마감, 2027 정면 보기, 담장 · 떡국 켜고 끄기 |
| `components/snowglobe/OrnamentGlb.tsx` | 고침 | 새해 오너먼트 원형 세 가지 읽기 |
| `components/stage/Fireworks.tsx` | 새로 | 폭죽 · 금가루 (Snow 와 같은 props) |
| `components/stage/SnowGlobeModel.tsx` · `StageScene.tsx` | 고침 (몇 줄) | 주제에 따라 모델 · 효과 · 배경 고르기 |
| `components/stage/backdropShared.ts` · `PhotoBackdrop.tsx` | 고침 | 주제별 배경 그림 |
| `components/ui/GlobeKindPicker.tsx` · `Icons.tsx` | 새로 · 고침 | 고르기 버튼, 트리 · 케이크 · 양 아이콘 |
| `components/owner/OpeningView.tsx` · `OwnerFlow.tsx` · `CustomizeDock.tsx` · `components/friend/OrnamentPickDock.tsx` | 고침 (몇 줄) | 고른 주제 넘기기, 주제별 선택지 |

---

### Task 0: 팀원에게 알리기 (코드 없음)

- [ ] **Step 1:** 이슈 초안을 작업자에게 보여 주고 승인받는다. 제목 `[To 김미영, 이민정] 새해 스노우볼: theme.kind 값과 화면 파일에 넣을 연결 지점 알림`. 본문: (1) `theme.kind` 값 세 가지와 기본값 — 생일 담당과 이름 맞추기, (2) 아래 파일에 넣을 몇 줄의 위치(Task 4 · 7 · 8 · 9 의 Modify 목록), (3) `snowglobe-slots.json` 을 어떻게 뽑았는지 질문 (spec 7번).
- [ ] **Step 2:** 승인되면 `gh issue create` 로 올리고 번호를 PR 본문에 적는다.

### Task 1: 주제 값과 주제별 자리 · 모양 (`lib/`)

**Files:**
- Modify: `lib/theme.ts`, `lib/snowglobe.ts`
- Create: `lib/newyear-slots.json` (Task 2 의 스크립트가 만든 임시 값으로 시작)

**Interfaces — Produces:**
```ts
// lib/theme.ts
export const GLOBE_KINDS = ["christmas", "birthday", "newyear"] as const;
export type GlobeKind = (typeof GLOBE_KINDS)[number];
export type GlobeTheme = Record<ThemePart, string> & { kind: GlobeKind };
export const DEFAULT_THEME: GlobeTheme; // kind: "christmas"
export function toKind(value: unknown): GlobeKind; // 모르는 값 → "christmas"
export function themeParts(kind: GlobeKind): typeof THEME_PARTS; // 새해: 트리 · 눈 색깔 빠지고, 소품은 { snowman → "담장" }, { gift → "떡국" }
// lib/snowglobe.ts
export const ORNAMENT_SHAPES = ["ball", "star", "heart", "pouch", "kite", "norigae"] as const;
export function shapesFor(kind: GlobeKind): readonly OrnamentShape[]; // 새해: pouch · kite · norigae, 그 밖: ball · star · heart
export function toShape(value: string | undefined, kind?: GlobeKind): OrnamentShape; // 그 주제에 없는 모양 → shapesFor(kind)[0]
export function slotsFor(kind: GlobeKind): Slot[];
export function placeOrnaments<T extends OrnamentLike>(ornaments: T[], kind?: GlobeKind): PlacedOrnament<T>[];
export function ornamentSpot(ornaments: OrnamentLike[], index: number, shape?: OrnamentShape, kind?: GlobeKind): [number, number, number] | null;
```

- [ ] **Step 1:** `lib/theme.ts` 에 위 값들을 넣는다. `parseTheme` 은 `kind` 를 `toKind` 로 읽는다. 생일은 지금은 크리스마스와 같은 선택지를 돌려준다 (생일 담당이 채움).
- [ ] **Step 2:** `lib/snowglobe.ts`: `APART` · `BASE_SCORE` 처럼 `SLOTS` 에 묶인 값을 "자리 묶음" 하나(`{ slots, apart, baseScore }`)로 묶어 주제별로 만든다. 새해 모양 세 가지는 모두 `slope`(얹는 자리)로 보고 `cookieScale` 을 쓴다. `MAX_ORNAMENTS` 는 그대로 39 (두 json 모두 39개인지 모듈을 읽을 때 `console.error` 로 알림).
- [ ] **Step 3:** `Record<OrnamentShape, …>` 를 쓰는 곳(`OrnamentPickDock.tsx` 의 `SHAPE_LABEL`, `OrnamentGlb.tsx` 의 `TEMPLATE_NAMES` 등)이 타입 오류를 내므로 이름표만 채운다: 복주머니 · 방패연 · 노리개.
- [ ] **Step 4:** 확인 — `npx tsc --noEmit` 통과. 작은 확인 스크립트(스크래치)로 `parseTheme({})`.kind === "christmas", `parseTheme({kind:"newyear"}).kind === "newyear"`, `parseTheme({kind:"x"}).kind === "christmas"`, `toShape("ball","newyear") === "pouch"`, `toShape("pouch","christmas") === "ball"`, `placeOrnaments(39개,"newyear").length === 39` 이고 자리 id 가 겹치지 않음, `placeOrnaments(목록)` 결과가 고치기 전과 같음(크리스마스).
- [ ] **Step 5:** 커밋 `feat: 스노우볼 주제 값(theme.kind)과 주제별 오너먼트 자리 · 모양`

### Task 2: 임시 모델과 자리 내보내기 스크립트

**Files:**
- Create: `scripts/make-newyear-placeholder.mjs`, `scripts/blender/export_slots.py`
- Create (만든 결과): `public/models/newyear.glb`, `public/models/ornaments-newyear.glb`, `lib/newyear-slots.json`

**Interfaces — Produces:** spec 6번 이름 그대로의 오브젝트 · 재질.
- `newyear.glb`: `snowglobe.glb` 에서 유리 · 받침대 · 명판만 남기고(호랑가시나무 재질 `W_Base_Holly*` 메시는 뺌) `w_Sheep`(재질 `W_Sheep_Wool`, 타원체) · `w_Sheep_Face`(`W_Sheep_Face`) · `w_Year2027`(`W_Year_Red`, 납작한 상자) · `w_HanokWall` · `w_HanokWall_Snow`(`W_Snow_Sparkle`) · `w_Magpie` · `w_Soban` · `w_Tteokguk` · `w_Yard`(`W_Yard`) 를 단순 도형으로 넣는다.
- `ornaments-newyear.glb`: `t_Orn_Pouch` · `t_Orn_Kite` · `t_Orn_Norigae`, 재질 `Orn_Main` · `Orn_Accent`.
- `newyear-slots.json`: 양 몸통 타원체 표면에 39개, 얼굴(+z 앞쪽 위) 쪽은 비움, `kind: "slope"`, `ballScale: null`.

- [ ] **Step 1:** `make-newyear-placeholder.mjs` 를 gltf-transform 으로 쓴다. 양 몸통 타원체의 중심 · 반지름은 상수 한 곳에 두고 모델과 자리가 같이 쓴다.
- [ ] **Step 2:** `export_slots.py`: 이름이 `Slot_` 로 시작하는 Empty 를 번호순으로 읽어 Blender(Z 위) → glTF(Y 위) 좌표로 바꾸고 `snowglobe-slots.json` 과 같은 키로 쓴다. 39개가 아니면 오류로 멈춘다. 쓰는 법을 파일 맨 위 주석에 적는다 (Blender > Scripting 에서 실행).
- [ ] **Step 3:** `node scripts/make-newyear-placeholder.mjs` 실행 → 세 파일이 생기고, `npm run compress:models` 가 새 glb 에서도 오류 없이 돈다 (압축 스크립트가 파일 이름을 정해 두었으면 목록에 더함).
- [ ] **Step 4:** 커밋 `chore: 새해 스노우볼 임시 모델 · 자리 내보내기 스크립트`

### Task 3: 새해 오너먼트 원형 읽기

**Files:** Modify `components/snowglobe/OrnamentGlb.tsx`

**Interfaces:**
- Consumes: `OrnamentShape`, `shapesFor` (Task 1), `ornaments-newyear.glb` (Task 2)
- Produces: `useOrnamentTemplates(kind?: GlobeKind)` — 그 주제의 파일만 받는다 (크리스마스 화면은 새해 오너먼트 파일을 받지 않음). `SingleOrnament({ shape, color })` 는 모양으로 파일을 고른다.

- [ ] **Step 1:** 모양 → `{ url, 원형 이름 }` 표를 두고 훅이 주제의 파일 하나만 `useGLTF` 하게 고친다. 원형이 없으면 빈 배열(안 그림).
- [ ] **Step 2:** 새해 오너먼트는 "브로치처럼 붙임": `role === "metal"` 중 고리는 숨기지 않고 모델 쪽에서 처리하므로 코드는 그대로. (노리개 고리는 금속으로 남음)
- [ ] **Step 3:** 확인 — `npm run lint`, `/gift/new` 에서 기존 세 모양이 그대로 보임.
- [ ] **Step 4:** 커밋

### Task 4: 새해 모델 그리기

**Files:**
- Create: `components/snowglobe/NewYearGlb.tsx`
- Modify: `components/snowglobe/SnowGlobeGlb.tsx` (재질 마감 · 유리 · 명판 함수 `export` 만), `components/stage/SnowGlobeModel.tsx` (주제 분기), `components/ModelPreload.tsx` (`kind` prop)

**Interfaces:**
- Consumes: `theme.kind`, `hasProp` , `slotsFor`
- Produces: `NewYearModel({ title, baseColor, showWall, showTteokguk }: { title?: string; baseColor?: string; showWall?: boolean; showTteokguk?: boolean })`

- [ ] **Step 1:** `SnowGlobeGlb.tsx` 의 유리 · 받침대 · 명판 · `MATERIAL_TUNES` 적용 부분을 `NewYearGlb.tsx` 가 불러 쓸 수 있게 `export` 한다 (동작은 바꾸지 않음). `MATERIAL_TUNES` 에 `W_Sheep_Wool`(무광, 거칠기 0.9) · `W_Sheep_Face` · `W_Year_Red`(붉은색 + 은은한 emissive) · `W_Yard`(무광 황토) 를 더한다.
- [ ] **Step 2:** `NewYearModel`: `w_HanokWall*` · `w_Magpie*` 는 `showWall`, `w_Soban*` · `w_Tteokguk*` 는 `showTteokguk` 으로 켜고 끈다. `w_Year2027` 은 `useFrame` 에서 카메라 쪽(Y 축만)으로 돌리고 천천히 살짝 흔든다 (reducedMotion 이면 흔들지 않음). 이름으로 찾은 것이 없으면 건너뛴다.
- [ ] **Step 3:** `SnowGlobeModel.tsx`: `theme.kind === "newyear"` 이면 `NewYearModel` 을, 아니면 지금 그대로. `remember` · `ornamentPosition` 과 `Ornaments` 에 `kind` 를 넘긴다. `MODEL.floorY` 등 바깥 값은 그대로.
- [ ] **Step 4:** `[테스트용] ?props=test` 와 같은 방식으로 `?kind=newyear` 를 붙이면 그 탭에서 새해로 보이는 미리 보기 스위치를 둔다 (Task 7 이 끝나면 지움).
- [ ] **Step 5:** 확인 — `/globe/demo?kind=newyear` 에서 임시 양 · 2027 · 담장 · 떡국이 보이고 오너먼트가 양 몸통에 붙는다. 돌려도 2027 이 정면. `/globe/demo` 는 전과 같다 (스크린숏 비교). 콘솔 오류 없음.
- [ ] **Step 6:** 커밋 `feat: 새해 스노우볼 모델 그리기 (임시 모델)`

### Task 5: 꾸미기 · 오너먼트 고르기 (주제별 선택지)

**Files:** Modify `components/owner/CustomizeDock.tsx`, `components/friend/OrnamentPickDock.tsx`, 그리고 `kind` 를 넘겨야 하는 부모(`FriendFlow.tsx`, `components/gift/*`)

- [ ] **Step 1:** `CustomizeDock`: `THEME_PARTS` 대신 `themeParts(theme.kind)`. 새해에서는 탭이 "소품(담장 · 떡국)" · "받침대" 둘.
- [ ] **Step 2:** `OrnamentPickDock`: `ORNAMENT_SHAPES` 대신 `shapesFor(kind)`. 처음 고른 모양도 `shapesFor(kind)[0]`.
- [ ] **Step 3:** 기념 메시지(`/gift`)는 받는 스노우볼의 주제를 모르므로 지금처럼 볼 · 별 · 하트만 (Review Focus 2 가 처리).
- [ ] **Step 4:** 확인 — `/new?kind=newyear`(Task 4 의 스위치)에서 담장 · 떡국 버튼이 장면을 켜고 끈다. 친구 화면에서 새해일 때만 세 모양이 보인다. lint · build.
- [ ] **Step 5:** 커밋

### Task 6: 폭죽 · 금가루

**Files:**
- Create: `components/stage/Fireworks.tsx`
- Modify: `components/stage/StageScene.tsx` (새해면 `<Snow>` 대신 `<Fireworks>`)

**Interfaces — Produces:** `Fireworks({ shakeSignal, reducedMotion }: { shakeSignal: number; reducedMotion: boolean })` (Snow 와 같은 신호)

- [ ] **Step 1:** 고정 크기 버퍼(불꽃 약 600 + 금가루 약 300, `THREE.Points` + 셰이더, additive)로 만든다. 값: 평소 5~8초마다 하나, 위치는 유리 안 위쪽(y 0.25~0.7, 반지름 0.55 안, 2027 · 양 정면을 피해 옆 · 뒤쪽 위주). 흔들면 1.2초 동안 5~7발이 연달아 터지고, 불꽃이 식으면 금가루가 되어 `MODEL.floorY` 까지 천천히 내려앉아 옅어진다. 색: 금 `#F6D79A` 기본, 빨강 `#E5484D` · 분홍 `#F4A9C2` 조금. 유리 안쪽 면(반지름 0.94) 밖으로 나가지 않는다.
- [ ] **Step 2:** `reducedMotion`: 터지지 않고 금가루만 조용히 떠 있다가 내려앉는다.
- [ ] **Step 3:** 확인 — `/globe/demo?kind=newyear` 에서 기다리면 한 발, 흔들면(PC: 흔들기 버튼/끌기) 연달아 터짐. 30초 연타해도 프레임이 떨어지지 않음. 브라우저에서 동작 줄이기를 켜면 폭죽 없음.
- [ ] **Step 4:** 커밋 `feat: 새해 스노우볼 폭죽 · 금가루`

### Task 7: 스노우볼 고르기 버튼 (spec 3-3)

**Files:**
- Create: `components/ui/GlobeKindPicker.tsx`
- Modify: `components/ui/Icons.tsx` (`tree` · `cake` · `sheep` · `chevron-down`, 24 격자 · 선 굵기 지금 아이콘과 같게), `components/stage/Stage.tsx` (왼쪽 위 자리 하나: `topLeft?: ReactNode`), `components/owner/OpeningView.tsx`, `components/owner/OwnerFlow.tsx`, `app/new/page.tsx`

**Interfaces — Produces:** `GlobeKindPicker({ kind, onPick }: { kind: GlobeKind; onPick: (kind: GlobeKind) => void })`

- [ ] **Step 1:** 버튼(아래 화살표) → 누르면 아래로 아이콘 세 개가 펼쳐짐(토글). 버튼마다 `aria-label`(크리스마스 · 생일 · 새해) · `title`, 고른 것은 `aria-pressed` 와 테두리. 바깥을 누르거나 Esc 로 닫힘. 자리: 휴대폰 왼쪽 위, PC 는 전체 화면 버튼 바로 아래.
- [ ] **Step 2:** `OpeningView`: 고른 주제를 state 로 두고 `Stage` 의 `theme` 에 넣는다. "내 스노우볼 만들기" 는 `/new?kind=…` 로 간다 (크리스마스면 붙이지 않음). `OwnerFlow` 는 `kind` 로 처음 테마를 만든다 (`searchParams` 는 Next 16 문서 확인).
- [ ] **Step 3:** Task 4 의 `?kind=` 미리 보기 스위치를 지운다. 생일은 모델이 아직 없으므로 생일 코드가 들어올 때까지 목록에서 숨기는 값(`AVAILABLE_KINDS`) 하나로 가린다.
- [ ] **Step 4:** 확인 — 홈에서 새해를 고르면 스노우볼이 바뀌고, 만들기로 가서 만들면 `/globe/닉네임` 이 새해로 열린다 (DB `theme.kind` 저장). 키보드만으로 고를 수 있다. 휴대폰 너비(375)에서 다른 버튼과 겹치지 않는다.
- [ ] **Step 5:** 커밋 `feat: 스노우볼 고르기 버튼 (크리스마스 · 새해)`

### Task 8: 일출 배경

**Files:** Modify `components/stage/backdropShared.ts`, `PhotoBackdrop.tsx`, `VillageBackdrop.tsx`, `StageScene.tsx`

- [ ] **Step 1:** 배경 그림 표를 주제별로 (`BACKDROPS[kind]`). 일출 그림이 준비되기 전에는 spec 8-4 대로 지금 그림에 따뜻한 색을 입히는 값(`tint`)으로 대신한다.
- [ ] **Step 2:** 그림이 오면 `public/backgrounds/sunrise-web.webp` · `sunrise-mobile.webp` 로 넣고 비율을 고친다. 유리에 비치는 빛(`NightLights`)도 새해에는 따뜻한 색으로.
- [ ] **Step 3:** 확인 · 커밋

### Task 9: 진짜 모델로 바꾸기 (Blender 결과가 온 뒤)

- [ ] **Step 1:** `newyear.glb` · `ornaments-newyear.glb` 를 바꿔 넣고, Blender 에서 `export_slots.py` 로 `lib/newyear-slots.json` 을 다시 뽑는다.
- [ ] **Step 2:** `scripts/make-newyear-placeholder.mjs` 를 지운다. 오브젝트 · 재질 이름이 spec 과 다른 곳을 맞춘다. 재질 마감 값(양털 · 2027 · 황토)을 화면을 보며 고친다. 눈/폭죽이 피해 갈 모양(양 몸통) 값을 잰다.
- [ ] **Step 3:** `npm run build`(모델 자동 압축) → 용량 확인. 배포 주소에서 휴대폰 확인(돌리기 · 흔들기)은 작업자가 한다.
- [ ] **Step 4:** `DESIGN.md` 변경 기록, 위임 로그(`docs/위임로그/차명근.md`), `git pull origin main` → push → PR.

---

## 순서와 마감

| 언제 | 에이전트 (코드) | 차명근 (Blender) |
| --- | --- | --- |
| 11/27 (오늘) | Task 0 · 1 · 2 · 3 · 4 | 양 · 2027 · 마당부터 |
| 11/28 | Task 5 · 6 · 7 · 8 | 담장 · 떡국 · 오너먼트 세 가지 · 자리 39개 |
| 11/29 | Task 9, 휴대폰 확인, PR | 받침대 문양 (시간이 되면) |

11/28 저녁까지 진짜 모델이 안 오면 spec 8번대로 줄인다. 받침대 전통 문양은 spec 3-1 의 "시간이 없으면" 순서를 따른다.
