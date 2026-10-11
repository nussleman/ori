/* 오리 사이트 — 첫 화면 (4단계 입구 재구성)
   만드는 사람에게 거는 한 문장 + 검색 + 두 갈래(작품 찾기 / 내 공연 시작하기).
   아래로는 많이 올라간 작품(작품 허브로) → 지금 모집 중인 자리 → 최근 공연. 관객용 기능은 키우지 않는다 (direction.md) */
/* ══ 홈: 한가운데 검색창만 있는 랜딩 화면 ══ */
function goHome(push){
  if(push!==false)history.pushState({view:'home'},'','#home');
  setNav('home');sb('');_sbContext='';  renderHome();
}
function renderHome(){
  // mn()이 #mn의 innerHTML을 통째로 갈아치우기 때문에, 검색창이 이미 홈 안(#home-search-slot)에
  // 들어가 있는 상태에서 다시 렌더링하면 참조를 잃어버린다. mn() 호출 전에 미리 붙잡아둔다.
  var wrap=$('gs-wrap');
  var shows=sortShows(DB.shows.filter(function(s){return fld(s,'공연명');}));
  var people=DB.people.filter(function(p){return fld(p,'이름');});
  var hasProj=MY_PROJECTS_CACHE&&MY_PROJECTS_CACHE.length;
  var heroH='<div class="home-hero">'
    +'<div class="home-hero-top"><div class="home-hero-tagline">연극·뮤지컬을 만드는 사람들</div><div class="home-hero-title"><svg class="logo-mark"><use href="#duck-logo"></use></svg>오리</div>'
    +'<div class="home-hero-pitch">올리고 싶은 작품을 찾고, 함께할 사람을 만나고,<br>정식으로 허락받아 무대에 올려요.</div></div>'
    +'<div class="home-hero-search" id="home-search-slot"></div>'
    +'<div class="home-hero-bottom"><div class="home-hero-cta">'
    +'<button type="button" class="pf-btn" onclick="goWorks()">작품 찾기</button>'
    +'<button type="button" class="pf-btn pf-active" id="home-start" onclick="homeStart()">'+(hasProj?'내 프로젝트로 →':'내 공연 시작하기')+'</button></div>'
    +'<div class="home-hero-stats">공연 <em>'+shows.length+'</em>편 · 사람 <em>'+people.length+'</em>명 · 작품 <em>'+DB.works.length+'</em>개</div>'
    +'<div class="home-scroll">아래로 둘러보기 ↓</div></div>'
    +'</div>';
  // 첫 화면 아래: 최근 공연(둘러보고 기록 남기기)과 지금 모집 중인 자리(기회)
  var feed='<div class="home-feed">'
    +'<section class="home-sec" id="home-works"></section>'
    +'<section class="home-sec" id="home-opps"></section>'
    +'<section class="home-sec"><div class="dv-h-row"><h2 class="dv-h">최근 공연</h2><button type="button" class="dv-all" onclick="goShows()">모두보기 ›</button></div>'
    +'<div class="home-posters">'+shows.slice(0,8).map(function(s){return dvShowCard(s,dvShowSub(s,['troupe','date']));}).join('')+'</div></section>'
    +'<p class="home-credit">오리는 team 오리가 만들고 있어요</p></div>';
  mn(heroH+feed);
  // 검색창을 사이드바/상단바가 아닌 홈 히어로 한가운데로 옮긴다
  var slot=$('home-search-slot');
  if(wrap&&slot)slot.appendChild(wrap);
  loadHomeOpps();
  loadHomeWorks();
  // 내 프로젝트 목록이 늦게 오면 버튼 이름을 그때 맞춘다
  if(!hasProj&&CURRENT_USER)loadMyProjectsCache().then(function(){var b=$('home-start');if(b&&MY_PROJECTS_CACHE.length)b.textContent='내 프로젝트로 →';});
}
/* 내 공연 시작하기: 이미 프로젝트가 있으면 내 프로젝트로, 없으면 새로 (누르는 순간의 목록으로 판단 — 실수로 새 프로젝트가 생기지 않게) */
async function homeStart(){
  if(!CURRENT_USER){loginWithGoogle();return;}
  if(!(MY_PROJECTS_CACHE&&MY_PROJECTS_CACHE.length))await loadMyProjectsCache();
  if(MY_PROJECTS_CACHE&&MY_PROJECTS_CACHE.length){await ensureMakerEntry();goMake();}
  else startNewProject();
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
async function loadHomeOpps(){
  if(!CURRENT_USER)return;
  var r=await sbClient.rpc('list_opportunities');
  var el=$('home-opps');if(!el||r.error)return;
  var rows=r.data||[];if(!rows.length){el.innerHTML='';return;}
  _opp.rows=rows;
  el.innerHTML='<div class="dv-h-row"><h2 class="dv-h">지금 모집 중인 자리<span class="dv-n">'+rows.length+'</span></h2><button type="button" class="dv-all" onclick="goProjectBrowse()">기회 모두보기 ›</button></div>'
    +'<div class="opp-grid">'+rows.slice(0,3).map(oppCardHtml).join('')+'</div>';
}
