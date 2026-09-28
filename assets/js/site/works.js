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
