/* 오리 사이트 — 프로젝트 둘러보기 (공개 프로젝트, 모집 중인 자리) */
/* ── 프로젝트 둘러보기 (모집중인 빈 자리) ── */
var _browseProjectsRaw=[],_browseProjectFilter='all';
var _browseRecruitingRaw=[],_browseRecruitFilter='all';
async function goProjectBrowse(push){
  if(push!==false)history.pushState({view:'projects'},'','#projects');
  setNav('projects');sb('');_sbContext='';mobShowDetail();
  if(!CURRENT_USER){mn('<div class="tab-index"><div class="result-empty">로그인이 필요해요</div></div>');return;}
  var statusOptions=[['all','전체 상태']].concat(Object.keys(PROJECT_STATUS_LABEL).map(function(k){return [k,PROJECT_STATUS_LABEL[k]];}));
  var recruitTypeOptions=[['all','전체 유형'],['actor','배우'],['staff','스태프'],['other','기타']];
  mn('<div class="tab-index"><div class="project-browse-grid">'
    +'<div class="project-browse-col">'
      +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.8rem;flex-wrap:wrap;gap:0.5rem">'
      +'<span class="sec-label" style="margin-bottom:0">프로젝트 목록<span style="font-size:0.7rem;color:var(--muted);font-weight:400;margin-left:0.4rem">공개로 설정된 프로젝트예요</span></span>'
      +'<button class="pf-btn pf-active" onclick="startNewProject()">+ 새 프로젝트 시작하기</button>'
      +'</div>'
      +'<div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.8rem">'
      +'<select class="wizard-search" style="width:auto;margin-bottom:0" onchange="setBrowseProjectFilter(this.value)">'
      +statusOptions.map(function(o){return '<option value="'+o[0]+'">'+o[1]+'</option>';}).join('')
      +'</select>'
      +'<input type="text" class="wizard-search" style="width:auto;flex:1;min-width:120px;margin-bottom:0" placeholder="제목·단체·작품 검색..." oninput="setBrowseProjectSearch(this.value)">'
      +'</div>'
      +'<div id="browse-public-projects-list" class="project-card-grid">불러오는 중…</div>'
    +'</div>'
    +'<div class="project-browse-col">'
      +'<span class="sec-label">모집 중인 자리</span>'
      +'<div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.8rem">'
      +'<select class="wizard-search" style="width:auto;margin-bottom:0" onchange="setBrowseRecruitFilter(this.value)">'
      +recruitTypeOptions.map(function(o){return '<option value="'+o[0]+'">'+o[1]+'</option>';}).join('')
      +'</select>'
      +'<input type="text" class="wizard-search" style="width:auto;flex:1;min-width:120px;margin-bottom:0" placeholder="프로젝트·자리명 검색..." oninput="setBrowseRecruitSearch(this.value)">'
      +'</div>'
      +'<div id="browse-positions-list" class="project-card-grid">불러오는 중…</div>'
    +'</div>'
    +'</div></div>');
  loadBrowsePublicProjects();
  loadBrowseRecruiting();
}
var _browseProjectSearch='',_browseRecruitSearch='';
function setBrowseProjectSearch(v){_browseProjectSearch=v.trim().toLowerCase();renderBrowsePublicProjects();}
function setBrowseRecruitSearch(v){_browseRecruitSearch=v.trim().toLowerCase();renderBrowseRecruiting();}
async function loadBrowsePublicProjects(){
  try{
    var r=await sbClient.rpc('list_public_projects');
    _browseProjectsRaw=r.data||[];
    renderBrowsePublicProjects();
  }catch(e){var el=$('browse-public-projects-list');if(el)el.innerHTML='<div style="font-size:0.82rem;color:var(--muted)">불러오지 못했어요.</div>';}
}
function setBrowseProjectFilter(v){_browseProjectFilter=v;renderBrowsePublicProjects();}
function renderBrowsePublicProjects(){
  var el=$('browse-public-projects-list');if(!el)return;
  var rows=_browseProjectsRaw||[];
  if(_browseProjectFilter&&_browseProjectFilter!=='all')rows=rows.filter(function(p){return p.status===_browseProjectFilter;});
  if(_browseProjectSearch)rows=rows.filter(function(p){
    return (p.title||'').toLowerCase().indexOf(_browseProjectSearch)>-1
      ||(p.troupe_name||'').toLowerCase().indexOf(_browseProjectSearch)>-1
      ||(p.work_name||'').toLowerCase().indexOf(_browseProjectSearch)>-1;
  });
  if(!rows.length){el.innerHTML='<div style="font-size:0.82rem;color:var(--muted)">해당하는 프로젝트가 없어요.</div>';return;}
  el.innerHTML=rows.map(function(p){
    var ownerNameH=p.owner_person_id?('<span class="link" data-action="person" data-id="'+p.owner_person_id+'" onclick="event.stopPropagation()">'+escHtml(p.owner_nickname||p.owner_email)+'</span>'):escHtml(p.owner_nickname||p.owner_email);
    return '<div class="item-card proj-card" style="cursor:pointer" onclick="goProject(\''+p.id+'\')">'
      +'<div class="item-card-title" style="display:flex;justify-content:space-between;align-items:center;gap:0.4rem">'+escHtml(p.title||'새 프로젝트')+'<span class="status-chip '+(PROJECT_STATUS_CHIP_CLASS[p.status]||'')+'" style="font-size:0.62rem;padding:0.15rem 0.55rem">'+(PROJECT_STATUS_LABEL[p.status]||p.status)+'</span></div>'
      +'<div style="font-size:0.76rem;color:var(--muted);margin-top:0.5rem;line-height:1.7">'
      +(p.work_name?'작품 '+escHtml(p.work_name)+'<br>':'')
      +(p.troupe_name?'단체 '+escHtml(p.troupe_name)+'<br>':'')
      +'관리자 '+ownerNameH
      +'</div></div>';
  }).join('');
}
var POSITION_TYPE_LABEL={actor:'배우 모집',staff:'스태프 모집',other:'기타 모집'};
async function loadBrowseRecruiting(){
  try{
    var r=await sbClient.rpc('browse_recruiting_positions');
    _browseRecruitingRaw=r.data||[];
    renderBrowseRecruiting();
  }catch(e){var el=$('browse-positions-list');if(el)el.innerHTML='<div style="font-size:0.82rem;color:var(--muted)">불러오지 못했어요.</div>';}
}
function setBrowseRecruitFilter(v){_browseRecruitFilter=v;renderBrowseRecruiting();}
function renderBrowseRecruiting(){
  var el=$('browse-positions-list');if(!el)return;
  var rows=_browseRecruitFilter==='all'?_browseRecruitingRaw:_browseRecruitingRaw.filter(function(p){return p.position_type===_browseRecruitFilter;});
  if(!rows.length){el.innerHTML='<div style="font-size:0.82rem;color:var(--muted)">지금은 모집 중인 자리가 없어요.</div>';return;}
  el.innerHTML=rows.map(function(p){
    return '<div class="item-card" style="margin-bottom:0.6rem">'
      +'<div style="font-size:0.68rem;color:var(--accent);margin-bottom:0.3rem">'+(POSITION_TYPE_LABEL[p.position_type]||p.position_type)+'</div>'
      +'<div class="item-card-title">'+escHtml(p.position_label||p.position_type)+'</div>'
      +'<div style="font-size:0.78rem;color:var(--muted);margin:0.3rem 0 0.8rem">'+escHtml(p.project_title)
      +(p.has_troupe?'':'<br>단체를 찾고 있어요')
      +(p.has_venue?'':'<br>극장을 찾고 있어요')
      +'</div>'
      +'<button class="pf-btn" onclick="requestJoinPosition(\''+p.project_id+'\',\''+p.position_id+'\')">참여 요청하기</button></div>';
  }).join('');
}
async function requestJoinPosition(projectId,positionId){
  var msg= await oriPrompt('간단한 소개나 하고 싶은 말을 남겨주세요 (선택)');
  if(msg===null)return;
  try{
    await sbClient.from('project_join_requests').insert({project_id:projectId,position_id:positionId,user_id:CURRENT_USER.id,message:msg||null});
    oriAlert('요청 보냈어요! 프로젝트 관리자가 확인하면 연락드릴 거예요.');
  }catch(e){oriAlert('요청 중 문제가 생겼어요: '+e.message);}
}
