-- 소품 큐시트 + 예산 고도화
-- 큐시트: 장면(project_scenes) × 소품(project_props) → 큐(project_prop_cues)
--   큐 한 줄 = "이 장면에서 이 소품이 누구에 의해 어디서 어떻게 들어와서, 무엇을 하고, 누가 어디로 어떻게 나가는지"
--   팀원 누구나(참여자) 읽고 쓴다 — 소품 담당이 관리자가 아닐 수 있어서.
-- 예산: 총 예산, 외부 시트 링크. 항목별 예상(planned_amount)·실제(actual_amount)는 이미 있다.

create table if not exists public.project_scenes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  order_num int not null default 0,
  label text not null check (char_length(label) <= 30),          -- "1막 3장", "M5 Upgrade"
  title text check (char_length(title) <= 60),
  created_at timestamptz not null default now()
);
create index if not exists project_scenes_project_idx on public.project_scenes(project_id, order_num);

create table if not exists public.project_props (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null check (char_length(name) <= 40),
  qty int not null default 1 check (qty between 1 and 999),
  preset text check (char_length(preset) <= 40),                 -- 공연 시작 전 놓는 곳
  owner text check (char_length(owner) <= 30),                   -- 준비·관리 담당
  status text not null default 'need' check (status in ('need','sourcing','ready')),
  note text check (char_length(note) <= 300),
  order_num int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists project_props_project_idx on public.project_props(project_id, order_num);

create table if not exists public.project_prop_cues (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  prop_id uuid not null references public.project_props(id) on delete cascade,
  scene_id uuid not null references public.project_scenes(id) on delete cascade,
  in_by text check (char_length(in_by) <= 30),       -- 들여오는 사람(배역/크루)
  in_from text check (char_length(in_from) <= 30),   -- 상수·하수·객석·무대 위(이미 있음)…
  in_how text check (char_length(in_how) <= 60),     -- 들고 등장·크루 세팅·전달받음…
  action text check (char_length(action) <= 200),    -- 무대 위에서 일어나는 일
  out_by text check (char_length(out_by) <= 30),
  out_to text check (char_length(out_to) <= 30),     -- 상수·하수·무대에 남김…
  out_how text check (char_length(out_how) <= 60),
  order_num int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists project_prop_cues_project_idx on public.project_prop_cues(project_id);

alter table public.project_scenes enable row level security;
alter table public.project_props enable row level security;
alter table public.project_prop_cues enable row level security;

do $$ declare t text; begin
  foreach t in array array['project_scenes','project_props','project_prop_cues'] loop
    execute format('drop policy if exists %I on public.%I', t||'_rw', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.is_project_participant(project_id)) with check (public.is_project_participant(project_id))', t||'_rw', t);
  end loop;
end $$;

alter table public.projects add column if not exists budget_total numeric check (budget_total is null or budget_total >= 0);
alter table public.projects add column if not exists budget_sheet_url text check (budget_sheet_url is null or budget_sheet_url ~ '^https?://');
alter table public.projects add column if not exists props_sheet_url text check (props_sheet_url is null or props_sheet_url ~ '^https?://');

-- 분류별 지출 비중(프로젝트마다 그 분류가 전체 지출에서 차지한 비율)의 중앙값. 3개 이상 프로젝트에 있는 분류만.
-- 예산 탭 "추천 분배"가 쓴다. 없으면 화면이 일반적인 소규모 공연 비율로 대신한다.
create or replace function public.budget_shares()
returns table(category text, n_projects int, median_share numeric)
language sql stable security definer set search_path to 'public' as $$
  with per as (
    select project_id, category, sum(coalesce(actual_amount, planned_amount)) as amt
    from project_budget_items
    where item_type = 'expense' and category is not null
    group by project_id, category
  ), tot as (
    select project_id, sum(amt) as t from per group by project_id having sum(amt) > 0
  )
  select per.category, count(*)::int,
         (percentile_cont(0.5) within group (order by per.amt / tot.t))::numeric
  from per join tot using (project_id)
  where per.amt > 0
  group by per.category having count(*) >= 3;
$$;
revoke all on function public.budget_shares() from public, anon;
grant execute on function public.budget_shares() to authenticated;
