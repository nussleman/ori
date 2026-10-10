-- 단체가 직접 공연을 기록한다 (2026-10-10 피벗 2단계: 입력 구조)
-- 기록마다 주인이 있다: 공연의 주인은 단체. 단체 관리자(troupe_members admin·confirmed)가 등록·수정하면 '단체 확인'.

-- 프로젝트로 만든 공연도 단체가 만든 기록이므로 '단체 확인'
create or replace function public.publish_project_as_show(p_project_id uuid)
returns uuid language plpgsql security definer set search_path = public as $function$
declare
  v_project record; v_show_id uuid; v_pos record; v_person_id uuid; v_participation_id uuid;
begin
  select * into v_project from projects where id = p_project_id;
  if v_project is null then raise exception '프로젝트를 찾을 수 없어요'; end if;
  if not is_project_admin(p_project_id) then raise exception '권한이 없어요'; end if;
  if v_project.published_show_id is not null then return v_project.published_show_id; end if;

  insert into shows (title, show_date, end_date, troupe_id, venue_id, work_id, is_licensed, record_status)
  values (v_project.title, v_project.target_start_date, v_project.target_end_date, v_project.troupe_id,
          v_project.venue_id, v_project.work_id, v_project.is_licensed,
          case when v_project.troupe_id is not null then '단체 확인' else '미확인' end)
  returning id into v_show_id;

  for v_pos in select * from project_positions where project_id = p_project_id and status = 'filled' and assigned_member_id is not null
  loop
    select up.person_id into v_person_id
    from project_members pm join user_profiles up on up.id = pm.user_id
    where pm.id = v_pos.assigned_member_id;
    if v_person_id is not null then
      insert into participation_history (show_id, person_id, role_type)
      values (v_show_id, v_person_id, case when v_pos.position_type = 'actor' then '배우' else '스텝' end)
      returning id into v_participation_id;
      if v_pos.position_type = 'actor' and v_pos.role_id is not null then
        insert into participation_roles (participation_id, role_id) values (v_participation_id, v_pos.role_id);
      elsif v_pos.staff_role_id is not null then
        insert into participation_staff_roles (participation_id, staff_role_id) values (v_participation_id, v_pos.staff_role_id);
      end if;
    end if;
  end loop;

  update projects set published_show_id = v_show_id where id = p_project_id;
  return v_show_id;
end $function$;

