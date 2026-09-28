/* 오리 어드민 — 할 일 홈, 요청 처리, 분류 대기열, 운영·설정 화면 */
import { sb, S, byId, IX, nameOf, firstImg, update, insert, remove, esc, $, $$, fmtDate, fmtWhen, toast, confirmDlg, dialog } from './lib.js?v=20260928s';
import { ENT, ENT_ORDER, isPublicShow } from './schema.js?v=20260928s';
import { picker } from './records.js?v=20260928s';

/* ══════════ 요청 건수 (사이드바 배지·홈) ══════════ */
export const REQ = {
  claims: { label: '사람 클레임', load: st => sb.rpc('list_claims', { p_status: st }), pending: 'pending',
    tabs: [['pending', '대기'], ['approved', '승인됨'], ['rejected', '거절됨'], ['all', '전체']] },
  troupeclaims: { label: '단체 클레임', load: st => sb.rpc('list_troupe_claims', { p_status: st }), pending: 'pending',
    tabs: [['pending', '대기'], ['confirmed', '승인됨'], ['rejected', '거절됨'], ['all', '전체']] },
  edits: { label: '수정 요청', load: st => { let q = sb.from('edit_requests').select('*').order('created_at', { ascending: false }); if (st !== 'all') q = q.eq('status', st); return q; }, pending: 'pending',
    tabs: [['pending', '대기'], ['done', '완료'], ['rejected', '반려'], ['all', '전체']] },
  inquiries: { label: '라이선스 문의', load: st => sb.rpc('list_license_inquiries', { p_status: st }), pending: 'new',
    tabs: [['new', '새 문의'], ['answered', '답변함'], ['closed', '종료'], ['all', '전체']] },
};
export const COUNTS = {};
export async function loadCounts() {
  await Promise.all(Object.entries(REQ).map(async ([k, d]) => { const { data } = await d.load(d.pending); COUNTS[k] = (data || []).length; }));
  return COUNTS;
}

/* ══════════ 할 일 홈 ══════════ */
export function renderInbox(root) {
  root.dataset.view = 'inbox';
  const reqTotal = Object.values(COUNTS).reduce((a, b) => a + (b || 0), 0);
  const unlic = S.shows.filter(s => !s.is_licensed).length, unrights = S.works.filter(w => !w.rights_type).length;
  const pub = S.shows.filter(isPublicShow).length;
  const card = (href, n, label, sub, tone) => `<a class="ib-card${n ? '' : ' done'}${tone ? ' ' + tone : ''}" href="${href}"><b>${n}</b><span>${label}</span>${sub ? `<small>${sub}</small>` : ''}</a>`;
  const quality = ENT_ORDER.map(t => {
    const E = ENT[t], items = E.checks.map(c => [c, S[t].filter(c[2]).length]).filter(x => x[1]);
    if (!items.length) return '';
    return `<div class="ib-q"><h4>${E.icon} ${E.label} <small>${S[t].length}</small></h4>${items.map(([c, n]) => `<a class="ib-row" href="#/data/${t}?f=${c[0]}"><span>${c[1]}</span><b>${n}</b></a>`).join('')}</div>`;
  }).join('');
  root.innerHTML = `<div class="page">
    <header class="page-h"><h1>할 일</h1><p>들어온 요청과 채워야 할 데이터를 한곳에 모았어요. 누르면 바로 그 목록으로 가요.</p></header>
    <section class="ib-sec"><h2>들어온 요청 <small>${reqTotal}</small></h2><div class="ib-cards">
      ${Object.entries(REQ).map(([k, d]) => card('#/requests/' + k, COUNTS[k] || 0, d.label, '', COUNTS[k] ? 'hot' : '')).join('')}
    </div></section>
    <section class="ib-sec"><h2>분류 대기</h2><div class="ib-cards">
      ${card('#/queue/license', unlic, '라이선스 미상 공연', `사이트 공개 ${pub} / 전체 ${S.shows.length}편`, unlic ? 'warm' : '')}
      ${card('#/queue/rights', unrights, '권리 미분류 작품', `전체 ${S.works.length}작품`, unrights ? 'warm' : '')}
    </div></section>
    <section class="ib-sec"><h2>채울 데이터</h2><div class="ib-qs">${quality || '<p class="muted">모두 채워졌어요 👏</p>'}</div></section>
  </div>`;
}

