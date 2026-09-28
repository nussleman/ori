/* 오리 사이트 — 공연 목록·상세 */
/* ══════════════════════════════════════
   공연 인덱스 (필터 + 그리드 첫 화면)
   ══════════════════════════════════════ */
var _showFilter={troupes:[],years:[],venues:[]};
var _showIndexView='grid'; // 'grid' | 'list'

function goShows(push){
  if(push!==false)history.pushState({view:'shows'},'','#shows');
  setNav('shows');_sbContext='shows';
  // 사이드바 숨기고 메인 전체 사용
  sb('');
  _showFilter={troupes:[],years:[],venues:[]};
  renderShowIndex();
}

function clearShowFilter(){
  _showFilter={troupes:[],years:[],venues:[]};
  renderShowIndex();
}

function renderShowIndex(){
  var allShows=sortShows(DB.shows.filter(function(s){return fld(s,'공연명');}));

  // 필터 옵션 수집
  var troupeSet={},yearSet={},venueSet={};
  allShows.forEach(function(s){
    var tid=ids(fld(s,'극단'))[0]||'';if(tid&&nm(tid))troupeSet[tid]=nm(tid);
    var y=yearOf(fld(s,'공연 날짜')||'');if(y)yearSet[y]=y;
    var vid=ids(fld(s,'극장'))[0]||'';if(vid&&nm(vid))venueSet[vid]=nm(vid);
  });
  var troupeIds=Object.keys(troupeSet).sort(function(a,b){return troupeSet[a].localeCompare(troupeSet[b]);});
  var years=Object.keys(yearSet).sort().reverse();
  var venueIds=Object.keys(venueSet).sort(function(a,b){return venueSet[a].localeCompare(venueSet[b]);});

  // 필터 적용
  var filtered=allShows.filter(function(s){
    if(_showFilter.troupes.length>0){var tid=ids(fld(s,'극단'))[0]||'';if(_showFilter.troupes.indexOf(tid)===-1)return false;}
    if(_showFilter.years.length>0){var y=yearOf(fld(s,'공연 날짜')||'')||'연도미상';if(_showFilter.years.indexOf(y)===-1)return false;}
    if(_showFilter.venues.length>0){var vid=ids(fld(s,'극장'))[0]||'';if(_showFilter.venues.indexOf(vid)===-1)return false;}
    return true;
  });

  var cntT={},cntY={},cntV={};
  allShows.forEach(function(s){
    var tid=ids(fld(s,'극단'))[0]||'';if(tid)cntT[tid]=(cntT[tid]||0)+1;
    var y=yearOf(fld(s,'공연 날짜')||'')||'연도미상';cntY[y]=(cntY[y]||0)+1;
    var vid=ids(fld(s,'극장'))[0]||'';if(vid)cntV[vid]=(cntV[vid]||0)+1;
  });
  var yearOpts=years.map(function(y){return{v:y,l:y,n:cntY[y]};});
  if(cntY['연도미상'])yearOpts.push({v:'연도미상',l:'연도 미상',n:cntY['연도미상']});
  var filterH=filterBar('shows',[
    {key:'years',label:'연도',type:'multi',value:_showFilter.years,options:yearOpts},
    {key:'troupes',label:'단체',type:'multi',value:_showFilter.troupes,options:troupeIds.map(function(t){return{v:t,l:nm(t),n:cntT[t]};})},
    {key:'venues',label:'극장',type:'multi',value:_showFilter.venues,options:venueIds.map(function(v){return{v:v,l:nm(v),n:cntV[v]};})}
  ],{
    count:'<em>'+filtered.length+'</em>개 공연',
    view:{value:_showIndexView,onChange:function(v){_showIndexView=v;renderShowIndex();}},
    onChange:function(k,v){_showFilter[k]=v;renderShowIndex();},
    onReset:clearShowFilter
  });
  var resultH='';

  // 결과 목록
  var listH='';
  if(!filtered.length){
    listH='<div class="result-empty"><div class="result-empty-icon">🎭</div>조건에 맞는 공연이 없어요.<br><span style="font-size:0.75rem;opacity:0.6">필터를 조정해보세요</span></div>';
  } else if(_showIndexView==='grid'){
    listH='<div class="result-grid">';
    filtered.forEach(function(s){
      var wid=ids(fld(s,'작품'))[0]||'';
      var trid=ids(fld(s,'극단'))[0]||'';
      var date=ym(fld(s,'공연 날짜')||'');
      var p=POSTER[s.id]||'';
      listH+='<div class="result-card" data-action="show" data-id="'+s.id+'">'+favBtnHtml('show',s.id)
        +(p?'<img src="'+p+'" alt="'+fld(s,'공연명')+'">':'<div class="result-card-ph">🎭</div>')
        +'<div class="result-card-body">'
        +'<div class="result-card-title">'+fld(s,'공연명')+'</div>'
        +'<div class="result-card-sub">'+(nm(trid)||nm(wid)||'')+'</div>'
        +(date?'<div class="result-card-sub">'+date+'</div>':'')
        +'</div></div>';
    });
    listH+='</div>';
  } else {
    listH='<div class="result-list">';
    filtered.forEach(function(s){
      var wid=ids(fld(s,'작품'))[0]||'';
      var trid=ids(fld(s,'극단'))[0]||'';
      var vid=ids(fld(s,'극장'))[0]||'';
      var date=fld(s,'공연 날짜')||'';
      var p=POSTER[s.id]||'';
      listH+='<div class="result-row" data-action="show" data-id="'+s.id+'">'
        +'<div class="rr-poster">'+(p?'<img src="'+p+'">':'🎭')+'</div>'
        +'<div class="rr-main">'
        +'<div class="rr-title">'+fld(s,'공연명')+'</div>'
        +'<div class="rr-meta">'
        +(nm(wid)?'<span class="rr-tag">'+nm(wid)+'</span>':'')
        +(nm(trid)?'<span class="rr-tag">'+nm(trid)+'</span>':'')
        +(nm(vid)?'<span class="rr-tag">'+nm(vid)+'</span>':'')
        +'</div></div>'
        +(date?'<span class="rr-date">'+ym(date)+'</span>':'')
        +'</div>';
    });
    listH+='</div>';
  }

  mn('<div class="tab-index">'+filterH+resultH+listH+'</div>');
}