-- 단체 관리자인가 (사이트 관리자도 허용)
create or replace function public.can_manage_troupe(p_troupe_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or public.is_troupe_admin(p_troupe_id)
$$;

-- 공연 등록·수정. 작품·극장은 id로 고르거나, 이름만 주면 같은 이름을 찾고 없으면 새로 만든다.
-- p: {title, work_id, work_name, venue_id, venue_name, show_date, end_date,
--     ticket_type, performers_paid, performance_count, is_licensed}
create or replace function public.troupe_save_show(p_troupe_id uuid, p_show_id uuid, p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid := p_show_id;
  v_work uuid := nullif(p->>'work_id', '')::uuid;
  v_venue uuid := nullif(p->>'venue_id', '')::uuid;
  v_title text := nullif(trim(p->>'title'), '');
begin
  if not public.can_manage_troupe(p_troupe_id) then raise exception '이 단체의 관리자만 공연을 기록할 수 있어요'; end if;
  if v_title is null then raise exception '공연명을 적어주세요'; end if;
  if nullif(p->>'show_date', '') is null then raise exception '공연 날짜를 적어주세요'; end if;

  if v_work is null and nullif(trim(p->>'work_name'), '') is not null then
    select id into v_work from works where title = trim(p->>'work_name') limit 1;
    if v_work is null then
      insert into works (title) values (trim(p->>'work_name')) returning id into v_work;
    end if;
  end if;
  if v_venue is null and nullif(trim(p->>'venue_name'), '') is not null then
    select id into v_venue from venues where name = trim(p->>'venue_name') limit 1;
    if v_venue is null then
      insert into venues (name) values (trim(p->>'venue_name')) returning id into v_venue;
    end if;
  end if;

  if v_id is null then
    insert into shows (title, troupe_id, work_id, venue_id, show_date, end_date,
                       ticket_type, performers_paid, performance_count, is_licensed, record_status)
    values (v_title, p_troupe_id, v_work, v_venue, (p->>'show_date')::date, nullif(p->>'end_date', '')::date,
            nullif(p->>'ticket_type', ''), (p->>'performers_paid')::boolean,
            nullif(p->>'performance_count', '')::int, nullif(p->>'is_licensed', ''), '단체 확인')
    returning id into v_id;
  else
    if not exists (select 1 from shows where id = v_id and troupe_id = p_troupe_id) then
      raise exception '이 단체의 공연이 아니에요';
    end if;
    update shows set
      title = v_title, work_id = v_work, venue_id = v_venue,
      show_date = (p->>'show_date')::date, end_date = nullif(p->>'end_date', '')::date,
      ticket_type = nullif(p->>'ticket_type', ''), performers_paid = (p->>'performers_paid')::boolean,
      performance_count = nullif(p->>'performance_count', '')::int,
      is_licensed = nullif(p->>'is_licensed', ''),
      record_status = case when record_status = '권리 확인' then record_status else '단체 확인' end
    where id = v_id;
  end if;
  return v_id;
end $$;

-- 캐스팅·스태프 붙여넣기. 한 줄에 "구분: 이름, 이름" (탭도 구분자로 인정).
-- 구분이 작품의 배역 이름이면 배우, 스태프 역할 이름이면 스태프, 둘 다 아니면 배역 없는 배우로 넣는다.
-- 이름이 정확히 같은 사람이 딱 한 명이면 그 사람으로, 아니면 새 사람을 만든다(동명이인은 어드민에서 정리).
create or replace function public.troupe_add_cast(p_show_id uuid, p_lines text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_show record; v_line text; v_label text; v_names text; v_name text;
  v_role uuid; v_staff uuid; v_person uuid; v_part uuid; v_cnt int;
  v_added int := 0; v_new int := 0; v_unknown text[] := '{}';
begin
  select * into v_show from shows where id = p_show_id;
  if v_show is null then raise exception '공연을 찾을 수 없어요'; end if;
  if v_show.troupe_id is null or not public.can_manage_troupe(v_show.troupe_id) then
    raise exception '이 단체의 관리자만 출연진을 넣을 수 있어요';
  end if;

  foreach v_line in array regexp_split_to_array(coalesce(p_lines, ''), E'\n') loop
    v_line := trim(regexp_replace(v_line, E'\t', ':', 'g'));
    continue when v_line = '';
    if position(':' in v_line) > 0 then
      v_label := trim(split_part(v_line, ':', 1));
      v_names := trim(substr(v_line, position(':' in v_line) + 1));
    else
      v_label := ''; v_names := v_line;
    end if;

    v_role := null; v_staff := null;
    if v_label <> '' then
      select id into v_role from roles where work_id = v_show.work_id and name = v_label limit 1;
      if v_role is null then select id into v_staff from staff_roles where name = v_label limit 1; end if;
      if v_role is null and v_staff is null and not (v_label = any(v_unknown)) then
        v_unknown := v_unknown || v_label;
      end if;
    end if;

    foreach v_name in array regexp_split_to_array(v_names, '\s*[,/·:]\s*') loop
      v_name := trim(v_name);
      continue when v_name = '';
      select count(*) into v_cnt from people where name = v_name and not coalesce(is_hidden, false);
      if v_cnt = 1 then
        select id into v_person from people where name = v_name and not coalesce(is_hidden, false);
      else
        insert into people (name) values (v_name) returning id into v_person;
        v_new := v_new + 1;
      end if;
      -- 같은 공연·같은 사람·같은 구분이 이미 있으면 건너뛴다
      if exists (
        select 1 from participation_history ph
        left join participation_roles pr on pr.participation_id = ph.id
        left join participation_staff_roles ps on ps.participation_id = ph.id
        where ph.show_id = p_show_id and ph.person_id = v_person
          and coalesce(pr.role_id::text, '') = coalesce(v_role::text, '')
          and coalesce(ps.staff_role_id::text, '') = coalesce(v_staff::text, '')
      ) then continue; end if;

      insert into participation_history (show_id, person_id, role_type)
      values (p_show_id, v_person, case when v_staff is not null then '스텝' else '배우' end)
      returning id into v_part;
      if v_role is not null then insert into participation_roles (participation_id, role_id) values (v_part, v_role); end if;
      if v_staff is not null then insert into participation_staff_roles (participation_id, staff_role_id) values (v_part, v_staff); end if;
      v_added := v_added + 1;
    end loop;
  end loop;

  return jsonb_build_object('added', v_added, 'new_people', v_new, 'unknown_labels', to_jsonb(v_unknown));
end $$;

revoke execute on function public.troupe_save_show(uuid, uuid, jsonb) from anon, public;
revoke execute on function public.troupe_add_cast(uuid, text) from anon, public;
grant execute on function public.troupe_save_show(uuid, uuid, jsonb) to authenticated;
grant execute on function public.troupe_add_cast(uuid, text) to authenticated;
grant execute on function public.can_manage_troupe(uuid) to authenticated;
