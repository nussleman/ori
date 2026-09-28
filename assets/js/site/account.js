/* 오리 사이트 — 로그인(구글), 선언 의식, 즐겨찾기, 사람/단체 클레임 */
/* ══ 인증 (Google 로그인 필수) + 선언 의식 + 즐겨찾기 ══
   PKCE flow를 명시: 콜백 토큰이 URL 해시(#)가 아니라 쿼리스트링(?code=)으로 오게 만들어서
   이 앱의 해시 기반 라우팅(#shows, #person-xxx 등)과 절대 충돌하지 않게 한다.
   이 사이트는 로그인 없이는 데이터를 아예 안 보여준다 — DB 쪽 SELECT 정책도 authenticated 전용으로 잠가둠. */
var sbClient=supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{auth:{flowType:'pkce',storageKey:'oridb-site-auth'}});
var CURRENT_USER=null; // {id, email, nickname}
var CURRENT_SESSION=null; // access_token 등 실제 세션 (rest() 호출용)
var FAVORITES_LIST=[]; // [{target_type,target_id},...]
var FAVORITES_SET=new Set(); // "type:id" 빠른 조회용
var MY_PROJECTS_CACHE=[]; // [{id,title}] - 전역검색에서 내 프로젝트도 찾을 수 있게 가볍게 캐싱
async function loadMyProjectsCache(){
  try{
    // 내가 참여 중인 공연만 (projects 테이블을 바로 읽으면 남의 공개 프로젝트까지 섞인다)
    var r=await sbClient.rpc('list_my_projects_detail');
    MY_PROJECTS_CACHE=r.data||[];
  }catch(e){MY_PROJECTS_CACHE=[];}
  if(typeof renderMyNav==='function')renderMyNav();
}
var OATH_PHRASE='나는 천하의 멍텅구리지만 우리들의 정직하고 행복한 공연 생활에 진심으로 임할 것을 엄숙히 선언합니다.';

function loginWithGoogle(){
  sbClient.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.origin+location.pathname}});
}
function logout(){
  try{sessionStorage.removeItem('oridb_declared');}catch(e){}
  sbClient.auth.signOut().then(function(){location.reload();});
}
function handleProfileFabClick(){
  if(!CURRENT_USER)return;
  var dd=$('profile-dropdown');
  if(!dd)return;
  dd.classList.toggle('open');
}
function closeProfileDropdown(){
  var dd=$('profile-dropdown');if(dd)dd.classList.remove('open');
}
document.addEventListener('click',function(e){
  var dd=$('profile-dropdown');if(!dd||!dd.classList.contains('open'))return;
  if(!dd.contains(e.target)&&e.target.id!=='profile-fab'){dd.classList.remove('open');}
});
function goMyPageTab(tab){
  window._myPageTab=tab;
  goMyPage(true,true);
}
function renderProfileFab(){
  var btn=$('profile-fab');if(!btn)return;
  if(CURRENT_USER){
    btn.title=CURRENT_USER.nickname?CURRENT_USER.nickname+' · 마이페이지':'마이페이지';
    btn.classList.add('logged-in');
    btn.textContent=CURRENT_USER.avatarEmoji||(CURRENT_USER.nickname||'?').charAt(0);
  }else{
    btn.title='';btn.classList.remove('logged-in');btn.textContent='';
  }
}
async function loadUserProfile(){
  try{
    var r=await sbClient.from('user_profiles').select('nickname,person_id,intro,contact,avatar_emoji,preferred_roles').eq('id',CURRENT_USER.id).maybeSingle();
    if(r.data){CURRENT_USER.nickname=r.data.nickname;CURRENT_USER.personId=r.data.person_id;CURRENT_USER.intro=r.data.intro;CURRENT_USER.contact=r.data.contact;CURRENT_USER.avatarEmoji=r.data.avatar_emoji;CURRENT_USER.preferredRoles=r.data.preferred_roles||[];}
  }catch(e){}
}
async function loadFavorites(){
  if(!CURRENT_USER){FAVORITES_LIST=[];FAVORITES_SET=new Set();return;}
  try{
    var r=await sbClient.from('favorites').select('target_type,target_id,list_type').eq('user_id',CURRENT_USER.id);
    FAVORITES_LIST=r.data||[];
    FAVORITES_SET=new Set(FAVORITES_LIST.map(function(f){return f.list_type+':'+f.target_type+':'+f.target_id;}));
  }catch(e){FAVORITES_LIST=[];FAVORITES_SET=new Set();}
}

