-- 프로젝트 제작 계기판 (site: assets/js/site/project-dashboard.js)
-- 1) 영역별 상태를 직접 정한 값(자동 판정을 덮어쓴다)과 메모
create table if not exists public.project_areas (
  project_id uuid not null references public.projects(id) on delete cascade,
  area_key text not null,
  status text check (status in ('done','doing','todo','off')),
  note text,
  updated_at timestamptz not null default now(),
  primary key (project_id, area_key)
);
alter table public.project_areas enable row level security;
drop policy if exists project_areas_select on public.project_areas;
create policy project_areas_select on public.project_areas for select using (is_project_participant(project_id));
drop policy if exists project_areas_write on public.project_areas;
create policy project_areas_write on public.project_areas for all using (is_project_admin(project_id)) with check (is_project_admin(project_id));

-- 2) 캐스팅 추천: 이 배역을 "해보고 싶어요"한, 사람 기록과 연결된 유저
create or replace function public.role_wishlist_people(p_role_ids uuid[])
returns table(role_id uuid, person_id uuid, nickname text)
language sql stable security definer set search_path to 'public' as $$
  select f.target_id, up.person_id, up.nickname
  from favorites f join user_profiles up on up.id = f.user_id
  where f.list_type = 'wishlist' and f.target_type = 'role'
    and f.target_id = any(p_role_ids) and up.person_id is not null;
$$;
grant execute on function public.role_wishlist_people(uuid[]) to authenticated;

-- 3) 금액 추천: 지출 분류별로 3개 이상 프로젝트의 기록이 모였을 때만 중앙값을 돌려준다 (개별 프로젝트는 드러나지 않음)
create or replace function public.budget_benchmarks()
returns table(category text, n_projects int, median_planned numeric, median_actual numeric)
language sql stable security definer set search_path to 'public' as $$
  with per as (
    select project_id, category, sum(planned_amount) as p, sum(actual_amount) as a
    from project_budget_items
    where item_type = 'expense' and category is not null
    group by project_id, category
  )
  select category, count(*)::int,
         percentile_cont(0.5) within group (order by p)::numeric,
         (percentile_cont(0.5) within group (order by a) filter (where a is not null))::numeric
  from per group by category having count(*) >= 3;
$$;
grant execute on function public.budget_benchmarks() to authenticated;
