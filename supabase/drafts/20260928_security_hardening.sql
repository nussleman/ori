-- ⚠️ 초안: 아직 DB에 적용하지 않음. 적용 전 롤백 테스트(supabase/drafts 안 설명) 후 apply_migration으로 반영.
-- 오리 보안 정리 (2026-09-28)
-- 1) 익명 세션 차단  2) 자기 권한 올리기 차단  3) 프로젝트 역할 분리  4) 아무나 쓰던 테이블 잠금  5) 사진 삭제 제한

-- ── 0. "진짜 로그인한 사람" 판별 (익명 세션은 auth.role()이 authenticated라 따로 걸러야 한다)
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
  loop
    execute format('alter policy %I on public.%I using (public.is_real_user())', r.policyname, r.tablename);
  end loop;
end $$;

-- 같은 조건을 쓰던 조회 함수들도 교체
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

-- ── 2. 자기 프로필로 관리자 되기 / 남의 사람 기록 연결 차단: 고칠 수 있는 칸만 허용
revoke update on public.user_profiles from anon, authenticated;
grant update (nickname, intro, contact, avatar_emoji, preferred_roles) on public.user_profiles to authenticated;

-- ── 3. 단체 관리자 셀프 등록 차단 (신청은 request_troupe_link 함수로만, 승인은 관리자)
drop policy if exists troupe_members_insert_own on public.troupe_members;

-- ── 4. 프로젝트 역할 분리
--   소유자·관리자: 프로젝트 정보, 자리(포지션), 참여 요청 처리, 예산
--   멤버: 홍보 문구·링크, 극장 후보 담기
--   멤버 추가·역할 변경은 함수(create_new_project / approve_join_request / set_member_admin)로만
drop policy if exists project_members_insert_participant on public.project_members;
drop policy if exists project_members_update_participant on public.project_members;
drop policy if exists project_members_delete_participant on public.project_members;

alter policy project_positions_insert_participant on public.project_positions with check (public.is_project_admin(project_id));
alter policy project_positions_update_participant on public.project_positions using (public.is_project_admin(project_id));
alter policy project_positions_delete_participant on public.project_positions using (public.is_project_admin(project_id));

alter policy join_requests_update_participant on public.project_join_requests using (public.is_project_admin(project_id));
alter policy join_requests_insert_own on public.project_join_requests with check (user_id = auth.uid() and public.is_real_user());

alter policy projects_select_public on public.projects using (is_public = true and public.is_real_user());
alter policy projects_insert_owner on public.projects with check (owner_id = auth.uid() and public.is_real_user());

-- 멤버는 홍보 칸만, 소유자 변경은 사이트 관리자만
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
drop trigger if exists projects_guard_update on public.projects;
create trigger projects_guard_update before update on public.projects
  for each row execute function public.projects_guard_update();

-- 자리 모집 열기/닫기, 작품 배역 채우기, 극장 확정은 관리자만
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

-- ── 5. 누구나 쓰던 테이블 → 사이트 관리자만 (조회는 그대로)
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

-- ── 6. 사진: 올리기는 진짜 로그인만, 지우기는 올린 본인 또는 관리자만
alter policy "인증된 사용자만 업로드" on storage.objects with check (bucket_id = 'photos' and public.is_real_user());
alter policy "인증된 사용자만 삭제" on storage.objects using (bucket_id = 'photos' and (owner_id = auth.uid()::text or public.is_admin()));

-- ── 7. 로그인 없이(anon) 부를 필요가 없는 함수 실행 권한 회수
--   RLS 정책 안에서 쓰는 판별 함수(is_*)는 남겨둔다 — 회수하면 정책 평가 자체가 오류가 난다.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
      and p.proname not in ('is_admin','is_project_admin','is_project_participant','is_troupe_admin','is_real_user')
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')  -- pg_trgm 같은 확장 함수는 건드리지 않음
  loop
    execute format('revoke execute on function %s from anon, public', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end $$;
revoke execute on function public.handle_new_user() from authenticated;
revoke execute on function public.projects_guard_update() from authenticated;
