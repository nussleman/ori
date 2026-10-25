-- 10/25 보드 검토 수정
-- 1) 오디션에서 직접 추가한 지원자(오리 계정 없음)를 합격시키면 자리가 이름으로 채워진다
alter table public.project_positions
  add column if not exists assigned_name text
  check (assigned_name is null or char_length(assigned_name) between 1 and 80);

-- 2) 팀 연락망: 팀원이 자기 연락처·비상 연락처를 적는다. 같은 프로젝트 구성원만 본다 (밖으로는 안 나감)
create table if not exists public.project_member_contacts (
  member_id uuid primary key references public.project_members(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  phone text check (phone is null or char_length(phone) <= 40),
  emergency text check (emergency is null or char_length(emergency) <= 120),
  updated_at timestamptz not null default now()
);
create index if not exists project_member_contacts_project on public.project_member_contacts (project_id);
alter table public.project_member_contacts enable row level security;

create policy project_member_contacts_select on public.project_member_contacts
  for select using (public.is_project_participant(project_id));
create policy project_member_contacts_insert on public.project_member_contacts
  for insert with check (exists (select 1 from public.project_members m
    where m.id = member_id and m.project_id = project_member_contacts.project_id and m.user_id = auth.uid()));
create policy project_member_contacts_update on public.project_member_contacts
  for update using (exists (select 1 from public.project_members m
    where m.id = member_id and m.project_id = project_member_contacts.project_id and m.user_id = auth.uid()))
  with check (exists (select 1 from public.project_members m
    where m.id = member_id and m.project_id = project_member_contacts.project_id and m.user_id = auth.uid()));
create policy project_member_contacts_delete on public.project_member_contacts
  for delete using (exists (select 1 from public.project_members m
    where m.id = member_id and m.user_id = auth.uid()));
