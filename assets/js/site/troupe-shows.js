/* 오리 사이트 — 단체가 직접 남기는 공연 기록 (내 단체 관리 화면 안)
   기록의 주인은 단체. 단체 관리자가 지난 공연을 등록·수정하면 '단체 확인' 기록이 된다.
   필수는 공연명·날짜 두 칸뿐, 나머지는 아는 만큼. 출연진은 시트에서 붙여넣기.
   배우·스태프가 직접 추가한 이력도 여기서 확인한다 (my-history.js가 요청하는 쪽).
   서버: troupe_save_show / troupe_add_cast (supabase/migrations/20261010_troupe_show_entry.sql),
         list_participation_requests / review_participation (20261010_participation_requests.sql) */
var _ts={tid:null,rows:[],editing:null,pending:[]};
var TS_LIC=[['','모름'],['창작','우리 창작'],['완료','허락받음'],['미확보','아직']];

async function renderTroupeShows(tid){
  _ts.tid=tid;_ts.editing=null;
  var el=$('troupe-shows');if(!el)return;
  el.innerHTML='<div class="person-side-title">우리 공연 기록</div><div style="font-size:0.8rem;color:var(--muted)">불러오는 중…</div>';
  var res=await Promise.all([
    sbClient.from('shows').select('id,title,show_date,end_date,work_id,venue_id,ticket_type,performers_paid,performance_count,is_licensed,record_status').eq('troupe_id',tid).order('show_date',{ascending:false}),
    sbClient.rpc('list_participation_requests',{p_troupe_id:tid,p_status:'확인 대기'})
  ]);
  var r=res[0];
  _ts.pending=res[1].data||[];
  if(r.error){el.innerHTML='<div class="person-side-title">우리 공연 기록</div><div style="font-size:0.8rem;color:var(--muted)">불러오기 실패: '+escHtml(r.error.message)+'</div>';return;}
  _ts.rows=r.data||[];
  drawTroupeShows();
}
function tsCondText(s){
  return [s.ticket_type?s.ticket_type:'',s.performance_count?s.performance_count+'회':'',s.performers_paid===true?'출연료 지급':(s.performers_paid===false?'출연료 없음':'')].filter(Boolean).join(' · ');
}
function drawTroupeShows(){
  var el=$('troupe-shows');if(!el)return;
  var h='<div class="ts-head"><div class="person-side-title" style="margin:0">우리 공연 기록 <span class="dv-n">'+_ts.rows.length+'</span></div>'
    +'<button class="pf-btn pf-active" onclick="openTroupeShowForm(null)">+ 지난 공연 기록하기</button></div>'
    +'<div class="ts-help">우리 단체가 올린 공연을 남겨두면 단체 페이지가 포트폴리오가 되고, 함께한 사람들의 이력도 같이 쌓여요.</div>';
  if(_ts.pending.length)h+='<div class="ts-pending"><div class="ts-pending-title">확인 기다리는 이력 <span class="dv-n">'+_ts.pending.length+'</span></div>'
    +'<div class="ts-help" style="margin:0.2rem 0 0.4rem">배우·스태프가 우리 공연에 참여했다고 남긴 이력이에요. 맞으면 확인을 눌러주세요. 확인한 이력만 사람 페이지에 올라가요.</div>'
    +_ts.pending.map(function(x){
      return '<div class="ts-row"><div class="ts-main">'
        +'<div class="ts-title">'+escHtml(x.person_name||'')+' <span class="ts-meta">'+escHtml(x.role_names||(x.role_type==='스텝'?'스태프':x.role_type)||'')+'</span></div>'
        +'<div class="ts-meta">'+escHtml(x.show_title||'')+(x.show_date?' · '+String(x.show_date).replace(/-/g,'.'):'')+'</div>'
        +(x.request_note?'<div class="ts-meta">메모: '+escHtml(x.request_note)+'</div>':'')
        +'</div><div class="ts-side"><button class="pf-btn" onclick="reviewTroupeHistory(\''+x.id+'\',false)">아니에요</button>'
        +'<button class="pf-btn pf-active" onclick="reviewTroupeHistory(\''+x.id+'\',true)">확인</button></div></div>';
    }).join('')+'</div>';
  h+='<div id="ts-form"></div>';
  if(!_ts.rows.length){h+='<div class="ts-empty">아직 기록된 공연이 없어요. 가장 최근 공연 하나부터 남겨볼까요?</div>';}
  else h+='<div class="ts-list">'+_ts.rows.map(function(s){
    var cond=tsCondText(s);
    var need=!s.ticket_type||s.performers_paid==null;
    return '<div class="ts-row">'
      +'<div class="ts-main"><div class="ts-title">'+escHtml(s.title||'(제목 없음)')+'</div>'
      +'<div class="ts-meta">'+[s.show_date?String(s.show_date).replace(/-/g,'.'):'',s.work_id?escHtml(nm(s.work_id)):'',s.venue_id?escHtml(nm(s.venue_id)):''].filter(Boolean).join(' · ')+'</div>'
      +'<div class="ts-meta">'+(cond?escHtml(cond):'')+(need?'<span class="ts-flag">조건 채우기</span>':'')+'</div></div>'
      +'<div class="ts-side"><span class="ts-status ts-st-'+(s.record_status==='미확인'?'none':'ok')+'">'+escHtml(s.record_status||'미확인')+'</span>'
      +'<button class="pf-btn" onclick="openTroupeShowForm(\''+s.id+'\')">고치기</button></div>'
      +'</div>';
  }).join('')+'</div>';
  el.innerHTML=h;
}
function tsSeg(name,opts,val){
  return '<div class="ts-seg">'+opts.map(function(o){
    var v=String(o[0]);var on=String(val==null?'':val)===v;
    return '<label class="ts-seg-opt'+(on?' on':'')+'"><input type="radio" name="'+name+'" value="'+v+'"'+(on?' checked':'')+' onchange="tsSegChange(this)">'+o[1]+'</label>';
  }).join('')+'</div>';
}
function tsSegChange(inp){
  var wrap=inp.closest('.ts-seg');wrap.querySelectorAll('.ts-seg-opt').forEach(function(l){l.classList.toggle('on',l.querySelector('input').checked);});
}
function tsSegVal(name){var c=document.querySelector('input[name="'+name+'"]:checked');return c?c.value:'';}
function openTroupeShowForm(sid){
  var s=sid?_ts.rows.find(function(x){return x.id===sid;}):{};
  _ts.editing=sid||null;
  var esc=function(v){return escHtml(v==null?'':String(v)).replace(/"/g,'&quot;');};
  var workList=DB.works.map(function(w){return '<option value="'+esc(fld(w,'작품명')||nm(w.id))+'">';}).join('');
  var venueList=DB.venues.map(function(v){return '<option value="'+esc(nm(v.id))+'">';}).join('');
  var h='<div class="ts-form">'
    +'<div class="ts-form-title">'+(sid?'공연 기록 고치기':'지난 공연 기록하기')+'</div>'
    +'<div class="ts-grid">'
    +'<div class="edit-modal-field ts-wide"><label>공연명 *</label><input type="text" id="ts-title" value="'+esc(s.title)+'" placeholder="예: 2025 정기공연 〈긴긴밤〉"></div>'
    +'<div class="edit-modal-field"><label>작품</label><input type="text" id="ts-work" list="ts-work-list" value="'+esc(s.work_id?nm(s.work_id):'')+'" placeholder="작품 이름 (없으면 새로 만들어요)"><datalist id="ts-work-list">'+workList+'</datalist></div>'
    +'<div class="edit-modal-field"><label>극장</label><input type="text" id="ts-venue" list="ts-venue-list" value="'+esc(s.venue_id?nm(s.venue_id):'')+'" placeholder="극장 이름"><datalist id="ts-venue-list">'+venueList+'</datalist></div>'
    +'<div class="edit-modal-field"><label>첫 공연일 *</label><input type="date" id="ts-date" value="'+esc(s.show_date)+'"></div>'
    +'<div class="edit-modal-field"><label>마지막 공연일</label><input type="date" id="ts-end" value="'+esc(s.end_date)+'"></div>'
    +'<div class="edit-modal-field"><label>회차</label><input type="number" min="1" id="ts-count" value="'+esc(s.performance_count)+'" placeholder="몇 번 올렸나요"></div>'
    +'<div class="edit-modal-field"><label>티켓</label>'+tsSeg('ts-ticket',[['','모름'],['유료','유료'],['무료','무료']],s.ticket_type||'')+'</div>'
    +'<div class="edit-modal-field"><label>출연료</label>'+tsSeg('ts-paid',[['','모름'],['true','지급'],['false','없음']],s.performers_paid==null?'':String(s.performers_paid))+'</div>'
    +'<div class="edit-modal-field ts-wide"><label>라이선스 <span class="ts-private">🔒 공개되지 않아요</span></label>'+tsSeg('ts-lic',TS_LIC,s.is_licensed||'')+'</div>'
    +'<div class="edit-modal-field ts-wide"><label>출연진·스태프 붙여넣기 (선택)</label>'
    +'<textarea id="ts-cast" rows="5" placeholder="한 줄에 하나씩 · 시트에서 그대로 복사해도 돼요\n주인공: 김오리, 박오리\n연출: 이오리\n음악감독\t최오리"></textarea>'
    +'<div class="ts-hint">"배역이나 역할: 이름" 형식이에요. 이름이 여럿이면 쉼표로. 같은 이름이 오리에 한 명뿐이면 그 사람에게 이어지고, 아니면 새로 만들어요.</div></div>'
    +'</div>'
    +'<div class="ts-actions"><button class="pf-btn" onclick="closeTroupeShowForm()">취소</button><button class="pf-btn pf-active" id="ts-save" onclick="saveTroupeShow()">저장</button></div>'
    +'<div id="ts-msg" class="ts-msg"></div></div>';
  $('ts-form').innerHTML=h;
  $('ts-form').scrollIntoView({behavior:'smooth',block:'start'});
}
function closeTroupeShowForm(){_ts.editing=null;var f=$('ts-form');if(f)f.innerHTML='';}
async function saveTroupeShow(){
  var msg=$('ts-msg'),btn=$('ts-save');
  var title=$('ts-title').value.trim(),date=$('ts-date').value;
  if(!title||!date){msg.textContent='공연명과 첫 공연일은 꼭 적어주세요.';return;}
  var workName=$('ts-work').value.trim(),venueName=$('ts-venue').value.trim();
  var work=DB.works.find(function(w){return (fld(w,'작품명')||nm(w.id))===workName;});
  var venue=DB.venues.find(function(v){return nm(v.id)===venueName;});
  var paid=tsSegVal('ts-paid');
  var payload={title:title,show_date:date,end_date:$('ts-end').value||'',
    work_id:work?work.id:'',work_name:work?'':workName,
    venue_id:venue?venue.id:'',venue_name:venue?'':venueName,
    ticket_type:tsSegVal('ts-ticket'),performers_paid:paid===''?null:paid==='true',
    performance_count:$('ts-count').value||'',is_licensed:tsSegVal('ts-lic')};
  btn.disabled=true;msg.textContent='저장 중…';
  try{
    var r=await sbClient.rpc('troupe_save_show',{p_troupe_id:_ts.tid,p_show_id:_ts.editing,p:payload});
    if(r.error)throw r.error;
    var sid=r.data,note='';
    var cast=$('ts-cast').value.trim();
    if(cast){
      var c=await sbClient.rpc('troupe_add_cast',{p_show_id:sid,p_lines:cast});
      if(c.error)throw c.error;
      var d=c.data||{};
      note=' 출연진·스태프 '+(d.added||0)+'명을 이었어요'+(d.new_people?' (새로 만든 사람 '+d.new_people+'명)':'')+'.';
      if(d.unknown_labels&&d.unknown_labels.length)note+=' "'+d.unknown_labels.join('", "')+'"은 작품 배역에서 못 찾아서 배역 없이 넣었어요.';
    }
    await load();
    await renderTroupeShows(_ts.tid);
    oriAlert('공연 기록을 저장했어요.'+note);
  }catch(e){msg.textContent='저장하지 못했어요: '+(e.message||e);btn.disabled=false;}
}
async function reviewTroupeHistory(id,ok){
  if(!ok&&!await oriConfirm('이 사람이 이 공연에 참여하지 않았나요?\n"아니에요"를 누르면 요청한 사람에게 그렇게 표시돼요.'))return;
  var r=await sbClient.rpc('review_participation',{p_id:id,p_ok:ok});
  if(r.error){oriAlert('처리하지 못했어요: '+r.error.message);return;}
  if(ok)await load();
  await renderTroupeShows(_ts.tid);
}
