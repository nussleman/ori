/* 오리 사이트 — 아카이브 홈 = 사이트 첫 화면 (10/14)
   주 메뉴는 셋: 아카이브(DB) · 기회(매칭) · 내 프로젝트. 여기는 아카이브의 첫 화면:
   검색 + 지금 쌓인 기록의 크기 → 많이 올라간 작품(작품 허브 입구) → 최근 공연.
   관객용 기능은 키우지 않는다 (direction.md) */
function goHome(push){
  if(push!==false)history.pushState({view:'home'},'','#home');
  setNav('home');sb('');_sbContext='';  renderHome();
}
function renderHome(){
  // mn()이 #mn을 통째로 갈아치우므로, 검색창(#gs-wrap)을 먼저 붙잡아 두었다가 가운데 자리에 다시 넣는다
  var wrap=$('gs-wrap');
  var shows=sortShows(DB.shows.filter(function(s){return fld(s,'공연명');}));
  var people=DB.people.filter(function(p){return fld(p,'이름');});
  mn('<div class="ah">'
    +'<section class="ah-top"><h1 class="ah-title">아카이브</h1>'
    +'<p class="ah-sub">누가 어떤 작품을 어디서 올렸는지, 연극·뮤지컬을 만든 기록을 찾아요.</p>'
    +'<div class="ah-search" id="home-search-slot"></div>'
    +'<div class="ah-stats">작품 <em>'+DB.works.length+'</em> · 공연 <em>'+shows.length+'</em> · 사람 <em>'+people.length+'</em> · 단체 <em>'+(DB.troupes||[]).length+'</em> · 극장 <em>'+(DB.venues||[]).length+'</em></div></section>'
    +'<section class="home-sec" id="home-works"></section>'
    +'<section class="home-sec"><div class="dv-h-row"><h2 class="dv-h">최근 공연</h2><button type="button" class="dv-all" onclick="goShows()">모두보기 ›</button></div>'
    +'<div class="home-posters">'+shows.slice(0,8).map(function(s){return dvShowCard(s,dvShowSub(s,['troupe','date']));}).join('')+'</div></section>'
    +'</div>');
  var slot=$('home-search-slot');
  if(wrap&&slot)slot.appendChild(wrap);
  var gi=$('gs-input');if(gi)gi.placeholder='작품, 사람, 단체, 극장 이름으로 찾기';
  loadHomeWorks();
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
    +'<div class="home-works">'+rows.map(function(w){
      var st=WORK_STATS[w.id];
      return '<div class="dv-row" data-action="work" data-id="'+w.id+'"><div class="dv-row-img dv-card-ph">📖</div><div class="dv-row-main"><div class="dv-row-title">'+escHtml(fld(w,'작품명')||'')+'</div>'
        +'<div class="dv-row-sub">'+escHtml([workStageLabel(w.id),st.wish_count?st.wish_count+'명이 올리고 싶어해요':''].filter(Boolean).join(' · '))+'</div></div></div>';
    }).join('')+'</div>';
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
