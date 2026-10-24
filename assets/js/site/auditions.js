/* 오리 사이트 — 오디션 일정·평가 (10/24): "오디션·캐스팅" 상자 안의 [배역 자리 | 오디션]
   지원자: 기회 지원에서 불러오기(audition_import_requests) 또는 직접 추가(현장 지원 등)
   시간표: 날짜·시간대·한 사람당 몇 분·장소 → 칸이 만들어지고, 지원자를 칸에 배정(자동 배정 가능). 지원자는 "내 지원 현황"에서 자기 시간·장소를 본다(my_auditions)
   평가: 평가자마다 연기·노래·움직임·배역 어울림 1~5 + 추천(합격·콜백·보류·불합격) + 메모. 점수는 프로젝트 관리자만 본다
   결정: 합격 → 기회 지원이면 바로 팀으로(approve_join_request), 불합격 → 지원 결과로(reject_join_request)
   표: audition_slots · audition_candidates · audition_scores (supabase/migrations/20261024_auditions.sql) */
var AUD_CRIT=[['acting','연기'],['singing','노래'],['movement','움직임'],['fit','배역 어울림']];
var AUD_REC={pass:'합격',callback:'콜백',hold:'보류',fail:'불합격'};
var AUD_STATUS={applied:'지원',callback:'콜백',passed:'합격',held:'보류',failed:'불합격'};
var _aud={slots:[],cands:[],scores:[],pending:0,f:'',open:{}};

/* 상자 화면: 배역 자리 | 오디션 */
function renderActorBox(el){
  var sub=window._actorSub||'roles';
  el.innerHTML='<div class="pjb-tabs aud-switch" role="tablist">'
    +[['roles','배역 자리'],['aud','오디션']].map(function(t){return '<button type="button" role="tab" class="'+(sub===t[0]?'active':'')+'" onclick="window._actorSub=\''+t[0]+'\';renderActorBox($(\'project-tab-content\'))">'+t[1]+'</button>';}).join('')
    +'</div><div id="actor-sub"></div>';
  var body=$('actor-sub'),pid=window._projectCtx.pid;
  if(sub==='aud')renderAuditions(body);
  else{body.innerHTML='<div id="actor-tab-body"><div class="hf-loading">불러오는 중…</div></div>';loadProjectPositionsData(pid,renderActorTabBody);}
}

