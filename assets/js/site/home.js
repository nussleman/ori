/* 오리 사이트 — 첫 화면 (10/14: "내 연습실에 왔다")
   밤 11시 연습 끝난 연출이 열었을 때 3초 안에: 정면엔 내 공연(화이트보드, 유일하게 불이 켜진 곳),
   옆 벽엔 다른 단체·사람이 남긴 쪽지 몇 장(제안·열린 자리), 구석엔 손 닿는 작품 서가(검색 + 요즘 찾는 작품).
   숫자보다 이름, 상태보다 사람. 한 화면 안에. 관객용 기능은 키우지 않는다 (direction.md) */
function goHome(push){
  if(push!==false)history.pushState({view:'home'},'','#home');
  setNav('home');sb('');_sbContext='';  renderHome();
}
function renderHome(){
  // mn()이 #mn을 통째로 갈아치우므로, 검색창(#gs-wrap)을 먼저 붙잡아 두었다가 서가 안에 다시 넣는다
  var wrap=$('gs-wrap');
  mn('<div class="rr">'
    +'<header class="rr-brand"><svg class="logo-mark" aria-hidden="true"><use href="#duck-logo"></use></svg><b>오리</b><span>연극·뮤지컬을 만드는 사람들</span></header>'
    +'<div class="rr-room">'
    +'<section class="rr-board" id="rr-board" aria-label="내 공연"></section>'
    +'<div class="rr-side">'
    +'<section class="rr-wall" aria-label="쪽지"><div class="rr-label">함께하자는 쪽지</div><div class="rr-notes" id="rr-notes"><div class="rr-quiet">&nbsp;</div></div>'
    +'<button type="button" class="rr-more" onclick="goProjectBrowse()">사람을 찾는 자리 모두 보기 ›</button></section>'
    +'<section class="rr-shelf" aria-label="작품 서가"><div class="rr-label">작품 서가</div><div id="rr-search"></div><div class="rr-books" id="rr-books"></div>'
    +'<div class="rr-jump"><button type="button" onclick="goWorks()">작품</button><button type="button" onclick="goShows()">공연</button><button type="button" onclick="goPeople()">사람</button><button type="button" onclick="goTroupes()">단체</button><button type="button" onclick="goVenues()">극장</button></div></section>'
    +'</div></div></div>');
  var slot=$('rr-search');
  if(wrap&&slot)slot.appendChild(wrap);
  var gi=$('gs-input');if(gi)gi.placeholder='작품, 사람, 극장 이름으로 찾기';
  renderBoard();
  if(CURRENT_USER)loadMyProjectsCache().then(renderBoard);
  loadNotes();
  loadBooks();
}
function homeActive(){
  // 막이 가장 먼저 오르는 공연이 화이트보드의 주인공 (날짜 없는 건 뒤로)
  return (MY_PROJECTS_CACHE||[]).filter(function(p){return PROJECT_ACTIVE_STATUS.indexOf(p.status||'planning')>-1;})
    .sort(function(a,b){var x=a.target_start_date||'9999',y=b.target_start_date||'9999';return x<y?-1:x>y?1:0;});
}
/* 화이트보드에 적힌 다음 할 일 — 프로젝트에 아직 비어 있는 것부터 */
function boardNextStep(p){
  if(!p.work_name)return '올릴 작품 정하기';
  if(!p.target_start_date)return '공연 날짜 정하기';
  if(!p.venue_name)return '극장 정하기';
  return '계기판에서 오늘 할 일 보기';
}
function boardDday(p){
  var dd=projectDday(p.target_start_date,p.target_end_date,p.status||'planning');
  if(dd.cls==='tbd')return{big:'날짜 미정',small:'',cls:'tbd'};
  return dd;
}
function renderBoard(){
  var el=$('rr-board');if(!el)return;
  if(!CURRENT_USER){
    el.innerHTML='<div class="rr-label">내 공연</div><div class="rr-board-empty"><div class="rr-board-title">다음 공연, 여기서 준비해요</div>'
      +'<p>작품·사람·극장·일정·예산을 한 장의 보드에 모아요.</p><button type="button" class="rr-start" onclick="loginWithGoogle()">로그인하고 시작하기</button></div>';
    return;
  }
  var a=homeActive();
  if(!a.length){
    el.innerHTML='<div class="rr-label">내 공연</div><div class="rr-board-empty"><div class="rr-board-title">아직 준비 중인 공연이 없어요</div>'
      +'<p>올릴 작품이 정해지지 않아도 괜찮아요. 보드부터 세우고 하나씩 채워요.</p>'
      +'<button type="button" class="rr-start" onclick="startNewProject()">다음 공연 준비 시작하기</button>'
      +'<button type="button" class="rr-link" onclick="goWorks()">올릴 작품부터 둘러보기 ›</button></div>';
    return;
  }
  var p=a[0],dd=boardDday(p),rest=a.slice(1,3);
  var meta=[p.work_name&&(p.title||'').indexOf(p.work_name)<0&&'〈'+p.work_name+'〉',p.troupe_name,p.venue_name].filter(Boolean).map(escHtml).join(' · ');
  el.innerHTML='<div class="rr-label">내 공연</div>'
    +'<button type="button" class="rr-main" onclick="goProject(\''+p.id+'\')">'
    +'<span class="rr-dday rr-dday-'+dd.cls+'">'+escHtml(dd.big)+'</span>'
    +(dd.small?'<span class="rr-ddate">'+escHtml(dd.small)+'</span>':'')
    +'<span class="rr-title">'+escHtml(p.title||'새 프로젝트')+'</span>'
    +'<span class="rr-meta">'+(meta||'작품·단체 미정')+'</span>'
    +'<span class="rr-next"><span>다음 할 일</span>'+escHtml(boardNextStep(p))+' →</span></button>'
    +'<div class="rr-board-foot">'
    +rest.map(function(q){var d=boardDday(q);return '<button type="button" class="rr-chip" onclick="goProject(\''+q.id+'\')">'+escHtml(q.title||'새 프로젝트')+'<em>'+escHtml(d.big)+'</em></button>';}).join('')
    +(a.length>3?'<button type="button" class="rr-chip" onclick="goMake()">외 '+(a.length-3)+'개 ›</button>':'')
    +'<button type="button" class="rr-chip rr-chip-new" onclick="startNewProject()">＋ 다음 공연 준비</button></div>';
}
/* 쪽지: 나한테 온 제안이 먼저, 그다음 사람을 찾는 자리 — 합쳐서 세 장까지 */
async function loadNotes(){
  var el=$('rr-notes');if(!el)return;
  if(!CURRENT_USER){el.innerHTML='<div class="rr-quiet">로그인하면 다른 단체가 남긴 쪽지가 보여요</div>';return;}
  var res=await Promise.all([sbClient.rpc('my_offers'),sbClient.rpc('list_opportunities')]);
  el=$('rr-notes');if(!el)return;
  var offers=res[0].error?[]:(res[0].data||[]),opps=res[1].error?[]:(res[1].data||[]);
  if(!res[1].error)_opp.rows=opps;
  var open=opps.filter(function(r){return !r.my_status;});
  var notes=offers.slice(0,2).map(function(o){
    var who=o.inviter_nickname?o.inviter_nickname+'님이':o.troupe_name?o.troupe_name+'에서':'누군가';
    return '<button type="button" class="rr-note rr-note-offer" onclick="goOffers()"><span class="rr-pin"></span>'
      +'<span class="rr-note-main">'+escHtml(who)+' '+escHtml(o.position_label||'함께')+' 자리로 같이 하자고 해요</span>'
      +'<span class="rr-note-sub">'+escHtml([o.project_title,o.work_name&&(o.project_title||'').indexOf(o.work_name)<0?'〈'+o.work_name+'〉':''].filter(Boolean).join(' · '))+' · 답하기 ›</span></button>';
  });
  open.slice(0,3-notes.length).forEach(function(r){
    var who=r.troupe_id?nm(r.troupe_id):'';
    var when=r.target_start_date?String(r.target_start_date).slice(5).replace('-','.')+' 공연':'날짜 미정';
    notes.push('<button type="button" class="rr-note" onclick="goProject(\''+r.project_id+'\')"><span class="rr-pin"></span>'
      +'<span class="rr-note-main">'+escHtml(r.position_label||'자리')+' 구해요</span>'
      +'<span class="rr-note-sub">'+escHtml([r.project_title,who,when].filter(Boolean).join(' · '))+'</span></button>');
  });
  el.innerHTML=notes.length?notes.join(''):'<div class="rr-quiet">지금 벽에 붙은 쪽지가 없어요. 내 공연에서 자리를 열면 여기 붙어요.</div>';
}
/* 서가: 요즘 많이 올라간 작품 세 권 (작은 숫자로 가린 "몇몇"은 순서로 짐작되지 않게 뺀다) */
async function loadBooks(){
  await loadWorkStats();
  var el=$('rr-books');if(!el)return;
  var rows=DB.works.filter(function(w){var st=WORK_STATS&&WORK_STATS[w.id];return st&&!st.few&&st.show_count;})
    .sort(function(a,b){var x=WORK_STATS[a.id],y=WORK_STATS[b.id];return (y.troupe_count-x.troupe_count)||(y.show_count-x.show_count);}).slice(0,3);
  el.innerHTML=rows.map(function(w){
    var st=WORK_STATS[w.id];
    return '<button type="button" class="rr-book" data-action="work" data-id="'+w.id+'"><span class="rr-book-title">'+escHtml(fld(w,'작품명')||'')+'</span>'
      +'<span class="rr-book-sub">'+(st.troupe_count?'단체 '+st.troupe_count+'곳이 올렸어요':st.show_count+'번 올라갔어요')+'</span></button>';
  }).join('');
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
