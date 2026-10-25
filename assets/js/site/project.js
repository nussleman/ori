/* 오리 사이트 — 공연 프로젝트 운영 공간 (개요, 배우·스텝, 홍보, 극장, 팀, 예산) */
/* ══ 공연 프로젝트 (진행중인 준비 과정을 관리하는 비공개 공간) ══ */
var PROJECT_STATUS_LABEL={planning:'기획/제작 중',upcoming:'공연 예정',running:'공연 중',completed:'공연 완료',cancelled:'취소'};
var PROJECT_STATUS_COLOR={planning:'',upcoming:'var(--accent)',running:'#6eb5c8',completed:'#8a9a7a',cancelled:'#c26b6b'};
async function loadMyProjects(elId){
  var el=$(elId||'my-projects-list');if(!el)return;
  try{
    var r=await sbClient.rpc('list_my_projects_detail');
    var rows=r.data||[];
    if(!rows.length){el.innerHTML='<div style="font-size:0.82rem;color:var(--muted)">아직 시작한 프로젝트가 없어요. <button type="button" class="pf-btn pf-active" style="margin-left:0.4rem" onclick="startNewProject()">+ 새 프로젝트</button></div>';return;}
    el.innerHTML='<div class="item-grid">'+rows.map(function(p){
      return '<div class="item-card proj-card">'
        +'<div class="proj-card-actions">'
        +'<button class="proj-icon-btn" onclick="event.stopPropagation();renameProject(\''+p.id+'\')" title="이름 수정">✎</button>'
        +'<button class="proj-icon-btn" onclick="event.stopPropagation();deleteProject(\''+p.id+'\')" title="삭제">'+ico('trash')+'</button>'
        +'</div>'
        +'<div style="cursor:pointer" onclick="goProject(\''+p.id+'\')"><div class="item-card-title">'+escHtml(p.title||'새 프로젝트')+'</div>'
        +'<div style="font-size:0.72rem;color:var(--muted);margin-top:0.3rem">'+(PROJECT_STATUS_LABEL[p.status]||p.status)+'</div></div></div>';
    }).join('')+'</div>';
  }catch(e){el.innerHTML=loadFailHtml('프로젝트 목록');}
}
function refreshProjectLists(){
  if($('my-projects-list'))loadMyProjects('my-projects-list');
  if($('browse-my-projects-list'))loadBrowseMyProjects();
  loadMyProjectsCache();
}
async function renameProject(pid){
  var t= await oriPrompt('새 프로젝트 이름을 입력하세요');
  if(!t)return;
  try{await sbOk(sbClient.from('projects').update({title:t}).eq('id',pid));refreshProjectLists();}
  catch(e){oriAlert('수정 실패: '+e.message);}
}
async function deleteProject(pid){
  if(!await oriConfirm('이 프로젝트를 삭제할까요? 되돌릴 수 없어요.'))return;
  try{await sbOk(sbClient.from('projects').delete().eq('id',pid));refreshProjectLists();}
  catch(e){oriAlert('삭제 실패: '+e.message);}
}
var _startingProject=false;
async function startNewProject(){
  if(!CURRENT_USER){loginWithGoogle();return;}
  if(_startingProject)return;
  await ensureMakerEntry();
  _startingProject=true;
  try{
    var r=await sbClient.rpc('create_new_project');
    if(r.error)throw r.error;
    loadMyProjectsCache();
    goProject(r.data);
    afterMakerEntry();
  }catch(e){oriAlert('프로젝트를 시작하는 중 문제가 생겼어요: '+e.message);}
  finally{_startingProject=false;}
}
/* 프로젝트 화면 (10/23): 탭 없이 "상자 보드" 한 장 — 상자를 누르면 그 부분만 열리고, 왼쪽 위 탐색 경로로 돌아온다.
   주소: #project-<id> = 보드, #project-<id>/<상자> = 그 상자 (뒤로가기·공유 링크가 그대로 통한다). 상자 정의는 project-home.js */
