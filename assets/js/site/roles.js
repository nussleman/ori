/* 오리 사이트 — 배역 목록·상세 */
/* ══ 배역 인덱스 ══ */
var _roleFilter={work:'all',gender:'',minAct:0,tags:[]};
var _roleIndexView='grid';
var _roleWorkOptions=[];

function goRoles(push){
  if(push!==false)history.pushState({view:'roles'},'','#roles');
  setNav('roles');_sbContext='roles';  _allRoles=DB.roles.filter(function(r){return fld(r,'배역명');}).sort(function(a,b){
    var oa=ROLE_ORDER[a.id],ob=ROLE_ORDER[b.id];
    if(oa==null&&ob==null){var wa=ids(fld(a,'작품'))[0]||'',wb=ids(fld(b,'작품'))[0]||'';return wa.localeCompare(wb);}
    if(oa==null)return 1;if(ob==null)return -1;return oa-ob;
  });
  _roleFilter={work:'all',gender:'',minAct:0,tags:[]};renderRoleIndex();
}

function roleWorkFilterInput(q){
  var dd=document.getElementById('role-work-filter-dropdown');
  if(!dd)return;
  var query=(q||'').trim().toLowerCase();
  var matches=_roleWorkOptions.filter(function(w){return !query||w.name.toLowerCase().includes(query);}).slice(0,50);
  if(!matches.length){dd.innerHTML='<div class="gs-empty">검색 결과 없음</div>';}
  else{
    dd.innerHTML=matches.map(function(w){return '<div class="gs-item" onmousedown="selectRoleWorkFilter(\''+w.id+'\')"><div class="gs-item-main"><div class="gs-item-name">'+w.name+'</div></div></div>';}).join('');
  }
  dd.classList.add('open');
}
function roleWorkFilterFocus(){var inp=document.getElementById('role-work-filter-input');roleWorkFilterInput(inp?inp.value:'');}
function selectRoleWorkFilter(wid){
  _roleFilter.work=wid;
  renderRoleIndex();
}
function clearRoleWorkFilter(){
  _roleFilter.work='all';
  renderRoleIndex();
}
document.addEventListener('click',function(e){
  var wrap=document.getElementById('role-work-filter-wrap');
  var dd=document.getElementById('role-work-filter-dropdown');
  if(wrap&&dd&&!wrap.contains(e.target))dd.classList.remove('open');
});
function toggleRoleTagFilter(t){
  var arr=_roleFilter.tags;var idx=arr.indexOf(t);
  if(idx>-1)arr.splice(idx,1);else arr.push(t);
  renderRoleIndex();
}

