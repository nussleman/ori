/* 오리 사이트 — 프로젝트 제작 계기판
   제작의 모든 영역(작품·극장·캐스팅·연출·조명·음향 …)을 한눈에: 초록 해결 / 노랑 진행 중 / 빨강 확인 필요.
   - 상태는 프로젝트 데이터로 자동 판정한다(자리 확정 여부, 극장 후보, 연습 일정, 예산 등). 관리자가 직접 정하면 그 값이 이긴다(project_areas).
   - 빨강·노랑의 기준은 "첫 공연 날짜 − 영역별 준비 기간(DASH_AREAS의 D-일수)". 마감이 지났거나 가까운데 비어 있으면 빨강.
   - 영역을 누르면 아래에 자세히: 할 일 안내, 상태 직접 정하기·메모, 그리고 데이터 기반 추천(해본 사람, 이 배역을 해본·해보고 싶은 사람, 비슷한 단체가 쓴 극장, 비슷한 프로젝트의 비용).
   - 금액 추천은 budget_benchmarks()가 3개 이상 프로젝트의 기록이 모인 분류만 돌려줄 때만 보인다. 없으면 솔직하게 "아직 부족해요". */

/* [키, 이름, 준비 기간(첫 공연 며칠 전까지), 판정 방식, 스텝 역할 이름(부분 일치), 예산 분류, 안내] */
var DASH_AREAS=[
  ['work','작품·라이선스',120,'work',null,null,'무엇을 올릴지, 라이선스가 해결됐는지'],
  ['director','연출',90,'staff',['연출'],null,'연출이 정해져야 나머지 제작진·일정이 굴러가요'],
  ['venue','극장',60,'venue',null,'대관','날짜·좌석 수·대관료를 비교해 계약까지'],
  ['music','음악감독',60,'staff',['음악'],null,'음원·MR·반주 방식(라이브/MR)'],
  ['rehearsal','연습',60,'rehearsal',null,null,'연습실과 주간 연습 일정'],
  ['budget','예산',60,'budget',null,null,'수입(티켓·후원)과 지출 계획'],
  ['casting','캐스팅',45,'casting',null,null,'모든 배역에 배우 확정 (더블 포함)'],
  ['choreo','안무',45,'staff',['안무'],null,'넘버별 안무 담당'],
  ['lighting','조명',30,'staff',['조명'],'조명/음향','디자이너·오퍼레이터, 극장 기본 조명으로 충분한지'],
  ['sound','음향',30,'staff',['음향'],'조명/음향','오퍼레이터, 마이크 수량·장비 대여'],
  ['stage','무대',30,'staff',['무대','미술'],'무대/미술','세트 디자인·제작·반입 일정'],
  ['promo','홍보',30,'promo',['홍보'],'홍보','포스터·SNS·보도자료'],
  ['costume','의상',21,'staff',['의상'],'의상/분장','배역별 의상 제작·대여'],
  ['props','소품',21,'staff',['소품'],'무대/미술','소품 목록과 준비 담당'],
  ['ticket','티켓',21,'manual',null,'티켓팅','예매처·가격·좌석 운영'],
  ['makeup','분장',14,'staff',['분장','메이크업'],'의상/분장','분장·헤어 담당과 분장품'],
  ['photo','촬영',14,'staff',['촬영','사진','영상'],'홍보','공연 사진·영상 기록 담당']
];
var DASH_STATUS_LABEL={done:'해결',doing:'진행 중',todo:'시작 전',off:'해당 없음'};
var _dash={open:null,data:null};

function dashArea(key){return DASH_AREAS.find(function(a){return a[0]===key;});}
function dashDaysUntil(dateStr){if(!dateStr)return null;var t=new Date();t.setHours(0,0,0,0);return Math.round((new Date(String(dateStr).slice(0,10)+'T00:00:00')-t)/86400000);}
function dashDueDate(start,days){var d=new Date(String(start).slice(0,10)+'T00:00:00');d.setDate(d.getDate()-days);return (d.getMonth()+1)+'.'+d.getDate();}
function dashStaffRoleIds(patterns){
  return DB.staffRoles.filter(function(s){var n=fld(s,'Name')||'';return patterns.some(function(p){return n.indexOf(p)>-1&&!(p==='연출'&&n.indexOf('조연출')>-1);});}).map(function(s){return s.id;});
}
function dashPositionsFor(a,positions){
  if(!a[4])return[];
  var ids=dashStaffRoleIds(a[4]);
  return positions.filter(function(p){
    if(p.position_type==='staff'&&ids.indexOf(p.staff_role_id)>-1)return true;
    var lb=p.position_label||'';
    return p.position_type!=='actor'&&a[4].some(function(k){return lb.indexOf(k)>-1&&!(k==='연출'&&lb.indexOf('조연출')>-1);});
  });
}
function dashFilled(p){return !!(p.assigned_member_id||p.status==='filled');}

