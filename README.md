# 오리 (Ori)

한국 연극·뮤지컬 공연 아카이브 + 공연 프로젝트 운영 도구.
빌드 과정 없는 바닐라 JS 정적 사이트로, GitHub Pages(`main` 브랜치)로 배포되고 데이터는 Supabase에 있다.

- 사이트: https://nussleman.github.io/ori/ → `gongyon-db.html`
- 관리자: https://nussleman.github.io/ori/admin.html

## 디렉토리

```
index.html                 루트 접속 시 gongyon-db.html 로 이동
gongyon-db.html            오리 사이트 (HTML 뼈대만. 화면은 JS가 #mn 에 그린다)
admin.html                 관리자 페이지 (HTML 뼈대 + 탭별 폼)
assets/
  favicon.svg              사이트 파비콘 — 이 파일만 바꾸면 된다
  favicon-admin.svg        관리자 파비콘 (탭 구분용 색)
  css/site.css             사이트 스타일
  css/admin.css            관리자 스타일
  js/config.js             Supabase 주소·공개 키 (사이트·관리자 공통)
  js/admin/                관리자 (ES 모듈, app.js가 시작점)
    app.js                 로그인·사이드바·주소(#/…) 라우팅·단축키
    lib.js                 Supabase 클라이언트, 전체 데이터 캐시(S)·관계 색인(IX), 저장 도우미, 창·알림
    schema.js              데이터 종류별 입력 칸·목록 표시·"채울 것" 점검 정의
    records.js             레코드 작업대: 목록 + 편집기(자동 저장), 사진, 출연진·배역·창작진·참여 이력 연결
    pages.js               할 일 홈, 요청 처리, 공개·권리 분류, 데이터 현황, 유저·관리자·선택지
  js/site/                 사이트 로직 (일반 스크립트, 아래 순서대로 로드)
    core.js                전역 상태, $() 헬퍼, mn() 렌더, REST 어댑터, 데이터 로드, 전역 검색, 모달
    filters.js             공통 필터 바 filterBar() — 목록·상세의 모든 필터
    detail.js              상세 화면 공통 틀 dvRender() — 같은 모델로 전용 페이지/오른쪽 패널을 그림
    account.js             구글 로그인, 선언 의식, 즐겨찾기, 사람/단체 클레임
    edit-request.js        정보 제보·수정요청 모달
    mypage.js              마이페이지: 내 기록 · 지원 현황 · 저장한 것 · 내 정보 · 내 단체
    reviews.js             후기·관극 기록 (공연·작품·극장·단체만, 긍정 키워드 칩 + 짧은 글, 신고)
    project.js             프로젝트 공간 뼈대(불러오기·탭) + 배역·제작진·팀·극장·홍보·예산 화면
    project-home.js        프로젝트 탭 구성: 홈(지금 할 일)·사람·준비
    project-dashboard.js   제작 계기판: 영역별 초록·노랑·빨강 불(자동 판정 + 마감 계산)과 데이터 기반 추천(스태프·캐스팅·극장·작품·비용)
    project-schedule.js    프로젝트 일정·공지
    project-budget.js      예산: 총 예산·분류별 추천 분배·예상/실제·사용 알림·부족금/잔금 제안·시트 링크·CSV·붙여넣기
    project-props.js       소품 큐시트: 장면×소품 큐(들어옴·무대에서·나감), 장면 순/소품별/인물별 보기, 동선 점검, CSV·인쇄
    bridges.js             둘러보기↔만들기 연결 버튼, 공통 선택 창 pickOne()
    project-wizard.js      프로젝트 위저드
    project-browse.js      기회: 모집 중인 자리 목록·지원, 마이페이지 지원 현황
    pages.js               콘텐츠(준비중)·라이선스 문의·약관·개인정보처리방침
    home.js                첫 화면 (가운데 검색창 + 최근 공연 · 모집 중인 자리)
    make.js                만들기 모드 첫 화면(내 프로젝트)과 좌측 프로젝트 목록
    shows.js works.js roles.js people.js troupes.js venues.js   목록·상세 화면
    peek.js                카드 클릭: 한 번 = 오른쪽 미리보기 패널, 두 번 = 전용 페이지
    router.js              해시 라우팅 + 앱 시작 (반드시 마지막)
```

## 규칙

- 용어: **공연** = 아카이브에 기록된 실제 공연, **프로젝트** = 오리에서 준비·운영 중인 공연. 두 모드는 **둘러보기 / 만들기**.
- 기본은 둘러보기(① 둘러보고 후기·관극 기록 남기기 ② 기회에서 자리 찾아 지원). 만들기(③ 기획·제작·참여)는 프로필 메뉴의 "만들기 모드로 전환"으로만 들어가고, 마지막 모드를 기억한다(`ori-mode`). 제작용 버튼(프로젝트 시작·후보 담기·초대)은 만들기 모드를 한 번이라도 쓴 사람(`isProducer()`)에게만 보인다.
- 후기는 사람에게 달지 않는다. 키워드는 긍정적인 것만 둔다.
- 디자인: 명조체 쓰지 않는다. 카드에 왼쪽 색띠 넣지 않는다.

- 사이트 JS는 전역 함수 방식(`onclick="goShows()"`)이라 파일을 나눠도 같은 전역 공간을 쓴다. 새 파일을 만들면 `gongyon-db.html` 하단 `<script>` 목록에 추가한다. `router.js`는 항상 마지막.
- 상세 화면은 모델 객체(헤더·핵심 정보·액션·섹션)를 만들어 `dvRender()`에 넘긴다. 섹션에 `peek:true`를 주면 패널 요약판에도 나온다.
- 필터는 `filterBar(이름, specs, opts)` 하나로 만든다. 버튼을 나열하지 않는다.
- 목록/상세의 카드는 `data-action="show|person|work|role|venue|troupe"` + `data-id`만 달면 클릭 동작(미리보기/전용 페이지)이 자동으로 붙는다.
- 상세 화면 안에서 DOM을 찾을 땐 `document.getElementById` 대신 `$()`, `$1()`, `$$()`를 쓴다 — 같은 화면이 본문과 미리보기 패널에 동시에 떠도 올바른 쪽을 찾는다.
- CSS/JS를 고치면 HTML의 `?v=날짜` 값을 올려서 브라우저 캐시를 무효화한다.
- 보안 경계는 브라우저 코드가 아니라 Supabase RLS다. anon 키는 공개 키라 저장소에 있어도 된다.
