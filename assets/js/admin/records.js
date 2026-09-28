/* 오리 어드민 — 레코드 작업대
   왼쪽: 목록(검색·보기·채울 것 필터·정렬), 오른쪽: 편집기.
   편집기의 값은 바꾸는 즉시 저장된다(자동 저장). 사진·연결(출연진, 배역, 창작진, 참여 이력)도 그 자리에서. */
import { sb, S, byId, IX, nameOf, firstImg, update, insert, remove, insertLink, removeLink, uploadPhoto,
  esc, $, $$, fmtDate, fmtWhen, toast, confirmDlg, promptDlg, dialog } from './lib.js?v=20260928s';
import { ENT, BOOL } from './schema.js?v=20260928s';

const LS = {};  // 목록 상태: table → {q, f, sort}
let CUR = { table: null, id: null, req: null };

/* ══════════ 진입 ══════════ */
export function showRecords(root, table, id, params) {
  const st = LS[table] = LS[table] || { q: '', f: '', sort: ENT[table].sort[0][0] };
  if (params && params.f != null) st.f = params.f;
  const same = root.dataset.view === 'rec:' + table;
  CUR = { table, id: id || null, req: (params && params.req) || null };
  if (!same) {
    root.dataset.view = 'rec:' + table;
    root.innerHTML = `<div class="rec">
      <aside class="rec-list">
        <div class="rl-head"><h2>${ENT[table].label} <span class="rl-total"></span></h2><button type="button" class="btn primary sm" data-act="new">＋ 새 ${ENT[table].label}</button></div>
        <input type="search" class="inp rl-q" placeholder="이름으로 찾기  ( / )" value="${esc(st.q)}">
        <div class="rl-filters"></div>
        <div class="rl-bar"><span class="rl-count"></span><select class="rl-sort">${ENT[table].sort.map(s => `<option value="${s[0]}">${s[1]}</option>`).join('')}</select></div>
        <div class="rl-items" tabindex="-1"></div>
      </aside>
      <section class="rec-edit"></section>
    </div>`;
    wireList(root, table);
  }
  $('.rl-sort', root).value = st.sort;
  // 필터 밖의 항목을 열면 목록 필터를 풀어서 목록에서도 보이게 한다
  if (id && (st.q || st.f) && !listRows(table).some(r => r.id === id)) { st.q = ''; st.f = ''; $('.rl-q', root).value = ''; }
  renderList(root, table);
  renderEditor(root);
}

/* ══════════ 목록 ══════════ */
function listRows(table) {
  const E = ENT[table], st = LS[table];
  let rows = S[table].slice();
  const q = st.q.trim().toLowerCase();
  if (q) rows = rows.filter(r => [r.title, r.name, r.title_en, r.name_en, r.nickname].some(v => v && String(v).toLowerCase().includes(q)));
  if (st.f) {
    const v = (E.views || []).find(x => x[0] === st.f), c = E.checks.find(x => x[0] === st.f);
    if (v) rows = rows.filter(v[2]); else if (c) rows = rows.filter(c[2]);
  }
  const s = E.sort.find(x => x[0] === st.sort) || E.sort[0];
  const nm = r => r.title || r.name || '';
  rows.sort(s[2] || ((a, b) => nm(a).localeCompare(nm(b), 'ko')));
  return rows;
}
function renderList(root, table) {
  const E = ENT[table], st = LS[table];
  $('.rl-total', root).textContent = S[table].length;
  const chips = [['', '전체', S[table].length]]
    .concat((E.views || []).map(v => [v[0], v[1], S[table].filter(v[2]).length]))
    .concat(E.checks.map(c => [c[0], c[1], S[table].filter(c[2]).length]).filter(c => c[2] || c[0] === st.f));
  $('.rl-filters', root).innerHTML = chips.map((c, i) => `<button type="button" class="chip${st.f === c[0] ? ' on' : ''}${i > (E.views || []).length ? ' warn' : ''}" data-f="${c[0]}">${c[1]} <b>${c[2]}</b></button>`).join('');
  const rows = listRows(table);
  $('.rl-count', root).textContent = rows.length + '개';
  const box = $('.rl-items', root);
  box.innerHTML = rows.length ? rows.map(r => rowHtml(table, r)).join('') : '<div class="empty">해당하는 항목이 없어요.</div>';
  markActive(root);
}
function rowHtml(table, r) {
  const E = ENT[table], img = firstImg(r, E.img);
  const warns = E.checks.filter(c => c[2](r)).map(c => c[1]);
  const badge = E.badge ? E.badge(r) : '';
  return `<button type="button" class="rl-row" data-id="${r.id}">
    ${img ? `<img class="th th-${E.shape}" src="${esc(img)}" alt="" loading="lazy">` : `<span class="th th-${E.shape} th-ph">${E.icon}</span>`}
    <span class="rl-main"><span class="rl-name">${esc(r.title || r.name || '(이름 없음)')}${badge ? ` <em class="pill pill-priv">${badge}</em>` : ''}</span><span class="rl-sub">${esc(E.sub(r))}</span></span>
    ${warns.length ? `<span class="rl-warn" title="${esc(warns.join(', '))}">${warns.length}</span>` : ''}
  </button>`;
}
function markActive(root) {
  $$('.rl-row', root).forEach(b => b.classList.toggle('on', b.dataset.id === CUR.id));
  const on = $('.rl-row.on', root); if (on) on.scrollIntoView({ block: 'nearest' });
}
function wireList(root, table) {
  const q = $('.rl-q', root);
  q.addEventListener('input', () => { LS[table].q = q.value; renderList(root, table); });
  $('.rl-sort', root).addEventListener('change', e => { LS[table].sort = e.target.value; renderList(root, table); });
  $('.rl-filters', root).addEventListener('click', e => { const c = e.target.closest('[data-f]'); if (!c) return; LS[table].f = c.dataset.f; renderList(root, table); });
  $('.rl-items', root).addEventListener('click', e => { const r = e.target.closest('.rl-row'); if (r) go(table, r.dataset.id); });
  $('.rl-head [data-act=new]', root).addEventListener('click', () => createNew(table));
}
export function listKeys(e) {
  const root = document.getElementById('main');
  if (!root || !root.dataset.view || !root.dataset.view.startsWith('rec:')) return;
  const table = root.dataset.view.slice(4);
  if (e.key === '/' && !isTyping(e)) { e.preventDefault(); $('.rl-q', root).focus(); return; }
  if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && (!isTyping(e) || e.target.classList.contains('rl-q'))) {
    const rows = $$('.rl-row', root); if (!rows.length) return;
    e.preventDefault();
    let i = rows.findIndex(b => b.dataset.id === CUR.id);
    i = e.key === 'ArrowDown' ? Math.min(rows.length - 1, i + 1) : Math.max(0, i - 1);
    go(table, rows[i].dataset.id, true);
  }
}
function isTyping(e) { return /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable; }
export function go(table, id, replace) {
  const h = '#/data/' + table + (id ? '/' + id : '');
  if (replace) history.replaceState(null, '', h); else history.pushState(null, '', h);
  window.dispatchEvent(new Event('ori:route'));
}

