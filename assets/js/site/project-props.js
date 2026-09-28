/* 오리 사이트 — 프로젝트 소품 큐시트 (준비 탭 › 소품)
   구조: 장면(project_scenes) × 소품(project_props) → 큐(project_prop_cues)
   큐 한 줄 = 이 장면에서 이 소품이 [누가·어디서·어떻게] 들어와 → [무슨 일을 겪고] → [누가·어디로·어떻게] 나간다.
   보기 셋:
     장면 순 — 백스테이지에서 실제로 보는 큐시트
     소품별 — 소품 하나의 여정(프리셋 → 장면들 → 끝). 동선이 끊기는 곳을 짚어준다
     인물별 — 배우 한 명이 챙겨야 할 소품 (그 사람만 뽑아서 인쇄)
   동선 점검(propsCheck): 무대에 남겼는데 다음엔 옆에서 들어옴 / 상수로 나갔다 하수로 들어옴 / 소모되는데 수량 부족 등.
   팀원 누구나 편집(RLS: 프로젝트 참여자). */
var PROP_STATUS=[['need','필요'],['sourcing','구하는 중'],['ready','준비됨']];
var CUE_IN_FROM=['상수','하수','객석','무대 위(이미 있음)','무대 뒤','위에서'];
var CUE_IN_HOW=['들고 등장','크루가 세팅','암전 중 세팅','건네받음','던져 받음'];
var CUE_OUT_TO=['상수','하수','객석','무대에 남김','소모됨'];
var CUE_OUT_HOW=['들고 퇴장','크루가 회수','암전 중 회수','건네줌','다음 장면까지 둠'];
var ON_STAGE='무대 위(이미 있음)',LEFT='무대에 남김',USED='소모됨';
var _pp={pid:null,scenes:[],props:[],cues:[],chars:[],view:'scene',person:'',perf:0};

function openPropsView(v){_pp.view=v;propsDraw();}
async function renderProjectPropsTab(body){
  var ctx=window._projectCtx;_pp.pid=ctx.pid;
  body.innerHTML='<div id="pp" class="pp"><div class="hf-loading">불러오는 중…</div></div>';
  await loadPropsData();
}
async function loadPropsData(){
  var ctx=window._projectCtx,pid=ctx.pid;
  var q=function(t,o){return sbClient.from(t).select('*').eq('project_id',pid).order(o||'order_num',{ascending:true});};
  var res=await Promise.all([q('project_scenes'),q('project_props'),q('project_prop_cues'),
    sbClient.from('project_positions').select('position_type,position_label,role_id').eq('project_id',pid),
    sbClient.from('project_events').select('kind').eq('project_id',pid).eq('kind','performance')]);
  if(window._projectCtx!==ctx)return;
  if(res[0].error||res[1].error||res[2].error){var e=$('pp');if(e)e.innerHTML='<div class="result-empty">큐시트를 불러오지 못했어요.</div>';return;}
  _pp.scenes=res[0].data;_pp.props=res[1].data;_pp.cues=res[2].data;_pp.perf=(res[4].data||[]).length;
  // 인물 후보: 이 프로젝트의 배역 자리 + 작품 배역 + 크루
  var names=[];
  (res[3].data||[]).forEach(function(p){if(p.position_type==='actor')names.push(p.role_id&&nm(p.role_id)||p.position_label);});
  if(ctx.pr.work_id)(DB.roles||[]).filter(function(r){return ids(fld(r,'작품')).indexOf(ctx.pr.work_id)>-1;}).forEach(function(r){names.push(fld(r,'배역명'));});
  _pp.cues.forEach(function(c){names.push(c.in_by,c.out_by);});
  names.push('크루','앙상블');
  _pp.chars=names.filter(function(v,i,a){return v&&a.indexOf(v)===i;});
  propsDraw();
}