/* ══════════ 요청 처리 ══════════ */
const RQ_ST = {};
const TYPE_TABLE = { show: 'shows', work: 'works', role: 'roles', person: 'people', troupe: 'troupes', venue: 'venues' };
const TYPE_LABEL = { show: '공연', work: '작품', troupe: '단체', venue: '극장', person: '사람', role: '배역', other: '기타' };
const REQ_KIND = { edit: '수정', create: '추가', delete: '삭제' };
export async function renderRequests(root, kind) {
  root.dataset.view = 'req:' + kind;
  const d = REQ[kind], st = RQ_ST[kind] = RQ_ST[kind] || d.pending;
  root.innerHTML = `<div class="page">
    <header class="page-h"><h1>${d.label}</h1>
      <div class="tabs">${d.tabs.map(t => `<button type="button" class="tab${t[0] === st ? ' on' : ''}" data-st="${t[0]}">${t[1]}${t[0] === d.pending && COUNTS[kind] ? ` <b>${COUNTS[kind]}</b>` : ''}</button>`).join('')}</div></header>
    <div class="req-list"><p class="muted">불러오는 중…</p></div></div>`;
  $('.tabs', root).addEventListener('click', e => { const b = e.target.closest('[data-st]'); if (b) { RQ_ST[kind] = b.dataset.st; renderRequests(root, kind); } });
  const { data, error } = await d.load(st);
  const box = $('.req-list', root);
  if (error) { box.innerHTML = `<p class="err">불러오지 못했어요: ${esc(error.message)}</p>`; return; }
  if (!data || !data.length) { box.innerHTML = '<div class="empty big">처리할 게 없어요 👏</div>'; return; }
  box.innerHTML = data.map(r => reqCard(kind, r)).join('');
  box.addEventListener('click', e => { const b = e.target.closest('[data-do]'); if (b) reqAct(root, kind, b.dataset.do, b.dataset.id); });
}
function stPill(s) { const m = { pending: '대기', new: '새 문의', approved: '승인됨', confirmed: '승인됨', done: '완료', answered: '답변함', rejected: '거절·반려', closed: '종료' }; return `<em class="pill st-${s}">${m[s] || s}</em>`; }
function reqCard(kind, r) {
  if (kind === 'claims') return `<div class="rq"><div class="rq-m"><div class="rq-t">${stPill(r.status)} <b>${esc(r.person_name)}</b> 님으로 계정 연결 요청</div>
    <div class="rq-s">${esc(r.requester_email || '')} · ${fmtWhen(r.created_at)}</div></div>
    <div class="rq-a">${r.person_id ? `<a class="btn ghost sm" href="#/data/people/${r.person_id}">사람 보기</a>` : ''}${r.status === 'pending' ? `<button type="button" class="btn primary sm" data-do="ok" data-id="${r.claim_id}">승인</button><button type="button" class="btn ghost sm" data-do="no" data-id="${r.claim_id}">거절</button>` : ''}</div></div>`;
  if (kind === 'troupeclaims') return `<div class="rq"><div class="rq-m"><div class="rq-t">${stPill(r.status)} <b>${esc(r.troupe_name)}</b> 단체 관리자 연결 요청</div>
    <div class="rq-s">${esc(r.requester_nickname || r.requester_email || '')} · ${fmtWhen(r.created_at)}</div></div>
    <div class="rq-a">${r.troupe_id ? `<a class="btn ghost sm" href="#/data/troupes/${r.troupe_id}">단체 보기</a>` : ''}${r.status === 'pending' ? `<button type="button" class="btn primary sm" data-do="ok" data-id="${r.claim_id}">승인</button><button type="button" class="btn ghost sm" data-do="no" data-id="${r.claim_id}">거절</button>` : ''}</div></div>`;
  if (kind === 'edits') {
    const t = TYPE_TABLE[r.target_type], target = t && r.target_id ? nameOf(t, r.target_id) : '';
    return `<div class="rq"><div class="rq-m"><div class="rq-t">${stPill(r.status)} <span class="muted">${REQ_KIND[r.request_type] || r.request_type} · ${TYPE_LABEL[r.target_type] || r.target_type}${target ? ' · ' : ''}</span><b>${esc(target)}</b></div>
      <div class="rq-b"><b>${esc(r.summary || '')}</b>${r.details ? `<div>${esc(r.details)}</div>` : ''}</div><div class="rq-s">${fmtWhen(r.created_at)}</div></div>
      <div class="rq-a">${t && r.target_id ? `<a class="btn primary sm" href="#/data/${t}/${r.target_id}?req=${r.id}">열어서 고치기</a>` : ''}${r.status === 'pending' ? `<button type="button" class="btn ghost sm" data-do="done" data-id="${r.id}">완료</button><button type="button" class="btn ghost sm" data-do="rejected" data-id="${r.id}">반려</button>` : ''}</div></div>`;
  }
  return `<div class="rq"><div class="rq-m"><div class="rq-t">${stPill(r.status)} <b>${esc(r.show_title || r.work_title || '(일반 문의)')}</b></div>
    <div class="rq-b">${esc(r.message || '')}${r.admin_note ? `<div class="muted">메모: ${esc(r.admin_note)}</div>` : ''}</div>
    <div class="rq-s">${esc(r.requester_nickname || r.requester_email || '')}${r.contact ? ' · 연락처 ' + esc(r.contact) : ''} · ${fmtWhen(r.created_at)}</div></div>
    <div class="rq-a">${r.status !== 'closed' ? `<button type="button" class="btn primary sm" data-do="answer" data-id="${r.id}">답변함으로</button><button type="button" class="btn ghost sm" data-do="close" data-id="${r.id}">종료</button>` : ''}</div></div>`;
}
async function reqAct(root, kind, act, id) {
  let res;
  if (kind === 'claims') res = await sb.rpc(act === 'ok' ? 'approve_person_claim' : 'reject_person_claim', { claim_id: id });
  else if (kind === 'troupeclaims') res = await sb.rpc(act === 'ok' ? 'approve_troupe_claim' : 'reject_troupe_claim', { p_claim_id: id });
  else if (kind === 'edits') { const u = (await sb.auth.getUser()).data.user; res = await sb.from('edit_requests').update({ status: act, reviewed_by: u && u.id, reviewed_at: new Date().toISOString() }).eq('id', id); }
  else {
    let note = null;
    if (act === 'answer') { const b = await dialog({ title: '답변함으로 표시', body: '<p class="muted">어떻게 안내했는지 메모로 남겨둘 수 있어요 (선택).</p><textarea class="inp" rows="3"></textarea>', ok: '표시' }); if (!b) return; note = $('textarea', b).value.trim() || null; }
    res = await sb.rpc('resolve_license_inquiry', { p_id: id, p_status: act === 'answer' ? 'answered' : 'closed', p_admin_note: note });
  }
  if (res.error) { toast(res.error.message, 'err'); return; }
  toast('처리했어요');
  window.dispatchEvent(new Event('ori:badges'));
  renderRequests(root, kind);
}

