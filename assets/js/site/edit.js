/* 오리 어드민 — 사이트에서 편집
   어드민(admin.html > 사이트에서 편집)이 오리 사이트를 ?edit=1 로 품어 띄울 때만 불러온다 (gongyon-db.html 맨 아래).
   일반 사이트에는 이 파일이 아예 로드되지 않는다. 관리자(user_profiles.is_admin)일 때만 켜진다.
   - 비공개(라이선스 미상·미확보, 숨김) 공연과 이력 없는 사람까지 모두 보인다 (core.js load()).
   - 상세(전용 페이지·오른쪽 패널)의 기본 정보는 값을 눌러 그 자리에서 고친다.
   - 사진 관리·삭제는 상세 맨 위 편집 줄에서, 출연진·제작진·배역·창작진은 해당 섹션의 + / × 로.
   - 목록 화면에서는 오른쪽 아래 "+ 새 …" 버튼으로 추가한다.
   쓰기 권한은 DB 정책(is_admin())이 최종으로 막는다. */
var EDIT={admin:false,on:false};
function isEditMode(){return EDIT.admin&&EDIT.on;}

var ED_BOOL=[['','—'],['true','예'],['false','아니오']];
var ED_SCHEMA={
  show:{table:'shows',label:'공연',img:'poster_urls',nameCol:'title',fields:[
    ['title','공연명','text'],['work_id','작품','fk:work'],['troupe_id','단체','fk:troupe'],['venue_id','극장','fk:venue'],
    ['show_date','시작일','date'],['end_date','종료일','date'],
    ['is_licensed','라이선스','select',[['','미상 (비공개)'],['창작','창작'],['완료','완료 (확보)'],['미확보','미확보 (비공개)']]],
    ['audience_count','관객수','number'],['is_sold_out','매진','select',ED_BOOL],['has_rerun','재공연','select',ED_BOOL],
    ['is_hidden','숨김','select',[['false','공개'],['true','숨김 (저작권 신고 등)']]]]},
  work:{table:'works',label:'작품',img:'poster_urls',nameCol:'title',fields:[
    ['title','작품명','text'],['title_en','영문 제목','text'],['genre','구분','suggest',['뮤지컬','연극']],
    ['country','국가','list'],['premiere_year','초연 연도','number'],['tags','태그','list'],
    ['rights_type','권리 유형','select',[['',''],['창작','창작'],['번안','번안'],['해외라이선스','해외라이선스'],['공유저작물','공유저작물'],['확인불가','확인불가']]],
    ['amateur_license_status','아마추어 라이선스','select',[['',''],['제공','제공'],['협의가능','협의가능'],['미제공','미제공'],['확인불가','확인불가']]],
    ['rights_holder_display','권리자','text'],['license_note','라이선스 메모','textarea']]},
  role:{table:'roles',label:'배역',img:'photo_urls',nameCol:'name',fields:[
    ['name','배역명','text'],['work_id','작품','fk:work'],['order_num','순서','number'],
    ['gender','성별','select',[['',''],['남','남'],['여','여']]],['tags','태그','list']]},
  troupe:{table:'troupes',label:'단체',img:'photo_urls',nameCol:'name',fields:[
    ['name','단체명','text'],['org_type','조직 형태','list'],['member_base','구성원','select',[['',''],['학생','학생'],['직장인','직장인'],['일반','일반']]],
    ['status','운영 상태','select',[['',''],['창단준비중','창단준비중'],['활동중','활동중'],['활동뜸함','활동뜸함'],['해체','해체']]],
    ['region','활동 지역','list'],['founded_year','창단 연도','number'],['recruiting_info','단원 모집','textarea'],['contact','연락처','text'],['memo','메모','textarea']]},
  venue:{table:'venues',label:'극장',img:'photo_urls',nameCol:'name',fields:[
    ['name','극장명','text'],['address','주소','text'],['seat_count','좌석 (최소)','number'],['seat_count_max','좌석 (최대)','number'],
    ['seat_detail_note','좌석 메모','text'],['rental_available','대관','select',ED_BOOL],['rental_fee','대관료','text'],
    ['parking_available','주차','select',ED_BOOL],['transit_info','대중교통','text'],['contact','연락처','text']]},
  person:{table:'people',label:'사람',img:'photo_urls',nameCol:'name',fields:[
    ['name','이름','text'],['name_en','영문 이름','text'],['nickname','활동명','text'],
    ['gender','성별','select',[['',''],['남','남'],['여','여'],['기타','기타']]]]}
};
var ED_FK_LIST={work:function(){return DB.works;},troupe:function(){return DB.troupes;},venue:function(){return DB.venues;}};
var ED_LIST_VIEWS={shows:'show',works:'work',people:'person',troupes:'troupe',venues:'venue',roles:'role'};