/* ══════════ 편집기 ══════════ */
function renderEditor(root) {
  // 매번 새 요소에 그리고 이벤트를 단다 (이전 것은 통째로 버려져 이벤트가 쌓이지 않는다)
  const host = $('.rec-edit', root), scroll = host.scrollTop, sameRec = host.dataset.rec === CUR.table + '/' + CUR.id;
  host.innerHTML = '<div class="ed-wrap"></div>'; host.dataset.rec = CUR.table + '/' + CUR.id;
  const box = host.firstChild, { table, id } = CUR, E = ENT[table];
  if (sameRec) requestAnimationFrame(() => { host.scrollTop = scroll; });
  markActive(root);
  if (!id) {
    box.innerHTML = `<div class="ed-empty"><div class="ed-empty-ic">${E.icon}</div><p>왼쪽에서 ${E.label}을 고르면 여기서 바로 고칠 수 있어요.</p><p class="hint">↑↓로 목록을 오가고, / 로 검색해요.</p></div>`;
    return;
  }
  const r = byId[table].get(id);
  if (!r) { box.innerHTML = `<div class="ed-empty"><p>이 ${E.label}을 찾을 수 없어요. 지워졌을 수 있어요.</p></div>`; return; }
  const img = firstImg(r, E.img), warns = E.checks.filter(c => c[2](r));
  const badge = E.badge ? E.badge(r) : '';
  box.innerHTML = `
    <div class="ed-req" hidden></div>
    <header class="ed-head">
      <button type="button" class="ed-photo ph-${E.shape}" data-act="photos" title="사진 관리">${img ? `<img src="${esc(img)}" alt="">` : `<span>${E.icon}<small>사진 추가</small></span>`}</button>
      <div class="ed-titles">
        <div class="ed-kind">${E.icon} ${E.label}${badge ? ` <em class="pill pill-priv">사이트 비공개 · ${badge}</em>` : ''}<span id="save-state" class="save-state"></span></div>
        <input class="ed-title" data-col="${E.fields[0][0]}" value="${esc(r[E.fields[0][0]] || '')}" placeholder="${E.fields[0][1]}">
        <div class="ed-meta">${esc(E.sub(r))}</div>
      </div>
      <div class="ed-acts">
        <a class="btn ghost sm" href="gongyon-db.html#${E.site}-${r.id}" target="_blank" rel="noopener">사이트에서 보기 ↗</a>
        <button type="button" class="btn ghost sm danger" data-act="delete">삭제</button>
      </div>
    </header>
    ${warns.length ? `<div class="ed-warns"><span>채울 것</span>${warns.map(c => `<button type="button" class="chip warn" data-jump="${c[0]}">${c[1]}</button>`).join('')}</div>` : ''}
    <section class="ed-sec"><h3>기본 정보</h3><div class="props">${E.fields.slice(1).map(f => propRow(f, r)).join('')}</div></section>
    <section class="ed-sec" data-sec="photos"><h3>사진 <small>${(r[E.img] || []).length}</small></h3>${photosHtml(r[E.img] || [], E.shape)}</section>
    ${relHtml(table, r)}
  `;
  wireEditor(box, table, r);
  if (CUR.req) loadRequestBanner(box, CUR.req);
}

