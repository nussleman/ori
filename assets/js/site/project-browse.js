/* 오리 사이트 — 기회 (#projects)
   둘러보기의 두 번째 흐름: "내가 지원할 수 있는 자리·기회를 찾는다".
   모집 중인 자리(배역·제작진)를 한 목록으로 보여주고, 바로 지원한다. 자리를 누르면 프로젝트 공개 페이지로.
   내가 보낸 지원의 상태는 마이페이지 "지원 현황"(renderMyApplications)에서 본다.
   데이터: list_opportunities() (자리 + 프로젝트 + 내 지원 상태), my_join_requests(), list_public_projects(). */
var _opp={rows:[],projects:[],f:{type:'',role:''},sort:'new'};

async function goProjectBrowse(push){
  if(push!==false)history.pushState({view:'projects'},'','#projects');
  setNav('projects');sb('');_sbContext='';mobShowDetail();
  if(!CURRENT_USER){mn('<div class="tab-index"><div class="result-empty">로그인이 필요해요</div></div>');return;}
  mn('<div class="tab-index opp-page"><header class="opp-head"><h1 class="dv-title">기회</h1><p class="opp-sub">지금 함께할 사람을 찾는 공연들이에요. 마음에 드는 자리에 지원해 보세요.</p><div id="opp-mine"></div></header>'
    +'<div id="opp-bar"></div><div id="opp-list" class="opp-grid"><div class="hf-loading">불러오는 중…</div></div>'
    +'<section class="dv-sec" id="opp-projects"></section></div>');
  var res=await Promise.all([sbClient.rpc('list_opportunities'),sbClient.rpc('list_public_projects'),sbClient.rpc('my_join_requests')]);
  if(location.hash!=='#projects')return;
  _opp.rows=res[0].data||[];_opp.projects=res[1].data||[];
  var mine=res[2].data||[],waiting=mine.filter(function(r){return r.status==='pending';}).length;
  var m=$('opp-mine');
  if(m&&mine.length)m.innerHTML='<button type="button" class="opp-mine" onclick="goMyPageTab(\'apply\')">내 지원 <b>'+mine.length+'</b>건'+(waiting?' · 답을 기다리는 중 <b>'+waiting+'</b>':'')+' ›</button>';
  renderOpportunities();
}
function oppKind(r){
  if(r.position_type==='actor'){var role=r.role_id&&DB.roles.find(function(x){return x.id===r.role_id;});var g=role&&fld(role,'성별');return '배우'+(g?' · '+g:'');}
  if(r.position_type==='staff')return '제작진'+(r.staff_role_id&&nm(r.staff_role_id)?' · '+nm(r.staff_role_id):'');
  return '함께할 사람';
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
  if(bar)bar.innerHTML=filterBar('opp',[
    {key:'type',label:'자리',type:'single',value:f.type,options:[{v:'actor',l:'배우',n:all.filter(function(r){return r.position_type==='actor';}).length},{v:'crew',l:'제작진·스태프',n:all.filter(function(r){return r.position_type!=='actor';}).length}]},
    {key:'role',label:'분야',type:'single',value:f.role,options:f.type==='actor'?[]:Object.keys(staffSet).map(function(k){return{v:k,l:staffSet[k]};})}
  ],{
    count:'<em>'+rows.length+'</em>개 자리',
    sort:{value:_opp.sort,options:[{v:'new',l:'최근 올라온 순'},{v:'soon',l:'공연 가까운 순'}],onChange:function(v){_opp.sort=v;renderOpportunities();}},
    onChange:function(k,v){_opp.f[k]=v;if(k==='type'&&v==='actor')_opp.f.role='';renderOpportunities();},
    onReset:function(){_opp.f={type:'',role:''};renderOpportunities();}
  });
  var el=$('opp-list');if(!el)return;
  if(!rows.length){el.innerHTML='<div class="result-empty"><div class="result-empty-icon">📣</div>'+(all.length?'조건에 맞는 자리가 없어요.':'지금은 모집 중인 자리가 없어요.<br><span style="font-size:0.8rem;color:var(--muted)">새 자리가 올라오면 여기에 보여요.</span>')+'</div>';}
  else el.innerHTML=rows.map(oppCardHtml).join('');
  renderOppProjects();
}
function oppCardHtml(r){
  var dd=r.target_start_date?dashDaysUntil(r.target_start_date):null;
  var when=r.target_start_date?String(r.target_start_date).slice(5).replace('-','.')+' 공연'+(dd!=null&&dd>=0?' · D-'+dd:''):'공연 날짜 미정';
  var meta=[r.work_id&&nm(r.work_id),r.troupe_id&&nm(r.troupe_id),r.venue_id&&nm(r.venue_id)].filter(Boolean).map(escHtml).join(' · ');
  var st=r.my_status;
  var btn=st==='pending'?'<span class="opp-st">지원함 · 답 기다리는 중</span>'
    :st==='approved'?'<span class="opp-st ok">합류했어요</span>'
    :st==='rejected'?'<span class="opp-st">이번엔 함께하지 못해요</span>'
    :'<button type="button" class="opp-apply" onclick="event.stopPropagation();requestJoinPosition(\''+r.project_id+'\',\''+r.position_id+'\')">지원하기</button>';
  return '<div class="opp-card" onclick="goProject(\''+r.project_id+'\')">'
    +'<div class="opp-kind">'+escHtml(oppKind(r))+'</div>'
    +'<div class="opp-title">'+escHtml(r.position_label||'자리')+'</div>'
    +'<div class="opp-proj">'+escHtml(r.project_title||'새 프로젝트')+'</div>'
    +(meta?'<div class="opp-meta">'+meta+'</div>':'')
    +'<div class="opp-foot"><span class="opp-when">'+escHtml(when)+'</span>'+btn+'</div></div>';
}
function renderOppProjects(){
  var el=$('opp-projects');if(!el)return;
  var ps=(_opp.projects||[]).filter(function(p){return p.status!=='completed'&&p.status!=='cancelled';});
  if(!ps.length){el.innerHTML='';return;}
  el.innerHTML=dvSection('모집 중인 프로젝트',ps.length)+'<div class="opp-proj-list">'+ps.map(function(p){
    return '<button type="button" class="opp-proj-row" onclick="goProject(\''+p.id+'\')"><b>'+escHtml(p.title||'새 프로젝트')+'</b><span>'+escHtml([p.work_name,p.troupe_name,PROJECT_STATUS_LABEL[p.status]].filter(Boolean).join(' · '))+'</span></button>';
  }).join('')+'</div>';
}
async function requestJoinPosition(projectId,positionId){
  if(!CURRENT_USER){loginWithGoogle();return;}
  var msg=await oriPrompt('지원 메시지 (선택)\n간단한 소개나 경험, 가능한 연습 요일을 적어주면 좋아요.','');
  if(msg===null)return;
  var r=await sbClient.from('project_join_requests').insert({project_id:projectId,position_id:positionId,user_id:CURRENT_USER.id,message:msg||null});
  if(r.error){oriAlert(r.error.code==='23505'?'이미 지원한 자리예요.':'지원하지 못했어요: '+r.error.message);return;}
  var row=_opp.rows.find(function(x){return x.position_id===positionId;});if(row)row.my_status='pending';
  if(location.hash==='#projects')renderOpportunities();else if($('home-opps'))loadHomeOpps();
  oriAlert('지원했어요! 프로젝트에서 확인하면 마이페이지 "지원 현황"에서 결과를 볼 수 있어요.');
}

