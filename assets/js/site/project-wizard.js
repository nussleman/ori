/* 오리 사이트 — 프로젝트 위저드 (단계별 질문 카드) */
/* ══ 프로젝트 위저드: 화면 중앙 고정 카드에서 단계별로 이어서 질문 ══ */
var WIZARD_STEP_LABEL={venue:'극장',troupe:'단체',work:'작품',date:'날짜',license:'라이선스',name:'이름',visibility:'공개여부'};
var WIZARD_STEP_FIELD={venue:'극장명',troupe:'극단명',work:'작품명'};
var _wizardPid=null,_wizardSteps=[],_wizardStepIdx=0,_wizardMemberId=null;
var _wizardCompleted=false,_wizardIsCreation=false;
function openProjectWizard(pid,steps,memberId){
  _wizardPid=pid;_wizardSteps=steps;_wizardStepIdx=0;_wizardMemberId=memberId||null;
  _wizardCompleted=false;_wizardIsCreation=(steps[0]==='name');
  $('wizard-overlay').classList.add('open');
  renderWizardStep();
}
async function closeWizard(){
  if(_wizardIsCreation&&!_wizardCompleted){
    if(!await oriConfirm('여기까지 만든 프로젝트를 취소할까요? 지금까지 입력한 내용은 사라져요.'))return;
    $('wizard-overlay').classList.remove('open');
    try{await sbClient.from('projects').delete().eq('id',_wizardPid);}catch(e){}
    loadMyProjectsCache();
    goMyShows();
    return;
  }
  $('wizard-overlay').classList.remove('open');
  var roleIdx=_wizardSteps.indexOf('role');
  var roleNotAnsweredYet=(roleIdx>-1&&_wizardStepIdx<=roleIdx);
  if(roleNotAnsweredYet){goMyShows();}
  else if(_wizardPid){goProject(_wizardPid);}
}
function wizardFinish(){
  $('wizard-overlay').classList.remove('open');
  if(_wizardPid)goProject(_wizardPid);
}
function wizardNext(){
  _wizardStepIdx++;
  if(_wizardStepIdx>=_wizardSteps.length){wizardShowDone();return;}
  renderWizardStep();
}
function wizardBack(){
  if(_wizardStepIdx<=0)return;
  _wizardStepIdx--;
  renderWizardStep();
}
function wizardShowDone(){
  _wizardCompleted=true;
  var content=$('wizard-content');
  content.style.opacity=0;
  setTimeout(function(){
    content.innerHTML='<div class="wizard-done"><div class="wizard-done-icon">✓</div><div class="wizard-question" style="font-size:1rem">여기까지 답한 내용이 저장됐어요</div>'
      +'<button class="pf-btn pf-active" style="width:100%" onclick="wizardFinish()">확인</button></div>';
    $('wizard-progress').textContent='완료';
    $('wizard-back-btn').classList.remove('show');
    content.style.opacity=1;
  },200);
}
function renderWizardStep(){
  var step=_wizardSteps[_wizardStepIdx];
  var content=$('wizard-content');
  content.style.opacity=0;
  setTimeout(function(){
    content.innerHTML=buildWizardStepHtml(step);
    $('wizard-progress').textContent=(_wizardStepIdx+1)+' / '+_wizardSteps.length;
    $('wizard-back-btn').classList.toggle('show',_wizardStepIdx>0);
    content.style.opacity=1;
    var input=$('wizard-search')||$('wizard-name-input');if(input)input.focus();
  },200);
}
function buildWizardStepHtml(step){
  if(step==='name')return wizardNameStepHtml();
  if(step==='visibility')return wizardVisibilityStepHtml();
  if(step==='role')return wizardRoleStepHtml();
  if(step==='members')return wizardMembersStepHtml();
  if(step==='date')return wizardDateStepHtml();
  if(step==='license')return wizardLicenseStepHtml();
  var label=WIZARD_STEP_LABEL[step];
  var q=step==='venue'?'극장은 정해졌나요?':step==='troupe'?'함께하는 단체는 정해졌나요?':'올릴 작품은 정해졌나요?';
  return '<div class="wizard-question">'+q+'</div>'
    +'<input type="text" class="wizard-search" id="wizard-search" placeholder="'+label+' 이름으로 검색..." oninput="wizardFilterList(this.value)">'
    +'<div class="wizard-results" id="wizard-results"></div>'
    +'<button class="wizard-skip-btn" onclick="wizardSkip()">아직 안 정해졌어요, 나중에 할게요</button>';
}
function wizardNameStepHtml(){
  return '<div class="wizard-question">프로젝트 이름을 정해주세요</div>'
    +'<div style="font-size:0.78rem;color:var(--muted);margin-bottom:1rem">작품이나 공연명을 적어주세요. 나중에 언제든 바꿀 수 있어요.</div>'
    +'<input type="text" class="wizard-search" id="wizard-name-input" placeholder="예: 지킬앤하이드">'
    +'<button class="pf-btn pf-active" style="width:100%" onclick="wizardSubmitName()">다음</button>';
}
async function wizardSubmitName(){
  var name=($('wizard-name-input').value||'').trim();
  if(!name){oriAlert('이름을 적어주세요.');return;}
  try{await sbClient.from('projects').update({title:name}).eq('id',_wizardPid);}catch(e){oriAlert('저장 실패: '+e.message);return;}
  wizardNext();
}
function wizardVisibilityStepHtml(){
  return '<div class="wizard-question">오리 웹사이트에 공개할까요?</div>'
    +'<div style="font-size:0.78rem;color:var(--muted);margin-bottom:1rem">공개하면 "프로젝트" 메뉴에서 누구나 볼 수 있어요. 비공개면 구성원만 볼 수 있고, 나중에 언제든 바꿀 수 있어요.</div>'
    +'<div class="wizard-role-options">'
    +'<button class="wizard-role-btn" onclick="wizardSubmitVisibility(true)">공개할게요</button>'
    +'<button class="wizard-role-btn" onclick="wizardSubmitVisibility(false)">비공개로 할게요</button>'
    +'</div>';
}
async function wizardSubmitVisibility(val){
  try{await sbClient.from('projects').update({is_public:val}).eq('id',_wizardPid);}catch(e){oriAlert('저장 실패: '+e.message);return;}
  wizardNext();
}
function wizardLicenseStepHtml(){
  return '<div class="wizard-question">저작권·라이선스는 어떻게 되나요?</div>'
    +'<div class="wizard-role-options">'
    +'<button class="wizard-role-btn" onclick="wizardSubmitLicense(\'창작\')">직접 창작한 작품이에요</button>'
    +'<button class="wizard-role-btn" onclick="wizardSubmitLicense(\'완료\')">라이선스를 확보했어요</button>'
    +'<button class="wizard-role-btn" onclick="wizardSubmitLicense(\'미확보\')">아직 확보하지 못했어요</button>'
    +'</div>'
    +'<button class="wizard-skip-btn" onclick="wizardSkip()">아직 안 정해졌어요, 나중에 할게요</button>';
}
async function wizardSubmitLicense(val){
  try{await sbClient.from('projects').update({is_licensed:val}).eq('id',_wizardPid);}
  catch(e){oriAlert('저장 실패: '+e.message);return;}
  if(val==='미확보'){
    oriAlert('안내: 라이선스를 확보하지 않은 채로 공연이 진행되어 발생하는 저작권 문제에 대해 오리는 책임지지 않아요. 공연 전 반드시 라이선스를 확보해주세요.');
  }
  wizardNext();
}
function wizardRoleStepHtml(){
  return '<div class="wizard-question">이 프로젝트, 당신이 관리하시나요?</div>'
    +'<div style="font-size:0.78rem;color:var(--muted);margin-bottom:1rem">여기서 답하는 내용은 나중에 팀 탭에서 언제든 바꿀 수 있어요.</div>'
    +'<div class="wizard-role-options">'
    +'<button class="wizard-role-btn" onclick="wizardSubmitRole(\'self\')">네, 제가 관리해요</button>'
    +'<button class="wizard-role-btn" onclick="wizardShowOtherAdminPrompt()">아니요, 다른 분이 담당이에요</button>'
    +'</div><div id="wizard-other-admin"></div>';
}
function wizardShowOtherAdminPrompt(){
  var el=$('wizard-other-admin');if(!el)return;
  el.innerHTML='<input type="text" class="wizard-search" id="wizard-other-admin-search" style="margin-top:0.7rem" placeholder="담당자 이름으로 검색..." oninput="wizardOtherAdminFilter(this.value)">'
    +'<div class="wizard-results" id="wizard-other-admin-results"></div>';
}
function wizardOtherAdminFilter(q){
  var el=$('wizard-other-admin-results');if(!el)return;
  q=q.trim();
  if(!q){el.innerHTML='';return;}
  var matches=DB.people.filter(function(p){var n=fld(p,'이름');return n&&n.toLowerCase().indexOf(q.toLowerCase())>-1;}).slice(0,8);
  el.innerHTML=matches.length?matches.map(function(p){return '<div class="wizard-result-item" onclick="wizardSubmitRole(\'other\',\''+p.id+'\',\''+escHtml(fld(p,'이름')).replace(/'/g,"\\'")+'\')">'+escHtml(fld(p,'이름'))+'</div>';}).join(''):'<div class="wizard-result-empty">일치하는 사람이 없어요</div>';
}
async function wizardSubmitRole(choice,personId,name){
  var row={project_id:_wizardPid,assigned_member_id:_wizardMemberId,status:'filled',position_type:'other'};
  if(choice==='self'){
    row.position_label='관리자';
  }else{
    if(!personId){oriAlert('검색해서 담당자를 선택해주세요.');return;}
    row.position_label='관리 지원 (담당자: '+name+')';
  }
  try{await sbClient.from('project_positions').insert(row);}catch(e){oriAlert('저장 실패: '+e.message);return;}
  wizardNext();
}
function wizardFilterList(q){
  var el=$('wizard-results');if(!el)return;
  var step=_wizardSteps[_wizardStepIdx];
  var list=step==='venue'?DB.venues:step==='troupe'?DB.troupes:DB.works;
  var nameField=WIZARD_STEP_FIELD[step];
  q=q.trim();
  if(!q){el.innerHTML='';return;}
  var matches=list.filter(function(item){var n=fld(item,nameField);return n&&n.toLowerCase().indexOf(q.toLowerCase())>-1;}).slice(0,8);
  el.innerHTML=matches.length?matches.map(function(item){return '<div class="wizard-result-item" onclick="wizardSelect(\''+item.id+'\')">'+escHtml(fld(item,nameField))+'</div>';}).join(''):'<div class="wizard-result-empty">일치하는 결과가 없어요</div>';
}
async function wizardSelect(id){
  var step=_wizardSteps[_wizardStepIdx];
  var field=step+'_id';
  var patch={};patch[field]=id;
  try{
    await sbClient.from('projects').update(patch).eq('id',_wizardPid);
    if(step==='work')await sbClient.rpc('populate_work_roles',{p_project_id:_wizardPid,p_work_id:id});
    if(step==='venue')await sbClient.rpc('select_project_venue',{p_project_id:_wizardPid,p_venue_id:id});
  }catch(e){oriAlert('저장 실패: '+e.message);}
  wizardNext();
}
async function wizardSkip(){
  var step=_wizardSteps[_wizardStepIdx];
  if(step==='date'||step==='license'||step==='members'){wizardNext();return;}
  try{await sbClient.from('project_positions').insert({project_id:_wizardPid,position_type:'other',position_label:WIZARD_STEP_LABEL[step]+' 미정',status:'open'});}catch(e){}
  wizardNext();
}
var _wizardSelectedMembers=[];
function wizardMembersStepHtml(){
  _wizardSelectedMembers=[];
  return '<div class="wizard-question">다른 멤버들은 누가 있나요?</div>'
    +'<div style="font-size:0.78rem;color:var(--muted);margin-bottom:1rem">이름으로 검색해서 선택해주세요. 나중에 팀 탭에서 역할을 정하고 정식으로 연결할 수 있어요.</div>'
    +'<input type="text" class="wizard-search" id="wizard-members-search" placeholder="이름으로 검색..." oninput="wizardMembersFilter(this.value)">'
    +'<div class="wizard-results" id="wizard-members-results"></div>'
    +'<div id="wizard-members-selected" class="wizard-selected-chips"></div>'
    +'<button class="pf-btn pf-active" style="width:100%" onclick="wizardSubmitMembers()">다음</button>'
    +'<button class="wizard-skip-btn" onclick="wizardSkip()">아직 없어요, 나중에 할게요</button>';
}
function wizardMembersFilter(q){
  var el=$('wizard-members-results');if(!el)return;
  q=q.trim();
  if(!q){el.innerHTML='';return;}
  var matches=DB.people.filter(function(p){
    var n=fld(p,'이름');
    return n&&n.toLowerCase().indexOf(q.toLowerCase())>-1&&_wizardSelectedMembers.indexOf(p.id)===-1;
  }).slice(0,8);
  el.innerHTML=matches.length?matches.map(function(p){return '<div class="wizard-result-item" onclick="wizardMembersAdd(\''+p.id+'\')">'+escHtml(fld(p,'이름'))+'</div>';}).join(''):'<div class="wizard-result-empty">일치하는 사람이 없어요</div>';
}
function wizardMembersAdd(pid2){
  if(_wizardSelectedMembers.indexOf(pid2)===-1)_wizardSelectedMembers.push(pid2);
  $('wizard-members-search').value='';$('wizard-members-results').innerHTML='';
  renderWizardMembersChips();
}
function wizardMembersRemove(pid2){
  _wizardSelectedMembers=_wizardSelectedMembers.filter(function(id){return id!==pid2;});
  renderWizardMembersChips();
}
function renderWizardMembersChips(){
  var el=$('wizard-members-selected');if(!el)return;
  el.innerHTML=_wizardSelectedMembers.map(function(id){
    return '<span class="wizard-chip">'+escHtml(nm(id))+' <button onclick="wizardMembersRemove(\''+id+'\')">×</button></span>';
  }).join('');
}
async function wizardSubmitMembers(){
  if(!_wizardSelectedMembers.length){wizardNext();return;}
  try{
    var rows=_wizardSelectedMembers.map(function(id){return {project_id:_wizardPid,position_type:'other',position_label:nm(id),status:'open'};});
    await sbClient.from('project_positions').insert(rows);
  }catch(e){oriAlert('저장 실패: '+e.message);return;}
  wizardNext();
}
function wizardDateStepHtml(){
  return '<div class="wizard-question">공연 날짜는 정해졌나요?</div>'
    +'<div class="wizard-date-row"><input type="date" id="wizard-date-start"><span>~</span><input type="date" id="wizard-date-end"></div>'
    +'<button class="pf-btn pf-active" style="width:100%;margin-top:0.8rem" onclick="wizardSaveDate()">확인</button>'
    +'<button class="wizard-skip-btn" onclick="wizardSkip()">아직 안 정해졌어요, 나중에 할게요</button>';
}
async function wizardSaveDate(){
  var start=$('wizard-date-start').value,end=$('wizard-date-end').value;
  if(!start){wizardNext();return;}
  try{await sbClient.from('projects').update({target_start_date:start,target_end_date:end||null}).eq('id',_wizardPid);}catch(e){oriAlert('저장 실패: '+e.message);}
  wizardNext();
}

function showAddPositionForm(pid){
  var el=$('add-position-form');if(!el)return;
  var options=DB.staffRoles.filter(function(s){return fld(s,'Name');});
  el.innerHTML='<div style="display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center">'
    +'<select id="add-pos-type" class="pf-btn" style="padding:0.35rem 0.6rem" onchange="document.getElementById(\'add-pos-staffwrap\').style.display=this.value===\'staff\'?\'inline\':\'none\'">'
    +'<option value="actor">배우 자리</option><option value="staff">스태프 자리</option><option value="other">기타</option></select>'
    +'<span id="add-pos-staffwrap" style="display:none"><select id="add-pos-staffrole" class="pf-btn" style="padding:0.35rem 0.6rem">'
    +options.map(function(s){return '<option value="'+s.id+'">'+fld(s,'Name')+'</option>';}).join('')+'</select></span>'
    +'<input type="text" id="add-pos-label" class="pf-btn" style="padding:0.35rem 0.6rem" placeholder="자리 이름 (예: 조연출)">'
    +'<button class="pf-btn pf-active" onclick="submitAddPosition(\''+pid+'\')">추가</button></div>';
}
async function submitAddPosition(pid){
  var type=$('add-pos-type').value;
  var label=$('add-pos-label').value.trim();
  var row={project_id:pid,position_type:type,status:'open',position_label:label||null};
  if(type==='staff'){
    var srid=$('add-pos-staffrole').value;
    row.staff_role_id=srid;
    if(!label)row.position_label=nm(srid);
  }
  if(!row.position_label)row.position_label=type==='actor'?'배우':'스태프';
  try{
    await sbClient.from('project_positions').insert(row);
    goProject(pid);
  }catch(e){oriAlert('추가 중 문제가 생겼어요: '+e.message);}
}
async function editProjectTitle(pid){
  var el=$('project-title-display');
  var current=el?el.firstChild.textContent:'';
  var t= await oriPrompt('프로젝트 제목을 입력하세요',current);
  if(!t||!t.trim())return;
  try{
    await sbClient.from('projects').update({title:t.trim()}).eq('id',pid);
    loadMyProjectsCache();
    goProject(pid);
  }catch(e){oriAlert('수정 실패: '+e.message);}
}
async function toggleRecruiting(pid,on){
  try{
    await sbClient.from('projects').update({is_recruiting:on}).eq('id',pid);
    if(window._projectCtx&&window._projectCtx.pid===pid){window._projectCtx.pr.is_recruiting=on;if(window._projectTab==='home')renderProjectTabContent();}
  }
  catch(e){oriAlert('변경 중 문제가 생겼어요: '+e.message);}
}
async function loadJoinRequests(pid){
  var el=$('join-requests-list');if(!el)return;
  try{
    var r=await sbClient.rpc('list_project_join_requests',{p_project_id:pid});
    var rows=r.data||[];
    if(window._projectCtx){window._projectCtx.pendingRequests=rows.length;updatePeopleTabBadge();}
    if(!rows.length){el.innerHTML='<div style="font-size:0.8rem;color:var(--muted)">대기 중인 요청이 없어요.</div>';return;}
    el.innerHTML=rows.map(function(req){
      return '<div class="proj-request-row">'
        +'<div><div style="font-size:0.82rem">'+escHtml(req.position_label||'자리 미지정')+' · '+escHtml(req.requester_nickname||req.requester_email)+'</div>'+(req.message?'<div style="font-size:0.74rem;color:var(--muted);margin-top:0.2rem">'+escHtml(req.message)+'</div>':'')+'</div>'
        +'<div style="display:flex;gap:0.4rem;flex-shrink:0"><button class="pf-btn pf-active" onclick="approveJoinReq(\''+req.request_id+'\',\''+pid+'\')">승인</button><button class="pf-btn" onclick="rejectJoinReq(\''+req.request_id+'\',\''+pid+'\')">거절</button></div></div>';
    }).join('');
  }catch(e){el.innerHTML='<div style="font-size:0.8rem;color:var(--muted)">불러오기 실패</div>';}
}
async function approveJoinReq(reqId,pid){
  try{await sbClient.rpc('approve_join_request',{request_id:reqId});loadJoinRequests(pid);}
  catch(e){oriAlert('승인 실패: '+e.message);}
}
async function rejectJoinReq(reqId,pid){
  try{await sbClient.rpc('reject_join_request',{request_id:reqId});loadJoinRequests(pid);}
  catch(e){oriAlert('거절 실패: '+e.message);}
}