async function goProject(pid,push){
  var parts=String(pid).split('/');pid=parts[0];var box=parts[1]||'';
  if(push!==false)history.pushState({view:'project',id:pid},'','#project-'+pid+(box?'/'+box:''));
  setNav('project',pid);sb('');_sbContext='';mobShowDetail();
  document.body.classList.remove('pj-fit');
  mn('<div class="pj-shell"><div class="result-empty"><div class="hf-loading">불러오는 중…</div></div></div>');
  try{
    var pr=await sbClient.from('projects').select('*').eq('id',pid).single();
    if(pr.error)throw pr.error;
    var mr=await sbClient.from('project_members').select('*').eq('project_id',pid);
    var members=mr.data||[];
    var myMember=members.find(function(m){return m.user_id===CURRENT_USER.id;});
    var posr=await sbClient.from('project_positions').select('*').eq('project_id',pid);
    var positions=posr.data||[];
    var myPosition=myMember?positions.find(function(p){return p.assigned_member_id===myMember.id;}):null;
    var isOwner=!!(myMember&&myMember.member_role==='owner');
    var isAdmin=!!(myMember&&(myMember.member_role==='owner'||myMember.member_role==='admin'));

    window._projectCtx={pid:pid,pr:pr.data,members:members,positions:positions,myMember:myMember,myPosition:myPosition,isOwner:isOwner,isAdmin:isAdmin};
    if(!myMember){
      setNav('projects');
      renderPublicProjectView(pr.data);
      injectBackBtn('← 프로젝트 목록',function(){goProjectBrowse();});
      return;
    }
    if(!myPosition){
      mn('<div class="tab-index"><div style="font-size:0.85rem;color:var(--muted);padding:2rem">첫 질문에 답하는 중이에요…</div></div>');
      injectBackBtn('← 내 프로젝트',function(){goMake();});
      // 새 프로젝트는 이름·작품만 묻는다. 만든 사람은 바로 관리자 자리에 앉고, 나머지(날짜·극장·단체·공개·라이선스)는 보드의 상자에서 채운다
      if(isOwner){
        try{await sbOk(sbClient.from('project_positions').insert({project_id:pid,assigned_member_id:myMember.id,status:'filled',position_type:'other',position_label:'관리자'}));}catch(e){}
        openProjectWizard(pid,pr.data.work_id?['name']:['name','work'],myMember.id);
      }else openProjectWizard(pid,['role'],myMember.id);
      return;
    }
    box=pjbResolve(box);
    window._projectBox=projectBoxes().some(function(b){return b.key===box;})?box:'';
    renderProjectShell();
  }catch(e){
    mn('<div class="pj-shell"><div class="result-empty">프로젝트를 불러올 수 없어요. 접근 권한이 없거나 삭제되었을 수 있어요.</div></div>');
  }
}
/* 상자 하나 열기 / 보드로 돌아가기 (box='') */
function openProjectBox(box,push){
  var ctx=window._projectCtx;if(!ctx)return;
  box=pjbResolve(box||'');
  window._projectBox=box;
  if(push!==false)history.pushState({view:'project',id:ctx.pid},'','#project-'+ctx.pid+(box?'/'+box:''));
  renderProjectShell();
}
/* 왼쪽 위 탐색 경로 (노션식): 내 프로젝트 / 프로젝트 이름 / 지금 연 상자. 앞의 것은 눌러서 간다 */
function projectCrumbHtml(){
  var ctx=window._projectCtx,box=window._projectBox,b=box&&projectBoxes().find(function(x){return x.key===box;});
  var items=[['내 프로젝트','goMake()'],[ctx.pr.title||'새 프로젝트',box?'openProjectBox(\'\')':'']];
  if(b)items.push([b.title,'']);
  return '<div class="pj-crumb" role="navigation" aria-label="탐색 경로">'+items.map(function(it,i){
    return (i?'<span class="pj-crumb-sep">/</span>':'')
      +(it[1]?'<button type="button" class="pj-crumb-i" onclick="'+it[1]+'">'+(i===1?ico('stage'):'')+escHtml(it[0])+'</button>'
        :'<span class="pj-crumb-i now" aria-current="page">'+(i===1?ico('stage'):'')+escHtml(it[0])+'</span>');
  }).join('')+'</div>';
}
function renderProjectShell(){
  var box=window._projectBox;
  window._projectTab=box||'home';  // 일정·예산 화면이 "지금 내 화면인지" 확인할 때 쓴다
  document.body.classList.toggle('pj-fit',!box);
  mn('<div class="pj-shell'+(box?' pj-shell-view':'')+'">'+projectCrumbHtml()+(box?projectBoxHeadHtml(box):'')+'<div id="project-tab-content" class="'+(box?'pj-view':'pj-board-wrap')+'"></div></div>');
  renderProjectTabContent();
  if(box&&box!=='settings')renderOpsLinks(box);  // 상자마다 꽂아 둔 바깥 도구 (project-ops.js)
}
/* 상자 화면 머리: 큰 제목 + 꽂아 둔 바깥 도구(오른쪽) + 같은 단계의 다른 상자로 바로 가는 탭 */
function projectBoxHeadHtml(box){
  var ctx=window._projectCtx,all=projectBoxes(),b=all.find(function(x){return x.key===box;});if(!b)return '';
  var sibs=pjbVisible(ctx.pid).filter(function(x){return x.phase===b.phase;});
  if(!sibs.some(function(x){return x.key===box;}))sibs.push(b);
  return '<div class="bx-head"><h1 class="bx-title">'+ico(b.icon)+escHtml(b.title)+'</h1>'+(box!=='settings'?opsLinksBarHtml(box):'')+'</div>'
    +'<div id="ops-link-form"></div>'
    +(sibs.length>1?'<div class="bx-sibs" role="tablist">'+sibs.map(function(x){return '<button type="button" role="tab" aria-selected="'+(x.key===box)+'" class="'+(x.key===box?'active':'')+'" onclick="openProjectBox(\''+x.key+'\')">'+escHtml(x.title)+'</button>';}).join('')+'</div>':'');
}
/* 예전 탭 이름으로 부르던 곳(일정·예산 등)을 상자로 잇는다 */
function switchProjectTab(tab){
  var map={home:'',people:window._peopleSub||'actor',prep:window._prepSub||'venue'};
  openProjectBox(map[tab]!==undefined?map[tab]:tab);
}
function renderProjectTabContent(){
  var el=$('project-tab-content');if(!el)return;
  var box=window._projectBox,b=box&&projectBoxes().find(function(x){return x.key===box;});
  if(!b){renderProjectBoard(el);return;}
  b.view(el);
}
/* 자리·초대·모집을 바꾼 뒤 지금 화면을 새로 그린다 */
function loadProjectMembersDetail(pid){
  if(!window._projectCtx||window._projectCtx.pid!==pid)return;
  renderProjectTabContent();
}
async function updateProjectStatus(pid,status){
  var ctx=window._projectCtx;
  if(status==='upcoming'&&!ctx.pr.published_show_id){
    if(!await oriConfirm('상태를 "공연 예정"으로 바꾸면, 지금까지 채운 정보(작품·단체·극장·날짜·구성원)로 공연 데이터가 자동으로 만들어져요.\n계속할까요?',{ok:'공연 예정으로 바꾸기'})){
      renderProjectTabContent();return;
    }
    try{
      await sbOk(sbClient.from('projects').update({status:status}).eq('id',pid));
      var r=await sbClient.rpc('publish_project_as_show',{p_project_id:pid});
      if(r.error)throw r.error;
      ctx.pr.status=status;ctx.pr.published_show_id=r.data;
      await load();
      oriAlert('공연 데이터가 만들어졌어요!');
      renderProjectTabContent();
    }catch(e){oriAlert('공연 데이터 생성 중 문제가 생겼어요: '+e.message);}
    return;
  }
  try{await sbOk(sbClient.from('projects').update({status:status}).eq('id',pid));ctx.pr.status=status;renderProjectTabContent();}
  catch(e){oriAlert('상태 변경 실패: '+e.message);}
}
var PROJECT_STATUS_CHIP_CLASS={planning:'',upcoming:'status-chip-upcoming',running:'status-chip-running',completed:'status-chip-completed',cancelled:'status-chip-cancelled'};
function renderPublicProjectView(pr){
  var chipClass=PROJECT_STATUS_CHIP_CLASS[pr.status]||'';
  var h='<div class="detail-header"><div class="eyebrow">프로젝트 · 공개로 구경 중</div><div class="detail-title">'+escHtml(pr.title||'새 프로젝트')+'</div>'
    +'<div class="detail-meta"><span class="status-chip '+chipClass+'">'+(PROJECT_STATUS_LABEL[pr.status]||pr.status)+'</span></div></div>';
  h+='<div class="person-overview-grid">';
  h+='<div class="person-side-card"><div class="person-side-title">작품</div><div style="font-size:0.85rem">'+(pr.work_id?('<span class="link" data-action="work" data-id="'+pr.work_id+'">'+escHtml(nm(pr.work_id))+'</span>'):'<span style="color:var(--muted)">미정</span>')+'</div></div>';
  h+='<div class="person-side-card"><div class="person-side-title">단체</div><div style="font-size:0.85rem">'+(pr.troupe_id?('<span class="link" data-action="troupe" data-id="'+pr.troupe_id+'">'+escHtml(nm(pr.troupe_id))+'</span>'):'<span style="color:var(--muted)">미정</span>')+'</div></div>';
  h+='<div class="person-side-card"><div class="person-side-title">극장</div><div style="font-size:0.85rem">'+(pr.venue_id?('<span class="link" data-action="venue" data-id="'+pr.venue_id+'">'+escHtml(nm(pr.venue_id))+'</span>'):'<span style="color:var(--muted)">미정</span>')+'</div></div>';
  h+='</div>';
  h+='<section class="dv-sec" id="pub-open-pos"></section>';
  var past=troupePastShows(pr.troupe_id);
  if(past.length)h+='<section class="dv-sec">'+dvSection(escHtml(nm(pr.troupe_id))+'의 지난 공연',past.length)
    +'<div class="dv-list dv-list-film">'+past.slice(0,6).map(function(s){return dvShowFilm(s);}).join('')+'</div>'
    +(past.length>6?'<button type="button" class="dv-all" data-action="troupe" data-id="'+pr.troupe_id+'">단체 페이지에서 모두 보기 ›</button>':'')+'</section>';
  h+='<div style="text-align:center;margin-top:1.5rem;font-size:0.8rem;color:var(--muted)">이 프로젝트의 구성원만 자세한 내용(팀·예산·참여요청)을 볼 수 있어요.</div>';
  mn(h);
  loadPublicOpenPositions(pr.id);
}
function overviewFieldCard(label,value,wizardStep,ctaLabel,canEdit,linkTo){
  var valueH=value?(linkTo?('<span class="link" data-action="'+linkTo.action+'" data-id="'+linkTo.id+'">'+escHtml(value)+'</span>'):escHtml(value))
    :'<span style="color:var(--muted)">비어있어요</span>';
  return '<div class="person-side-card"><div class="person-side-title">'+label+'</div><div style="font-size:0.9rem">'+valueH+'</div>'
    +(canEdit?'<button class="pf-btn" style="margin-top:0.6rem;width:100%" onclick=\'openProjectWizard("'+window._projectCtx.pid+'",["'+wizardStep+'"])\'>'+(value?'변경':ctaLabel)+'</button>':'')
    +'</div>';
}
async function toggleProjectPublic(pid,on){
  try{await sbOk(sbClient.from('projects').update({is_public:on}).eq('id',pid));window._projectCtx.pr.is_public=on;renderProjectTabContent();}
  catch(e){oriAlert('변경 실패: '+e.message);}
}
async function loadOverviewAdminList(pid){
  var el=$('overview-admin-list');if(!el)return;
  try{
    var r=await sbClient.rpc('list_project_members_detail',{p_project_id:pid});
    var seen={};
    var admins=(r.data||[]).filter(function(m){
      if(m.member_role!=='owner'&&m.member_role!=='admin')return false;
      if(seen[m.member_id])return false;
      seen[m.member_id]=true;
      return true;
    });
    el.innerHTML=admins.map(function(m){
      var nameH=m.person_id?'<span class="link" data-action="person" data-id="'+m.person_id+'">'+escHtml(m.nickname||m.email)+'</span>':escHtml(m.nickname||m.email);
      return '<div style="margin-bottom:0.35rem">'+(m.member_role==='owner'?''+ico('crown')+' ':'')+nameH+'</div>';
    }).join('')||'<span style="color:var(--muted)">없음</span>';
  }catch(e){el.innerHTML=loadFailHtml('관리자 목록');}
}
async function toggleBudgetVisible(pid,on){
  try{await sbOk(sbClient.from('projects').update({budget_visible_to_members:on}).eq('id',pid));window._projectCtx.pr.budget_visible_to_members=on;}
  catch(e){oriAlert('변경 실패: '+e.message);}
}
function staffCategoryOf(name){
  if(!name)return '기타';
  if(name.indexOf('연출')>-1)return '연출진';
  if(['기획','제작'].some(function(k){return name.indexOf(k)>-1;}))return '기획/제작';
  if(['무대','미술','안무','음악','조명','소품','메이크업','음향','의상'].some(function(k){return name.indexOf(k)>-1;}))return '크리에이티브';
  if(['운영','홍보','총무'].some(function(k){return name.indexOf(k)>-1;}))return '운영진';
  return '기타';
}
async function loadProjectPositionsData(pid,renderFn){
  try{
    var ctx=window._projectCtx;
    var posr=await sbClient.from('project_positions').select('*').eq('project_id',pid);
    var positions=posr.data||[];
    ctx.positions=positions;
    var detailR=await sbClient.rpc('list_project_members_detail',{p_project_id:pid});
    ctx.memberDetail=detailR.data||[];
    var emailByMemberId={};(detailR.data||[]).forEach(function(d){emailByMemberId[d.member_id]=d.person_id?('<span class="link" data-action="person" data-id="'+d.person_id+'">'+escHtml(d.nickname||d.email)+'</span>'):escHtml(d.nickname||d.email);});
    ctx.emailByMemberId=emailByMemberId;
    renderFn();
  }catch(e){var el=$('project-tab-content');if(el)el.innerHTML=loadFailHtml('');}
}
function renderActorTabBody(){
  var el=$('actor-tab-body');if(!el)return;
  var ctx=window._projectCtx;var pid=ctx.pid,pr=ctx.pr,positions=ctx.positions||[],emailByMemberId=ctx.emailByMemberId||{};
  var actorPositions=positions.filter(function(p){return p.position_type==='actor';});
  var rowsH='';
  if(pr.work_id){
    var workRoles=DB.roles.filter(function(r){return ids(fld(r,'작품')).indexOf(pr.work_id)>-1&&fld(r,'배역명');});
    if(workRoles.length){
      rowsH=workRoles.map(function(r){
        var matched=actorPositions.filter(function(p){return p.role_id===r.id;});
        return slotRowsFor('role',pid,r.id,fld(r,'배역명'),matched,emailByMemberId);
      }).join('');
    }
  }
  if(!rowsH){
    var freeform=actorPositions.filter(function(p){return !p.role_id;});
    rowsH=freeform.length?freeform.map(function(p){return slotRowsFor('pos',pid,null,p.position_label||'배우',[p],emailByMemberId);}).join('')
      :'<div class="dv-empty">'+(ctx.isAdmin&&!pr.work_id?'<button type="button" class="pf-btn pf-active" onclick="openProjectWizard(\''+pid+'\',[\'work\'])">작품 정하기</button>':'배역이 없어요')+'</div>';
  }
  el.innerHTML='<div class="slot-list">'+rowsH+'</div>'+infoReportPrompt('배역','role');
}
function renderCrewTabBody(){
  var el=$('crew-tab-body');if(!el)return;
  var ctx=window._projectCtx;var pid=ctx.pid,positions=ctx.positions||[],emailByMemberId=ctx.emailByMemberId||{};
  var staffPositions=positions.filter(function(p){return p.position_type==='staff';});
  var staffRolesAll=DB.staffRoles.filter(function(s){return fld(s,'Name');}).slice().sort(function(a,b){return(STAFF_ORDER[a.id]||999)-(STAFF_ORDER[b.id]||999);});
  var staffGroups={'연출진':[],'기획/제작':[],'크리에이티브':[],'운영진':[],'기타':[]};
  staffRolesAll.forEach(function(sr){staffGroups[staffCategoryOf(fld(sr,'Name'))].push(sr);});
  var cardsH=Object.keys(staffGroups).map(function(g){
    if(!staffGroups[g].length)return '';
    var rowsH=staffGroups[g].map(function(sr){
      var matched=staffPositions.filter(function(p){return p.staff_role_id===sr.id;});
      return slotRowsFor('staff',pid,sr.id,fld(sr,'Name'),matched,emailByMemberId);
    }).join('');
    return '<div class="person-side-card"><div class="proj-staff-subgroup">'+g+'</div>'+rowsH+'</div>';
  }).join('');
  var otherPositions=positions.filter(function(p){return p.position_type==='other';});
  var otherRowsH=otherPositions.map(function(p){return slotRowsFor('other',pid,null,p.position_label||'기타',[p],emailByMemberId);}).join('');
  cardsH+='<div class="person-side-card"><div class="proj-staff-subgroup">기타 · 이름만 적은 멤버</div>'+(otherRowsH||'<div style="font-size:0.78rem;color:var(--muted)">없어요.</div>')
    +'<button class="pf-btn" style="margin-top:0.6rem;width:100%" onclick="showAddPositionForm(\''+pid+'\')">+ 자리 추가</button><div id="add-position-form" style="margin-top:0.5rem"></div></div>';
  el.innerHTML='<div class="project-members-grid project-members-grid-3col">'+cardsH+'</div>'+infoReportPrompt('스태프 역할','other');
}
/* 홍보·티켓: 소개 문구(쓰고 나가면 저장). 예매처·인스타 같은 링크는 위 "연결"에 꽂는다 (project_links promo) */
function renderProjectPromoTab(el){
  var ctx=window._projectCtx,pid=ctx.pid,pr=ctx.pr;
  el.innerHTML='<section class="dv-sec">'+dvSection('소개 문구')
    +'<textarea id="promo-note" class="bx-text" rows="5" maxlength="2000" placeholder="공연 한 줄 소개 · 시놉시스 요약" onblur="savePromoNote(\''+pid+'\')">'+escHtml(pr.promo_note||'')+'</textarea>'
    +'<div id="promo-note-msg" class="bx-saved"></div></section>';
}
async function savePromoNote(pid){
  var v=$('promo-note').value.trim()||null,pr=window._projectCtx.pr;
  if(v===(pr.promo_note||null))return;
  try{await sbOk(sbClient.from('projects').update({promo_note:v}).eq('id',pid));pr.promo_note=v;$('promo-note-msg').textContent='저장됨';}
  catch(e){$('promo-note-msg').textContent='저장 실패: '+e.message;}
}
/* 공간: 담은 후보(맨 위) → 찾기 */
function renderProjectVenueTab(el){
  var ctx=window._projectCtx;var pid=ctx.pid;
  el.innerHTML='<section class="dv-sec">'+dvSection('후보')+'<div id="venue-candidates-list"><div class="hf-loading">불러오는 중…</div></div></section>'
    +(ctx.isAdmin?'<section class="dv-sec">'+dvSection('찾기')
    +'<div class="task-add"><input type="text" id="venue-filter-keyword" placeholder="극장 이름" oninput="renderVenueFilterResults()">'
    +'<input type="number" id="venue-filter-seats" min="0" placeholder="객석 몇 석 이상" oninput="renderVenueFilterResults()"></div>'
    +'<div id="venue-filter-results" class="vn-grid"></div></section>':'');
  if(ctx.isAdmin)renderVenueFilterResults();
  loadVenueCandidatesList(pid);
}
function renderVenueFilterResults(){
  var el=$('venue-filter-results');if(!el)return;
  var minSeats=Number($('venue-filter-seats').value||0);
  var kw=($('venue-filter-keyword').value||'').trim().toLowerCase();
  var list=DB.venues.filter(function(v){
    var name=fld(v,'극장명')||'';
    if(kw&&name.toLowerCase().indexOf(kw)===-1)return false;
    if(minSeats){
      var seats=fld(v,'좌석수_최대')||fld(v,'좌석수');
      if(seats&&seats<minSeats)return false;
    }
    return true;
  }).slice(0,30);
  if(!list.length){el.innerHTML='<div class="dv-empty">맞는 극장이 없어요</div>';return;}
  el.innerHTML=list.map(function(v){
    var seatsLabel=venueSeatsLabel(v),fee=fld(v,'대관료');
    return '<div class="vn-card"><b>'+escHtml(fld(v,'극장명'))+'</b><span>'+escHtml([seatsLabel,fee?'대관료 '+fee:''].filter(Boolean).join(' · '))+'</span>'
      +'<button type="button" class="pf-btn" onclick="addVenueCandidateFromFilter(\''+v.id+'\')">+ 후보</button></div>';
  }).join('');
}
async function addVenueCandidateFromFilter(vid){
  var pid=window._projectCtx.pid;
  try{await sbOk(sbClient.from('project_venue_candidates').insert({project_id:pid,venue_id:vid,status:'considering'}));}catch(e){}
  loadVenueCandidatesList(pid);
}
var VENUE_CAND_STATUS_LABEL={considering:'후보',reviewing:'알아보는 중',selected:'확정'};
async function loadVenueCandidatesList(pid){
  var el=$('venue-candidates-list');if(!el)return;
  var admin=window._projectCtx.isAdmin;
  try{
    var r=await sbClient.from('project_venue_candidates').select('*').eq('project_id',pid).order('created_at',{ascending:true});
    var rows=(r.data||[]).filter(function(c){return DB.venues.some(function(v){return v.id===c.venue_id;});});
    if(!rows.length){el.innerHTML='<div class="dv-empty">아직 담은 극장이 없어요</div>';return;}
    el.innerHTML=rows.map(function(c){
      var venue=DB.venues.find(function(v){return v.id===c.venue_id;}),seats=venueSeatsLabel(venue);
      return '<div class="slot-row'+(c.status==='selected'?' vn-sel':'')+'"><span class="dash-dot '+(c.status==='selected'?'green':c.status==='reviewing'?'yellow':'gray')+'"></span>'
        +'<span class="slot-l"><span class="link" data-action="venue" data-id="'+venue.id+'">'+escHtml(fld(venue,'극장명'))+'</span></span><span class="slot-who">'+(seats||'')+'</span>'
        +(admin?'<span class="slot-btns"><span class="dash-seg">'+Object.keys(VENUE_CAND_STATUS_LABEL).map(function(k){return '<button type="button" class="'+(c.status===k?'on':'')+'" onclick="setVenueCandStatus(\''+c.id+'\',\''+pid+'\',\''+venue.id+'\',\''+k+'\')">'+VENUE_CAND_STATUS_LABEL[k]+'</button>';}).join('')+'</span>'
          +'<button type="button" class="task-x" title="빼기" onclick="removeVenueCandidate(\''+c.id+'\',\''+pid+'\')">✕</button></span>':'<span class="slot-btns">'+VENUE_CAND_STATUS_LABEL[c.status]+'</span>')
        +'</div>';
    }).join('');
  }catch(e){el.innerHTML=loadFailHtml('극장 후보');}
}
async function setVenueCandStatus(candId,pid,venueId,status){
  try{
    if(status==='selected')await sbOk(sbClient.rpc('select_project_venue',{p_project_id:pid,p_venue_id:venueId}));
    else await sbOk(sbClient.from('project_venue_candidates').update({status:status}).eq('id',candId));
    window._projectCtx.pr.venue_id=status==='selected'?venueId:window._projectCtx.pr.venue_id;
    loadVenueCandidatesList(pid);
  }catch(e){oriAlert('변경 실패: '+e.message);}
}
async function removeVenueCandidate(candId,pid){
  try{await sbOk(sbClient.from('project_venue_candidates').delete().eq('id',candId));loadVenueCandidatesList(pid);}
  catch(e){oriAlert('삭제 실패: '+e.message);}
}
window._teamSubTab=window._teamSubTab||'people';
function renderTeamSubTabBody(){
  var el=$('team-subtab-body');if(!el)return;
  var ctx=window._projectCtx;var pid=ctx.pid,pr=ctx.pr;
  var sub=window._teamSubTab;
  if(sub==='people'){
    var rows=ctx.memberDetail||[],me=ctx.myMember&&ctx.myMember.id,contacts=window._teamContacts||{};
    var roleLabel={owner:'대표',admin:'관리자',member:''};
    var byMember={};var order=[];
    rows.forEach(function(m){
      if(!byMember[m.member_id]){byMember[m.member_id]=Object.assign({},m,{positionLabels:[]});order.push(m.member_id);}
      var posLabel=m.staff_role_name||m.position_label;
      if(posLabel&&byMember[m.member_id].positionLabels.indexOf(posLabel)<0)byMember[m.member_id].positionLabels.push(posLabel);
    });
    var uniqueRows=order.map(function(id){return byMember[id];});
    var mine=contacts[me];
    el.innerHTML=(me?'<div class="tm-me"><button type="button" class="pf-btn'+(mine?'':' pf-active')+'" onclick="teamContactForm()">'+(mine?'내 연락처 고치기':'+ 내 연락처')+'</button><div id="team-contact-f"></div></div>':'')
      +(uniqueRows.map(function(m){
      var name=(m.person_id&&nm(m.person_id))||m.nickname||m.email||'팀원';
      var nameH=m.person_id?'<span class="link" data-action="person" data-id="'+m.person_id+'">'+escHtml(name)+'</span>':escHtml(name);
      var c=contacts[m.member_id]||{};
      var adminToggle=(ctx.isOwner&&m.member_role!=='owner')?'<button type="button" class="ph-edit" onclick="toggleMemberAdmin(\''+m.member_id+'\','+(m.member_role==='admin'?'false':'true')+',\''+pid+'\')">'+(m.member_role==='admin'?'관리자 해제':'관리자로')+'</button>':'';
      return '<div class="tm-row"><div class="tm-main"><b>'+nameH+'</b>'+(roleLabel[m.member_role]?'<span class="tm-role">'+(m.member_role==='owner'?ico('crown'):'')+roleLabel[m.member_role]+'</span>':'')
        +'<span class="tm-pos">'+m.positionLabels.map(escHtml).join(' · ')+'</span></div>'
        +'<div class="tm-contact">'+(c.phone?'<a href="tel:'+escHtml(c.phone.replace(/[^0-9+]/g,''))+'">'+escHtml(c.phone)+'</a>':'')+(c.emergency?'<small title="비상 연락처">비상 '+escHtml(c.emergency)+'</small>':'')+'</div>'
        +adminToggle+'</div>';
    }).join('')||'<div class="dv-empty">구성원이 없어요</div>');
  }else if(sub==='orgs'){
    var orgRows=[];
    if(pr.troupe_id)orgRows.push({name:nm(pr.troupe_id),id:pr.troupe_id,type:'troupe',role:'단체'});
    if(pr.venue_id)orgRows.push({name:nm(pr.venue_id),id:pr.venue_id,type:'venue',role:'극장'});
    el.innerHTML='<div>'+(orgRows.length?orgRows.map(function(o){
      return '<div class="proj-member-row"><span class="status-chip" style="font-size:0.68rem;padding:0.15rem 0.55rem">'+o.role+'</span><span class="link" style="margin-left:0.6rem" data-action="'+o.type+'" data-id="'+o.id+'">'+escHtml(o.name)+'</span></div>';
    }).join(''):'<div style="font-size:0.82rem;color:var(--muted)">아직 연결된 단체·극장이 없어요. 개요 탭에서 정해보세요.</div>')+'</div>';
  }
}
function infoReportPrompt(label,targetType){
  return '<div style="text-align:center;margin-top:1rem"><span class="link" style="font-size:0.76rem;color:var(--muted)" onclick="openEditModal(\''+targetType+'\')">'+label+'이 부족한가요? 정보 제보하기</span></div>';
}
async function toggleMemberAdmin(memberId,makeAdmin,pid){
  var r=await sbClient.rpc('set_member_admin',{p_member_id:memberId,p_is_admin:makeAdmin});
  if(r.error){oriAlert('변경 실패: '+r.error.message);return;}
  loadProjectMembersDetail(pid);
}
/* 배역·자리 한 줄: 확정(이름) · 모집 중 · 비어 있음. 버튼은 관리자에게만 */
function slotRowsFor(kind,pid,refId,label,matchedPositions,emailByMemberId){
  matchedPositions=matchedPositions||[];
  var admin=!!(window._projectCtx&&window._projectCtx.isAdmin);
  var filled=matchedPositions.filter(function(p){return p.status==='filled'&&(p.assigned_member_id||p.assigned_name);});
  var openOrClosed=matchedPositions.filter(function(p){return filled.indexOf(p)<0;});
  var q='\''+escHtml(label).replace(/'/g,"\\'")+'\'';
  var btn=function(t,fn){return admin?'<button type="button" class="pf-btn" onclick="'+fn+'">'+t+'</button>':'';};
  var row=function(dot,meta,btns,pos){
    return '<div class="slot-row"><span class="dash-dot '+dot+'"></span><span class="slot-l">'+escHtml(label)+'</span><span class="slot-who">'+meta+'</span>'+(btns?'<span class="slot-btns">'+btns+'</span>':'')+'</div>'
      +(pos?'<div id="invite-picker-'+pos.id+'"></div>':'');
  };
  var h='';
  filled.forEach(function(pos){
    var who=(emailByMemberId&&emailByMemberId[pos.assigned_member_id])||escHtml(pos.assigned_name||'확정');
    h+=row('green',who,(kind==='role'||kind==='staff')?btn('+ 한 명 더','addAnotherSlot(\''+pid+'\',\''+kind+'\',\''+refId+'\','+q+')'):'');
  });
  if(!openOrClosed.length&&!filled.length)
    h+=row('gray','비어 있음',btn('사람 찾기','ensurePositionAndSearch(\''+pid+'\',\''+kind+'\',\''+refId+'\','+q+')')+btn('모집 열기','recruitProjectSlot(\''+pid+'\',\''+kind+'\',\''+refId+'\','+q+')'));
  openOrClosed.forEach(function(pos){
    var open=pos.status==='open';
    h+=row(open?'yellow':'gray',open?'모집 중':'비어 있음',btn('사람 찾기','openInvitePicker(\''+pos.id+'\',\''+kind+'\',\''+refId+'\')')+btn(open?'모집 닫기':'모집 열기','setPositionRecruiting(\''+pos.id+'\','+(!open)+',\''+pid+'\')'),pos);
  });
  return h;
}
async function ensurePositionAndSearch(pid,kind,refId,label){
  var row={project_id:pid,status:'closed',position_label:label};
  if(kind==='role'){row.position_type='actor';row.role_id=refId;}
  else if(kind==='staff'){row.position_type='staff';row.staff_role_id=refId;}
  else{row.position_type='other';}
  var r=await sbClient.from('project_positions').insert(row).select().single();
  if(r.error){oriAlert('오류: '+r.error.message);return;}
  await loadProjectMembersDetail(pid);
  openInvitePicker(r.data.id,kind,refId);
}
async function addAnotherSlot(pid,kind,refId,label){
  var row={project_id:pid,status:'closed',position_label:label};
  if(kind==='role'){row.position_type='actor';row.role_id=refId;}
  else if(kind==='staff'){row.position_type='staff';row.staff_role_id=refId;}
  var r=await sbClient.from('project_positions').insert(row).select().single();
  if(r.error){oriAlert('오류: '+r.error.message);return;}
  await loadProjectMembersDetail(pid);
  openInvitePicker(r.data.id,kind,refId);
}
async function setPositionRecruiting(posId,open,pid){
  var r=await sbClient.rpc('set_position_recruiting',{p_position_id:posId,p_open:open});
  if(r.error){oriAlert('변경 실패: '+r.error.message);return;}
  loadProjectMembersDetail(pid);
}
function openInvitePicker(posId,kind,refId){
  var el=$('invite-picker-'+posId);if(!el)return;
  if(el.dataset.open==='1'){el.innerHTML='';el.dataset.open='0';return;}
  el.dataset.open='1';
  el.innerHTML='<input type="text" class="wizard-search" style="margin-top:0.5rem" placeholder="이름으로 검색..." oninput="inviteFilterList(\''+posId+'\',this.value,\''+kind+'\',\''+refId+'\')">'
    +'<div class="wizard-results" id="invite-results-'+posId+'"></div>';
  inviteFilterList(posId,'',kind,refId);
}
function getRecommendedPeople(kind,refId){
  var counts={};
  var field=kind==='role'?'배역':(kind==='staff'?'스텝':null);
  if(field&&refId){
    DB.history.filter(function(h){return isValidH(h)&&ids(fld(h,field)).indexOf(refId)>-1;}).forEach(function(h){
      var p2=ids(fld(h,'참여자'))[0]||'';if(p2)counts[p2]=(counts[p2]||0)+1;
    });
  }
  return Object.keys(counts).sort(function(a,b){return counts[b]-counts[a];}).slice(0,5);
}
async function inviteFilterList(posId,q,kind,refId){
  var el=$('invite-results-'+posId);if(!el)return;
  q=(q||'').trim();
  el.innerHTML='<div class="wizard-result-empty"><div class="hf-loading">불러오는 중…</div></div>';
  var personIds=q?DB.people.filter(function(p){var n=fld(p,'이름');return n&&n.indexOf(q)>-1;}).slice(0,8).map(function(p){return p.id;}):getRecommendedPeople(kind,refId);
  if(!personIds.length){el.innerHTML='<div class="wizard-result-empty">'+(q?'일치하는 사람이 없어요':'추천할 사람이 없어요. 검색해보세요.')+'</div>';return;}
  var results=await Promise.all(personIds.map(function(p2){
    return sbClient.rpc('person_claim_status',{p_person_id:p2}).then(function(r){return {pid:p2,claimed:r.data&&r.data.claimed};}).catch(function(){return {pid:p2,claimed:false};});
  }));
  el.innerHTML='<div style="font-size:0.66rem;color:var(--muted);margin-bottom:0.4rem;text-transform:uppercase;letter-spacing:0.08em">'+(q?'검색 결과':'추천')+'</div>'
    +results.map(function(r){
      return '<div class="invite-candidate-row"><span class="proj-slot-label">'+escHtml(nm(r.pid))+'</span>'
        +(r.claimed?'<button class="pf-btn" style="margin-left:auto;padding:0.15rem 0.5rem;font-size:0.68rem" onclick="sendPositionInvite(\''+posId+'\',\''+r.pid+'\')">참여 요청 보내기</button>'
          :'<span class="invite-unjoined-tag">미가입자</span><button class="pf-btn" style="padding:0.15rem 0.5rem;font-size:0.68rem" onclick="inviteThisPerson(\''+r.pid+'\')">초대링크 복사</button>')
        +'</div>';
    }).join('');
}
async function sendPositionInvite(posId,personId){
  var msg= await oriPrompt('간단한 메시지를 남겨주세요 (선택)')||'';
  try{
    await sbOk(sbClient.rpc('invite_person_to_position',{p_position_id:posId,p_person_id:personId,p_message:msg}));
    oriAlert('참여 요청을 보냈어요.');
  }catch(e){oriAlert('요청을 보낼 수 없어요: '+e.message);}
  loadProjectMembersDetail(window._projectCtx.pid);
}
async function recruitProjectSlot(pid,kind,refId,label){
  try{
    var row={project_id:pid,status:'open',position_label:label};
    if(kind==='role'){row.position_type='actor';row.role_id=refId;}
    else if(kind==='staff'){row.position_type='staff';row.staff_role_id=refId;}
    else{row.position_type='other';}
    await sbOk(sbClient.from('project_positions').insert(row).select());
  }catch(e){/* 이미 있으면 무시 */}
  try{await sbOk(sbClient.from('projects').update({is_recruiting:true}).eq('id',pid));window._projectCtx.pr.is_recruiting=true;}catch(e){}
  loadProjectMembersDetail(pid);
}
/* 예산 화면은 project-budget.js */
