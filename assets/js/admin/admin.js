/* 오리 Admin — ES 모듈 (전역 함수는 window.* 로 노출) */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = window.ORI_CONFIG.supabaseUrl;
const SUPABASE_ANON_KEY = window.ORI_CONFIG.supabaseAnonKey;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { flowType: 'pkce', storageKey: 'oridb-admin-auth' } });

const authStatusEl = document.getElementById('authStatus');

function loginWithGoogle() {
  supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } });
}
window.loginWithGoogle = loginWithGoogle;

function logout() {
  supabase.auth.signOut().then(() => location.reload());
}
window.logout = logout;

function showLoginGate() {
  if (document.getElementById('loginGate')) return;
  const gate = document.createElement('div');
  gate.id = 'loginGate';
  gate.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;z-index:9999;';
  gate.innerHTML = '<div style="background:#17171a;border:1px solid rgba(255,255,255,.15);border-radius:10px;padding:2.2rem 2.6rem;text-align:center;font-family:sans-serif;color:#eee">'
    + '<div style="margin-bottom:1.2rem;font-size:0.95rem">관리자 로그인이 필요해요</div>'
    + '<button onclick="loginWithGoogle()" style="padding:0.6rem 1.3rem;cursor:pointer;border-radius:6px;border:1px solid #555;background:#222;color:#eee;font-size:0.9rem">구글로 로그인</button>'
    + '</div>';
  document.body.appendChild(gate);
}
function hideLoginGate() {
  document.getElementById('loginGate')?.remove();
}

async function checkIsAdmin() {
  const { data } = await supabase.from('user_profiles').select('is_admin,nickname').maybeSingle();
  if (data && data.is_admin) {
    authStatusEl.textContent = '관리자로 로그인됨 (' + (data.nickname || '') + ')';
    authStatusEl.className = 'ok';
  } else {
    authStatusEl.textContent = '로그인됨 — 관리자 권한 없음 (읽기만 가능)';
    authStatusEl.className = 'err';
  }
}

async function applyAuthState(session) {
  if (session && session.user && !session.user.is_anonymous) {
    hideLoginGate();
    await checkIsAdmin();
  } else if (session && session.user && session.user.is_anonymous) {
    // 예전 익명 로그인 방식의 잔재 세션 — 더 이상 유효한 로그인으로 취급하지 않고 정리한다
    await supabase.auth.signOut();
    authStatusEl.textContent = '로그인 필요';
    authStatusEl.className = 'err';
    showLoginGate();
  } else {
    authStatusEl.textContent = '로그인 필요';
    authStatusEl.className = 'err';
    showLoginGate();
  }
}

async function ensureAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  await applyAuthState(session);
  supabase.auth.onAuthStateChange((_event, session) => { applyAuthState(session); });
}

// ---------- 메뉴: 상단 그룹 → 좌측 레일 하위 메뉴(탭) ----------
// 현재 탭은 주소 해시(#show 등)에 남겨서 새로고침해도 같은 화면으로 돌아온다.
const lastTabByGroup = {};
function groupOfTab(tab) {
  if (!tab) return undefined;
  return document.querySelector(`#navTabs button[data-tab="${tab}"]`)?.closest('.nav-section')?.dataset.group;
}
function showGroup(group) {
  document.querySelectorAll('#navGroups button[data-group]').forEach(b => b.classList.toggle('active', b.dataset.group === group));
  document.querySelectorAll('#navTabs .nav-section').forEach(s => s.classList.toggle('active', s.dataset.group === group));
}
function switchAdminTab(tab) {
  const group = groupOfTab(tab);
  if (!group) return;
  lastTabByGroup[group] = tab;
  showGroup(group);
  document.querySelectorAll('#navTabs button[data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById('tab-' + tab);
  if (panel) panel.classList.add('active');
  if (tab === 'browse') initBrowseFrame();
  if (location.hash !== '#' + tab) history.replaceState(null, '', '#' + tab);
}

// ---------- 사이트에서 편집: 오리 사이트를 ?edit=1 로 품어 띄운다 (assets/js/site/edit.js) ----------
const BROWSE_URL = 'gongyon-db.html?edit=1';
function initBrowseFrame() {
  const fr = document.getElementById('browse-frame');
  if (!fr || fr.dataset.ready) return;
  fr.dataset.ready = '1';
  fr.src = BROWSE_URL + '#shows';
  document.getElementById('browse-open').href = BROWSE_URL + '#shows';
}
document.addEventListener('click', (e) => {
  const j = e.target.closest('.browse-jumps button[data-go]');
  if (j) {
    const fr = document.getElementById('browse-frame');
    try { fr.contentWindow.location.hash = j.dataset.go; } catch (err) { fr.src = BROWSE_URL + j.dataset.go; }
    document.getElementById('browse-open').href = BROWSE_URL + j.dataset.go;
    return;
  }
  if (e.target.closest('#browse-reload')) {
    const w = document.getElementById('browse-frame').contentWindow;
    if (w && w.edReload) w.edReload(); else if (w) w.location.reload();
  }
});
window.switchAdminTab = switchAdminTab;
document.getElementById('navTabs').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-tab]');
  if (!btn) return;
  switchAdminTab(btn.dataset.tab);
});
// 그룹을 누르면 그 그룹에서 마지막으로 보던(없으면 첫) 하위 메뉴를 연다.
// 실제 버튼을 클릭해서, 탭별로 붙어 있는 로딩 핸들러(권리 분류 등)도 그대로 동작하게 한다.
document.getElementById('navGroups').addEventListener('click', (e) => {
  const g = e.target.closest('button[data-group]')?.dataset.group;
  if (!g) return;
  const tab = lastTabByGroup[g] || document.querySelector(`#navTabs .nav-section[data-group="${g}"] button[data-tab]`).dataset.tab;
  document.querySelector(`#navTabs button[data-tab="${tab}"]`).click();
});
// 하위 메뉴의 빨간 점(대기 건수)이 켜지면 상단 그룹에도 점을 켠다
function syncGroupBadges() {
  document.querySelectorAll('#navGroups [data-group-badge]').forEach(dot => {
    const g = dot.dataset.groupBadge;
    dot.classList.toggle('on', !!document.querySelector(`#navTabs .nav-section[data-group="${g}"] .nav-badge.on`));
  });
}
new MutationObserver(syncGroupBadges).observe(document.getElementById('navTabs'), { subtree: true, attributes: true, attributeFilter: ['class'] });
const initialTab = location.hash.slice(1);
switchAdminTab(groupOfTab(initialTab) ? initialTab : 'show');

function showMsg(id, ok, text) {
  const el = document.getElementById(id);
  el.textContent = text;
  el.className = 'msg ' + (ok ? 'ok' : 'err');
}

// ---------- 작품 구분(장르) 옵션 ----------
// 고정 기본값 + 실제 DB에 이미 들어있는 값(과거 자유입력분)을 합쳐서 드롭다운으로만 고를 수 있게 한다.
let GENRE_OPTIONS = ['연극', '뮤지컬', '무용', '오페라', '기타'];
function updateGenreOptions() {
  const existing = new Set((cache.works || []).map(w => w.genre).filter(Boolean));
  const extra = [...existing].filter(g => !GENRE_OPTIONS.includes(g)).sort();
  GENRE_OPTIONS = ['연극', '뮤지컬', '무용', '오페라', '기타', ...extra];
  const sel = document.getElementById('work-genre-select');
  if (sel) {
    const cur = sel.value;
    sel.innerHTML = '<option value="">선택 안 함</option>' + GENRE_OPTIONS.map(g => `<option value="${g}">${g}</option>`).join('');
    if (cur) sel.value = cur;
  }
}
function genreEditOptions() {
  return [{ value: '', label: '(없음)' }, ...GENRE_OPTIONS.map(g => ({ value: g, label: g }))];
}

// ---------- 작품 국가 옵션 ----------
// 자주 쓰이는 국가 목록 + DB에 이미 들어있는 값(과거 자유입력분)을 합쳐서 드롭다운으로 고를 수 있게 한다.
let COUNTRY_OPTIONS = [
  '대한민국','영국','미국','프랑스','독일','일본','러시아','이탈리아','스페인','캐나다','호주',
  '중국','오스트리아','헝가리','스웨덴','노르웨이','덴마크','네덜란드','벨기에','스위스','아일랜드',
  '체코','폴란드','그리스','포르투갈','브라질','아르헨티나','멕시코','인도','기타'
];
function updateCountryOptions() {
  const existing = new Set((cache.works || []).map(w => w.country).filter(Boolean));
  const extra = [...existing].filter(c => !COUNTRY_OPTIONS.includes(c)).sort();
  COUNTRY_OPTIONS = [...new Set([...COUNTRY_OPTIONS, ...extra])];
  comboData['work-country'] = {
    byLabel: new Map(COUNTRY_OPTIONS.map(c => [c, c])),
    byId: new Map(COUNTRY_OPTIONS.map(c => [c, c]))
  };
}
// 국가처럼 "값 자체가 곧 저장값"인 입력창에 드롭다운을 연결한다 (hidden 필드 없이 입력창 자신의 값을 바로 바꿈).
function wireTextCombo(comboId) {
  const input = document.getElementById('combo-input-' + comboId);
  const dropdown = document.getElementById('ddl-' + comboId);
  if (!input || !dropdown) return;
  createComboDropdown(comboId, input, dropdown, () => {});
}

// 여러 개를 클릭클릭으로 골라 담는 멀티셀렉트 드롭다운 (배역 태그, 작품 국가 등에서 공용으로 사용).
// getOptions(): 후보 문자열 배열, isSelected(v): 현재 선택 여부, onToggle(v): 클릭 시 추가/해제 처리
function attachMultiSelectDropdown(inputEl, dropdownEl, getOptions, isSelected, onToggle, allowNew) {
  function render() {
    const q = inputEl.value.trim().toLowerCase();
    const options = getOptions();
    const items = options.filter(o => !q || o.toLowerCase().includes(q));
    let html = items.map(o => {
      const on = isSelected(o);
      return `<div class="combo-option${on ? ' tag-selected' : ''}" data-val="${o.replace(/"/g,'&quot;')}">${on ? '✓ ' : ''}${o}</div>`;
    }).join('');
    if (allowNew && q && !options.includes(q)) {
      html += `<div class="combo-option" data-newval="${q.replace(/"/g,'&quot;')}">+ "${q}" 새로 추가</div>`;
    }
    dropdownEl.innerHTML = html || '<div class="combo-empty">검색 결과가 없어요</div>';
    dropdownEl.classList.add('open');
  }
  inputEl.addEventListener('focus', render);
  inputEl.addEventListener('input', render);
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const v = inputEl.value.trim();
      if (v) { onToggle(v); inputEl.value = ''; render(); }
    } else if (e.key === 'Escape') {
      dropdownEl.classList.remove('open');
    }
  });
  dropdownEl.addEventListener('mousedown', (e) => {
    const opt = e.target.closest('.combo-option');
    if (!opt) return;
    e.preventDefault();
    const v = opt.dataset.newval !== undefined ? opt.dataset.newval : opt.dataset.val;
    onToggle(v);
    inputEl.value = '';
    render();
    inputEl.focus();
  });
  document.addEventListener('click', (e) => {
    if (e.target !== inputEl && !dropdownEl.contains(e.target)) dropdownEl.classList.remove('open');
  });
  return { render };
}

// ---------- 작품 국가 위젯 (폼, 다중선택) ----------
// 여러 폼에서 재사용하는 범용 다중선택 칩피커 (국가/태그 위젯과 동일한 동작을 일반화)
function makeChipPicker(getOptions) {
  const picker = {
    state: [],
    reset(vals) { picker.state = vals ? [...vals] : []; },
    render(boxId) {
      const box = document.getElementById(boxId);
      box.innerHTML = picker.state.map((t, i) =>
        `<span class="combo-chip">${(t||'').toString().replace(/</g,'&lt;')}<button type="button" class="rm-chip-btn" data-idx="${i}">×</button></span>`
      ).join('');
    },
    wire(boxId, inputId, ddlId) {
      const box = document.getElementById(boxId);
      box.addEventListener('click', (e) => {
        const btn = e.target.closest('.rm-chip-btn');
        if (!btn) return;
        picker.state.splice(Number(btn.dataset.idx), 1);
        picker.render(boxId);
      });
      attachMultiSelectDropdown(document.getElementById(inputId), document.getElementById(ddlId), getOptions,
        (v) => picker.state.includes(v), (v) => {
          const idx = picker.state.indexOf(v);
          if (idx > -1) picker.state.splice(idx, 1); else picker.state.push(v);
          const opts = getOptions();
          if (!opts.includes(v)) opts.push(v);
          picker.render(boxId);
        }, true);
    },
  };
  return picker;
}
const troupeRegionPicker = makeChipPicker(() => TROUPE_REGION_OPTIONS);
const personRolePicker = makeChipPicker(() => PERSON_ROLE_OPTIONS);

let workCountriesState = [];
function renderWorkCountryChips() {
  const box = document.getElementById('work-country-chips');
  box.innerHTML = workCountriesState.map((c, i) =>
    `<span class="combo-chip">${c.replace(/</g,'&lt;')}<button type="button" class="rm-chip-btn" data-idx="${i}">×</button></span>`
  ).join('');
}
function resetWorkCountries(countries) {
  workCountriesState = countries ? [...countries] : [];
  renderWorkCountryChips();
  const inp = document.getElementById('work-country-input');
  if (inp) inp.value = '';
}
document.getElementById('work-country-chips').addEventListener('click', (e) => {
  const btn = e.target.closest('.rm-chip-btn');
  if (!btn) return;
  workCountriesState.splice(Number(btn.dataset.idx), 1);
  renderWorkCountryChips();
});
attachMultiSelectDropdown(
  document.getElementById('work-country-input'),
  document.getElementById('ddl-work-country'),
  () => COUNTRY_OPTIONS,
  (v) => workCountriesState.includes(v),
  (v) => {
    const idx = workCountriesState.indexOf(v);
    if (idx > -1) workCountriesState.splice(idx, 1); else workCountriesState.push(v);
    if (!COUNTRY_OPTIONS.includes(v)) COUNTRY_OPTIONS.push(v);
    renderWorkCountryChips();
  },
  true
);

// ---------- 작품 폼 안의 창작자(극작/작곡 등) 인라인 관리 ----------
let workCreatorRows = []; // [{person_id, creation_type_id}]

function renderWorkCreators() {
  const box = document.getElementById('work-creators-list');
  box.innerHTML = workCreatorRows.map((r, i) => {
    const pname = cache.people.find(p=>p.id===r.person_id)?.name || '(알 수 없음)';
    const tname = cache.creationTypes.find(t=>t.id===r.creation_type_id)?.name || '(알 수 없음)';
    return `<span class="combo-chip" style="margin:2px 4px 2px 0;">${pname} (${tname})<button type="button" class="rm-chip-btn" onclick="removeWorkCreatorRow(${i})">×</button></span>`;
  }).join('') || '<span class="empty" style="padding:0;">아직 등록된 창작자가 없어요</span>';
}
window.addWorkCreatorRow = function() {
  const personInput = document.getElementById('combo-input-workcreator-person');
  const typeInput = document.getElementById('combo-input-workcreator-type');
  const personMap = comboData['workcreator-person'];
  const typeMap = comboData['workcreator-type'];
  const personId = personMap && personMap.byLabel.get(personInput.value.trim());
  const typeId = typeMap && typeMap.byLabel.get(typeInput.value.trim());
  if (!personId || !typeId) { alert('사람과 유형을 목록에서 정확히 골라주세요.'); return; }
  workCreatorRows.push({ person_id: personId, creation_type_id: typeId });
  personInput.value = '';
  typeInput.value = '';
  renderWorkCreators();
};
window.removeWorkCreatorRow = function(i) {
  workCreatorRows.splice(i, 1);
  renderWorkCreators();
};
function resetWorkCreatorWidget(rows) {
  workCreatorRows = rows.map(r => ({ person_id: r.person_id, creation_type_id: r.creation_type_id }));
  renderWorkCreators();
  const p = document.getElementById('combo-input-workcreator-person'); if (p) p.value = '';
  const t = document.getElementById('combo-input-workcreator-type'); if (t) t.value = '';
}
async function saveWorkCreators(workId) {
  const { error: delErr } = await supabase.from('creation_history').delete().eq('work_id', workId);
  if (delErr) return delErr.message;
  if (workCreatorRows.length) {
    const { error } = await supabase.from('creation_history').insert(
      workCreatorRows.map(r => ({ work_id: workId, person_id: r.person_id, creation_type_id: r.creation_type_id }))
    );
    if (error) return error.message;
  }
  return null;
}

