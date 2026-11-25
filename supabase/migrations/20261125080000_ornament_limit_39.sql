-- 한 스노우볼에 달 수 있는 오너먼트 수를 200개에서 39개로 낮춘다.
-- 트리에 오너먼트 자리가 39곳이라, 그보다 많으면 트리에 달리지 않아 주인이 읽을 수 없다.
-- (자리 수는 lib/snowglobe-slots.json 기준. 자리를 늘리면 이 숫자도 함께 올린다.)
-- add_ornament 함수의 다른 부분은 그대로다.

create or replace function snowglobe.add_ornament(
  p_nickname    text,
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
