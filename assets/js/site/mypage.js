/* 오리 사이트 — 마이페이지 (내 정보, 내 단체, 즐겨찾기, 해보고 싶어요) */
/* ══ 마이페이지 (즐겨찾기) ══ */
var FAV_TYPE_LABEL={show:'공연',work:'작품',troupe:'단체',venue:'극장',person:'사람',role:'배역'};
function myCardHtml(type,id,listType){
  var name=nm(id)||'(삭제된 항목)';
  var imgUrl=type==='show'?(POSTER[id]||''):(type==='person'?(PERSON_PHOTO[id]||''):'');
  var imgH=imgUrl?'<img class="cast-img" src="'+imgUrl+'">':'<div class="cast-img-ph">&nbsp;</div>';
  return '<div class="cast-card" data-action="'+type+'" data-id="'+id+'" style="position:relative">'+favBtnHtml(type,id,listType)+imgH+'<div class="cast-name">'+name+'</div></div>';
}
var MYPAGE_TABS=[['info','내 정보'],['dashboard','대시보드'],['favorites','즐겨찾기'],['wishlist','해보고 싶은'],['projects','프로젝트'],['troupes','내 단체']];
window._myPageTab='info';
async function renderMyPage(){
  await loadFavorites();
  await loadUserProfile();
  var h='<div class="mypage-sticky-header"><div class="eyebrow" style="margin-bottom:0.6rem">마이페이지</div>'
    +'<div class="mypage-tabs">'+MYPAGE_TABS.map(function(t){
      return '<button class="mypage-tab-btn'+(window._myPageTab===t[0]?' active':'')+'" data-mytab="'+t[0]+'" onclick="switchMyPageTab(\''+t[0]+'\')">'+t[1]+'</button>';
    }).join('')+'</div></div>';
  h+='<div class="mypage-sticky-spacer"></div>';
  h+='<div class="tab-index"><div id="mypage-tab-content"></div></div>';
  mn(h);
  renderMyPageTabContent();
  requestAnimationFrame(function(){
    var hdr=document.querySelector('.mypage-sticky-header');
    var spacer=document.querySelector('.mypage-sticky-spacer');
    if(hdr&&spacer)spacer.style.height=hdr.offsetHeight+'px';
  });
}
function switchMyPageTab(tab){
  window._myPageTab=tab;
  document.querySelectorAll('.mypage-tab-btn').forEach(function(b){b.classList.toggle('active',b.dataset.mytab===tab);});
  renderMyPageTabContent();
}
function renderMyPageTabContent(){
  var el=$('mypage-tab-content');if(!el)return;
  var tab=window._myPageTab;
  if(tab==='info')renderMyPageInfo(el);
  else if(tab==='dashboard')renderMyPageDashboard(el);
  else if(tab==='favorites')renderMyPageFavorites(el);
  else if(tab==='wishlist')renderMyPageWishlist(el);
  else if(tab==='projects')renderMyPageProjects(el);
  else if(tab==='troupes')renderMyPageTroupes(el);
}
function renderMyPageTroupes(el){
  el.innerHTML='<div class="sec"><div class="sec-label">내 단체</div><div id="mypage-troupes-list">불러오는 중…</div></div>';
  loadMyPageTroupesList();
}
async function loadMyPageTroupesList(){
  var el=$('mypage-troupes-list');if(!el)return;
  try{
    var r=await sbClient.rpc('list_my_troupes');
    var rows=r.data||[];
    if(!rows.length){el.innerHTML='<div class="result-empty"><div class="result-empty-icon">🏢</div><div style="font-size:0.95rem;margin-bottom:0.4rem">아직 연결된 단체가 없어요</div><div style="font-size:0.8rem;color:var(--muted)">단체 페이지에서 "우리 단체예요"를 눌러 연결해보세요.</div></div>';return;}
    el.innerHTML='<div class="project-card-grid">'+rows.map(function(t){
      return '<div class="item-card" style="cursor:pointer" onclick="'+(t.member_role==='admin'?'goMyTroupe(\''+t.troupe_id+'\')':'showTroupe(\''+t.troupe_id+'\')')+'">'
        +'<div class="item-card-title">'+escHtml(t.troupe_name)+'</div>'
        +'<div style="font-size:0.76rem;color:var(--muted);margin-top:0.4rem">'+(t.member_role==='admin'?'관리자 · 정보 수정 가능':'멤버')+'</div></div>';
    }).join('')+'</div>';
  }catch(e){el.innerHTML='<div style="font-size:0.82rem;color:var(--muted)">불러오기 실패</div>';}
}
var AVATAR_EMOJI_OPTIONS=['🦆','🎭','🎬','🎨','🎤','🎹','🎻','🎺','🥁','🎧','🎪','🎟️','⭐','🌙','☀️','🌈','🔥','🌊','🍀','🌸','🌵','🍄','🦊','🐯','🐰','🐼','🐨','🐸','🐙','🦉','🐧','🦁','🐶','🐱','👻','🤖','👽','🦄','🐲','😎','🥳','🤠','🧚','🧛','🧜','🥷','🕺','💃','🎯','🎲','🧩','🔮','💎','🍕','🍩','☕','🍉','🎈','⚡','❄️','🌻'];
var PREFERRED_ROLE_OPTIONS=['배우','연출','조연출','무대','미술','안무','음악','운영','조명','소품','메이크업','음향','홍보','의상','제작·기획'];
window._infoEditMode=false;
function renderMyPageInfo(el){
  var h='<div class="myinfo-wrap">';

  // 1) 프로필 연결 (최좌측)
  h+='<div class="myinfo-card">';
  h+='<div class="person-side-title" style="text-align:center">프로필 연결</div>';
  if(CURRENT_USER.personId){
    var pname=nm(CURRENT_USER.personId)||'(이름없음)';
    h+='<div class="cast-grid" style="margin-bottom:0.5rem">'+myCardHtml('person',CURRENT_USER.personId)+'</div>'
      +'<div style="font-size:0.75rem;color:var(--muted);text-align:center">'+pname+'님으로 연결됨</div>';
  }else{
    h+='<div style="font-size:0.78rem;color:var(--muted);line-height:1.6;text-align:center">아직 연결 안 됨<br><span class="link" onclick="maybeForceShowConnectPrompt()">내 프로필 찾기</span></div>';
  }
  h+='</div>';

  // 1.5) 내 단체 (별도 탭으로 이동하는 바로가기)
  h+='<div class="myinfo-card"><div class="person-side-title" style="text-align:center">내 단체</div>'
    +'<div style="text-align:center"><button class="pf-btn" onclick="switchMyPageTab(\'troupes\')">내 단체 보기 →</button></div></div>';

  // 2) 개인정보 (보기/편집 토글)
  h+='<div class="myinfo-card">';
  h+='<div class="person-side-title" style="display:flex;justify-content:space-between;align-items:center">개인 정보'
    +(window._infoEditMode?'':'<button type="button" class="myinfo-edit-toggle" onclick="toggleInfoEdit()" title="수정">✎</button>')+'</div>';
  if(window._infoEditMode){
    h+='<div class="myinfo-avatar-picker">';
    h+='<div class="myinfo-avatar-wrap"><div class="myinfo-avatar-preview" id="avatar-preview">'+(CURRENT_USER.avatarEmoji||(CURRENT_USER.nickname||'?').charAt(0))+'</div>'
      +'<button type="button" class="myinfo-avatar-edit-btn" onclick="toggleAvatarPicker()" title="아이콘 바꾸기">✎</button></div>';
    h+='<div class="myinfo-avatar-options" id="avatar-options" style="display:none">'+AVATAR_EMOJI_OPTIONS.map(function(e){
      return '<button type="button" class="myinfo-avatar-opt" data-emoji="'+e+'" onclick="pickAvatarEmoji(\''+e+'\')">'+e+'</button>';
    }).join('')+'</div></div>';
    h+='<div class="edit-modal-field"><label>닉네임 (선택)</label><input type="text" id="profile-nickname" value="'+(CURRENT_USER.nickname||'').replace(/"/g,'&quot;')+'" placeholder="설정 안 함"></div>';
    h+='<div class="edit-modal-field"><label>이메일</label><input type="text" value="'+(CURRENT_USER.email||'')+'" disabled></div>';
    h+='<div class="edit-modal-field"><label>자기소개<span class="myinfo-field-note"> · 연결된 사람 페이지에 공개돼요</span></label><textarea id="profile-intro" rows="2" placeholder="어떤 활동을 하는지, 관심사 등을 적어보세요">'+(CURRENT_USER.intro||'')+'</textarea></div>';
    h+='<div class="edit-modal-field"><label>연락처<span class="myinfo-field-note"> · 비공개, 프로젝트 참여 요청시에만 사용</span></label><input type="text" id="profile-contact" value="'+(CURRENT_USER.contact||'').replace(/"/g,'&quot;')+'" placeholder="카카오톡 오픈채팅, 전화번호 등"></div>';
    h+='<div class="edit-modal-field"><label>지금 하고 있는 역할<span class="myinfo-field-note"> · 여러 개 선택 가능</span></label><div class="myinfo-role-options">'
      +PREFERRED_ROLE_OPTIONS.map(function(r){
        var on=(CURRENT_USER.preferredRoles||[]).indexOf(r)>-1;
        return '<button type="button" class="myinfo-role-opt'+(on?' on':'')+'" data-role="'+r+'" onclick="this.classList.toggle(\'on\')">'+r+'</button>';
      }).join('')+'</div></div>';
    h+='<button class="pf-btn pf-active" style="width:100%" onclick="saveProfileInfo()">저장</button>';
    h+='<div id="profile-save-msg" style="font-size:0.75rem;color:var(--muted);margin-top:0.5rem;text-align:center"></div>';
    h+='<div style="text-align:center;margin-top:1.2rem"><span class="danger-link" onclick="deleteMyAccount()">회원 탈퇴</span></div>';
  }else{
    h+='<div class="myinfo-view-row"><span class="myinfo-view-label">닉네임</span><span>'+escHtml(CURRENT_USER.nickname||'설정 안 함')+'</span></div>';
    h+='<div class="myinfo-view-row"><span class="myinfo-view-label">이메일</span><span>'+escHtml(CURRENT_USER.email||'')+'</span></div>';
    h+='<div class="myinfo-view-row"><span class="myinfo-view-label">자기소개</span><span>'+escHtml(CURRENT_USER.intro||'설정 안 함')+'</span></div>';
    h+='<div class="myinfo-view-row"><span class="myinfo-view-label">연락처</span><span>'+escHtml(CURRENT_USER.contact||'설정 안 함')+'</span></div>';
    h+='<div class="myinfo-view-row"><span class="myinfo-view-label">현재 역할</span><span>'+((CURRENT_USER.preferredRoles||[]).map(escHtml).join(', ')||'설정 안 함')+'</span></div>';
  }
  h+='</div>';

  // 3) 사진 (개인정보 오른쪽)
  if(CURRENT_USER.personId){
    var person=DB.people.find(function(p){return p.id===CURRENT_USER.personId;});
    var myPhotos=person?(fld(person,'사진')||[]).filter(function(p){return p&&p.url;}):[];
    h+='<div class="myinfo-card myinfo-card-wide">';
    h+='<div class="person-side-title" style="text-align:center">내 사진'+(myPhotos.length?' ('+myPhotos.length+')':'')+'</div>';
    if(myPhotos.length){
      h+='<div class="person-gallery-grid-wide">'+myPhotos.map(function(p,i){
        var esc=p.url.replace(/'/g,"\\'");
        return '<div class="pg-item">'+(i===0?'<span class="pg-primary-badge">대표</span>':'<button class="pg-primary-btn" onclick="setPrimaryPhoto(\''+esc+'\')" title="대표사진으로 설정">★</button>')
          +'<img src="'+p.url+'" alt="사진"><button class="pg-del" onclick="removeMyPhoto(\''+esc+'\')" title="삭제">×</button></div>';
      }).join('')+'</div>';
    }
    h+='<input type="file" id="my-photo-upload" accept="image/*" style="display:none" onchange="uploadMyPhoto(this)">'
      +'<button class="person-gallery-more-btn" style="margin-top:0.6rem" onclick="document.getElementById(\'my-photo-upload\').click()">+ 사진 추가</button>'
      +'<div id="my-photo-upload-msg" style="font-size:0.7rem;color:var(--muted);margin-top:0.4rem;text-align:center"></div>';
    h+='</div>';
  }

  h+='</div>';
  el.innerHTML=h;
}
function goMyTroupe(tid,push){
  if(push!==false)history.pushState({view:'mytroupe',id:tid},'','#mytroupe-'+tid);
  setNav('mypage');sb('');_sbContext='';mobShowDetail();
  if(!CURRENT_USER){mn('<div class="tab-index"><div class="result-empty">로그인이 필요해요</div></div>');return;}
  var troupe=DB.troupes.find(function(t){return t.id===tid;});
  if(!troupe){mn('<div class="tab-index"><div class="result-empty">단체를 찾을 수 없어요.</div></div>');return;}
  var name=fld(troupe,'극단명')||'';
  var status=fld(troupe,'운영상태')||'';
  var memberBase=fld(troupe,'구성원기반')||'';
  var region=fld(troupe,'활동지역')||'';
  var founded=fld(troupe,'창단연도')||'';
  var recruiting=fld(troupe,'모집정보')||'';
  var photos=(fld(troupe,'사진')||[]).filter(function(p){return p&&p.url;});
  var h='<div class="detail-header"><div class="eyebrow">내 단체 관리</div><div class="detail-title">'+escHtml(name)+'</div>'
    +'<div class="detail-meta"><span class="link" data-action="troupe" data-id="'+tid+'">공개 페이지 보기 →</span></div></div>';
  h+='<div class="myinfo-wrap">';
  h+='<div class="myinfo-card"><div class="person-side-title">기본 정보</div>'
    +'<div class="edit-modal-field"><label>단체명</label><input type="text" id="mt-name" value="'+escHtml(name).replace(/"/g,'&quot;')+'"></div>'
    +'<div class="edit-modal-field"><label>운영상태</label><select id="mt-status">'
    +['','창단준비중','활동중','활동뜸함','해체'].map(function(s){return '<option value="'+s+'"'+(status===s?' selected':'')+'>'+(s||'(없음)')+'</option>';}).join('')+'</select></div>'
    +'<div class="edit-modal-field"><label>구성원기반</label><select id="mt-memberbase">'
    +['','학생','직장인','일반'].map(function(s){return '<option value="'+s+'"'+(memberBase===s?' selected':'')+'>'+(s||'(없음)')+'</option>';}).join('')+'</select></div>'
    +'<div class="edit-modal-field"><label>활동지역</label><input type="text" id="mt-region" value="'+escHtml(Array.isArray(region)?region.join(', '):region).replace(/"/g,'&quot;')+'" placeholder="예: 서울, 경기"></div>'
    +'<div class="edit-modal-field"><label>창단연도</label><input type="number" id="mt-founded" value="'+(founded||'')+'"></div>'
    +'<div class="edit-modal-field"><label>단원 모집 정보</label><textarea id="mt-recruiting" rows="3" placeholder="모집 중인 내용이 있으면 적어주세요">'+escHtml(recruiting)+'</textarea></div>'
    +'<button class="pf-btn pf-active" style="width:100%" onclick="saveMyTroupe(\''+tid+'\')">저장</button>'
    +'<div id="mt-save-msg" style="font-size:0.75rem;color:var(--muted);margin-top:0.5rem;text-align:center"></div></div>';
  h+='<div class="myinfo-card myinfo-card-wide"><div class="person-side-title">사진</div>';
  if(photos.length){
    h+='<div class="person-gallery-grid-wide">'+photos.map(function(p,i){
      var esc=p.url.replace(/'/g,"\\'");
      return '<div class="pg-item">'+(i===0?'<span class="pg-primary-badge">대표</span>':'<button class="pg-primary-btn" onclick="setPrimaryTroupePhoto(\''+tid+'\',\''+esc+'\')" title="대표사진으로 설정">★</button>')
        +'<img src="'+p.url+'" alt="사진"><button class="pg-del" onclick="removeTroupePhoto(\''+tid+'\',\''+esc+'\')" title="삭제">×</button></div>';
    }).join('')+'</div>';
  }
  h+='<input type="file" id="mt-photo-upload" accept="image/*" style="display:none" onchange="uploadTroupePhoto(this,\''+tid+'\')">'
    +'<button class="person-gallery-more-btn" style="margin-top:0.6rem" onclick="document.getElementById(\'mt-photo-upload\').click()">+ 사진 추가</button>'
    +'<div id="mt-photo-upload-msg" style="font-size:0.7rem;color:var(--muted);margin-top:0.4rem;text-align:center"></div></div>';
  h+='</div>';
  mn(h);
  injectBackBtn('← 마이페이지',function(){goMyPage();});
}
async function saveMyTroupe(tid){
  var region=$('mt-region').value.trim();
  var payload={
    name:$('mt-name').value.trim(),
    status:$('mt-status').value||null,
    member_base:$('mt-memberbase').value||null,
    region:region?region.split(',').map(function(s){return s.trim();}).filter(Boolean):null,
    founded_year:$('mt-founded').value?Number($('mt-founded').value):null,
    recruiting_info:$('mt-recruiting').value.trim()||null
  };
  try{
    await sbClient.from('troupes').update(payload).eq('id',tid);
    $('mt-save-msg').textContent='저장됐어요.';
  }catch(e){$('mt-save-msg').textContent='저장 실패: '+e.message;}
}
async function uploadTroupePhoto(input,tid){
  var file=input.files&&input.files[0];if(!file)return;
  var msgEl=$('mt-photo-upload-msg');if(msgEl)msgEl.textContent='업로드 중…';
  try{
    var ext=(file.name.split('.').pop()||'jpg').toLowerCase();
    var path='troupes/'+tid+'/'+Date.now()+'.'+ext;
    var up=await sbClient.storage.from('photos').upload(path,file);
    if(up.error)throw up.error;
    var pub=sbClient.storage.from('photos').getPublicUrl(path);
    var troupe=DB.troupes.find(function(t){return t.id===tid;});
    var existing=(fld(troupe,'사진')||[]).map(function(p){return p.url;});
    existing.push(pub.data.publicUrl);
    await sbClient.from('troupes').update({photo_urls:existing}).eq('id',tid);
    await load();
    goMyTroupe(tid);
  }catch(e){if(msgEl)msgEl.textContent='업로드 실패: '+e.message;}
}
async function removeTroupePhoto(tid,url){
  if(!await oriConfirm('이 사진을 삭제할까요?'))return;
  try{
    var troupe=DB.troupes.find(function(t){return t.id===tid;});
    var existing=(fld(troupe,'사진')||[]).map(function(p){return p.url;}).filter(function(u){return u!==url;});
    await sbClient.from('troupes').update({photo_urls:existing}).eq('id',tid);
    await load();
    goMyTroupe(tid);
  }catch(e){oriAlert('삭제 실패: '+e.message);}
}
async function setPrimaryTroupePhoto(tid,url){
  try{
    var troupe=DB.troupes.find(function(t){return t.id===tid;});
    var existing=(fld(troupe,'사진')||[]).map(function(p){return p.url;});
    var reordered=[url].concat(existing.filter(function(u){return u!==url;}));
    await sbClient.from('troupes').update({photo_urls:reordered}).eq('id',tid);
    await load();
    goMyTroupe(tid);
  }catch(e){oriAlert('설정 실패: '+e.message);}
}
function toggleInfoEdit(){
  window._infoEditMode=!window._infoEditMode;
  _pickedAvatarEmoji=null;
  renderMyPageInfo($('mypage-tab-content'));
}
function toggleAvatarPicker(){
  var el=$('avatar-options');if(!el)return;
  el.style.display=el.style.display==='none'?'flex':'none';
}
var _pickedAvatarEmoji=null;
function pickAvatarEmoji(e){
  _pickedAvatarEmoji=e;
  var pv=$('avatar-preview');if(pv)pv.textContent=e;
}
async function saveProfileInfo(){
  var nickname=$('profile-nickname').value.trim();
  var intro=$('profile-intro').value.trim();
  var contact=$('profile-contact').value.trim();
  var avatarEmoji=_pickedAvatarEmoji!==null?_pickedAvatarEmoji:CURRENT_USER.avatarEmoji;
  var preferredRoles=Array.prototype.slice.call(document.querySelectorAll('.myinfo-role-opt.on')).map(function(b){return b.dataset.role;});
  try{
    await sbClient.from('user_profiles').update({nickname:nickname||null,intro:intro||null,contact:contact||null,avatar_emoji:avatarEmoji||null,preferred_roles:preferredRoles.length?preferredRoles:null}).eq('id',CURRENT_USER.id);
    CURRENT_USER.nickname=nickname;CURRENT_USER.intro=intro;CURRENT_USER.contact=contact;CURRENT_USER.avatarEmoji=avatarEmoji;CURRENT_USER.preferredRoles=preferredRoles;
    renderProfileFab();
    window._infoEditMode=false;
    renderMyPageInfo($('mypage-tab-content'));
  }catch(e){
    var msg=$('profile-save-msg');
    if(msg)msg.textContent='저장 실패: '+e.message;
  }
}
async function deleteMyAccount(){
  if(!await oriConfirm('정말 탈퇴하시겠어요?\n즐겨찾기, 프로젝트, 프로필 연결이 모두 삭제되고 되돌릴 수 없어요.\n(단, 참여이력 데이터 자체는 아카이브 목적상 유지돼요)'))return;
  if(!await oriConfirm('마지막 확인이에요. 정말 탈퇴할까요?'))return;
  try{
    var r=await sbClient.rpc('delete_my_account');
    if(r.error)throw r.error;
    oriAlert('탈퇴 처리됐어요. 그동안 이용해주셔서 감사해요.');
    await sbClient.auth.signOut();
    location.reload();
  }catch(e){oriAlert('탈퇴 처리 중 문제가 생겼어요: '+e.message);}
}
function renderMyPageFavorites(el){
  var byType={};
  FAVORITES_LIST.filter(function(f){return f.list_type==='favorite';}).forEach(function(f){(byType[f.target_type]=byType[f.target_type]||[]).push(f.target_id);});
  var order=['show','work','troupe','venue','person'];
  var h='',any=false;
  order.forEach(function(type){
    var ids2=byType[type];if(!ids2||!ids2.length)return;
    any=true;
    h+='<div class="person-side-card" style="margin-bottom:1.3rem"><div class="person-side-title">'+FAV_TYPE_LABEL[type]+'</div><div class="cast-grid" style="margin-bottom:0">';
    ids2.forEach(function(id){h+=myCardHtml(type,id,'favorite');});
    h+='</div></div>';
  });
  if(!any)h='<div class="result-empty"><div class="result-empty-icon">🦆</div><div style="font-size:0.95rem;margin-bottom:0.4rem">아직 즐겨찾기한 게 없어요</div><div style="font-size:0.8rem;color:var(--muted)">공연·작품·단체·극장·사람 페이지에서 오리 아이콘을 눌러보세요.</div></div>';
  el.innerHTML=h;
}
function renderMyPageDashboard(el){
  if(!CURRENT_USER.personId){
    el.innerHTML='<div class="result-empty"><div class="result-empty-icon">📊</div><div style="font-size:0.95rem;margin-bottom:0.4rem">아직 연결된 프로필이 없어요</div><div style="font-size:0.8rem;color:var(--muted);margin-bottom:0.8rem">내 참여 이력을 찾아 연결하면, 여기에 내 활동 통계가 떠요.</div><button class="pf-btn pf-active" onclick="maybeForceShowConnectPrompt()">내 프로필 찾기</button></div>';
    return;
  }
  var pid=CURRENT_USER.personId;
  var hist=sortHistByShowDate(histByPerson(pid));
  var actors=hist.filter(function(h){return tname(h)==='배우';});
  var staff=hist.filter(function(h){return tname(h)==='스텝';});
  var showIds=[];hist.forEach(function(h){var sid=ids(fld(h,'공연'))[0]||'';if(sid&&showIds.indexOf(sid)===-1)showIds.push(sid);});
  var roleIds=[];actors.forEach(function(h){var rid=ids(fld(h,'배역'))[0]||'';if(rid&&roleIds.indexOf(rid)===-1)roleIds.push(rid);});
  var creationRecs=DB.creationHistory.filter(function(c){return ids(fld(c,'창작자')).indexOf(pid)>-1;});
  var creationWorkIds=[];creationRecs.forEach(function(c){var wid=ids(fld(c,'작품'))[0]||'';if(wid&&creationWorkIds.indexOf(wid)===-1)creationWorkIds.push(wid);});
  var troupeCntMap={};showIds.forEach(function(sid){var s=DB.shows.find(function(x){return x.id===sid;});if(!s)return;var tid=ids(fld(s,'극단'))[0]||'';if(!tid)return;troupeCntMap[tid]=(troupeCntMap[tid]||0)+1;});
  var troupeRanked=Object.keys(troupeCntMap).sort(function(a,b){return troupeCntMap[b]-troupeCntMap[a];}).slice(0,5);
  var yearCntMap={};showIds.forEach(function(sid){var y=yearOf(showDate(sid));if(y)yearCntMap[y]=(yearCntMap[y]||0)+1;});
  var allYears=Object.keys(yearCntMap).sort();var maxYearCnt=Math.max.apply(null,Object.values(yearCntMap).concat([1]));
  var roleById={};DB.roles.forEach(function(r){roleById[r.id]=r;});
  var tagCounts={};
  actors.forEach(function(h){ids(fld(h,'배역')).forEach(function(rid){var role=roleById[rid];if(!role)return;(fld(role,'태그')||[]).forEach(function(t){if(t)tagCounts[t]=(tagCounts[t]||0)+1;});});});
  var tagRanked=Object.keys(tagCounts).sort(function(a,b){return tagCounts[b]-tagCounts[a];}).slice(0,10);

  // 함께한 사람 (배우+스텝 통틀어)
  var coMap={};
  showIds.forEach(function(sid){DB.history.filter(function(h){return isValidH(h)&&ids(fld(h,'공연')).indexOf(sid)>-1;}).forEach(function(h){var cpid=ids(fld(h,'참여자'))[0]||'';if(!cpid||cpid===pid)return;coMap[cpid]=(coMap[cpid]||0)+1;});});
  var coRanked=Object.keys(coMap).sort(function(a,b){return coMap[b]-coMap[a];}).slice(0,8);

  // 최근 활동 (최근 5개 공연, 역할 라벨 포함)
  var showMap={};
  hist.forEach(function(rec){
    var sid=ids(fld(rec,'공연'))[0]||'';if(!sid)return;
    if(!showMap[sid])showMap[sid]={sid:sid,roles:[],staffRoles:[],d:showDate(sid)};
    if(tname(rec)==='배우'){var rid=ids(fld(rec,'배역'))[0]||'';if(rid&&nm(rid))showMap[sid].roles.push(nm(rid));}
    else{var srid=ids(fld(rec,'스텝'))[0]||'';if(srid&&nm(srid))showMap[sid].staffRoles.push(nm(srid));}
  });
  var recentShows=Object.values(showMap).sort(function(a,b){if(!a.d&&!b.d)return 0;if(!a.d)return 1;if(!b.d)return -1;return b.d.localeCompare(a.d);}).slice(0,5);

  // 즐겨찾기/위시/프로젝트 개수 (빠른 링크용)
  var favCnt=FAVORITES_LIST.filter(function(f){return f.list_type==='favorite';}).length;
  var wishCnt=FAVORITES_LIST.filter(function(f){return f.list_type==='wishlist';}).length;
  var projCnt=MY_PROJECTS_CACHE.length;

  var statsH='<div class="person-stats-inline">'
    +'<div class="psi-item"><div class="psi-num">'+showIds.length+'</div><div class="psi-label">총 공연</div></div>'
    +'<div class="psi-item"><div class="psi-num">'+actors.length+'</div><div class="psi-label">배우 참여</div></div>'
    +'<div class="psi-item"><div class="psi-num">'+staff.length+'</div><div class="psi-label">스텝 참여</div></div>'
    +(creationWorkIds.length?'<div class="psi-item"><div class="psi-num">'+creationWorkIds.length+'</div><div class="psi-label">창작 참여</div></div>':'')
    +'<div class="psi-item"><div class="psi-num">'+roleIds.length+'</div><div class="psi-label">맡은 배역</div></div>'
    +'</div>';

  var h='<div class="dash-quicklinks">'
    +'<button class="dash-quick-pill" onclick="switchMyPageTab(\'favorites\')">🦆 즐겨찾기 <b>'+favCnt+'</b></button>'
    +'<button class="dash-quick-pill" onclick="switchMyPageTab(\'wishlist\')">🚩 해보고 싶은 <b>'+wishCnt+'</b></button>'
    +'<button class="dash-quick-pill" onclick="switchMyPageTab(\'projects\')">🎪 프로젝트 <b>'+projCnt+'</b></button>'
    +'</div>';

  h+='<div class="person-overview-grid">';
  h+='<div class="person-side-card person-card-medium"><div class="person-side-title">내 활동 요약</div>'+statsH+'</div>';
  if(allYears.length){
    h+='<div class="year-chart-block person-card-medium"><div class="year-chart-title">연도별 공연 수</div><div class="mini-chart">';
    allYears.forEach(function(y){var cnt=yearCntMap[y];var barPx=Math.max(4,Math.round((cnt/maxYearCnt)*44));h+='<div class="mini-bar-wrap"><div class="mini-bar-cnt">'+cnt+'</div><div class="mini-bar" style="height:'+barPx+'px"></div><div class="mini-bar-label">'+y+'</div></div>';});
    h+='</div></div>';
  }
  if(troupeRanked.length){
    h+='<div class="person-side-card"><div class="person-side-title">주로 함께한 단체</div><div class="person-troupes-inline">';
    troupeRanked.forEach(function(tid){h+='<span class="troupe-chip" data-action="troupe" data-id="'+tid+'">'+nm(tid)+'<span class="troupe-chip-cnt">'+troupeCntMap[tid]+'회</span></span>';});
    h+='</div></div>';
  }
  if(tagRanked.length){
    h+='<div class="person-side-card"><div class="person-side-title">자주 맡은 배역 유형</div>';
    tagRanked.forEach(function(t){h+='<span class="role-tag-chip">'+t+'<span class="role-tag-chip-cnt">'+tagCounts[t]+'</span></span>';});
    h+='</div>';
  }
  if(creationWorkIds.length){
    h+='<div class="person-side-card"><div class="person-side-title">창작 참여 작품</div><div class="person-troupes-inline">';
    creationWorkIds.forEach(function(wid){h+='<span class="troupe-chip" data-action="work" data-id="'+wid+'">'+nm(wid)+'</span>';});
    h+='</div></div>';
  }
  h+='</div>';

  if(recentShows.length){
    h+='<div class="sec"><div class="sec-label">최근 활동</div><div style="display:flex;flex-direction:column;gap:0.4rem">'+recentShows.map(function(s){
      var p=POSTER[s.sid]||'';
      var roleLabel=s.roles.concat(s.staffRoles).join(', ');
      return '<div class="dash-recent-row" data-action="show" data-id="'+s.sid+'">'
        +(p?'<img src="'+p+'">':'<div class="dash-recent-ph">🎭</div>')
        +'<div><div style="font-size:0.85rem">'+nm(s.sid)+'</div><div style="font-size:0.72rem;color:var(--muted)">'+(roleLabel?roleLabel+' · ':'')+(ym(s.d)||'')+'</div></div></div>';
    }).join('')+'</div></div>';
  }

  if(coRanked.length){
    h+='<div class="sec"><div class="sec-label">자주 함께한 사람</div><div class="coactor-grid">'+coRanked.map(function(cpid){
      var cphoto=PERSON_PHOTO[cpid]||'';var cphotoH=cphoto?'<img class="coactor-photo" src="'+cphoto+'">':'<div class="coactor-photo-ph">🎭</div>';
      return '<div class="coactor-card" data-action="person" data-id="'+cpid+'">'+cphotoH+'<div class="coactor-info"><div class="coactor-name">'+nm(cpid)+'</div><div class="coactor-cnt">'+coMap[cpid]+'회 함께</div></div></div>';
    }).join('')+'</div></div>';
  }

  h+='<div style="text-align:center;margin-top:1rem"><button class="pf-btn" onclick="showPerson(\''+pid+'\')">내 프로필 전체 보기 →</button></div>';
  el.innerHTML=h;
}
function renderMyPageWishlist(el){
  var byType={};
  FAVORITES_LIST.filter(function(f){return f.list_type==='wishlist';}).forEach(function(f){(byType[f.target_type]=byType[f.target_type]||[]).push(f.target_id);});
  var order=['work','role'];
  var h='',any=false;
  order.forEach(function(type){
    var ids2=byType[type];if(!ids2||!ids2.length)return;
    any=true;
    h+='<div class="person-side-card" style="margin-bottom:1.3rem"><div class="person-side-title">해보고 싶은 '+FAV_TYPE_LABEL[type]+'</div><div class="cast-grid" style="margin-bottom:0">';
    ids2.forEach(function(id){h+=myCardHtml(type,id,'wishlist');});
    h+='</div></div>';
  });
  if(!any)h='<div class="result-empty"><div class="result-empty-icon">💗</div><div style="font-size:0.95rem;margin-bottom:0.4rem">아직 담아둔 게 없어요</div><div style="font-size:0.8rem;color:var(--muted)">작품·배역 페이지에서 하트 아이콘을 눌러보세요.</div></div>';
  el.innerHTML=h;
}
function renderMyPageProjects(el){
  el.innerHTML='<button class="pf-btn pf-active" style="margin-bottom:1rem" onclick="startNewProject()">+ 새 프로젝트 시작하기</button>'
    +'<div id="my-projects-list">불러오는 중…</div>';
  loadMyProjects();
}
function goMyPage(push,keepTab){
  if(push!==false)history.pushState({view:'mypage'},'','#mypage');
  setNav('mypage');sb('');_sbContext='';mobShowDetail();
  if(!CURRENT_USER){
    mn('<div class="tab-index"><div class="result-empty"><div class="result-empty-icon">👤</div><div style="font-size:0.95rem;margin-bottom:0.4rem">로그인이 필요해요</div><div style="font-size:0.8rem;color:var(--muted);margin-bottom:1rem">구글 계정으로 로그인하면 즐겨찾기를 저장할 수 있어요.</div><button class="pf-btn" onclick="loginWithGoogle()">구글로 로그인</button></div></div>');
    return;
  }
  if(!keepTab)window._myPageTab='info';
  renderMyPage();
}
