/* 오리 어드민 — 공통: Supabase 클라이언트, 데이터 캐시, 저장 도우미, 작은 UI 도우미
   어드민은 모든 테이블을 한 번에 불러와 메모리(S)에 들고 있고, 고칠 때마다 DB에 바로 쓰고
   메모리도 같이 고친다(다시 불러오지 않아 빠르다). 필요하면 사이드바의 ↻로 전체를 다시 읽는다. */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const sb = createClient(window.ORI_CONFIG.supabaseUrl, window.ORI_CONFIG.supabaseAnonKey,
  { auth: { flowType: 'pkce', storageKey: 'oridb-admin-auth' } });

/* ── 데이터 ── */
export const TABLES = ['shows', 'works', 'roles', 'people', 'troupes', 'venues', 'staff_roles', 'creation_types',
  'participation_history', 'participation_roles', 'participation_staff_roles', 'creation_history', 'option_lists'];
export const S = {};          // 테이블명 → 행 배열
export const byId = {};       // 테이블명 → Map(id → 행)
export const IX = {};         // 관계 색인 (reindex에서 만든다)

async function fetchAll(table) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from(table).select('*').range(from, from + 999);
    if (error) throw new Error(table + ': ' + error.message);
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
}
export async function loadAll() {
  const res = await Promise.all(TABLES.map(fetchAll));
  TABLES.forEach((t, i) => { S[t] = res[i]; });
  reindex();
}
function group(rows, key) { const m = new Map(); rows.forEach(r => { const k = r[key]; if (k == null) return; if (!m.has(k)) m.set(k, []); m.get(k).push(r); }); return m; }
export function reindex() {
  TABLES.forEach(t => { byId[t] = new Map((S[t] || []).filter(r => r.id).map(r => [r.id, r])); });
  IX.phByShow = group(S.participation_history, 'show_id');
  IX.phByPerson = group(S.participation_history, 'person_id');
  IX.prByPh = group(S.participation_roles, 'participation_id');
  IX.prByRole = group(S.participation_roles, 'role_id');
  IX.psrByPh = group(S.participation_staff_roles, 'participation_id');
  IX.rolesByWork = group(S.roles, 'work_id');
  IX.showsByWork = group(S.shows, 'work_id');
  IX.showsByTroupe = group(S.shows, 'troupe_id');
  IX.showsByVenue = group(S.shows, 'venue_id');
  IX.chByWork = group(S.creation_history, 'work_id');
  IX.chByPerson = group(S.creation_history, 'person_id');
  IX.options = {};
  (S.option_lists || []).slice().sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    .forEach(o => { (IX.options[o.category] = IX.options[o.category] || []).push(o.value); });
}

/* ── 이름 ── */
export const NAME_COL = { shows: 'title', works: 'title', roles: 'name', people: 'name', troupes: 'name', venues: 'name', staff_roles: 'name', creation_types: 'name' };
export function nameOf(table, id) { const r = id && byId[table] && byId[table].get(id); return r ? (r[NAME_COL[table]] || '') : ''; }
export function firstImg(r, col) { const a = r && r[col]; return Array.isArray(a) && a[0] ? a[0] : ''; }

