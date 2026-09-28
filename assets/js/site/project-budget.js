/* 오리 사이트 — 프로젝트 예산 탭
   흐름: 총 예산 → 분류별 추천 분배 → 항목마다 예상·실제 금액 → 사용 알림 → 잔금·부족금 처리 제안.
   - 추천 분배: budget_shares()가 3개 이상 프로젝트의 기록이 모인 분류를 돌려주면 그 비율(데이터 기반),
     아니면 일반적인 소규모 공연 비율(BUDGET_SHARE_DEFAULT)로. 어느 쪽인지 화면에 밝힌다.
   - 시트 연동: 연결된 시트 링크(projects.budget_sheet_url) + CSV 내보내기 + 시트에서 복사해 붙여넣기.
   - 쓰기는 프로젝트 관리자만(RLS). 예산 함께 보기를 켜면 팀원은 읽기만. */
var BUDGET_PRESETS={
  expense:{
    '대관':['극장 대관료','연습실 대관료'],
    '인건비':['배우 사례비','스태프 사례비','연출료'],
    '무대/미술':['무대장치','소품','세트 제작'],
    '의상/분장':['의상 제작·대여','분장품'],
    '조명/음향':['조명 장비 대여','음향 장비 대여'],
    '홍보':['포스터·전단 인쇄','SNS 광고','사진·영상 촬영'],
    '티켓팅':['예매 수수료'],
    '기타':['예비비','잡비']
  },
  income:{
    '티켓':['현장 판매','온라인 예매'],
    '후원':['개인 후원','기업 협찬'],
    '펀딩':['크라우드펀딩'],
    '기타':['기타 수입']
  }
};
/* 소규모 아마추어 공연에서 흔한 지출 비중 (합 100) */
var BUDGET_SHARE_DEFAULT={'대관':0.30,'무대/미술':0.15,'조명/음향':0.12,'의상/분장':0.10,'인건비':0.10,'홍보':0.08,'티켓팅':0.03,'기타':0.12};
var _bg={pid:null,rows:[],shares:null,shareSrc:'',members:0};

function bgNum(v){return v==null||v===''?null:Number(v);}
function bgWon(n){return Math.round(n||0).toLocaleString()+'원';}
function bgRound(n){return Math.round(n/10000)*10000;}
function bgCanEdit(){return !!(window._projectCtx&&window._projectCtx.isAdmin);}

function renderProjectBudget(el){
  var ctx=window._projectCtx;_bg.pid=ctx.pid;
  el.innerHTML='<div class="bg" id="bg"><div class="hf-loading">불러오는 중…</div></div>';
  loadProjectBudget();
}
async function loadProjectBudget(){
  var ctx=window._projectCtx,pid=ctx.pid;
  var res=await Promise.all([
    sbClient.from('project_budget_items').select('*').eq('project_id',pid).order('created_at',{ascending:true}),
    sbClient.rpc('budget_shares'),
    sbClient.rpc('list_project_members_detail',{p_project_id:pid})
  ]);
  if(window._projectCtx!==ctx||window._projectTab!=='budget')return;
  if(res[0].error){var e=$('bg');if(e)e.innerHTML='<div class="result-empty">예산을 불러오지 못했어요.</div>';return;}
  _bg.rows=res[0].data||[];
  var sh=(res[1].data||[]).filter(function(s){return s.median_share>0;});
  if(sh.length>=3){
    var sum=sh.reduce(function(s,x){return s+Number(x.median_share);},0),m={};
    sh.forEach(function(x){m[x.category]=Number(x.median_share)/sum;});
    _bg.shares=m;_bg.shareSrc='오리에서 진행한 프로젝트들의 실제 비중';
  }else{_bg.shares=BUDGET_SHARE_DEFAULT;_bg.shareSrc='일반적인 소규모 공연 비중';}
  var seen={};(res[2].data||[]).forEach(function(m){seen[m.member_id]=1;});_bg.members=Object.keys(seen).length;
  bgDraw();
}