/* ── 값 입력 ── */
function eqv(a, b) { return String(a == null ? '' : a) === String(b == null ? '' : b); }
function propRow(f, r) {
  const [col, label, type, opts] = f, v = r[col];
  let ctl;
  if (type === 'textarea') ctl = `<textarea class="inp" data-col="${col}" rows="3">${esc(v || '')}</textarea>`;
  else if (type === 'bool' || type === 'seg') {
    const o = type === 'bool' ? BOOL : opts;
    ctl = `<div class="seg" data-col="${col}">${o.map(x => `<button type="button" data-v='${JSON.stringify(x[0])}' class="${eqv(v, x[0]) || (x[0] === false && v == null && col === 'is_hidden') ? 'on' : ''}">${esc(x[1])}</button>`).join('')}</div>`;
  } else if (type === 'suggest') {
    const vals = [...new Set([...(opts || []), ...S.works.map(w => w.genre).filter(Boolean)])];
    ctl = `<input class="inp" data-col="${col}" value="${esc(v || '')}" list="dl-${col}"><datalist id="dl-${col}">${vals.map(x => `<option value="${esc(x)}">`).join('')}</datalist>`;
  } else if (type.startsWith('fk:')) {
    const t = type.slice(3);
    ctl = `<div class="fk" data-col="${col}" data-fk="${t}"><button type="button" class="fk-btn${v ? '' : ' empty'}" data-act="fk">${v ? esc(nameOf(t, v) || '(목록에 없음)') : '고르기…'}</button>${v ? `<button type="button" class="icon-btn" data-act="fk-open" title="열기">↗</button><button type="button" class="icon-btn" data-act="fk-clear" title="연결 끊기">✕</button>` : ''}</div>`;
  } else if (type.startsWith('tags:')) {
    ctl = `<div class="tags" data-col="${col}" data-cat="${type.slice(5)}">${(v || []).map((x, i) => `<span class="tag">${esc(x)}<button type="button" data-rm="${i}">✕</button></span>`).join('')}<input class="tag-in" placeholder="${(v || []).length ? '＋' : '입력 후 Enter'}" list="dl-tag-${col}"><datalist id="dl-tag-${col}">${tagOptions(type.slice(5), col).map(x => `<option value="${esc(x)}">`).join('')}</datalist></div>`;
  } else if (type === 'links') {
    const L = Array.isArray(v) ? v : [];
    ctl = `<div class="links" data-col="${col}">${L.map((l, i) => linkRow(l, i)).join('')}<button type="button" class="btn ghost xs" data-act="link-add">＋ 링크</button></div>`;
  } else ctl = `<input class="inp" type="${type === 'number' ? 'number' : type === 'date' ? 'date' : 'text'}" data-col="${col}" value="${esc(v == null ? '' : v)}">`;
  return `<div class="prop" data-prop="${col}"><label>${label}</label><div class="prop-v">${ctl}</div></div>`;
}
function linkRow(l, i) { return `<div class="link-row" data-i="${i}"><input class="inp" data-k="label" placeholder="이름" value="${esc(l.label || '')}"><input class="inp" data-k="url" placeholder="https://" value="${esc(l.url || '')}"><button type="button" class="icon-btn" data-act="link-rm">✕</button></div>`; }
function tagOptions(cat, col) {
  const used = new Set(); Object.values(S).forEach(() => {}); // noop
  const table = CUR.table; (S[table] || []).forEach(r => (r[col] || []).forEach(x => used.add(x)));
  return [...new Set([...(IX.options[cat] || []), ...used])];
}
function readVal(f, el) {
  const type = f[2], v = el.value;
  if (v === '') return null;
  if (type === 'number') { const n = Number(v); return isNaN(n) ? null : n; }
  return v;
}

/* ── 사진 ── */
function photosHtml(urls, shape) {
  return `<div class="photos">${urls.map((u, i) => `<figure class="ph ph-${shape}${i === 0 ? ' main' : ''}" data-i="${i}"><img src="${esc(u)}" alt="" loading="lazy">
    ${i === 0 ? '<span class="ph-tag">대표</span>' : `<button type="button" class="ph-btn ph-main" data-act="ph-main">대표로</button>`}
    <button type="button" class="ph-btn ph-rm" data-act="ph-rm" title="빼기">✕</button></figure>`).join('')}
    <label class="ph-add">＋ 사진 올리기<small>여러 장 가능 · 끌어다 놓아도 돼요</small><input type="file" accept="image/*" multiple hidden></label></div>`;
}