/* ── 켜기: 관리자면 바로 켠다 ── */
function edInit(){
  EDIT.admin=!!(CURRENT_USER&&CURRENT_USER.isAdmin);
  EDIT.on=EDIT.admin;
  document.body.classList.toggle('edit-mode',isEditMode());
  edSyncFab(window._edNavV);
}
/* 데이터를 다시 읽고 지금 화면(과 열려 있던 패널)을 그대로 다시 그린다 */
async function edReload(){
  var y=window.scrollY,top=PEEK.open&&PEEK.stack[PEEK.stack.length-1];
  var tab=DV_STATE.tab;
  await load();
  routeFromHash(location.hash);
  if(DV_STATE.tab!==tab&&_dvModel){DV_STATE.tab=tab;dvRender(_dvModel,true);}
  window.scrollTo(0,y);
  if(top&&PEEK_LABEL[top.action]&&edExists(top.action,top.id))openPeek(top.action,top.id);
}
function edExists(type,id){
  var arr={show:DB.shows,person:DB.people,work:DB.works,role:DB.roles,venue:DB.venues,troupe:DB.troupes}[type]||[];
  return arr.some(function(r){return r.id===id;});
}

/* 비공개 표시: 편집 모드에서만 보이는 공연에 붙는 작은 딱지 */
function edShowIsPublic(s){var l=fld(s,'라이선스상태');return (l==='창작'||l==='완료')&&!fld(s,'숨김');}
function edPrivBadge(s){
  if(!isEditMode()||!s||edShowIsPublic(s))return '';
  var l=fld(s,'라이선스상태');
  var why=fld(s,'숨김')?'숨김':(l==='미확보'?'라이선스 미확보':'라이선스 미상');
  return '<span class="ed-priv" title="사이트에는 안 보여요">비공개 · '+why+'</span>';
}

