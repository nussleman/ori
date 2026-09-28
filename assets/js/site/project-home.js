/* 오리 사이트 — 공연 프로젝트 공간의 탭 구성
   탭: 홈(지금 할 일·공지·다가오는 일정) · 사람(배역·제작진·팀원·참여 요청) · 일정(project-schedule.js) · 준비(극장 후보·소품 큐시트·홍보) · 예산(project-budget.js)
   예전의 개요/배우/제작진/극장/팀/홍보/참여요청 8개 탭 렌더러는 project.js에 그대로 있고, 여기서 묶어서 쓴다. */
var PROJECT_STAGES=['기획','팀 꾸리기','공연 준비','공연','마무리'];
var PEOPLE_SUBTABS=[['actor','배역'],['crew','제작진'],['team','팀원'],['requests','참여 요청']];
var PREP_SUBTABS=[['venue','극장 후보'],['props','소품 큐시트'],['promo','홍보']];

function projectStageIndex(pr){
  if(pr.status==='completed'||pr.status==='cancelled')return 4;
  if(pr.status==='running')return 3;
  if(pr.status==='upcoming')return 2;
  return (pr.work_id&&pr.target_start_date)?1:0;
}

/* 탭 안의 작은 전환 버튼 (사람: 배역/제작진/…, 준비: 극장/홍보) */
function subTabsHtml(list,current,fn,badges){
  return '<div class="sub-tabs" role="tablist">'+list.map(function(t){
    var b=badges&&badges[t[0]]?'<span class="sub-tab-n">'+badges[t[0]]+'</span>':'';
    return '<button type="button" role="tab" class="sub-tab'+(current===t[0]?' active':'')+'" onclick="'+fn+'(\''+t[0]+'\')">'+t[1]+b+'</button>';
  }).join('')+'</div>';
}

/* ── 홈 ── */
function renderProjectHome(el){
  var ctx=window._projectCtx,pr=ctx.pr,pid=ctx.pid,isAdmin=ctx.isAdmin;
  var stage=projectStageIndex(pr);
  var stageH='<ol class="ph-stages">'+PROJECT_STAGES.map(function(s,i){
    return '<li class="ph-stage'+(i<stage?' done':'')+(i===stage?' now':'')+'"><span class="ph-stage-dot"></span><span>'+s+'</span></li>';
  }).join('')+'</ol>';

  var myRole=ctx.myPosition?(ctx.myPosition.position_label||''):'';
  var editBtn=function(step){return isAdmin?' <button type="button" class="ph-edit" onclick="openProjectWizard(\''+pid+'\',[\''+step+'\'])">'+'변경</button>':'';};
  var empty='<span class="ph-none">미정</span>';
  var dates=pr.target_start_date?(pr.target_start_date+(pr.target_end_date&&pr.target_end_date!==pr.target_start_date?' ~ '+pr.target_end_date:'')):'';
  var statusH=isAdmin
    ?'<select class="ph-select" onchange="updateProjectStatus(\''+pid+'\',this.value)">'+Object.keys(PROJECT_STATUS_LABEL).map(function(k){return '<option value="'+k+'"'+(pr.status===k?' selected':'')+'>'+PROJECT_STATUS_LABEL[k]+'</option>';}).join('')+'</select>'
    :escHtml(PROJECT_STATUS_LABEL[pr.status]||pr.status);
  var factsH='<dl class="dv-facts ph-facts">'
    +'<div class="dv-fact"><dt>상태</dt><dd>'+statusH+'</dd></div>'
    +'<div class="dv-fact"><dt>작품</dt><dd>'+(pr.work_id?dvLink('work',pr.work_id,nm(pr.work_id)):empty)+editBtn('work')+'</dd></div>'
    +'<div class="dv-fact"><dt>단체</dt><dd>'+(pr.troupe_id?dvLink('troupe',pr.troupe_id,nm(pr.troupe_id)):empty)+editBtn('troupe')+'</dd></div>'
    +'<div class="dv-fact"><dt>극장</dt><dd>'+(pr.venue_id?dvLink('venue',pr.venue_id,nm(pr.venue_id)):empty)+(isAdmin?' <button type="button" class="ph-edit" onclick="openPrepSub(\'venue\')">찾기</button>':'')+'</dd></div>'
    +'<div class="dv-fact"><dt>날짜</dt><dd>'+(dates?escHtml(dates):empty)+editBtn('date')+'</dd></div>'
    +'<div class="dv-fact"><dt>라이선스</dt><dd>'+(pr.is_licensed?escHtml(pr.is_licensed):empty)+editBtn('license')+'</dd></div>'
    +'</dl>';

  var h='<div class="ph-top">'
    +(!isAdmin?'<div class="ph-me">이 프로젝트에서 내 역할 <b>'+(myRole?escHtml(myRole):'아직 정해지지 않았어요')+'</b></div>':'')+'</div>';
  h+=stageH;
  if(isAdmin)h+='<section class="dv-sec ph-todo-sec" id="ph-todo-sec" hidden>'+dvSection('지금 할 일')+'<div id="ph-todo" class="ph-todo"><div class="hf-loading">확인하는 중…</div></div></section>';
  h+=dashboardSectionHtml();
  h+='<div class="ph-2col">'+homeNoticesHtml()+homeUpcomingHtml()+'</div>';
  h+='<section class="dv-sec">'+dvSection('공연 정보')+factsH+'</section>';
  h+='<section class="dv-sec">'+dvSection('팀')+'<div id="ph-team" class="ph-team"><div class="hf-loading">불러오는 중…</div></div></section>';
  if(pr.published_show_id)h+='<section class="dv-sec"><div class="ph-published">이 공연은 아카이브에 올라가 있어요. <span class="link" data-action="show" data-id="'+pr.published_show_id+'">공연 페이지 보기 →</span></div></section>';
  if(isAdmin){
    h+='<section class="dv-sec">'+dvSection('공개 설정')+'<div class="ph-settings">'
      +(ctx.isOwner?'<label class="ph-switch"><input type="checkbox" '+(pr.is_public?'checked':'')+' onchange="toggleProjectPublic(\''+pid+'\',this.checked)"><span><b>프로젝트 공개</b><br>둘러보기의 "기회"에서 누구나 이 프로젝트를 볼 수 있어요</span></label>':'')
      +'<label class="ph-switch"><input type="checkbox" '+(pr.is_recruiting?'checked':'')+' onchange="toggleRecruiting(\''+pid+'\',this.checked)"><span><b>빈 자리 모집</b><br>비어 있는 배역·제작진 자리를 모집 목록에 올려요</span></label>'
      +(ctx.isOwner?'<label class="ph-switch"><input type="checkbox" '+(pr.budget_visible_to_members?'checked':'')+' onchange="toggleBudgetVisible(\''+pid+'\',this.checked)"><span><b>예산 함께 보기</b><br>관리자가 아닌 팀원도 예산 탭을 볼 수 있어요</span></label>':'')
      +'</div></section>';
  }
  el.innerHTML=h;
  loadProjectHomeData();
  loadHomeScheduleBits();
  renderProdDash();
}