/* ══════════ 연결된 데이터 ══════════ */
const byOrder = (a, b) => (a.order_num ?? 999) - (b.order_num ?? 999);
function link(table, id, label) { return id ? `<a class="lnk" href="#/data/${table}/${id}">${esc(label || nameOf(table, id) || '(이름 없음)')}</a>` : '<span class="muted">—</span>'; }
function relHtml(table, r) {
  if (table === 'shows') {
    const phs = IX.phByShow.get(r.id) || [];
    const cast = [], staff = [], bare = [];
    phs.forEach(ph => {
      const rl = IX.prByPh.get(ph.id) || [], sr = IX.psrByPh.get(ph.id) || [];
      rl.forEach(x => cast.push({ ph, role: byId.roles.get(x.role_id) }));
      sr.forEach(x => staff.push({ ph, sr: byId.staff_roles.get(x.staff_role_id) }));
      if (!rl.length && !sr.length) bare.push(ph);
    });
    cast.sort((a, b) => byOrder(a.role || {}, b.role || {}));
    staff.sort((a, b) => byOrder(a.sr || {}, b.sr || {}));
    const wr = (IX.rolesByWork.get(r.work_id) || []).slice().sort(byOrder);
    const castRoleIds = new Set(cast.map(c => c.role && c.role.id));
    const emptyRoles = wr.filter(x => !castRoleIds.has(x.id));
    return `<section class="ed-sec"><h3>출연진 <small>${cast.length}</small></h3>
      ${!r.work_id ? '<p class="hint">작품을 먼저 연결하면 그 작품의 배역에서 고를 수 있어요.</p>' : ''}
      <table class="rel"><tbody>${cast.map(c => `<tr><td class="w-role">${c.role ? link('roles', c.role.id) : '<span class="muted">배역 미정</span>'}</td><td>${link('people', c.ph.person_id)}</td>
        <td class="w-x"><button type="button" class="icon-btn" data-act="cast-rm" data-ph="${c.ph.id}" data-role="${c.role ? c.role.id : ''}" title="빼기">✕</button></td></tr>`).join('')}
      ${emptyRoles.map(x => `<tr class="gap"><td class="w-role">${link('roles', x.id)}</td><td><button type="button" class="btn ghost xs" data-act="cast-fill" data-role="${x.id}">＋ 배우 넣기</button></td><td></td></tr>`).join('')}
      </tbody></table>
      <button type="button" class="btn ghost sm" data-act="cast-add">＋ 출연진 추가</button></section>
      <section class="ed-sec"><h3>제작진 <small>${staff.length}</small></h3>
      <table class="rel"><tbody>${staff.map(c => `<tr><td class="w-role">${esc(c.sr ? c.sr.name : '역할 미정')}</td><td>${link('people', c.ph.person_id)}</td>
        <td class="w-x"><button type="button" class="icon-btn" data-act="staff-rm" data-ph="${c.ph.id}" data-sr="${c.sr ? c.sr.id : ''}" title="빼기">✕</button></td></tr>`).join('')}</tbody></table>
      <button type="button" class="btn ghost sm" data-act="staff-add">＋ 제작진 추가</button></section>
      ${bare.length ? `<section class="ed-sec"><h3>역할이 없는 참여 <small>${bare.length}</small></h3><p class="hint">배역도 스텝 역할도 없이 이름만 걸린 기록이에요. 정리하거나 지워주세요.</p>
        <table class="rel"><tbody>${bare.map(ph => `<tr><td>${link('people', ph.person_id)}</td><td class="w-x"><button type="button" class="icon-btn" data-act="ph-del" data-ph="${ph.id}">✕</button></td></tr>`).join('')}</tbody></table></section>` : ''}`;
  }
  if (table === 'works') {
    const roles = (IX.rolesByWork.get(r.id) || []).slice().sort(byOrder);
    const chs = IX.chByWork.get(r.id) || [];
    const shows = (IX.showsByWork.get(r.id) || []).slice().sort((a, b) => String(b.show_date || '').localeCompare(String(a.show_date || '')));
    return `<section class="ed-sec"><h3>등장인물 <small>${roles.length}</small></h3>
      <table class="rel rel-roles"><thead><tr><th>순서</th><th>배역</th><th>성별</th><th>출연</th><th></th></tr></thead><tbody>${roles.map(x => `<tr data-role="${x.id}">
        <td class="w-num"><input class="inp xs" type="number" data-rcol="order_num" value="${x.order_num ?? ''}"></td>
        <td><input class="inp xs" data-rcol="name" value="${esc(x.name)}"></td>
        <td><div class="seg xs" data-rcol="gender">${[['', '—'], ['남', '남'], ['여', '여']].map(o => `<button type="button" data-v='${JSON.stringify(o[0])}' class="${eqv(x.gender, o[0]) ? 'on' : ''}">${o[1]}</button>`).join('')}</div></td>
        <td class="muted">${(IX.prByRole.get(x.id) || []).length}</td>
        <td class="w-x"><a class="icon-btn" href="#/data/roles/${x.id}" title="배역 열기">↗</a><button type="button" class="icon-btn" data-act="role-del" data-role="${x.id}" title="지우기">✕</button></td></tr>`).join('')}</tbody></table>
      <button type="button" class="btn ghost sm" data-act="role-add">＋ 배역 추가</button></section>
      <section class="ed-sec"><h3>창작진 <small>${chs.length}</small></h3>
      <table class="rel"><tbody>${chs.map(c => `<tr><td class="w-role">${esc(nameOf('creation_types', c.creation_type_id) || '역할 미정')}</td><td>${link('people', c.person_id)}</td>
        <td class="w-x"><button type="button" class="icon-btn" data-act="ch-rm" data-ch="${c.id}">✕</button></td></tr>`).join('')}</tbody></table>
      <button type="button" class="btn ghost sm" data-act="ch-add">＋ 창작진 추가</button></section>
      ${showListHtml(shows, 'work_id')}`;
  }
  if (table === 'roles') {
    const links = IX.prByRole.get(r.id) || [];
    const rows = links.map(x => S.participation_history.find(p => p.id === x.participation_id)).filter(Boolean);
    const sib = (IX.rolesByWork.get(r.work_id) || []).filter(x => x.id !== r.id).sort(byOrder);
    return `<section class="ed-sec"><h3>맡은 사람 <small>${rows.length}</small></h3>
      <table class="rel"><tbody>${rows.map(ph => `<tr><td>${link('people', ph.person_id)}</td><td>${link('shows', ph.show_id)}</td><td class="muted">${fmtDate((byId.shows.get(ph.show_id) || {}).show_date)}</td></tr>`).join('') || '<tr><td class="muted">아직 없어요. 공연 화면의 출연진에서 넣어요.</td></tr>'}</tbody></table></section>
      ${sib.length ? `<section class="ed-sec"><h3>같은 작품의 다른 배역</h3><div class="chips-row">${sib.map(x => `<a class="chip" href="#/data/roles/${x.id}">${esc(x.name)}</a>`).join('')}</div></section>` : ''}`;
  }
  if (table === 'people') {
    const phs = (IX.phByPerson.get(r.id) || []).slice().sort((a, b) => String((byId.shows.get(b.show_id) || {}).show_date || '').localeCompare(String((byId.shows.get(a.show_id) || {}).show_date || '')));
    const chs = IX.chByPerson.get(r.id) || [];
    return `<section class="ed-sec"><h3>참여 이력 <small>${phs.length}</small></h3>
      <table class="rel"><tbody>${phs.map(ph => {
        const rl = (IX.prByPh.get(ph.id) || []).map(x => nameOf('roles', x.role_id) + ' 역');
        const sr = (IX.psrByPh.get(ph.id) || []).map(x => nameOf('staff_roles', x.staff_role_id));
        return `<tr><td>${link('shows', ph.show_id)}</td><td class="muted">${fmtDate((byId.shows.get(ph.show_id) || {}).show_date)}</td><td>${esc([...rl, ...sr].join(', ') || '역할 없음')}</td>
          <td class="w-x"><button type="button" class="icon-btn" data-act="ph-del" data-ph="${ph.id}" title="이 이력 지우기">✕</button></td></tr>`;
      }).join('')}</tbody></table>
      <button type="button" class="btn ghost sm" data-act="hist-add">＋ 이력 추가</button></section>
      <section class="ed-sec"><h3>창작 이력 <small>${chs.length}</small></h3>
      <table class="rel"><tbody>${chs.map(c => `<tr><td>${link('works', c.work_id)}</td><td class="muted">${esc(nameOf('creation_types', c.creation_type_id) || '')}</td>
        <td class="w-x"><button type="button" class="icon-btn" data-act="ch-rm" data-ch="${c.id}">✕</button></td></tr>`).join('')}</tbody></table>
      <button type="button" class="btn ghost sm" data-act="pch-add">＋ 창작 이력 추가</button></section>`;
  }
  if (table === 'troupes') return showListHtml((IX.showsByTroupe.get(r.id) || []).slice().sort((a, b) => String(b.show_date || '').localeCompare(String(a.show_date || ''))), 'troupe_id');
  if (table === 'venues') return showListHtml((IX.showsByVenue.get(r.id) || []).slice().sort((a, b) => String(b.show_date || '').localeCompare(String(a.show_date || ''))), 'venue_id');
  return '';
}
function showListHtml(shows, col) {
  return `<section class="ed-sec"><h3>공연 <small>${shows.length}</small></h3>
    <table class="rel"><tbody>${shows.map(s => `<tr><td>${link('shows', s.id)} ${ENT.shows.badge(s) ? `<em class="pill pill-priv">${ENT.shows.badge(s)}</em>` : ''}</td><td class="muted">${fmtDate(s.show_date)}</td><td class="muted">${esc(col === 'troupe_id' ? nameOf('venues', s.venue_id) : nameOf('troupes', s.troupe_id))}</td></tr>`).join('')}</tbody></table>
    <button type="button" class="btn ghost sm" data-act="show-new" data-col="${col}">＋ 여기에 새 공연</button></section>`;
}

