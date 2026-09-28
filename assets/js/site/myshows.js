/* 오리 사이트 — 내 공연
   "내 공연" 모드의 첫 화면: 내가 참여 중인 공연(프로젝트) 카드 + 새 공연 시작.
   좌측 메뉴에는 진행 중인 공연을 바로가기로 띄운다(renderMyNav). 목록은 MY_PROJECTS_CACHE(account.js)를 쓴다. */
var PROJECT_ACTIVE_STATUS=['planning','upcoming','running'];
var PROJECT_STATUS_ICON={planning:'✏️',upcoming:'📅',running:'🎭',completed:'✓',cancelled:'—'};

function goMyShows(push){
  if(push!==false)history.pushState({view:'my'},'','#my');
  setNav('my');sb('');_sbContext='';mobShowDetail();
  if(!CURRENT_USER){mn('<div class="tab-index"><div class="result-empty">로그인이 필요해요</div></div>');return;}
  renderMyShows();
  loadMyProjectsCache().then(function(){if(location.hash==='#my')renderMyShows();});
}

function myShowCard(p){
  var st=p.status||'planning';
  var meta=[p.work_name,p.troupe_name].filter(Boolean).map(escHtml).join(' · ');
  return '<button type="button" class="ms-card ms-'+st+'" onclick="goProject(\''+p.id+'\')">'
    +'<span class="ms-status"><span class="ms-dot"></span>'+(PROJECT_STATUS_LABEL[st]||st)+'</span>'
    +'<span class="ms-title">'+escHtml(p.title||'새 공연')+'</span>'
    +'<span class="ms-meta">'+(meta||'작품·단체 미정')+'</span>'
    +(p.owner_nickname?'<span class="ms-owner">대표 '+escHtml(p.owner_nickname)+'</span>':'')
    +'</button>';
}

function renderMyShows(){
  var list=MY_PROJECTS_CACHE||[];
  var active=list.filter(function(p){return PROJECT_ACTIVE_STATUS.indexOf(p.status||'planning')>-1;});
  var past=list.filter(function(p){return PROJECT_ACTIVE_STATUS.indexOf(p.status||'planning')===-1;});
  var h='<div class="ms-page"><header class="ms-head"><div><div class="dv-kicker">내 공연</div><h1 class="dv-title">준비 중인 공연</h1></div>'
    +'<button type="button" class="ms-new" onclick="startNewProject()">+ 새 공연 시작</button></header>';
  if(!list.length){
    h+='<div class="ms-empty">'
      +'<div class="ms-empty-title">아직 준비 중인 공연이 없어요</div>'
      +'<ol class="ms-steps">'
      +'<li><b>무엇을</b> 올릴지 — 작품·단체·극장을 정해요</li>'
      +'<li><b>누구와</b> 할지 — 배역과 제작진 자리를 만들고 사람을 모아요</li>'
      +'<li><b>어떻게</b> 준비할지 — 일정·예산·홍보를 한곳에서 챙겨요</li>'
      +'<li>공연이 끝나면 <b>아카이브에 올려</b> 모두의 기록으로 남겨요</li>'
      +'</ol>'
      +'<button type="button" class="ms-new ms-new-lg" onclick="startNewProject()">첫 공연 시작하기</button>'
      +'<div class="ms-empty-alt">함께할 공연을 찾고 있다면 <span class="link" onclick="goProjectBrowse()">모집 중인 자리 보기 →</span></div>'
      +'</div>';
  }else{
    h+='<section class="dv-sec">'+dvSection('진행 중',active.length)
      +(active.length?'<div class="ms-grid">'+active.map(myShowCard).join('')+'</div>':'<div class="dv-empty">진행 중인 공연이 없어요.</div>')+'</section>';
    if(past.length)h+='<section class="dv-sec">'+dvSection('지난 공연',past.length)+'<div class="ms-grid ms-grid-past">'+past.map(myShowCard).join('')+'</div></section>';
  }
  h+='</div>';
  mn(h);
}

/* 좌측 "내 공연" 메뉴: 진행 중인 공연 바로가기 */
function renderMyNav(){
  var el=document.getElementById('my-nav-projects');if(!el)return;
  var active=(MY_PROJECTS_CACHE||[]).filter(function(p){return PROJECT_ACTIVE_STATUS.indexOf(p.status||'planning')>-1;});
  el.innerHTML=active.length?active.map(function(p){
    return '<button type="button" data-pid="'+p.id+'" class="nav-project'+(window._currentProjectNav===p.id?' active':'')+'" onclick="goProject(\''+p.id+'\')">'+escHtml(p.title||'새 공연')+'</button>';
  }).join(''):'<div class="nav-empty">아직 없어요</div>';
}
