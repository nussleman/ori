/* 오리 어드민 — 시작점: 로그인, 사이드바, 주소(#/…) 라우팅, 단축키
   주소 모양
     #/inbox                         할 일
     #/data/<테이블>[/<id>][?f=필터&req=요청id]   레코드 작업대 (shows·works·roles·people·troupes·venues)
     #/requests/<claims|troupeclaims|edits|history|reviews|inquiries>
     #/queue/license · #/queue/rights · #/demand · #/health · #/users · #/admins · #/lists */
import { sb, S, loadAll, esc, $, $$, toast } from './lib.js?v=20261010d';
import { ENT, ENT_ORDER } from './schema.js?v=20261010d';
import { showRecords, listKeys, openSearch } from './records.js?v=20261010d';
import { renderDemand } from './demand.js?v=20261010d';
import { REQ, COUNTS, loadCounts, renderInbox, renderRequests, renderLicense, licenseKeys, renderRights, rightsKeys, renderHealth, renderUsers, renderAdmins, renderLists } from './pages.js?v=20261010d';

const main = document.getElementById('main');

/* ── 로그인 ── */
async function checkAdmin() {
  const { data } = await sb.from('user_profiles').select('is_admin,nickname').maybeSingle();
  return data;
}
function gate(msg, btn) {
  document.getElementById('app').hidden = true;
  const g = document.getElementById('gate'); g.hidden = false;
  g.innerHTML = `<div class="gate-box"><div class="gate-logo">🦆 오리 어드민</div><p>${msg}</p>${btn ? '<button type="button" class="btn primary" id="gate-login">구글로 로그인</button>' : '<button type="button" class="btn ghost" id="gate-out">다른 계정으로 로그인</button>'}</div>`;
  const l = document.getElementById('gate-login'); if (l) l.onclick = () => sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } });
  const o = document.getElementById('gate-out'); if (o) o.onclick = () => sb.auth.signOut().then(() => location.reload());
}
async function start() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session || !session.user || session.user.is_anonymous) { if (session) await sb.auth.signOut(); return gate('관리자 로그인이 필요해요.', true); }
  const prof = await checkAdmin();
  if (!prof || !prof.is_admin) return gate(`${esc(session.user.email || '')} 계정은 관리자가 아니에요.`, false);
  document.getElementById('gate').hidden = true;
  document.getElementById('app').hidden = false;
  $('#me').textContent = prof.nickname || session.user.email || '';
  main.innerHTML = '<div class="loading">데이터를 불러오는 중…</div>';
  try { await loadAll(); } catch (e) { main.innerHTML = `<div class="page"><p class="err">불러오지 못했어요: ${esc(e.message)}</p></div>`; return; }
  await loadCounts();
  renderSide();
  route();
}

