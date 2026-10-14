/* 오리 사이트 — 해시 라우팅 + 앱 시작 (반드시 마지막에 로드) */
function routeFromHash(hash){
  var h=hash||location.hash;
  if(!h){goHome(false);return;}  // 사이트 첫 화면 = 아카이브 홈 (10/14)
  if(h==='#home'){goHome(false);return;}
  if(h==='#shows'){goShows(false);return;}
  if(h==='#people'){goPeople(false);return;}
  if(h==='#works'){goWorks(false);return;}
  if(h==='#roles'){goRoles(false);return;}
  if(h==='#venues'){goVenues(false);return;}
  if(h==='#troupes'){goTroupes(false);return;}
  if(h==='#content'){goContent(false);return;}
  if(h==='#mypage'){goMyPage(false);return;}
  if(h==='#projects'){goProjectBrowse(false);return;}
  if(h==='#offers'){goOffers(false);return;}
  if(h==='#make'||h==='#my'){goMake(false);return;}
  if(h==='#terms'){goTerms(false);return;}
  if(h==='#privacy'){goPrivacy(false);return;}
  var m;
  if(m=h.match(/^#show-(.+)$/)){showShow(m[1],false);return;}
  if(m=h.match(/^#person-(.+)$/)){showPerson(m[1],false);return;}
  if(m=h.match(/^#work-(.+)$/)){showWork(m[1],false);return;}
  if(m=h.match(/^#role-(.+)$/)){showRole(m[1],false);return;}
  if(m=h.match(/^#venue-(.+)$/)){showVenue(m[1],false);return;}
  if(m=h.match(/^#troupe-(.+)$/)){showTroupe(m[1],false);return;}
  if(m=h.match(/^#project-(.+)$/)){goProject(m[1],false);return;}
  if(m=h.match(/^#mytroupe-(.+)$/)){goMyTroupe(m[1],false);return;}
  goHome(false);
}
window.addEventListener('popstate',function(e){
  if(_peekSkipPop){_peekSkipPop=false;return;}           // ✕·Esc로 패널을 닫으며 되돌린 기록
  if(PEEK.open){closePeek(true);return;}                  // 뒤로가기는 패널부터 닫는다 (본문은 그대로)
  routeFromHash(location.hash);
  var p=e.state&&e.state.peek;                             // 패널을 열어둔 채 떠났던 화면이면 패널도 다시
  if(p&&!isMobile())openPeekRestore(p.action,p.id);
});

(async function(){
  await initAuth();
})();