/* ══════════ 공개 분류 (라이선스 미상 공연) ══════════ */
const LQ = { i: 0, all: false };
const LIC = [['창작', '창작', '1'], ['완료', '완료 (확보)', '2'], ['미확보', '미확보 (숨김)', '3']];
export function renderLicense(root) {
  root.dataset.view = 'lic';
  const queue = S.shows.filter(s => LQ.all || !s.is_licensed).sort((a, b) => String(b.show_date || '').localeCompare(String(a.show_date || '')));
  const cnt = k => S.shows.filter(s => (s.is_licensed || '') === k).length;
  LQ.i = Math.min(LQ.i, Math.max(0, queue.length - 1));
  const s = queue[LQ.i];
  root.innerHTML = `<div class="page">
    <header class="page-h"><h1>공개 분류</h1><p>사이트에는 라이선스가 해결된 공연(창작·완료)만 나와요. 미상인 공연을 하나씩 분류해요. 그 공연에만 나오는 사람도 함께 숨겨져요.</p>
      <div class="stats"><span class="pill st-done">공개 ${cnt('창작') + cnt('완료')}</span><span class="pill">창작 ${cnt('창작')}</span><span class="pill">완료 ${cnt('완료')}</span><span class="pill st-rejected">미확보 ${cnt('미확보')}</span><span class="pill st-pending">미상 ${cnt('')}</span>
      <button type="button" class="btn ghost xs" data-q="toggle">${LQ.all ? '미상만 보기' : '전체 보기'}</button></div></header>
    ${s ? `<div class="q-card">
      ${firstImg(s, 'poster_urls') ? `<img class="q-img" src="${esc(firstImg(s, 'poster_urls'))}" alt="">` : '<div class="q-img q-ph">🎭</div>'}
      <div class="q-body"><div class="muted">${LQ.i + 1} / ${queue.length}</div><h2>${esc(s.title)}</h2>
        <div class="q-facts">${[nameOf('works', s.work_id) && '작품 ' + nameOf('works', s.work_id), nameOf('troupes', s.troupe_id), nameOf('venues', s.venue_id), fmtDate(s.show_date), (IX.phByShow.get(s.id) || []).length + '명 참여'].filter(Boolean).map(x => `<span>${esc(x)}</span>`).join('')}</div>
        ${s.work_id && byId.works.get(s.work_id) && byId.works.get(s.work_id).rights_type ? `<p class="hint">작품 권리 유형: <b>${esc(byId.works.get(s.work_id).rights_type)}</b></p>` : ''}
        <div class="q-opts">${LIC.map(o => `<button type="button" class="btn ${s.is_licensed === o[0] ? 'primary' : 'ghost'}" data-q="${o[0]}"><kbd>${o[2]}</kbd>${o[1]}</button>`).join('')}</div>
        <div class="q-nav"><button type="button" class="btn ghost sm" data-q="prev">← 이전</button><button type="button" class="btn ghost sm" data-q="next">건너뛰기 →</button><a class="btn ghost sm" href="#/data/shows/${s.id}">자세히 고치기</a><span class="hint">1·2·3 분류 · ←→ 이동</span></div>
      </div></div>` : '<div class="empty big">분류할 공연이 없어요 👏</div>'}
  </div>`;
  root.onclick = async e => {
    const b = e.target.closest('[data-q]'); if (!b) return;
    const q = b.dataset.q;
    if (q === 'toggle') { LQ.all = !LQ.all; LQ.i = 0; return renderLicense(root); }
    if (q === 'prev') { LQ.i = Math.max(0, LQ.i - 1); return renderLicense(root); }
    if (q === 'next') { LQ.i++; return renderLicense(root); }
    if (s && await update('shows', s.id, { is_licensed: q })) { if (LQ.all) LQ.i++; renderLicense(root); window.dispatchEvent(new Event('ori:badges')); }
  };
}
export function licenseKeys(e) {
  const root = document.getElementById('main');
  if (root.dataset.view !== 'lic' || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.metaKey || e.ctrlKey) return;
  const o = LIC.find(x => x[2] === e.key);
  const btn = o ? $(`[data-q="${o[0]}"]`, root) : e.key === 'ArrowRight' ? $('[data-q=next]', root) : e.key === 'ArrowLeft' ? $('[data-q=prev]', root) : null;
  if (btn) { e.preventDefault(); btn.click(); }
}