/* ── 사이드바 ── */
function renderSide() {
  const reqN = Object.values(COUNTS).reduce((a, b) => a + (b || 0), 0);
  const unlic = S.shows.filter(s => !s.is_licensed).length, unrights = S.works.filter(w => !w.rights_type).length;
  const n = x => x ? `<b class="n">${x}</b>` : '';
  // 묶음 제목을 누르면 접었다 폈다 (처음엔 접힘, 기억: localStorage ori-admin-nav). 접혀 있어도 처리할 수는 제목 옆에
  let closed = {}; try { closed = JSON.parse(localStorage.getItem('ori-admin-nav') || '{}'); } catch (e) {}
  const shut = k => closed[k] !== false;   // 처음엔 모두 접힘. 편 묶음만 기억한다
  const grp = (key, label, items, badge) => `<div class="side-grp${shut(key) ? ' closed' : ''}" data-g="${key}">
    <button type="button" class="side-lbl" aria-expanded="${!shut(key)}" onclick="toggleSideGrp('${key}')"><span>${label}</span>${badge ? `<b class="n soft">${badge}</b>` : ''}<i class="side-caret">▾</i></button>
    <div class="side-grp-in">${items}</div></div>`;
  const reqSum = Object.keys(REQ).reduce((a, k) => a + (COUNTS[k] || 0), 0);
  $('#side-nav').innerHTML = `
    <a href="#/inbox" data-r="inbox">✅ 할 일 ${n(reqN + unlic)}</a>
    ${grp('data', '데이터', ENT_ORDER.map(t => `<a href="#/data/${t}" data-r="data/${t}">${ENT[t].icon} ${ENT[t].label}<small>${S[t].length}</small></a>`).join(''))}
    ${grp('req', '요청', Object.entries(REQ).map(([k, d]) => `<a href="#/requests/${k}" data-r="requests/${k}">${d.label} ${n(COUNTS[k])}</a>`).join(''), reqSum)}
    ${grp('check', '분류·점검', `<a href="#/queue/license" data-r="queue/license">공개 분류 ${unlic ? `<b class="n soft">${unlic}</b>` : ''}</a>
    <a href="#/queue/rights" data-r="queue/rights">권리 분류 ${unrights ? `<b class="n soft">${unrights}</b>` : ''}</a>
    <a href="#/demand" data-r="demand">수요 보드</a>
    <a href="#/health" data-r="health">데이터 현황</a>`)}
    ${grp('set', '설정', `<a href="#/lists" data-r="lists">선택지 관리</a>
    <a href="#/users" data-r="users">유저</a>
    <a href="#/admins" data-r="admins">관리자</a>`)}`;
  markSide();
}
window.toggleSideGrp = function (key) {
  const g = document.querySelector(`.side-grp[data-g="${key}"]`); if (!g) return;
  const shut = !g.classList.contains('closed');
  g.classList.toggle('closed', shut); g.querySelector('.side-lbl').setAttribute('aria-expanded', String(!shut));
  let closed = {}; try { closed = JSON.parse(localStorage.getItem('ori-admin-nav') || '{}'); } catch (e) {}
  closed[key] = shut; try { localStorage.setItem('ori-admin-nav', JSON.stringify(closed)); } catch (e) {}
};
function markSide() {
  const h = location.hash.replace(/^#\//, '').split('?')[0];
  $$('#side-nav a').forEach(a => { const r = a.dataset.r; a.classList.toggle('on', h === r || h.startsWith(r + '/')); });
}

/* ── 라우팅 ── */
let lastView = '';
function route() {
  const raw = location.hash.replace(/^#\/?/, '') || 'inbox';
  const [path, qs] = raw.split('?');
  const params = Object.fromEntries(new URLSearchParams(qs || ''));
  const seg = path.split('/');
  const view = seg[0] + '/' + (seg[1] || '');
  if (view !== lastView || seg[0] !== 'data') { main.onclick = main.onchange = main.onkeydown = null; }
  if (seg[0] === 'data' && ENT[seg[1]]) showRecords(main, seg[1], seg[2] || null, params);
  else if (seg[0] === 'requests' && REQ[seg[1]]) renderRequests(main, seg[1]);
  else if (path === 'queue/license') renderLicense(main);
  else if (path === 'queue/rights') renderRights(main);
  else if (path === 'demand') renderDemand(main);
  else if (path === 'health') renderHealth(main);
  else if (path === 'users') renderUsers(main);
  else if (path === 'admins') renderAdmins(main);
  else if (path === 'lists') renderLists(main);
  else renderInbox(main);
  if (view !== lastView) main.scrollTop = 0;
  lastView = view;
  markSide();
}
window.addEventListener('hashchange', route);
window.addEventListener('ori:route', route);
let _sideT; window.addEventListener('ori:changed', () => { clearTimeout(_sideT); _sideT = setTimeout(renderSide, 150); });
window.addEventListener('ori:badges', async () => { await loadCounts(); renderSide(); });

/* ── 단축키 ── */
document.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openSearch(); return; }
  listKeys(e); licenseKeys(e); rightsKeys(e);
});
$('#side-search').addEventListener('click', openSearch);
$('#reload').addEventListener('click', async () => {
  toast('다시 불러오는 중…');
  await loadAll(); await loadCounts(); renderSide();
  const root = main; root.dataset.view = ''; route(); toast('최신 데이터로 새로 불러왔어요');
});
$('#logout').addEventListener('click', () => sb.auth.signOut().then(() => location.reload()));

start();