/* ── 정렬·조회 ── */
function ppSceneIdx(id){for(var i=0;i<_pp.scenes.length;i++)if(_pp.scenes[i].id===id)return i;return 999;}
function ppScene(id){return _pp.scenes.find(function(s){return s.id===id;});}
function ppProp(id){return _pp.props.find(function(p){return p.id===id;});}
function ppSceneName(id){var s=ppScene(id);return s?s.label:'';}
function ppCuesOfProp(pid){return _pp.cues.filter(function(c){return c.prop_id===pid;}).sort(function(a,b){return ppSceneIdx(a.scene_id)-ppSceneIdx(b.scene_id)||a.order_num-b.order_num;});}
function ppCuesOfScene(sid){return _pp.cues.filter(function(c){return c.scene_id===sid;}).sort(function(a,b){return a.order_num-b.order_num||String((ppProp(a.prop_id)||{}).name||'').localeCompare(String((ppProp(b.prop_id)||{}).name||''));});}

/* ── 동선 점검: {cueId: [경고], propId: [경고]} ── */
function propsCheck(){
  var byCue={},byProp={},add=function(m,k,t){(m[k]=m[k]||[]).push(t);};
  _pp.props.forEach(function(p){
    var cs=ppCuesOfProp(p.id);if(!cs.length)return;
    if(cs[0].in_from===ON_STAGE&&!p.preset)add(byCue,cs[0].id,'처음부터 무대 위에 있어야 해요 — 프리셋 위치를 적어 주세요');
    for(var i=1;i<cs.length;i++){
      var a=cs[i-1],b=cs[i],an=ppSceneName(a.scene_id);
      if(a.out_to===LEFT&&b.in_from&&b.in_from!==ON_STAGE)add(byCue,b.id,an+'에서 무대에 남겼는데 여기선 '+b.in_from+'에서 들어와요 — 사이에 회수가 필요해요');
      if(b.in_from===ON_STAGE&&a.out_to&&a.out_to!==LEFT&&a.out_to!==USED)add(byCue,b.id,'무대 위에 있어야 하는데 '+an+'에서 '+a.out_to+'(으)로 나갔어요');
      if((a.out_to==='상수'||a.out_to==='하수')&&(b.in_from==='상수'||b.in_from==='하수')&&a.out_to!==b.in_from)add(byCue,b.id,a.out_to+'로 나갔다가 '+b.in_from+'에서 들어와요 — 무대 뒤로 옮겨줄 사람이 필요해요');
    }
    // 소모품: 한 회차에 필요한 개수
    var used=cs.filter(function(c){return c.out_to===USED;}).length;
    var need=used+(cs[cs.length-1].out_to===USED?0:1);
    if(used&&need>p.qty)add(byProp,p.id,'한 회차에 '+need+'개가 필요한데 수량이 '+p.qty+'개예요'+(_pp.perf>1?' (공연 '+_pp.perf+'회면 모두 '+need*_pp.perf+'개)':''));
    else if(used&&_pp.perf>1)add(byProp,p.id,'소모품이에요 — 공연 '+_pp.perf+'회면 모두 '+need*_pp.perf+'개 필요');
  });
  return {cue:byCue,prop:byProp};
}

