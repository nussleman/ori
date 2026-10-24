/* 오리 사이트 — 라이선스 (#licenses, 10/23 개정)
   오리가 관리하는 라이선스 = 운영자가 "권리 정보 공개"를 켜고 아마추어 라이선스가 '제공'·'협의가능'인 작품.
   들어오면 신청할 수 있는 작품이 카드로 쫙 뜨고(위 칩으로 거르기), 누르면 작품별 라이선스 화면(#license-<id>)에서
   MTI처럼 단계를 밟는다: ① 공연 정보 → ② 오리 검토 → ③ 권리자 승인·계약 → ④ 대본·자료 → ⑤ 공연·기록.
   ①은 기존 정식 공연 신청(save_license_demand, works.js openDemandForm)을 그대로 쓴다.
   목록에 없는 작품은 아래 "이 작품도 열어 주세요"에서 원해요(= 올리고 싶어요 wishlist)를 누르거나, 오리에 없는 작품이면 문의로.
   권리 정보는 서버 license_catalog가 공개 작품만 내보낸다. */
var LIC_STATUS={'제공':'바로 신청','협의가능':'협의 가능'};
var LIC_STEPS=[['공연 정보','언제·몇 회·티켓·출연료'],['오리 검토','조건 확인, 견적 안내'],['권리자 승인','계약서 서명'],['대본·자료','허락 범위의 대본·악보·음원'],['공연·기록','공연이 끝나면 아카이브에']];
var _lic={rows:[],byId:{},chip:'',q:'',want:{}};

async function loadLicenseCatalog(){
  var r=await sbClient.rpc('license_catalog');
  if(r.error)throw r.error;
  _lic.byId={};(r.data||[]).forEach(function(x){_lic.byId[x.work_id]=x;});
  _lic.rows=DB.works.filter(function(w){return fld(w,'작품명');}).map(function(w){return {w:w,c:_lic.byId[w.id]||{}};});
}
function licOpen(c){return !!(c&&c.rights_public&&LIC_STATUS[c.amateur]);}
function licRoles(wid){return DB.roles.filter(function(r){return ids(fld(r,'작품')).indexOf(wid)>-1;});}
function licGenre(w){var g=fld(w,'구분');return Array.isArray(g)?g.join(', '):(g||'');}
function licIsCreation(x){return x.c.rights_type==='창작';}

async function goLicenses(push){
  if(push!==false)history.pushState({view:'licenses'},'','#licenses');
  setNav('licenses');sb('');_sbContext='';mobShowDetail();
  mn('<div class="nx lic-nx"><h1 class="mine-title">라이선스</h1><div class="hf-loading">불러오는 중…</div></div>');
  try{await loadLicenseCatalog();}catch(e){if(location.hash==='#licenses')mn('<div class="nx lic-nx">'+loadFailHtml('라이선스 목록')+'</div>');return;}
  if(location.hash!=='#licenses')return;
  renderLicenses();
}
/* 위 칩: 거르기 */
var LIC_CHIPS=[['','전체'],['open','바로 신청'],['talk','협의 가능'],['musical','뮤지컬'],['play','연극'],['creation','창작'],['foreign','해외']];
function licChipMatch(x,k){
  if(!k)return true;
  var g=licGenre(x.w),country=String(fld(x.w,'국가')||'');
  if(k==='open')return x.c.amateur==='제공';
  if(k==='talk')return x.c.amateur==='협의가능';
  if(k==='musical')return g.indexOf('뮤지컬')>-1;
  if(k==='play')return g.indexOf('연극')>-1;
  if(k==='creation')return licIsCreation(x);
  if(k==='foreign')return country&&country.indexOf('한국')<0;
  return true;
}
function renderLicenses(){
  var open=_lic.rows.filter(function(x){return licOpen(x.c);});
  var chips=LIC_CHIPS.filter(function(c){return !c[0]||open.some(function(x){return licChipMatch(x,c[0]);});});
  if(!chips.some(function(c){return c[0]===_lic.chip;}))_lic.chip='';
  var list=open.filter(function(x){return licChipMatch(x,_lic.chip);}).sort(function(a,b){return (b.c.amateur==='제공'?1:0)-(a.c.amateur==='제공'?1:0)||String(fld(a.w,'작품명')).localeCompare(String(fld(b.w,'작품명')),'ko');});
  var h='<div class="nx lic-nx"><div class="mine-head"><h1 class="mine-title">라이선스</h1></div>'
    +(open.length?pchipsHtml(chips,_lic.chip,'licChip'):'')
;
  if(open.length)h+='<div class="opp-pgrid lic-grid">'+list.map(licCardHtml).join('')+'</div>';
  else h+='<div class="lic-empty"><div class="lic-empty-t">아직 문이 열린 작품이 없어요</div></div>';
  h+='<section class="lic-want" id="lic-want"></section></div>';
  mn(h);
  renderLicenseWant();
}
function licChip(k){_lic.chip=k;renderLicenses();}
function licCardHtml(x){
  var w=x.w,c=x.c,img=oppImage(w.id),roles=licRoles(w.id).length;
  var sub=[c.holder,roles?'등장인물 '+roles+'명':''].filter(Boolean).join(' · ');
  return '<div class="nx-card opp-pc lic-pc'+(img?'':' opp-pc-ph')+'" role="button" tabindex="0" onclick="goLicense(\''+w.id+'\')" onkeydown="if(event.key===\'Enter\')goLicense(\''+w.id+'\')" style="--tone:'+cardTone(w.id)+'">'
    +(img?'<img src="'+escHtml(img)+'" alt="" loading="lazy">':'<div class="nx-card-type"><span class="ph-icon">'+ico('book')+'</span></div>')
    +'<span class="opp-pc-kind lic-k-'+(c.amateur==='제공'?'open':'talk')+'">'+escHtml(LIC_STATUS[c.amateur])+'</span>'
    +'<div class="opp-pc-cap"><b>'+escHtml(fld(w,'작품명'))+'</b><span>'+escHtml(sub||licGenre(w)||'')+'</span>'
    +'<div class="opp-pc-foot"><span class="opp-pc-when">'+escHtml(c.request_count?'신청 '+c.request_count+'곳':licGenre(w))+'</span><span class="opp-apply">신청하기</span></div></div></div>';
}

