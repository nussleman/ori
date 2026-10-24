-- 프로젝트 운영 보강 (2026-10-24, 검토 결과 1·2·3·4번): 할 일 · 연습 출결 · 바깥 도구 연결 · 회고 · 기록 보강
-- 권한은 기존 프로젝트 표와 같게: 프로젝트 참여자(is_project_participant)가 읽고 쓰고, 지우기는 만든 사람이나 프로젝트 관리자

-- 1) 할 일: 누가·언제까지·어느 상자(영역)
create table if not exists public.project_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  box_key text,
  assignee_member_id uuid references public.project_members(id) on delete set null,
  due_date date,
  done boolean not null default false,
  done_at timestamptz,
  order_num int not null default 0,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists project_tasks_project on public.project_tasks (project_id, done, due_date);
alter table public.project_tasks enable row level security;
create policy project_tasks_select on public.project_tasks for select to authenticated using (is_project_participant(project_id));
create policy project_tasks_insert on public.project_tasks for insert to authenticated with check (is_project_participant(project_id));
create policy project_tasks_update on public.project_tasks for update to authenticated using (is_project_participant(project_id)) with check (is_project_participant(project_id));
create policy project_tasks_delete on public.project_tasks for delete to authenticated using (created_by = auth.uid() or is_project_admin(project_id));

-- 2) 연습 출결: 일정마다 온다·못 온다·아직 모름
create table if not exists public.project_event_rsvps (
  event_id uuid not null references public.project_events(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  status text not null check (status in ('yes','no','maybe')),
  note text check (note is null or char_length(note) <= 200),
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
alter table public.project_event_rsvps enable row level security;
create policy rsvps_select on public.project_event_rsvps for select to authenticated
  using (exists (select 1 from project_events e where e.id = event_id and is_project_participant(e.project_id)));
create policy rsvps_write on public.project_event_rsvps for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (select 1 from project_events e where e.id = event_id and is_project_participant(e.project_id)));

-- 3) 바깥 도구 연결: 상자마다 구글 시트·드라이브·큐랩 파일·노션·단톡방·예매처 링크
create table if not exists public.project_links (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  box_key text not null,
  kind text not null default 'link',
  label text check (label is null or char_length(label) <= 80),
  url text not null check (url ~* '^https?://' and char_length(url) <= 2000),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists project_links_project on public.project_links (project_id, box_key);
alter table public.project_links enable row level security;
create policy project_links_select on public.project_links for select to authenticated using (is_project_participant(project_id));
create policy project_links_insert on public.project_links for insert to authenticated with check (is_project_participant(project_id));
create policy project_links_delete on public.project_links for delete to authenticated using (created_by = auth.uid() or is_project_admin(project_id));

-- 4) 회고: 잘된 것 · 아쉬운 것 · 다음엔
create table if not exists public.project_retro_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  kind text not null check (kind in ('good','bad','next')),
  body text not null check (char_length(body) between 1 and 1000),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.project_retro_items enable row level security;
create policy retro_select on public.project_retro_items for select to authenticated using (is_project_participant(project_id));
create policy retro_insert on public.project_retro_items for insert to authenticated with check (user_id = auth.uid() and is_project_participant(project_id));
create policy retro_delete on public.project_retro_items for delete to authenticated using (user_id = auth.uid() or is_project_admin(project_id));

revoke all on public.project_tasks, public.project_event_rsvps, public.project_links, public.project_retro_items from anon;
grant select, insert, update, delete on public.project_tasks, public.project_event_rsvps to authenticated;
grant select, insert, delete on public.project_links, public.project_retro_items to authenticated;

-- 5) 기록 보강: 관객 수·회차·티켓·출연료를 프로젝트에 적고, 공연 기록(아카이브)으로 넘긴다
alter table public.projects add column if not exists audience_count int check (audience_count is null or audience_count >= 0);
alter table public.projects add column if not exists performance_count int check (performance_count is null or performance_count > 0);
alter table public.projects add column if not exists ticket_type text check (ticket_type is null or ticket_type in ('유료','무료'));
alter table public.projects add column if not exists performers_paid boolean;

create or replace function public.publish_project_as_show(p_project_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_project record; v_show_id uuid;
begin
  select * into v_project from projects where id = p_project_id;
  if v_project is null then raise exception '프로젝트를 찾을 수 없어요'; end if;
  if not is_project_admin(p_project_id) then raise exception '권한이 없어요'; end if;
  v_show_id := v_project.published_show_id;
  if v_show_id is null then
    insert into shows (title, show_date, end_date, troupe_id, venue_id, work_id, is_licensed, record_status,
                       ticket_type, performers_paid, performance_count, audience_count)
    values (v_project.title, v_project.target_start_date, v_project.target_end_date, v_project.troupe_id,
            v_project.venue_id, v_project.work_id, v_project.is_licensed,
            case when v_project.troupe_id is not null then '단체 확인' else '미확인' end,
            v_project.ticket_type, v_project.performers_paid, v_project.performance_count, v_project.audience_count)
    returning id into v_show_id;
    update projects set published_show_id = v_show_id where id = p_project_id;
  else
    -- 이미 올라간 공연이면 프로젝트에서 새로 적은 조건·관객 수를 채운다 (비어 있는 값으로 덮지 않음)
    update shows set ticket_type = coalesce(v_project.ticket_type, ticket_type),
                     performers_paid = coalesce(v_project.performers_paid, performers_paid),
                     performance_count = coalesce(v_project.performance_count, performance_count),
                     audience_count = coalesce(v_project.audience_count, audience_count)
     where id = v_show_id;
  end if;
  perform public.project_show_sync(p_project_id);
  return v_show_id;
end $$;