/* ── 그리기 ── */
function propsDraw(){
  var el=$('pp');if(!el)return;
  var chk=propsCheck(),nWarn=Object.keys(chk.cue).reduce(function(s,k){return s+chk.cue[k].length;},0)+Object.keys(chk.prop).length;
  var cnt={need:0,sourcing:0,ready:0};_pp.props.forEach(function(p){cnt[p.status]++;});
  var h='<div class="pp-head"><div class="pp-stats">'
    +'<span>장면 <b>'+_pp.scenes.length+'</b></span><span>소품 <b>'+_pp.props.length+'</b></span>'
    +(_pp.props.length?'<span class="pp-st-bar" title="준비 상태"><i class="ready" style="flex:'+cnt.ready+'"></i><i class="sourcing" style="flex:'+cnt.sourcing+'"></i><i class="need" style="flex:'+cnt.need+'"></i></span><span class="pp-st-t">준비됨 '+cnt.ready+' · 구하는 중 '+cnt.sourcing+' · 필요 '+cnt.need+'</span>':'')
    +(nWarn?'<span class="pp-warn-n"><span class="dash-dot red"></span>동선 확인 '+nWarn+'</span>':'')
    +'</div>'+sheetBarHtml('props_sheet_url','pp')+'</div>';
  if(!_pp.scenes.length&&!_pp.props.length){
    h+='<div class="pp-start"><div class="pp-start-t">소품 큐시트 만들기</div>'
      +'<ol><li><b>장면</b>을 적어요 — 대본 순서대로, 여러 줄을 한 번에 붙여넣어도 돼요.</li>'
      +'<li><b>소품</b>을 적어요 — 이름, 수량, 처음 놓아둘 곳(프리셋), 담당.</li>'
      +'<li>장면마다 <b>큐</b>를 넣어요 — 누가 어디서 들고 들어와, 무엇을 하고, 어디로 나가는지.</li></ol>'
      +'<div class="bg-actions"><button type="button" class="pf-btn pf-active" onclick="openSceneManager()">장면 적기</button><button type="button" class="pf-btn" onclick="openPropForm()">소품 추가</button></div></div>';
    el.innerHTML=h;return;
  }
  var views=[['scene','장면 순'],['prop','소품별'],['person','인물별']];
  h+='<div class="pp-bar"><div class="seg">'+views.map(function(v){return '<button type="button" class="'+(_pp.view===v[0]?'on':'')+'" onclick="openPropsView(\''+v[0]+'\')">'+v[1]+'</button>';}).join('')+'</div>'
    +'<div class="pp-bar-r"><button type="button" class="sheet-btn" onclick="openSceneManager()">장면 관리</button><button type="button" class="sheet-btn" onclick="openPropForm()">+ 소품</button>'
    +(_pp.scenes.length&&_pp.props.length?'<button type="button" class="sheet-btn pf-active" onclick="openCueForm()">+ 큐</button>':'')
    +'<button type="button" class="sheet-btn" onclick="propsPrint()">인쇄</button></div></div>';
  h+='<div id="pp-print">';
  if(_pp.view==='scene')h+=ppSceneView(chk);
  else if(_pp.view==='prop')h+=ppPropView(chk);
  else h+=ppPersonView(chk);
  h+='</div>';
  el.innerHTML=h;
}
function ppCell(by,where,how){
  var main=[by,where].filter(Boolean).map(escHtml).join(' · ');
  return (main?'<b>'+main+'</b>':'<span class="pp-none">—</span>')+(how?'<small>'+escHtml(how)+'</small>':'');
}
function ppWarnHtml(list){return (list||[]).map(function(t){return '<div class="pp-warn"><span class="dash-dot red"></span>'+escHtml(t)+'</div>';}).join('');}
function ppSceneView(chk){
  if(!_pp.scenes.length)return '<div class="bg-empty">장면을 먼저 적어 주세요. <button type="button" class="link-btn" onclick="openSceneManager()">장면 적기</button></div>';
  var pw=Object.keys(chk.prop).map(function(k){return ppWarnHtml(chk.prop[k].map(function(t){return (ppProp(k)||{}).name+' — '+t;}));}).join('');
  return (pw?'<div class="pp-propwarn">'+pw+'</div>':'')+_pp.scenes.map(function(s){
    var cs=ppCuesOfScene(s.id);
    return '<section class="pp-scene"><div class="pp-scene-h"><span class="pp-scene-l">'+escHtml(s.label)+'</span>'+(s.title?'<span class="pp-scene-t">'+escHtml(s.title)+'</span>':'')
      +'<button type="button" class="pp-add" onclick="openCueForm(null,\''+s.id+'\')">+ 큐</button></div>'
      +(cs.length?'<div class="pp-table"><div class="pp-tr pp-th"><span>소품</span><span>들어옴</span><span>무대에서</span><span>나감</span></div>'
        +cs.map(function(c){
          var p=ppProp(c.prop_id)||{};
          return '<div class="pp-tr" onclick="openCueForm(\''+c.id+'\')"><span class="pp-prop">'+escHtml(p.name||'')+(p.qty>1?' <small>×'+p.qty+'</small>':'')+'</span>'
            +'<span>'+ppCell(c.in_by,c.in_from,c.in_how)+'</span><span class="pp-act">'+escHtml(c.action||'')+'</span><span>'+ppCell(c.out_by,c.out_to,c.out_how)+'</span>'
            +(chk.cue[c.id]?'<div class="pp-tr-warn">'+ppWarnHtml(chk.cue[c.id])+'</div>':'')+'</div>';
        }).join('')+'</div>':'<div class="pp-none pp-empty-scene">이 장면엔 소품이 없어요.</div>')
      +'</section>';
  }).join('');
}
function ppPropView(chk){
  if(!_pp.props.length)return '<div class="bg-empty">소품을 먼저 추가해 주세요.</div>';
  return '<div class="pp-props">'+_pp.props.map(function(p){
    var cs=ppCuesOfProp(p.id),st=PROP_STATUS.find(function(x){return x[0]===p.status;})||PROP_STATUS[0];
    var journey='<ol class="pp-journey">'
      +'<li class="pp-j-pre"><span class="pp-j-s">시작</span><span>'+(p.preset?escHtml(p.preset):'<span class="pp-none">프리셋 미정</span>')+'</span></li>'
      +cs.map(function(c){
        return '<li onclick="openCueForm(\''+c.id+'\')"><span class="pp-j-s">'+escHtml(ppSceneName(c.scene_id))+'</span><span>'
          +escHtml([c.in_by,c.in_from].filter(Boolean).join(' · ')||'—')+(c.in_how?' <small>'+escHtml(c.in_how)+'</small>':'')
          +(c.action?' → '+escHtml(c.action):'')
          +' → '+escHtml([c.out_by&&c.out_by!==c.in_by?c.out_by:'',c.out_to].filter(Boolean).join(' · ')||'—')+(c.out_how?' <small>'+escHtml(c.out_how)+'</small>':'')
          +'</span>'+ppWarnHtml(chk.cue[c.id])+'</li>';
      }).join('')+'</ol>';
    return '<div class="pp-card"><div class="pp-card-h" onclick="openPropForm(\''+p.id+'\')"><div><div class="pp-card-n">'+escHtml(p.name)+(p.qty>1?' <small>×'+p.qty+'</small>':'')+'</div>'
      +'<div class="pp-card-m">'+[p.owner?'담당 '+escHtml(p.owner):'',cs.length?cs.length+'개 장면':''].filter(Boolean).join(' · ')+'</div></div>'
      +'<span class="pp-status '+p.status+'">'+st[1]+'</span></div>'
      +(p.note?'<div class="pp-card-note">'+escHtml(p.note)+'</div>':'')
      +ppWarnHtml(chk.prop[p.id])
      +(cs.length?journey:'<div class="pp-none pp-empty-scene">아직 어느 장면에도 없어요. <button type="button" class="link-btn" onclick="openCueForm(null,null,\''+p.id+'\')">큐 넣기</button></div>')+'</div>';
  }).join('')+'</div>';
}
function ppPersonView(chk){
  var people=[];_pp.cues.forEach(function(c){[c.in_by,c.out_by].forEach(function(n){if(n&&people.indexOf(n)<0)people.push(n);});});
  if(!people.length)return '<div class="bg-empty">큐에 사람을 적으면 인물마다 챙길 소품을 모아 보여줘요.</div>';
  if(people.indexOf(_pp.person)<0)_pp.person=people[0];
  var me=_pp.person;
  var mine=_pp.cues.filter(function(c){return c.in_by===me||c.out_by===me;}).sort(function(a,b){return ppSceneIdx(a.scene_id)-ppSceneIdx(b.scene_id)||a.order_num-b.order_num;});
  return '<div class="pp-people">'+people.map(function(n){return '<button type="button" class="rv-chip'+(n===me?' on':'')+'" onclick="_pp.person=this.dataset.n;propsDraw()" data-n="'+escHtml(n)+'">'+escHtml(n)+'</button>';}).join('')+'</div>'
    +'<div class="pp-person-t">'+escHtml(me)+' <span>· 챙길 소품 <b>'+mine.length+'</b>개</span></div>'
    +'<ol class="pp-mine">'+mine.map(function(c){
      var p=ppProp(c.prop_id)||{},lines=[];
      if(c.in_by===me)lines.push('<span class="pp-tag in">들고 옴</span>'+escHtml([c.in_from,c.in_how].filter(Boolean).join(' · ')||'—'));
      if(c.action)lines.push('<span class="pp-tag">무대에서</span>'+escHtml(c.action));
      if(c.out_by===me)lines.push('<span class="pp-tag out">가지고 나감</span>'+escHtml([c.out_to,c.out_how].filter(Boolean).join(' · ')||'—'));
      if(c.in_by!==me&&c.in_by)lines.unshift('<span class="pp-tag">받음</span>'+escHtml(c.in_by)+'에게서');
      return '<li onclick="openCueForm(\''+c.id+'\')"><div class="pp-mine-h"><span class="pp-scene-l">'+escHtml(ppSceneName(c.scene_id))+'</span><b>'+escHtml(p.name||'')+'</b></div>'+lines.map(function(l){return '<div class="pp-mine-l">'+l+'</div>';}).join('')+ppWarnHtml(chk.cue[c.id])+'</li>';
    }).join('')+'</ol>';
}

