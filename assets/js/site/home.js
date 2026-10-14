/* 오리 사이트 — 첫 화면 (10/14: 한 화면, 같은 크기 상자 세 개)
   본질 = 연극·뮤지컬을 만드는 걸 돕는다. 첫 화면에서 하는 일은 셋뿐:
     1) 정보를 탐색한다 — 검색 + 갈래(작품·공연·사람·단체·극장)
     2) 기회를 보고 제안을 확인한다 — 열린 자리 / 나한테 온 제안
     3) 프로젝트를 한다 — 하던 것 들어가기 / 새로 시작
   관객용 기능은 키우지 않는다 (direction.md) */
function goHome(push){
  if(push!==false)history.pushState({view:'home'},'','#home');
  setNav('home');sb('');_sbContext='';  renderHome();
}
function homeBox(id,num,title,inner){
  return '<section class="home-box" id="hb-'+id+'"><div class="home-box-head"><span class="home-box-num">'+num+'</span><h2 class="home-box-title">'+title+'</h2></div>'
    +'<div class="home-box-body">'+inner+'</div></section>';
}
function homeRow(id,label,sub,onclick,cls){
  return '<button type="button" class="home-row'+(cls?' '+cls:'')+'" id="'+id+'" onclick="'+onclick+'"><span class="home-row-label">'+label+'</span>'
    +'<span class="home-row-sub" id="'+id+'-sub">'+(sub||'&nbsp;')+'</span><span class="home-row-go" aria-hidden="true">›</span></button>';
}
function renderHome(){
  // mn()이 #mn을 통째로 갈아치우므로, 검색창(#gs-wrap)을 먼저 붙잡아 두었다가 첫 상자 안에 다시 넣는다
  var wrap=$('gs-wrap');
  mn('<div class="home-one">'
    +'<div class="home-brand"><div class="home-hero-tagline">연극·뮤지컬을 만드는 사람들</div>'
    +'<h1 class="home-hero-title"><svg class="logo-mark" aria-hidden="true"><use href="#duck-logo"></use></svg>오리</h1>'
    +'<div class="home-hero-pitch">올리고 싶은 작품을 찾고, 함께할 사람을 만나고,<br>정식으로 허락받아 무대에 올려요.</div></div>'
    +'<div class="home-boxes">'
    +homeBox('find','1','정보 찾기','<div id="hb-search"></div><div class="home-jump">'
      +'<button type="button" onclick="goWorks()">작품</button><button type="button" onclick="goShows()">공연</button>'
      +'<button type="button" onclick="goPeople()">사람</button><button type="button" onclick="goTroupes()">단체</button>'
      +'<button type="button" onclick="goVenues()">극장</button></div>')
    +homeBox('opp','2','기회와 제안',homeRow('hr-opps','열린 기회','','goProjectBrowse()')+homeRow('hr-offers','나한테 온 제안','','goOffers()'))
    +homeBox('proj','3','프로젝트','<div id="hr-projs"></div>'+homeRow('hr-new','＋ 새 프로젝트','다음 공연 준비 시작하기','startNewProject()','home-row-new'))
    +'</div></div>');
  var slot=$('hb-search');
  if(wrap&&slot)slot.appendChild(wrap);
  var gi=$('gs-input');if(gi)gi.placeholder='작품, 사람, 극장 이름으로 찾기';
  renderHomeProj();
  if(CURRENT_USER)loadMyProjectsCache().then(renderHomeProj);
  loadHomeCounts();
}
function homeSub(id,html){var el=$(id+'-sub');if(el)el.innerHTML=html;}
function homeActive(){return (MY_PROJECTS_CACHE||[]).filter(function(p){return PROJECT_ACTIVE_STATUS.indexOf(p.status||'planning')>-1;});}
/* 하던 프로젝트: 최근 두 개를 바로 들어가는 줄로, 더 있으면 "모두 보기" */
function renderHomeProj(){
  var el=$('hr-projs');if(!el)return;
  if(!CURRENT_USER){el.innerHTML=homeRow('hr-login','하던 프로젝트','로그인하면 보여요','loginWithGoogle()');return;}
  var a=homeActive();
  if(!a.length){el.innerHTML='<div class="home-row-empty">하던 프로젝트가 없어요</div>';return;}
  el.innerHTML=a.slice(0,2).map(function(p,i){
    var dd=projectDday(p.target_start_date,p.target_end_date,p.status||'planning');
    return homeRow('hr-p'+i,escHtml(p.title||'새 프로젝트'),'<em>'+escHtml(dd.big)+'</em> · '+escHtml(PROJECT_STATUS_LABEL[p.status||'planning']||''),'goProject(\''+p.id+'\')');
  }).join('')+(a.length>2?'<button type="button" class="home-more" onclick="goMake()">하던 프로젝트 '+a.length+'개 모두 보기 ›</button>':'');
}
var _homeCounts={};
async function loadHomeCounts(){
  if(!CURRENT_USER){homeSub('hr-opps','로그인하면 보여요');homeSub('hr-offers','로그인하면 보여요');return;}
  var res=await Promise.all([sbClient.rpc('list_opportunities'),sbClient.rpc('my_offers')]);
  if(!$('hr-opps'))return;
  var opps=res[0].error?null:(res[0].data||[]),offers=res[1].error?null:(res[1].data||[]);
  if(opps)_opp.rows=opps;
  homeSub('hr-opps',opps==null?'불러오지 못했어요':opps.length?'<em>'+opps.length+'</em>개 자리가 사람을 찾아요':'지금 열린 자리가 없어요');
  homeSub('hr-offers',offers==null?'불러오지 못했어요':offers.length?'<em>'+offers.length+'</em>개가 답을 기다려요':'아직 온 제안이 없어요');
  $('hr-offers').classList.toggle('has-new',!!(offers&&offers.length));
}

