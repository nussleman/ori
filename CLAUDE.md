# 오리 작업 메모 (Claude용)

- 구조와 코드 규칙은 README.md를 따른다.
- Supabase 프로젝트: `lezwarruqgccnecrmpga` ("오리 DB", ap-northeast-1). 같은 조직의 다른 프로젝트와 헷갈리지 않는다.
- 스키마 변경은 `apply_migration`, 조회는 `execute_sql`. 변경 전에 `list_tables`로 현재 구조를 확인한다.
- `main`에 푸시하면 바로 GitHub Pages로 배포된다. 태준님 방침: 작업이 끝나면 묻지 말고 테스트 후 `main`에 바로 커밋·푸시한다.
- 화면을 바꾸면 프론트와 DB 상태를 같이 확인한다 (UI가 말하는 것과 실제 데이터가 어긋나지 않게).