/* ── 장면 관리 ── */
function openSceneManager(){
  var rows=_pp.scenes.map(function(s,i){
    return '<div class="pp-sm-row" data-id="'+s.id+'"><input class="pp-sm-l" value="'+escHtml(s.label)+'" maxlength="30" onchange="saveScene(\''+s.id+'\',\'label\',this.value)">'
      +'<input class="pp-sm-t" value="'+escHtml(s.title||'')+'" maxlength="60" placeholder="장면 제목 (선택)" onchange="saveScene(\''+s.id+'\',\'title\',this.value)">'
      +'<button type="button" class="bg-del" title="위로" onclick="moveScene(\''+s.id+'\',-1)"'+(i?'':' disabled')+'>↑</button>'
      +'<button type="button" class="bg-del" title="삭제" onclick="deleteScene(\''+s.id+'\')">✕</button></div>';
  }).join('');
  oriSheetModal('pp-sm','<div class="rv-m-h"><div><div class="rv-m-k">소품 큐시트</div><div class="rv-m-t">장면</div></div><button type="button" class="rv-x" onclick="closeSceneManager()">✕</button></div>'
    +(rows?'<div class="pp-sm-list">'+rows+'</div>':'')
    +'<label class="rv-f"><span>장면 추가 <small>한 줄에 하나 · "1막 2장 | 고백" 처럼 | 뒤에 제목</small></span><textarea id="pp-sm-new" rows="4" placeholder="1막 1장 | 등굣길&#10;1막 2장&#10;M5 Upgrade"></textarea></label>'
    +'<div class="rv-m-f"><button type="button" class="pf-btn" onclick="closeSceneManager()">닫기</button><button type="button" class="pf-btn pf-active" onclick="addScenes()">추가</button></div>');
}
function closeSceneManager(){var o=$('pp-sm');if(o)o.classList.remove('open');propsDraw();}
async function addScenes(){
  var lines=($('pp-sm-new').value||'').split(/\r?\n/).map(function(l){return l.trim();}).filter(Boolean);
  if(!lines.length)return;
  var base=_pp.scenes.reduce(function(m,s){return Math.max(m,s.order_num);},0);
  var rows=lines.map(function(l,i){var p=l.split('|');return {project_id:_pp.pid,order_num:base+(i+1)*10,label:p[0].trim().slice(0,30),title:(p[1]||'').trim().slice(0,60)||null};});
  var r=await sbClient.from('project_scenes').insert(rows).select();
  if(r.error){oriAlert('추가하지 못했어요: '+r.error.message);return;}
  _pp.scenes=_pp.scenes.concat(r.data);openSceneManager();
}
async function saveScene(id,f,v){
  v=v.trim();if(f==='label'&&!v){oriAlert('장면 이름은 비울 수 없어요.');return;}
  var patch={};patch[f]=v||null;
  var r=await sbClient.from('project_scenes').update(patch).eq('id',id);
  if(r.error){oriAlert('저장하지 못했어요: '+r.error.message);return;}
  var s=ppScene(id);if(s)s[f]=patch[f];
}
async function moveScene(id,dir){
  var i=ppSceneIdx(id),j=i+dir;if(j<0||j>=_pp.scenes.length)return;
  var a=_pp.scenes[i],b=_pp.scenes[j],ao=a.order_num,bo=b.order_num;
  if(ao===bo)bo=ao+dir;
  var r1=await sbClient.from('project_scenes').update({order_num:bo}).eq('id',a.id);
  var r2=await sbClient.from('project_scenes').update({order_num:ao}).eq('id',b.id);
  if(r1.error||r2.error){oriAlert('순서를 바꾸지 못했어요.');return;}
  a.order_num=bo;b.order_num=ao;_pp.scenes.sort(function(x,y){return x.order_num-y.order_num;});openSceneManager();
}
async function deleteScene(id){
  var n=_pp.cues.filter(function(c){return c.scene_id===id;}).length;
  if(!await oriConfirm('"'+ppSceneName(id)+'" 장면을 지울까요?'+(n?'\n이 장면의 큐 '+n+'개도 함께 지워져요.':'')))return;
  var r=await sbClient.from('project_scenes').delete().eq('id',id);
  if(r.error){oriAlert('지우지 못했어요: '+r.error.message);return;}
  _pp.scenes=_pp.scenes.filter(function(s){return s.id!==id;});_pp.cues=_pp.cues.filter(function(c){return c.scene_id!==id;});openSceneManager();
}

