# 기념 메시지 먼저 보내기 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 첫 화면에서 오너먼트 하나와 메시지를 만들어 링크로 보내고, 받은 사람이 그 오너먼트를 열어 읽고 자기 스노우볼에 달 수 있게 한다 (FEEDBACK F1).

**Architecture:** 기념 메시지는 새 표 `snowglobe.gifts` 에 저장하고 DB 함수 3개(`create_gift` · `get_gift` · `add_gift_to_globe`)로만 다룬다. 보내기(`/gift/new`)와 받기(`/gift/[id]`)는 지금의 무대(`Stage`)를 쓰되, 스노우볼 대신 "오너먼트 하나만 크게" 장면을 끼워 넣는다. 보관은 지금의 만들기 · 로그인 흐름이 끝난 직후 주인 토큰으로 `add_gift_to_globe` 를 부른다.

**Tech Stack:** Next.js 16 (App Router, cacheComponents), React 19, Tailwind 4, React Three Fiber + drei, Supabase (snowglobe 스키마, RPC 만), Vercel.

**Spec:** `docs/superpowers/specs/2026-11-27-gift-message-design.md`

## Global Constraints

- 마감 2026-11-29(일) 23:59. 빠듯하면 연출(오너먼트 떠서 돌기)을 줄이고 보내기 → 읽기 → 보관 흐름을 먼저 끝낸다.
- 링크 번호는 UUID(`gen_random_uuid()`). 링크를 가진 사람은 누구나 읽고, 누구나 각자 자기 스노우볼에 달 수 있다.
- 지금 규칙을 그대로: 이름 1~20자, 메시지 1~200자, 금지어(`snowglobe.has_banned_word`), 스노우볼당 39개, 한 스노우볼에 1분 10개.
- 같은 스노우볼에 같은 기념 메시지는 한 번만.
- 보관한 오너먼트의 `created_at` 은 **보관한 시각**(`now()`). 위치는 지금처럼 자동(`position` 비움).
- 받는 사람 이름은 받지 않는다. 위치 고르기 · 고치기 · 지우기 · 만료 · 알림은 없다.
- 표는 직접 읽지 못하게(RLS 켜고 정책 없음), 함수는 `security definer` + `set search_path = ''`, `anon` 에 실행 권한.
- 받은 사람 화면은 스노우볼 모델(`/models/snowglobe.glb`)을 받지 않는다. 오너먼트 모델(`/models/ornaments.glb`)만.
- 문구는 다정한 해요체, 이모지 없음 (DESIGN.md 10장). 빨간 주 버튼은 한 화면에 하나.
- Next.js 코드를 쓰기 전에 `node_modules/next/dist/docs/` 의 해당 문서를 본다. 주소에 따라 미리보기가 바뀌는 페이지는 `app/globe/[id]/page.tsx` 의 `DynamicMarker` 방식을 따른다.
- 공개 저장소: 확인용 데이터는 지어낸 것으로 하고 끝나면 지운다.
- 다른 사람 파일(`OpeningView` · `OwnerFlow` · `LoginView` · `Stage` · `ShareDock` 김미영, `SnowGlobeGlb` 이민정)은 연결에 필요한 만큼만 고치고, 머지 뒤 이슈로 알린다.

## Review Focus

1. **없는 번호 · 형식이 틀린 번호로 `/gift/abc` 를 열 때**: 오류 화면이 아니라 "기념 메시지를 찾지 못했어요" 안내가 나와야 한다. (`get_gift` 가 uuid 형변환 오류를 내지 않고 null 을 돌려줘야 함 → Task 1)
2. **이미 단 기념 메시지를 다시 달려고 할 때**: 오류로 막히지 않고 "이미 달려 있어요"를 알리며 그 스노우볼로 간다. (Task 1 · Task 6)
3. **가득 찬(39개) 스노우볼에 달려고 할 때**: 로그인은 되지만 "가득 찼어요"를 알리고, 받은 오너먼트 화면이나 로그인 화면에 머문다. (Task 6)
4. **보내는 사람 이름 · 메시지에 금지어**: 보내기 화면에서 금지어 안내가 뜨고 링크가 만들어지지 않는다. (Task 1 트리거, Task 4 확인)
5. **만들기 도중 이름이 이미 있는 닉네임**: 지금처럼 만들기 화면에서 안내가 뜨고, 기념 메시지는 그 뒤 성공했을 때만 달린다. (Task 6)

