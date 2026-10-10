-- 수요 묶기: 어드민 "수요 보드" + 작품 권리 "두 겹" (2026-10-10, docs/license.md 사업 흐름 2·3번)
-- "이 작품, 단체 12곳이 원해요"를 만드는 곳. 수요 = 앞으로 올리고 싶다는 신호만:
--   올리고 싶어요(favorites wishlist) · 라이선스 문의(license_inquiries) · 이 작품으로 준비 중인 프로젝트(projects)
-- 과거 공연 횟수는 내부 참고로만 보이고, 권리자용 내보내기에는 넣지 않는다 (과거 무단 공연은 들추지 않는다).

-- 1) 권리 두 겹: 원작의 문 / 번역의 문. work_rights는 운영자만 읽고 쓰는 영업용 표(공개 안 됨)
alter table public.work_rights
  add column if not exists orig_holder text,            -- 원작 권리자 또는 대행사·출판사
  add column if not exists ko_script_holder text,       -- 한국어 대본(번역본)을 가진 곳
  add column if not exists ko_script_holder_type text
    check (ko_script_holder_type in ('제작사', '번역자', '오리', '없음')),
  add column if not exists ko_script_contact text,
  add column if not exists ko_exclusive text
    check (ko_exclusive in ('있음', '없음', '끝남', '모름'));
comment on column public.work_rights.holder_contact is '원작 권리자·대행사 연락처';
comment on column public.work_rights.is_exclusive is '(예전 칸) 한국 독점 여부는 ko_exclusive를 쓴다';

-- 2) 수요 보드 (운영자 전용). 예전 v_catalog_candidates는 favorites RLS 때문에 운영자 본인 것만 세었고
--    해외라이선스 작품을 빼고 있어서, 모든 작품을 정확히 세는 함수로 대신한다.
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
  with sig as (  -- 수요 신호 한 줄 = (작품, 사람, 단체)
    select f.target_id wid, f.user_id uid, tm.troupe_id tid, 'wish' k
    from favorites f left join troupe_members tm on tm.user_id = f.user_id and tm.status = 'confirmed'
    where f.list_type = 'wishlist' and f.target_type = 'work'
    union all
    select coalesce(li.work_id, s.work_id), li.user_id, tm.troupe_id, 'inq'
    from license_inquiries li left join shows s on s.id = li.show_id
    left join troupe_members tm on tm.user_id = li.user_id and tm.status = 'confirmed'
    union all
    select p.work_id, p.owner_id, p.troupe_id, 'proj'
    from projects p where p.work_id is not null and p.status <> 'cancelled'
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
         -- 첫 딜 후보: 협상 상대가 하나뿐인 경우 (창작 작품, 또는 한국 독점이 없거나 끝난 작품) + 수요가 있음
         coalesce(coalesce(d.dp, 0) > 0 and (w.rights_type = '창작' or wr.ko_exclusive in ('없음', '끝남')), false)
  from works w
  left join d on d.wid = w.id
  left join past on past.work_id = w.id
  left join work_rights wr on wr.work_id = w.id;
end $$;

-- 3) 한 작품의 수요 신호 자세히 (운영자 전용). 본인이 남긴 신호만이라 이름을 보여도 된다.
create or replace function public.demand_detail(p_work_id uuid)
returns table (kind text, at timestamptz, who text, troupe_name text, note text, status text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception '운영자만 볼 수 있어요'; end if;
  return query
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

revoke execute on function public.demand_board() from anon, public;
revoke execute on function public.demand_detail(uuid) from anon, public;
grant execute on function public.demand_board() to authenticated;
grant execute on function public.demand_detail(uuid) to authenticated;