/* ── 계산 ── */
function bgCalc(){
  var pr=window._projectCtx.pr,rows=_bg.rows;
  var c={total:bgNum(pr.budget_total),pe:0,ae:0,pi:0,ai:0,fe:0,fi:0,cats:{},unplanned:[]};
  rows.forEach(function(b){
    var p=bgNum(b.planned_amount)||0,a=bgNum(b.actual_amount);
    if(b.item_type==='income'){c.pi+=p;c.ai+=a||0;c.fi+=a!=null?a:p;return;}
    c.pe+=p;c.ae+=a||0;c.fe+=a!=null?a:p;
    var k=b.category||'미분류';var g=c.cats[k]||(c.cats[k]={p:0,a:0,hasA:false,rows:[]});
    g.p+=p;if(a!=null){g.a+=a;g.hasA=true;}g.rows.push(b);
    if(a&&!b.planned_amount)c.unplanned.push(b);
  });
  c.balance=c.fi-c.fe;
  c.base=c.total||c.pe;
  var d=pr.target_start_date?dashDaysUntil(pr.target_start_date):null;c.dday=d;
  return c;
}
function bgAlerts(c){
  var out=[],pct=function(a,b){return Math.round(a/b*100);};
  if(c.total){
    if(c.ae>c.total)out.push(['red','총 예산을 '+bgWon(c.ae-c.total)+' 넘겨 썼어요.']);
    else if(c.pe>c.total)out.push(['red','계획한 지출이 총 예산보다 '+bgWon(c.pe-c.total)+' 많아요.']);
  }
  Object.keys(c.cats).forEach(function(k){
    var g=c.cats[k];if(!g.p||!g.hasA)return;
    if(g.a>g.p)out.push(['red',k+' — 예상보다 '+bgWon(g.a-g.p)+' 더 썼어요 (+'+(pct(g.a,g.p)-100)+'%).']);
    else if(g.a>=g.p*0.9&&g.a<g.p)out.push(['yellow',k+' — 예상의 '+pct(g.a,g.p)+'%를 썼어요.']);
  });
  if(c.base&&c.ae/c.base>=0.8&&c.dday!=null&&c.dday>14)out.push(['yellow','공연까지 '+c.dday+'일 남았는데 예산의 '+pct(c.ae,c.base)+'%를 썼어요.']);
  if(c.unplanned.length)out.push(['yellow','계획에 없던 지출 '+c.unplanned.length+'건 ('+bgWon(c.unplanned.reduce(function(s,b){return s+Number(b.actual_amount);},0))+')이 있어요.']);
  if(c.pi&&c.pe&&c.pi<c.pe)out.push(['yellow','예상 수입이 예상 지출보다 '+bgWon(c.pe-c.pi)+' 적어요.']);
  return out;
}
/* 잔금·부족금 처리 제안 */
function bgSettle(c){
  var pr=window._projectCtx.pr,n=_bg.members,tips=[];
  if(!c.fe&&!c.fi)return null;
  if(c.balance<0){
    var gap=-c.balance,left=gap;
    var reserve=_bg.rows.filter(function(b){return b.item_type==='expense'&&/예비/.test(b.item_name||'')&&bgNum(b.actual_amount)==null&&b.planned_amount>0;})
      .reduce(function(s,b){return s+Number(b.planned_amount);},0);
    if(reserve){var use=Math.min(reserve,left);tips.push(['예비비로 충당','아직 쓰지 않은 예비비 '+bgWon(reserve)+' 중 '+bgWon(use)+'을 돌려요.']);left-=use;}
    var slack=Object.keys(c.cats).filter(function(k){var g=c.cats[k];return k!=='대관'&&k!=='기타'&&!g.hasA&&g.p>0;})
      .sort(function(a,b){return c.cats[b].p-c.cats[a].p;}).slice(0,2);
    if(left>0&&slack.length){
      var room=slack.reduce(function(s,k){return s+c.cats[k].p;},0),cut=Math.min(left,bgRound(room*0.3)||room);
      tips.push(['아직 안 쓴 항목 줄이기',slack.map(function(k){return k+' '+bgWon(c.cats[k].p);}).join(', ')+'에서 '+bgWon(cut)+' 정도 덜어낼 수 있는지 봐요.']);left-=cut;
    }
    if(left>0)tips.push(['수입 늘리기',(left<gap?'그래도 모자란 ':'')+bgWon(left)+'은 후원·펀딩으로 모으거나, 티켓 가격·회차를 다시 계산해요.']);
    if(left>0&&n>1)tips.push(['팀이 나눠 내기','팀원 '+n+'명이 나누면 1인당 '+bgWon(Math.ceil(left/n/1000)*1000)+'이에요.']);
    return {kind:'short',amount:gap,title:'이대로면 '+bgWon(gap)+'이 모자라요',tips:tips};
  }
  if(c.balance>0){
    var after=pr.status==='running'||pr.status==='completed';
    if(!after){
      var keep=bgRound(c.fe*0.1);
      tips.push(['예비비로 두기','공연 전까지는 지출의 10% 정도('+bgWon(keep)+')를 비상금으로 남겨두는 게 안전해요.']);
      if(c.balance>keep)tips.push(['더 쓸 수 있는 돈',bgWon(c.balance-keep)+'은 홍보나 무대처럼 공연 완성도에 바로 보이는 곳에 더 써도 돼요.']);
    }else{
      tips.push(['다음 공연 적립','단체 통장에 남겨 다음 공연의 대관 계약금으로 써요.']);
      if(n>1)tips.push(['팀원에게 돌려주기','팀원 '+n+'명에게 나누면 1인당 '+bgWon(Math.floor(c.balance/n/1000)*1000)+'이에요.']);
      tips.push(['고마운 분들께','후원자·도와준 곳에 감사 선물이나 뒤풀이로 마무리해요.']);
    }
    return {kind:'left',amount:c.balance,title:(after?'정산하고 ':'이대로면 ')+bgWon(c.balance)+'이 남아요',tips:tips};
  }
  return {kind:'even',amount:0,title:'수입과 지출이 딱 맞아요',tips:[]};
}
function bgRecs(c){
  if(!c.total)return null;
  var sh=_bg.shares,out={};
  Object.keys(sh).forEach(function(k){out[k]=bgRound(c.total*sh[k]);});
  return out;
}

