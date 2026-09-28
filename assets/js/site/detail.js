/* 오리 사이트 — 상세 화면 공통 틀
   공연·사람·작품·배역·극장·단체 상세는 모두 같은 모양의 "모델"을 만들어 dvRender()에 넘긴다.
   위계는 세 단계만: 이름(크고 굵게) → 섹션 제목(중간 굵게 + 오른쪽 "모두보기") → 회색 본문.
   상자·테두리 대신 여백과 가는 선으로 나누고, 본문은 가운데 좁은 폭으로 흐른다.
   모델 = {
     type, id, back:{label, go},
     hero:true면 대표 이미지를 흐리게 깐 띠 배너 (공연)
     thumb:{url, shape:'poster'|'round'|'square', ph},
     kicker, title, sub,            // 작은 분류 줄 / 이름 / 회색 한 줄 정보
     tags:[...], chips:HTML,        // 태그 / 외부 링크 등
     favs:[HTML], primary:HTML,     // 이름 옆 아이콘(즐겨찾기 등) / 가장 중요한 버튼 하나
     widget:HTML, intro:HTML,       // 클레임 등 비동기 자리 / 소개글
     info:[[라벨, 값HTML]],         // 라벨–값 표 (값이 비면 생략)
     sections:[{title, tab, items:[HTML], layout, body, homeMax, peek, peekMax, n}],
       // tab이 있는 섹션은 그 탭에서 전체, "홈" 탭에선 앞의 homeMax개 + 모두보기.
       // tab이 없는 섹션은 홈에 전부. body는 해당 탭에서만(필터 등). peek:true면 오른쪽 패널에도.
     links:[HTML],                  // 맨 아래 조용한 텍스트 링크 (정보 수정 요청 등)
     empty, after
   } */

var DV_PEEK_MAX=6, DV_HOME_MAX=6;
var DV_STATE={key:'',tab:'home'}, _dvModel=null;

/* 이름 옆 아이콘 버튼 (즐겨찾기 / 해보고 싶어요) */
function dvFavIcon(type,id,listType){
  listType=listType||'favorite';
  var on=FAVORITES_SET.has(listType+':'+type+':'+id);
  var wish=listType==='wishlist';
  var label=wish?'해보고 싶어요':'즐겨찾기';
  return '<button type="button" class="dv-icon fav-btn'+(wish?' wish-btn':'')+(on?' on':'')+'" data-fav-type="'+type+'" data-fav-id="'+id+'" data-list-type="'+listType+'" onclick="toggleFavorite(this)" title="'+label+'" aria-label="'+label+'">'+(wish?WISH_ICON_SVG:FAV_ICON_SVG)+'</button>';
}
function dvFavBtn(type,id,listType){return dvFavIcon(type,id,listType);}
function dvActBtn(label,onclick,icon,primary){
  return '<button type="button" class="dv-act'+(primary?' dv-act-primary':'')+'" onclick="'+onclick+'">'+(icon?'<span class="dv-act-ic" aria-hidden="true">'+icon+'</span>':'')+'<span>'+label+'</span></button>';
}
function dvTextLink(label,onclick){return '<button type="button" class="dv-textlink" onclick="'+onclick+'">'+label+' ›</button>';}
function dvEditBtn(type,id){return dvTextLink('정보 수정 요청','openEditModal(\''+type+'\',\''+id+'\')');}
function dvLinkChips(links){
  return (links||[]).filter(function(l){return l&&l.url;}).map(function(l){
    return '<a class="dv-extlink" href="'+escHtml(l.url)+'" target="_blank" rel="noopener noreferrer">'+linkLabel(l)+'</a>';
  }).join('');
}
function dvLink(action,id,label){return id&&label?'<span class="link" data-action="'+action+'" data-id="'+id+'">'+escHtml(label)+'</span>':'';}
function dvSection(title,n,moreTab){
  return '<div class="dv-h-row"><h2 class="dv-h">'+title+(n!=null?'<span class="dv-n">'+n+'</span>':'')+'</h2>'
    +(moreTab?'<button type="button" class="dv-all" onclick="dvSwitchTab(\''+moreTab+'\')">모두보기 ›</button>':'')+'</div>';
}
function dvNames(pids){return pids.map(function(p){return dvLink('person',p,nm(p))||'';}).filter(Boolean).join(', ');}