/* ── 이 작품도 열어 주세요: 목록에 없는 작품에 원해요 ── */
function licWantCount(x){var base=x.c.wish_count||0,adj=_lic.want[x.w.id]||0;return Math.max(0,base+adj);}
function renderLicenseWant(){
  var el=$('lic-want');if(!el)return;
  el.innerHTML='<div class="lic-want-head"><h2 class="cat-all">이 작품도 열어 주세요</h2></div>'
    +'<div class="lic-search"><input type="text" id="lic-q" placeholder="작품 이름으로 찾기" value="'+escHtml(_lic.q)+'" oninput="_lic.q=this.value;renderLicenseWantList()"></div>'
    +'<div id="lic-want-list"></div>';
  renderLicenseWantList();
}
function renderLicenseWantList(){
  var el=$('lic-want-list');if(!el)return;
  var closed=_lic.rows.filter(function(x){return !licOpen(x.c);}),q=_lic.q.trim();
  var list=q?closed.filter(function(x){return String(fld(x.w,'작품명')).indexOf(q)>-1;}).slice(0,12)
    :closed.filter(function(x){return licWantCount(x);}).sort(function(a,b){return licWantCount(b)-licWantCount(a);}).slice(0,10);
  var head=q?'':'<div class="lic-want-cap">많이 원하는 작품</div>';
  var rows=list.map(function(x){
    var on=FAVORITES_SET.has('wishlist:work:'+x.w.id),n=licWantCount(x);
    return '<div class="lic-want-row"><span class="lic-want-name" data-action="work" data-id="'+x.w.id+'">'+escHtml(fld(x.w,'작품명'))+'</span>'
      +'<span class="lic-want-n">'+(n?n+'명이 원해요':'')+'</span>'
      +'<button type="button" class="lic-want-btn'+(on?' on':'')+'" aria-pressed="'+on+'" onclick="licWant(\''+x.w.id+'\',this)"><svg viewBox="0 0 24 24" width="16" height="16" fill="'+(on?'currentColor':'none')+'" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/></svg>'+'원해요'+'</button></div>';
  }).join('');
  el.innerHTML=head+(rows||'<div class="lic-want-none">'+(q?'"'+escHtml(q)+'"(은)는 오리에 아직 없는 작품이에요.':'아직 원해요가 없어요. 위에서 작품을 찾아 첫 번째로 남겨 보세요.')+'</div>')
    +'<button type="button" class="dv-textlink lic-inq" onclick="openLicenseInquiry(\'\',\'\')">오리에 없는 작품이에요 · 문의 남기기 ›</button>';
}
async function licWant(wid,btn){
  if(!CURRENT_USER){loginWithGoogle();return;}
  var key='wishlist:work:'+wid,was=FAVORITES_SET.has(key);
  btn.disabled=true;
  try{
    if(was)await sbOk(sbClient.from('favorites').delete().eq('user_id',CURRENT_USER.id).eq('target_type','work').eq('target_id',wid).eq('list_type','wishlist'));
    else await sbOk(sbClient.from('favorites').insert({user_id:CURRENT_USER.id,target_type:'work',target_id:wid,list_type:'wishlist'}));
  }catch(e){btn.disabled=false;oriAlert('남기지 못했어요: '+e.message);return;}
  if(was){FAVORITES_SET.delete(key);FAVORITES_LIST=FAVORITES_LIST.filter(function(f){return !(f.list_type==='wishlist'&&f.target_type==='work'&&f.target_id===wid);});}
  else{FAVORITES_SET.add(key);FAVORITES_LIST.push({target_type:'work',target_id:wid,list_type:'wishlist'});}
  _lic.want[wid]=(_lic.want[wid]||0)+(was?-1:1);
  renderLicenseWantList();
  if(!was)oriAlert('원해요를 남겼어요. 원하는 사람이 모이면 오리가 권리자에게 물어볼게요.');
}

