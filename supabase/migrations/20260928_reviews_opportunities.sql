-- 둘러보기 개편: 후기(좋았던 점 키워드 + 짧은 글), 기회(모집 중인 자리) 목록, 내 지원 현황
-- 후기는 공연·작품·극장·단체에만 (사람에게는 받지 않는다). 한 사람이 한 대상에 하나.
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('show','work','venue','troupe')),
  target_id uuid not null,
  keywords text[] not null default '{}',
  body text check (body is null or char_length(body) <= 400),
  watched_on date,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, target_type, target_id)
);
alter table public.reviews enable row level security;
drop policy if exists reviews_select on public.reviews;
create policy reviews_select on public.reviews for select using (auth.role() = 'authenticated' and (not is_hidden or user_id = auth.uid() or is_admin()));
drop policy if exists reviews_insert on public.reviews;
create policy reviews_insert on public.reviews for insert with check (user_id = auth.uid());
drop policy if exists reviews_update on public.reviews;
create policy reviews_update on public.reviews for update using (user_id = auth.uid() or is_admin());
drop policy if exists reviews_delete on public.reviews;
create policy reviews_delete on public.reviews for delete using (user_id = auth.uid() or is_admin());

create table if not exists public.review_reports (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  reason text,
  status text not null default 'pending' check (status in ('pending','done')),
  created_at timestamptz not null default now(),
  unique (review_id, user_id)
);
alter table public.review_reports enable row level security;
drop policy if exists review_reports_insert on public.review_reports;
create policy review_reports_insert on public.review_reports for insert with check (user_id = auth.uid());
drop policy if exists review_reports_admin on public.review_reports;
create policy review_reports_admin on public.review_reports for all using (is_admin()) with check (is_admin());

-- 대상의 후기 목록 (닉네임과 함께)
create or replace function public.list_reviews(p_type text, p_id uuid)
returns table(id uuid, keywords text[], body text, watched_on date, created_at timestamptz, nickname text, avatar_emoji text, is_mine boolean)
language sql stable security definer set search_path to 'public' as $$
  select r.id, r.keywords, r.body, r.watched_on, r.created_at, coalesce(up.nickname, '오리 관객'), up.avatar_emoji, r.user_id = auth.uid()
  from reviews r left join user_profiles up on up.id = r.user_id
  where r.target_type = p_type and r.target_id = p_id and not r.is_hidden and auth.role() = 'authenticated'
  order by (r.user_id = auth.uid()) desc, r.created_at desc;
$$;
grant execute on function public.list_reviews(text, uuid) to authenticated;

-- 내 기록 (관극 기록·남긴 후기)
create or replace function public.my_reviews()
returns table(id uuid, target_type text, target_id uuid, keywords text[], body text, watched_on date, created_at timestamptz)
language sql stable security definer set search_path to 'public' as $$
  select id, target_type, target_id, keywords, body, watched_on, created_at from reviews where user_id = auth.uid()
  order by coalesce(watched_on, created_at::date) desc;
$$;
grant execute on function public.my_reviews() to authenticated;

-- 기회: 모집 중인 자리 + 프로젝트 정보 + 내가 이미 지원했는지
create or replace function public.list_opportunities()
returns table(position_id uuid, position_type text, position_label text, role_id uuid, staff_role_id uuid, created_at timestamptz,
  project_id uuid, project_title text, work_id uuid, troupe_id uuid, venue_id uuid, target_start_date date, my_status text)
language sql stable security definer set search_path to 'public' as $$
  select pp.id, pp.position_type, pp.position_label, pp.role_id, pp.staff_role_id, pp.created_at,
         pr.id, pr.title, pr.work_id, pr.troupe_id, pr.venue_id, pr.target_start_date,
         (select jr.status from project_join_requests jr where jr.position_id = pp.id and jr.user_id = auth.uid() order by jr.created_at desc limit 1)
  from projects pr join project_positions pp on pp.project_id = pr.id
  where pr.is_recruiting and pp.status = 'open' and pp.assigned_member_id is null
    and pr.status in ('planning','upcoming') and auth.role() = 'authenticated'
  order by pp.created_at desc;
$$;
grant execute on function public.list_opportunities() to authenticated;

-- 내 지원 현황
create or replace function public.my_join_requests()
returns table(id uuid, project_id uuid, project_title text, position_label text, status text, created_at timestamptz, reviewed_at timestamptz)
language sql stable security definer set search_path to 'public' as $$
  select jr.id, jr.project_id, pr.title, pp.position_label, jr.status, jr.created_at, jr.reviewed_at
  from project_join_requests jr join projects pr on pr.id = jr.project_id left join project_positions pp on pp.id = jr.position_id
  where jr.user_id = auth.uid() order by jr.created_at desc;
$$;
grant execute on function public.my_join_requests() to authenticated;