// ---------- 배역 캐릭터 태그 위젯 (클릭으로 다중 선택 + 새 태그는 입력 후 Enter) ----------
let roleTagsState = [];
// 미리 준비된 태그 + 이미 DB에 쓰인 태그를 합쳐서 드롭다운 목록으로 쓴다.
let ROLE_TAG_OPTIONS = [
  '군인','엄마','아빠','섹시','찐따','코믹','진지','주연','조연','악역',
  '순정남','순정녀','능글맞은','귀여운','카리스마','냉정한','유머러스한','순수한','사이코','반전매력'
];
function updateRoleTagOptions() {
  const existing = new Set();
  (cache.roles || []).forEach(r => (r.tags || []).forEach(t => existing.add(t)));
  const extra = [...existing].filter(t => !ROLE_TAG_OPTIONS.includes(t)).sort();
  ROLE_TAG_OPTIONS = [...new Set([...ROLE_TAG_OPTIONS, ...extra])];
}
function renderRoleTagsChips() {
  const box = document.getElementById('role-tags-chips');
  box.innerHTML = roleTagsState.map((t, i) =>
    `<span class="combo-chip">${t.replace(/</g,'&lt;')}<button type="button" class="rm-chip-btn" data-tagidx="${i}">×</button></span>`
  ).join('');
}
function resetRoleTags(tags) {
  roleTagsState = tags ? [...tags] : [];
  renderRoleTagsChips();
  const inp = document.getElementById('role-tag-input');
  if (inp) inp.value = '';
  renderRoleTagDropdown();
}
function renderRoleTagDropdown() {
  const dropdownEl = document.getElementById('ddl-role-tag');
  const inputEl = document.getElementById('role-tag-input');
  if (!dropdownEl || !inputEl) return;
  const q = inputEl.value.trim().toLowerCase();
  const items = ROLE_TAG_OPTIONS.filter(t => !q || t.toLowerCase().includes(q));
  let html = items.map(t => {
    const on = roleTagsState.includes(t);
    return `<div class="combo-option${on ? ' tag-selected' : ''}" data-tag="${t.replace(/"/g,'&quot;')}">${on ? '✓ ' : ''}${t}</div>`;
  }).join('');
  if (q && !ROLE_TAG_OPTIONS.includes(q)) {
    html += `<div class="combo-option" data-newtag="${q.replace(/"/g,'&quot;')}">+ "${q}" 새 태그로 추가</div>`;
  }
  dropdownEl.innerHTML = html || '<div class="combo-empty">태그를 입력해보세요</div>';
  dropdownEl.classList.add('open');
}
function addOrToggleRoleTag(t) {
  if (!t) return;
  const idx = roleTagsState.indexOf(t);
  if (idx > -1) roleTagsState.splice(idx, 1); else roleTagsState.push(t);
  if (!ROLE_TAG_OPTIONS.includes(t)) ROLE_TAG_OPTIONS.push(t);
  renderRoleTagsChips();
}
(function initRoleTagWidget() {
  const inputEl = document.getElementById('role-tag-input');
  const dropdownEl = document.getElementById('ddl-role-tag');
  inputEl.addEventListener('focus', renderRoleTagDropdown);
  inputEl.addEventListener('input', renderRoleTagDropdown);
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const v = inputEl.value.trim();
      if (v) { addOrToggleRoleTag(v); inputEl.value = ''; renderRoleTagDropdown(); }
    } else if (e.key === 'Escape') {
      dropdownEl.classList.remove('open');
    }
  });
  dropdownEl.addEventListener('mousedown', (e) => {
    const opt = e.target.closest('.combo-option');
    if (!opt) return;
    e.preventDefault();
    const t = opt.dataset.newtag !== undefined ? opt.dataset.newtag : opt.dataset.tag;
    addOrToggleRoleTag(t);
    inputEl.value = '';
    renderRoleTagDropdown();
    inputEl.focus();
  });
  document.addEventListener('click', (e) => {
    if (e.target !== inputEl && !dropdownEl.contains(e.target)) dropdownEl.classList.remove('open');
  });
})();
document.getElementById('role-tags-chips').addEventListener('click', (e) => {
  const btn = e.target.closest('.rm-chip-btn');
  if (!btn) return;
  roleTagsState.splice(Number(btn.dataset.tagidx), 1);
  renderRoleTagsChips();
});

// ---------- 작품 태그 위젯 (클릭으로 다중 선택 + 새 태그는 입력 후 Enter) ----------
let workTagsState = [];
let WORK_TAG_OPTIONS = ['코미디','감동','스릴러','로맨스','실험적','고전','창작극','번역극','다크','옴니버스','가족','풍자'];
function updateWorkTagOptions() {
  const existing = new Set();
  (cache.works || []).forEach(w => (w.tags || []).forEach(t => existing.add(t)));
  const extra = [...existing].filter(t => !WORK_TAG_OPTIONS.includes(t)).sort();
  WORK_TAG_OPTIONS = [...new Set([...WORK_TAG_OPTIONS, ...extra])];
}

let ORG_TYPE_OPTIONS = ['극단','제작사','동호회'];
function updateOrgTypeOptions() {
  const existing = new Set();
  (cache.troupes || []).forEach(t => (t.org_type || []).forEach(v => existing.add(v)));
  const extra = [...existing].filter(v => !ORG_TYPE_OPTIONS.includes(v)).sort();
  ORG_TYPE_OPTIONS = [...new Set([...ORG_TYPE_OPTIONS, ...extra])];
}
let TROUPE_REGION_OPTIONS = ['사당/이수','건대','대학로','홍대','신촌','강남/서초','잠실','노원/도봉','구로/신도림','경기 남부','경기 북부','인천','지방(광역시 등)','기타'];
function updateTroupeRegionOptions() {
  const existing = new Set();
  (cache.troupes || []).forEach(t => (t.region || []).forEach(v => existing.add(v)));
  const extra = [...existing].filter(v => !TROUPE_REGION_OPTIONS.includes(v)).sort();
  TROUPE_REGION_OPTIONS = [...new Set([...TROUPE_REGION_OPTIONS, ...extra])];
}
let PERSON_ROLE_OPTIONS = ['배우(연극)','배우(뮤지컬)','연출','작가','작곡가','안무가','스텝','프로듀서','기타'];
function updatePersonRoleOptions() {
  const existing = new Set();
  (cache.people || []).forEach(p => (p.roles || []).forEach(v => existing.add(v)));
  const extra = [...existing].filter(v => !PERSON_ROLE_OPTIONS.includes(v)).sort();
  PERSON_ROLE_OPTIONS = [...new Set([...PERSON_ROLE_OPTIONS, ...extra])];
}

// option_lists 테이블(설정 > 옵션 관리에서 직접 추가/삭제한 값들)을 각 배열에 병합한다.
const OPTION_CATEGORY_ARRAYS = {
  work_country: () => COUNTRY_OPTIONS, work_tag: () => WORK_TAG_OPTIONS, role_tag: () => ROLE_TAG_OPTIONS,
  org_type: () => ORG_TYPE_OPTIONS, troupe_region: () => TROUPE_REGION_OPTIONS, person_role: () => PERSON_ROLE_OPTIONS,
};
async function loadOptionLists() {
  const { data, error } = await supabase.from('option_lists').select('category,value,sort_order').order('sort_order');
  if (error) { console.error('옵션 목록 로드 실패:', error); return; }
  const byCategory = {};
  (data || []).forEach(row => { (byCategory[row.category] = byCategory[row.category] || []).push(row.value); });
  COUNTRY_OPTIONS = byCategory.work_country || [];
  WORK_TAG_OPTIONS = byCategory.work_tag || [];
  ROLE_TAG_OPTIONS = byCategory.role_tag || [];
  ORG_TYPE_OPTIONS = byCategory.org_type || [];
  TROUPE_REGION_OPTIONS = byCategory.troupe_region || [];
  PERSON_ROLE_OPTIONS = byCategory.person_role || [];
  // 옵션 목록에서 지워졌어도, 실제로 쓰이고 있는 값은 계속 선택 가능하도록 다시 병합한다.
  updateCountryOptions(); updateWorkTagOptions(); updateRoleTagOptions();
  updateOrgTypeOptions(); updateTroupeRegionOptions(); updatePersonRoleOptions();
}

// ---------- 설정 > 옵션 관리 (다중선택 항목의 선택지 자체를 편집) ----------
const OPTION_CATEGORY_LABELS = {
  work_country: '작품 - 국가', work_tag: '작품 - 태그', role_tag: '배역 - 태그',
  org_type: '단체 - 조직형태', troupe_region: '단체 - 활동지역', person_role: '사람 - 역할',
};
let optionListRows = [];
async function loadOptionListRows() {
  const { data } = await supabase.from('option_lists').select('*').order('category').order('sort_order');
  optionListRows = data || [];
}
function renderOptionManager() {
  const el = document.getElementById('option-manager');
  if (!el) return;
  el.innerHTML = Object.keys(OPTION_CATEGORY_LABELS).map(cat => {
    const rows = optionListRows.filter(r => r.category === cat);
    return `<div style="margin-bottom:18px;">
      <div style="font-weight:600; font-size:13px; margin-bottom:6px;">${OPTION_CATEGORY_LABELS[cat]}</div>
      <div class="combo-chips" style="margin-bottom:6px;">
        ${rows.map(r => `<span class="combo-chip">${r.value.replace(/</g,'&lt;')}<button type="button" class="rm-chip-btn" data-id="${r.id}">×</button></span>`).join('') || '<span class="empty">등록된 값이 없어요</span>'}
      </div>
      <div style="display:flex; gap:6px;">
        <input type="text" data-add-category="${cat}" placeholder="새 값 입력 후 Enter" style="flex:1; max-width:240px; padding:4px 8px;">
      </div>
    </div>`;
  }).join('');
}
document.getElementById('option-manager').addEventListener('click', async (e) => {
  const btn = e.target.closest('.rm-chip-btn');
  if (!btn) return;
  if (!confirm('이 값을 옵션 목록에서 삭제할까요? (이미 저장된 데이터의 값은 그대로 남아요)')) return;
  await supabase.from('option_lists').delete().eq('id', btn.dataset.id);
  await loadOptionListRows();
  await loadOptionLists();
  renderOptionManager();
  renderAllLists();
});
document.getElementById('option-manager').addEventListener('keydown', async (e) => {
  if (e.key !== 'Enter') return;
  const input = e.target.closest('input[data-add-category]');
  if (!input) return;
  e.preventDefault();
  const val = input.value.trim();
  if (!val) return;
  const cat = input.dataset.addCategory;
  const maxSort = Math.max(0, ...optionListRows.filter(r => r.category === cat).map(r => r.sort_order || 0));
  const { error } = await supabase.from('option_lists').insert({ category: cat, value: val, sort_order: maxSort + 1 });
  if (error && error.code !== '23505') { alert('추가 실패: ' + error.message); return; }
  input.value = '';
  await loadOptionListRows();
  await loadOptionLists();
  renderOptionManager();
  renderAllLists();
});
function renderWorkTagsChips() {
  const box = document.getElementById('work-tags-chips');
  box.innerHTML = workTagsState.map((t, i) =>
    `<span class="combo-chip">${t.replace(/</g,'&lt;')}<button type="button" class="rm-chip-btn" data-idx="${i}">×</button></span>`
  ).join('');
}
function resetWorkTags(tags) {
  workTagsState = tags ? [...tags] : [];
  renderWorkTagsChips();
  const inp = document.getElementById('work-tag-input');
  if (inp) inp.value = '';
}
document.getElementById('work-tags-chips').addEventListener('click', (e) => {
  const btn = e.target.closest('.rm-chip-btn');
  if (!btn) return;
  workTagsState.splice(Number(btn.dataset.idx), 1);
  renderWorkTagsChips();
});
attachMultiSelectDropdown(
  document.getElementById('work-tag-input'),
  document.getElementById('ddl-work-tag'),
  () => WORK_TAG_OPTIONS,
  (v) => workTagsState.includes(v),
  (v) => {
    const idx = workTagsState.indexOf(v);
    if (idx > -1) workTagsState.splice(idx, 1); else workTagsState.push(v);
    if (!WORK_TAG_OPTIONS.includes(v)) WORK_TAG_OPTIONS.push(v);
    renderWorkTagsChips();
  },
  true
);

// ---------- 커스텀 검색형 드롭다운 (datalist 대체) ----------
// 드롭다운이 입력창 바로 아래에 카드 형태로 뜨고, 마우스를 올리면 그 항목 배경색이 바뀐다.
// 단일선택: <input class=combo-input> + <div class=combo-dropdown> + <input type=hidden data-combo=X>
const comboData = {}; // comboId -> {byLabel: Map<label,id>, byId: Map<id,label>}

function fillCombo(comboId, rows, valueKey, labelKey) {
  const byLabel = new Map(), byId = new Map();
  rows.forEach(r => {
    const label = (typeof labelKey === 'function' ? labelKey(r) : r[labelKey]) || '(이름 없음)';
    byLabel.set(label, r[valueKey]);
    byId.set(r[valueKey], label);
  });
  comboData[comboId] = { byLabel, byId };
}

// 입력창 + 드롭다운 한 쌍에 검색/키보드 탐색/클릭선택 동작을 연결한다.
// onSelectLabel(label): 사용자가 항목을 고르면 호출됨 (라벨 문자열을 넘겨줌)
function createComboDropdown(comboId, inputEl, dropdownEl, onSelectLabel) {
  let items = [];
  let focusIdx = -1;

  function render() {
    const map = comboData[comboId];
    if (!map) { close(); return; }
    const q = inputEl.value.trim().toLowerCase();
    items = [...map.byLabel.keys()].filter(l => !q || l.toLowerCase().includes(q)).slice(0, 300);
    focusIdx = -1;
    if (!items.length) {
      dropdownEl.innerHTML = '<div class="combo-empty">검색 결과가 없어요</div>';
      dropdownEl.classList.add('open');
      return;
    }
    dropdownEl.innerHTML = items.map((l, i) => `<div class="combo-option" data-idx="${i}">${l.replace(/</g,'&lt;')}</div>`).join('');
    dropdownEl.classList.add('open');
  }
  function close() { dropdownEl.classList.remove('open'); dropdownEl.innerHTML = ''; focusIdx = -1; }
  function highlight() {
    [...dropdownEl.children].forEach((el, i) => el.classList.toggle('focused', i === focusIdx));
    const cur = dropdownEl.children[focusIdx];
    if (cur) cur.scrollIntoView({ block: 'nearest' });
  }
  function selectIdx(i) {
    const label = items[i];
    if (label === undefined) return;
    inputEl.value = label;
    close();
    onSelectLabel(label);
  }

  inputEl.addEventListener('focus', render);
  inputEl.addEventListener('input', render);
  inputEl.addEventListener('keydown', (e) => {
    if (!dropdownEl.classList.contains('open')) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); focusIdx = Math.min(focusIdx + 1, items.length - 1); highlight(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); focusIdx = Math.max(focusIdx - 1, 0); highlight(); }
    else if (e.key === 'Enter') { if (focusIdx >= 0) { e.preventDefault(); selectIdx(focusIdx); } }
    else if (e.key === 'Escape') { close(); }
  });
  dropdownEl.addEventListener('mousedown', (e) => {
    const opt = e.target.closest('.combo-option');
    if (!opt) return;
    e.preventDefault();
    selectIdx(Number(opt.dataset.idx));
  });
  document.addEventListener('click', (e) => {
    if (e.target !== inputEl && !dropdownEl.contains(e.target)) close();
  });

  return { close, refresh: render };
}

function syncComboDisplay(comboId, id) {
  const input = document.getElementById('combo-input-' + comboId);
  const map = comboData[comboId];
  if (input) input.value = (id && map && map.byId.get(id)) || '';
}