/* ══════════ 편집기 동작 ══════════ */
function refresh() { const root = document.getElementById('main'); renderList(root, CUR.table); renderEditor(root); }
async function setField(table, id, col, val) {
  const r = byId[table].get(id);
  if (r && eqv(r[col], val) && !Array.isArray(val)) return;
  if (col === ENT[table].fields[0][0] && !val) { toast(ENT[table].fields[0][1] + '은 비울 수 없어요.', 'err'); refresh(); return; }
  if (await update(table, id, { [col]: val })) refresh();
}
function wireEditor(box, table, r) {
  const E = ENT[table], id = r.id;
  // 텍스트·숫자·날짜: 바뀌면 저장
  box.addEventListener('change', e => {
    const el = e.target;
    if (el.matches('.ed-title, .prop .inp[data-col]')) {
      const f = E.fields.find(x => x[0] === el.dataset.col);
      setField(table, id, el.dataset.col, readVal(f, el));
    } else if (el.matches('[data-rcol]')) {
      const rid = el.closest('[data-role]').dataset.role, c = el.dataset.rcol;
      let v = el.value === '' ? null : (c === 'order_num' ? Number(el.value) : el.value);
      if (c === 'name' && !v) { toast('배역명은 비울 수 없어요.', 'err'); refresh(); return; }
      update('roles', rid, { [c]: v }).then(ok => ok && c === 'order_num' && refresh());
    } else if (el.matches('.links .inp')) saveLinks(el.closest('.links'));
  });
  box.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.matches('.ed-title, .prop input.inp, [data-rcol]')) { e.preventDefault(); e.target.blur(); }
    if (e.key === 'Enter' && e.target.matches('.tag-in')) { e.preventDefault(); addTag(e.target); }
    if (e.key === 'Backspace' && e.target.matches('.tag-in') && !e.target.value) { const t = e.target.closest('.tags'); const last = $$('[data-rm]', t).pop(); if (last) last.click(); }
  });
  box.addEventListener('focusout', e => { if (e.target.matches('.tag-in') && e.target.value.trim()) addTag(e.target); });
  box.addEventListener('click', async e => {
    const seg = e.target.closest('.seg button');
    if (seg) {
      const s = seg.closest('.seg'), v = JSON.parse(seg.dataset.v);
      if (s.dataset.col) return setField(table, id, s.dataset.col, v === '' ? null : v);
      const rid = s.closest('[data-role]').dataset.role;
      if (await update('roles', rid, { gender: v || null })) refresh();
      return;
    }
    const rmTag = e.target.closest('.tags [data-rm]');
    if (rmTag) { const t = rmTag.closest('.tags'), arr = (r[t.dataset.col] || []).slice(); arr.splice(+rmTag.dataset.rm, 1); return setField(table, id, t.dataset.col, arr.length ? arr : null); }
    const a = e.target.closest('[data-act]'); if (!a) return;
    const act = a.dataset.act;
    if (act === 'photos') return $('[data-sec=photos]', box).scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (act === 'delete') return deleteRecord(table, r);
    if (act === 'fk') { const fk = a.closest('.fk'); return pickFk(a, fk.dataset.fk, v => setField(table, id, fk.dataset.col, v)); }
    if (act === 'fk-clear') return setField(table, id, a.closest('.fk').dataset.col, null);
    if (act === 'fk-open') { const fk = a.closest('.fk'); return go(fk.dataset.fk, r[fk.dataset.col]); }
    if (act === 'link-add') { const L = a.closest('.links'); a.insertAdjacentHTML('beforebegin', linkRow({}, $$('.link-row', L).length)); $$('.link-row input', L).slice(-2)[0].focus(); return; }
    if (act === 'link-rm') { const L = a.closest('.links'); a.closest('.link-row').remove(); return saveLinks(L); }
    if (act === 'ph-rm' || act === 'ph-main') {
      const i = +a.closest('.ph').dataset.i, urls = (r[E.img] || []).slice();
      if (act === 'ph-rm') { if (!(await confirmDlg('이 사진을 뺄까요?', '저장소의 파일은 남아요.'))) return; urls.splice(i, 1); }
      else urls.unshift(urls.splice(i, 1)[0]);
      return setField(table, id, E.img, urls.length ? urls : null);
    }
    return relAction(act, a, table, r);
  });
  // 사진 올리기 (고르기·끌어 놓기)
  const add = $('.ph-add', box), fileIn = $('.ph-add input', box);
  fileIn.addEventListener('change', () => uploadFiles(table, id, [...fileIn.files]));
  const sec = $('[data-sec=photos]', box);
  sec.addEventListener('dragover', e => { e.preventDefault(); add.classList.add('drag'); });
  sec.addEventListener('dragleave', () => add.classList.remove('drag'));
  sec.addEventListener('drop', e => { e.preventDefault(); add.classList.remove('drag'); uploadFiles(table, id, [...e.dataTransfer.files].filter(f => f.type.startsWith('image/'))); });
  // 채울 것 → 해당 칸으로
  box.addEventListener('click', e => {
    const j = e.target.closest('[data-jump]'); if (!j) return;
    const map = { nolicense: 'is_licensed', nowork: 'work_id', nodate: 'show_date', notroupe: 'troupe_id', novenue: 'venue_id', norights: 'rights_type', nogenre: 'genre', nogender: 'gender', noregion: 'region', noaddr: 'address', noseat: 'seat_count', noposter: null, nophoto: null };
    const col = map[j.dataset.jump];
    const target = col ? $(`[data-prop="${col}"]`, box) : (j.dataset.jump.startsWith('no') && /photo|poster/.test(j.dataset.jump) ? $('[data-sec=photos]', box) : null) || $$('.ed-sec', box).find(s => /출연진|창작진|등장인물|참여/.test(s.textContent));
    if (target) { target.scrollIntoView({ behavior: 'smooth', block: 'center' }); target.classList.add('flash'); setTimeout(() => target.classList.remove('flash'), 1200); }
  });
}
function addTag(inp) {
  const t = inp.closest('.tags'), v = inp.value.trim(); if (!v) return;
  const r = byId[CUR.table].get(CUR.id), arr = (r[t.dataset.col] || []).slice();
  inp.value = '';
  if (arr.includes(v)) return;
  arr.push(v); setField(CUR.table, CUR.id, t.dataset.col, arr);
}
function saveLinks(L) {
  const links = $$('.link-row', L).map(row => ({ label: $('[data-k=label]', row).value.trim(), url: $('[data-k=url]', row).value.trim() })).filter(l => l.url);
  setField(CUR.table, CUR.id, L.dataset.col, links);
}
async function uploadFiles(table, id, files) {
  if (!files.length) return;
  const E = ENT[table], r = byId[table].get(id), urls = (r[E.img] || []).slice();
  toast('사진 올리는 중… (' + files.length + '장)');
  for (const f of files) { const u = await uploadPhoto(E.site, f); if (u) urls.push(u); }
  await setField(table, id, E.img, urls.length ? urls : null);
}

