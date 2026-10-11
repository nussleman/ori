/* 오리 사이트 — 작품 목록·상세
   작품 페이지는 허브: 이 작품을 올리려는 사람이 볼 것(올라간 횟수·단체 수 집계, 올리고 싶은 사람 수, 권리 정보,
   등장인물, 해본 극장, 비용 감)과 할 일(라이선스 문의, 프로젝트 시작)을 한곳에.
   미확보 공연은 개별로 보이지 않고 숫자로만, 그 숫자도 단체가 특정될 만큼 작으면(공개 안 된 공연이 섞이고 3곳 미만) "몇몇"으로
   — 서버 work_public_stats (supabase/migrations/20261011_work_public_stats.sql) / work_hub (20261010_work_hub.sql) */
var WORK_STATS=null; // {work_id: {show_count, troupe_count, few, first_year, last_year, wish_count}}
async function loadWorkStats(force){
  if(WORK_STATS&&!force)return WORK_STATS;
  var r=await sbClient.rpc('work_public_stats');
  WORK_STATS={};
  (r.data||[]).forEach(function(x){WORK_STATS[x.work_id]=x;});
  return WORK_STATS;
}
function workStageLabel(wid){
  var st=WORK_STATS&&WORK_STATS[wid];
  if(!st)return '';
  if(st.few)return '몇몇 단체가 올림';
  if(!st.show_count)return '';
  return st.show_count+'번 올라감'+(st.troupe_count?' · 단체 '+st.troupe_count+'곳':'');
}
/* ══ 작품 인덱스 ══ */
var _allWorks=[];
var _workIndexView='grid';
var _workFilter={country:'',minCast:0,genre:''};

function goWorks(push){
  if(push!==false)history.pushState({view:'works'},'','#works');
  setNav('works');_sbContext='works';
    _allWorks=DB.works.filter(function(w){return fld(w,'작품명');});
  _workFilter={country:'',minCast:0,genre:''};
  renderWorkIndex();
  if(!WORK_STATS)loadWorkStats().then(function(){if(_sbContext==='works'&&$('mn').querySelector('.result-grid,.result-list'))renderWorkIndex();});
}

function workGenre(w){
  var candidates=['구분','장르','유형','분류','작품유형','장르구분','공연유형','Genre','genre'];
  for(var i=0;i<candidates.length;i++){
    var v=fld(w,candidates[i]);
    if(v){return typeof v==='string'?v:(v.name||(Array.isArray(v)?v.join(', '):String(v)));}
  }
  return '';
}

