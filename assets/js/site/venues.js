/* 오리 사이트 — 극장 목록·상세 */
var _venueFilter={sizeTier:'',sort:'name',parkingOnly:false};
function goVenues(push){
  if(push!==false)history.pushState({view:'venues'},'','#venues');
  setNav('venues');_sbContext='venues';  _allVenues=DB.venues.filter(function(v){return fld(v,'극장명');});
  _venueFilter={sizeTier:'',sort:'name',parkingOnly:false};
  renderVenueIndex();
}
function venueSeats(v){
  var candidates=['좌석수','좌석 수','객석수','객석 수','수용인원','좌석규모','좌석 규모','좌석','Capacity','capacity','Seats','seats'];
  // '좌석수' is confirmed the correct field name; kept first in the list, others remain as fallback.
  for(var i=0;i<candidates.length;i++){
    var val=fld(v,candidates[i]);
    if(val!=null&&val!==''){return val;}
  }
  return null;
}
function venueSeatsMax(v){
  var val=fld(v,'좌석수_최대');
  return(val!=null&&val!=='')?val:null;
}
function venueSeatsLabel(v){
  var min=venueSeats(v),max=venueSeatsMax(v);
  if(min==null&&max==null)return '';
  if(min!=null&&max!=null&&max!==min)return min+'~'+max+'석';
  return(min!=null?min:max)+'석';
}
function venueSizeTier(seats){
  if(seats==null)return '';
  if(seats<100)return '소극장';
  if(seats<300)return '중극장';
  return '대극장';
}
function clearVenueFilter(){_venueFilter={sizeTier:'',sort:'name',parkingOnly:false};renderVenueIndex();}
function renderVenueIndex(){
  var all=_allVenues;
  if(!all.length){mn('<div class="tab-index"><div class="result-empty"><div class="result-empty-icon">📍</div>극장 데이터가 없습니다.</div></div>');return;}

  var showCntMap={},seatMap={};
  all.forEach(function(v){
    showCntMap[v.id]=DB.shows.filter(function(s){return ids(fld(s,'극장')).indexOf(v.id)>-1;}).length;
    seatMap[v.id]=venueSeats(v);
  });

  var filtered=all.filter(function(v){
    if(_venueFilter.sizeTier&&venueSizeTier(seatMap[v.id])!==_venueFilter.sizeTier)return false;
    if(_venueFilter.parkingOnly&&!fld(v,'주차가능여부'))return false;
    return true;
  });

  if(_venueFilter.sort==='shows'){
    filtered=filtered.slice().sort(function(a,b){return showCntMap[b.id]-showCntMap[a.id];});
  } else if(_venueFilter.sort==='seats'){
    filtered=filtered.slice().sort(function(a,b){return(seatMap[b.id]||0)-(seatMap[a.id]||0);});
  } else {
    filtered=filtered.slice().sort(function(a,b){return(fld(a,'극장명')||'').localeCompare(fld(b,'극장명')||'');});
  }

  var filterH=filterBar('venues',[
    {key:'sizeTier',label:'규모',type:'single',value:_venueFilter.sizeTier,options:[{v:'소극장',l:'소극장 (100석 미만)'},{v:'중극장',l:'중극장 (100~299석)'},{v:'대극장',l:'대극장 (300석 이상)'}]},
    {key:'parkingOnly',label:'주차 가능',type:'toggle',value:_venueFilter.parkingOnly}
  ],{
    count:'<em>'+filtered.length+'</em>개 극장',
    sort:{value:_venueFilter.sort,options:[{v:'name',l:'이름순'},{v:'shows',l:'공연 많은순'},{v:'seats',l:'좌석 많은순'}],onChange:function(v){_venueFilter.sort=v;renderVenueIndex();}},
    onChange:function(k,v){_venueFilter[k]=v;renderVenueIndex();},
    onReset:function(){_venueFilter={sizeTier:'',sort:_venueFilter.sort,parkingOnly:false};renderVenueIndex();}
  });
  var resultH='';
  var listH='';
  if(!filtered.length){
    listH='<div class="result-empty"><div class="result-empty-icon">📍</div>해당하는 극장이 없어요.</div>';
  } else {
    listH='<div class="result-grid">';
    filtered.forEach(function(v){
      var seatsLabel=venueSeatsLabel(v);
      var vphoto=iurl(fld(v,'사진'));
      var vphH=vphoto?'<img src="'+vphoto+'" style="width:100%;height:100%;object-fit:cover;border-radius:8px">':'📍';
      listH+='<div class="result-card" data-action="venue" data-id="'+v.id+'">'+favBtnHtml('venue',v.id)+'<div class="result-card-ph">'+vphH+'</div><div class="result-card-body"><div class="result-card-title">'+fld(v,'극장명')+'</div><div class="result-card-sub">공연 '+showCntMap[v.id]+'개'+(seatsLabel?' · 좌석 '+seatsLabel:'')+'</div></div></div>';
    });
    listH+='</div>';
  }
  mn('<div class="tab-index">'+filterH+resultH+listH+'</div>');
}
function showVenue(vid,push){
  if(push!==false)history.pushState({view:'venue',id:vid},'','#venue-'+vid);
  setNav('venues');mobShowDetail();
  var venue=DB.venues.find(function(v){return v.id===vid;});if(!venue)return;
  var shows=sortShows(DB.shows.filter(function(s){return ids(fld(s,'극장')).indexOf(vid)>-1;}));
  var yn=function(v){return v==null?'':(v?'가능':'불가');};
  var photos=fld(venue,'사진')||[];
  dvRender({
    type:'venue',id:vid,back:{label:'극장 목록',go:'goVenues()'},
    thumb:{url:iurl(photos),shape:'square',ph:'📍'},
    kicker:'극장',
    title:fld(venue,'극장명'),
    facts:[['좌석',venueSeatsLabel(venue)],['대관',yn(fld(venue,'대관가능여부'))],['대관료',escHtml(fld(venue,'대관료')||'')],['주차',yn(fld(venue,'주차가능여부'))],['대중교통',escHtml(fld(venue,'대중교통정보')||'')],['연락처',escHtml(fld(venue,'연락처')||'')],['공연',shows.length?shows.length+'편':'']],
    actions:[dvActBtn('내 프로젝트 후보에 담기','addVenueToMyProject(\''+vid+'\')','＋',true),dvFavBtn('venue',vid),dvEditBtn('venue',vid)],
    sections:[
      {title:'공연 목록',n:shows.length,items:shows.map(function(s){return dvShowCard(s,dvShowSub(s,['troupe','date']));}),layout:'cards',peek:true,body:dvYearShows('venue-shows',shows,['troupe','date'])},
      {title:'사진',body:buildPhotoGalleryHtml(photos,fld(venue,'극장명'))}
    ],
    empty:'이 극장에 등록된 공연이 아직 없어요.',
    after:function(){dvYearShowsRender('venue-shows');}
  });
}
var _troupeFilter={orgType:'',memberBase:'',region:'',status:'',sort:'name'};