/* ── 고르기 창 (검색해서 하나 고르기, 없으면 새로 만들기) ── */
export function picker(anchor, { items, placeholder, onPick, createLabel, onCreate, emptyText }) {
  $$('.pk').forEach(p => p.remove());
  const pk = document.createElement('div'); pk.className = 'pk';
  pk.innerHTML = `<input class="inp" placeholder="${esc(placeholder || '검색')}"><div class="pk-list"></div>`;
  document.body.appendChild(pk);
  const rect = anchor.getBoundingClientRect();
  pk.style.left = Math.min(rect.left, window.innerWidth - 340) + 'px';
  const below = window.innerHeight - rect.bottom > 320;
  pk.style.top = (below ? rect.bottom + 4 : Math.max(8, rect.top - 324)) + 'px';
  const inp = $('input', pk), list = $('.pk-list', pk);
  let hits = [], idx = 0;
  function draw() {
    const q = inp.value.trim().toLowerCase();
    hits = items.filter(it => !q || (it.label + ' ' + (it.sub || '')).toLowerCase().includes(q)).slice(0, 60);
    const extra = onCreate && q ? [{ create: true, label: (createLabel || '새로 만들기') + ': "' + inp.value.trim() + '"' }] : [];
    hits = hits.concat(extra);
    idx = Math.min(idx, Math.max(0, hits.length - 1));
    list.innerHTML = hits.length ? hits.map((h, i) => `<button type="button" class="pk-it${i === idx ? ' on' : ''}${h.create ? ' pk-new' : ''}" data-i="${i}">${h.create ? '＋ ' : ''}${esc(h.label)}${h.sub ? `<small>${esc(h.sub)}</small>` : ''}</button>`).join('') : `<div class="pk-empty">${esc(emptyText || '없어요')}</div>`;
  }
  function choose(i) { const h = hits[i]; if (!h) return; close(); if (h.create) onCreate(inp.value.trim()); else onPick(h.id, h); }
  function close() { pk.remove(); document.removeEventListener('mousedown', outside, true); }
  function outside(e) { if (!pk.contains(e.target)) close(); }
  inp.addEventListener('input', () => { idx = 0; draw(); });
  inp.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); idx = Math.min(hits.length - 1, idx + 1); draw(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); idx = Math.max(0, idx - 1); draw(); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(idx); }
    else if (e.key === 'Escape') { e.stopPropagation(); close(); }
  });
  list.addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (b) choose(+b.dataset.i); });
  setTimeout(() => document.addEventListener('mousedown', outside, true));
  draw(); inp.focus();
}
function itemsOf(table) {
  const E = ENT[table];
  return S[table].map(r => ({ id: r.id, label: r.title || r.name || '', sub: E ? E.sub(r) : '' })).sort((a, b) => a.label.localeCompare(b.label, 'ko'));
}
function pickFk(anchor, t, done) {
  picker(anchor, { items: itemsOf(t), placeholder: ENT[t].label + ' 찾기', onPick: id => done(id), createLabel: '새 ' + ENT[t].label,
    onCreate: async name => { const row = await insert(t, { [ENT[t].fields[0][0]]: name }); if (row) { toast('새 ' + ENT[t].label + '을 만들었어요'); done(row.id); } } });
}
function pickPerson(anchor, done) {
  picker(anchor, { items: itemsOf('people'), placeholder: '사람 이름', createLabel: '새 사람', onPick: id => done(id),
    onCreate: async name => { const p = await insert('people', { name }); if (p) done(p.id); } });
}