/* ── 값 표시·입력 ── */
function edFkLabel(kind,id){if(!id)return '';var r=(ED_FK_LIST[kind]()||[]).find(function(x){return x.id===id;});return r?nm(r.id):'(목록에 없음)';}
function edDisplay(f,v){
  var t=f[2];
  if(v==null||v===''||(Array.isArray(v)&&!v.length))return '<span class="ed-empty">+ 입력</span>';
  if(t.indexOf('fk:')===0)return escHtml(edFkLabel(t.slice(3),v));
  if(t==='select'){var o=(f[3]||[]).find(function(x){return x[0]===String(v);});return escHtml(o?o[1]:String(v));}
  if(t==='list')return v.map(function(x){return '<span class="ed-tag">'+escHtml(x)+'</span>';}).join('');
  if(t==='date')return escHtml(String(v).replace(/-/g,'.'));
  return escHtml(String(v)).replace(/\n/g,'<br>');
}
function edInput(f,v,extraAttr){
  var t=f[2],a=' name="'+f[0]+'" class="ed-in"'+(extraAttr||'');
  var val=v==null?'':v;
  if(t.indexOf('fk:')===0){
    var kind=t.slice(3);
    var rows=(ED_FK_LIST[kind]()||[]).slice().sort(function(x,y){return nm(x.id).localeCompare(nm(y.id));});
    return '<select'+a+' data-fk="'+kind+'"><option value="">— 없음 —</option>'+rows.map(function(r){return '<option value="'+r.id+'"'+(r.id===val?' selected':'')+'>'+escHtml(nm(r.id))+'</option>';}).join('')
      +'<option value="__new">＋ 새로 만들기…</option></select>';
  }
  if(t==='select')return '<select'+a+'>'+(f[3]||[]).map(function(o){return '<option value="'+escHtml(o[0])+'"'+(o[0]===String(val)?' selected':'')+'>'+escHtml(o[1]||'—')+'</option>';}).join('')+'</select>';
  if(t==='suggest'){var dl='ed-dl-'+f[0];return '<input type="text"'+a+' list="'+dl+'" value="'+escHtml(val)+'"><datalist id="'+dl+'">'+(f[3]||[]).map(function(o){return '<option value="'+escHtml(o)+'">';}).join('')+'</datalist>';}
  if(t==='list')return '<input type="text"'+a+' value="'+escHtml((val||[]).join(', '))+'" placeholder="쉼표로 구분">';
  if(t==='textarea')return '<textarea'+a+' rows="3">'+escHtml(val)+'</textarea>';
  return '<input type="'+(t==='number'?'number':t==='date'?'date':'text')+'"'+a+' value="'+escHtml(val)+'">';
}
function edRead(f,el){
  var t=f[2],v=el.value;
  if(t==='list'){var arr=v.split(',').map(function(x){return x.trim();}).filter(Boolean);return arr.length?arr:null;}
  if(v==='')return null;
  if(t==='number'){var n=Number(v);return isNaN(n)?null:n;}
  if(t==='select'&&(v==='true'||v==='false'))return v==='true';
  return v;
}
/* fk 선택에서 "새로 만들기"를 고르면 이름만 받아 바로 만든다 */
async function edFkNew(sel){
  if(sel.value!=='__new')return true;
  var kind=sel.dataset.fk,sc=ED_SCHEMA[kind];
  var name=await oriPrompt('새 '+sc.label+' 이름','');
  if(!name||!name.trim()){sel.value='';return false;}
  var ins={};ins[sc.nameCol]=name.trim();
  var r=await sbClient.from(sc.table).insert(ins).select('id').single();
  if(r.error){oriAlert('만들지 못했어요: '+r.error.message);sel.value='';return false;}
  await load();
  var o=document.createElement('option');o.value=r.data.id;o.textContent=name.trim();o.selected=true;sel.insertBefore(o,sel.lastChild);
  return true;
}

/* ── 상세 화면: 기본 정보 표를 그 자리에서 고치기 ── */
function edInfoSlot(type,id){return '<section class="dv-sec dv-sec-info ed-info" data-ed-type="'+type+'" data-ed-id="'+id+'"><div class="ed-loading">불러오는 중…</div></section>';}
function edAfterRender(root){
  (root||document).querySelectorAll('.ed-info[data-ed-type]').forEach(function(el){edRenderInfo(el,el.dataset.edType,el.dataset.edId);});
}
async function edRenderInfo(el,type,id){
  var sc=ED_SCHEMA[type];if(!sc)return;
  var r=await sbClient.from(sc.table).select('*').eq('id',id).maybeSingle();
  if(r.error||!r.data){el.innerHTML='<div class="ed-loading">정보를 불러오지 못했어요.</div>';return;}
  var row=r.data;
  el.innerHTML='<dl class="dv-info">'+sc.fields.map(function(f,i){
    return '<div class="dv-info-row ed-row" data-i="'+i+'"><dt>'+f[1]+'</dt><dd class="ed-val" title="눌러서 고치기">'+edDisplay(f,row[f[0]])+'</dd></div>';
  }).join('')+'</dl>';
  el._row=row;
}
async function edStartInline(dd){
  var rowEl=dd.closest('.ed-row'),box=dd.closest('.ed-info');if(!rowEl||!box||dd.querySelector('.ed-in'))return;
  var type=box.dataset.edType,id=box.dataset.edId,sc=ED_SCHEMA[type],f=sc.fields[+rowEl.dataset.i],row=box._row||{};
  var old=dd.innerHTML;
  dd.innerHTML='<div class="ed-inline">'+edInput(f,row[f[0]])+'<button type="button" class="ed-ok" title="저장 (Enter)">저장</button><button type="button" class="ed-cancel" title="취소 (Esc)">취소</button></div>';
  var inp=dd.querySelector('.ed-in');inp.focus();if(inp.select&&inp.type!=='date')inp.select();
  var done=false;
  function cancel(){if(done)return;done=true;dd.innerHTML=old;}
  async function save(){
    if(done)return;
    if(inp.dataset.fk&&!(await edFkNew(inp)))return;
    var v=edRead(f,inp);
    if(f[0]===sc.nameCol&&!v){oriAlert(f[1]+'은 비울 수 없어요.');return;}
    done=true;dd.innerHTML='<span class="ed-loading">저장 중…</span>';
    var patch={};patch[f[0]]=v;
    var u=await sbClient.from(sc.table).update(patch).eq('id',id);
    if(u.error){oriAlert('저장하지 못했어요: '+u.error.message);dd.innerHTML=old;return;}
    edToast(f[1]+' 저장했어요');
    await edReload();
  }
  dd.querySelector('.ed-ok').onclick=save;
  dd.querySelector('.ed-cancel').onclick=cancel;
  inp.addEventListener('keydown',function(e){
    if(e.key==='Enter'&&inp.tagName!=='TEXTAREA'){e.preventDefault();save();}
    if(e.key==='Escape'){e.stopPropagation();cancel();}
  });
  if(inp.tagName==='SELECT')inp.addEventListener('change',function(){if(inp.value!=='__new'||true)save();});
}