/* ── 자동 판정 ── */
function dashAuto(a,D){
  var pr=D.pr,kind=a[3];
  if(kind==='work'){
    if(pr.work_id&&(pr.is_licensed==='창작'||pr.is_licensed==='완료'))return{s:'done',t:nm(pr.work_id)+' · '+pr.is_licensed};
    if(pr.work_id)return{s:'doing',t:nm(pr.work_id)+' · 라이선스 '+(pr.is_licensed||'미정')};
    return{s:'todo',t:'작품 미정'};
  }
  if(kind==='venue'){
    if(pr.venue_id)return{s:'done',t:nm(pr.venue_id)||'확정'};
    if(D.venueCands.length)return{s:'doing',t:'후보 '+D.venueCands.length+'곳 비교 중'};
    return{s:'todo',t:'미정'};
  }
  if(kind==='casting'){
    var acts=D.positions.filter(function(p){return p.position_type==='actor';});
    if(!acts.length)return{s:'todo',t:pr.work_id?'배역 자리가 없어요':'작품을 먼저 정해요'};
    var f=acts.filter(dashFilled).length;
    if(f===acts.length)return{s:'done',t:'배역 '+acts.length+'개 모두 확정'};
    return{s:f?'doing':'todo',t:'배역 '+acts.length+' 중 '+f+' 확정'};
  }
  if(kind==='rehearsal'){
    var reh=D.events.filter(function(e){return e.kind==='rehearsal';}).length;
    if(reh)return{s:'done',t:'연습 '+reh+'회 잡힘'};
    return D.events.length?{s:'doing',t:'일정 '+D.events.length+'개 · 연습은 아직'}:{s:'todo',t:'연습 일정 없음'};
  }
  if(kind==='budget'){
    if(D.budget==null)return{s:'todo',t:'예산은 관리자만 봐요'};
    var exp=D.budget.filter(function(b){return b.item_type==='expense';});
    var planned=exp.reduce(function(s,b){return s+(Number(b.planned_amount)||0);},0);
    if(planned>0)return{s:'done',t:'지출 계획 '+dashWon(planned)};
    return D.budget.length?{s:'doing',t:'항목만 있고 금액 없음'}:{s:'todo',t:'예산 없음'};
  }
  if(kind==='staff'||kind==='promo'){
    var ps=dashPositionsFor(a,D.positions);
    var filled=ps.filter(dashFilled);
    if(kind==='promo'&&(pr.promo_links||[]).length)return{s:'done',t:'홍보 링크 '+pr.promo_links.length+'개'};
    if(filled.length)return{s:'done',t:filled.map(function(p){return dashMemberName(p,D);}).filter(Boolean).join(', ')||'확정'};
    if(ps.length)return{s:'doing',t:'자리 있음 · '+(pr.is_recruiting?'모집 중':'미확정')};
    if(kind==='promo'&&pr.promo_note)return{s:'doing',t:'계획 메모 있음'};
    return{s:'todo',t:'담당 미정'};
  }
  return{s:'todo',t:'직접 체크해요'};
}
function dashMemberName(p,D){
  var m=(D.members||[]).find(function(x){return x.member_id===p.assigned_member_id;});
  return m?((m.person_id&&nm(m.person_id))||m.nickname||''):'';
}
function dashWon(n){n=Math.round(n);return n>=10000?(Math.round(n/1000)/10)+'만원':n.toLocaleString()+'원';}