---

## 파일 구조

| 파일 | 하는 일 |
| --- | --- |
| `supabase/migrations/20261127090000_gifts.sql` (새) | `gifts` 표, `ornaments.gift_id`, 금지어 트리거, 함수 3개 |
| `lib/api.ts` | `Gift` 타입, `createGift` · `getGift` · `addGiftToGlobe`, 오류 문구 |
| `lib/kakao.ts` | `shareKakao` 에 설명 · 버튼 글자를 바꿀 수 있는 선택 인자 |
| `components/owner/ShareDock.tsx` | 공유 문구를 바꿀 수 있는 선택 prop |
| `components/snowglobe/OrnamentGlb.tsx` (새) | 오너먼트 모델 읽기 · 색 입히기(지금 `SnowGlobeGlb.tsx` 에서 옮김) + `SingleOrnament` |
| `components/snowglobe/SnowGlobeGlb.tsx` | 옮긴 부분을 `OrnamentGlb.tsx` 에서 가져다 씀 |
| `components/gift/GiftOrnamentScene.tsx` (새) | "오너먼트 하나만 크게" 3D 장면 |
| `components/stage/Stage.tsx` | `scene` prop: 주면 스노우볼 대신 그 장면을 그림 |
| `components/gift/GiftSendFlow.tsx` (새), `app/gift/new/page.tsx` (새) | 보내기: 고르기 → 쓰기 → 링크 |
| `components/gift/GiftView.tsx` (새), `components/gift/GiftMessageCard.tsx` (새), `app/gift/[id]/page.tsx` (새) | 받기: 오너먼트 · 메시지 · 보관 버튼 |
| `lib/gift-link.ts` (새) | 보관할 기념 메시지 번호를 주소(`?gift=`)에서 읽고 쓰기 |
| `components/owner/OwnerFlow.tsx`, `components/owner/LoginView.tsx` | 만들기 · 로그인 직후 `addGiftToGlobe` |
| `components/owner/OpeningView.tsx` | [기념 메시지 보내기] 보조 버튼 |
| `app/layout.tsx`, `components/ModelPreload.tsx` (새), 스노우볼 쓰는 페이지 4개 | 스노우볼 모델 미리 받기를 전체에서 페이지별로 옮김 |

확인 스크립트(자동 브라우저)는 저장소 밖 임시 폴더에 두고 커밋하지 않는다. 이 저장소에는 테스트 도구가 없으므로, 각 Task 의 "테스트"는 실제 DB 에 대한 SQL 확인과 자동 브라우저 확인이다.

---

### Task 1: DB — 기념 메시지 표와 함수

**Files:**
- Create: `supabase/migrations/20261127090000_gifts.sql`
- Modify: `db.md` (4장 표, 6장 함수 · 오류 이름, 9장 적용 기록)

**Interfaces:**
- Produces (DB 함수, 모두 `anon` 실행 가능):
  - `snowglobe.create_gift(p_sender_name text, p_message text, p_shape text default 'ball', p_color text default '#e5484d') returns jsonb` → `{ "id": uuid }`
  - `snowglobe.get_gift(p_id text) returns jsonb` → `{ id, sender_name, message, shape, color, created_at }` 또는 `null` (없거나 형식이 틀린 번호)
  - `snowglobe.add_gift_to_globe(p_id text, p_nickname text, p_owner_token text) returns jsonb` → `{ "ornament_id": uuid, "already": boolean }`
  - 오류 이름: `gift_not_found`, 그리고 기존 `invalid_owner_token` · `globe_full` · `too_many_requests` · `invalid_sender_name` · `invalid_message` · `invalid_shape` · `invalid_color` · `banned_word`

- [ ] **Step 1: 확인 SQL 을 먼저 적는다 (적용 전에는 실패해야 함)**