function renderWorkIndex(){
  // 국가 옵션 수집
  var countrySet={};
  _allWorks.forEach(function(w){
    var c=fld(w,'국가')||fld(w,'원작국가')||fld(w,'나라')||'';
    if(c){(Array.isArray(c)?c:[c]).forEach(function(v){if(v)countrySet[v]=true;});}
  });
  var countries=Object.keys(countrySet).sort();

  // 장르 옵션 수집
  var genreSet={};
  _allWorks.forEach(function(w){var g=workGenre(w);if(g)genreSet[g]=true;});
  var genres=Object.keys(genreSet).sort();

  // 필터 적용
  var filtered=_allWorks.filter(function(w){
    if(_workFilter.country){
      var c=fld(w,'국가')||fld(w,'원작국가')||fld(w,'나라')||'';
      var vals=Array.isArray(c)?c:[c];
      if(vals.indexOf(_workFilter.country)===-1)return false;
    }
    if(_workFilter.genre){
      if(workGenre(w)!==_workFilter.genre)return false;
    }
    if(_workFilter.minCast>0){
      var roleCnt=DB.roles.filter(function(r){return ids(fld(r,'작품')).indexOf(w.id)>-1;}).length;
      if(roleCnt<_workFilter.minCast)return false;
    }
    return true;
  });

  var filterH=filterBar('works',[
    {key:'genre',label:'장르',type:'single',value:_workFilter.genre,options:genres.map(function(g){return{v:g,l:g};})},
    {key:'country',label:'국가',type:'single',value:_workFilter.country,options:countries.map(function(c){return{v:c,l:c};})},
    {key:'minCast',label:'배역 인원',type:'single',value:_workFilter.minCast||'',options:[{v:3,l:'3명 이상'},{v:5,l:'5명 이상'},{v:10,l:'10명 이상'}]}
  ],{
    count:'<em>'+filtered.length+'</em>개 작품',
    view:{value:_workIndexView,onChange:function(v){_workIndexView=v;renderWorkIndex();}},
    onChange:function(k,v){_workFilter[k]=(k==='minCast'?(v||0):v);renderWorkIndex();},
    onReset:clearWorkFilter
  });
  var resultH='';

  var listH='';
  if(!filtered.length){listH='<div class="result-empty"><div class="result-empty-icon">📖</div>조건에 맞는 작품이 없어요.'+fbEmptyReset('works')+'</div>';}
  else if(_workIndexView==='grid'){
    listH='<div class="result-grid">';
    filtered.forEach(function(w){
      var shows=DB.shows.filter(function(s){return ids(fld(s,'작품')).indexOf(w.id)>-1;});
      var roleCnt=DB.roles.filter(function(r){return ids(fld(r,'작품')).indexOf(w.id)>-1;}).length;
      var country=fld(w,'국가')||fld(w,'원작국가')||fld(w,'나라')||'';
      var countryLabel=Array.isArray(country)?country.join(', '):country;
      var genre=workGenre(w);
      var wTags=fld(w,'태그')||[];
      var tagsRowH='';
      if(genre||wTags.length){
        tagsRowH='<div class="result-card-tags">'+(genre?'<span class="result-card-tag">'+genre+'</span>':'')+wTags.map(function(t){return '<span class="result-card-tag">'+t+'</span>';}).join('')+'</div>';
      }
      var wPhoto=(fld(w,'사진')||[])[0];
      var wPhotoH=wPhoto?'<img src="'+wPhoto.url+'" style="width:100%;height:100%;object-fit:cover;border-radius:8px">':'📖';
      listH+='<div class="result-card" data-action="work" data-id="'+w.id+'">'+favBtnHtml('work',w.id)+wishBtnHtml('work',w.id)
        +'<div class="result-card-ph">'+wPhotoH+'</div><div class="result-card-body"><div class="result-card-title">'+fld(w,'작품명')+'</div>'+(fld(w,'작품명 (영문)')?'<div class="result-card-sub">'+fld(w,'작품명 (영문)')+'</div>':'')+(countryLabel?'<div class="result-card-sub">'+countryLabel+'</div>':'')+'<div class="result-card-sub">'+([workStageLabel(w.id)||(shows.length?'공연 '+shows.length+'개':''),roleCnt?'배역 '+roleCnt+'명':''].filter(Boolean).join(' · ')||'&nbsp;')+'</div>'+tagsRowH+'</div></div>';
    });
    listH+='</div>';
  } else {
    listH='<div class="result-list">';
    filtered.forEach(function(w){
      var shows=DB.shows.filter(function(s){return ids(fld(s,'작품')).indexOf(w.id)>-1;});
      var roleCnt=DB.roles.filter(function(r){return ids(fld(r,'작품')).indexOf(w.id)>-1;}).length;
      var country=fld(w,'국가')||fld(w,'원작국가')||fld(w,'나라')||'';
      var countryLabel=Array.isArray(country)?country.join(', '):country;
      var genre=workGenre(w);
      listH+='<div class="result-row" data-action="work" data-id="'+w.id+'"><div class="rr-poster">📖</div><div class="rr-main"><div class="rr-title">'+fld(w,'작품명')+'</div><div class="rr-meta">'+(genre?'<span class="rr-tag" style="color:var(--accent)">'+genre+'</span>':'')+(fld(w,'작품명 (영문)')?'<span class="rr-tag">'+fld(w,'작품명 (영문)')+'</span>':'')+(countryLabel?'<span class="rr-tag">'+countryLabel+'</span>':'')+'<span class="rr-tag">'+(workStageLabel(w.id)||'공연 '+shows.length+'개')+'</span>'+(roleCnt?'<span class="rr-tag">배역 '+roleCnt+'명</span>':'')+'</div></div></div>';
    });
    listH+='</div>';
  }
  mn('<div class="tab-index">'+filterH+resultH+listH+'</div>');
}
function clearWorkFilter(){_workFilter={country:'',minCast:0,genre:''};renderWorkIndex();}
function showWork(wid,push){
  if(push!==false)history.pushState({view:'work',id:wid},'','#work-'+wid);
  setNav('works');mobShowDetail();
  var work=DB.works.find(function(w){return w.id===wid;});if(!work)return;
  var shows=sortShows(DB.shows.filter(function(s){return ids(fld(s,'작품')).indexOf(wid)>-1;}));
  var roles=DB.roles.filter(function(r){return ids(fld(r,'작품')).indexOf(wid)>-1;});
  roles.sort(function(a,b){var oa=ROLE_ORDER[a.id],ob=ROLE_ORDER[b.id];if(oa==null&&ob==null)return 0;if(oa==null)return 1;if(ob==null)return -1;return oa-ob;});
  var country=fld(work,'국가');country=Array.isArray(country)?country.join(', '):(country||'');
  var creators=[];DB.creationHistory.forEach(function(c){if(ids(fld(c,'작품')).indexOf(wid)>-1){var p=ids(fld(c,'창작자'))[0];if(p&&creators.indexOf(p)===-1)creators.push(p);}});
  var photos=fld(work,'사진')||[];
  dvRender({
    type:'work',id:wid,back:{label:'작품 목록',go:'goWorks()'},hero:true,
    thumb:{url:iurl(photos),shape:'poster',ph:'📖'},
    kicker:'작품'+(workGenre(work)?' · '+escHtml(workGenre(work)):''),
    title:fld(work,'작품명'),
    sub:fld(work,'작품명 (영문)')?escHtml(fld(work,'작품명 (영문)')):'',
    tags:fld(work,'태그')||[],
    favs:[dvFavIcon('work',wid),dvFavIcon('work',wid,'wishlist')],
    info:[['국가',escHtml(country)],['초연',fld(work,'초연 연도')?fld(work,'초연 연도')+'년':''],['등장인물',roles.length?roles.length+'명':'']],
    primary:dvActBtn('이 작품으로 프로젝트 시작','startProjectFromWork(\''+wid+'\')','🎭',true)+reviewBtn('work',wid),
    links:[dvTextLink('라이선스 문의','openLicenseInquiry(\'\',\''+wid+'\')'),dvEditBtn('work',wid)],
    sections:[
      {title:'이 작품을 올리려면',body:'<div id="work-hub-'+wid+'" class="wh"><div class="hf-loading">불러오는 중…</div></div>',peek:true},
      {title:'공연 이력',tab:'공연 이력',homeMax:4,items:shows.map(function(s){return dvShowFilm(s);}),layout:'film',peek:true,peekMax:5},
      {title:'창작진',items:creators.map(function(p){return dvPersonRow(p,'');}),layout:'rows',peek:true},
      {title:'등장인물',tab:'등장인물',homeMax:12,items:roles.map(function(r){return dvChip('role',r.id,fld(r,'배역명'));}),layout:'chips',peek:true,peekMax:20},
      {title:'해보고 싶어하는 사람들',body:'<div id="wish-interest-work"></div>'},
      reviewSection('work',wid),
      {title:'사진',tab:'사진',body:buildPhotoGalleryHtml(photos,fld(work,'작품명'))}
    ],
    empty:'아직 연결된 공연이나 배역이 없어요.',
    after:function(){renderWishlistInterest('work',wid,'wish-interest-work');loadReviews('work',wid);renderWorkHub(wid,roles,shows);}
  });
}
var WH_AMATEUR={'제공':'아마추어 공연 라이선스를 내주고 있어요','협의가능':'아마추어 공연도 협의할 수 있어요','미제공':'아마추어 공연 라이선스는 아직 내주지 않아요','확인불가':''};
async function renderWorkHub(wid,roles,shows){
  var res=await Promise.all([loadWorkStats(),sbClient.rpc('work_hub',{p_work_id:wid})]);
  var el=$('work-hub-'+wid);if(!el)return;
  var st=(WORK_STATS&&WORK_STATS[wid])||{},hub=res[1].data||{};
  var tile=function(big,small){return '<div class="wh-tile"><b>'+big+'</b><span>'+small+'</span></div>';};
  var h='<div class="wh-tiles">';
  h+=st.few?tile('몇몇','단체 몇 곳이 올렸어요<br>정확한 수는 단체가 특정되지 않게 가려요')
    :st.show_count?tile(st.show_count+'번','단체 '+(st.troupe_count||0)+'곳이 올렸어요'+(st.first_year?'<br>'+st.first_year+(st.last_year!==st.first_year?'–'+st.last_year:'')+'년':''))
    :tile('0번','오리에 기록된 공연이 아직 없어요');
  h+=tile((st.wish_count||0)+'명','올리고 싶어해요'+(hub.requests?'<br>정식 신청 '+hub.requests+'곳':''));
  var g={};roles.forEach(function(r){var x=fld(r,'성별');if(x)g[x]=(g[x]||0)+1;});
  var gTxt=Object.keys(g).map(function(k){return k+' '+g[k];}).join(' · ');
  h+=roles.length?tile(roles.length+'명','등장인물'+(gTxt?'<br>'+escHtml(gTxt):'')):tile('—','등장인물 정보가 아직 없어요');
  var b=hub.budget;
  h+=b?tile(Math.round(b.median/10000).toLocaleString()+'만원','총예산 중앙값<br>프로젝트 '+b.n+'개 기준'):tile('—','비용 감은 프로젝트 3개가<br>모이면 보여드려요');
  h+='</div>';
  // 권리 정보: 운영자가 확인하고 공개하기로 한 작품만
  var rt=hub.rights;
  h+='<div class="wh-rights"><div class="wh-label">권리</div>';
  if(rt){
    h+='<div>'+[rt.type?escHtml(rt.type):'',rt.holder?'권리자 '+escHtml(rt.holder):''].filter(Boolean).join(' · ')+'</div>'
      +(WH_AMATEUR[rt.amateur]?'<div class="wh-strong">'+WH_AMATEUR[rt.amateur]+'</div>':'')
      +(rt.verified_at?'<div class="wh-sub">'+String(rt.verified_at).replace(/-/g,'.')+' 오리 확인</div>':'');
  }else h+='<div class="wh-sub">오리가 권리 정보를 확인하고 있어요. 올리고 싶다면 라이선스 문의를 남겨주세요. 문의가 모일수록 권리자에게 말하기 쉬워져요.</div>';
  h+='</div>';
  // 해본 극장: 공개된 공연에서만
  var vs={};shows.forEach(function(s){ids(fld(s,'극장')).forEach(function(v){vs[v]=(vs[v]||0)+1;});});
  var vids=Object.keys(vs).sort(function(a,c){return vs[c]-vs[a];});
  if(vids.length){
    h+='<div class="wh-rights"><div class="wh-label">해본 극장</div><div class="wh-venues">'+vids.slice(0,8).map(function(v){
      var ven=DB.venues.find(function(x){return x.id===v;});var seat=ven&&fld(ven,'좌석수');
      return '<span class="role-tag-chip link" data-action="venue" data-id="'+v+'">'+escHtml(nm(v))+(seat?' · '+seat+'석':'')+'</span>';
    }).join('')+'</div></div>';
  }
  h+='<div id="wh-demand-'+wid+'" class="wh-demand"></div>';
  h+='<div class="wh-acts">'+dvActBtn('라이선스 문의','openLicenseInquiry(\'\',\''+wid+'\')','✉️')+'</div>';
  el.innerHTML=h;
  renderDemandBox(wid);
}