/* ══════════ 권리 분류 (작품) + 카탈로그 후보 ══════════ */
const RQ = { i: 0, all: false };
const RIGHTS = [['창작', '1'], ['번안', '2'], ['해외라이선스', '3'], ['공유저작물', '4'], ['확인불가', '5']];
const ALIC = [['제공', 'Q'], ['협의가능', 'W'], ['미제공', 'E'], ['확인불가', 'R']];
export function renderRights(root) {
  root.dataset.view = 'rights';
  const list = S.works.filter(w => RQ.all || !w.rights_type).sort((a, b) => (a.title || '').localeCompare(b.title || '', 'ko'));
  RQ.i = Math.min(RQ.i, Math.max(0, list.length - 1));
  const w = list[RQ.i], done = S.works.filter(x => x.rights_type).length;
  const shows = w ? (IX.showsByWork.get(w.id) || []) : [];
  const yrs = shows.map(s => s.show_date && Number(String(s.show_date).slice(0, 4))).filter(Boolean);
  root.innerHTML = `<div class="page">
    <header class="page-h"><h1>권리 분류</h1><p>작품의 권리 유형과 아마추어 라이선스 제공 여부를 빠르게 분류해요.</p>
      <div class="stats"><div class="bar"><i style="width:${S.works.length ? Math.round(done / S.works.length * 100) : 0}%"></i></div><span class="muted">${done} / ${S.works.length} 분류됨</span>
      ${RIGHTS.map(r => `<span class="pill">${r[0]} ${S.works.filter(x => x.rights_type === r[0]).length}</span>`).join('')}
      <button type="button" class="btn ghost xs" data-r="toggle">${RQ.all ? '미분류만 보기' : '전체 보기'}</button></div></header>
    ${w ? `<div class="q-card">
      ${firstImg(w, 'poster_urls') ? `<img class="q-img" src="${esc(firstImg(w, 'poster_urls'))}" alt="">` : '<div class="q-img q-ph">📖</div>'}
      <div class="q-body"><div class="muted">${RQ.i + 1} / ${list.length}</div><h2>${esc(w.title)}</h2>${w.title_en ? `<div class="muted">${esc(w.title_en)}</div>` : ''}
        <div class="q-facts">${[w.genre, (w.country || []).join(', '), w.premiere_year && '초연 ' + w.premiere_year, '공연 ' + shows.length + '편', yrs.length && '최근 ' + Math.max(...yrs), '창작진 ' + (IX.chByWork.get(w.id) || []).length + '명'].filter(Boolean).map(x => `<span>${esc(x)}</span>`).join('')}</div>
        <div class="q-lbl">권리 유형</div><div class="q-opts">${RIGHTS.map(o => `<button type="button" class="btn ${w.rights_type === o[0] ? 'primary' : 'ghost'}" data-r="t:${o[0]}"><kbd>${o[1]}</kbd>${o[0]}</button>`).join('')}</div>
        <div class="q-lbl">아마추어 라이선스</div><div class="q-opts">${ALIC.map(o => `<button type="button" class="btn ${w.amateur_license_status === o[0] ? 'primary' : 'ghost'}" data-r="l:${o[0]}"><kbd>${o[1]}</kbd>${o[0]}</button>`).join('')}</div>
        <div class="q-nav"><button type="button" class="btn ghost sm" data-r="prev">← 이전</button><button type="button" class="btn ghost sm" data-r="next">다음 →</button>
          <a class="btn ghost sm" href="https://www.google.com/search?q=${encodeURIComponent(w.title + ' 뮤지컬 연극 원작 초연')}" target="_blank" rel="noopener">검색 ↗</a><a class="btn ghost sm" href="#/data/works/${w.id}">자세히 고치기</a>
          <span class="hint">1–5 유형 · Q–R 라이선스 · ←→ 이동</span></div>
      </div></div>` : '<div class="empty big">분류할 작품이 없어요 👏</div>'}
    <section class="ed-sec"><h3>카탈로그 후보 <small>라이선스 사업 우선순위</small></h3><div id="cat-list"><p class="muted">불러오는 중…</p></div></section>
  </div>`;
  root.onclick = async e => {
    const b = e.target.closest('[data-r]'); if (!b) return;
    const q = b.dataset.r;
    if (q === 'toggle') { RQ.all = !RQ.all; RQ.i = 0; return renderRights(root); }
    if (q === 'prev') { RQ.i = Math.max(0, RQ.i - 1); return renderRights(root); }
    if (q === 'next') { RQ.i = Math.min(list.length - 1, RQ.i + 1); return renderRights(root); }
    if (!w) return;
    if (q.startsWith('t:')) { const was = w.rights_type; if (await update('works', w.id, { rights_type: q.slice(2) })) { if (was || RQ.all) RQ.i++; renderRights(root); } }
    if (q.startsWith('l:')) { if (await update('works', w.id, { amateur_license_status: q.slice(2) })) renderRights(root); }
  };
  loadCatalog();
}
export function rightsKeys(e) {
  const root = document.getElementById('main');
  if (root.dataset.view !== 'rights' || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.metaKey || e.ctrlKey) return;
  const t = RIGHTS.find(x => x[1] === e.key), l = ALIC.find(x => x[1] === e.key.toUpperCase());
  const btn = t ? $(`[data-r="t:${t[0]}"]`, root) : l ? $(`[data-r="l:${l[0]}"]`, root) : e.key === 'ArrowRight' ? $('[data-r=next]', root) : e.key === 'ArrowLeft' ? $('[data-r=prev]', root) : null;
  if (btn) { e.preventDefault(); btn.click(); }
}
const CAT_ST = ['미접촉', '접촉중', '인터뷰완료', '협의중', '계약완료', '거절', '보류'];
async function loadCatalog() {
  const el = document.getElementById('cat-list'); if (!el) return;
  const { data, error } = await sb.from('v_catalog_candidates').select('*').order('auto_score', { ascending: false }).limit(50);
  if (error) { el.innerHTML = `<p class="err">불러오지 못했어요: ${esc(error.message)}</p>`; return; }
  if (!data || !data.length) { el.innerHTML = '<p class="muted">후보가 없어요.</p>'; return; }
  el.innerHTML = `<table class="grid"><thead><tr><th>점수</th><th>작품</th><th>권리</th><th>공연</th><th>최근</th><th>창작진</th><th>수요</th><th>사장</th><th>접촉 상태</th></tr></thead><tbody>${data.map(r => `<tr>
    <td><b>${r.auto_score}</b></td><td><a class="lnk" href="#/data/works/${r.id}">${esc(r.title)}</a> <span class="muted">${esc(r.genre || '')}</span></td><td>${esc(r.rights_type || '')}</td>
    <td>${r.show_count}</td><td>${r.last_show_year || ''}</td><td>${r.creator_count || '<span class="warn-t">없음</span>'}</td><td>${r.demand_score || ''}</td><td>${r.is_dormant ? '✓' : ''}</td>
    <td><select class="inp xs" data-cat="${r.id}">${CAT_ST.map(s => `<option${r.catalog_status === s ? ' selected' : ''}>${s}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table>`;
  el.onchange = async e => {
    const s = e.target.closest('[data-cat]'); if (!s) return;
    const { error } = await sb.from('work_rights').upsert({ work_id: s.dataset.cat, catalog_status: s.value, updated_at: new Date().toISOString() }, { onConflict: 'work_id' });
    if (error) toast(error.message, 'err'); else toast('저장했어요');
  };
}

/* ══════════ 데이터 현황 ══════════ */
export function renderHealth(root) {
  root.dataset.view = 'health';
  const bars = ENT_ORDER.map(t => {
    const E = ENT[t], n = S[t].length || 1;
    return `<div class="h-ent"><h4>${E.icon} ${E.label} <small>${S[t].length}</small></h4>${E.checks.map(c => {
      const bad = S[t].filter(c[2]).length, pct = Math.round((1 - bad / n) * 100);
      return `<a class="h-row" href="#/data/${t}?f=${c[0]}"><span>${c[1].replace(/ 없음| 미상| 미분류| 미연결/, '')}</span><div class="bar"><i style="width:${pct}%" class="${pct >= 80 ? 'good' : pct >= 50 ? 'mid' : 'low'}"></i></div><b>${pct}%</b><small>${bad ? bad + '개 비어 있음' : '완료'}</small></a>`;
    }).join('')}</div>`;
  }).join('');
  root.innerHTML = `<div class="page"><header class="page-h"><h1>데이터 현황</h1><p>항목별로 얼마나 채워졌는지 보여줘요. 줄을 누르면 비어 있는 것만 모아 볼 수 있어요.</p></header><div class="h-grid">${bars}</div></div>`;
}

/* ══════════ 유저 ══════════ */
export async function renderUsers(root) {
  root.dataset.view = 'users';
  root.innerHTML = `<div class="page"><header class="page-h"><h1>유저</h1><p>가입한 계정과 사람 기록 연결 여부예요. 연결되지 않은 계정은 눌러서 바로 연결할 수 있어요.</p>
    <input type="search" class="inp" id="u-q" placeholder="이메일·닉네임 찾기" style="max-width:320px"></header><div id="u-list"><p class="muted">불러오는 중…</p></div></div>`;
  const { data, error } = await sb.rpc('list_all_users');
  const el = $('#u-list', root);
  if (error) { el.innerHTML = `<p class="err">${esc(error.message)}</p>`; return; }
  const draw = () => {
    const q = $('#u-q', root).value.trim().toLowerCase();
    const rows = (data || []).filter(u => !q || (u.email || '').toLowerCase().includes(q) || (u.nickname || '').toLowerCase().includes(q));
    el.innerHTML = `<table class="grid"><thead><tr><th>이메일</th><th>닉네임</th><th>사람 기록</th><th>주 역할</th><th>관리자</th><th>가입</th></tr></thead><tbody>${rows.map(u => `<tr>
      <td>${esc(u.email || '')}</td><td>${esc(u.nickname || '')}</td>
      <td>${u.person_name ? (u.person_id ? `<a class="lnk" href="#/data/people/${u.person_id}">${esc(u.person_name)}</a>` : esc(u.person_name)) : `<button type="button" class="btn ghost xs" data-link="${u.user_id}">＋ 연결하기</button>`}</td>
      <td>${esc((u.preferred_roles || []).join(', '))}</td><td>${u.is_admin ? '✓' : ''}</td><td class="muted">${fmtDate(u.created_at)}</td></tr>`).join('')}</tbody></table>`;
  };
  draw();
  $('#u-q', root).addEventListener('input', draw);
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-link]'); if (!b) return;
    picker(b, { items: S.people.map(p => ({ id: p.id, label: p.name, sub: ENT.people.sub(p) })), placeholder: '연결할 사람 찾기', onPick: async pid => {
      const { error } = await sb.rpc('admin_link_user_person', { p_user_id: b.dataset.link, p_person_id: pid });
      if (error) { toast(error.message, 'err'); return; }
      toast('연결했어요'); renderUsers(root);
    } });
  });
}

