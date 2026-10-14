/* 오리 사이트 — 아카이브 홈 = 사이트 첫 화면 (10/14, 넷플릭스식)
   맨 위 큰 무대(히어로): 포스터가 있는 최근 공연을 몇 편 돌려 보여준다.
   그 아래 가로로 넘기는 줄: 최근 공연 · 여러 단체가 올린 작품 · 무대에 많이 선 사람 · 단체 · 극장.
   포스터·사진이 없는 항목은 이름을 크게 쓴 "글자 카드"로 (빈 상자 대신). 관객용 기능은 키우지 않는다 (direction.md) */
function nxTone(id){return cardTone(id);}
function nxYear(d){return d?String(d).slice(0,4):'';}
function goHome(push){
  if(push!==false)history.pushState({view:'home'},'','#home');
  setNav('home');sb('');_sbContext='';  renderHome();
}
var _nxHero={list:[],i:0,timer:null};
function renderHome(){
  var shows=sortShows(DB.shows.filter(function(s){return fld(s,'공연명');}));
  // 공연별 참여 인원 (출연·스태프, 사람 기준 중복 없이)
  var castN={};DB.history.forEach(function(h){var sid=ids(fld(h,'공연'))[0],pid=ids(fld(h,'참여자'))[0];if(!sid||!pid)return;(castN[sid]=castN[sid]||{})[pid]=1;});
  window._nxCast=castN;
  _nxHero.list=shows.filter(function(s){return POSTER[s.id];}).slice(0,5);
  if(!_nxHero.list.length)_nxHero.list=shows.slice(0,1);
  _nxHero.i=0;
  // 사람: 무대에 많이 선 순 / 단체·극장: 공연이 많은 순
  var pCount={};DB.history.forEach(function(h){var pid=ids(fld(h,'참여자'))[0],sid=ids(fld(h,'공연'))[0];if(pid&&sid)(pCount[pid]=pCount[pid]||{})[sid]=1;});
  var people=DB.people.filter(function(p){return pCount[p.id];}).sort(function(a,b){return Object.keys(pCount[b.id]).length-Object.keys(pCount[a.id]).length;}).slice(0,16);
  var tCount={},vCount={};shows.forEach(function(s){var t=ids(fld(s,'극단'))[0],v=ids(fld(s,'극장'))[0];if(t)tCount[t]=(tCount[t]||0)+1;if(v)vCount[v]=(vCount[v]||0)+1;});
  var troupes=DB.troupes.filter(function(t){return tCount[t.id];}).sort(function(a,b){return tCount[b.id]-tCount[a.id];}).slice(0,16);
  var venues=DB.venues.filter(function(v){return vCount[v.id];}).sort(function(a,b){return vCount[b.id]-vCount[a.id];}).slice(0,16);
  mn('<div class="nx">'
    +'<section class="nx-hero" id="nx-hero" aria-label="오늘의 무대"></section>'
    +nxRow('최근 무대에 오른 공연','goShows()',shows.slice(0,16).map(nxShowCard))
    +'<div id="nx-works"></div>'
    +nxRow('무대에 많이 선 사람','goPeople()',people.map(function(p){return nxPersonCard(p,Object.keys(pCount[p.id]).length);}))
    +nxRow('자주 무대에 오르는 단체','goTroupes()',troupes.map(function(t){return nxTextCard('troupe',t.id,fld(t,'극단명'),'공연 '+tCount[t.id]+'편',iurl(fld(t,'사진')));}))
    +nxRow('자주 쓰인 극장','goVenues()',venues.map(function(v){var seats=fld(v,'좌석수');return nxTextCard('venue',v.id,fld(v,'극장명'),'공연 '+vCount[v.id]+'편'+(seats?' · '+seats+'석':''),iurl(fld(v,'사진')));}))
    +'</div>');
  renderHero();nxArrows();
  clearInterval(_nxHero.timer);
  if(_nxHero.list.length>1)_nxHero.timer=setInterval(function(){if(!$('nx-hero')){clearInterval(_nxHero.timer);return;}if(document.hidden)return;nxHeroGo(_nxHero.i+1);},8000);
  loadNxWorks();
}
function renderHero(){
  var el=$('nx-hero');if(!el)return;
  var s=_nxHero.list[_nxHero.i];if(!s){el.innerHTML='';return;}
  var p=POSTER[s.id]||'',wid=ids(fld(s,'작품'))[0],tid=ids(fld(s,'극단'))[0],vid=ids(fld(s,'극장'))[0];
  var n=window._nxCast&&window._nxCast[s.id]?Object.keys(window._nxCast[s.id]).length:0;
  var title=fld(s,'공연명')||'',work=wid?nm(wid):'';
  var meta=[nxYear(fld(s,'공연 날짜')),tid&&nm(tid),vid&&nm(vid),n?'출연·스태프 '+n+'명':''].filter(Boolean).map(escHtml).join('<i>•</i>');
  el.innerHTML=(p?'<div class="nx-hero-bg" style="background-image:url(\''+p.replace(/'/g,'%27')+'\')"></div>':'<div class="nx-hero-bg" style="background:#1c1c20"></div>')
    +'<div class="nx-hero-shade"></div>'
    +(p?'<img class="nx-hero-poster" src="'+escHtml(p)+'" alt="'+escHtml(title)+' 포스터">':'')
    +'<div class="nx-hero-text">'
    +(work&&work!==title?'<div class="nx-hero-kicker">〈'+escHtml(work)+'〉</div>':'')
    +'<h1 class="nx-hero-title">'+escHtml(title)+'</h1>'
    +'<div class="nx-hero-meta">'+meta+'</div>'
    +'<div class="nx-hero-btns"><button type="button" class="nx-btn nx-btn-main" onclick="openDetail(\'show\',\''+s.id+'\')"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4l13 8-13 8z"/></svg>공연 기록 보기</button>'
    +(wid?'<button type="button" class="nx-btn" onclick="openDetail(\'work\',\''+wid+'\')">작품 페이지</button>':'')+'</div></div>'
    +(_nxHero.list.length>1?'<div class="nx-dots">'+_nxHero.list.map(function(x,i){return '<button type="button" aria-label="'+(i+1)+'번째 공연" class="'+(i===_nxHero.i?'on':'')+'" onclick="nxHeroGo('+i+',true)"></button>';}).join('')+'</div>':'');
}
function nxHeroGo(i,user){
  var n=_nxHero.list.length;if(!n)return;_nxHero.i=(i+n)%n;renderHero();
  if(user){clearInterval(_nxHero.timer);}
}
/* 가로로 넘기는 줄 하나 */
function nxRow(title,more,cards,sub){
  if(!cards.length)return '';
  var id='nxr'+Math.random().toString(36).slice(2,8);
  return '<section class="nx-row"><div class="nx-row-head"><h2>'+escHtml(title)+'</h2>'+(more?'<button type="button" class="nx-more" onclick="'+more+'">모두 보기 ›</button>':'')+'</div>'
    +(sub?'<p class="nx-row-sub">'+escHtml(sub)+'</p>':'')
    +'<div class="nx-track-wrap"><button type="button" class="nx-arrow nx-prev" aria-label="앞으로" onclick="nxScroll(\''+id+'\',-1)"><span class="nx-arrow-btn"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></span></button>'
    +'<div class="nx-track" id="'+id+'">'+cards.join('')+'</div>'
    +'<button type="button" class="nx-arrow nx-next" aria-label="뒤로" onclick="nxScroll(\''+id+'\',1)"><span class="nx-arrow-btn"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg></span></button></div></section>';
}
/* 줄 양끝 화살표: 처음이면 왼쪽, 끝이면 오른쪽을 감춘다 */
function nxArrows(){
  document.querySelectorAll('.nx-track').forEach(function(t){
    var w=t.parentNode;if(!w||w.dataset.arr)return;w.dataset.arr='1';
    function upd(){w.classList.toggle('at-start',t.scrollLeft<4);w.classList.toggle('at-end',t.scrollLeft+t.clientWidth>=t.scrollWidth-4);}
    t.addEventListener('scroll',upd,{passive:true});upd();
  });
}
function nxScroll(id,dir){var t=$(id);if(t)t.scrollBy({left:dir*t.clientWidth*0.9,behavior:'smooth'});}
function nxShowCard(s){
  var p=POSTER[s.id]||'',tid=ids(fld(s,'극단'))[0],title=fld(s,'공연명')||'';
  var sub=[tid&&nm(tid),nxYear(fld(s,'공연 날짜'))].filter(Boolean).join(' · ');
  return '<div class="nx-card" data-action="show" data-id="'+s.id+'" style="--tone:'+nxTone(s.id)+'">'
    +(p?'<img src="'+escHtml(p)+'" alt="" loading="lazy">':'<div class="nx-card-type">'+phCover('show',title,sub)+'</div>')
    +'<div class="nx-card-cap"><b>'+escHtml(title)+'</b>'+(sub?'<span>'+escHtml(sub)+'</span>':'')+'</div></div>';
}
function nxPersonCard(p,n){
  var ph=PERSON_PHOTO[p.id]||'',name=fld(p,'이름')||'';
  return '<div class="nx-card nx-person" data-action="person" data-id="'+p.id+'" style="--tone:'+nxTone(p.id)+'">'
    +(ph?'<img src="'+escHtml(ph)+'" alt="" loading="lazy">':'<div class="nx-card-type">'+phCover('person',name,'공연 '+n+'편')+'</div>')
    +'<div class="nx-card-cap"><b>'+escHtml(name)+'</b><span>공연 '+n+'편</span></div></div>';
}
function nxTextCard(action,id,name,sub,img){
  return '<div class="nx-card" data-action="'+action+'" data-id="'+id+'" style="--tone:'+nxTone(id)+'">'
    +(img?'<img src="'+escHtml(img)+'" alt="" loading="lazy">':'<div class="nx-card-type">'+phCover(action,name,sub)+'</div>')
    +'<div class="nx-card-cap"><b>'+escHtml(name||'')+'</b>'+(sub?'<span>'+escHtml(sub)+'</span>':'')+'</div></div>';
}
/* 여러 단체가 올린 작품: 라이선스와 상관없는 집계(숫자만). "몇몇"(작은 숫자라 가린 것)은 순서로 짐작되지 않게 뺀다 */
async function loadNxWorks(){
  await loadWorkStats();
  var el=$('nx-works');if(!el||!WORK_STATS)return;
  var rows=DB.works.filter(function(w){var st=WORK_STATS[w.id];return st&&!st.few&&(st.show_count||st.wish_count);})
    .sort(function(a,b){var x=WORK_STATS[a.id],y=WORK_STATS[b.id];return (y.troupe_count-x.troupe_count)||(y.show_count-x.show_count)||(y.wish_count-x.wish_count);}).slice(0,16);
  el.outerHTML=nxRow('여러 단체가 올린 작품','goWorks()',rows.map(function(w){
    var st=WORK_STATS[w.id];
    return nxTextCard('work',w.id,fld(w,'작품명'),[st.troupe_count?'단체 '+st.troupe_count+'곳':'',st.show_count?st.show_count+'번 올라감':'',st.wish_count?st.wish_count+'명이 올리고 싶어해요':''].filter(Boolean).join(' · '),iurl(fld(w,'사진')));
  }),'다음 공연 작품을 고를 때 참고해 보세요.');
  nxArrows();
}

/* ══ 알림 (위 막대 종): 답을 기다리는 제안 + 최근 2주 안에 답이 온 내 지원 ══ */
var _bell={offers:[],decided:[]};
async function loadBell(){
  if(!CURRENT_USER)return;
  window._bellLoaded=true;
  var res=await Promise.all([sbClient.rpc('my_offers'),sbClient.rpc('my_join_requests')]);
  _bell.offers=res[0].error?[]:(res[0].data||[]);
  var since=Date.now()-14*86400000;
  _bell.decided=(res[1].error?[]:(res[1].data||[])).filter(function(r){return r.status!=='pending'&&r.reviewed_at&&new Date(r.reviewed_at).getTime()>since;});
  var n=_bell.offers.length;
  [['bell-n',n+_bell.decided.length],['rail-offers-n',n]].forEach(function(x){var b=$(x[0]);if(!b)return;b.hidden=!x[1];b.textContent=x[1]>9?'9+':x[1];});
}
function toggleBell(e){
  e.stopPropagation();
  var dd=$('bell-dd');if(!dd)return;
  if(dd.classList.contains('open')){dd.classList.remove('open');return;}
  if(!CURRENT_USER){loginWithGoogle();return;}
  var items=_bell.offers.map(function(o){return '<button type="button" class="bell-item" onclick="closeBell();goOffers()"><b>'+escHtml((o.inviter_nickname?o.inviter_nickname+'님이 ':'')+(o.position_label||'함께')+' 자리로 제안했어요')+'</b><span>'+escHtml(o.project_title||'')+' · 답하기</span></button>';})
    .concat(_bell.decided.map(function(r){return '<button type="button" class="bell-item" onclick="closeBell();goMyPageTab(\'apply\')"><b>'+escHtml((r.project_title||'프로젝트')+(r.status==='approved'?'에 합류했어요':' 지원 결과가 나왔어요'))+'</b><span>'+escHtml(r.position_label||'')+'</span></button>';}));
  dd.innerHTML='<div class="bell-h">알림</div>'+(items.length?items.join(''):'<div class="bell-empty">새 알림이 없어요</div>');
  dd.classList.add('open');
}
function closeBell(){var dd=$('bell-dd');if(dd)dd.classList.remove('open');}
document.addEventListener('click',function(e){var w=e.target.closest&&e.target.closest('.bell-wrap');if(!w)closeBell();});

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
  renderOffers();loadBell();
  if(accept){
    loadMyProjectsCache();
    oriAlert('「'+(o.project_title||'프로젝트')+'」에 합류했어요',{action:{label:'프로젝트 열기',fn:function(){goProject(o.project_id);}}});
  }else oriAlert('제안을 거절했어요');
}