/* 마이페이지 "지원 현황" */
async function renderMyApplications(el){
  el.innerHTML='<div class="hf-loading">불러오는 중…</div>';
  var r=await sbClient.rpc('my_join_requests');
  if(r.error){el.innerHTML='<div class="result-empty">불러오지 못했어요.</div>';return;}
  var rows=r.data||[];
  if(!rows.length){el.innerHTML='<div class="result-empty"><div class="result-empty-icon">📮</div><div style="font-size:0.95rem;margin-bottom:0.4rem">아직 지원한 자리가 없어요</div><div style="font-size:0.8rem;color:var(--muted);margin-bottom:1rem">기회에서 함께할 공연을 찾아보세요.</div><button class="pf-btn pf-active" onclick="goProjectBrowse()">기회 보기</button></div>';return;}
  var label={pending:'답 기다리는 중',approved:'합류했어요',rejected:'이번엔 함께하지 못해요'};
  el.innerHTML='<div class="apply-list">'+rows.map(function(x){
    return '<div class="apply-row" onclick="goProject(\''+x.project_id+'\')"><div><div class="apply-t">'+escHtml(x.position_label||'자리')+' <span class="apply-p">· '+escHtml(x.project_title||'')+'</span></div>'
      +'<div class="apply-d">'+new Date(x.created_at).toLocaleDateString('ko-KR')+' 지원'+(x.reviewed_at?' · '+new Date(x.reviewed_at).toLocaleDateString('ko-KR')+' 답변':'')+'</div></div>'
      +'<span class="apply-st st-'+x.status+'">'+(label[x.status]||x.status)+'</span></div>';
  }).join('')+'</div>'
  +(rows.some(function(x){return x.status==='approved';})?'<p class="opp-sub" style="margin-top:1rem">합류한 프로젝트는 프로필 메뉴의 "만들기 모드"에서 함께 준비해요.</p>':'');
}