window.setCombo = function(comboId, id) {
  const hidden = document.querySelector(`[data-combo="${comboId}"]`);
  if (hidden) { hidden.value = id || ''; hidden.dispatchEvent(new Event('change')); }
  syncComboDisplay(comboId, id);
};

// 폼 안의 고정 단일선택 콤보에 드롭다운 동작을 연결한다.
function wireSingleCombo(comboId) {
  const input = document.getElementById('combo-input-' + comboId);
  const hidden = document.querySelector(`[data-combo="${comboId}"]`);
  const dropdown = document.getElementById('ddl-' + comboId);
  if (!input || !hidden || !dropdown) return;
  createComboDropdown(comboId, input, dropdown, (label) => {
    const map = comboData[comboId];
    const id = map && map.byLabel.get(label);
    hidden.value = id || '';
    hidden.dispatchEvent(new Event('change'));
  });
  input.addEventListener('blur', () => {
    setTimeout(() => {
      const map = comboData[comboId];
      const val = input.value.trim();
      if (!val) { if (hidden.value) { hidden.value = ''; hidden.dispatchEvent(new Event('change')); } return; }
      if (!(map && map.byLabel.has(val))) {
        // 목록에 없는 값을 입력한 채 벗어나면, 마지막으로 유효했던 선택으로 되돌린다.
        syncComboDisplay(comboId, hidden.value);
      }
    }, 150);
  });
}

// ---------- 즉석 추가 (드롭다운에 원하는 값이 없을 때 바로 만들기) ----------
window.quickAdd = async function(table, promptText, buildPayload, onCreated) {
  const name = prompt(promptText);
  if (!name || !name.trim()) return;
  const payload = buildPayload(name.trim());
  const { data, error } = await supabase.from(table).insert(payload).select().single();
  if (error) { alert('생성 실패: ' + error.message); return; }
  // reloadAll이 select/체크박스 옵션을 다시 그리기 때문에, 다른 폼에서 이미 골라둔 값들이 날아가지 않게 보존한다.
  const preservedSelects = [...document.querySelectorAll('main select')].map(s => [s, s.value]);
  const preservedCombos = [...document.querySelectorAll('main [data-combo]')].map(el => [el.dataset.combo, el.value]);
  const preservedChecks = [...document.querySelectorAll('main input[type=checkbox]:checked')].map(c => [c.name, c.value]);
  // 지금 인라인 수정 중인 카드가 있다면, 표가 다시 그려지며 그 자리가 사라지기 전에 잠시 홈으로 빼둔다.
  const wasEditingKey = currentEditKey;
  if (wasEditingKey) moveCardHome(wasEditingKey);
  await reloadAll();
  preservedSelects.forEach(([s, v]) => { if (v && s.querySelector(`option[value="${v}"]`)) s.value = v; });
  preservedCombos.forEach(([comboId, v]) => { if (v) { const hidden = document.querySelector(`[data-combo="${comboId}"]`); if (hidden) hidden.value = v; syncComboDisplay(comboId, v); } });
  preservedChecks.forEach(([name, value]) => {
    const el = document.querySelector(`main input[type=checkbox][name="${name}"][value="${value}"]`);
    if (el) el.checked = true;
  });
  if (wasEditingKey) {
    const tbl = CANCEL_TABLE_MAP[wasEditingKey];
    const editId = editState[tbl];
    const btn = editId && document.querySelector(`.edit-btn[data-edit-table="${tbl}"][data-edit-id="${editId}"]`);
    if (btn) moveCardToRow(wasEditingKey, btn.closest('tr'));
  }
  onCreated(data.id);
};

// ---------- 사진 위젯 ----------
// key별로 현재 URL 배열을 들고 있다가, 폼 제출 시 그대로 payload에 실어보낸다.
let photoState = { work: [], show: [], person: [], participation: [], troupe: [], venue: [], role: [] };

function renderPhotoThumbs(key) {
  const box = document.getElementById('photos-' + key);
  box.innerHTML = photoState[key].map((url, i) =>
    `<div class="photo-thumb"><img src="${url}"><button type="button" class="rm-btn" data-photokey="${key}" data-idx="${i}">×</button></div>`
  ).join('');
}
function resetPhotoWidget(key, urls) {
  photoState[key] = urls ? [...urls] : [];
  renderPhotoThumbs(key);
  document.getElementById('upload-status-' + key).textContent = '';
}
document.querySelector('main').addEventListener('click', (e) => {
  const rm = e.target.closest('.rm-btn');
  if (!rm) return;
  const key = rm.dataset.photokey;
  photoState[key].splice(Number(rm.dataset.idx), 1);
  renderPhotoThumbs(key);
});
['work','show','person','participation','troupe','venue','role'].forEach(key => {
  document.getElementById('upload-' + key).addEventListener('change', async (e) => {
    const files = [...e.target.files];
    if (!files.length) return;
    const statusEl = document.getElementById('upload-status-' + key);
    for (const file of files) {
      statusEl.textContent = `업로드 중... (${file.name})`;
      try {
        const path = key + '/' + Date.now() + '_' + Math.random().toString(36).slice(2,7) + '_' + file.name.replace(/[^a-zA-Z0-9.\-_]/g,'_');
        const { error } = await supabase.storage.from('photos').upload(path, file);
        if (error) throw error;
        const { data } = supabase.storage.from('photos').getPublicUrl(path);
        photoState[key].push(data.publicUrl);
        renderPhotoThumbs(key);
        statusEl.textContent = '업로드 완료';
      } catch (err) {
        statusEl.textContent = '업로드 실패: ' + err.message;
      }
    }
    e.target.value = '';
  });
});

// ---------- SNS/홍보 링크 위젯 (사람) ----------
// 타이핑 중엔 행을 다시 그리지 않는다 (한글 IME 조합 깨짐 방지). 행 추가/삭제일 때만 DOM 구조를 바꾼다.
function addLinkRow(key, label = '', url = '') {
  const container = document.getElementById('links-' + key);
  const row = document.createElement('div');
  row.className = 'link-row';
  row.innerHTML = `<input type="text" class="link-label" placeholder="라벨 (예: Instagram)" value="${label.replace(/"/g,'&quot;')}">
    <input type="text" class="link-url" placeholder="https://..." value="${url.replace(/"/g,'&quot;')}">
    <button type="button" class="rm-link-btn">×</button>`;
  container.appendChild(row);
}
function resetLinkWidget(key, links) {
  document.getElementById('links-' + key).innerHTML = '';
  (links || []).forEach(l => addLinkRow(key, l.label || '', l.url || ''));
}
function collectLinks(key) {
  return [...document.getElementById('links-' + key).querySelectorAll('.link-row')]
    .map(row => ({ label: row.querySelector('.link-label').value.trim(), url: row.querySelector('.link-url').value.trim() }))
    .filter(l => l.url);
}
document.getElementById('add-link-person').addEventListener('click', () => addLinkRow('person'));
document.getElementById('add-link-troupe').addEventListener('click', () => addLinkRow('troupe'));
troupeRegionPicker.wire('troupe-region-chips', 'troupe-region-input', 'ddl-troupe-region');
personRolePicker.wire('person-role-chips', 'person-role-input', 'ddl-person-role');
document.querySelector('main').addEventListener('click', (e) => {
  const rm = e.target.closest('.rm-link-btn');
  if (!rm) return;
  rm.closest('.link-row').remove();
});

// ---------- 삭제 버튼 위임 처리 ----------
const FK_TABLE_LABELS = {
  participation_history: '참여이력', creation_history: '창작이력', shows: '공연',
  works: '작품', roles: '배역', staff_roles: '스텝역할', troupes: '단체', venues: '극장', people: '사람',
};
document.querySelector('main').addEventListener('click', async (e) => {
  const btn = e.target.closest('.del-btn');
  if (!btn) return;
  if (!confirm('정말 삭제할까요?')) return;
  const table = btn.dataset.table;
  const id = btn.dataset.id;
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) {
    if (error.code === '23503') {
      const m = /on table "([a-z_]+)"/.exec(error.message);
      const refTable = m ? (FK_TABLE_LABELS[m[1]] || m[1]) : '다른 데이터';
      alert(`삭제할 수 없어요: 이 항목이 "${refTable}"에서 아직 참조되고 있어요.\n먼저 ${refTable} 탭에서 관련 항목을 지우거나 다른 값으로 옮긴 뒤 다시 시도해주세요.`);
    } else {
      alert('삭제 실패: ' + error.message);
    }
    return;
  }
  reloadAll();
});

// ---------- 마스터 데이터 캐시 ----------
let cache = { troupes: [], venues: [], works: [], roles: [], staffRoles: [], people: [], creationTypes: [], shows: [],
  showsFull: [], participationRows: [], participationRoleLinks: [], participationStaffLinks: [], creationRows: [] };

async function loadMasterData() {
  const [troupes, venues, works, roles, staffRoles, people, creationTypes] = await Promise.all([
    supabase.from('troupes').select('*').order('name'),
    supabase.from('venues').select('*').order('name'),
    supabase.from('works').select('*').order('title'),
    supabase.from('roles').select('*').order('name'),
    supabase.from('staff_roles').select('*').order('order_num', {ascending: true, nullsFirst: false}),
    supabase.from('people').select('*').order('name'),
    supabase.from('creation_types').select('*').order('name'),
  ]);
  cache.troupes = troupes.data || [];
  cache.venues = venues.data || [];
  cache.works = works.data || [];
  cache.roles = roles.data || [];
  cache.staffRoles = staffRoles.data || [];
  cache.people = people.data || [];
  cache.creationTypes = creationTypes.data || [];

  updateGenreOptions();
  updateCountryOptions();
  updateRoleTagOptions();
  updateWorkTagOptions();
  updateOrgTypeOptions();
  updateTroupeRegionOptions();
  updatePersonRoleOptions();

  fillCombo('show-troupe', cache.troupes, 'id', 'name');
  fillCombo('show-venue', cache.venues, 'id', 'name');
  fillCombo('show-work', cache.works, 'id', 'title');
  fillCombo('entity-work', cache.works, 'id', 'title');
  fillCombo('entity-person', cache.people, 'id', 'name');
  fillCombo('entity-troupe', cache.troupes, 'id', 'name');
  fillCombo('entity-venue', cache.venues, 'id', 'name');
  fillCombo('entity-creationtype', cache.creationTypes, 'id', 'name');

  fillCombo('role-work', cache.works, 'id', 'title');
  fillCombo('participation-person', cache.people, 'id', 'name');
  fillCombo('creation-person', cache.people, 'id', 'name');
  fillCombo('creation-work', cache.works, 'id', 'title');
  fillCombo('creation-type', cache.creationTypes, 'id', 'name');
  fillCombo('workcreator-person', cache.people, 'id', 'name');
  fillCombo('workcreator-type', cache.creationTypes, 'id', 'name');

  document.getElementById('participation-staffroles-list').innerHTML = cache.staffRoles.map(s =>
    `<label><input type="checkbox" name="staff_role_ids" value="${s.id}"> ${s.name}</label>`).join('') || '<span class="empty">스텝역할이 없어요</span>';
}

async function loadShowsForParticipation() {
  const { data } = await supabase.from('shows').select('id,title,show_date,work_id,troupe_id').order('show_date', {ascending: false, nullsFirst: false});
  cache.shows = data || [];
  const showLabel = s => {
    const troupeName = cache.troupes.find(t => t.id === s.troupe_id)?.name;
    const parts = [s.title];
    if (troupeName) parts.push(troupeName);
    if (s.show_date) parts.push(s.show_date);
    return parts[0] + (parts.length > 1 ? ' (' + parts.slice(1).join(' · ') + ')' : '');
  };
  fillCombo('participation-show', cache.shows, 'id', showLabel);
  fillCombo('entity-show', cache.shows, 'id', showLabel);
}

async function rolesForShow(showId) {
  const show = cache.shows.find(s => s.id === showId);
  if (!show || !show.work_id) return [];
  return cache.roles.filter(r => r.work_id === show.work_id);
}

function renderRoleCheckboxes(roles, checkedIds = []) {
  const box = document.getElementById('participation-roles-list');
  box.innerHTML = roles.length
    ? roles.map(r => `<label><input type="checkbox" name="role_ids" value="${r.id}" ${checkedIds.includes(r.id)?'checked':''}> ${r.name}</label>`).join('')
    : '<span class="empty">이 공연 작품에 등록된 배역이 없어요. "+ 새 배역"으로 추가해보세요.</span>';
}

window.quickAddRole = function() {
  const showId = document.getElementById('participation-show-select').value;
  const show = cache.shows.find(s => s.id === showId);
  if (!show) { alert('먼저 공연을 선택해주세요.'); return; }
  if (!show.work_id) { alert('이 공연에는 아직 연결된 작품이 없어요. "공연" 탭에서 먼저 작품을 연결해주세요.'); return; }
  quickAdd('roles', '새 배역명을 입력하세요', n => ({ work_id: show.work_id, name: n }), async (id) => {
    const roles = await rolesForShow(showId);
    const checkedIds = [...document.querySelectorAll('#participation-roles-list input[name=role_ids]:checked')].map(c => c.value);
    renderRoleCheckboxes(roles, [...checkedIds, id]);
  });
};

document.getElementById('participation-show-select').addEventListener('change', async (e) => {
  const showId = e.target.value;
  if (!showId) { document.getElementById('participation-roles-list').innerHTML = '<span class="empty">공연을 먼저 선택하세요</span>'; return; }
  renderRoleCheckboxes(await rolesForShow(showId));
});

// 역할 구분(배우/스텝)에 따라 배역/스텝역할 목록 중 하나만 활성화
function applyRoleTypeGate() {
  const val = document.getElementById('participation-role-type').value;
  const rolesWrap = document.getElementById('participation-roles-wrap');
  const staffWrap = document.getElementById('participation-staffroles-wrap');
  const showRoles = val === '' || val === '배우';
  const showStaff = val === '' || val === '스텝';
  rolesWrap.style.display = showRoles ? '' : 'none';
  staffWrap.style.display = showStaff ? '' : 'none';
  if (!showRoles) rolesWrap.querySelectorAll('input[name=role_ids]:checked').forEach(c => c.checked = false);
  if (!showStaff) staffWrap.querySelectorAll('input[name=staff_role_ids]:checked').forEach(c => c.checked = false);
}
document.getElementById('participation-role-type').addEventListener('change', applyRoleTypeGate);

// ---------- 목록 렌더 ----------
const tableSortState = {}; // containerId -> {idx, dir}
const tableMeta = {}; // containerId -> {columns, tableName}