/* ── 게이트 표시 제어 ── */
function showAuthGate(){$('auth-gate').classList.add('open');$('oath-gate').classList.remove('open');}
function hideAuthGate(){$('auth-gate').classList.remove('open');}
function hasDeclaredThisSession(){try{return sessionStorage.getItem('oridb_declared')==='1';}catch(e){return false;}}
function markDeclared(){try{sessionStorage.setItem('oridb_declared','1');}catch(e){}}

/* ── 선언 의식: 문구를 한 글자씩 스르르 띄운 뒤, "선언합니다"를 입력하면 입장 ── */
function playOathRitual(){
  return new Promise(function(resolve){
    hideAuthGate();
    var gate=$('oath-gate');gate.classList.remove('closing');gate.classList.add('open');
    var textEl=$('oath-text');textEl.innerHTML='';
    var words=OATH_PHRASE.split(' ');
    var gi=0;
    words.forEach(function(word,wi){
      var wordSpan=document.createElement('span');
      wordSpan.className='oath-word';
      word.split('').forEach(function(ch){
        var span=document.createElement('span');
        span.className='oath-char';
        span.style.animationDelay=(gi*32)+'ms';
        span.textContent=ch;
        wordSpan.appendChild(span);
        gi++;
      });
      textEl.appendChild(wordSpan);
      if(wi<words.length-1){
        textEl.appendChild(document.createTextNode(' ')); // 실제 띄어쓰기라야 여기서만 줄바꿈된다
        gi++;
      }
    });
    var totalMs=gi*32+700;
    var inputWrap=$('oath-input-wrap');
    setTimeout(function(){
      inputWrap.classList.add('show');
    },totalMs);
    window._resolveOath=function(){
      gate.classList.add('closing');
      setTimeout(function(){gate.classList.remove('open','closing');resolve();},600);
    };
  });
}
function confirmOath(){
  markDeclared();
  if(window._resolveOath)window._resolveOath();
}

/* ── 인증 상태에 따라 전체 진입 흐름을 제어 ── */
var _entered=false;
async function handleAuthSession(session){
  // admin.html과 이 사이트는 같은 도메인 하위 경로라 브라우저 로그인 세션(localStorage)을 공유한다.
  // 예전 admin.html의 익명 로그인 잔재가 여기로 새어 들어올 수 있어 명시적으로 걸러낸다.
  if(session&&session.user&&session.user.is_anonymous){
    CURRENT_SESSION=null;
    sbClient.auth.signOut();
    return;
  }
  CURRENT_SESSION=session||null;
  if(session&&session.user){
    CURRENT_USER={id:session.user.id,email:session.user.email};
    await loadUserProfile();
    await loadFavorites();
    loadMyProjectsCache();
    renderProfileFab();
    refreshFavoriteButtons();
    if(!_entered){
      if(!hasDeclaredThisSession())await playOathRitual();
      _entered=true;
      await enterSite();
    }
  }else{
    CURRENT_USER=null;FAVORITES_LIST=[];FAVORITES_SET=new Set();MY_PROJECTS_CACHE=[];
    _entered=false;
    renderProfileFab();
    showAuthGate();
  }
}
async function enterSite(){
  hideAuthGate();
  try{await load();routeFromHash(location.hash);}
  catch(e){$('mn').innerHTML='<div style="color:#e06c6c;padding:2rem">연결 실패: '+e.message+'</div>';}
  maybeShowConnectPrompt();
}
async function initAuth(){
  var got=await sbClient.auth.getSession();
  await handleAuthSession(got.data.session);
  sbClient.auth.onAuthStateChange(function(event,session){handleAuthSession(session);});
}

