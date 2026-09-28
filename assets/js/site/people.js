/* 오리 사이트 — 사람 목록·상세, 사진 갤러리 */
/* ══ 사람 ══ */
var _allPeople=[];
var _peopleFilter={type:'all',staffRole:'',sort:'name'};
var _peopleIndexView='grid';

function goPeople(push){
  if(push!==false)history.pushState({view:'people'},'','#people');
  setNav('people');_sbContext='people';  _allPeople=DB.people.filter(function(p){return fld(p,'이름');});
  _peopleFilter={type:'all',staffRole:'',sort:'name'};
  renderPeopleIndex();
}

function renderPeopleIndex(){
  var all=_allPeople;
  var staffRoleSet={};
  all.forEach(function(p){
    histByPerson(p.id).filter(function(h){return tname(h)==='스텝';}).forEach(function(h){
      var srid=ids(fld(h,'스텝'))[0]||'';
      if(srid&&nm(srid))staffRoleSet[srid]=nm(srid);
    });
  });
  var staffRoleIds=Object.keys(staffRoleSet).sort(function(a,b){return(STAFF_ORDER[a]||999)-(STAFF_ORDER[b]||999);});

  var filtered=all.filter(function(p){
    var hist=histByPerson(p.id);
    if(_peopleFilter.type==='actor'&&!hist.some(function(h){return tname(h)==='배우';}))return false;
    if(_peopleFilter.type==='staff'&&!hist.some(function(h){return tname(h)==='스텝';}))return false;
    if(_peopleFilter.staffRole&&!hist.some(function(h){return tname(h)==='스텝'&&ids(fld(h,'스텝')).indexOf(_peopleFilter.staffRole)>-1;}))return false;
    return true;
  });

  if(_peopleFilter.sort==='count'){
    filtered=filtered.slice().sort(function(a,b){return histByPerson(b.id).length-histByPerson(a.id).length;});
  }

  var filterH=filterBar('people',[
    {key:'type',label:'역할',type:'single',value:_peopleFilter.type==='all'?'':_peopleFilter.type,options:[{v:'actor',l:'배우'},{v:'staff',l:'스텝'}]},
    {key:'staffRole',label:'스텝 역할',type:'single',value:_peopleFilter.staffRole,options:_peopleFilter.type==='actor'?[]:staffRoleIds.map(function(r){return{v:r,l:nm(r)};})}
  ],{
    count:'<em>'+filtered.length+'</em>명',
    sort:{value:_peopleFilter.sort,options:[{v:'name',l:'이름순'},{v:'count',l:'참여 이력순'}],onChange:function(v){_peopleFilter.sort=v;renderPeopleIndex();}},
    view:{value:_peopleIndexView,onChange:function(v){_peopleIndexView=v;renderPeopleIndex();}},
    onChange:function(k,v){
      if(k==='type'){_peopleFilter.type=v||'all';if(v==='actor')_peopleFilter.staffRole='';}
      else _peopleFilter[k]=v;
      renderPeopleIndex();
    },
    onReset:function(){_peopleFilter={type:'all',staffRole:'',sort:_peopleFilter.sort};renderPeopleIndex();}
  });
  var resultH='';

  var listH='';
  if(!filtered.length){
    listH='<div class="result-empty"><div class="result-empty-icon">👤</div>해당하는 사람이 없어요.</div>';
  } else if(_peopleIndexView==='grid'){
    listH='<div class="result-grid">';
    filtered.forEach(function(p){
      var hist=histByPerson(p.id);
      var actCnt=hist.filter(function(h){return tname(h)==='배우';}).length;
      var staffRoleCntMap={};
      hist.filter(function(h){return tname(h)==='스텝';}).forEach(function(h){
        var srid=ids(fld(h,'스텝'))[0]||'';
        if(srid&&nm(srid))staffRoleCntMap[nm(srid)]=(staffRoleCntMap[nm(srid)]||0)+1;
      });
      var staffRoleNames=Object.keys(staffRoleCntMap).sort(function(a,b){
        var oa=Object.keys(MAP).find(function(k){return MAP[k]===a;})||'';
        var ob=Object.keys(MAP).find(function(k){return MAP[k]===b;})||'';
        return(STAFF_ORDER[oa]||999)-(STAFF_ORDER[ob]||999);
      });
      var photo=PERSON_PHOTO[p.id]||'';
      var tagsH='<div class="result-card-tags">'+(actCnt?'<span class="result-card-tag" style="color:var(--actor);background:var(--actor-bg)">배우 '+actCnt+'</span>':'');
      staffRoleNames.forEach(function(rname){tagsH+='<span class="result-card-tag" style="color:var(--staff);background:var(--staff-bg)">'+rname+' '+staffRoleCntMap[rname]+'</span>';});
      tagsH+='</div>';
      listH+='<div class="result-card" data-action="person" data-id="'+p.id+'">'+favBtnHtml('person',p.id)+(photo?'<img src="'+photo+'" alt="'+fld(p,'이름')+'" style="width:100%;aspect-ratio:2/3;object-fit:cover;display:block">':'<div class="result-card-ph">👤</div>')+'<div class="result-card-body"><div class="result-card-title">'+fld(p,'이름')+'</div>'+tagsH+'</div></div>';
    });
    listH+='</div>';
  } else {
    listH='<div class="result-list">';
    filtered.forEach(function(p){
      var hist=histByPerson(p.id);
      var actCnt=hist.filter(function(h){return tname(h)==='배우';}).length;
      var staffRoleCntMap2={};
      hist.filter(function(h){return tname(h)==='스텝';}).forEach(function(h){
        var srid=ids(fld(h,'스텝'))[0]||'';
        if(srid&&nm(srid))staffRoleCntMap2[nm(srid)]=(staffRoleCntMap2[nm(srid)]||0)+1;
      });
      var staffRoleNames2=Object.keys(staffRoleCntMap2).sort(function(a,b){
        var oa=Object.keys(MAP).find(function(k){return MAP[k]===a;})||'';
        var ob=Object.keys(MAP).find(function(k){return MAP[k]===b;})||'';
        return(STAFF_ORDER[oa]||999)-(STAFF_ORDER[ob]||999);
      });
      var photo=PERSON_PHOTO[p.id]||'';
      var metaH=(actCnt?'<span class="rr-tag" style="color:var(--actor)">배우 '+actCnt+'</span>':'');
      staffRoleNames2.forEach(function(rname){metaH+='<span class="rr-tag" style="color:var(--staff)">'+rname+' '+staffRoleCntMap2[rname]+'</span>';});
      metaH+='<span class="rr-tag">총 '+hist.length+'회</span>';
      listH+='<div class="result-row" data-action="person" data-id="'+p.id+'"><div class="rr-poster" style="border-radius:50%">'+(photo?'<img src="'+photo+'" style="border-radius:50%">':'👤')+'</div><div class="rr-main"><div class="rr-title">'+fld(p,'이름')+'</div><div class="rr-meta">'+metaH+'</div></div></div>';
    });
    listH+='</div>';
  }
  mn('<div class="tab-index">'+filterH+resultH+listH+'</div>');
}