function renderTable(containerId, rows, columns, tableName, countId, editHandler) {
  const container = document.getElementById(containerId);
  if (countId) document.getElementById(countId).textContent = `(${rows.length}건)`;
  tableMeta[containerId] = { columns, tableName };
  if (!rows.length) { container.innerHTML = '<p class="empty">등록된 데이터가 없어요.</p>'; return; }

  const sortInfo = tableSortState[containerId];
  let sortedRows = rows;
  if (sortInfo) {
    const col = columns[sortInfo.idx];
    const getVal = col.sortValue || (col.key ? (r => r[col.key]) : null);
    if (getVal) {
      sortedRows = [...rows].sort((a, b) => {
        let va = getVal(a), vb = getVal(b);
        va = va == null ? '' : va; vb = vb == null ? '' : vb;
        if (typeof va === 'number' && typeof vb === 'number') return sortInfo.dir * (va - vb);
        return sortInfo.dir * String(va).localeCompare(String(vb));
      });
    }
  }

  const head = columns.map((c, i) => {
    const sortable = !!(c.sortValue || c.key);
    if (!sortable) return `<th>${c.label}</th>`;
    const arrow = sortInfo && sortInfo.idx === i ? (sortInfo.dir === 1 ? ' ▲' : ' ▼') : '';
    return `<th class="sortable-th" data-container="${containerId}" data-colidx="${i}">${c.label}${arrow}</th>`;
  }).join('') + '<th></th>';

  const body = sortedRows.map(r => {
    const cells = columns.map((c, ci) => {
      const content = c.render ? c.render(r) : (r[c.key] ?? '');
      if (c.editable) {
        const raw = (r[c.key] ?? '').toString().replace(/"/g,'&quot;');
        return `<td class="editable-cell" data-container="${containerId}" data-rowid="${r.id}" data-colidx="${ci}" data-value="${raw}">${content}</td>`;
      }
      return `<td>${content}</td>`;
    }).join('');
    const editBtn = editHandler ? `<button class="edit-btn" data-edit-table="${tableName}" data-edit-id="${r.id}">수정</button>` : '';
    return `<tr>${cells}<td class="row-actions">${editBtn}<button class="del-btn" data-table="${tableName}" data-id="${r.id}">삭제</button></td></tr>`;
  }).join('');
  container.innerHTML = `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

// 열 헤더 클릭 -> 정렬 토글
document.querySelector('main').addEventListener('click', (e) => {
  const th = e.target.closest('.sortable-th');
  if (!th) return;
  const containerId = th.dataset.container;
  const idx = Number(th.dataset.colidx);
  const cur = tableSortState[containerId];
  tableSortState[containerId] = (cur && cur.idx === idx) ? { idx, dir: -cur.dir } : { idx, dir: 1 };
  renderAllLists();
});

// 셀 인라인수정 후 전체 재조회(reloadAll) 없이, 캐시에 있는 해당 행만 바로 고쳐서 즉시 반영한다.
function patchCacheRow(tableName, rowId, patch) {
  const arraysByTable = {
    shows: [cache.shows, cache.showsFull],
    participation_history: [cache.participationRows],
    works: [cache.works],
    roles: [cache.roles],
    staff_roles: [cache.staffRoles],
    troupes: [cache.troupes],
    venues: [cache.venues],
    people: [cache.people],
    creation_history: [cache.creationRows],
  };
  (arraysByTable[tableName] || []).forEach(arr => {
    const row = (arr || []).find(r => r.id === rowId);
    if (row) Object.assign(row, patch);
  });
}

// 셀 더블클릭 -> 그 자리에서 바로 수정 (텍스트/숫자/날짜/셀렉트/참조검색)
document.querySelector('main').addEventListener('dblclick', (e) => {
  const td = e.target.closest('.editable-cell');
  if (!td || td.querySelector('input,select')) return;
  const containerId = td.dataset.container;
  const rowId = td.dataset.rowid;
  const colIdx = Number(td.dataset.colidx);
  const meta = tableMeta[containerId];
  if (!meta) return;
  const col = meta.columns[colIdx];
  const oldHtml = td.innerHTML;
  const curVal = td.dataset.value;

  // 다중선택형 컬럼(예: 작품 국가)은 칩+드롭다운+저장버튼으로 별도 처리한다.
  if (col.editType === 'multiselect') {
    const rowObj = (cache[col.multiCache] || []).find(x => x.id === rowId) || {};
    let cellArr = [...(rowObj[col.key] || [])];
    td.innerHTML = `<div class="cell-combo-wrap">
        <div class="combo-chips" style="margin-bottom:4px;"></div>
        <div style="display:flex; gap:4px;">
          <input type="text" placeholder="검색 또는 입력 후 Enter" autocomplete="off" style="flex:1; padding:4px; box-sizing:border-box;">
          <button type="button" class="btn secondary" style="margin-top:0; padding:2px 8px; font-size:12px;">저장</button>
        </div>
        <div class="combo-dropdown"></div>
      </div>`;
    const chipsBox = td.querySelector('.combo-chips');
    const cellInput = td.querySelector('input');
    const dropdownEl = td.querySelector('.combo-dropdown');
    const saveBtn = td.querySelector('button');
    function renderCellChips() {
      chipsBox.innerHTML = cellArr.map((c, i) =>
        `<span class="combo-chip">${c.replace(/</g,'&lt;')}<button type="button" class="rm-chip-btn" data-idx="${i}">×</button></span>`
      ).join('');
    }
    renderCellChips();
    chipsBox.addEventListener('mousedown', (e) => {
      const btn = e.target.closest('.rm-chip-btn');
      if (!btn) return;
      e.preventDefault();
      cellArr.splice(Number(btn.dataset.idx), 1);
      renderCellChips();
    });
    attachMultiSelectDropdown(cellInput, dropdownEl, col.optionsGetter || (() => COUNTRY_OPTIONS), (v) => cellArr.includes(v), (v) => {
      const idx = cellArr.indexOf(v);
      if (idx > -1) cellArr.splice(idx, 1); else cellArr.push(v);
      const opts = (col.optionsGetter || (() => COUNTRY_OPTIONS))();
      if (!opts.includes(v)) opts.push(v);
      renderCellChips();
    }, true);
    cellInput.focus();
    saveBtn.addEventListener('click', () => {
      const newVal = cellArr.length ? cellArr : null;
      supabase.from(meta.tableName).update({ [col.key]: newVal }).eq('id', rowId).then(({ error }) => {
        if (error) { alert('저장 실패: ' + error.message); td.innerHTML = oldHtml; return; }
        const wasEditingKey = currentEditKey;
        if (wasEditingKey) moveCardHome(wasEditingKey);
        patchCacheRow(meta.tableName, rowId, { [col.key]: newVal });
        renderAllLists();
        if (wasEditingKey) {
          const tbl = CANCEL_TABLE_MAP[wasEditingKey];
          const editId = editState[tbl];
          const btn = editId && document.querySelector(`.edit-btn[data-edit-table="${tbl}"][data-edit-id="${editId}"]`);
          if (btn) moveCardToRow(wasEditingKey, btn.closest('tr'));
        }
      });
    });
    return;
  }

  let inputHtml;
  if (col.editType === 'select') {
    inputHtml = `<select style="width:100%; padding:4px;">` +
      col.editOptions.map(o => `<option value="${o.value}" ${o.value === curVal ? 'selected' : ''}>${o.label}</option>`).join('') +
      `</select>`;
  } else if (col.editType === 'fk') {
    const map = comboData['entity-' + col.fkEntity];
    const curLabel = (curVal && map && map.byId.get(curVal)) || '';
    inputHtml = `<div class="cell-combo-wrap"><input type="text" value="${curLabel.replace(/"/g,'&quot;')}" placeholder="검색해서 선택" autocomplete="off" style="width:100%; padding:4px; box-sizing:border-box;"><div class="combo-dropdown"></div></div>`;
  } else {
    inputHtml = `<input type="${col.editType || 'text'}" value="${curVal}" style="width:100%; padding:4px; box-sizing:border-box;">`;
  }
  td.innerHTML = inputHtml;
  const inputEl = td.querySelector('input,select');
  if (col.editType === 'fk') {
    const dropdownEl = td.querySelector('.combo-dropdown');
    createComboDropdown('entity-' + col.fkEntity, inputEl, dropdownEl, () => {});
  }
  inputEl.focus();
  if (inputEl.select) inputEl.select();

  let cancelled = false;
  function commit() {
    if (cancelled) return;
    let newVal;
    if (col.editType === 'fk') {
      const map = comboData['entity-' + col.fkEntity];
      const label = inputEl.value.trim();
      if (!label) { newVal = null; }
      else if (map && map.byLabel.has(label)) { newVal = map.byLabel.get(label); }
      else { alert('목록에 있는 값을 검색해서 정확히 선택해주세요.'); td.innerHTML = oldHtml; return; }
    } else {
      newVal = inputEl.value === '' ? null : inputEl.value;
      if (newVal === 'true') newVal = true;
      else if (newVal === 'false') newVal = false;
    }
    supabase.from(meta.tableName).update({ [col.key]: newVal }).eq('id', rowId).then(({ error }) => {
      if (error) { alert('저장 실패: ' + error.message); td.innerHTML = oldHtml; return; }
      const wasEditingKey = currentEditKey;
      if (wasEditingKey) moveCardHome(wasEditingKey);
      patchCacheRow(meta.tableName, rowId, { [col.key]: newVal });
      renderAllLists();
      if (wasEditingKey) {
        const tbl = CANCEL_TABLE_MAP[wasEditingKey];
        const editId = editState[tbl];
        const btn = editId && document.querySelector(`.edit-btn[data-edit-table="${tbl}"][data-edit-id="${editId}"]`);
        if (btn) moveCardToRow(wasEditingKey, btn.closest('tr'));
      }
    });
  }
  inputEl.addEventListener('blur', () => setTimeout(commit, 120));
  inputEl.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') { ev.preventDefault(); inputEl.blur(); }
    if (ev.key === 'Escape') { cancelled = true; td.innerHTML = oldHtml; }
  });
});

function thumbHtml(urls) {
  if (!urls || !urls.length) return '';
  return `<img class="thumb" src="${urls[0]}">` + (urls.length > 1 ? `<span class="count-tag">+${urls.length-1}</span>` : '');
}
function tagsHtml(tags) {
  if (!tags || !tags.length) return '';
  return tags.map(t => `<span class="tag-badge">${(t||'').toString().replace(/</g,'&lt;')}</span>`).join('');
}

// 그룹 없음이면 평범한 표, 그룹 선택돼 있으면 그룹명별로 소제목+표를 나눠 그린다.
function renderGroupable(containerId, countId, rows, columns, tableName, groupLabelFn) {
  if (countId) document.getElementById(countId).textContent = `(${rows.length}건)`;
  const container = document.getElementById(containerId);
  if (!rows.length) { container.innerHTML = '<p class="empty">등록된 데이터가 없어요.</p>'; return; }
  if (!groupLabelFn) { renderTable(containerId, rows, columns, tableName, null, true); return; }
  const groups = {};
  rows.forEach(r => {
    let labels = groupLabelFn(r);
    if (!Array.isArray(labels)) labels = [labels];
    labels.forEach(k => { (groups[k] = groups[k] || []).push(r); });
  });
  const sortedKeys = Object.keys(groups).sort((a,b)=>a.localeCompare(b));
  let html = '';
  sortedKeys.forEach((k, i) => {
    html += `<div style="margin:16px 0 6px; font-weight:600; font-size:13.5px;">${k} <span class="count-tag">(${groups[k].length}건)</span></div>`;
    html += `<div id="${containerId}-grp-${i}"></div>`;
  });
  container.innerHTML = html;
  sortedKeys.forEach((k, i) => renderTable(`${containerId}-grp-${i}`, groups[k], columns, tableName, null, true));
}

async function reloadAll() {
  await loadMasterData();
  await loadShowsForParticipation();

  const { data: shows } = await supabase.from('shows').select('*').order('show_date', {ascending:false, nullsFirst:false});
  cache.shows = shows || cache.shows;
  cache.showsFull = shows || [];

  // 80건 제한 없이 전체 참여이력 로드
  const { data: parts } = await supabase.from('participation_history').select('*').order('created_at', {ascending:false});
  cache.participationRows = parts || [];
  // .in()으로 participation_id를 수백 개씩 나열하면 URL이 너무 길어져 요청이 실패할 수 있어서,
  // 필터 없이 두 연결 테이블 전체를 가져와 JS에서 매칭한다.
  const [{data: rlRows, error: rlErr}, {data: srRows, error: srErr}] = await Promise.all([
    supabase.from('participation_roles').select('participation_id,role_id'),
    supabase.from('participation_staff_roles').select('participation_id,staff_role_id'),
  ]);
  if (rlErr) console.error('participation_roles 로드 실패:', rlErr);
  if (srErr) console.error('participation_staff_roles 로드 실패:', srErr);
  cache.participationRoleLinks = rlRows || [];
  cache.participationStaffLinks = srRows || [];

  const { data: creations } = await supabase.from('creation_history').select('*');
  cache.creationRows = creations || [];

  renderAllLists();
}

function namesFor(pid, rows, key, list) {
  return (rows||[]).filter(r=>r.participation_id===pid).map(r=>list.find(x=>x.id===r[key])?.name).filter(Boolean).join(', ');
}

function searchVal(key) {
  return (document.getElementById('search-' + key)?.value || '').trim().toLowerCase();
}
function matches(term, ...fields) {
  if (!term) return true;
  return fields.some(f => (f || '').toString().toLowerCase().includes(term));
}

// 검색창 입력 시 재조회 없이 캐시된 데이터로만 다시 그린다 (IME 문제 없음: 입력창 자체는 다시 그리지 않음)
window.__applyFilters = renderAllLists;