/* 상세 맨 위 편집 줄: 사진 관리 / 삭제 */
function edBar(type,id,extra){
  var sc=ED_SCHEMA[type];if(!sc)return '';
  return '<div class="ed-bar"><span class="ed-bar-l">✎ 편집 모드 · 값을 누르면 바로 고쳐져요</span>'+(extra||'')
    +'<button type="button" class="ed-btn" data-ed="photos" data-type="'+type+'" data-id="'+id+'">사진 관리</button>'
    +'<button type="button" class="ed-btn ed-danger" data-ed="delete" data-type="'+type+'" data-id="'+id+'">삭제</button></div>';
}

/* ── 창(모달) ── */
function edModal(title,body,okLabel){
  return new Promise(function(resolve){
    var ov=document.getElementById('ed-modal');
    if(!ov){ov=document.createElement('div');ov.id='ed-modal';document.body.appendChild(ov);}
    ov.innerHTML='<div class="edm-panel" role="dialog" aria-label="'+escHtml(title)+'"><div class="edm-head"><b>'+escHtml(title)+'</b><button type="button" class="edm-x" title="닫기">✕</button></div>'
      +'<div class="edm-body">'+body+'</div><div class="edm-foot"><button type="button" class="ed-btn edm-cancel">취소</button><button type="button" class="ed-btn ed-primary edm-ok">'+(okLabel||'저장')+'</button></div></div>';
    ov.classList.add('open');
    function close(v){ov.classList.remove('open');document.removeEventListener('keydown',onKey,true);resolve(v);}
    function onKey(e){if(e.key==='Escape'){e.stopPropagation();close(null);}}
    document.addEventListener('keydown',onKey,true);
    ov.querySelector('.edm-x').onclick=function(){close(null);};
    ov.querySelector('.edm-cancel').onclick=function(){close(null);};
    ov.onclick=function(e){if(e.target===ov)close(null);};
    ov.querySelector('.edm-ok').onclick=function(){close(ov.querySelector('.edm-body'));};
    var first=ov.querySelector('.edm-body input,.edm-body select,.edm-body textarea');if(first)first.focus();
  });
}
function edToast(msg){
  var t=document.getElementById('ed-toast');
  if(!t){t=document.createElement('div');t.id='ed-toast';document.body.appendChild(t);}
  t.textContent=msg;t.classList.add('on');clearTimeout(t._h);t._h=setTimeout(function(){t.classList.remove('on');},1800);
}

