-- 오디션 일정·평가 (2026-10-24): 오디션·캐스팅 상자 안
-- 시간표(audition_slots) · 지원자(audition_candidates: 기회 지원에서 불러오거나 직접 추가) · 평가(audition_scores: 평가자마다 1~5점 + 메모 + 추천)
-- 점수·메모는 프로젝트 관리자만 본다. 지원자는 자기 시간·장소·결과만 (my_auditions).
create table if not exists public.audition_slots (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  starts_at timestamptz not null,
  minutes int not null default 10 check (minutes between 1 and 240),
  location text check (location is null or char_length(location) <= 200),
  created_at timestamptz not null default now()
);
create index if not exists audition_slots_project on public.audition_slots (project_id, starts_at);
create table if not exists public.audition_candidates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  join_request_id uuid unique references public.project_join_requests(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  name text not null check (char_length(name) between 1 and 80),
  position_id uuid references public.project_positions(id) on delete set null,
  contact text check (contact is null or char_length(contact) <= 200),
  slot_id uuid references public.audition_slots(id) on delete set null,
  status text not null default 'applied' check (status in ('applied','callback','passed','held','failed')),
  note text check (note is null or char_length(note) <= 1000),
  created_at timestamptz not null default now()
);
create index if not exists audition_candidates_project on public.audition_candidates (project_id);
create table if not exists public.audition_scores (
  candidate_id uuid not null references public.audition_candidates(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  acting int check (acting between 1 and 5),
  singing int check (singing between 1 and 5),
  movement int check (movement between 1 and 5),
  fit int check (fit between 1 and 5),
  recommend text check (recommend is null or recommend in ('pass','callback','hold','fail')),
  memo text check (memo is null or char_length(memo) <= 1000),
  updated_at timestamptz not null default now(),
  primary key (candidate_id, user_id)
);
alter table public.audition_slots enable row level security;
alter table public.audition_candidates enable row level security;
alter table public.audition_scores enable row level security;
create policy aud_slots_select on public.audition_slots for select to authenticated using (is_project_participant(project_id));
create policy aud_slots_write on public.audition_slots for all to authenticated using (is_project_admin(project_id)) with check (is_project_admin(project_id));
create policy aud_cand_all on public.audition_candidates for all to authenticated using (is_project_admin(project_id)) with check (is_project_admin(project_id));
create policy aud_scores_select on public.audition_scores for select to authenticated
  using (exists (select 1 from audition_candidates c where c.id = candidate_id and is_project_admin(c.project_id)));
create policy aud_scores_write on public.audition_scores for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (select 1 from audition_candidates c where c.id = candidate_id and is_project_admin(c.project_id)));
revoke all on public.audition_slots, public.audition_candidates, public.audition_scores from anon;
grant select, insert, update, delete on public.audition_slots, public.audition_candidates, public.audition_scores to authenticated;

-- 기회에서 들어온 지원(기다리는 중)을 지원자로 불러오기. 이미 불러온 건 건너뛴다
create or replace function public.audition_import_requests(p_project_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not is_project_admin(p_project_id) then raise exception '프로젝트 관리자만 할 수 있어요'; end if;
  insert into audition_candidates (project_id, join_request_id, user_id, name, position_id, note)
  select jr.project_id, jr.id, jr.user_id,
         coalesce(nullif(up.nickname, ''), split_part(au.email, '@', 1), '지원자'), jr.position_id, jr.message
  from project_join_requests jr
  left join user_profiles up on up.id = jr.user_id
  left join auth.users au on au.id = jr.user_id
  where jr.project_id = p_project_id and jr.status = 'pending' and jr.invited_by is null
    and not exists (select 1 from audition_candidates c where c.join_request_id = jr.id);
  get diagnostics n = row_count;
  return n;
end $$;

-- 지원자 본인: 내 오디션 시간·장소·결과 (점수·메모는 주지 않는다)
create or replace function public.my_auditions()
returns table (join_request_id uuid, project_id uuid, project_title text, starts_at timestamptz, minutes int, location text, status text)
language sql stable security definer set search_path = public as $$
  select c.join_request_id, c.project_id, p.title, s.starts_at, s.minutes, s.location, c.status
  from audition_candidates c join projects p on p.id = c.project_id
  left join audition_slots s on s.id = c.slot_id
  where c.user_id = auth.uid()
$$;
revoke execute on function public.audition_import_requests(uuid), public.my_auditions() from anon, public;
grant execute on function public.audition_import_requests(uuid), public.my_auditions() to authenticated;
