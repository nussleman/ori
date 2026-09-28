/* 오리 사이트 — 상세 화면 공통 틀
   공연·사람·작품·배역·극장·단체 상세는 모두 같은 모양의 "모델"을 만들어 dvRender()에 넘긴다.
   같은 모델이 두 가지로 그려진다.
     전용 페이지 : 헤더 → 액션 줄 → 섹션 전부
     오른쪽 패널 : 헤더 → 액션 줄 → peek 표시된 섹션만, 항목 몇 개 + "전체 보기"
   모델 = {
     type, id, back:{label, go},                     // 목록으로 돌아가기
     thumb:{url, shape:'poster'|'round'|'square', ph}, // 대표 이미지
     kicker, title, sub,                              // 작은 분류 줄 / 이름 / 한 줄 요약 (HTML 가능)
     facts:[[라벨, 값HTML], ...],                      // 핵심 정보 (값이 비면 자동 생략)
     tags:[...], actions:[HTML...], widget:HTML,       // 태그 / 액션 버튼 / 클레임 등 비동기 위젯 자리
     intro:HTML,                                      // 헤더 아래 소개 (선택)
     sections:[{title, n, items:[HTML], layout, body, tools, peek, peekMax, full}],
       // items+layout: 카드 목록 (패널에선 앞의 peekMax개만), body: 직접 그린 HTML (페이지 전용)
       // peek:true 인 섹션만 패널에 나온다. full:false 면 페이지에선 숨김.
     footer:HTML, empty:'...'
   } */

var DV_PEEK_MAX=6;

function dvFavBtn(type,id,listType){
  listType=listType||'favorite';
  var on=FAVORITES_SET.has(listType+':'+type+':'+id);
  var wish=listType==='wishlist';
  return '<button type="button" class="dv-act fav-btn'+(wish?' wish-btn':'')+(on?' on':'')+'" data-fav-type="'+type+'" data-fav-id="'+id+'" data-list-type="'+listType+'" onclick="toggleFavorite(this)">'
    +(wish?WISH_ICON_SVG:FAV_ICON_SVG)+'<span>'+(wish?'해보고 싶어요':'즐겨찾기')+'</span></button>';
}
function dvActBtn(label,onclick,icon,primary){
  return '<button type="button" class="dv-act'+(primary?' dv-act-primary':'')+'" onclick="'+onclick+'">'+(icon?'<span class="dv-act-ic" aria-hidden="true">'+icon+'</span>':'')+'<span>'+label+'</span></button>';
}
function dvEditBtn(type,id){return dvActBtn('정보 수정 제보','openEditModal(\''+type+'\',\''+id+'\')','✎');}
function dvLinkChips(links){
  return (links||[]).filter(function(l){return l&&l.url;}).map(function(l){
    return '<a class="dv-act dv-link" href="'+escHtml(l.url)+'" target="_blank" rel="noopener noreferrer">'+linkLabel(l)+'</a>';
  }).join('');
}
function dvLink(action,id,label){return id&&label?'<span class="link" data-action="'+action+'" data-id="'+id+'">'+escHtml(label)+'</span>':'';}
function dvSection(title,n){return '<h2 class="dv-h">'+title+(n!=null?'<span class="dv-n">'+n+'</span>':'')+'</h2>';}

/* 목록 카드 공통 */
function dvShowCard(s,sub){
  var p=POSTER[s.id]||'';
  return '<div class="dv-card" data-action="show" data-id="'+s.id+'">'
    +(p?'<img class="dv-card-img" src="'+p+'" alt="">':'<div class="dv-card-img dv-card-ph">🎭</div>')
    +'<div class="dv-card-title">'+escHtml(fld(s,'공연명')||'')+'</div>'
    +(sub?'<div class="dv-card-sub">'+sub+'</div>':'')+'</div>';
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

function dvRender(m){
  var peek=PEEK.rendering;
  var th=m.thumb||{};
  var thumbH=th.url
    ?'<img class="dv-thumb dv-thumb-'+(th.shape||'square')+'" src="'+th.url+'" alt="">'
    :'<div class="dv-thumb dv-thumb-'+(th.shape||'square')+' dv-card-ph">'+(th.ph||'')+'</div>';
  var facts=(m.facts||[]).filter(function(f){return f&&f[1]!=null&&f[1]!=='';});
  var h='<article class="dv'+(peek?' dv-peek':'')+'">';
  if(!peek&&m.back)h+='<button type="button" class="dv-back" onclick="'+m.back.go+'">← '+m.back.label+'</button>';
  h+='<header class="dv-head">'+thumbH+'<div class="dv-head-main">'
    +(m.kicker?'<div class="dv-kicker">'+m.kicker+'</div>':'')
    +'<h1 class="dv-title">'+escHtml(m.title||'')+'</h1>'
    +(m.sub?'<div class="dv-sub">'+m.sub+'</div>':'')
    +(m.tags&&m.tags.length?'<div class="dv-tags">'+m.tags.map(function(t){return '<span class="dv-tag">'+escHtml(t)+'</span>';}).join('')+'</div>':'')
    +'</div></header>';
  if(facts.length){
    h+='<dl class="dv-facts">'+facts.map(function(f){return '<div class="dv-fact"><dt>'+f[0]+'</dt><dd>'+f[1]+'</dd></div>';}).join('')+'</dl>';
  }
  var acts=(m.actions||[]).join('');
  if(acts||m.widget!=null)h+='<div class="dv-actions">'+acts+(m.widget!=null?'<span class="dv-widget">'+m.widget+'</span>':'')+'</div>';
  if(m.intro)h+=m.intro;

  var shown=0;
  (m.sections||[]).forEach(function(s){
    if(peek&&!s.peek)return;
    if(!peek&&s.full===false)return;
    var hasItems=s.items&&s.items.length;
    if(!hasItems&&!s.body)return;
    shown++;
    h+='<section class="dv-sec">'+(s.title?dvSection(s.title,s.n!=null?s.n:(hasItems?s.items.length:null)):'');
    if(!peek&&s.tools)h+=s.tools;
    if(hasItems&&(peek||!s.body)){
      var max=peek?(s.peekMax||DV_PEEK_MAX):s.items.length;
      h+='<div class="dv-list dv-list-'+(s.layout||'cards')+'"'+(s.listId&&!peek?' id="'+s.listId+'"':'')+'>'+s.items.slice(0,max).join('')+'</div>';
      if(peek&&s.items.length>max)h+='<button type="button" class="dv-more" onclick="expandPeek()">'+s.items.length+'개 전체 보기 →</button>';
    }else if(s.body)h+=s.body;
    h+='</section>';
  });
  if(!shown&&m.empty)h+='<div class="dv-empty">'+m.empty+'</div>';
  if(peek)h+='<button type="button" class="dv-open-page" onclick="expandPeek()">전체 페이지로 보기 →</button>';
  else if(m.footer)h+=m.footer;
  h+='</article>';
  mn(h);
  if(m.after)m.after();
  if(!peek)window.scrollTo(0,0);
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
  el.innerHTML=tools+'<div class="dv-list dv-list-cards">'+list.map(function(s){return dvShowCard(s,dvShowSub(s,st.sub));}).join('')+'</div>';
}