/* ── 새로 추가 (목록 화면의 + 버튼) ── */
function edSyncFab(v){
  window._edNavV=v;
  var fab=document.getElementById('ed-fab');
  var type=ED_LIST_VIEWS[v];
  if(!isEditMode()||!type){if(fab)fab.remove();return;}
  if(!fab){fab=document.createElement('button');fab.id='ed-fab';fab.type='button';document.body.appendChild(fab);}
  fab.dataset.ed='new';fab.dataset.type=type;
  fab.textContent='＋ 새 '+ED_SCHEMA[type].label;
}
async function edNew(type){
  var sc=ED_SCHEMA[type];
  var body='<div class="ed-form">'+sc.fields.filter(function(f){return f[0]!=='is_hidden';}).map(function(f){
    return '<label class="ed-field"><span>'+f[1]+(f[0]===sc.nameCol?' <em>*</em>':'')+'</span>'+edInput(f,f[0]==='is_licensed'?'창작':null)+'</label>';
  }).join('')+'</div><p class="ed-hint">사진은 만든 다음 상세 화면의 "사진 관리"에서 올려요.</p>';
  var box=await edModal('새 '+sc.label,body,'만들기');
  if(!box)return;
  var ins={};
  for(var i=0;i<sc.fields.length;i++){
    var f=sc.fields[i],el=box.querySelector('[name="'+f[0]+'"]');if(!el)continue;
    if(el.dataset.fk&&el.value==='__new'&&!(await edFkNew(el)))return;
    var v=edRead(f,el);if(v!=null)ins[f[0]]=v;
  }
  if(!ins[sc.nameCol]){oriAlert(sc.fields[0][1]+'을 입력해주세요.');return;}
  if(type==='role'&&!ins.work_id){oriAlert('배역은 작품을 골라야 만들 수 있어요.');return;}
  var r=await sbClient.from(sc.table).insert(ins).select('id').single();
  if(r.error){oriAlert('만들지 못했어요: '+r.error.message);return;}
  await load();
  edToast(sc.label+'을 만들었어요');
  openDetail(type,r.data.id);
}

/* ── 사진 관리 ── */
async function edPhotos(type,id){
  var sc=ED_SCHEMA[type];
  var r=await sbClient.from(sc.table).select(sc.img).eq('id',id).single();
  if(r.error){oriAlert(r.error.message);return;}
  var urls=(r.data[sc.img]||[]).slice();
  var body='<div class="ed-photos"></div><label class="ed-upload">＋ 사진 올리기<input type="file" accept="image/*" multiple hidden></label><div class="ed-hint ed-up-status">첫 번째 사진이 대표 사진이에요.</div>';
  var ov=document.getElementById('ed-modal');
  var p=edModal(sc.label+' 사진',body,'저장');
  ov=document.getElementById('ed-modal');
  var grid=ov.querySelector('.ed-photos'),status=ov.querySelector('.ed-up-status');
  function draw(){
    grid.innerHTML=urls.length?urls.map(function(u,i){
      return '<div class="ed-ph'+(i===0?' first':'')+'"><img src="'+escHtml(u)+'" alt="">'
        +(i===0?'<span class="ed-ph-main">대표</span>':'<button type="button" data-i="'+i+'" class="ed-ph-top" title="대표로">대표로</button>')
        +'<button type="button" data-i="'+i+'" class="ed-ph-rm" title="빼기">✕</button></div>';
    }).join(''):'<div class="ed-hint">아직 사진이 없어요.</div>';
  }
  draw();
  grid.onclick=function(e){
    var b=e.target.closest('button');if(!b)return;var i=+b.dataset.i;
    if(b.classList.contains('ed-ph-rm'))urls.splice(i,1);
    else if(b.classList.contains('ed-ph-top'))urls.unshift(urls.splice(i,1)[0]);
    draw();
  };
  ov.querySelector('.ed-upload input').onchange=async function(e){
    var files=[].slice.call(e.target.files||[]);
    for(var k=0;k<files.length;k++){
      var file=files[k];status.textContent='올리는 중… ('+file.name+')';
      var path=type+'/'+Date.now()+'_'+Math.random().toString(36).slice(2,7)+'_'+file.name.replace(/[^a-zA-Z0-9.\-_]/g,'_');
      var up=await sbClient.storage.from('photos').upload(path,file);
      if(up.error){status.textContent='올리지 못했어요: '+up.error.message;continue;}
      urls.push(sbClient.storage.from('photos').getPublicUrl(path).data.publicUrl);draw();
      status.textContent='다 올렸어요. 저장을 눌러야 반영돼요.';
    }
    e.target.value='';
  };
  var box=await p;if(!box)return;
  var patch={};patch[sc.img]=urls.length?urls:null;
  var u=await sbClient.from(sc.table).update(patch).eq('id',id);
  if(u.error){oriAlert('저장하지 못했어요: '+u.error.message);return;}
  edToast('사진을 저장했어요');await edReload();
}

