/* 오리 사이트 — 공통: 전역 상태, DOM 헬퍼, 화면 렌더(mn), Supabase REST 어댑터, 데이터 로드, 전역 검색, 유틸, 모달 */
var SUPABASE_URL=ORI_CONFIG.supabaseUrl;
var SUPABASE_ANON_KEY=ORI_CONFIG.supabaseAnonKey;
var DB={shows:[],people:[],history:[],roles:[],staffRoles:[],works:[],troupes:[],venues:[],creationHistory:[]};
var _sbContext=''; // 현재 목록 맥락 (shows, people …)
var MAP={},STAFF_ORDER={},ROLE_ORDER={},POSTER={},PERSON_PHOTO={};

/* ── DOM 헬퍼 ──
   상세 화면은 본문(#mn)과 우측 미리보기 패널(#peek-body) 두 곳에 그려질 수 있다.
   같은 화면이 양쪽에 동시에 떠 있으면 id가 겹치므로, _domScope가 가리키는 쪽을 먼저 찾는다.
   (_domScope는 패널에 그리는 동안, 그리고 패널 안에서 일어난 이벤트 처리 동안만 설정된다 — peek.js 참고) */
var _domScope=null;
function $(i){
  if(_domScope){var el=_domScope.querySelector('[id="'+i+'"]');if(el)return el;}
  return document.getElementById(i);
}
function $1(sel){return(_domScope||document).querySelector(sel);}
function $$(sel){return(_domScope||document).querySelectorAll(sel);}
function sb(h){$('sb').innerHTML=h;}
/* 화면 렌더: 평소엔 본문(#mn)에, 미리보기 패널을 그리는 중이면 패널에 넣는다.
   카드 클릭(한 번=패널, 두 번=전용 페이지)과 이미지 확대 처리는 peek.js의 이벤트 위임이 담당한다. */
function mn(h){
  if(PEEK.rendering){$('peek-body').innerHTML=h;return;}
  $('mn').innerHTML=h;
}
function openLightbox(src){
  var lb=$('lightbox'),img=$('lightbox-img');
  if(!lb||!img)return;
  img.src=src;
  lb.classList.add('open');
}
function closeLightbox(){var lb=$('lightbox');if(lb)lb.classList.remove('open');}
document.addEventListener('keydown',function(e){
  if(e.key!=='Escape')return;
  var lb=$('lightbox');
  if(lb&&lb.classList.contains('open'))closeLightbox();else closePeek();
});
function fld(r,k){return(r&&r.fields&&r.fields[k]!==undefined)?r.fields[k]:null;}
function ids(v){if(!v||!Array.isArray(v))return[];return v.map(function(x){return typeof x==='string'?x:x.id;});}
function nm(id){return MAP[id]||'';}
function iurl(imgs){if(!imgs||!imgs[0])return '';return(imgs[0].thumbnails&&imgs[0].thumbnails.large)?imgs[0].thumbnails.large.url:imgs[0].url;}

/* ══ Supabase REST 어댑터 ══
   아래 rest()로 원본 테이블을 읽어와서, 기존 렌더링 코드가 기대하는
   Airtable 레코드 모양({id, fields:{한글필드명:값}})으로 그대로 변환한다.
   이렇게 하면 이 블록 밖의 1000줄 넘는 화면 코드는 전혀 손댈 필요가 없다. */
async function rest(table, query){
  var token=(CURRENT_SESSION&&CURRENT_SESSION.access_token)||SUPABASE_ANON_KEY;
  var url=SUPABASE_URL+'/rest/v1/'+table+'?'+(query||'select=*')+'&limit=5000';
  var r=await fetch(url,{headers:{apikey:SUPABASE_ANON_KEY,Authorization:'Bearer '+token}});
  if(!r.ok)throw new Error(table+' 로드 실패: '+r.status);
  return await r.json();
}
function photoField(urls){return(urls&&urls.length)?urls.map(function(u){return{url:u};}):null;}
function groupBy(rows,key){
  var m={};
  rows.forEach(function(r){(m[r[key]]=m[r[key]]||[]).push(r);});
  return m;
}

