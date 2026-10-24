/* 오리 사이트 — 나에게 온 것·내 것 (10/23): 받은 제안(#offers) · 내 지원 현황(#apply) · 저장한 것(#saved)
   아카이브·기회와 같은 카드 화면. 히어로는 없고, 맨 위 칩 줄이 메뉴(세 화면 오가기)와 거르기를 함께 한다.
   카드는 세로 포스터(2:3) — 같은 작품의 공연 포스터가 있으면 그림, 없으면 빈 표지. */
/* 위 칩 = 이 화면의 거르기만 (화면끼리 오가는 건 왼쪽 레일) */
function mineChips(cur,filters,fcur,fn){
  if(!filters.length)return '';
  return '<div class="pchips" role="toolbar">'+filters.map(function(f){
    return '<button type="button" class="'+(f[0]===fcur?'active':'')+'" onclick="'+fn+'(\''+f[0]+'\')">'+escHtml(f[1])+(f[2]!=null?'<span class="pchips-n">'+f[2]+'</span>':'')+'</button>';
  }).join('')+'</div>';
}
function mineWorkId(name){if(!name)return '';var w=DB.works.find(function(x){return fld(x,'작품명')===name;});return w?w.id:'';}
function mineShell(title,sub,chips,body){
  return '<div class="nx mine-nx"><div class="mine-head"><h1 class="mine-title">'+title+'</h1></div>'+chips+body+'</div>';
}
function mineEmpty(icon,t,btn){return '<div class="result-empty mine-empty"><div class="result-empty-icon">'+ico(icon)+'</div><div class="mine-empty-t">'+t+'</div>'+(btn||'')+'</div>';}
/* 포스터 카드 하나 (자리·제안 공용) */
function minePoster(o){
  return '<div class="nx-card opp-pc'+(o.img?'':' opp-pc-ph')+'"'+(o.go?' role="button" tabindex="0" onclick="'+o.go+'" onkeydown="if(event.key===\'Enter\'){'+o.go+'}"':'')+' style="--tone:'+cardTone(o.id)+'">'
    +(o.img?'<img src="'+escHtml(o.img)+'" alt="" loading="lazy">':'<div class="nx-card-type"><span class="ph-icon">'+ico(o.icon||'mask')+'</span></div>')
    +(o.kind?'<span class="opp-pc-kind'+(o.kindCls?' '+o.kindCls:'')+'">'+escHtml(o.kind)+'</span>':'')
    +'<div class="opp-pc-cap"><b>'+escHtml(o.title)+'</b>'+(o.sub?'<span>'+escHtml(o.sub)+'</span>':'')
    +(o.note?'<span class="mine-note">“'+escHtml(o.note)+'”</span>':'')
    +'<div class="opp-pc-foot"><span class="opp-pc-when">'+escHtml(o.when||'')+'</span>'+(o.btn||'')+'</div>'+(o.btn2||'')+'</div></div>';
}

