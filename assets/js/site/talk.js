/* 오리 사이트 — 이야기 · 게시판 (10/24)
   작품·배역 페이지의 "이야기" 탭: 그 작품·배역에 대한 해석·연기 팁·연출 아이디어·제작 팁·질문이 쌓이는 곳.
   게시판(#board): 작품·배역 이야기 최신 글 + 기록에 매이지 않은 자유·질문·정보.
   건설적으로: 글은 종류를 골라 쓰고, 반응은 "도움됐어요"만(싫어요 없음), 기본 정렬은 도움순, 신고 → 운영자가 숨김.
   서버: talk_list / talk_replies_list / talk_hide, 표 talk_posts·talk_replies·talk_helpful·talk_reports (supabase/migrations/20261024_talk.sql) */
var TALK_KINDS={
  work:[['해석','해석'],['연출','연출 아이디어'],['제작','제작 팁'],['질문','질문']],
  role:[['해석','해석'],['연기','연기 팁'],['연출','연출 아이디어'],['질문','질문']],
  board:[['자유','자유'],['질문','질문'],['정보','정보']]
};
var TALK_LABEL={'해석':'해석','연기':'연기 팁','연출':'연출 아이디어','제작':'제작 팁','질문':'질문','자유':'자유','정보':'정보'};
var TALK_HINT={'해석':'어떻게 읽었나요?','연기':'연기할 때 도움이 된 것','연출':'이렇게 올려보면 어떨까요?','제작':'준비하며 알게 된 것 (무대·소품·예산)','질문':'궁금한 것','자유':'','정보':'나누고 싶은 정보'};
var _talk={};   // 자리(key)마다 {type,id,el,rows,kind,sort,open:{},draftKind}

function talkKey(type,id){return type+':'+(id||'');}
function talkWhen(d){var t=new Date(d),n=Date.now()-t.getTime();if(n<3600e3)return Math.max(1,Math.round(n/60e3))+'분 전';if(n<86400e3)return Math.round(n/3600e3)+'시간 전';if(n<7*86400e3)return Math.round(n/86400e3)+'일 전';return t.toLocaleDateString('ko-KR',{year:'numeric',month:'numeric',day:'numeric'});}
function talkText(s){return escHtml(s||'').replace(/\n/g,'<br>');}

/* 작품·배역 페이지: 홈 탭엔 도움 많이 받은 글 두 개, "이야기" 탭엔 전부 */
function talkSections(type,id){
  return [
    {title:'이야기',body:'<div id="talk-prev-'+type+'-'+id+'" class="talk-prev"></div>'},
    {title:'이야기',tab:'이야기',body:'<div id="talk-'+type+'-'+id+'"></div>'}
  ];
}
function talkAfter(type,id){
  if($('talk-'+type+'-'+id))renderTalk('talk-'+type+'-'+id,type,id);
  else if($('talk-prev-'+type+'-'+id))renderTalkPreview(type,id);
}
async function renderTalkPreview(type,id){
  var el=$('talk-prev-'+type+'-'+id);if(!el)return;
  var r=await sbClient.rpc('talk_list',{p_target_type:type,p_target_id:id});
  el=$('talk-prev-'+type+'-'+id);if(!el)return;
  var rows=(r.data||[]).filter(function(x){return !x.is_hidden;}).sort(function(a,b){return b.helpful-a.helpful||String(b.created_at).localeCompare(String(a.created_at));});
  el.innerHTML=(rows.length?rows.slice(0,2).map(function(p){
      return '<div class="talk-mini"><span class="talk-kind k-'+p.kind+'">'+escHtml(TALK_LABEL[p.kind])+'</span><span class="talk-mini-b">'+escHtml(String(p.body).replace(/\s+/g,' '))+'</span>'+(p.helpful?'<span class="talk-mini-h">도움 '+p.helpful+'</span>':'')+'</div>';
    }).join(''):'')
    +'<button type="button" class="dv-all talk-more" onclick="dvSwitchTab(\'이야기\')">'+(rows.length?'이야기 '+rows.length+'개 모두 보기 ›':'첫 이야기 남기기 ›')+'</button>';
}