/* ── 소품 ── */
function openPropForm(id){
  var p=id?ppProp(id):{qty:1,status:'need'};
  oriSheetModal('pp-pf','<div class="rv-m-h"><div><div class="rv-m-k">소품</div><div class="rv-m-t">'+(id?escHtml(p.name):'새 소품')+'</div></div><button type="button" class="rv-x" onclick="$(\'pp-pf\').classList.remove(\'open\')">✕</button></div>'
    +'<div class="pp-form">'
    +'<label class="rv-f pp-w2"><span>이름</span><input id="pf-name" maxlength="40" value="'+escHtml(p.name||'')+'" placeholder="예: 알약 병"></label>'
    +'<label class="rv-f"><span>수량</span><input id="pf-qty" type="number" min="1" max="999" value="'+(p.qty||1)+'"></label>'
    +'<label class="rv-f pp-w2"><span>처음 놓아둘 곳 <small>프리셋</small></span><input id="pf-preset" maxlength="40" value="'+escHtml(p.preset||'')+'" placeholder="예: 하수 소품 테이블"></label>'
    +'<label class="rv-f"><span>담당</span><input id="pf-owner" maxlength="30" list="pp-chars" value="'+escHtml(p.owner||'')+'"></label>'
    +'<div class="rv-f pp-w3"><span>준비 상태</span><div class="seg" id="pf-status">'+PROP_STATUS.map(function(s){return '<button type="button" data-v="'+s[0]+'" class="'+(p.status===s[0]?'on':'')+'" onclick="[].forEach.call(this.parentNode.children,function(b){b.classList.remove(\'on\')});this.classList.add(\'on\')">'+s[1]+'</button>';}).join('')+'</div></div>'
    +'<label class="rv-f pp-w3"><span>메모 <small>재질, 구입처, 주의할 점</small></span><textarea id="pf-note" rows="2" maxlength="300">'+escHtml(p.note||'')+'</textarea></label>'
    +'</div>'+ppCharsList()
    +'<div class="rv-m-f">'+(id?'<button type="button" class="pf-btn pp-danger" style="margin-right:auto" onclick="deleteProp(\''+id+'\')">삭제</button>':'')
    +'<button type="button" class="pf-btn" onclick="$(\'pp-pf\').classList.remove(\'open\')">취소</button><button type="button" class="pf-btn pf-active" onclick="saveProp('+(id?'\''+id+'\'':'null')+')">저장</button></div>');
  setTimeout(function(){var n=$('pf-name');if(n&&!id)n.focus();},30);
}
function ppCharsList(){return '<datalist id="pp-chars">'+_pp.chars.map(function(c){return '<option value="'+escHtml(c)+'">';}).join('')+'</datalist>';}
async function saveProp(id){
  var name=$('pf-name').value.trim();if(!name){oriAlert('소품 이름을 적어 주세요.');return;}
  var st=document.querySelector('#pf-status .on');
  var row={name:name,qty:Math.max(1,Math.min(999,parseInt($('pf-qty').value,10)||1)),preset:$('pf-preset').value.trim()||null,owner:$('pf-owner').value.trim()||null,status:st?st.dataset.v:'need',note:$('pf-note').value.trim()||null};
  var r;
  if(id)r=await sbClient.from('project_props').update(row).eq('id',id).select().single();
  else{row.project_id=_pp.pid;row.order_num=_pp.props.length*10+10;r=await sbClient.from('project_props').insert(row).select().single();}
  if(r.error){oriAlert('저장하지 못했어요: '+r.error.message);return;}
  if(id)_pp.props=_pp.props.map(function(p){return p.id===id?r.data:p;});else _pp.props.push(r.data);
  $('pp-pf').classList.remove('open');propsDraw();
}
async function deleteProp(id){
  var n=ppCuesOfProp(id).length;
  if(!await oriConfirm('이 소품을 지울까요?'+(n?'\n이 소품의 큐 '+n+'개도 함께 지워져요.':'')))return;
  var r=await sbClient.from('project_props').delete().eq('id',id);
  if(r.error){oriAlert('지우지 못했어요: '+r.error.message);return;}
  _pp.props=_pp.props.filter(function(p){return p.id!==id;});_pp.cues=_pp.cues.filter(function(c){return c.prop_id!==id;});
  $('pp-pf').classList.remove('open');propsDraw();
}

