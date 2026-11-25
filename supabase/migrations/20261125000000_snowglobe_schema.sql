-- 3D 스노우볼 롤링페이퍼: 스키마, 테이블, 함수
-- 설명은 db.md 를 보세요.
--
-- 원칙
--  1. 테이블에는 직접 접근하지 못한다 (RLS 켬 + 정책 없음 + 권한 없음).
--  2. 모든 읽기와 쓰기는 아래 함수로만 한다.
--  3. 주인은 닉네임 + 비밀번호로 자기 스노우볼(홈)을 연다. 열면 주인 토큰을 받고,
--     메시지 내용은 주인 토큰이 맞을 때만 돌려준다.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create schema if not exists snowglobe;

-- ── 테이블 ─────────────────────────────────────────────────

create table snowglobe.globes (
  id              uuid primary key default gen_random_uuid(),
  nickname        text not null unique
                  check (nickname ~ '^[a-z0-9가-힣_-]{2,20}$' and nickname ~ '[a-z0-9가-힣]'),
  title           text not null check (char_length(title) between 1 and 30),
  theme           jsonb not null default '{}'::jsonb,
  password_hash   text not null,
  failed_attempts integer not null default 0,
  locked_until    timestamptz,
  created_at      timestamptz not null default now()
);

create table snowglobe.ornaments (
  id          uuid primary key default gen_random_uuid(),
  globe_id    uuid not null references snowglobe.globes (id) on delete cascade,
  sender_name text not null check (char_length(sender_name) between 1 and 20),
  message     text not null check (char_length(message) between 1 and 300),
  shape       text not null default 'ball' check (char_length(shape) between 1 and 30),
  color       text not null default '#e5484d' check (color ~ '^#[0-9a-fA-F]{6}$'),
  position    jsonb,
  created_at  timestamptz not null default now()
);

create index ornaments_globe_id_created_at_idx
  on snowglobe.ornaments (globe_id, created_at);