function renderRoleIndex(){
  var workSet={};
  _allRoles.forEach(function(r){var wid=ids(fld(r,'작품'))[0]||'';if(wid&&nm(wid))workSet[wid]=nm(wid);});
  var workIds=Object.keys(workSet).sort(function(a,b){return workSet[a].localeCompare(workSet[b]);});
  _roleWorkOptions=workIds.map(function(wid){return{id:wid,name:workSet[wid]};});

  // 성별 옵션 수집
  var genderSet={};
  _allRoles.forEach(function(r){var g=fld(r,'성별')||fld(r,'젠더')||'';if(g)genderSet[g]=true;});
  var genders=Object.keys(genderSet).sort();

  // 태그 옵션 수집
  var tagSet={};
  _allRoles.forEach(function(r){(fld(r,'태그')||[]).forEach(function(t){if(t)tagSet[t]=true;});});
  var tagList=Object.keys(tagSet).sort();

  // 필터 적용
  var filtered=_allRoles.filter(function(r){
    if(_roleFilter.work!=='all'&&ids(fld(r,'작품')).indexOf(_roleFilter.work)===-1)return false;
    if(_roleFilter.gender&&(fld(r,'성별')||fld(r,'젠더')||'')!==_roleFilter.gender)return false;
    if(_roleFilter.tags.length){
      var rTags=fld(r,'태그')||[];
      if(!_roleFilter.tags.every(function(t){return rTags.indexOf(t)>-1;}))return false;
    }
    if(_roleFilter.minAct>0){
      var cnt=DB.history.filter(function(h){return isValidH(h)&&ids(fld(h,'배역')).indexOf(r.id)>-1;}).length;
      if(cnt<_roleFilter.minAct)return false;
    }
    return true;
  });

  var hasFilter=_roleFilter.work!=='all'||!!_roleFilter.gender||_roleFilter.minAct>0||_roleFilter.tags.length>0;
  var filterH='<div class="filter-panel"><div class="filter-panel-top"><span class="filter-panel-title">필터</span>'+(hasFilter?'<button class="filter-clear-btn" onclick="_roleFilter={work:\'all\',gender:\'\',minAct:0,tags:[]};renderRoleIndex()">전체 초기화</button>':''  )+'</div><div class="filter-rows">';

  // 작품 필터 (검색형 드롭다운 - 작품 수가 많아 칩 나열 대신 검색으로 고른다)
  if(workIds.length){
    var selectedWorkName=_roleFilter.work!=='all'?nm(_roleFilter.work):'';
    filterH+='<div class="filter-row"><span class="filter-row-label">작품</span><div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap">'
      +'<div class="global-search" id="role-work-filter-wrap" style="max-width:260px;margin:0">'
      +'<span class="gs-icon">🔍</span>'
      +'<input type="text" id="role-work-filter-input" placeholder="작품 검색..." autocomplete="off" oninput="roleWorkFilterInput(this.value)" onfocus="roleWorkFilterFocus()">'
      +'<div class="gs-dropdown" id="role-work-filter-dropdown"></div>'
      +'</div>'
      +(selectedWorkName?'<button class="fchip on" onclick="clearRoleWorkFilter()">'+selectedWorkName+' ✕</button>':'')
      +'</div></div>';
  }

  // 성별 필터
  if(genders.length){
    filterH+='<div class="filter-row"><span class="filter-row-label">성별</span><div class="filter-chips">';
    filterH+='<button class="fchip'+(!_roleFilter.gender?' on':'')+'" onclick="_roleFilter.gender=\'\';renderRoleIndex()">전체</button>';
    genders.forEach(function(g){var on=_roleFilter.gender===g;filterH+='<button class="fchip'+(on?' on':'')+'" onclick="_roleFilter.gender=\''+g+'\';renderRoleIndex()">'+g+'</button>';});
    filterH+='</div></div>';
  }

  // 태그 필터 (다중 선택)
  if(tagList.length){
    filterH+='<div class="filter-row"><span class="filter-row-label">태그</span><div class="filter-chips">';
    tagList.forEach(function(t){var on=_roleFilter.tags.indexOf(t)>-1;filterH+='<button class="fchip'+(on?' on':'')+'" onclick="toggleRoleTagFilter(\''+t+'\')">'+t+'</button>';});
    filterH+='</div></div>';
  }

  // 출연 이력 횟수 필터
  var ma=_roleFilter.minAct;
  filterH+='<div class="filter-row"><span class="filter-row-label">출연 횟수</span><div class="filter-chips">'
    +'<button class="fchip'+(ma===0?' on':'')+'" onclick="_roleFilter.minAct=0;renderRoleIndex()">전체</button>'
    +'<button class="fchip'+(ma===2?' on':'')+'" onclick="_roleFilter.minAct=2;renderRoleIndex()">2회 이상</button>'
    +'<button class="fchip'+(ma===3?' on':'')+'" onclick="_roleFilter.minAct=3;renderRoleIndex()">3회 이상</button>'
    +'<button class="fchip'+(ma===5?' on':'')+'" onclick="_roleFilter.minAct=5;renderRoleIndex()">5회 이상</button>'
    +'</div></div>';

  filterH+='</div></div>';
  var resultH='<div class="result-header"><span class="result-count"><em>'+filtered.length+'</em>개 배역</span><div class="result-view-btns"><button class="rvb'+(_roleIndexView==='grid'?' on':'')+'" onclick="_roleIndexView=\'grid\';renderRoleIndex()">▦</button><button class="rvb'+(_roleIndexView==='list'?' on':'')+'" onclick="_roleIndexView=\'list\';renderRoleIndex()">≡</button></div></div>';

  var listH='';
  if(!filtered.length){listH='<div class="result-empty"><div class="result-empty-icon">🎬</div>해당하는 배역이 없어요.</div>';}
  else if(_roleIndexView==='grid'){
    listH='<div class="result-grid">';
    filtered.forEach(function(r){
      var wid=ids(fld(r,'작품'))[0]||'';
      var gender=fld(r,'성별')||fld(r,'젠더')||'';
      var rTags=fld(r,'태그')||[];
      var rTagsH=rTags.length?('<div class="result-card-tags">'+rTags.map(function(t){return '<span class="result-card-tag">'+t+'</span>';}).join('')+'</div>'):'';
      var rPhoto=(fld(r,'사진')||[])[0];
      var rPhotoH=rPhoto?'<img src="'+rPhoto.url+'" style="width:100%;height:100%;object-fit:cover;border-radius:8px">':'🎬';
      listH+='<div class="result-card" data-action="role" data-id="'+r.id+'">'+wishBtnHtml('role',r.id)+'<div class="result-card-ph">'+rPhotoH+'</div><div class="result-card-body"><div class="result-card-title">'+fld(r,'배역명')+'</div>'+(nm(wid)?'<div class="result-card-sub">'+nm(wid)+'</div>':'')+(gender?'<div class="result-card-sub">'+gender+'</div>':'')+rTagsH+'</div></div>';
    });
    listH+='</div>';
  } else {
    listH='<div class="result-list">';
    filtered.forEach(function(r){
      var wid=ids(fld(r,'작품'))[0]||'';
      var gender=fld(r,'성별')||fld(r,'젠더')||'';
      var actCnt=DB.history.filter(function(h){return isValidH(h)&&ids(fld(h,'배역')).indexOf(r.id)>-1;}).length;
      listH+='<div class="result-row" data-action="role" data-id="'+r.id+'"><div class="rr-poster">🎬</div><div class="rr-main"><div class="rr-title">'+fld(r,'배역명')+'</div><div class="rr-meta">'+(nm(wid)?'<span class="rr-tag">'+nm(wid)+'</span>':'')+(gender?'<span class="rr-tag">'+gender+'</span>':'')+(actCnt?'<span class="rr-tag">'+actCnt+'명 출연</span>':'')+'</div></div></div>';
    });
    listH+='</div>';
  }
  mn('<div class="tab-index">'+filterH+resultH+listH+'</div>');
}
function showRole(rid,push){
  if(push!==false)history.pushState({view:'role',id:rid},'','#role-'+rid);
  setNav('roles');mobShowDetail();
  var role=DB.roles.find(function(r){return r.id===rid;});if(!role)return;
  var wid=ids(fld(role,'작품'))[0]||'';
  var hists=DB.history.filter(function(h){return isValidH(h)&&ids(fld(h,'배역')).indexOf(rid)>-1;});
  var showIds=[];hists.forEach(function(h){var sid=ids(fld(h,'공연'))[0]||'';if(sid&&showIds.indexOf(sid)===-1)showIds.push(sid);});
  var siblingRoles=wid?DB.roles.filter(function(r){return r.id!==rid&&ids(fld(r,'작품')).indexOf(wid)>-1&&fld(r,'배역명');}):[];
  var roleTags=fld(role,'태그')||[];
  var tagsRowH=roleTags.length?('<div class="result-card-tags" style="margin-top:0.5rem">'+roleTags.map(function(t){return '<span class="result-card-tag">'+t+'</span>';}).join('')+'</div>'):'';
  var h='<div class="detail-header"><div class="eyebrow">'+(wid?'<span class="link" data-action="work" data-id="'+wid+'">'+nm(wid)+'</span> · 배역':'배역')+'</div><div class="detail-title">'+fld(role,'배역명')+wishBtnHtml('role',rid)+'</div>'+tagsRowH+'<div class="detail-meta"><span>출연 '+hists.length+'건</span>'+(showIds.length?'<span>공연 '+showIds.length+'개</span>':'')+'</div></div>';
  h+=buildPhotoGalleryHtml(fld(role,'사진'),fld(role,'배역명'),false);
  if(hists.length){
    // 공연별로 묶어서 날짜순 정렬
    var byShow={};hists.forEach(function(h){var sid=ids(fld(h,'공연'))[0]||'';if(!sid)return;if(!byShow[sid])byShow[sid]=[];byShow[sid].push(h);});
    var showOrder=Object.keys(byShow).sort(function(a,b){var da=showDate(a),db=showDate(b);if(!da&&!db)return 0;if(!da)return 1;if(!db)return -1;return db.localeCompare(da);});
    h+='<div class="sec"><div class="sec-label">출연 이력</div><div class="cast-grid">';
    showOrder.forEach(function(sid){
      var sHists=byShow[sid];
      var sDate=ym(showDate(sid));
      var showRec=DB.shows.find(function(x){return x.id===sid;})||{};
      var trid=ids(fld(showRec,'극단'))[0]||'';
      sHists.forEach(function(rec){
        var pid=ids(fld(rec,'참여자'))[0]||'';
        var u=iurl(fld(rec,'사진'))||PERSON_PHOTO[pid]||'';
        var imgH=u?'<img class="cast-img" src="'+u+'">':'<div class="cast-img-ph">🎭</div>';
        h+='<div class="cast-card" data-action="person" data-id="'+pid+'">'
          +imgH
          +'<div class="cast-name">'+nm(pid)+'</div>'
          +'<div class="cast-role"><span class="link" data-action="show" data-id="'+sid+'">'+nm(sid)+'</span></div>'
          +(sDate||nm(trid)?'<div class="cast-role" style="opacity:.65">'+(sDate||'')+(sDate&&nm(trid)?' · ':'')+nm(trid)+'</div>':'')
          +'</div>';
      });
    });
    h+='</div></div>';
  } else {h+='<div class="empty">출연 이력이 없습니다.</div>';}
  if(siblingRoles.length){
    h+='<div class="sec"><div class="sec-label">같은 작품의 다른 배역</div><div class="item-grid">';
    siblingRoles.forEach(function(r){var actCnt=DB.history.filter(function(h){return isValidH(h)&&ids(fld(h,'배역')).indexOf(r.id)>-1;}).length;h+='<div class="item-card" data-action="role" data-id="'+r.id+'"><div class="item-card-title">'+fld(r,'배역명')+'</div><div class="item-card-sub">출연 '+actCnt+'명</div></div>';});
    h+='</div></div>';
  }
  h+='<div class="sec"><div class="sec-label">해보고 싶어하는 사람들</div><div id="wish-interest-role"></div></div>';
  mn(h);injectBackBtn('← 배역',function(){goRoles();});
  renderWishlistInterest('role',rid,'wish-interest-role');
}
