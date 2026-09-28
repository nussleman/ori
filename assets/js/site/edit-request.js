/* 오리 사이트 — 정보 제보·수정요청 모달 */
/* ── 수정요청 모달 ── */
var _editModalTarget=null; // {type,id} 프리셋 (상세페이지에서 열었을 때)
var EDIT_TARGET_FIELD={show:'공연명',work:'작품명',troupe:'극단명',venue:'극장명',person:'이름',role:'배역명'};
function editTargetList(type){
  if(type==='show')return DB.shows;
  if(type==='work')return DB.works;
  if(type==='troupe')return DB.troupes;
  if(type==='venue')return DB.venues;
  if(type==='person')return DB.people;
  if(type==='role')return DB.roles;
  return [];
}
function onEditTargetTypeChange(){
  _editModalTarget=null;
  $('edit-target-search').value='';
  $('edit-target-results').innerHTML='';
  $('edit-target-selected').style.display='none';
  var type=$('edit-target-type').value;
  var pickerField=$('edit-target-picker-field');
  pickerField.style.display=type==='other'?'none':'block';
}
function editModalFilterList(q){
  var el=$('edit-target-results');if(!el)return;
  var type=$('edit-target-type').value;
  var field=EDIT_TARGET_FIELD[type];
  q=q.trim();
  if(!q||!field){el.innerHTML='';return;}
  var matches=editTargetList(type).filter(function(item){var n=fld(item,field);return n&&n.toLowerCase().indexOf(q.toLowerCase())>-1;}).slice(0,8);
  el.innerHTML=matches.length?matches.map(function(item){return '<div class="wizard-result-item" onclick="editModalSelectTarget(\''+item.id+'\',\''+escHtml(fld(item,field)).replace(/'/g,"\\'")+'\')">'+escHtml(fld(item,field))+'</div>';}).join(''):'<div class="wizard-result-empty">일치하는 항목이 없어요. "기타"로 새로 등록 요청해보세요.</div>';
}
function editModalSelectTarget(id,name){
  _editModalTarget={type:$('edit-target-type').value,id:id};
  $('edit-target-selected').style.display='block';
  $('edit-target-selected').textContent='✓ 선택됨: '+name;
  $('edit-target-results').innerHTML='';
  $('edit-target-search').value='';
}
function openEditModal(targetType,targetId){
  if(!CURRENT_USER){loginWithGoogle();return;}
  _editModalTarget=targetId?{type:targetType,id:targetId}:null;
  $('edit-summary').value='';$('edit-details').value='';$('edit-modal-msg').textContent='';
  $('edit-target-search').value='';$('edit-target-results').innerHTML='';
  if(targetType)$('edit-target-type').value=targetType;
  if(targetId&&targetType){
    $('edit-target-selected').style.display='block';
    $('edit-target-selected').textContent='✓ 선택됨: '+(nm(targetId)||'');
  }else{
    $('edit-target-selected').style.display='none';
  }
  $('edit-target-picker-field').style.display=(targetType||$('edit-target-type').value)==='other'?'none':'block';
  $('edit-request-type').value=targetId?'edit':'create';
  $('edit-modal-overlay').classList.add('open');
}
function closeEditModal(){$('edit-modal-overlay').classList.remove('open');}
async function submitEditRequest(){
  var summary=$('edit-summary').value.trim();
  var targetType=$('edit-target-type').value;
  if(targetType!=='other'&&!_editModalTarget){$('edit-modal-msg').textContent='어떤 항목인지 검색해서 선택해주세요.';return;}
  if(!summary){$('edit-modal-msg').textContent='한 줄 요약은 꼭 적어주세요.';return;}
  var row={
    user_id:CURRENT_USER.id,
    request_type:$('edit-request-type').value,
    target_type:targetType,
    target_id:_editModalTarget?_editModalTarget.id:null,
    summary:summary,
    details:$('edit-details').value.trim()||null
  };
  try{
    await sbClient.from('edit_requests').insert(row);
    $('edit-modal-msg').textContent='보냈어요! 확인 후 반영할게요.';
    setTimeout(closeEditModal,1200);
  }catch(e){
    $('edit-modal-msg').textContent='전송 중 문제가 생겼어요: '+e.message;
  }
}
