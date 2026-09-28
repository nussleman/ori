-- 공연 프로젝트: 일정 + 공지 (2026-09-28)
-- 팀원(참여자)은 보기만, 프로젝트 관리자(소유자·관리자)만 쓰기

create table if not exists public.project_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  kind text not null default 'rehearsal' check (kind in ('rehearsal','performance','meeting','deadline','etc')),
  title text not null check (char_length(title) between 1 and 120),
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text check (location is null or char_length(location) <= 200),
  note text check (note is null or char_length(note) <= 2000),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at)
);
create index if not exists project_events_project_time on public.project_events (project_id, starts_at);

create table if not exists public.project_notices (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  pinned boolean not null default false,
  author_name text check (author_name is null or char_length(author_name) <= 60),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists project_notices_project_time on public.project_notices (project_id, created_at desc);

alter table public.project_events enable row level security;
alter table public.project_notices enable row level security;

create policy project_events_select on public.project_events for select using (public.is_project_participant(project_id));
create policy project_events_insert on public.project_events for insert with check (public.is_project_admin(project_id));
create policy project_events_update on public.project_events for update using (public.is_project_admin(project_id)) with check (public.is_project_admin(project_id));
create policy project_events_delete on public.project_events for delete using (public.is_project_admin(project_id));

create policy project_notices_select on public.project_notices for select using (public.is_project_participant(project_id));
create policy project_notices_insert on public.project_notices for insert with check (public.is_project_admin(project_id));
create policy project_notices_update on public.project_notices for update using (public.is_project_admin(project_id)) with check (public.is_project_admin(project_id));
create policy project_notices_delete on public.project_notices for delete using (public.is_project_admin(project_id));

revoke all on public.project_events, public.project_notices from anon;
