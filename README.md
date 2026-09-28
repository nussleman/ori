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
  js/admin/admin.js        관리자 로직 (ES 모듈)
  js/site/                 사이트 로직 (일반 스크립트, 아래 순서대로 로드)
    core.js                전역 상태, $() 헬퍼, mn() 렌더, REST 어댑터, 데이터 로드, 전역 검색, 모달
    filters.js             공통 필터 바 filterBar() — 목록·상세의 모든 필터
    detail.js              상세 화면 공통 틀 dvRender() — 같은 모델로 전용 페이지/오른쪽 패널을 그림
    account.js             구글 로그인, 선언 의식, 즐겨찾기, 사람/단체 클레임
    edit-request.js        정보 제보·수정요청 모달
    mypage.js              마이페이지
    project.js             프로젝트 공간 뼈대(불러오기·탭) + 배역·제작진·팀·극장·홍보·예산 화면
    project-home.js        프로젝트 탭 구성: 홈(지금 할 일)·사람·준비
    project-schedule.js    프로젝트 일정·공지
    bridges.js             둘러보기↔만들기 연결 버튼, 공통 선택 창 pickOne()
    project-wizard.js      프로젝트 위저드
    project-browse.js      프로젝트 둘러보기 / 모집 중인 자리
    pages.js               콘텐츠(준비중)·라이선스 문의·약관·개인정보처리방침
    dashboard.js           대시보드
    home.js                첫 화면 (가운데 검색창 + 프로젝트 만들기)
    make.js                만들기 모드 첫 화면(내 프로젝트)과 좌측 프로젝트 목록
    shows.js works.js roles.js people.js troupes.js venues.js   목록·상세 화면
    peek.js                카드 클릭: 한 번 = 오른쪽 미리보기 패널, 두 번 = 전용 페이지
    router.js              해시 라우팅 + 앱 시작 (반드시 마지막)
```

## 규칙

- 용어: **공연** = 아카이브에 기록된 실제 공연, **프로젝트** = 오리에서 준비·운영 중인 공연. 두 모드는 **둘러보기 / 만들기**.
- 디자인: 명조체 쓰지 않는다. 카드에 왼쪽 색띠 넣지 않는다.

- 사이트 JS는 전역 함수 방식(`onclick="goShows()"`)이라 파일을 나눠도 같은 전역 공간을 쓴다. 새 파일을 만들면 `gongyon-db.html` 하단 `<script>` 목록에 추가한다. `router.js`는 항상 마지막.
- 상세 화면은 모델 객체(헤더·핵심 정보·액션·섹션)를 만들어 `dvRender()`에 넘긴다. 섹션에 `peek:true`를 주면 패널 요약판에도 나온다.
- 필터는 `filterBar(이름, specs, opts)` 하나로 만든다. 버튼을 나열하지 않는다.
- 목록/상세의 카드는 `data-action="show|person|work|role|venue|troupe"` + `data-id`만 달면 클릭 동작(미리보기/전용 페이지)이 자동으로 붙는다.
- 상세 화면 안에서 DOM을 찾을 땐 `document.getElementById` 대신 `$()`, `$1()`, `$$()`를 쓴다 — 같은 화면이 본문과 미리보기 패널에 동시에 떠도 올바른 쪽을 찾는다.
- CSS/JS를 고치면 HTML의 `?v=날짜` 값을 올려서 브라우저 캐시를 무효화한다.
- 보안 경계는 브라우저 코드가 아니라 Supabase RLS다. anon 키는 공개 키라 저장소에 있어도 된다.
