/* 오리 사이트 — 대시보드 (통계 개요) */
/* ══ 대시보드 (통계 개요, 준비중인 기업회원 메뉴의 일반 버전) ══ */
function dashBarList(rows,opts){
  // rows: [[label,count],...] / opts.max: 기준 최대값(없으면 rows 중 최대), opts.rank: 순위 숫자 표시 여부
  opts=opts||{};
  var max=opts.max||Math.max.apply(null,rows.map(function(r){return r[1];}))||1;
  var h='';
  rows.forEach(function(r,i){
    var pct=max?Math.round((r[1]/max)*100):0;
    h+='<div class="dash-bar-row">'
      +(opts.rank?'<span class="dash-bar-rank">'+(i+1)+'</span>':'')
      +'<span class="dash-bar-label" title="'+r[0]+'">'+r[0]+'</span>'
      +'<span class="dash-bar-track"><span class="dash-bar-fill" style="width:'+pct+'%"></span></span>'
      +'<span class="dash-bar-value">'+r[1]+(opts.suffix||'')+'</span></div>';
  });
  return h;
}
function topEntries(counts,n){
  return Object.keys(counts).map(function(k){return [k,counts[k]];})
    .sort(function(a,b){return b[1]-a[1];}).slice(0,n||10);
}
function dashYearChart(counts,emptyMsg){
  var years=Object.keys(counts).sort();
  if(years.length===0)return '<div class="result-empty" style="padding:1.4rem 0">'+(emptyMsg||'날짜 데이터가 없어요')+'</div>';
  var yMax=Math.max.apply(null,years.map(function(y){return counts[y];}))||1;
  var h='<div class="dash-yearchart">';
  years.forEach(function(y){
    var c=counts[y];
    var hh=Math.max(4,Math.round(c/yMax*100));
    h+='<div class="dash-yearchart-col"><span class="dash-yearchart-count">'+c+'</span>'
      +'<div class="dash-yearchart-bar" style="height:'+hh+'%"></div>'
      +'<span class="dash-yearchart-label">'+y+'</span></div>';
  });
  h+='</div>';
  return h;
}
function renderDashboard(){
  var validShows=DB.shows.filter(function(s){return fld(s,'공연명');});
  var total=validShows.length||1;

  // 2) 연도별 공연 수 추이
  var yearCounts={};
  validShows.forEach(function(s){var y=yearOf(fld(s,'공연 날짜')||'');if(y)yearCounts[y]=(yearCounts[y]||0)+1;});
  var yearH=dashYearChart(yearCounts);

  // 3) 장르별 분포 (작품 기준)
  var genreCounts={};
  DB.works.filter(function(w){return fld(w,'작품명');}).forEach(function(w){
    var g=fld(w,'구분')||'미상';genreCounts[g]=(genreCounts[g]||0)+1;
  });
  var genreH=dashBarList(topEntries(genreCounts,10),{suffix:'건'});

  // 4) 가장 활발한 극단 TOP 10
  var troupeCounts={};
  validShows.forEach(function(s){var tid=ids(fld(s,'극단'))[0];if(tid)troupeCounts[tid]=(troupeCounts[tid]||0)+1;});
  var troupeRows=topEntries(troupeCounts,10).map(function(r){return [nm(r[0])||'(이름없음)',r[1]];});
  var troupeH=troupeRows.length?dashBarList(troupeRows,{rank:true,suffix:'건'}):'<div class="result-empty" style="padding:1.4rem 0">연결된 극단이 없어요</div>';

  // 5) 가장 많이 쓰인 극장 TOP 10
  var venueCounts={};
  validShows.forEach(function(s){var vid=ids(fld(s,'극장'))[0];if(vid)venueCounts[vid]=(venueCounts[vid]||0)+1;});
  var venueRows=topEntries(venueCounts,10).map(function(r){return [nm(r[0])||'(이름없음)',r[1]];});
  var venueH=venueRows.length?dashBarList(venueRows,{rank:true,suffix:'건'}):'<div class="result-empty" style="padding:1.4rem 0">연결된 극장이 없어요</div>';

  // 6) 참여 인원 TOP 10 (참여이력 기준)
  var personCounts={};
  DB.history.filter(isValidH).forEach(function(h){var pid=ids(fld(h,'참여자'))[0];if(pid)personCounts[pid]=(personCounts[pid]||0)+1;});
  var personRows=topEntries(personCounts,10).map(function(r){return [nm(r[0])||'(이름없음)',r[1]];});
  var personH=personRows.length?dashBarList(personRows,{rank:true,suffix:'회'}):'<div class="result-empty" style="padding:1.4rem 0">참여이력이 없어요</div>';

  // 7) 배역 유형 태그 분포 TOP 15 (실제 참여이력에 연결된 배역 기준)
  var roleById={};DB.roles.forEach(function(r){roleById[r.id]=r;});
  var tagCounts={};
  DB.history.filter(isValidH).forEach(function(h){
    ids(fld(h,'배역')).forEach(function(rid){
      var role=roleById[rid];if(!role)return;
      var tags=fld(role,'태그')||[];
      tags.forEach(function(t){if(t)tagCounts[t]=(tagCounts[t]||0)+1;});
    });
  });
  var tagRows=topEntries(tagCounts,15);
  var tagH=tagRows.length?dashBarList(tagRows,{suffix:'회'}):'<div class="result-empty" style="padding:1.4rem 0">배역 태그 데이터가 없어요</div>';

  // 9) 단체 조직형태 분포
  var orgTypeCounts={};
  DB.troupes.filter(function(t){return fld(t,'극단명');}).forEach(function(t){
    var v=fld(t,'조직형태')||'미상';orgTypeCounts[v]=(orgTypeCounts[v]||0)+1;
  });
  var orgTypeH=dashBarList(topEntries(orgTypeCounts,10),{suffix:'개'});

  // 10) 스태프 역할별 참여 분포
  var staffCounts={};
  DB.history.forEach(function(h){
    if(tname(h)!=='스텝')return;
    ids(fld(h,'스텝')).forEach(function(sid){var n=nm(sid);if(n)staffCounts[n]=(staffCounts[n]||0)+1;});
  });
  var staffRows=topEntries(staffCounts,10);
  var staffH=staffRows.length?dashBarList(staffRows,{rank:true,suffix:'회'}):'<div class="result-empty" style="padding:1.4rem 0">스태프 참여이력이 없어요</div>';

  // 11) 극장 규모(좌석수) 분포
  var seatBuckets=[['~100석',0,100],['101~200석',101,200],['201~300석',201,300],['301~500석',301,500],['501석 이상',501,Infinity]];
  var seatCounts={};seatBuckets.forEach(function(b){seatCounts[b[0]]=0;});
  DB.venues.filter(function(v){return fld(v,'극장명');}).forEach(function(v){
    var s=fld(v,'좌석수');if(s==null)return;
    var b=seatBuckets.find(function(b){return s>=b[1]&&s<=b[2];});
    if(b)seatCounts[b[0]]++;
  });
  var seatRows=seatBuckets.map(function(b){return [b[0],seatCounts[b[0]]];}).filter(function(r){return r[1]>0;});
  var seatH=seatRows.length?dashBarList(seatRows):'<div class="result-empty" style="padding:1.4rem 0">좌석수 데이터가 없어요</div>';

  // 12) 배역 성별 분포
  var roleGenderCounts={'남':0,'여':0,'미상':0};
  DB.roles.filter(function(r){return fld(r,'배역명');}).forEach(function(r){
    var g=fld(r,'성별');roleGenderCounts[g==='남'||g==='여'?g:'미상']++;
  });
  var roleGenderColors={'남':'#6eb5c8','여':'#c8a96e','미상':'rgba(255,255,255,0.18)'};
  var roleGenderTotal=roleGenderCounts['남']+roleGenderCounts['여']+roleGenderCounts['미상']||1;
  var roleGenderH='<div class="dash-stackbar">';
  ['남','여','미상'].forEach(function(k){
    var pct=Math.round(roleGenderCounts[k]/roleGenderTotal*100);
    if(pct>0)roleGenderH+='<span class="dash-stackbar-seg" style="width:'+pct+'%;background:'+roleGenderColors[k]+'"></span>';
  });
  roleGenderH+='</div><div class="dash-legend">';
  ['남','여','미상'].forEach(function(k){
    roleGenderH+='<span class="dash-legend-item"><span class="dash-legend-dot" style="background:'+roleGenderColors[k]+'"></span>'+k+' <span class="dash-legend-val">'+roleGenderCounts[k]+'개</span></span>';
  });
  roleGenderH+='</div>';

  // 13) 다작 창작자 TOP 10 (창작이력 기준)
  var creatorCounts={};
  DB.creationHistory.forEach(function(c){
    var pid=ids(fld(c,'창작자'))[0];if(pid)creatorCounts[pid]=(creatorCounts[pid]||0)+1;
  });
  var creatorRows=topEntries(creatorCounts,10).map(function(r){return [nm(r[0])||'(이름없음)',r[1]];});
  var creatorH=creatorRows.length?dashBarList(creatorRows,{rank:true,suffix:'건'}):'<div class="result-empty" style="padding:1.4rem 0">창작이력 데이터가 없어요</div>';

  // 14) 작품별 재상연 빈도 TOP 10
  var workShowCounts={};
  validShows.forEach(function(s){var wid=ids(fld(s,'작품'))[0];if(wid)workShowCounts[wid]=(workShowCounts[wid]||0)+1;});
  var workRows=topEntries(workShowCounts,10).map(function(r){return [nm(r[0])||'(이름없음)',r[1]];});
  var workRerunH=workRows.length?dashBarList(workRows,{rank:true,suffix:'회'}):'<div class="result-empty" style="padding:1.4rem 0">작품 연결 데이터가 없어요</div>';

  // 15) 신규 단체 유입 추이 (단체별 첫 공연 연도 기준)
  var troupeFirstYear={};
  validShows.forEach(function(s){
    var tid=ids(fld(s,'극단'))[0],y=yearOf(fld(s,'공연 날짜')||'');
    if(tid&&y&&(!troupeFirstYear[tid]||y<troupeFirstYear[tid]))troupeFirstYear[tid]=y;
  });
  var entryYearCounts={};
  Object.keys(troupeFirstYear).forEach(function(tid){var y=troupeFirstYear[tid];entryYearCounts[y]=(entryYearCounts[y]||0)+1;});
  var entryYearH=dashYearChart(entryYearCounts,'단체·날짜가 함께 연결된 공연이 없어요');

  // 16) 단체당 평균 공연 수 / 1회성 단체 비율
  var troupeShowCounts={};
  validShows.forEach(function(s){var tid=ids(fld(s,'극단'))[0];if(tid)troupeShowCounts[tid]=(troupeShowCounts[tid]||0)+1;});
  var activeTroupeIds=Object.keys(troupeShowCounts);
  var avgShowsPerTroupe=activeTroupeIds.length?(activeTroupeIds.reduce(function(sum,id){return sum+troupeShowCounts[id];},0)/activeTroupeIds.length):0;
  var oneTimeCount=activeTroupeIds.filter(function(id){return troupeShowCounts[id]===1;}).length;
  var oneTimePct=activeTroupeIds.length?Math.round(oneTimeCount/activeTroupeIds.length*100):0;
  var troupeStatsH='<div class="dash-summary-strip" style="margin-bottom:0">'
    +'<div class="dash-summary-item"><span class="dash-summary-num">'+avgShowsPerTroupe.toFixed(1)+'</span><span class="dash-summary-label">단체당 평균 공연 수</span></div>'
    +'<div class="dash-summary-item"><span class="dash-summary-num">'+oneTimePct+'%</span><span class="dash-summary-label">1회 공연만 올린 단체 비율</span></div>'
    +'<div class="dash-summary-item"><span class="dash-summary-num">'+activeTroupeIds.length+'</span><span class="dash-summary-label">공연 연결된 단체 수</span></div>'
    +'</div>';

  var h='<div class="dash-intro">DB에 쌓인 데이터를 기반으로 한 통계 개요예요. 관객수·매진·재공연 등 성과 데이터는 아직 입력된 게 없어서, 데이터가 쌓이면 이 대시보드에도 추가될 예정이에요.</div>';

  h+='<div class="dash-summary-strip">'
    +'<div class="dash-summary-item"><span class="dash-summary-num">'+validShows.length+'</span><span class="dash-summary-label">공연</span></div>'
    +'<div class="dash-summary-item"><span class="dash-summary-num">'+DB.troupes.length+'</span><span class="dash-summary-label">단체</span></div>'
    +'<div class="dash-summary-item"><span class="dash-summary-num">'+DB.venues.length+'</span><span class="dash-summary-label">극장</span></div>'
    +'<div class="dash-summary-item"><span class="dash-summary-num">'+DB.works.filter(function(w){return fld(w,'작품명');}).length+'</span><span class="dash-summary-label">작품</span></div>'
    +'<div class="dash-summary-item"><span class="dash-summary-num">'+DB.people.filter(function(p){return fld(p,'이름');}).length+'</span><span class="dash-summary-label">참여자</span></div>'
    +'<div class="dash-summary-item"><span class="dash-summary-num">'+DB.history.filter(isValidH).length+'</span><span class="dash-summary-label">참여이력</span></div>'
    +'</div>';

  h+='<div class="dash-grid">'
    +'<div class="dash-card wide"><div class="dash-card-title">연도별 공연 수 추이</div>'+yearH+'</div>'
    +'<div class="dash-card"><div class="dash-card-title">장르별 분포<span class="dash-card-note">작품 기준</span></div>'+genreH+'</div>'
    +'<div class="dash-card"><div class="dash-card-title">가장 활발한 단체 TOP 10</div>'+troupeH+'</div>'
    +'<div class="dash-card"><div class="dash-card-title">가장 많이 쓰인 극장 TOP 10</div>'+venueH+'</div>'
    +'<div class="dash-card"><div class="dash-card-title">참여 최다 인물 TOP 10</div>'+personH+'</div>'
    +'<div class="dash-card wide"><div class="dash-card-title">배역 유형 태그 분포 TOP 15<span class="dash-card-note">실제 참여이력 기준</span></div>'+tagH+'</div>'
    +'<div class="dash-card"><div class="dash-card-title">단체 조직형태 분포</div>'+orgTypeH+'</div>'
    +'<div class="dash-card"><div class="dash-card-title">스태프 역할별 참여 분포 TOP 10</div>'+staffH+'</div>'
    +'<div class="dash-card"><div class="dash-card-title">극장 규모(좌석수) 분포</div>'+seatH+'</div>'
    +'<div class="dash-card"><div class="dash-card-title">배역 성별 분포</div>'+roleGenderH+'</div>'
    +'<div class="dash-card"><div class="dash-card-title">다작 창작자 TOP 10<span class="dash-card-note">창작이력 기준</span></div>'+creatorH+'</div>'
    +'<div class="dash-card"><div class="dash-card-title">작품별 재상연 빈도 TOP 10</div>'+workRerunH+'</div>'
    +'<div class="dash-card wide"><div class="dash-card-title">신규 단체 유입 추이<span class="dash-card-note">단체별 첫 공연 연도 기준</span></div>'+entryYearH+'</div>'
    +'<div class="dash-card wide"><div class="dash-card-title">단체 활동 패턴<span class="dash-card-note">일회성 vs 지속형</span></div>'+troupeStatsH+'</div>'
    +'</div>';

  mn('<div class="tab-index">'+h+'</div>');
}
function goDashboard(push){
  if(push!==false)history.pushState({view:'dashboard'},'','#dashboard');
  setNav('dashboard');sb('');_sbContext='';mobShowDetail();
  renderDashboard();
}
