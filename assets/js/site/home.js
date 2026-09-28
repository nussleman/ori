/* 오리 사이트 — 둘러보기 홈
   들어오자마자 "할 게 보이는" 피드: 모집 중인 자리 → 최근 공연 → 많이 올려진 작품 → 활발한 단체.
   각 줄 오른쪽 "전체 보기"로 해당 메뉴에 들어간다. 카드 클릭은 다른 목록과 똑같이 (한 번=패널, 두 번=페이지). */
function goHome(push){
  if(push!==false)history.pushState({view:'home'},'','#home');
  setNav('home');sb('');_sbContext='';
  renderHome();
}

function homeSection(title,sub,moreLabel,moreGo,bodyH,id){
  return '<section class="hf-sec"'+(id?' id="'+id+'"':'')+'><div class="hf-head"><div><h2 class="hf-title">'+title+'</h2>'
    +(sub?'<div class="hf-sub">'+sub+'</div>':'')+'</div>'
    +(moreGo?'<button type="button" class="hf-more" onclick="'+moreGo+'">'+moreLabel+' →</button>':'')+'</div>'+bodyH+'</section>';
}

function renderHome(){
  var shows=DB.shows.filter(function(s){return fld(s,'공연명');});
  var people=DB.people.filter(function(p){return fld(p,'이름');});
  var name=CURRENT_USER&&CURRENT_USER.nickname?escHtml(CURRENT_USER.nickname)+'님, ':'';

  var hero='<div class="hf-hero">'
    +'<div class="hf-hero-text"><div class="hf-kicker">연극·뮤지컬 아카이브</div>'
    +'<h1 class="hf-hello">'+name+'오늘은 무엇을 해볼까요?</h1>'
    +'<div class="hf-stats">공연 <em>'+shows.length+'</em> · 사람 <em>'+people.length+'</em> · 작품 <em>'+DB.works.length+'</em> · 단체 <em>'+DB.troupes.length+'</em></div></div>'
    +'<div class="hf-doors">'
    +'<button type="button" class="hf-door" onclick="goShows()"><span class="hf-door-t">공연 둘러보기</span><span class="hf-door-s">누가 어떤 공연을 했는지</span></button>'
    +'<button type="button" class="hf-door hf-door-my" onclick="goMyShows()"><span class="hf-door-t">내 공연 준비하기</span><span class="hf-door-s">팀 꾸리기부터 공연 올리기까지</span></button>'
    +'</div></div>';

  // 최근 공연 (날짜 최신순)
  var recent=sortShows(shows).slice(0,8);
  var recentH='<div class="dv-list dv-list-cards hf-row">'+recent.map(function(s){return dvShowCard(s,dvShowSub(s,['troupe','date']));}).join('')+'</div>';

  // 많이 올려진 작품
  var workCnt={};shows.forEach(function(s){var w=ids(fld(s,'작품'))[0];if(w)workCnt[w]=(workCnt[w]||0)+1;});
  var topWorks=Object.keys(workCnt).sort(function(a,b){return workCnt[b]-workCnt[a];}).slice(0,8);
  var workById={};DB.works.forEach(function(w){workById[w.id]=w;});
  var worksH='<div class="dv-list dv-list-cards hf-row">'+topWorks.map(function(wid){
    var w=workById[wid];if(!w)return '';
    var img=iurl(fld(w,'사진'));
    // 작품 포스터가 없으면 가장 최근 공연 포스터를 쓴다
    if(!img){var s=sortShows(shows.filter(function(x){return ids(fld(x,'작품'))[0]===wid&&POSTER[x.id];}))[0];if(s)img=POSTER[s.id];}
    return '<div class="dv-card" data-action="work" data-id="'+wid+'">'
      +(img?'<img class="dv-card-img" src="'+img+'" alt="">':'<div class="dv-card-img dv-card-ph">📖</div>')
      +'<div class="dv-card-title">'+escHtml(fld(w,'작품명')||'')+'</div><div class="dv-card-sub">'+workCnt[wid]+'번 공연됨</div></div>';
  }).join('')+'</div>';

  // 활발한 단체
  var trCnt={},trLast={};
  shows.forEach(function(s){var t=ids(fld(s,'극단'))[0];if(!t)return;trCnt[t]=(trCnt[t]||0)+1;var d=fld(s,'공연 날짜')||'';if(d>(trLast[t]||''))trLast[t]=d;});
  var topTroupes=Object.keys(trCnt).sort(function(a,b){return trCnt[b]-trCnt[a]||(trLast[b]||'').localeCompare(trLast[a]||'');}).slice(0,6);
  var troupesH='<div class="dv-list dv-list-rows">'+topTroupes.map(function(t){
    var tr=DB.troupes.find(function(x){return x.id===t;});var ph=tr?iurl(fld(tr,'사진')):'';
    return '<div class="dv-row" data-action="troupe" data-id="'+t+'">'
      +(ph?'<img class="dv-row-img" src="'+ph+'" alt="">':'<div class="dv-row-img dv-card-ph">🏢</div>')
      +'<div class="dv-row-main"><div class="dv-row-title">'+escHtml(nm(t))+'</div><div class="dv-row-sub">공연 '+trCnt[t]+'편'+(trLast[t]?' · 최근 '+ym(trLast[t]):'')+'</div></div></div>';
  }).join('')+'</div>';

  var h='<div class="home-feed">'+hero
    +homeSection('지금 모집 중','함께할 사람을 찾고 있는 공연이에요','모집 전체 보기','goProjectBrowse()','<div id="hf-recruit" class="hf-recruit"><div class="hf-loading">불러오는 중…</div></div>','hf-recruit-sec')
    +homeSection('최근 공연','','공연 전체 보기','goShows()',recentH)
    +(topWorks.length?homeSection('많이 올려진 작품','여러 단체가 무대에 올린 작품이에요','작품 전체 보기','goWorks()',worksH):'')
    +(topTroupes.length?homeSection('활발한 단체','','단체 전체 보기','goTroupes()',troupesH):'')
    +'</div>';
  mn(h);
  loadHomeRecruiting();
}

async function loadHomeRecruiting(){
  var el=$('hf-recruit');if(!el)return;
  try{
    var r=await sbClient.rpc('browse_recruiting_positions');
    var rows=(r.data||[]).slice(0,8);
    if(!rows.length){
      el.innerHTML='<div class="hf-empty">지금은 모집 중인 자리가 없어요. <span class="link" onclick="goMyShows()">내 공연을 시작하고 사람을 모아보세요 →</span></div>';
      return;
    }
    var typeLabel={actor:'배우',staff:'스텝',other:'기타'};
    el.innerHTML='<div class="hf-recruit-list">'+rows.map(function(p){
      return '<button type="button" class="hf-rc" onclick="goProject(\''+p.project_id+'\')">'
        +'<span class="hf-rc-type">'+(typeLabel[p.position_type]||'모집')+'</span>'
        +'<span class="hf-rc-label">'+escHtml(p.position_label||'자리')+'</span>'
        +'<span class="hf-rc-proj">'+escHtml(p.project_title||'')+'</span></button>';
    }).join('')+'</div>';
  }catch(e){el.innerHTML='<div class="hf-empty">모집 정보를 불러오지 못했어요.</div>';}
}