async function load(){
  var raw=await Promise.all([
    rest('shows','select=id,title,show_date,end_date,troupe_id,venue_id,work_id,poster_urls,audience_count,is_sold_out,has_rerun,is_licensed,is_hidden'+((window.isEditMode&&isEditMode())?'':'&is_hidden=is.false')),
    rest('people','select=id,name,photo_urls,social_links'),
    rest('participation_history','select=id,person_id,show_id,photo_urls'),
    rest('participation_roles','select=participation_id,role_id'),
    rest('participation_staff_roles','select=participation_id,staff_role_id'),
    rest('roles','select=id,name,order_num,gender,work_id,tags,photo_urls'),
    rest('staff_roles','select=id,name,order_num'),
    rest('works','select=id,title,title_en,genre,country,premiere_year,tags,poster_urls'),
    rest('troupes','select=id,name,org_type,member_base,photo_urls,status,region,founded_year,recruiting_info,social_links'),
    rest('venues','select=id,name,seat_count,seat_count_max,photo_urls,rental_fee,rental_available,contact,parking_available,transit_info'),
    rest('creation_history','select=id,work_id,person_id'),
    rest('app_settings','select=key,value'),
  ]);
  var shows=raw[0],people=raw[1],partHist=raw[2],partRoles=raw[3],
      partStaff=raw[4],roles=raw[5],staffRoles=raw[6],works=raw[7],troupes=raw[8],venues=raw[9],creationHist=raw[10],appSettings=raw[11];

  var settingsMap={};
  (appSettings||[]).forEach(function(s){settingsMap[s.key]=s.value;});

  var roleIdsByPart=groupBy(partRoles,'participation_id');
  var staffIdsByPart=groupBy(partStaff,'participation_id');

  DB.works=works.map(function(w){return{id:w.id,fields:{
    '작품명':w.title,'작품명 (영문)':w.title_en,'국가':w.country,'구분':w.genre,'초연 연도':w.premiere_year,'태그':w.tags||[],'사진':photoField(w.poster_urls)
  }};});
  DB.roles=roles.map(function(r){return{id:r.id,fields:{
    '배역명':r.name,'순서':r.order_num,'성별':r.gender,'작품':r.work_id?[r.work_id]:[],'태그':r.tags||[],'사진':photoField(r.photo_urls)
  }};});
  DB.staffRoles=staffRoles.map(function(s){return{id:s.id,fields:{'Name':s.name,'순서':s.order_num}};});
  DB.troupes=troupes.map(function(t){return{id:t.id,fields:{'극단명':t.name,'조직형태':t.org_type,'구성원기반':t.member_base,'수준':t.level,'사진':photoField(t.photo_urls),
    '운영상태':t.status,'활동지역':t.region,'창단연도':t.founded_year,'모집정보':t.recruiting_info,'주요링크':t.social_links||[]
  }};});
  DB.venues=venues.map(function(v){return{id:v.id,fields:{'극장명':v.name,'좌석수':v.seat_count,'좌석수_최대':v.seat_count_max,'사진':photoField(v.photo_urls),
    '대관료':v.rental_fee,'대관가능여부':v.rental_available,'연락처':v.contact,'주차가능여부':v.parking_available,'대중교통정보':v.transit_info
  }};});
  DB.people=people.map(function(p){return{id:p.id,fields:{'이름':p.name,'사진':photoField(p.photo_urls),'홍보링크':p.social_links||[]}};});
  DB.creationHistory=creationHist.map(function(c){return{id:c.id,fields:{'창작자':c.person_id?[c.person_id]:[],'작품':c.work_id?[c.work_id]:[]}};});
  DB.shows=shows.map(function(s){return{id:s.id,fields:{
    '공연명':s.title,'공연 날짜':s.show_date,'종료일':s.end_date,
    '극단':s.troupe_id?[s.troupe_id]:[],'극장':s.venue_id?[s.venue_id]:[],
    '작품':s.work_id?[s.work_id]:[],
    '포스터':photoField(s.poster_urls),
    '관객수':s.audience_count,'매진여부':s.is_sold_out,'재공연여부':s.has_rerun,
    '라이선스상태':s.is_licensed,'숨김':!!s.is_hidden
  }};});
  // 공개 기준: 라이선스가 해결된 공연만 다룬다 — 창작(자체 창작) 또는 완료(라이선스 확보).
  // 미확보·미상(아직 분류 안 됨)은 사이트 어디에도 나오지 않는다. 분류는 어드민 > 계정·설정 > 설정.
  // 관리자 편집 모드(edit.js)에서는 고칠 수 있게 비공개 공연·사람까지 모두 불러온다.
  var EDITING=!!(window.isEditMode&&isEditMode());
  if(!EDITING)DB.shows=DB.shows.filter(function(s){var l=fld(s,'라이선스상태');return l==='창작'||l==='완료';});
  var visibleShowIds={};
  DB.shows.forEach(function(s){visibleShowIds[s.id]=true;});
  partHist=partHist.filter(function(ph){return visibleShowIds[ph.show_id];});

  // 참여이력 한 행이 배역+스텝을 동시에 가질 수 있으므로(겸직),
  // 기존 화면 코드(역할타입=배우/스텝 단일값 기대)에 맞춰 겸직 시 두 행으로 나눠 합성한다.
  DB.history=[];
  partHist.forEach(function(ph){
    var roleIds=(roleIdsByPart[ph.id]||[]).map(function(x){return x.role_id;});
    var staffIds=(staffIdsByPart[ph.id]||[]).map(function(x){return x.staff_role_id;});
    var photoFields=photoField(ph.photo_urls);
    if(roleIds.length){
      DB.history.push({id:ph.id+'-actor',fields:{'참여자':[ph.person_id],'공연':[ph.show_id],'역할 타입':'배우','배역':roleIds,'사진':photoFields}});
    }
    if(staffIds.length){
      DB.history.push({id:ph.id+'-staff',fields:{'참여자':[ph.person_id],'공연':[ph.show_id],'역할 타입':'스텝','스텝':staffIds,'사진':photoFields}});
    }
    if(!roleIds.length&&!staffIds.length){
      DB.history.push({id:ph.id,fields:{'참여자':[ph.person_id],'공연':[ph.show_id],'사진':photoFields}});
    }
  });

  var visiblePeople={};
  DB.history.forEach(function(h){ids(fld(h,'참여자')).forEach(function(p){visiblePeople[p]=true;});});
  DB.creationHistory.forEach(function(c){ids(fld(c,'창작자')).forEach(function(p){visiblePeople[p]=true;});});
  if(CURRENT_USER&&CURRENT_USER.personId)visiblePeople[CURRENT_USER.personId]=true;
  if(!EDITING)DB.people=DB.people.filter(function(p){return visiblePeople[p.id];});

  MAP={};
  DB.shows.forEach(function(r){MAP[r.id]=fld(r,'공연명')||'';});
  DB.people.forEach(function(r){MAP[r.id]=fld(r,'이름')||'';});
  DB.roles.forEach(function(r){MAP[r.id]=fld(r,'배역명')||'';});
  DB.staffRoles.forEach(function(r){MAP[r.id]=fld(r,'Name')||'';});
  DB.works.forEach(function(r){MAP[r.id]=fld(r,'작품명')||'';});
  DB.troupes.forEach(function(r){MAP[r.id]=fld(r,'극단명')||'';});
  DB.venues.forEach(function(r){MAP[r.id]=fld(r,'극장명')||'';});
  POSTER={};
  DB.shows.forEach(function(r){var u=iurl(fld(r,'포스터'));if(u)POSTER[r.id]=u;});
  PERSON_PHOTO={};
  DB.people.forEach(function(r){var u=iurl(fld(r,'사진'));if(u)PERSON_PHOTO[r.id]=u;});
  STAFF_ORDER={};
  DB.staffRoles.forEach(function(r){var o=fld(r,'순서');if(o!=null)STAFF_ORDER[r.id]=o;});
  ROLE_ORDER={};
  var roleOrderCandidates=['순서','배역 순서','번호','배역번호','순번','Order','order'];
  var roleOrderField=roleOrderCandidates.find(function(key){
    return DB.roles.some(function(r){return fld(r,key)!=null;});
  });
  if(roleOrderField){
    DB.roles.forEach(function(r){var o=fld(r,roleOrderField);if(o!=null)ROLE_ORDER[r.id]=o;});
  }
}

