-- 메시지 길이 한도를 화면과 맞춘다: 300자 → 200자
--
-- 화면(lib/api.ts 의 MESSAGE_MAX)은 200자까지만 받는데 DB 는 300자까지 받고 있었다.
-- 화면을 거치지 않고 함수를 직접 부르면 201 ~ 300자 메시지가 저장될 수 있어서 DB 도 200자로 맞춘다.
-- 적용 전에 확인: 저장된 메시지 중 200자를 넘는 것은 없다 (가장 긴 것이 14자).
-- 바뀐 곳은 add_ornament 의 길이 검사 한 줄과 테이블 제약 하나뿐이다. 나머지는 20261125080000 과 같다.

alter table snowglobe.ornaments drop constraint if exists ornaments_message_check;
alter table snowglobe.ornaments
  add constraint ornaments_message_check check (char_length(message) between 1 and 200);

create or replace function snowglobe.add_ornament(
  p_nickname text,
  p_sender_name text,
  p_message text,
  p_shape text default 'ball',
  p_color text default '#e5484d',
  p_position jsonb default null
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
  if char_length(v_message) not between 1 and 200 then
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

  -- 한 스노우볼에 달 수 있는 오너먼트 수(트리 자리 수)와, 짧은 시간에 몰아서 다는 것을 제한한다.
  if (select count(*) from snowglobe.ornaments o where o.globe_id = v_globe_id) >= 39 then
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
