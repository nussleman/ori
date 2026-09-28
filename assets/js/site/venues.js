/* 오리 사이트 — 극장 목록·상세 */
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

  var hasFilter=!!_venueFilter.sizeTier||_venueFilter.sort!=='name'||_venueFilter.parkingOnly;
  var filterH='<div class="filter-panel"><div class="filter-panel-top"><span class="filter-panel-title">필터 / 정렬</span>'
    +(hasFilter?'<button class="filter-clear-btn" onclick="clearVenueFilter()">전체 초기화</button>':'')
    +'</div><div class="filter-rows">'
    +'<div class="filter-row"><span class="filter-row-label">규모</span><div class="filter-chips">'
    +'<button class="fchip'+(!_venueFilter.sizeTier?' on':'')+'" onclick="_venueFilter.sizeTier=\'\';renderVenueIndex()">전체</button>'
    +['소극장','중극장','대극장'].map(function(t){return '<button class="fchip'+(_venueFilter.sizeTier===t?' on':'')+'" onclick="_venueFilter.sizeTier=\''+t+'\';renderVenueIndex()">'+t+'</button>';}).join('')
    +'</div></div>'
    +'<div class="filter-row"><span class="filter-row-label">접근성</span><div class="filter-chips">'
    +'<button class="fchip'+(_venueFilter.parkingOnly?' on':'')+'" onclick="_venueFilter.parkingOnly=!_venueFilter.parkingOnly;renderVenueIndex()">🚗 주차 가능만</button>'
    +'</div></div>'
    +'<div class="filter-row"><span class="filter-row-label">정렬</span><div class="filter-chips">'
    +'<button class="fchip'+(_venueFilter.sort==='name'?' on':'')+'" onclick="_venueFilter.sort=\'name\';renderVenueIndex()">이름순</button>'
    +'<button class="fchip'+(_venueFilter.sort==='shows'?' on':'')+'" onclick="_venueFilter.sort=\'shows\';renderVenueIndex()">공연 많은순</button>'
    +'<button class="fchip'+(_venueFilter.sort==='seats'?' on':'')+'" onclick="_venueFilter.sort=\'seats\';renderVenueIndex()">좌석수 많은순</button>'
    +'</div></div></div></div>';

  var resultH='<div class="result-header"><span class="result-count"><em>'+filtered.length+'</em>개 극장</span></div>';
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
  var seatsLabel=venueSeatsLabel(venue);
  var venuePhotos=fld(venue,'사진')||[];
  var h='<div class="detail-header"><div class="eyebrow">극장</div><div class="detail-title">'+fld(venue,'극장명')+favBtnHtml('venue',vid)+'</div><div class="detail-meta"><span>공연 '+shows.length+'개</span>'+(seatsLabel?'<span>💺 좌석 '+seatsLabel+'</span>':'')+'</div></div>';
  h+=buildPhotoGalleryHtml(venuePhotos,fld(venue,'극장명'),false);
  var vRentalFee=fld(venue,'대관료');
  var vRentalAvail=fld(venue,'대관가능여부');
  var vContact=fld(venue,'연락처');
  var vParking=fld(venue,'주차가능여부');
  var vTransit=fld(venue,'대중교통정보');
  var vInfoRows=[];
  if(vRentalAvail!=null)vInfoRows.push('<div class="info-row"><span class="info-row-label">대관 가능여부</span><span>'+(vRentalAvail?'가능':'불가')+'</span></div>');
  if(vRentalFee)vInfoRows.push('<div class="info-row"><span class="info-row-label">대관료</span><span>'+vRentalFee+'</span></div>');
  if(vContact)vInfoRows.push('<div class="info-row"><span class="info-row-label">연락처</span><span>'+vContact+'</span></div>');
  if(vParking!=null)vInfoRows.push('<div class="info-row"><span class="info-row-label">주차</span><span>'+(vParking?'가능':'불가')+'</span></div>');
  if(vTransit)vInfoRows.push('<div class="info-row"><span class="info-row-label">대중교통</span><span>'+vTransit+'</span></div>');
  if(vInfoRows.length){
    h+='<div class="sec"><div class="sec-label">실전 정보</div><div class="info-rows">'+vInfoRows.join('')+'</div></div>';
  }
  if(shows.length){
    var vYearCntMap={};shows.forEach(function(s){var y=yearOf(fld(s,'공연 날짜')||'')||'연도 미상';vYearCntMap[y]=(vYearCntMap[y]||0)+1;});
    var vYears=Object.keys(vYearCntMap).sort().reverse();
    window._venueShows=shows;
    window._venueActiveYear='all';
    window._renderVenueShowGrid=function(yearArg){
      if(yearArg!==undefined)window._venueActiveYear=yearArg;
      var yearFilter=window._venueActiveYear;
      var filtered=window._venueShows.filter(function(s){
        if(yearFilter==='all')return true;
        return(yearOf(fld(s,'공연 날짜')||'')||'연도 미상')===yearFilter;
      });
      var gridH='';
      filtered.forEach(function(s){
        var wid=ids(fld(s,'작품'))[0]||'';
        var p=POSTER[s.id]||'';
        gridH+='<div class="item-card" data-action="show" data-id="'+s.id+'">'
          +(p?'<img src="'+p+'" style="width:100%;aspect-ratio:2/3;object-fit:cover;border-radius:4px;margin-bottom:0.6rem">':'')
          +'<div class="item-card-title">'+fld(s,'공연명')+'</div>'
          +'<div class="item-card-sub">'+nm(wid)+(fld(s,'공연 날짜')?' · '+ym(fld(s,'공연 날짜')):'')+'</div>'
          +'</div>';
      });
      var el=$('venue-show-grid');if(el)el.innerHTML=gridH||'<div class="empty" style="grid-column:1/-1">해당 공연이 없습니다.</div>';
      $$('.vf-year-btn').forEach(function(btn){btn.classList.toggle('pf-active',btn.dataset.year===yearFilter);});
    };
    var vYearBtnsH='<button class="pf-btn vf-year-btn pf-active" data-year="all" onclick="_renderVenueShowGrid(\'all\')">전체</button>';
    vYears.forEach(function(y){vYearBtnsH+='<button class="pf-btn vf-year-btn" data-year="'+y+'" onclick="_renderVenueShowGrid(\''+y+'\')">'+y+'</button>';});
    h+='<div class="sec"><div class="sec-label">공연 목록</div>'
      +'<div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-bottom:0.8rem">'+vYearBtnsH+'</div>'
      +'<div class="item-grid" id="venue-show-grid"></div></div>';
  } else {h+='<div class="empty">등록된 공연이 없습니다.</div>';}
  mn(h);
  if(window._renderVenueShowGrid)_renderVenueShowGrid('all');
  injectBackBtn('← 극장',function(){goVenues();});
}

var _troupeFilter={orgType:'',memberBase:'',region:'',status:'',sort:'name'};
