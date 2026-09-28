/* 오리 사이트 — 카드 클릭 동작
   한 번 클릭 → 오른쪽 미리보기 패널(#peek)에 상세를 띄운다.
   두 번 클릭 → 전용 페이지(#show-xxx 등)로 이동한다.
   모바일은 패널을 펼칠 공간이 없어서 한 번 탭하면 바로 전용 페이지로 간다.
   상세 화면 함수(showShow 등)를 그대로 재사용하고, 그리는 동안만 PEEK.rendering을 켜서
   mn()이 본문 대신 패널에 쓰게 한다 (core.js의 mn, setNav, injectBackBtn 참고). */
var PEEK={rendering:false,open:false,stack:[]};
var PEEK_LABEL={show:'공연',person:'사람',work:'작품',role:'배역',venue:'극장',troupe:'단체'};
var DOUBLE_CLICK_MS=220;

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
  $('peek-type').textContent='';  // 종류는 패널 본문 윗줄(공연 · …)에 이미 나온다
  $('peek-back').hidden=PEEK.stack.length<2;
  markPeeked(action,id);
}

function openPeek(action,id,fromPanel){
  if(!PEEK_LABEL[action]||!id)return;
  if(isMobile()){openDetail(action,id);return;}
  var top=PEEK.stack[PEEK.stack.length-1];
  if(!fromPanel)PEEK.stack=[];
  if(!top||top.action!==action||top.id!==id||!fromPanel)PEEK.stack.push({action:action,id:id});
  renderPeek(action,id);
  if(!PEEK.open){
    PEEK.open=true;
    $('peek').classList.add('open');$('peek').setAttribute('aria-hidden','false');
    document.body.classList.add('peek-open');
  }
}

function peekBack(){
  if(PEEK.stack.length<2)return;
  PEEK.stack.pop();
  var prev=PEEK.stack[PEEK.stack.length-1];
  renderPeek(prev.action,prev.id);
}

function closePeek(){
  if(!PEEK.open)return;
  PEEK.open=false;PEEK.stack=[];
  $('peek').classList.remove('open');$('peek').setAttribute('aria-hidden','true');
  document.body.classList.remove('peek-open');
  markPeeked(null,null);
}

/* 패널에 띄운 항목을 전용 페이지로 */
function expandPeek(){
  var cur=PEEK.stack[PEEK.stack.length-1];if(!cur)return;
  closePeek();openDetail(cur.action,cur.id);
}

/* 본문에서 지금 패널에 떠 있는 카드를 표시 */
function markPeeked(action,id){
  document.querySelectorAll('#mn .is-peeked').forEach(function(el){el.classList.remove('is-peeked');});
  if(!action)return;
  document.querySelectorAll('#mn [data-action="'+action+'"][data-id="'+id+'"]').forEach(function(el){el.classList.add('is-peeked');});
}

/* 클릭 위임: 한 번/두 번 클릭 구분.
   e.detail(연속 클릭 횟수)로 판단하고, 첫 클릭은 잠깐 기다렸다가 두 번째가 안 오면 패널을 연다.
   (바로 열면 더블클릭 때 패널이 번쩍 열렸다 닫힌다) */
var _peekClickTimer=null;
function handleCardClick(e,inPanel){
  var el=e.target.closest('[data-action]');
  if(!el||!PEEK_LABEL[el.dataset.action]){
    // 카드가 아닌 이미지(상세 화면의 포스터·갤러리)는 클릭하면 크게 본다
    var img=e.target.closest('img');
    if(img&&img.src&&!e.target.closest('button,a'))openLightbox(img.src);
    return;
  }
  var action=el.dataset.action,id=el.dataset.id;
  clearTimeout(_peekClickTimer);
  if(isMobile()){openDetail(action,id);return;}
  if(e.detail>=2){closePeek();openDetail(action,id);return;}
  _peekClickTimer=setTimeout(function(){openPeek(action,id,inPanel);},DOUBLE_CLICK_MS);
}

document.addEventListener('DOMContentLoaded',function(){
  $('mn').addEventListener('click',function(e){handleCardClick(e,false);});
  var peek=$('peek'),body=$('peek-body');
  body.addEventListener('click',function(e){handleCardClick(e,true);});
  // 패널 안에서 일어난 이벤트(필터 버튼 등)를 처리하는 동안에는 $()가 패널 쪽 요소를 먼저 찾게 한다
  ['click','input','change','keydown'].forEach(function(type){
    peek.addEventListener(type,function(){_domScope=body;setTimeout(function(){_domScope=null;},0);},true);
  });
});