/* ── 작품별 라이선스 화면 (#license-<id>): 작품 정보 + 단계 + 신청 ── */
async function goLicense(wid,push){
  if(push!==false)history.pushState({view:'license',id:wid},'','#license-'+wid);
  setNav('licenses');sb('');_sbContext='';mobShowDetail();
  if(!_lic.rows.length){mn('<div class="lic-page"><div class="hf-loading">불러오는 중…</div></div>');try{await loadLicenseCatalog();}catch(e){mn('<div class="lic-page">'+loadFailHtml('라이선스')+'</div>');return;}}
  var w=DB.works.find(function(x){return x.id===wid;});if(!w){mn('<div class="lic-page"><div class="result-empty">작품을 찾을 수 없어요.</div></div>');return;}
  await loadWorkStats();
  var c=_lic.byId[wid]||{},roles=licRoles(wid),st=WORK_STATS&&WORK_STATS[wid];
  var g={};roles.forEach(function(r){var x=fld(r,'성별');if(x)g[x]=(g[x]||0)+1;});
  var facts=[
    ['권리자',c.holder?escHtml(c.holder):'확인 중'],
    ['아마추어 라이선스',licOpen(c)?escHtml(LIC_STATUS[c.amateur]):'아직 열리지 않았어요'],
    ['등장인물',roles.length?roles.length+'명'+(Object.keys(g).length?' ('+Object.keys(g).map(function(k){return escHtml(k)+' '+g[k];}).join(' · ')+')':''):''],
    ['구분',escHtml([licGenre(w),fld(w,'국가'),fld(w,'초연 연도')?fld(w,'초연 연도')+' 초연':''].filter(Boolean).join(' · '))],
    ['오리 기록',st?(st.few?'몇몇 단체가 올렸어요':st.show_count?st.show_count+'번 올라감 · 단체 '+st.troupe_count+'곳':''):''],
    ['오리 확인',c.verified_at?String(c.verified_at).replace(/-/g,'.'):'']
  ].filter(function(f){return f[1];});
  var img=oppImage(wid);
  var h='<div class="lic-page"><div class="pj-crumb" role="navigation" aria-label="탐색 경로"><button type="button" class="pj-crumb-i" onclick="goLicenses()">라이선스</button><span class="pj-crumb-sep">/</span><span class="pj-crumb-i now" aria-current="page">'+escHtml(fld(w,'작품명'))+'</span></div>'
    +'<div class="lic-top">'
    +(img?'<img class="lic-poster" src="'+escHtml(img)+'" alt="">':'<div class="lic-poster lic-poster-ph">'+ico('book')+'</div>')
    +'<div class="lic-top-main"><div class="dv-kicker">라이선스'+(licOpen(c)?' · '+escHtml(LIC_STATUS[c.amateur]):'')+'</div>'
    +'<h1 class="lic-title">'+escHtml(fld(w,'작품명'))+'</h1>'
    +'<dl class="lic-facts">'+facts.map(function(f){return '<div><dt>'+f[0]+'</dt><dd>'+f[1]+'</dd></div>';}).join('')+'</dl>'
    +'<button type="button" class="dv-textlink" onclick="openDetail(\'work\',\''+wid+'\')">작품 페이지 보기 ›</button></div></div>'
    +'<section class="lic-apply"><h2 class="lic-h">라이선스 신청</h2>'
    +'<ol class="lic-track" id="lic-track-'+wid+'"></ol>'
    +'<div id="wh-demand-'+wid+'" class="lic-form"><div class="hf-loading">불러오는 중…</div></div>'
    +'</section></div>';
  mn(h);
  await renderDemandBox(wid);
  if(!_wd[wid])openDemandForm(wid);   // 처음이면 ① 공연 정보 칸을 바로 펼친다
  licTrack(wid);
}
/* 단계 표시: 신청 전 = ①, 신청 후 = ② 오리 검토 중 */
function licTrack(wid){
  var el=$('lic-track-'+wid);if(!el)return;
  var cur=_wd[wid]?1:0;
  el.innerHTML=LIC_STEPS.map(function(s,i){
    return '<li class="'+(i<cur?'done':i===cur?'now':'')+'"><span class="lic-dot">'+(i<cur?'✓':i+1)+'</span><span class="lic-tt"><b>'+s[0]+'</b><small>'+(i===cur&&cur===1?'신청을 받았어요 · 오리가 검토 중':s[1])+'</small></span></li>';
  }).join('');
}
/* works.js의 신청 저장·취소 뒤 단계 표시를 맞춘다 */
function licAfterDemand(wid){if($('lic-track-'+wid))licTrack(wid);}
