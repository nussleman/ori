-- 프로젝트 상자 보드 배치 (2026-10-24): 사람마다·프로젝트마다 상자 순서(드래그)와 숨긴 상자(상자 고르기)를 기억한다.
-- 본인 줄만 읽고 쓴다. 프로젝트가 지워지면 같이 지워진다.
create table if not exists public.project_board_layouts (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  box_order text[] not null default '{}',
  hidden text[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (project_id, user_id)
);
alter table public.project_board_layouts enable row level security;
create policy board_layout_own on public.project_board_layouts for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.project_board_layouts from anon;
grant select, insert, update, delete on public.project_board_layouts to authenticated;