/* ══ 갈래별 줄 (10/14): 작품·공연·사람·단체·극장·배역 목록 맨 위에도 홈처럼 가로 줄 몇 개 → 그 아래 전체 목록(필터) ══
   숫자는 화면에 보이는 공개 공연(DB.shows)만으로 센다 */
var _catRowsCache={};
function nxStats(){
  var key=DB.shows.length+':'+DB.history.length+':'+DB.people.length;  // 로그인 뒤 다시 불러오면 새로 센다
  if(window._nxStats&&window._nxStatsKey===key)return window._nxStats;
  window._nxStatsKey=key;_catRowsCache={};
  var st={showsOf:{},castOf:{},actOf:{},staffOf:{},pShows:{},roleN:{},wTroupes:{},tShows:{},vShows:{},lastOf:{}};
  var shows=sortShows(DB.shows.filter(function(s){return fld(s,'공연명');}));
  shows.forEach(function(s,i){
    var w=ids(fld(s,'작품'))[0],t=ids(fld(s,'극단'))[0],v=ids(fld(s,'극장'))[0];
    if(w){(st.showsOf[w]=st.showsOf[w]||[]).push(s);if(t)(st.wTroupes[w]=st.wTroupes[w]||{})[t]=1;}
    if(t)(st.tShows[t]=st.tShows[t]||[]).push(s);
    if(v)(st.vShows[v]=st.vShows[v]||[]).push(s);
  });
  DB.history.forEach(function(h){
    var p=ids(fld(h,'참여자'))[0],s=ids(fld(h,'공연'))[0];if(!p||!s)return;
    (st.castOf[s]=st.castOf[s]||{})[p]=1;(st.pShows[p]=st.pShows[p]||{})[s]=1;
    if(fld(h,'역할 타입')==='배우'){(st.actOf[p]=st.actOf[p]||{})[s]=1;ids(fld(h,'배역')).forEach(function(r){(st.roleN[r]=st.roleN[r]||{})[p]=1;});}
    if(fld(h,'역할 타입')==='스텝')(st.staffOf[p]=st.staffOf[p]||{})[s]=1;
  });
  st.shows=shows;
  window._nxStats=st;return st;
}
function nKeys(o){return o?Object.keys(o).length:0;}
function topBy(list,score,min){return list.filter(function(x){return score(x)>=(min||1);}).sort(function(a,b){return score(b)-score(a);}).slice(0,16);}
function catRows(v){
  var st=nxStats();
  if(_catRowsCache[v]!==undefined)return _catRowsCache[v];
  var yr=String(new Date().getFullYear()),h='';
  var row=function(title,cards,sub){return cards.length>=3?nxRow(title,'',cards,sub):'';};
  var showCard=function(s){return nxShowCard(s);};
  if(v==='shows'){
    h+=row('최근 무대에 오른 공연',st.shows.slice(0,16).map(showCard));
    h+=row(yr+'년에 오른 공연',st.shows.filter(function(s){return String(fld(s,'공연 날짜')||'').slice(0,4)===yr;}).slice(0,16).map(showCard));
    h+=row('많은 사람이 함께한 공연',topBy(st.shows,function(s){return nKeys(st.castOf[s.id]);},2).map(showCard));
  }else if(v==='works'){
    var wcard=function(w,sub){return nxTextCard('work',w.id,fld(w,'작품명'),sub,iurl(fld(w,'사진')));};
    h+=row('여러 단체가 올린 작품',topBy(DB.works,function(w){return nKeys(st.wTroupes[w.id]);},2).map(function(w){return wcard(w,'단체 '+nKeys(st.wTroupes[w.id])+'곳 · '+st.showsOf[w.id].length+'번 올라감');}),'다음 공연 작품을 고를 때 참고해 보세요.');
    var seen={},recent=[];st.shows.forEach(function(s){var w=ids(fld(s,'작품'))[0];if(w&&!seen[w]){seen[w]=1;var ww=DB.works.find(function(x){return x.id===w;});if(ww)recent.push(ww);}});
    h+=row('최근 무대에 오른 작품',recent.slice(0,16).map(function(w){var s=st.showsOf[w.id][0];return wcard(w,[nm(ids(fld(s,'극단'))[0]),String(fld(s,'공연 날짜')||'').slice(0,4)].filter(Boolean).join(' · '));}));
    var rc={};DB.roles.forEach(function(r){var w=ids(fld(r,'작품'))[0];if(w)rc[w]=(rc[w]||0)+1;});
    h+=row('배역이 많은 작품',topBy(DB.works,function(w){return rc[w.id]||0;},8).map(function(w){return wcard(w,'배역 '+rc[w.id]+'명');}),'출연진이 많은 단체에 맞는 작품이에요.');
  }else if(v==='people'){
    var pc=function(p,o){return nxPersonCard(p,nKeys(o[p.id]));};
    h+=row('무대에 많이 선 사람',topBy(DB.people,function(p){return nKeys(st.pShows[p.id]);},2).map(function(p){return pc(p,st.pShows);}));
    h+=row('배우로 많이 선 사람',topBy(DB.people,function(p){return nKeys(st.actOf[p.id]);},2).map(function(p){return pc(p,st.actOf);}));
    h+=row('스태프로 많이 함께한 사람',topBy(DB.people,function(p){return nKeys(st.staffOf[p.id]);},2).map(function(p){return pc(p,st.staffOf);}));
  }else if(v==='troupes'){
    var tc=function(t){var ss=st.tShows[t.id]||[];return nxTextCard('troupe',t.id,fld(t,'극단명'),'공연 '+ss.length+'편',iurl(fld(t,'사진')));};
    h+=row('자주 무대에 오르는 단체',topBy(DB.troupes,function(t){return (st.tShows[t.id]||[]).length;},1).map(tc));
    h+=row('최근 공연한 단체',DB.troupes.filter(function(t){return st.tShows[t.id];}).sort(function(a,b){return String(fld(st.tShows[b.id][0],'공연 날짜')||'').localeCompare(String(fld(st.tShows[a.id][0],'공연 날짜')||''));}).slice(0,16).map(tc));
  }else if(v==='venues'){
    var vc=function(x){var ss=st.vShows[x.id]||[],seats=fld(x,'좌석수');return nxTextCard('venue',x.id,fld(x,'극장명'),'공연 '+ss.length+'편'+(seats?' · '+seats+'석':''),iurl(fld(x,'사진')));};
    h+=row('자주 쓰인 극장',topBy(DB.venues,function(x){return (st.vShows[x.id]||[]).length;},1).map(vc));
    h+=row('최근 공연이 열린 극장',DB.venues.filter(function(x){return st.vShows[x.id];}).sort(function(a,b){return String(fld(st.vShows[b.id][0],'공연 날짜')||'').localeCompare(String(fld(st.vShows[a.id][0],'공연 날짜')||''));}).slice(0,16).map(vc));
  }else if(v==='roles'){
    h+=row('많이 연기된 배역',topBy(DB.roles,function(r){return nKeys(st.roleN[r.id]);},2).map(function(r){var w=ids(fld(r,'작품'))[0];return nxTextCard('role',r.id,fld(r,'배역명'),[w&&'〈'+nm(w)+'〉',nKeys(st.roleN[r.id])+'명이 연기'].filter(Boolean).join(' · '),iurl(fld(r,'사진')));}));
  }
  _catRowsCache[v]=h?'<div class="cat-rows">'+h+'<h2 class="cat-all">전체 목록</h2></div>':'';
  return _catRowsCache[v];
}
/* mn()이 목록 화면을 그릴 때 맨 위에 붙인다 (core.js mn → catRowsHook) */
function catRowsHook(el){
  var root=el.firstElementChild;if(!root||!root.classList.contains('tab-index'))return;
  var v=window._navV;if(['shows','works','people','troupes','venues','roles'].indexOf(v)<0)return;
  var h=catRows(v);if(!h)return;
  root.insertAdjacentHTML('afterbegin',h);nxArrows();
}