var FAV_ICON_SVG='<svg viewBox="0 0 120 100" fill="currentColor"><ellipse cx="52" cy="68" rx="38" ry="25"/><circle cx="78" cy="40" r="20"/><path d="M94,34 Q118,28 119,38 Q118,48 94,44 Z"/></svg>';
var WISH_ICON_SVG='<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 2.5a1 1 0 0 1 1 1V21a1 1 0 1 1-2 0V3.5a1 1 0 0 1 1-1z"/><path d="M6 3.5h11.5c.9 0 1.4 1.1.8 1.8L15.3 9l3 3.7c.6.7.1 1.8-.8 1.8H6V3.5z"/></svg>';
function favBtnHtml(type,id,listType){
  listType=listType||'favorite';
  var key=listType+':'+type+':'+id;var on=FAVORITES_SET.has(key);
  var icon=listType==='wishlist'?WISH_ICON_SVG:FAV_ICON_SVG;
  var label=listType==='wishlist'?'해보고 싶어요':'즐겨찾기';
  var cls=listType==='wishlist'?'fav-btn wish-btn':'fav-btn';
  return '<button class="'+cls+' fav-btn-inline'+(on?' on':'')+'" data-fav-type="'+type+'" data-fav-id="'+id+'" data-list-type="'+listType+'" onclick="event.stopPropagation();toggleFavorite(this)" title="'+label+'">'+icon+'</button>';
}
function wishBtnHtml(type,id){return favBtnHtml(type,id,'wishlist');}
async function toggleFavorite(btn){
  if(!CURRENT_USER){loginWithGoogle();return;}
  var type=btn.dataset.favType,id=btn.dataset.favId,listType=btn.dataset.listType||'favorite',key=listType+':'+type+':'+id;
  var isOn=FAVORITES_SET.has(key);
  btn.disabled=true;
  try{
    if(isOn){
      await sbClient.from('favorites').delete().eq('user_id',CURRENT_USER.id).eq('target_type',type).eq('target_id',id).eq('list_type',listType);
      FAVORITES_SET.delete(key);
      FAVORITES_LIST=FAVORITES_LIST.filter(function(f){return !(f.target_type===type&&f.target_id===id&&f.list_type===listType);});
    }else{
      await sbClient.from('favorites').insert({user_id:CURRENT_USER.id,target_type:type,target_id:id,list_type:listType});
      FAVORITES_SET.add(key);
      FAVORITES_LIST.push({target_type:type,target_id:id,list_type:listType});
    }
  }finally{
    btn.disabled=false;refreshFavoriteButtons();
    if(location.hash==='#mypage')renderMyPage();
  }
}
function refreshFavoriteButtons(){
  document.querySelectorAll('.fav-btn').forEach(function(b){
    var key=(b.dataset.listType||'favorite')+':'+b.dataset.favType+':'+b.dataset.favId;
    var on=FAVORITES_SET.has(key);
    b.classList.toggle('on',on);
  });
}