function showPerson(pid,push){
  if(push!==false)history.pushState({view:'person',id:pid},'','#person-'+pid);
  setNav('people');mobShowDetail();
  var person=DB.people.find(function(p){return p.id===pid;});if(!person)return;
  var hist=sortHistByShowDate(histByPerson(pid));
  var actors=hist.filter(function(h){return tname(h)==='배우';});
  var staff=hist.filter(function(h){return tname(h)==='스텝';});
  var showIds=[];hist.forEach(function(h){var sid=ids(fld(h,'공연'))[0]||'';if(sid&&showIds.indexOf(sid)===-1)showIds.push(sid);});
  var troupeIds=[];showIds.forEach(function(sid){var s=DB.shows.find(function(x){return x.id===sid;});if(!s)return;var tid=ids(fld(s,'극단'))[0]||'';if(tid&&troupeIds.indexOf(tid)===-1)troupeIds.push(tid);});
  var roleIds=[];actors.forEach(function(h){var rid=ids(fld(h,'배역'))[0]||'';if(rid&&roleIds.indexOf(rid)===-1)roleIds.push(rid);});
  var coMap={};
  showIds.forEach(function(sid){DB.history.filter(function(h){return isValidH(h)&&ids(fld(h,'공연')).indexOf(sid)>-1&&tname(h)==='배우';}).forEach(function(h){var cpid=ids(fld(h,'참여자'))[0]||'';if(!cpid||cpid===pid)return;coMap[cpid]=(coMap[cpid]||0)+1;});});
  var coActors=Object.keys(coMap).sort(function(a,b){return coMap[b]-coMap[a];}).slice(0,8);
  var coStaffMap={};
  showIds.forEach(function(sid){DB.history.filter(function(h){return isValidH(h)&&ids(fld(h,'공연')).indexOf(sid)>-1&&tname(h)==='스텝';}).forEach(function(h){var cpid=ids(fld(h,'참여자'))[0]||'';if(!cpid||cpid===pid)return;if(!coStaffMap[cpid])coStaffMap[cpid]={cnt:0,roles:{}};coStaffMap[cpid].cnt++;var srid=ids(fld(h,'스텝'))[0]||'';if(srid&&nm(srid))coStaffMap[cpid].roles[nm(srid)]=true;});});
  var coStaff=Object.keys(coStaffMap).sort(function(a,b){return coStaffMap[b].cnt-coStaffMap[a].cnt;}).slice(0,6);
  var troupeCntMap={};showIds.forEach(function(sid){var s=DB.shows.find(function(x){return x.id===sid;});if(!s)return;var tid=ids(fld(s,'극단'))[0]||'';if(!tid)return;troupeCntMap[tid]=(troupeCntMap[tid]||0)+1;});
  var troupeRanked=Object.keys(troupeCntMap).sort(function(a,b){return troupeCntMap[b]-troupeCntMap[a];}).slice(0,5);
  var yearCntMap={};showIds.forEach(function(sid){var y=yearOf(showDate(sid));if(y)yearCntMap[y]=(yearCntMap[y]||0)+1;});
  var allYears=Object.keys(yearCntMap).sort();var maxYearCnt=Math.max.apply(null,Object.values(yearCntMap).concat([1]));
  var firstYear=allYears[0]||'',lastActiveYear=allYears[allYears.length-1]||'';
  var spanLabel=firstYear&&lastActiveYear?(firstYear===lastActiveYear?firstYear+'년 활동':firstYear+' – '+lastActiveYear+' 활동'):'';

  // 배역 태그(person 기준): 실제로 이 사람이 맡은 배역들의 태그 집계
  var roleById={};DB.roles.forEach(function(r){roleById[r.id]=r;});
  var tagCounts={};
  actors.forEach(function(h){
    ids(fld(h,'배역')).forEach(function(rid){
      var role=roleById[rid];if(!role)return;
      (fld(role,'태그')||[]).forEach(function(t){if(t)tagCounts[t]=(tagCounts[t]||0)+1;});
    });
  });
  var tagRanked=Object.keys(tagCounts).sort(function(a,b){return tagCounts[b]-tagCounts[a];}).slice(0,10);

  // 창작이력 (작가/작곡 등 - 참여이력과 별개 테이블)
  var creationRecs=DB.creationHistory.filter(function(c){return ids(fld(c,'창작자')).indexOf(pid)>-1;});
  var creationWorkIds=[];creationRecs.forEach(function(c){var wid=ids(fld(c,'작품'))[0]||'';if(wid&&creationWorkIds.indexOf(wid)===-1)creationWorkIds.push(wid);});

  // 활동 축(배우/스태프/창작) 중 비중 큰 순으로 자연스러운 소개문구 생성
  var axisCounts=[];
  if(actors.length)axisCounts.push({label:'배우',n:actors.length});
  var staffRoleCounts={};
  staff.forEach(function(h){ids(fld(h,'스텝')).forEach(function(srid){var n=nm(srid);if(n)staffRoleCounts[n]=(staffRoleCounts[n]||0)+1;});});
  var topStaffRole=Object.keys(staffRoleCounts).sort(function(a,b){return staffRoleCounts[b]-staffRoleCounts[a];})[0]||'';
  if(staff.length)axisCounts.push({label:topStaffRole||'스태프',n:staff.length});
  if(creationWorkIds.length)axisCounts.push({label:'창작',n:creationWorkIds.length});
  axisCounts.sort(function(a,b){return b.n-a.n;});
  var roleBlurb;
  if(!axisCounts.length)roleBlurb='아직 참여이력이 없어요';
  else if(axisCounts.length===1)roleBlurb='주로 '+axisCounts[0].label+'로 활동';
  else roleBlurb='주로 '+axisCounts[0].label+'로, '+axisCounts.slice(1).map(function(a){return a.label;}).join('·')+'도 겸하며 활동';
  var blurbFull=roleBlurb+(spanLabel?' · '+spanLabel:'');

  // 사진: 대표 사진은 고정 헤더에, 나머지는 전체너비 갤러리로
  var personPhotos=(fld(person,'사진')||[]).filter(function(p){return p&&p.url;});
  var primaryPhotoUrl=personPhotos.length?personPhotos[0].url:'';
  var stickyPhotoH=primaryPhotoUrl?'<img class="person-sticky-photo" src="'+primaryPhotoUrl+'" alt="'+fld(person,'이름')+'">':'<div class="person-sticky-photo-ph">🎭</div>';

  var personLinks=fld(person,'홍보링크')||[];
  var validLinks=personLinks.filter(function(l){return l&&l.url;});
  var stickyLinksInlineH=validLinks.length?validLinks.map(function(l){
    var d=detectLinkPlatform(l.url);
    return '<a class="person-link-chip-sm" href="'+l.url+'" target="_blank" rel="noopener noreferrer">'+(d?d.icon+' '+d.name:'🔗 '+(l.label||'링크'))+'</a>';
  }).join(''):'';

  var stickyH='<div class="person-sticky-header"><div class="person-sticky-row">'+stickyPhotoH
    +'<div class="person-sticky-text"><div class="person-sticky-name">'+fld(person,'이름')+favBtnHtml('person',pid)+'</div>'
    +'<div class="person-sticky-blurb">'+blurbFull+(stickyLinksInlineH?'<span class="person-sticky-links-inline">'+stickyLinksInlineH+'</span>':'')+'</div></div>'
    +'<span id="claim-widget" style="margin-left:auto;display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap"></span></div></div>';

  var isMyProfile=CURRENT_USER&&CURRENT_USER.personId===pid;
  var nonPrimaryPhotos=personPhotos.slice(1); // 첫번째(대표사진)는 고정헤더에 이미 나오므로 목록에서 제외
  var galleryFullH='';
  if(nonPrimaryPhotos.length){
    var GALLERY_INITIAL=12;
    galleryFullH='<div class="person-gallery-full"><div class="person-gallery-grid-wide">';
    nonPrimaryPhotos.forEach(function(p,i){
      galleryFullH+='<img src="'+p.url+'" alt="'+fld(person,'이름')+'"'+(i>=GALLERY_INITIAL?' class="gallery-extra-hidden"':'')+'>';
    });
    galleryFullH+='</div>';
    if(nonPrimaryPhotos.length>GALLERY_INITIAL){
      galleryFullH+='<button class="person-gallery-more-btn" data-hidden-count="'+(nonPrimaryPhotos.length-GALLERY_INITIAL)+'" onclick="togglePersonGalleryWide(this)">+'+(nonPrimaryPhotos.length-GALLERY_INITIAL)+'장 더보기</button>';
    }
    galleryFullH+='</div>';
  }

  var statsH='<div class="person-stats-inline">'
    +'<div class="psi-item"><div class="psi-num">'+showIds.length+'</div><div class="psi-label">총 공연</div></div>'
    +'<div class="psi-item"><div class="psi-num">'+actors.length+'</div><div class="psi-label">배우 참여</div></div>'
    +'<div class="psi-item"><div class="psi-num">'+staff.length+'</div><div class="psi-label">스텝 참여</div></div>'
    +(creationWorkIds.length?'<div class="psi-item"><div class="psi-num">'+creationWorkIds.length+'</div><div class="psi-label">창작 참여</div></div>':'')
    +'<div class="psi-item"><div class="psi-num">'+roleIds.length+'</div><div class="psi-label">맡은 배역</div></div>'
    +'<div class="psi-item"><div class="psi-num">'+troupeIds.length+'</div><div class="psi-label">참여 단체</div></div>'
    +'</div>';
  var statsCardH='<div class="person-side-card person-card-medium"><div class="person-side-title">활동 요약</div>'+statsH+'</div>';

  var chartH='';
  if(allYears.length>=1){
    var CHART_H=44;
    chartH='<div class="year-chart-block person-card-medium"><div class="year-chart-title">연도별 공연 수</div><div class="mini-chart">';
    allYears.forEach(function(y){var cnt=yearCntMap[y];var barPx=Math.max(4,Math.round((cnt/maxYearCnt)*CHART_H));chartH+='<div class="mini-bar-wrap"><div class="mini-bar-cnt">'+cnt+'</div><div class="mini-bar" style="height:'+barPx+'px"></div><div class="mini-bar-label">'+y+'</div></div>';});
    chartH+='</div></div>';
  }

  var troupeChipsH='';
  if(troupeRanked.length){
    troupeChipsH='<div class="person-side-card"><div class="person-side-title">주로 함께한 단체</div><div class="person-troupes-inline">';
    troupeRanked.forEach(function(tid){troupeChipsH+='<span class="troupe-chip" data-action="troupe" data-id="'+tid+'">'+nm(tid)+'<span class="troupe-chip-cnt">'+troupeCntMap[tid]+'회</span></span>';});
    troupeChipsH+='</div></div>';
  }

  var tagChipsH='';
  if(tagRanked.length){
    tagChipsH='<div class="person-side-card"><div class="person-side-title">자주 맡은 배역 유형</div>';
    tagRanked.forEach(function(t){tagChipsH+='<span class="role-tag-chip">'+t+'<span class="role-tag-chip-cnt">'+tagCounts[t]+'</span></span>';});
    tagChipsH+='</div>';
  }

  var creationChipsH='';
  if(creationWorkIds.length){
    creationChipsH='<div class="person-side-card"><div class="person-side-title">창작 참여 작품</div><div class="person-troupes-inline">';
    creationWorkIds.forEach(function(wid){creationChipsH+='<span class="troupe-chip" data-action="work" data-id="'+wid+'">'+nm(wid)+'</span>';});
    creationChipsH+='</div></div>';
  }

  var overviewH='<div class="person-overview-grid">'+statsCardH+chartH+troupeChipsH+tagChipsH+creationChipsH+'</div>';

  var h=stickyH+'<div class="person-sticky-spacer"></div><div id="person-intro-line"></div>'+galleryFullH+overviewH;

  var showMap={};
  hist.forEach(function(rec){
    var sid=ids(fld(rec,'공연'))[0]||'';if(!sid)return;
    if(!showMap[sid])showMap[sid]={sid:sid,roles:[],staffRoles:[],isActor:false,isStaff:false,d:showDate(sid),rolePhoto:''};
    var isActor=tname(rec)==='배우';
    if(isActor){
      showMap[sid].isActor=true;
      var rid=ids(fld(rec,'배역'))[0]||'';if(rid&&nm(rid))showMap[sid].roles.push(nm(rid));
      if(!showMap[sid].rolePhoto){
        var recPhotoArr=fld(rec,'사진')||[];
        if(recPhotoArr.length)showMap[sid].rolePhoto=iurl(recPhotoArr);
      }
    }else{showMap[sid].isStaff=true;var srid=ids(fld(rec,'스텝'))[0]||'';if(srid&&nm(srid))showMap[sid].staffRoles.push(nm(srid));}
  });
  // 항상 날짜순(최신순) 정렬 — 표시 방식(포스터/배역 프로필)만 토글 대상
  var showEntries=Object.values(showMap).sort(function(a,b){if(!a.d&&!b.d)return 0;if(!a.d)return 1;if(!b.d)return -1;return b.d.localeCompare(a.d);});
  window._personActiveType='all';
  window._personActiveYear='all';
  window._personImgMode='poster'; // 'poster' = 공연 포스터 우선, 'role' = 배역 프로필 사진 우선
  window._renderPersonGrid=function(typeArg,yearArg,imgModeArg){
    if(typeArg!==undefined)window._personActiveType=typeArg;
    if(yearArg!==undefined)window._personActiveYear=yearArg;
    if(imgModeArg!==undefined)window._personImgMode=imgModeArg;
    var filter=window._personActiveType;var yearFilter=window._personActiveYear;var imgMode=window._personImgMode;
    var filtered=showEntries.filter(function(e){
      if(filter==='actor'&&!e.isActor)return false;
      if(filter==='staff'&&!e.isStaff)return false;
      if(yearFilter!=='all'&&(yearOf(e.d)||'연도 미상')!==yearFilter)return false;
      return true;
    });
    var gridH='';
    filtered.forEach(function(e){
      var dateLabel=ym(e.d);
      var useRolePhoto=imgMode==='role'&&e.rolePhoto;
      var u=useRolePhoto?e.rolePhoto:(POSTER[e.sid]||'');
      var imgH=u?'<img class="cast-img" src="'+u+'">':'<div class="cast-img-ph">&nbsp;</div>';
      var roleLabel='';
      if(filter==='staff'){roleLabel=e.staffRoles.join(', ');}
      else if(filter==='actor'){roleLabel=e.roles.join(', ');}
      else{var parts=[];if(e.roles.length)parts.push(e.roles.join(', '));if(e.staffRoles.length)parts.push(e.staffRoles.join(', '));roleLabel=parts.join(' / ');}
      // 배역 프로필 모드 + 배우 이력이면 배역명을 주 라벨로, 공연명을 부 라벨로 뒤집는다
      var primaryLabel,secondaryLabel;
      if(imgMode==='role'&&e.isActor&&e.roles.length){primaryLabel=e.roles.join(', ');secondaryLabel=nm(e.sid);}
      else{primaryLabel=nm(e.sid);secondaryLabel=roleLabel;}
      var tagH='<div style="display:flex;gap:4px;flex-wrap:wrap">';
      if(e.isActor)tagH+='<div class="cast-card-tag cast-card-tag-actor">배우</div>';
      if(e.isStaff){
        if(e.staffRoles.length){e.staffRoles.forEach(function(sr){tagH+='<div class="cast-card-tag cast-card-tag-staff">'+sr+'</div>';});}
        else{tagH+='<div class="cast-card-tag cast-card-tag-staff">스탭</div>';}
      }
      tagH+='</div>';
      gridH+='<div class="cast-card" data-action="show" data-id="'+e.sid+'">'+imgH+'<div class="cast-name">'+primaryLabel+'</div>'+(secondaryLabel?'<div class="cast-role">'+secondaryLabel+'</div>':'')+(dateLabel?'<div class="cast-role" style="opacity:.6">'+dateLabel+'</div>':'')+tagH+'</div>';
    });
    if(!filtered.length)gridH='<div class="empty" style="grid-column:1/-1">해당 이력이 없습니다.</div>';
    var el=$('person-grid');if(el)el.innerHTML=gridH;
    ['all','actor','staff'].forEach(function(f){var btn=$('pf-'+f);if(btn)btn.classList.toggle('pf-active',f===filter);});
    $$('.pf-year-btn').forEach(function(btn){btn.classList.toggle('pf-active',btn.dataset.year===yearFilter);});
    ['poster','role'].forEach(function(m){var btn=$('pf-img-'+m);if(btn)btn.classList.toggle('pf-active',m===imgMode);});
  };
  if(showEntries.length){
    var yearBtnsH='<button class="pf-btn pf-year-btn pf-active" data-year="all" onclick="_renderPersonGrid(undefined,\'all\')">전체</button>';
    allYears.slice().reverse().forEach(function(y){yearBtnsH+='<button class="pf-btn pf-year-btn" data-year="'+y+'" onclick="_renderPersonGrid(undefined,\''+y+'\')">'+y+'</button>';});
    h+='<div class="sec"><div style="display:flex;align-items:center;gap:0.6rem;margin-bottom:0.6rem;flex-wrap:wrap">'
      +'<span style="font-size:0.68rem;letter-spacing:0.22em;color:var(--muted);text-transform:uppercase">활동 이력</span>'
      +'<div style="flex:1;height:1px;background:var(--line);min-width:1rem"></div>'
      +'<div style="display:flex;gap:0.4rem">'
      +'<button id="pf-img-poster" class="pf-btn pf-active" onclick="_renderPersonGrid(undefined,undefined,\'poster\')">공연 포스터</button>'
      +'<button id="pf-img-role" class="pf-btn" onclick="_renderPersonGrid(undefined,undefined,\'role\')">배역 프로필</button>'
      +'</div>'
      +'<div style="display:flex;gap:0.4rem">'
      +'<button id="pf-all" class="pf-btn pf-active" onclick="_renderPersonGrid(\'all\')">전체</button>'
      +'<button id="pf-actor" class="pf-btn" onclick="_renderPersonGrid(\'actor\')">배우만</button>'
      +'<button id="pf-staff" class="pf-btn" onclick="_renderPersonGrid(\'staff\')">스탭만</button>'
      +'</div></div>'
      +'<div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-bottom:0.8rem">'+yearBtnsH+'</div>'
      +'<div class="cast-grid" id="person-grid"></div></div>';
  }
  if(coActors.length){
    h+='<div class="sec"><div class="sec-label">함께한 배우</div><div class="coactor-grid">';
    coActors.forEach(function(cpid){var cphoto=PERSON_PHOTO[cpid]||'';var cphotoH=cphoto?'<img class="coactor-photo" src="'+cphoto+'">':'<div class="coactor-photo-ph">🎭</div>';h+='<div class="coactor-card" data-action="person" data-id="'+cpid+'">'+cphotoH+'<div class="coactor-info"><div class="coactor-name">'+nm(cpid)+'</div><div class="coactor-cnt">'+coMap[cpid]+'회 함께</div></div></div>';});
    h+='</div></div>';
  }
  if(coStaff.length){
    h+='<div class="sec"><div class="sec-label">자주 함께한 스텝</div><div class="coactor-grid">';
    coStaff.forEach(function(cpid){var cphoto=PERSON_PHOTO[cpid]||'';var cphotoH=cphoto?'<img class="coactor-photo" src="'+cphoto+'">':'<div class="coactor-photo-ph">🎭</div>';var roles=Object.keys(coStaffMap[cpid].roles).join(', ');h+='<div class="coactor-card" data-action="person" data-id="'+cpid+'">'+cphotoH+'<div class="coactor-info"><div class="coactor-name">'+nm(cpid)+'</div><div class="coactor-cnt">'+(roles?roles+' · ':'')+coStaffMap[cpid].cnt+'회</div></div></div>';});
    h+='</div></div>';
  }
  if(!hist.length)h+='<div class="empty">참여 이력이 없습니다.</div>';
  mn(h);
  if(window._renderPersonGrid)_renderPersonGrid('all');
  renderClaimWidget(pid);
  renderPersonIntro(pid);
  injectBackBtn('← 사람',function(){goPeople();});
  var stickyScope=_domScope||document;
  requestAnimationFrame(function(){
    var hdr=stickyScope.querySelector('.person-sticky-header');
    var spacer=stickyScope.querySelector('.person-sticky-spacer');
    if(hdr&&spacer)spacer.style.height=hdr.offsetHeight+'px';
  });
}
function buildPhotoGalleryHtml(photos,altText,skipFirst){
  photos=(photos||[]).filter(function(p){return p&&p.url;});
  if(skipFirst===false){
    if(!photos.length)return '';
  }else{
    if(photos.length<2)return '';
    photos=photos.slice(1);
  }
  var rest=photos;
  var GALLERY_INITIAL=12;
  var h='<div class="person-gallery-full"><div class="person-gallery-grid-wide">';
  rest.forEach(function(p,i){h+='<img src="'+p.url+'" alt="'+escHtml(altText||'')+'"'+(i>=GALLERY_INITIAL?' class="gallery-extra-hidden"':'')+'>';});
  h+='</div>';
  if(rest.length>GALLERY_INITIAL)h+='<button class="person-gallery-more-btn" data-hidden-count="'+(rest.length-GALLERY_INITIAL)+'" onclick="togglePersonGalleryWide(this)">+'+(rest.length-GALLERY_INITIAL)+'장 더보기</button>';
  h+='</div>';
  return h;
}
function togglePersonGalleryWide(btn){
  var grid=btn.previousElementSibling;if(!grid)return;
  var expanded=grid.classList.toggle('gallery-expanded');
  btn.textContent=expanded?'접기':('+'+btn.dataset.hiddenCount+'장 더보기');
}
async function renderWishlistInterest(type,id,elId){
  var el=$(elId);if(!el)return;
  try{
    var r=await sbClient.rpc('list_wishlist_interest',{p_target_type:type,p_target_id:id});
    var rows=r.data||[];
    if(!rows.length){el.innerHTML='<div style="font-size:0.8rem;color:var(--muted)">아직 없어요. 하트를 눌러 첫 번째가 되어보세요.</div>';return;}
    el.innerHTML=rows.map(function(row){return '<span class="role-tag-chip">'+(row.nickname||'익명')+'</span>';}).join('');
  }catch(e){el.innerHTML='';}
}

