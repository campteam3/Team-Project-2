# db.md — 데이터베이스 설계

> 작성: 2026-11-25 · 상태: **실제 DB 에 적용 완료 (2026-11-25).** 앱에서 쓰려면 9번의 남은 설정 2가지가 필요합니다.
> SQL: [supabase/migrations/20261125000000_snowglobe_schema.sql](supabase/migrations/20261125000000_snowglobe_schema.sql) · [20261125080000_ornament_limit_39.sql](supabase/migrations/20261125080000_ornament_limit_39.sql) (오너먼트 한도 39개)

## 1. 한눈에

- Supabase 프로젝트: `wanted_practice` (조직 `wanted`)를 그대로 씁니다.
- 이 프로젝트의 테이블은 **`snowglobe` 스키마**에만 둡니다. 연습용 테이블(`public`)과 섞이지 않습니다.
- 이메일 가입은 없습니다. 주인은 **닉네임 + 비밀번호**를 입력해 본인의 홈(자기 스노우볼)으로 갑니다.
- **테이블에는 직접 접근하지 못하고, 모든 읽기와 쓰기는 함수로만** 합니다.
- **메시지 내용은 주인만** 읽습니다.

## 2. 정한 것

| 항목 | 결정 | 이유 |
| --- | --- | --- |
| 메시지 공개 범위 | 주인만 읽기 | 남이 쓴 글이 보이지 않아야 솔직하게 쓸 수 있음 |
| 주인 구분 | 닉네임 + 비밀번호 (주인이 직접 정함) | 어느 기기에서든 본인의 홈으로 갈 수 있고, 긴 링크를 보관할 필요가 없음 |
| 정식 로그인을 쓰지 않는 이유 | — | 로그인 설정과 화면에 시간이 들고, 연습용 계정과 섞이며, 인증 메일 발송 제한이 테스트를 막을 수 있음 |
| 친구에게 보내는 링크 | 닉네임이 그대로 링크가 됨 (예: 닉네임 `test123` → `/globe/test123`) | 기억하기 쉽고 보내기 좋음 |
| 닉네임 규칙 | 한글 · 영문 · 숫자 · `_` · `-` 로 2~20자. 영문 대소문자는 구분하지 않음 | 한글 닉네임을 쓸 수 있어야 자연스러움 |
| 친구의 참여 | 가입 없이 이름만 적고 달기 | 링크를 받은 사람이 바로 참여 |

## 3. 주인이 본인의 홈으로 가는 흐름

| 상황 | 일어나는 일 |
| --- | --- |
| 스노우볼을 만들 때 | 닉네임(`test123`)과 비밀번호를 정합니다. 스노우볼 이름은 따로 정할 수도 있고, 비우면 닉네임이 이름이 됩니다. 만든 기기는 바로 주인으로 인정됩니다 |
| 같은 기기에서 다시 올 때 | 브라우저에 저장해 둔 **주인 토큰**으로 바로 본인의 홈이 열립니다 |
| 다른 기기에서 올 때 | 닉네임과 비밀번호를 입력하면 본인의 홈으로 갑니다 |
| 친구가 올 때 | `/globe/test123` 에서 스노우볼을 보고 오너먼트를 답니다. 메시지 내용은 보이지 않습니다 |

- **홈**: 주인으로 열린 자기 스노우볼 화면입니다. 메시지를 읽고, 이름과 꾸미기를 바꾸고, 오너먼트를 지울 수 있습니다.
- **주인 토큰**: 비밀번호가 맞으면 서버가 주는 무작위 값입니다(32자, 30일 유효). 앱이 브라우저에 저장해 두고 주인 기능을 부를 때 함께 보냅니다. 비밀번호 자체는 브라우저에 저장하지 않습니다.
- **비밀번호를 잊으면 복구할 수 없습니다.** 이메일을 받지 않기 때문입니다. 만들 때 화면에서 이 점을 알려 줘야 합니다.
- **비밀번호를 5번 틀리면 10분 동안 잠깁니다.** 잠긴 동안에도 친구들은 오너먼트를 달 수 있습니다.

## 4. 테이블

### `snowglobe.globes` — 스노우볼

