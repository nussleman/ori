/* 오리 사이트 — 만들기 모드
   만들기 모드의 첫 화면(#make): 내가 참여 중인 프로젝트(오리에서 준비·운영 중인 공연) 카드 + 새 프로젝트.
   '공연'은 아카이브에 기록된 실제 공연, '프로젝트'는 오리에서 준비 중인 공연 — 두 말을 섞지 않는다.
   좌측 메뉴에는 진행 중인 공연을 바로가기로 띄운다(renderMakeNav). 목록은 MY_PROJECTS_CACHE(account.js)를 쓴다. */
var PROJECT_ACTIVE_STATUS=['planning','upcoming','running'];
var PROJECT_STATUS_ICON={planning:'✏️',upcoming:'📅',running:'🎭',completed:'✓',cancelled:'—'};

function goMake(push){
  if(push!==false)history.pushState({view:'make'},'','#make');
  setNav('make');sb('');_sbContext='';mobShowDetail();
  if(!CURRENT_USER){mn('<div class="tab-index"><div class="result-empty">로그인이 필요해요</div></div>');return;}
  renderMyShows();
  loadMyProjectsCache().then(function(){if(location.hash==='#make')renderMyShows();});
}

/* 막이 오르기까지 남은 날: {big:'D-68', small:'12.05 첫 공연'} */
function projectDday(start,end,status){
  if(status==='completed')return{big:'막 내림',small:start?String(start).slice(0,10).replace(/-/g,'.'):'',cls:'done'};
  if(status==='cancelled')return{big:'취소',small:'',cls:'done'};
  if(!start)return{big:'D-?',small:'날짜 미정',cls:'tbd'};
  var t=new Date();t.setHours(0,0,0,0);
  var d=new Date(String(start).slice(0,10)+'T00:00:00');
  var e=end?new Date(String(end).slice(0,10)+'T00:00:00'):d;
  var n=Math.round((d-t)/86400000);
  var md=String(start).slice(5,10).replace('-','.');
  if(n>0)return{big:'D-'+n,small:md+' 첫 공연',cls:n<=14?'soon':''};
  if(t<=e)return{big:'공연 중',small:md+' 개막',cls:'live'};
  return{big:'D+'+(-n),small:md+' 개막',cls:'done'};
}

function myShowCard(p){
  var st=p.status||'planning';
  var meta=[p.work_name,p.troupe_name].filter(Boolean).map(escHtml).join(' · ');
  var dd=projectDday(p.target_start_date,p.target_end_date,st);
  return '<button type="button" class="ms-card ms-ticket ms-'+st+'" onclick="goProject(\''+p.id+'\')">'
    +'<span class="ms-main">'
    +'<span class="ms-status"><span class="ms-dot"></span>'+(PROJECT_STATUS_LABEL[st]||st)+'</span>'
    +'<span class="ms-title">'+escHtml(p.title||'새 프로젝트')+'</span>'
    +'<span class="ms-meta">'+(meta||'작품·단체 미정')+'</span>'
    +(p.venue_name?'<span class="ms-meta ms-venue">'+escHtml(p.venue_name)+'</span>':'')
    +'</span>'
    +'<span class="ms-stub ms-stub-'+dd.cls+'"><span class="ms-dday">'+dd.big+'</span>'+(dd.small?'<span class="ms-ddate">'+dd.small+'</span>':'')+'</span>'
    +'</button>';
}

function renderMyShows(){
  var list=MY_PROJECTS_CACHE||[];
  var active=list.filter(function(p){return PROJECT_ACTIVE_STATUS.indexOf(p.status||'planning')>-1;});
  var past=list.filter(function(p){return PROJECT_ACTIVE_STATUS.indexOf(p.status||'planning')===-1;});
  var h='<div class="ms-page"><header class="ms-head"><div><div class="ms-kicker">BACKSTAGE · 무대 뒤</div><h1 class="dv-title">내 프로젝트</h1>'+(active.length?'<div class="ms-tagline">다음 막이 오르기까지 — <em>'+active.length+'편</em> 준비 중</div>':'<div class="ms-tagline">당신의 다음 무대를 여기서 준비해요</div>')+'</div>'
    +'<button type="button" class="ms-new" onclick="startNewProject()">+ 새 프로젝트</button></header>';
  if(!list.length){
    h+='<div class="ms-empty">'
      +'<div class="ms-empty-title">아직 프로젝트가 없어요</div>'
      +'<ol class="ms-steps">'
      +'<li><b>무엇을</b> 올릴지 — 작품·단체·극장을 정해요</li>'
      +'<li><b>누구와</b> 할지 — 배역과 제작진 자리를 만들고 사람을 모아요</li>'
      +'<li><b>어떻게</b> 준비할지 — 일정·예산·홍보를 한곳에서 챙겨요</li>'
      +'<li>공연이 끝나면 <b>아카이브에 올려</b> 모두가 볼 수 있는 공연 기록으로 남겨요</li>'
      +'</ol>'
      +'<button type="button" class="ms-new ms-new-lg" onclick="startNewProject()">첫 프로젝트 시작하기</button>'
      +'<div class="ms-empty-alt">다른 프로젝트에 참여하고 싶다면 <span class="link" onclick="goProjectBrowse()">모집 중인 자리 보기 →</span></div>'
      +'</div>';
  }else{
    h+='<section class="dv-sec">'+dvSection('진행 중',active.length)
      +(active.length?'<div class="ms-grid">'+active.map(myShowCard).join('')+'</div>':'<div class="dv-empty">진행 중인 프로젝트가 없어요.</div>')+'</section>';
    if(past.length)h+='<section class="dv-sec">'+dvSection('끝난 프로젝트',past.length)+'<div class="ms-grid ms-grid-past">'+past.map(myShowCard).join('')+'</div></section>';
  }
  h+='</div>';
  mn(h);
}

/* 좌측 만들기 메뉴: 진행 중인 프로젝트 바로가기 */
function renderMakeNav(){
  var el=document.getElementById('make-nav-projects');if(!el)return;
  var active=(MY_PROJECTS_CACHE||[]).filter(function(p){return PROJECT_ACTIVE_STATUS.indexOf(p.status||'planning')>-1;});
  el.innerHTML=active.length?active.map(function(p){
    return '<button type="button" data-pid="'+p.id+'" class="nav-project'+(window._currentProjectNav===p.id?' active':'')+'" onclick="goProject(\''+p.id+'\')">'+escHtml(p.title||'새 프로젝트')+'</button>';
  }).join(''):'<div class="nav-empty">아직 없어요</div>';
}