async function uploadMyPhoto(input){
  var file=input.files&&input.files[0];if(!file)return;
  var msgEl=$('my-photo-upload-msg');
  if(msgEl)msgEl.textContent='업로드 중…';
  try{
    var ext=(file.name.split('.').pop()||'jpg').toLowerCase();
    var path='people/'+CURRENT_USER.personId+'/'+Date.now()+'.'+ext;
    var up=await sbClient.storage.from('photos').upload(path,file);
    if(up.error)throw up.error;
    var pub=sbClient.storage.from('photos').getPublicUrl(path);
    var url=pub.data.publicUrl;
    var r=await sbClient.rpc('add_own_person_photo',{photo_url:url});
    if(r.error)throw r.error;
    renderMyPageInfo($('mypage-tab-content'));
  }catch(e){
    if(msgEl)msgEl.textContent='업로드 실패: '+e.message;
  }
}
async function removeMyPhoto(url){
  if(!await oriConfirm('이 사진을 삭제할까요?'))return;
  try{
    var r=await sbClient.rpc('remove_own_person_photo',{photo_url:url});
    if(r.error)throw r.error;
    renderMyPageInfo($('mypage-tab-content'));
  }catch(e){oriAlert('삭제 실패: '+e.message);}
}
async function setPrimaryPhoto(url){
  try{
    var r=await sbClient.rpc('set_primary_person_photo',{photo_url:url});
    if(r.error)throw r.error;
    renderMyPageInfo($('mypage-tab-content'));
  }catch(e){oriAlert('설정 실패: '+e.message);}
}