/* ══ 전역 검색 ══ */
var _gsComposing=false,_gsFocusIdx=-1,_gsItems=[];
document.addEventListener('DOMContentLoaded',function(){
  var inp=$('gs-input');if(!inp)return;
  inp.addEventListener('compositionstart',function(){_gsComposing=true;});
  inp.addEventListener('compositionend',function(){_gsComposing=false;gsInput();});
});
function gsInput(){
  if(_gsComposing)return;
  var q=($('gs-input')||{value:''}).value.trim();
  var cl=$('gs-clear');if(cl)cl.classList.toggle('vis',q.length>0);
  if(!q){gsClose();return;}
  gsRender(q);
}
function gsOpen(){var q=($('gs-input')||{value:''}).value.trim();if(q)gsRender(q);}
function gsClear(){var inp=$('gs-input');if(inp)inp.value='';var cl=$('gs-clear');if(cl)cl.classList.remove('vis');gsClose();if(inp)inp.focus();}
function gsClose(){var d=$('gs-dropdown');if(d){d.classList.remove('open');d.innerHTML='';}  _gsFocusIdx=-1;_gsItems=[];}
function gsRender(q){
  var d=$('gs-dropdown');if(!d)return;
  var results=[];
  DB.shows.filter(function(s){return(fld(s,'공연명')||'').includes(q);}).slice(0,4).forEach(function(s){var trid=ids(fld(s,'극단'))[0]||'';results.push({type:'show',id:s.id,icon:'🎭',name:fld(s,'공연명'),sub:nm(trid)||fld(s,'공연 날짜')||''});});
  DB.people.filter(function(p){return(fld(p,'이름')||'').includes(q);}).slice(0,4).forEach(function(p){var cnt=DB.history.filter(function(h){return isValidH(h)&&ids(fld(h,'참여자')).indexOf(p.id)>-1;}).length;results.push({type:'person',id:p.id,icon:'👤',name:fld(p,'이름'),sub:cnt+'개 이력'});});
  DB.works.filter(function(w){return(fld(w,'작품명')||'').includes(q);}).slice(0,3).forEach(function(w){var cnt=DB.shows.filter(function(s){return ids(fld(s,'작품')).indexOf(w.id)>-1;}).length;results.push({type:'work',id:w.id,icon:'📖',name:fld(w,'작품명'),sub:'공연 '+cnt+'개'});});
  DB.troupes.filter(function(t){return(fld(t,'극단명')||'').includes(q);}).slice(0,3).forEach(function(t){var cnt=DB.shows.filter(function(s){return ids(fld(s,'극단')).indexOf(t.id)>-1;}).length;results.push({type:'troupe',id:t.id,icon:'🏢',name:fld(t,'극단명'),sub:'공연 '+cnt+'개'});});
  DB.venues.filter(function(v){return(fld(v,'극장명')||'').includes(q);}).slice(0,3).forEach(function(v){var cnt=DB.shows.filter(function(s){return ids(fld(s,'극장')).indexOf(v.id)>-1;}).length;results.push({type:'venue',id:v.id,icon:'📍',name:fld(v,'극장명'),sub:'공연 '+cnt+'개'});});
  DB.roles.filter(function(r){return(fld(r,'배역명')||'').includes(q);}).slice(0,4).forEach(function(r){var wid=ids(fld(r,'작품'))[0]||'';var actCnt=DB.history.filter(function(h){return isValidH(h)&&ids(fld(h,'배역')).indexOf(r.id)>-1;}).length;results.push({type:'role',id:r.id,icon:'🎬',name:fld(r,'배역명'),sub:(nm(wid)?nm(wid)+' · ':'')+actCnt+'명 출연'});});
  if(CURRENT_USER){
    MY_PROJECTS_CACHE.filter(function(p){return(p.title||'').includes(q);}).slice(0,3).forEach(function(p){results.push({type:'project',id:p.id,icon:'🎪',name:p.title||'새 프로젝트',sub:'내 프로젝트'});});
  }
  _gsItems=results;_gsFocusIdx=-1;
  if(!results.length){d.innerHTML='<div class="gs-empty">검색 결과 없음</div>';d.classList.add('open');return;}
  var typeLabel={show:'공연',person:'사람',work:'작품',troupe:'단체',venue:'극장',role:'배역',project:'내 프로젝트'};
  var lastType='';var html='';
  results.forEach(function(item,i){
    if(item.type!==lastType){if(lastType)html+='<div class="gs-divider"></div>';html+='<div class="gs-group-label">'+typeLabel[item.type]+'</div>';lastType=item.type;}
    html+='<div class="gs-item" data-idx="'+i+'" onmousedown="gsSelect('+i+')">'+'<span class="gs-item-icon">'+item.icon+'</span>'+'<div class="gs-item-main">'+'<div class="gs-item-name">'+item.name+'</div>'+(item.sub?'<div class="gs-item-sub">· '+item.sub+'</div>':'')+'</div></div>';
  });
  d.innerHTML=html;d.classList.add('open');
}
function gsSelect(idx){
  var item=_gsItems[idx];if(!item)return;
  gsClose();var inp=$('gs-input');if(inp)inp.value='';var cl=$('gs-clear');if(cl)cl.classList.remove('vis');
  if(item.type==='show')showShow(item.id);
  else if(item.type==='person')showPerson(item.id);
  else if(item.type==='work')showWork(item.id);
  else if(item.type==='troupe')showTroupe(item.id);
  else if(item.type==='venue')showVenue(item.id);
  else if(item.type==='role')showRole(item.id);
  else if(item.type==='project')goProject(item.id);
}
function gsKeydown(e){
  var d=$('gs-dropdown');if(!d||!d.classList.contains('open'))return;
  if(e.key==='ArrowDown'){e.preventDefault();_gsFocusIdx=Math.min(_gsFocusIdx+1,_gsItems.length-1);gsHighlight();}
  else if(e.key==='ArrowUp'){e.preventDefault();_gsFocusIdx=Math.max(_gsFocusIdx-1,0);gsHighlight();}
  else if(e.key==='Enter'){e.preventDefault();if(_gsFocusIdx>=0)gsSelect(_gsFocusIdx);else if(_gsItems.length===1)gsSelect(0);}
  else if(e.key==='Escape'){gsClose();}
}
function gsHighlight(){var d=$('gs-dropdown');if(!d)return;d.querySelectorAll('.gs-item').forEach(function(el){el.classList.toggle('focused',parseInt(el.dataset.idx)===_gsFocusIdx);});}
document.addEventListener('click',function(e){var wrap=$('gs-wrap');if(wrap&&!wrap.contains(e.target))gsClose();});