// ---------- 열별 필터 (모든 목록에서, 셀렉트/fk/다중선택 컬럼 기준으로 자동 생성) ----------
let colFilters = {}; // tableName -> { colKey: value }
function renderColumnFilterBar(elId, tableKey, columns, rows) {
  const el = document.getElementById(elId);
  if (!el) return;
  const filterableCols = columns.filter(c => c.key && c.editable &&
    (c.editType === 'select' || c.editType === 'fk' || c.editType === 'multiselect'));
  if (!filterableCols.length) { el.innerHTML = ''; return; }
  const state = colFilters[tableKey] || {};
  el.innerHTML = filterableCols.map(c => {
    let options;
    if (c.editType === 'select') {
      options = c.editOptions.filter(o => o.value !== '');
    } else if (c.editType === 'fk') {
      const seen = new Map();
      rows.forEach(r => { const v = r[c.key]; if (v != null && !seen.has(v)) seen.set(v, c.render ? c.render(r) : v); });
      options = [...seen.entries()].map(([value, label]) => ({ value, label })).sort((a,b) => (a.label||'').localeCompare(b.label||''));
    } else { // multiselect
      const seen = new Set();
      rows.forEach(r => (r[c.key] || []).forEach(v => seen.add(v)));
      options = [...seen].sort().map(v => ({ value: v, label: v }));
    }
    const cur = state[c.key] || '';
    return `<select data-colkey="${c.key}" style="max-width:190px; font-size:12px; margin:0 6px 6px 0; padding:3px;">
      <option value="">${c.label}: 전체</option>
      ${options.map(o => `<option value="${(o.value+'').replace(/"/g,'&quot;')}" ${cur===o.value?'selected':''}>${(o.label||'').toString().replace(/</g,'&lt;')}</option>`).join('')}
    </select>`;
  }).join('');
  el.querySelectorAll('select').forEach(sel => {
    sel.addEventListener('change', () => {
      const key = sel.dataset.colkey;
      const val = sel.value;
      colFilters[tableKey] = colFilters[tableKey] || {};
      if (val) colFilters[tableKey][key] = val; else delete colFilters[tableKey][key];
      renderAllLists();
    });
  });
}
function applyColumnFilters(tableKey, columns, rows) {
  const state = colFilters[tableKey];
  if (!state || !Object.keys(state).length) return rows;
  return rows.filter(r => Object.keys(state).every(key => {
    const col = columns.find(c => c.key === key);
    const val = state[key];
    if (col && col.editType === 'multiselect') return (r[key] || []).includes(val);
    return r[key] != null && r[key].toString() === val;
  }));
}

function renderAllLists() {
  const tShow = searchVal('show');
  const showColumns = [
    {label:'포스터', render: r => thumbHtml(r.poster_urls)},
    {label:'공연명', key:'title', editable:true},
    {label:'연결작품', key:'work_id', editable:true, editType:'fk', fkEntity:'work',
      render: r => cache.works.find(w=>w.id===r.work_id)?.title || '<span class="warn-badge">⚠ 작품 미연결</span>'},
    {label:'시작일', key:'show_date', editable:true, editType:'date'},
    {label:'종료일', key:'end_date', editable:true, editType:'date'},
    {label:'단체', key:'troupe_id', editable:true, editType:'fk', fkEntity:'troupe',
      render: r => cache.troupes.find(t=>t.id===r.troupe_id)?.name || ''},
    {label:'극장', key:'venue_id', editable:true, editType:'fk', fkEntity:'venue',
      render: r => cache.venues.find(v=>v.id===r.venue_id)?.name || ''},
    {label:'라이선스', key:'is_licensed', editable:true, editType:'select', editOptions:[{value:'',label:'(미상)'},{value:'창작',label:'창작'},{value:'완료',label:'완료'},{value:'미확보',label:'미확보'}],
      render: r => !r.is_licensed ? '<span class="warn-badge">⚠ 라이선스 미입력</span>'
        : r.is_licensed === '미확보' ? '<span class="warn-badge">⚠ 라이선스 미확보</span>'
        : r.is_licensed},
    {label:'관객수', key:'audience_count', editable:true, editType:'number'},
    {label:'매진', key:'is_sold_out', editable:true, editType:'select', editOptions:[{value:'',label:'(없음)'},{value:'true',label:'매진'},{value:'false',label:'미매진'}], render: r => r.is_sold_out==null?'':(r.is_sold_out?'매진':'미매진')},
    {label:'재공연', key:'has_rerun', editable:true, editType:'select', editOptions:[{value:'',label:'(없음)'},{value:'true',label:'있음'},{value:'false',label:'없음'}], render: r => r.has_rerun==null?'':(r.has_rerun?'있음':'없음')},
    {label:'숨김', key:'is_hidden', editable:true, editType:'select', editOptions:[{value:'false',label:'공개'},{value:'true',label:'숨김'}],
      render: r => r.is_hidden ? '<span class="warn-badge">⚠ 숨김(저작권 신고 등)</span>' : ''},
  ];
  renderColumnFilterBar('qf-show', 'shows', showColumns, cache.showsFull);
  renderTable('list-show', applyColumnFilters('shows', showColumns, cache.showsFull).filter(r => matches(tShow, r.title,
    cache.troupes.find(t=>t.id===r.troupe_id)?.name, cache.venues.find(v=>v.id===r.venue_id)?.name)),
    showColumns, 'shows', 'count-show', true);

  const tPart = searchVal('participation');
  const partColumns = [
    {label:'참여자', key:'person_id', editable:true, editType:'fk', fkEntity:'person',
      render: r => cache.people.find(p=>p.id===r.person_id)?.name || '', sortValue: r => cache.people.find(p=>p.id===r.person_id)?.name || ''},
    {label:'공연', key:'show_id', editable:true, editType:'fk', fkEntity:'show',
      render: r => cache.shows.find(s=>s.id===r.show_id)?.title || '', sortValue: r => cache.shows.find(s=>s.id===r.show_id)?.title || ''},
    {label:'단체', render: r => { const s = cache.shows.find(s=>s.id===r.show_id); return cache.troupes.find(t=>t.id===s?.troupe_id)?.name || ''; }},
    {label:'역할구분', key:'role_type', editable:true, editType:'select', editOptions:[{value:'',label:'(없음)'},{value:'배우',label:'배우'},{value:'스텝',label:'스텝'}]},
    {label:'배역/스텝', render: r => {
      const roleNames = namesFor(r.id, cache.participationRoleLinks, 'role_id', cache.roles);
      const staffNames = namesFor(r.id, cache.participationStaffLinks, 'staff_role_id', cache.staffRoles);
      const parts = [roleNames, staffNames].filter(Boolean);
      return parts.length ? parts.join(' / ') : '<span class="warn-badge">⚠ 배역·스텝 미지정</span>';
    }},
    {label:'사진', render: r => thumbHtml(r.photo_urls)},
  ];
  renderColumnFilterBar('qf-participation', 'participation_history', partColumns, cache.participationRows);
  const partFiltered = applyColumnFilters('participation_history', partColumns, cache.participationRows).filter(r => {
    const personName = cache.people.find(p=>p.id===r.person_id)?.name;
    const showTitle = cache.shows.find(s=>s.id===r.show_id)?.title;
    const roleNames = namesFor(r.id, cache.participationRoleLinks, 'role_id', cache.roles);
    const staffNames = namesFor(r.id, cache.participationStaffLinks, 'staff_role_id', cache.staffRoles);
    return matches(tPart, personName, showTitle, roleNames, staffNames);
  });
  const groupBy = document.getElementById('group-participation')?.value || '';
  const groupLabelFn = !groupBy ? null : (row => groupBy === 'show'
    ? (cache.shows.find(s=>s.id===row.show_id)?.title || '(공연 없음)')
    : (cache.people.find(p=>p.id===row.person_id)?.name || '(참여자 없음)'));
  renderGroupable('list-participation', 'count-participation', partFiltered, partColumns, 'participation_history', groupLabelFn);

  function creatorsFor(workId) {
    return cache.creationRows.filter(c => c.work_id === workId)
      .map(c => {
        const person = cache.people.find(p=>p.id===c.person_id)?.name;
        const type = cache.creationTypes.find(t=>t.id===c.creation_type_id)?.name;
        return person ? `${person}${type ? '('+type+')' : ''}` : '';
      }).filter(Boolean).join(', ');
  }
  const tWork = searchVal('work');
  const workColumns = [
    {label:'포스터', render: r => thumbHtml(r.poster_urls)},
    {label:'작품명', key:'title', editable:true},
    {label:'창작자', render: r => creatorsFor(r.id) || '<span class="warn-badge">⚠ 입력 필요</span>'},
    {label:'구분', key:'genre', editable:true, editType:'select', editOptions: genreEditOptions()},
    {label:'국가', key:'country', editable:true, editType:'multiselect', multiCache:'works', render: r => (r.country||[]).join(', ')},
    {label:'태그', key:'tags', editable:true, editType:'multiselect', multiCache:'works', optionsGetter: () => WORK_TAG_OPTIONS, render: r => tagsHtml(r.tags) || ''},
    {label:'권리유형', key:'rights_type', editable:true, editType:'select',
      editOptions:[{value:'',label:'(미분류)'},{value:'창작',label:'창작'},{value:'번안',label:'번안'},{value:'해외라이선스',label:'해외라이선스'},{value:'공유저작물',label:'공유저작물'},{value:'확인불가',label:'확인불가'}],
      render: r => r.rights_type || '<span class="warn-badge">⚠ 미분류</span>'},
    {label:'아마추어 라이선스', key:'amateur_license_status', editable:true, editType:'select',
      editOptions:[{value:'확인불가',label:'확인불가'},{value:'제공',label:'제공'},{value:'협의가능',label:'협의가능'},{value:'미제공',label:'미제공'}],
      render: r => r.amateur_license_status === '제공' ? '<b style="color:var(--ok)">제공</b>' : (r.amateur_license_status || '')},
  ];
  const workGroupBy = document.getElementById('group-work')?.value || '';
  const workGroupFn = workGroupBy === 'genre' ? (r => r.genre || '(구분 미입력)') : null;
  renderColumnFilterBar('qf-work', 'works', workColumns, cache.works);
  renderGroupable('list-work', 'count-work', applyColumnFilters('works', workColumns, cache.works).filter(r => matches(tWork, r.title, r.title_en, r.genre, (r.country||[]).join(' '), (r.tags||[]).join(' '))), workColumns, 'works', workGroupFn);

  const tRole = searchVal('role');
  const roleColumns = [
    {label:'사진', render: r => thumbHtml(r.photo_urls)},
    {label:'배역명', key:'name', editable:true},
    {label:'작품', key:'work_id', editable:true, editType:'fk', fkEntity:'work',
      render: r => cache.works.find(w=>w.id===r.work_id)?.title || '<span class="warn-badge">⚠ 작품 미지정</span>', sortValue: r => cache.works.find(w=>w.id===r.work_id)?.title || ''},
    {label:'순서', key:'order_num', editable:true, editType:'number'},
    {label:'성별', key:'gender', editable:true, editType:'select', editOptions:[{value:'',label:'(없음)'},{value:'남',label:'남'},{value:'여',label:'여'}],
      render: r => r.gender || '<span class="warn-badge">⚠ 입력 필요</span>'},
    {label:'태그', key:'tags', editable:true, editType:'multiselect', multiCache:'roles', optionsGetter: () => ROLE_TAG_OPTIONS, render: r => tagsHtml(r.tags) || ''},
  ];
  renderColumnFilterBar('qf-role', 'roles', roleColumns, cache.roles);
  const roleGroupBy = document.getElementById('group-role')?.value || '';
  const roleGroupFn = roleGroupBy === 'work' ? (r => cache.works.find(w=>w.id===r.work_id)?.title || '(작품 없음)') : null;
  renderGroupable('list-role', 'count-role', applyColumnFilters('roles', roleColumns, cache.roles).filter(r => matches(tRole, r.name, cache.works.find(w=>w.id===r.work_id)?.title, (r.tags||[]).join(' '))), roleColumns, 'roles', roleGroupFn);

  const tTroupe = searchVal('troupe');
  const troupeColumns = [
    {label:'사진', render: r => thumbHtml(r.photo_urls)},
    {label:'단체명', key:'name', editable:true},
    {label:'조직형태', key:'org_type', editable:true, editType:'multiselect', multiCache:'troupes', optionsGetter: () => ORG_TYPE_OPTIONS, render: r => (r.org_type||[]).join(', ')},
    {label:'구성원기반', key:'member_base', editable:true, editType:'select', editOptions:[{value:'',label:'(없음)'},{value:'학생',label:'학생'},{value:'직장인',label:'직장인'},{value:'일반',label:'일반'}]},
    {label:'운영상태', key:'status', editable:true, editType:'select', editOptions:[{value:'',label:'(없음)'},{value:'창단준비중',label:'창단준비중'},{value:'활동중',label:'활동중'},{value:'활동뜸함',label:'활동뜸함'},{value:'해체',label:'해체'}]},
    {label:'활동지역', key:'region', editable:true, editType:'multiselect', multiCache:'troupes', optionsGetter: () => TROUPE_REGION_OPTIONS, render: r => (r.region||[]).join(', ')},
    {label:'연락처', key:'contact', editable:true},
  ];
  renderColumnFilterBar('qf-troupe', 'troupes', troupeColumns, cache.troupes);
  const troupeGroupBy = document.getElementById('group-troupe')?.value || '';
  const troupeGroupFn = troupeGroupBy === 'orgtype' ? (r => (r.org_type && r.org_type.length) ? r.org_type : ['(미분류)'])
    : troupeGroupBy === 'memberbase' ? (r => r.member_base || '(미분류)') : null;
  renderGroupable('list-troupe', 'count-troupe',
    applyColumnFilters('troupes', troupeColumns, cache.troupes).filter(r => matches(tTroupe, r.name, (r.org_type||[]).join(' '), r.member_base, (r.region||[]).join(' '))),
    troupeColumns, 'troupes', troupeGroupFn);

  const tVenue = searchVal('venue');
  const venueColumns = [
    {label:'사진', render: r => thumbHtml(r.photo_urls)},
    {label:'극장명', key:'name', editable:true},
    {label:'최소좌석', key:'seat_count', editable:true, editType:'number'},
    {label:'최대좌석', key:'seat_count_max', editable:true, editType:'number'},
    {label:'주소', key:'address', editable:true},
    {label:'대관료', key:'rental_fee', editable:true},
    {label:'대관가능', key:'rental_available', editable:true, editType:'select', editOptions:[{value:'',label:'(없음)'},{value:'true',label:'가능'},{value:'false',label:'불가'}], render: r => r.rental_available==null?'':(r.rental_available?'가능':'불가')},
    {label:'주차', key:'parking_available', editable:true, editType:'select', editOptions:[{value:'',label:'(없음)'},{value:'true',label:'가능'},{value:'false',label:'불가'}], render: r => r.parking_available==null?'':(r.parking_available?'가능':'불가')},
    {label:'연락처', key:'contact', editable:true},
  ];
  renderColumnFilterBar('qf-venue', 'venues', venueColumns, cache.venues);
  renderTable('list-venue', applyColumnFilters('venues', venueColumns, cache.venues).filter(r => matches(tVenue, r.name, r.address)), venueColumns, 'venues', 'count-venue', true);

  const tStaffrole = searchVal('staffrole');
  const staffroleColumns = [{label:'이름', key:'name', editable:true}, {label:'순서', key:'order_num', editable:true, editType:'number'}];
  renderColumnFilterBar('qf-staffrole', 'staff_roles', staffroleColumns, cache.staffRoles);
  renderTable('list-staffrole', applyColumnFilters('staff_roles', staffroleColumns, cache.staffRoles).filter(r => matches(tStaffrole, r.name)),
    staffroleColumns, 'staff_roles', 'count-staffrole', true);

  const tPerson = searchVal('person');
  const personColumns = [
    {label:'사진', render: r => thumbHtml(r.photo_urls)},
    {label:'이름', key:'name', editable:true}, {label:'닉네임', key:'nickname', editable:true},
    {label:'생년월일', key:'birth_date', editable:true, editType:'date'},
    {label:'성별', key:'gender', editable:true, editType:'select', editOptions:[{value:'',label:'(없음)'},{value:'남',label:'남'},{value:'여',label:'여'},{value:'기타',label:'기타'}]},
    {label:'역할', key:'roles', editable:true, editType:'multiselect', multiCache:'people', optionsGetter: () => PERSON_ROLE_OPTIONS, render: r => (r.roles||[]).join(', ')},
  ];
  renderColumnFilterBar('qf-person', 'people', personColumns, cache.people);
  renderTable('list-person', applyColumnFilters('people', personColumns, cache.people).filter(r => matches(tPerson, r.name, r.name_en, r.nickname, (r.roles||[]).join(' '))),
    personColumns, 'people', 'count-person', true);

  const tCreation = searchVal('creation');
  const creationColumns = [
    {label:'사람', key:'person_id', editable:true, editType:'fk', fkEntity:'person',
      render: r => cache.people.find(p=>p.id===r.person_id)?.name || '', sortValue: r => cache.people.find(p=>p.id===r.person_id)?.name || ''},
    {label:'작품', key:'work_id', editable:true, editType:'fk', fkEntity:'work',
      render: r => cache.works.find(w=>w.id===r.work_id)?.title || '', sortValue: r => cache.works.find(w=>w.id===r.work_id)?.title || ''},
    {label:'유형', key:'creation_type_id', editable:true, editType:'fk', fkEntity:'creationtype',
      render: r => cache.creationTypes.find(c=>c.id===r.creation_type_id)?.name || '', sortValue: r => cache.creationTypes.find(c=>c.id===r.creation_type_id)?.name || ''},
  ];
  renderColumnFilterBar('qf-creation', 'creation_history', creationColumns, cache.creationRows);
  renderTable('list-creation', applyColumnFilters('creation_history', creationColumns, cache.creationRows).filter(r => matches(tCreation,
    cache.people.find(p=>p.id===r.person_id)?.name, cache.works.find(w=>w.id===r.work_id)?.title,
    cache.creationTypes.find(c=>c.id===r.creation_type_id)?.name)),
    creationColumns, 'creation_history', 'count-creation', true);
}

// ---------- 수정 상태 관리 ----------
// 한 번에 한 폼만 수정 모드로 두되, 폼별로 독립적으로 취급한다.
const editState = {}; // { tableName: id }

// 수정 버튼을 누르면 폼 카드를 맨 위에서 그 행 바로 아래로 옮긴다 (스크롤 없이 그 자리에서 수정).
const cardHomes = {}; // key -> {parent, next}
const TABLE_TO_KEY = {
  shows: 'show', participation_history: 'participation', works: 'work', roles: 'role',
  troupes: 'troupe', venues: 'venue', staff_roles: 'staffrole', people: 'person', creation_history: 'creation'
};
function captureCardHomes() {
  ['show','participation','work','role','troupe','venue','staffrole','person','creation'].forEach(key => {
    const card = document.getElementById('formcard-' + key);
    if (card) { cardHomes[key] = { parent: card.parentElement, next: card.nextElementSibling }; card.style.display = 'none'; }
  });
}

window.showNewForm = function(key) {
  if (currentEditKey && currentEditKey !== key) moveCardHome(currentEditKey);
  moveCardHome(key);
  const table = CANCEL_TABLE_MAP[key];
  const form = document.getElementById('form-' + key);
  form.reset();
  delete editState[table];
  setEditMode('form-' + key, table, false);
  if (photoState[key]) resetPhotoWidget(key, []);
  if (key === 'person') { resetLinkWidget('person', []); personRolePicker.reset([]); personRolePicker.render('person-role-chips'); }
  if (key === 'troupe') { document.querySelectorAll('#troupe-org-type-list input:checked').forEach(c=>c.checked=false); troupeRegionPicker.reset([]); troupeRegionPicker.render('troupe-region-chips'); }
  if (key === 'work') resetWorkCreatorWidget([]);
  if (key === 'work') resetWorkCountries([]);
  if (key === 'work') resetWorkTags([]);
  if (key === 'role') resetRoleTags([]);
  if (key === 'participation') {
    document.getElementById('participation-roles-list').innerHTML = '<span class="empty">공연을 먼저 선택하세요</span>';
    form.querySelectorAll('input[name=staff_role_ids]:checked').forEach(c=>c.checked=false);
    applyRoleTypeGate();
  }
  // 목록에 열필터가 걸려있으면, 그 값을 새 등록 폼에 미리 채워준다 (해당 이름의 필드가 폼에 있을 때만)
  const activeFilters = colFilters[table];
  if (activeFilters) {
    Object.keys(activeFilters).forEach(colKey => {
      const val = activeFilters[colKey];
      const field = form.querySelector(`[name="${colKey}"]`);
      if (!field) return;
      if (field.dataset.combo) { setCombo(field.dataset.combo, val); }
      else { field.value = val; field.dispatchEvent(new Event('change')); }
    });
  }
  document.getElementById('formcard-' + key).style.display = 'block';
  document.getElementById('formcard-' + key).scrollIntoView({behavior:'smooth', block:'start'});
};
let currentEditKey = null;
function moveCardHome(key) {
  const card = document.getElementById('formcard-' + key);
  const home = cardHomes[key];
  if (!card || !home) return;
  const wrapperTr = card.closest('tr.inline-edit-row');
  home.parent.insertBefore(card, home.next);
  if (wrapperTr) wrapperTr.remove();
  if (currentEditKey === key) currentEditKey = null;
}
function moveCardToRow(key, rowEl) {
  const card = document.getElementById('formcard-' + key);
  if (!card || !rowEl) return;
  Object.keys(cardHomes).forEach(k => { if (k !== key) moveCardHome(k); });
  card.style.display = 'block';
  const tr = document.createElement('tr');
  tr.className = 'inline-edit-row';
  const td = document.createElement('td');
  td.colSpan = 20;
  tr.appendChild(td);
  rowEl.after(tr);
  td.appendChild(card);
  card.scrollIntoView({behavior:'smooth', block:'center'});
  currentEditKey = key;
}

const FORM_ADD_TITLES = {
  show: '새 공연 등록', participation: '새 참여이력 입력', work: '새 작품 등록', role: '새 배역 등록',
  troupe: '새 단체 등록', venue: '새 극장 등록', staffrole: '새 스텝역할 등록', person: '새 사람 등록', creation: '새 창작이력 등록'
};
function setEditMode(formId, tableName, on) {
  const form = document.getElementById(formId);
  const key = formId.replace('form-','');
  form.querySelector('button[type=submit]').textContent = on ? (form.dataset.editLabel || '수정 저장') : (form.dataset.addLabel);
  document.getElementById('cancel-' + key).classList.toggle('show', on);
  document.getElementById('formtitle-' + key).textContent = on ? '수정 중' : FORM_ADD_TITLES[key];
  if (!on) {
    delete editState[tableName];
    moveCardHome(TABLE_TO_KEY[tableName]);
  }
}

function fillFormFields(form, row) {
  [...form.elements].forEach(el => {
    if (!el.name || !(el.name in row)) return;
    el.value = row[el.name] ?? '';
    if (el.dataset.combo) syncComboDisplay(el.dataset.combo, row[el.name]);
  });
}

const CANCEL_TABLE_MAP = {
  show: 'shows', participation: 'participation_history', work: 'works', role: 'roles',
  troupe: 'troupes', venue: 'venues', staffrole: 'staff_roles', person: 'people', creation: 'creation_history'
};
document.querySelectorAll('.cancel-edit-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const key = btn.id.replace('cancel-','');
    const formId = 'form-' + key;
    const form = document.getElementById(formId);
    form.reset();
    setEditMode(formId, CANCEL_TABLE_MAP[key], false);
    moveCardHome(key);
    if (photoState[key]) resetPhotoWidget(key, []);
    if (key === 'person') { resetLinkWidget('person', []); personRolePicker.reset([]); personRolePicker.render('person-role-chips'); }
    if (key === 'troupe') { resetLinkWidget('troupe', []); document.querySelectorAll('#troupe-org-type-list input:checked').forEach(c=>c.checked=false); troupeRegionPicker.reset([]); troupeRegionPicker.render('troupe-region-chips'); }
    if (key === 'work') resetWorkCreatorWidget([]);
    if (key === 'work') resetWorkCountries([]);
    if (key === 'work') resetWorkTags([]);
    if (key === 'role') resetRoleTags([]);
      if (key === 'participation') {
      document.getElementById('participation-roles-list').innerHTML = '<span class="empty">공연을 먼저 선택하세요</span>';
      form.querySelectorAll('input[name=staff_role_ids]:checked').forEach(c=>c.checked=false);
      applyRoleTypeGate();
    }
    document.getElementById('formcard-' + key).style.display = 'none';
  });
});

// ---------- 수정 버튼 델리게이션 (탭별 분기) ----------
document.querySelector('main').addEventListener('click', async (e) => {
  const btn = e.target.closest('.edit-btn');
  if (!btn) return;
  const table = btn.dataset.editTable;
  const id = btn.dataset.editId;

  if (table === 'shows') {
    const row = cache.shows.find(s => s.id === id) || (await supabase.from('shows').select('*').eq('id', id).single()).data;
    const form = document.getElementById('form-show');
    fillFormFields(form, row);
    resetPhotoWidget('show', row.poster_urls);
    editState['shows'] = id;
    setEditMode('form-show', 'shows', true);
    moveCardToRow('show', btn.closest('tr'));
  }
  else if (table === 'participation_history') {
    const row = (await supabase.from('participation_history').select('*').eq('id', id).single()).data;
    const form = document.getElementById('form-participation');
    fillFormFields(form, row);
    resetPhotoWidget('participation', row.photo_urls);
    const roles = await rolesForShow(row.show_id);
    const { data: rl } = await supabase.from('participation_roles').select('role_id').eq('participation_id', id);
    const { data: sr } = await supabase.from('participation_staff_roles').select('staff_role_id').eq('participation_id', id);
    renderRoleCheckboxes(roles, (rl||[]).map(x=>x.role_id));
    const staffIds = (sr||[]).map(x=>x.staff_role_id);
    form.querySelectorAll('input[name=staff_role_ids]').forEach(c => c.checked = staffIds.includes(c.value));
    applyRoleTypeGate();
    editState['participation_history'] = id;
    setEditMode('form-participation', 'participation_history', true);
    moveCardToRow('participation', btn.closest('tr'));
  }
  else if (table === 'works') {
    const row = cache.works.find(w => w.id === id);
    fillFormFields(document.getElementById('form-work'), row);
    resetPhotoWidget('work', row.poster_urls);
    resetWorkCreatorWidget(cache.creationRows.filter(c => c.work_id === id));
    resetWorkCountries(row.country || []);
    resetWorkTags(row.tags || []);
    editState['works'] = id;
    setEditMode('form-work', 'works', true);
    moveCardToRow('work', btn.closest('tr'));
  }
  else if (table === 'people') {
    const row = cache.people.find(p => p.id === id);
    fillFormFields(document.getElementById('form-person'), row);
    resetPhotoWidget('person', row.photo_urls);
    resetLinkWidget('person', row.social_links);
    personRolePicker.reset(row.roles || []);
    personRolePicker.render('person-role-chips');
    editState['people'] = id;
    setEditMode('form-person', 'people', true);
    moveCardToRow('person', btn.closest('tr'));
  }
  else {
    // roles, troupes, venues, staff_roles, creation_history 등 단순 폼
    const formMap = { roles: 'form-role', troupes: 'form-troupe', venues: 'form-venue', staff_roles: 'form-staffrole', creation_history: 'form-creation' };
    const cacheMap = { roles: 'roles', troupes: 'troupes', venues: 'venues', staff_roles: 'staffRoles', creation_history: null };
    const formId = formMap[table];
    let row;
    if (cacheMap[table]) row = cache[cacheMap[table]].find(x => x.id === id);
    else row = (await supabase.from(table).select('*').eq('id', id).single()).data;
    fillFormFields(document.getElementById(formId), row);
    if (table === 'troupes') {
      resetPhotoWidget('troupe', row.photo_urls);
      resetLinkWidget('troupe', row.social_links);
      const orgVals = row.org_type || [];
      document.querySelectorAll('#troupe-org-type-list input[name=org_type_vals]').forEach(c => c.checked = orgVals.includes(c.value));
      troupeRegionPicker.reset(row.region || []);
      troupeRegionPicker.render('troupe-region-chips');
    }
    if (table === 'venues') resetPhotoWidget('venue', row.photo_urls);
    if (table === 'roles') { resetRoleTags(row.tags || []); resetPhotoWidget('role', row.photo_urls); }
    editState[table] = id;
    setEditMode(formId, table, true);
    moveCardToRow(TABLE_TO_KEY[table], btn.closest('tr'));
  }
});

// ---------- 폼 제출 처리 ----------
function formToObj(form, skipNames = []) {
  const obj = {};
  new FormData(form).forEach((v, k) => {
    if (skipNames.includes(k)) return;
    if (v === '') return;
    obj[k] = v;
  });
  return obj;
}

document.getElementById('form-show').dataset.addLabel = '공연 저장';
document.getElementById('form-participation').dataset.addLabel = '참여이력 저장';
document.getElementById('form-work').dataset.addLabel = '작품 저장';
document.getElementById('form-role').dataset.addLabel = '배역 저장';
document.getElementById('form-troupe').dataset.addLabel = '단체 저장';
document.getElementById('form-venue').dataset.addLabel = '극장 저장';
document.getElementById('form-staffrole').dataset.addLabel = '스텝역할 저장';
document.getElementById('form-person').dataset.addLabel = '사람 저장';
document.getElementById('form-creation').dataset.addLabel = '창작이력 저장';

document.getElementById('form-show').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const payload = formToObj(form);
  payload.poster_urls = photoState.show.length ? photoState.show : null;
  const editId = editState['shows'];
  const { error } = editId
    ? await supabase.from('shows').update(payload).eq('id', editId)
    : await supabase.from('shows').insert(payload);
  if (error) { showMsg('msg-show', false, '저장 실패: ' + error.message); return; }
  showMsg('msg-show', true, '저장됐어요.');
  form.reset();
  resetPhotoWidget('show', []);
  setEditMode('form-show', 'shows', false);
  document.getElementById('formcard-show').style.display = 'none';
  reloadAll();
});

document.getElementById('form-participation').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const roleIds = [...form.querySelectorAll('input[name=role_ids]:checked')].map(c => c.value);
  const staffRoleIds = [...form.querySelectorAll('input[name=staff_role_ids]:checked')].map(c => c.value);
  const payload = formToObj(form, ['role_ids', 'staff_role_ids']);
  payload.photo_urls = photoState.participation.length ? photoState.participation : null;
  const editId = editState['participation_history'];
  let partId;
  if (editId) {
    const { error } = await supabase.from('participation_history').update(payload).eq('id', editId);
    if (error) { showMsg('msg-participation', false, '저장 실패: ' + error.message); return; }
    partId = editId;
    await supabase.from('participation_roles').delete().eq('participation_id', editId);
    await supabase.from('participation_staff_roles').delete().eq('participation_id', editId);
  } else {
    const { data, error } = await supabase.from('participation_history').insert(payload).select().single();
    if (error) { showMsg('msg-participation', false, '저장 실패: ' + error.message); return; }
    partId = data.id;
  }
  if (roleIds.length) await supabase.from('participation_roles').insert(roleIds.map(rid => ({participation_id: partId, role_id: rid})));
  if (staffRoleIds.length) await supabase.from('participation_staff_roles').insert(staffRoleIds.map(sid => ({participation_id: partId, staff_role_id: sid})));
  showMsg('msg-participation', true, '저장됐어요.');
  form.reset();
  resetPhotoWidget('participation', []);
  setEditMode('form-participation', 'participation_history', false);
  document.getElementById('formcard-participation').style.display = 'none';
  document.getElementById('participation-roles-list').innerHTML = '<span class="empty">공연을 먼저 선택하세요</span>';
  reloadAll();
});

function simpleFormHandler(formId, tableName, msgId, photoKey) {
  document.getElementById(formId).addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const payload = formToObj(form, ['org_type_vals']);
    if (photoKey) payload[photoKey === 'work' || photoKey === 'show' ? 'poster_urls' : 'photo_urls'] = photoState[photoKey].length ? photoState[photoKey] : null;
    if (tableName === 'people') {
      payload.social_links = collectLinks('person');
      payload.roles = personRolePicker.state.length ? personRolePicker.state : null;
    }
    if (tableName === 'troupes') {
      const orgVals = [...form.querySelectorAll('input[name=org_type_vals]:checked')].map(c => c.value);
      payload.org_type = orgVals.length ? orgVals : null;
      payload.social_links = collectLinks('troupe');
      payload.region = troupeRegionPicker.state.length ? troupeRegionPicker.state : null;
    }
    if (tableName === 'roles') {
      payload.tags = roleTagsState.length ? roleTagsState : null;
    }
    if (tableName === 'works') {
      payload.country = workCountriesState.length ? workCountriesState : null;
      payload.tags = workTagsState.length ? workTagsState : null;
    }
    const editId = editState[tableName];
    let savedId = editId;
    const { data, error } = editId
      ? await supabase.from(tableName).update(payload).eq('id', editId).select().single()
      : await supabase.from(tableName).insert(payload).select().single();
    if (error) { showMsg(msgId, false, '저장 실패: ' + error.message); return; }
    savedId = data.id;
    if (tableName === 'works') {
      const err = await saveWorkCreators(savedId);
      if (err) { showMsg(msgId, false, '저장 실패(창작자): ' + err); return; }
    }
    showMsg(msgId, true, '저장됐어요.');
    form.reset();
    if (photoKey) resetPhotoWidget(photoKey, []);
    if (tableName === 'people') { resetLinkWidget('person', []); personRolePicker.reset([]); personRolePicker.render('person-role-chips'); }
    if (tableName === 'troupes') { resetLinkWidget('troupe', []); troupeRegionPicker.reset([]); troupeRegionPicker.render('troupe-region-chips'); }
    if (tableName === 'works') resetWorkCreatorWidget([]);
    if (tableName === 'works') resetWorkCountries([]);
    if (tableName === 'works') resetWorkTags([]);
    if (tableName === 'roles') resetRoleTags([]);
    setEditMode(formId, tableName, false);
    document.getElementById(formId.replace('form-','formcard-')).style.display = 'none';
    reloadAll();
  });
}
simpleFormHandler('form-work', 'works', 'msg-work', 'work');
simpleFormHandler('form-role', 'roles', 'msg-role', 'role');
simpleFormHandler('form-troupe', 'troupes', 'msg-troupe', 'troupe');
simpleFormHandler('form-venue', 'venues', 'msg-venue', 'venue');
simpleFormHandler('form-staffrole', 'staff_roles', 'msg-staffrole');
simpleFormHandler('form-person', 'people', 'msg-person', 'person');
simpleFormHandler('form-creation', 'creation_history', 'msg-creation');

// ---------- 초기화 ----------
captureCardHomes();
wireSingleCombo('show-troupe');
wireSingleCombo('show-venue');
wireSingleCombo('show-work');
wireSingleCombo('role-work');
wireSingleCombo('participation-person');
wireSingleCombo('participation-show');
wireSingleCombo('creation-person');
wireSingleCombo('creation-work');
wireSingleCombo('creation-type');
wireSingleCombo('workcreator-person');
wireSingleCombo('workcreator-type');
// ---------- 설정: 공개 기준(라이선스 분류) ----------
// 사이트는 창작·완료 공연만 보여준다. 미상 공연을 하나씩 빠르게 분류하는 대기열.
let _licQueue = [], _licIdx = 0;
const LIC_OPTIONS = [['창작', '창작 (자체 창작)'], ['완료', '완료 (라이선스 확보)'], ['미확보', '미확보 (숨김)']];
async function loadSettings() {
  const { data } = await supabase.from('shows').select('id,title,show_date,is_licensed,work_id,troupe_id,venue_id,poster_urls').order('show_date', { ascending: false });
  const rows = data || [];
  const cnt = { '창작': 0, '완료': 0, '미확보': 0, '미상': 0 };
  rows.forEach(r => { cnt[r.is_licensed || '미상'] = (cnt[r.is_licensed || '미상'] || 0) + 1; });
  document.getElementById('lic-stats').innerHTML =
    `<span class="lic-chip ok">공개 ${cnt['창작'] + cnt['완료']}편 <small>(창작 ${cnt['창작']} · 완료 ${cnt['완료']})</small></span>`
    + `<span class="lic-chip">숨김 ${cnt['미확보'] + cnt['미상']}편 <small>(미확보 ${cnt['미확보']} · 미상 ${cnt['미상']})</small></span>`;
  _licQueue = rows.filter(r => !r.is_licensed);
  _licIdx = 0;
  renderLicQueue();
}
function renderLicQueue() {
  const el = document.getElementById('lic-queue');
  if (_licIdx >= _licQueue.length) { el.innerHTML = '<div class="lic-done">분류할 공연이 없어요. 👏</div>'; return; }
  const r = _licQueue[_licIdx];
  const nameOf = (list, id) => (list || []).find(x => x.id === id)?.name || (list || []).find(x => x.id === id)?.title || '';
  const meta = [nameOf(cache.works, r.work_id), nameOf(cache.troupes, r.troupe_id), nameOf(cache.venues, r.venue_id), r.show_date || ''].filter(Boolean).join(' · ');
  el.innerHTML = `<div class="lic-item">
      ${r.poster_urls && r.poster_urls[0] ? `<img src="${r.poster_urls[0]}" alt="">` : '<div class="lic-ph">🎭</div>'}
      <div class="lic-body"><div class="lic-count">미상 ${_licIdx + 1} / ${_licQueue.length}</div>
        <div class="lic-title">${escHtmlAdmin(r.title || '')}</div><div class="lic-meta">${escHtmlAdmin(meta)}</div>
        <div class="lic-btns">${LIC_OPTIONS.map((o, i) => `<button type="button" class="btn${i === 2 ? ' secondary' : ''}" onclick="setShowLicense('${r.id}','${o[0]}')">${i + 1}. ${o[1]}</button>`).join('')}
        <button type="button" class="btn secondary" onclick="skipLicense()">건너뛰기 →</button></div></div></div>`;
}
async function setShowLicense(id, val) {
  const { error } = await supabase.from('shows').update({ is_licensed: val }).eq('id', id);
  if (error) { showMsg('msg-settings', false, '저장 실패: ' + error.message); return; }
  _licIdx++; renderLicQueue();
  showMsg('msg-settings', true, '저장했어요. 목록 숫자는 새로고침하면 갱신돼요.');
}
function skipLicense() { _licIdx++; renderLicQueue(); }
window.setShowLicense = setShowLicense; window.skipLicense = skipLicense;
document.addEventListener('keydown', (e) => {
  if (!document.getElementById('tab-settings')?.classList.contains('active')) return;
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
  const r = _licQueue[_licIdx]; if (!r) return;
  if (e.key === '1' || e.key === '2' || e.key === '3') { e.preventDefault(); setShowLicense(r.id, LIC_OPTIONS[+e.key - 1][0]); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); skipLicense(); }
});

// ---------- 클레임 승인 ----------
const CLAIM_STATUS_LABEL = { pending: '대기중', approved: '승인됨', rejected: '거절됨' };
let _claimsFilter = 'pending';
function setClaimsFilter(status) {
  _claimsFilter = status;
  document.querySelectorAll('.claims-filter-tab').forEach(b => b.classList.toggle('active', b.dataset.status === status));
  loadClaims();
}
window.setClaimsFilter = setClaimsFilter;
async function loadClaims() {
  const el = document.getElementById('claims-list');
  const { data, error } = await supabase.rpc('list_claims', { p_status: _claimsFilter });
  if (error) { el.innerHTML = '<p class="sub">불러오기 실패: ' + error.message + '</p>'; return; }
  const { data: pendingData } = await supabase.rpc('list_claims', { p_status: 'pending' });
  document.getElementById('badge-claims').classList.toggle('on', !!(pendingData && pendingData.length));
  if (!data || !data.length) { el.innerHTML = '<p class="sub">해당하는 요청이 없어요.</p>'; return; }
  el.innerHTML = data.map(c => `
    <div class="card" style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
      <div>
        <b>${c.person_name}</b> 님으로 연결 요청 <span class="edits-status-${c.status === 'approved' ? 'done' : c.status}">[${CLAIM_STATUS_LABEL[c.status] || c.status}]</span>
        <div class="sub">요청자: ${c.requester_email} · 요청 ${new Date(c.created_at).toLocaleString('ko-KR')}${c.reviewed_at ? ' · 처리 ' + new Date(c.reviewed_at).toLocaleString('ko-KR') : ''}</div>
      </div>
      ${c.status === 'pending' ? `
      <div style="display:flex; gap:8px; flex-shrink:0;">
        <button type="button" class="btn" onclick="approveClaim('${c.claim_id}')">승인</button>
        <button type="button" class="btn secondary" onclick="rejectClaim('${c.claim_id}')">거절</button>
      </div>` : ''}
    </div>
  `).join('');
}
async function approveClaim(claimId) {
  const { error } = await supabase.rpc('approve_person_claim', { claim_id: claimId });
  if (error) { alert('승인 실패: ' + error.message); return; }
  loadClaims();
}
async function rejectClaim(claimId) {
  const { error } = await supabase.rpc('reject_person_claim', { claim_id: claimId });
  if (error) { alert('거절 실패: ' + error.message); return; }
  loadClaims();
}
window.approveClaim = approveClaim;
window.rejectClaim = rejectClaim;

// ---------- 수정요청 ----------
const EDIT_TYPE_LABEL = { show:'공연', work:'작품', troupe:'단체', venue:'극장', person:'사람', role:'배역', other:'기타' };
const EDIT_REQ_LABEL = { edit:'수정', create:'추가', delete:'삭제' };
const EDIT_STATUS_LABEL = { pending:'대기중', done:'완료', rejected:'반려' };
let _editsFilter = 'pending';
function setEditsFilter(status) {
  _editsFilter = status;
  document.querySelectorAll('.edits-filter-tab').forEach(b => b.classList.toggle('active', b.dataset.status === status));
  loadEdits();
}
window.setEditsFilter = setEditsFilter;
async function loadEdits() {
  const el = document.getElementById('edits-list');
  let q = supabase.from('edit_requests').select('*').order('created_at', { ascending: false });
  if (_editsFilter !== 'all') q = q.eq('status', _editsFilter);
  const { data, error } = await q;
  if (error) { el.innerHTML = '<p class="sub">불러오기 실패: ' + error.message + '</p>'; return; }
  const { data: pendingData } = await supabase.from('edit_requests').select('id').eq('status', 'pending');
  document.getElementById('badge-edits').classList.toggle('on', !!(pendingData && pendingData.length));
  if (!data || !data.length) { el.innerHTML = '<p class="sub">해당하는 요청이 없어요.</p>'; return; }
  el.innerHTML = `<table class="edits-table"><thead><tr><th>구분</th><th>요약</th><th>내용</th><th>날짜</th><th>상태</th><th></th></tr></thead><tbody>`
    + data.map(r => `
      <tr>
        <td>${EDIT_REQ_LABEL[r.request_type] || r.request_type} · ${EDIT_TYPE_LABEL[r.target_type] || r.target_type}</td>
        <td>${r.summary}</td>
        <td class="edits-details">${r.details || ''}</td>
        <td>${new Date(r.created_at).toLocaleDateString('ko-KR')}</td>
        <td><span class="edits-status-${r.status}">${EDIT_STATUS_LABEL[r.status] || r.status}</span></td>
        <td class="edits-actions">
          ${r.target_type !== 'other' ? `<button type="button" class="btn small secondary" onclick="switchAdminTab('${r.target_type}')">이동</button>` : ''}
          ${r.status === 'pending' ? `<button type="button" class="btn small" onclick="resolveEdit('${r.id}','done')">완료</button><button type="button" class="btn small secondary" onclick="resolveEdit('${r.id}','rejected')">반려</button>` : ''}
        </td>
      </tr>
    `).join('')
    + `</tbody></table>`;
}
async function resolveEdit(id, status) {
  const { error } = await supabase.from('edit_requests').update({ status, reviewed_by: (await supabase.auth.getUser()).data.user.id, reviewed_at: new Date().toISOString() }).eq('id', id);
  if (error) { alert('처리 실패: ' + error.message); return; }
  loadEdits();
}
window.resolveEdit = resolveEdit;

// ---------- 유저 목록 ----------
async function loadUsers() {
  const el = document.getElementById('users-list');
  const { data, error } = await supabase.rpc('list_all_users');
  if (error) { el.innerHTML = '<p class="sub">불러오기 실패: ' + error.message + '</p>'; return; }
  if (!data || !data.length) { el.innerHTML = '<p class="sub">가입한 유저가 없어요.</p>'; return; }
  window._usersData = data;
  el.innerHTML = `<table class="edits-table"><thead><tr><th>이메일</th><th>닉네임</th><th>연결된 사람</th><th>현재 역할</th><th>관리자</th><th>가입일</th></tr></thead><tbody>`
    + data.map(u => `
      <tr>
        <td>${u.email || ''}</td>
        <td>${u.nickname || ''}</td>
        <td id="user-link-${u.user_id}">${u.person_name
          ? escHtmlAdmin(u.person_name)
          : `<span class="unlinked-chip" onclick="openLinkPicker('${u.user_id}')">미연결 · 연결하기</span>`}</td>
        <td>${(u.preferred_roles || []).map(escHtmlAdmin).join(', ') || '<span class="sub">-</span>'}</td>
        <td>${u.is_admin ? '✓' : ''}</td>
        <td>${new Date(u.created_at).toLocaleDateString('ko-KR')}</td>
      </tr>
    `).join('')
    + `</tbody></table>`;
}
window.loadUsers = loadUsers;

// ---------- 라이선스 문의 ----------
const INQUIRY_STATUS_LABEL = { new: '새 문의', answered: '답변완료', closed: '종료' };
let _inquiriesFilter = 'new';
function setInquiriesFilter(status) {
  _inquiriesFilter = status;
  document.querySelectorAll('.inquiries-filter-tab').forEach(b => b.classList.toggle('active', b.dataset.status === status));
  loadInquiries();
}
window.setInquiriesFilter = setInquiriesFilter;
async function loadInquiries() {
  const el = document.getElementById('inquiries-list');
  const { data, error } = await supabase.rpc('list_license_inquiries', { p_status: _inquiriesFilter });
  if (error) { el.innerHTML = '<p class="sub">불러오기 실패: ' + error.message + '</p>'; return; }
  const { data: newData } = await supabase.rpc('list_license_inquiries', { p_status: 'new' });
  document.getElementById('badge-inquiries').classList.toggle('on', !!(newData && newData.length));
  if (!data || !data.length) { el.innerHTML = '<p class="sub">해당하는 문의가 없어요.</p>'; return; }
  el.innerHTML = data.map(q => `
    <div class="card">
      <div><b>${q.show_title || q.work_title || '(일반 문의)'}</b> <span class="edits-status-${q.status === 'answered' ? 'done' : q.status === 'new' ? 'pending' : 'rejected'}">[${INQUIRY_STATUS_LABEL[q.status] || q.status}]</span></div>
      <div class="sub" style="margin-top:6px;">${q.requester_nickname || q.requester_email} · ${new Date(q.created_at).toLocaleString('ko-KR')}${q.contact ? ' · 연락처: ' + q.contact : ''}</div>
      <div style="margin-top:8px; white-space:pre-wrap;">${q.message || ''}</div>
      ${q.admin_note ? `<div class="sub" style="margin-top:6px;">메모: ${q.admin_note}</div>` : ''}
      ${q.status !== 'closed' ? `
      <div style="display:flex; gap:8px; margin-top:10px;">
        <button type="button" class="btn small" onclick="answerInquiry('${q.id}')">답변완료로 표시</button>
        <button type="button" class="btn small secondary" onclick="closeInquiry('${q.id}')">종료</button>
      </div>` : ''}
    </div>
  `).join('');
}
async function answerInquiry(id) {
  const note = prompt('안내한 내용을 메모로 남겨두시겠어요? (선택)') || null;
  const { error } = await supabase.rpc('resolve_license_inquiry', { p_id: id, p_status: 'answered', p_admin_note: note });
  if (error) { alert('처리 실패: ' + error.message); return; }
  loadInquiries();
}
async function closeInquiry(id) {
  const { error } = await supabase.rpc('resolve_license_inquiry', { p_id: id, p_status: 'closed', p_admin_note: null });
  if (error) { alert('처리 실패: ' + error.message); return; }
  loadInquiries();
}
window.answerInquiry = answerInquiry;
window.closeInquiry = closeInquiry;

// ---------- 단체 클레임 ----------
const TROUPE_CLAIM_STATUS_LABEL = { pending: '대기중', confirmed: '승인됨', rejected: '거절됨' };
let _troupeClaimsFilter = 'pending';
function setTroupeClaimsFilter(status) {
  _troupeClaimsFilter = status;
  document.querySelectorAll('.troupeclaims-filter-tab').forEach(b => b.classList.toggle('active', b.dataset.status === status));
  loadTroupeClaims();
}
window.setTroupeClaimsFilter = setTroupeClaimsFilter;
async function loadTroupeClaims() {
  const el = document.getElementById('troupeclaims-list');
  const { data, error } = await supabase.rpc('list_troupe_claims', { p_status: _troupeClaimsFilter });
  if (error) { el.innerHTML = '<p class="sub">불러오기 실패: ' + error.message + '</p>'; return; }
  const { data: pendingData } = await supabase.rpc('list_troupe_claims', { p_status: 'pending' });
  document.getElementById('badge-troupeclaims').classList.toggle('on', !!(pendingData && pendingData.length));
  if (!data || !data.length) { el.innerHTML = '<p class="sub">해당하는 요청이 없어요.</p>'; return; }
  el.innerHTML = data.map(c => `
    <div class="card" style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
      <div>
        <b>${escHtmlAdmin(c.troupe_name)}</b> 관리자 연결 요청 <span class="edits-status-${c.status === 'confirmed' ? 'done' : c.status}">[${TROUPE_CLAIM_STATUS_LABEL[c.status] || c.status}]</span>
        <div class="sub">요청자: ${c.requester_nickname || c.requester_email} · ${new Date(c.created_at).toLocaleString('ko-KR')}</div>
      </div>
      ${c.status === 'pending' ? `
      <div style="display:flex; gap:8px; flex-shrink:0;">
        <button type="button" class="btn" onclick="approveTroupeClaim('${c.claim_id}')">승인</button>
        <button type="button" class="btn secondary" onclick="rejectTroupeClaim('${c.claim_id}')">거절</button>
      </div>` : ''}
    </div>
  `).join('');
}
async function approveTroupeClaim(claimId) {
  const { error } = await supabase.rpc('approve_troupe_claim', { p_claim_id: claimId });
  if (error) { alert('승인 실패: ' + error.message); return; }
  loadTroupeClaims();
}
async function rejectTroupeClaim(claimId) {
  const { error } = await supabase.rpc('reject_troupe_claim', { p_claim_id: claimId });
  if (error) { alert('거절 실패: ' + error.message); return; }
  loadTroupeClaims();
}
window.approveTroupeClaim = approveTroupeClaim;
window.rejectTroupeClaim = rejectTroupeClaim;
function escHtmlAdmin(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function openLinkPicker(userId) {
  const cell = document.getElementById('user-link-' + userId);
  if (!cell) return;
  cell.innerHTML = `<input type="text" class="link-picker-input" placeholder="사람 이름 검색..." oninput="filterLinkPicker('${userId}', this.value)">
    <div class="link-picker-results" id="link-picker-results-${userId}"></div>`;
  document.querySelector(`#user-link-${userId} input`).focus();
}
function filterLinkPicker(userId, q) {
  const el = document.getElementById('link-picker-results-' + userId);
  if (!el) return;
  q = q.trim();
  if (!q) { el.innerHTML = ''; return; }
  const matches = (cache.people || []).filter(p => p.name && p.name.includes(q)).slice(0, 8);
  el.innerHTML = matches.length
    ? matches.map(p => `<div class="link-picker-item" onclick="confirmLinkUser('${userId}','${p.id}')">${escHtmlAdmin(p.name)}</div>`).join('')
    : `<div class="sub">일치하는 사람이 없어요.</div>`;
}
async function confirmLinkUser(userId, personId) {
  const { error } = await supabase.rpc('admin_link_user_person', { p_user_id: userId, p_person_id: personId });
  if (error) { alert('연결 실패: ' + error.message); return; }
  loadUsers();
}
window.openLinkPicker = openLinkPicker;
window.filterLinkPicker = filterLinkPicker;
window.confirmLinkUser = confirmLinkUser;