```sql
-- 실제 DB(wanted_practice, snowglobe 스키마)에서 execute_sql 로 실행
select snowglobe.create_gift('보내는이', '확인용 메시지', 'star', '#F2C46D');            -- {"id": ...}
select snowglobe.get_gift('<위 id>');                                                  -- sender_name · message 가 같음
select snowglobe.get_gift('00000000-0000-0000-0000-000000000000');                     -- null
select snowglobe.get_gift('abc');                                                      -- null (오류 아님)
select snowglobe.create_gift('보내는이', '병신', 'ball', '#C8363D');                    -- 오류 banned_word
select snowglobe.create_gift('보내는이', repeat('가', 201), 'ball', '#C8363D');         -- 오류 invalid_message
-- 테스트 스노우볼(지어낸 닉네임)을 create_globe 로 만들고 받은 owner_token 으로:
select snowglobe.add_gift_to_globe('<id>', '<닉네임>', '<토큰>');                        -- already=false
select snowglobe.add_gift_to_globe('<id>', '<닉네임>', '<토큰>');                        -- already=true, 오너먼트 수 그대로
select snowglobe.add_gift_to_globe('<id>', '<닉네임>', 'wrong');                         -- 오류 invalid_owner_token
select snowglobe.add_gift_to_globe('00000000-0000-0000-0000-000000000000', '<닉네임>', '<토큰>'); -- 오류 gift_not_found
-- 38개를 채운 스노우볼 + 서로 다른 기념 메시지 2개: 첫 번째 성공, 두 번째 오류 globe_full
-- anon 으로 표 직접 읽기 (REST /rest/v1/gifts): 401
```

- [ ] **Step 2: 실행해 함수가 없어 실패하는 것을 본다**

Expected: `function snowglobe.create_gift(...) does not exist`

- [ ] **Step 3: 마이그레이션 작성**

- `snowglobe.gifts(id uuid primary key default gen_random_uuid(), sender_name text not null check (char_length between 1 and 20), message text not null check (char_length between 1 and 200), shape text not null check (char_length between 1 and 30), color text not null check (color ~ '^#[0-9a-fA-F]{6}$'), created_at timestamptz not null default now())`. RLS 켜기, 정책 없음.
- 금지어 트리거: `before insert on snowglobe.gifts` → `sender_name` · `message` 에 `snowglobe.has_banned_word` 가 참이면 `raise exception 'banned_word'` (20261126120000_banned_words.sql 과 같은 모양).
- `alter table snowglobe.ornaments add column gift_id uuid references snowglobe.gifts(id) on delete set null` + `unique (globe_id, gift_id)` (gift_id 가 null 인 줄은 겹쳐도 됨).
- `create_gift`: `add_ornament` 와 같은 순서로 다듬고(`btrim`) 검사해 `invalid_*` 오류를 낸 뒤 insert.
- `get_gift`: `p_id` 가 uuid 형식(`~* '^[0-9a-f-]{36}$'`)이 아니면 `null`. 아니면 한 줄을 jsonb 로, 없으면 `null`.
- `add_gift_to_globe`: `v_globe := snowglobe.owner_globe_id(p_nickname, p_owner_token)` → 기념 메시지가 없으면 `gift_not_found` → 이미 같은 `(globe_id, gift_id)` 가 있으면 그 오너먼트 id 와 `already=true` → 39개 이상이면 `globe_full` → 1분 10개면 `too_many_requests` → `ornaments` 에 `sender_name, message, shape, color, gift_id` 를 복사해 insert (`created_at` 기본값 = 보관 시각, `position` null).
- `grant execute ... to anon, authenticated` 세 함수. 기존 파일은 고치지 않는다.

- [ ] **Step 4: `apply_migration`(이름 `snowglobe_gifts`)으로 적용하고 Step 1 을 다시 실행**

Expected: 각 줄이 주석의 결과대로. 확인용 데이터(기념 메시지 · 스노우볼)는 지운다.

- [ ] **Step 5: `db.md` 갱신 후 커밋**

```bash
git add supabase/migrations/20261127090000_gifts.sql db.md
git commit -m "feat(db): 기념 메시지 표와 함수 (FEEDBACK F1)"
```