/* ══ 공연 사이드바 (내부용) ══ */

function showShow(sid,push){
  if(push!==false)history.pushState({view:'show',id:sid},'','#show-'+sid);
  setNav('shows');mobShowDetail();
  var show=DB.shows.find(function(s){return s.id===sid;});if(!show)return;
  var hist=histByShow(sid);
  var actors=hist.filter(function(h){return tname(h)==='배우';});
  var staff=hist.filter(function(h){return tname(h)==='스텝';});
  var wid=ids(fld(show,'작품'))[0]||'',trid=ids(fld(show,'극단'))[0]||'',vid=ids(fld(show,'극장'))[0]||'';
  var date=fld(show,'공연 날짜')||'',endDate=fld(show,'종료일')||'';
  var dateLabel=date?(endDate&&endDate!==date?date+' ~ '+endDate:date):'';
  var lic=fld(show,'라이선스상태');
  var licLabel=lic==='창작'?'창작 (라이선스 불필요)':(lic==='완료'?'라이선스 확보':(lic==='미확보'?'라이선스 미확보':''));
  var audience=fld(show,'관객수');
  var result=[fld(show,'매진여부')?'매진':'',fld(show,'재공연여부')?'재공연':''].filter(Boolean).join(' · ');

  var sortedActors=actors.slice().sort(function(a,b){var ra=ids(fld(a,'배역'))[0]||'',rb=ids(fld(b,'배역'))[0]||'';var oa=ROLE_ORDER[ra],ob=ROLE_ORDER[rb];if(oa==null&&ob==null)return 0;if(oa==null)return 1;if(ob==null)return -1;return oa-ob;});
  var castItems=sortedActors.map(function(rec){
    var pid=ids(fld(rec,'참여자'))[0]||'',rid=ids(fld(rec,'배역'))[0]||'';
    return dvPersonCard(pid,rid?dvLink('role',rid,nm(rid)):'','',iurl(fld(rec,'사진')));
  });
  var sortedStaff=staff.slice().sort(function(a,b){var ra=ids(fld(a,'스텝'))[0]||'',rb=ids(fld(b,'스텝'))[0]||'';return(STAFF_ORDER[ra]||999)-(STAFF_ORDER[rb]||999);});
  var staffItems=sortedStaff.map(function(rec){var pid=ids(fld(rec,'참여자'))[0]||'',rid=ids(fld(rec,'스텝'))[0]||'';return dvPersonRow(pid,escHtml(nm(rid)));});

  // 관련 공연: 같은 작품(재공연) > 같은 단체 > 출연진 겹침 > 같은 극장
  var currentPeople={};actors.forEach(function(h){var pid=ids(fld(h,'참여자'))[0]||'';if(pid)currentPeople[pid]=true;});
  var scored=[];
  DB.shows.forEach(function(other){
    if(other.id===sid)return;
    var owid=ids(fld(other,'작품'))[0]||'',otrid=ids(fld(other,'극단'))[0]||'',ovid=ids(fld(other,'극장'))[0]||'';
    var score=0;
    if(wid&&owid===wid)score+=10;
    if(trid&&otrid===trid)score+=5;
    if(vid&&ovid===vid)score+=1;
    var overlap=0;
    histByShow(other.id).filter(function(h){return tname(h)==='배우';}).forEach(function(h){var pid=ids(fld(h,'참여자'))[0]||'';if(pid&&currentPeople[pid])overlap++;});
    score+=Math.min(overlap*2,10);
    if(score>0)scored.push({show:other,score:score});
  });
  scored.sort(function(a,b){return b.score-a.score;});
  var related=scored.slice(0,6).map(function(r){return dvShowCard(r.show,dvShowSub(r.show,['troupe','date']));});

  dvRender({
    type:'show',id:sid,back:{label:'공연 목록',go:'goShows()'},
    thumb:{url:POSTER[sid]||'',shape:'poster',ph:'🎭'},
    kicker:'공연'+(wid?' · '+dvLink('work',wid,nm(wid)):''),
    title:fld(show,'공연명'),
    facts:[['단체',dvLink('troupe',trid,nm(trid))],['극장',dvLink('venue',vid,nm(vid))],['기간',dateLabel],['라이선스',licLabel],['관객',audience!=null?audience+'명':''],['결과',result]],
    actions:[dvFavBtn('show',sid),dvActBtn('라이선스 문의','openLicenseInquiry(\''+sid+'\',\''+wid+'\')','💬'),dvEditBtn('show',sid)],
    sections:[
      {title:'출연진',items:castItems,layout:'people',peek:true,peekMax:8},
      {title:'스텝',items:staffItems,layout:'rows',peek:true,peekMax:6},
      {title:'사진',body:buildPhotoGalleryHtml(fld(show,'포스터'),fld(show,'공연명'))},
      {title:'관련 공연',items:related,layout:'cards'}
    ],
    empty:'아직 등록된 출연진·스텝이 없어요.',
    footer:'<div class="dv-footer"><span class="report-copyright-link" onclick="openCopyrightReport(\''+sid+'\')">이 공연에 저작권 문제가 있나요? 신고하기</span></div>'
  });
}