/* ══════════ 관리자 ══════════ */
export async function renderAdmins(root) {
  root.dataset.view = 'admins';
  root.innerHTML = `<div class="page"><header class="page-h"><h1>관리자</h1><p>여기 등록된 이메일로 구글 로그인하면 관리자 권한을 가져요. 아직 가입 전이면 처음 로그인하는 순간 관리자가 돼요.</p></header>
    <form class="inline-form" id="adm-add"><input type="email" class="inp" placeholder="이메일 주소" required><button class="btn primary sm">추가</button></form><div id="adm-list"></div></div>`;
  const draw = async () => {
    const { data, error } = await sb.from('admin_emails').select('email').order('email');
    $('#adm-list', root).innerHTML = error ? `<p class="err">${esc(error.message)}</p>` : `<table class="grid"><tbody>${(data || []).map(a => `<tr><td>${esc(a.email)}</td><td class="w-x"><button type="button" class="btn ghost xs danger" data-rm="${esc(a.email)}">빼기</button></td></tr>`).join('')}</tbody></table>`;
  };
  $('#adm-add', root).addEventListener('submit', async e => {
    e.preventDefault(); const inp = $('input', e.target), email = inp.value.trim(); if (!email) return;
    const { error } = await sb.rpc('grant_admin', { target_email: email });
    if (error) toast(error.message, 'err'); else { toast('추가했어요'); inp.value = ''; draw(); }
  });
  $('#adm-list', root).addEventListener('click', async e => {
    const b = e.target.closest('[data-rm]'); if (!b) return;
    if (!(await confirmDlg(b.dataset.rm + '을 관리자에서 뺄까요?', '', true))) return;
    const { error } = await sb.rpc('revoke_admin', { target_email: b.dataset.rm });
    if (error) toast(error.message, 'err'); else draw();
  });
  draw();
}