/* ══ 유틸 ══ */
function sortShows(arr){return arr.slice().sort(function(a,b){var da=fld(a,'공연 날짜')||'',db=fld(b,'공연 날짜')||'';if(!da&&!db)return 0;if(!da)return 1;if(!db)return -1;return db.localeCompare(da);});}
function showDate(sid){var s=DB.shows.find(function(x){return x.id===sid;});if(!s)return '';var candidates=['공연 날짜','날짜','공연일자','공연일','공연날짜','Date','date'];for(var i=0;i<candidates.length;i++){var v=fld(s,candidates[i]);if(v)return v;}return '';}
function sortHistByShowDate(arr){return arr.slice().sort(function(a,b){var da=showDate(ids(fld(a,'공연'))[0]||''),db=showDate(ids(fld(b,'공연'))[0]||'');if(!da&&!db)return 0;if(!da)return 1;if(!db)return -1;return db.localeCompare(da);});}
function ym(dateStr){if(!dateStr)return '';var m=dateStr.match(/^(\d{4})-(\d{2})/);return m?(m[1]+'.'+m[2]):dateStr;}
function detectLinkPlatform(url){
  var host='';
  try{host=new URL(url).hostname.replace(/^www\./,'').toLowerCase();}catch(e){return null;}
  var table=[
    [/instagram\.com/,'Instagram','📷'],
    [/(youtube\.com|youtu\.be)/,'YouTube','▶'],
    [/(twitter\.com|x\.com)/,'X','𝕏'],
    [/facebook\.com/,'Facebook','f'],
    [/blog\.naver\.com/,'네이버 블로그','📝'],
    [/tiktok\.com/,'TikTok','🎵'],
    [/threads\.net/,'Threads','@'],
    [/open\.kakao\.com|pf\.kakao\.com/,'카카오채널','💬'],
    [/linktr\.ee/,'Linktree','🔗'],
    [/vimeo\.com/,'Vimeo','▶'],
  ];
  for(var i=0;i<table.length;i++){if(table[i][0].test(host))return {name:table[i][1],icon:table[i][2]};}
  return null;
}
function linkLabel(l){
  var detected=detectLinkPlatform(l.url);
  if(detected)return detected.icon+' '+detected.name;
  return l.label||'링크';
}
function yearOf(dateStr){if(!dateStr)return '';var m=dateStr.match(/^(\d{4})/);return m?m[1]:'';}
function isValidH(h){return ids(fld(h,'참여자')).length>0;}
function histByShow(sid){return DB.history.filter(function(h){return isValidH(h)&&ids(fld(h,'공연')).indexOf(sid)>-1;});}
function histByPerson(pid){return DB.history.filter(function(h){return isValidH(h)&&ids(fld(h,'참여자')).indexOf(pid)>-1;});}
function tname(h){var t=fld(h,'역할 타입');return t?(typeof t==='string'?t:t.name||''):'';}
function isMobile(){return window.innerWidth<=768;}
function mobShowDetail(){var a=$('sb');if(a)a.classList.add('mob-hidden');}
function injectBackBtn(label,fn){
  if(PEEK.rendering||!isMobile())return;
  var m=$('mn');if(!m)return;
  var btn=document.createElement('button');btn.className='mob-back-btn';btn.innerHTML='← '+label;btn.onclick=fn;
  m.insertBefore(btn,m.firstChild);
}
/* 현재 화면을 메뉴에 표시한다.
   두 모드: 둘러보기(아카이브 탐색) / 만들기(내 프로젝트 운영). 모드마다 좌측 메뉴·상단 요소가 다르다.
   v: home(첫 화면) · shows·works·people·troupes·venues·roles·projects·dashboard (둘러보기)
      make·project (만들기) / 그 밖(mypage 등)은 둘러보기 모드, 메뉴 선택 없음
   projectId: 만들기 모드에서 좌측 목록 중 열린 프로젝트 */