/* ══ 받은 제안 ══ */
var _offers={rows:[],f:''};
async function goOffers(push){
  if(!CURRENT_USER){loginWithGoogle();return;}
  if(push!==false)history.pushState({view:'offers'},'','#offers');
  setNav('offers');sb('');_sbContext='';mobShowDetail();
  mn(mineShell('받은 제안','',mineChips('goOffers',[],'',''),'<div class="hf-loading">불러오는 중…</div>'));
  var r=await sbClient.rpc('my_offers');
  if(location.hash!=='#offers')return;
  if(r.error){mn(mineShell('받은 제안','',mineChips('goOffers',[],'',''),loadFailHtml('제안')));return;}
  _offers.rows=r.data||[];renderOffers();
}
function offersFilter(f){_offers.f=f;renderOffers();}
function renderOffers(){
  var all=_offers.rows,open=all.filter(function(o){return o.position_open!==false;});
  var rows=_offers.f==='open'?open:_offers.f==='closed'?all.filter(function(o){return o.position_open===false;}):all;
  var chips=mineChips('goOffers',[['','전체',all.length],['open','답할 수 있는',open.length],['closed','이미 채워진',all.length-open.length]].filter(function(f){return !f[0]||f[2];}),_offers.f,'offersFilter');
  var body=!all.length?mineEmpty('mail','아직 온 제안이 없어요','<button class="pf-btn pf-active" onclick="goProjectBrowse()">기회 둘러보기</button>')
    :'<div class="opp-pgrid">'+rows.map(function(o){
      var wid=mineWorkId(o.work_name),closed=o.position_open===false;
      return minePoster({id:o.project_id,img:oppImage(wid),icon:'mail',kind:'제안'+(o.troupe_name?' · '+o.troupe_name:''),kindCls:'mine-k-offer',
        title:o.position_label||'함께해요',sub:[o.project_title||'새 프로젝트',o.inviter_nickname&&o.inviter_nickname+'님'].filter(Boolean).join(' · '),note:o.message,
        when:closed?'자리가 채워졌어요':oppWhen(o.target_start_date,true),
        btn:closed?'<button type="button" class="opp-apply mine-no" onclick="event.stopPropagation();answerOffer(\''+o.id+'\',false)">지우기</button>':'<button type="button" class="opp-apply" onclick="event.stopPropagation();answerOffer(\''+o.id+'\',true)">함께할게요</button>',
        btn2:closed?'':'<button type="button" class="mine-decline" onclick="event.stopPropagation();answerOffer(\''+o.id+'\',false)">이번엔 어려워요</button>',
        go:'goProject(\''+o.project_id+'\')'});
    }).join('')+'</div>';
  mn(mineShell('받은 제안','',chips,body));
}
async function answerOffer(id,accept){
  var o=_offers.rows.find(function(x){return x.id===id;});if(!o)return;
  if(!accept&&o.position_open!==false&&!(await oriConfirm('「'+(o.project_title||'이 프로젝트')+'」의 '+(o.position_label||'제안')+' 제안을 거절할까요?',{ok:'거절하기',cancel:'그대로 두기'})))return;
  try{await sbOk(sbClient.rpc('respond_offer',{p_request_id:id,p_accept:accept}));}
  catch(e){oriAlert('답하지 못했어요: '+e.message);goOffers(false);return;}
  _offers.rows=_offers.rows.filter(function(x){return x.id!==id;});
  renderOffers();loadBell();
  if(accept){
    loadMyProjectsCache();
    oriAlert('「'+(o.project_title||'프로젝트')+'」에 합류했어요',{action:{label:'프로젝트 열기',fn:function(){goProject(o.project_id);}}});
  }else oriAlert('제안을 거절했어요');
}

