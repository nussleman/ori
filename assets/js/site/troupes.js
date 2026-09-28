/* 오리 사이트 — 단체 목록·상세 */
function showTroupe(tid,push){
  if(push!==false)history.pushState({view:'troupe',id:tid},'','#troupe-'+tid);
  setNav('troupes');mobShowDetail();
  var troupe=DB.troupes.find(function(t){return t.id===tid;});if(!troupe)return;
  var shows=sortShows(DB.shows.filter(function(s){return ids(fld(s,'극단')).indexOf(tid)>-1;}));
  var showIds=shows.map(function(s){return s.id;});

  // 극단 참여 이력 집계 (배우/스텝 통합, 참여 횟수 기준 랭킹)
  var memberMap={};
  showIds.forEach(function(sid){
    DB.history.filter(function(h){return isValidH(h)&&ids(fld(h,'공연')).indexOf(sid)>-1;}).forEach(function(h){
      var pid=ids(fld(h,'참여자'))[0]||'';if(!pid)return;
      if(!memberMap[pid])memberMap[pid]={cnt:0,actor:0,staff:0};
      memberMap[pid].cnt++;
      var t=tname(h);
      if(t==='배우')memberMap[pid].actor++;else if(t==='스텝')memberMap[pid].staff++;
    });
  });
  var topMembers=Object.keys(memberMap).sort(function(a,b){return memberMap[b].cnt-memberMap[a].cnt;}).slice(0,12);
  var memberCnt=Object.keys(memberMap).length;

  var troupePhotos=fld(troupe,'사진')||[];
  var tStatus=fld(troupe,'운영상태');
  var tRegion=fld(troupe,'활동지역');
  var tLinksH='';
  var tLinks=(fld(troupe,'주요링크')||[]).filter(function(l){return l&&l.url;});
  if(tLinks.length){
    tLinksH='<div class="person-links-inline">'+tLinks.map(function(l){return '<a class="person-link-chip" href="'+l.url+'" target="_blank" rel="noopener noreferrer">'+linkLabel(l)+'</a>';}).join('')+'</div>';
  }
  var h='<div class="detail-header"><div class="eyebrow">단체</div><div class="detail-title">'+fld(troupe,'극단명')+favBtnHtml('troupe',tid)+'</div><div class="detail-meta"><span>공연 '+shows.length+'개</span>'+(memberCnt?'<span>사람 '+memberCnt+'명</span>':'')+(tStatus?'<span>'+tStatus+'</span>':'')+(tRegion?'<span>📍 '+tRegion+'</span>':'')+'</div>'+tLinksH
    +'<div style="margin-top:0.8rem;display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center" id="troupe-claim-widget"></div></div>';
  h+=buildPhotoGalleryHtml(troupePhotos,fld(troupe,'극단명'),false);
  var tFoundedYear=fld(troupe,'창단연도');
  var tRecruiting=fld(troupe,'모집정보');
  var tInfoRows=[];
  if(tFoundedYear)tInfoRows.push('<div class="info-row"><span class="info-row-label">창단연도</span><span>'+tFoundedYear+'년</span></div>');
  if(tRecruiting)tInfoRows.push('<div class="info-row"><span class="info-row-label">단원 모집</span><span>'+tRecruiting+'</span></div>');
  if(tInfoRows.length){
    h+='<div class="sec"><div class="sec-label">실전 정보</div><div class="info-rows">'+tInfoRows.join('')+'</div></div>';
  }

  if(topMembers.length){
    h+='<div class="sec"><div class="sec-label">많이 참여한 사람</div><div class="coactor-grid">';
    topMembers.forEach(function(pid){
      var cphoto=PERSON_PHOTO[pid]||'';
      var cphotoH=cphoto?'<img class="coactor-photo" src="'+cphoto+'">':'<div class="coactor-photo-ph">🎭</div>';
      var m=memberMap[pid];
      var roleParts=[];if(m.actor)roleParts.push('배우 '+m.actor);if(m.staff)roleParts.push('스텝 '+m.staff);
      h+='<div class="coactor-card" data-action="person" data-id="'+pid+'">'+cphotoH+'<div class="coactor-info"><div class="coactor-name">'+nm(pid)+'</div><div class="coactor-cnt">'+(roleParts.join(' · ')||m.cnt+'회')+'</div></div></div>';
    });
    h+='</div></div>';
  }

  if(shows.length){
    var tYearCntMap={};shows.forEach(function(s){var y=yearOf(fld(s,'공연 날짜')||'')||'연도 미상';tYearCntMap[y]=(tYearCntMap[y]||0)+1;});
    var tYears=Object.keys(tYearCntMap).sort().reverse();
    window._troupeShows=shows;
    window._troupeActiveYear='all';
    window._renderTroupeShowGrid=function(yearArg){
      if(yearArg!==undefined)window._troupeActiveYear=yearArg;
      var yearFilter=window._troupeActiveYear;
      var filtered=window._troupeShows.filter(function(s){
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
      var el=$('troupe-show-grid');if(el)el.innerHTML=gridH||'<div class="empty" style="grid-column:1/-1">해당 공연이 없습니다.</div>';
      $$('.tf-year-btn').forEach(function(btn){btn.classList.toggle('pf-active',btn.dataset.year===yearFilter);});
    };
    var tYearBtnsH='<button class="pf-btn tf-year-btn pf-active" data-year="all" onclick="_renderTroupeShowGrid(\'all\')">전체</button>';
    tYears.forEach(function(y){tYearBtnsH+='<button class="pf-btn tf-year-btn" data-year="'+y+'" onclick="_renderTroupeShowGrid(\''+y+'\')">'+y+'</button>';});
    h+='<div class="sec"><div class="sec-label">공연 목록</div>'
      +'<div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-bottom:0.8rem">'+tYearBtnsH+'</div>'
      +'<div class="item-grid" id="troupe-show-grid"></div></div>';
  } else {h+='<div class="empty">등록된 공연이 없습니다.</div>';}
  mn(h);
  if(window._renderTroupeShowGrid)_renderTroupeShowGrid('all');
  renderTroupeClaimWidget(tid);
  injectBackBtn('← 단체',function(){goTroupes();});
}

function goTroupes(push){
  if(push!==false)history.pushState({view:'troupes'},'','#troupes');
  setNav('troupes');_sbContext='troupes';  _allTroupes=DB.troupes.filter(function(t){return fld(t,'극단명');});
  _troupeFilter={orgType:'',memberBase:'',region:'',status:'',sort:'name'};
  renderTroupeIndex();
}
function clearTroupeFilter(){_troupeFilter={orgType:'',memberBase:'',region:'',status:'',sort:'name'};renderTroupeIndex();}

function renderTroupeIndex(){
  var all=_allTroupes;
  if(!all.length){mn('<div class="tab-index"><div class="result-empty"><div class="result-empty-icon">🏢</div>단체 데이터가 없습니다.</div></div>');return;}

  var showCntMap={},memberCntMap={};
  all.forEach(function(t){
    var shows=DB.shows.filter(function(s){return ids(fld(s,'극단')).indexOf(t.id)>-1;});
    showCntMap[t.id]=shows.length;
    var memberSet={};
    shows.forEach(function(s){
      DB.history.filter(function(h){return isValidH(h)&&ids(fld(h,'공연')).indexOf(s.id)>-1;})
        .forEach(function(h){var pid=ids(fld(h,'참여자'))[0]||'';if(pid)memberSet[pid]=true;});
    });
    memberCntMap[t.id]=Object.keys(memberSet).length;
  });

  var orgTypeSet={},memberBaseSet={},regionSet={},statusSet={};
  all.forEach(function(t){var o=fld(t,'조직형태')||[];(Array.isArray(o)?o:[o]).forEach(function(v){if(v)orgTypeSet[v]=true;});var m=fld(t,'구성원기반');if(m)memberBaseSet[m]=true;(function(r){(Array.isArray(r)?r:[r]).forEach(function(x){if(x)regionSet[x]=true;});})(fld(t,'활동지역'));var s=fld(t,'운영상태');if(s)statusSet[s]=true;});
  var orgTypes=Object.keys(orgTypeSet).sort();
  var memberBases=Object.keys(memberBaseSet).sort();
  var regions=Object.keys(regionSet).sort();
  var statuses=Object.keys(statusSet).sort();

  var filtered=all.filter(function(t){
    if(_troupeFilter.orgType&&(fld(t,'조직형태')||[]).indexOf(_troupeFilter.orgType)===-1)return false;
    if(_troupeFilter.memberBase&&fld(t,'구성원기반')!==_troupeFilter.memberBase)return false;
    if(_troupeFilter.region){var rg=fld(t,'활동지역');if((Array.isArray(rg)?rg:[rg]).indexOf(_troupeFilter.region)===-1)return false;}
    if(_troupeFilter.status&&fld(t,'운영상태')!==_troupeFilter.status)return false;
    return true;
  });

  if(_troupeFilter.sort==='shows'){
    filtered=filtered.slice().sort(function(a,b){return showCntMap[b.id]-showCntMap[a.id];});
  } else if(_troupeFilter.sort==='members'){
    filtered=filtered.slice().sort(function(a,b){return memberCntMap[b.id]-memberCntMap[a.id];});
  } else {
    filtered=filtered.slice().sort(function(a,b){return(fld(a,'극단명')||'').localeCompare(fld(b,'극단명')||'');});
  }

  var opt=function(arr){return arr.map(function(x){return{v:x,l:x};});};
  var filterH=filterBar('troupes',[
    {key:'orgType',label:'조직형태',type:'single',value:_troupeFilter.orgType,options:opt(orgTypes)},
    {key:'memberBase',label:'구성원',type:'single',value:_troupeFilter.memberBase,options:opt(memberBases)},
    {key:'region',label:'지역',type:'single',value:_troupeFilter.region,options:opt(regions)},
    {key:'status',label:'운영상태',type:'single',value:_troupeFilter.status,options:opt(statuses)}
  ],{
    count:'<em>'+filtered.length+'</em>개 단체',
    sort:{value:_troupeFilter.sort,options:[{v:'name',l:'이름순'},{v:'shows',l:'공연 많은순'},{v:'members',l:'참여 사람 많은순'}],onChange:function(v){_troupeFilter.sort=v;renderTroupeIndex();}},
    onChange:function(k,v){_troupeFilter[k]=v;renderTroupeIndex();},
    onReset:function(){_troupeFilter={orgType:'',memberBase:'',region:'',status:'',sort:_troupeFilter.sort};renderTroupeIndex();}
  });
  var resultH='';

  var listH='';
  if(!filtered.length){
    listH='<div class="result-empty"><div class="result-empty-icon">🏢</div>해당하는 단체가 없어요.</div>';
  } else {
    listH='<div class="result-grid">';
    filtered.forEach(function(t){
      var tphoto=iurl(fld(t,'사진'));
      var tphH=tphoto?'<img src="'+tphoto+'" style="width:100%;height:100%;object-fit:cover;border-radius:8px">':'🏢';
      listH+='<div class="result-card" data-action="troupe" data-id="'+t.id+'">'+favBtnHtml('troupe',t.id)
        +'<div class="result-card-ph">'+tphH+'</div>'
        +'<div class="result-card-body">'
        +'<div class="result-card-title">'+fld(t,'극단명')+'</div>'
        +'<div class="result-card-sub">공연 '+showCntMap[t.id]+'개</div>'
        +(memberCntMap[t.id]?'<div class="result-card-sub">사람 '+memberCntMap[t.id]+'명</div>':'')
        +'</div></div>';
    });
    listH+='</div>';
  }
  mn('<div class="tab-index">'+filterH+resultH+listH+'</div>');
}