// ---------- 데이터 현황 ----------
function loadDataHealth() {
  const el = document.getElementById('datahealth-content');
  const shows = (cache.showsFull || []).filter(s => s.title);
  const total = shows.length || 1;
  const rows = [
    ['공연 날짜', shows.filter(s => s.show_date).length, '📅'],
    ['극단 연결', shows.filter(s => s.troupe_id).length, '🏢'],
    ['극장 연결', shows.filter(s => s.venue_id).length, '📍'],
    ['라이선스 상태', shows.filter(s => s.is_licensed).length, '📄'],
  ];
  const licCounts = { '창작': 0, '완료': 0, '미확보': 0, '미상': 0 };
  shows.forEach(s => { const v = s.is_licensed; licCounts[v && licCounts.hasOwnProperty(v) ? v : '미상']++; });
  const licColors = { '창작': '#c8a96e', '완료': '#6eb5c8', '미확보': '#d98a6a', '미상': '#ccc' };
  function fillColor(pct) { return pct >= 80 ? '#6ea87a' : pct >= 50 ? '#c8a96e' : '#c26b6b'; }
  el.innerHTML = `
    <div class="dh-summary-card"><div class="dh-summary-num">${shows.length}</div><div class="dh-summary-label">전체 공연 건수</div></div>
    <h3 class="dh-section-title">항목별 입력 완성도</h3>
    <div class="dh-grid">
      ${rows.map(([label, cnt, icon]) => {
        const pct = Math.round(cnt / total * 100);
        return `<div class="dh-card">
          <div class="dh-card-top"><span>${icon} ${label}</span><span class="dh-card-pct" style="color:${fillColor(pct)}">${pct}%</span></div>
          <div class="dh-track"><span class="dh-fill" style="width:${pct}%;background:${fillColor(pct)}"></span></div>
          <div class="dh-card-sub">${cnt} / ${shows.length}건</div>
        </div>`;
      }).join('')}
    </div>
    <h3 class="dh-section-title">라이선스 상태 분포</h3>
    <div class="dh-lic-bar">${Object.keys(licCounts).map(k => {
      const pct = Math.round(licCounts[k] / total * 100);
      return pct > 0 ? `<span style="width:${pct}%;background:${licColors[k]}" title="${k} ${licCounts[k]}건"></span>` : '';
    }).join('')}</div>
    <div class="dh-lic-legend">${Object.keys(licCounts).map(k =>
      `<span class="dh-lic-chip"><span class="dh-lic-dot" style="background:${licColors[k]}"></span>${k} <b>${licCounts[k]}</b>건</span>`
    ).join('')}</div>
  `;
}
window.loadDataHealth = loadDataHealth;