/* ── 큐 ── */
function openCueForm(id,sceneId,propId){
  var c=id?_pp.cues.find(function(x){return x.id===id;}):{scene_id:sceneId||(_pp.scenes[0]||{}).id,prop_id:propId||''};
  if(!_pp.scenes.length){openSceneManager();return;}
  if(!_pp.props.length){openPropForm();return;}
  var dl=function(id,list){return '<datalist id="'+id+'">'+list.map(function(v){return '<option value="'+escHtml(v)+'">';}).join('')+'</datalist>';};
  var inp=function(key,ph,list,max){return '<input id="cf-'+key+'" maxlength="'+max+'" value="'+escHtml(c[key]||'')+'" placeholder="'+ph+'"'+(list?' list="'+list+'"':'')+'>';};
  oriSheetModal('pp-cf','<div class="rv-m-h"><div><div class="rv-m-k">소품 큐</div><div class="rv-m-t">'+(id?escHtml((ppProp(c.prop_id)||{}).name||''):'새 큐')+'</div></div><button type="button" class="rv-x" onclick="$(\'pp-cf\').classList.remove(\'open\')">✕</button></div>'
    +'<div class="pp-form">'
    +'<label class="rv-f pp-w2"><span>장면</span><select id="cf-scene">'+_pp.scenes.map(function(s){return '<option value="'+s.id+'"'+(s.id===c.scene_id?' selected':'')+'>'+escHtml(s.label+(s.title?' · '+s.title:''))+'</option>';}).join('')+'</select></label>'
    +'<label class="rv-f"><span>소품</span><select id="cf-prop">'+(c.prop_id?'':'<option value="">고르기</option>')+_pp.props.map(function(p){return '<option value="'+p.id+'"'+(p.id===c.prop_id?' selected':'')+'>'+escHtml(p.name)+'</option>';}).join('')+'</select></label>'
    +'<div class="pp-fgroup pp-w3"><div class="pp-fgroup-h">들어옴</div><div class="pp-f3">'+inp('in_by','누가','pp-chars',30)+inp('in_from','어디서','cf-l-in',30)+inp('in_how','어떻게','cf-l-inhow',60)+'</div></div>'
    +'<label class="rv-f pp-w3"><span>무대에서 <small>이 소품으로 무슨 일이 일어나나요</small></span><textarea id="cf-action" rows="2" maxlength="200" placeholder="예: 알약을 꺼내 삼킨다, 병은 주머니에">'+escHtml(c.action||'')+'</textarea></label>'
    +'<div class="pp-fgroup pp-w3"><div class="pp-fgroup-h">나감</div><div class="pp-f3">'+inp('out_by','누가 (비우면 들어온 사람)','pp-chars',30)+inp('out_to','어디로','cf-l-out',30)+inp('out_how','어떻게','cf-l-outhow',60)+'</div></div>'
    +'</div>'+ppCharsList()+dl('cf-l-in',CUE_IN_FROM)+dl('cf-l-inhow',CUE_IN_HOW)+dl('cf-l-out',CUE_OUT_TO)+dl('cf-l-outhow',CUE_OUT_HOW)
    +'<div class="rv-m-f">'+(id?'<button type="button" class="pf-btn pp-danger" style="margin-right:auto" onclick="deleteCue(\''+id+'\')">삭제</button>':'')
    +'<button type="button" class="pf-btn" onclick="$(\'pp-cf\').classList.remove(\'open\')">취소</button><button type="button" class="pf-btn pf-active" onclick="saveCue('+(id?'\''+id+'\'':'null')+')">저장</button></div>');
}
async function saveCue(id){
  var v=function(k){var e=$('cf-'+k);return e&&e.value.trim()||null;};
  var row={scene_id:$('cf-scene').value,prop_id:$('cf-prop').value,in_by:v('in_by'),in_from:v('in_from'),in_how:v('in_how'),action:v('action'),out_by:v('out_by')||v('in_by'),out_to:v('out_to'),out_how:v('out_how')};
  if(!row.prop_id){oriAlert('소품을 골라 주세요.');return;}
  var r;
  if(id)r=await sbClient.from('project_prop_cues').update(row).eq('id',id).select().single();
  else{row.project_id=_pp.pid;row.order_num=ppCuesOfScene(row.scene_id).length*10+10;r=await sbClient.from('project_prop_cues').insert(row).select().single();}
  if(r.error){oriAlert('저장하지 못했어요: '+r.error.message);return;}
  if(id)_pp.cues=_pp.cues.map(function(c){return c.id===id?r.data:c;});else _pp.cues.push(r.data);
  [row.in_by,row.out_by].forEach(function(n){if(n&&_pp.chars.indexOf(n)<0)_pp.chars.unshift(n);});
  $('pp-cf').classList.remove('open');propsDraw();
}
async function deleteCue(id){
  if(!await oriConfirm('이 큐를 지울까요?'))return;
  var r=await sbClient.from('project_prop_cues').delete().eq('id',id);
  if(r.error){oriAlert('지우지 못했어요: '+r.error.message);return;}
  _pp.cues=_pp.cues.filter(function(c){return c.id!==id;});$('pp-cf').classList.remove('open');propsDraw();
}