/* ── 그리기 ── */
function bgDraw(){
  var el=$('bg');if(!el)return;
  // 표 안에서 다음 칸으로 넘어가는 중에 다시 그려도 커서가 제자리에 있게
  var ae=document.activeElement,keep=null;
  if(ae&&ae.closest&&ae.closest('.bg-table tr[data-id]')){var tr=ae.closest('tr');keep=[tr.dataset.id,[].indexOf.call(tr.querySelectorAll('input,button'),ae)];}
  var ctx=window._projectCtx,pr=ctx.pr,ed=bgCanEdit(),c=bgCalc(),recs=bgRecs(c);
  var h='';
  // 머리: 총 예산 + 시트
  h+='<div class="bg-head"><div class="bg-total"><span class="bg-lbl">총 예산</span>'
    +(ed?'<input id="bg-total-in" class="bg-total-in" inputmode="numeric" placeholder="얼마로 할까요?" value="'+(c.total!=null?c.total.toLocaleString():'')+'" onblur="bgSaveTotal(this)" onkeydown="if(event.key===\'Enter\')this.blur()"><span class="bg-unit">원</span>'
         :'<b class="bg-total-v">'+(c.total!=null?bgWon(c.total):'정하지 않았어요')+'</b>')
    +'</div>'+sheetBarHtml('budget_sheet_url','bg')+'</div>';
  // 숫자 요약
  var base=c.base,usePct=base?Math.min(100,Math.round(c.ae/base*100)):0;
  h+='<div class="bg-kpis">'
    +bgKpi('예상 지출',c.pe,c.total&&c.pe>c.total?'over':'')
    +bgKpi('실제 지출',c.ae,c.total&&c.ae>c.total?'over':'')
    +bgKpi('예상 수입',c.pi,'')
    +bgKpi('실제 수입',c.ai,'')+'</div>';
  if(base)h+='<div class="bg-usage"><div class="bg-usage-bar"><i style="width:'+usePct+'%" class="'+(c.ae>base?'over':usePct>=80?'warn':'')+'"></i></div>'
    +'<div class="bg-usage-t"><span>'+(c.total?'총 예산':'예상 지출')+'의 <b>'+Math.round(c.ae/base*100)+'%</b> 사용</span><span>'+(c.ae<=base?'남은 돈 <b>'+bgWon(base-c.ae)+'</b>':'<b class="neg">'+bgWon(c.ae-base)+' 초과</b>')+'</span></div></div>';
  else if(ed)h+='<p class="bg-hint">총 예산을 적으면 분류별로 얼마씩 쓰면 좋을지 추천하고, 쓰는 만큼 알려드려요.</p>';
  // 확인할 것
  var al=bgAlerts(c);
  if(al.length)h+='<section class="dv-sec">'+dvSection('확인할 것',al.length)+'<div class="bg-alerts">'+al.map(function(a){return '<div class="bg-alert '+a[0]+'"><span class="dash-dot '+a[0]+'"></span>'+escHtml(a[1])+'</div>';}).join('')+'</div></section>';
  // 잔금·부족금
  var st=bgSettle(c);
  if(st)h+='<section class="dv-sec">'+dvSection(st.kind==='short'?'부족금 메우기':st.kind==='left'?'남는 돈 쓰기':'정산')
    +'<div class="bg-settle '+st.kind+'"><div class="bg-settle-t">'+escHtml(st.title)+'</div><div class="bg-settle-s">수입 '+bgWon(c.fi)+' − 지출 '+bgWon(c.fe)+' <small>(실제 금액이 있으면 실제, 없으면 예상으로 계산)</small></div>'
    +(st.tips.length?'<ol class="bg-tips">'+st.tips.map(function(t){return '<li><b>'+escHtml(t[0])+'</b><span>'+escHtml(t[1])+'</span></li>';}).join('')+'</ol>':'')+'</div></section>';
  // 분류별 · 추천 분배
  var cats=Object.keys(Object.assign({},recs||{},c.cats));
  var order=Object.keys(BUDGET_PRESETS.expense);
  cats.sort(function(a,b){var ia=order.indexOf(a),ib=order.indexOf(b);return (ia<0?99:ia)-(ib<0?99:ib);});
  if(cats.length){
    var maxV=Math.max.apply(null,cats.map(function(k){var g=c.cats[k]||{};return Math.max(g.p||0,g.a||0,recs&&recs[k]||0);}).concat([1]));
    h+='<section class="dv-sec">'+dvSection('분류별')
      +(recs?'<p class="bg-hint">추천은 총 예산 '+bgWon(c.total)+'을 <b>'+escHtml(_bg.shareSrc)+'</b>로 나눈 금액이에요.</p>':'')
      +'<div class="bg-legend"><span><i class="p"></i>예상</span><span><i class="a"></i>실제</span>'+(recs?'<span><i class="r"></i>추천</span>':'')+'</div>'
      +'<div class="bg-cats"><div class="bg-cat bg-cat-h"><span>분류</span><span></span><span>예상</span><span>실제</span>'+(recs?'<span>추천</span>':'')+'</div>'
      +cats.map(function(k){
        var g=c.cats[k]||{p:0,a:0,hasA:false},r=recs&&recs[k];
        var cls=g.hasA&&g.p&&g.a>g.p?'over':'';
        return '<div class="bg-cat'+(recs?'':' norec')+'"><span class="bg-cat-n">'+escHtml(k)+'</span>'
          +'<span class="bg-cat-bar"><i class="p" style="width:'+(g.p/maxV*100)+'%"></i><i class="a '+cls+'" style="width:'+(g.a/maxV*100)+'%"></i>'+(r?'<i class="r" style="left:'+(r/maxV*100)+'%"></i>':'')+'</span>'
          +'<span>'+(g.p?bgWon(g.p):'—')+'</span><span class="'+cls+'">'+(g.hasA?bgWon(g.a):'—')+'</span>'
          +(recs?'<span class="bg-rec">'+(r?bgWon(r):'—')+'</span>':'')+'</div>';
      }).join('')+'</div>'
      +(recs&&ed?'<div class="bg-actions"><button type="button" class="pf-btn" onclick="bgApplyRecs()">비어 있는 분류에 추천 금액 채우기</button></div>':'')
      +'</section>';
  }
  // 항목 표
  h+='<section class="dv-sec">'+dvSection('지출')+bgTable('expense')+'</section>';
  h+='<section class="dv-sec">'+dvSection('수입')+bgTable('income')+'</section>';
  if(ed)h+='<div class="bg-actions">'+(_bg.rows.length?'':'<button type="button" class="pf-btn pf-active" onclick="fillBudgetTemplate()">표준 항목으로 시작하기</button>')
    +'<button type="button" class="pf-btn" onclick="bgOpenPaste()">시트에서 붙여넣기</button></div>';
  el.innerHTML=h;
  if(keep){var t=el.querySelector('tr[data-id="'+keep[0]+'"]'),inp=t&&t.querySelectorAll('input,button')[keep[1]];if(inp)inp.focus();}
}
function bgKpi(l,v,cls){return '<div class="bg-kpi '+cls+'"><span>'+l+'</span><b>'+bgWon(v)+'</b></div>';}
function bgTable(type){
  var ed=bgCanEdit(),rows=_bg.rows.filter(function(b){return b.item_type===type;});
  var order=Object.keys(BUDGET_PRESETS[type]);
  rows.sort(function(a,b){var ia=order.indexOf(a.category),ib=order.indexOf(b.category);return (ia<0?99:ia)-(ib<0?99:ib);});
  var cats=order.concat(_bg.rows.filter(function(b){return b.item_type===type&&b.category;}).map(function(b){return b.category;})).filter(function(v,i,a){return a.indexOf(v)===i;});
  var items=[];Object.keys(BUDGET_PRESETS[type]).forEach(function(k){items=items.concat(BUDGET_PRESETS[type][k]);});
  var ro=ed?'':' readonly';
  var h='<datalist id="bg-cat-'+type+'">'+cats.map(function(c){return '<option value="'+escHtml(c)+'">';}).join('')+'</datalist>'
    +'<datalist id="bg-item-'+type+'">'+items.map(function(c){return '<option value="'+escHtml(c)+'">';}).join('')+'</datalist>';
  if(!rows.length)h+='<div class="bg-empty">아직 없어요.</div>';
  else h+='<div class="bg-table-wrap"><table class="bg-table"><thead><tr><th>분류</th><th>항목</th><th>내용</th><th class="num">예상</th><th class="num">실제</th>'+(ed?'<th></th>':'')+'</tr></thead><tbody>'
    +rows.map(function(b){
      var p=bgNum(b.planned_amount),a=bgNum(b.actual_amount);
      var cls=type==='expense'&&a!=null&&p!=null&&a>p?' over':'';
      return '<tr data-id="'+b.id+'">'
        +'<td><input list="bg-cat-'+type+'" value="'+escHtml(b.category||'')+'" maxlength="10"'+ro+' onchange="bgSaveField(\''+b.id+'\',\'category\',this.value,true)"></td>'
        +'<td><input list="bg-item-'+type+'" value="'+escHtml(b.item_name||'')+'" maxlength="20"'+ro+' onchange="bgSaveField(\''+b.id+'\',\'item_name\',this.value)"></td>'
        +'<td><input value="'+escHtml(b.notes||'')+'" placeholder="메모"'+ro+' onchange="bgSaveField(\''+b.id+'\',\'notes\',this.value)"></td>'
        +'<td class="num"><input inputmode="numeric" value="'+(p!=null?p.toLocaleString():'')+'" placeholder="0"'+ro+' onchange="bgSaveAmount(\''+b.id+'\',\'planned_amount\',this)"></td>'
        +'<td class="num"><input class="'+cls+'" inputmode="numeric" value="'+(a!=null?a.toLocaleString():'')+'" placeholder="—"'+ro+' onchange="bgSaveAmount(\''+b.id+'\',\'actual_amount\',this)"></td>'
        +(ed?'<td><button type="button" class="bg-del" title="삭제" onclick="deleteBudgetItem(\''+b.id+'\')">✕</button></td>':'')+'</tr>';
    }).join('')+'</tbody></table></div>';
  if(ed)h+='<button type="button" class="bg-add" onclick="addBudgetRow(\''+type+'\')">+ '+(type==='income'?'수입':'지출')+' 항목</button>';
  return h;
}

