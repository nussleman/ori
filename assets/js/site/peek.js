/* 오리 사이트 — 카드 클릭 동작 (10/23 개정: 곁 카드)
   한 번 클릭 → 누른 카드 바로 옆에 작은 상세 카드(#peek)가 뜬다. 누른 카드는 절대 가리지 않는다
     (오른쪽에 자리가 있으면 오른쪽, 없으면 왼쪽. 카드 높이에 맞춰 세로로 붙고, 작은 꼬리가 카드를 가리킨다).
   곁 카드엔 카드 그림을 다시 싣지 않는다 — 이름·핵심 정보·연관 데이터(눌러서 그리로 이어 가기)만.
   곁 카드 안의 항목을 누르면 같은 자리에서 내용이 바뀌고(← 로 돌아가기), "전체 페이지"로 전용 페이지.
   두 번 클릭 → 전용 페이지(#show-xxx 등). 모바일은 옆 자리가 없어 한 번 탭하면 바로 전용 페이지.
   바깥을 누르거나 Esc·뒤로가기면 닫힌다.
   상세 화면 함수(showShow 등)를 그대로 재사용하고, 그리는 동안만 PEEK.rendering을 켜서
   mn()이 본문 대신 곁 카드에 쓰게 한다 (core.js의 mn, setNav, injectBackBtn 참고). */
var PEEK={rendering:false,open:false,stack:[],anchor:null};
var PEEK_LABEL={show:'공연',person:'사람',work:'작품',role:'배역',venue:'극장',troupe:'단체'};
var DOUBLE_CLICK_MS=220,PEEK_W=400,PEEK_GAP=14;

/* 전용 페이지로 이동 (히스토리에 남김) */
function openDetail(action,id,push){
  if(action==='show')showShow(id,push);
  else if(action==='person')showPerson(id,push);
  else if(action==='work')showWork(id,push);
  else if(action==='role')showRole(id,push);
  else if(action==='venue')showVenue(id,push);
  else if(action==='troupe')showTroupe(id,push);
}

function renderPeek(action,id){
  var body=$('peek-body');
  PEEK.rendering=true;_domScope=body;
  try{openDetail(action,id,false);}
  finally{PEEK.rendering=false;_domScope=null;}
  body.scrollTop=0;
  $('peek-type').textContent=PEEK_LABEL[action]||'';
  $('peek-back').hidden=PEEK.stack.length<2;
  markPeeked();
  placePeek();
}

/* 누른 카드 옆에 붙인다. 오른쪽 → 왼쪽 순으로 자리를 찾고, 둘 다 좁으면 넓은 쪽에 폭을 줄여서.
   그래도 안 되면(아주 좁은 창) 전용 페이지로 */
function placePeek(){
  var el=$('peek'),a=PEEK.anchor;if(!el||!PEEK.open&&!el.classList.contains('open'))return;
  var vw=window.innerWidth,vh=window.innerHeight,top0=76;
  var r=a&&document.body.contains(a)?a.getBoundingClientRect():null;
  if(!r||(!r.width&&!r.height)){r={left:vw-PEEK_W-24,right:vw-24,top:top0,bottom:top0,width:0,height:0};}  // 카드가 사라졌으면 오른쪽 위에
  var w=Math.min(PEEK_W,vw-24),spaceR=vw-r.right-PEEK_GAP-12,spaceL=r.left-PEEK_GAP-12,side;
  if(spaceR>=w)side='right';else if(spaceL>=w)side='left';
  else{side=spaceR>=spaceL?'right':'left';w=Math.max(spaceR,spaceL);}
  if(w<300){var cur=PEEK.stack[PEEK.stack.length-1];closePeek(true);if(cur)openDetail(cur.action,cur.id);return;}
  var x=side==='right'?r.right+PEEK_GAP:r.left-PEEK_GAP-w;
  el.style.width=w+'px';el.style.left=Math.round(x)+'px';
  el.style.maxHeight=Math.min(640,vh-top0-12)+'px';
  var h=el.offsetHeight;
  var y=Math.max(top0,Math.min(r.top-6,vh-h-12));
  el.style.top=Math.round(y)+'px';
  el.dataset.side=side;
  el.style.setProperty('--tail-y',Math.max(18,Math.min(h-18,r.top+Math.min(r.height,240)/2-y))+'px');
}
var _peekRaf=0;
function peekFollow(){if(!PEEK.open||_peekRaf)return;_peekRaf=requestAnimationFrame(function(){_peekRaf=0;placePeek();});}
window.addEventListener('scroll',peekFollow,{passive:true});
document.addEventListener('scroll',function(e){if(e.target!==document&&e.target.classList&&e.target.classList.contains('nx-track'))peekFollow();},true);
window.addEventListener('resize',peekFollow);

function openPeek(action,id,fromPanel,anchor){
  if(!PEEK_LABEL[action]||!id)return;
  if(isMobile()){openDetail(action,id);return;}
  var top=PEEK.stack[PEEK.stack.length-1];
  if(!fromPanel){PEEK.stack=[];PEEK.anchor=anchor||null;}
  if(!top||top.action!==action||top.id!==id||!fromPanel)PEEK.stack.push({action:action,id:id});
  // 뒤로가기가 곁 카드부터 닫도록 (사용성 2단계): 열 때 같은 주소로 기록을 하나 쌓고, 바꿀 땐 덮어쓴다
  var st={peek:{action:action,id:id}};
  if(!PEEK.open)history.pushState(st,'',location.hash||location.pathname);else history.replaceState(st,'',location.hash||location.pathname);
  var reopen=PEEK.open&&!fromPanel;
  if(!PEEK.open){
    PEEK.open=true;
    $('peek').classList.add('open');$('peek').setAttribute('aria-hidden','false');
    document.body.classList.add('peek-open');
  }
  renderPeek(action,id);
  if(reopen){var el=$('peek');el.classList.remove('pop-in');void el.offsetWidth;el.classList.add('pop-in');}
}