| 열 | 형식 | 설명 |
| --- | --- | --- |
| `id` | uuid | 기본 키 |
| `nickname` | text, 고유 | 주인이 정한 닉네임. 한글 · 영문 소문자 · 숫자 · `_` · `-`, 2~20자. 영문은 소문자로 바꿔 저장 |
| `title` | text | 스노우볼 이름. 1~30자. 비우면 닉네임 |
| `theme` | jsonb | 꾸미기 값. 모양은 디자인에서 자유롭게 정함 (2,000바이트 이내) |
| `password_hash` | text | 비밀번호의 해시 (bcrypt). 밖으로 내보내지 않음 |
| `failed_attempts` | integer | 비밀번호를 연속으로 틀린 횟수 |
| `locked_until` | timestamptz | 잠금이 풀리는 시각. 잠기지 않았으면 비어 있음 |
| `created_at` | timestamptz | 만든 시각 |

### `snowglobe.ornaments` — 오너먼트와 메시지

| 열 | 형식 | 설명 |
| --- | --- | --- |
| `id` | uuid | 기본 키 |
| `globe_id` | uuid | 어느 스노우볼인지. 스노우볼을 지우면 함께 지워짐 |
| `sender_name` | text | 보낸 사람 이름. 1~20자 |
| `message` | text | 메시지. 1~300자. **주인만 읽음** |
| `shape` | text | 오너먼트 모양 이름. 기본값 `ball`. 종류는 디자인에서 정함 |
| `color` | text | 색. `#rrggbb` 형식 |
| `position` | jsonb | 달린 위치. 비우면 화면에서 자동 배치. 모양은 디자인에서 정함 |
| `created_at` | timestamptz | 단 시각 |

### `snowglobe.owner_sessions` — 주인 토큰

| 열 | 형식 | 설명 |
| --- | --- | --- |
| `token_hash` | text | 주인 토큰의 해시 (SHA-256). 기본 키 |
| `globe_id` | uuid | 어느 스노우볼의 주인인지 |
| `created_at` | timestamptz | 만든 시각 |
| `expires_at` | timestamptz | 만료 시각 (만든 때부터 30일) |

관계: 스노우볼 하나에 오너먼트 여러 개, 주인 토큰 여러 개 (기기마다 하나씩).

## 5. 권한 (RLS)

- 세 테이블 모두 **RLS 를 켜고 정책을 하나도 만들지 않았습니다.** 그래서 브라우저에 노출되는 공개 키(anon)로는 테이블을 직접 읽거나 쓸 수 없습니다.
- 공개 키로 할 수 있는 일은 아래 9개 함수를 부르는 것뿐입니다. 함수가 입력을 검사하고, 주인 기능은 주인 토큰을 확인합니다.
- 내부 도우미 함수 4개(`is_valid_nickname`, `hash_token`, `new_owner_token`, `owner_globe_id`)는 공개 키로 부를 수 없습니다.

**시연할 수 있는 장면**: 공개 키로 `ornaments` 테이블을 직접 읽으면 거부되고, 토큰 없이 `get_messages` 를 부르면 오류가 나고, 비밀번호로 연 뒤에만 메시지가 나옵니다. 비밀번호를 5번 틀리면 잠기는 것도 보여 줄 수 있습니다.

## 6. 함수

앱에서는 `getSupabase()?.rpc('함수이름', { 인자 })` 로 부릅니다.

| 함수 | 누가 | 하는 일 | 돌려주는 값 |
| --- | --- | --- | --- |
| `is_nickname_available(p_nickname)` | 누구나 | 닉네임을 쓸 수 있는지 확인 | `true` / `false` |
| `create_globe(p_nickname, p_password, p_title?, p_theme?)` | 누구나 | 스노우볼 만들기 | `{ nickname, owner_token }` |
| `open_globe(p_nickname, p_password)` | 누구나 | 닉네임 + 비밀번호로 홈 열기 | 아래 "열기 결과" 참고 |
| `get_globe(p_nickname)` | 누구나 | 스노우볼과 오너먼트 목록 (**메시지 내용 없음**) | `{ nickname, title, theme, created_at, ornaments: [...] }` 또는 `null` |
| `add_ornament(p_nickname, p_sender_name, p_message, p_shape?, p_color?, p_position?)` | 누구나 | 오너먼트와 메시지 달기 | 방금 단 오너먼트 (메시지 내용 없음) |
| `get_messages(p_nickname, p_owner_token)` | 주인 | 메시지 내용까지 포함한 목록 | `[{ id, sender_name, message, shape, color, position, created_at }]` |
| `update_globe(p_nickname, p_owner_token, p_title?, p_theme?)` | 주인 | 이름 · 꾸미기 변경 | 바뀐 스노우볼 |
| `delete_ornament(p_nickname, p_owner_token, p_ornament_id)` | 주인 | 오너먼트 하나 삭제 | 지웠으면 `true` |
| `close_globe(p_owner_token)` | 주인 | 이 기기의 주인 토큰 없애기 (닫기) | 없앴으면 `true` |

