/* 오리 사이트 — 배역 목록·상세 */
/* ══ 배역 인덱스 ══ */
var _roleFilter={work:'all',gender:'',minAct:0,tags:[]};
var _roleIndexView='grid';

function goRoles(push){
  if(push!==false)history.pushState({view:'roles'},'','#roles');
  setNav('roles');_sbContext='roles';  _allRoles=DB.roles.filter(function(r){return fld(r,'배역명');}).sort(function(a,b){
    var oa=ROLE_ORDER[a.id],ob=ROLE_ORDER[b.id];
    if(oa==null&&ob==null){var wa=ids(fld(a,'작품'))[0]||'',wb=ids(fld(b,'작품'))[0]||'';return wa.localeCompare(wb);}
    if(oa==null)return 1;if(ob==null)return -1;return oa-ob;
  });
  _roleFilter={work:'all',gender:'',minAct:0,tags:[]};renderRoleIndex();
}

function renderRoleIndex(){
  var workSet={};
  _allRoles.forEach(function(r){var wid=ids(fld(r,'작품'))[0]||'';if(wid&&nm(wid))workSet[wid]=nm(wid);});
  var workIds=Object.keys(workSet).sort(function(a,b){return workSet[a].localeCompare(workSet[b]);});

  // 성별 옵션 수집
  var genderSet={};
  _allRoles.forEach(function(r){var g=fld(r,'성별')||fld(r,'젠더')||'';if(g)genderSet[g]=true;});
  var genders=Object.keys(genderSet).sort();

  // 태그 옵션 수집
  var tagSet={};
  _allRoles.forEach(function(r){(fld(r,'태그')||[]).forEach(function(t){if(t)tagSet[t]=true;});});
  var tagList=Object.keys(tagSet).sort();

  // 필터 적용
  var filtered=_allRoles.filter(function(r){
    if(_roleFilter.work!=='all'&&ids(fld(r,'작품')).indexOf(_roleFilter.work)===-1)return false;
    if(_roleFilter.gender&&(fld(r,'성별')||fld(r,'젠더')||'')!==_roleFilter.gender)return false;
    if(_roleFilter.tags.length){
      var rTags=fld(r,'태그')||[];
      if(!_roleFilter.tags.every(function(t){return rTags.indexOf(t)>-1;}))return false;
    }
    if(_roleFilter.minAct>0){
      var cnt=DB.history.filter(function(h){return isValidH(h)&&ids(fld(h,'배역')).indexOf(r.id)>-1;}).length;
      if(cnt<_roleFilter.minAct)return false;
    }
    return true;
  });

  var roleCntByWork={};_allRoles.forEach(function(r){var w=ids(fld(r,'작품'))[0]||'';if(w)roleCntByWork[w]=(roleCntByWork[w]||0)+1;});
  var filterH=filterBar('roles',[
    {key:'work',label:'작품',type:'single',value:_roleFilter.work==='all'?'':_roleFilter.work,options:workIds.map(function(w){return{v:w,l:workSet[w],n:roleCntByWork[w]};})},
    {key:'gender',label:'성별',type:'single',value:_roleFilter.gender,options:genders.map(function(g){return{v:g,l:g};})},
    {key:'tags',label:'태그',type:'multi',value:_roleFilter.tags,options:tagList.map(function(t){return{v:t,l:t};})},
    {key:'minAct',label:'출연 횟수',type:'single',value:_roleFilter.minAct||'',options:[{v:2,l:'2회 이상'},{v:3,l:'3회 이상'},{v:5,l:'5회 이상'}]}
  ],{
    count:'<em>'+filtered.length+'</em>개 배역',
    view:{value:_roleIndexView,onChange:function(v){_roleIndexView=v;renderRoleIndex();}},
    onChange:function(k,v){
      if(k==='work')_roleFilter.work=v||'all';
      else if(k==='minAct')_roleFilter.minAct=v||0;
      else _roleFilter[k]=v;
      renderRoleIndex();
    },
    onReset:function(){_roleFilter={work:'all',gender:'',minAct:0,tags:[]};renderRoleIndex();}
  });
  var resultH='';

  var listH='';
  if(!filtered.length){listH='<div class="result-empty"><div class="result-empty-icon">🎬</div>해당하는 배역이 없어요.</div>';}
  else if(_roleIndexView==='grid'){
    listH='<div class="result-grid">';
    filtered.forEach(function(r){
      var wid=ids(fld(r,'작품'))[0]||'';
      var gender=fld(r,'성별')||fld(r,'젠더')||'';
      var rTags=fld(r,'태그')||[];
      var rTagsH=rTags.length?('<div class="result-card-tags">'+rTags.map(function(t){return '<span class="result-card-tag">'+t+'</span>';}).join('')+'</div>'):'';
      var rPhoto=(fld(r,'사진')||[])[0];
      var rPhotoH=rPhoto?'<img src="'+rPhoto.url+'" style="width:100%;height:100%;object-fit:cover;border-radius:8px">':'🎬';
      listH+='<div class="result-card" data-action="role" data-id="'+r.id+'">'+wishBtnHtml('role',r.id)+'<div class="result-card-ph">'+rPhotoH+'</div><div class="result-card-body"><div class="result-card-title">'+fld(r,'배역명')+'</div>'+(nm(wid)?'<div class="result-card-sub">'+nm(wid)+'</div>':'')+(gender?'<div class="result-card-sub">'+gender+'</div>':'')+rTagsH+'</div></div>';
    });
    listH+='</div>';
  } else {
    listH='<div class="result-list">';
    filtered.forEach(function(r){
      var wid=ids(fld(r,'작품'))[0]||'';
      var gender=fld(r,'성별')||fld(r,'젠더')||'';
      var actCnt=DB.history.filter(function(h){return isValidH(h)&&ids(fld(h,'배역')).indexOf(r.id)>-1;}).length;
      listH+='<div class="result-row" data-action="role" data-id="'+r.id+'"><div class="rr-poster">🎬</div><div class="rr-main"><div class="rr-title">'+fld(r,'배역명')+'</div><div class="rr-meta">'+(nm(wid)?'<span class="rr-tag">'+nm(wid)+'</span>':'')+(gender?'<span class="rr-tag">'+gender+'</span>':'')+(actCnt?'<span class="rr-tag">'+actCnt+'명 출연</span>':'')+'</div></div></div>';
    });
    listH+='</div>';
  }
  mn('<div class="tab-index">'+filterH+resultH+listH+'</div>');
}
function showRole(rid,push){
  if(push!==false)history.pushState({view:'role',id:rid},'','#role-'+rid);
  setNav('roles');mobShowDetail();
  var role=DB.roles.find(function(r){return r.id===rid;});if(!role)return;
  var wid=ids(fld(role,'작품'))[0]||'';
  var hists=DB.history.filter(function(h){return isValidH(h)&&ids(fld(h,'배역')).indexOf(rid)>-1;});
  hists.sort(function(a,b){var da=showDate(ids(fld(a,'공연'))[0]||''),db=showDate(ids(fld(b,'공연'))[0]||'');if(!da&&!db)return 0;if(!da)return 1;if(!db)return -1;return db.localeCompare(da);});
  var showIds=[];hists.forEach(function(h){var sid=ids(fld(h,'공연'))[0]||'';if(sid&&showIds.indexOf(sid)===-1)showIds.push(sid);});
  var actorItems=hists.map(function(rec){
    var pid=ids(fld(rec,'참여자'))[0]||'',sid=ids(fld(rec,'공연'))[0]||'';
    var s=DB.shows.find(function(x){return x.id===sid;})||{};
    return dvPersonCard(pid,dvLink('show',sid,nm(sid)),dvShowSub(s,['troupe','date']),iurl(fld(rec,'사진')));
  });
  var siblings=wid?DB.roles.filter(function(r){return r.id!==rid&&ids(fld(r,'작품')).indexOf(wid)>-1&&fld(r,'배역명');}):[];
  var photos=fld(role,'사진')||[];
  dvRender({
    type:'role',id:rid,back:{label:'배역 목록',go:'goRoles()'},
    thumb:{url:iurl(photos),shape:'square',ph:'🎬'},
    kicker:'배역'+(wid?' · '+dvLink('work',wid,nm(wid)):''),
    title:fld(role,'배역명'),
    tags:fld(role,'태그')||[],
    facts:[['작품',dvLink('work',wid,nm(wid))],['성별',escHtml(fld(role,'성별')||'')],['맡은 사람',hists.length?hists.length+'명':''],['공연',showIds.length?showIds.length+'편':'']],
    actions:[dvFavBtn('role',rid,'wishlist'),dvEditBtn('role',rid)],
    sections:[
      {title:'맡은 사람',items:actorItems,layout:'people',peek:true,peekMax:8},
      {title:'같은 작품의 다른 배역',items:siblings.map(function(r){return dvChip('role',r.id,fld(r,'배역명'));}),layout:'chips',peek:true,peekMax:12},
      {title:'해보고 싶어하는 사람들',body:'<div id="wish-interest-role"></div>'},
      {title:'사진',body:buildPhotoGalleryHtml(photos,fld(role,'배역명'))}
    ],
    empty:'아직 이 배역을 맡은 사람이 등록되지 않았어요.',
    after:function(){renderWishlistInterest('role',rid,'wish-interest-role');}
  });
}