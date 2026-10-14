-- 2026-10-14 나한테 온 제안 (프로젝트 초대를 진짜 "제안"으로)
-- 문제: invite_person_to_position이 초대를 "그 사람이 지원한 것"처럼 저장했다.
--   → 초대받은 사람은 수락·거절할 수 없고, 초대한 관리자가 스스로 "승인"해 본인 동의 없이 합류시킬 수 있었다.
-- 바꾼 것:
--   1) project_join_requests.invited_by: 비어 있으면 지원, 차 있으면 초대(누가 보냈는지)
--   2) 초대는 받은 사람만 수락(respond_offer true)·거절(false). 관리자 승인 목록·승인 함수에서는 초대를 뺀다
--   3) 사용자가 직접 넣는 줄(지원)에는 invited_by를 넣을 수 없다 (가짜 초대를 만들어 스스로 수락하는 것 차단)
--   4) my_offers(): 나한테 온 대기 중 제안. my_join_requests()는 내가 지원한 것만

alter table public.project_join_requests add column if not exists invited_by uuid references auth.users(id);

alter policy join_requests_insert_own on public.project_join_requests
  with check ((user_id = auth.uid()) and is_real_user() and invited_by is null);

create or replace function public.invite_person_to_position(p_position_id uuid, p_person_id uuid, p_message text)
 returns void language plpgsql security definer set search_path to 'public'
as $function$
declare v_project_id uuid; v_target_user uuid;
begin
  select project_id into v_project_id from project_positions where id = p_position_id;
  if v_project_id is null then raise exception '자리를 찾을 수 없어요'; end if;
  if not is_project_admin(v_project_id) then raise exception '관리자만 초대할 수 있어요'; end if;
  select id into v_target_user from user_profiles where person_id = p_person_id;
  if v_target_user is null then raise exception '아직 오리 계정과 연결되지 않은 사람이에요'; end if;
  if v_target_user = auth.uid() then raise exception '나 자신은 초대할 수 없어요'; end if;
  if exists (select 1 from project_join_requests where position_id = p_position_id and user_id = v_target_user and status = 'pending') then
    raise exception '이미 이 자리로 제안을 보냈어요';
  end if;
  insert into project_join_requests (project_id, position_id, user_id, message, status, invited_by)
  values (v_project_id, p_position_id, v_target_user, p_message, 'pending', auth.uid());
end;
$function$;

-- 관리자 승인 목록: 지원만 (초대는 받은 사람이 답한다)
create or replace function public.list_project_join_requests(p_project_id uuid)
 returns table(request_id uuid, position_id uuid, position_label text, requester_email text, requester_nickname text, message text, created_at timestamp with time zone)
 language sql stable security definer set search_path to 'public'
as $function$
  select jr.id, jr.position_id, pp.position_label, au.email, up.nickname, jr.message, jr.created_at
  from project_join_requests jr
  left join project_positions pp on pp.id = jr.position_id
  join auth.users au on au.id = jr.user_id
  left join user_profiles up on up.id = jr.user_id
  where jr.project_id = p_project_id and jr.status = 'pending' and jr.invited_by is null and is_project_admin(p_project_id)
  order by jr.created_at asc;
$function$;

-- 합류 처리 공통 (승인·제안 수락이 같이 쓴다)
create or replace function public.join_request_accept_core(p_request_id uuid)
 returns void language plpgsql security definer set search_path to 'public'
as $function$
declare v_req record; v_member_id uuid;
begin
  select * into v_req from project_join_requests where id = p_request_id;
  select id into v_member_id from project_members where project_id = v_req.project_id and user_id = v_req.user_id;
  if v_member_id is null then
    insert into project_members (project_id, user_id, member_role, invite_status)
    values (v_req.project_id, v_req.user_id, 'member', 'confirmed')
    returning id into v_member_id;
  end if;
  if v_req.position_id is not null then
    update project_positions set assigned_member_id = v_member_id, status = 'filled' where id = v_req.position_id;
  end if;
  update project_join_requests set status = 'approved', reviewed_at = now() where id = p_request_id;
  perform public.project_show_sync(v_req.project_id);
end;
$function$;
revoke execute on function public.join_request_accept_core(uuid) from public, anon, authenticated;

