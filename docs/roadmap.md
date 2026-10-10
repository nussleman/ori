# 오리 피벗 로드맵 (2026-10-10~)

방향은 [direction.md](direction.md). 태준님 방침: Claude가 바로 할 수 있는 것부터 진행하고, 태준님이 해야 하는데 넘어간 건 아래 "태준님 할 일"에 남긴다.

## 0. 방향 확정 — ✅ 완료
- direction.md 개정, "아마추어 공연 숨김" 결정 폐기

## 1. 기반 정리 (오픈 전 필수)
- ⏸ **보안 강화** — `supabase/drafts/20260928_security_hardening.sql` 초안 그대로. 10/10 적용 승인 창에서 태준님이 취소 → 나중에 하기로 함. 함께: 남은 익명 세션 4개 삭제
- ✅ 공연 조건 필드: `shows.ticket_type`(유료/무료), `performers_paid`, `performance_count`, `record_status`(미확인/단체 확인/권리 확인) — `supabase/migrations/20261010_show_conditions.sql`. 어드민 입력칸 + "조건 미기록" 필터, 사이트 공연 상세 "조건"·"기록" 줄
- ✅ 약관·개인정보처리방침 개정 (core.js `goTerms`/`goPrivacy`)
- ⬜ 라이선스와 공개 여부 분리 — 지금은 사이트가 `is_licensed in (창작, 완료) && !is_hidden`만 보여줌 (core.js `load()` 안 필터). 3단계 작품 집계 공개 때 함께 정리

## 2. 입력 구조
- ✅ **단체가 직접 공연 기록** — 마이페이지 → 내 단체 → 관리 화면의 "우리 공연 기록" (`assets/js/site/troupe-shows.js`).
  - 서버 함수 `troupe_save_show`, `troupe_add_cast`, `can_manage_troupe` — `supabase/migrations/20261010_troupe_show_entry.sql`
  - 필수: 공연명·첫 공연일. 작품·극장은 이름으로 찾고 없으면 생성. 출연진은 "구분: 이름, 이름" 줄 붙여넣기 (탭 허용). 구분이 작품 배역이면 배우, 스태프 역할이면 스태프. 동명 1명이면 연결, 아니면 새 사람
  - 단체가 남긴 기록과 프로젝트로 발행된 공연(`publish_project_as_show`)은 `record_status='단체 확인'`
- ⬜ **다음 작업: 배우·스태프가 "내 이력" 직접 추가 → 단체가 확인** (아래 "다음 작업 메모")
- ⬜ 수정 요청(edit_requests)을 운영자뿐 아니라 그 기록의 주인(단체)에게도 보이기
- ✅(기존) 프로젝트가 "공연 예정"이 되면 공연 기록 자동 발행 (`project.js` `updateProjectStatus`)

## 3. 작품 페이지 허브 + 공개 기준
- 권리 정보, 공개된 공연 기록, **미확보 공연은 "단체 N곳이 이 작품을 올렸어요" 집계로만**
- "이 작품 올리고 싶어요"(favorites의 wishlist = 수요 데이터), 라이선스 문의(license_inquiries)
- 배역 수·해본 극장·비용 감, "이 작품으로 프로젝트 시작하기"

## 4. 입구 재구성 + 비로그인 공개 — ⚠️ 보안 강화·법률 상담 먼저
- 로그인 없이 둘러보기 (RLS anon 조회 허용, 개인정보 노출 범위 점검)
- 첫 화면: 만드는 사람에게 거는 한 문장 + 작품 찾기 + 내 공연 시작하기
- 만들기 모드를 프로필 메뉴에 숨기지 않고 첫 화면·작품 페이지에서 진입
- 선언 의식(account.js `playOathRitual`)·프로필 연결 팝업은 첫 프로젝트 생성/합류 때 한 번

## 5. 관계 강화
- 모집 공고에 단체 지난 공연 자동 첨부, 지원 → 합류 → 공연 후 이력 확인 한 흐름, 사람 이력 공유 링크

## 계속 병행
- 태준님 공연 하나를 오리로 실제 운영, 단체 3곳, 대표 5명 인터뷰
- 데이터: 작품 권리 분류 66건, 라이선스 미상 공연 81건, 공연 조건 (단체가 직접 채우는 걸 우선, 태준님은 직접 아는 공연만)
- 권리자 영업 자료: 작품별 아마추어 공연 집계 → 첫 수동 라이선스 딜

---

## 태준님 할 일 (미뤄둔 것 — 관련 작업에 닿으면 먼저 꺼낼 것)
- [ ] 보안 강화 적용 승인 (나중에)
- [ ] Supabase 대시보드에서 익명 로그인 끄기 (나중에)
- [ ] Supabase 유료 플랜 전환 (나중에 하기로 결정. 무료 플랜이라 10/10에 DB가 자동 정지돼 있었음)
- [ ] 비로그인 공개 전 법률 상담 1회 (하기로 함, 한국저작권위원회 무료 상담)
- [ ] 낙타 공연으로 "우리 공연 기록" 직접 써보고 피드백

## 알려진 위험·메모
- 공연 테이블 RLS가 "로그인한 사람은 전부 조회"라, 로그인한 누구나 REST로 `shows.is_licensed`(내부용)를 읽을 수 있음. 비로그인 공개 전 보안 정리 때 컬럼 노출을 막을 것 (뷰/함수로 공개 필드만)
- `app_settings.show_unlicensed_content`는 사이트가 쓰지 않음 (공개 기준은 core.js 하드코딩)

## 다음 작업 메모: 내 이력 추가 → 단체 확인
- 사람(people)과 계정 연결은 `person_claims`(관리자 승인) → `user_profiles.person_id`
- 제안 흐름: 연결된 사람이 마이페이지 "내 기록"에서 "이력 추가" (공연 고르기 또는 새 공연 이름, 배역/역할) → `participation_history`에 확인 대기 상태로 들어감 → 그 공연 단체의 관리자가 "우리 공연 기록"에서 확인/거절. 단체 없는 공연은 사이트 관리자가 확인
- 필요한 것: participation_history에 상태 칸(예: `confirm_status` 확인 대기/확인/거절, 기본값은 기존 데이터 보호를 위해 '확인'), 추가 함수(security definer, is_real_user 확인), 단체 관리자용 확인 목록, 사이트 공개 화면은 '확인'만 표시

## 작업·테스트 방식 (이 세션에서 쓴 것)
- DB 변경은 `apply_migration`, 같은 SQL을 `supabase/migrations/날짜_이름.sql`로 저장
- 서버 함수 테스트: `execute_sql`에서 DO 블록으로 `set_config('request.jwt.claims', '{"sub":"<user id>","role":"authenticated"}', true)` + `set local role authenticated` 후 호출, 마지막에 `raise exception`으로 결과를 출력하면서 자동 롤백 (테스트 데이터가 남지 않음). 단체 관리자 테스트 계정: 낙타(troupe b89e0a0e…) 관리자 = 사이트 관리자이기도 함
- 화면 테스트: 로그인 뒤 화면은 직접 못 눌러봄 → 스크래치 폴더에 가짜 데이터로 해당 JS만 띄워 Playwright 스크린샷
- 캐시: JS/CSS를 바꾸면 `gongyon-db.html`의 `?v=` 값을 올림 (현재 20261010c)
