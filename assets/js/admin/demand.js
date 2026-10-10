/* 오리 어드민 — 수요 보드 (#/demand)
   "이 작품, 단체 12곳이 원해요"를 만드는 곳 (docs/license.md 사업 흐름 2·3번: 수요를 묶어 권리자를 설득한다).
   수요 = 앞으로 올리고 싶다는 신호만: 올리고 싶어요 · 라이선스 문의 · 이 작품으로 준비 중인 프로젝트.
   과거 공연 횟수는 내부 참고로만 보이고 권리자용 내보내기·문장에는 넣지 않는다 (과거 무단 공연은 들추지 않는다).
   작품 권리는 "두 겹"으로 적는다: 원작의 문(권리자·대행사) / 번역의 문(한국어 대본 보유자) + 한국 독점 여부.
   서버: demand_board / demand_detail, 표 work_rights (supabase/migrations/20261010_demand_board.sql) */
import { sb, esc, $, fmtDate, toast } from './lib.js?v=20261010c';

const DM = { rows: [], view: 'demand', sort: 'demand_troupes', open: null };
const CAT_ST = ['미접촉', '접촉중', '인터뷰완료', '협의중', '계약완료', '거절', '보류'];
const SCRIPT_T = ['', '제작사', '번역자', '오리', '없음'];
const EXCL = ['', '있음', '없음', '끝남', '모름'];
const SORTS = [['demand_troupes', '원하는 단체 많은 순'], ['demand_people', '원하는 사람 많은 순'], ['inquiry_count', '문의 많은 순'], ['project_count', '준비 중 프로젝트 많은 순'], ['past_show_count', '지난 공연 많은 순 (내부)']];
const VIEWS = [['demand', '수요 있는 작품'], ['first', '첫 딜 후보'], ['all', '전체']];
const PSTAT = { planning: '기획 중', upcoming: '공연 예정', running: '공연 중', completed: '끝남', new: '새 문의', answered: '답변함', closed: '종료' };

