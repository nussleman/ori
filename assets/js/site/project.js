/* 오리 사이트 — 공연 프로젝트 운영 공간 (개요, 배우·스텝, 홍보, 극장, 팀, 예산) */
/* ══ 공연 프로젝트 (진행중인 준비 과정을 관리하는 비공개 공간) ══ */
var PROJECT_STATUS_LABEL={planning:'기획/제작 중',upcoming:'공연 예정',running:'공연 중',completed:'공연 완료',cancelled:'취소'};
var PROJECT_STATUS_COLOR={planning:'',upcoming:'var(--accent)',running:'#6eb5c8',completed:'#8a9a7a',cancelled:'#c26b6b'};
async function loadMyProjects(elId){
  var el=$(elId||'my-projects-list');if(!el)return;
  try{
    var r=await sbClient.rpc('list_my_projects_detail');
    var rows=r.data||[];
    if(!rows.length){el.innerHTML='<div style="font-size:0.82rem;color:var(--muted)">아직 시작한 프로젝트가 없어요.</div>';return;}
    el.innerHTML='<div class="item-grid">'+rows.map(function(p){
      return '<div class="item-card proj-card">'
        +'<div class="proj-card-actions">'
        +'<button class="proj-icon-btn" onclick="event.stopPropagation();renameProject(\''+p.id+'\')" title="이름 수정">✎</button>'
        +'<button class="proj-icon-btn" onclick="event.stopPropagation();deleteProject(\''+p.id+'\')" title="삭제">🗑</button>'
        +'</div>'
        +'<div style="cursor:pointer" onclick="goProject(\''+p.id+'\')"><div class="item-card-title">'+escHtml(p.title||'새 프로젝트')+'</div>'
        +'<div style="font-size:0.72rem;color:var(--muted);margin-top:0.3rem">'+(PROJECT_STATUS_LABEL[p.status]||p.status)+'</div></div></div>';
    }).join('')+'</div>';
  }catch(e){el.innerHTML='<div style="font-size:0.82rem;color:var(--muted)">불러오기 실패했어요.</div>';}
}
function refreshProjectLists(){
  if($('my-projects-list'))loadMyProjects('my-projects-list');
  if($('browse-my-projects-list'))loadBrowseMyProjects();
  loadMyProjectsCache();
}
async function renameProject(pid){
  var t= await oriPrompt('새 프로젝트 이름을 입력하세요');
  if(!t)return;
  try{await sbClient.from('projects').update({title:t}).eq('id',pid);refreshProjectLists();}
  catch(e){oriAlert('수정 실패: '+e.message);}
}
async function deleteProject(pid){
  if(!await oriConfirm('이 프로젝트를 삭제할까요? 되돌릴 수 없어요.'))return;
  try{await sbClient.from('projects').delete().eq('id',pid);refreshProjectLists();}
  catch(e){oriAlert('삭제 실패: '+e.message);}
}
var _startingProject=false;
async function startNewProject(){
  if(!CURRENT_USER||_startingProject)return;
  _startingProject=true;
  try{
    var r=await sbClient.rpc('create_new_project');
    if(r.error)throw r.error;
    loadMyProjectsCache();
    goProject(r.data);
  }catch(e){oriAlert('프로젝트를 시작하는 중 문제가 생겼어요: '+e.message);}
  finally{_startingProject=false;}
}
async function goProject(pid,push){
  if(push!==false)history.pushState({view:'project',id:pid},'','#project-'+pid);
  setNav('project',pid);sb('');_sbContext='';mobShowDetail();
  mn('<div class="tab-index"><div class="result-empty">불러오는 중…</div></div>');
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
      injectBackBtn('← 내 공연',function(){goMyShows();});
      openProjectWizard(pid,['name','visibility','role','members','venue','troupe','work','date','license'],myMember.id);
      return;
    }

    if(!window._projectTab)window._projectTab='overview';
    var tabs=currentProjectTabs();
    if(!tabs.some(function(t){return t[0]===window._projectTab;}))window._projectTab='overview';
    var h='<div class="mypage-sticky-header"><div class="eyebrow" style="margin-bottom:0.3rem">프로젝트'+(!isAdmin?' <span style="opacity:0.6">· 멤버로 보는 중</span>':'')+'</div>'
      +'<div class="detail-title" id="project-title-display" style="margin-bottom:0.8rem;display:flex;align-items:center;gap:0.6rem"><span>'+escHtml(pr.data.title||'새 프로젝트')+'</span>'+(isAdmin?'<button class="myinfo-edit-toggle" style="flex-shrink:0" onclick="editProjectTitle(\''+pid+'\')" title="제목 수정">✎</button>':'')+'</div>'
      +'<div class="mypage-tabs">'+tabs.map(function(t){
        var badge=t[0]==='requests'?'<span class="nav-badge-dot" id="requests-tab-badge"></span>':'';
        return '<button class="mypage-tab-btn'+(window._projectTab===t[0]?' active':'')+'" data-ptab="'+t[0]+'" onclick="switchProjectTab(\''+t[0]+'\')">'+t[1]+badge+'</button>';
      }).join('')+'</div></div>';
    h+='<div class="mypage-sticky-spacer"></div>';
    h+='<div id="project-tab-content"></div>';
    mn(h);
    injectBackBtn('← 내 공연',function(){goMyShows();});
    renderProjectTabContent();
    requestAnimationFrame(function(){
      var hdr=document.querySelector('.mypage-sticky-header');
      var spacer=document.querySelector('.mypage-sticky-spacer');
      if(hdr&&spacer)spacer.style.height=hdr.offsetHeight+'px';
    });
  }catch(e){
    mn('<div class="tab-index"><div class="result-empty">프로젝트를 불러올 수 없어요. 접근 권한이 없거나 삭제되었을 수 있어요.</div></div>');
  }
}
var PROJECT_TABS_ALL=[['overview','개요'],['actor','배우'],['crew','제작진'],['venue','극장'],['team','팀'],['promo','홍보'],['budget','예산'],['requests','참여 요청']];
function currentProjectTabs(){
  var ctx=window._projectCtx;if(!ctx)return PROJECT_TABS_ALL;
  return PROJECT_TABS_ALL.filter(function(t){
    if(t[0]==='requests')return ctx.isAdmin;
    if(t[0]==='budget')return ctx.isAdmin||(ctx.pr.budget_visible_to_members);
    return true;
  });
}
function switchProjectTab(tab){
  window._projectTab=tab;
  document.querySelectorAll('.mypage-tab-btn[data-ptab]').forEach(function(b){b.classList.toggle('active',b.dataset.ptab===tab);});
  renderProjectTabContent();
}
function renderProjectTabContent(){
  var el=$('project-tab-content');if(!el)return;
  var tab=window._projectTab;
  if(tab==='overview')renderProjectOverview(el);
  else if(tab==='actor')renderProjectActorTab(el);
  else if(tab==='crew')renderProjectCrewTab(el);
  else if(tab==='venue')renderProjectVenueTab(el);
  else if(tab==='team')renderProjectTeamTab(el);
  else if(tab==='promo')renderProjectPromoTab(el);
  else if(tab==='budget')renderProjectBudget(el);
  else if(tab==='requests')renderProjectRequests(el);
}
async function updateProjectStatus(pid,status){
  var ctx=window._projectCtx;
  if(status==='upcoming'&&!ctx.pr.published_show_id){
    if(!await oriConfirm('상태를 "공연 예정"으로 바꾸면, 지금까지 채운 정보(작품·단체·극장·날짜·구성원)로 공연 데이터가 자동으로 만들어져요.\n계속할까요?')){
      renderProjectOverview($('project-tab-content'));return;
    }
    try{
      await sbClient.from('projects').update({status:status}).eq('id',pid);
      var r=await sbClient.rpc('publish_project_as_show',{p_project_id:pid});
      if(r.error)throw r.error;
      ctx.pr.status=status;ctx.pr.published_show_id=r.data;
      await load();
      oriAlert('공연 데이터가 만들어졌어요!');
      renderProjectOverview($('project-tab-content'));
    }catch(e){oriAlert('공연 데이터 생성 중 문제가 생겼어요: '+e.message);}
    return;
  }
  try{await sbClient.from('projects').update({status:status}).eq('id',pid);ctx.pr.status=status;renderProjectOverview($('project-tab-content'));}
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
  h+='<div style="text-align:center;margin-top:1.5rem;font-size:0.8rem;color:var(--muted)">이 프로젝트의 구성원만 자세한 내용(팀·예산·참여요청)을 볼 수 있어요.</div>';
  mn(h);
}
function renderProjectOverview(el){
  var ctx=window._projectCtx;var pid=ctx.pid,pr=ctx.pr;
  var h='<div class="person-overview-grid">';
  var chipClass=PROJECT_STATUS_CHIP_CLASS[pr.status]||'';

  // 상태 + 공개여부 (인라인으로 바로 수정 가능)
  h+='<div class="person-side-card"><div class="person-side-title">상태</div>'
    +(ctx.isAdmin?'<select class="wizard-search" style="margin-bottom:0" onchange="updateProjectStatus(\''+pid+'\',this.value)">'
      +Object.keys(PROJECT_STATUS_LABEL).map(function(k){return '<option value="'+k+'"'+(pr.status===k?' selected':'')+'>'+PROJECT_STATUS_LABEL[k]+'</option>';}).join('')
      +'</select>':'<span class="status-chip '+chipClass+'">'+(PROJECT_STATUS_LABEL[pr.status]||pr.status)+'</span>')
    +(pr.published_show_id?'<div style="margin-top:0.5rem"><span class="link" data-action="show" data-id="'+pr.published_show_id+'">공연 페이지 보기 →</span></div>':'')
    +'</div>';
  h+='<div class="person-side-card"><div class="person-side-title">공개 범위</div>'
    +(ctx.isOwner?('<div class="proj-visibility-toggle"><button class="proj-vis-btn'+(!pr.is_public?' on':'')+'" onclick="toggleProjectPublic(\''+pid+'\',false)">🔒 비공개</button><button class="proj-vis-btn'+(pr.is_public?' on':'')+'" onclick="toggleProjectPublic(\''+pid+'\',true)">🌐 공개</button></div>')
      :('<span class="status-chip'+(pr.is_public?' status-chip-upcoming':'')+'">'+(pr.is_public?'🌐 공개':'🔒 비공개')+'</span>'))
    +'<div style="font-size:0.7rem;color:var(--muted);margin-top:0.5rem">공개하면 "프로젝트" 메뉴 목록에 누구나 볼 수 있게 떠요</div></div>';

  h+=overviewFieldCard('날짜',pr.target_start_date?(pr.target_start_date+(pr.target_end_date?' ~ '+pr.target_end_date:'')):null,'date','날짜 정하기',ctx.isAdmin);
  h+=overviewFieldCard('작품',pr.work_id?nm(pr.work_id):null,'work','작품 정하기',ctx.isAdmin,pr.work_id?{action:'work',id:pr.work_id}:null);
  h+=overviewFieldCard('단체',pr.troupe_id?nm(pr.troupe_id):null,'troupe','단체 정하기',ctx.isAdmin,pr.troupe_id?{action:'troupe',id:pr.troupe_id}:null);
  h+=overviewFieldCard('극장',pr.venue_id?nm(pr.venue_id):null,'venue','극장 정하기',ctx.isAdmin,pr.venue_id?{action:'venue',id:pr.venue_id}:null);
  h+=overviewFieldCard('라이선스',pr.is_licensed,'license','라이선스 정하기',ctx.isAdmin);

  h+='<div class="person-side-card"><div class="person-side-title">관리자</div><div id="overview-admin-list" style="font-size:0.85rem">불러오는 중…</div>'
    +'<button class="pf-btn" style="margin-top:0.7rem;width:100%" onclick="switchProjectTab(\'team\')">전체 팀 보기 →</button></div>';

  if(ctx.isAdmin){
    h+='<div class="person-side-card"><div class="person-side-title">모집 공개</div>'
      +'<label class="proj-toggle-row"><input type="checkbox" '+(pr.is_recruiting?'checked':'')+' onchange="toggleRecruiting(\''+pid+'\',this.checked)">빈 자리를 "프로젝트" 메뉴에 공개</label>'
      +(ctx.isOwner?'<label class="proj-toggle-row"><input type="checkbox" '+(pr.budget_visible_to_members?'checked':'')+' onchange="toggleBudgetVisible(\''+pid+'\',this.checked)">일반 멤버에게도 예산 탭 공개</label>':'')
      +'</div>';
  }
  h+='</div>';
  el.innerHTML=h;
  loadOverviewAdminList(pid);
}
function overviewFieldCard(label,value,wizardStep,ctaLabel,canEdit,linkTo){
  var valueH=value?(linkTo?('<span class="link" data-action="'+linkTo.action+'" data-id="'+linkTo.id+'">'+escHtml(value)+'</span>'):escHtml(value))
    :'<span style="color:var(--muted)">비어있어요</span>';
  return '<div class="person-side-card"><div class="person-side-title">'+label+'</div><div style="font-size:0.9rem">'+valueH+'</div>'
    +(canEdit?'<button class="pf-btn" style="margin-top:0.6rem;width:100%" onclick=\'openProjectWizard("'+window._projectCtx.pid+'",["'+wizardStep+'"])\'>'+(value?'변경':ctaLabel)+'</button>':'')
    +'</div>';
}
async function toggleProjectPublic(pid,on){
  try{await sbClient.from('projects').update({is_public:on}).eq('id',pid);window._projectCtx.pr.is_public=on;renderProjectOverview($('project-tab-content'));}
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
      return '<div style="margin-bottom:0.35rem">'+(m.member_role==='owner'?'👑 ':'')+nameH+'</div>';
    }).join('')||'<span style="color:var(--muted)">없음</span>';
  }catch(e){el.innerHTML='<span style="color:var(--muted)">불러오기 실패</span>';}
}
async function toggleBudgetVisible(pid,on){
  try{await sbClient.from('projects').update({budget_visible_to_members:on}).eq('id',pid);window._projectCtx.pr.budget_visible_to_members=on;}
  catch(e){oriAlert('변경 실패: '+e.message);}
}
function renderProjectRequests(el){
  var pid=window._projectCtx.pid;
  el.innerHTML='<div class="sec"><div class="sec-label">참여 요청</div><div id="join-requests-list">불러오는 중…</div></div>';
  loadJoinRequests(pid);
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
  }catch(e){var el=$('project-tab-content');if(el)el.innerHTML='<div style="font-size:0.82rem;color:var(--muted)">불러오기 실패: '+e.message+'</div>';}
}
function renderProjectActorTab(el){
  el.innerHTML='<div id="actor-tab-body">불러오는 중…</div>';
  loadProjectPositionsData(window._projectCtx.pid,renderActorTabBody);
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
      :'<div style="font-size:0.78rem;color:var(--muted)">작품을 연결하면 배역이 자동으로 여기 떠요. 개요 탭에서 작품을 먼저 정해주세요.</div>';
  }
  el.innerHTML='<div>'+rowsH+'</div>'+infoReportPrompt('배역','role');
}
function renderProjectCrewTab(el){
  el.innerHTML='<div id="crew-tab-body">불러오는 중…</div>';
  loadProjectPositionsData(window._projectCtx.pid,renderCrewTabBody);
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
function renderProjectPromoTab(el){
  var ctx=window._projectCtx;var pid=ctx.pid,pr=ctx.pr;
  var links=pr.promo_links||[];
  el.innerHTML='<div class="edit-modal-field"><label>홍보 소개문구</label><textarea id="promo-note" rows="4" placeholder="공연을 한 줄로 소개하는 문구, 시놉시스 요약 등">'+escHtml(pr.promo_note||'')+'</textarea></div>'
    +'<button class="pf-btn pf-active" onclick="savePromoNote(\''+pid+'\')">저장</button>'
    +'<div id="promo-note-msg" style="font-size:0.75rem;color:var(--muted);margin-top:0.4rem"></div>'
    +'<div class="sec" style="margin-top:1.6rem"><div class="sec-label">홍보 링크</div>'
    +'<div id="promo-links-list">'+links.map(function(l,i){
      return '<div class="proj-member-row"><a href="'+escHtml(l)+'" target="_blank" rel="noopener noreferrer" style="color:var(--accent);font-size:0.82rem;word-break:break-all">'+escHtml(l)+'</a>'
        +'<button class="proj-icon-btn" style="margin-left:auto;position:static" onclick="removePromoLink(\''+pid+'\','+i+')" title="삭제">🗑</button></div>';
    }).join('')+'</div>'
    +'<div style="display:flex;gap:0.5rem;margin-top:0.6rem">'
    +'<input type="text" id="promo-link-input" class="wizard-search" style="margin-bottom:0" placeholder="SNS 게시물, 포스터 이미지, 티켓 예매 링크 등 URL">'
    +'<button class="pf-btn pf-active" onclick="addPromoLink(\''+pid+'\')">추가</button></div></div>';
}
async function savePromoNote(pid){
  try{
    await sbClient.from('projects').update({promo_note:$('promo-note').value.trim()||null}).eq('id',pid);
    window._projectCtx.pr.promo_note=$('promo-note').value.trim();
    $('promo-note-msg').textContent='저장됐어요.';
  }catch(e){$('promo-note-msg').textContent='저장 실패: '+e.message;}
}
async function addPromoLink(pid){
  var input=$('promo-link-input');
  var url=input.value.trim();
  if(!url){return;}
  if(!/^https?:\/\//i.test(url))url='https://'+url;
  var links=(window._projectCtx.pr.promo_links||[]).concat([url]);
  try{
    await sbClient.from('projects').update({promo_links:links}).eq('id',pid);
    window._projectCtx.pr.promo_links=links;
    renderProjectPromoTab($('project-tab-content'));
  }catch(e){oriAlert('추가 실패: '+e.message);}
}
async function removePromoLink(pid,idx){
  var links=(window._projectCtx.pr.promo_links||[]).slice();
  links.splice(idx,1);
  try{
    await sbClient.from('projects').update({promo_links:links}).eq('id',pid);
    window._projectCtx.pr.promo_links=links;
    renderProjectPromoTab($('project-tab-content'));
  }catch(e){oriAlert('삭제 실패: '+e.message);}
}
function renderProjectVenueTab(el){
  var ctx=window._projectCtx;var pid=ctx.pid,pr=ctx.pr;
  el.innerHTML=
    '<div class="sec"><div class="sec-label">조건으로 찾기</div>'
    +'<div style="font-size:0.72rem;color:var(--muted);margin-bottom:0.8rem">참고: 실제 대관 가능 날짜는 극장에 직접 문의가 필요해요. 여긴 좌석수·대관료 정보만 필터할 수 있어요.</div>'
    +'<div style="display:flex;gap:0.6rem;flex-wrap:wrap;margin-bottom:1rem">'
    +'<input type="number" id="venue-filter-seats" class="wizard-search" style="width:auto;flex:1;min-width:140px;margin-bottom:0" placeholder="필요 객석수 (예: 100)" oninput="renderVenueFilterResults()">'
    +'<input type="text" id="venue-filter-keyword" class="wizard-search" style="width:auto;flex:1;min-width:140px;margin-bottom:0" placeholder="극장명 검색..." oninput="renderVenueFilterResults()">'
    +'</div>'
    +'<div id="venue-filter-results" class="project-card-grid"></div></div>'
    +'<div class="sec" style="margin-top:2rem"><div class="sec-label">후보로 담은 극장</div><div id="venue-candidates-list">불러오는 중…</div></div>';
  renderVenueFilterResults();
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
  if(!list.length){el.innerHTML='<div style="font-size:0.82rem;color:var(--muted)">조건에 맞는 극장이 없어요.</div>';return;}
  el.innerHTML=list.map(function(v){
    var seatsLabel=venueSeatsLabel(v);
    var fee=fld(v,'대관료');
    return '<div class="item-card"><div class="item-card-title">'+escHtml(fld(v,'극장명'))+'</div>'
      +'<div style="font-size:0.76rem;color:var(--muted);margin:0.4rem 0 0.8rem">'+(seatsLabel?'좌석 '+seatsLabel+'<br>':'')+(fee?'대관료 '+escHtml(String(fee)):'')+'</div>'
      +'<button class="pf-btn" onclick="addVenueCandidateFromFilter(\''+v.id+'\')">+ 후보에 담기</button></div>';
  }).join('');
}
async function addVenueCandidateFromFilter(vid){
  var pid=window._projectCtx.pid;
  try{await sbClient.from('project_venue_candidates').insert({project_id:pid,venue_id:vid,status:'considering'});}catch(e){}
  loadVenueCandidatesList(pid);
}
var VENUE_CAND_STATUS_LABEL={considering:'후보',reviewing:'고려중',selected:'최종 선택'};
async function loadVenueCandidatesList(pid){
  var el=$('venue-candidates-list');if(!el)return;
  try{
    var r=await sbClient.from('project_venue_candidates').select('*').eq('project_id',pid).order('created_at',{ascending:true});
    var rows=r.data||[];
    if(!rows.length){el.innerHTML='<div style="font-size:0.82rem;color:var(--muted)">아직 담아둔 극장이 없어요. 위에서 조건으로 찾아 담아보세요.</div>';return;}
    el.innerHTML='<div class="project-members-grid">'+rows.map(function(c){
      var venue=DB.venues.find(function(v){return v.id===c.venue_id;});
      if(!venue)return '';
      var seats=venueSeatsLabel(venue);
      return '<div class="person-side-card'+(c.status==='selected'?' venue-cand-selected':'')+'">'
        +'<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:0.5rem">'
        +'<span class="link" data-action="venue" data-id="'+venue.id+'">'+escHtml(fld(venue,'극장명'))+'</span>'
        +'<button class="proj-icon-btn" style="position:static" onclick="removeVenueCandidate(\''+c.id+'\',\''+pid+'\')" title="제거">🗑</button>'
        +'</div>'
        +(seats?'<div style="font-size:0.76rem;color:var(--muted);margin-top:0.3rem">좌석 '+seats+'</div>':'')
        +'<select class="wizard-search" style="margin:0.6rem 0 0;padding:0.35rem 0.5rem;font-size:0.78rem" onchange="setVenueCandStatus(\''+c.id+'\',\''+pid+'\',\''+venue.id+'\',this.value)">'
        +Object.keys(VENUE_CAND_STATUS_LABEL).map(function(k){return '<option value="'+k+'"'+(c.status===k?' selected':'')+'>'+VENUE_CAND_STATUS_LABEL[k]+'</option>';}).join('')
        +'</select></div>';
    }).join('')+'</div>';
  }catch(e){el.innerHTML='<div style="font-size:0.82rem;color:var(--muted)">불러오기 실패</div>';}
}
async function setVenueCandStatus(candId,pid,venueId,status){
  try{
    if(status==='selected')await sbClient.rpc('select_project_venue',{p_project_id:pid,p_venue_id:venueId});
    else await sbClient.from('project_venue_candidates').update({status:status}).eq('id',candId);
    window._projectCtx.pr.venue_id=status==='selected'?venueId:window._projectCtx.pr.venue_id;
    loadVenueCandidatesList(pid);
  }catch(e){oriAlert('변경 실패: '+e.message);}
}
async function removeVenueCandidate(candId,pid){
  try{await sbClient.from('project_venue_candidates').delete().eq('id',candId);loadVenueCandidatesList(pid);}
  catch(e){oriAlert('삭제 실패: '+e.message);}
}
var PROJECT_TEAM_SUBTABS=[['people','사람'],['orgs','단체']];
window._teamSubTab=window._teamSubTab||'people';
function renderProjectTeamTab(el){
  el.innerHTML='<div class="mypage-tabs" style="margin-bottom:1.4rem;border-bottom:1px solid var(--line)">'+PROJECT_TEAM_SUBTABS.map(function(t){
      return '<button class="mypage-tab-btn'+(window._teamSubTab===t[0]?' active':'')+'" onclick="switchTeamSubTab(\''+t[0]+'\')" style="font-size:0.8rem">'+t[1]+'</button>';
    }).join('')+'</div>'
    +'<div id="team-subtab-body">불러오는 중…</div>';
  loadProjectPositionsData(window._projectCtx.pid,renderTeamSubTabBody);
}
function switchTeamSubTab(tab){
  window._teamSubTab=tab;
  renderProjectTeamTab($('project-tab-content'));
}
function renderTeamSubTabBody(){
  var el=$('team-subtab-body');if(!el)return;
  var ctx=window._projectCtx;var pid=ctx.pid,pr=ctx.pr;
  var sub=window._teamSubTab;
  if(sub==='people'){
    var rows=ctx.memberDetail||[];
    var roleLabel={owner:'👑 대표 관리자',admin:'관리자',member:'멤버'};
    var byMember={};var order=[];
    rows.forEach(function(m){
      if(!byMember[m.member_id]){byMember[m.member_id]=Object.assign({},m,{positionLabels:[]});order.push(m.member_id);}
      var posLabel=m.staff_role_name||m.position_label;
      if(posLabel)byMember[m.member_id].positionLabels.push(posLabel);
    });
    var uniqueRows=order.map(function(id){return byMember[id];});
    el.innerHTML='<div>'+(uniqueRows.map(function(m){
      var nameH=m.person_id?'<span class="link" data-action="person" data-id="'+m.person_id+'">'+escHtml(m.nickname||m.email)+'</span>':escHtml(m.nickname||m.email);
      var adminToggle=(ctx.isOwner&&m.member_role!=='owner')?('<button class="pf-btn" style="padding:0.15rem 0.5rem;font-size:0.68rem;margin-left:0.6rem" onclick="toggleMemberAdmin(\''+m.member_id+'\','+(m.member_role==='admin'?'false':'true')+',\''+pid+'\')">'+(m.member_role==='admin'?'관리자 해제':'관리자로 지정')+'</button>'):'';
      var rolesH=m.positionLabels.length?('<span style="color:var(--muted);font-size:0.76rem;margin-left:0.5rem">'+m.positionLabels.map(escHtml).join(', ')+'</span>'):'';
      return '<div class="proj-member-row"><span class="status-chip" style="font-size:0.68rem;padding:0.15rem 0.55rem">'+roleLabel[m.member_role]+'</span><span style="margin-left:0.6rem">'+nameH+'</span>'+rolesH+adminToggle+'</div>';
    }).join('')||'<div style="font-size:0.82rem;color:var(--muted)">구성원이 없어요.</div>')+'</div>';
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
function slotRowsFor(kind,pid,refId,label,matchedPositions,emailByMemberId){
  matchedPositions=matchedPositions||[];
  var filled=matchedPositions.filter(function(p){return p.status==='filled'&&p.assigned_member_id;});
  var openOrClosed=matchedPositions.filter(function(p){return p.status!=='filled';});
  var h='';
  filled.forEach(function(pos){
    var email=(emailByMemberId&&emailByMemberId[pos.assigned_member_id])||'참여자';
    h+='<div class="proj-member-row"><span class="proj-slot-filled-dot"></span><span class="proj-slot-label">'+escHtml(label)+'</span><span style="margin-left:auto;color:var(--muted);font-size:0.78rem">'+email+'</span>'
      +((kind==='role'||kind==='staff')?'<button class="pf-btn" style="margin-left:0.4rem;padding:0.15rem 0.45rem;font-size:0.66rem" onclick="addAnotherSlot(\''+pid+'\',\''+kind+'\',\''+refId+'\',\''+escHtml(label).replace(/'/g,"\\'")+'\')" title="한 명 더 캐스팅">+ 더</button>':'')
      +'</div>';
  });
  if(!openOrClosed.length&&!filled.length){
    h+='<div class="proj-member-row"><span class="proj-slot-empty-dot"></span><span class="proj-slot-label">'+escHtml(label)+'</span>'
      +'<span style="margin-left:auto;display:flex;gap:0.3rem;flex-shrink:0">'
      +'<button class="pf-btn" style="padding:0.2rem 0.5rem;font-size:0.68rem" onclick="ensurePositionAndSearch(\''+pid+'\',\''+kind+'\',\''+refId+'\',\''+escHtml(label).replace(/'/g,"\\'")+'\')">사람 찾기</button>'
      +'<button class="pf-btn" style="padding:0.2rem 0.5rem;font-size:0.68rem" onclick="recruitProjectSlot(\''+pid+'\',\''+kind+'\',\''+refId+'\',\''+escHtml(label).replace(/'/g,"\\'")+'\')">자리 열기</button>'
      +'</span></div>';
  }
  openOrClosed.forEach(function(pos){
    if(pos.status==='open'){
      h+='<div class="proj-member-row"><span class="proj-slot-open-dot"></span><span class="proj-slot-label">'+escHtml(label)+'</span><span class="proj-slot-meta">지금 찾고 있어요</span>'
        +'<span style="margin-left:auto;display:flex;gap:0.3rem;flex-shrink:0">'
        +'<button class="pf-btn" style="padding:0.2rem 0.5rem;font-size:0.68rem" onclick="openInvitePicker(\''+pos.id+'\',\''+kind+'\',\''+refId+'\')">사람 찾기</button>'
        +'<button class="pf-btn" style="padding:0.2rem 0.5rem;font-size:0.68rem" onclick="setPositionRecruiting(\''+pos.id+'\',false,\''+pid+'\')">닫기</button>'
        +'</span></div><div id="invite-picker-'+pos.id+'"></div>';
    }else{
      h+='<div class="proj-member-row"><span class="proj-slot-empty-dot"></span><span class="proj-slot-label">'+escHtml(label)+'</span>'
        +'<span style="margin-left:auto;display:flex;gap:0.3rem;flex-shrink:0">'
        +'<button class="pf-btn" style="padding:0.2rem 0.5rem;font-size:0.68rem" onclick="openInvitePicker(\''+pos.id+'\',\''+kind+'\',\''+refId+'\')">사람 찾기</button>'
        +'<button class="pf-btn" style="padding:0.2rem 0.5rem;font-size:0.68rem" onclick="setPositionRecruiting(\''+pos.id+'\',true,\''+pid+'\')">자리 열기</button>'
        +'</span></div><div id="invite-picker-'+pos.id+'"></div>';
    }
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
  el.innerHTML='<div class="wizard-result-empty">불러오는 중…</div>';
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
    await sbClient.rpc('invite_person_to_position',{p_position_id:posId,p_person_id:personId,p_message:msg});
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
    await sbClient.from('project_positions').insert(row).select();
  }catch(e){/* 이미 있으면 무시 */}
  try{await sbClient.from('projects').update({is_recruiting:true}).eq('id',pid);window._projectCtx.pr.is_recruiting=true;}catch(e){}
  loadProjectMembersDetail(pid);
}
var BUDGET_PRESETS={
  expense:{
    '대관':['극장 대관료','연습실 대관료'],
    '인건비':['배우 사례비','스태프 사례비','연출료'],
    '무대/미술':['무대장치','소품','세트 제작'],
    '의상/분장':['의상 제작·대여','분장품'],
    '조명/음향':['조명 장비 대여','음향 장비 대여'],
    '홍보':['포스터·전단 인쇄','SNS 광고','사진·영상 촬영'],
    '티켓팅':['예매 수수료'],
    '기타':['예비비','잡비']
  },
  income:{
    '티켓':['현장 판매','온라인 예매'],
    '후원':['개인 후원','기업 협찬'],
    '펀딩':['크라우드펀딩'],
    '기타':['기타 수입']
  }
};
var BUDGET_TEMPLATE={
  expense:[['대관','극장 대관료'],['인건비','배우 사례비'],['무대/미술','무대장치'],['의상/분장','의상 제작·대여'],['조명/음향','조명 장비 대여'],['홍보','포스터·전단 인쇄'],['티켓팅','예매 수수료'],['기타','예비비']],
  income:[['티켓','현장 판매'],['후원','개인 후원'],['펀딩','크라우드펀딩'],['기타','기타 수입']]
};
function renderProjectBudget(el){
  var pid=window._projectCtx.pid;
  el.innerHTML='<div id="budget-balance-bar" class="budget-balance-bar"></div>'
    +'<div class="budget-2col">'
    +'<div class="budget-col"><div class="proj-member-group-title">수입</div><div id="budget-income-total" class="budget-col-total"></div><div id="budget-income-list">불러오는 중…</div>'
    +'<button class="pf-btn" style="margin-top:0.5rem;width:100%" onclick="addBudgetRow(\''+pid+'\',\'income\')">+ 수입 행 추가</button></div>'
    +'<div class="budget-col"><div class="proj-member-group-title">지출</div><div id="budget-expense-total" class="budget-col-total"></div><div id="budget-expense-list">불러오는 중…</div>'
    +'<button class="pf-btn" style="margin-top:0.5rem;width:100%" onclick="addBudgetRow(\''+pid+'\',\'expense\')">+ 지출 행 추가</button></div>'
    +'</div>'
    +'<div style="text-align:center;margin-top:1.4rem"><button class="pf-btn" onclick="fillBudgetTemplate(\''+pid+'\')">표준 항목으로 채우기</button></div>';
  loadProjectBudget(pid);
}
function budgetDatalistOptions(type,category,projectRows){
  var presetCats=Object.keys(BUDGET_PRESETS[type]||{});
  var usedCats=projectRows.filter(function(b){return b.item_type===type&&b.category;}).map(function(b){return b.category;});
  var allCats=presetCats.concat(usedCats).filter(function(v,i,a){return a.indexOf(v)===i;});
  var presetItems=(BUDGET_PRESETS[type]&&BUDGET_PRESETS[type][category])||[];
  var usedItems=projectRows.filter(function(b){return b.item_type===type&&(!category||b.category===category)&&b.item_name;}).map(function(b){return b.item_name;});
  var allItems=presetItems.concat(usedItems).filter(function(v,i,a){return a.indexOf(v)===i;});
  return {cats:allCats,items:allItems};
}
function budgetTableHtml(items,pid,type,allRows){
  var h='<div class="budget-table-wrap"><datalist id="budget-cat-list-'+type+'">'+budgetDatalistOptions(type,null,allRows).cats.map(function(c){return '<option value="'+escHtml(c)+'">';}).join('')+'</datalist>';
  if(!items.length)return h+'<div style="font-size:0.78rem;color:var(--muted)">아직 없어요.</div></div>';
  h+='<table class="budget-table"><thead><tr><th>대항목</th><th>소항목</th><th>상세내용</th><th>금액</th><th></th></tr></thead><tbody>';
  h+=items.map(function(b){
    var itemOpts=budgetDatalistOptions(type,b.category,allRows).items;
    return '<tr>'
      +'<td><input list="budget-cat-list-'+type+'" value="'+escHtml(b.category||'')+'" maxlength="10" onchange="onBudgetCategoryChange(\''+b.id+'\',\''+pid+'\',\''+type+'\',this.value)" onblur="saveBudgetField(\''+b.id+'\',\'category\',this.value,\''+pid+'\')"></td>'
      +'<td><input list="budget-item-list-'+b.id+'" value="'+escHtml(b.item_name||'')+'" maxlength="10" onblur="saveBudgetField(\''+b.id+'\',\'item_name\',this.value,\''+pid+'\')">'
        +'<datalist id="budget-item-list-'+b.id+'">'+itemOpts.map(function(i){return '<option value="'+escHtml(i)+'">';}).join('')+'</datalist></td>'
      +'<td><input value="'+escHtml(b.notes||'')+'" onblur="saveBudgetField(\''+b.id+'\',\'notes\',this.value,\''+pid+'\')" placeholder="상세 내용"></td>'
      +'<td><input value="'+(b.planned_amount!=null?Number(b.planned_amount).toLocaleString():'')+'" inputmode="numeric" style="width:90px;text-align:right" onblur="saveBudgetAmount(\''+b.id+'\',this,\''+pid+'\')" placeholder="0"></td>'
      +'<td><button class="proj-icon-btn" style="position:static" onclick="deleteBudgetItem(\''+b.id+'\',\''+pid+'\')" title="삭제">🗑</button></td>'
      +'</tr>';
  }).join('')+'</tbody></table></div>';
  return h;
}
function onBudgetCategoryChange(id,pid,type,category){
  // 카테고리 바뀌면 다음 로드 때 그 카테고리 기준 소항목 추천이 갱신됨 (즉시 반영 위해 저장 후 재로딩)
  saveBudgetField(id,'category',category,pid).then(function(){loadProjectBudget(pid);});
}
async function loadProjectBudget(pid){
  var expEl=$('budget-expense-list'),incEl=$('budget-income-list');if(!expEl||!incEl)return;
  try{
    var r=await sbClient.from('project_budget_items').select('*').eq('project_id',pid).order('created_at',{ascending:true});
    var rows=r.data||[];
    expEl.innerHTML=budgetTableHtml(rows.filter(function(b){return b.item_type==='expense';}),pid,'expense',rows);
    incEl.innerHTML=budgetTableHtml(rows.filter(function(b){return b.item_type==='income';}),pid,'income',rows);
    var incomeTotal=rows.filter(function(b){return b.item_type==='income';}).reduce(function(s,b){return s+(Number(b.planned_amount)||0);},0);
    var expenseTotal=rows.filter(function(b){return b.item_type==='expense';}).reduce(function(s,b){return s+(Number(b.planned_amount)||0);},0);
    var balance=incomeTotal-expenseTotal;
    var incTotalEl=$('budget-income-total'),expTotalEl=$('budget-expense-total'),balEl=$('budget-balance-bar');
    if(incTotalEl)incTotalEl.innerHTML='<div class="budget-col-total-num budget-col-income">'+incomeTotal.toLocaleString()+'원</div>';
    if(expTotalEl)expTotalEl.innerHTML='<div class="budget-col-total-num budget-col-expense">'+expenseTotal.toLocaleString()+'원</div>';
    if(balEl)balEl.innerHTML='현재 잔액 <b class="'+(balance>=0?'budget-col-balance-pos':'budget-col-balance-neg')+'">'+balance.toLocaleString()+'원</b>';
  }catch(e){expEl.innerHTML=incEl.innerHTML='<div style="font-size:0.82rem;color:var(--muted)">불러오기 실패</div>';}
}
function saveBudgetField(id,field,value,pid){
  var patch={};patch[field]=value||null;
  return sbClient.from('project_budget_items').update(patch).eq('id',id).then(function(r){if(r.error)oriAlert('저장 실패: '+r.error.message);});
}
async function saveBudgetAmount(id,input,pid){
  var raw=input.value.replace(/[^0-9]/g,'');
  var num=raw?Number(raw):null;
  try{await sbClient.from('project_budget_items').update({planned_amount:num}).eq('id',id);}catch(e){oriAlert('저장 실패: '+e.message);return;}
  loadProjectBudget(pid);
}
async function addBudgetRow(pid,type){
  try{
    await sbClient.from('project_budget_items').insert({project_id:pid,item_type:type,item_name:'새 항목'});
    loadProjectBudget(pid);
  }catch(e){oriAlert('추가 실패: '+e.message);}
}
async function deleteBudgetItem(id,pid){
  if(!await oriConfirm('삭제할까요?'))return;
  try{await sbClient.from('project_budget_items').delete().eq('id',id);loadProjectBudget(pid);}
  catch(e){oriAlert('삭제 실패: '+e.message);}
}
async function fillBudgetTemplate(pid){
  if(!await oriConfirm('일반적인 공연 준비에 필요한 표준 항목들을 채워둘게요. 계속할까요?'))return;
  try{
    var rows=[];
    BUDGET_TEMPLATE.expense.forEach(function(t){rows.push({project_id:pid,item_type:'expense',category:t[0],item_name:t[1]});});
    BUDGET_TEMPLATE.income.forEach(function(t){rows.push({project_id:pid,item_type:'income',category:t[0],item_name:t[1]});});
    await sbClient.from('project_budget_items').insert(rows);
    loadProjectBudget(pid);
  }catch(e){oriAlert('채우기 실패: '+e.message);}
}
