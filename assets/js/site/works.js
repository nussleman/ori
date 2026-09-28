/* 오리 사이트 — 작품 목록·상세 */
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

  var hasFilter=!!_workFilter.country||!!_workFilter.genre||_workFilter.minCast>0;
  var filterH='<div class="filter-panel"><div class="filter-panel-top"><span class="filter-panel-title">필터</span>'+(hasFilter?'<button class="filter-clear-btn" onclick="clearWorkFilter()">전체 초기화</button>':'')+'</div><div class="filter-rows">';

  // 장르 필터
  if(genres.length){
    filterH+='<div class="filter-row"><span class="filter-row-label">장르</span><div class="filter-chips">';
    filterH+='<button class="fchip'+(!_workFilter.genre?' on':'')+'" onclick="_workFilter.genre=\'\';renderWorkIndex()">전체</button>';
    genres.forEach(function(g){var on=_workFilter.genre===g;filterH+='<button class="fchip'+(on?' on':'')+'" onclick="_workFilter.genre=\''+g+'\';renderWorkIndex()">'+g+'</button>';});
    filterH+='</div></div>';
  }

  // 국가 필터
  if(countries.length){
    filterH+='<div class="filter-row"><span class="filter-row-label">국가</span><div class="filter-chips">';
    filterH+='<button class="fchip'+(!_workFilter.country?' on':'')+'" onclick="_workFilter.country=\'\';renderWorkIndex()">전체</button>';
    countries.forEach(function(c){var on=_workFilter.country===c;filterH+='<button class="fchip'+(on?' on':'')+'" onclick="_workFilter.country=\''+c+'\';renderWorkIndex()">'+c+'</button>';});
    filterH+='</div></div>';
  }

  // 배역 인원 필터
  var mc=_workFilter.minCast;
  filterH+='<div class="filter-row"><span class="filter-row-label">배역 인원</span><div class="filter-chips">'
    +'<button class="fchip'+(mc===0?' on':'')+'" onclick="_workFilter.minCast=0;renderWorkIndex()">전체</button>'
    +'<button class="fchip'+(mc===3?' on':'')+'" onclick="_workFilter.minCast=3;renderWorkIndex()">3명 이상</button>'
    +'<button class="fchip'+(mc===5?' on':'')+'" onclick="_workFilter.minCast=5;renderWorkIndex()">5명 이상</button>'
    +'<button class="fchip'+(mc===10?' on':'')+'" onclick="_workFilter.minCast=10;renderWorkIndex()">10명 이상</button>'
    +'</div></div>';

  filterH+='</div></div>';
  var resultH='<div class="result-header"><span class="result-count"><em>'+filtered.length+'</em>개 작품</span><div class="result-view-btns"><button class="rvb'+(_workIndexView==='grid'?' on':'')+'" onclick="_workIndexView=\'grid\';renderWorkIndex()">▦</button><button class="rvb'+(_workIndexView==='list'?' on':'')+'" onclick="_workIndexView=\'list\';renderWorkIndex()">≡</button></div></div>';

  var listH='';
  if(!filtered.length){listH='<div class="result-empty"><div class="result-empty-icon">📖</div>조건에 맞는 작품이 없어요.</div>';}
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
        +'<div class="result-card-ph">'+wPhotoH+'</div><div class="result-card-body"><div class="result-card-title">'+fld(w,'작품명')+'</div>'+(fld(w,'작품명 (영문)')?'<div class="result-card-sub">'+fld(w,'작품명 (영문)')+'</div>':'')+(countryLabel?'<div class="result-card-sub">'+countryLabel+'</div>':'')+'<div class="result-card-sub">공연 '+shows.length+'개'+(roleCnt?' · 배역 '+roleCnt+'명':'')+'</div>'+tagsRowH+'</div></div>';
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
      listH+='<div class="result-row" data-action="work" data-id="'+w.id+'"><div class="rr-poster">📖</div><div class="rr-main"><div class="rr-title">'+fld(w,'작품명')+'</div><div class="rr-meta">'+(genre?'<span class="rr-tag" style="color:var(--accent)">'+genre+'</span>':'')+(fld(w,'작품명 (영문)')?'<span class="rr-tag">'+fld(w,'작품명 (영문)')+'</span>':'')+(countryLabel?'<span class="rr-tag">'+countryLabel+'</span>':'')+'<span class="rr-tag">공연 '+shows.length+'개</span>'+(roleCnt?'<span class="rr-tag">배역 '+roleCnt+'명</span>':'')+'</div></div></div>';
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
  var genre=workGenre(work);
  var wTags=fld(work,'태그')||[];
  var wTagsRowH=wTags.length?('<div class="result-card-tags" style="margin-top:0.5rem">'+wTags.map(function(t){return '<span class="result-card-tag">'+t+'</span>';}).join('')+'</div>'):'';
  var h='<div class="detail-header"><div class="eyebrow">작품'+(genre?' · '+genre:'')+'</div><div class="detail-title">'+fld(work,'작품명')+favBtnHtml('work',wid)+wishBtnHtml('work',wid)+'</div>'+(fld(work,'작품명 (영문)')?'<div class="detail-meta"><span>'+fld(work,'작품명 (영문)')+'</span></div>':'')+wTagsRowH+'</div>';
  h+=buildPhotoGalleryHtml(fld(work,'사진'),fld(work,'작품명'),false);
  if(shows.length){h+='<div class="sec"><div class="sec-label">공연 이력</div><div class="item-grid">'+shows.map(function(s){
    var p=POSTER[s.id]||'';
    var trid=ids(fld(s,'극단'))[0]||'';
    var date=fld(s,'공연 날짜')||'';
    var subParts=[];if(nm(trid))subParts.push(nm(trid));if(date)subParts.push(date);
    return '<div class="item-card" data-action="show" data-id="'+s.id+'">'+( p?'<img src="'+p+'" style="width:100%;aspect-ratio:2/3;object-fit:cover;border-radius:4px;margin-bottom:0.6rem">':'')+'<div class="item-card-title">'+fld(s,'공연명')+'</div><div class="item-card-sub">'+subParts.join(' · ')+'</div></div>';
  }).join('')+'</div></div>';}
  if(roles.length){h+='<div class="sec"><div class="sec-label">등장인물</div><div class="item-grid">'+roles.map(function(r){return '<div class="item-card" data-action="role" data-id="'+r.id+'"><div class="item-card-title">'+fld(r,'배역명')+'</div></div>';}).join('')+'</div></div>';}
  h+='<div class="sec"><div class="sec-label">해보고 싶어하는 사람들</div><div id="wish-interest-work"></div></div>';
  mn(h);injectBackBtn('← 작품',function(){goWorks();});
  renderWishlistInterest('work',wid,'wish-interest-work');
}