/* ── 삭제 ── */
var ED_FK_LABELS={participation_history:'참여 이력',creation_history:'창작 이력',shows:'공연',works:'작품',roles:'배역',staff_roles:'스텝 역할',troupes:'단체',venues:'극장',people:'사람',projects:'프로젝트'};
async function edDelete(type,id){
  var sc=ED_SCHEMA[type];
  if(!(await oriConfirm('"'+nm(id)+'" '+sc.label+'을 지울까요? 되돌릴 수 없어요.')))return;
  var r=await sbClient.from(sc.table).delete().eq('id',id);
  if(r.error){
    if(r.error.code==='23503'){var m=/on table "([a-z_]+)"/.exec(r.error.message);var ref=m?(ED_FK_LABELS[m[1]]||m[1]):'다른 데이터';
      oriAlert('지울 수 없어요. 이 '+sc.label+'을 아직 "'+ref+'"에서 쓰고 있어요. 그쪽을 먼저 정리해주세요.');}
    else oriAlert('지우지 못했어요: '+r.error.message);
    return;
  }
  edToast('지웠어요');
  if(PEEK.open){var top=PEEK.stack[PEEK.stack.length-1];if(top&&top.id===id)closePeek();}
  await load();
  var back={show:'#shows',person:'#people',work:'#works',role:'#roles',venue:'#venues',troupe:'#troupes'}[type];
  if(location.hash.indexOf(id)>-1){history.replaceState(null,'',back);}
  await edReload();
}

/* ── 공연의 출연진·제작진 ── */
function edPersonChip(pid,sid,refId,kind){
  return '<span class="ed-chip">'+dvLink('person',pid,nm(pid))
    +'<button type="button" class="ed-chip-x" data-ed="rmcast" data-sid="'+sid+'" data-pid="'+pid+'" data-ref="'+(refId||'')+'" data-kind="'+kind+'" title="이 공연에서 빼기">✕</button></span>';
}
function edCastRow(sid,rid,roleName,pids,photo){
  var u=photo||(pids[0]&&PERSON_PHOTO[pids[0]])||'';
  return '<div class="dv-role">'+(u?'<img class="dv-role-img" src="'+u+'" alt="">':'<div class="dv-role-img dv-card-ph">🎭</div>')
    +'<div class="dv-role-main"><div class="dv-role-name">'+(rid?dvLink('role',rid,roleName):'배역 미정')+'</div>'
    +'<div class="dv-role-cast">'+pids.map(function(p){return edPersonChip(p,sid,rid,'actor');}).join(' ')+'</div></div></div>';
}
function edCreditRow(sid,srid,label,pids){
  return '<div class="dv-credit"><span class="dv-credit-l">'+escHtml(label)+'</span><span class="dv-credit-v">'+pids.map(function(p){return edPersonChip(p,sid,srid,'staff');}).join(' ')+'</span></div>';
}
function edAddBtn(label,attrs){return '<button type="button" class="ed-add" '+attrs+'>＋ '+label+'</button>';}