-- 주인이 비밀번호로 스노우볼을 열면 생기는 토큰. 토큰 자체가 아니라 해시만 저장한다.
create table snowglobe.owner_sessions (
  token_hash text primary key,
  globe_id   uuid not null references snowglobe.globes (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days'
);

create index owner_sessions_globe_id_idx on snowglobe.owner_sessions (globe_id);

-- RLS 를 켜고 정책을 만들지 않는다 → 공개 키로는 테이블을 직접 읽거나 쓸 수 없다.
alter table snowglobe.globes enable row level security;
alter table snowglobe.ornaments enable row level security;
alter table snowglobe.owner_sessions enable row level security;

-- ── 내부 도우미 (공개하지 않음) ─────────────────────────────

create function snowglobe.hash_token(p_token text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
$$;

-- 닉네임 형식이 맞는지 (소문자로 바꾼 값을 넣는다). 화면 경로와 겹치는 이름은 쓸 수 없다.
create function snowglobe.is_valid_nickname(p_nickname text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    p_nickname ~ '^[a-z0-9가-힣_-]{2,20}$'
    and p_nickname ~ '[a-z0-9가-힣]'
    and p_nickname <> all (array['demo', 'new', 'admin', 'api', 'globe', 'owner', 'login', 'home']),
    false
  );
$$;

-- 주인 토큰을 새로 만들어 저장하고 토큰을 돌려준다.
create function snowglobe.new_owner_token(p_globe_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text := replace(gen_random_uuid()::text, '-', '');
begin
  delete from snowglobe.owner_sessions s
  where s.globe_id = p_globe_id and s.expires_at < now();

  insert into snowglobe.owner_sessions (token_hash, globe_id)
  values (snowglobe.hash_token(v_token), p_globe_id);

  return v_token;
end;
$$;

-- 닉네임과 주인 토큰이 맞으면 스노우볼 id 를, 아니면 오류를 낸다.
create function snowglobe.owner_globe_id(p_nickname text, p_owner_token text)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select g.id into v_id
  from snowglobe.globes g
  join snowglobe.owner_sessions s on s.globe_id = g.id
  where g.nickname = lower(btrim(coalesce(p_nickname, '')))
    and s.token_hash = snowglobe.hash_token(coalesce(p_owner_token, ''))
    and s.expires_at > now();

  if v_id is null then
    raise exception 'invalid_owner_token';
  end if;
  return v_id;
end;
$$;

-- ── 공개 함수 ──────────────────────────────────────────────

-- 닉네임을 쓸 수 있는지 확인한다.
create function snowglobe.is_nickname_available(p_nickname text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select snowglobe.is_valid_nickname(lower(btrim(coalesce(p_nickname, ''))))
     and not exists (
       select 1 from snowglobe.globes g where g.nickname = lower(btrim(p_nickname))
     );
$$;

-- 스노우볼을 만든다. 만든 사람은 바로 주인 토큰을 받는다.
create function snowglobe.create_globe(
  p_nickname     text,
  p_password text,
  p_title    text default null,
  p_theme    jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nickname     text := lower(btrim(coalesce(p_nickname, '')));
  v_title    text := btrim(coalesce(p_title, ''));
  v_password text := coalesce(p_password, '');
  v_theme    jsonb := coalesce(p_theme, '{}'::jsonb);
  v_id       uuid;
begin
  if not snowglobe.is_valid_nickname(v_nickname) then
    raise exception 'invalid_nickname';
  end if;
  if v_title = '' then
    v_title := v_nickname;
  end if;
  if char_length(v_title) > 30 then
    raise exception 'invalid_title';
  end if;
  -- bcrypt 는 72바이트까지만 쓰므로 그 안으로 제한한다.
  if char_length(v_password) < 4 or octet_length(v_password) > 72 then
    raise exception 'invalid_password_format';
  end if;
  if octet_length(v_theme::text) > 2000 then
    raise exception 'invalid_theme';
  end if;

  begin
    insert into snowglobe.globes (nickname, title, theme, password_hash)
    values (
      v_nickname, v_title, v_theme,
      extensions.crypt(v_password, extensions.gen_salt('bf', 10))
    )
    returning id into v_id;
  exception when unique_violation then
    raise exception 'nickname_taken';
  end;

  return jsonb_build_object('nickname', v_nickname, 'owner_token', snowglobe.new_owner_token(v_id));
end;
$$;

-- 주인이 닉네임 + 비밀번호로 자기 스노우볼(홈)을 연다.
-- 틀려도 오류를 내지 않고 결과로 알려 준다 (틀린 횟수를 저장해야 하기 때문).
-- 5번 틀리면 10분 동안 잠긴다.
create function snowglobe.open_globe(p_nickname text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_globe snowglobe.globes;
begin
  select * into v_globe
  from snowglobe.globes g
  where g.nickname = lower(btrim(coalesce(p_nickname, '')))
  for update;

  if v_globe.id is null then
    return jsonb_build_object('ok', false, 'reason', 'globe_not_found');
  end if;

  if v_globe.locked_until is not null and v_globe.locked_until > now() then
    return jsonb_build_object(
      'ok', false,
      'reason', 'locked',
      'retry_after_seconds', ceil(extract(epoch from v_globe.locked_until - now()))::integer
    );
  end if;

  if v_globe.password_hash = extensions.crypt(coalesce(p_password, ''), v_globe.password_hash) then
    update snowglobe.globes g
    set failed_attempts = 0, locked_until = null
    where g.id = v_globe.id;

    return jsonb_build_object('ok', true, 'owner_token', snowglobe.new_owner_token(v_globe.id));
  end if;

  if v_globe.failed_attempts + 1 >= 5 then
    update snowglobe.globes g
    set failed_attempts = 0, locked_until = now() + interval '10 minutes'
    where g.id = v_globe.id;

    return jsonb_build_object('ok', false, 'reason', 'locked', 'retry_after_seconds', 600);
  end if;

  update snowglobe.globes g
  set failed_attempts = g.failed_attempts + 1
  where g.id = v_globe.id;

  return jsonb_build_object(
    'ok', false,
    'reason', 'invalid_password',
    'attempts_left', 5 - (v_globe.failed_attempts + 1)
  );
end;
$$;

-- 스노우볼과 오너먼트 목록을 돌려준다. 메시지 내용은 넣지 않는다. 없는 닉네임이면 null.
create function snowglobe.get_globe(p_nickname text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'nickname', g.nickname,
    'title', g.title,
    'theme', g.theme,
    'created_at', g.created_at,
    'ornaments', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', o.id,
          'sender_name', o.sender_name,
          'shape', o.shape,
          'color', o.color,
          'position', o.position,
          'created_at', o.created_at
        )
        order by o.created_at
      )
      from snowglobe.ornaments o
      where o.globe_id = g.id
    ), '[]'::jsonb)
  )
  from snowglobe.globes g
  where g.nickname = lower(btrim(coalesce(p_nickname, '')));
$$;

-- 오너먼트와 메시지를 단다. 돌려주는 값에 메시지 내용은 없다.
create function snowglobe.add_ornament(
  p_nickname        text,
  p_sender_name text,
  p_message     text,
  p_shape       text default 'ball',
  p_color       text default '#e5484d',
  p_position    jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_globe_id uuid;
  v_sender   text := btrim(coalesce(p_sender_name, ''));
  v_message  text := btrim(coalesce(p_message, ''));
  v_shape    text := btrim(coalesce(p_shape, 'ball'));
  v_color    text := coalesce(p_color, '#e5484d');
  v_row      snowglobe.ornaments;
begin
  select g.id into v_globe_id
  from snowglobe.globes g
  where g.nickname = lower(btrim(coalesce(p_nickname, '')));

  if v_globe_id is null then
    raise exception 'globe_not_found';
  end if;
  if char_length(v_sender) not between 1 and 20 then
    raise exception 'invalid_sender_name';
  end if;
  if char_length(v_message) not between 1 and 300 then
    raise exception 'invalid_message';
  end if;
  if char_length(v_shape) not between 1 and 30 then
    raise exception 'invalid_shape';
  end if;
  if v_color !~ '^#[0-9a-fA-F]{6}$' then
    raise exception 'invalid_color';
  end if;
  if p_position is not null and octet_length(p_position::text) > 200 then
    raise exception 'invalid_position';
  end if;

  -- 한 스노우볼에 달 수 있는 오너먼트 수와, 짧은 시간에 몰아서 다는 것을 제한한다.
  if (select count(*) from snowglobe.ornaments o where o.globe_id = v_globe_id) >= 200 then
    raise exception 'globe_full';
  end if;
  if (
    select count(*) from snowglobe.ornaments o
    where o.globe_id = v_globe_id and o.created_at > now() - interval '1 minute'
  ) >= 10 then
    raise exception 'too_many_requests';
  end if;

  insert into snowglobe.ornaments (globe_id, sender_name, message, shape, color, position)
  values (v_globe_id, v_sender, v_message, v_shape, v_color, p_position)
  returning * into v_row;

  return jsonb_build_object(
    'id', v_row.id,
    'sender_name', v_row.sender_name,
    'shape', v_row.shape,
    'color', v_row.color,
    'position', v_row.position,
    'created_at', v_row.created_at
  );
end;
$$;

-- 주인만: 메시지 내용까지 포함한 오너먼트 목록.
create function snowglobe.get_messages(p_nickname text, p_owner_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_globe_id uuid := snowglobe.owner_globe_id(p_nickname, p_owner_token);
begin
  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', o.id,
        'sender_name', o.sender_name,
        'message', o.message,
        'shape', o.shape,
        'color', o.color,
        'position', o.position,
        'created_at', o.created_at
      )
      order by o.created_at
    )
    from snowglobe.ornaments o
    where o.globe_id = v_globe_id
  ), '[]'::jsonb);