/* ── 연결 동작 ── */
async function ensurePh(showId, personId, roleType) {
  const ex = S.participation_history.find(p => p.show_id === showId && p.person_id === personId);
  return ex || insert('participation_history', { show_id: showId, person_id: personId, role_type: roleType });
}
async function cleanupPh(phId) {
  if ((IX.prByPh.get(phId) || []).length || (IX.psrByPh.get(phId) || []).length) return;
  await remove('participation_history', phId);
}
async function relAction(act, a, table, r) {
  if (act === 'cast-add' || act === 'cast-fill') {
    const wr = (IX.rolesByWork.get(r.work_id) || []).slice().sort(byOrder);
    const withRole = async (pid, roleId) => { const ph = await ensurePh(r.id, pid, '배우'); if (ph && roleId) await insertLink('participation_roles', { participation_id: ph.id, role_id: roleId }); refresh(); toast('출연진에 넣었어요'); };
    if (act === 'cast-fill') return pickPerson(a, pid => withRole(pid, a.dataset.role));
    return pickPerson(a, pid => {
      picker(a, { items: wr.map(x => ({ id: x.id, label: x.name, sub: x.gender || '' })).concat([{ id: '', label: '배역 미정' }]), placeholder: nameOf('people', pid) + ' — 어떤 배역?',
        createLabel: '새 배역', onCreate: r.work_id ? async name => { const nr = await insert('roles', { name, work_id: r.work_id, order_num: wr.length + 1 }); if (nr) withRole(pid, nr.id); } : null,
        onPick: rid => withRole(pid, rid) });
    });
  }
  if (act === 'staff-add') {
    return pickPerson(a, pid => {
      picker(a, { items: S.staff_roles.slice().sort(byOrder).map(x => ({ id: x.id, label: x.name })), placeholder: nameOf('people', pid) + ' — 어떤 역할?',
        createLabel: '새 스텝 역할', onCreate: async name => { const ns = await insert('staff_roles', { name, order_num: S.staff_roles.length + 1 }); if (ns) go2(ns.id); },
        onPick: go2 });
      async function go2(srid) { const ph = await ensurePh(r.id, pid, '스텝'); if (ph) await insertLink('participation_staff_roles', { participation_id: ph.id, staff_role_id: srid }); refresh(); toast('제작진에 넣었어요'); }
    });
  }
  if (act === 'cast-rm' || act === 'staff-rm') {
    const ph = byId.participation_history.get(a.dataset.ph); if (!ph) return;
    const what = act === 'cast-rm' ? (a.dataset.role ? nameOf('roles', a.dataset.role) + ' 역' : '출연진') : (nameOf('staff_roles', a.dataset.sr) || '제작진');
    if (!(await confirmDlg(nameOf('people', ph.person_id) + ' — ' + what + '에서 뺄까요?'))) return;
    if (act === 'cast-rm' && a.dataset.role) await removeLink('participation_roles', { participation_id: ph.id, role_id: a.dataset.role });
    if (act === 'staff-rm' && a.dataset.sr) await removeLink('participation_staff_roles', { participation_id: ph.id, staff_role_id: a.dataset.sr });
    await cleanupPh(ph.id); refresh(); return;
  }
  if (act === 'ph-del') {
    const ph = byId.participation_history.get(a.dataset.ph); if (!ph) return;
    if (!(await confirmDlg('이 참여 이력을 지울까요?', nameOf('people', ph.person_id) + ' · ' + nameOf('shows', ph.show_id), true))) return;
    await delPh(ph.id); refresh(); return;
  }
  if (act === 'hist-add') {
    return picker(a, { items: itemsOf('shows'), placeholder: '어느 공연?', onPick: sid => {
      const s = byId.shows.get(sid), wr = (IX.rolesByWork.get(s.work_id) || []).slice().sort(byOrder);
      const items = wr.map(x => ({ id: 'r:' + x.id, label: x.name + ' 역', sub: '배우' })).concat(S.staff_roles.slice().sort(byOrder).map(x => ({ id: 's:' + x.id, label: x.name, sub: '제작진' })));
      picker(a, { items, placeholder: nameOf('shows', sid) + ' — 무엇으로?', onPick: async k => {
        const actor = k.startsWith('r:'), ph = await ensurePh(sid, r.id, actor ? '배우' : '스텝'); if (!ph) return;
        if (actor) await insertLink('participation_roles', { participation_id: ph.id, role_id: k.slice(2) });
        else await insertLink('participation_staff_roles', { participation_id: ph.id, staff_role_id: k.slice(2) });
        refresh(); toast('이력을 넣었어요');
      } });
    } });
  }
  if (act === 'role-add') {
    const name = await promptDlg('새 배역 이름'); if (!name) return;
    const n = (IX.rolesByWork.get(r.id) || []).reduce((m, x) => Math.max(m, x.order_num || 0), 0);
    if (await insert('roles', { name, work_id: r.id, order_num: n + 1 })) refresh();
    return;
  }
  if (act === 'role-del') {
    const rid = a.dataset.role, used = (IX.prByRole.get(rid) || []).length;
    if (used) { toast(`이 배역을 ${used}명이 맡은 기록이 있어요. 공연 출연진에서 먼저 빼주세요.`, 'err'); return; }
    if (!(await confirmDlg(nameOf('roles', rid) + ' 배역을 지울까요?', '', true))) return;
    if (await remove('roles', rid, '이 배역')) refresh();
    return;
  }
  if (act === 'ch-add' || act === 'pch-add') {
    const withType = (wid, pid) => picker(a, { items: S.creation_types.map(t => ({ id: t.id, label: t.name })).concat([{ id: '', label: '역할 미정' }]), placeholder: '어떤 역할?',
      onPick: async ct => { if (await insert('creation_history', { work_id: wid, person_id: pid, creation_type_id: ct || null })) { refresh(); toast('창작 이력을 넣었어요'); } } });
    if (act === 'ch-add') return pickPerson(a, pid => withType(r.id, pid));
    return picker(a, { items: itemsOf('works'), placeholder: '어느 작품?', onPick: wid => withType(wid, r.id) });
  }
  if (act === 'ch-rm') {
    if (!(await confirmDlg('이 창작 이력을 지울까요?'))) return;
    if (await remove('creation_history', a.dataset.ch)) refresh();
    return;
  }
  if (act === 'show-new') {
    const title = await promptDlg('새 공연 이름', table === 'works' ? r.title : ''); if (!title) return;
    const s = await insert('shows', { title, [a.dataset.col]: r.id }); if (s) go('shows', s.id);
  }
}
async function delPh(phId) {
  for (const x of (IX.prByPh.get(phId) || []).slice()) await removeLink('participation_roles', { participation_id: phId, role_id: x.role_id });
  for (const x of (IX.psrByPh.get(phId) || []).slice()) await removeLink('participation_staff_roles', { participation_id: phId, staff_role_id: x.staff_role_id });
  await remove('participation_history', phId);
}