---

### Task 2: 화면에서 부르는 함수와 공유 문구

**Files:**
- Modify: `lib/api.ts`, `lib/kakao.ts`, `components/owner/ShareDock.tsx`

**Interfaces:**
- Consumes: Task 1 의 함수 3개
- Produces:
  - `type Gift = { id: string; sender_name: string; message: string; shape: string; color: string; created_at: string }`
  - `createGift(senderName: string, message: string, color: string, shape?: string): Promise<Result<{ id: string }>>`
  - `getGift(id: string): Promise<Result<Gift | null>>`
  - `addGiftToGlobe(id: string, nickname: string, ownerToken: string): Promise<Result<{ ornament_id: string; already: boolean }>>`
  - `MESSAGES.gift_not_found = "기념 메시지를 찾지 못했어요. 링크를 다시 확인해 주세요."`
  - `shareKakao(url: string, title: string, options?: { description?: string; button?: string }): Promise<boolean>` — 주지 않으면 지금 글자 그대로
  - `ShareDock` 에 선택 prop `share?: { description: string; button: string; text: string }` — `text` 는 기본 공유 창(`navigator.share`)의 글. 주지 않으면 지금 그대로.

- [ ] **Step 1: 함수와 타입을 더하고 `npx tsc --noEmit` · `npm run lint` 통과**
- [ ] **Step 2: 지금 화면(완성 화면 · 주인 화면)의 공유 글자가 그대로인 것을 확인** — 빌드한 사이트에서 `ShareDock` 의 버튼을 눌러 `shareKakao` 가 받은 인자를 자동 브라우저로 가로채 비교.
- [ ] **Step 3: 커밋** `feat: 기념 메시지 API 와 공유 문구 선택 (FEEDBACK F1)`

---

### Task 3: "오너먼트 하나만 크게" 장면

**Files:**
- Create: `components/snowglobe/OrnamentGlb.tsx`, `components/gift/GiftOrnamentScene.tsx`
- Modify: `components/snowglobe/SnowGlobeGlb.tsx` (옮긴 부분을 가져다 씀), `components/stage/Stage.tsx`

**Interfaces:**
- Produces:
  - `OrnamentGlb.tsx`: `useOrnamentTemplates()`, `pastel(color)`, `type TemplatePart`, `ORNAMENT_URL` 을 `SnowGlobeGlb.tsx` 에서 그대로 옮겨 export. `useGLTF.preload(ORNAMENT_URL)` 도 이 파일로. 그리고 `SingleOrnament({ shape, color }: { shape: OrnamentShape; color: string })` — 원점에 오너먼트 하나를 `SnowGlobeGlb` 의 `OrnamentItem` 과 같은 재질 규칙(본체 파스텔 · 무늬 · 금속)으로 그린다.
  - `GiftOrnamentScene({ shape, color, onOpen }: { shape: OrnamentShape; color: string; onOpen?: () => void })` — Canvas, 배경은 지금의 `VillageBackdrop`, 조명은 지금의 `NightLights`/`NightBloom`, 가운데 `SingleOrnament` 가 천천히 돌며 위아래로 살짝 뜬다(움직임 줄이기면 멈춤). 누르면 `onOpen`.
  - `Stage` 에 선택 prop `scene?: ReactNode`. 주면 스노우볼 장면(`StageScene`) · 명판 · 말풍선 대신 그것을 무대에 그린다. 위쪽 띠 · 제목 · 아래쪽 도크 · 키보드 처리 · 알림은 그대로.
- **조건:** `GiftOrnamentScene` 과 그것을 쓰는 페이지는 `SnowGlobeGlb.tsx` 를 import 하지 않는다 (그 파일이 스노우볼 모델을 미리 받기 때문).