async function audLoad(){
  var ctx=window._projectCtx,pid=ctx.pid;
  var q=function(p){return p.then(function(r){return r.error?[]:(r.data||[]);},function(){return[];});};
  var res=await Promise.all([
    q(sbClient.from('audition_slots').select('*').eq('project_id',pid).order('starts_at')),
    ctx.isAdmin?q(sbClient.from('audition_candidates').select('*').eq('project_id',pid).order('created_at')):Promise.resolve([]),
    ctx.isAdmin?q(sbClient.rpc('list_project_join_requests',{p_project_id:pid})):Promise.resolve([]),
    ctx.memberDetail?Promise.resolve(ctx.memberDetail):q(sbClient.rpc('list_project_members_detail',{p_project_id:pid})),
    q(sbClient.from('project_positions').select('*').eq('project_id',pid))
  ]);
  _aud.slots=res[0];_aud.cands=res[1];ctx.memberDetail=res[3];ctx.positions=res[4];
  var imported={};_aud.cands.forEach(function(c){if(c.join_request_id)imported[c.join_request_id]=1;});
  _aud.pending=res[2].filter(function(r){return !imported[r.request_id];}).length;
  var ids=_aud.cands.map(function(c){return c.id;});
  _aud.scores=ids.length?await q(sbClient.from('audition_scores').select('*').in('candidate_id',ids)):[];
}
async function renderAuditions(el){
  el.innerHTML='<div id="aud"><div class="hf-loading">불러오는 중…</div></div>';
  await audLoad();
  audDraw();
}
function audTime(d){var t=new Date(d);return evDate(t)+' '+evTime(t);}
function audPosLabel(pid){var p=(window._projectCtx.positions||[]).find(function(x){return x.id===pid;});return p?(p.position_label||'자리'):'';}
function audWho(uid){  // 구성원(user_id) → 상세(member_id)의 이름
  var ctx=window._projectCtx,mem=(ctx.members||[]).find(function(x){return x.user_id===uid;});
  var m=mem&&(ctx.memberDetail||[]).find(function(x){return x.member_id===mem.id;});
  return m?((m.person_id&&nm(m.person_id))||m.nickname||'평가자'):'평가자';
}
function audDraw(){
  var el=$('aud');if(!el)return;
  var ctx=window._projectCtx,admin=ctx.isAdmin;
  var slotOf=function(id){return _aud.slots.find(function(s){return s.id===id;});};
  var candIn=function(sid){return _aud.cands.find(function(c){return c.slot_id===sid;});};
  // 시간표
  var byDay={};_aud.slots.forEach(function(s){var k=evDate(new Date(s.starts_at));(byDay[k]=byDay[k]||[]).push(s);});
  var free=_aud.cands.filter(function(c){return !c.slot_id&&c.status!=='failed'&&c.status!=='passed';});
  var h='';
  if(admin)h+='<div class="aud-bar">'
    +'<button type="button" class="pf-btn pf-active" onclick="audImport()"'+(_aud.pending?'':' disabled')+'>기회 지원자 불러오기'+(_aud.pending?' '+_aud.pending:'')+'</button>'
    +'<button type="button" class="pf-btn" onclick="audAddForm()">+ 직접 추가</button><div id="aud-add"></div></div>';
  h+='<section class="dv-sec">'+dvSection('시간표',_aud.slots.length||null)
    +(admin?'<details class="aud-gen"'+(_aud.slots.length?'':' open')+'><summary class="ev-add">+ 시간표 만들기</summary><div class="aud-gen-f">'
      +'<label>날짜<input type="date" id="aud-d" value="'+new Date(Date.now()+7*864e5).toISOString().slice(0,10)+'"></label>'
      +'<label>시작<input type="time" id="aud-s" value="14:00"></label><label>끝<input type="time" id="aud-e" value="17:00"></label>'
      +'<label>한 사람<select id="aud-m"><option value="5">5분</option><option value="10" selected>10분</option><option value="15">15분</option><option value="20">20분</option><option value="30">30분</option></select></label>'
      +'<label class="aud-wide">장소<input type="text" id="aud-l" maxlength="200" placeholder="연습실·주소"></label>'
      +'<button type="button" class="pf-btn pf-active" onclick="audGenerate()">칸 만들기</button></div></details>':'')
    +(Object.keys(byDay).length?Object.keys(byDay).map(function(day){
      return '<div class="aud-day"><h3>'+escHtml(day)+(byDay[day][0].location?'<span>'+escHtml(byDay[day][0].location)+'</span>':'')+'</h3><div class="aud-slots">'+byDay[day].map(function(s){
        var c=candIn(s.id);
        return '<div class="aud-slot'+(c?' taken':'')+'"><span class="aud-slot-t">'+evTime(new Date(s.starts_at))+'</span>'
          +(admin?'<select onchange="audAssign(this.value,\''+s.id+'\')"><option value="">비어 있음</option>'
            +(c?'<option value="'+c.id+'" selected>'+escHtml(c.name)+'</option>':'')
            +free.map(function(x){return '<option value="'+x.id+'">'+escHtml(x.name)+(x.position_id?' · '+escHtml(audPosLabel(x.position_id)):'')+'</option>';}).join('')+'</select>'
            +'<button type="button" class="task-x" title="칸 지우기" onclick="audSlotDel(\''+s.id+'\')">✕</button>'
          :'<span class="aud-slot-n">'+(c?'배정됨':'')+'</span>')+'</div>';
      }).join('')+'</div></div>';
    }).join(''):'<div class="dv-empty">아직 시간표가 없어요</div>')
    +(admin&&free.length&&_aud.slots.some(function(s){return !candIn(s.id);})?'<button type="button" class="pf-btn aud-auto" onclick="audAutoAssign()">빈 칸에 자동 배정 ('+free.length+'명)</button>':'')
    +'</section>';
  if(admin){
    var cnt=function(f){return _aud.cands.filter(function(c){return audMatch(c,f);}).length;};
    var list=_aud.cands.filter(function(c){return audMatch(c,_aud.f);}).sort(function(a,b){
      var sa=slotOf(a.slot_id),sb=slotOf(b.slot_id);return String(sa?sa.starts_at:'9').localeCompare(String(sb?sb.starts_at:'9'));});
    h+='<section class="dv-sec">'+dvSection('지원자·평가',_aud.cands.length||null)
      +(_aud.cands.length?'<div class="pchips aud-chips">'+[['','전체'],['none','미배정'],['callback','콜백'],['passed','합격'],['held','보류'],['failed','불합격']].map(function(f){return '<button type="button" class="'+(_aud.f===f[0]?'active':'')+'" onclick="_aud.f=\''+f[0]+'\';audDraw()">'+f[1]+'<span class="pchips-n">'+cnt(f[0])+'</span></button>';}).join('')+'</div>':'')
      +(list.length?list.map(audCandHtml).join(''):'<div class="dv-empty">'+(_aud.cands.length?'해당하는 지원자가 없어요':'아직 지원자가 없어요')+'</div>')+'</section>';
  }
  el.innerHTML=h;
}
function audMatch(c,f){return !f||(f==='none'?!c.slot_id:c.status===f);}
function audCandHtml(c){
  var me=CURRENT_USER&&CURRENT_USER.id,sc=_aud.scores.filter(function(s){return s.candidate_id===c.id;}),mine=sc.find(function(s){return s.user_id===me;})||{};
  var vals=[];sc.forEach(function(s){AUD_CRIT.forEach(function(k){if(s[k[0]])vals.push(s[k[0]]);});});
  var avg=vals.length?(vals.reduce(function(a,b){return a+b;},0)/vals.length).toFixed(1):null;
  var recs={};sc.forEach(function(s){if(s.recommend)recs[s.recommend]=(recs[s.recommend]||0)+1;});
  var slot=_aud.slots.find(function(s){return s.id===c.slot_id;});
  var open=_aud.open[c.id],cid='\''+c.id+'\'';
  return '<article class="aud-c st-'+c.status+'">'
    +'<div class="aud-c-top" onclick="_aud.open['+cid+']=!_aud.open['+cid+'];audDraw()">'
    +'<div class="aud-c-main"><b>'+escHtml(c.name)+'</b><span>'+escHtml([c.position_id?audPosLabel(c.position_id):'',slot?audTime(slot.starts_at):'시간 미정',c.join_request_id?'기회 지원':'직접 추가'].filter(Boolean).join(' · '))+'</span></div>'
    +'<div class="aud-c-sum">'+(avg?'<span class="aud-avg">★ '+avg+'</span><span class="aud-n">'+sc.length+'명 평가</span>':'<span class="aud-n">평가 전</span>')
    +Object.keys(recs).map(function(k){return '<span class="aud-rec r-'+k+'">'+AUD_REC[k]+' '+recs[k]+'</span>';}).join('')+'</div>'
    +'<span class="aud-st st-'+c.status+'">'+AUD_STATUS[c.status]+'</span></div>'
    +(open?'<div class="aud-c-body">'
      +(c.note?'<div class="aud-note">“'+escHtml(c.note)+'”</div>':'')
      +(c.contact?'<div class="aud-note">연락처 '+escHtml(c.contact)+'</div>':'')
      +'<div class="aud-eval"><div class="aud-eval-h">내 평가</div>'
      +AUD_CRIT.map(function(k){return '<div class="aud-crit"><span>'+k[1]+'</span><span class="aud-stars">'+[1,2,3,4,5].map(function(n){return '<button type="button" class="'+(mine[k[0]]>=n?'on':'')+'" aria-label="'+k[1]+' '+n+'점" onclick="audScore('+cid+',\''+k[0]+'\','+(mine[k[0]]===n?'null':n)+')">★</button>';}).join('')+'</span></div>';}).join('')
      +'<div class="aud-crit"><span>추천</span><span class="aud-recs">'+Object.keys(AUD_REC).map(function(k){return '<button type="button" class="r-'+k+(mine.recommend===k?' on':'')+'" onclick="audScore('+cid+',\'recommend\','+(mine.recommend===k?'null':'\''+k+'\'')+')">'+AUD_REC[k]+'</button>';}).join('')+'</span></div>'
      +'<input type="text" class="aud-memo" maxlength="1000" placeholder="메모 (관리자만 봐요)" value="'+escHtml(mine.memo||'')+'" onchange="audScore('+cid+',\'memo\',this.value)"></div>'
      +(sc.filter(function(s){return s.user_id!==me;}).length?'<div class="aud-others">'+sc.filter(function(s){return s.user_id!==me;}).map(function(s){
        return '<div class="aud-other"><b>'+escHtml(audWho(s.user_id))+'</b>'+AUD_CRIT.filter(function(k){return s[k[0]];}).map(function(k){return '<span>'+k[1]+' '+s[k[0]]+'</span>';}).join('')
          +(s.recommend?'<span class="aud-rec r-'+s.recommend+'">'+AUD_REC[s.recommend]+'</span>':'')+(s.memo?'<div class="aud-other-m">'+escHtml(s.memo)+'</div>':'')+'</div>';
      }).join('')+'</div>':'')
      +'<div class="aud-decide"><span>결정</span>'+[['callback','콜백'],['passed','합격'],['held','보류'],['failed','불합격']].map(function(d){return '<button type="button" class="d-'+d[0]+(c.status===d[0]?' on':'')+'" onclick="audDecide('+cid+',\''+d[0]+'\')">'+d[1]+'</button>';}).join('')
      +'<button type="button" class="talk-link" onclick="audCandDel('+cid+')">지원자 지우기</button></div>'
      +'</div>':'')+'</article>';
}

