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
  roles.sort(function(a,b){var oa=ROLE_ORDER[a.id],ob=ROLE_ORDER[b.id];if(oa==null&&ob==null)return 0;if(oa==null)return 1;if(ob==null)return -1;return oa-ob;});
  var country=fld(work,'국가');country=Array.isArray(country)?country.join(', '):(country||'');
  var creators=[];DB.creationHistory.forEach(function(c){if(ids(fld(c,'작품')).indexOf(wid)>-1){var p=ids(fld(c,'창작자'))[0];if(p&&creators.indexOf(p)===-1)creators.push(p);}});
  var photos=fld(work,'사진')||[];
  dvRender({
    type:'work',id:wid,back:{label:'작품 목록',go:'goWorks()'},
    thumb:{url:iurl(photos),shape:'poster',ph:'📖'},
    kicker:'작품'+(workGenre(work)?' · '+escHtml(workGenre(work)):''),
    title:fld(work,'작품명'),
    sub:fld(work,'작품명 (영문)')?escHtml(fld(work,'작품명 (영문)')):'',
    tags:fld(work,'태그')||[],
    facts:[['국가',escHtml(country)],['초연',fld(work,'초연 연도')?fld(work,'초연 연도')+'년':''],['등장인물',roles.length?roles.length+'명':''],['공연',shows.length?shows.length+'편':'']],
    actions:[dvActBtn('이 작품으로 프로젝트 시작','startProjectFromWork(\''+wid+'\')','🎭',true),dvFavBtn('work',wid),dvFavBtn('work',wid,'wishlist'),dvActBtn('라이선스 문의','openLicenseInquiry(\'\',\''+wid+'\')','💬'),dvEditBtn('work',wid)],
    sections:[
      {title:'공연 이력',items:shows.map(function(s){return dvShowCard(s,dvShowSub(s,['troupe','date']));}),layout:'cards',peek:true},
      {title:'창작진',items:creators.map(function(p){return dvPersonRow(p,'');}),layout:'rows',peek:true},
      {title:'등장인물',items:roles.map(function(r){return dvChip('role',r.id,fld(r,'배역명'));}),layout:'chips',peek:true,peekMax:20},
      {title:'해보고 싶어하는 사람들',body:'<div id="wish-interest-work"></div>'},
      {title:'사진',body:buildPhotoGalleryHtml(photos,fld(work,'작품명'))}
    ],
    empty:'아직 연결된 공연이나 배역이 없어요.',
    after:function(){renderWishlistInterest('work',wid,'wish-interest-work');}
  });
}