create or replace function public.approve_join_request(request_id uuid)
 returns void language plpgsql security definer set search_path to 'public'
as $function$
declare v_req record;
begin
  select * into v_req from project_join_requests where id = request_id;
  if v_req is null then raise exception '요청을 찾을 수 없어요'; end if;
  if not is_project_admin(v_req.project_id) then raise exception '권한이 없어요'; end if;
  if v_req.invited_by is not null then raise exception '제안은 받은 사람이 수락해야 해요'; end if;
  if v_req.status <> 'pending' then raise exception '이미 처리된 요청이에요'; end if;
  perform public.join_request_accept_core(request_id);
end;
$function$;

-- 나한테 온 제안 (대기 중)
create or replace function public.my_offers()
 returns table(id uuid, project_id uuid, project_title text, position_label text, message text, created_at timestamp with time zone,
               inviter_nickname text, troupe_name text, work_name text, target_start_date date, position_open boolean)
 language sql stable security definer set search_path to 'public'
as $function$
  select jr.id, jr.project_id, pr.title, pp.position_label, jr.message, jr.created_at,
         up.nickname, t.name, w.title, pr.target_start_date,
         (pp.id is null or (pp.status = 'open' and pp.assigned_member_id is null))
  from project_join_requests jr
  join projects pr on pr.id = jr.project_id
  left join project_positions pp on pp.id = jr.position_id
  left join user_profiles up on up.id = jr.invited_by
  left join troupes t on t.id = pr.troupe_id
  left join works w on w.id = pr.work_id
  where jr.user_id = auth.uid() and jr.invited_by is not null and jr.status = 'pending' and is_real_user()
  order by jr.created_at desc;
$function$;
revoke execute on function public.my_offers() from public, anon;
grant execute on function public.my_offers() to authenticated;

-- 제안에 답하기: 받은 본인만. 수락하면 바로 합류, 거절하면 rejected (상태 제약이 pending·approved·rejected라서)
create or replace function public.respond_offer(p_request_id uuid, p_accept boolean)
 returns void language plpgsql security definer set search_path to 'public'
as $function$
declare v_req record; v_pos record;
begin
  if not is_real_user() then raise exception '로그인이 필요해요'; end if;
  select * into v_req from project_join_requests where id = p_request_id;
  if v_req is null or v_req.user_id <> auth.uid() or v_req.invited_by is null then raise exception '제안을 찾을 수 없어요'; end if;
  if v_req.status <> 'pending' then raise exception '이미 답한 제안이에요'; end if;
  if not p_accept then
    update project_join_requests set status = 'rejected', reviewed_at = now() where id = p_request_id;
    return;
  end if;
  -- 보낸 사람이 여전히 그 프로젝트의 관리자여야 한다
  if not exists (select 1 from project_members m where m.project_id = v_req.project_id and m.user_id = v_req.invited_by and m.member_role in ('owner','admin') and m.invite_status = 'confirmed') then
    raise exception '이 제안은 더 이상 유효하지 않아요';
  end if;
  if v_req.position_id is not null then
    select * into v_pos from project_positions where id = v_req.position_id;
    if v_pos is null or v_pos.status <> 'open' or v_pos.assigned_member_id is not null then
      raise exception '그 사이 자리가 채워졌어요';
    end if;
  end if;
  perform public.join_request_accept_core(p_request_id);
end;
$function$;
revoke execute on function public.respond_offer(uuid, boolean) from public, anon;
grant execute on function public.respond_offer(uuid, boolean) to authenticated;

-- 지원 현황: 내가 지원한 것만 (받은 제안은 my_offers)
create or replace function public.my_join_requests()
 returns table(id uuid, project_id uuid, project_title text, position_label text, status text, created_at timestamp with time zone, reviewed_at timestamp with time zone)
 language sql stable security definer set search_path to 'public'
as $function$
  select jr.id, jr.project_id, pr.title, pp.position_label, jr.status, jr.created_at, jr.reviewed_at
  from project_join_requests jr join projects pr on pr.id = jr.project_id left join project_positions pp on pp.id = jr.position_id
  where jr.user_id = auth.uid() and jr.invited_by is null order by jr.created_at desc;
$function$;