/* ══ 나한테 온 제안 (#offers): 받은 제안을 보고 그 자리에서 수락·거절 ══ */
var _homeOffers=[];
async function goOffers(push){
  if(!CURRENT_USER){loginWithGoogle();return;}
  if(push!==false)history.pushState({view:'offers'},'','#offers');
  setNav('offers');sb('');_sbContext='';
  mn('<div class="tab-index"><div class="result-empty"><div class="hf-loading">불러오는 중…</div></div></div>');
  var r=await sbClient.rpc('my_offers');
  if(r.error){mn(loadFailHtml('제안'));return;}
  _homeOffers=r.data||[];
  renderOffers();
}
function renderOffers(){
  var h='<div class="offers-page"><h1 class="dv-title">나한테 온 제안</h1>'
    +'<p class="home-sec-sub">프로젝트에서 함께하자고 보낸 제안이에요. 함께하면 바로 그 프로젝트의 구성원이 돼요.</p>';
  if(!_homeOffers.length)h+='<div class="dv-empty">아직 온 제안이 없어요. <button type="button" class="dv-all" onclick="goProjectBrowse()">열린 기회 둘러보기 ›</button></div>';
  else h+='<div class="offer-grid">'+_homeOffers.map(function(o){
      var from=[o.troupe_name,o.inviter_nickname&&o.inviter_nickname+'님'].filter(Boolean).join(' · ');
      var meta=[o.work_name,o.target_start_date?String(o.target_start_date).slice(0,10).replace(/-/g,'.')+' 공연':''].filter(Boolean).join(' · ');
      return '<div class="offer-card">'
        +'<div class="opp-kind">제안'+(from?' · '+escHtml(from):'')+'</div>'
        +'<div class="opp-title">'+escHtml(o.position_label||'함께해요')+'</div>'
        +'<div class="opp-proj">'+escHtml(o.project_title||'새 프로젝트')+'</div>'
        +(meta?'<div class="opp-meta">'+escHtml(meta)+'</div>':'')
        +(o.message?'<div class="offer-msg">“'+escHtml(o.message)+'”</div>':'')
        +(o.position_open===false?'<div class="opp-meta">그 사이 이 자리가 채워졌어요</div>':'')
        +'<div class="offer-actions">'
        +(o.position_open===false?'':'<button type="button" class="offer-yes" onclick="answerOffer(\''+o.id+'\',true)">함께할게요</button>')
        +'<button type="button" class="offer-no" onclick="answerOffer(\''+o.id+'\',false)">'+(o.position_open===false?'목록에서 지우기':'이번엔 어려워요')+'</button></div></div>';
    }).join('')+'</div>';
  mn(h+'</div>');
}
async function answerOffer(id,accept){
  var o=_homeOffers.find(function(x){return x.id===id;});if(!o)return;
  if(!accept&&o.position_open!==false&&!(await oriConfirm('「'+(o.project_title||'이 프로젝트')+'」의 '+(o.position_label||'제안')+' 제안을 거절할까요?',{ok:'거절하기',cancel:'그대로 두기'})))return;
  try{await sbOk(sbClient.rpc('respond_offer',{p_request_id:id,p_accept:accept}));}
  catch(e){oriAlert('답하지 못했어요: '+e.message);goOffers(false);return;}
  _homeOffers=_homeOffers.filter(function(x){return x.id!==id;});
  renderOffers();
  if(accept){
    loadMyProjectsCache();
    oriAlert('「'+(o.project_title||'프로젝트')+'」에 합류했어요',{action:{label:'프로젝트 열기',fn:function(){goProject(o.project_id);}}});
  }else oriAlert('제안을 거절했어요');
}
