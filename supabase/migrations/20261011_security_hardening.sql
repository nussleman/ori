-- 오리 보안 정리 (2026-10-11 적용, 초안: supabase/drafts/20260928_security_hardening.sql)
-- 9/28 초안을 지금 DB에 맞춰 다시 쓰고, 미확보 공연 비공개를 더했다.
-- 규칙을 지우지 않고 "아무도 통과 못 함(false)"으로 바꿔 끈다 (지우는 명령은 MCP가 승인을 기다리며 멈추기 때문).
--  0) 진짜 로그인 판별  1) 아카이브 조회는 진짜 로그인만  2) 미확보 공연은 관계자만
--  3) 자기 권한 올리기 차단  4) 단체 관리자 셀프 등록 차단  5) 프로젝트 역할 분리
--  6) 아무나 쓰던 표 잠금  7) 사진 지우기 제한  8) 로그인 안 한 사람의 함수 실행 회수
-- (익명 계정 정리는 20261011_remove_anonymous_users.sql 따로)

-- ── 0. "진짜 로그인한 사람" (익명 세션도 auth.role()은 authenticated라 따로 걸러야 한다)
create or replace function public.is_real_user() returns boolean
language sql stable set search_path = public as $$
  select auth.uid() is not null
     and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
$$;

-- ── 1. 아카이브 조회: authenticated → 진짜 로그인만
do $$
declare r record;
begin
  for r in
    select tablename, policyname from pg_policies
    where schemaname = 'public' and cmd = 'SELECT' and qual = '(auth.role() = ''authenticated''::text)'
      and tablename <> 'shows'   -- 공연은 아래 2번에서 따로
  loop
    execute format('alter policy %I on public.%I using (public.is_real_user())', r.policyname, r.tablename);
  end loop;
end $$;
alter policy reviews_select on public.reviews
  using (public.is_real_user() and ((not is_hidden) or user_id = auth.uid() or public.is_admin()));

do $$
declare f record; def text;
begin
  for f in
    select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('browse_recruiting_positions','get_person_intro','list_public_projects','list_wishlist_interest')
  loop
    def := pg_get_functiondef(f.oid);
    def := replace(def, 'auth.role() = ''authenticated''', 'public.is_real_user()');
    execute def;
  end loop;
end $$;

-- ── 2. 미확보 공연은 개별로 공개하지 않는다 (direction.md)
-- 예전엔 로그인한 누구나 모든 공연과 내부용 is_licensed('미확보' 등)를 읽을 수 있었다.
-- 이제 공개 공연(창작·완료)만 모두가 보고, 그 밖의 공연은 관계자만: 운영자, 그 공연 단체의 관리자,
-- 그 공연에 이력이 있는 본인, 그 공연을 발행한 프로젝트의 구성원.
create or replace function public.can_see_show(p_show_id uuid, p_troupe_id uuid, p_is_licensed text, p_is_hidden boolean)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_real_user() and (
    (p_is_licensed in ('창작', '완료') and not coalesce(p_is_hidden, false))
    or public.is_admin()
    or (p_troupe_id is not null and public.is_troupe_admin(p_troupe_id))
    or exists (select 1 from participation_history ph join user_profiles up on up.person_id = ph.person_id
               where ph.show_id = p_show_id and up.id = auth.uid())
    or exists (select 1 from projects pr where pr.published_show_id = p_show_id and public.is_project_participant(pr.id))
  )
$$;
alter policy authenticated_select on public.shows using (public.can_see_show(id, troupe_id, is_licensed, is_hidden));

-- ── 3. 자기 프로필로 관리자 되기 / 남의 사람 기록 연결 차단: 고칠 수 있는 칸만
revoke update on public.user_profiles from anon, authenticated;
grant update (nickname, intro, contact, avatar_emoji, preferred_roles) on public.user_profiles to authenticated;

-- ── 4. 단체 관리자 셀프 등록 차단 (신청은 request_troupe_link 함수로만, 승인은 운영자)
alter policy troupe_members_insert_own on public.troupe_members with check (false);

