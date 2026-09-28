/* 오리 사이트 — 둘러보기 ↔ 내 공연을 잇는 버튼
   작품 상세 "이 작품으로 공연 만들기", 극장 상세 "내 공연 후보에 담기", 사람 상세 "내 공연에 초대".
   여러 공연 중 하나를 고를 때는 pickOne()으로 간단한 선택 창을 띄운다. */

/* 선택 창: items=[{value,label,sub}] → 고른 value (취소하면 null) */
function pickOne(title,items,emptyMsg){
  return new Promise(function(resolve){
    var ov=document.getElementById('pick-overlay');
    document.getElementById('pick-title').textContent=title;
    var list=document.getElementById('pick-list');
    list.innerHTML=items.length?items.map(function(it,i){
      return '<button type="button" class="pick-item" data-i="'+i+'"><span class="pick-l">'+escHtml(it.label)+'</span>'+(it.sub?'<span class="pick-s">'+escHtml(it.sub)+'</span>':'')+'</button>';
    }).join(''):'<div class="pick-empty">'+(emptyMsg||'고를 수 있는 항목이 없어요')+'</div>';
    function done(v){ov.classList.remove('open');list.onclick=null;document.getElementById('pick-cancel').onclick=null;resolve(v);}
    list.onclick=function(e){var b=e.target.closest('.pick-item');if(b)done(items[+b.dataset.i].value);};
    document.getElementById('pick-cancel').onclick=function(){done(null);};
    ov.onclick=function(e){if(e.target===ov)done(null);};
    ov.classList.add('open');
    var first=list.querySelector('.pick-item');if(first)first.focus();
  });
}

function myActiveProjects(){
  return (MY_PROJECTS_CACHE||[]).filter(function(p){return PROJECT_ACTIVE_STATUS.indexOf(p.status||'planning')>-1;});
}
async function pickMyProject(title){
  await loadMyProjectsCache();
  var list=myActiveProjects();
  if(!list.length){
    if(await oriConfirm('진행 중인 공연이 없어요. 새 공연을 시작할까요?'))startNewProject();
    return null;
  }
  if(list.length===1)return list[0].id;
  return pickOne(title,list.map(function(p){return{value:p.id,label:p.title||'새 공연',sub:[PROJECT_STATUS_LABEL[p.status],p.work_name].filter(Boolean).join(' · ')};}));
}

/* 작품 → 이 작품으로 공연 만들기 */
async function startProjectFromWork(wid){
  if(!CURRENT_USER){loginWithGoogle();return;}
  if(!await oriConfirm('"'+nm(wid)+'"(으)로 새 공연을 시작할까요?\n작품의 배역이 자리로 자동으로 만들어져요.'))return;
  try{
    var r=await sbClient.rpc('create_new_project');if(r.error)throw r.error;
    var pid=r.data;
    var u=await sbClient.from('projects').update({title:nm(wid),work_id:wid}).eq('id',pid);if(u.error)throw u.error;
    await sbClient.rpc('populate_work_roles',{p_project_id:pid,p_work_id:wid});
    await loadMyProjectsCache();
    goProject(pid);
  }catch(e){oriAlert('공연을 시작하지 못했어요: '+e.message);}
}

/* 극장 → 내 공연 후보에 담기 */
async function addVenueToMyProject(vid){
  if(!CURRENT_USER){loginWithGoogle();return;}
  var pid=await pickMyProject('어느 공연의 극장 후보로 담을까요?');if(!pid)return;
  try{
    var ex=await sbClient.from('project_venue_candidates').select('id').eq('project_id',pid).eq('venue_id',vid);
    if(ex.data&&ex.data.length){oriAlert('이미 후보에 담겨 있어요.');return;}
    var r=await sbClient.from('project_venue_candidates').insert({project_id:pid,venue_id:vid,status:'considering'});if(r.error)throw r.error;
    var p=(MY_PROJECTS_CACHE||[]).find(function(x){return x.id===pid;});
    if(await oriConfirm('"'+(p?p.title:'내 공연')+'"의 극장 후보에 담았어요.\n후보 목록을 볼까요?')){window._prepSub='venue';window._projectTabNext='prep';goProject(pid);}
  }catch(e){oriAlert('담지 못했어요: '+e.message);}
}

/* 사람 → 내 공연에 초대 (빈 자리를 골라 참여 요청을 보낸다) */
async function invitePersonToMyProject(personId){
  if(!CURRENT_USER){loginWithGoogle();return;}
  var pid=await pickMyProject(nm(personId)+'님을 어느 공연에 초대할까요?');if(!pid)return;
  try{
    var pr=await sbClient.from('project_positions').select('*').eq('project_id',pid);if(pr.error)throw pr.error;
    var open=(pr.data||[]).filter(function(p){return p.status==='open'&&!p.assigned_member_id;});
    var typeLabel={actor:'배역',staff:'제작진',other:'기타'};
    var posId=await pickOne('어떤 자리로 초대할까요?',open.map(function(p){return{value:p.id,label:p.position_label||'자리',sub:typeLabel[p.position_type]||''};}),
      '비어 있는 자리가 없어요. 공연의 "사람" 탭에서 자리를 먼저 만들어주세요.');
    if(!posId)return;
    var msg=await oriPrompt('함께 보낼 한마디 (선택)','');
    if(msg===null)return;
    var r=await sbClient.rpc('invite_person_to_position',{p_position_id:posId,p_person_id:personId,p_message:msg||''});
    if(r.error)throw r.error;
    oriAlert(nm(personId)+'님에게 참여 요청을 보냈어요.');
  }catch(e){
    if(/연결되지 않은/.test(e.message||'')){
      if(await oriConfirm(nm(personId)+'님은 아직 오리에 가입하지 않았어요.\n가입 안내 메시지를 복사할까요?'))inviteThisPerson(personId);
    }else oriAlert('초대하지 못했어요: '+e.message);
  }
}