function edPeoplePickerHtml(){
  return '<label class="ed-field"><span>사람</span><div class="ed-pp"><input type="text" class="ed-in ed-pp-q" placeholder="이름으로 찾기" autocomplete="off"><input type="hidden" name="person_id"><div class="ed-pp-list"></div></div></label>';
}
function edWirePeoplePicker(box){
  var q=box.querySelector('.ed-pp-q'),hid=box.querySelector('[name=person_id]'),list=box.querySelector('.ed-pp-list');
  function draw(){
    var s=q.value.trim();hid.value='';
    if(!s){list.innerHTML='';return;}
    var hits=DB.people.filter(function(p){return (fld(p,'이름')||'').indexOf(s)>-1;}).slice(0,8);
    list.innerHTML=hits.map(function(p){
      var n=DB.history.filter(function(h){return ids(fld(h,'참여자')).indexOf(p.id)>-1;}).length;
      return '<button type="button" data-pid="'+p.id+'">'+escHtml(fld(p,'이름'))+'<small>'+(n?'이력 '+n+'건':'이력 없음')+'</small></button>';
    }).join('')+'<button type="button" data-new="1" class="ed-pp-new">＋ "'+escHtml(s)+'" 새 사람으로 추가</button>';
  }
  q.addEventListener('input',draw);
  list.onclick=function(e){
    var b=e.target.closest('button');if(!b)return;
    if(b.dataset.new){hid.value='__new:'+q.value.trim();}else{hid.value=b.dataset.pid;q.value=nm(b.dataset.pid);}
    list.querySelectorAll('button').forEach(function(x){x.classList.toggle('on',x===b);});
  };
}
async function edResolvePerson(v){
  if(!v)return null;
  if(v.indexOf('__new:')!==0)return v;
  var r=await sbClient.from('people').insert({name:v.slice(6)}).select('id').single();
  if(r.error){oriAlert('사람을 만들지 못했어요: '+r.error.message);return null;}
  return r.data.id;
}
async function edAddCast(sid,kind){
  var show=DB.shows.find(function(s){return s.id===sid;});if(!show)return;
  var wid=ids(fld(show,'작품'))[0]||'';
  var roleSel;
  if(kind==='actor'){
    var roles=DB.roles.filter(function(r){return ids(fld(r,'작품')).indexOf(wid)>-1;}).sort(function(a,b){return (ROLE_ORDER[a.id]||99)-(ROLE_ORDER[b.id]||99);});
    roleSel='<label class="ed-field"><span>배역</span><select name="ref" class="ed-in">'+roles.map(function(r){return '<option value="'+r.id+'">'+escHtml(nm(r.id))+'</option>';}).join('')
      +(wid?'<option value="__new">＋ 새 배역…</option>':'')+'<option value="">배역 미정</option></select></label>'
      +(wid?'':'<p class="ed-hint">이 공연에 작품이 연결돼 있지 않아서 배역을 고를 수 없어요.</p>');
  }else{
    var srs=DB.staffRoles.slice().sort(function(a,b){return (STAFF_ORDER[a.id]||99)-(STAFF_ORDER[b.id]||99);});
    roleSel='<label class="ed-field"><span>역할</span><select name="ref" class="ed-in">'+srs.map(function(r){return '<option value="'+r.id+'">'+escHtml(nm(r.id))+'</option>';}).join('')+'</select></label>';
  }
  var p=edModal(kind==='actor'?'출연진 추가':'제작진 추가','<div class="ed-form">'+edPeoplePickerHtml()+roleSel+'</div>','추가');
  var ov=document.getElementById('ed-modal');edWirePeoplePicker(ov);
  var box=await p;if(!box)return;
  var pid=await edResolvePerson(box.querySelector('[name=person_id]').value);
  if(!pid){oriAlert('사람을 목록에서 골라주세요.');return;}
  var ref=box.querySelector('[name=ref]').value;
  if(ref==='__new'){
    var rn=await oriPrompt('새 배역 이름','');if(!rn||!rn.trim())return;
    var nr=await sbClient.from('roles').insert({name:rn.trim(),work_id:wid}).select('id').single();
    if(nr.error){oriAlert('배역을 만들지 못했어요: '+nr.error.message);return;}
    ref=nr.data.id;
  }
  // 같은 공연·사람의 참여 이력이 있으면 거기에 붙인다 (배우+스텝 겸직)
  var ex=await sbClient.from('participation_history').select('id').eq('show_id',sid).eq('person_id',pid).limit(1);
  var phid=ex.data&&ex.data[0]&&ex.data[0].id;
  if(!phid){
    var ins=await sbClient.from('participation_history').insert({show_id:sid,person_id:pid,role_type:kind==='actor'?'배우':'스텝'}).select('id').single();
    if(ins.error){oriAlert('추가하지 못했어요: '+ins.error.message);return;}
    phid=ins.data.id;
  }
  if(ref){
    var link=kind==='actor'?sbClient.from('participation_roles').insert({participation_id:phid,role_id:ref}):sbClient.from('participation_staff_roles').insert({participation_id:phid,staff_role_id:ref});
    var lr=await link;if(lr.error&&lr.error.code!=='23505'){oriAlert('역할을 붙이지 못했어요: '+lr.error.message);}
  }
  edToast(nm(pid)||'추가했어요');await edReload();
}
async function edRemoveCast(sid,pid,ref,kind){
  if(!(await oriConfirm(nm(pid)+' 님을 이 공연의 '+(kind==='actor'?(ref?nm(ref)+' 역':'출연진'):(ref?nm(ref):'제작진'))+'에서 뺄까요?')))return;
  var ph=await sbClient.from('participation_history').select('id').eq('show_id',sid).eq('person_id',pid);
  var phIds=(ph.data||[]).map(function(x){return x.id;});
  if(!phIds.length){await edReload();return;}
  if(ref){
    var q=kind==='actor'?sbClient.from('participation_roles').delete().in('participation_id',phIds).eq('role_id',ref):sbClient.from('participation_staff_roles').delete().in('participation_id',phIds).eq('staff_role_id',ref);
    var d=await q;if(d.error){oriAlert('빼지 못했어요: '+d.error.message);return;}
  }
  // 남은 역할이 없는 참여 이력은 정리한다
  for(var i=0;i<phIds.length;i++){
    var a=await sbClient.from('participation_roles').select('role_id').eq('participation_id',phIds[i]);
    var b=await sbClient.from('participation_staff_roles').select('staff_role_id').eq('participation_id',phIds[i]);
    if(!(a.data||[]).length&&!(b.data||[]).length)await sbClient.from('participation_history').delete().eq('id',phIds[i]);
  }
  edToast('뺐어요');await edReload();
}