end;
$$;

-- 주인만: 스노우볼 이름과 꾸미기 값을 바꾼다. null 을 넘긴 값은 그대로 둔다.
create function snowglobe.update_globe(
  p_nickname        text,
  p_owner_token text,
  p_title       text default null,
  p_theme       jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_globe_id uuid := snowglobe.owner_globe_id(p_nickname, p_owner_token);
  v_title    text := btrim(p_title);
begin
  if v_title is not null and char_length(v_title) not between 1 and 30 then
    raise exception 'invalid_title';
  end if;
  if p_theme is not null and octet_length(p_theme::text) > 2000 then
    raise exception 'invalid_theme';
  end if;

  update snowglobe.globes g
  set title = coalesce(v_title, g.title),
      theme = coalesce(p_theme, g.theme)
  where g.id = v_globe_id;

  return snowglobe.get_globe(p_nickname);
end;
$$;

-- 주인만: 오너먼트 하나를 지운다. 지웠으면 true.
create function snowglobe.delete_ornament(
  p_nickname        text,
  p_owner_token text,
  p_ornament_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_globe_id uuid := snowglobe.owner_globe_id(p_nickname, p_owner_token);
  v_deleted  integer;
begin
  delete from snowglobe.ornaments o
  where o.id = p_ornament_id and o.globe_id = v_globe_id;
  get diagnostics v_deleted = row_count;
  return v_deleted > 0;
end;
$$;

-- 주인만: 이 기기의 주인 토큰을 없앤다 (닫기). 없앴으면 true.
create function snowglobe.close_globe(p_owner_token text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  delete from snowglobe.owner_sessions s
  where s.token_hash = snowglobe.hash_token(coalesce(p_owner_token, ''));
  get diagnostics v_deleted = row_count;
  return v_deleted > 0;
end;
$$;

-- ── 권한 ───────────────────────────────────────────────────
-- 공개 키(anon)와 로그인 사용자(authenticated)는 스키마에 들어와 공개 함수만 실행할 수 있다.

revoke all on schema snowglobe from public;
revoke all on all tables in schema snowglobe from public, anon, authenticated;
revoke all on all functions in schema snowglobe from public, anon, authenticated;

grant usage on schema snowglobe to anon, authenticated, service_role;
grant all on all tables in schema snowglobe to service_role;
grant execute on all functions in schema snowglobe to service_role;

grant execute on function snowglobe.is_nickname_available(text) to anon, authenticated;
grant execute on function snowglobe.create_globe(text, text, text, jsonb) to anon, authenticated;
grant execute on function snowglobe.open_globe(text, text) to anon, authenticated;
grant execute on function snowglobe.get_globe(text) to anon, authenticated;
grant execute on function snowglobe.add_ornament(text, text, text, text, text, jsonb) to anon, authenticated;
grant execute on function snowglobe.get_messages(text, text) to anon, authenticated;
grant execute on function snowglobe.update_globe(text, text, text, jsonb) to anon, authenticated;
grant execute on function snowglobe.delete_ornament(text, text, uuid) to anon, authenticated;
grant execute on function snowglobe.close_globe(text) to anon, authenticated;