/* 목록 모양들 */
function dvShowCard(s,sub){  // 포스터 카드 (관련 공연 등)
  var p=POSTER[s.id]||'';
  return '<div class="dv-card" data-action="show" data-id="'+s.id+'">'
    +(p?'<img class="dv-card-img" src="'+p+'" alt="">':'<div class="dv-card-img dv-card-ph">🎭</div>')
    +'<div class="dv-card-title">'+escHtml(fld(s,'공연명')||'')+'</div>'
    +(sub?'<div class="dv-card-sub">'+sub+'</div>':'')+'</div>';
}
function dvShowFilm(s,extra,omit){  // 공연 한 줄 (작은 포스터 + 제목 + 장소 + 기간 + 역할). omit:'venue'|'troupe'는 그 페이지 자신이라 뺀다
  var p=POSTER[s.id]||'';
  var d=fld(s,'공연 날짜')||'',e=fld(s,'종료일')||'';
  var dates=d?(d.replace(/-/g,'.')+(e&&e!==d?' ~ '+e.replace(/-/g,'.'):'')):'';
  var place=[omit==='venue'?'':ids(fld(s,'극장'))[0],omit==='troupe'?'':ids(fld(s,'극단'))[0]].map(function(x){return x&&nm(x);}).filter(Boolean).map(escHtml).join(' · ');
  return '<div class="dv-film" data-action="show" data-id="'+s.id+'">'
    +(p?'<img class="dv-film-img" src="'+p+'" alt="">':'<div class="dv-film-img dv-card-ph">🎭</div>')
    +'<div class="dv-film-main"><div class="dv-film-title">'+escHtml(fld(s,'공연명')||'')+'</div>'
    +(place?'<div class="dv-film-sub">'+place+'</div>':'')
    +(dates?'<div class="dv-film-sub">'+dates+'</div>':'')
    +(extra?'<div class="dv-film-sub dv-film-extra">'+extra+'</div>':'')+'</div></div>';
}
function dvPersonCard(pid,line1,line2,photo){
  var u=photo||PERSON_PHOTO[pid]||'';
  return '<div class="dv-card dv-card-person" data-action="person" data-id="'+pid+'">'
    +(u?'<img class="dv-card-img" src="'+u+'" alt="">':'<div class="dv-card-img dv-card-ph">👤</div>')
    +'<div class="dv-card-title">'+escHtml(nm(pid))+'</div>'
    +(line1?'<div class="dv-card-sub">'+line1+'</div>':'')
    +(line2?'<div class="dv-card-sub dv-card-sub2">'+line2+'</div>':'')+'</div>';
}
function dvPersonRow(pid,sub){
  var u=PERSON_PHOTO[pid]||'';
  return '<div class="dv-row" data-action="person" data-id="'+pid+'">'
    +(u?'<img class="dv-row-img" src="'+u+'" alt="">':'<div class="dv-row-img dv-card-ph">👤</div>')
    +'<div class="dv-row-main"><div class="dv-row-title">'+escHtml(nm(pid))+'</div>'+(sub?'<div class="dv-row-sub">'+sub+'</div>':'')+'</div></div>';
}
/* 배역 한 줄: 동그란 사진 + 배역명 + 맡은 배우들 (더블캐스팅을 한눈에) */
function dvRoleRow(roleId,roleName,pids,photo){
  var u=photo||(pids[0]&&PERSON_PHOTO[pids[0]])||'';
  return '<div class="dv-role">'
    +(u?'<img class="dv-role-img" src="'+u+'" alt="">':'<div class="dv-role-img dv-card-ph">🎭</div>')
    +'<div class="dv-role-main"><div class="dv-role-name">'+(roleId?dvLink('role',roleId,roleName):escHtml(roleName||'배역 미정'))+'</div>'
    +'<div class="dv-role-cast">'+dvNames(pids)+'</div></div></div>';
}
/* 제작진 한 줄: 역할 — 이름들 */
function dvCredit(label,pids){return '<div class="dv-credit"><span class="dv-credit-l">'+escHtml(label)+'</span><span class="dv-credit-v">'+dvNames(pids)+'</span></div>';}
function dvChip(action,id,label,cnt){
  return '<span class="dv-chip"'+(action?' data-action="'+action+'" data-id="'+id+'"':'')+'>'+escHtml(label)+(cnt!=null?'<span class="dv-chip-n">'+cnt+'</span>':'')+'</span>';
}
function dvShowSub(s,parts){
  var out=[];
  parts.forEach(function(p){
    if(p==='date'){var d=ym(fld(s,'공연 날짜')||'');if(d)out.push(d);}
    else if(p==='troupe'){var t=ids(fld(s,'극단'))[0];if(t&&nm(t))out.push(escHtml(nm(t)));}
    else if(p==='work'){var w=ids(fld(s,'작품'))[0];if(w&&nm(w))out.push(escHtml(nm(w)));}
    else if(p==='venue'){var v=ids(fld(s,'극장'))[0];if(v&&nm(v))out.push(escHtml(nm(v)));}
  });
  return out.join(' · ');
}