async function audImport(){
  var r=await sbClient.rpc('audition_import_requests',{p_project_id:window._projectCtx.pid});
  if(r.error){oriAlert('불러오지 못했어요: '+r.error.message);return;}
  oriAlert(r.data?'지원자 '+r.data+'명을 불러왔어요':'새로 불러올 지원자가 없어요');
  renderAuditions($('actor-sub'));
}
function audAddForm(){
  var f=$('aud-add');if(!f)return;
  var acts=(window._projectCtx.positions||[]).filter(function(p){return p.position_type==='actor';});
  f.innerHTML='<div class="ops-link-f"><input type="text" id="aud-n" maxlength="80" placeholder="이름"><select id="aud-p"><option value="">희망 배역</option>'+acts.map(function(p){return '<option value="'+p.id+'">'+escHtml(p.position_label||'배역')+'</option>';}).join('')+'</select>'
    +'<input type="text" id="aud-c" maxlength="200" placeholder="연락처 (선택)"><button type="button" class="pf-btn pf-active" onclick="audAdd()">추가</button></div>';
  $('aud-n').focus();
}
async function audAdd(){
  var name=($('aud-n').value||'').trim();if(!name){$('aud-n').focus();return;}
  try{await sbOk(sbClient.from('audition_candidates').insert({project_id:window._projectCtx.pid,name:name,position_id:$('aud-p').value||null,contact:($('aud-c').value||'').trim()||null}));}
  catch(e){oriAlert('추가하지 못했어요: '+e.message);return;}
  renderAuditions($('actor-sub'));
}
/* 시간표 만들기: 시작~끝을 한 사람 몇 분씩 칸으로. 일정에도 "오디션" 한 줄을 넣어 캘린더·출결과 이어진다 */
async function audGenerate(){
  var ctx=window._projectCtx,d=$('aud-d').value,s=$('aud-s').value,e=$('aud-e').value,m=parseInt($('aud-m').value,10)||10,loc=($('aud-l').value||'').trim()||null;
  if(!d||!s||!e){oriAlert('날짜와 시간을 정해 주세요');return;}
  var st=new Date(d+'T'+s),en=new Date(d+'T'+e);if(en<=st){oriAlert('끝 시간이 시작보다 늦어야 해요');return;}
  var rows=[];for(var t=new Date(st);t.getTime()+m*60e3<=en.getTime();t=new Date(t.getTime()+m*60e3))rows.push({project_id:ctx.pid,starts_at:t.toISOString(),minutes:m,location:loc});
  if(!rows.length){oriAlert('시간이 너무 짧아요');return;}
  if(rows.length>120){oriAlert('칸이 너무 많아요 (최대 120)');return;}
  try{
    await sbOk(sbClient.from('audition_slots').insert(rows));
    await sbClient.from('project_events').insert({project_id:ctx.pid,kind:'etc',title:'오디션',starts_at:st.toISOString(),ends_at:en.toISOString(),location:loc,note:rows.length+'칸 · 한 사람 '+m+'분'});
  }catch(err){oriAlert('만들지 못했어요: '+err.message);return;}
  renderAuditions($('actor-sub'));
}
async function audAssign(candId,slotId){
  var cur=_aud.cands.find(function(c){return c.slot_id===slotId;});
  try{
    if(cur&&cur.id!==candId)await sbOk(sbClient.from('audition_candidates').update({slot_id:null}).eq('id',cur.id));
    if(candId)await sbOk(sbClient.from('audition_candidates').update({slot_id:slotId}).eq('id',candId));
  }catch(e){oriAlert('배정하지 못했어요: '+e.message);return;}
  if(cur)cur.slot_id=null;var c=_aud.cands.find(function(x){return x.id===candId;});if(c)c.slot_id=slotId;
  audDraw();
}
async function audAutoAssign(){
  var free=_aud.cands.filter(function(c){return !c.slot_id&&c.status!=='failed'&&c.status!=='passed';});
  var empty=_aud.slots.filter(function(s){return !_aud.cands.some(function(c){return c.slot_id===s.id;})&&new Date(s.starts_at)>new Date();});
  var n=Math.min(free.length,empty.length);if(!n){oriAlert('배정할 빈 칸이 없어요');return;}
  try{for(var i=0;i<n;i++){await sbOk(sbClient.from('audition_candidates').update({slot_id:empty[i].id}).eq('id',free[i].id));free[i].slot_id=empty[i].id;}}
  catch(e){oriAlert('배정하지 못했어요: '+e.message);}
  audDraw();
}
async function audSlotDel(id){
  try{await sbOk(sbClient.from('audition_slots').delete().eq('id',id));}catch(e){oriAlert('지우지 못했어요: '+e.message);return;}
  _aud.slots=_aud.slots.filter(function(s){return s.id!==id;});_aud.cands.forEach(function(c){if(c.slot_id===id)c.slot_id=null;});audDraw();
}
async function audScore(candId,field,val){
  var me=CURRENT_USER.id,cur=_aud.scores.find(function(s){return s.candidate_id===candId&&s.user_id===me;});
  var row=Object.assign({candidate_id:candId,user_id:me},cur||{});row[field]=val===''?null:val;row.updated_at=new Date().toISOString();
  var r=await sbClient.from('audition_scores').upsert(row);
  if(r.error){oriAlert('저장하지 못했어요: '+r.error.message);return;}
  if(cur)Object.assign(cur,row);else _aud.scores.push(row);
  if(field!=='memo')audDraw();
}
async function audDecide(candId,status){
  var c=_aud.cands.find(function(x){return x.id===candId;});if(!c)return;
  if(status==='passed'&&c.join_request_id&&!await oriConfirm(c.name+'님을 합격으로 정할까요? 기회 지원을 승인해서 바로 팀에 들어와요.',{ok:'합격'}))return;
  if(status==='failed'&&c.join_request_id&&!await oriConfirm(c.name+'님을 불합격으로 정할까요? 지원 결과로 "이번엔 함께 못 해요"가 전해져요.',{ok:'불합격'}))return;
  try{
    await sbOk(sbClient.from('audition_candidates').update({status:status}).eq('id',candId));
    if(c.join_request_id&&status==='passed')await sbOk(sbClient.rpc('approve_join_request',{request_id:c.join_request_id}));
    if(c.join_request_id&&status==='failed')await sbOk(sbClient.rpc('reject_join_request',{request_id:c.join_request_id}));
  }catch(e){oriAlert('정하지 못했어요: '+e.message);return;}
  c.status=status;audDraw();
  if(status==='passed')oriAlert(c.name+'님 합격'+(c.join_request_id?' · 팀에 들어왔어요':''));
}
async function audCandDel(candId){
  if(!await oriConfirm('이 지원자와 평가를 지울까요?',{ok:'지우기',cancel:'그대로 두기'}))return;
  try{await sbOk(sbClient.from('audition_candidates').delete().eq('id',candId));}catch(e){oriAlert('지우지 못했어요: '+e.message);return;}
  _aud.cands=_aud.cands.filter(function(c){return c.id!==candId;});audDraw();
}