/* ── 저장 ── */
async function bgSaveTotal(input){
  var raw=input.value.replace(/[^0-9]/g,''),v=raw?Number(raw):null,pr=window._projectCtx.pr;
  if(v===bgNum(pr.budget_total))return;
  var r=await sbClient.from('projects').update({budget_total:v}).eq('id',_bg.pid);
  if(r.error){oriAlert('저장하지 못했어요: '+r.error.message);return;}
  pr.budget_total=v;bgDraw();
}
async function bgSaveField(id,field,value,redraw){
  var patch={};patch[field]=value.trim()||null;
  var r=await sbClient.from('project_budget_items').update(patch).eq('id',id);
  if(r.error){oriAlert('저장하지 못했어요: '+r.error.message);return;}
  var row=_bg.rows.find(function(b){return b.id===id;});if(row)row[field]=patch[field];
  if(redraw)bgDraw();
}
async function bgSaveAmount(id,field,input){
  var raw=input.value.replace(/[^0-9]/g,''),v=raw?Number(raw):null;
  var patch={};patch[field]=v;
  var r=await sbClient.from('project_budget_items').update(patch).eq('id',id);
  if(r.error){oriAlert('저장하지 못했어요: '+r.error.message);return;}
  var row=_bg.rows.find(function(b){return b.id===id;});if(row)row[field]=v;
  bgDraw();
}
async function addBudgetRow(type){
  var r=await sbClient.from('project_budget_items').insert({project_id:_bg.pid,item_type:type,item_name:'새 항목'}).select().single();
  if(r.error){oriAlert('추가하지 못했어요: '+r.error.message);return;}
  _bg.rows.push(r.data);bgDraw();
  var inp=document.querySelector('.bg-table tr[data-id="'+r.data.id+'"] input');if(inp)inp.focus();
}
async function deleteBudgetItem(id){
  if(!await oriConfirm('이 항목을 지울까요?'))return;
  var r=await sbClient.from('project_budget_items').delete().eq('id',id);
  if(r.error){oriAlert('지우지 못했어요: '+r.error.message);return;}
  _bg.rows=_bg.rows.filter(function(b){return b.id!==id;});bgDraw();
}
async function fillBudgetTemplate(){
  var rows=[];
  ['expense','income'].forEach(function(t){Object.keys(BUDGET_PRESETS[t]).forEach(function(k){rows.push({project_id:_bg.pid,item_type:t,category:k,item_name:BUDGET_PRESETS[t][k][0]});});});
  var r=await sbClient.from('project_budget_items').insert(rows);
  if(r.error){oriAlert('채우지 못했어요: '+r.error.message);return;}
  loadProjectBudget();
}
/* 추천 금액을 "비어 있는" 분류에만 채운다 — 이미 적은 금액은 건드리지 않는다 */
async function bgApplyRecs(){
  var c=bgCalc(),recs=bgRecs(c);if(!recs)return;
  var ups=[],ins=[];
  Object.keys(recs).forEach(function(k){
    var g=c.cats[k];
    if(!g){ins.push({project_id:_bg.pid,item_type:'expense',category:k,item_name:(BUDGET_PRESETS.expense[k]||['예산'])[0],planned_amount:recs[k]});return;}
    if(g.p>0)return;
    ups.push([g.rows[0].id,recs[k]]);
  });
  if(!ups.length&&!ins.length){oriAlert('모든 분류에 이미 금액이 있어요. 추천과 다른 곳은 표에서 직접 고쳐 주세요.');return;}
  if(!await oriConfirm((ups.length+ins.length)+'개 분류에 추천 금액을 채울게요. 이미 적은 금액은 그대로 둬요.'))return;
  var errs=0;
  for(var i=0;i<ups.length;i++){var r=await sbClient.from('project_budget_items').update({planned_amount:ups[i][1]}).eq('id',ups[i][0]);if(r.error)errs++;}
  if(ins.length){var r2=await sbClient.from('project_budget_items').insert(ins);if(r2.error)errs++;}
  if(errs)oriAlert('일부를 채우지 못했어요.');
  loadProjectBudget();
}

