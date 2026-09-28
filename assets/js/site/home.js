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
  var shows=DB.shows.filter(function(s){return fld(s,'공연명');});
  var people=DB.people.filter(function(p){return fld(p,'이름');});
  var histCnt=DB.history.filter(isValidH).length;
  var heroH='<div class="home-hero">'
    +'<div class="home-hero-top"><div class="home-hero-tagline">연극·뮤지컬 아카이브</div><div class="home-hero-title"><svg class="logo-mark"><use href="#duck-logo"></use></svg>오리</div></div>'
    +'<div class="home-hero-search" id="home-search-slot"></div>'
    +'<div class="home-hero-bottom"><div class="home-hero-stats">공연 <em>'+shows.length+'</em>건 · 참여자 <em>'+people.length+'</em>명 · 참여이력 <em>'+histCnt+'</em>건</div>'
    +'<button type="button" class="home-make" onclick="goMake()">프로젝트 만들기 →</button>'
    +'<div class="home-credit">오리는 team 오리가 만들고 있어요</div></div>'
    +'</div>';
  mn(heroH);
  // 검색창을 사이드바/상단바가 아닌 홈 히어로 한가운데로 옮긴다
  var slot=$('home-search-slot');
  if(wrap&&slot)slot.appendChild(wrap);
}