// ---------- 관리자 목록 ----------
async function loadAdmins() {
  const el = document.getElementById('admins-list');
  const { data, error } = await supabase.from('admin_emails').select('email').order('email');
  if (error) { el.innerHTML = '<p class="sub">불러오기 실패: ' + error.message + '</p>'; return; }
  if (!data || !data.length) { el.innerHTML = '<p class="sub">등록된 관리자가 없어요.</p>'; return; }
  el.innerHTML = data.map(a => `
    <div class="card" style="display:flex; align-items:center; justify-content:space-between;">
      <span>${a.email}</span>
      <button type="button" class="btn secondary" onclick="removeAdminEmail('${a.email}')">제거</button>
    </div>
  `).join('');
}
async function addAdminEmail() {
  const input = document.getElementById('new-admin-email');
  const email = input.value.trim();
  if (!email) return;
  const { error } = await supabase.rpc('grant_admin', { target_email: email });
  showMsg('msg-admins', !error, error ? '추가 실패: ' + error.message : '추가됐어요.');
  if (!error) { input.value = ''; loadAdmins(); }
}
async function removeAdminEmail(email) {
  if (!confirm(email + ' 을(를) 관리자에서 제거할까요?')) return;
  const { error } = await supabase.rpc('revoke_admin', { target_email: email });
  if (error) { alert('제거 실패: ' + error.message); return; }
  loadAdmins();
}
window.addAdminEmail = addAdminEmail;
window.removeAdminEmail = removeAdminEmail;