/* ── 사람 레코드 클레임 ("이거 나예요") — 자동승인 없이 전부 관리자 승인을 거침 ── */
function escHtml(s){
  return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});
}
async function renderPersonIntro(pid){
  var el=$('person-intro-line');if(!el)return;
  try{
    var r=await sbClient.rpc('get_person_intro',{p_person_id:pid});
    if(r.data)el.innerHTML='<div class="person-intro-text">'+escHtml(r.data)+'</div>';
  }catch(e){}
}
async function renderClaimWidget(pid){
  var el=$('claim-widget');if(!el)return;
  if(!CURRENT_USER){el.innerHTML='';return;}
  if(CURRENT_USER.personId===pid){
    el.innerHTML='<span class="claim-badge claim-badge-linked">✓ 내 프로필</span><button class="claim-btn" onclick="goMyPage()">내 정보 수정하기</button>';
    return;
  }
  try{
    var r=await sbClient.rpc('person_claim_status',{p_person_id:pid});
    var status=r.data||{};
    var h='';
    if(status.claimed){
      h+='<span class="claim-badge claim-badge-linked">✓ 가입한 사람이에요</span>';
    }else{
      h+='<span class="claim-badge claim-badge-pending">아직 가입 안 했어요</span>'
        +'<button class="claim-btn" onclick="inviteThisPerson(\''+pid+'\')">초대 링크 복사</button>';
    }
    if(!CURRENT_USER.personId&&!status.claimed&&status.my_pending){
      h+='<span class="claim-badge claim-badge-pending">내 요청 승인 대기중</span>';
    }
    el.innerHTML=h;
  }catch(e){el.innerHTML='';}
}
async function renderTroupeClaimWidget(tid){
  var el=$('troupe-claim-widget');if(!el)return;
  if(!CURRENT_USER){el.innerHTML='';return;}
  try{
    var r=await sbClient.rpc('troupe_link_status',{p_troupe_id:tid});
    var status=(r.data&&r.data[0])||{};
    var h='';
    if(status.my_role==='admin'){
      h+='<span class="claim-badge claim-badge-linked">✓ 내가 관리하는 단체예요</span><button class="claim-btn" onclick="goMyTroupe(\''+tid+'\')">단체 정보 수정하기</button>';
    }else if(status.my_pending){
      h+='<span class="claim-badge claim-badge-pending">승인 대기 중</span>';
    }else{
      h+='<button class="claim-btn" onclick="requestTroupeLink(\''+tid+'\')">우리 단체예요</button>';
    }
    el.innerHTML=h;
  }catch(e){el.innerHTML='';}
}
async function requestTroupeLink(tid){
  if(!CURRENT_USER){loginWithGoogle();return;}
  if(!await oriConfirm('이 단체의 관리자로 연결을 요청할까요?\n관리자가 확인 후 승인하면 단체 정보를 수정할 수 있어요.'))return;
  try{
    var r=await sbClient.rpc('request_troupe_link',{p_troupe_id:tid});
    if(r.error)throw r.error;
    oriAlert('요청을 보냈어요. 승인되면 단체 정보를 수정할 수 있어요.');
    renderTroupeClaimWidget(tid);
  }catch(e){oriAlert('요청 실패: '+e.message);}
}
function maybeShowConnectPrompt(){
  if(!CURRENT_USER||CURRENT_USER.personId)return;
  try{if(sessionStorage.getItem('oridb_connect_dismissed')==='1')return;}catch(e){}
  var overlay=$('connect-overlay');if(overlay)overlay.classList.add('open');
}
function maybeForceShowConnectPrompt(){
  if(!CURRENT_USER)return;
  var overlay=$('connect-overlay');if(overlay)overlay.classList.add('open');
}
function closeConnectPrompt(){
  var overlay=$('connect-overlay');if(overlay)overlay.classList.remove('open');
  try{sessionStorage.setItem('oridb_connect_dismissed','1');}catch(e){}
}
function connectFilterList(q){
  var el=$('connect-results');if(!el)return;
  q=q.trim();
  if(!q){el.innerHTML='';return;}
  var matches=DB.people.filter(function(p){var n=fld(p,'이름');return n&&n.indexOf(q)>-1;}).slice(0,8);
  el.innerHTML=matches.length?matches.map(function(p){return '<div class="wizard-result-item" onclick="connectSelectPerson(\''+p.id+'\')">'+escHtml(fld(p,'이름'))+'</div>';}).join(''):'<div class="wizard-result-empty">일치하는 사람이 없어요</div>';
}
async function connectSelectPerson(pid){
  try{
    await sbClient.from('person_claims').insert({user_id:CURRENT_USER.id,person_id:pid});
    closeConnectPrompt();
    oriAlert(nm(pid)+'님으로 연결 요청을 보냈어요. 관리자가 확인하면 승인돼요.');
  }catch(e){oriAlert('요청 중 문제가 생겼어요. 이미 요청했을 수도 있어요.');}
}
function inviteThisPerson(pid){
  var name=nm(pid)||'이 분';
  var url=location.origin+location.pathname+'#person-'+pid;
  var msg=name+'님, 오리(연극·뮤지컬 아카이브)에 참여이력이 등록되어 있어요! 로그인하고 확인해보세요: '+url;
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(msg).then(function(){oriAlert('복사했어요! 카톡 등으로 붙여넣어 보내보세요.');}).catch(function(){oriPrompt('아래 내용을 복사해서 보내보세요:',msg);});
  }else{
    oriPrompt('아래 내용을 복사해서 보내보세요:',msg);
  }
}