/* ── 불빛: 상태 + 마감 ── */
function dashLight(a,D){
  var man=D.areas[a[0]],auto=dashAuto(a,D);
  var s=(man&&man.status)||auto.s;
  var r={key:a[0],label:a[1],status:s,text:auto.t,manual:!!(man&&man.status),note:man&&man.note};
  if(s==='off'){r.light='off';return r;}
  if(s==='done'){r.light='green';return r;}
  var start=D.start;
  if(!start){r.light=s==='doing'?'yellow':'gray';r.due='';return r;}
  var left=dashDaysUntil(start)-a[2];  // 이 영역 마감까지 남은 날
  r.due=dashDueDate(start,a[2])+'까지';
  if(left<0){r.light='red';r.why='마감 '+(-left)+'일 지남';}
  else if(s==='doing'){r.light=left<=7?'red':'yellow';r.why=left<=7?'마감 '+left+'일 남음':'';}
  else{r.light=left<=14?'red':'gray';r.why=left<=14?'마감 '+left+'일 남음':left+'일 뒤까지 여유';}
  return r;
}

/* ── 데이터 불러오기 ── */
async function loadProdDashData(){
  var ctx=window._projectCtx,pid=ctx.pid;
  var q=function(p){return p.then(function(r){return r.error?[]:(r.data||[]);},function(){return[];});};
  var res=await Promise.all([
    q(sbClient.from('project_positions').select('*').eq('project_id',pid)),
    q(sbClient.from('project_areas').select('*').eq('project_id',pid)),
    q(sbClient.from('project_venue_candidates').select('venue_id,status').eq('project_id',pid)),
    q(sbClient.from('project_events').select('kind,starts_at').eq('project_id',pid)),
    q(sbClient.rpc('list_project_members_detail',{p_project_id:pid})),
    ctx.isAdmin||ctx.pr.budget_visible_to_members?q(sbClient.from('project_budget_items').select('item_type,category,planned_amount,actual_amount').eq('project_id',pid)):Promise.resolve(null)
  ]);
  var areas={};res[1].forEach(function(a){areas[a.area_key]=a;});
  // 첫 공연 날짜: 전광판(D-day)과 같은 기준 — 앞으로 있을 '공연' 일정이 있으면 그 날, 없으면 프로젝트 목표일
  var now=new Date(),perf=res[3].filter(function(e){return e.kind==='performance'&&e.starts_at&&new Date(e.starts_at)>=now;}).sort(function(a,b){return a.starts_at<b.starts_at?-1:1;})[0];
  var start=ctx.pr.target_start_date;
  if(perf){var d=new Date(perf.starts_at);start=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
  return{pr:ctx.pr,start:start,positions:res[0],areas:areas,venueCands:res[2],events:res[3],members:res[4],budget:res[5]};
}

/* ── 그리기 ── */
function dashboardSectionHtml(){return '<section class="dv-sec dash-sec" id="ph-dash"><div class="hf-loading">계기판 켜는 중…</div></section>';}
async function renderProdDash(){
  var el=$('ph-dash');if(!el)return;
  var ctx=window._projectCtx;
  var D=await loadProdDashData();
  if(window._projectCtx!==ctx||!$('ph-dash'))return;
  if(_dash.pid!==ctx.pid){_dash.pid=ctx.pid;_dash.open=null;}  // 다른 프로젝트로 오면 펼침을 닫는다
  _dash.data=D;
  var lights=DASH_AREAS.map(function(a){return dashLight(a,D);});
  var on=lights.filter(function(l){return l.light!=='off';}),off=lights.filter(function(l){return l.light==='off';});
  var cnt=function(c){return on.filter(function(l){return l.light===c;}).length;};
  var h='<div class="dash-head"><h2 class="dv-h">제작 계기판</h2>'
    +'<div class="dash-sum"><span class="dash-dot green"></span>해결 <b>'+cnt('green')+'</b><span class="dash-dot yellow"></span>진행 중 <b>'+cnt('yellow')+'</b><span class="dash-dot red"></span>확인 필요 <b>'+cnt('red')+'</b>'+(cnt('gray')?'<span class="dash-dot gray"></span>시작 전 <b>'+cnt('gray')+'</b>':'')+'</div></div>'
    +(D.start?'':'<div class="dash-warn">첫 공연 날짜를 정하면 영역마다 언제까지 해결해야 하는지 계산해 빨간불·노란불을 켜드려요. '+(ctx.isAdmin?'<button type="button" class="ph-edit" onclick="openProjectWizard(\''+ctx.pid+'\',[\'date\'])">날짜 정하기</button>':'')+'</div>')
    +'<div class="dash-grid">'+on.concat(off).map(function(l){
      return '<button type="button" class="dash-tile '+l.light+(_dash.open===l.key?' open':'')+'" onclick="dashToggle(\''+l.key+'\')">'
        +'<span class="dash-tile-h"><span class="dash-dot '+l.light+'"></span>'+l.label+(l.manual?'<span class="dash-man" title="직접 정한 상태">✎</span>':'')+'</span>'
        +'<span class="dash-tile-s">'+escHtml(l.light==='off'?'해당 없음':l.text)+'</span>'
        +(l.why||l.due?'<span class="dash-tile-d'+(l.light==='red'?' hot':'')+'">'+escHtml(l.why&&l.light==='red'?l.why:(l.due||''))+'</span>':'')
        +'</button>';
    }).join('')+'</div><div id="dash-detail"></div>';
  el.innerHTML=h;
  if(_dash.open)dashRenderDetail(_dash.open);
}
function dashToggle(key){
  _dash.open=_dash.open===key?null:key;
  document.querySelectorAll('.dash-tile').forEach(function(b){b.classList.toggle('open',b.getAttribute('onclick').indexOf("'"+_dash.open+"'")>-1);});
  var el=$('dash-detail');if(!el)return;
  if(!_dash.open){el.innerHTML='';return;}
  dashRenderDetail(_dash.open);
  el.scrollIntoView({behavior:'smooth',block:'nearest'});
}
function dashRenderDetail(key){
  var el=$('dash-detail'),D=_dash.data;if(!el||!D)return;
  var a=dashArea(key),l=dashLight(a,D),ctx=window._projectCtx,admin=ctx.isAdmin;
  var man=D.areas[key]||{};
  var h='<div class="dash-detail '+l.light+'"><div class="dash-dh"><span class="dash-dot '+l.light+'"></span><b>'+a[1]+'</b>'
    +'<span class="dash-dh-s">'+escHtml(l.light==='off'?'해당 없음':l.text)+(l.due?' · '+l.due:'')+(l.why?' · '+l.why:'')+'</span>'
    +'<button type="button" class="dash-x" onclick="dashToggle(\''+key+'\')" title="닫기">✕</button></div>'
    +'<p class="dash-hint">'+escHtml(a[6])+'</p>';
  if(admin){
    h+='<div class="dash-man-row"><span class="dash-lbl">상태</span><div class="dash-seg">'
      +[['','자동'],['done','해결'],['doing','진행 중'],['todo','시작 전'],['off','해당 없음']].map(function(o){
        return '<button type="button" class="'+((man.status||'')===o[0]?'on':'')+'" onclick="dashSetStatus(\''+key+'\',\''+o[0]+'\')">'+o[1]+'</button>';
      }).join('')+'</div></div>'
      +'<div class="dash-man-row"><span class="dash-lbl">메모</span><input class="dash-note" value="'+escHtml(man.note||'')+'" placeholder="진행 상황, 연락처, 결정한 것" onchange="dashSaveNote(\''+key+'\',this.value)"></div>';
  }else if(man.note)h+='<p class="dash-hint">메모: '+escHtml(man.note)+'</p>';
  h+=dashActionsHtml(a,D);
  h+=(l.light==='green'||l.light==='off')?'':'<div class="dash-recs" id="dash-recs"><div class="hf-loading">추천을 찾는 중…</div></div>';
  h+='</div>';
  el.innerHTML=h;
  if(l.light!=='green'&&l.light!=='off')dashRecs(a,D).then(function(html){var r=$('dash-recs');if(r&&_dash.open===key)r.innerHTML=html;});
}
function dashActionsHtml(a,D){
  if(!window._projectCtx.isAdmin)return '';
  var pid=window._projectCtx.pid,b=function(label,go){return '<button type="button" class="ph-todo-btn" onclick="'+go+'">'+label+'</button>';};
  var k=a[3],acts=[];
  if(k==='work')acts.push(b(D.pr.work_id?'라이선스 정하기':'작품 정하기','openProjectWizard(\''+pid+'\',[\''+(D.pr.work_id?'license':'work')+'\'])'));
  if(k==='venue')acts.push(b('극장 후보 보기','openPrepSub(\'venue\')'));
  if(k==='casting')acts.push(b('배역 자리 보기','openPeopleSub(\'actor\')'));
  if(k==='staff'||k==='promo')acts.push(b('제작진 자리 보기','openPeopleSub(\'crew\')'));
  if(k==='promo')acts.push(b('홍보 준비','openPrepSub(\'promo\')'));
  if(k==='rehearsal')acts.push(b('연습 일정 추가','window._evFormOpen=true;switchProjectTab(\'schedule\')'));
  if(k==='budget')acts.push(b('예산 열기','switchProjectTab(\'budget\')'));
  return acts.length?'<div class="dash-acts">'+acts.join('')+'</div>':'';
}

/* ══ 추천 (데이터 기반) ══ */
async function dashRecs(a,D){
  var k=a[3],out='';
  try{
    if(k==='staff'||k==='promo')out+=dashStaffRecs(a,D);
    if(k==='casting')out+=await dashCastingRecs(D);
    if(k==='venue')out+=dashVenueRecs(D);
    if(k==='work')out+=D.pr.work_id?dashLicenseTip(D):await dashWorkRecs(D);
    if(a[5]||k==='budget')out+=await dashCostRecs(a,D);
  }catch(e){out+='<p class="dash-hint">추천을 불러오지 못했어요.</p>';}
  return out||'<p class="dash-hint">이 영역은 아직 추천할 데이터가 없어요. 위의 상태·메모로 직접 챙겨주세요.</p>';
}
function dashRecBlock(title,basis,rows){
  if(!rows.length)return '';
  return '<div class="dash-rec"><div class="dash-rec-h">'+title+'<span class="dash-basis">'+basis+'</span></div>'+rows.join('')+'</div>';
}
function dashRecRow(main,sub,btn){
  return '<div class="dash-rec-row"><div class="dash-rec-m">'+main+(sub?'<span class="dash-rec-s">'+sub+'</span>':'')+'</div>'+(btn||'')+'</div>';
}
function dashProjectPeople(D){var s={};(D.members||[]).forEach(function(m){if(m.person_id)s[m.person_id]=true;});return s;}
function dashTroupeOf(showId){var s=DB.shows.find(function(x){return x.id===showId;});return s?{t:ids(fld(s,'극단'))[0],v:ids(fld(s,'극장'))[0],y:yearOf(fld(s,'공연 날짜')||'')}:{};}

/* 스태프: 이 역할을 해본 사람. 같은 단체·같은 극장·최근 경험에 가산점 */
function dashStaffRecs(a,D){
  var roleIds=dashStaffRoleIds(a[4]);if(!roleIds.length)return '';
  var inProj=dashProjectPeople(D),pr=D.pr,thisYear=new Date().getFullYear();
  var score={};
  DB.history.forEach(function(h){
    if(tname(h)!=='스텝')return;
    if(!ids(fld(h,'스텝')).some(function(r){return roleIds.indexOf(r)>-1;}))return;
    var pid=ids(fld(h,'참여자'))[0];if(!pid||inProj[pid])return;
    var sh=dashTroupeOf(ids(fld(h,'공연'))[0]);
    var e=score[pid]=score[pid]||{n:0,troupe:0,venue:0,last:0};
    e.n++;if(pr.troupe_id&&sh.t===pr.troupe_id)e.troupe++;if(pr.venue_id&&sh.v===pr.venue_id)e.venue++;if(sh.y)e.last=Math.max(e.last,+sh.y);
  });
  var list=Object.keys(score).map(function(pid){var e=score[pid];return{pid:pid,e:e,s:e.n*2+e.troupe*3+e.venue*2+(e.last>=thisYear-2?1:0)};})
    .sort(function(x,y){return y.s-x.s;}).slice(0,5);
  var label=a[1];
  return dashRecBlock(label+'을(를) 해본 사람','오리에 기록된 '+label+' 참여 이력 기준',list.map(function(x){
    var why=[label+' '+x.e.n+'회'];
    if(x.e.troupe)why.push(nm(pr.troupe_id)+'와 작업');
    if(x.e.venue)why.push(nm(pr.venue_id)+' 경험');
    if(x.e.last)why.push('최근 '+x.e.last);
    return dashRecRow('<span class="link" data-action="person" data-id="'+x.pid+'">'+escHtml(nm(x.pid))+'</span>',escHtml(why.join(' · ')),
      window._projectCtx.isAdmin?'<button type="button" class="dash-btn" onclick="dashInvite(\''+a[0]+'\',\''+x.pid+'\')">초대</button>':'');
  }));
}

/* 캐스팅: 빈 배역마다 — 이 배역을 해본 사람, 해보고 싶다고 한 사람 */
async function dashCastingRecs(D){
  var open=D.positions.filter(function(p){return p.position_type==='actor'&&!dashFilled(p)&&p.role_id;});
  if(!open.length)return '';
  var inProj=dashProjectPeople(D);
  var roleIds=open.map(function(p){return p.role_id;}).filter(function(v,i,s){return s.indexOf(v)===i;});
  var wish={};
  var w=await sbClient.rpc('role_wishlist_people',{p_role_ids:roleIds});
  (w.data||[]).forEach(function(r){(wish[r.role_id]=wish[r.role_id]||[]).push(r.person_id);});
  var blocks=roleIds.slice(0,6).map(function(rid){
    var pos=open.find(function(p){return p.role_id===rid;});
    var done={},rows=[];
    DB.history.forEach(function(h){
      if(tname(h)!=='배우'||ids(fld(h,'배역')).indexOf(rid)===-1)return;
      var pid=ids(fld(h,'참여자'))[0];if(!pid||inProj[pid]||done[pid])return;done[pid]=true;
      rows.push({pid:pid,why:'이 배역을 해봤어요 · '+(nm(ids(fld(h,'공연'))[0])||'')});
    });
    (wish[rid]||[]).forEach(function(pid){if(inProj[pid]||done[pid])return;done[pid]=true;rows.push({pid:pid,why:'이 배역을 해보고 싶다고 했어요'});});
    if(!rows.length)return '';
    return '<div class="dash-role"><div class="dash-role-n">'+escHtml(nm(rid)||pos.position_label||'배역')+'</div>'+rows.slice(0,3).map(function(x){
      return dashRecRow('<span class="link" data-action="person" data-id="'+x.pid+'">'+escHtml(nm(x.pid))+'</span>',escHtml(x.why),
        window._projectCtx.isAdmin?'<button type="button" class="dash-btn" onclick="dashInviteTo(\''+pos.id+'\',\''+x.pid+'\')">초대</button>':'');
    }).join('')+'</div>';
  }).filter(Boolean);
  if(!blocks.length)return '<p class="dash-hint">빈 배역을 해본 사람이나 해보고 싶다고 한 사람이 아직 오리에 없어요. 모집을 공개해 지원을 받아보세요.</p>';
  return '<div class="dash-rec"><div class="dash-rec-h">빈 배역 추천<span class="dash-basis">배역 참여 이력 · "해보고 싶어요" 기준</span></div>'+blocks.join('')+'</div>';
}

/* 극장: 같은 단체가 쓴 곳, 많이 쓰인 곳, 대관 가능 */
function dashVenueRecs(D){
  var pr=D.pr,cand={};D.venueCands.forEach(function(c){cand[c.venue_id]=true;});
  var nCast=D.positions.filter(function(p){return p.position_type==='actor';}).length;
  var list=DB.venues.map(function(v){
    var shows=DB.shows.filter(function(s){return ids(fld(s,'극장')).indexOf(v.id)>-1;});
    var same=pr.troupe_id?shows.filter(function(s){return ids(fld(s,'극단')).indexOf(pr.troupe_id)>-1;}).length:0;
    var troupes={};shows.forEach(function(s){var t=ids(fld(s,'극단'))[0];if(t)troupes[t]=1;});
    var seats=fld(v,'좌석수');
    var s=same*4+Math.min(shows.length,5)+(fld(v,'대관가능여부')?1:0)+(seats?1:0);
    return{v:v,s:s,same:same,shows:shows.length,troupes:Object.keys(troupes).length,seats:seats};
  }).filter(function(x){return x.s>0;}).sort(function(a,b){return b.s-a.s;}).slice(0,5);
  return dashRecBlock('극장 후보','오리에 기록된 공연 '+DB.shows.length+'편 · 극장 정보 기준',list.map(function(x){
    var why=[];
    if(x.seats)why.push(x.seats+'석');
    if(x.same)why.push(nm(pr.troupe_id)+' '+x.same+'회 사용');
    else if(x.shows)why.push('단체 '+x.troupes+'곳이 '+x.shows+'회 사용');
    var fee=fld(x.v,'대관료');if(fee)why.push('대관료 '+fee);
    return dashRecRow('<span class="link" data-action="venue" data-id="'+x.v.id+'">'+escHtml(nm(x.v.id))+'</span>',escHtml(why.join(' · ')),
      !window._projectCtx.isAdmin?'':cand[x.v.id]?'<span class="dash-done">후보에 있음</span>':'<button type="button" class="dash-btn" onclick="dashAddVenue(\''+x.v.id+'\')">후보에 담기</button>');
  }))+(nCast?'<p class="dash-hint">배우 '+nCast+'명 규모예요. 무대 크기와 분장실도 같이 확인해요.</p>':'');
}

/* 작품: 라이선스가 풀리는 작품 중 우리 팀 규모에 맞는 것 */
async function dashWorkRecs(D){
  var r=await sbClient.from('works').select('id,rights_type,amateur_license_status');
  var info={};(r.data||[]).forEach(function(w){info[w.id]=w;});
  var team=Math.max(1,(D.members||[]).length);
  var list=DB.works.map(function(w){
    var i=info[w.id]||{},roles=DB.roles.filter(function(x){return ids(fld(x,'작품')).indexOf(w.id)>-1;}).length;
    var shows=DB.shows.filter(function(s){return ids(fld(s,'작품')).indexOf(w.id)>-1;}).length;
    var lic=i.amateur_license_status==='제공'?3:i.amateur_license_status==='협의가능'?2:(i.rights_type==='창작'||i.rights_type==='공유저작물')?2:0;
    var fit=roles?Math.max(0,3-Math.abs(roles-team)/3):0;
    return{w:w,i:i,roles:roles,shows:shows,s:lic*2+fit+Math.min(shows,3)};
  }).filter(function(x){return x.s>0;}).sort(function(a,b){return b.s-a.s;}).slice(0,5);
  return dashRecBlock('올려볼 만한 작품','라이선스 정보 · 배역 수 · 아마추어 공연 기록 기준',list.map(function(x){
    var why=[];
    if(x.i.amateur_license_status)why.push('라이선스 '+x.i.amateur_license_status);else if(x.i.rights_type)why.push(x.i.rights_type);
    if(x.roles)why.push('배역 '+x.roles+'명');
    if(x.shows)why.push('공연 '+x.shows+'회');
    return dashRecRow('<span class="link" data-action="work" data-id="'+x.w.id+'">'+escHtml(nm(x.w.id))+'</span>',escHtml(why.join(' · ')),
      window._projectCtx.isAdmin?'<button type="button" class="dash-btn" onclick="dashSetWork(\''+x.w.id+'\')">이 작품으로</button>':'');
  }));
}
function dashLicenseTip(D){
  var l=D.pr.is_licensed;
  if(l==='미확보'||!l)return '<div class="dash-rec"><div class="dash-rec-h">라이선스</div>'+dashRecRow(escHtml(nm(D.pr.work_id)),'라이선스가 해결돼야 공연을 아카이브에 올릴 수 있어요','<button type="button" class="dash-btn" onclick="openLicenseInquiry(\'\',\''+D.pr.work_id+'\')">오리에 문의</button>')+'</div>';
  return '';
}

/* 비용: 비슷한 프로젝트들의 실제 기록 (3건 이상 모인 분류만) */
async function dashCostRecs(a,D){
  var r=await sbClient.rpc('budget_benchmarks');
  var rows=(r.data||[]).filter(function(b){return a[3]==='budget'||b.category===a[5];});
  if(!rows.length)return '<p class="dash-hint dash-cost">💰 예상 비용: 비슷한 프로젝트의 기록이 3건 이상 모이면 알려드려요. 공연이 끝나고 예산 탭에 실제 쓴 금액을 적어주면 다음 프로젝트들의 추천이 정확해져요.</p>';
  return dashRecBlock('예상 비용','오리에서 진행한 프로젝트들의 중앙값',rows.map(function(b){
    return dashRecRow(escHtml(b.category),'계획 '+dashWon(b.median_planned)+(b.median_actual!=null?' · 실제 '+dashWon(b.median_actual):'')+' · 프로젝트 '+b.n_projects+'개','');
  }));
}

/* ══ 동작 ══ */
async function dashSetStatus(key,status){
  var pid=window._projectCtx.pid,r;
  var cur=(_dash.data&&_dash.data.areas[key])||{};
  if(!status&&!cur.note)r=await sbClient.from('project_areas').delete().eq('project_id',pid).eq('area_key',key);
  else r=await sbClient.from('project_areas').upsert({project_id:pid,area_key:key,status:status||null,note:cur.note||null,updated_at:new Date().toISOString()});
  if(r.error){oriAlert('저장하지 못했어요: '+r.error.message);return;}
  renderProdDash();
}
async function dashSaveNote(key,note){
  var pid=window._projectCtx.pid,cur=(_dash.data&&_dash.data.areas[key])||{};
  var r=await sbClient.from('project_areas').upsert({project_id:pid,area_key:key,status:cur.status||null,note:note.trim()||null,updated_at:new Date().toISOString()});
  if(r.error){oriAlert('저장하지 못했어요: '+r.error.message);return;}
  if(_dash.data)_dash.data.areas[key]=Object.assign({},cur,{note:note.trim()||null});
}
/* 스태프 영역 초대: 이 영역의 빈 자리가 없으면 자리를 만들어서 초대한다 */
async function dashInvite(key,personId){
  var a=dashArea(key),D=_dash.data,pid=window._projectCtx.pid;
  var ps=dashPositionsFor(a,D.positions).filter(function(p){return !dashFilled(p);});
  var posId=ps[0]&&ps[0].id;
  if(!posId){
    var rid=dashStaffRoleIds(a[4])[0];
    var ins=await sbClient.from('project_positions').insert({project_id:pid,position_type:'staff',staff_role_id:rid||null,position_label:a[1],status:'open'}).select('id').single();
    if(ins.error){oriAlert('자리를 만들지 못했어요: '+ins.error.message);return;}
    posId=ins.data.id;
  }
  await dashInviteTo(posId,personId);
}
async function dashInviteTo(posId,personId){
  var msg=await oriPrompt(nm(personId)+'님에게 함께 보낼 한마디 (선택)','');
  if(msg===null)return;
  var r=await sbClient.rpc('invite_person_to_position',{p_position_id:posId,p_person_id:personId,p_message:msg||''});
  if(r.error){
    if(/연결되지 않은/.test(r.error.message||'')){if(await oriConfirm(nm(personId)+'님은 아직 오리에 가입하지 않았어요.\n가입 안내 메시지를 복사할까요?'))inviteThisPerson(personId);}
    else oriAlert('초대하지 못했어요: '+r.error.message);
    return;
  }
  oriAlert(nm(personId)+'님에게 참여 요청을 보냈어요. 수락하면 팀에 들어와요.');
  renderProdDash();
}
async function dashAddVenue(vid){
  var pid=window._projectCtx.pid;
  var r=await sbClient.from('project_venue_candidates').insert({project_id:pid,venue_id:vid,status:'considering'});
  if(r.error){oriAlert('담지 못했어요: '+r.error.message);return;}
  renderProdDash();
}
async function dashSetWork(wid){
  var ctx=window._projectCtx,pid=ctx.pid;
  if(!await oriConfirm('"'+nm(wid)+'"(으)로 정할까요?\n작품의 배역이 자리로 자동으로 만들어져요.'))return;
  var u=await sbClient.from('projects').update({work_id:wid}).eq('id',pid);
  if(u.error){oriAlert('정하지 못했어요: '+u.error.message);return;}
  var p=await sbClient.rpc('populate_work_roles',{p_project_id:pid,p_work_id:wid});
  if(p.error)oriAlert('배역 자리를 만들지 못했어요: '+p.error.message);
  goProject(pid,false);
}
