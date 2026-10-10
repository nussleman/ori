-- 지원 → 합류 → 공연 후 이력을 한 흐름으로 (2026-10-10 피벗 5단계: 관계 강화)
-- 빈 곳 두 개를 메운다:
--  1) 공연 데이터가 만들어진 뒤에 합류한 사람은 이력이 생기지 않았다 → 합류 승인 때도 이력을 채운다
--  2) 합류 때 프로필(사람) 연결이 없던 사람은 나중에 연결해도 이력이 없었다 → "내 이력"을 열 때 채운다
-- 프로젝트로 만든 공연은 단체가 만든 기록이므로 이력은 바로 '확인'.

-- 프로젝트의 채워진 자리 → 발행된 공연의 참여 이력 (이미 있는 건 건너뜀). 다른 함수 안에서만 부른다.
create or replace function public.project_show_sync(p_project_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_show uuid; v_pos record; v_person uuid; v_part uuid; v_added int := 0;
  v_role uuid; v_staff uuid; v_type text;
begin
  select published_show_id into v_show from projects where id = p_project_id;
  if v_show is null then return 0; end if;
  for v_pos in select * from project_positions where project_id = p_project_id and status = 'filled' and assigned_member_id is not null
  loop
    select up.person_id into v_person
    from project_members pm join user_profiles up on up.id = pm.user_id
    where pm.id = v_pos.assigned_member_id;
    continue when v_person is null;
    v_type := case when v_pos.position_type = 'actor' then '배우' else '스텝' end;
    v_role := case when v_pos.position_type = 'actor' then v_pos.role_id end;
    v_staff := case when v_pos.position_type <> 'actor' then v_pos.staff_role_id end;
    continue when exists (
      select 1 from participation_history ph
      left join participation_roles pr on pr.participation_id = ph.id
      left join participation_staff_roles ps on ps.participation_id = ph.id
      where ph.show_id = v_show and ph.person_id = v_person and coalesce(ph.role_type, '') = v_type
        and coalesce(pr.role_id::text, '') = coalesce(v_role::text, '')
        and coalesce(ps.staff_role_id::text, '') = coalesce(v_staff::text, '')
    );
    insert into participation_history (show_id, person_id, role_type) values (v_show, v_person, v_type)
    returning id into v_part;
    if v_role is not null then insert into participation_roles (participation_id, role_id) values (v_part, v_role); end if;
    if v_staff is not null then insert into participation_staff_roles (participation_id, staff_role_id) values (v_part, v_staff); end if;
    v_added := v_added + 1;
  end loop;
  return v_added;
end $$;
revoke execute on function public.project_show_sync(uuid) from anon, public, authenticated;

-- 공연 데이터 발행: 처음이면 공연을 만들고, 이미 있으면 빠진 이력만 채운다
create or replace function public.publish_project_as_show(p_project_id uuid)
returns uuid language plpgsql security definer set search_path = public as $function$
declare v_project record; v_show_id uuid;
begin
  select * into v_project from projects where id = p_project_id;
  if v_project is null then raise exception '프로젝트를 찾을 수 없어요'; end if;
  if not is_project_admin(p_project_id) then raise exception '권한이 없어요'; end if;
  v_show_id := v_project.published_show_id;
  if v_show_id is null then
    insert into shows (title, show_date, end_date, troupe_id, venue_id, work_id, is_licensed, record_status)
    values (v_project.title, v_project.target_start_date, v_project.target_end_date, v_project.troupe_id,
            v_project.venue_id, v_project.work_id, v_project.is_licensed,
            case when v_project.troupe_id is not null then '단체 확인' else '미확인' end)
    returning id into v_show_id;
    update projects set published_show_id = v_show_id where id = p_project_id;
  end if;
  perform public.project_show_sync(p_project_id);
  return v_show_id;
end $function$;

-- 합류 승인: 이미 공연 데이터가 있는 프로젝트면 바로 이력까지
create or replace function public.approve_join_request(request_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare v_req record; v_member_id uuid;
begin
  select * into v_req from project_join_requests where id = request_id;
  if v_req is null then raise exception '요청을 찾을 수 없어요'; end if;
  if not is_project_admin(v_req.project_id) then raise exception '권한이 없어요'; end if;

  select id into v_member_id from project_members where project_id = v_req.project_id and user_id = v_req.user_id;
  if v_member_id is null then
    insert into project_members (project_id, user_id, member_role, invite_status)
    values (v_req.project_id, v_req.user_id, 'member', 'confirmed')
    returning id into v_member_id;
  end if;

  if v_req.position_id is not null then
    update project_positions set assigned_member_id = v_member_id, status = 'filled' where id = v_req.position_id;
  end if;
  update project_join_requests set status = 'approved', reviewed_at = now() where id = request_id;
  perform public.project_show_sync(v_req.project_id);
end;
$function$;

-- 내가 자리를 맡은 프로젝트 중 공연 데이터가 있는 것의 이력을 채운다 ("내 이력"을 열 때 부름)
create or replace function public.sync_my_project_history()
returns int language plpgsql security definer set search_path = public as $$
declare v_pid uuid; v_added int := 0;
begin
  if auth.uid() is null or not exists (select 1 from user_profiles where id = auth.uid() and person_id is not null) then return 0; end if;
  for v_pid in
    select distinct pp.project_id from project_positions pp
    join project_members pm on pm.id = pp.assigned_member_id
    join projects pr on pr.id = pp.project_id
    where pm.user_id = auth.uid() and pp.status = 'filled' and pr.published_show_id is not null
  loop
    v_added := v_added + public.project_show_sync(v_pid);
  end loop;
  return v_added;
end $$;
revoke execute on function public.sync_my_project_history() from anon, public;
grant execute on function public.sync_my_project_history() to authenticated;