- [ ] **Step 1: 확인 기준을 정한다** — 빌드한 사이트에서 `GiftOrnamentScene` 을 쓰는 임시 화면(Task 5 전이면 `/gift/new` 의 첫 단계)을 열고, 자동 브라우저로 (a) 받은 파일 목록에 `snowglobe.glb` 가 없고 `ornaments.glb` 는 있음 (b) 캔버스가 그려짐 (c) 모양 3종 · 색 6가지를 바꿔 캡처했을 때 스노우볼에 달린 오너먼트와 같은 모습.
- [ ] **Step 2: 지금 화면이 그대로인지 먼저 캡처해 둔다** — `/globe/demo` 를 확대해 오너먼트 캡처(옮기기 전).
- [ ] **Step 3: 옮기기와 새 장면, `Stage` 의 `scene` prop 구현**
- [ ] **Step 4: Step 1 · Step 2 를 다시 확인** — `/globe/demo` 오너먼트 캡처가 옮기기 전과 같음, Step 1 의 (a)(b)(c) 통과. `npm run lint`, `npm run build`.
- [ ] **Step 5: 커밋** `feat: 오너먼트 하나만 보여 주는 장면, Stage 의 scene (FEEDBACK F1)`

---

### Task 4: 보내기 화면 `/gift/new`

**Files:**
- Create: `app/gift/new/page.tsx`, `components/gift/GiftSendFlow.tsx`

**Interfaces:**
- Consumes: `createGift`, `GiftOrnamentScene`, `Stage({ scene })`, `OrnamentPickDock`, `MessageCard`, `ShareDock({ share })`, `ORNAMENT_OPTIONS`(lib/theme.ts), `toShape`
- Produces: 주소 `/gift/<id>` (받기 화면, Task 5)

단계와 글자(정해진 것):
1. **고르기** — 제목 "어떤 오너먼트로 보낼까요?", 부제 "1 / 2 단계". 도크는 `OrnamentPickDock`, 뒤로는 첫 화면(`/`).
2. **쓰기** — 제목 "마음을 적어 주세요", 부제 "2 / 2 단계 · 링크를 받은 사람이 열어 볼 수 있어요". `MessageCard`(기본 문구 포함). `MessageCard` 의 제출 버튼 글자는 그대로 두어도 된다.
3. **보냈어요** — 제목 "기념 메시지를 만들었어요", 부제 "링크를 보내면 받은 사람이 열어 보고 자기 스노우볼에 달 수 있어요". `ShareDock` 에 `url = ${origin}/gift/<id>`, `title = "<보내는 사람>님이 기념 메시지를 보냈어요"`, `share = { description: "눌러서 오너먼트를 열어 보세요.", button: "메시지 열어 보기", text: "기념 메시지를 보냈어요. 눌러서 열어 봐!" }`. 아래 작은 링크 "내 스노우볼도 만들기" → `/new`.
- 오류는 `createGift` 의 `message` 를 메시지 카드의 오류 자리에 보여 준다.

- [ ] **Step 1: 확인 스크립트를 먼저 쓴다** — 자동 브라우저(PC 1200 · 휴대폰 390 · 320): 고르기에서 모양 · 색을 바꾸면 장면이 바뀜 → 이름 "테스트" · 기본 문구 "연말 인사" → 보내기 → 링크가 `/gift/` + UUID 형식 → `get_gift` 로 읽은 값이 같음. 메시지에 금지어 → 금지어 안내, 링크 없음. 가로 넘침 없음.
- [ ] **Step 2: 실행해 실패(페이지 없음)를 본다**
- [ ] **Step 3: 구현** — `page.tsx` 는 `Suspense` 로 감싼 클라이언트 컴포넌트(`app/login/page.tsx` 와 같은 모양).
- [ ] **Step 4: 확인 스크립트 통과, `npm run lint` · `npm run build`**
- [ ] **Step 5: 커밋** `feat: 기념 메시지 보내기 화면 (FEEDBACK F1)`

---

### Task 5: 받기 화면 `/gift/[id]`

**Files:**
- Create: `app/gift/[id]/page.tsx`, `components/gift/GiftView.tsx`, `components/gift/GiftMessageCard.tsx`, `lib/gift-link.ts`

**Interfaces:**
- Consumes: `getGift`, `GiftOrnamentScene`, `Stage({ scene })`
- Produces:
  - `lib/gift-link.ts`: `giftParam(search: URLSearchParams): string | null` (`?gift=` 값), `withGift(path: string, giftId: string): string`
  - [내 스노우볼에 달기] → `withGift("/new", id)`, "이미 스노우볼이 있어요" → `withGift("/login", id)` (Task 6 이 받음)