var MAKE_MODE_VIEWS=['make','project'];
function setNav(v,projectId){
  if(PEEK.rendering)return; // 패널 미리보기는 현재 메뉴 상태를 바꾸지 않는다
  closePeek();
  var make=MAKE_MODE_VIEWS.indexOf(v)>-1;
  document.body.classList.toggle('mode-make',make);
  document.body.classList.toggle('is-home',v==='home');
  var mb=$('mode-browse'),mm=$('mode-make');
  if(mb){mb.classList.toggle('active',!make);mb.setAttribute('aria-selected',String(!make));}
  if(mm){mm.classList.toggle('active',make);mm.setAttribute('aria-selected',String(make));}
  ['home','shows','people','works','roles','venues','troupes','dashboard','projects','make'].forEach(function(n){
    var el=$('nav-'+n);if(el)el.classList.toggle('active',n===v);
    var mel=$('mobt-'+n);if(mel)mel.classList.toggle('active',n===v||(n==='make'&&make));
  });
  window._currentProjectNav=v==='project'?projectId:null;
  document.querySelectorAll('#make-nav-projects button').forEach(function(b){b.classList.toggle('active',b.dataset.pid===window._currentProjectNav);});
  // 첫 화면에서는 검색창이 화면 가운데(home.js)로 옮겨가 있다 — 다른 화면에선 상단바로 되돌린다
  if(v!=='home'){var wrap=$('gs-wrap'),bar=$('top-bar');if(wrap&&bar&&wrap.parentNode!==bar)bar.appendChild(wrap);}
  if(window.edSyncFab)edSyncFab(v);
}
/* ── 오리 스타일 모달 (네이티브 alert/confirm/prompt 대체) ── */
var _oriModalResolve=null;
function _oriModalClose(result){
  $('ori-modal-overlay').classList.remove('open');
  var r=_oriModalResolve;_oriModalResolve=null;
  if(r)r(result);
}
function oriAlert(message){
  return new Promise(function(resolve){
    _oriModalResolve=resolve;
    $('ori-modal-message').textContent=message;
    $('ori-modal-input-field').style.display='none';
    $('ori-modal-actions').style.flexDirection='row';
    $('ori-modal-actions').innerHTML='<button class="pf-btn pf-active" style="width:100%" onclick="_oriModalClose(true)">확인</button>';
    $('ori-modal-overlay').classList.add('open');
  });
}
function oriConfirm(message){
  return new Promise(function(resolve){
    _oriModalResolve=resolve;
    $('ori-modal-message').textContent=message;
    $('ori-modal-input-field').style.display='none';
    $('ori-modal-actions').style.flexDirection='row';
    $('ori-modal-actions').innerHTML='<button class="pf-btn" style="flex:1" onclick="_oriModalClose(false)">취소</button><button class="pf-btn pf-active" style="flex:1" onclick="_oriModalClose(true)">확인</button>';
    $('ori-modal-overlay').classList.add('open');
  });
}
function oriPrompt(message,defaultValue){
  return new Promise(function(resolve){
    _oriModalResolve=resolve;
    $('ori-modal-message').textContent=message;
    $('ori-modal-input-field').style.display='block';
    $('ori-modal-input').value=defaultValue||'';
    $('ori-modal-actions').style.flexDirection='row';
    $('ori-modal-actions').innerHTML='<button class="pf-btn" style="flex:1" onclick="_oriModalClose(null)">취소</button><button class="pf-btn pf-active" style="flex:1" onclick="_oriModalClose($(\'ori-modal-input\').value)">확인</button>';
    $('ori-modal-overlay').classList.add('open');
    setTimeout(function(){$('ori-modal-input').focus();},50);
  });
}
async function submitLicenseInquiry(){
  var message=$('license-inquiry-message').value.trim();
  if(!message){$('license-inquiry-msg').textContent='문의 내용을 적어주세요.';return;}
  try{
    await sbClient.from('license_inquiries').insert({
      show_id:_licenseInquiryCtx?_licenseInquiryCtx.showId:null,
      work_id:_licenseInquiryCtx?_licenseInquiryCtx.workId:null,
      user_id:CURRENT_USER.id,
      message:message,
      contact:$('license-inquiry-contact').value.trim()||null
    });
    $('license-inquiry-msg').textContent='보냈어요! 확인 후 안내드릴게요.';
    setTimeout(closeLicenseInquiry,1200);
  }catch(e){$('license-inquiry-msg').textContent='전송 실패: '+e.message;}
}
function goTerms(push){
  if(push!==false)history.pushState({view:'terms'},'','#terms');
  setNav('');sb('');_sbContext='';mobShowDetail();
  mn('<div class="tab-index legal-doc"><div class="detail-header"><div class="eyebrow">약관</div><div class="detail-title">이용약관</div><div class="detail-meta"><span>시행일: 2026년 8월</span></div></div>'
    +'<div class="legal-body">'
    +'<h4>1. 서비스의 목적과 성격</h4>'
    +'<p>오리(이하 "서비스")는 프로와 아마추어를 가리지 않고 연극/뮤지컬 공연 이력을 기록하는 비영리 성격의 공연 아카이브입니다. 사람·극장·작품 등으로 이어지는 공연 이력을 누구나 쉽게 찾아볼 수 있게 하고, 새로 공연을 만들려는 사람이 기획부터 라이선스 확보, 제작, 운영까지 서비스 안에서 준비할 수 있도록 돕는 것을 목적으로 합니다. 서비스는 현재 1인이 운영하고 있으며, 사전 고지 없이 기능이 변경되거나 서비스가 중단될 수 있습니다.</p>'
    +'<h4>2. 게시된 정보의 성격과 책임 소재</h4>'
    +'<p>서비스에 게시된 공연·작품·단체 정보는 운영자가 조사하거나 이용자가 제공한 정보를 정리한 것입니다. 실제 공연의 저작권·라이선스 확보 여부는 해당 공연을 기획·제작한 단체 또는 개인의 책임이며, 서비스는 이를 보증하지 않습니다.</p>'
    +'<h4>3. 저작권 침해 신고 및 처리</h4>'
    +'<p>본인의 저작권이 침해되었다고 판단되는 게시물을 발견한 경우, 각 공연 상세페이지의 "저작권 문제 신고" 기능을 통해 신고할 수 있습니다. 신고가 접수되면 사실관계 확인 전이라도 해당 게시물은 즉시 비공개 처리되며, 운영자가 이후 내용을 검토합니다. 신고는 로그인한 이용자라면 누구나 할 수 있습니다.</p>'
    +'<h4>4. 이용자가 등록하는 콘텐츠</h4>'
    +'<p>이용자가 직접 등록하는 사진, 자기소개 등의 콘텐츠에 대한 책임은 등록한 본인에게 있습니다. 타인의 권리를 침해하거나 부적절한 콘텐츠는 운영자가 사전 통지 없이 삭제할 수 있습니다.</p>'
    +'<h4>5. 계정</h4>'
    +'<p>서비스는 구글 계정으로 로그인합니다. 실명 사용 의무는 없으며, 별도의 닉네임을 설정할 수 있습니다.</p>'
    +'<h4>6. 문의</h4>'
    +'<p>서비스 관련 문의, 정정 요청, 저작권 관련 사항은 <a href="mailto:gksxowns@gmail.com">gksxowns@gmail.com</a>으로 연락 주세요.</p>'
    +'</div></div>');
}
function goPrivacy(push){
  if(push!==false)history.pushState({view:'privacy'},'','#privacy');
  setNav('');sb('');_sbContext='';mobShowDetail();
  mn('<div class="tab-index legal-doc"><div class="detail-header"><div class="eyebrow">약관</div><div class="detail-title">개인정보처리방침</div><div class="detail-meta"><span>시행일: 2026년 8월</span></div></div>'
    +'<div class="legal-body">'
    +'<h4>1. 수집하는 개인정보 항목</h4>'
    +'<p>구글 로그인을 통해 이메일 주소를 수집합니다. 그 외 닉네임, 자기소개, 연락처, 프로필 사진은 이용자가 마이페이지에서 직접 입력할 때만 수집되며, 모두 선택 항목입니다.</p>'
    +'<h4>2. 수집 목적</h4>'
    +'<p>로그인 및 본인 확인, 즐겨찾기·위시리스트 등 개인화 기능 제공, 공연 프로젝트 협업 기능(연락처는 참여 요청이 승인된 경우에 한해 상대방에게 노출될 수 있음)을 위해 사용합니다.</p>'
    +'<h4>3. 보관 및 파기</h4>'
    +'<p>회원 탈퇴 시 계정 정보(이메일, 닉네임, 자기소개, 연락처, 즐겨찾기, 프로젝트 등)는 즉시 삭제됩니다. 단, 이용자가 사람(참여자) 레코드에 연결한 경우, 그 사람의 공연 참여이력 자체는 서비스의 아카이브 목적상 계정 삭제 후에도 유지되며 계정과의 연결만 해제됩니다.</p>'
    +'<h4>4. 제3자 제공</h4>'
    +'<p>수집한 개인정보를 외부에 제공하지 않습니다. 데이터는 Supabase(데이터베이스·인증), Google(로그인)을 통해 처리됩니다.</p>'
    +'<h4>5. 이용자의 권리</h4>'
    +'<p>마이페이지 &gt; 내 정보에서 언제든 본인 정보를 열람·수정할 수 있고, 같은 곳에서 회원 탈퇴(삭제 요청)를 할 수 있습니다.</p>'
    +'<h4>6. 문의</h4>'
    +'<p>개인정보 관련 문의는 <a href="mailto:gksxowns@gmail.com">gksxowns@gmail.com</a>으로 연락 주세요.</p>'
    +'</div></div>');
}
