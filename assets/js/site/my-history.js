/* 오리 사이트 — 마이페이지 "내 기록"의 내 이력: 배우·스태프가 참여한 공연을 직접 추가하고, 그 공연의 단체가 확인한다
   기록마다 주인이 있다: 이력의 주인은 본인, 사실 확인은 공연의 주인(단체). 단체 없는 공연은 사이트 관리자가 확인.
   확인 전 이력은 나에게만 보이고 사이트 공개 화면엔 안 나온다 (core.js load()가 '확인'만 읽음).
   서버: request_my_participation / cancel_my_participation (supabase/migrations/20261010_participation_requests.sql),
         sync_my_project_history (20261010_project_history_sync.sql) */
var _mh={rows:[],shows:null,showByLabel:{}};
var MH_ST={'확인 대기':['wait','단체 확인 기다리는 중'],'거절':['no','단체가 아니라고 했어요']};

async function renderMyHistory(el){
  if(!el)return;
  if(!CURRENT_USER.personId){
    el.innerHTML='<section class="dv-sec mh-sec">'+dvSection('내 이력',0)
      +'<div class="mh-empty">내 프로필(사람)을 연결하면 참여한 공연을 직접 이력에 추가할 수 있어요.<br><span class="link" onclick="maybeForceShowConnectPrompt()">내 프로필 찾기</span></div></section>';
    return;
  }
  el.innerHTML='<section class="dv-sec mh-sec"><div class="hf-loading">불러오는 중…</div></section>';
  // 프로젝트로 합류한 공연인데 이력이 빠진 것(공연 발행 뒤 합류, 합류 뒤 프로필 연결)을 먼저 채운다
  var sy=await sbClient.rpc('sync_my_project_history');
  if(sy.data>0)load();
  var r=await sbClient.from('participation_history')
    .select('id,role_type,confirm_status,request_note,requested_by,show:shows(id,title,show_date,troupe_id),participation_roles(role:roles(name)),participation_staff_roles(staff:staff_roles(name))')
    .eq('person_id',CURRENT_USER.personId);
  if(r.error){el.innerHTML='<section class="dv-sec mh-sec">'+dvSection('내 이력',0)+'<div class="mh-empty">불러오지 못했어요: '+escHtml(r.error.message)+'</div></section>';return;}
  _mh.rows=(r.data||[]).filter(function(x){return x.show;}).sort(function(a,b){return String(b.show.show_date||'').localeCompare(String(a.show.show_date||''));});
  drawMyHistory(el);
}
function mhRoleText(x){
  var names=(x.participation_roles||[]).map(function(p){return p.role&&p.role.name;})
    .concat((x.participation_staff_roles||[]).map(function(p){return p.staff&&p.staff.name;})).filter(Boolean);
  return (x.role_type==='스텝'?'스태프':(x.role_type||''))+(names.length?' · '+names.join(', '):'');
}
function drawMyHistory(el){
  el=el||$('my-history');if(!el)return;
  var wait=_mh.rows.filter(function(x){return x.confirm_status==='확인 대기';}).length;
  var h='<section class="dv-sec mh-sec"><div class="ts-head">'+dvSection('내 이력',_mh.rows.length)
    +'<button class="pf-btn pf-active" onclick="openMyHistoryForm()">+ 이력 추가</button></div>'
    +'<div class="ts-help">참여한 공연을 직접 남겨두면 그 공연의 단체가 확인한 뒤 내 사람 페이지에 올라가요.'+(wait?' 지금 '+wait+'건이 확인을 기다리고 있어요.':'')+'</div>'
    +'<div id="mh-form"></div>';
  if(!_mh.rows.length)h+='<div class="mh-empty">아직 이력이 없어요. 가장 최근에 참여한 공연 하나부터 남겨볼까요?</div>';
  else h+='<div class="ts-list">'+_mh.rows.map(function(x){
    var st=MH_ST[x.confirm_status];
    var mine=x.requested_by===CURRENT_USER.id&&st;
    return '<div class="ts-row"><div class="ts-main">'
      +'<div class="ts-title">'+escHtml(x.show.title||'(제목 없음)')+'</div>'
      +'<div class="ts-meta">'+[x.show.show_date?String(x.show.show_date).replace(/-/g,'.'):'',x.show.troupe_id?escHtml(nm(x.show.troupe_id)):'',escHtml(mhRoleText(x))].filter(Boolean).join(' · ')+'</div>'
      +(x.request_note?'<div class="ts-meta">메모: '+escHtml(x.request_note)+'</div>':'')
      +'</div><div class="ts-side">'
      +(st?'<span class="ts-status mh-st-'+st[0]+'">'+st[1]+'</span>':'<span class="ts-status ts-st-ok">확인됨</span>')
      +(mine?'<button class="pf-btn" onclick="cancelMyHistory(\''+x.id+'\')">'+(x.confirm_status==='거절'?'지우기':'취소')+'</button>':'')
      +'</div></div>';
  }).join('')+'</div>';
  h+='</section>';
  el.innerHTML=h;
}
async function mhLoadShows(){
  if(_mh.shows)return;
  // 사이트에 공개되지 않은 공연도 고를 수 있어야 하므로 따로 읽는다 (이름·날짜·단체만)
  var r=await sbClient.from('shows').select('id,title,show_date,troupe_id,work_id').eq('is_hidden',false).order('show_date',{ascending:false}).limit(5000);
  _mh.shows=r.data||[];
  _mh.showByLabel={};
  _mh.shows.forEach(function(s){_mh.showByLabel[mhShowLabel(s)]=s;});
}
function mhShowLabel(s){
  var sub=[s.show_date?String(s.show_date).replace(/-/g,'.'):'',s.troupe_id?nm(s.troupe_id):''].filter(Boolean).join(' · ');
  return (s.title||'(제목 없음)')+(sub?' ('+sub+')':'');
}
async function openMyHistoryForm(){
  var box=$('mh-form');if(!box)return;
  box.innerHTML='<div class="hf-loading">공연 목록 불러오는 중…</div>';
  await mhLoadShows();
  var esc=function(v){return escHtml(v==null?'':String(v)).replace(/"/g,'&quot;');};
  var showList=_mh.shows.map(function(s){return '<option value="'+esc(mhShowLabel(s))+'">';}).join('');
  var troupeList=DB.troupes.map(function(t){return '<option value="'+esc(nm(t.id))+'">';}).join('');
  box.innerHTML='<div class="ts-form">'
    +'<div class="ts-form-title">내 이력 추가</div>'
    +'<div class="ts-grid">'
    +'<div class="edit-modal-field ts-wide"><label>어떤 공연인가요 *</label><input type="text" id="mh-show" list="mh-show-list" placeholder="공연명으로 찾기 · 없으면 그대로 적어주세요" oninput="mhShowInput()"><datalist id="mh-show-list">'+showList+'</datalist>'
    +'<div class="ts-hint" id="mh-show-hint">오리에 있는 공연이면 목록에서 고르고, 없으면 공연명을 적으면 새로 만들어요.</div></div>'
    +'<div class="edit-modal-field mh-new" style="display:none"><label>첫 공연일 *</label><input type="date" id="mh-date"></div>'
    +'<div class="edit-modal-field mh-new" style="display:none"><label>단체</label><input type="text" id="mh-troupe" list="mh-troupe-list" placeholder="올린 단체 (아는 경우)"><datalist id="mh-troupe-list">'+troupeList+'</datalist></div>'
    +'<div class="edit-modal-field"><label>무엇으로 참여했나요 *</label>'+tsSeg('mh-kind',[['배우','배우'],['스태프','스태프']],'배우').replace(/tsSegChange\(this\)/g,'tsSegChange(this);mhLabelList()')+'</div>'
    +'<div class="edit-modal-field"><label id="mh-label-name">배역</label><input type="text" id="mh-label" list="mh-label-list" placeholder="배역 이름 (모르면 비워도 돼요)"><datalist id="mh-label-list"></datalist></div>'
    +'<div class="edit-modal-field ts-wide"><label>단체에 남길 메모 (선택)</label><input type="text" id="mh-note" placeholder="예: 앙상블, 더블 캐스트, 2회차부터 합류"></div>'
    +'</div>'
    +'<div class="ts-actions"><button class="pf-btn" onclick="closeMyHistoryForm()">취소</button><button class="pf-btn pf-active" id="mh-save" onclick="saveMyHistory()">추가하기</button></div>'
    +'<div id="mh-msg" class="ts-msg"></div></div>';
  mhLabelList();
  box.scrollIntoView({behavior:'smooth',block:'start'});
}
function closeMyHistoryForm(){var b=$('mh-form');if(b)b.innerHTML='';}
function mhPickedShow(){var v=$('mh-show');return v?_mh.showByLabel[v.value.trim()]:null;}
function mhShowInput(){
  var s=mhPickedShow(),typed=$('mh-show').value.trim();
  document.querySelectorAll('.mh-new').forEach(function(f){f.style.display=(!s&&typed)?'':'none';});
  $('mh-show-hint').textContent=s?'오리에 있는 공연이에요. 그 공연의 단체가 확인해요.':(typed?'오리에 없는 공연이라 새로 만들어요. 날짜를 적어주세요.':'오리에 있는 공연이면 목록에서 고르고, 없으면 공연명을 적으면 새로 만들어요.');
  mhLabelList();
}
function mhLabelList(){
  var kind=tsSegVal('mh-kind')||'배우',dl=$('mh-label-list');if(!dl)return;
  var opts;
  if(kind==='배우'){
    var s=mhPickedShow();
    opts=s&&s.work_id?DB.roles.filter(function(r){return ids(fld(r,'작품')).indexOf(s.work_id)>-1;}).map(function(r){return fld(r,'배역명');}):[];
  }else opts=DB.staffRoles.map(function(r){return fld(r,'Name');});
  dl.innerHTML=opts.filter(Boolean).map(function(o){return '<option value="'+escHtml(o).replace(/"/g,'&quot;')+'">';}).join('');
  $('mh-label-name').textContent=kind==='배우'?'배역':'역할';
  $('mh-label').placeholder=kind==='배우'?'배역 이름 (모르면 비워도 돼요)':'예: 조명, 무대감독';
}
async function saveMyHistory(){
  var msg=$('mh-msg'),btn=$('mh-save');
  var typed=$('mh-show').value.trim(),s=mhPickedShow();
  if(!typed){msg.textContent='어떤 공연인지 적어주세요.';return;}
  var p={kind:tsSegVal('mh-kind')||'배우',label:$('mh-label').value.trim(),note:$('mh-note').value.trim()};
  if(s)p.show_id=s.id;
  else{
    if(!$('mh-date').value){msg.textContent='새 공연은 첫 공연일을 적어주세요.';return;}
    var tName=$('mh-troupe').value.trim();
    var t=tName?DB.troupes.find(function(x){return nm(x.id)===tName;}):null;
    p.show_title=typed;p.show_date=$('mh-date').value;p.troupe_id=t?t.id:'';
    if(tName&&!t)p.note=['단체: '+tName,p.note].filter(Boolean).join(' · ');
  }
  btn.disabled=true;msg.textContent='추가하는 중…';
  var r=await sbClient.rpc('request_my_participation',{p:p});
  if(r.error){msg.textContent='추가하지 못했어요: '+r.error.message;btn.disabled=false;return;}
  if(!s)_mh.shows=null; // 새 공연이 생겼으니 다음에 다시 읽는다
  await renderMyHistory($('my-history'));
  oriAlert(s&&s.troupe_id?'이력을 추가했어요. '+nm(s.troupe_id)+'에서 확인하면 내 사람 페이지에 올라가요.':'이력을 추가했어요. 확인되면 내 사람 페이지에 올라가요.');
}
async function cancelMyHistory(id){
  if(!await oriConfirm('이 이력 요청을 지울까요?'))return;
  var r=await sbClient.rpc('cancel_my_participation',{p_id:id});
  if(r.error){oriAlert('지우지 못했어요: '+r.error.message);return;}
  renderMyHistory($('my-history'));
}