async function loadProjectHomeData(){
  var ctx=window._projectCtx,pid=ctx.pid,pr=ctx.pr;
  var reqs=[],budgetCnt=0,eventCnt=0;
  try{
    var posr=await sbClient.from('project_positions').select('*').eq('project_id',pid);ctx.positions=posr.data||[];
    var md=await sbClient.rpc('list_project_members_detail',{p_project_id:pid});ctx.memberDetail=md.data||[];
    if(ctx.isAdmin){
      var rq=await sbClient.rpc('list_project_join_requests',{p_project_id:pid});reqs=rq.data||[];
      var bd=await sbClient.from('project_budget_items').select('id').eq('project_id',pid);budgetCnt=(bd.data||[]).length;
      var evr=await sbClient.from('project_events').select('id').eq('project_id',pid);eventCnt=(evr.data||[]).length;
    }
  }catch(e){}
  if(window._projectCtx!==ctx||window._projectTab!=='home')return;  // 그새 다른 화면으로 갔으면 그리지 않는다
  ctx.pendingRequests=reqs.length;
  updatePeopleTabBadge();

  var positions=ctx.positions||[];
  var open=positions.filter(function(p){return p.status==='open'&&!p.assigned_member_id;});
  var memberIds={};(ctx.memberDetail||[]).forEach(function(m){memberIds[m.member_id]=m;});
  var members=Object.keys(memberIds).map(function(k){return memberIds[k];});

  // 팀 요약
  var teamEl=$('ph-team');
  if(teamEl){
    var roleOrder={owner:0,admin:1,member:2};
    members.sort(function(a,b){return(roleOrder[a.member_role]||3)-(roleOrder[b.member_role]||3);});
    teamEl.innerHTML='<div class="ph-team-stats"><span><em>'+members.length+'</em>명 함께해요</span>'
      +'<span><em>'+open.length+'</em>개 자리가 비어 있어요</span>'
      +(ctx.isAdmin&&reqs.length?'<span class="ph-alert"><em>'+reqs.length+'</em>건 참여 요청 대기</span>':'')+'</div>'
      +'<div class="dv-list dv-list-rows">'+members.slice(0,8).map(function(m){
        var label=(m.member_role==='owner'?'대표 · ':m.member_role==='admin'?'관리자 · ':'')+(m.staff_role_name||m.position_label||'역할 미정');
        var name=escHtml((m.person_id&&nm(m.person_id))||m.nickname||m.email||'');
        var u=m.person_id?PERSON_PHOTO[m.person_id]:'';
        return '<div class="dv-row"'+(m.person_id?' data-action="person" data-id="'+m.person_id+'"':'')+'>'
          +(u?'<img class="dv-row-img" src="'+u+'" alt="">':'<div class="dv-row-img dv-card-ph">👤</div>')
          +'<div class="dv-row-main"><div class="dv-row-title">'+name+'</div><div class="dv-row-sub">'+escHtml(label)+'</div></div></div>';
      }).join('')+'</div>'
      +'<button type="button" class="dv-more" onclick="openPeopleSub(\'team\')">팀 전체 보기 →</button>';
  }

  // 지금 할 일 (관리자)
  var todoEl=$('ph-todo');if(!todoEl)return;
  var pidQ='\''+pid+'\'';
  var todos=[];
  if(reqs.length)todos.push({t:'참여 요청 '+reqs.length+'건이 기다리고 있어요',s:'승인하면 바로 팀에 들어와요',btn:'확인하기',go:'openPeopleSub(\'requests\')',hot:true});
  // 작품·극장·자리·라이선스·연습·예산은 제작 계기판(project-dashboard.js)이 챙긴다. 여기는 계기판에 없는 것만.
  if(!pr.target_start_date)todos.push({t:'첫 공연 날짜를 정해요',s:'날짜가 있어야 계기판이 영역마다 마감을 계산해요',btn:'날짜 정하기',go:'openProjectWizard('+pidQ+',[\'date\'])'});
  if(pr.status==='planning'&&pr.work_id&&pr.target_start_date&&pr.venue_id&&!open.length)
    todos.push({t:'준비가 거의 끝났어요',s:'상태를 "공연 예정"으로 바꾸면 공연 페이지가 만들어져요',btn:'공연 예정으로',go:'updateProjectStatus('+pidQ+',\'upcoming\')'});
  var todoSec=$('ph-todo-sec');if(todoSec)todoSec.hidden=!todos.length;
  todoEl.innerHTML=todos.length?todos.slice(0,5).map(function(t){
    return '<div class="ph-todo-item'+(t.hot?' hot':'')+'"><div class="ph-todo-text"><div class="ph-todo-t">'+t.t+'</div><div class="ph-todo-s">'+t.s+'</div></div>'
      +'<button type="button" class="ph-todo-btn" onclick="'+t.go+'">'+t.btn+'</button></div>';
  }).join(''):'<div class="ph-todo-done">지금 해야 할 일은 없어요. 👏</div>';
}