`ornaments` 배열의 항목: `{ id, sender_name, shape, color, position, created_at }`

### 열기 결과 (`open_globe`)

이 함수는 비밀번호가 틀려도 **오류를 내지 않고 결과로 알려 줍니다.** (틀린 횟수를 저장해야 하기 때문입니다.)

| 결과 | 뜻 |
| --- | --- |
| `{ ok: true, owner_token }` | 열림. 토큰을 브라우저에 저장 |
| `{ ok: false, reason: "invalid_password", attempts_left }` | 비밀번호 틀림. 남은 횟수 |
| `{ ok: false, reason: "locked", retry_after_seconds }` | 잠김. 다시 시도할 수 있을 때까지 남은 초 |
| `{ ok: false, reason: "globe_not_found" }` | 없는 스노우볼 |

### 오류 이름

나머지 함수는 문제가 있으면 아래 이름으로 오류를 냅니다. 화면에서는 이 이름을 보고 안내 문구를 고릅니다.

| 오류 | 뜻 |
| --- | --- |
| `invalid_nickname` | 닉네임 형식이 틀리거나 쓸 수 없는 이름 (`demo`, `new`, `admin`, `api`, `globe`, `owner`, `login`, `home`) |
| `nickname_taken` | 이미 쓰는 닉네임 |
| `invalid_title` | 스노우볼 이름이 30자 초과 |
| `invalid_password_format` | 비밀번호가 4자 미만이거나 너무 김 (72바이트 초과. 한글만 쓰면 24자까지) |
| `invalid_theme` | 꾸미기 값이 너무 큼 |
| `globe_not_found` | 없는 스노우볼 |
| `invalid_sender_name` | 보낸 사람 이름이 비었거나 20자 초과 |
| `invalid_message` | 메시지가 비었거나 300자 초과 |
| `invalid_shape` / `invalid_color` / `invalid_position` | 모양 · 색 · 위치 값이 틀림 |
| `globe_full` | 오너먼트가 39개에 도달 (트리의 자리 수) |
| `banned_word` | 닉네임 · 스노우볼 이름 · 보낸 사람 이름 · 메시지에 금지어(욕설)가 들어 있음 |
| `too_many_requests` | 한 스노우볼에 1분 동안 10개 넘게 달림 |
| `invalid_owner_token` | 주인 토큰이 없거나, 틀렸거나, 만료됨 → 비밀번호 입력 화면으로 |

## 7. 막아 둔 것 (안정성)

- **빈 입력 · 긴 입력**: 함수에서 앞뒤 공백을 지우고 길이를 검사합니다. 테이블에도 같은 제약이 있어 이중으로 막습니다.
- **몰아서 달기**: 한 스노우볼에 1분에 10개, 전체 39개까지. 39는 트리에 있는 오너먼트 자리 수(`lib/snowglobe-slots.json`)이고, 자리를 늘리면 함께 올립니다.
- **메시지 엿보기**: 테이블 직접 접근 차단 + 주인 토큰 확인.
- **비밀번호 찍어 맞히기**: 5번 틀리면 10분 잠금.
- **닉네임 겹침**: 닉네임은 고유하고(영문 대소문자 구분 없음), 화면 경로와 겹치는 이름은 쓸 수 없습니다.
- **욕설**: 닉네임 · 스노우볼 이름 · 보낸 사람 이름 · 메시지에 금지어가 들어 있으면 저장하지 않습니다(`banned_word`). 저장 직전에 도는 트리거라 함수를 직접 불러도 막힙니다. 목록은 `supabase/migrations/20261126120000_banned_words.sql` 의 `has_banned_word` 에 있고, 숫자 · 기호를 끼워 넣은 것과 초성 줄임말까지 봅니다. 완벽하지는 않아서 글자를 바꿔 쓴 변형은 새어 나갈 수 있고, 드물게 멀쩡한 문장이 걸릴 수 있습니다.
- **비밀번호 · 토큰 유출**: DB 에는 해시만 저장합니다. 비밀번호는 느린 해시(bcrypt)를 써서, DB 가 노출돼도 원래 값을 알아내기 어렵습니다.

