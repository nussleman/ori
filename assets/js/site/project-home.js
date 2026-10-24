/* 오리 사이트 — 공연 프로젝트 화면: 상자 보드 (10/23)
   탭·머리말 없이, 프로젝트를 이루는 요소를 상자로 한 화면에 모은다 (본문은 스크롤 없이 한 장).
   상자 = 제목 · 핵심 상태(숫자·정해진 것) · 한 줄 설명 · 상태 아이콘(해결·진행 중·시작 전·확인 필요).
   상자를 누르면 그 부분만 열린다(#project-<id>/<상자>). 돌아오기는 왼쪽 위 탐색 경로(project.js projectCrumbHtml).
   상자 안 화면은 예전 탭 렌더러(project.js 배역·제작진·극장·홍보, 일정·예산·소품·계기판 파일)를 그대로 쓴다.
   상태는 제작 계기판(project-dashboard.js)과 같은 판정·마감 기준을 따른다 — 같은 것을 두 곳이 다르게 말하지 않게. */
var PROJECT_STAGES=['기획','팀 꾸리기','공연 준비','공연','마무리'];
var PJB_ST_LABEL={done:'해결',doing:'진행 중',todo:'시작 전',alert:'확인 필요',off:'해당 없음'};
/* 상태 아이콘 = 빛나는 구슬 안의 기호 (CSS .pjb-orb가 입체감을 준다) */
var PJB_ST_ICON={
  done:'<path d="M7.5 12.5l3 3L16.5 9"/>',
  doing:'<path d="M12 7v5l3.2 2"/>',
  todo:'<path d="M8 12h.01M12 12h.01M16 12h.01"/>',
  alert:'<path d="M12 7.5v5M12 16.2v.1"/>',
  off:'<path d="M8.5 12h7"/>'
};
function pjbOrb(st){return '<span class="pjb-orb" title="'+PJB_ST_LABEL[st]+'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+PJB_ST_ICON[st]+'</svg><span class="sr-only">'+PJB_ST_LABEL[st]+'</span></span>';}
var _pjb={data:null};

function projectStageIndex(pr){
  if(pr.status==='completed'||pr.status==='cancelled')return 4;
  if(pr.status==='running')return 3;
  if(pr.status==='upcoming')return 2;
  return (pr.work_id&&pr.target_start_date)?1:0;
}
/* 계기판 불빛 → 상자 상태 */
function pjbFromLight(l){return {green:'done',yellow:'doing',red:'alert',gray:'todo',off:'off'}[l]||'todo';}
function pjbLight(key,D){var a=dashArea(key);return a?dashLight(a,D):{light:'gray',text:''};}
function pjbMd(d){return d?String(d).slice(5,10).replace('-','.'):'';}

/* ── 상자 정의: 순서 = 보드에 놓이는 순서 ──
   view: 상자 안 화면(없으면 go만). go: 상자를 눌렀을 때 화면 대신 할 일(정하기 창 등). show: 보일 사람 */
/* ── 상자 정의 (10/24 개정): 제작 단계(프리·프로덕션·포스트)로 나누고, 사람마다 골라 쓰고 순서를 바꾼다 ──
   phase: pre(프리 프로덕션) · prod(프로덕션) · post(포스트 프로덕션). off:true = 처음엔 숨김(상자 고르기에서 켬).
   모든 상자는 누르면 바로 그 화면(view)으로 간다. 예전 키(date·troupe·requests)는 합친 상자로 잇는다(PJB_ALIAS). */
var PJB_PHASES=[['','전체'],['pre','프리 프로덕션'],['prod','프로덕션'],['post','포스트 프로덕션']];
/* 예전 키는 지금 상자로 잇는다 (주소·계기판 버튼 호환) */
var PJB_ALIAS={date:'schedule',troupe:'settings',requests:'team',props:'cues'};
function projectBoxes(all){
  var ctx=window._projectCtx||{},pid=ctx.pid,pr=ctx.pr||{},admin=!!ctx.isAdmin;
  var budgetOk=admin||!!pr.budget_visible_to_members;
  var list=[
    {key:'tasks',phase:'common',title:'할 일',icon:'note',view:function(el){renderProjectTasks(el);},calc:function(D){
      var me=ctx.myMember&&ctx.myMember.id,open=(D.tasks||[]).filter(function(t){return !t.done;});
      var late=open.filter(function(t){return t.due_date&&dashDaysUntil(t.due_date)<0;}).length,mine=open.filter(function(t){return t.assignee_member_id===me;}).length;
      if(!(D.tasks||[]).length)return{v:'할 일 없음',d:'',st:'todo'};
      return{v:open.length?'남은 일 '+open.length:'모두 끝',d:[late?'마감 지남 '+late:'',mine?'내 할 일 '+mine:''].filter(Boolean).join(' · '),st:late?'alert':open.length?'doing':'done'};
    }},
    {key:'team',phase:'common',title:'팀·연락망',icon:'user',view:function(el){renderProjectTeamBox(el);},calc:function(D){
      var seen={};D.members.forEach(function(m){seen[m.member_id]=1;});
      var n=Object.keys(seen).length,me=ctx.myPosition&&ctx.myPosition.position_label,rq=D.requests.length;
      return{v:n+'명'+(rq?' · 요청 '+rq:''),d:rq?'참여 요청 '+rq+'건 대기':(me?'내 역할 '+me:''),st:rq?'alert':n>1?'done':'todo'};
    }},
    {key:'files',phase:'common',title:'자료함',icon:'book',view:function(el){el.innerHTML='';},calc:function(D){
      var n=((D.links||{}).files||[]).length;
      return{v:n?'연결 '+n+'개':'비어 있음',d:n?((D.links.files||[]).slice(0,3).map(function(l){return l.label;}).join(' · ')):'대본·악보·도면',st:n?'done':'todo'};
    }},
    {key:'settings',phase:'common',title:'프로젝트 정보',icon:'settings',view:function(el){renderProjectSettings(el);},calc:function(){
      var bits=[pr.troupe_id?nm(pr.troupe_id):'단체 미정',pr.is_public?'공개':'비공개',pr.is_recruiting?'모집 중':''].filter(Boolean);
      return{v:PROJECT_STATUS_LABEL[pr.status]||pr.status,d:bits.join(' · '),st:pr.status==='cancelled'?'off':pr.troupe_id?'done':'doing'};
    }},
    {key:'work',phase:'pre',title:'작품·라이선스',icon:'book',view:function(el){renderProjectWork(el);},calc:function(D){
      var l=pjbLight('work',D);
      if(!pr.work_id)return{v:'작품 미정',d:'작품을 정하면 배역 자리가 생겨요',st:pjbFromLight(l.light)};
      return{v:nm(pr.work_id),d:'라이선스 '+(pr.is_licensed==='완료'?'확보':pr.is_licensed||'미정'),st:pjbFromLight(l.light)};
    }},
    {key:'venue',phase:'pre',title:'공간',icon:'pin',view:function(el){renderProjectVenueTab(el);},calc:function(D){
      var l=pjbLight('venue',D);
      if(pr.venue_id){var v=DB.venues.find(function(x){return x.id===pr.venue_id;}),seats=v&&fld(v,'좌석수');return{v:nm(pr.venue_id),d:(seats?seats+'석 · ':'')+'확정',st:'done'};}
      return{v:D.venueCands.length?'후보 '+D.venueCands.length+'곳':'미정',d:D.venueCands.length?'후보 비교 중':'조건으로 찾아 담기',st:pjbFromLight(l.light)};
    }},
    {key:'budget',phase:'pre',title:'예산',icon:'coin',show:budgetOk,view:function(el){renderProjectBudget(el);},calc:function(D){
      var l=pjbLight('budget',D);
      return{v:l.text&&l.text.indexOf('예산 없음')<0?l.text.replace(/ 사용$/,''):'아직 없음',d:'총 예산 '+(Number(pr.budget_total)?dashWon(Number(pr.budget_total)):'미정'),st:pjbFromLight(l.light)};
    }},
    {key:'actor',phase:'pre',title:'오디션·캐스팅',icon:'mask',view:function(el){renderActorBox(el);},calc:function(D){
      var acts=D.positions.filter(function(p){return p.position_type==='actor';}),f=acts.filter(dashFilled).length,l=pjbLight('casting',D);
      if(!acts.length)return{v:'배역 없음',d:pr.work_id?'배역 자리 만들기':'작품을 정하면 배역이 생겨요',st:pjbFromLight(l.light)};
      var openN=acts.filter(function(p){return p.status==='open'&&!dashFilled(p);}).length;
      var au=D.aud||[],cb=au.filter(function(c){return c.status==='callback';}).length;
      return{v:f+' / '+acts.length+' 확정',d:au.length?'오디션 '+au.length+'명'+(cb?' · 콜백 '+cb:''):(acts.length-f?'빈 배역 '+(acts.length-f):'모두 확정')+(openN?' · 모집 중 '+openN:''),st:pjbFromLight(l.light)};
    }},
    {key:'crew',phase:'pre',title:'제작진',icon:'clapper',view:function(el){el.innerHTML='<div id="crew-tab-body"><div class="hf-loading">불러오는 중…</div></div>';loadProjectPositionsData(pid,renderCrewTabBody);},calc:function(D){
      var st=D.positions.filter(function(p){return p.position_type!=='actor';}),f=st.filter(dashFilled);
      var red=DASH_AREAS.filter(function(a){return a[3]==='staff';}).map(function(a){return dashLight(a,D);}).filter(function(l){return l.light==='red';});
      var names=f.map(function(p){return p.position_label;}).filter(Boolean);
      return{v:f.length?f.length+'명 확정':'아직 없음',d:red.length?red.slice(0,3).map(function(l){return l.label;}).join('·')+' 마감 임박':names.slice(0,3).join(' · ')+(names.length>3?' 외':''),
        st:red.length?'alert':f.length?'doing':'todo'};
    }},
    {key:'schedule',phase:'prod',title:'연습·일정',icon:'calendar',view:function(el){renderProjectScheduleBox(el);},calc:function(D){
      var now=new Date(),up=D.events.filter(function(e){return e.starts_at&&new Date(e.starts_at)>=now;}).sort(function(a,b){return a.starts_at<b.starts_at?-1:1;});
      var l=pjbLight('rehearsal',D),next=up[0]?evDate(new Date(up[0].starts_at))+' '+(EVENT_KIND[up[0].kind]||EVENT_KIND.etc).l:'';
      if(!D.start)return{v:'날짜 미정',d:next?'다음 '+next:'첫 공연 날짜 정하기',st:'todo'};
      var dd=projectDday(D.start,pr.target_end_date,pr.status);
      return{v:dd.big+' · '+pjbMd(D.start),d:next?'다음 '+next+' · 앞으로 '+up.length+'개':'잡힌 일정 없음',st:dd.cls==='soon'&&l.light!=='green'?'alert':pjbFromLight(l.light)};
    }},
    {key:'notices',phase:'prod',title:'공지',icon:'note',view:function(el){el.innerHTML=homeNoticesHtml();loadHomeScheduleBits();},calc:function(D){
      if(!D.notices.length)return{v:'없음',d:'',st:'off'};
      var top=D.notices.slice().sort(function(a,b){return(b.pinned?1:0)-(a.pinned?1:0);})[0];
      return{v:D.notices.length+'개',d:(top.pinned?'고정 · ':'')+String(top.body||'').replace(/\s+/g,' '),st:'done'};
    }},
    {key:'cues',phase:'prod',title:'큐시트',icon:'stage',view:function(el){renderProjectPropsTab(el);},calc:function(D){
      var l=pjbLight('props',D),n=(D.props||[]).length,r=(D.props||[]).filter(function(p){return p.status==='ready';}).length;
      return{v:n?r+' / '+n+' 준비':'목록 없음',d:n?'장면별 큐시트':'',st:pjbFromLight(l.light)};
    }},
    {key:'showweek',phase:'prod',title:'공연 주간',icon:'ticket',view:function(el){renderProjectTasks(el,'showweek');},calc:function(D){
      var t=(D.tasks||[]).filter(function(x){return x.box_key==='showweek';}),d=t.filter(function(x){return x.done;}).length;
      var late=t.filter(function(x){return !x.done&&x.due_date&&dashDaysUntil(x.due_date)<0;}).length;
      if(!t.length)return{v:'체크리스트 없음',d:'콜시트 · 리허설 · 반입',st:'todo'};
      return{v:'체크 '+d+' / '+t.length,d:late?'마감 지남 '+late:'',st:late?'alert':d===t.length?'done':'doing'};
    }},
    {key:'promo',phase:'prod',title:'홍보·티켓',icon:'megaphone',view:function(el){renderProjectPromoTab(el);},calc:function(D){
      var l=pjbLight('promo',D),n=(pr.promo_links||[]).length;
      return{v:n?'링크 '+n+'개':(pr.promo_note?'문구 있음':'아직 없음'),d:pr.promo_note?String(pr.promo_note).replace(/\s+/g,' '):'',st:pjbFromLight(l.light)};
    }},
    {key:'settle',phase:'post',title:'정산',icon:'coin',show:budgetOk,view:function(el){renderProjectSettle(el);},calc:function(D){
      if(D.budget==null)return{v:'',d:'',st:'off'};
      var sum=function(t,k){return D.budget.filter(function(b){return b.item_type===t;}).reduce(function(s,b){return s+(Number(b[k])||0);},0);};
      var out=sum('expense','actual_amount'),inc=sum('income','actual_amount');
      if(!out&&!inc)return{v:'기록 없음',d:'실제 쓴 돈·들어온 돈',st:pr.status==='completed'?'alert':'todo'};
      return{v:(inc-out>=0?'+':'−')+dashWon(Math.abs(inc-out)),d:'지출 '+dashWon(out)+' · 수입 '+dashWon(inc),st:pr.status==='completed'?'done':'doing'};
    }},
    {key:'record',phase:'post',title:'공연 기록',icon:'mask',view:function(el){renderProjectRecord(el);},calc:function(){
      if(pr.published_show_id)return{v:'아카이브에 올라감',d:'출연·스태프 이력 반영',st:'done'};
      return{v:'아직',d:'',st:pr.status==='completed'?'alert':'todo'};
    }},
    {key:'retro',phase:'post',title:'회고',icon:'chat',view:function(el){renderProjectRetro(el);},calc:function(D){
      var n=(D.retro||0);
      return{v:n?n+'개 남김':'아직 없음',d:'잘된 것 · 아쉬운 것 · 다음엔',st:n?'done':pr.status==='completed'?'alert':'off'};
    }},
    {key:'dash',phase:'common',off:true,title:'제작 계기판',icon:'compass',view:function(el){el.innerHTML=dashboardSectionHtml();renderProdDash();},calc:function(D){
      var ls=DASH_AREAS.map(function(a){return dashLight(a,D);}).filter(function(l){return l.light!=='off';});
      var c=function(x){return ls.filter(function(l){return l.light===x;}).length;};
      return{v:c('red')?'확인 필요 '+c('red'):'해결 '+c('green')+' / '+ls.length,d:'진행 '+c('yellow')+' · 시작 전 '+c('gray'),st:c('red')?'alert':c('green')===ls.length?'done':'doing'};
    }}
  ].filter(function(b){return b.show!==false;});
  return list;
}
function pjbResolve(key){return PJB_ALIAS[key]||key;}

/* ── 배치: 사람마다·프로젝트마다 순서와 숨긴 상자 (project_board_layouts) ── */
var _pjbLayout={};
async function pjbLoadLayout(pid){
  if(_pjbLayout[pid])return _pjbLayout[pid];
  var L={order:[],hidden:null};
  try{var r=await sbClient.from('project_board_layouts').select('box_order,hidden').eq('project_id',pid).eq('user_id',CURRENT_USER.id).maybeSingle();
    if(r.data){L.order=r.data.box_order||[];L.hidden=r.data.hidden||[];}}catch(e){}
  _pjbLayout[pid]=L;return L;
}
/* 보이는 상자들(순서대로). 처음 보는 상자는 기본 순서 자리에, off 상자는 처음엔 숨김 */
function pjbVisible(pid){
  var L=_pjbLayout[pid]||{order:[],hidden:null},boxes=projectBoxes();
  var hidden=L.hidden||boxes.filter(function(b){return b.off;}).map(function(b){return b.key;});
  var known=L.order.filter(function(k){return boxes.some(function(b){return b.key===k;});});
  boxes.forEach(function(b,i){if(known.indexOf(b.key)<0){var prev=boxes.slice(0,i).reverse().find(function(x){return known.indexOf(x.key)>-1;});known.splice(prev?known.indexOf(prev.key)+1:0,0,b.key);}});
  return known.filter(function(k){return hidden.indexOf(k)<0;}).map(function(k){return boxes.find(function(b){return b.key===k;});});
}
var _pjbSaveT=null;
function pjbSaveLayout(pid){
  clearTimeout(_pjbSaveT);
  _pjbSaveT=setTimeout(async function(){
    var L=_pjbLayout[pid];if(!L)return;
    var r=await sbClient.from('project_board_layouts').upsert({project_id:pid,user_id:CURRENT_USER.id,box_order:L.order,hidden:L.hidden||[],updated_at:new Date().toISOString()});
    if(r.error)oriAlert('배치를 저장하지 못했어요: '+r.error.message);
  },400);
}

/* ── 보드 ── */
async function loadBoardData(){
  var ctx=window._projectCtx,pid=ctx.pid;
  var q=function(p){return p.then(function(r){return r.error?[]:(r.data||[]);},function(){return[];});};
  var res=await Promise.all([
    loadProdDashData(),
    q(sbClient.from('project_notices').select('body,pinned,created_at').eq('project_id',pid).order('created_at',{ascending:false})),
    ctx.isAdmin?q(sbClient.rpc('list_project_join_requests',{p_project_id:pid})):Promise.resolve([]),
    q(sbClient.from('project_tasks').select('id,box_key,done,due_date,assignee_member_id').eq('project_id',pid)),
    opsLoadLinks(pid,true),
    q(sbClient.from('project_retro_items').select('id').eq('project_id',pid)),
    ctx.isAdmin?q(sbClient.from('audition_candidates').select('status').eq('project_id',pid)):Promise.resolve([])
  ]);
  var D=res[0];D.notices=res[1];D.requests=res[2];D.tasks=res[3];D.links=res[4]||{};D.retro=res[5].length;D.aud=res[6];
  ctx.positions=D.positions;ctx.memberDetail=D.members;ctx.pendingRequests=D.requests.length;
  return D;
}
function pjbBoxInner(b,D){
  var c=D?b.calc(D):{v:'',d:'',st:'todo'};
  var nl=D&&D.links&&b.key!=='files'?(D.links[b.key]||[]).length:0;  // 꽂아 둔 바깥 도구 수
  return {st:c.st,html:'<span class="pjb-top"><span class="pjb-t">'+ico(b.icon)+escHtml(b.title)+(nl?'<span class="pjb-lk" title="연결된 도구 '+nl+'개">'+ico('link')+nl+'</span>':'')+'</span>'+pjbOrb(c.st)+'</span>'
    +'<span class="pjb-v" title="'+escHtml(c.v||'')+'">'+(D?escHtml(c.v):'<span class="hf-loading"></span>')+'</span>'
    +'<span class="pjb-d">'+escHtml(c.d||'')+'</span>'};
}
function pjbBoxHtml(b,D){
  var x=pjbBoxInner(b,D);
  return '<button type="button" class="pjb pjb-'+x.st+(D?'':' pjb-wait')+'" data-box="'+b.key+'" onclick="openProjectBox(\''+b.key+'\')">'+x.html+'</button>';
}
/* 보드: 이름 → 단계 탭(전체·프리·프로덕션·포스트) + 상자 고르기 → 상자들. 상자는 끌어서 순서를 바꾼다 */
async function renderProjectBoard(el){
  var ctx=window._projectCtx,pid=ctx.pid;
  await pjbLoadLayout(pid);
  if(window._projectCtx!==ctx||window._projectBox)return;
  var tab=window._pjbTab||'',all=pjbVisible(pid);
  var boxes=all.filter(function(b){return !tab||b.phase===tab||b.phase==='common';});  // 공통 상자는 어느 단계에서나
  var cols=all.length>15?6:all.length>12?5:4,rows=Math.max(1,Math.ceil(boxes.length/cols));
  var cached=_pjb.data&&_pjb.data.pid===pid?_pjb.data.D:null;  // 다시 그릴 땐 지난 값을 먼저 보여주고 새로 받아 바꾼다
  el.innerHTML='<div class="pjb-stage" style="--cols:'+cols+';--rows:'+rows+';--rows-m:'+Math.max(1,Math.ceil(boxes.length/2))+'">'
    +'<h1 class="pjb-title">'+escHtml(ctx.pr.title||'새 프로젝트')+'</h1>'
    +'<div class="pjb-bar"><div class="pjb-tabs" role="tablist">'+PJB_PHASES.map(function(p){
      var n=p[0]?all.filter(function(b){return b.phase===p[0];}).length:all.length;  // 단계 상자 수 (공통 제외)
      return '<button type="button" role="tab" aria-selected="'+(tab===p[0])+'" class="'+(tab===p[0]?'active':'')+'" onclick="pjbSetTab(\''+p[0]+'\')">'+p[1]+'<span class="pchips-n">'+n+'</span></button>';
    }).join('')+'</div>'
    +'<button type="button" class="pjb-pick-btn" onclick="pjbTogglePicker(event)" aria-haspopup="true">'+ico('settings')+'상자 고르기</button><div class="pjb-picker" id="pjb-picker" hidden></div></div>'
    +'<div class="pjb-board">'+(boxes.length?boxes.map(function(b){return pjbBoxHtml(b,cached);}).join(''):'<div class="pjb-none"><button type="button" class="pf-btn pf-active" onclick="pjbTogglePicker(event)">상자 고르기</button></div>')+'</div></div>';
  pjbDeal(el);pjbDragSetup(el.querySelector('.pjb-board'),pid);
  loadBoardData().then(function(D){
    _pjb.data={pid:pid,D:D};
    if(window._projectCtx!==ctx||window._projectBox||!$('project-tab-content'))return;
    // 펼쳐지는 중에도 끊기지 않게 상자를 새로 만들지 않고 안만 바꾼다
    boxes.forEach(function(b){
      var btn=el.querySelector('.pjb[data-box="'+b.key+'"]');if(!btn)return;
      var x=pjbBoxInner(b,D);btn.className='pjb pjb-'+x.st;btn.innerHTML=x.html;
    });
  });
}
function pjbSetTab(t){window._pjbTab=t;var el=$('project-tab-content');if(el)renderProjectBoard(el);}

/* 상자 고르기: 단계별로 켜고 끄기 + 기본으로 */
function pjbTogglePicker(e){
  if(e)e.stopPropagation();
  var el=$('pjb-picker');if(!el)return;
  if(!el.hidden){el.hidden=true;return;}
  var pid=window._projectCtx.pid,L=_pjbLayout[pid],boxes=projectBoxes(),vis=pjbVisible(pid).map(function(b){return b.key;});
  el.innerHTML=[['common','공통']].concat(PJB_PHASES.slice(1)).map(function(p){
    return '<div class="pjb-pick-g"><div class="pjb-pick-h">'+p[1]+'</div>'+boxes.filter(function(b){return b.phase===p[0];}).map(function(b){
      var on=vis.indexOf(b.key)>-1;
      return '<label class="pjb-pick-i"><input type="checkbox"'+(on?' checked':'')+' onchange="pjbPick(\''+b.key+'\',this.checked)"><span>'+ico(b.icon)+escHtml(b.title)+'</span></label>';
    }).join('')+'</div>';
  }).join('')+'<button type="button" class="pjb-pick-reset" onclick="pjbPickReset()">기본으로</button>';
  el.hidden=false;
}
document.addEventListener('click',function(e){var p=$('pjb-picker');if(p&&!p.hidden&&!e.target.closest('.pjb-picker,.pjb-pick-btn'))p.hidden=true;});
function pjbPick(key,on){
  var pid=window._projectCtx.pid,L=_pjbLayout[pid];
  if(!L.hidden)L.hidden=projectBoxes().filter(function(b){return b.off;}).map(function(b){return b.key;});
  L.order=pjbVisible(pid).map(function(b){return b.key;}).concat(L.hidden);  // 지금 순서를 굳혀 둔다
  L.hidden=L.hidden.filter(function(k){return k!==key;});if(!on)L.hidden.push(key);
  pjbSaveLayout(pid);
  var el=$('project-tab-content');if(el){renderProjectBoard(el).then(function(){pjbTogglePicker();});}
}
function pjbPickReset(){
  var pid=window._projectCtx.pid;_pjbLayout[pid]={order:[],hidden:null};
  pjbSaveLayout(pid);var el=$('project-tab-content');if(el)renderProjectBoard(el);
}

/* 끌어서 순서 바꾸기 (마우스·터치 공용, pointer 이벤트). 살짝 움직이면 끌기, 그냥 누르면 그 상자 화면으로 */
function pjbDragSetup(board,pid){
  if(!board)return;
  var st=null;
  board.addEventListener('pointerdown',function(e){
    if(e.button!==0)return;var b=e.target.closest('.pjb');if(!b)return;
    st={b:b,x:e.clientX,y:e.clientY,id:e.pointerId,drag:false};
  });
  board.addEventListener('pointermove',function(e){
    if(!st||e.pointerId!==st.id)return;
    var b=st.b;
    if(!st.drag){
      if(Math.hypot(e.clientX-st.x,e.clientY-st.y)<8)return;
      st.drag=true;try{b.setPointerCapture(e.pointerId);}catch(x){}
      var r=b.getBoundingClientRect();st.gx=st.x-r.left;st.gy=st.y-r.top;
      b.style.transition='none';b.classList.add('pjb-dragging');board.classList.add('pjb-sorting');
    }
    e.preventDefault();
    // 미끄러지는 중인 상자의 겉보기 자리가 아니라 실제 자리(offset)로 판정해야 왔다 갔다 하지 않는다
    var bb=board.getBoundingClientRect(),px=e.clientX-bb.left,py=e.clientY-bb.top;
    var over=[].slice.call(board.querySelectorAll('.pjb:not(.pjb-dragging)')).find(function(o){return px>=o.offsetLeft&&px<=o.offsetLeft+o.offsetWidth&&py>=o.offsetTop&&py<=o.offsetTop+o.offsetHeight;});
    if(over){
      var kids=[].slice.call(board.children),from=kids.indexOf(b),to=kids.indexOf(over);
      if(from!==to)pjbFlip(board,b,function(){if(from<to)over.after(b);else over.before(b);});
    }
    var br=board.getBoundingClientRect();
    b.style.transform='translate('+(e.clientX-st.gx-br.left-b.offsetLeft)+'px,'+(e.clientY-st.gy-br.top-b.offsetTop)+'px) scale(1.04)';
  });
  var end=function(e){
    if(!st||e.pointerId!==st.id)return;
    var b=st.b,dragged=st.drag;st=null;
    if(!dragged)return;
    b.classList.remove('pjb-dragging');board.classList.remove('pjb-sorting');
    b.style.transition='transform .22s cubic-bezier(.2,.8,.2,1)';b.style.transform='';
    setTimeout(function(){b.style.transition='';},240);
    board._skipClick=true;setTimeout(function(){board._skipClick=false;},50);
    // 보이는 상자의 새 순서를 전체 순서에 끼워 넣는다 (다른 단계·숨긴 상자의 자리는 그대로)
    var keys=[].slice.call(board.querySelectorAll('.pjb')).map(function(x){return x.dataset.box;});
    var L=_pjbLayout[pid],full=pjbVisible(pid).map(function(x){return x.key;}),hidden=L.hidden||projectBoxes().filter(function(x){return x.off;}).map(function(x){return x.key;});
    var i=0;full=full.map(function(k){return keys.indexOf(k)>-1?keys[i++]:k;});
    L.order=full.concat(hidden.filter(function(k){return full.indexOf(k)<0;}));L.hidden=hidden;
    pjbSaveLayout(pid);
  };
  board.addEventListener('pointerup',end);board.addEventListener('pointercancel',end);
  board.addEventListener('click',function(e){if(board._skipClick){e.stopPropagation();e.preventDefault();}},true);
}
/* 다른 상자들은 새 자리로 미끄러진다 (FLIP) */
function pjbFlip(board,dragged,mutate){
  var others=[].slice.call(board.querySelectorAll('.pjb')).filter(function(x){return x!==dragged;});
  var before=others.map(function(x){return x.getBoundingClientRect();});
  mutate();
  others.forEach(function(x,i){
    var a=x.getBoundingClientRect(),dx=before[i].left-a.left,dy=before[i].top-a.top;
    if(!dx&&!dy)return;
    x.style.transition='none';x.style.transform='translate('+dx+'px,'+dy+'px)';
    void x.offsetWidth;
    x.style.transition='transform .22s cubic-bezier(.2,.8,.2,1)';x.style.transform='';
  });
}
function pjbDeal(el){
  if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  var board=el.querySelector('.pjb-board'),list=[].slice.call(el.querySelectorAll('.pjb'));if(!board||!list.length)return;
  var br=board.getBoundingClientRect(),cx=br.left+br.width/2,cy=br.top+br.height/2;
  list.forEach(function(b,i){
    var r=b.getBoundingClientRect(),rot=((i*37)%13-6)*1.2;
    b.style.transition='none';b.style.opacity='0';
    b.style.transform='translate('+(cx-r.left-r.width/2)+'px,'+(cy-r.top-r.height/2)+'px) rotate('+rot+'deg) scale(0.55)';
  });
  void board.offsetWidth;
  list.forEach(function(b,i){
    b.style.transition='transform .62s cubic-bezier(.18,.9,.22,1.06) '+(i*42)+'ms, opacity .22s ease '+(i*42)+'ms';
    b.style.opacity='';b.style.transform='';
  });
  // 끝나면 인라인 값을 지워 평소의 눌림·떠오름 반응이 돌아오게
  setTimeout(function(){list.forEach(function(b){if(!b.classList.contains('pjb-dragging')){b.style.transition='';}});},620+list.length*42);
}

/* ── 합친 상자들의 화면 ── */
/* 작품·라이선스: 지금 작품과 라이선스, 바꾸기·라이선스 신청 */
function renderProjectWork(el){
  var ctx=window._projectCtx,pr=ctx.pr,pid=ctx.pid,admin=ctx.isAdmin,w=pr.work_id;
  var lic=pr.is_licensed==='완료'?'확보':pr.is_licensed||'미정';
  var roles=w?DB.roles.filter(function(r){return ids(fld(r,'작품')).indexOf(w)>-1;}).length:0;
  var h='<section class="dv-sec"><dl class="dv-facts ph-facts">'
    +'<div class="dv-fact"><dt>작품</dt><dd>'+(w?dvLink('work',w,nm(w)):'<span class="ph-none">미정</span>')+(admin?' <button type="button" class="ph-edit" onclick="openProjectWizard(\''+pid+'\',[\'work\'])">'+(w?'바꾸기':'정하기')+'</button>':'')+'</dd></div>'
    +'<div class="dv-fact"><dt>라이선스</dt><dd>'+escHtml(lic)+(admin?' <button type="button" class="ph-edit" onclick="openProjectWizard(\''+pid+'\',[\'license\'])">변경</button>':'')+'</dd></div>'
    +(roles?'<div class="dv-fact"><dt>등장인물</dt><dd>'+roles+'명</dd></div>':'')
    +'</dl></section>';
  if(w&&lic!=='확보'&&lic!=='창작')h+='<section class="dv-sec"><div class="wd-cta"><b>〈'+escHtml(nm(w))+'〉 라이선스</b><button type="button" class="pf-btn pf-active" onclick="goLicense(\''+w+'\')">라이선스 신청</button></div></section>';
  if(!w&&admin)h+='<section class="dv-sec" id="pw-recs"><div class="hf-loading">추천을 찾는 중…</div></section>';
  el.innerHTML=h;
  if(!w&&admin)loadProdDashData().then(function(D){return dashWorkRecs(D);}).then(function(x){var r=$('pw-recs');if(r)r.innerHTML=x||'';});
}
/* 일정: 첫 공연 날짜 띠 + 일정·공지 화면 */
function renderProjectScheduleBox(el){
  var ctx=window._projectCtx,pr=ctx.pr,pid=ctx.pid;
  var dd=projectDday(pr.target_start_date,pr.target_end_date,pr.status);
  var dates=pr.target_start_date?String(pr.target_start_date).replace(/-/g,'.')+(pr.target_end_date&&pr.target_end_date!==pr.target_start_date?' ~ '+String(pr.target_end_date).slice(5).replace('-','.'):''):'날짜 미정';
  el.innerHTML='<div class="pj-dateband"><span class="pj-dateband-d">'+escHtml(dd.big)+'</span><span class="pj-dateband-s">첫 공연 '+escHtml(dates)+'</span>'
    +(ctx.isAdmin?'<button type="button" class="ph-edit" onclick="openProjectWizard(\''+pid+'\',[\'date\'])">날짜 바꾸기</button>':'')
    +'<button type="button" class="ph-edit pj-ics" onclick="opsExportIcs()">'+ico('calendar')+'캘린더로 내보내기</button></div><div id="pj-sched-body"></div>';
  renderProjectSchedule($('pj-sched-body'));
}
/* 팀: 참여 요청(관리자) + 팀원 */
function renderProjectTeamBox(el){
  var ctx=window._projectCtx,pid=ctx.pid;
  window._teamSubTab='people';
  el.innerHTML=(ctx.isAdmin?'<section class="dv-sec">'+dvSection('참여 요청')+'<div id="join-requests-list"><div class="hf-loading">불러오는 중…</div></div></section>':'')
    +'<section class="dv-sec">'+dvSection('팀원')+'<div id="team-subtab-body"><div class="hf-loading">불러오는 중…</div></div></section>';
  if(ctx.isAdmin)loadJoinRequests(pid);
  loadProjectPositionsData(pid,renderTeamSubTabBody);
}
/* 예전 "사람" 탭 배지 자리 — 이제 보드의 참여 요청 상자가 말해 준다 */
function updatePeopleTabBadge(){}

/* 예전 탭 하위 메뉴를 부르던 곳(계기판 버튼 등)은 상자로 바로 */
function openPeopleSub(sub){window._peopleSub=sub;openProjectBox(sub);}
function openPrepSub(sub){window._prepSub=sub;openProjectBox(sub);}

/* ── 프로젝트 정보 상자 안: 단계 · 상태 · 공연 정보 · 공개 설정 ── */
function renderProjectSettings(el){
  var ctx=window._projectCtx,pr=ctx.pr,pid=ctx.pid,isAdmin=ctx.isAdmin;
  var stage=projectStageIndex(pr);
  var editBtn=function(step){return isAdmin?' <button type="button" class="ph-edit" onclick="openProjectWizard(\''+pid+'\',[\''+step+'\'])">변경</button>':'';};
  var empty='<span class="ph-none">미정</span>';
  var dates=pr.target_start_date?(pr.target_start_date+(pr.target_end_date&&pr.target_end_date!==pr.target_start_date?' ~ '+pr.target_end_date:'')):'';
  var statusH=isAdmin
    ?'<select class="ph-select" onchange="updateProjectStatus(\''+pid+'\',this.value)">'+Object.keys(PROJECT_STATUS_LABEL).map(function(k){return '<option value="'+k+'"'+(pr.status===k?' selected':'')+'>'+PROJECT_STATUS_LABEL[k]+'</option>';}).join('')+'</select>'
    :escHtml(PROJECT_STATUS_LABEL[pr.status]||pr.status);
  var h='<ol class="ph-stages">'+PROJECT_STAGES.map(function(s,i){
    return '<li class="ph-stage'+(i<stage?' done':'')+(i===stage?' now':'')+'"><span class="ph-stage-dot"></span><span>'+s+'</span></li>';
  }).join('')+'</ol>';
  h+='<section class="dv-sec">'+dvSection('공연 정보')+'<dl class="dv-facts ph-facts">'
    +'<div class="dv-fact"><dt>이름</dt><dd>'+escHtml(pr.title||'새 프로젝트')+(isAdmin?' <button type="button" class="ph-edit" onclick="editProjectTitle(\''+pid+'\')">변경</button>':'')+'</dd></div>'
    +'<div class="dv-fact"><dt>상태</dt><dd>'+statusH+'</dd></div>'
    +'<div class="dv-fact"><dt>작품</dt><dd>'+(pr.work_id?dvLink('work',pr.work_id,nm(pr.work_id)):empty)+editBtn('work')+'</dd></div>'
    +'<div class="dv-fact"><dt>단체</dt><dd>'+(pr.troupe_id?dvLink('troupe',pr.troupe_id,nm(pr.troupe_id)):empty)+editBtn('troupe')+'</dd></div>'
    +'<div class="dv-fact"><dt>극장</dt><dd>'+(pr.venue_id?dvLink('venue',pr.venue_id,nm(pr.venue_id)):empty)+(isAdmin?' <button type="button" class="ph-edit" onclick="openProjectBox(\'venue\')">찾기</button>':'')+'</dd></div>'
    +'<div class="dv-fact"><dt>날짜</dt><dd>'+(dates?escHtml(dates):empty)+editBtn('date')+'</dd></div>'
    +'<div class="dv-fact"><dt>라이선스</dt><dd>'+(pr.is_licensed?escHtml(pr.is_licensed):empty)+editBtn('license')+'</dd></div>'
    +'</dl></section>';
  if(pr.published_show_id)h+='<section class="dv-sec"><div class="ph-published">이 공연은 아카이브에 올라가 있어요. <span class="link" data-action="show" data-id="'+pr.published_show_id+'">공연 페이지 보기 →</span></div></section>';
  if(isAdmin){
    h+='<section class="dv-sec">'+dvSection('공개 설정')+'<div class="ph-settings">'
      +(ctx.isOwner?'<label class="ph-switch"><input type="checkbox" '+(pr.is_public?'checked':'')+' onchange="toggleProjectPublic(\''+pid+'\',this.checked)"><span><b>프로젝트 공개</b><br>둘러보기의 "기회"에서 누구나 이 프로젝트를 볼 수 있어요</span></label>':'')
      +'<label class="ph-switch"><input type="checkbox" '+(pr.is_recruiting?'checked':'')+' onchange="toggleRecruiting(\''+pid+'\',this.checked)"><span><b>빈 자리 모집</b><br>비어 있는 배역·제작진 자리를 기회 목록에 올려요</span></label>'
      +(ctx.isOwner?'<label class="ph-switch"><input type="checkbox" '+(pr.budget_visible_to_members?'checked':'')+' onchange="toggleBudgetVisible(\''+pid+'\',this.checked)"><span><b>예산 함께 보기</b><br>관리자가 아닌 팀원도 예산 상자를 볼 수 있어요</span></label>':'')
      +'</div></section>';
  }
  el.innerHTML=h;
}
