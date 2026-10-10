-- 작품 페이지 허브 (2026-10-10 피벗 3단계)
-- 원칙: 미확보 공연은 개별로 공개하지 않고 작품 페이지에 집계(숫자)로만. 사이트는 공개 공연만 읽으므로(core.js load())
-- 라이선스와 상관없는 "몇 번·몇 곳" 숫자는 여기서 따로 받는다. 이름·날짜·단체 같은 개별 정보는 돌려주지 않는다.

-- 1) 작품별 집계: 올라간 횟수, 올린 단체 수, 처음·최근 연도, "올리고 싶어요" 수
create or replace function public.work_stage_stats()
returns table (work_id uuid, show_count int, troupe_count int, first_year int, last_year int, wish_count int)
language sql stable security definer set search_path = public as $$
  with s as (
    select work_id, count(*)::int n, count(distinct troupe_id)::int t,
           min(extract(year from show_date))::int y0, max(extract(year from show_date))::int y1
    from shows where work_id is not null and not coalesce(is_hidden, false)
    group by work_id
  ), w as (
    select target_id, count(*)::int n from favorites
    where list_type = 'wishlist' and target_type = 'work' group by target_id
  )
  select coalesce(s.work_id, w.target_id), coalesce(s.n, 0), coalesce(s.t, 0), s.y0, s.y1, coalesce(w.n, 0)
  from s full join w on w.target_id = s.work_id
$$;

-- 2) 작품 하나의 허브 정보: 공개하기로 한 권리 정보 + 비용 감(같은 작품 프로젝트 3개 이상일 때 총예산 중앙값)
create or replace function public.work_hub(p_work_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'rights', (select case when rights_is_public then jsonb_build_object(
                 'type', rights_type, 'holder', rights_holder_display,
                 'amateur', amateur_license_status, 'verified_at', rights_verified_at)
               end from works where id = p_work_id),
    'budget', (select case when count(*) >= 3 then jsonb_build_object(
                 'n', count(*), 'median', percentile_cont(0.5) within group (order by budget_total))
               end from projects where work_id = p_work_id and budget_total > 0)
  )
$$;

revoke execute on function public.work_stage_stats() from anon, public;
revoke execute on function public.work_hub(uuid) from anon, public;
grant execute on function public.work_stage_stats() to authenticated;
grant execute on function public.work_hub(uuid) to authenticated;
