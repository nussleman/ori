-- 예전 어드민 익명 로그인이 남긴 익명 계정 정리 (2026-10-11, 보안 정리와 함께 태준님 승인)
-- 익명 계정은 이제 아무것도 읽을 수 없고(is_real_user), 남은 4개는 테스트 흔적(즐겨찾기 4개뿐).
-- 딸린 프로필·즐겨찾기 등은 auth.users 삭제 시 함께 지워진다(on delete cascade).
-- 새 익명 로그인 자체를 막는 건 Supabase 대시보드 설정(Authentication → Sign In / Providers → Anonymous)에서 끈다.
delete from auth.users where is_anonymous;