막지 않은 것
- 광고나, 금지어 목록에 없는 나쁜 말 같은 **내용 자체**는 걸러 내지 않습니다. 주인이 `delete_ornament` 로 지울 수 있습니다.
- 누군가 일부러 비밀번호를 계속 틀려서 **주인이 못 열게 잠가 둘 수 있습니다.** 이미 연 기기의 토큰은 영향을 받지 않습니다.
- 비밀번호 변경과 스노우볼 삭제 기능은 없습니다.

## 8. 확인한 것

SQL 을 임시 Postgres(PGlite)에 실행해 59가지 경우를 시험했고 모두 통과했습니다. 직접 접근 차단, 입력 검사, 한글 닉네임, 닉네임 + 비밀번호로 열기, 틀린 토큰 · 만료된 토큰 · 남의 토큰 거부, 5번 틀리면 잠김, 잠금 해제 후 다시 열림, 몰아서 달기 제한이 포함됩니다.

실제 Supabase(`wanted_practice`)에도 적용한 뒤 공개 키 역할로 13가지를 다시 확인했습니다: 테이블 3개 직접 읽기 차단, 내부 함수 차단, 한글 닉네임으로 만들기, 중복 닉네임 거부, 빈 메시지 거부, 누구나 읽기에 메시지 내용 없음, 틀린 토큰 거부, 틀린 비밀번호 안내, 맞는 비밀번호로 열고 메시지 읽기. 확인에 쓴 데이터는 모두 되돌려서 남아 있지 않습니다.

## 9. 실제 DB 적용 상태

1. ✅ **완료** — 마이그레이션 SQL 을 Supabase MCP 로 적용했습니다 (이름 `snowglobe_schema`).
2. ✅ **완료** — Supabase 대시보드의 **Project Settings → API → Exposed schemas 에 `snowglobe` 를 추가**합니다. 이것을 하지 않으면 앱에서 함수를 부를 수 없습니다. (대시보드에서 직접 해야 합니다)
3. ✅ **완료** — 프로젝트 URL 과 공개 키(anon key)를 `.env.local` 과 Vercel 환경 변수에 넣습니다 (`.env.example` 참고).
4. ✅ **확인함** — 기존 `public` 스키마의 연습용 테이블 8개는 모두 RLS 가 켜져 있습니다. 다만 연습용 함수 `buy_item`, `paw_balance` 는 공개 키로 누구나 부를 수 있는 상태입니다. 배포하면 공개 키가 브라우저에 노출되므로, 필요 없으면 지우거나 실행 권한을 거두는 것이 좋습니다.
5. ✅ **완료 (11/26)** — 금지어 막기 마이그레이션을 적용했습니다 (이름 `snowglobe_banned_words`). 배포 주소의 친구 화면에서 욕설이 든 메시지 · 이름은 "금지어가 포함되어 있어 등록할 수 없어요…" 안내가 뜨고, 멀쩡한 글은 저장되는 것을 확인했습니다. 금지어만 되돌리려면 `drop trigger ornaments_block_banned on snowglobe.ornaments; drop trigger globes_block_banned on snowglobe.globes;` 두 줄이면 됩니다.

되돌리기: `drop schema snowglobe cascade;` 한 줄이면 이 프로젝트의 테이블과 함수가 모두 지워지고, 연습용 테이블에는 영향이 없습니다.

## 10. 나중에 바꿀 수 있는 것

- 특정 날짜에 메시지 공개: `globes` 에 공개 시각 열을 추가하고 `get_messages` 에서 확인
- 새 오너먼트를 실시간으로 보여 주기: 지금은 `get_globe` 를 다시 불러야 합니다
- 비밀번호 변경, 스노우볼 삭제
- 정식 로그인: 비밀번호 재설정이나 스노우볼 여러 개 관리가 필요해지면