function updatePeopleTabBadge(){
  var b=document.querySelector('.mypage-tab-btn[data-ptab="people"] .nav-badge-dot');
  if(b)b.classList.toggle('on',!!(window._projectCtx&&window._projectCtx.pendingRequests));
}

/* ── 사람: 배역 · 제작진 · 팀원 · 참여 요청 ── */
function openPeopleSub(sub){window._peopleSub=sub;switchProjectTab('people');}
function renderProjectPeople(el){
  var ctx=window._projectCtx;
  var subs=PEOPLE_SUBTABS.filter(function(t){return t[0]!=='requests'||ctx.isAdmin;});
  var sub=window._peopleSub||'actor';
  if(!subs.some(function(t){return t[0]===sub;}))sub='actor';
  window._peopleSub=sub;
  var badges={requests:ctx.pendingRequests||0};
  el.innerHTML=subTabsHtml(subs,sub,'openPeopleSub',badges)+'<div id="people-sub-body"></div>';
  var body=$('people-sub-body');
  if(sub==='actor'){body.innerHTML='<div id="actor-tab-body">불러오는 중…</div>';loadProjectPositionsData(ctx.pid,renderActorTabBody);}
  else if(sub==='crew'){body.innerHTML='<div id="crew-tab-body">불러오는 중…</div>';loadProjectPositionsData(ctx.pid,renderCrewTabBody);}
  else if(sub==='team'){window._teamSubTab='people';body.innerHTML='<div id="team-subtab-body">불러오는 중…</div>';loadProjectPositionsData(ctx.pid,renderTeamSubTabBody);}
  else if(sub==='requests'){body.innerHTML='<div id="join-requests-list">불러오는 중…</div>';loadJoinRequests(ctx.pid);}
}

/* ── 준비: 극장 후보 · 소품 큐시트(project-props.js) · 홍보 ── */
function openPrepSub(sub){window._prepSub=sub;switchProjectTab('prep');}
function renderProjectPrep(el){
  var sub=window._prepSub||'venue';window._prepSub=sub;
  el.innerHTML=subTabsHtml(PREP_SUBTABS,sub,'openPrepSub')+'<div id="prep-sub-body"></div>';
  var body=$('prep-sub-body');
  if(sub==='venue')renderProjectVenueTab(body);else if(sub==='props')renderProjectPropsTab(body);else renderProjectPromoTab(body);
}
