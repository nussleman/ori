/* 오리 사이트 — 기회 (#projects)
   둘러보기의 두 번째 흐름: "내가 지원할 수 있는 자리·기회를 찾는다".
   생김새는 아카이브 홈과 같은 넷플릭스식 (10/23): 큰 무대(히어로) = 사람을 찾는 공연 → 가로 줄(공연 가까운 자리·배우·제작진·새 자리·모집 중인 프로젝트) → 전체 자리(필터).
   아카이브와 다른 점: 카드에 바로 [지원하기]가 있고 내 지원 상태가 붙는다. 카드를 누르면 프로젝트 공개 화면(모집 중인 자리 목록)으로.
   내가 보낸 지원의 상태는 마이페이지 "지원 현황"(renderMyApplications)에서 본다.
   데이터: list_opportunities() (자리 + 프로젝트 + 내 지원 상태), my_join_requests(), list_public_projects(), my_offers(). */
var _opp={rows:[],projects:[],mine:[],offers:[],f:{type:'',role:''},sort:'new'};
var _oppHero={list:[],i:0,timer:null};

async function goProjectBrowse(push){
  if(push!==false)history.pushState({view:'projects'},'','#projects');
  setNav('projects');sb('');_sbContext='';mobShowDetail();
  if(!CURRENT_USER){mn('<div class="tab-index"><div class="result-empty">로그인이 필요해요</div></div>');return;}
  mn('<div class="nx opp-nx"><section class="nx-hero opp-hero" id="opp-hero"><div class="opp-hero-wait"><div class="hf-loading">불러오는 중…</div></div></section></div>');
  var res=await Promise.all([sbClient.rpc('list_opportunities'),sbClient.rpc('list_public_projects'),sbClient.rpc('my_join_requests'),sbClient.rpc('my_offers')]);
  if(location.hash!=='#projects')return;
  if(res[0].error){mn('<div class="nx opp-nx">'+loadFailHtml('기회')+'</div>');return;}
  _opp.rows=res[0].data||[];_opp.projects=res[1].data||[];_opp.mine=res[2].data||[];_opp.offers=res[3].error?[]:(res[3].data||[]);
  renderOppPage();
}
function oppKind(r){
  if(r.position_type==='actor'){var role=r.role_id&&DB.roles.find(function(x){return x.id===r.role_id;});var g=role&&fld(role,'성별');return '배우'+(g?' · '+g:'');}
  if(r.position_type==='staff')return '제작진'+(r.staff_role_id&&nm(r.staff_role_id)?' · '+nm(r.staff_role_id):'');
  return '함께할 사람';
}
/* 프로젝트 그림: 같은 작품의 공연 포스터(가장 최근) → 작품 사진. 없으면 빈 표지 */
function oppImage(wid){
  if(!wid)return '';
  var ss=sortShows(DB.shows.filter(function(s){return ids(fld(s,'작품')).indexOf(wid)>-1&&POSTER[s.id];}));
  if(ss[0])return POSTER[ss[0].id];
  var w=DB.works.find(function(x){return x.id===wid;});
  return w?iurl(fld(w,'사진'))||'':'';
}
function oppWhen(d,short){
  if(!d)return short?'날짜 미정':'공연 날짜 미정';
  var dd=dashDaysUntil(d);
  return String(d).slice(5,10).replace('-','.')+(short?'':' 공연')+(dd!=null&&dd>=0?' · D-'+dd:'');
}
/* 자리를 프로젝트별로 묶는다 (히어로·프로젝트 줄) */
function oppByProject(rows){
  var m={},order=[];
  (rows||_opp.rows).forEach(function(r){if(!m[r.project_id]){m[r.project_id]={p:r,rows:[]};order.push(r.project_id);}m[r.project_id].rows.push(r);});
  return order.map(function(k){return m[k];});
}
/* 위 칩 (10/23, 아카이브처럼): 거르기(전체·배우·제작진) + 내 지원·받은 제안으로 가는 칩 */
function oppChip(k){_opp.chip=k;_opp.f={type:k,role:''};renderOppPage();}
function renderOppPage(){
  var chip=_opp.chip||'';
  var all=_opp.rows.filter(function(r){return !chip||(chip==='actor'?r.position_type==='actor':r.position_type!=='actor');}),groups=oppByProject(all);
  _oppHero.list=groups.slice().sort(function(a,b){return String(a.p.target_start_date||'9999').localeCompare(String(b.p.target_start_date||'9999'));}).slice(0,5);
  _oppHero.i=0;
  var soon=all.filter(function(r){var d=dashDaysUntil(r.target_start_date);return d!=null&&d>=0;}).sort(function(a,b){return String(a.target_start_date).localeCompare(String(b.target_start_date));});
  var acts=all.filter(function(r){return r.position_type==='actor';}),crew=all.filter(function(r){return r.position_type!=='actor';});
  var recruitingIds={};groups.forEach(function(g){recruitingIds[g.p.project_id]=g.rows.length;});
  var projs=(_opp.projects||[]).filter(function(p){return p.status!=='completed'&&p.status!=='cancelled';});
  var offers=_opp.offers,waiting=_opp.mine.filter(function(r){return r.status==='pending';}).length;
  var nA=_opp.rows.filter(function(r){return r.position_type==='actor';}).length;
  var h='<div class="nx opp-nx">'+pchipsHtml([['','전체',_opp.rows.length],['actor','배우',nA],['crew','제작진·스태프',_opp.rows.length-nA],'|',['goMyApply()','내 지원 현황','link',_opp.mine.length||null],['goOffers()','받은 제안','link',offers.length||null]],chip,'oppChip');
  h+='<section class="nx-hero opp-hero" id="opp-hero" aria-label="사람을 찾는 공연"></section>';
  h+=nxRow('공연이 가까운 자리','',soon.slice(0,16).map(oppCardHtml),'첫 공연이 얼마 안 남은 팀이에요. 빨리 답이 와요.');
  if(!chip){h+=nxRow('배우를 찾아요','',acts.slice(0,16).map(oppCardHtml));
  h+=nxRow('제작진·스태프를 찾아요','',crew.slice(0,16).map(oppCardHtml));}
  if(all.length>3)h+=nxRow('새로 올라온 자리','',all.slice(0,16).map(oppCardHtml));
  if(!chip)h+=nxRow('모집 중인 프로젝트','',projs.slice(0,16).map(function(p){return oppProjectCardHtml(p,recruitingIds[p.id]||0);}),'자리를 누르기 전에 어떤 팀인지 먼저 둘러봐요.');
  h+='<section class="opp-all"><div class="opp-all-head"><h2 class="cat-all">전체 자리</h2>'
    +(_opp.mine.length?'<button type="button" class="opp-mine" onclick="goMyPageTab(\'apply\')">내 지원 <b>'+_opp.mine.length+'</b>건'+(waiting?' · 답을 기다리는 중 <b>'+waiting+'</b>':'')+' ›</button>':'')+'</div>'
    +'<div id="opp-bar"></div><div id="opp-list" class="opp-pgrid"></div></section>';
  mn(h+'</div>');
  renderOppHero();nxArrows();
  clearInterval(_oppHero.timer);
  if(_oppHero.list.length>1)_oppHero.timer=setInterval(function(){if(!$('opp-hero')){clearInterval(_oppHero.timer);return;}if(document.hidden)return;oppHeroGo(_oppHero.i+1);},8000);
  renderOpportunities();
}
/* 큰 무대: 사람을 찾는 공연 하나씩 (공연이 가까운 순) */
function renderOppHero(){
  var el=$('opp-hero');if(!el)return;
  var g=_oppHero.list[_oppHero.i];
  if(!g){
    el.innerHTML='<div class="nx-hero-bg" style="background:#1c1c20"></div><div class="nx-hero-shade"></div><div class="nx-hero-text">'
      +'<div class="nx-hero-kicker">기회</div><h1 class="nx-hero-title">지금은 모집 중인 자리가 없어요</h1>'
      +'<div class="nx-hero-meta">프로젝트에서 빈 배역·제작진 자리를 열면 여기 맨 앞에 걸려요.</div>'
      +'<div class="nx-hero-btns"><button type="button" class="nx-btn nx-btn-main" onclick="goMake()">내 프로젝트에서 자리 열기</button><button type="button" class="nx-btn" onclick="goHome()">아카이브 둘러보기</button></div></div>';
    return;
  }
  var p=g.p,img=oppImage(p.work_id),work=p.work_id?nm(p.work_id):'';
  var nA=g.rows.filter(function(r){return r.position_type==='actor';}).length,nC=g.rows.length-nA;
  var meta=[p.troupe_id&&nm(p.troupe_id),p.venue_id&&nm(p.venue_id),oppWhen(p.target_start_date,true)].filter(Boolean).map(escHtml).join('<i>•</i>');
  var canApply=g.rows.filter(function(r){return !r.my_status;}).length;
  var past=troupePastShows(p.troupe_id);
  el.innerHTML=(img?'<div class="nx-hero-bg" style="background-image:url(\''+img.replace(/'/g,'%27')+'\')"></div>':'<div class="nx-hero-bg" style="background:#1c1c20"></div>')
    +'<div class="nx-hero-shade"></div>'
    +(img?'<img class="nx-hero-poster" src="'+escHtml(img)+'" alt="">':'')
    +'<div class="nx-hero-text">'
    +'<div class="nx-hero-kicker"><span class="opp-live">모집 중</span>'+(work&&work!==p.project_title?'〈'+escHtml(work)+'〉':'')+'</div>'
    +'<h1 class="nx-hero-title">'+escHtml(p.project_title||'새 프로젝트')+'</h1>'
    +'<div class="nx-hero-meta">'+meta+'</div>'
    +'<div class="opp-hero-seats">'+g.rows.slice(0,5).map(function(r){return '<span class="opp-seat'+(r.my_status?' mine':'')+'">'+escHtml(r.position_label||'자리')+(r.my_status?' · '+(r.my_status==='pending'?'지원함':r.my_status==='approved'?'합류':'이번엔 어려움'):'')+'</span>';}).join('')
    +(g.rows.length>5?'<span class="opp-seat more">+'+(g.rows.length-5)+'</span>':'')+'</div>'
    +'<div class="opp-hero-sub">'+escHtml(['찾는 자리 '+g.rows.length+'개',nA?'배우 '+nA:'',nC?'제작진 '+nC:'',past.length?nm(p.troupe_id)+' 지난 공연 '+past.length+'편':''].filter(Boolean).join(' · '))+'</div>'
    +'<div class="nx-hero-btns">'
    +(canApply?'<button type="button" class="nx-btn nx-btn-main" onclick="oppHeroApply()"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>지원하기</button>':'<span class="nx-btn opp-done">모든 자리에 지원했어요</span>')
    +'<button type="button" class="nx-btn" onclick="goProject(\''+p.project_id+'\')">프로젝트 보기</button></div></div>'
    +(_oppHero.list.length>1?'<div class="nx-dots">'+_oppHero.list.map(function(x,i){return '<button type="button" aria-label="'+(i+1)+'번째 공연" class="'+(i===_oppHero.i?'on':'')+'" onclick="oppHeroGo('+i+',true)"></button>';}).join('')+'</div>':'');
}
function oppHeroGo(i,user){var n=_oppHero.list.length;if(!n)return;_oppHero.i=(i+n)%n;renderOppHero();if(user)clearInterval(_oppHero.timer);}
/* 히어로 [지원하기]: 자리가 하나면 바로, 여럿이면 고르게 */
async function oppHeroApply(){
  var g=_oppHero.list[_oppHero.i];if(!g)return;
  clearInterval(_oppHero.timer);
  var free=g.rows.filter(function(r){return !r.my_status;});if(!free.length)return;
  var posId=free.length===1?free[0].position_id:await pickOne('어느 자리에 지원할까요?',free.map(function(r){return{value:r.position_id,label:r.position_label||'자리',sub:oppKind(r)};}));
  if(posId)requestJoinPosition(g.p.project_id,posId);
}
function renderOpportunities(){
  var all=_opp.rows,f=_opp.f;
  var staffSet={};all.forEach(function(r){if(r.position_type==='staff'&&r.staff_role_id&&nm(r.staff_role_id))staffSet[r.staff_role_id]=nm(r.staff_role_id);});
  var rows=all.filter(function(r){
    if(f.type==='actor'&&r.position_type!=='actor')return false;
    if(f.type==='crew'&&r.position_type==='actor')return false;
    if(f.role&&r.staff_role_id!==f.role)return false;
    return true;
  });
  if(_opp.sort==='soon')rows=rows.slice().sort(function(a,b){return String(a.target_start_date||'9999').localeCompare(String(b.target_start_date||'9999'));});
  var bar=$('opp-bar');
  if(bar)bar.innerHTML=all.length?filterBar('opp',[
    {key:'type',label:'자리',type:'single',value:f.type,options:[{v:'actor',l:'배우',n:all.filter(function(r){return r.position_type==='actor';}).length},{v:'crew',l:'제작진·스태프',n:all.filter(function(r){return r.position_type!=='actor';}).length}]},
    {key:'role',label:'분야',type:'single',value:f.role,options:f.type==='actor'?[]:Object.keys(staffSet).map(function(k){return{v:k,l:staffSet[k]};})}
  ],{
    count:'<em>'+rows.length+'</em>개 자리',
    sort:{value:_opp.sort,options:[{v:'new',l:'최근 올라온 순'},{v:'soon',l:'공연 가까운 순'}],onChange:function(v){_opp.sort=v;renderOpportunities();}},
    onChange:function(k,v){_opp.f[k]=v;if(k==='type'&&v==='actor')_opp.f.role='';renderOpportunities();},
    onReset:function(){_opp.f={type:'',role:''};renderOpportunities();}
  }):'';
  var el=$('opp-list');if(!el)return;
  if(!rows.length){el.innerHTML='<div class="result-empty"><div class="result-empty-icon">'+ico('megaphone')+'</div>'+(all.length?'조건에 맞는 자리가 없어요. <button type="button" class="dv-all" onclick="_opp.f={type:\'\',role:\'\'};renderOpportunities()">필터 지우기</button>':'지금은 모집 중인 자리가 없어요.<br><span style="font-size:0.8rem;color:var(--muted)">새 자리가 올라오면 여기에 보여요.</span>')+'</div>';}
  else el.innerHTML=rows.map(oppCardHtml).join('');
}
/* 단체의 지난 공연(공개 공연): 모집 공고를 볼 때 "이 단체는 어떤 공연을 해왔나"를 같이 보여준다 */
function troupePastShows(tid){
  if(!tid)return [];
  return sortShows(DB.shows.filter(function(s){return ids(fld(s,'극단')).indexOf(tid)>-1;}));
}
function troupeTrackLine(tid){
  var ps=troupePastShows(tid);if(!ps.length)return '';
  return '<div class="opp-track">지난 공연 '+ps.length+'편 · 최근 〈'+escHtml(fld(ps[0],'공연명')||'')+'〉</div>';
}
/* 자리 카드: 아카이브와 같은 세로 포스터(2:3). 위엔 자리 종류, 아래엔 자리 이름·프로젝트·날짜와 [지원하기] */
function oppCardHtml(r){
  var img=oppImage(r.work_id),st=r.my_status;
  var btn=st==='pending'?'<span class="opp-st">지원함</span>'
    :st==='approved'?'<span class="opp-st ok">합류했어요</span>'
    :st==='rejected'?'<span class="opp-st">이번엔 함께 못 해요</span>'
    :'<button type="button" class="opp-apply" onclick="event.stopPropagation();requestJoinPosition(\''+r.project_id+'\',\''+r.position_id+'\')">지원하기</button>';
  var sub=[r.project_title||'새 프로젝트',r.troupe_id&&nm(r.troupe_id)].filter(Boolean).join(' · ');
  return '<div class="nx-card opp-pc'+(img?'':' opp-pc-ph')+'" role="button" tabindex="0" onclick="goProject(\''+r.project_id+'\')" onkeydown="if(event.key===\'Enter\')goProject(\''+r.project_id+'\')" style="--tone:'+cardTone(r.project_id)+'">'
    +(img?'<img src="'+escHtml(img)+'" alt="" loading="lazy">':'<div class="nx-card-type"><span class="ph-icon">'+ico(r.position_type==='actor'?'mask':'clapper')+'</span></div>')
    +'<span class="opp-pc-kind">'+escHtml(oppKind(r))+'</span>'
    +'<div class="opp-pc-cap"><b>'+escHtml(r.position_label||'자리')+'</b><span>'+escHtml(sub)+'</span>'
    +'<div class="opp-pc-foot"><span class="opp-pc-when">'+escHtml(oppWhen(r.target_start_date,true))+'</span>'+btn+'</div></div></div>';
}
function oppProjectCardHtml(p,n){
  var g=_opp.rows.find(function(r){return r.project_id===p.id;}),img=g?oppImage(g.work_id):'';
  var sub=[p.troupe_name,n?'자리 '+n+'개':PROJECT_STATUS_LABEL[p.status]].filter(Boolean).join(' · ');
  return '<div class="nx-card opp-pc'+(img?'':' opp-pc-ph')+'" role="button" tabindex="0" onclick="goProject(\''+p.id+'\')" onkeydown="if(event.key===\'Enter\')goProject(\''+p.id+'\')" style="--tone:'+cardTone(p.id)+'">'
    +(img?'<img src="'+escHtml(img)+'" alt="" loading="lazy">':'<div class="nx-card-type"><span class="ph-icon">'+ico('stage')+'</span></div>')
    +(n?'<span class="opp-pc-kind">모집 중</span>':'')
    +'<div class="opp-pc-cap"><b>'+escHtml(p.title||'새 프로젝트')+'</b><span>'+escHtml(p.work_name||'작품 미정')+'</span>'
    +'<div class="opp-pc-foot"><span class="opp-pc-when">'+escHtml(sub)+'</span></div></div></div>';
}
async function requestJoinPosition(projectId,positionId){
  if(!CURRENT_USER){loginWithGoogle();return;}
  await ensureMakerEntry();
  var msg=await oriPrompt('지원 메시지 (선택)\n간단한 소개나 경험, 가능한 연습 요일을 적어주면 좋아요.','');
  if(msg===null)return;
  var r=await sbClient.from('project_join_requests').insert({project_id:projectId,position_id:positionId,user_id:CURRENT_USER.id,message:msg||null});
  if(r.error){oriAlert(r.error.code==='23505'?'이미 지원한 자리예요.':'지원하지 못했어요: '+r.error.message);return;}
  var row=_opp.rows.find(function(x){return x.position_id===positionId;});if(row)row.my_status='pending';
  _opp.mine.push({status:'pending'});
  if(location.hash==='#projects')renderOppPage();
  if($('pub-open-pos'))loadPublicOpenPositions(projectId);
  oriAlert('지원했어요! 프로젝트에서 답하면 마이페이지 "지원 현황"에서 볼 수 있어요.',{action:{label:'지원 현황 보기',fn:function(){goMyPageTab('apply');}}});
}

/* 마이페이지 "지원 현황" */
async function renderMyApplications(el){
  el.innerHTML='<div class="hf-loading">불러오는 중…</div>';
  var r=await sbClient.rpc('my_join_requests');
  if(r.error){el.innerHTML=loadFailHtml('지원 현황');return;}
  var rows=r.data||[];
  if(!rows.length){el.innerHTML='<div class="result-empty"><div class="result-empty-icon">'+ico('send')+'</div><div style="font-size:0.95rem;margin-bottom:0.4rem">아직 지원한 자리가 없어요</div><div style="font-size:0.8rem;color:var(--muted);margin-bottom:1rem">기회에서 함께할 공연을 찾아보세요.</div><button class="pf-btn pf-active" onclick="goProjectBrowse()">기회 보기</button></div>';return;}
  var label={pending:'답 기다리는 중',approved:'합류했어요',rejected:'이번엔 함께하지 못해요'};
  el.innerHTML='<div class="apply-list">'+rows.map(function(x){
    return '<div class="apply-row" onclick="goProject(\''+x.project_id+'\')"><div><div class="apply-t">'+escHtml(x.position_label||'자리')+' <span class="apply-p">· '+escHtml(x.project_title||'')+'</span></div>'
      +'<div class="apply-d">'+new Date(x.created_at).toLocaleDateString('ko-KR')+' 지원'+(x.reviewed_at?' · '+new Date(x.reviewed_at).toLocaleDateString('ko-KR')+' 답변':'')+'</div></div>'
      +'<span class="apply-st st-'+x.status+'">'+(label[x.status]||x.status)+'</span></div>';
  }).join('')+'</div>'
  +(rows.some(function(x){return x.status==='approved';})?'<p class="opp-sub" style="margin-top:1rem">합류한 프로젝트는 프로필 메뉴의 "만들기 모드"에서 함께 준비해요.</p>':'');
}

/* 프로젝트 공개 화면의 "모집 중인 자리": 기회 카드를 눌러 들어온 사람이 그 자리에서 지원한다 */
async function loadPublicOpenPositions(pid){
  var el=$('pub-open-pos');if(!el)return;
  var r=await sbClient.rpc('list_opportunities');
  if(!$('pub-open-pos'))return;
  if(r.error){el.innerHTML=loadFailHtml('모집 중인 자리');return;}
  var rows=(r.data||[]).filter(function(x){return x.project_id===pid;});
  if(!rows.length){el.innerHTML='';return;}
  el.innerHTML=dvSection('모집 중인 자리',rows.length)+'<div class="pub-pos">'+rows.map(function(x){
    var st=x.my_status;
    var btn=st==='pending'?'<span class="opp-st">지원함 · 답 기다리는 중</span>':st==='approved'?'<span class="opp-st ok">합류했어요</span>':st==='rejected'?'<span class="opp-st">이번엔 함께 못 해요</span>'
      :'<button type="button" class="opp-apply" onclick="requestJoinPosition(\''+pid+'\',\''+x.position_id+'\')">지원하기</button>';
    return '<div class="pub-pos-row"><div><div class="pub-pos-t">'+escHtml(x.position_label||'자리')+'</div><div class="pub-pos-s">'+escHtml(oppKind(x))+'</div></div>'+btn+'</div>';
  }).join('')+'</div>';
}
