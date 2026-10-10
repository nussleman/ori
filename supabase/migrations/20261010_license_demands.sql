-- 수요 신청: "이 작품, 정식으로 올리고 싶어요" (2026-10-10, docs/license.md 사업 흐름 2번)
-- 하트·문의·프로젝트에는 언제·몇 회·유료인지가 없어 권리자가 시장 크기를 가늠하기 어렵다.
-- 신청 = 시기·규모·조건이 담긴 수요 신호. 계약이 아니다 (오리가 모아서 권리자에게 대신 묻는다).
-- 저작권법 29조 기준(티켓 유료·출연료)이 라이선스 필요 여부를 가르므로 둘 다 받는다.

create table if not exists public.license_demands (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references public.works(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  troupe_id uuid references public.troupes(id) on delete set null,  -- 신청한 사람이 속한 단체 (없으면 개인)
  period text,                 -- 희망 시기 '2027 상반기' / '미정'
  performance_count int check (performance_count is null or performance_count between 1 and 500),
  ticket_type text check (ticket_type in ('유료', '무료', '미정')),
  performers_paid text check (performers_paid in ('지급', '없음', '미정')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (work_id, user_id)    -- 작품당 한 사람 한 신청 (고치기로 갱신)
);
alter table public.license_demands enable row level security;
create policy license_demands_select on public.license_demands for select using (user_id = auth.uid() or public.is_admin());
-- 쓰기는 아래 함수로만 (단체 소속 확인)

create or replace function public.save_license_demand(p_work_id uuid, p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_troupe uuid := nullif(p->>'troupe_id', '')::uuid; v_id uuid;
begin
  if v_uid is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then raise exception '로그인이 필요해요'; end if;
  if not exists (select 1 from works where id = p_work_id) then raise exception '작품을 찾을 수 없어요'; end if;
  if v_troupe is not null and not exists (select 1 from troupe_members where troupe_id = v_troupe and user_id = v_uid and status = 'confirmed') then
    raise exception '내가 속한 단체만 고를 수 있어요';
  end if;
  insert into license_demands (work_id, user_id, troupe_id, period, performance_count, ticket_type, performers_paid, note)
  values (p_work_id, v_uid, v_troupe, nullif(p->>'period', ''), nullif(p->>'performance_count', '')::int,
          nullif(p->>'ticket_type', ''), nullif(p->>'performers_paid', ''), nullif(trim(p->>'note'), ''))
  on conflict (work_id, user_id) do update set
    troupe_id = excluded.troupe_id, period = excluded.period, performance_count = excluded.performance_count,
    ticket_type = excluded.ticket_type, performers_paid = excluded.performers_paid, note = excluded.note, updated_at = now()
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.withdraw_license_demand(p_work_id uuid)
returns void language sql security definer set search_path = public as $$
  delete from license_demands where work_id = p_work_id and user_id = auth.uid()
$$;

revoke execute on function public.save_license_demand(uuid, jsonb) from anon, public;
revoke execute on function public.withdraw_license_demand(uuid) from anon, public;
grant execute on function public.save_license_demand(uuid, jsonb) to authenticated;
grant execute on function public.withdraw_license_demand(uuid) to authenticated;

-- 작품 허브에 정식 신청 수(단체 기준, 단체 없이 신청하면 1명=1곳) 추가.
-- (반환 모양이 바뀌는 함수는 drop이 필요해 피하고, 같은 jsonb를 돌려주는 work_hub에 넣는다)
create or replace function public.work_hub(p_work_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'rights', (select case when rights_is_public then jsonb_build_object(
                 'type', rights_type, 'holder', rights_holder_display,
                 'amateur', amateur_license_status, 'verified_at', rights_verified_at)
               end from works where id = p_work_id),
    'budget', (select case when count(*) >= 3 then jsonb_build_object(
                 'n', count(*), 'median', percentile_cont(0.5) within group (order by budget_total))
               end from projects where work_id = p_work_id and budget_total > 0),
    'requests', (select count(distinct coalesce(troupe_id::text, user_id::text)) from license_demands where work_id = p_work_id)
  )
$$;

-- 수요 보드 보조: 작품별 정식 신청 수·유료 예정 수·가장 이른 희망 시기 (운영자 전용)
create or replace function public.license_demand_stats()
returns table (work_id uuid, request_count int, request_paid int, request_period text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception '운영자만 볼 수 있어요'; end if;
  return query
  select ld.work_id, count(*)::int, count(*) filter (where ld.ticket_type = '유료' or ld.performers_paid = '지급')::int,
         min(ld.period) filter (where ld.period is not null and ld.period <> '미정')
  from license_demands ld group by ld.work_id;
end $$;
revoke execute on function public.license_demand_stats() from anon, public;
grant execute on function public.license_demand_stats() to authenticated;

-- 수요 보드: 정식 신청을 원하는 단체·사람 수에 합친다 (반환 모양은 그대로)
create or replace function public.demand_board()
returns table (
  work_id uuid, title text, genre text, rights_type text, amateur_license_status text,
  demand_troupes int, demand_people int, wish_count int, inquiry_count int, inquiry_new int, project_count int,
  past_show_count int, past_troupe_count int, last_year int,
  catalog_status text, priority int, orig_holder text, ko_script_holder text, ko_script_holder_type text, ko_exclusive text,
  first_deal boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception '운영자만 볼 수 있어요'; end if;
  return query
  with sig as (
    select f.target_id wid, f.user_id uid, tm.troupe_id tid
    from favorites f left join troupe_members tm on tm.user_id = f.user_id and tm.status = 'confirmed'
    where f.list_type = 'wishlist' and f.target_type = 'work'
    union all
    select coalesce(li.work_id, s.work_id), li.user_id, tm.troupe_id
    from license_inquiries li left join shows s on s.id = li.show_id
    left join troupe_members tm on tm.user_id = li.user_id and tm.status = 'confirmed'
    union all
    select p.work_id, p.owner_id, p.troupe_id from projects p where p.work_id is not null and p.status <> 'cancelled'
    union all
    select ld.work_id, ld.user_id, ld.troupe_id from license_demands ld
  ), d as (
    select wid, count(distinct tid)::int dt, count(distinct uid)::int dp from sig where wid is not null group by wid
  ), past as (
    select s.work_id, count(*)::int n, count(distinct s.troupe_id)::int t, max(extract(year from s.show_date))::int y
    from shows s where s.work_id is not null and not coalesce(s.is_hidden, false) group by s.work_id
  )
  select w.id, w.title, w.genre, w.rights_type, w.amateur_license_status,
         coalesce(d.dt, 0), coalesce(d.dp, 0),
         (select count(*)::int from favorites f where f.list_type = 'wishlist' and f.target_type = 'work' and f.target_id = w.id),
         (select count(*)::int from license_inquiries li left join shows s on s.id = li.show_id where coalesce(li.work_id, s.work_id) = w.id),
         (select count(*)::int from license_inquiries li left join shows s on s.id = li.show_id where coalesce(li.work_id, s.work_id) = w.id and li.status = 'new'),
         (select count(*)::int from projects p where p.work_id = w.id and p.status <> 'cancelled'),
         coalesce(past.n, 0), coalesce(past.t, 0), past.y,
         coalesce(wr.catalog_status, '미접촉'), wr.priority, wr.orig_holder, wr.ko_script_holder, wr.ko_script_holder_type, wr.ko_exclusive,
         coalesce(coalesce(d.dp, 0) > 0 and (w.rights_type = '창작' or wr.ko_exclusive in ('없음', '끝남')), false)
  from works w
  left join d on d.wid = w.id
  left join past on past.work_id = w.id
  left join work_rights wr on wr.work_id = w.id;
end $$;
revoke execute on function public.demand_board() from anon, public;
grant execute on function public.demand_board() to authenticated;

create or replace function public.demand_detail(p_work_id uuid)
returns table (kind text, at timestamptz, who text, troupe_name text, note text, status text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception '운영자만 볼 수 있어요'; end if;
  return query
  select '정식 신청'::text, ld.updated_at, up.nickname, t.name,
         concat_ws(' · ', ld.period, case when ld.performance_count is not null then ld.performance_count || '회' end,
                   case when ld.ticket_type is not null then '티켓 ' || ld.ticket_type end,
                   case when ld.performers_paid is not null then '출연료 ' || ld.performers_paid end, ld.note),
         null::text
  from license_demands ld left join user_profiles up on up.id = ld.user_id left join troupes t on t.id = ld.troupe_id
  where ld.work_id = p_work_id
  union all
  select '올리고 싶어요', f.created_at, up.nickname,
         (select string_agg(t.name, ', ') from troupe_members tm join troupes t on t.id = tm.troupe_id where tm.user_id = f.user_id and tm.status = 'confirmed'),
         null::text, null::text
  from favorites f left join user_profiles up on up.id = f.user_id
  where f.list_type = 'wishlist' and f.target_type = 'work' and f.target_id = p_work_id
  union all
  select '라이선스 문의', li.created_at, up.nickname,
         (select string_agg(t.name, ', ') from troupe_members tm join troupes t on t.id = tm.troupe_id where tm.user_id = li.user_id and tm.status = 'confirmed'),
         li.message, li.status
  from license_inquiries li left join shows s on s.id = li.show_id left join user_profiles up on up.id = li.user_id
  where coalesce(li.work_id, s.work_id) = p_work_id
  union all
  select '프로젝트', p.created_at, up.nickname, t.name, p.title, p.status
  from projects p left join user_profiles up on up.id = p.owner_id left join troupes t on t.id = p.troupe_id
  where p.work_id = p_work_id and p.status <> 'cancelled'
  order by 2 desc;
end $$;