정해진 것:
- 불러오는 중: 지금의 `StageFallback` 과 같은 "불러오고 있어요".
- 없음(null): `NotFoundView` 와 같은 눈사람 화면에 문구 "기념 메시지는 없고, 눈사람만 있네요." / "링크가 맞는지 다시 확인해 주세요." / [내 스노우볼 만들기].
- 있음: 제목 "<보내는 사람>님이 보낸 오너먼트", 부제(닫혀 있을 때) "눌러서 열어 보세요". 장면은 `GiftOrnamentScene`, 누르면 `GiftMessageCard`(보낸 사람 이름 · 메시지 · 날짜 `M월 D일`, 메시지 줄바꿈 유지, 글자를 HTML 로 해석하지 않음). 도크: [내 스노우볼에 달기](주 버튼), 아래 작은 링크 "이미 스노우볼이 있어요". 카드는 열린 뒤에도 도크가 보이게 둔다.
- 미리보기(`generateMetadata`): 제목 "기념 메시지가 도착했어요", 설명 "눌러서 오너먼트를 열어 보세요.", `images: [OG_IMAGE]`. DB 는 읽지 않는다. `DynamicMarker` 방식.

- [ ] **Step 1: 확인 스크립트를 먼저 쓴다** — Task 1 의 테스트 기념 메시지로: 제목에 보낸 사람 이름 → 오너먼트를 누르면 카드에 메시지(줄바꿈 · `<b>` 글자 그대로) → 버튼 두 개의 주소가 `/new?gift=<id>` · `/login?gift=<id>`. `/gift/abc` 와 없는 UUID → 눈사람 화면. 받은 파일에 `snowglobe.glb` 없음. 카카오톡 봇 이름으로 요청했을 때 `<head>` 에 미리보기 제목 · 이미지. 390 · 320 가로 넘침 없음.
- [ ] **Step 2: 실행해 실패를 본다**
- [ ] **Step 3: 구현**
- [ ] **Step 4: 확인 스크립트 통과, lint · build**
- [ ] **Step 5: 커밋** `feat: 기념 메시지 받기 화면 (FEEDBACK F1)`

---

### Task 6: 만들기 · 로그인 직후 보관

**Files:**
- Modify: `components/owner/OwnerFlow.tsx`, `components/owner/LoginView.tsx`

**Interfaces:**
- Consumes: `giftParam`, `addGiftToGlobe`, `saveOwnerToken`, `globePath`, `useNotice`

정해진 것:
- `OwnerFlow`: 주소에 `?gift=` 가 있으면, `createGlobe` 성공 직후 `addGiftToGlobe(gift, nickname, owner_token)`. 성공하면 완성 화면에 그 오너먼트가 달려 보이고 알림 "받은 오너먼트를 달았어요". 실패해도 스노우볼은 이미 만들어졌으므로 완성 화면으로 가고 오류 문구를 알림으로 보여 준다. `?gift=` 가 있을 때 꾸미기 부제 끝에 " · 다 만들면 받은 오너먼트가 달려요" 를 더한다.
- `LoginView`: 주소에 `?gift=` 가 있으면 부제를 "닉네임과 비밀번호를 넣으면 받은 오너먼트가 달려요"로. `openGlobe` 성공 → `saveOwnerToken` → `addGiftToGlobe`. 성공(`already` 포함) → 그 스노우볼 화면으로 이동. `globe_full` · `too_many_requests` 등 실패 → 로그인 화면의 오류 자리에 문구를 보여 주고 머문다(토큰은 이미 저장됨). `?gift=` 가 없으면 지금과 똑같다.
- 이동한 스노우볼 화면에서 새로 단 오너먼트를 따로 강조하는 것은 하지 않는다 (범위 밖).

