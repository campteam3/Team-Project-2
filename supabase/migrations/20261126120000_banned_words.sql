-- 금지어(욕설) 막기
--
-- 오너먼트의 보내는 사람 이름 · 메시지, 스노우볼의 닉네임 · 이름에 욕설이 들어 있으면 저장하지 않고
-- 'banned_word' 오류를 낸다. 화면은 이 오류를 "금지어가 포함되어 있어…" 안내로 바꿔 보여 준다 (lib/api.ts).
--
-- 기존 함수(add_ornament, create_globe, update_globe)는 고치지 않고, 저장 직전에 도는 트리거로 막는다.
-- 그래서 화면을 거치지 않고 함수를 직접 불러도 막힌다.
--
-- 목록을 고칠 때: 아래 has_banned_word 의 두 줄(정규식)만 고치면 된다. 화면 코드는 고칠 것이 없다.
--   · 첫 줄: 띄어쓰기는 남기고 숫자 · 기호만 지운 글에서 찾는다 (예: "시1발", "씨.발" 도 걸림)
--   · 둘째 줄: 띄어쓰기까지 지운 글에서 찾는다 (예: "ㅅ ㅂ", "F U C K" 도 걸림). 멀쩡한 문장이 걸리기 쉬워서 줄임말 위주로 적게 둔다
-- 완벽한 필터가 아니다. 글자를 바꿔 쓰는 식의 변형은 새어 나갈 수 있고, 드물게 멀쩡한 문장이 걸릴 수 있다.

create or replace function snowglobe.has_banned_word(p_text text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  with t as (
    -- 소문자로 바꾸고, 뜻이 다른 낱말(시발점 · 시발역)은 먼저 지운다
    select regexp_replace(lower(coalesce(p_text, '')), '시발(점|역)', '', 'g') as base
  ), n as (
    select
      regexp_replace(base, '[^가-힣ㄱ-ㅎㅏ-ㅣa-z[:space:]]', '', 'g') as keep_space,
      regexp_replace(base, '[^가-힣ㄱ-ㅎㅏ-ㅣa-z]', '', 'g') as no_space
    from t
  )
  select
    keep_space ~ '(씨발|씨바|씨빨|씨팔|시발|시팔|쓰발|씹새|씹년|씹놈|씹할|씹창|쌍놈|쌍년|썅|좆|좃같|존나|병신|븅신|빙신|지랄|개새끼|개색끼|개색기|개세끼|개자식|미친놈|미친년|미친새|또라이|닥쳐|아가리|엿먹|느금|니애미|니미럴|창녀|걸레년|죽여버|\mfuck|\mshit\M|\mbitch|\masshole|\mbastard)'
    or no_space ~ '(ㅅㅂ|ㅆㅂ|ㅂㅅ|ㅈㄹ|ㅗㅗ|ㅄ|개새끼|좆|fuck)'
  from n
$$;

-- 판별 함수는 DB 안에서만 쓴다 (밖에서 목록을 떠보지 못하게)
revoke all on function snowglobe.has_banned_word(text) from public, anon, authenticated;

-- 오너먼트: 보내는 사람 이름과 메시지
create or replace function snowglobe.block_banned_ornament()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if snowglobe.has_banned_word(new.sender_name) or snowglobe.has_banned_word(new.message) then
    raise exception 'banned_word';
  end if;
  return new;
end;
$$;

drop trigger if exists ornaments_block_banned on snowglobe.ornaments;
create trigger ornaments_block_banned
  before insert or update of sender_name, message on snowglobe.ornaments
  for each row execute function snowglobe.block_banned_ornament();

-- 스노우볼: 닉네임과 이름
create or replace function snowglobe.block_banned_globe()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if snowglobe.has_banned_word(new.nickname) or snowglobe.has_banned_word(new.title) then
    raise exception 'banned_word';
  end if;
  return new;
end;
$$;

drop trigger if exists globes_block_banned on snowglobe.globes;
create trigger globes_block_banned
  before insert or update of nickname, title on snowglobe.globes
  for each row execute function snowglobe.block_banned_globe();

revoke all on function snowglobe.block_banned_ornament() from public, anon, authenticated;
revoke all on function snowglobe.block_banned_globe() from public, anon, authenticated;