/* ── 정식으로 올리고 싶어요 (수요 신청) ──
   시기·회차·조건을 남기면 오리가 같은 작품 신청을 묶어 권리자에게 대신 묻는다. 계약이 아니다.
   티켓 유료·출연료는 라이선스가 필요한지 가르는 기준(저작권법 29조)이라 꼭 묻는다. 서버: save_license_demand / withdraw_license_demand */
var _wd={};
function demandPeriods(){
  var y=new Date().getFullYear(),h=new Date().getMonth()<6?0:1,out=[];
  for(var i=0;i<5;i++){var k=h+i;out.push((y+Math.floor(k/2))+' '+(k%2?'하반기':'상반기'));}
  return out.concat(['미정']);
}
async function renderDemandBox(wid){
  var box=$('wh-demand-'+wid);if(!box||!CURRENT_USER)return;
  var r=await sbClient.from('license_demands').select('*').eq('work_id',wid).eq('user_id',CURRENT_USER.id).maybeSingle();
  _wd[wid]=r.data||null;
  var d=_wd[wid];
  if(d){
    var sum=[d.period,d.performance_count?d.performance_count+'회':'',d.ticket_type?'티켓 '+d.ticket_type:'',d.performers_paid?'출연료 '+d.performers_paid:''].filter(Boolean).join(' · ');
    box.innerHTML='<div class="wd-done"><div><b>정식 공연 신청을 남겼어요</b><div class="wh-sub">'+escHtml(sum||'조건 미정')+(d.troupe_id?' · '+escHtml(nm(d.troupe_id)):'')+'</div>'
      +'<div class="wh-sub">같은 작품 신청이 모이면 오리가 권리자에게 물어봐요. 언제든 고치거나 취소할 수 있어요.</div></div>'
      +'<div class="wd-btns"><button type="button" class="pf-btn" onclick="openDemandForm(\''+wid+'\')">고치기</button><button type="button" class="pf-btn" onclick="withdrawDemand(\''+wid+'\')">취소</button></div></div>';
  }else{
    box.innerHTML='<div class="wd-cta"><div><b>이 작품, 정식으로 올리고 싶나요?</b><div class="wh-sub">언제·몇 회쯤인지 남겨주세요. 같은 작품을 원하는 단체들의 신청을 묶어 오리가 권리자에게 대신 물어봐요. 신청이 계약은 아니에요.</div></div>'
      +'<button type="button" class="pf-btn pf-active" onclick="openDemandForm(\''+wid+'\')">정식으로 올리고 싶어요</button></div>';
  }
}
async function openDemandForm(wid){
  if(!CURRENT_USER){loginWithGoogle();return;}
  var box=$('wh-demand-'+wid);if(!box)return;
  var d=_wd[wid]||{};
  var tr=await sbClient.rpc('list_my_troupes');var troupes=tr.data||[];
  var opt=function(v,l,cur){return '<option value="'+escHtml(v)+'"'+(String(cur||'')===String(v)?' selected':'')+'>'+escHtml(l)+'</option>';};
  box.innerHTML='<div class="ts-form wd-form"><div class="ts-form-title">〈'+escHtml(nm(wid))+'〉 정식 공연 신청</div><div class="ts-grid">'
    +'<div class="edit-modal-field"><label>누구로</label><select id="wd-troupe">'+opt('','개인으로',d.troupe_id)+troupes.map(function(t){return opt(t.troupe_id,t.troupe_name,d.troupe_id);}).join('')+'</select></div>'
    +'<div class="edit-modal-field"><label>희망 시기</label><select id="wd-period">'+demandPeriods().map(function(p){return opt(p,p,d.period||demandPeriods()[1]);}).join('')+'</select></div>'
    +'<div class="edit-modal-field"><label>예상 회차</label><input type="number" min="1" id="wd-count" value="'+(d.performance_count||'')+'" placeholder="몇 번 올릴 예정인가요"></div>'
    +'<div class="edit-modal-field"><label>티켓</label>'+tsSeg('wd-ticket',[['유료','유료'],['무료','무료'],['미정','미정']],d.ticket_type||'미정')+'</div>'
    +'<div class="edit-modal-field"><label>출연료</label>'+tsSeg('wd-paid',[['지급','지급'],['없음','없음'],['미정','미정']],d.performers_paid||'미정')+'</div>'
    +'<div class="edit-modal-field ts-wide"><label>한마디 (선택)</label><input type="text" id="wd-note" value="'+escHtml(d.note||'').replace(/"/g,'&quot;')+'" placeholder="예: 대학 동아리 정기공연, 소극장 80석"></div>'
    +'</div><div class="ts-hint">티켓을 팔거나 출연료를 주면 라이선스가 꼭 필요해요. 둘 다 아니어도 번역·각색 대본은 허락이 따로 필요해요.</div>'
    +'<div class="ts-actions"><button class="pf-btn" onclick="renderDemandBox(\''+wid+'\')">닫기</button><button class="pf-btn pf-active" id="wd-save" onclick="saveDemand(\''+wid+'\')">신청 남기기</button></div>'
    +'<div id="wd-msg" class="ts-msg"></div></div>';
}
async function saveDemand(wid){
  var btn=$('wd-save'),msg=$('wd-msg');btn.disabled=true;msg.textContent='남기는 중…';
  var r=await sbClient.rpc('save_license_demand',{p_work_id:wid,p:{troupe_id:$('wd-troupe').value,period:$('wd-period').value,performance_count:$('wd-count').value,
    ticket_type:tsSegVal('wd-ticket'),performers_paid:tsSegVal('wd-paid'),note:$('wd-note').value}});
  if(r.error){msg.textContent='남기지 못했어요: '+r.error.message;btn.disabled=false;return;}
  await renderDemandBox(wid);
  oriAlert('신청을 남겼어요. 같은 작품 신청이 모이면 오리가 권리자에게 물어볼게요.');
}
async function withdrawDemand(wid){
  if(!await oriConfirm('이 작품 정식 공연 신청을 취소할까요?'))return;
  var r=await sbClient.rpc('withdraw_license_demand',{p_work_id:wid});
  if(r.error){oriAlert('취소하지 못했어요: '+r.error.message);return;}
  renderDemandBox(wid);
}