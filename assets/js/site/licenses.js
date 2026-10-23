/* 오리 사이트 — 라이선스 (#licenses, 10/23)
   오리가 관리하는 라이선스 목록. 아카이브·기회와 같은 넷플릭스식: 큰 무대(안내) → 가로 줄 → 전체 작품 표.
   권리 정보는 운영자가 "권리 정보 공개"를 켠 작품만 보인다(서버 license_catalog가 거름). 나머지는 "확인 중" + 앞으로의 수요 숫자만.
   지난 공연·미확보 여부는 여기서 말하지 않는다 (direction.md: 오리는 고발 도구가 아니다). */
var LIC_STATUS={'제공':'라이선스 제공','협의가능':'협의 가능','미제공':'아직 안 내줌'};
var _lic={rows:[],f:{st:''},sort:'demand'};

async function goLicenses(push){
  if(push!==false)history.pushState({view:'licenses'},'','#licenses');
  setNav('licenses');sb('');_sbContext='';mobShowDetail();
  mn('<div class="nx lic-nx"><section class="nx-hero lic-hero"><div class="opp-hero-wait"><div class="hf-loading">불러오는 중…</div></div></section></div>');
  var r=await sbClient.rpc('license_catalog');
  if(location.hash!=='#licenses')return;
  if(r.error){mn('<div class="nx lic-nx">'+loadFailHtml('라이선스 목록')+'</div>');return;}
  var byId={};(r.data||[]).forEach(function(x){byId[x.work_id]=x;});
  _lic.rows=DB.works.filter(function(w){return fld(w,'작품명');}).map(function(w){return {w:w,c:byId[w.id]||{}};});
  renderLicenses();
}
function licState(c){return c.rights_public?(c.amateur==='제공'?'open':c.amateur==='협의가능'?'talk':'known'):'checking';}
function licLabel(c){return c.rights_public?(LIC_STATUS[c.amateur]||'오리 확인'):'확인 중';}
function licDemand(c){return (c.wish_count||0)+(c.request_count||0);}
function licDemandText(c){return [c.wish_count?c.wish_count+'명이 올리고 싶어해요':'',c.request_count?'정식 신청 '+c.request_count+'곳':''].filter(Boolean).join(' · ');}
function licCard(x,sub){return nxTextCard('work',x.w.id,fld(x.w,'작품명'),sub,oppImage(x.w.id));}
function renderLicenses(){
  var all=_lic.rows,pub=all.filter(function(x){return x.c.rights_public;});
  var open=pub.filter(function(x){return x.c.amateur==='제공';}),talk=pub.filter(function(x){return x.c.amateur==='협의가능';});
  var wanted=all.filter(function(x){return licDemand(x.c);}).sort(function(a,b){return licDemand(b.c)-licDemand(a.c);});
  var people=all.reduce(function(s,x){return s+(x.c.wish_count||0);},0),reqs=all.reduce(function(s,x){return s+(x.c.request_count||0);},0);
  var h='<div class="nx lic-nx"><section class="nx-hero lic-hero"><div class="nx-hero-bg lic-hero-bg"></div><div class="nx-hero-shade"></div>'
    +'<div class="nx-hero-text"><div class="nx-hero-kicker">라이선스</div>'
    +'<h1 class="nx-hero-title">허락받고, 떳떳하게 올려요</h1>'
    +'<div class="nx-hero-meta">오리가 확인한 작품 '+pub.length+'<i>•</i>확인 중 '+(all.length-pub.length)+(people?'<i>•</i>올리고 싶어하는 마음 '+people:'')+(reqs?'<i>•</i>정식 신청 '+reqs:'')+'</div>'
    +'<p class="lic-hero-p">티켓을 팔거나 출연료를 주는 공연은 작가의 허락이 필요해요. 번역 작품은 한국어 대본을 만든 쪽의 허락도요. 원하는 사람이 모일수록 오리가 권리자에게 말하기 쉬워져요.</p>'
    +'<div class="nx-hero-btns"><button type="button" class="nx-btn nx-btn-main" onclick="openLicenseInquiry(\'\',\'\')">라이선스 문의 남기기</button><button type="button" class="nx-btn" onclick="goWorks()">작품 둘러보기</button></div></div>'
    +'<div class="lic-hero-keys" aria-hidden="true"><span>원작의 문</span><span>번역의 문</span></div></section>';
  h+=nxRow('아마추어 라이선스를 내주는 작품','',open.slice(0,16).map(function(x){return licCard(x,[x.c.holder,'라이선스 제공'].filter(Boolean).join(' · '));}),'오리가 권리자와 확인했어요. 작품 페이지에서 바로 신청해요.');
  h+=nxRow('협의할 수 있는 작품','',talk.slice(0,16).map(function(x){return licCard(x,[x.c.holder,'협의 가능'].filter(Boolean).join(' · '));}));
  h+=nxRow('올리고 싶어하는 사람이 많은 작품','',wanted.slice(0,16).map(function(x){return licCard(x,licDemandText(x.c)+(x.c.rights_public?'':' · 확인 중'));}),'원하는 사람이 모이면 오리가 이 숫자를 들고 권리자를 만나요.');
  h+='<section class="opp-all"><div class="opp-all-head"><h2 class="cat-all">전체 작품</h2></div><div id="lic-bar"></div><div id="lic-list" class="lic-list"></div></section></div>';
  mn(h);nxArrows();
  renderLicenseList();
}
function renderLicenseList(){
  var all=_lic.rows,f=_lic.f;
  var cnt=function(s){return all.filter(function(x){return licState(x.c)===s;}).length;};
  var rows=all.filter(function(x){return !f.st||licState(x.c)===f.st;});
  rows=rows.slice().sort(_lic.sort==='name'?function(a,b){return String(fld(a.w,'작품명')).localeCompare(String(fld(b.w,'작품명')),'ko');}
    :function(a,b){return (b.c.rights_public?1:0)-(a.c.rights_public?1:0)||licDemand(b.c)-licDemand(a.c)||String(fld(a.w,'작품명')).localeCompare(String(fld(b.w,'작품명')),'ko');});
  var bar=$('lic-bar');
  if(bar)bar.innerHTML=filterBar('lic',[{key:'st',label:'상태',type:'single',value:f.st,options:[
      {v:'open',l:'라이선스 제공',n:cnt('open')},{v:'talk',l:'협의 가능',n:cnt('talk')},{v:'known',l:'그 밖에 확인됨',n:cnt('known')},{v:'checking',l:'확인 중',n:cnt('checking')}].filter(function(o){return o.n;})}],{
    count:'<em>'+rows.length+'</em>개 작품',
    sort:{value:_lic.sort,options:[{v:'demand',l:'확인·수요 순'},{v:'name',l:'이름 순'}],onChange:function(v){_lic.sort=v;renderLicenseList();}},
    onChange:function(k,v){_lic.f[k]=v;renderLicenseList();},
    onReset:function(){_lic.f={st:''};renderLicenseList();}
  });
  var el=$('lic-list');if(!el)return;
  if(!rows.length){el.innerHTML='<div class="result-empty">조건에 맞는 작품이 없어요. <button type="button" class="dv-all" onclick="_lic.f={st:\'\'};renderLicenseList()">필터 지우기</button></div>';return;}
  el.innerHTML='<div class="lic-row lic-row-h" aria-hidden="true"><span>작품</span><span>상태</span><span>권리자</span><span>수요</span></div>'+rows.map(function(x){
    var c=x.c,st=licState(c);
    return '<div class="lic-row" data-action="work" data-id="'+x.w.id+'">'
      +'<span class="lic-name">'+escHtml(fld(x.w,'작품명'))+'</span>'
      +'<span><span class="lic-badge lic-'+st+'">'+escHtml(licLabel(c))+'</span></span>'
      +'<span class="lic-holder">'+escHtml(c.holder||(c.rights_public?(c.rights_type||''):''))+'</span>'
      +'<span class="lic-demand">'+escHtml(licDemandText(c))+'</span></div>';
  }).join('');
}
