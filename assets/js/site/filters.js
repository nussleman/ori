/* 오리 사이트 — 공통 필터 바
   모든 목록 화면(공연·사람·작품·배역·극장·단체)이 같은 모양의 한 줄 필터를 쓴다.
     [단체 ▾] [연도 · 2024 ▾] [🚗 주차 가능]  초기화          24개 공연   이름순 ▾   ▦ ≡
   - 필터마다 드롭다운 하나. 고른 값은 버튼 안에 요약해서 보여준다.
   - multi: 여러 개 선택(체크), single: 하나만(다시 누르면 해제), toggle: 켜기/끄기 버튼
   - 옵션이 많으면(8개 초과) 드롭다운 위에 검색창이 뜬다.
   사용법: filterBar('shows', specs, {count:'24개 공연', sort:{...}, view:{...}, onChange:function(key,value){...}})
   specs: [{key, label, type:'multi'|'single'|'toggle', options:[{v,l}], value}]
   onReset은 모든 필터를 기본값으로. onChange는 상태만 바꾸고 목록을 다시 그리면 된다 (열려 있던 드롭다운은 다시 그려도 유지된다). */
var FB={};          // bar → {specs, opts}
var _fbOpen=null;   // 지금 열린 드롭다운 {bar,key,q}

function fbEsc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

function fbSummary(spec){
  if(spec.type==='multi'){
    var vals=spec.value||[];if(!vals.length)return '';
    var first=(spec.options.find(function(o){return o.v===vals[0];})||{l:vals[0]}).l;
    return vals.length>1?first+' 외 '+(vals.length-1):first;
  }
  if(spec.type==='single'){
    if(spec.value===''||spec.value==null)return '';
    return(spec.options.find(function(o){return o.v===spec.value;})||{l:spec.value}).l;
  }
  return '';
}
function fbIsOn(spec){
  if(spec.type==='multi')return(spec.value||[]).length>0;
  if(spec.type==='toggle')return !!spec.value;
  return !(spec.value===''||spec.value==null);
}

function fbDropdownHtml(bar,spec,extraCls){
  var isOpen=_fbOpen&&_fbOpen.bar===bar&&_fbOpen.key===spec.key;
  var on=fbIsOn(spec),sum=fbSummary(spec);
  var h='<div class="fdd'+(on?' on':'')+(isOpen?' open':'')+(extraCls?' '+extraCls:'')+'" data-key="'+spec.key+'">'
    +'<button type="button" class="fdd-btn" onclick="fbOpenToggle(\''+bar+'\',\''+spec.key+'\')" aria-haspopup="listbox" aria-expanded="'+(isOpen?'true':'false')+'">'
    +'<span class="fdd-label">'+fbEsc(spec.label)+'</span>'
    +(sum?'<span class="fdd-val">'+fbEsc(sum)+'</span>':'')
    +'<span class="fdd-caret" aria-hidden="true">▾</span></button>'
    +'<div class="fdd-pop" role="listbox">';
  if(spec.options.length>8){
    h+='<input type="text" class="fdd-search" placeholder="'+fbEsc(spec.label)+' 검색" value="'+fbEsc(isOpen?_fbOpen.q||'':'')+'" oninput="fbSearch(this)" autocomplete="off">';
  }
  h+='<div class="fdd-opts">';
  if(spec.type==='single'&&!spec.noAll){
    h+='<button type="button" class="fdd-opt'+(!on?' sel':'')+'" onclick="fbPick(\''+bar+'\',\''+spec.key+'\',-1)"><span class="fdd-mark"></span>전체</button>';
  }
  spec.options.forEach(function(o,i){
    var sel=spec.type==='multi'?(spec.value||[]).indexOf(o.v)>-1:spec.value===o.v;
    var hidden=isOpen&&_fbOpen.q&&String(o.l).toLowerCase().indexOf(_fbOpen.q.toLowerCase())===-1;
    h+='<button type="button" class="fdd-opt'+(sel?' sel':'')+(spec.type==='multi'?' multi':'')+'"'+(hidden?' hidden':'')+' data-l="'+fbEsc(String(o.l).toLowerCase())+'" onclick="fbPick(\''+bar+'\',\''+spec.key+'\','+i+')">'
      +'<span class="fdd-mark"></span><span class="fdd-opt-l">'+fbEsc(o.l)+'</span>'+(o.n!=null?'<span class="fdd-opt-n">'+o.n+'</span>':'')+'</button>';
  });
  h+='</div>';
  if(spec.type==='multi'&&on)h+='<button type="button" class="fdd-clear" onclick="fbClearKey(\''+bar+'\',\''+spec.key+'\')">선택 해제</button>';
  return h+'</div></div>';
}