function peekBack(){
  if(PEEK.stack.length<2)return;
  PEEK.stack.pop();
  var prev=PEEK.stack[PEEK.stack.length-1];
  renderPeek(prev.action,prev.id);
}

/* viaHistory: 뒤로가기나 다른 화면으로 이동하면서 닫힐 때는 기록을 건드리지 않는다.
   ✕·Esc·바깥 클릭으로 닫을 때는 열며 쌓은 기록을 하나 되돌린다 (그 되돌림은 popstate에서 무시) */
var _peekSkipPop=false;
function closePeek(viaHistory){
  if(!PEEK.open)return;
  if(!viaHistory&&history.state&&history.state.peek){_peekSkipPop=true;history.back();}
  PEEK.open=false;PEEK.stack=[];PEEK.anchor=null;
  $('peek').classList.remove('open','pop-in');$('peek').setAttribute('aria-hidden','true');
  document.body.classList.remove('peek-open');
  markPeeked();
}

/* 곁 카드에 띄운 항목을 전용 페이지로 */
function expandPeek(){
  var cur=PEEK.stack[PEEK.stack.length-1];if(!cur)return;
  closePeek(true);openDetail(cur.action,cur.id);
}

/* 본문에서 지금 곁 카드가 붙어 있는 카드를 표시 */
function markPeeked(){
  document.querySelectorAll('#mn .is-peeked').forEach(function(el){el.classList.remove('is-peeked');});
  if(PEEK.open&&PEEK.anchor)PEEK.anchor.classList.add('is-peeked');
}

/* 클릭 위임: 한 번/두 번 클릭 구분.
   e.detail(연속 클릭 횟수)로 판단하고, 첫 클릭은 잠깐 기다렸다가 두 번째가 안 오면 곁 카드를 연다.
   (바로 열면 더블클릭 때 곁 카드가 번쩍 열렸다 닫힌다) */
var _peekClickTimer=null;
function handleCardClick(e,inPanel){
  var el=e.target.closest('[data-action]');
  if(!el||!PEEK_LABEL[el.dataset.action]){
    // 카드가 아닌 이미지(상세 화면의 포스터·갤러리)는 클릭하면 크게 본다
    var img=e.target.closest('img');
    if(img&&img.src&&!e.target.closest('button,a,[onclick],.nx-card'))openLightbox(img.src);  // 카드 그림(기회·라이선스·제안 카드)은 카드 동작을 따른다
    return;
  }
  var action=el.dataset.action,id=el.dataset.id;
  clearTimeout(_peekClickTimer);
  if(isMobile()){openDetail(action,id);return;}
  if(e.detail>=2){closePeek(true);openDetail(action,id);return;}
  // 이미 이 카드에 붙어 있으면 한 번 더 누르면 닫는다
  if(!inPanel&&PEEK.open&&PEEK.anchor===el&&PEEK.stack.length===1){_peekClickTimer=setTimeout(function(){closePeek();},DOUBLE_CLICK_MS);return;}
  _peekClickTimer=setTimeout(function(){openPeek(action,id,inPanel,inPanel?null:el);},DOUBLE_CLICK_MS);
}

document.addEventListener('DOMContentLoaded',function(){
  $('mn').addEventListener('click',function(e){handleCardClick(e,false);});
  var peek=$('peek'),body=$('peek-body');
  body.addEventListener('click',function(e){handleCardClick(e,true);});
  // 곁 카드 안에서 일어난 이벤트(필터 버튼 등)를 처리하는 동안에는 $()가 곁 카드 쪽 요소를 먼저 찾게 한다
  ['click','input','change','keydown'].forEach(function(type){
    peek.addEventListener(type,function(){_domScope=body;setTimeout(function(){_domScope=null;},0);},true);
  });
  // 바깥을 누르면 닫는다 (다른 카드를 누른 건 그 카드로 옮겨 가니 그대로 둔다)
  document.addEventListener('mousedown',function(e){
    if(!PEEK.open)return;
    var t=e.target;
    if(t.closest('#peek,.wizard-overlay,.edit-modal-overlay,.lightbox-overlay,#mn [data-action]'))return;
    closePeek();
  });
});
/* 뒤로가기로 돌아온 화면에 그때 열려 있던 곁 카드를 다시 연다 (기록을 새로 쌓지 않음). 붙일 카드가 없으면 열지 않는다 */
function openPeekRestore(action,id){
  if(!PEEK_LABEL[action]||!id)return;
  var a=document.querySelector('#mn [data-action="'+action+'"][data-id="'+id+'"]');if(!a)return;
  PEEK.stack=[{action:action,id:id}];PEEK.anchor=a;
  PEEK.open=true;$('peek').classList.add('open');$('peek').setAttribute('aria-hidden','false');document.body.classList.add('peek-open');
  renderPeek(action,id);
}