/* ── 이야기 판 (작품·배역 탭, 게시판 공용) ── */
async function renderTalk(elId,type,id,opts){
  opts=opts||{};
  var k=talkKey(type,id),st=_talk[k]||(_talk[k]={type:type,id:id,rows:[],kind:'',sort:type==='feed'?'new':'help',open:{},draftKind:(TALK_KINDS[type==='feed'?'board':type]||[])[0][0]});
  st.el=elId;st.opts=opts;
  var el=$(elId);if(!el)return;
  if(!st.loaded)el.innerHTML='<div class="hf-loading">불러오는 중…</div>';
  var r=await sbClient.rpc('talk_list',{p_target_type:type,p_target_id:id||null});
  if(r.error){var e2=$(elId);if(e2)e2.innerHTML=loadFailHtml('이야기');return;}
  st.rows=r.data||[];st.loaded=true;
  talkDraw(k);
}
function talkDraw(k){
  var st=_talk[k],el=$(st.el);if(!el)return;
  var wtype=st.type==='feed'?'board':st.type,kinds=TALK_KINDS[wtype];
  var chipKinds=st.type==='feed'?[['','전체'],['자유','자유'],['질문','질문'],['정보','정보'],['record','작품·배역 이야기']]:[['','전체']].concat(kinds);
  var match=function(p){return !st.kind||(st.kind==='record'?p.target_type!=='board':p.kind===st.kind);};
  var rows=st.rows.filter(match).slice().sort(st.sort==='help'?function(a,b){return b.helpful-a.helpful||String(b.created_at).localeCompare(String(a.created_at));}:function(a,b){return String(b.created_at).localeCompare(String(a.created_at));});
  var cnt=function(c){return st.rows.filter(function(p){return !c||(c==='record'?p.target_type!=='board':p.kind===c);}).length;};
  var q='\''+k+'\'';
  var h='<div class="talk">'
    +'<div class="talk-top"><div class="pchips talk-chips">'+chipKinds.map(function(c){return '<button type="button" class="'+(st.kind===c[0]?'active':'')+'" onclick="talkKind('+q+',\''+c[0]+'\')">'+escHtml(c[1])+'<span class="pchips-n">'+cnt(c[0])+'</span></button>';}).join('')+'</div>'
    +'<div class="talk-sort"><button type="button" class="'+(st.sort==='help'?'on':'')+'" onclick="talkSort('+q+',\'help\')">도움순</button><button type="button" class="'+(st.sort==='new'?'on':'')+'" onclick="talkSort('+q+',\'new\')">최신순</button></div></div>'
    +talkComposer(k,wtype)
    +'<div class="talk-list">'+(rows.length?rows.map(function(p){return talkPostHtml(k,p);}).join(''):'<div class="talk-empty">'+(st.rows.length?'이 종류의 글은 아직 없어요':'아직 이야기가 없어요')+'</div>')+'</div></div>';
  el.innerHTML=h;
  Object.keys(st.open).forEach(function(pid){if(st.open[pid])talkLoadReplies(k,pid);});
}
function talkComposer(k,wtype){
  var st=_talk[k],kinds=TALK_KINDS[wtype],q='\''+k+'\'';
  return '<div class="talk-write">'
    +'<div class="talk-kinds" role="radiogroup">'+kinds.map(function(c){return '<button type="button" role="radio" aria-checked="'+(st.draftKind===c[0])+'" class="talk-kind k-'+c[0]+(st.draftKind===c[0]?' on':'')+'" onclick="talkDraftKind('+q+',\''+c[0]+'\')">'+escHtml(c[1])+'</button>';}).join('')+'</div>'
    +(wtype==='board'?'<input type="text" class="talk-title-in" id="talk-title-'+k.replace(/[^a-z0-9]/gi,'')+'" maxlength="120" placeholder="제목">':'')
    +'<textarea class="talk-in" id="talk-in-'+k.replace(/[^a-z0-9]/gi,'')+'" rows="3" maxlength="4000" placeholder="'+escHtml(TALK_HINT[st.draftKind]||'')+'"></textarea>'
    +'<div class="talk-write-row"><button type="button" class="pf-btn pf-active" onclick="talkPost('+q+')">올리기</button></div></div>';
}
function talkPostHtml(k,p){
  var st=_talk[k],q='\''+k+'\'',pid='\''+p.id+'\'';
  var ctxH='';
  if(st.type==='feed'&&p.target_type!=='board'){
    var nmv=nm(p.target_id);
    ctxH='<span class="talk-ctx" data-action="'+p.target_type+'" data-id="'+p.target_id+'">'+(p.target_type==='role'?'배역 ':'')+'〈'+escHtml(nmv||'기록')+'〉</span>';
  }
  return '<article class="talk-post'+(p.is_hidden?' hidden-post':'')+'" id="tp-'+p.id+'">'
    +'<div class="talk-meta">'+ctxH+'<span class="talk-kind k-'+p.kind+'">'+escHtml(TALK_LABEL[p.kind]||p.kind)+'</span><b>'+escHtml(p.author)+'</b><span>'+talkWhen(p.created_at)+(p.edited_at?' · 고침':'')+'</span>'
    +(p.is_hidden?'<span class="talk-hid">숨김</span>':'')+(p.reports?'<span class="talk-rep">신고 '+p.reports+'</span>':'')+'</div>'
    +(p.title?'<h3 class="talk-t">'+escHtml(p.title)+'</h3>':'')
    +'<div class="talk-b">'+talkText(p.body)+'</div>'
    +'<div class="talk-acts">'
    +'<button type="button" class="talk-help'+(p.my_helpful?' on':'')+'" aria-pressed="'+p.my_helpful+'" onclick="talkHelp('+q+',\'post\','+pid+')"'+(p.mine?' disabled title="내 글"':'')+'><svg viewBox="0 0 24 24" width="15" height="15" fill="'+(p.my_helpful?'currentColor':'none')+'" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M7 11v9H4v-9zM7 11l4-7c1.5 0 2.5 1 2.2 2.6L12.8 10H19a2 2 0 0 1 2 2.3l-1.2 6A2 2 0 0 1 17.8 20H7"/></svg>도움됐어요'+(p.helpful?' '+p.helpful:'')+'</button>'
    +'<button type="button" class="talk-link" onclick="talkToggleReplies('+q+','+pid+')">답글'+(p.replies?' '+p.replies:'')+'</button>'
    +(p.mine?'<button type="button" class="talk-link" onclick="talkEdit('+q+','+pid+')">고치기</button><button type="button" class="talk-link" onclick="talkDelete('+q+',\'post\','+pid+')">지우기</button>'
      :'<button type="button" class="talk-link" onclick="talkReport(\'post\','+pid+')">신고</button>')
    +(window.IS_ADMIN?'<button type="button" class="talk-link talk-admin" onclick="talkHide('+q+',\'post\','+pid+','+(!p.is_hidden)+')">'+(p.is_hidden?'되살리기':'숨기기')+'</button>':'')
    +'</div><div class="talk-replies" id="tr-'+p.id+'"'+(st.open[p.id]?'':' hidden')+'></div></article>';
}
function talkKind(k,c){_talk[k].kind=c;talkDraw(k);}
function talkSort(k,s){_talk[k].sort=s;talkDraw(k);}
function talkDraftKind(k,c){
  var st=_talk[k],box=$('talk-in-'+k.replace(/[^a-z0-9]/gi,'')),val=box?box.value:'',t=$('talk-title-'+k.replace(/[^a-z0-9]/gi,'')),tv=t?t.value:'';
  st.draftKind=c;talkDraw(k);
  var b2=$('talk-in-'+k.replace(/[^a-z0-9]/gi,''));if(b2){b2.value=val;b2.focus();}
  var t2=$('talk-title-'+k.replace(/[^a-z0-9]/gi,''));if(t2)t2.value=tv;
}
async function talkPost(k){
  if(!CURRENT_USER){loginWithGoogle();return;}
  var st=_talk[k],sk=k.replace(/[^a-z0-9]/gi,''),box=$('talk-in-'+sk),body=(box&&box.value||'').trim(),t=$('talk-title-'+sk);
  if(body.length<2){if(box)box.focus();return;}
  var board=st.type==='board'||st.type==='feed';
  var row={target_type:board?'board':st.type,target_id:board?null:st.id,kind:st.draftKind,body:body,user_id:CURRENT_USER.id};
  if(t&&t.value.trim())row.title=t.value.trim();
  try{await sbOk(sbClient.from('talk_posts').insert(row));}catch(e){oriAlert('올리지 못했어요: '+e.message);return;}
  st.sort='new';await renderTalk(st.el,st.type,st.id,st.opts);
  flashNew('#'+st.el+' .talk-post');
}
async function talkHelp(k,type,itemId,postId){
  if(!CURRENT_USER){loginWithGoogle();return;}
  var st=_talk[k],item=type==='post'?st.rows.find(function(x){return x.id===itemId;}):(st.replies&&st.replies[postId]||[]).find(function(x){return x.id===itemId;});
  if(!item||item.mine)return;
  var on=!item.my_helpful;
  var r=on?await sbClient.from('talk_helpful').insert({item_type:type,item_id:itemId,user_id:CURRENT_USER.id})
    :await sbClient.from('talk_helpful').delete().eq('item_type',type).eq('item_id',itemId).eq('user_id',CURRENT_USER.id);
  if(r.error){oriAlert('저장하지 못했어요: '+r.error.message);return;}
  item.my_helpful=on;item.helpful+=on?1:-1;
  if(type==='post')talkDraw(k);else talkDrawReplies(k,postId);
}
function talkToggleReplies(k,pid){
  var st=_talk[k];st.open[pid]=!st.open[pid];
  var el=$('tr-'+pid);if(!el)return;el.hidden=!st.open[pid];
  if(st.open[pid])talkLoadReplies(k,pid);
}
async function talkLoadReplies(k,pid){
  var st=_talk[k],el=$('tr-'+pid);if(!el)return;
  if(!(st.replies&&st.replies[pid]))el.innerHTML='<div class="hf-loading">불러오는 중…</div>';
  var r=await sbClient.rpc('talk_replies_list',{p_post_id:pid});
  if(r.error){el.innerHTML=loadFailHtml('답글');return;}
  (st.replies=st.replies||{})[pid]=r.data||[];
  talkDrawReplies(k,pid);
}
function talkDrawReplies(k,pid){
  var st=_talk[k],el=$('tr-'+pid);if(!el)return;
  var q='\''+k+'\'',p='\''+pid+'\'';
  el.innerHTML=(st.replies[pid]||[]).map(function(x){
    var xid='\''+x.id+'\'';
    return '<div class="talk-reply'+(x.is_hidden?' hidden-post':'')+'"><div class="talk-meta"><b>'+escHtml(x.author)+'</b><span>'+talkWhen(x.created_at)+'</span>'+(x.is_hidden?'<span class="talk-hid">숨김</span>':'')+(x.reports?'<span class="talk-rep">신고 '+x.reports+'</span>':'')+'</div>'
      +'<div class="talk-b">'+talkText(x.body)+'</div><div class="talk-acts">'
      +'<button type="button" class="talk-help sm'+(x.my_helpful?' on':'')+'" onclick="talkHelp('+q+',\'reply\','+xid+','+p+')"'+(x.mine?' disabled':'')+'>도움됐어요'+(x.helpful?' '+x.helpful:'')+'</button>'
      +(x.mine?'<button type="button" class="talk-link" onclick="talkDelete('+q+',\'reply\','+xid+','+p+')">지우기</button>':'<button type="button" class="talk-link" onclick="talkReport(\'reply\','+xid+')">신고</button>')
      +(window.IS_ADMIN?'<button type="button" class="talk-link talk-admin" onclick="talkHide('+q+',\'reply\','+xid+','+(!x.is_hidden)+','+p+')">'+(x.is_hidden?'되살리기':'숨기기')+'</button>':'')
      +'</div></div>';
  }).join('')
  +'<div class="talk-reply-write"><input type="text" id="tri-'+pid+'" maxlength="2000" placeholder="답글" onkeydown="if(event.key===\'Enter\'&&!event.isComposing)talkReply('+q+','+p+')"><button type="button" class="pf-btn" onclick="talkReply('+q+','+p+')">달기</button></div>';
}
async function talkReply(k,pid){
  if(!CURRENT_USER){loginWithGoogle();return;}
  var inp=$('tri-'+pid),body=(inp&&inp.value||'').trim();if(!body)return;
  try{await sbOk(sbClient.from('talk_replies').insert({post_id:pid,body:body,user_id:CURRENT_USER.id}));}catch(e){oriAlert('답글을 달지 못했어요: '+e.message);return;}
  var post=_talk[k].rows.find(function(x){return x.id===pid;});if(post)post.replies++;
  _talk[k].open[pid]=true;talkDraw(k);
}
async function talkEdit(k,pid){
  var st=_talk[k],p=st.rows.find(function(x){return x.id===pid;});if(!p)return;
  var body=await oriPrompt('고치기',p.body);if(body===null)return;body=body.trim();if(body.length<2)return;
  try{await sbOk(sbClient.from('talk_posts').update({body:body,edited_at:new Date().toISOString()}).eq('id',pid));}catch(e){oriAlert('고치지 못했어요: '+e.message);return;}
  p.body=body;p.edited_at=new Date().toISOString();talkDraw(k);
}
async function talkDelete(k,type,id,postId){
  if(!await oriConfirm(type==='post'?'이 글을 지울까요? 달린 답글도 함께 지워져요.':'이 답글을 지울까요?',{ok:'지우기',cancel:'그대로 두기'}))return;
  try{await sbOk(sbClient.from(type==='post'?'talk_posts':'talk_replies').delete().eq('id',id));}catch(e){oriAlert('지우지 못했어요: '+e.message);return;}
  var st=_talk[k];
  if(type==='post')st.rows=st.rows.filter(function(x){return x.id!==id;});
  else{st.replies[postId]=(st.replies[postId]||[]).filter(function(x){return x.id!==id;});var p=st.rows.find(function(x){return x.id===postId;});if(p)p.replies--;}
  talkDraw(k);
}
async function talkReport(type,id){
  if(!CURRENT_USER){loginWithGoogle();return;}
  var reason=await oriPrompt('신고하는 까닭 (선택)','');if(reason===null)return;
  var r=await sbClient.from('talk_reports').insert({item_type:type,item_id:id,user_id:CURRENT_USER.id,reason:reason.trim()||null});
  if(r.error&&r.error.code!=='23505'){oriAlert('신고하지 못했어요: '+r.error.message);return;}
  oriAlert('신고했어요. 운영팀이 살펴볼게요.');
}
async function talkHide(k,type,id,hidden,postId){
  try{await sbOk(sbClient.rpc('talk_hide',{p_item_type:type,p_item_id:id,p_hidden:hidden}));}catch(e){oriAlert('바꾸지 못했어요: '+e.message);return;}
  var st=_talk[k];
  if(type==='post'){var p=st.rows.find(function(x){return x.id===id;});if(p)p.is_hidden=hidden;talkDraw(k);}
  else{var x=(st.replies[postId]||[]).find(function(y){return y.id===id;});if(x)x.is_hidden=hidden;talkDrawReplies(k,postId);}
}

/* ── 게시판 (#board) ── */
function goBoard(push){
  if(push!==false)history.pushState({view:'board'},'','#board');
  setNav('board');sb('');_sbContext='';mobShowDetail();
  if(!CURRENT_USER){loginWithGoogle();return;}
  mn('<div class="nx board-nx"><div class="mine-head"><h1 class="mine-title">게시판</h1></div><div id="talk-board"></div></div>');
  renderTalk('talk-board','feed',null);
}
