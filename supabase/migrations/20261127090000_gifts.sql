-- 기념 메시지 먼저 보내기 (FEEDBACK F1, 차명근)
-- 설계: docs/superpowers/specs/2026-11-27-gift-message-design.md
--
-- 보내는 사람이 오너먼트 하나와 메시지를 만들어 링크(/gift/<번호>)로 보냅니다.
-- 링크를 가진 사람은 누구나 읽을 수 있고, 누구나 각자 자기 스노우볼에 달 수 있습니다.
-- 달면 그 내용을 복사해 받은 사람의 스노우볼에 오너먼트로 넣습니다. 그 뒤로는 다른 오너먼트와 똑같습니다(주인만 읽고 지움).
--
-- 함수
--   create_gift(보내는 사람, 메시지, 모양, 색)       → { id }
--   get_gift(번호)                                  → { id, sender_name, message, shape, color, created_at } 또는 null
--   add_gift_to_globe(번호, 닉네임, 주인 토큰)        → { ornament_id, already }
-- 오류: gift_not_found, 그리고 기존의 invalid_owner_token · globe_full · too_many_requests · invalid_* · banned_word

-- 기념 메시지. 번호는 짐작할 수 없는 무작위 번호(UUID)라, 링크를 가진 사람만 열 수 있습니다.
create table snowglobe.gifts (
  id          uuid primary key default gen_random_uuid(),
  sender_name text not null check (char_length(sender_name) between 1 and 20),
  message     text not null check (char_length(message) between 1 and 200),
  shape       text not null check (char_length(shape) between 1 and 30),
  color       text not null check (color ~ '^#[0-9a-fA-F]{6}$'),
  created_at  timestamptz not null default now()
);

-- 표는 직접 읽지 못하게 막고(정책 없음), 아래 함수로만 다룹니다.
alter table snowglobe.gifts enable row level security;
revoke all on table snowglobe.gifts from anon, authenticated;

-- 금지어 (20261126120000_banned_words.sql 과 같은 방식)
create or replace function snowglobe.block_banned_gift()
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

create trigger gifts_block_banned
  before insert or update of sender_name, message on snowglobe.gifts
  for each row execute function snowglobe.block_banned_gift();

revoke all on function snowglobe.block_banned_gift() from public, anon, authenticated;

-- 어느 기념 메시지에서 온 오너먼트인지. 같은 스노우볼에 같은 기념 메시지는 한 번만 달립니다.
-- (기념 메시지가 없는 오너먼트는 null 이라 겹쳐도 됩니다)
alter table snowglobe.ornaments
  add column gift_id uuid references snowglobe.gifts(id) on delete set null;
alter table snowglobe.ornaments
  add constraint ornaments_globe_gift_unique unique (globe_id, gift_id);

-- ── 공개 함수 ──────────────────────────────────────────────

create or replace function snowglobe.create_gift(
  p_sender_name text,
  p_message text,
  p_shape text default 'ball',
  p_color text default '#e5484d'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sender  text := btrim(coalesce(p_sender_name, ''));
  v_message text := btrim(coalesce(p_message, ''));
  v_shape   text := btrim(coalesce(p_shape, 'ball'));
  v_color   text := coalesce(p_color, '#e5484d');
  v_id      uuid;
begin
  if char_length(v_sender) not between 1 and 20 then
    raise exception 'invalid_sender_name';
  end if;
  if char_length(v_message) not between 1 and 200 then
    raise exception 'invalid_message';
  end if;
  if char_length(v_shape) not between 1 and 30 then
    raise exception 'invalid_shape';
  end if;
  if v_color !~ '^#[0-9a-fA-F]{6}$' then
    raise exception 'invalid_color';
  end if;

  insert into snowglobe.gifts (sender_name, message, shape, color)
  values (v_sender, v_message, v_shape, v_color)
  returning id into v_id;

  return jsonb_build_object('id', v_id);
end;
$$;

-- 링크를 가진 누구나 읽습니다. 형식이 틀리거나 없는 번호는 오류 없이 null 입니다.
create or replace function snowglobe.get_gift(p_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_row snowglobe.gifts;
begin
  if coalesce(p_id, '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return null;
  end if;
  select * into v_row from snowglobe.gifts g where g.id = p_id::uuid;
  if not found then
    return null;
  end if;
  return jsonb_build_object(
    'id', v_row.id,
    'sender_name', v_row.sender_name,
    'message', v_row.message,
    'shape', v_row.shape,
    'color', v_row.color,
    'created_at', v_row.created_at
  );
end;
$$;

-- 주인이 기념 메시지를 자기 스노우볼에 답니다. 날짜는 단 시각이고(자리가 밀리지 않게), 위치는 자동입니다.
create or replace function snowglobe.add_gift_to_globe(p_id text, p_nickname text, p_owner_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_globe_id uuid := snowglobe.owner_globe_id(p_nickname, p_owner_token);
  v_gift     snowglobe.gifts;
  v_existing uuid;
  v_new      uuid;
begin
  if coalesce(p_id, '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'gift_not_found';
  end if;
  select * into v_gift from snowglobe.gifts g where g.id = p_id::uuid;
  if not found then
    raise exception 'gift_not_found';
  end if;

  select o.id into v_existing from snowglobe.ornaments o where o.globe_id = v_globe_id and o.gift_id = v_gift.id;
  if v_existing is not null then
    return jsonb_build_object('ornament_id', v_existing, 'already', true);
  end if;

  if (select count(*) from snowglobe.ornaments o where o.globe_id = v_globe_id) >= 39 then
    raise exception 'globe_full';
  end if;
  if (
    select count(*) from snowglobe.ornaments o
    where o.globe_id = v_globe_id and o.created_at > now() - interval '1 minute'
  ) >= 10 then
    raise exception 'too_many_requests';
  end if;

  insert into snowglobe.ornaments (globe_id, sender_name, message, shape, color, gift_id)
  values (v_globe_id, v_gift.sender_name, v_gift.message, v_gift.shape, v_gift.color, v_gift.id)
  returning id into v_new;

  return jsonb_build_object('ornament_id', v_new, 'already', false);
end;
$$;

revoke all on function snowglobe.create_gift(text, text, text, text) from public;
revoke all on function snowglobe.get_gift(text) from public;
revoke all on function snowglobe.add_gift_to_globe(text, text, text) from public;
grant execute on function snowglobe.create_gift(text, text, text, text) to anon, authenticated, service_role;
grant execute on function snowglobe.get_gift(text) to anon, authenticated, service_role;
grant execute on function snowglobe.add_gift_to_globe(text, text, text) to anon, authenticated, service_role;
