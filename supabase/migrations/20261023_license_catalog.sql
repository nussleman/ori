-- 라이선스 메뉴 (2026-10-23): 오리가 관리하는 라이선스 목록
-- 권리 정보(유형·권리자·아마추어 라이선스·확인일)는 운영자가 "권리 정보 공개"를 켠 작품만 내보낸다 (work_hub와 같은 기준).
-- 공개 안 된 작품은 "확인 중"으로만, 숫자는 앞으로의 수요(올리고 싶어요·정식 신청)만 — 지난 공연 집계는 work_public_stats가 따로 거른다.
create or replace function public.license_catalog()
returns table (work_id uuid, rights_public boolean, rights_type text, holder text, amateur text, verified_at date,
               wish_count int, request_count int)
language sql stable security definer set search_path = public as $$
  select w.id, coalesce(w.rights_is_public, false),
         case when w.rights_is_public then w.rights_type end,
         case when w.rights_is_public then w.rights_holder_display end,
         case when w.rights_is_public then w.amateur_license_status end,
         case when w.rights_is_public then w.rights_verified_at::date end,
         (select count(*)::int from favorites f where f.list_type = 'wishlist' and f.target_type = 'work' and f.target_id = w.id),
         (select count(*)::int from license_demands ld where ld.work_id = w.id)
  from works w
  where public.is_real_user()
$$;
revoke execute on function public.license_catalog() from anon, public;
grant execute on function public.license_catalog() to authenticated;