export async function renderDemand(root) {
  root.dataset.view = 'demand';
  root.innerHTML = '<div class="page"><p class="muted">불러오는 중…</p></div>';
  const { data, error } = await sb.rpc('demand_board');
  if (error) { root.innerHTML = `<div class="page"><p class="err">불러오지 못했어요: ${esc(error.message)}</p></div>`; return; }
  DM.rows = data || [];
  draw(root);
}
const hasDemand = r => r.demand_people > 0 || r.project_count > 0;
function visible() {
  const rows = DM.rows.filter(r => DM.view === 'all' ? true : DM.view === 'first' ? r.first_deal : hasDemand(r));
  return rows.sort((a, b) => (b[DM.sort] || 0) - (a[DM.sort] || 0) || (b.demand_people - a.demand_people) || (a.title || '').localeCompare(b.title || '', 'ko'));
}
function draw(root) {
  const rows = visible();
  const withDemand = DM.rows.filter(hasDemand).length, first = DM.rows.filter(r => r.first_deal).length;
  const troupes = DM.rows.reduce((a, r) => a + r.demand_troupes, 0);
  root.innerHTML = `<div class="page">
    <header class="page-h"><h1>수요 보드</h1>
      <p>앞으로 올리고 싶다는 신호(올리고 싶어요 · 라이선스 문의 · 준비 중인 프로젝트)를 작품별로 묶어요. 이 숫자를 들고 권리자에게 가요. 과거 공연 횟수는 내부 참고로만 보여요.</p>
      <div class="stats"><span class="pill">수요 있는 작품 ${withDemand}</span><span class="pill">원하는 단체 합계 ${troupes}</span><span class="pill">첫 딜 후보 ${first}</span>
        <select class="inp xs dm-sort" data-sort>${SORTS.map(s => `<option value="${s[0]}"${DM.sort === s[0] ? ' selected' : ''}>${s[1]}</option>`).join('')}</select>
        <button type="button" class="btn ghost xs" data-csv>권리자용 CSV</button></div>
      <div class="tabs">${VIEWS.map(v => `<button type="button" class="tab${DM.view === v[0] ? ' on' : ''}" data-dmtab="${v[0]}">${v[1]}</button>`).join('')}</div>
    </header>
    ${rows.length ? `<table class="grid dm"><thead><tr><th>작품</th><th>권리</th><th title="수요 신호를 남긴 사람이 속한 단체 + 프로젝트 단체">원하는 단체</th><th>사람</th><th>올리고 싶어요</th><th>문의</th><th>준비 중</th><th class="dm-int">지난 공연 (내부)</th><th>한국 독점</th><th>접촉 상태</th></tr></thead><tbody>
      ${rows.map(r => `<tr data-w="${r.work_id}" class="dm-row${DM.open === r.work_id ? ' on' : ''}">
        <td><b>${esc(r.title)}</b>${r.first_deal ? ' <em class="pill st-confirmed">첫 딜 후보</em>' : ''} <span class="muted">${esc(r.genre || '')}</span></td>
        <td>${esc(r.rights_type || '미분류')}${r.amateur_license_status && r.amateur_license_status !== '확인불가' ? ` <span class="muted">· 아마추어 ${esc(r.amateur_license_status)}</span>` : ''}</td>
        <td><b>${r.demand_troupes || ''}</b></td><td>${r.demand_people || ''}</td><td>${r.wish_count || ''}</td>
        <td>${r.inquiry_count || ''}${r.inquiry_new ? ` <em class="pill st-pending">새 ${r.inquiry_new}</em>` : ''}</td><td>${r.project_count || ''}</td>
        <td class="dm-int">${r.past_show_count ? `${r.past_show_count}회 · ${r.past_troupe_count}곳${r.last_year ? ' · ' + r.last_year : ''}` : ''}</td>
        <td>${esc(r.ko_exclusive || '')}</td>
        <td><select class="inp xs" data-cat="${r.work_id}">${CAT_ST.map(s => `<option${r.catalog_status === s ? ' selected' : ''}>${s}</option>`).join('')}</select></td></tr>
        ${DM.open === r.work_id ? `<tr class="dm-detail"><td colspan="10"><div id="dm-detail"><p class="muted">불러오는 중…</p></div></td></tr>` : ''}`).join('')}
    </tbody></table>` : `<div class="empty big">${DM.view === 'first' ? '첫 딜 후보가 아직 없어요. 수요가 있는 작품의 "한국 독점"을 채우면 여기 모여요.' : '아직 수요 신호가 없어요.'}</div>`}
  </div>`;
  root.onclick = e => {
    const v = e.target.closest('[data-dmtab]'); if (v) { DM.view = v.dataset.dmtab; DM.open = null; return draw(root); }
    if (e.target.closest('[data-csv]')) return exportCsv(rows);
    if (e.target.closest('select, input, textarea, button, a')) return;
    const tr = e.target.closest('tr.dm-row'); if (!tr) return;
    DM.open = DM.open === tr.dataset.w ? null : tr.dataset.w; draw(root);
  };
  root.onchange = async e => {
    if (e.target.matches('[data-sort]')) { DM.sort = e.target.value; return draw(root); }
    const s = e.target.closest('[data-cat]'); if (!s) return;
    if (await saveRights(s.dataset.cat, { catalog_status: s.value })) DM.rows.find(r => r.work_id === s.dataset.cat).catalog_status = s.value;
  };
  if (DM.open) drawDetail(root, DM.rows.find(r => r.work_id === DM.open));
}
async function saveRights(wid, patch) {
  const { error } = await sb.from('work_rights').upsert({ work_id: wid, ...patch, updated_at: new Date().toISOString() }, { onConflict: 'work_id' });
  if (error) { toast(error.message, 'err'); return false; }
  toast('저장했어요'); return true;
}
/* 권리자에게 보여줄 한 문장: 앞으로의 수요만 */
function pitch(r) {
  const parts = [r.demand_troupes ? `단체 ${r.demand_troupes}곳` : '', r.demand_people ? `${r.demand_people}명` : ''].filter(Boolean).join(' · ');
  const extra = [r.inquiry_count ? `라이선스 문의 ${r.inquiry_count}건` : '', r.project_count ? `이 작품으로 준비 중인 프로젝트 ${r.project_count}개` : ''].filter(Boolean).join(', ');
  return `〈${r.title}〉 정식 공연을 원하는 곳: ${parts || '아직 없음'}${extra ? ` (${extra})` : ''}. — 오리, ${fmtDate(new Date().toISOString())} 기준`;
}
async function drawDetail(root, r) {
  const box = $('#dm-detail', root); if (!box || !r) return;
  const [{ data: sig, error }, { data: wr }] = await Promise.all([sb.rpc('demand_detail', { p_work_id: r.work_id }), sb.from('work_rights').select('*').eq('work_id', r.work_id).maybeSingle()]);
  if (DM.open !== r.work_id) return;
  const w = wr || {};
  const sel = (k, opts) => `<select class="inp xs" data-k="${k}">${opts.map(o => `<option value="${o}"${(w[k] || '') === o ? ' selected' : ''}>${o || '—'}</option>`).join('')}</select>`;
  const inp = (k, ph) => `<input class="inp xs" data-k="${k}" value="${esc(w[k] || '')}" placeholder="${esc(ph)}">`;
  box.innerHTML = `<div class="dm-d">
    <div class="dm-col"><h4>수요 신호 <small>${(sig || []).length}</small></h4>
      ${error ? `<p class="err">${esc(error.message)}</p>` : (sig || []).length ? `<ul class="dm-sig">${sig.map(s => `<li><em class="pill">${esc(s.kind)}</em> <b>${esc(s.who || '(이름 없음)')}</b>${s.troupe_name ? ` · ${esc(s.troupe_name)}` : ''} <span class="muted">${fmtDate(s.at)}${s.status ? ' · ' + esc(PSTAT[s.status] || s.status) : ''}</span>${s.note ? `<div class="muted">${esc(s.note)}</div>` : ''}</li>`).join('')}</ul>` : '<p class="muted">아직 신호가 없어요.</p>'}
      <h4>권리자에게 보여줄 문장</h4><div class="dm-pitch">${esc(pitch(r))}</div>
      <button type="button" class="btn ghost xs" data-copy>문장 복사</button>
      <a class="btn ghost xs" href="#/data/works/${r.work_id}">작품 고치기</a></div>
    <div class="dm-col"><h4>권리 두 겹 <small>운영자만 봐요</small></h4>
      <div class="dm-form">
        <label>원작의 문</label><div>${inp('orig_holder', '원작 권리자 또는 대행사·출판사')}${inp('holder_contact', '연락처')}</div>
        <label>번역의 문</label><div>${inp('ko_script_holder', '한국어 대본을 가진 곳 (제작사 이름, 번역자)')}${sel('ko_script_holder_type', SCRIPT_T)}${inp('ko_script_contact', '연락처')}</div>
        <label>한국 독점</label><div>${sel('ko_exclusive', EXCL)} <span class="muted">없음·끝남이면 협상 상대가 하나라 첫 딜 후보가 돼요</span></div>
        <label>메모</label><div><textarea class="inp" rows="3" data-k="notes" placeholder="통화 기록, 조건, 다음 할 일">${esc(w.notes || '')}</textarea></div>
      </div>
      <button type="button" class="btn primary sm" data-save>저장</button></div>
  </div>`;
  box.onclick = async e => {
    if (e.target.closest('[data-copy]')) { navigator.clipboard.writeText(pitch(r)).then(() => toast('복사했어요'), () => toast('복사하지 못했어요', 'err')); return; }
    if (!e.target.closest('[data-save]')) return;
    const patch = {};
    box.querySelectorAll('[data-k]').forEach(el => { patch[el.dataset.k] = el.value.trim() || null; });
    if (await saveRights(r.work_id, patch)) renderDemand(root);
  };
}
/* 권리자용 CSV: 앞으로의 수요 숫자만 (사람 이름·과거 공연은 넣지 않는다) */
function exportCsv(rows) {
  const head = ['작품', '원하는 단체 수', '원하는 사람 수', '올리고 싶어요', '라이선스 문의', '준비 중인 프로젝트', '기준일'];
  const day = fmtDate(new Date().toISOString());
  const q = v => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
  const csv = '﻿' + [head, ...rows.filter(hasDemand).map(r => [r.title, r.demand_troupes, r.demand_people, r.wish_count, r.inquiry_count, r.project_count, day])].map(l => l.map(q).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `오리_작품수요_${day}.csv`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
