/* 오리 사이트 — 단체 목록·상세 */
function showTroupe(tid,push){
  if(push!==false)history.pushState({view:'troupe',id:tid},'','#troupe-'+tid);
  setNav('troupes');mobShowDetail();
  var troupe=DB.troupes.find(function(t){return t.id===tid;});if(!troupe)return;
  var shows=sortShows(DB.shows.filter(function(s){return ids(fld(s,'극단')).indexOf(tid)>-1;}));
  var memberMap={};
  shows.forEach(function(s){
    histByShow(s.id).forEach(function(h){
      var pid=ids(fld(h,'참여자'))[0]||'';if(!pid)return;
      if(!memberMap[pid])memberMap[pid]={cnt:0,actor:0,staff:0};
      memberMap[pid].cnt++;
      var t=tname(h);if(t==='배우')memberMap[pid].actor++;else if(t==='스텝')memberMap[pid].staff++;
    });
  });
  var members=Object.keys(memberMap).sort(function(a,b){return memberMap[b].cnt-memberMap[a].cnt;});
  var memberItems=members.slice(0,12).map(function(pid){
    var m=memberMap[pid],parts=[];if(m.actor)parts.push('배우 '+m.actor);if(m.staff)parts.push('스텝 '+m.staff);
    return dvPersonRow(pid,parts.join(' · ')||m.cnt+'회');
  });
  var arr=function(v){return Array.isArray(v)?v.join(', '):(v||'');};
  var photos=fld(troupe,'사진')||[];
  dvRender({
    type:'troupe',id:tid,back:{label:'단체 목록',go:'goTroupes()'},
    thumb:{url:iurl(photos),shape:'square',ph:'🏢'},
    kicker:'단체'+(arr(fld(troupe,'조직형태'))?' · '+escHtml(arr(fld(troupe,'조직형태'))):''),
    title:fld(troupe,'극단명'),
    facts:[['지역',escHtml(arr(fld(troupe,'활동지역')))],['운영상태',escHtml(fld(troupe,'운영상태')||'')],['창단',fld(troupe,'창단연도')?fld(troupe,'창단연도')+'년':''],['구성원',escHtml(fld(troupe,'구성원기반')||'')],['공연',shows.length?shows.length+'편':''],['참여한 사람',members.length?members.length+'명':''],['단원 모집',escHtml(fld(troupe,'모집정보')||'')]],
    actions:[dvFavBtn('troupe',tid),dvLinkChips(fld(troupe,'주요링크')),dvEditBtn('troupe',tid)],
    widget:'<span id="troupe-claim-widget"></span>',
    sections:[
      {title:'공연 목록',n:shows.length,items:shows.map(function(s){return dvShowCard(s,dvShowSub(s,['work','date']));}),layout:'cards',peek:true,body:dvYearShows('troupe-shows',shows,['work','date'])},
      {title:'많이 참여한 사람',items:memberItems,layout:'rows',peek:true,peekMax:5},
      {title:'사진',body:buildPhotoGalleryHtml(photos,fld(troupe,'극단명'))}
    ],
    empty:'이 단체에 등록된 공연이 아직 없어요.',
    after:function(){dvYearShowsRender('troupe-shows');renderTroupeClaimWidget(tid);}
  });
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
