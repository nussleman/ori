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
  renderHero();
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
  el.innerHTML=(p?'<div class="nx-hero-bg" style="background-image:url(\''+p.replace(/'/g,'%27')+'\')"></div>':'<div class="nx-hero-bg" style="background:'+nxTone(s.id)+'"></div>')
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
    +'<div class="nx-track-wrap"><button type="button" class="nx-arrow nx-prev" aria-label="앞으로" onclick="nxScroll(\''+id+'\',-1)">‹</button>'
    +'<div class="nx-track" id="'+id+'">'+cards.join('')+'</div>'
    +'<button type="button" class="nx-arrow nx-next" aria-label="뒤로" onclick="nxScroll(\''+id+'\',1)">›</button></div></section>';
}
function nxScroll(id,dir){var t=$(id);if(t)t.scrollBy({left:dir*t.clientWidth*0.9,behavior:'smooth'});}
function nxShowCard(s){
  var p=POSTER[s.id]||'',tid=ids(fld(s,'극단'))[0],title=fld(s,'공연명')||'';
  var sub=[tid&&nm(tid),nxYear(fld(s,'공연 날짜'))].filter(Boolean).join(' · ');
  return '<div class="nx-card" data-action="show" data-id="'+s.id+'" style="--tone:'+nxTone(s.id)+'">'
    +(p?'<img src="'+escHtml(p)+'" alt="" loading="lazy">':'<div class="nx-card-type">'+escHtml(title)+'</div>')
    +'<div class="nx-card-cap"><b>'+escHtml(title)+'</b>'+(sub?'<span>'+escHtml(sub)+'</span>':'')+'</div></div>';
}
function nxPersonCard(p,n){
  var ph=PERSON_PHOTO[p.id]||'',name=fld(p,'이름')||'';
  return '<div class="nx-card nx-person" data-action="person" data-id="'+p.id+'" style="--tone:'+nxTone(p.id)+'">'
    +(ph?'<img src="'+escHtml(ph)+'" alt="" loading="lazy">':'<div class="nx-card-type nx-initial">'+escHtml(name.charAt(0))+'</div>')
    +'<div class="nx-card-cap"><b>'+escHtml(name)+'</b><span>공연 '+n+'편</span></div></div>';
}
function nxTextCard(action,id,name,sub,img){
  return '<div class="nx-card" data-action="'+action+'" data-id="'+id+'" style="--tone:'+nxTone(id)+'">'
    +(img?'<img src="'+escHtml(img)+'" alt="" loading="lazy">':'<div class="nx-card-type">'+escHtml(name||'')+'</div>')
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
