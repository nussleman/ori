-- 배우·스태프가 "내 이력"을 직접 추가하고, 그 공연의 단체가 확인한다 (2026-10-10 피벗 2단계: 입력 구조)
-- 기록마다 주인이 있다: 이력의 주인은 본인, 그 이력이 사실인지는 공연의 주인(단체)이 확인.
-- 단체가 없는 공연은 사이트 관리자가 확인한다.

-- 1) 참여 이력에 확인 상태. 기존 데이터(운영자·단체·프로젝트가 넣은 것)는 모두 '확인'
alter table public.participation_history
  add column if not exists confirm_status text not null default '확인'
    check (confirm_status in ('확인 대기', '확인', '거절')),
  add column if not exists requested_by uuid references auth.users(id) on delete set null,
  add column if not exists request_note text,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz;

create index if not exists participation_history_pending_idx
  on public.participation_history (show_id) where confirm_status = '확인 대기';

-- 2) 내 이력 추가 요청
-- p: {show_id} 또는 {show_title, show_date, troupe_id}  (오리에 없는 공연이면 새로 만든다 — 라이선스 미상이라 사이트엔 안 나옴)
--    {kind: '배우'|'스태프', label: 배역명 또는 역할명, note}
create or replace function public.request_my_participation(p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_person uuid;
  v_show uuid := nullif(p->>'show_id', '')::uuid;
  v_work uuid;
  v_kind text := coalesce(nullif(p->>'kind', ''), '배우');
  v_label text := nullif(trim(p->>'label'), '');
  v_role uuid; v_staff uuid; v_part uuid; v_note text;
begin
  if v_uid is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception '로그인이 필요해요';
  end if;
  select person_id into v_person from user_profiles where id = v_uid;
  if v_person is null then raise exception '먼저 내 프로필(사람)을 연결해주세요'; end if;
  if v_kind not in ('배우', '스태프') then raise exception '배우인지 스태프인지 골라주세요'; end if;
  if (select count(*) from participation_history where requested_by = v_uid and confirm_status = '확인 대기') >= 30 then
    raise exception '확인을 기다리는 이력이 너무 많아요. 단체가 확인한 뒤 더 추가해주세요';
  end if;

  if v_show is null then
    if nullif(trim(p->>'show_title'), '') is null then raise exception '공연을 고르거나 공연명을 적어주세요'; end if;
    if nullif(p->>'show_date', '') is null then raise exception '새 공연은 첫 공연일을 적어주세요'; end if;
    select id into v_show from shows
      where title = trim(p->>'show_title') and show_date = (p->>'show_date')::date
        and troupe_id is not distinct from nullif(p->>'troupe_id', '')::uuid
      limit 1;
    if v_show is null then
      insert into shows (title, show_date, troupe_id, record_status)
      values (trim(p->>'show_title'), (p->>'show_date')::date, nullif(p->>'troupe_id', '')::uuid, '미확인')
      returning id into v_show;
    end if;
  elsif not exists (select 1 from shows where id = v_show) then
    raise exception '공연을 찾을 수 없어요';
  end if;

  select work_id into v_work from shows where id = v_show;
  if v_label is not null then
    if v_kind = '배우' then
      select id into v_role from roles where work_id = v_work and name = v_label limit 1;
    else
      select id into v_staff from staff_roles where name = v_label limit 1;
    end if;
  end if;
  -- 목록에 없는 배역·역할 이름은 메모로 남겨 확인하는 사람이 보게 한다
  v_note := concat_ws(' · ',
    case when v_label is not null and v_role is null and v_staff is null then v_kind || ': ' || v_label end,
    nullif(trim(p->>'note'), ''));

  if exists (
    select 1 from participation_history ph
    left join participation_roles pr on pr.participation_id = ph.id
    left join participation_staff_roles ps on ps.participation_id = ph.id
    where ph.show_id = v_show and ph.person_id = v_person and ph.confirm_status <> '거절'
      and coalesce(ph.role_type, '') = case when v_kind = '배우' then '배우' else '스텝' end
      and coalesce(pr.role_id::text, '') = coalesce(v_role::text, '')
      and coalesce(ps.staff_role_id::text, '') = coalesce(v_staff::text, '')
  ) then raise exception '이미 같은 이력이 있어요'; end if;

  insert into participation_history (show_id, person_id, role_type, confirm_status, requested_by, request_note)
  values (v_show, v_person, case when v_kind = '배우' then '배우' else '스텝' end, '확인 대기', v_uid, nullif(v_note, ''))
  returning id into v_part;
  if v_role is not null then insert into participation_roles (participation_id, role_id) values (v_part, v_role); end if;
  if v_staff is not null then insert into participation_staff_roles (participation_id, staff_role_id) values (v_part, v_staff); end if;
  return v_part;
end $$;

-- 3) 내가 올린 요청 취소 (확인 대기·거절된 것만. 확인된 이력은 수정 요청으로)
create or replace function public.cancel_my_participation(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from participation_history
  where id = p_id and requested_by = auth.uid() and confirm_status in ('확인 대기', '거절');
  if not found then raise exception '지울 수 없는 이력이에요'; end if;
end $$;

-- 4) 확인 목록. p_troupe_id가 있으면 그 단체 공연만(단체 관리자), 없으면 전체(사이트 관리자)
create or replace function public.list_participation_requests(p_troupe_id uuid, p_status text default '확인 대기')
returns table (id uuid, show_id uuid, show_title text, show_date date, troupe_id uuid, troupe_name text,
               person_id uuid, person_name text, role_type text, role_names text, request_note text,
               confirm_status text, requester_nickname text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if p_troupe_id is null then
    if not public.is_admin() then raise exception '권한이 없어요'; end if;
  elsif not public.can_manage_troupe(p_troupe_id) then
    raise exception '이 단체의 관리자만 볼 수 있어요';
  end if;
  return query
  select ph.id, s.id, s.title, s.show_date, s.troupe_id, t.name, pe.id, pe.name, ph.role_type,
         nullif(concat_ws(', ',
           (select string_agg(r.name, ', ') from participation_roles pr join roles r on r.id = pr.role_id where pr.participation_id = ph.id),
           (select string_agg(sr.name, ', ') from participation_staff_roles ps join staff_roles sr on sr.id = ps.staff_role_id where ps.participation_id = ph.id)
         ), ''),
         ph.request_note, ph.confirm_status, up.nickname, ph.created_at
  from participation_history ph
  join shows s on s.id = ph.show_id
  join people pe on pe.id = ph.person_id
  left join troupes t on t.id = s.troupe_id
  left join user_profiles up on up.id = ph.requested_by
  where ph.requested_by is not null
    and (p_status = 'all' or ph.confirm_status = p_status)
    and (p_troupe_id is null or s.troupe_id = p_troupe_id)
  order by ph.created_at desc;
end $$;

-- 5) 확인·거절. 공연의 단체 관리자, 또는 사이트 관리자
create or replace function public.review_participation(p_id uuid, p_ok boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_troupe uuid;
begin
  select s.troupe_id into v_troupe from participation_history ph join shows s on s.id = ph.show_id where ph.id = p_id;
  if not found then raise exception '이력을 찾을 수 없어요'; end if;
  if not (public.is_admin() or (v_troupe is not null and public.is_troupe_admin(v_troupe))) then
    raise exception '이 공연 단체의 관리자만 확인할 수 있어요';
  end if;
  update participation_history
  set confirm_status = case when p_ok then '확인' else '거절' end, reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_id;
end $$;

revoke execute on function public.request_my_participation(jsonb) from anon, public;
revoke execute on function public.cancel_my_participation(uuid) from anon, public;
revoke execute on function public.list_participation_requests(uuid, text) from anon, public;
revoke execute on function public.review_participation(uuid, boolean) from anon, public;
grant execute on function public.request_my_participation(jsonb) to authenticated;
grant execute on function public.cancel_my_participation(uuid) to authenticated;
grant execute on function public.list_participation_requests(uuid, text) to authenticated;
grant execute on function public.review_participation(uuid, boolean) to authenticated;