// ---------- 권리 분류 ----------
const RIGHTS_OPTS = [
  { v: '창작',        k: '1', c: '#8a5a3d' },
  { v: '번안',        k: '2', c: '#3d6b7d' },
  { v: '해외라이선스', k: '3', c: '#a34a6b' },
  { v: '공유저작물',   k: '4', c: '#5c7d3d' },
  { v: '확인불가',     k: '5', c: '#8b8a83' },
];
const LIC_OPTS = [
  { v: '제공', k: 'Q' }, { v: '협의가능', k: 'W' },
  { v: '미제공', k: 'E' }, { v: '확인불가', k: 'R' },
];
let rqIdx = 0, rqOnlyTodo = true;

function rqQueue() {
  const all = [...(cache.works || [])].sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  return rqOnlyTodo ? all.filter(w => !w.rights_type) : all;
}
function rqStats(w) {
  const shows = (cache.showsFull || []).filter(s => s.work_id === w.id);
  const yrs = shows.map(s => s.show_year || (s.show_date ? Number(String(s.show_date).slice(0, 4)) : null)).filter(Boolean);
  return {
    showCount: shows.length,
    lastYear: yrs.length ? Math.max(...yrs) : null,
    creators: (cache.creationRows || []).filter(c => c.work_id === w.id).length,
  };
}

async function rqSave(w, patch) {
  const { error } = await supabase.from('works').update(patch).eq('id', w.id);
  if (error) { alert('저장 실패: ' + error.message); return false; }
  Object.assign(w, patch);
  patchCacheRow('works', w.id, patch);
  return true;
}
async function rqSetRights(v) {
  const w = rqQueue()[rqIdx]; if (!w) return;
  const wasEmpty = !w.rights_type;
  if (!await rqSave(w, { rights_type: v })) return;
  if (!(rqOnlyTodo && wasEmpty)) rqIdx = Math.min(rqIdx + 1, rqQueue().length - 1);
  else rqIdx = Math.min(rqIdx, Math.max(0, rqQueue().length - 1));
  renderRightsTab();
}
async function rqSetLicense(v) {
  const w = rqQueue()[rqIdx]; if (!w) return;
  if (await rqSave(w, { amateur_license_status: v })) renderRightsTab();
}

function renderRightsTab() {
  const works = cache.works || [];
  const pt = document.getElementById('rq-progress-text');
  if (!pt) return;
  const done = works.filter(w => w.rights_type).length;
  const pct = works.length ? Math.round(done / works.length * 100) : 0;
  pt.textContent = '(' + done + ' / ' + works.length + ' 분류됨)';
  document.getElementById('rq-bar-fill').style.width = pct + '%';
  document.getElementById('rq-counts').innerHTML = RIGHTS_OPTS.map(o =>
    '<span class="rq-chip"><i class="rq-dot" style="background:' + o.c + '"></i>' + o.v +
    ' <b>' + works.filter(w => w.rights_type === o.v).length + '</b></span>'
  ).join('');
  document.getElementById('rq-filter-btn').textContent = rqOnlyTodo ? '전체 보기' : '미분류만 보기';

  const list = rqQueue();
  const body = document.getElementById('rq-body');
  if (!list.length) {
    body.innerHTML = '<p class="empty">' + (rqOnlyTodo ? '미분류 작품이 없어요. 전체 보기를 눌러보세요.' : '작품이 없어요.') + '</p>';
    return;
  }
  rqIdx = Math.min(rqIdx, list.length - 1);
  const w = list[rqIdx];
  const st = rqStats(w);

  const facts = [
    w.genre ? '<span class="rq-fact">' + escHtmlAdmin(w.genre) + '</span>' : '',
    (w.country || []).length ? '<span class="rq-fact">' + escHtmlAdmin((w.country || []).join(', ')) + '</span>' : '',
    w.premiere_year ? '<span class="rq-fact">초연 <b>' + w.premiere_year + '</b></span>' : '',
    '<span class="rq-fact">공연 <b>' + st.showCount + '</b>건</span>',
    st.lastYear ? '<span class="rq-fact">최근 <b>' + st.lastYear + '</b></span>' : '',
    '<span class="rq-fact' + (st.creators ? '' : ' warn') + '">창작자 <b>' + st.creators + '</b>명</span>',
  ].filter(Boolean).join('');

  const opts = (arr, cur, cls) => arr.map(o =>
    '<button type="button" class="rq-opt ' + cls + (cur === o.v ? ' on' : '') + '" data-v="' + o.v + '"' +
    (cur === o.v ? ' style="background:' + (o.c || 'var(--accent)') + ';border-color:' + (o.c || 'var(--accent)') + '"' : '') +
    '><kbd>' + o.k + '</kbd>' + o.v + '</button>').join('');

  body.innerHTML = '<div class="rq-wrap"><div>' +
    '<div class="rq-eyebrow">' + (rqIdx + 1) + ' / ' + list.length + '</div>' +
    '<div class="rq-title">' + escHtmlAdmin(w.title) + '</div>' +
    (w.title_en ? '<div class="rq-title-en">' + escHtmlAdmin(w.title_en) + '</div>' : '') +
    '<div class="rq-facts">' + facts + '</div>' +
    '<div class="rq-grp"><span class="rq-label">권리 유형</span><div class="rq-opts">' + opts(RIGHTS_OPTS, w.rights_type, 'rq-r') + '</div></div>' +
    '<div class="rq-grp"><span class="rq-label">아마추어 라이선스</span><div class="rq-opts">' + opts(LIC_OPTS, w.amateur_license_status, 'rq-l') + '</div></div>' +
    '<div class="rq-nav">' +
      '<button type="button" class="btn secondary small" id="rq-prev">← 이전</button>' +
      '<button type="button" class="btn secondary small" id="rq-next">다음 →</button>' +
      '<a href="https://www.google.com/search?q=' + encodeURIComponent(w.title + ' 뮤지컬 연극 원작 초연') + '" target="_blank" rel="noopener" class="btn small secondary" style="text-decoration:none;">검색</a>' +
      '<span class="rq-hint">1–5 유형 · Q–R 라이선스 · ←→ 이동</span>' +
    '</div></div>' +
    '<div class="rq-side"><ol>' + list.map(function (x, i) {
      const found = RIGHTS_OPTS.find(o => o.v === x.rights_type);
      const c = found ? found.c : null;
      return '<li class="' + (i === rqIdx ? 'cur' : '') + '" data-i="' + i + '">' +
        '<i class="rq-dot" style="' + (c ? 'background:' + c : 'box-shadow:inset 0 0 0 1px var(--line)') + '"></i>' +
        '<span>' + escHtmlAdmin(x.title) + '</span></li>';
    }).join('') + '</ol></div></div>';

  body.querySelector('#rq-prev').onclick = () => { rqIdx = Math.max(0, rqIdx - 1); renderRightsTab(); };
  body.querySelector('#rq-next').onclick = () => { rqIdx = Math.min(list.length - 1, rqIdx + 1); renderRightsTab(); };
  body.querySelectorAll('.rq-r').forEach(b => b.onclick = () => rqSetRights(b.dataset.v));
  body.querySelectorAll('.rq-l').forEach(b => b.onclick = () => rqSetLicense(b.dataset.v));
  body.querySelectorAll('.rq-side li').forEach(li => li.onclick = () => { rqIdx = Number(li.dataset.i); renderRightsTab(); });
  const cur = body.querySelector('.rq-side .cur');
  if (cur) cur.scrollIntoView({ block: 'nearest' });
}

document.getElementById('rq-filter-btn').addEventListener('click', () => {
  rqOnlyTodo = !rqOnlyTodo; rqIdx = 0; renderRightsTab();
});

document.addEventListener('keydown', (e) => {
  const panel = document.getElementById('tab-rights');
  if (!panel || !panel.classList.contains('active')) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
  const r = RIGHTS_OPTS.find(o => o.k === e.key);
  if (r) { e.preventDefault(); rqSetRights(r.v); return; }
  const l = LIC_OPTS.find(o => o.k === e.key.toUpperCase());
  if (l) { e.preventDefault(); rqSetLicense(l.v); return; }
  if (e.key === 'ArrowRight') { e.preventDefault(); rqIdx = Math.min(rqQueue().length - 1, rqIdx + 1); renderRightsTab(); }
  if (e.key === 'ArrowLeft') { e.preventDefault(); rqIdx = Math.max(0, rqIdx - 1); renderRightsTab(); }
});

const CATALOG_STATUSES = ['미접촉','접촉중','인터뷰완료','협의중','계약완료','거절','보류'];
async function loadCatalogCandidates() {
  const el = document.getElementById('rq-candidates');
  if (!el) return;
  const { data, error } = await supabase.from('v_catalog_candidates')
    .select('*').order('auto_score', { ascending: false }).limit(50);
  if (error) { el.innerHTML = '<p class="sub">불러오기 실패: ' + error.message + '</p>'; return; }
  if (!data || !data.length) { el.innerHTML = '<p class="empty">후보가 없어요.</p>'; return; }
  el.innerHTML = '<table class="edits-table"><thead><tr>' +
    '<th>점수</th><th>작품</th><th>권리유형</th><th>공연</th><th>최근</th><th>창작자</th><th>수요</th><th>사장</th><th>접촉상태</th>' +
    '</tr></thead><tbody>' + data.map(r =>
      '<tr><td><span class="rq-score">' + r.auto_score + '</span></td>' +
      '<td><b>' + escHtmlAdmin(r.title) + '</b>' + (r.genre ? ' <span class="sub">' + escHtmlAdmin(r.genre) + '</span>' : '') + '</td>' +
      '<td>' + (r.rights_type === '확인불가' ? '<span class="warn-badge">⚠ 미분류</span>' : escHtmlAdmin(r.rights_type)) + '</td>' +
      '<td>' + r.show_count + '건</td>' +
      '<td>' + (r.last_show_year || '') + '</td>' +
      '<td>' + (r.creator_count ? r.creator_count + '명' : '<span class="warn-badge">⚠ 없음</span>') + '</td>' +
      '<td>' + (r.demand_score || '') + '</td>' +
      '<td>' + (r.is_dormant ? '✓' : '') + '</td>' +
      '<td><select data-catalog-work="' + r.id + '" style="font-size:12px; padding:3px;">' +
        CATALOG_STATUSES.map(s => '<option value="' + s + '"' + (r.catalog_status === s ? ' selected' : '') + '>' + s + '</option>').join('') +
      '</select></td></tr>'
    ).join('') + '</tbody></table>';
  el.querySelectorAll('select[data-catalog-work]').forEach(sel => {
    sel.addEventListener('change', async () => {
      const { error } = await supabase.from('work_rights')
        .upsert({ work_id: sel.dataset.catalogWork, catalog_status: sel.value, updated_at: new Date().toISOString() },
                { onConflict: 'work_id' });
      if (error) alert('저장 실패: ' + error.message);
    });
  });
}

document.getElementById('navTabs').addEventListener('click', (e) => {
  if (!e.target.closest('button[data-tab="rights"]')) return;
  renderRightsTab();
  loadCatalogCandidates();
});

(async () => {
  await ensureAuth();
  await loadOptionListRows();
  await loadOptionLists();
  await reloadAll();
  await loadSettings();
  await loadClaims();
  await loadEdits();
  await loadInquiries();
  await loadTroupeClaims();
  await loadAdmins();
  loadUsers();
  loadDataHealth();
  renderOptionManager();
  if (location.hash === '#rights') { renderRightsTab(); loadCatalogCandidates(); }
})();
