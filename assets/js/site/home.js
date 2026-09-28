/* 오리 사이트 — 첫 화면: 가운데 검색창 + '프로젝트 만들기' 한 스푼 */
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
  var heroH='<div class="home-hero">'
    +'<div class="home-hero-top"><div class="home-hero-tagline">연극·뮤지컬 아카이브</div><div class="home-hero-title"><svg class="logo-mark"><use href="#duck-logo"></use></svg>오리</div></div>'
    +'<div class="home-hero-search" id="home-search-slot"></div>'
    +'<div class="home-hero-bottom"><div class="home-hero-stats">공연 <em>'+shows.length+'</em>편 · 사람 <em>'+people.length+'</em>명 · 작품 <em>'+DB.works.length+'</em>개</div>'
    +'<div class="home-scroll">아래로 둘러보기 ↓</div></div>'
    +'</div>';
  // 첫 화면 아래: 최근 공연(둘러보고 기록 남기기)과 지금 모집 중인 자리(기회)
  var feed='<div class="home-feed">'
    +'<section class="home-sec"><div class="dv-h-row"><h2 class="dv-h">최근 공연</h2><button type="button" class="dv-all" onclick="goShows()">모두보기 ›</button></div>'
    +'<div class="home-posters">'+shows.slice(0,8).map(function(s){return dvShowCard(s,dvShowSub(s,['troupe','date']));}).join('')+'</div></section>'
    +'<section class="home-sec" id="home-opps"></section>'
    +'<p class="home-credit">오리는 team 오리가 만들고 있어요</p></div>';
  mn(heroH+feed);
  // 검색창을 사이드바/상단바가 아닌 홈 히어로 한가운데로 옮긴다
  var slot=$('home-search-slot');
  if(wrap&&slot)slot.appendChild(wrap);
  loadHomeOpps();
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