/* ── 내보내기·인쇄 ── */
function propsExportMenu(){
  oriSheetModal('pp-ex','<div class="rv-m-h"><div><div class="rv-m-k">소품 큐시트</div><div class="rv-m-t">CSV 내보내기</div></div><button type="button" class="rv-x" onclick="$(\'pp-ex\').classList.remove(\'open\')">✕</button></div>'
    +'<p class="bg-hint">구글 시트·엑셀에서 바로 열 수 있어요.</p>'
    +'<div class="bg-actions" style="justify-content:flex-start"><button type="button" class="pf-btn pf-active" onclick="propsExportCues()">큐시트 (장면 순)</button><button type="button" class="pf-btn" onclick="propsExportList()">소품 목록</button></div>');
}
function ppFile(n){return ((window._projectCtx.pr.title||'프로젝트')+' '+n+'.csv').replace(/[\\/:*?"<>|]/g,'');}
function propsExportCues(){
  var rows=[['장면','장면 제목','소품','수량','들어옴-누가','들어옴-어디서','들어옴-어떻게','무대에서','나감-누가','나감-어디로','나감-어떻게']];
  _pp.scenes.forEach(function(s){ppCuesOfScene(s.id).forEach(function(c){var p=ppProp(c.prop_id)||{};rows.push([s.label,s.title,p.name,p.qty,c.in_by,c.in_from,c.in_how,c.action,c.out_by,c.out_to,c.out_how]);});});
  downloadCsv(ppFile('소품 큐시트'),rows);
}
function propsExportList(){
  var st={};PROP_STATUS.forEach(function(s){st[s[0]]=s[1];});
  var rows=[['소품','수량','프리셋','담당','상태','등장 장면','메모']];
  _pp.props.forEach(function(p){rows.push([p.name,p.qty,p.preset,p.owner,st[p.status],ppCuesOfProp(p.id).map(function(c){return ppSceneName(c.scene_id);}).join(', '),p.note]);});
  downloadCsv(ppFile('소품 목록'),rows);
}
function propsPrint(){
  document.body.classList.add('printing-pp');
  var done=function(){document.body.classList.remove('printing-pp');window.removeEventListener('afterprint',done);};
  window.addEventListener('afterprint',done);
  window.print();
  setTimeout(done,1500);
}