function filterBar(bar,specs,opts){
  opts=opts||{};
  specs=specs.filter(function(s){return s.type==='toggle'||(s.options&&s.options.length);});
  FB[bar]={specs:specs,opts:opts};
  var anyOn=specs.some(fbIsOn);
  var h='<div class="fbar" data-bar="'+bar+'"><div class="fbar-left">';
  specs.forEach(function(spec){
    if(spec.type==='toggle'){
      h+='<button type="button" class="fdd-btn fdd-toggle'+(spec.value?' on':'')+'" aria-pressed="'+(spec.value?'true':'false')+'" onclick="fbPick(\''+bar+'\',\''+spec.key+'\',0)">'+fbEsc(spec.label)+'</button>';
    }else h+=fbDropdownHtml(bar,spec);
  });
  if(anyOn)h+='<button type="button" class="fbar-reset" onclick="fbReset(\''+bar+'\')">초기화</button>';
  h+='</div><div class="fbar-right">';
  if(opts.count)h+='<span class="fbar-count">'+opts.count+'</span>';
  if(opts.sort){
    var s=opts.sort;
    h+=fbDropdownHtml(bar,{key:'__sort',label:'정렬',type:'single',noAll:true,options:s.options,value:s.value},'fdd-sort fdd-right');
  }
  if(opts.view){
    h+='<div class="fbar-view" role="group" aria-label="보기 방식">'
      +'<button type="button" class="rvb'+(opts.view.value==='grid'?' on':'')+'" title="카드로 보기" onclick="fbView(\''+bar+'\',\'grid\')">▦</button>'
      +'<button type="button" class="rvb'+(opts.view.value==='list'?' on':'')+'" title="목록으로 보기" onclick="fbView(\''+bar+'\',\'list\')">≡</button></div>';
  }
  return h+'</div></div>';
}

function fbSpec(bar,key){
  var b=FB[bar];if(!b)return null;
  if(key==='__sort'){var s=b.opts.sort;return{key:'__sort',type:'single',options:s.options,value:s.value};}
  return b.specs.find(function(s){return s.key===key;});
}
function fbEmit(bar,key,value){
  var b=FB[bar];if(!b)return;
  if(key==='__sort')b.opts.sort.onChange(value);else b.opts.onChange(key,value);
}
function fbOpenToggle(bar,key){
  var wasOpen=_fbOpen&&_fbOpen.bar===bar&&_fbOpen.key===key;
  fbCloseAll();
  if(wasOpen)return;
  _fbOpen={bar:bar,key:key,q:''};
  var el=fbEl(bar,key);if(!el)return;
  el.classList.add('open');el.querySelector('.fdd-btn').setAttribute('aria-expanded','true');
  var inp=el.querySelector('.fdd-search');if(inp)inp.focus();
}
function fbEl(bar,key){return document.querySelector('.fbar[data-bar="'+bar+'"] .fdd[data-key="'+key+'"]');}
function fbCloseAll(){
  _fbOpen=null;
  document.querySelectorAll('.fdd.open').forEach(function(el){el.classList.remove('open');var b=el.querySelector('.fdd-btn');if(b)b.setAttribute('aria-expanded','false');});
}
function fbPick(bar,key,idx){
  var spec=fbSpec(bar,key);if(!spec)return;
  if(spec.type==='toggle'){fbEmit(bar,key,!spec.value);return;}
  var v=idx<0?'':spec.options[idx].v;
  if(spec.type==='multi'){
    var arr=(spec.value||[]).slice(),i=arr.indexOf(v);
    if(i>-1)arr.splice(i,1);else arr.push(v);
    var q=_fbOpen?_fbOpen.q:'';
    fbEmit(bar,key,arr);               // 다시 그려도 드롭다운은 열린 채로 (여러 개 고르기 편하게)
    _fbOpen={bar:bar,key:key,q:q};
    var el=fbEl(bar,key);if(el){el.classList.add('open');var inp=el.querySelector('.fdd-search');if(inp){inp.focus();inp.setSelectionRange(inp.value.length,inp.value.length);}}
    return;
  }
  fbCloseAll();
  fbEmit(bar,key,(key!=='__sort'&&spec.value===v)?'':v);  // 이미 고른 값을 다시 누르면 해제
}
function fbClearKey(bar,key){fbEmit(bar,key,[]);fbCloseAll();}
function fbReset(bar){var b=FB[bar];if(!b)return;fbCloseAll();b.opts.onReset();}
function fbView(bar,v){var b=FB[bar];if(b&&b.opts.view)b.opts.view.onChange(v);}
function fbSearch(inp){
  var q=inp.value.trim().toLowerCase();
  if(_fbOpen)_fbOpen.q=inp.value;
  inp.closest('.fdd').querySelectorAll('.fdd-opt[data-l]').forEach(function(o){o.hidden=!!q&&o.dataset.l.indexOf(q)===-1;});
}
document.addEventListener('click',function(e){if(_fbOpen&&!e.target.closest('.fdd'))fbCloseAll();});
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&_fbOpen){e.stopImmediatePropagation();fbCloseAll();}},true);