function dvInfoHtml(info){
  var rows=(info||[]).filter(function(f){return f&&f[1]!=null&&f[1]!=='';});
  if(!rows.length)return '';
  return '<dl class="dv-info">'+rows.map(function(f){return '<div class="dv-info-row"><dt>'+f[0]+'</dt><dd>'+f[1]+'</dd></div>';}).join('')+'</dl>';
}
function dvListHtml(s,max){
  return '<div class="dv-list dv-list-'+(s.layout||'cards')+'">'+s.items.slice(0,max).join('')+'</div>';
}

function dvSwitchTab(tab){
  DV_STATE.tab=tab;
  if(_dvModel)dvRender(_dvModel,true);
  var bar=document.querySelector('#mn .dv-tabs');
  if(bar){var y=bar.getBoundingClientRect().top+window.scrollY-64;if(window.scrollY>y)window.scrollTo(0,y);}
}

function dvRender(m,keepScroll){
  if(m.facts&&!m.info)m.info=m.facts;
  var peek=PEEK.rendering;
  var key=m.type+':'+m.id;
  if(!peek){_dvModel=m;if(DV_STATE.key!==key){DV_STATE={key:key,tab:'home'};}}
  var sections=(m.sections||[]).filter(function(s){return (s.items&&s.items.length)||s.body;});
  var tabs=[];sections.forEach(function(s){if(s.tab&&tabs.indexOf(s.tab)===-1)tabs.push(s.tab);});
  var tab=peek||!tabs.length?'home':DV_STATE.tab;
  if(tab!=='home'&&tabs.indexOf(tab)===-1)tab='home';

  var th=m.thumb||{};
  // 오른쪽 패널: 대표 사진을 맨 위에 가장 크게, 글자는 그 아래 작게
  var peekMedia=peek&&th.url;
  var thumbH=peekMedia?'':th.url
    ?'<img class="dv-thumb dv-thumb-'+(th.shape||'square')+'" src="'+th.url+'" alt="">'
    :'<div class="dv-thumb dv-thumb-'+(th.shape||'square')+' dv-card-ph">'+(th.ph||'')+'</div>';
  var headH='<header class="dv-head'+(peekMedia?' dv-head-nothumb':'')+'">'+thumbH+'<div class="dv-head-main">'
    +(m.kicker?'<div class="dv-kicker">'+m.kicker+'</div>':'')
    +'<div class="dv-title-row"><h1 class="dv-title">'+escHtml(m.title||'')+'</h1>'+(m.favs||[]).join('')+'</div>'
    +(m.sub?'<div class="dv-sub">'+m.sub+'</div>':'')
    +(m.tags&&m.tags.length?'<div class="dv-tags">'+m.tags.map(function(t){return '<span class="dv-tag">'+escHtml(t)+'</span>';}).join('')+'</div>':'')
    +(m.chips?'<div class="dv-chips">'+m.chips+'</div>':'')
    +((m.primary||m.widget!=null)?'<div class="dv-head-acts">'+(m.primary||'')+(m.widget!=null?'<span class="dv-widget">'+m.widget+'</span>':'')+'</div>':'')
    +'</div></header>';

  var h='<div class="dv-page'+(peek?' dv-peek':'')+'">';
  if(peekMedia)h+='<div class="dv-peek-media dv-peek-media-'+(th.shape||'square')+'" style="--hero-img:url(\''+th.url+'\')"><img class="dv-thumb" src="'+th.url+'" alt=""></div>';
  if(!peek&&m.hero){
    h+='<div class="dv-hero"'+(th.url?' style="--hero-img:url(\''+th.url+'\')"':'')+'><div class="dv-hero-in">'
      +(m.back?'<button type="button" class="dv-back" onclick="'+m.back.go+'">← '+m.back.label+'</button>':'')+headH+'</div></div>';
    h+='<article class="dv">';
  }else{
    h+='<article class="dv">';
    if(!peek&&m.back)h+='<button type="button" class="dv-back" onclick="'+m.back.go+'">← '+m.back.label+'</button>';
    h+=headH;
  }
  if(!peek&&tabs.length){
    h+='<div class="dv-tabs" role="tablist">'+[['home','홈']].concat(tabs.map(function(t){return[t,t];})).map(function(t){
      return '<button type="button" role="tab" class="dv-tab'+(tab===t[0]?' active':'')+'" onclick="dvSwitchTab(\''+t[0]+'\')">'+t[1]+'</button>';
    }).join('')+'</div>';
  }
  if(tab==='home'){
    if(m.intro)h+=m.intro;
    var infoH=dvInfoHtml(m.info);
    if(infoH)h+='<section class="dv-sec dv-sec-info">'+infoH+'</section>';
  }

  var shown=0;
  sections.forEach(function(s){
    var hasItems=s.items&&s.items.length;
    var n=s.n!=null?s.n:(hasItems?s.items.length:null);
    if(peek){
      if(!s.peek||!hasItems)return;
      var pm=s.peekMax||DV_PEEK_MAX;
      h+='<section class="dv-sec">'+dvSection(s.title,n)+dvListHtml(s,pm)
        +(s.items.length>pm?'<button type="button" class="dv-more" onclick="expandPeek()">'+s.items.length+'개 모두보기 ›</button>':'')+'</section>';
      shown++;return;
    }
    if(tab==='home'){
      if(s.tab){
        if(!hasItems)return;   // 필터·차트 같은 body 전용 섹션은 자기 탭에서만
        var hm=s.homeMax||DV_HOME_MAX;
        h+='<section class="dv-sec">'+dvSection(s.title,n,s.items.length>hm?s.tab:null)+dvListHtml(s,hm)+'</section>';
      }else{
        h+='<section class="dv-sec">'+(s.title?dvSection(s.title,n):'')+(s.body&&!hasItems?s.body:(s.body||dvListHtml(s,s.items.length)))+'</section>';
      }
      shown++;return;
    }
    if(s.tab!==tab)return;
    h+='<section class="dv-sec">'+(s.title?dvSection(s.title,n):'')+(s.body||dvListHtml(s,s.items.length))+'</section>';
    shown++;
  });
  if(!shown&&m.empty&&tab==='home')h+='<div class="dv-empty">'+m.empty+'</div>';
  if(peek)h+='<button type="button" class="dv-open-page" onclick="expandPeek()">전체 페이지로 보기 ›</button>';
  else if(m.links&&m.links.filter(Boolean).length&&tab==='home')h+='<footer class="dv-foot">'+m.links.filter(Boolean).join('')+'</footer>';
  h+='</article></div>';
  mn(h);
  if(m.after)m.after();
  if(!peek&&!keepScroll)window.scrollTo(0,0);
}