/* ── 새로 만들기 / 지우기 ── */
async function createNew(table) {
  const E = ENT[table];
  if (table === 'roles') {
    return picker($('.rl-head [data-act=new]'), { items: itemsOf('works'), placeholder: '어느 작품의 배역?', onPick: async wid => {
      const name = await promptDlg('새 배역 이름'); if (!name) return;
      const n = (IX.rolesByWork.get(wid) || []).reduce((m, x) => Math.max(m, x.order_num || 0), 0);
      const row = await insert('roles', { name, work_id: wid, order_num: n + 1 }); if (row) go('roles', row.id);
    } });
  }
  const name = await promptDlg('새 ' + E.label + ' — ' + E.fields[0][1]); if (!name) return;
  const dup = S[table].find(r => (r.title || r.name) === name);
  if (dup && !(await confirmDlg('같은 이름이 이미 있어요', '"' + name + '"이(가) 이미 있어요. 그래도 새로 만들까요?'))) { go(table, dup.id); return; }
  const row = await insert(table, { [E.fields[0][0]]: name });
  if (row) { toast('새 ' + E.label + '을 만들었어요'); go(table, row.id); }
}
async function deleteRecord(table, r) {
  const E = ENT[table], name = r.title || r.name;
  if (table === 'shows' || table === 'people') {
    const phs = (table === 'shows' ? IX.phByShow : IX.phByPerson).get(r.id) || [];
    if (!(await confirmDlg(`"${name}" ${E.label}을 지울까요?`, phs.length ? `참여 이력 ${phs.length}건도 함께 지워져요. 되돌릴 수 없어요.` : '되돌릴 수 없어요.', true))) return;
    for (const ph of phs.slice()) await delPh(ph.id);
    if (table === 'people') for (const c of (IX.chByPerson.get(r.id) || []).slice()) await remove('creation_history', c.id);
  } else if (!(await confirmDlg(`"${name}" ${E.label}을 지울까요?`, '되돌릴 수 없어요.', true))) return;
  if (await remove(table, r.id, '이 ' + E.label)) { toast('지웠어요'); go(table, null, true); }
}

/* ── 수정 요청에서 넘어온 경우: 요청 내용과 완료/반려 버튼 ── */
async function loadRequestBanner(box, reqId) {
  const { data } = await sb.from('edit_requests').select('*').eq('id', reqId).maybeSingle();
  const el = $('.ed-req', box); if (!data || !el) return;
  el.hidden = false;
  el.innerHTML = `<div><b>수정 요청</b> · ${esc(data.summary || '')}<span class="muted"> · ${fmtWhen(data.created_at)}</span></div>
    ${data.details ? `<div class="ed-req-d">${esc(data.details)}</div>` : ''}
    ${data.status === 'pending' ? `<div class="ed-req-a"><span class="hint">아래에서 고친 뒤 처리해주세요</span><button type="button" class="btn primary sm" data-req="done">반영 완료</button><button type="button" class="btn ghost sm" data-req="rejected">반려</button></div>` : `<div class="muted">처리됨: ${data.status === 'done' ? '완료' : '반려'}</div>`}`;
  el.addEventListener('click', async e => {
    const b = e.target.closest('[data-req]'); if (!b) return;
    const u = (await sb.auth.getUser()).data.user;
    const { error } = await sb.from('edit_requests').update({ status: b.dataset.req, reviewed_by: u && u.id, reviewed_at: new Date().toISOString() }).eq('id', reqId);
    if (error) { toast(error.message, 'err'); return; }
    toast(b.dataset.req === 'done' ? '요청을 완료로 처리했어요' : '반려했어요');
    window.dispatchEvent(new Event('ori:badges'));
    el.innerHTML = `<div class="muted">처리됨: ${b.dataset.req === 'done' ? '완료' : '반려'} · <a class="lnk" href="#/requests/edits">요청 목록으로</a></div>`;
  });
}

/* ── 전체 검색 (Ctrl/⌘+K) ── */
export function openSearch() {
  const items = [];
  Object.keys(ENT).forEach(t => S[t].forEach(r => items.push({ id: t + '/' + r.id, label: r.title || r.name || '', sub: ENT[t].icon + ' ' + ENT[t].label + (ENT[t].sub(r) ? ' · ' + ENT[t].sub(r) : '') })));
  const anchor = document.getElementById('side-search');
  picker(anchor, { items, placeholder: '공연·작품·배역·사람·단체·극장 찾기', emptyText: '찾는 게 없어요', onPick: k => { const [t, id] = k.split('/'); go(t, id); } });
}
