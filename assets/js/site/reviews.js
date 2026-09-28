/* 오리 사이트 — 후기와 관극 기록
   공연·작품·극장·단체에 "좋았던 점" 키워드를 고르고 짧게 남긴다 (네이버 지도 방문자 리뷰처럼 긍정을 모으는 방식).
   별점·비판 항목은 두지 않는다. 사람에게는 후기를 받지 않는다 — 건강하고 포용적인 문화를 위해.
   공연 후기는 곧 "관극 기록": 본 날짜를 함께 남기고, 마이페이지 "내 기록"에 모인다.
   DB: reviews(한 사람이 한 대상에 하나), list_reviews / my_reviews RPC, review_reports(신고). */
var REVIEW_KEYWORDS={
  show:['배우들 연기가 좋아요','노래가 좋아요','음악이 좋아요','연출이 신선해요','무대가 멋져요','조명이 아름다워요','의상이 멋져요','앙상블이 좋아요','감동적이에요','재미있어요','여운이 남아요','다시 보고 싶어요'],
  work:['이야기가 좋아요','넘버가 좋아요','메시지가 좋아요','배역이 골고루 있어요','처음 올리기 좋아요','관객 반응이 좋아요','연습할수록 재밌어요'],
  venue:['시야가 좋아요','음향이 좋아요','좌석이 편해요','찾아가기 쉬워요','대관 응대가 친절해요','분장실이 넉넉해요','무대가 넓어요','접근성이 좋아요','가성비가 좋아요'],
  troupe:['분위기가 좋아요','처음이어도 환영해요','소통이 잘 돼요','체계적이에요','서로 배려해요','함께 성장해요','또 함께하고 싶어요']
};
var REVIEW_NOUN={show:'공연',work:'작품',venue:'극장',troupe:'단체'};
var _rvCache={};

/* 상세 화면: 후기 섹션 자리 + 남기기 버튼 */
function reviewSection(type,id){return{title:'후기',body:'<div class="rv" id="rv-'+type+'-'+id+'"><div class="hf-loading">불러오는 중…</div></div>'};}
function reviewBtn(type,id){
  var label=type==='show'?'관극 기록 남기기':'후기 남기기';
  return dvActBtn(label,'openReviewForm(\''+type+'\',\''+id+'\')','✎',true);
}
async function loadReviews(type,id){
  var el=document.getElementById('rv-'+type+'-'+id);if(!el)return;
  var r=await sbClient.rpc('list_reviews',{p_type:type,p_id:id});
  if(r.error){el.innerHTML='<div class="rv-empty">후기를 불러오지 못했어요.</div>';return;}
  var rows=r.data||[];_rvCache[type+':'+id]=rows;
  el=document.getElementById('rv-'+type+'-'+id);if(!el)return;
  if(!rows.length){
    el.innerHTML='<div class="rv-empty">아직 후기가 없어요. '+(type==='show'?'이 공연을 봤다면 첫 관극 기록을 남겨주세요.':'좋았던 점을 처음으로 남겨주세요.')+'</div>';
    return;
  }
  // 좋았던 점 모아보기 (네이버 지도처럼 키워드별 막대)
  var cnt={};rows.forEach(function(x){(x.keywords||[]).forEach(function(k){cnt[k]=(cnt[k]||0)+1;});});
  var top=Object.keys(cnt).sort(function(a,b){return cnt[b]-cnt[a];}).slice(0,6),max=top.length?cnt[top[0]]:1;
  var h='<div class="rv-sum-h"><b>'+rows.length+'</b>명이 남긴 좋았던 점</div>'
    +(top.length?'<div class="rv-bars">'+top.map(function(k){return '<div class="rv-bar"><span class="rv-bar-fill" style="width:'+Math.max(8,Math.round(cnt[k]/max*100))+'%"></span><span class="rv-bar-k">'+escHtml(k)+'</span><span class="rv-bar-n">'+cnt[k]+'</span></div>';}).join('')+'</div>':'');
  var withText=rows.filter(function(x){return x.body||x.is_mine;});
  if(withText.length)h+='<div class="rv-list">'+withText.slice(0,20).map(function(x){return reviewItemHtml(type,id,x);}).join('')+'</div>';
  el.innerHTML=h;
}
function reviewItemHtml(type,id,x){
  var when=x.watched_on?String(x.watched_on).replace(/-/g,'.')+' 관람':new Date(x.created_at).toLocaleDateString('ko-KR');
  return '<div class="rv-item'+(x.is_mine?' mine':'')+'"><div class="rv-who"><span class="rv-av">'+escHtml(x.avatar_emoji||'🦆')+'</span><b>'+escHtml(x.nickname)+'</b><span class="rv-when">'+when+'</span>'
    +(x.is_mine?'<span class="rv-acts"><button type="button" onclick="openReviewForm(\''+type+'\',\''+id+'\')">고치기</button><button type="button" onclick="deleteReview(\''+type+'\',\''+id+'\',\''+x.id+'\')">지우기</button></span>'
      :'<span class="rv-acts"><button type="button" onclick="reportReview(\''+x.id+'\')">신고</button></span>')+'</div>'
    +((x.keywords||[]).length?'<div class="rv-kws">'+x.keywords.map(function(k){return '<span class="rv-kw">'+escHtml(k)+'</span>';}).join('')+'</div>':'')
    +(x.body?'<div class="rv-body">'+escHtml(x.body)+'</div>':'')+'</div>';
}