/* ══ 내 지원 현황 ══ */
var _apply={rows:[],f:'',aud:{}};
var APPLY_LABEL={pending:'답 기다리는 중',approved:'합류했어요',rejected:'이번엔 함께 못 해요'};
async function goMyApply(push){
  if(!CURRENT_USER){loginWithGoogle();return;}
  if(push!==false)history.pushState({view:'apply'},'','#apply');
  window._myPageTab='apply';setNav('apply');sb('');_sbContext='';mobShowDetail();
  mn(mineShell('내 지원 현황','',mineChips('goMyApply',[],'',''),'<div class="hf-loading">불러오는 중…</div>'));
  var res=await Promise.all([sbClient.rpc('my_join_requests'),sbClient.rpc('my_auditions')]),r=res[0];
  _apply.aud={};(res[1].data||[]).forEach(function(a){if(a.join_request_id)_apply.aud[a.join_request_id]=a;});  // 오디션 시간·장소
  if(location.hash!=='#apply')return;
  if(r.error){mn(mineShell('내 지원 현황','',mineChips('goMyApply',[],'',''),loadFailHtml('지원 현황')));return;}
  _apply.rows=r.data||[];renderMyApply();
}
function applyFilter(f){_apply.f=f;renderMyApply();}
function renderMyApply(){
  var all=_apply.rows,cnt=function(s){return all.filter(function(x){return x.status===s;}).length;};
  var rows=_apply.f?all.filter(function(x){return x.status===_apply.f;}):all;
  var chips=mineChips('goMyApply',[['','전체',all.length],['pending','답 기다리는 중',cnt('pending')],['approved','합류',cnt('approved')],['rejected','아쉬움',cnt('rejected')]].filter(function(f){return !f[0]||f[2];}),_apply.f,'applyFilter');
  var md=function(d){return d?new Date(d).toLocaleDateString('ko-KR',{month:'numeric',day:'numeric'}):'';};
  var body=!all.length?mineEmpty('send','아직 지원한 자리가 없어요','<button class="pf-btn pf-active" onclick="goProjectBrowse()">기회 보기</button>')
    :'<div class="opp-pgrid">'+rows.map(function(x){
      return minePoster({id:x.project_id,icon:'send',kind:APPLY_LABEL[x.status]||x.status,kindCls:'mine-k-'+x.status,
        title:x.position_label||'자리',sub:x.project_title||'',
        when:(function(){var a=_apply.aud&&_apply.aud[x.id];if(a&&a.starts_at&&x.status==='pending'){var t=new Date(a.starts_at);return '오디션 '+evDate(t)+' '+evTime(t)+(a.location?' · '+a.location:'');}return md(x.created_at)+' 지원'+(x.reviewed_at?' · '+md(x.reviewed_at)+' 답':'');})(),
        btn:x.status==='approved'?'<span class="opp-st ok">팀으로 ›</span>':'',
        go:'goProject(\''+x.project_id+'\')'});
    }).join('')+'</div>';
  mn(mineShell('내 지원 현황','',chips,body));
}
/* ══ 저장한 것 ══ */
var _saved={f:''};
var SAVED_KIND=[['show','공연'],['work','작품'],['person','사람'],['troupe','단체'],['venue','극장'],['role','배역']];
function goSaved(push){
  if(!CURRENT_USER){loginWithGoogle();return;}
  if(push!==false)history.pushState({view:'saved'},'','#saved');
  window._myPageTab='saved';setNav('saved');sb('');_sbContext='';mobShowDetail();
  renderSaved();
}
function savedFilter(f){_saved.f=f;renderSaved();}
function savedCard(f){
  var t=f.target_type,id=f.target_id,tb={show:DB.shows,work:DB.works,person:DB.people,troupe:DB.troupes,venue:DB.venues,role:DB.roles}[t];
  var r=tb&&tb.find(function(x){return x.id===id;});if(!r)return '';
  var wish=f.list_type==='wishlist',h;
  if(t==='show')h=nxShowCard(r);
  else if(t==='person')h=nxPersonCard(r,nKeys(nxStats().pShows[id]));
  else if(t==='work')h=nxTextCard('work',id,fld(r,'작품명'),[licGenre(r),fld(r,'국가')].filter(Boolean).join(' · '),oppImage(id));
  else if(t==='troupe')h=nxTextCard('troupe',id,fld(r,'극단명'),fld(r,'활동지역')||'',iurl(fld(r,'사진')));
  else if(t==='venue')h=nxTextCard('venue',id,fld(r,'극장명'),fld(r,'좌석수')?fld(r,'좌석수')+'석':'',iurl(fld(r,'사진')));
  else{var w=ids(fld(r,'작품'))[0];h=nxTextCard('role',id,fld(r,'배역명'),w?'〈'+nm(w)+'〉':'',iurl(fld(r,'사진')));}
  return wish?h.replace('class="nx-card','class="nx-card saved-wish'):h;
}
function renderSaved(){
  var all=FAVORITES_LIST.slice(),f=_saved.f;
  var cnt=function(k){return all.filter(function(x){return k==='wish'?x.list_type==='wishlist':x.target_type===k;}).length;};
  var filters=[['','전체',all.length]].concat(SAVED_KIND.map(function(k){return [k[0],k[1],cnt(k[0])];}),[['wish','해보고 싶어요',cnt('wish')]]).filter(function(x){return !x[0]||x[2];});
  var rows=all.filter(function(x){return !f||(f==='wish'?x.list_type==='wishlist':x.target_type===f);});
  var cards=rows.map(savedCard).filter(Boolean);
  var body=!all.length?mineEmpty('bookmark','아직 저장한 게 없어요','<button class="pf-btn pf-active" onclick="goHome()">아카이브 둘러보기</button>')
    :'<div class="opp-pgrid">'+cards.join('')+'</div>';
  mn(mineShell('저장한 것','',mineChips('goSaved',filters,f,'savedFilter'),body));
}
