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
  var showById={};DB.shows.forEach(function(s){showById[s.id]=s;});

  // 함께한 사람·단체·연도 집계
  var coMap={},coStaffMap={},troupeCntMap={},yearCntMap={};
  showIds.forEach(function(sid){
    histByShow(sid).forEach(function(h){
      var cpid=ids(fld(h,'참여자'))[0]||'';if(!cpid||cpid===pid)return;
      if(tname(h)==='배우')coMap[cpid]=(coMap[cpid]||0)+1;
      else if(tname(h)==='스텝'){if(!coStaffMap[cpid])coStaffMap[cpid]={cnt:0,roles:{}};coStaffMap[cpid].cnt++;var srid=ids(fld(h,'스텝'))[0]||'';if(srid&&nm(srid))coStaffMap[cpid].roles[nm(srid)]=true;}
    });
    var s=showById[sid];var tid=s&&ids(fld(s,'극단'))[0];if(tid)troupeCntMap[tid]=(troupeCntMap[tid]||0)+1;
    var y=yearOf(showDate(sid));if(y)yearCntMap[y]=(yearCntMap[y]||0)+1;
  });
  var coActors=Object.keys(coMap).sort(function(a,b){return coMap[b]-coMap[a];}).slice(0,8);
  var coStaff=Object.keys(coStaffMap).sort(function(a,b){return coStaffMap[b].cnt-coStaffMap[a].cnt;}).slice(0,6);
  var troupeRanked=Object.keys(troupeCntMap).sort(function(a,b){return troupeCntMap[b]-troupeCntMap[a];});
  var allYears=Object.keys(yearCntMap).sort();
  var span=allYears.length?(allYears[0]===allYears[allYears.length-1]?allYears[0]+'년':allYears[0]+' – '+allYears[allYears.length-1]):'';

  // 자주 맡은 배역 유형(배역 태그)
  var roleById={};DB.roles.forEach(function(r){roleById[r.id]=r;});
  var tagCounts={},roleIds=[];
  actors.forEach(function(h){ids(fld(h,'배역')).forEach(function(rid){if(roleIds.indexOf(rid)===-1)roleIds.push(rid);var r=roleById[rid];if(!r)return;(fld(r,'태그')||[]).forEach(function(t){if(t)tagCounts[t]=(tagCounts[t]||0)+1;});});});
  var tagRanked=Object.keys(tagCounts).sort(function(a,b){return tagCounts[b]-tagCounts[a];}).slice(0,10);

  // 창작 참여 작품
  var creationWorkIds=[];DB.creationHistory.forEach(function(c){if(ids(fld(c,'창작자')).indexOf(pid)>-1){var w=ids(fld(c,'작품'))[0];if(w&&creationWorkIds.indexOf(w)===-1)creationWorkIds.push(w);}});

  // 한 줄 소개: 비중 큰 활동 순
  var staffRoleCounts={};staff.forEach(function(h){ids(fld(h,'스텝')).forEach(function(srid){var n=nm(srid);if(n)staffRoleCounts[n]=(staffRoleCounts[n]||0)+1;});});
  var topStaffRole=Object.keys(staffRoleCounts).sort(function(a,b){return staffRoleCounts[b]-staffRoleCounts[a];})[0]||'';
  var axis=[];
  if(actors.length)axis.push({label:'배우',n:actors.length});
  if(staff.length)axis.push({label:topStaffRole||'스텝',n:staff.length});
  if(creationWorkIds.length)axis.push({label:'창작',n:creationWorkIds.length});
  axis.sort(function(a,b){return b.n-a.n;});
  var blurb=!axis.length?'아직 참여 이력이 없어요':(axis.length===1?'주로 '+axis[0].label+'로 활동':'주로 '+axis[0].label+'로, '+axis.slice(1).map(function(a){return a.label;}).join('·')+'도 겸하며 활동');

  // 활동 이력: 공연 단위로 묶기 (최신순)
  var showMap={};
  hist.forEach(function(rec){
    var sid=ids(fld(rec,'공연'))[0]||'';if(!sid)return;
    if(!showMap[sid])showMap[sid]={sid:sid,roles:[],staffRoles:[],isActor:false,isStaff:false,d:showDate(sid),rolePhoto:''};
    var e=showMap[sid];
    if(tname(rec)==='배우'){e.isActor=true;var rid=ids(fld(rec,'배역'))[0]||'';if(rid&&nm(rid))e.roles.push(nm(rid));if(!e.rolePhoto)e.rolePhoto=iurl(fld(rec,'사진'));}
    else{e.isStaff=true;var srid=ids(fld(rec,'스텝'))[0]||'';if(srid&&nm(srid))e.staffRoles.push(nm(srid));}
  });
  var entries=Object.values(showMap).sort(function(a,b){if(!a.d&&!b.d)return 0;if(!a.d)return 1;if(!b.d)return -1;return b.d.localeCompare(a.d);});
  if(!PEEK.rendering)window._ph={entries:entries,type:'',year:'',img:'poster'};  // 패널 미리보기가 페이지 상태를 덮어쓰지 않게

  var photos=(fld(person,'사진')||[]).filter(function(p){return p&&p.url;});
  var chartH='';
  if(allYears.length>1){
    var maxY=Math.max.apply(null,Object.values(yearCntMap));
    chartH='<div class="mini-chart">'+allYears.map(function(y){var c=yearCntMap[y];return '<div class="mini-bar-wrap"><div class="mini-bar-cnt">'+c+'</div><div class="mini-bar" style="height:'+Math.max(4,Math.round(c/maxY*44))+'px"></div><div class="mini-bar-label">'+y+'</div></div>';}).join('')+'</div>';
  }
  dvRender({
    type:'person',id:pid,back:{label:'사람 목록',go:'goPeople()'},
    thumb:{url:photos.length?photos[0].url:'',shape:'round',ph:'👤'},
    kicker:'사람',
    title:fld(person,'이름'),
    sub:escHtml(blurb),
    facts:[['공연',showIds.length?showIds.length+'편':''],['배우',actors.length?actors.length+'회':''],['스텝',staff.length?staff.length+'회':''],['창작',creationWorkIds.length?creationWorkIds.length+'작품':''],['단체',troupeRanked.length?troupeRanked.length+'곳':''],['활동',span]],
    actions:[(CURRENT_USER&&CURRENT_USER.personId===pid)?'':dvActBtn('내 공연에 초대','invitePersonToMyProject(\''+pid+'\')','✉',true),dvFavBtn('person',pid),dvLinkChips(fld(person,'홍보링크')),dvEditBtn('person',pid)],
    widget:'<span id="claim-widget"></span>',
    intro:'<div id="person-intro-line"></div>',
    sections:[
      {title:'활동 이력',n:entries.length,items:entries.map(function(e){return personHistCard(e,'poster');}),layout:'cards',peek:true,body:'<div id="person-hist"></div>'},
      {title:'창작 참여 작품',items:creationWorkIds.map(function(w){return dvChip('work',w,nm(w));}),layout:'chips',peek:true},
      {title:'함께한 배우',items:coActors.map(function(c){return dvPersonRow(c,coMap[c]+'회 함께');}),layout:'rows'},
      {title:'자주 함께한 스텝',items:coStaff.map(function(c){var r=Object.keys(coStaffMap[c].roles).join(', ');return dvPersonRow(c,(r?escHtml(r)+' · ':'')+coStaffMap[c].cnt+'회');}),layout:'rows'},
      {title:'주로 함께한 단체',items:troupeRanked.slice(0,8).map(function(t){return dvChip('troupe',t,nm(t),troupeCntMap[t]+'회');}),layout:'chips'},
      {title:'자주 맡은 배역 유형',items:tagRanked.map(function(t){return dvChip('','',t,tagCounts[t]);}),layout:'chips'},
      {title:'연도별 공연 수',body:chartH},
      {title:'사진',body:buildPhotoGalleryHtml(photos,fld(person,'이름'))}
    ],
    empty:'아직 참여 이력이 없어요.',
    after:function(){personHistRender();renderClaimWidget(pid);renderPersonIntro(pid);}
  });
}
function personHistCard(e,mode){
  var img=mode==='role'&&e.rolePhoto?e.rolePhoto:(POSTER[e.sid]||'');
  var roleTxt=e.roles.join(', '),staffTxt=e.staffRoles.join(', ');
  var sub=[roleTxt,staffTxt].filter(Boolean).map(escHtml).join(' / ');
  var tags=(e.isActor?'<span class="dv-badge dv-badge-actor">배우</span>':'')+(e.isStaff?'<span class="dv-badge dv-badge-staff">스텝</span>':'');
  return '<div class="dv-card" data-action="show" data-id="'+e.sid+'">'
    +(img?'<img class="dv-card-img" src="'+img+'" alt="">':'<div class="dv-card-img dv-card-ph">🎭</div>')
    +'<div class="dv-card-title">'+escHtml(nm(e.sid))+'</div>'
    +(sub?'<div class="dv-card-sub">'+sub+'</div>':'')
    +'<div class="dv-card-sub dv-card-sub2">'+(ym(e.d)||'연도 미상')+tags+'</div></div>';
}
/* 사람 상세의 활동 이력: 역할·연도 필터 + 사진 방식(공연 포스터 / 배역 사진) */
function personHistRender(){
  if(PEEK.rendering)return;
  var st=window._ph,el=document.getElementById('person-hist');if(!st||!el)return;
  var yearCnt={};st.entries.forEach(function(e){var y=yearOf(e.d)||'연도 미상';yearCnt[y]=(yearCnt[y]||0)+1;});
  var years=Object.keys(yearCnt).sort().reverse();
  var hasBoth=st.entries.some(function(e){return e.isActor;})&&st.entries.some(function(e){return e.isStaff;});
  var hasRolePhoto=st.entries.some(function(e){return e.rolePhoto;});
  var list=st.entries.filter(function(e){
    if(st.type==='actor'&&!e.isActor)return false;
    if(st.type==='staff'&&!e.isStaff)return false;
    if(st.year&&(yearOf(e.d)||'연도 미상')!==st.year)return false;
    return true;
  });
  var specs=[];
  if(hasBoth)specs.push({key:'type',label:'역할',type:'single',value:st.type,options:[{v:'actor',l:'배우'},{v:'staff',l:'스텝'}]});
  if(years.length>1)specs.push({key:'year',label:'연도',type:'single',value:st.year,options:years.map(function(y){return{v:y,l:y,n:yearCnt[y]};})});
  var bar=(specs.length||hasRolePhoto)?dvFilterBar('person-hist',specs,{
    count:list.length+'편',
    sort:hasRolePhoto?{label:'보기',value:st.img,options:[{v:'poster',l:'공연 포스터로 보기'},{v:'role',l:'배역 사진으로 보기'}],onChange:function(v){st.img=v;personHistRender();}}:null,
    onChange:function(k,v){st[k]=v;personHistRender();},
    onReset:function(){st.type='';st.year='';personHistRender();}
  }):'';
  el.innerHTML=bar+(list.length?'<div class="dv-list dv-list-cards">'+list.map(function(e){return personHistCard(e,st.img);}).join('')+'</div>':'<div class="dv-empty">해당하는 이력이 없어요.</div>');
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