/* 남기기·고치기 창 */
function openReviewForm(type,id){
  if(!CURRENT_USER){loginWithGoogle();return;}
  var mine=(_rvCache[type+':'+id]||[]).find(function(x){return x.is_mine;})||{};
  var sel=mine.keywords||[];
  var ov=document.getElementById('rv-overlay');
  if(!ov){ov=document.createElement('div');ov.id='rv-overlay';ov.className='rv-overlay';document.body.appendChild(ov);}
  ov.innerHTML='<div class="rv-modal" role="dialog">'
    +'<div class="rv-m-h"><div><div class="rv-m-k">'+(type==='show'?'관극 기록':REVIEW_NOUN[type]+' 후기')+'</div><div class="rv-m-t">'+escHtml(nm(id))+'</div></div><button type="button" class="rv-x" onclick="closeReviewForm()">✕</button></div>'
    +(type==='show'?'<label class="rv-f"><span>본 날</span><input type="date" id="rv-date" value="'+(mine.watched_on||'')+'"></label>':'')
    +'<div class="rv-f"><span>어떤 점이 좋았나요? <small>여러 개 골라도 돼요</small></span><div class="rv-chips">'+REVIEW_KEYWORDS[type].map(function(k){
      return '<button type="button" class="rv-chip'+(sel.indexOf(k)>-1?' on':'')+'" onclick="this.classList.toggle(\'on\')">'+escHtml(k)+'</button>';
    }).join('')+'</div></div>'
    +'<label class="rv-f"><span>한마디 <small>선택 · 400자</small></span><textarea id="rv-body" rows="3" maxlength="400" placeholder="'+(type==='show'?'기억에 남은 장면, 좋았던 순간을 남겨주세요':'좋았던 경험을 나눠주세요')+'">'+escHtml(mine.body||'')+'</textarea></label>'
    +'<p class="rv-guide">오리는 서로를 응원하는 곳이에요. 좋았던 점 위주로, 특정 사람을 향한 평가나 비판은 남기지 않아요.</p>'
    +'<div class="rv-m-f"><button type="button" class="pf-btn" onclick="closeReviewForm()">취소</button><button type="button" class="pf-btn pf-active" onclick="saveReview(\''+type+'\',\''+id+'\')">남기기</button></div></div>';
  ov.classList.add('open');
  ov.onclick=function(e){if(e.target===ov)closeReviewForm();};
}
function closeReviewForm(){var ov=document.getElementById('rv-overlay');if(ov)ov.classList.remove('open');}
async function saveReview(type,id){
  var kws=[].slice.call(document.querySelectorAll('#rv-overlay .rv-chip.on')).map(function(b){return b.textContent;});
  var body=(document.getElementById('rv-body').value||'').trim();
  var dateEl=document.getElementById('rv-date');
  if(!kws.length&&!body){oriAlert('좋았던 점을 하나 이상 고르거나 한마디를 남겨주세요.');return;}
  var row={user_id:CURRENT_USER.id,target_type:type,target_id:id,keywords:kws,body:body||null,watched_on:dateEl&&dateEl.value?dateEl.value:null,updated_at:new Date().toISOString()};
  var r=await sbClient.from('reviews').upsert(row,{onConflict:'user_id,target_type,target_id'});
  if(r.error){oriAlert('남기지 못했어요: '+r.error.message);return;}
  closeReviewForm();
  loadReviews(type,id);
}
async function deleteReview(type,id,rid){
  if(!await oriConfirm('이 기록을 지울까요?'))return;
  var r=await sbClient.from('reviews').delete().eq('id',rid);
  if(r.error){oriAlert('지우지 못했어요: '+r.error.message);return;}
  loadReviews(type,id);
  if(window._myPageTab==='records')renderMyPageTabContent();
}
async function reportReview(rid){
  var reason=await oriPrompt('어떤 점이 문제인가요? (선택)\n운영팀이 확인하고 가이드에 맞지 않으면 숨겨요.','');
  if(reason===null)return;
  var r=await sbClient.from('review_reports').insert({review_id:rid,user_id:CURRENT_USER.id,reason:reason||null});
  if(r.error&&r.error.code!=='23505'){oriAlert('신고하지 못했어요: '+r.error.message);return;}
  oriAlert('신고했어요. 확인 후 처리할게요.');
}