-- ── 5. 프로젝트 역할 분리
--   소유자·관리자: 프로젝트 정보, 자리, 참여 요청 처리, 예산 / 멤버: 홍보 문구·링크, 극장 후보 담기
--   멤버 추가·역할 변경은 함수(create_new_project / approve_join_request / set_member_admin)로만
alter policy project_members_insert_participant on public.project_members with check (false);
alter policy project_members_update_participant on public.project_members using (false);
alter policy project_members_delete_participant on public.project_members using (false);

alter policy project_positions_insert_participant on public.project_positions with check (public.is_project_admin(project_id));
alter policy project_positions_update_participant on public.project_positions using (public.is_project_admin(project_id));
alter policy project_positions_delete_participant on public.project_positions using (public.is_project_admin(project_id));

alter policy join_requests_update_participant on public.project_join_requests using (public.is_project_admin(project_id));
alter policy join_requests_insert_own on public.project_join_requests with check (user_id = auth.uid() and public.is_real_user());

alter policy projects_select_public on public.projects using (is_public = true and public.is_real_user());
alter policy projects_insert_owner on public.projects with check (owner_id = auth.uid() and public.is_real_user());

create or replace function public.projects_guard_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() then return new; end if;
  if new.owner_id is distinct from old.owner_id then
    raise exception '프로젝트 소유자는 바꿀 수 없어요';
  end if;
  if not public.is_project_admin(old.id)
     and (to_jsonb(new) - 'promo_note' - 'promo_links' - 'updated_at')
         is distinct from (to_jsonb(old) - 'promo_note' - 'promo_links' - 'updated_at') then
    raise exception '프로젝트 관리자만 바꿀 수 있어요';
  end if;
  return new;
end $$;
create or replace trigger projects_guard_update before update on public.projects
  for each row execute function public.projects_guard_update();

do $$
declare f record; def text;
begin
  for f in
    select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('set_position_recruiting','populate_work_roles','select_project_venue')
  loop
    def := pg_get_functiondef(f.oid);
    def := replace(def, 'is_project_participant(', 'is_project_admin(');
    execute def;
  end loop;
end $$;

-- ── 6. 아무나 쓰던 표 → 운영자만 (조회는 그대로)
do $$
declare r record;
begin
  for r in
    select tablename, policyname, cmd from pg_policies
    where schemaname = 'public'
      and tablename in ('app_settings','creation_history','creation_types','tags','work_tags')
      and cmd in ('INSERT','UPDATE','DELETE')
  loop
    if r.cmd = 'INSERT' then
      execute format('alter policy %I on public.%I with check (public.is_admin())', r.policyname, r.tablename);
    elsif r.cmd = 'UPDATE' then
      execute format('alter policy %I on public.%I using (public.is_admin()) with check (public.is_admin())', r.policyname, r.tablename);
    else
      execute format('alter policy %I on public.%I using (public.is_admin())', r.policyname, r.tablename);
    end if;
  end loop;
end $$;

-- ── 7. 사진: 올리기는 진짜 로그인만, 지우기는 올린 본인 또는 운영자만
alter policy "인증된 사용자만 업로드" on storage.objects with check (bucket_id = 'photos' and public.is_real_user());
alter policy "인증된 사용자만 삭제" on storage.objects using (bucket_id = 'photos' and (owner_id = auth.uid()::text or public.is_admin()));

-- ── 8. 로그인 없이(anon) 부를 필요가 없는 함수 실행 권한 회수
--   RLS 정책 안에서 쓰는 판별 함수(is_*·can_see_show)는 남긴다 — 회수하면 정책 평가가 오류 난다.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
      and p.proname not in ('is_admin','is_project_admin','is_project_participant','is_troupe_admin','is_real_user','can_see_show')
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
      and p.prorettype <> 'trigger'::regtype
  loop
    execute format('revoke execute on function %s from anon, public', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end $$;
revoke execute on function public.handle_new_user() from anon, public, authenticated;
revoke execute on function public.projects_guard_update() from anon, public, authenticated;
