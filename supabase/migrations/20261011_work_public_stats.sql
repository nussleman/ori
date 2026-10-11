-- 작은 숫자 집계로 단체가 특정되지 않게 (2026-10-11, docs/public-scope.md 4번, 태준님 결정)
-- "단체 N곳이 이 작품을 올렸어요"는 미확보 공연까지 센다. 그런데 올린 단체가 1~2곳이면
-- 좁은 연극계에서 그 숫자만으로 어느 단체인지 짐작할 수 있다.
-- 기준: 공개되지 않은 공연이 섞여 있고 단체가 3곳 미만이면 숫자 대신 "몇몇"(few=true, 숫자·연도는 비움).
--       모두 공개 공연이면 원래 개별로도 보이는 것이니 숫자 그대로.
-- 화면만 가리면 서버에 직접 물어 숫자를 볼 수 있으므로 서버에서 거른다.
-- 예전 work_stage_stats는 반환 모양이 달라(바꾸려면 지워야 함) 새 함수를 만들고, 예전 것은 실행 권한만 회수한다.

create or replace function public.work_public_stats()
returns table (work_id uuid, show_count int, troupe_count int, few boolean, first_year int, last_year int, wish_count int)
language sql stable security definer set search_path = public as $$
  with s as (
    select work_id, count(*)::int n, count(distinct troupe_id)::int t,
           min(extract(year from show_date))::int y0, max(extract(year from show_date))::int y1,
           bool_or(not (coalesce(is_licensed, '') in ('창작', '완료'))) has_np
    from shows where work_id is not null and not coalesce(is_hidden, false)
    group by work_id
  ), w as (
    select target_id, count(*)::int n from favorites
    where list_type = 'wishlist' and target_type = 'work' group by target_id
  ), ids as (
    select work_id id from s union select target_id from w
  )
  select ids.id,
         case when s.has_np and s.t < 3 then null else coalesce(s.n, 0) end,
         case when s.has_np and s.t < 3 then null else coalesce(s.t, 0) end,
         coalesce(s.has_np and s.t < 3, false),
         case when s.has_np and s.t < 3 then null else s.y0 end,
         case when s.has_np and s.t < 3 then null else s.y1 end,
         coalesce(w.n, 0)
  from ids left join s on s.work_id = ids.id left join w on w.target_id = ids.id
  where public.is_real_user()
$$;
revoke execute on function public.work_public_stats() from anon, public;
grant execute on function public.work_public_stats() to authenticated;

-- 정확한 숫자를 주던 예전 함수는 이제 아무도 못 부른다 (운영자 수요 보드는 demand_board로 정확한 숫자를 본다)
revoke execute on function public.work_stage_stats() from anon, public, authenticated;