/* ══ 넷플릭스식 호버 미리보기 (10/14): 카드에 커서를 잠깐 두면 커지면서 자세한 정보 ══ */
var _pop={timer:null,card:null,el:null};
function popInfo(action,id){
  var st=nxStats(),r=null,L=[],title='',meta=[],img='';
  var yr=function(s){return String(fld(s,'공연 날짜')||'').slice(0,4);};
  if(action==='show'){r=DB.shows.find(function(x){return x.id===id;});if(!r)return null;title=fld(r,'공연명');img=POSTER[id]||'';
    var w=ids(fld(r,'작품'))[0],t=ids(fld(r,'극단'))[0],v=ids(fld(r,'극장'))[0];
    meta=[yr(r),t&&nm(t),v&&nm(v)];if(w&&nm(w)!==title)L.push('작품 〈'+nm(w)+'〉');
    var n=nKeys(st.castOf[id]);if(n)L.push('출연·스태프 '+n+'명');
    var names=Object.keys(st.castOf[id]||{}).slice(0,4).map(nm).filter(Boolean);if(names.length)L.push(names.join(', ')+(n>4?' 외':''));
  }else if(action==='work'){r=DB.works.find(function(x){return x.id===id;});if(!r)return null;title=fld(r,'작품명');img=iurl(fld(r,'사진'));
    var ss=st.showsOf[id]||[],rc=DB.roles.filter(function(x){return ids(fld(x,'작품')).indexOf(id)>-1;}).length;
    meta=[ss.length?ss.length+'번 올라감':'',nKeys(st.wTroupes[id])?'단체 '+nKeys(st.wTroupes[id])+'곳':'',rc?'배역 '+rc+'명':''];
    var c=fld(r,'국가');if(c)L.push(Array.isArray(c)?c.join(', '):c);
    if(ss[0])L.push('최근: '+[nm(ids(fld(ss[0],'극단'))[0]),yr(ss[0])].filter(Boolean).join(' · '));
  }else if(action==='person'){r=DB.people.find(function(x){return x.id===id;});if(!r)return null;title=fld(r,'이름');img=PERSON_PHOTO[id]||'';
    meta=['공연 '+nKeys(st.pShows[id])+'편',nKeys(st.actOf[id])?'배우 '+nKeys(st.actOf[id]):'',nKeys(st.staffOf[id])?'스태프 '+nKeys(st.staffOf[id]):''];
    var mine=st.shows.filter(function(s){return st.pShows[id]&&st.pShows[id][s.id];});
    if(mine[0])L.push('최근: '+fld(mine[0],'공연명')+(yr(mine[0])?' ('+yr(mine[0])+')':''));
    var tr={};mine.forEach(function(s){var t=ids(fld(s,'극단'))[0];if(t)tr[t]=(tr[t]||0)+1;});var tt=Object.keys(tr).sort(function(a,b){return tr[b]-tr[a];}).slice(0,2).map(nm);if(tt.length)L.push('함께한 단체: '+tt.join(', '));
  }else if(action==='troupe'||action==='venue'){var tb=action==='troupe'?DB.troupes:DB.venues;r=tb.find(function(x){return x.id===id;});if(!r)return null;
    title=fld(r,action==='troupe'?'극단명':'극장명');img=iurl(fld(r,'사진'));var ss2=(action==='troupe'?st.tShows:st.vShows)[id]||[];
    meta=['공연 '+ss2.length+'편',action==='venue'&&fld(r,'좌석수')?fld(r,'좌석수')+'석':'',action==='troupe'?fld(r,'활동지역'):''];
    if(ss2[0])L.push('최근: '+fld(ss2[0],'공연명')+(yr(ss2[0])?' ('+yr(ss2[0])+')':''));
    if(ss2[1])L.push(fld(ss2[1],'공연명')+(yr(ss2[1])?' ('+yr(ss2[1])+')':''));
  }else if(action==='role'){r=DB.roles.find(function(x){return x.id===id;});if(!r)return null;title=fld(r,'배역명');img=iurl(fld(r,'사진'));
    var w2=ids(fld(r,'작품'))[0];meta=[w2&&'〈'+nm(w2)+'〉',fld(r,'성별'),nKeys(st.roleN[id])?nKeys(st.roleN[id])+'명이 연기':''];
  }else return null;
  return {title:title||'',img:img,meta:meta.filter(Boolean),lines:L};
}
function popShow(card){
  var action=card.dataset.action,id=card.dataset.id,info=popInfo(action,id);if(!info)return;
  var media=card.querySelector('img,.result-card-ph,.nx-card-type');var rc=(media||card).getBoundingClientRect();
  var w=Math.max(rc.width*1.55,280),x=rc.left+rc.width/2-w/2;x=Math.max(12,Math.min(x,window.innerWidth-w-12));
  var el=_pop.el;if(!el){el=_pop.el=document.createElement('div');el.id='nx-pop';el.addEventListener('mouseleave',popHide);el.addEventListener('click',function(e){if(e.target.closest('button'))return;openDetail(el.dataset.action,el.dataset.id);popHide();});document.body.appendChild(el);}
  el.dataset.action=action;el.dataset.id=id;
  el.innerHTML='<div class="pop-media">'+(info.img?'<div class="pop-bg" style="background-image:url(\''+String(info.img).replace(/'/g,'%27')+'\')"></div><img src="'+escHtml(info.img)+'" alt="">':'<div class="pop-ph">'+phCover(action,info.title)+'</div>')+'</div>'
    +'<div class="pop-body"><div class="pop-acts"><button type="button" class="pop-go" onclick="openDetail(\''+action+'\',\''+id+'\');popHide()"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4l13 8-13 8z"/></svg>자세히 보기</button>'
    +(typeof favBtnHtml==='function'&&action!=='role'?'<span class="pop-fav">'+favBtnHtml(action,id)+'</span>':'')+'</div>'
    +'<div class="pop-title">'+escHtml(info.title)+'</div>'
    +(info.meta.length?'<div class="pop-meta">'+info.meta.map(escHtml).join('<i>·</i>')+'</div>':'')
    +info.lines.map(function(l){return '<div class="pop-line">'+escHtml(l)+'</div>';}).join('')+'</div>';
  el.style.width=w+'px';el.style.left=x+'px';
  el.classList.remove('on');el.style.top='0px';el.style.visibility='hidden';el.style.display='block';
  var ph=el.offsetHeight,y=rc.top+rc.height/2-ph/2;y=Math.max(70,Math.min(y,window.innerHeight-ph-12));
  el.style.top=y+'px';el.style.transformOrigin=((rc.left+rc.width/2-x)/w*100)+'% '+((rc.top+rc.height/2-y)/ph*100)+'%';
  el.style.visibility='';requestAnimationFrame(function(){el.classList.add('on');});
}
function popHide(){clearTimeout(_pop.timer);_pop.card=null;var el=_pop.el;if(el){el.classList.remove('on');setTimeout(function(){if(!el.classList.contains('on'))el.style.display='none';},180);}}
if(window.matchMedia&&window.matchMedia('(hover:hover) and (pointer:fine)').matches){
  document.addEventListener('mouseover',function(e){
    if(e.target.closest&&e.target.closest('#nx-pop'))return;
    var c=e.target.closest&&e.target.closest('.nx-card[data-action],.result-card[data-action]');
    if(c===_pop.card)return;
    clearTimeout(_pop.timer);
    if(_pop.el&&_pop.el.classList.contains('on')&&!c)return;
    if(!c){_pop.card=null;return;}
    if(PEEK&&PEEK.rendering)return;
    _pop.card=c;
    _pop.timer=setTimeout(function(){if(_pop.card===c&&document.body.contains(c))popShow(c);},550);
  });
  document.addEventListener('mouseout',function(e){var c=e.target.closest&&e.target.closest('.nx-card[data-action],.result-card[data-action]');if(c&&!(e.relatedTarget&&(c.contains(e.relatedTarget)||(e.relatedTarget.closest&&e.relatedTarget.closest('#nx-pop')))))
    {clearTimeout(_pop.timer);if(_pop.card===c)_pop.card=null;if(_pop.el&&_pop.el.classList.contains('on')&&!(e.relatedTarget&&e.relatedTarget.closest&&e.relatedTarget.closest('#nx-pop')))popHide();}});
  window.addEventListener('scroll',function(){if(_pop.el&&_pop.el.classList.contains('on'))popHide();},{passive:true});
  document.addEventListener('scroll',function(e){if(e.target.classList&&e.target.classList.contains('nx-track'))popHide();},true);
}