/* ── 쓰기 (DB와 메모리를 함께) ── */
const FK_LABEL = { participation_history: '참여 이력', creation_history: '창작 이력', shows: '공연', works: '작품', roles: '배역', staff_roles: '스텝 역할', troupes: '단체', venues: '극장', people: '사람', projects: '프로젝트', participation_roles: '배역 연결', participation_staff_roles: '스텝 연결', project_positions: '프로젝트 자리', project_venue_candidates: '프로젝트 극장 후보' };
export function errText(error, what) {
  if (!error) return '';
  if (error.code === '23503') {
    const m = /on table "([a-z_]+)"/.exec(error.message || '');
    const ref = m ? (FK_LABEL[m[1]] || m[1]) : '다른 데이터';
    return `${what || '이 항목'}을 아직 "${ref}"에서 쓰고 있어서 지울 수 없어요. 연결을 먼저 정리해주세요.`;
  }
  if (error.code === '23505') return '이미 같은 값이 있어요.';
  if (error.code === '42501' || /row-level security/i.test(error.message || '')) return '권한이 없어요. 관리자 계정으로 로그인했는지 확인해주세요.';
  return error.message || String(error);
}
export async function update(table, id, patch) {
  const { error } = await sb.from(table).update(patch).eq('id', id);
  if (error) { toast(errText(error), 'err'); return false; }
  const r = byId[table].get(id); if (r) Object.assign(r, patch);
  reindex(); saved(); return true;
}
export async function insert(table, row) {
  const { data, error } = await sb.from(table).insert(row).select().single();
  if (error) { toast(errText(error), 'err'); return null; }
  S[table].push(data); reindex(); saved(); return data;
}
export async function remove(table, id, what) {
  const { error } = await sb.from(table).delete().eq('id', id);
  if (error) { toast(errText(error, what), 'err'); return false; }
  S[table] = S[table].filter(r => r.id !== id); reindex(); saved(); return true;
}
/* id 없는 연결 테이블 (participation_roles 등) */
export async function insertLink(table, row) {
  const { error } = await sb.from(table).insert(row);
  if (error && error.code !== '23505') { toast(errText(error), 'err'); return false; }
  if (!error) { S[table].push(row); reindex(); }
  saved(); return true;
}
export async function removeLink(table, match) {
  let q = sb.from(table).delete();
  Object.entries(match).forEach(([k, v]) => { q = q.eq(k, v); });
  const { error } = await q;
  if (error) { toast(errText(error), 'err'); return false; }
  S[table] = S[table].filter(r => !Object.entries(match).every(([k, v]) => r[k] === v));
  reindex(); saved(); return true;
}
export async function uploadPhoto(folder, file) {
  const path = folder + '/' + Date.now() + '_' + Math.random().toString(36).slice(2, 7) + '_' + file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
  const { error } = await sb.storage.from('photos').upload(path, file);
  if (error) { toast('사진을 올리지 못했어요: ' + error.message, 'err'); return null; }
  return sb.storage.from('photos').getPublicUrl(path).data.publicUrl;
}

/* ── UI 도우미 ── */
export function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
export function $(sel, root) { return (root || document).querySelector(sel); }
export function $$(sel, root) { return [...(root || document).querySelectorAll(sel)]; }
export function fmtDate(d) { return d ? String(d).slice(0, 10).replace(/-/g, '.') : ''; }
export function fmtWhen(ts) { if (!ts) return ''; const d = new Date(ts); return d.toLocaleDateString('ko-KR') + ' ' + d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }); }

let _toastT;
export function toast(msg, kind) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.className = 'on' + (kind ? ' ' + kind : '');
  clearTimeout(_toastT); _toastT = setTimeout(() => { t.className = ''; }, kind === 'err' ? 5000 : 1800);
}
let _savedT;
export function saved() {
  window.dispatchEvent(new Event('ori:changed'));
  const el = document.getElementById('save-state'); if (!el) return;
  el.textContent = '저장됨 ✓'; el.classList.add('on');
  clearTimeout(_savedT); _savedT = setTimeout(() => el.classList.remove('on'), 1500);
}

/* 확인·입력 창 (브라우저 기본 창 대신) */
export function dialog({ title, body = '', ok = '확인', cancel = '취소', danger = false }) {
  return new Promise(resolve => {
    const ov = document.createElement('div'); ov.className = 'dlg-ov';
    ov.innerHTML = `<div class="dlg" role="dialog"><div class="dlg-h">${esc(title)}</div><div class="dlg-b">${body}</div>
      <div class="dlg-f">${cancel ? `<button type="button" class="btn ghost" data-a="no">${esc(cancel)}</button>` : ''}<button type="button" class="btn ${danger ? 'danger' : 'primary'}" data-a="ok">${esc(ok)}</button></div></div>`;
    document.body.appendChild(ov);
    const done = v => { ov.remove(); document.removeEventListener('keydown', onKey, true); resolve(v); };
    const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); done(null); } if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') { e.preventDefault(); done(ov.querySelector('.dlg-b')); } };
    document.addEventListener('keydown', onKey, true);
    ov.addEventListener('click', e => { const a = e.target.closest('[data-a]'); if (a) done(a.dataset.a === 'ok' ? ov.querySelector('.dlg-b') : null); else if (e.target === ov) done(null); });
    (ov.querySelector('.dlg-b input,.dlg-b textarea,.dlg-b select') || ov.querySelector('[data-a=ok]')).focus();
  });
}
export async function confirmDlg(title, msg, danger) { return !!(await dialog({ title, body: msg ? `<p>${esc(msg)}</p>` : '', ok: danger ? '지우기' : '확인', danger })); }
export async function promptDlg(title, value = '', placeholder = '') {
  const b = await dialog({ title, body: `<input type="text" class="inp" value="${esc(value)}" placeholder="${esc(placeholder)}">` });
  return b ? b.querySelector('input').value.trim() : null;
}
