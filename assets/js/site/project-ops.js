/* 오리 사이트 — 프로젝트 운영 도구 (10/24, 검토 결과 1~4번)
   할 일(누가·언제까지) · 연습 출결 · 바깥 도구 연결(구글 시트·드라이브·큐랩·노션·단톡방·예매처) · 일정 .ics 내보내기
   · 공연 주간 체크리스트 · 회고 · 기록 보강(관객 수·회차·티켓·출연료 → 아카이브) · 정산 화면.
   방향: 모든 툴을 만들지 않는다. 지금 쓰는 도구를 상자에 꽂아 두고 오리로 들어오게 하는 것만으로 성공.
   표: project_tasks · project_event_rsvps · project_links · project_retro_items (supabase/migrations/20261024_project_ops.sql) */

/* ══ 바깥 도구 연결 ══ */
var OPS_LINK_KINDS=[
  [/qlab|\.qlab/i,'qlab','큐랩'],
  [/docs\.google\.com\/spreadsheets/,'sheet','구글 시트'],[/docs\.google\.com\/document/,'doc','구글 문서'],[/docs\.google\.com\/presentation/,'slide','구글 슬라이드'],
  [/drive\.google\.com|docs\.google\.com\/file/,'drive','구글 드라이브'],[/calendar\.google\.com/,'cal','구글 캘린더'],[/notion\.(so|site)/,'notion','노션'],
  [/open\.kakao\.com|pf\.kakao\.com/,'kakao','단톡방'],[/figma\.com/,'figma','피그마'],[/dropbox\.com/,'dropbox','드롭박스'],
  [/ticketlink|interpark|nol\.yanolja|yes24|melon\.com\/ticket|booking\.naver|ticket/,'ticket','예매처'],
  [/instagram\.com/,'insta','인스타그램'],[/youtube\.com|youtu\.be/,'youtube','유튜브']
];
/* 상자마다 꽂으면 좋은 것 (빈칸일 때 버튼으로 권한다) */
var OPS_LINK_HINTS={
  tasks:['할 일 시트'],files:['대본','악보·MR','무대 도면 폴더'],team:['단톡방','연락망 시트'],budget:['예산 시트'],settle:['정산 시트','영수증 폴더'],
  venue:['대관 계약서','연습실 예약'],actor:['오디션 신청 폼','캐스팅 시트'],crew:['제작진 연락망'],schedule:['구글 캘린더','연습 일정 시트'],
  cues:['큐랩 파일','조명 큐 시트','음향 큐 시트'],showweek:['콜시트','반입 계획'],promo:['예매처','인스타그램','포스터 원본'],record:['공연 사진','공연 영상'],
  work:['대본','라이선스 계약서'],notices:['단톡방'],retro:['회고 문서']
};
var _ops={links:{},pid:null};
function opsLinkKind(url){for(var i=0;i<OPS_LINK_KINDS.length;i++)if(OPS_LINK_KINDS[i][0].test(url))return OPS_LINK_KINDS[i];return [null,'link','링크'];}
async function opsLoadLinks(pid,force){
  if(!force&&_ops.pid===pid&&_ops.loaded)return _ops.links;
  var r=await sbClient.from('project_links').select('*').eq('project_id',pid).order('created_at',{ascending:true});
  _ops.pid=pid;_ops.loaded=true;_ops.links={};
  (r.data||[]).forEach(function(l){(_ops.links[l.box_key]=_ops.links[l.box_key]||[]).push(l);});
  return _ops.links;
}
/* 상자 화면 머리 오른쪽 "연결": 꽂아 둔 도구 + [+ 연결] (누르면 아래에 칸, 이 상자에 맞는 이름 추천) */
function opsLinksBarHtml(box){return '<div class="ops-links" id="ops-links"></div>';}
async function renderOpsLinks(box){
  var el=$('ops-links');if(!el)return;
  var ctx=window._projectCtx,links=(await opsLoadLinks(ctx.pid))[box]||[];
  el=$('ops-links');if(!el)return;
  el.innerHTML=(box==='files'?[]:links).map(function(l){  // 자료함은 본문 칸이 곧 연결 목록
    var k=opsLinkKind(l.url);
    return '<span class="ops-link k-'+k[1]+'"><a href="'+escHtml(l.url)+'" target="_blank" rel="noopener noreferrer" title="'+escHtml(k[2])+'">'+ico('link')+'<b>'+escHtml(l.label||k[2])+'</b></a>'
      +'<button type="button" class="ops-link-x" title="연결 끊기" onclick="opsLinkDelete(\''+l.id+'\',\''+box+'\')">✕</button></span>';
  }).join('')
  +'<button type="button" class="ops-link-add" onclick="opsLinkForm(\''+box+'\',\'\')">+ 연결</button>';
}
function opsLinkForm(box,label){
  var f=$('ops-link-form');if(!f)return;
  if(f.innerHTML&&!label){f.innerHTML='';return;}
  var have=((_ops.links||{})[box]||[]).map(function(l){return l.label||'';});
  var hints=(OPS_LINK_HINTS[box]||[]).filter(function(h){return have.indexOf(h)<0;});
  f.innerHTML='<div class="ops-link-f">'
    +(hints.length?'<div class="pchips ops-hints">'+hints.map(function(h){return '<button type="button" class="'+(h===label?'active':'')+'" onclick="opsLinkForm(\''+box+'\',\''+h+'\')">'+escHtml(h)+'</button>';}).join('')+'</div>':'')
    +'<input type="text" id="ops-l-label" maxlength="80" placeholder="이름" value="'+escHtml(label)+'">'
    +'<input type="url" id="ops-l-url" placeholder="https:// 공유 링크 (시트·드라이브·노션·큐랩…)">'
    +'<button type="button" class="pf-btn pf-active" onclick="opsLinkSave(\''+box+'\')">연결</button><button type="button" class="pf-btn" onclick="$(\'ops-link-form\').innerHTML=\'\'">닫기</button></div>';
  ($(label?'ops-l-url':'ops-l-label')||{}).focus&&$(label?'ops-l-url':'ops-l-label').focus();
}
async function opsLinkSave(box){
  var url=($('ops-l-url').value||'').trim(),label=($('ops-l-label').value||'').trim();
  if(!url){$('ops-l-url').focus();return;}
  if(!/^https?:\/\//i.test(url))url='https://'+url;
  var k=opsLinkKind(url);
  try{await sbOk(sbClient.from('project_links').insert({project_id:window._projectCtx.pid,box_key:box,kind:k[1],label:label||k[2],url:url}));}
  catch(e){oriAlert('연결하지 못했어요: '+e.message);return;}
  await opsLoadLinks(window._projectCtx.pid,true);$('ops-link-form').innerHTML='';renderOpsLinks(box);if(box==='files')renderProjectFiles($('project-tab-content'));
}
async function opsLinkDelete(id,box){
  if(!await oriConfirm('이 연결을 끊을까요? 원래 문서는 그대로 남아요.',{ok:'연결 끊기',cancel:'그대로 두기'}))return;
  try{await sbOk(sbClient.from('project_links').delete().eq('id',id));}catch(e){oriAlert('끊지 못했어요: '+e.message);return;}
  await opsLoadLinks(window._projectCtx.pid,true);renderOpsLinks(box);if(box==='files')renderProjectFiles($('project-tab-content'));
}

/* ══ 자료함: 자주 찾는 자료를 칸으로. 칸을 누르면 열리고, 빈 칸은 바로 연결 ══ */
var OPS_FILE_SLOTS=[['대본','book'],['악보·MR','music'],['무대 도면 폴더','stage'],['포스터 원본','megaphone'],['계약서','note'],['사진·영상','camera']];
async function renderProjectFiles(el){
  if(!el)return;
  var links=((await opsLoadLinks(window._projectCtx.pid))||{}).files||[];
  var used={};
  var tiles=OPS_FILE_SLOTS.map(function(sl){
    var l=links.find(function(x){return (x.label||'')===sl[0];});if(l)used[l.id]=1;
    return l?'<a class="fl-tile on" href="'+escHtml(l.url)+'" target="_blank" rel="noopener noreferrer">'+ico(sl[1])+'<b>'+escHtml(sl[0])+'</b><small>'+escHtml(opsLinkKind(l.url)[2])+'</small></a>'
      :'<button type="button" class="fl-tile" onclick="opsLinkForm(\'files\',\''+sl[0]+'\')">'+ico(sl[1])+'<b>'+escHtml(sl[0])+'</b><small>+ 연결</small></button>';
  });
  links.filter(function(l){return !used[l.id];}).forEach(function(l){var k=opsLinkKind(l.url);tiles.push('<a class="fl-tile on" href="'+escHtml(l.url)+'" target="_blank" rel="noopener noreferrer">'+ico('link')+'<b>'+escHtml(l.label||k[2])+'</b><small>'+escHtml(k[2])+'</small></a>');});
  el.innerHTML='<div class="fl-grid">'+tiles.join('')+'</div>';
}

/* ══ 할 일 ══ */
var _tasks={rows:[],mine:false};
function opsMembers(){
  var seen={},out=[];(window._projectCtx.memberDetail||[]).forEach(function(m){if(seen[m.member_id])return;seen[m.member_id]=1;out.push({id:m.member_id,name:(m.person_id&&nm(m.person_id))||m.nickname||m.email||'팀원'});});
  return out;
}
async function opsLoadTasks(pid){
  var r=await sbClient.from('project_tasks').select('*').eq('project_id',pid).order('done').order('due_date',{ascending:true,nullsFirst:false}).order('created_at');
  return r.error?[]:(r.data||[]);
}
function opsDue(d){if(!d)return '';var n=dashDaysUntil(d);return n<0?(-n)+'일 지남':n===0?'오늘':n===1?'내일':pjbMd(d)+' (D-'+n+')';}
async function renderProjectTasks(el,boxFilter){
  var ctx=window._projectCtx,pid=ctx.pid;
  el.innerHTML='<div id="ops-tasks"><div class="hf-loading">불러오는 중…</div></div>';
  if(!ctx.memberDetail){var md=await sbClient.rpc('list_project_members_detail',{p_project_id:pid});ctx.memberDetail=md.data||[];}
  _tasks.rows=await opsLoadTasks(pid);_tasks.box=boxFilter||'';
  opsTasksDraw();
  if(!boxFilter&&!(_pjb.data&&_pjb.data.pid===pid))loadBoardData().then(function(D){_pjb.data={pid:pid,D:D};opsTasksDraw();});  // 바로 들어와도 계기판 제안이 보이게
}
function opsTasksDraw(){
  var el=$('ops-tasks');if(!el)return;
  var ctx=window._projectCtx,members=opsMembers(),me=ctx.myMember&&ctx.myMember.id,boxes=projectBoxes();
  var rows=_tasks.rows.filter(function(t){return (!_tasks.box||t.box_key===_tasks.box)&&(!_tasks.mine||t.assignee_member_id===me);});
  var open=rows.filter(function(t){return !t.done;}),done=rows.filter(function(t){return t.done;});
  var late=open.filter(function(t){return t.due_date&&dashDaysUntil(t.due_date)<0;}),week=open.filter(function(t){var n=t.due_date&&dashDaysUntil(t.due_date);return t.due_date&&n>=0&&n<=7;}),later=open.filter(function(t){return late.indexOf(t)<0&&week.indexOf(t)<0;});
  var memberName=function(id){var m=members.find(function(x){return x.id===id;});return m?m.name:'';};
  var boxTitle=function(k){var b=boxes.find(function(x){return x.key===k;});return b?b.title:'';};
  var row=function(t){
    return '<div class="task'+(t.done?' done':'')+(t.due_date&&!t.done&&dashDaysUntil(t.due_date)<0?' late':'')+'">'
      +'<button type="button" class="task-check" role="checkbox" aria-checked="'+t.done+'" onclick="opsTaskToggle(\''+t.id+'\')">'+(t.done?'✓':'')+'</button>'
      +'<span class="task-t">'+escHtml(t.title)+'</span>'
      +'<span class="task-meta">'
      +(t.box_key&&!_tasks.box?'<span class="task-box">'+escHtml(boxTitle(t.box_key))+'</span>':'')
      +'<select class="task-who" onchange="opsTaskSet(\''+t.id+'\',\'assignee_member_id\',this.value||null)"><option value="">담당 없음</option>'+members.map(function(m){return '<option value="'+m.id+'"'+(m.id===t.assignee_member_id?' selected':'')+'>'+escHtml(m.name)+'</option>';}).join('')+'</select>'
      +'<input type="date" class="task-due" value="'+(t.due_date||'')+'" onchange="opsTaskSet(\''+t.id+'\',\'due_date\',this.value||null)" title="'+escHtml(opsDue(t.due_date))+'">'
      +'<span class="task-when">'+escHtml(t.done?'':opsDue(t.due_date))+'</span></span>'
      +'<button type="button" class="task-x" title="지우기" onclick="opsTaskDelete(\''+t.id+'\')">✕</button></div>';
  };
  var group=function(title,list,cls){return list.length?'<section class="task-g '+(cls||'')+'"><h3>'+title+'<span>'+list.length+'</span></h3>'+list.map(row).join('')+'</section>':'';};
  var sugg=_tasks.box?'':opsTaskSuggestions();
  el.innerHTML='<div class="task-add"><input type="text" id="task-new" maxlength="200" placeholder="할 일" onkeydown="if(event.key===\'Enter\'&&!event.isComposing)opsTaskAdd()">'
    +'<select id="task-new-who"><option value="">담당</option>'+members.map(function(m){return '<option value="'+m.id+'">'+escHtml(m.name)+'</option>';}).join('')+'</select>'
    +'<input type="date" id="task-new-due">'
    +(_tasks.box?'':'<select id="task-new-box"><option value="">영역</option>'+boxes.filter(function(b){return b.key!=='tasks';}).map(function(b){return '<option value="'+b.key+'">'+escHtml(b.title)+'</option>';}).join('')+'</select>')
    +'<button type="button" class="pf-btn pf-active" onclick="opsTaskAdd()">추가</button></div>'
    +'<div class="pchips task-chips"><button type="button" class="'+(!_tasks.mine?'active':'')+'" onclick="_tasks.mine=false;opsTasksDraw()">모두<span class="pchips-n">'+_tasks.rows.filter(function(t){return !t.done&&(!_tasks.box||t.box_key===_tasks.box);}).length+'</span></button><button type="button" class="'+(_tasks.mine?'active':'')+'" onclick="_tasks.mine=true;opsTasksDraw()">내 할 일<span class="pchips-n">'+_tasks.rows.filter(function(t){return !t.done&&t.assignee_member_id===me&&(!_tasks.box||t.box_key===_tasks.box);}).length+'</span></button></div>'
    +group('마감 지남',late,'late')+group('이번 주',week)+group('나중에',later)
    +(!open.length&&!done.length?'<div class="dv-empty">'+(_tasks.box==='showweek'?'<button type="button" class="pf-btn pf-active" onclick="opsShowweekTemplate()">공연 주간 체크리스트 넣기</button>':'아직 할 일이 없어요')+'</div>':'')
    +sugg
    +(done.length?'<details class="task-g task-done"><summary><h3>끝낸 일<span>'+done.length+'</span></h3></summary>'+done.map(row).join('')+'</details>':'');
}
/* 계기판이 빨간불·마감 임박으로 보는 영역을 할 일로 제안 (아직 할 일이 없는 영역만) */
function opsTaskSuggestions(){
  var D=_pjb.data&&_pjb.data.pid===window._projectCtx.pid?_pjb.data.D:null;if(!D)return '';
  var have=_tasks.rows.map(function(t){return t.title;});
  var list=DASH_AREAS.map(function(a){var l=dashLight(a,D);return {a:a,l:l};}).filter(function(x){return (x.l.light==='red'||x.l.light==='yellow')&&have.indexOf(x.a[1]+' 해결하기')<0;}).slice(0,6);
  if(!list.length)return '';
  return '<section class="task-g task-sugg"><h3>제안<span>'+list.length+'</span></h3>'+list.map(function(x){
    var due=D.start?opsDateMinus(D.start,x.a[2]):'';
    return '<div class="task sugg"><span class="dash-dot '+x.l.light+'"></span><span class="task-t">'+escHtml(x.a[1])+' 해결하기</span><span class="task-when">'+escHtml(x.l.why||x.l.due||'')+'</span>'
      +'<button type="button" class="pf-btn" onclick="opsTaskAdd(\''+escHtml(x.a[1]).replace(/'/g,'')+' 해결하기\',\''+due+'\')">할 일로</button></div>';
  }).join('')+'</section>';
}
function opsDateMinus(start,days){var d=new Date(String(start).slice(0,10)+'T00:00:00');d.setDate(d.getDate()-days);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
async function opsTaskAdd(title,due){
  var ctx=window._projectCtx;
  var t=title||($('task-new')&&$('task-new').value||'').trim();if(!t){var i=$('task-new');if(i)i.focus();return;}
  var row={project_id:ctx.pid,title:t,box_key:_tasks.box||($('task-new-box')&&!title?$('task-new-box').value:null)||null,
    assignee_member_id:!title&&$('task-new-who')?($('task-new-who').value||null):null,due_date:due||(!title&&$('task-new-due')?$('task-new-due').value:'')||null};
  try{await sbOk(sbClient.from('project_tasks').insert(row));}catch(e){oriAlert('추가하지 못했어요: '+e.message);return;}
  _tasks.rows=await opsLoadTasks(ctx.pid);opsTasksDraw();
  var n=$('task-new');if(n){n.value='';n.focus();}
}
async function opsTaskToggle(id){
  var t=_tasks.rows.find(function(x){return x.id===id;});if(!t)return;
  var done=!t.done;
  var r=await sbClient.from('project_tasks').update({done:done,done_at:done?new Date().toISOString():null}).eq('id',id);
  if(r.error){oriAlert('저장하지 못했어요: '+r.error.message);return;}
  t.done=done;opsTasksDraw();
}
async function opsTaskSet(id,field,val){
  var t=_tasks.rows.find(function(x){return x.id===id;});if(!t)return;
  var u={};u[field]=val;
  var r=await sbClient.from('project_tasks').update(u).eq('id',id);
  if(r.error){oriAlert('저장하지 못했어요: '+r.error.message);return;}
  t[field]=val;opsTasksDraw();
}
async function opsTaskDelete(id){
  var r=await sbClient.from('project_tasks').delete().eq('id',id);
  if(r.error){oriAlert('지우지 못했어요: '+r.error.message);return;}
  _tasks.rows=_tasks.rows.filter(function(x){return x.id!==id;});opsTasksDraw();
}
/* 공연 주간 기본 체크리스트: 첫 공연 날짜에서 거꾸로 마감을 잡는다 */
var OPS_SHOWWEEK=[[7,'마지막 전체 런스루'],[5,'콜시트 돌리기 (집합 시간·장소·준비물)'],[3,'테크 리허설 (조명·음향 큐 맞추기)'],[2,'드레스 리허설'],[1,'반입·무대 셋업'],[1,'하우스 준비 (티켓·안내·객석)'],[0,'콜타임 공지'],[0,'공연 후 철수·반출'],[-2,'대여품 반납 (의상·소품·장비)']];
async function opsShowweekTemplate(){
  var ctx=window._projectCtx,start=ctx.pr.target_start_date;
  var rows=OPS_SHOWWEEK.map(function(x,i){return {project_id:ctx.pid,title:x[1],box_key:'showweek',order_num:i,due_date:start?opsDateMinus(start,x[0]):null};});
  try{await sbOk(sbClient.from('project_tasks').insert(rows));}catch(e){oriAlert('넣지 못했어요: '+e.message);return;}
  _tasks.rows=await opsLoadTasks(ctx.pid);opsTasksDraw();
}

/* ══ 연습 출결: 다가오는 일정마다 온다·못 온다·몰라 + 누가 오는지 ══ */
async function opsRsvpDecorate(events){
  var ids=events.map(function(e){return e.id;});if(!ids.length)return;
  var r=await sbClient.from('project_event_rsvps').select('*').in('event_id',ids);
  var by={};(r.data||[]).forEach(function(x){(by[x.event_id]=by[x.event_id]||[]).push(x);});
  var me=CURRENT_USER&&CURRENT_USER.id;
  events.forEach(function(ev){
    var row=document.querySelector('#ev-list .ev-row[data-ev="'+ev.id+'"]');if(!row)return;
    var list=by[ev.id]||[],mine=(list.find(function(x){return x.user_id===me;})||{}).status;
    var c=function(s){return list.filter(function(x){return x.status===s;}).length;};
    var box=document.createElement('div');box.className='ev-rsvp';
    box.innerHTML=[['yes','가요'],['maybe','몰라요'],['no','못 가요']].map(function(o){return '<button type="button" class="'+(mine===o[0]?'on r-'+o[0]:'')+'" onclick="opsRsvp(\''+ev.id+'\',\''+o[0]+'\')">'+o[1]+'</button>';}).join('')
      +'<span class="ev-rsvp-n">'+(c('yes')?'참석 '+c('yes'):'')+(c('no')?' · 불참 '+c('no'):'')+(c('maybe')?' · 미정 '+c('maybe'):'')+'</span>';
    var old=row.nextElementSibling;if(old&&old.classList.contains('ev-rsvp'))old.remove();
    row.after(box);
  });
}
async function opsRsvp(eventId,status){
  if(!CURRENT_USER)return;
  var r=await sbClient.from('project_event_rsvps').upsert({event_id:eventId,user_id:CURRENT_USER.id,status:status,updated_at:new Date().toISOString()});
  if(r.error){oriAlert('저장하지 못했어요: '+r.error.message);return;}
  loadScheduleList();
}

/* ══ 일정 → 구글 캘린더 등 (.ics 내려받기) ══ */
async function opsExportIcs(){
  var ctx=window._projectCtx,evs=await fetchProjectEvents(ctx.pid);
  var z=function(d){return new Date(d).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');};
  var esc=function(s){return String(s||'').replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');};
  var lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//ori//project//KO','X-WR-CALNAME:'+esc(ctx.pr.title||'오리 프로젝트')];
  evs.forEach(function(e){
    var k=(EVENT_KIND[e.kind]||EVENT_KIND.etc).l;
    lines.push('BEGIN:VEVENT','UID:'+e.id+'@ori','DTSTAMP:'+z(new Date()),'DTSTART:'+z(e.starts_at),'DTEND:'+z(e.ends_at||new Date(new Date(e.starts_at).getTime()+2*3600e3)),
      'SUMMARY:'+esc('['+k+'] '+e.title),e.location?'LOCATION:'+esc(e.location):'',e.note?'DESCRIPTION:'+esc(e.note):'','END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  var blob=new Blob([lines.filter(Boolean).join('\r\n')],{type:'text/calendar'}),a=document.createElement('a');
  a.href=URL.createObjectURL(blob);a.download=(ctx.pr.title||'ori')+'-일정.ics';document.body.appendChild(a);a.click();a.remove();
  oriAlert('일정 파일을 받았어요. 구글 캘린더 → 설정 → 가져오기에서 올리면 돼요.');
}

/* ══ 회고 ══ */
var OPS_RETRO=[['good','잘된 것'],['bad','아쉬운 것'],['next','다음엔']];
async function renderProjectRetro(el){
  var ctx=window._projectCtx;
  el.innerHTML='<div class="retro" id="ops-retro"><div class="hf-loading">불러오는 중…</div></div>';
  var r=await sbClient.from('project_retro_items').select('*').eq('project_id',ctx.pid).order('created_at');
  var rows=r.data||[],me=CURRENT_USER&&CURRENT_USER.id,box=$('ops-retro');if(!box)return;
  box.innerHTML=OPS_RETRO.map(function(k){
    var list=rows.filter(function(x){return x.kind===k[0];});
    return '<section class="retro-col r-'+k[0]+'"><h3>'+k[1]+'<span>'+list.length+'</span></h3>'
      +list.map(function(x){return '<div class="retro-i">'+escHtml(x.body)+(x.user_id===me||ctx.isAdmin?'<button type="button" class="task-x" onclick="opsRetroDel(\''+x.id+'\')">✕</button>':'')+'</div>';}).join('')
      +'<input type="text" class="retro-in" maxlength="1000" placeholder="+ '+k[1]+'" onkeydown="if(event.key===\'Enter\'&&!event.isComposing)opsRetroAdd(\''+k[0]+'\',this)"></section>';
  }).join('');
}
async function opsRetroAdd(kind,inp){
  var body=(inp.value||'').trim();if(!body)return;
  try{await sbOk(sbClient.from('project_retro_items').insert({project_id:window._projectCtx.pid,kind:kind,body:body,user_id:CURRENT_USER.id}));}catch(e){oriAlert('남기지 못했어요: '+e.message);return;}
  var el=$('project-tab-content');if(el)renderProjectRetro(el);
}
async function opsRetroDel(id){
  try{await sbOk(sbClient.from('project_retro_items').delete().eq('id',id));}catch(e){oriAlert('지우지 못했어요: '+e.message);return;}
  var el=$('project-tab-content');if(el)renderProjectRetro(el);
}

/* ══ 공연 기록: 관객 수·회차·티켓·출연료를 적고 아카이브로 ══ */
function renderProjectRecord(el){
  var ctx=window._projectCtx,pr=ctx.pr,pid=ctx.pid,admin=ctx.isAdmin;
  var seg=function(id,opts,cur){return admin?tsSeg(id,opts.concat([['','미정']]),cur):'<div>'+escHtml((opts.find(function(o){return String(o[0])===String(cur);})||[0,'미정'])[1])+'</div>';};  // 단체 공연 기록과 같은 고르기 (troupe-shows.js)
  el.innerHTML=(pr.published_show_id?'<div class="wd-done"><div><b>아카이브에 올라갔어요</b></div><button type="button" class="pf-btn pf-active" onclick="openDetail(\'show\',\''+pr.published_show_id+'\')">공연 페이지</button></div>':'')
    +'<section class="dv-sec"><div class="ts-grid rec-grid">'
    +'<div class="edit-modal-field"><label>관객 수 (전체 회차 합)</label><input type="number" min="0" id="rec-aud" value="'+(pr.audience_count==null?'':pr.audience_count)+'"'+(admin?'':' disabled')+'></div>'
    +'<div class="edit-modal-field"><label>회차</label><input type="number" min="1" id="rec-cnt" value="'+(pr.performance_count==null?'':pr.performance_count)+'"'+(admin?'':' disabled')+'></div>'
    +'<div class="edit-modal-field"><label>티켓</label>'+seg('rec-ticket',[['유료','유료'],['무료','무료']],pr.ticket_type||'')+'</div>'
    +'<div class="edit-modal-field"><label>출연료</label>'+seg('rec-paid',[['true','지급'],['false','없음']],pr.performers_paid==null?'':String(pr.performers_paid))+'</div>'
    +'</div>'+(admin?'<div class="ts-actions"><button type="button" class="pf-btn pf-active" onclick="opsRecSave()">'+(pr.published_show_id?'저장하고 아카이브에 반영':'저장')+'</button>'
      +(pr.published_show_id?'':'<button type="button" class="pf-btn" onclick="updateProjectStatus(\''+pid+'\',\'upcoming\')">공연 기록 만들기</button>')+'</div>':'')+'</section>';
}
async function opsRecSave(){
  var ctx=window._projectCtx,pr=ctx.pr;
  var aud=$('rec-aud').value,cnt=$('rec-cnt').value,paid=tsSegVal('rec-paid')||null;
  var u={audience_count:aud===''?null:Math.max(0,parseInt(aud,10)),performance_count:cnt===''?null:Math.max(1,parseInt(cnt,10)),ticket_type:tsSegVal('rec-ticket')||null,performers_paid:paid==null?null:paid==='true'};
  try{
    await sbOk(sbClient.from('projects').update(u).eq('id',ctx.pid));
    Object.assign(pr,u);
    if(pr.published_show_id)await sbOk(sbClient.rpc('publish_project_as_show',{p_project_id:ctx.pid}));
  }catch(e){oriAlert('저장하지 못했어요: '+e.message);return;}
  oriAlert(pr.published_show_id?'저장했고 아카이브 공연에도 반영했어요':'저장했어요');
}

/* ══ 정산: 예산과 같은 데이터, 다른 질문 (project-budget.js bgSettleView) ══ */
function renderProjectSettle(el){renderProjectBudget(el,'settle');}

/* ══ 제작진 화면 (10/24): 담당 영역마다 타일 (계기판과 같은 판정·마감). 누르면 아래에 담당자·추천·모집 ══ */
var CREW_AREAS=['director','music','choreo','lighting','sound','stage','costume','props','makeup','photo','promo'];
var _crew={open:null};
async function renderCrewBoard(el){
  var ctx=window._projectCtx;
  el.innerHTML='<div id="crew-board"><div class="hf-loading">불러오는 중…</div></div>';
  var D=await loadProdDashData();
  _dash.data=D;_dash.pid=ctx.pid;   // 계기판 동작(초대·상태 정하기)이 이 데이터를 쓴다
  ctx.positions=D.positions;
  crewDraw();
}
function crewDraw(){
  var el=$('crew-board'),D=_dash.data;if(!el||!D)return;
  var ctx=window._projectCtx;
  var areas=CREW_AREAS.map(function(k){return dashArea(k);}).filter(Boolean);
  var tiles=areas.map(function(a){
    var l=dashLight(a,D),st=pjbFromLight(l.light),ps=dashPositionsFor(a,D.positions),filled=ps.filter(dashFilled);
    var who=filled.map(function(p){return dashMemberName(p,D);}).filter(Boolean);
    var openPos=ps.filter(function(p){return p.status==='open'&&!dashFilled(p);}).length;
    var v=l.light==='off'?'해당 없음':who.length?who.join(', '):openPos?'모집 중':l.light==='green'?l.text:'미정';  // 사람 없이 해결된 영역(예: 홍보 링크)은 그 이유를
    return '<button type="button" class="crew-tile pjb-'+st+(_crew.open===a[0]?' open':'')+'" onclick="crewOpen(\''+a[0]+'\')">'
      +'<span class="crew-t">'+escHtml(a[1])+pjbOrb(st)+'</span><span class="crew-v">'+escHtml(v)+'</span>'
      +'<span class="crew-d">'+escHtml(l.light==='off'?'':(l.why&&l.light==='red'?l.why:(l.due||'')))+'</span></button>';
  });
  var others=D.positions.filter(function(p){return p.position_type==='other';});
  tiles.push('<button type="button" class="crew-tile pjb-'+(others.length?'done':'todo')+(_crew.open==='other'?' open':'')+'" onclick="crewOpen(\'other\')"><span class="crew-t">그 밖의 스태프'+pjbOrb(others.length?'done':'todo')+'</span><span class="crew-v">'+(others.length?others.length+'자리':'없음')+'</span><span class="crew-d"></span></button>');
  el.innerHTML='<div class="crew-grid">'+tiles.join('')+'</div><div id="crew-detail"></div>';
  if(_crew.open)crewDetail(_crew.open);
}
function crewOpen(key){_crew.open=_crew.open===key?null:key;crewDraw();var d=$('crew-detail');if(d&&_crew.open)d.scrollIntoView({behavior:'smooth',block:'nearest'});}
function crewDetail(key){
  var el=$('crew-detail'),D=_dash.data,ctx=window._projectCtx,admin=ctx.isAdmin,pid=ctx.pid;if(!el)return;
  if(key==='other'){
    var others=D.positions.filter(function(p){return p.position_type==='other';});
    el.innerHTML='<div class="crew-panel"><div class="crew-ph"><b>그 밖의 스태프</b></div>'
      +(others.length?others.map(function(p){return '<div class="crew-row"><span>'+escHtml(p.position_label||'스태프')+'</span><span class="crew-who">'+escHtml(dashFilled(p)?dashMemberName(p,D)||'확정':p.status==='open'?'모집 중':'비어 있음')+'</span></div>';}).join(''):'')
      +(admin?'<button class="pf-btn" onclick="showAddPositionForm(\''+pid+'\')">+ 자리 추가</button><div id="add-position-form" style="margin-top:0.5rem"></div>':'')+'</div>';
    return;
  }
  var a=dashArea(key),l=dashLight(a,D),ps=dashPositionsFor(a,D.positions),man=D.areas[key]||{};
  var openP=ps.find(function(p){return p.status==='open'&&!dashFilled(p);});
  var rid=dashStaffRoleIds(a[4]||[])[0];
  var h='<div class="crew-panel"><div class="crew-ph"><span class="dash-dot '+l.light+'"></span><b>'+escHtml(a[1])+'</b><span>'+escHtml([l.light==='off'?'해당 없음':l.text,l.due,l.why].filter(Boolean).join(' · '))+'</span><button type="button" class="dash-x" onclick="crewOpen(\''+key+'\')">✕</button></div>';
  h+=ps.length?ps.map(function(p){return '<div class="crew-row"><span>'+escHtml(p.position_label||a[1])+'</span><span class="crew-who">'+escHtml(dashFilled(p)?dashMemberName(p,D)||'확정':p.status==='open'?'모집 중':'비어 있음')+'</span>'
      +(admin&&!dashFilled(p)?'<button type="button" class="pf-btn" onclick="crewRecruit(\''+p.id+'\','+(p.status!=='open')+')">'+(p.status==='open'?'모집 닫기':'모집 열기')+'</button>':'')+'</div>';}).join('')
    :'<div class="crew-row"><span>'+escHtml(a[1])+'</span><span class="crew-who">자리 없음</span>'+(admin?'<button type="button" class="pf-btn" onclick="crewNewSlot(\''+key+'\')">모집 열기</button>':'')+'</div>';
  if(admin)h+='<div class="dash-man-row crew-man"><span class="dash-lbl">상태</span><div class="dash-seg">'+[['','자동'],['done','해결'],['off','해당 없음']].map(function(o){return '<button type="button" class="'+((man.status||'')===o[0]?'on':'')+'" onclick="crewStatus(\''+key+'\',\''+o[0]+'\')">'+o[1]+'</button>';}).join('')+'</div></div>';
  h+=(l.light==='green'||l.light==='off')?'':dashStaffRecs(a,D);
  el.innerHTML=h+'</div>';
}
async function crewRecruit(posId,open){
  var r=await sbClient.rpc('set_position_recruiting',{p_position_id:posId,p_open:open});
  if(r.error){oriAlert('바꾸지 못했어요: '+r.error.message);return;}
  if(open)try{await sbOk(sbClient.from('projects').update({is_recruiting:true}).eq('id',window._projectCtx.pid));window._projectCtx.pr.is_recruiting=true;}catch(e){}
  renderCrewBoard($('project-tab-content'));
}
async function crewNewSlot(key){
  var a=dashArea(key),rid=dashStaffRoleIds(a[4]||[])[0];
  await recruitProjectSlot(window._projectCtx.pid,rid?'staff':'other',rid||null,a[1]);
  renderCrewBoard($('project-tab-content'));
}
async function crewStatus(key,status){await dashSetStatus(key,status);renderCrewBoard($('project-tab-content'));}