/* 마이페이지 "내 기록": 관극 기록과 남긴 후기 */
async function renderMyRecords(el){
  el.innerHTML='<div class="hf-loading">불러오는 중…</div>';
  var r=await sbClient.rpc('my_reviews');
  if(r.error){el.innerHTML='<div class="result-empty">불러오지 못했어요.</div>';return;}
  var rows=r.data||[];
  var shows=rows.filter(function(x){return x.target_type==='show';}),others=rows.filter(function(x){return x.target_type!=='show';});
  if(!rows.length){
    el.innerHTML='<div class="result-empty"><div class="result-empty-icon">🎟</div><div style="font-size:0.95rem;margin-bottom:0.4rem">아직 기록이 없어요</div><div style="font-size:0.8rem;color:var(--muted);margin-bottom:1rem">본 공연 페이지에서 "관극 기록 남기기"를 눌러보세요. 작품·극장·단체에도 좋았던 점을 남길 수 있어요.</div><button class="pf-btn pf-active" onclick="goShows()">공연 둘러보기</button></div>';
    return;
  }
  var years={};shows.forEach(function(x){var y=(x.watched_on||x.created_at||'').slice(0,4);years[y]=(years[y]||0)+1;});
  var h='<div class="rec-stats"><span><em>'+shows.length+'</em>편 관람</span>'+Object.keys(years).sort().reverse().slice(0,3).map(function(y){return '<span>'+y+'년 <em>'+years[y]+'</em>편</span>';}).join('')+(others.length?'<span>후기 <em>'+others.length+'</em>개</span>':'')+'</div>';
  if(shows.length)h+='<section class="dv-sec">'+dvSection('관극 기록',shows.length)+'<div class="dv-list dv-list-film">'+shows.map(function(x){
    var s=DB.shows.find(function(v){return v.id===x.target_id;});
    var extra=[x.watched_on?String(x.watched_on).replace(/-/g,'.')+' 관람':'',(x.keywords||[]).slice(0,2).join(' · ')].filter(Boolean).join(' · ');
    return s?dvShowFilm(s,escHtml(extra)):'';
  }).join('')+'</div></section>';
  if(others.length)h+='<section class="dv-sec">'+dvSection('남긴 후기',others.length)+'<div class="rec-others">'+others.map(function(x){
    return '<div class="dv-row" data-action="'+x.target_type+'" data-id="'+x.target_id+'"><div class="dv-row-img dv-card-ph">'+({work:'📖',venue:'📍',troupe:'🏢'}[x.target_type]||'')+'</div><div class="dv-row-main"><div class="dv-row-title">'+escHtml(nm(x.target_id)||'(사라진 항목)')+'</div><div class="dv-row-sub">'+REVIEW_NOUN[x.target_type]+' · '+escHtml((x.keywords||[]).join(', ')||x.body||'')+'</div></div></div>';
  }).join('')+'</div></section>';
  el.innerHTML=h;
}
