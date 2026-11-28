"use strict";
/* ================= 스테이지 선택 화면 =================
   시작하기(또는 Enter) → 이 화면 → 스테이지 탭 → 수풀 아웃트로(playOutro) → 게임
   ‹ 타이틀(또는 Esc) → 타이틀 화면으로 돌아가요.

   해금 규칙: 클리어한 스테이지는 언제나 열리고,
              아직 클리어하지 않은 스테이지는 앞번호부터 3개까지만 열려요.
   클리어 기록은 js/controller.js 가 클리어 확정 시 localStorage "tp_cleared" 에 남기고
   ({스테이지 인덱스: {bestMs, bestTurns}}), 이 화면이 그걸 읽어요. */
(function(){
  var el=document.getElementById("stageSel");
  if(!el) return;
  /* 에디터 테스트 플레이(iframe)에서는 인트로·선택 화면 없이 바로 테스트 */
  if(typeof EDITOR_PLAYTEST!=="undefined"&&EDITOR_PLAYTEST){ el.classList.add("hidden"); return; }

  var grid=document.getElementById("ssGrid");
  var prog=document.getElementById("ssProg");
  var foot=document.getElementById("ssFoot");
  var back=document.getElementById("ssBack");
  var FOOT_NOTE=foot?foot.textContent:"";
  var open=false, entering=false, footTmr=0;

  function readCleared(){
    try{
      var all=JSON.parse(localStorage.getItem("tp_cleared")||"{}");
      return (all&&typeof all==="object")?all:{};
    }catch(e){ return {}; }
  }
  /* 미클리어 스테이지는 앞번호부터 최대 3개까지 열어요 */
  function unlockMap(cleared){
    var map=[], left=3;
    for(var i=0;i<STAGES.length;i++){
      if(cleared[i]){ map[i]=true; continue; }
      if(left>0){ map[i]=true; left--; } else map[i]=false;
    }
    return map;
  }
  function esc(s){
    return String(s).replace(/[&<>"]/g,function(c){
      return ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"})[c];
    });
  }

  /* ---------- 카드 2열 × 5행 ---------- */
  function render(){
    var cleared=readCleared(), unlock=unlockMap(cleared), nClear=0, html="";
    for(var i=0;i<STAGES.length;i++){
      var rec=cleared[i], isClear=!!rec;
      if(isClear) nClear++;
      var cls=isClear?"clear":(unlock[i]?"open":"lock");
      var no="STAGE "+(i<9?"0":"")+(i+1);
      var badge=isClear?"★ CLEAR":(unlock[i]?"▶ 도전":"🔒 잠김");
      var best, dim=false;
      if(isClear){
        var tm=(rec.bestMs!=null&&isFinite(rec.bestMs))
          ?((typeof cwTimeText==="function")?cwTimeText(rec.bestMs):"--") : "--";
        var tn=(rec.bestTurns!=null&&isFinite(rec.bestTurns))?(rec.bestTurns+"턴") : "--";
        best="최고 "+tm+" · "+tn;
      }else if(unlock[i]){
        best="미클리어"; dim=true;
      }else{
        best="앞 스테이지부터"; dim=true;
      }
      html+='<button type="button" class="ss-card '+cls+'" data-i="'+i+'"'+
            ' aria-label="스테이지 '+(i+1)+' '+esc(STAGES[i].name)+' — '+badge+'">'+
            '<span class="ss-no">'+no+'</span>'+
            '<span class="ss-nm">'+esc(STAGES[i].name)+'</span>'+
            '<span class="ss-badge">'+badge+'</span>'+
            '<span class="ss-best'+(dim?" dim":"")+'">'+best+'</span>'+
            '</button>';
    }
    if(grid) grid.innerHTML=html;
    if(prog) prog.innerHTML='<b>'+nClear+'</b> / '+STAGES.length+' 클리어';
  }

  /* ---------- 열기 / 닫기 ---------- */
  function openSelect(){
    if(open||entering) return;
    open=true;
    if(footTmr){ clearTimeout(footTmr); footTmr=0; }
    if(foot) foot.textContent=FOOT_NOTE;
    render();
    el.classList.remove("hidden");
    void el.offsetWidth;
    el.classList.add("open");
    el.setAttribute("aria-hidden","false");
  }
  function closeSelect(){
    if(!open) return;
    open=false;
    el.classList.remove("open");
    el.setAttribute("aria-hidden","true");
    setTimeout(function(){ if(!open) el.classList.add("hidden"); },240);
  }
  function enterStage(i){
    if(entering) return;
    entering=true;
    closeSelect();
    /* 뒤에 있던 타이틀 화면이 수풀 아웃트로를 재생하면서 게임으로 넘어가요 */
    if(typeof window.startAtStage==="function"){
      window.startAtStage(i);
    }else{
      G.stageIdx=i; G.mode="play"; loadStage(i); setWarn("");
    }
    setTimeout(function(){ entering=false; },400);
  }
  function lockedCard(card){
    card.classList.remove("shake");
    void card.offsetWidth;
    card.classList.add("shake");
    if(foot){
      foot.textContent="🔒 미클리어 스테이지는 앞번호부터 3개까지 열려요";
      if(footTmr) clearTimeout(footTmr);
      footTmr=setTimeout(function(){ foot.textContent=FOOT_NOTE; footTmr=0; },1600);
    }
    try{ if(typeof sBeepTip==="function") sBeepTip(); }catch(e){}
  }

  /* ---------- 이벤트 ---------- */
  if(grid) grid.addEventListener("click",function(e){
    var b=e.target.closest?e.target.closest(".ss-card"):null;
    if(!b) return;
    if(b.classList.contains("lock")){ b.blur(); lockedCard(b); return; }
    var i=parseInt(b.getAttribute("data-i"),10);
    if(isNaN(i)) return;
    b.blur();
    enterStage(i);
  });
  if(back) back.addEventListener("click",function(){ back.blur(); closeSelect(); });

  document.addEventListener("keydown",function(e){
    if(!open) return;
    if(e.key==="Escape"){ e.preventDefault(); e.stopPropagation(); closeSelect(); return; }
    if(e.ctrlKey||e.metaKey||e.altKey) return;
    var k=e.key;
    var isActivate=(k==="Enter"||k===" "||k==="Spacebar"||e.code==="Space");
    if(isActivate){
      /* 카드에 포커스가 있으면 Enter·Space 는 그 카드를 누르는 기본 동작에 맡겨요 */
      var a=document.activeElement;
      if(!(a&&a.classList&&a.classList.contains("ss-card"))) e.stopPropagation();
      return;
    }
    /* 화면이 떠 있는 동안 인게임 키(방향키·U·R·1~5)가 새어 들어가지 않게 */
    if(k.indexOf("Arrow")===0||k==="u"||k==="U"||k==="r"||k==="R"||k==="Backspace"||
       (k.length===1&&k>="1"&&k<="5")){
      e.preventDefault(); e.stopPropagation();
    }
  },true);

  /* 시작하기·Enter 가 이 화면을 열도록 js/start.js 가 불러요 */
  window.openStageSelect=openSelect;
})();
