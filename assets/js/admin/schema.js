/* 오리 어드민 — 데이터 종류별 정의
   fields: [컬럼, 라벨, 입력 종류, 옵션]
     text · textarea · number · date · bool(—/예/아니오) · seg(몇 개 중 하나) · select · suggest(자유입력+추천)
     fk:<테이블>(검색해서 고르기, 없으면 새로 만들기) · tags:<옵션분류>(여러 개) · links(이름+주소 목록)
   checks: 목록 필터 겸 "채울 것" 경고. [키, 라벨, 행 → 문제면 true] */
import { S, IX, nameOf } from './lib.js?v=20260928s';

const BOOL = [['', '—'], [true, '예'], [false, '아니오']];
const isPublicShow = s => (s.is_licensed === '창작' || s.is_licensed === '완료') && !s.is_hidden;
const castCount = sid => (IX.phByShow.get(sid) || []).length;

export const ENT = {
  shows: {
    label: '공연', icon: '🎭', img: 'poster_urls', shape: 'poster', site: 'show',
    fields: [
      ['title', '공연명', 'text'],
      ['work_id', '작품', 'fk:works'], ['troupe_id', '단체', 'fk:troupes'], ['venue_id', '극장', 'fk:venues'],
      ['show_date', '시작일', 'date'], ['end_date', '종료일', 'date'],
      ['is_licensed', '라이선스', 'seg', [['', '미상'], ['창작', '창작'], ['완료', '완료'], ['미확보', '미확보']]],
      ['is_hidden', '사이트 노출', 'seg', [[false, '보임'], [true, '숨김']]],
      ['audience_count', '관객 수', 'number'], ['is_sold_out', '매진', 'bool'], ['has_rerun', '재공연', 'bool'],
    ],
    sub: s => [nameOf('troupes', s.troupe_id), s.show_date ? String(s.show_date).slice(0, 7).replace('-', '.') : ''].filter(Boolean).join(' · '),
    badge: s => isPublicShow(s) ? '' : (s.is_hidden ? '숨김' : (s.is_licensed === '미확보' ? '미확보' : '미상')),
    sort: [['date', '최근 공연순', (a, b) => String(b.show_date || '').localeCompare(String(a.show_date || ''))], ['name', '이름순', null]],
    checks: [
      ['nolicense', '라이선스 미상', s => !s.is_licensed],
      ['nowork', '작품 미연결', s => !s.work_id],
      ['nodate', '날짜 없음', s => !s.show_date],
      ['nocast', '출연진 없음', s => !castCount(s.id)],
      ['noposter', '포스터 없음', s => !(s.poster_urls || []).length],
      ['notroupe', '단체 없음', s => !s.troupe_id],
      ['novenue', '극장 없음', s => !s.venue_id],
    ],
    views: [['public', '공개', isPublicShow], ['private', '비공개', s => !isPublicShow(s)]],
  },
  works: {
    label: '작품', icon: '📖', img: 'poster_urls', shape: 'poster', site: 'work',
    fields: [
      ['title', '작품명', 'text'], ['title_en', '영문 제목', 'text'],
      ['genre', '구분', 'suggest', ['뮤지컬', '연극']],
      ['country', '국가', 'tags:work_country'], ['premiere_year', '초연 연도', 'number'], ['tags', '태그', 'tags:work_tag'],
      ['rights_type', '권리 유형', 'seg', [['', '미분류'], ['창작', '창작'], ['번안', '번안'], ['해외라이선스', '해외라이선스'], ['공유저작물', '공유저작물'], ['확인불가', '확인불가']]],
      ['amateur_license_status', '아마추어 라이선스', 'seg', [['', '—'], ['제공', '제공'], ['협의가능', '협의가능'], ['미제공', '미제공'], ['확인불가', '확인불가']]],
      ['rights_holder_display', '권리자', 'text'], ['rights_source', '확인 출처', 'text'], ['rights_verified_at', '확인일', 'date'],
      ['rights_is_public', '권리 정보 공개', 'bool'], ['license_note', '라이선스 메모', 'textarea'],
    ],
    sub: w => [w.genre, (IX.showsByWork.get(w.id) || []).length ? '공연 ' + (IX.showsByWork.get(w.id) || []).length + '편' : ''].filter(Boolean).join(' · '),
    sort: [['name', '이름순', null], ['shows', '공연 많은 순', (a, b) => (IX.showsByWork.get(b.id) || []).length - (IX.showsByWork.get(a.id) || []).length]],
    checks: [
      ['norights', '권리 미분류', w => !w.rights_type],
      ['nocreator', '창작진 없음', w => !(IX.chByWork.get(w.id) || []).length],
      ['noroles', '배역 없음', w => !(IX.rolesByWork.get(w.id) || []).length],
      ['nogenre', '구분 없음', w => !w.genre],
      ['noposter', '포스터 없음', w => !(w.poster_urls || []).length],
    ],
  },
  roles: {
    label: '배역', icon: '🎬', img: 'photo_urls', shape: 'square', site: 'role',
    fields: [
      ['name', '배역명', 'text'], ['work_id', '작품', 'fk:works'], ['order_num', '순서', 'number'],
      ['gender', '성별', 'seg', [['', '—'], ['남', '남'], ['여', '여']]], ['tags', '태그', 'tags:role_tag'],
    ],
    sub: r => nameOf('works', r.work_id),
    sort: [['work', '작품별', (a, b) => (nameOf('works', a.work_id) || '').localeCompare(nameOf('works', b.work_id) || '') || (a.order_num || 99) - (b.order_num || 99)], ['name', '이름순', null]],
    checks: [
      ['nogender', '성별 없음', r => !r.gender],
      ['nocast', '맡은 사람 없음', r => !(IX.prByRole.get(r.id) || []).length],
    ],
  },
  people: {
    label: '사람', icon: '👤', img: 'photo_urls', shape: 'round', site: 'person',
    fields: [
      ['name', '이름', 'text'], ['name_en', '영문 이름', 'text'], ['nickname', '활동명', 'text'],
      ['gender', '성별', 'seg', [['', '—'], ['남', '남'], ['여', '여'], ['기타', '기타']]],
      ['birth_date', '생년월일', 'date'], ['roles', '주 역할', 'tags:person_role'],
      ['social_links', '홍보 링크', 'links'], ['is_hidden', '사이트 노출', 'seg', [[false, '보임'], [true, '숨김']]],
    ],
    sub: p => { const n = (IX.phByPerson.get(p.id) || []).length, c = (IX.chByPerson.get(p.id) || []).length; return [n ? '이력 ' + n : '', c ? '창작 ' + c : ''].filter(Boolean).join(' · ') || '이력 없음'; },
    sort: [['name', '이름순', null], ['count', '이력 많은 순', (a, b) => (IX.phByPerson.get(b.id) || []).length - (IX.phByPerson.get(a.id) || []).length]],
    checks: [
      ['nohist', '이력 없음', p => !(IX.phByPerson.get(p.id) || []).length && !(IX.chByPerson.get(p.id) || []).length],
      ['nophoto', '사진 없음', p => !(p.photo_urls || []).length],
      ['dupname', '이름 중복', p => S.people.filter(x => x.name === p.name).length > 1],
    ],
  },
  troupes: {
    label: '단체', icon: '🏢', img: 'photo_urls', shape: 'square', site: 'troupe',
    fields: [
      ['name', '단체명', 'text'], ['org_type', '조직 형태', 'tags:org_type'],
      ['member_base', '구성원', 'seg', [['', '—'], ['학생', '학생'], ['직장인', '직장인'], ['일반', '일반']]],
      ['status', '운영 상태', 'seg', [['', '—'], ['창단준비중', '창단준비중'], ['활동중', '활동중'], ['활동뜸함', '활동뜸함'], ['해체', '해체']]],
      ['region', '활동 지역', 'tags:troupe_region'], ['founded_year', '창단 연도', 'number'],
      ['recruiting_info', '단원 모집', 'textarea'], ['contact', '연락처', 'text'], ['social_links', '링크', 'links'], ['memo', '메모 (내부)', 'textarea'],
    ],
    sub: t => { const n = (IX.showsByTroupe.get(t.id) || []).length; return [(t.region || []).join(', '), n ? '공연 ' + n + '편' : ''].filter(Boolean).join(' · '); },
    sort: [['name', '이름순', null], ['shows', '공연 많은 순', (a, b) => (IX.showsByTroupe.get(b.id) || []).length - (IX.showsByTroupe.get(a.id) || []).length]],
    checks: [
      ['noshows', '공연 없음', t => !(IX.showsByTroupe.get(t.id) || []).length],
      ['noregion', '지역 없음', t => !(t.region || []).length],
      ['nophoto', '사진 없음', t => !(t.photo_urls || []).length],
    ],
  },
  venues: {
    label: '극장', icon: '📍', img: 'photo_urls', shape: 'square', site: 'venue',
    fields: [
      ['name', '극장명', 'text'], ['address', '주소', 'text'],
      ['seat_count', '좌석 (최소)', 'number'], ['seat_count_max', '좌석 (최대)', 'number'], ['seat_detail_note', '좌석 메모', 'text'],
      ['rental_available', '대관', 'bool'], ['rental_fee', '대관료', 'text'], ['parking_available', '주차', 'bool'],
      ['transit_info', '대중교통', 'text'], ['contact', '연락처', 'text'],
    ],
    sub: v => [v.seat_count ? v.seat_count + '석' : '', (IX.showsByVenue.get(v.id) || []).length ? '공연 ' + (IX.showsByVenue.get(v.id) || []).length + '편' : ''].filter(Boolean).join(' · '),
    sort: [['name', '이름순', null], ['shows', '공연 많은 순', (a, b) => (IX.showsByVenue.get(b.id) || []).length - (IX.showsByVenue.get(a.id) || []).length]],
    checks: [
      ['noaddr', '주소 없음', v => !v.address],
      ['noseat', '좌석 없음', v => !v.seat_count],
      ['noshows', '공연 없음', v => !(IX.showsByVenue.get(v.id) || []).length],
      ['nophoto', '사진 없음', v => !(v.photo_urls || []).length],
    ],
  },
};
export const ENT_ORDER = ['shows', 'works', 'roles', 'people', 'troupes', 'venues'];
export { BOOL, isPublicShow };
