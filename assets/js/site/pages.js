/* 오리 사이트 — 정적 페이지 (콘텐츠 준비중, 라이선스 문의, 이용약관, 개인정보처리방침) */
/* ══ 콘텐츠 (준비중) ══ */
function goContent(push){
  if(push!==false)history.pushState({view:'content'},'','#content');
  setNav('content');sb('');_sbContext='';mobShowDetail();
  mn('<div class="tab-index"><div class="result-empty"><div class="result-empty-icon">📰</div>'
    +'<div style="font-size:0.95rem;margin-bottom:0.4rem">콘텐츠 메뉴는 준비 중입니다</div>'
    +'<div style="font-size:0.8rem;color:var(--muted)">공지, 아티클, 큐레이션 등을 담을 공간이 곧 열릴 예정이에요.</div>'
    +'</div></div>');
}

/* ══ 법적 문서 (이용약관 / 개인정보처리방침) ══ */
async function openCopyrightReport(sid){
  if(!CURRENT_USER){loginWithGoogle();return;}
  if(!await oriConfirm('저작권 문제를 신고하시겠어요?\n신고 즉시 이 공연은 비공개 처리되고, 운영자가 확인해요.'))return;
  var note= await oriPrompt('간단히 설명해주세요 (선택)')||'';
  try{
    var r=await sbClient.rpc('report_copyright',{p_show_id:sid,p_note:note});
    if(r.error)throw r.error;
    oriAlert('신고 접수됐어요. 해당 공연은 비공개 처리됐습니다.');
    goShows();
  }catch(e){oriAlert('신고 처리 중 문제가 생겼어요: '+e.message);}
}
var _licenseInquiryCtx=null;
function openLicenseInquiry(sid,wid){
  if(!CURRENT_USER){loginWithGoogle();return;}
  _licenseInquiryCtx={showId:sid||null,workId:wid||null};
  var target=sid?nm(sid):(wid?nm(wid):'');
  $('license-inquiry-title').textContent=target?(target+' 라이선스가 궁금하신가요?'):'라이선스가 궁금하신가요?';
  $('license-inquiry-message').value='';$('license-inquiry-contact').value='';$('license-inquiry-msg').textContent='';
  $('license-inquiry-overlay').classList.add('open');
}
function closeLicenseInquiry(){$('license-inquiry-overlay').classList.remove('open');}
