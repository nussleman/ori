/* 오리 사이트 — 공연 프로젝트 화면: 상자 보드 (10/23)
   탭·머리말 없이, 프로젝트를 이루는 요소를 상자로 한 화면에 모은다 (본문은 스크롤 없이 한 장).
   상자 = 제목 · 핵심 상태(숫자·정해진 것) · 한 줄 설명 · 상태 아이콘(해결·진행 중·시작 전·확인 필요).
   상자를 누르면 그 부분만 열린다(#project-<id>/<상자>). 돌아오기는 왼쪽 위 탐색 경로(project.js projectCrumbHtml).
   상자 안 화면은 예전 탭 렌더러(project.js 배역·제작진·극장·홍보, 일정·예산·소품·계기판 파일)를 그대로 쓴다.
   상태는 제작 계기판(project-dashboard.js)과 같은 판정·마감 기준을 따른다 — 같은 것을 두 곳이 다르게 말하지 않게. */
var PROJECT_STAGES=['기획','팀 꾸리기','공연 준비','공연','마무리'];
var PJB_ST_LABEL={done:'해결',doing:'진행 중',todo:'시작 전',alert:'확인 필요',off:'해당 없음'};
/* 상태 아이콘 = 빛나는 구슬 안의 기호 (CSS .pjb-orb가 입체감을 준다) */
var PJB_ST_ICON={
  done:'<path d="M7.5 12.5l3 3L16.5 9"/>',
  doing:'<path d="M12 7v5l3.2 2"/>',
  todo:'<path d="M8 12h.01M12 12h.01M16 12h.01"/>',
  alert:'<path d="M12 7.5v5M12 16.2v.1"/>',
  off:'<path d="M8.5 12h7"/>'
};
function pjbOrb(st){return '<span class="pjb-orb" title="'+PJB_ST_LABEL[st]+'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+PJB_ST_ICON[st]+'</svg><span class="sr-only">'+PJB_ST_LABEL[st]+'</span></span>';}
var _pjb={data:null};

function projectStageIndex(pr){
  if(pr.status==='completed'||pr.status==='cancelled')return 4;
  if(pr.status==='running')return 3;
  if(pr.status==='upcoming')return 2;
  return (pr.work_id&&pr.target_start_date)?1:0;
}
/* 계기판 불빛 → 상자 상태 */
function pjbFromLight(l){return {green:'done',yellow:'doing',red:'alert',gray:'todo',off:'off'}[l]||'todo';}
function pjbLight(key,D){var a=dashArea(key);return a?dashLight(a,D):{light:'gray',text:''};}
function pjbMd(d){return d?String(d).slice(5,10).replace('-','.'):'';}

/* ── 상자 정의: 순서 = 보드에 놓이는 순서 ──
   view: 상자 안 화면(없으면 go만). go: 상자를 눌렀을 때 화면 대신 할 일(정하기 창 등). show: 보일 사람 */
function projectBoxes(){
  var ctx=window._projectCtx||{},pid=ctx.pid,pr=ctx.pr||{},admin=!!ctx.isAdmin,q='\''+pid+'\'';
  var wiz=function(steps){return 'openProjectWizard('+q+','+JSON.stringify(steps).replace(/"/g,'\'')+')';};
  return [
    {key:'date',title:'공연 날짜',icon:'ticket',go:admin?wiz(['date']):'openProjectBox(\'schedule\')',calc:function(D){
      var dd=projectDday(D.start,pr.target_end_date,pr.status);
      if(!D.start)return{v:'날짜 미정',d:admin?'첫 공연 날짜를 정하면 영역마다 마감을 계산해요':'관리자가 날짜를 정하면 여기에 보여요',st:'todo'};
      var end=pr.target_end_date&&pr.target_end_date>D.start?' · '+pjbMd(pr.target_end_date)+'까지':'';
      return{v:dd.big,d:(dd.small||pjbMd(D.start))+end,st:pr.status==='completed'?'done':dd.cls==='soon'?'alert':'done'};
    }},
    {key:'work',title:'작품·라이선스',icon:'book',go:admin?wiz(['work','license']):(pr.work_id?'openDetail(\'work\','+'\''+pr.work_id+'\')':''),calc:function(D){
      var l=pjbLight('work',D);
      if(!pr.work_id)return{v:'작품 미정',d:'무엇을 올릴지 정하면 배역 자리가 자동으로 생겨요',st:pjbFromLight(l.light)};
      return{v:nm(pr.work_id),d:'라이선스 '+(pr.is_licensed==='완료'?'확보':pr.is_licensed||'미정'),st:pjbFromLight(l.light)};
    }},
    {key:'venue',title:'극장',icon:'pin',view:function(el){renderProjectVenueTab(el);},calc:function(D){
      var l=pjbLight('venue',D);
      if(pr.venue_id){var v=DB.venues.find(function(x){return x.id===pr.venue_id;}),seats=v&&fld(v,'좌석수');return{v:nm(pr.venue_id),d:(seats?seats+'석 · ':'')+'확정',st:'done'};}
      return{v:D.venueCands.length?'후보 '+D.venueCands.length+'곳':'미정',d:D.venueCands.length?'후보를 비교해 하나로 정해요':'조건으로 찾아 후보를 담아요',st:pjbFromLight(l.light)};
    }},
    {key:'troupe',title:'단체',icon:'building',go:admin?wiz(['troupe']):(pr.troupe_id?'openDetail(\'troupe\','+'\''+pr.troupe_id+'\')':''),calc:function(){
      if(!pr.troupe_id)return{v:'미정',d:'함께 올리는 단체를 이어두면 지난 공연이 같이 보여요',st:'todo'};
      var n=troupePastShows(pr.troupe_id).length;
      return{v:nm(pr.troupe_id),d:n?'지난 공연 '+n+'편':'아직 아카이브에 공연이 없어요',st:'done'};
    }},
    {key:'actor',title:'배역',icon:'mask',view:function(el){el.innerHTML='<div id="actor-tab-body"><div class="hf-loading">불러오는 중…</div></div>';loadProjectPositionsData(pid,renderActorTabBody);},calc:function(D){
      var acts=D.positions.filter(function(p){return p.position_type==='actor';}),f=acts.filter(dashFilled).length,l=pjbLight('casting',D);
      if(!acts.length)return{v:'배역 없음',d:pr.work_id?'배역 자리를 만들어요':'작품을 정하면 배역이 생겨요',st:pjbFromLight(l.light)};
      var openN=acts.filter(function(p){return p.status==='open'&&!dashFilled(p);}).length;
      return{v:f+' / '+acts.length+' 확정',d:(acts.length-f?'빈 배역 '+(acts.length-f):'모두 확정')+(openN?' · 모집 중 '+openN:''),st:pjbFromLight(l.light)};
    }},
    {key:'crew',title:'제작진',icon:'clapper',view:function(el){el.innerHTML='<div id="crew-tab-body"><div class="hf-loading">불러오는 중…</div></div>';loadProjectPositionsData(pid,renderCrewTabBody);},calc:function(D){
      var st=D.positions.filter(function(p){return p.position_type!=='actor';}),f=st.filter(dashFilled);
      var areas=DASH_AREAS.filter(function(a){return a[3]==='staff';}).map(function(a){return dashLight(a,D);});
      var red=areas.filter(function(l){return l.light==='red';});
      var names=f.map(function(p){return p.position_label;}).filter(Boolean);
      return{v:f.length?f.length+'명 확정':'아직 없음',d:red.length?red.slice(0,3).map(function(l){return l.label;}).join('·')+' 마감이 가까워요':names.length?names.slice(0,3).join(' · ')+(names.length>3?' 외':''):'연출·음악감독부터 정해요',
        st:red.length?'alert':f.length?'doing':'todo'};
    }},
    {key:'team',title:'팀원',icon:'user',view:function(el){window._teamSubTab='people';el.innerHTML='<div id="team-subtab-body"><div class="hf-loading">불러오는 중…</div></div>';loadProjectPositionsData(pid,renderTeamSubTabBody);},calc:function(D){
      var seen={},adm=0;D.members.forEach(function(m){if(seen[m.member_id])return;seen[m.member_id]=1;if(m.member_role!=='member')adm++;});
      var n=Object.keys(seen).length,me=ctx.myPosition&&ctx.myPosition.position_label;
      return{v:n+'명',d:(me?'내 역할 '+me+' · ':'')+'관리자 '+adm+'명',st:n>1?'done':'todo'};
    }},
    {key:'requests',title:'참여 요청',icon:'mail',show:admin,view:function(el){el.innerHTML='<div id="join-requests-list"><div class="hf-loading">불러오는 중…</div></div>';loadJoinRequests(pid);},calc:function(D){
      var n=D.requests.length;
      return{v:n?n+'건 대기':'없음',d:n?'승인하면 바로 팀에 들어와요':(pr.is_recruiting?'모집 중이에요 · 지원이 오면 여기로':'모집을 켜면 지원을 받을 수 있어요'),st:n?'alert':'off'};
    }},
    {key:'schedule',title:'일정',icon:'calendar',view:function(el){renderProjectSchedule(el);},calc:function(D){
      var now=new Date(),up=D.events.filter(function(e){return e.starts_at&&new Date(e.starts_at)>=now;}).sort(function(a,b){return a.starts_at<b.starts_at?-1:1;});
      var l=pjbLight('rehearsal',D),reh=D.events.filter(function(e){return e.kind==='rehearsal';}).length;
      if(!up.length)return{v:'예정 없음',d:D.events.length?'지난 일정 '+D.events.length+'개':'연습·회의·공연 일정을 잡아요',st:pjbFromLight(l.light)};
      var n=up[0],k=(EVENT_KIND[n.kind]||EVENT_KIND.etc).l;
      return{v:evDate(new Date(n.starts_at))+' '+k,d:'앞으로 '+up.length+'개'+(reh?' · 연습 '+reh+'회':''),st:pjbFromLight(l.light)};
    }},
    {key:'notices',title:'공지',icon:'note',view:function(el){el.innerHTML=homeNoticesHtml();loadHomeScheduleBits();},calc:function(D){
      if(!D.notices.length)return{v:'없음',d:admin?'연습 장소·준비물처럼 모두가 알 것을 남겨요':'관리자가 올리면 여기에 보여요',st:'off'};
      var top=D.notices.slice().sort(function(a,b){return(b.pinned?1:0)-(a.pinned?1:0);})[0];
      return{v:D.notices.length+'개',d:(top.pinned?'고정 · ':'')+String(top.body||'').replace(/\s+/g,' '),st:'done'};
    }},
    {key:'budget',title:'예산',icon:'coin',show:admin||!!pr.budget_visible_to_members,view:function(el){renderProjectBudget(el);},calc:function(D){
      var l=pjbLight('budget',D);
      return{v:l.text&&l.text.indexOf('예산 없음')<0?l.text.replace(/ 사용$/,''):'아직 없음',d:'총 예산 '+(Number(pr.budget_total)?dashWon(Number(pr.budget_total)):'미정')+' · 분류별 추천 분배',st:pjbFromLight(l.light)};
    }},
    {key:'props',title:'소품',icon:'stage',view:function(el){renderProjectPropsTab(el);},calc:function(D){
      var l=pjbLight('props',D),n=(D.props||[]).length,r=(D.props||[]).filter(function(p){return p.status==='ready';}).length;
      return{v:n?r+' / '+n+' 준비':'목록 없음',d:n?'장면별 큐시트 · 동선 점검':'장면과 소품을 적으면 큐시트가 돼요',st:pjbFromLight(l.light)};
    }},
    {key:'promo',title:'홍보',icon:'megaphone',view:function(el){renderProjectPromoTab(el);},calc:function(D){
      var l=pjbLight('promo',D),n=(pr.promo_links||[]).length;
      return{v:n?'링크 '+n+'개':(pr.promo_note?'문구 있음':'아직 없음'),d:pr.promo_note?String(pr.promo_note).replace(/\s+/g,' '):'소개 문구·포스터·예매 링크',st:pjbFromLight(l.light)};
    }},
    {key:'settings',title:'상태·공개',icon:'settings',view:function(el){renderProjectSettings(el);},calc:function(){
      var bits=[pr.is_public?'공개':'비공개',pr.is_recruiting?'모집 중':'모집 꺼짐'];
      return{v:PROJECT_STATUS_LABEL[pr.status]||pr.status,d:PROJECT_STAGES[projectStageIndex(pr)]+' 단계 · '+bits.join(' · '),st:pr.published_show_id?'done':pr.status==='cancelled'?'off':'doing'};
    }}
  ].filter(function(b){return b.show!==false;});
}

/* ── 보드 ── */
async function loadBoardData(){
  var ctx=window._projectCtx,pid=ctx.pid;
  var q=function(p){return p.then(function(r){return r.error?[]:(r.data||[]);},function(){return[];});};
  var res=await Promise.all([
    loadProdDashData(),
    q(sbClient.from('project_notices').select('body,pinned,created_at').eq('project_id',pid).order('created_at',{ascending:false})),
    ctx.isAdmin?q(sbClient.rpc('list_project_join_requests',{p_project_id:pid})):Promise.resolve([])
  ]);
  var D=res[0];D.notices=res[1];D.requests=res[2];
  ctx.positions=D.positions;ctx.memberDetail=D.members;ctx.pendingRequests=D.requests.length;
  return D;
}
function pjbBoxInner(b,D){
  var c=D?b.calc(D):{v:'',d:'',st:'todo'};
  return {st:c.st,html:'<span class="pjb-top"><span class="pjb-t">'+ico(b.icon)+escHtml(b.title)+'</span>'+pjbOrb(c.st)+'</span>'
    +'<span class="pjb-v" title="'+escHtml(c.v||'')+'">'+(D?escHtml(c.v):'<span class="hf-loading"></span>')+'</span>'
    +'<span class="pjb-d">'+escHtml(c.d||'')+'</span>'};
}
function pjbBoxHtml(b,D){
  var x=pjbBoxInner(b,D),act=b.view?'openProjectBox(\''+b.key+'\')':(b.go||'');
  return '<button type="button" class="pjb pjb-'+x.st+(D?'':' pjb-wait')+'" data-box="'+b.key+'"'+(act?' onclick="'+act+'"':' disabled')+'>'+x.html+'</button>';
}
/* 보드: 프로젝트 이름(가장 크게, 상자 왼쪽 선에 맞춰) + 상자들. 열 때 카드를 나눠 주듯 가운데 더미에서 제자리로 펼쳐진다 */
function renderProjectBoard(el){
  var ctx=window._projectCtx,boxes=projectBoxes();
  var cols=boxes.length>12?5:4,rows=Math.ceil(boxes.length/cols);
  var cached=_pjb.data&&_pjb.data.pid===ctx.pid?_pjb.data.D:null;  // 다시 그릴 땐 지난 값을 먼저 보여주고 새로 받아 바꾼다
  el.innerHTML='<div class="pjb-stage" style="--cols:'+cols+';--rows:'+rows+';--rows-m:'+Math.ceil(boxes.length/2)+'">'
    +'<h1 class="pjb-title">'+escHtml(ctx.pr.title||'새 프로젝트')+'</h1>'
    +'<div class="pjb-board">'+boxes.map(function(b){return pjbBoxHtml(b,cached);}).join('')+'</div></div>';
  pjbDeal(el);
  loadBoardData().then(function(D){
    _pjb.data={pid:ctx.pid,D:D};
    if(window._projectCtx!==ctx||window._projectBox||!$('project-tab-content'))return;
    // 펼쳐지는 중에도 끊기지 않게 상자를 새로 만들지 않고 안만 바꾼다
    boxes.forEach(function(b){
      var btn=el.querySelector('.pjb[data-box="'+b.key+'"]');if(!btn)return;
      var x=pjbBoxInner(b,D);btn.className='pjb pjb-'+x.st;btn.innerHTML=x.html;
    });
  });
}
function pjbDeal(el){
  if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  var board=el.querySelector('.pjb-board'),list=[].slice.call(el.querySelectorAll('.pjb'));if(!board||!list.length)return;
  var br=board.getBoundingClientRect(),cx=br.left+br.width/2,cy=br.top+br.height/2;
  list.forEach(function(b,i){
    var r=b.getBoundingClientRect(),rot=((i*37)%13-6)*1.2;
    b.style.transition='none';b.style.opacity='0';
    b.style.transform='translate('+(cx-r.left-r.width/2)+'px,'+(cy-r.top-r.height/2)+'px) rotate('+rot+'deg) scale(0.55)';
  });
  void board.offsetWidth;
  list.forEach(function(b,i){
    b.style.transition='transform .62s cubic-bezier(.18,.9,.22,1.06) '+(i*42)+'ms, opacity .22s ease '+(i*42)+'ms';
    b.style.opacity='';b.style.transform='';
  });
  // 끝나면 인라인 값을 지워 평소의 눌림·떠오름 반응이 돌아오게
  setTimeout(function(){list.forEach(function(b){b.style.transition='';});},620+list.length*42);
}
/* 예전 "사람" 탭 배지 자리 — 이제 보드의 참여 요청 상자가 말해 준다 */
function updatePeopleTabBadge(){}

/* 예전 탭 하위 메뉴를 부르던 곳(계기판 버튼 등)은 상자로 바로 */
function openPeopleSub(sub){window._peopleSub=sub;openProjectBox(sub);}
function openPrepSub(sub){window._prepSub=sub;openProjectBox(sub);}

/* ── 상태·공개 상자 안: 단계 · 상태 · 공연 정보 · 공개 설정 ── */
function renderProjectSettings(el){
  var ctx=window._projectCtx,pr=ctx.pr,pid=ctx.pid,isAdmin=ctx.isAdmin;
  var stage=projectStageIndex(pr);
  var editBtn=function(step){return isAdmin?' <button type="button" class="ph-edit" onclick="openProjectWizard(\''+pid+'\',[\''+step+'\'])">변경</button>':'';};
  var empty='<span class="ph-none">미정</span>';
  var dates=pr.target_start_date?(pr.target_start_date+(pr.target_end_date&&pr.target_end_date!==pr.target_start_date?' ~ '+pr.target_end_date:'')):'';
  var statusH=isAdmin
    ?'<select class="ph-select" onchange="updateProjectStatus(\''+pid+'\',this.value)">'+Object.keys(PROJECT_STATUS_LABEL).map(function(k){return '<option value="'+k+'"'+(pr.status===k?' selected':'')+'>'+PROJECT_STATUS_LABEL[k]+'</option>';}).join('')+'</select>'
    :escHtml(PROJECT_STATUS_LABEL[pr.status]||pr.status);
  var h='<ol class="ph-stages">'+PROJECT_STAGES.map(function(s,i){
    return '<li class="ph-stage'+(i<stage?' done':'')+(i===stage?' now':'')+'"><span class="ph-stage-dot"></span><span>'+s+'</span></li>';
  }).join('')+'</ol>';
  h+='<section class="dv-sec">'+dvSection('공연 정보')+'<dl class="dv-facts ph-facts">'
    +'<div class="dv-fact"><dt>이름</dt><dd>'+escHtml(pr.title||'새 프로젝트')+(isAdmin?' <button type="button" class="ph-edit" onclick="editProjectTitle(\''+pid+'\')">변경</button>':'')+'</dd></div>'
    +'<div class="dv-fact"><dt>상태</dt><dd>'+statusH+'</dd></div>'
    +'<div class="dv-fact"><dt>작품</dt><dd>'+(pr.work_id?dvLink('work',pr.work_id,nm(pr.work_id)):empty)+editBtn('work')+'</dd></div>'
    +'<div class="dv-fact"><dt>단체</dt><dd>'+(pr.troupe_id?dvLink('troupe',pr.troupe_id,nm(pr.troupe_id)):empty)+editBtn('troupe')+'</dd></div>'
    +'<div class="dv-fact"><dt>극장</dt><dd>'+(pr.venue_id?dvLink('venue',pr.venue_id,nm(pr.venue_id)):empty)+(isAdmin?' <button type="button" class="ph-edit" onclick="openProjectBox(\'venue\')">찾기</button>':'')+'</dd></div>'
    +'<div class="dv-fact"><dt>날짜</dt><dd>'+(dates?escHtml(dates):empty)+editBtn('date')+'</dd></div>'
    +'<div class="dv-fact"><dt>라이선스</dt><dd>'+(pr.is_licensed?escHtml(pr.is_licensed):empty)+editBtn('license')+'</dd></div>'
    +'</dl></section>';
  if(pr.published_show_id)h+='<section class="dv-sec"><div class="ph-published">이 공연은 아카이브에 올라가 있어요. <span class="link" data-action="show" data-id="'+pr.published_show_id+'">공연 페이지 보기 →</span></div></section>';
  if(isAdmin){
    h+='<section class="dv-sec">'+dvSection('공개 설정')+'<div class="ph-settings">'
      +(ctx.isOwner?'<label class="ph-switch"><input type="checkbox" '+(pr.is_public?'checked':'')+' onchange="toggleProjectPublic(\''+pid+'\',this.checked)"><span><b>프로젝트 공개</b><br>둘러보기의 "기회"에서 누구나 이 프로젝트를 볼 수 있어요</span></label>':'')
      +'<label class="ph-switch"><input type="checkbox" '+(pr.is_recruiting?'checked':'')+' onchange="toggleRecruiting(\''+pid+'\',this.checked)"><span><b>빈 자리 모집</b><br>비어 있는 배역·제작진 자리를 기회 목록에 올려요</span></label>'
      +(ctx.isOwner?'<label class="ph-switch"><input type="checkbox" '+(pr.budget_visible_to_members?'checked':'')+' onchange="toggleBudgetVisible(\''+pid+'\',this.checked)"><span><b>예산 함께 보기</b><br>관리자가 아닌 팀원도 예산 상자를 볼 수 있어요</span></label>':'')
      +'</div></section>';
  }
  el.innerHTML=h;
}