/* ── 시트 연동: 링크 · CSV · 붙여넣기 ── */
function sheetBarHtml(field,prefix){
  var pr=window._projectCtx.pr,url=pr[field],ed=window._projectCtx.isAdmin;
  var kind=!url?'':/docs\.google\.com\/spreadsheets/.test(url)?'Google 시트':/sharepoint|onedrive|office/.test(url)?'Excel 온라인':/notion/.test(url)?'Notion':'연결된 시트';
  return '<div class="sheet-bar">'
    +(url?'<a class="sheet-link" href="'+escHtml(url)+'" target="_blank" rel="noopener">📄 '+kind+' 열기 ↗</a>':'')
    +(ed?'<button type="button" class="sheet-btn" onclick="setSheetLink(\''+field+'\')">'+(url?'링크 바꾸기':'🔗 시트 연결')+'</button>':'')
    +'<button type="button" class="sheet-btn" onclick="'+(prefix==='bg'?'bgExportCsv()':'propsExportMenu()')+'">CSV 내보내기</button></div>';
}
async function setSheetLink(field){
  var pr=window._projectCtx.pr;
  var v=await oriPrompt('함께 쓰는 시트 주소를 붙여넣어 주세요.\n(구글 시트·엑셀 온라인 등 · 비우면 연결을 끊어요)',pr[field]||'');
  if(v===null)return;v=v.trim();
  if(v&&!/^https?:\/\//.test(v)){oriAlert('https:// 로 시작하는 주소를 넣어 주세요.');return;}
  var patch={};patch[field]=v||null;
  var r=await sbClient.from('projects').update(patch).eq('id',pr.id||window._projectCtx.pid);
  if(r.error){oriAlert('저장하지 못했어요: '+r.error.message);return;}
  pr[field]=v||null;
  renderProjectTabContent();
}
function downloadCsv(name,rows){
  var csv='﻿'+rows.map(function(r){return r.map(function(v){v=v==null?'':String(v);return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;}).join(',');}).join('\r\n');
  var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download=name;
  document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove();},500);
}
function bgExportCsv(){
  var rows=[['구분','분류','항목','내용','예상','실제']];
  _bg.rows.forEach(function(b){rows.push([b.item_type==='income'?'수입':'지출',b.category,b.item_name,b.notes,b.planned_amount,b.actual_amount]);});
  downloadCsv(((window._projectCtx.pr.title||'프로젝트')+' 예산.csv').replace(/[\\/:*?"<>|]/g,''),rows);
}
function oriSheetModal(id,html){
  var ov=document.getElementById(id);
  if(!ov){ov=document.createElement('div');ov.id=id;ov.className='rv-overlay';document.body.appendChild(ov);}
  ov.innerHTML='<div class="rv-modal sheet-modal" role="dialog">'+html+'</div>';
  ov.classList.add('open');ov.onclick=function(e){if(e.target===ov)ov.classList.remove('open');};
  return ov;
}
function bgOpenPaste(){
  oriSheetModal('bg-paste','<div class="rv-m-h"><div><div class="rv-m-k">예산</div><div class="rv-m-t">시트에서 붙여넣기</div></div><button type="button" class="rv-x" onclick="$(\'bg-paste\').classList.remove(\'open\')">✕</button></div>'
    +'<p class="bg-hint">구글 시트나 엑셀에서 칸을 그대로 복사해 붙여넣어요. 열 순서: <b>구분(수입/지출) · 분류 · 항목 · 내용 · 예상 · 실제</b><br>구분 열이 없으면 모두 지출로 넣고, 머리글 줄은 알아서 건너뛰어요.</p>'
    +'<textarea id="bg-paste-in" rows="8" class="sheet-paste" placeholder="지출	대관	극장 대관료	3일	1500000	"></textarea>'
    +'<div class="rv-m-f"><span id="bg-paste-n" class="bg-hint" style="margin-right:auto"></span><button type="button" class="pf-btn" onclick="$(\'bg-paste\').classList.remove(\'open\')">취소</button><button type="button" class="pf-btn pf-active" onclick="bgImportPaste()">넣기</button></div>');
  var ta=$('bg-paste-in');ta.oninput=function(){$('bg-paste-n').textContent=bgParsePaste(ta.value).length+'줄 인식';};ta.focus();
}
function bgParsePaste(text){
  var toN=function(v){v=String(v||'').replace(/[^0-9]/g,'');return v?Number(v):null;};
  return text.split(/\r?\n/).map(function(l){return l.split(l.indexOf('\t')>-1?'\t':',').map(function(s){return s.trim();});})
    .filter(function(c){return c.some(Boolean);})
    .filter(function(c){return !/^(구분|분류|대항목|category)$/i.test(c[0]);})
    .map(function(c){
      var type='expense';
      if(c[0]==='수입'||c[0]==='지출'){type=c[0]==='수입'?'income':'expense';c=c.slice(1);}
      return {project_id:_bg.pid,item_type:type,category:c[0]||null,item_name:c[1]||c[0]||'항목',notes:c[2]||null,planned_amount:toN(c[3]),actual_amount:toN(c[4])};
    });
}
async function bgImportPaste(){
  var rows=bgParsePaste($('bg-paste-in').value);
  if(!rows.length){oriAlert('인식한 줄이 없어요.');return;}
  var r=await sbClient.from('project_budget_items').insert(rows);
  if(r.error){oriAlert('넣지 못했어요: '+r.error.message);return;}
  $('bg-paste').classList.remove('open');
  loadProjectBudget();
}
