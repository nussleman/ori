/* 오리 사이트 — 첫 화면 (10/14: 만드는 사람의 출발점)
   본질 = 연극·뮤지컬을 만드는 걸 돕는다. 첫 화면에서 바로 할 수 있는 것:
     찾기(검색 + 갈래 바로가기) → 나한테 온 제안(있을 때만, 바로 수락·거절) → 내 프로젝트 들어가기 / 새 프로젝트 시작
     → 열린 기회 둘러보기 → (아래) 많이 올라간 작품 · 최근 공연
   관객용 기능은 키우지 않는다 (direction.md) */
function goHome(push){
  if(push!==false)history.pushState({view:'home'},'','#home');
  setNav('home');sb('');_sbContext='';  renderHome();
}
function renderHome(){
  // mn()이 #mn의 innerHTML을 통째로 갈아치우기 때문에, 검색창이 이미 홈 안(#home-search-slot)에
  // 들어가 있는 상태에서 다시 렌더링하면 참조를 잃어버린다. mn() 호출 전에 미리 붙잡아둔다.
  var wrap=$('gs-wrap');
  var shows=sortShows(DB.shows.filter(function(s){return fld(s,'공연명');}));
  var heroH='<div class="home-hero">'
    +'<div class="home-hero-tagline">연극·뮤지컬을 만드는 사람들</div>'
    +'<h1 class="home-hero-title"><svg class="logo-mark" aria-hidden="true"><use href="#duck-logo"></use></svg>오리</h1>'
    +'<div class="home-hero-pitch">올리고 싶은 작품을 찾고, 함께할 사람을 만나고,<br>정식으로 허락받아 무대에 올려요.</div>'
    +'<div class="home-hero-search" id="home-search-slot"></div>'
    +'<div class="home-jump" aria-label="갈래별로 찾기">'
    +'<button type="button" onclick="goWorks()">작품</button><button type="button" onclick="goShows()">공연</button>'
    +'<button type="button" onclick="goPeople()">사람</button><button type="button" onclick="goTroupes()">단체</button>'
    +'<button type="button" onclick="goVenues()">극장</button></div>'
    +'</div>';
  var feed='<div class="home-feed">'
    +'<section class="home-sec" id="home-offers"></section>'
    +'<section class="home-sec" id="home-projects"></section>'
    +'<section class="home-sec" id="home-opps"></section>'
    +'<section class="home-sec" id="home-works"></section>'
    +'<section class="home-sec"><div class="dv-h-row"><h2 class="dv-h">최근 공연</h2><button type="button" class="dv-all" onclick="goShows()">모두보기 ›</button></div>'
    +'<div class="home-posters">'+shows.slice(0,8).map(function(s){return dvShowCard(s,dvShowSub(s,['troupe','date']));}).join('')+'</div></section>'
    +'<p class="home-credit">오리는 team 오리가 만들고 있어요</p></div>';
  mn(heroH+feed);
  var slot=$('home-search-slot');
  if(wrap&&slot)slot.appendChild(wrap);
  var gi=$('gs-input');if(gi)gi.placeholder='작품, 사람, 단체, 극장 이름으로 찾아보기';
  renderHomeProjects();
  if(CURRENT_USER)loadMyProjectsCache().then(function(){if(location.hash===''||location.hash==='#home')renderHomeProjects();});
  loadHomeOffers();
  loadHomeOpps();
  loadHomeWorks();
}
/* 내 프로젝트: 진행 중인 것 바로 들어가기 + 새 프로젝트 */
function renderHomeProjects(){
  var el=$('home-projects');if(!el)return;
  if(!CURRENT_USER){
    el.innerHTML='<div class="dv-h-row"><h2 class="dv-h">내 프로젝트</h2></div>'
      +'<button type="button" class="home-new home-new-solo" onclick="loginWithGoogle()"><b>로그인하고 공연 준비 시작하기</b><span>작품·사람·극장·일정·예산을 한곳에서</span></button>';
    return;
  }
  var list=MY_PROJECTS_CACHE||[];
  var active=list.filter(function(p){return PROJECT_ACTIVE_STATUS.indexOf(p.status||'planning')>-1;});
  var newCard='<button type="button" class="home-new'+(active.length?'':' home-new-solo')+'" onclick="startNewProject()">'
    +'<b>＋ 새 프로젝트</b><span>'+(active.length?'다음 공연 준비 시작하기':'올릴 작품이 정해지지 않아도 시작할 수 있어요')+'</span></button>';
  el.innerHTML='<div class="dv-h-row"><h2 class="dv-h">내 프로젝트'+(active.length?'<span class="dv-n">'+active.length+'</span>':'')+'</h2>'
    +(list.length?'<button type="button" class="dv-all" onclick="goMake()">모두보기 ›</button>':'')+'</div>'
    +'<div class="home-proj-grid">'+active.slice(0,5).map(myShowCard).join('')+newCard+'</div>';
}
/* 나한테 온 제안: 있을 때만 맨 위에. 그 자리에서 수락·거절 */
var _homeOffers=[];
async function loadHomeOffers(){
  var el=$('home-offers');if(!el)return;
  if(!CURRENT_USER){el.innerHTML='';return;}
  var r=await sbClient.rpc('my_offers');
  el=$('home-offers');if(!el)return;
  if(r.error){el.innerHTML='';return;}
  _homeOffers=r.data||[];
  renderHomeOffers();
}
function renderHomeOffers(){
  var el=$('home-offers');if(!el)return;
  if(!_homeOffers.length){el.innerHTML='';return;}
  el.innerHTML='<div class="dv-h-row"><h2 class="dv-h">나한테 온 제안<span class="dv-n">'+_homeOffers.length+'</span></h2></div>'
    +'<div class="offer-grid">'+_homeOffers.map(function(o){
      var from=[o.troupe_name,o.inviter_nickname&&o.inviter_nickname+'님'].filter(Boolean).join(' · ');
      var meta=[o.work_name,o.target_start_date?String(o.target_start_date).slice(0,10).replace(/-/g,'.')+' 공연':''].filter(Boolean).join(' · ');
      return '<div class="offer-card" id="offer-'+o.id+'">'
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
}
async function answerOffer(id,accept){
  var o=_homeOffers.find(function(x){return x.id===id;});if(!o)return;
  if(!accept&&o.position_open!==false&&!(await oriConfirm('「'+(o.project_title||'이 프로젝트')+'」의 '+(o.position_label||'제안')+' 제안을 거절할까요?',{ok:'거절하기',cancel:'그대로 두기'})))return;
  try{await sbOk(sbClient.rpc('respond_offer',{p_request_id:id,p_accept:accept}));}
  catch(e){oriAlert('답하지 못했어요: '+e.message);loadHomeOffers();return;}
  _homeOffers=_homeOffers.filter(function(x){return x.id!==id;});
  renderHomeOffers();
  if(accept){
    await loadMyProjectsCache();renderHomeProjects();
    oriAlert('「'+(o.project_title||'프로젝트')+'」에 합류했어요',{action:{label:'프로젝트 열기',fn:function(){goProject(o.project_id);}}});
  }else oriAlert('제안을 거절했어요');
}
/* 많이 올라간 작품: 라이선스와 상관없는 집계(숫자만)로 순위 → 작품 허브로 들어가는 입구 */
async function loadHomeWorks(){
  await loadWorkStats();
  var el=$('home-works');if(!el||!WORK_STATS)return;
  // "몇몇"(작은 숫자라 가린 것)은 순위에 넣지 않는다 — 순서로 숫자를 짐작할 수 있으니까
  var rows=DB.works.filter(function(w){var st=WORK_STATS[w.id];return st&&!st.few&&(st.show_count||st.wish_count);})
    .sort(function(a,b){var x=WORK_STATS[a.id],y=WORK_STATS[b.id];return (y.troupe_count-x.troupe_count)||(y.show_count-x.show_count)||(y.wish_count-x.wish_count);}).slice(0,6);
  if(!rows.length){el.innerHTML='';return;}
  el.innerHTML='<div class="dv-h-row"><h2 class="dv-h">많이 올라간 작품</h2><button type="button" class="dv-all" onclick="goWorks()">작품 모두보기 ›</button></div>'
    +'<p class="home-sec-sub">어떤 작품을 누가 얼마나 올렸는지 보고, 올리고 싶은 작품의 페이지에서 바로 준비를 시작해요.</p>'
    +'<div class="home-works">'+rows.map(function(w){
      var st=WORK_STATS[w.id];
      return '<div class="dv-row" data-action="work" data-id="'+w.id+'"><div class="dv-row-img dv-card-ph">📖</div><div class="dv-row-main"><div class="dv-row-title">'+escHtml(fld(w,'작품명')||'')+'</div>'
        +'<div class="dv-row-sub">'+escHtml([workStageLabel(w.id),st.wish_count?st.wish_count+'명이 올리고 싶어해요':''].filter(Boolean).join(' · '))+'</div></div></div>';
    }).join('')+'</div>';
}
/* 열린 기회: 지금 사람을 찾는 자리 */
async function loadHomeOpps(){
  if(!CURRENT_USER)return;
  var r=await sbClient.rpc('list_opportunities');
  var el=$('home-opps');if(!el||r.error)return;
  var rows=r.data||[];
  _opp.rows=rows;
  el.innerHTML='<div class="dv-h-row"><h2 class="dv-h">열린 기회'+(rows.length?'<span class="dv-n">'+rows.length+'</span>':'')+'</h2><button type="button" class="dv-all" onclick="goProjectBrowse()">기회 모두보기 ›</button></div>'
    +(rows.length?'<div class="opp-grid">'+rows.slice(0,6).map(oppCardHtml).join('')+'</div>'
      :'<div class="dv-empty">지금 사람을 찾는 자리가 없어요. 내 프로젝트에서 자리를 열면 여기 보여요.</div>');
}