/* ══════════ 선택지·스텝 역할·창작 유형 ══════════ */
const OPT_CATS = { work_country: '작품 · 국가', work_tag: '작품 · 태그', role_tag: '배역 · 태그', org_type: '단체 · 조직 형태', troupe_region: '단체 · 활동 지역', person_role: '사람 · 주 역할' };
export function renderLists(root) {
  root.dataset.view = 'lists';
  const small = (table, label, hasOrder) => `<section class="ed-sec"><h3>${label} <small>${S[table].length}</small></h3>
    <table class="rel rel-roles"><tbody>${S[table].slice().sort((a, b) => hasOrder ? (a.order_num ?? 999) - (b.order_num ?? 999) : (a.name || '').localeCompare(b.name || '', 'ko')).map(r => `<tr data-t="${table}" data-id="${r.id}">
      ${hasOrder ? `<td class="w-num"><input class="inp xs" type="number" data-c="order_num" value="${r.order_num ?? ''}"></td>` : ''}<td><input class="inp xs" data-c="name" value="${esc(r.name)}"></td>
      <td class="w-x"><button type="button" class="icon-btn" data-del="1" title="지우기">✕</button></td></tr>`).join('')}</tbody></table>
    <button type="button" class="btn ghost sm" data-add="${table}">＋ 추가</button></section>`;
  root.innerHTML = `<div class="page"><header class="page-h"><h1>선택지 관리</h1><p>여러 개 고르는 칸(국가·태그 등)의 추천 값과, 제작진 역할·창작 역할 목록이에요. 이미 저장된 데이터의 값은 지워도 그대로 남아요.</p></header>
    <div class="lists-grid">
      ${small('staff_roles', '제작진 역할 (스텝)', true)}
      ${small('creation_types', '창작 역할', false)}
      ${Object.entries(OPT_CATS).map(([cat, label]) => `<section class="ed-sec"><h3>${label} <small>${(S.option_lists.filter(o => o.category === cat)).length}</small></h3>
        <div class="tags" data-opt="${cat}">${S.option_lists.filter(o => o.category === cat).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)).map(o => `<span class="tag">${esc(o.value)}<button type="button" data-optrm="${o.id}">✕</button></span>`).join('')}<input class="tag-in" placeholder="입력 후 Enter"></div></section>`).join('')}
    </div></div>`;
  root.onchange = async e => {
    const el = e.target.closest('[data-c]'); if (!el) return;
    const tr = el.closest('tr'), v = el.value === '' ? null : (el.dataset.c === 'order_num' ? Number(el.value) : el.value);
    if (el.dataset.c === 'name' && !v) { toast('이름은 비울 수 없어요', 'err'); return renderLists(root); }
    await update(tr.dataset.t, tr.dataset.id, { [el.dataset.c]: v });
  };
  root.onkeydown = async e => {
    if (e.key !== 'Enter') return;
    if (e.target.matches('[data-c]')) { e.preventDefault(); e.target.blur(); return; }
    const inp = e.target.closest('.tag-in'); if (!inp) return;
    e.preventDefault(); const v = inp.value.trim(), cat = inp.closest('[data-opt]').dataset.opt; if (!v) return;
    const max = S.option_lists.filter(o => o.category === cat).reduce((m, o) => Math.max(m, o.sort_order || 0), 0);
    if (await insert('option_lists', { category: cat, value: v, sort_order: max + 1 })) renderLists(root);
  };
  root.onclick = async e => {
    const add = e.target.closest('[data-add]');
    if (add) { const t = add.dataset.add; const row = await insert(t, t === 'staff_roles' ? { name: '새 역할', order_num: S[t].length + 1 } : { name: '새 역할' }); if (row) { renderLists(root); const i = $(`tr[data-id="${row.id}"] [data-c=name]`, root); if (i) { i.focus(); i.select(); } } return; }
    const del = e.target.closest('[data-del]');
    if (del) { const tr = del.closest('tr'); if (!(await confirmDlg(nameOf(tr.dataset.t, tr.dataset.id) + '을(를) 지울까요?', '쓰고 있는 기록이 있으면 지워지지 않아요.', true))) return; if (await remove(tr.dataset.t, tr.dataset.id, '이 역할')) renderLists(root); return; }
    const orm = e.target.closest('[data-optrm]');
    if (orm) { if (await remove('option_lists', orm.dataset.optrm)) renderLists(root); }
  };
}