/* 상세 페이지 안의 필터(연도 등)를 공통 필터 바로 그린다. 스크롤 고정 없이 섹션 안에 놓인다. */
function dvFilterBar(bar,specs,opts){
  opts=opts||{};opts.inline=true;
  return filterBar(bar,specs,opts);
}

/* 극장·단체 상세의 "공연 목록": 연도 필터가 붙은 공연 카드 목록 (페이지 전용) */
var DVYF={};
function dvYearShows(bar,shows,subParts){
  if(PEEK.rendering)return '';   // 패널은 필터 없이 앞의 몇 개만 보여준다
  DVYF[bar]={shows:shows,sub:subParts,year:''};
  return '<div id="dvyf-'+bar+'"></div>';
}
function dvYearShowsRender(bar){
  if(PEEK.rendering)return;
  var st=DVYF[bar],el=document.getElementById('dvyf-'+bar);if(!st||!el)return;
  var cnt={};st.shows.forEach(function(s){var y=yearOf(fld(s,'공연 날짜')||'')||'연도 미상';cnt[y]=(cnt[y]||0)+1;});
  var years=Object.keys(cnt).sort().reverse();
  var list=st.shows.filter(function(s){return !st.year||(yearOf(fld(s,'공연 날짜')||'')||'연도 미상')===st.year;});
  var tools=years.length>1?dvFilterBar(bar,[{key:'year',label:'연도',type:'single',value:st.year,options:years.map(function(y){return{v:y,l:y,n:cnt[y]};})}],{
    count:list.length+'편',
    onChange:function(k,v){st.year=v;dvYearShowsRender(bar);},
    onReset:function(){st.year='';dvYearShowsRender(bar);}
  }):'';
  el.innerHTML=tools+'<div class="dv-list dv-list-film">'+list.map(function(s){return dvShowFilm(s,'',bar.indexOf('troupe')===0?'troupe':(bar.indexOf('venue')===0?'venue':''));}).join('')+'</div>';
}