- [ ] **Step 1: 확인 스크립트를 먼저 쓴다** — (a) 없는 사람: `/gift/<id>` → [내 스노우볼에 달기] → 꾸미기 → 닉네임 · 비밀번호 → 완성 화면에 오너먼트 1개 + 알림, DB 에서 그 스노우볼 오너먼트의 `gift_id` 가 그 번호. (b) 있는 사람: "이미 스노우볼이 있어요" → 로그인 → 그 스노우볼로 이동, 주인 화면에서 열면 보낸 사람 · 메시지가 보임. (c) 같은 링크로 다시 (b) → 오너먼트 수 그대로, 이동함. (d) 38개 + 다른 기념 메시지로 가득 채운 스노우볼 → 로그인 화면에 "가득 찼어요" 문구, 머묾. (e) `?gift=` 없이 만들기 · 로그인 · A1(나가기 → 다시 로그인)이 지금과 같음.
- [ ] **Step 2: 실행해 실패를 본다**
- [ ] **Step 3: 구현**
- [ ] **Step 4: 확인 스크립트 통과, lint · build. 확인용 스노우볼 · 기념 메시지는 지운다**
- [ ] **Step 5: 커밋** `feat: 만들기 · 로그인 직후 받은 오너먼트 달기 (FEEDBACK F1)`

---

### Task 7: 첫 화면 버튼과 스노우볼 모델 미리 받기 옮기기

**Files:**
- Modify: `components/owner/OpeningView.tsx`, `app/layout.tsx`, `app/page.tsx`, `app/new/page.tsx`, `app/login/page.tsx`, `app/globe/[id]/page.tsx`
- Create: `components/ModelPreload.tsx`

**Interfaces:**
- Produces: `ModelPreload()` — React 19 의 `<link rel="preload" href="/models/snowglobe.glb" as="fetch" crossOrigin="anonymous" />` 를 그리는 서버 컴포넌트(React 가 `<head>` 로 올림).

정해진 것:
- 첫 화면 도크: [내 스노우볼 만들기](주 버튼, 그대로) 옆에 [기념 메시지 보내기](보조 버튼, `/gift/new`). 좁은 화면(400px 미만)에서는 위아래로 쌓는다(`ShareDock` 과 같은 방식).
- `app/layout.tsx` 의 스노우볼 모델 미리 받기 줄을 지우고, 스노우볼을 쓰는 네 페이지에 `<ModelPreload />` 를 둔다. `/gift/*` 에는 두지 않는다.

- [ ] **Step 1: 확인** — 빌드한 사이트: 첫 화면에 버튼 두 개, 보조 버튼을 누르면 `/gift/new`. 390 · 320 에서 겹치거나 넘치지 않음. `/` · `/new` · `/login` · `/globe/demo` 의 `<head>` 에 미리 받기 줄이 있고 `/gift/new` 에는 없음. 첫 화면 로딩(느린 4G 흉내)이 옮기기 전과 비슷함.
- [ ] **Step 2: 구현 후 Step 1 통과, lint · build**
- [ ] **Step 3: 커밋** `feat: 첫 화면에 기념 메시지 보내기, 모델 미리 받기를 페이지별로 (FEEDBACK F1)`

---

### Task 8: 전체 확인과 기록

**Files:**
- Modify: `FEEDBACK.md` (F1 상태), `CLAUDE.md` (앱 구조 표에 `/gift/*` · `components/gift/` · `lib/gift-link.ts`), `docs/위임로그/차명근.md`

- [ ] **Step 1: 처음부터 끝까지** — Task 4 → 5 → 6 의 확인 스크립트를 이어서 실행 (PC · 390). 지금 흐름(만들기 · 친구 달기 · 로그인 · 읽기 · 이미지 저장 · 음악 · 금지어)이 그대로인 것.
- [ ] **Step 2: 배포 뒤** — 배포 주소에서 `/gift/<id>` 첫 로딩(느린 4G 흉내)과 카카오톡 봇 미리보기.
- [ ] **Step 3: 기록과 커밋, PR** — `FEEDBACK.md` F1 을 `✅ 차명근 · PR #번호`, 위임 로그 6칸. PR 본문에 고친 다른 사람 파일 목록. 머지는 사용자 승인 뒤. 머지 뒤 김미영 · 이민정 이슈 초안을 사용자에게 보여 주고 승인받아 올린다.
