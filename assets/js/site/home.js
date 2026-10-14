/* 오리 사이트 — 첫 화면 (10/14: 만드는 사람의 출발점, 한 화면)
   본질 = 연극·뮤지컬을 만드는 걸 돕는다. 스크롤 없이 한 화면에, 같은 크기의 상자 다섯 개:
     찾기(검색) · 열린 기회 · 나한테 온 제안 · 하던 프로젝트 · 새 프로젝트
   상자마다 지금 상태 한 줄(몇 개, 어떤 프로젝트)을 보여주고, 누르면 바로 그 일로 간다.
   관객용 기능은 키우지 않는다 (direction.md) */
function goHome(push){
  if(push!==false)history.pushState({view:'home'},'','#home');
  setNav('home');sb('');_sbContext='';  renderHome();
}
var _homeState={opps:null,offers:null};
function homeTile(id,icon,title,onclick){
  return '<div class="home-tile" id="ht-'+id+'"'+(onclick?' role="button" tabindex="0" onclick="'+onclick+'" onkeydown="if(event.key===\'Enter\')this.click()"':'')+'>'
    +'<div class="home-tile-icon" aria-hidden="true">'+icon+'</div>'
    +'<div class="home-tile-title">'+title+'</div>'
    +'<div class="home-tile-body" id="ht-'+id+'-body"><span class="home-tile-sub">&nbsp;</span></div></div>';
}
function renderHome(){
  // mn()이 #mn의 innerHTML을 통째로 갈아치우기 때문에, 검색창이 이미 홈 안에 들어가 있는 상태에서
  // 다시 렌더링하면 참조를 잃어버린다. mn() 호출 전에 미리 붙잡아둔다.
  var wrap=$('gs-wrap');
  mn('<div class="home-one">'
    +'<div class="home-brand"><div class="home-hero-tagline">연극·뮤지컬을 만드는 사람들</div>'
    +'<h1 class="home-hero-title"><svg class="logo-mark" aria-hidden="true"><use href="#duck-logo"></use></svg>오리</h1>'
    +'<div class="home-hero-pitch">올리고 싶은 작품을 찾고, 함께할 사람을 만나고,<br>정식으로 허락받아 무대에 올려요.</div></div>'
    +'<div class="home-tiles">'
    +homeTile('search','🔍','찾기',null)
    +homeTile('opps','📣','열린 기회','goProjectBrowse()')
    +homeTile('offers','✉️','나한테 온 제안','goOffers()')
    +homeTile('proj','🎭','하던 프로젝트','homeOpenProject()')
    +homeTile('new','＋','새 프로젝트','startNewProject()')
    +'</div></div>');
  // 찾기 상자 안에 검색창을 넣는다
  var body=$('ht-search-body');
  if(wrap&&body){body.innerHTML='';body.appendChild(wrap);}
  var gi=$('gs-input');if(gi)gi.placeholder='작품, 사람, 극장…';
  homeSub('new','다음 공연 준비 시작하기');
  renderHomeProj();
  if(CURRENT_USER)loadMyProjectsCache().then(renderHomeProj);
  loadHomeCounts();
}
function homeSub(id,html){var el=$('ht-'+id+'-body');if(el)el.innerHTML='<span class="home-tile-sub">'+html+'</span>';}
function homeActive(){return (MY_PROJECTS_CACHE||[]).filter(function(p){return PROJECT_ACTIVE_STATUS.indexOf(p.status||'planning')>-1;});}
function renderHomeProj(){
  if(!$('ht-proj'))return;
  if(!CURRENT_USER){homeSub('proj','로그인하면 보여요');return;}
  var a=homeActive();
  if(!a.length){homeSub('proj','아직 진행 중인 프로젝트가 없어요');$('ht-proj').classList.add('is-empty');return;}
  $('ht-proj').classList.remove('is-empty');
  var p=a[0],dd=projectDday(p.target_start_date,p.target_end_date,p.status||'planning');
  homeSub('proj','<b>'+escHtml(p.title||'새 프로젝트')+'</b>'+(a.length>1?' 외 '+(a.length-1)+'개':'')+'<br><em>'+escHtml(dd.big)+'</em>');
}
/* 하던 프로젝트: 하나면 바로 그 프로젝트로, 여럿이면 내 프로젝트 목록으로 */
async function homeOpenProject(){
  if(!CURRENT_USER){loginWithGoogle();return;}
  var a=homeActive();
  if(a.length===1){goProject(a[0].id);return;}
  await ensureMakerEntry();goMake();
}
async function loadHomeCounts(){
  if(!CURRENT_USER){homeSub('opps','로그인하면 보여요');homeSub('offers','로그인하면 보여요');return;}
  var res=await Promise.all([sbClient.rpc('list_opportunities'),sbClient.rpc('my_offers')]);
  if(!$('ht-opps'))return;
  var opps=res[0].error?null:(res[0].data||[]),offers=res[1].error?null:(res[1].data||[]);
  if(opps)_opp.rows=opps;
  _homeState.opps=opps;_homeState.offers=offers;
  homeSub('opps',opps==null?'불러오지 못했어요':opps.length?'<em>'+opps.length+'</em>개 자리가 사람을 찾아요':'지금 열린 자리가 없어요');
  homeSub('offers',offers==null?'불러오지 못했어요':offers.length?'<em>'+offers.length+'</em>개가 답을 기다려요':'아직 온 제안이 없어요');
  $('ht-offers').classList.toggle('has-new',!!(offers&&offers.length));
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