/* ── 작품의 등장인물·창작진 ── */
async function edAddRole(wid){
  var n=await oriPrompt('새 배역 이름','');if(!n||!n.trim())return;
  var max=0;DB.roles.forEach(function(r){if(ids(fld(r,'작품')).indexOf(wid)>-1)max=Math.max(max,ROLE_ORDER[r.id]||0);});
  var r=await sbClient.from('roles').insert({name:n.trim(),work_id:wid,order_num:max+1}).select('id').single();
  if(r.error){oriAlert('만들지 못했어요: '+r.error.message);return;}
  edToast('배역을 추가했어요');await edReload();
}
async function edAddCreator(wid){
  var types=[];try{var t=await sbClient.from('creation_types').select('id,name').order('name');types=t.data||[];}catch(e){}
  var p=edModal('창작진 추가','<div class="ed-form">'+edPeoplePickerHtml()
    +(types.length?'<label class="ed-field"><span>역할</span><select name="ctype" class="ed-in"><option value="">—</option>'+types.map(function(x){return '<option value="'+x.id+'">'+escHtml(x.name)+'</option>';}).join('')+'</select></label>':'')+'</div>','추가');
  edWirePeoplePicker(document.getElementById('ed-modal'));
  var box=await p;if(!box)return;
  var pid=await edResolvePerson(box.querySelector('[name=person_id]').value);
  if(!pid){oriAlert('사람을 목록에서 골라주세요.');return;}
  var ct=box.querySelector('[name=ctype]');
  var r=await sbClient.from('creation_history').insert({work_id:wid,person_id:pid,creation_type_id:ct&&ct.value||null});
  if(r.error){oriAlert('추가하지 못했어요: '+r.error.message);return;}
  edToast('창작진을 추가했어요');await edReload();
}
async function edRemoveCreator(wid,pid){
  if(!(await oriConfirm(nm(pid)+' 님을 창작진에서 뺄까요?')))return;
  var r=await sbClient.from('creation_history').delete().eq('work_id',wid).eq('person_id',pid);
  if(r.error){oriAlert('빼지 못했어요: '+r.error.message);return;}
  edToast('뺐어요');await edReload();
}

/* ── 클릭 위임 ── */
document.addEventListener('click',function(e){
  if(!isEditMode())return;
  var dd=e.target.closest('.ed-info .ed-val');
  if(dd&&!e.target.closest('.ed-inline')){e.preventDefault();edStartInline(dd);return;}
  var b=e.target.closest('[data-ed]');if(!b)return;
  e.preventDefault();e.stopPropagation();
  var k=b.dataset.ed;
  if(k==='photos')edPhotos(b.dataset.type,b.dataset.id);
  else if(k==='delete')edDelete(b.dataset.type,b.dataset.id);
  else if(k==='new')edNew(b.dataset.type);
  else if(k==='addcast')edAddCast(b.dataset.sid,b.dataset.kind);
  else if(k==='rmcast')edRemoveCast(b.dataset.sid,b.dataset.pid,b.dataset.ref,b.dataset.kind);
  else if(k==='addrole')edAddRole(b.dataset.wid);
  else if(k==='addcreator')edAddCreator(b.dataset.wid);
  else if(k==='rmcreator')edRemoveCreator(b.dataset.wid,b.dataset.pid);
},true);
