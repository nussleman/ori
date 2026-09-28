/* 오리 사이트 — 공연 프로젝트: 일정 · 공지
   일정(project_events): 연습·공연·회의·마감. 매주 반복으로 한 번에 여러 개 추가할 수 있다.
   공지(project_notices): 홈 탭 위쪽에 고정 공지 + 최근 공지.
   팀원은 보기만, 관리자만 쓰기 (DB 권한도 같게 걸려 있음). */
var EVENT_KIND={rehearsal:{l:'연습',c:'ev-reh'},performance:{l:'공연',c:'ev-perf'},meeting:{l:'회의',c:'ev-meet'},deadline:{l:'마감',c:'ev-dead'},etc:{l:'기타',c:'ev-etc'}};
var WEEKDAY=['일','월','화','수','목','금','토'];

function evDate(d){return (d.getMonth()+1)+'.'+String(d.getDate()).padStart(2,'0')+' ('+WEEKDAY[d.getDay()]+')';}
function evTime(d){return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');}
function dayDiff(d){var a=new Date();a.setHours(0,0,0,0);var b=new Date(d);b.setHours(0,0,0,0);return Math.round((b-a)/86400000);}
function ddayLabel(d){var n=dayDiff(d);return n===0?'오늘':(n>0?'D-'+n:'D+'+(-n));}

async function fetchProjectEvents(pid){
  var r=await sbClient.from('project_events').select('*').eq('project_id',pid).order('starts_at',{ascending:true});
  if(r.error)throw r.error;return r.data||[];
}
async function fetchProjectNotices(pid){
  var r=await sbClient.from('project_notices').select('*').eq('project_id',pid).order('created_at',{ascending:false});
  if(r.error)throw r.error;return r.data||[];
}

function eventRowHtml(ev,canEdit){
  var s=new Date(ev.starts_at),e=ev.ends_at?new Date(ev.ends_at):null;
  var k=EVENT_KIND[ev.kind]||EVENT_KIND.etc;
  var past=(e||s)<new Date();
  return '<div class="ev-row'+(past?' past':'')+'">'
    +'<div class="ev-date"><b>'+evDate(s)+'</b><span>'+evTime(s)+(e?' – '+evTime(e):'')+'</span></div>'
    +'<div class="ev-main"><div class="ev-title"><span class="ev-kind '+k.c+'">'+k.l+'</span>'+escHtml(ev.title)+'</div>'
    +((ev.location||ev.note)?'<div class="ev-sub">'+(ev.location?'📍 '+escHtml(ev.location):'')+(ev.location&&ev.note?' · ':'')+(ev.note?escHtml(ev.note):'')+'</div>':'')+'</div>'
    +(!past?'<span class="ev-dday">'+ddayLabel(s)+'</span>':'')
    +(canEdit?'<button type="button" class="ev-del" title="삭제" onclick="deleteProjectEvent(\''+ev.id+'\')">✕</button>':'')
    +'</div>';
}

/* ── 일정 탭 ── */
function renderProjectSchedule(el){
  var ctx=window._projectCtx;
  var h='';
  if(ctx.isAdmin){
    var today=new Date().toISOString().slice(0,10);
    h+='<details class="ev-form-wrap"'+(window._evFormOpen?' open':'')+' ontoggle="window._evFormOpen=this.open"><summary class="ev-add">+ 일정 추가</summary>'
      +'<div class="ev-form">'
      +'<div class="ev-kinds" role="radiogroup">'+Object.keys(EVENT_KIND).map(function(k,i){return '<label class="ev-kind-opt"><input type="radio" name="ev-kind" value="'+k+'"'+(i===0?' checked':'')+'><span class="ev-kind '+EVENT_KIND[k].c+'">'+EVENT_KIND[k].l+'</span></label>';}).join('')+'</div>'
      +'<div class="ev-grid">'
      +'<label class="ev-field ev-wide"><span>제목</span><input id="ev-title" type="text" maxlength="120" placeholder="예: 1막 블로킹, 전체 런, 첫 공연"></label>'
      +'<label class="ev-field"><span>날짜</span><input id="ev-date" type="date" value="'+today+'"></label>'
      +'<label class="ev-field"><span>시작</span><input id="ev-start" type="time" value="19:00"></label>'
      +'<label class="ev-field"><span>끝 (선택)</span><input id="ev-end" type="time" value="22:00"></label>'
      +'<label class="ev-field"><span>반복</span><select id="ev-repeat"><option value="1">한 번만</option><option value="4">매주 · 4주</option><option value="8">매주 · 8주</option><option value="12">매주 · 12주</option></select></label>'
      +'<label class="ev-field ev-wide"><span>장소 (선택)</span><input id="ev-loc" type="text" maxlength="200" placeholder="연습실, 극장 등"></label>'
      +'<label class="ev-field ev-wide"><span>메모 (선택)</span><input id="ev-note" type="text" maxlength="2000" placeholder="준비물, 참석 대상 등"></label>'
      +'</div>'
      +'<div class="ev-form-actions"><span id="ev-msg" class="ev-msg"></span><button type="button" class="ms-new" onclick="addProjectEvent()">추가하기</button></div>'
      +'</div></details>';
  }
  h+='<div id="ev-list"><div class="hf-loading">불러오는 중…</div></div>';
  el.innerHTML=h;
  loadScheduleList();
}

async function loadScheduleList(){
  var ctx=window._projectCtx,el=$('ev-list');if(!el)return;
  try{
    var evs=await fetchProjectEvents(ctx.pid);
    if(!evs.length){el.innerHTML='<div class="dv-empty">아직 일정이 없어요.'+(ctx.isAdmin?' 위의 "+ 일정 추가"로 연습·공연 일정을 넣어보세요.':' 관리자가 일정을 올리면 여기에 보여요.')+'</div>';return;}
    var now=new Date();
    var upcoming=evs.filter(function(e){return new Date(e.ends_at||e.starts_at)>=now;});
    var past=evs.filter(function(e){return new Date(e.ends_at||e.starts_at)<now;}).reverse();
    var byMonth=function(list){
      var out='',last='';
      list.forEach(function(ev){var d=new Date(ev.starts_at);var m=d.getFullYear()+'년 '+(d.getMonth()+1)+'월';if(m!==last){out+='<div class="ev-month">'+m+'</div>';last=m;}out+=eventRowHtml(ev,ctx.isAdmin);});
      return out;
    };
    el.innerHTML='<section class="dv-sec">'+dvSection('다가오는 일정',upcoming.length)+(upcoming.length?byMonth(upcoming):'<div class="dv-empty">예정된 일정이 없어요.</div>')+'</section>'
      +(past.length?'<details class="dv-sec ev-past"><summary>'+dvSection('지난 일정',past.length)+'</summary>'+byMonth(past)+'</details>':'');
  }catch(e){el.innerHTML='<div class="dv-empty">일정을 불러오지 못했어요: '+escHtml(e.message)+'</div>';}
}

async function addProjectEvent(){
  var ctx=window._projectCtx,msg=$('ev-msg');
  var kind=(document.querySelector('input[name="ev-kind"]:checked')||{}).value||'rehearsal';
  var title=$('ev-title').value.trim(),date=$('ev-date').value,st=$('ev-start').value,en=$('ev-end').value;
  var repeat=parseInt($('ev-repeat').value,10)||1;
  if(!title){msg.textContent='제목을 적어주세요';$('ev-title').focus();return;}
  if(!date||!st){msg.textContent='날짜와 시작 시간을 정해주세요';return;}
  var rows=[];
  for(var i=0;i<repeat;i++){
    var s=new Date(date+'T'+st);s.setDate(s.getDate()+7*i);
    var e=null;if(en){e=new Date(date+'T'+en);e.setDate(e.getDate()+7*i);if(e<s)e.setDate(e.getDate()+1);}
    rows.push({project_id:ctx.pid,kind:kind,title:title,starts_at:s.toISOString(),ends_at:e?e.toISOString():null,location:$('ev-loc').value.trim()||null,note:$('ev-note').value.trim()||null});
  }
  msg.textContent='저장 중…';
  try{
    var r=await sbClient.from('project_events').insert(rows);if(r.error)throw r.error;
    $('ev-title').value='';$('ev-note').value='';msg.textContent=rows.length>1?rows.length+'개 일정을 추가했어요':'추가했어요';
    loadScheduleList();
  }catch(e){msg.textContent='저장 실패: '+e.message;}
}
async function deleteProjectEvent(id){
  if(!await oriConfirm('이 일정을 지울까요?'))return;
  try{var r=await sbClient.from('project_events').delete().eq('id',id);if(r.error)throw r.error;
    if(window._projectTab==='schedule')loadScheduleList();else renderProjectTabContent();}
  catch(e){oriAlert('삭제 실패: '+e.message);}
}

/* ── 홈 탭에 들어가는 공지 · 다가오는 일정 ── */
function homeNoticesHtml(){
  var ctx=window._projectCtx;
  return '<section class="dv-sec">'+dvSection('공지')
    +(ctx.isAdmin?'<div class="nt-write"><textarea id="nt-body" rows="2" maxlength="2000" placeholder="팀에게 알릴 내용을 적어주세요 (예: 이번 주 연습은 토요일 2시로 바뀌었어요)"></textarea>'
      +'<div class="nt-write-row"><label class="nt-pin"><input type="checkbox" id="nt-pin"> 맨 위에 고정</label><button type="button" class="ms-new" onclick="addProjectNotice()">올리기</button></div></div>':'')
    +'<div id="ph-notices"><div class="hf-loading">불러오는 중…</div></div></section>';
}
function homeUpcomingHtml(){
  return '<section class="dv-sec">'+dvSection('다가오는 일정')+'<div id="ph-events"><div class="hf-loading">불러오는 중…</div></div></section>';
}
async function loadHomeScheduleBits(){
  var ctx=window._projectCtx;
  try{
    var notices=await fetchProjectNotices(ctx.pid);
    var nel=$('ph-notices');
    if(nel){
      notices.sort(function(a,b){return(b.pinned?1:0)-(a.pinned?1:0);});
      nel.innerHTML=notices.length?notices.slice(0,5).map(function(n){
        return '<div class="nt-item'+(n.pinned?' pinned':'')+'">'+(n.pinned?'<span class="nt-pin-badge">고정</span>':'')
          +'<div class="nt-body">'+escHtml(n.body)+'</div>'
          +'<div class="nt-meta">'+(n.author_name?escHtml(n.author_name)+' · ':'')+new Date(n.created_at).toLocaleDateString('ko-KR',{month:'long',day:'numeric'})
          +(ctx.isAdmin?' · <span class="link" onclick="deleteProjectNotice(\''+n.id+'\')">지우기</span>':'')+'</div></div>';
      }).join(''):'<div class="ph-empty-line">아직 공지가 없어요.</div>';
    }
  }catch(e){var n2=$('ph-notices');if(n2)n2.innerHTML='<div class="ph-empty-line">공지를 불러오지 못했어요.</div>';}
  try{
    var evs=await fetchProjectEvents(ctx.pid);
    var now=new Date();
    var up=evs.filter(function(e){return new Date(e.ends_at||e.starts_at)>=now;});
    var eel=$('ph-events');
    if(eel){
      eel.innerHTML=(up.length?up.slice(0,3).map(function(ev){return eventRowHtml(ev,false);}).join(''):'<div class="ph-empty-line">예정된 일정이 없어요.</div>')
        +'<button type="button" class="dv-more" onclick="switchProjectTab(\'schedule\')">'+(ctx.isAdmin&&!evs.length?'일정 추가하러 가기 →':'전체 일정 보기 →')+'</button>';
    }
    // 전광판 D-day: 첫 '공연' 일정이 있으면 그 날짜를 따른다
    var perf=evs.filter(function(e){return e.kind==='performance'&&new Date(e.ends_at||e.starts_at)>=now;})[0];
    var mq=document.querySelector('.pj-marquee');
    if(perf&&mq){
      var ps=perf.starts_at.slice(0,10),pl=new Date(perf.starts_at);
      var localDay=pl.getFullYear()+'-'+String(pl.getMonth()+1).padStart(2,'0')+'-'+String(pl.getDate()).padStart(2,'0');
      var d2=projectDday(localDay||ps,ctx.pr.target_end_date&&ctx.pr.target_end_date>localDay?ctx.pr.target_end_date:null,ctx.pr.status);
      mq.className='pj-marquee pj-mq-'+d2.cls;
      mq.innerHTML='<span class="pj-mq-d">'+d2.big+'</span>'+(d2.small?'<span class="pj-mq-s">'+d2.small+'</span>':'');
    }
    ctx.eventCount=evs.length;
  }catch(e){var e2=$('ph-events');if(e2)e2.innerHTML='<div class="ph-empty-line">일정을 불러오지 못했어요.</div>';}
}
async function addProjectNotice(){
  var ctx=window._projectCtx,body=$('nt-body').value.trim();
  if(!body){$('nt-body').focus();return;}
  try{
    var r=await sbClient.from('project_notices').insert({project_id:ctx.pid,body:body,pinned:$('nt-pin').checked,author_name:(CURRENT_USER&&CURRENT_USER.nickname)||null});
    if(r.error)throw r.error;
    $('nt-body').value='';$('nt-pin').checked=false;loadHomeScheduleBits();
  }catch(e){oriAlert('공지를 올리지 못했어요: '+e.message);}
}
async function deleteProjectNotice(id){
  if(!await oriConfirm('이 공지를 지울까요?'))return;
  try{var r=await sbClient.from('project_notices').delete().eq('id',id);if(r.error)throw r.error;loadHomeScheduleBits();}
  catch(e){oriAlert('삭제 실패: '+e.message);}
}
