-- 라이선스 화면 확인용 임시 작품 지우기 (2026-10-24에 넣음, 제목이 "(테스트)"로 시작하고 tags에 '테스트')
-- 태준님이 다 보셨으면 Claude에게 "테스트 작품 지워줘"라고 하면 적용 (지우기가 들어 있어 승인 창이 뜸)
delete from roles where work_id in (select id from works where title like '(테스트)%' and '테스트' = any(tags));
delete from favorites where target_type = 'work' and target_id in (select id from works where title like '(테스트)%' and '테스트' = any(tags));
delete from license_demands where work_id in (select id from works where title like '(테스트)%' and '테스트' = any(tags));
delete from works where title like '(테스트)%' and '테스트' = any(tags);
