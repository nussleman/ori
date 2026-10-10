-- 수정 요청을 운영자뿐 아니라 그 기록의 주인(단체)에게도 보인다 (2026-10-10 피벗 2단계: 입력 구조)
-- 단체의 기록 = 그 단체의 공연(target_type='show') + 단체 정보 자체(target_type='troupe').
-- 단체 관리자는 보고 고친 뒤 '완료'/'반려'로 닫는다. 운영자 화면(어드민 수정 요청)은 그대로 전부 본다.

-- 요청이 어느 단체의 기록에 대한 것인가
create or replace function public.edit_request_troupe(p_target_type text, p_target_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select case
    when p_target_type = 'troupe' then p_target_id
    when p_target_type = 'show' then (select troupe_id from shows where id = p_target_id)
  end
$$;

create or replace function public.list_troupe_edit_requests(p_troupe_id uuid, p_status text default 'pending')
returns table (id uuid, request_type text, target_type text, target_id uuid, target_name text,
               summary text, details text, status text, requester_nickname text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.can_manage_troupe(p_troupe_id) then raise exception '이 단체의 관리자만 볼 수 있어요'; end if;
  return query
  select er.id, er.request_type, er.target_type, er.target_id,
         case when er.target_type = 'troupe' then t.name else s.title end,
         er.summary, er.details, er.status, up.nickname, er.created_at
  from edit_requests er
  left join shows s on er.target_type = 'show' and s.id = er.target_id
  left join troupes t on er.target_type = 'troupe' and t.id = er.target_id
  left join user_profiles up on up.id = er.user_id
  where public.edit_request_troupe(er.target_type, er.target_id) = p_troupe_id
    and (p_status = 'all' or er.status = p_status)
  order by er.created_at desc;
end $$;

create or replace function public.resolve_troupe_edit_request(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare v_troupe uuid;
begin
  if p_status not in ('done', 'rejected') then raise exception '완료 또는 반려만 할 수 있어요'; end if;
  select public.edit_request_troupe(target_type, target_id) into v_troupe from edit_requests where id = p_id;
  if v_troupe is null or not public.can_manage_troupe(v_troupe) then
    raise exception '이 단체의 관리자만 처리할 수 있어요';
  end if;
  update edit_requests set status = p_status, reviewed_by = auth.uid(), reviewed_at = now() where id = p_id;
end $$;

revoke execute on function public.edit_request_troupe(text, uuid) from anon, public;
revoke execute on function public.list_troupe_edit_requests(uuid, text) from anon, public;
revoke execute on function public.resolve_troupe_edit_request(uuid, text) from anon, public;
grant execute on function public.edit_request_troupe(text, uuid) to authenticated;
grant execute on function public.list_troupe_edit_requests(uuid, text) to authenticated;
grant execute on function public.resolve_troupe_edit_request(uuid, text) to authenticated;
