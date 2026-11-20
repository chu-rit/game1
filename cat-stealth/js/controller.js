"use strict";
/* ================= HUD ================= */
function updateHUD(){
  var s=STAGES[G.stageIdx];
  $("hStage").textContent=(G.stageIdx+1)+"/"+STAGES.length;
  $("hName").textContent=s.name;
  $("hTurn").textContent=G.st.turn+"/"+G.st.maxTurns;
  /* 수풀에 숨어 있는 동안은 하단 힌트가 은신 상태를 알려줘요 */
  if(isHideTile(G.st,G.st.player.x,G.st.player.y)){
    $("hint").textContent="🌿 수풀에 숨었어요 — 고양이 눈·귀에 안 걸리고 추격도 끊겼어요";
  }else{
    $("hint").textContent=s.hint||HINT_DEFAULT;
  }
  var inv=G.st.inv, busy=(G.mode==="anim"||!!G.pending);
  var live=(G.mode==="play"||G.mode==="caught");
  for(var fi=0;fi<FISH_ORDER.length;fi++){
    var kd=FISH_ORDER[fi], btn=FBTN[kd];
    if(!btn) continue;
    var n=inv[kd]||0;
    btn.num.textContent=n;
    btn.el.disabled=(n<=0)||busy||G.mode!=="play";
    btn.el.classList.toggle("on",!!G.fishMode&&G.fishKind===kd);
  }
  $("bUndo").disabled=busy||G.undoStack.length===0||!live;
  $("bReset").disabled=busy||!live;
  /* 잡혔을 때는 패널 없이 보드를 본 채로, 취소 버튼에만 은은한 강조 */
  $("bUndo").classList.toggle("hot",G.mode==="caught");
}
function setWarn(msg,cls){
  var w=$("warn");
  if(!msg){ w.textContent=""; w.className=""; return; }
  w.textContent=msg; w.className=cls||"";
}
function clearWarnSoon(ms){
  var t=G.warnT=(G.warnT||0)+1;
  setTimeout(function(){ if(G.warnT===t&&G.mode==="play") setWarn(""); },ms||1600);
}

/* ================= 입력 · 즉시 실행 ================= */
function validMoves(){
  var p=G.st.player, out=[];
  for(var d=0;d<4;d++){
    var nx=p.x+DIRS[d][0], ny=p.y+DIRS[d][1];
    if(!humanWalkable(G.st,nx,ny)) continue;
    var occupied=false;
    for(var i=0;i<G.st.cats.length;i++){ if(G.st.cats[i].x===nx&&G.st.cats[i].y===ny){ occupied=true; } }
    if(occupied) continue;
    out.push({x:nx,y:ny,dir:d});
  }
  return out;
}
function validFishTiles(){
  /* 상하좌우 직선 2칸까지만 · 대각선 불가 · 장애물(벽/가구/고양이/다른 생선/아직 줍지 않은 생선)을 만나면 그 방향은 거기서 끊김 */
  var p=G.st.player, out=[];
  var free=function(x,y){
    /* 벽·가구·구멍(H)은 넘지 못해요. 고양이 발판(^)에는 던져서 떨어뜨릴 수 있어요. */
    if(!catWalkable(G.st,x,y)) return false;
    for(var i=0;i<G.st.cats.length;i++){ if(G.st.cats[i].x===x&&G.st.cats[i].y===y) return false; }
    for(var fi=0;fi<G.st.fishes.length;fi++){ if(G.st.fishes[fi].x===x&&G.st.fishes[fi].y===y) return false; }
    for(var pi=0;pi<G.st.pickups.length;pi++){ if(G.st.pickups[pi].x===x&&G.st.pickups[pi].y===y) return false; }
    return true;
  };
  for(var d=0;d<4;d++){
    for(var step=1;step<=FISH_RANGE;step++){
      var x=p.x+DIRS[d][0]*step, y=p.y+DIRS[d][1]*step;
      if(!free(x,y)) break;
      out.push({x:x,y:y});
    }
  }
  return out;
}
function computeDanger(){
  G.moveTiles=validMoves();
  G.dangerTiles=[];
  if(!G.st) return;
  for(var i=0;i<G.moveTiles.length;i++){
    var m=G.moveTiles[i], t=cloneState(G.st), ev=[];
    simStep(t,{t:"move",x:m.x,y:m.y},ev);
    var spot=false, killed=false;
    for(var e=0;e<ev.length;e++){
      if(ev[e].k==="spot") spot=true;
      if(ev[e].k==="caught") killed=true;
    }
    if(killed||spot) G.dangerTiles.push({x:m.x,y:m.y,killed:killed});
  }
}
function catById(id){
  for(var i=0;i<G.st.cats.length;i++){ if(G.st.cats[i].id===id) return G.st.cats[i]; }
  return null;
}
function beginTurn(action){
  if(G.mode!=="play"||G.pending) return;
  var snap={st:cloneState(G.st),dir:G.playerDir};
  var next=cloneState(G.st), ev=[];
  simStep(next,action,ev);

  G.undoStack.push(snap);
  if(G.undoStack.length>UNDO_MAX) G.undoStack.shift();

  var st=G.st;
  if(action.t==="move") G.playerDir=action.dir;
  else if(action.t==="fish") G.playerDir=dirFromTo({x:st.player.x,y:st.player.y,dir:G.playerDir},{x:action.x,y:action.y});
  st.player.x=next.player.x; st.player.y=next.player.y;
  st.inv=next.inv; st.pickups=next.pickups; st.fishes=next.fishes;
  for(var i=0;i<st.cats.length;i++){
    var c=st.cats[i], nc=next.cats[i];
    c.x=nc.x; c.y=nc.y; c.dir=nc.dir; c.state=nc.state; c.lure=nc.lure;
    c.chaseSteps=nc.chaseSteps; c.pi=nc.pi; c.psign=nc.psign;
  }

  var arc=null;
  setWarn("");   /* 이번 턴 안내 문구를 먼저 지우고, 사건(줍기·연쇄)이 있으면 그걸 띄워요 */
  for(var e=0;e<ev.length;e++){
    var v=ev[e];
    if(v.k==="fish"){ arc={from:{x:snap.st.player.x,y:snap.st.player.y},to:{x:v.x,y:v.y},kind:v.kind,t0:performance.now()}; sFish(); }
    else if(v.k==="spot"){ var cat=catById(v.id); if(cat) cat.alertT=performance.now(); sSpot(); }
    else if(v.k==="pickup"){
      G.fx.push({kind:v.kind,x:v.x,y:v.y,t0:performance.now()});
      var fbt=FBTN[v.kind];
      if(fbt){ fbt.el.classList.remove("gain"); void fbt.el.offsetWidth; fbt.el.classList.add("gain"); }
      sPickup();
      setWarn(KIND[v.kind].label+"을(를) 주웠어요! 아래 버튼으로 던질 수 있어요","fish");
      clearWarnSoon(2000);
    }
    else if(v.k==="bite"){ sBite(); }
    else if(v.k==="chain"){
      sChain();
      setWarn("😺 연쇄 반응! 냄새를 따라 다음 먹이로 걸어가요","fish");
      clearWarnSoon(2200);
    }
    else if(v.k==="ate"){ sAte(); }
    else if(v.k==="hide"){
      sHide();
      setWarn("🌿 수풀에 몸을 숨겼어요 — 고양이가 추격을 포기해요","fish");
      clearWarnSoon(2200);
    }
  }

  G.pending={next:next,ev:ev,t0:performance.now(),arc:arc};
  G.mode="anim"; G.fishMode=false; G.fishKind=null; G.fishAim=null;
  if(action.t==="move") sTap();
  updateHUD();
}
function finishTurn(){
  var p=G.pending;
  if(!p) return;
  G.pending=null;
  var caught=false, goal=false;
  for(var e=0;e<p.ev.length;e++){
    if(p.ev[e].k==="caught") caught=true;
    if(p.ev[e].k==="goal") goal=true;
  }
  if(caught){
    sCatch();
    var stEl=$("stage"); stEl.classList.remove("shake"); void stEl.offsetWidth; stEl.classList.add("shake");
    G.mode="caught";
    /* 전체 화면 모달 없이 보드를 그대로 보여 주고, 결과만 짧게 안내 */
    setWarn("😿 잡혔어요 — ↩ 취소 [U] 또는 ↻ 리셋 [R]","bad");
    updateHUD();
    return;
  }
  G.st.turn++;
  if(goal){
    sGoal();
    updateHUD();
    if(G.stageIdx>=STAGES.length-1){
      G.mode="win";
      G.panelTimer=setTimeout(function(){ G.panelTimer=null; if(G.mode==="win") showPanel(winPanel); },700);
    }else{
      G.mode="clear";
      G.panelTimer=setTimeout(function(){ G.panelTimer=null; if(G.mode==="clear") showPanel(clearPanel); },700);
    }
    return;
  }
  if(G.st.turn>G.st.maxTurns){
    /* 턴 초과 = 실패. 잡힌 것과 같은 처리: 마지막 수를 취소하거나 스테이지를 리셋할 수 있어요 */
    G.mode="caught";
    setWarn("⏳ 턴이 다 됐어요 — ↩ 취소 [U] 또는 ↻ 리셋 [R]","bad");
    updateHUD();
    return;
  }
  G.mode="play";
  setWarn("");
  computeDanger(); updateHUD();
}
function undo(){
  if(G.pending) return;
  if(!G.undoStack.length) return;
  if(G.mode!=="play"&&G.mode!=="caught") return;
  var snap=G.undoStack.pop();
  G.st=snap.st; G.playerDir=snap.dir;
  G.st.player.rx=G.st.player.x; G.st.player.ry=G.st.player.y;
  for(var i=0;i<G.st.cats.length;i++){ var c=G.st.cats[i]; c.rx=c.x; c.ry=c.y; c.alertT=0; }
  if(G.panelTimer){ clearTimeout(G.panelTimer); G.panelTimer=null; }
  hidePanel();
  G.mode="play"; G.fishMode=false; G.fishKind=null; G.fishAim=null;
  sUndo();
  setWarn("↩ 한 수 되돌렸어요");
  clearWarnSoon(1400);
  computeDanger(); updateHUD();
}
function resetStage(){
  if(G.pending) return;
  if(G.mode!=="play"&&G.mode!=="caught") return;
  if(G.panelTimer){ clearTimeout(G.panelTimer); G.panelTimer=null; }
  hidePanel();
  var idx=G.stageIdx;
  loadStage(idx);
  G.mode="play";
  sReset();
  setWarn("이 방을 처음부터 다시 시작했어요");
  clearWarnSoon(1600);
  updateHUD();
}

cvEl.addEventListener("pointerdown",function(e){
  if(G.mode!=="play"||G.pending) return;
  var r=cvEl.getBoundingClientRect();
  var tx=Math.floor((e.clientX-r.left)/r.width*N);
  var ty=Math.floor((e.clientY-r.top)/r.height*N);
  if(tx<0||ty<0||tx>=N||ty>=N) return;
  if(G.fishMode){
    var ft=validFishTiles();
    for(var i=0;i<ft.length;i++){
      if(ft[i].x===tx&&ft[i].y===ty){ beginTurn({t:"fish",x:tx,y:ty,kind:G.fishKind}); return; }
    }
    setWarn("그곳에는 던질 수 없어요 (상하좌우 직선 2칸 · 장애물 불가)","fish");
    return;
  }
  var vm=G.moveTiles&&G.moveTiles.length?G.moveTiles:validMoves();
  for(var j=0;j<vm.length;j++){
    if(vm[j].x===tx&&vm[j].y===ty){ beginTurn({t:"move",x:tx,y:ty,dir:vm[j].dir}); return; }
  }
  /* 못 가는 칸을 콕 찍었을 때: 고양이라면 이유를 알려 준다 */
  for(var ci=0;ci<G.st.cats.length;ci++){
    if(G.st.cats[ci].x===tx&&G.st.cats[ci].y===ty){
      if(vm.length===0){
        setWarn("갈 수 있는 칸이 없어요 · ↩ 취소로 되돌아가세요","bad");
      }else{
        setWarn("고양이가 길을 막고 있어요 · 생선으로 유인해 보세요","fish");
      }
      clearWarnSoon(1900);
      return;
    }
  }
  if(vm.length===0){ setWarn("갈 수 있는 칸이 없어요 · ↩ 취소로 되돌아가세요","bad"); clearWarnSoon(1900); }
});
$("bUndo").addEventListener("click",function(){ undo(); });
$("bReset").addEventListener("click",function(){ resetStage(); });
/* 생선 버튼 3개: 개수를 보여 주고, 1개 이상이면 눌러서 던지기 모드 */
function initFishButtons(){
  var bs=document.querySelectorAll("#fishbar button");
  for(var i=0;i<bs.length;i++){
    (function(el){
      var kind=el.getAttribute("data-kind");
      FBTN[kind]={el:el,num:el.querySelector(".n")};
      el.addEventListener("click",function(){ toggleFishMode(kind); });
    })(bs[i]);
  }
}
function toggleFishMode(kind){
  if(G.mode!=="play"||G.pending) return;
  if((G.st.inv[kind]||0)<=0){
    setWarn(KIND[kind].label+"이(가) 아직 없어요 · 바닥에 떨어진 생선을 밟아서 주우세요","fish");
    clearWarnSoon(2100);
    return;
  }
  G.fishAim=null;
  if(G.fishMode&&G.fishKind===kind){ G.fishMode=false; G.fishKind=null; setWarn(""); }
  else{
    G.fishMode=true; G.fishKind=kind;
    setWarn(KIND[kind].label+"을(를) 던질 칸을 누르세요 · 유인 사거리 "+KIND[kind].lure+"칸","fish");
  }
  updateHUD();
}

/* ================= 키보드 조준 · 투척 ================= */
/* 이 방향으로 던질 수 있는 칸들 (가까운 칸부터) */
function fishAimOptions(d){
  if(!G.st||!G.st.player) return [];
  var p=G.st.player, ft=validFishTiles(), out=[];
  for(var step=1;step<=FISH_RANGE;step++){
    var x=p.x+DIRS[d][0]*step, y=p.y+DIRS[d][1]*step;
    for(var i=0;i<ft.length;i++){
      if(ft[i].x===x&&ft[i].y===y) out.push({x:x,y:y,dir:d,step:step});
    }
  }
  return out;
}
/* 방향키/WASD로 조준: 처음엔 1칸, 같은 방향을 한 번 더 누르면 2칸으로 토글 */
function aimFishDir(d){
  var opts=fishAimOptions(d);
  if(!opts.length){
    setWarn("그 방향에는 던질 칸이 없어요 (상하좌우 직선 2칸 · 장애물 불가)","fish");
    clearWarnSoon(1700);
    return false;
  }
  var pick=opts[0], prev=G.fishAim;
  if(prev&&prev.dir===d){
    for(var i=0;i<opts.length;i++){ if(opts[i].step!==prev.step){ pick=opts[i]; break; } }
  }
  G.fishAim={x:pick.x,y:pick.y,dir:pick.dir,step:pick.step};
  setWarn("🎯 "+KIND[G.fishKind].label+" 조준 "+pick.step+"칸 · Enter/Space로 투척","fish");
  return true;
}
function clearFishAim(){ G.fishAim=null; }
/* 조준한 칸에 먹이를 던진다 */
function throwAimedFish(){
  if(G.mode!=="play"||G.pending) return false;
  if(!G.fishMode||!G.fishAim) return false;
  var a=G.fishAim, ft=validFishTiles(), ok=false;
  for(var i=0;i<ft.length;i++){ if(ft[i].x===a.x&&ft[i].y===a.y) ok=true; }
  if(!ok){ clearFishAim(); return false; }
  beginTurn({t:"fish",x:a.x,y:a.y,kind:G.fishKind});
  return true;
}

function arrowDirOf(key){
  if(key==="ArrowUp"||key==="w"||key==="W") return 0;
  if(key==="ArrowRight"||key==="d"||key==="D") return 1;
  if(key==="ArrowDown"||key==="s"||key==="S") return 2;
  if(key==="ArrowLeft"||key==="a"||key==="A") return 3;
  return -1;
}
function isEnterKey(e){ return e.key==="Enter"||e.key===" "||e.key==="Spacebar"||e.code==="Space"; }

document.addEventListener("keydown",function(e){
  /* Ctrl/Cmd/Alt 조합은 브라우저 단축키라서 건드리지 않아요 */
  if(e.ctrlKey||e.metaKey||e.altKey) return;
  var k=e.key;
  /* 스크롤 · 뒤로가기 같은 브라우저 기본 동작 막기 */
  if(k==="ArrowUp"||k==="ArrowRight"||k==="ArrowDown"||k==="ArrowLeft"||k===" "||k==="Spacebar"||k==="Backspace"||e.code==="Space") e.preventDefault();
  var enter=isEnterKey(e);

  /* ---- 오버레이 패널 ---- */
  if(G.mode==="title"){ if(enter) startGame(); return; }
  if(G.mode==="clear"){ if(enter) nextStage(); return; }
  if(G.mode==="win"){ if(enter) restartFromStart(); return; }
  if(G.mode==="caught"){
    if(enter||k==="u"||k==="U"||k==="z"||k==="Z"||k==="Backspace") undo();
    else if(k==="r"||k==="R") resetStage();
    return;
  }

  /* ---- ↩ 취소 · ↻ 리셋 ---- */
  if(k==="u"||k==="U"||k==="z"||k==="Z"||k==="Backspace"){ undo(); return; }
  if(k==="r"||k==="R"){ resetStage(); return; }

  /* ---- 먹이 선택 (1/2/3, 누를 때마다 조준 초기화) ---- */
  if(k==="1"||k==="2"||k==="3"){ toggleFishMode(FISH_ORDER[parseInt(k,10)-1]); return; }

  /* ---- Escape: 먹이 모드 해제 → 플레이 중이면 리셋 ---- */
  if(k==="Escape"){
    if(G.fishMode){ G.fishMode=false; G.fishKind=null; clearFishAim(); setWarn(""); updateHUD(); }
    else if(G.mode==="play"){ resetStage(); }
    return;
  }

  if(G.mode!=="play"||G.pending) return;

  /* ---- 조준한 칸에 투척 ---- */
  if(enter){ throwAimedFish(); return; }

  /* ---- 이동 / 먹이 모드에서는 조준 ---- */
  var d=arrowDirOf(k);
  if(d<0) return;
  if(G.fishMode){ aimFishDir(d); return; }
  var vm=validMoves();
  for(var i=0;i<vm.length;i++){ if(vm[i].dir===d){ beginTurn({t:"move",x:vm[i].x,y:vm[i].y,dir:d}); return; } }
});

/* ================= 패널 ================= */
function showPanel(fn){ var ov=$("overlay"), p=$("panel"); p.innerHTML=""; fn(p); ov.classList.remove("hidden"); }
function hidePanel(){ $("overlay").classList.add("hidden"); }
/* 패널 버튼 동작 — 터치/클릭과 키보드(Enter·Space·u·z·r)가 같은 함수를 씁니다 */
function startGame(){ hidePanel(); G.mode="play"; G.stageIdx=0; loadStage(0); setWarn(""); beep(600,0.1,"triangle",0.05,200); }
function nextStage(){ if(G.stageIdx>=STAGES.length-1) return; hidePanel(); G.stageIdx++; G.mode="play"; loadStage(G.stageIdx); setWarn(""); }
function restartFromStart(){ hidePanel(); G.stageIdx=0; G.mode="play"; loadStage(0); setWarn(""); }
function titlePanel(p){
  p.innerHTML='<canvas id="pCat" width="200" height="112"></canvas>'+
  '<div id="tSub">TACTICAL STEALTH PUZZLE</div><h2 id="tTitle">TINY &amp; PAWS</h2>'+
  '<div style="font-size:13px;font-weight:800;color:#cbbfae;margin-bottom:10px;">작은 인간과 거대 고양이</div>'+
  '<button id="pStart">시작하기 🐾<span class="kc">Enter</span></button>';
  /* 타이틀 아트도 게임과 같은 대기모션으로 살아 있게: 패널이 떠 있는 동안 매 프레임 다시 그려요.
     고양이마다 id를 다르게 줘서 idle↔idle2 전환 타이밍이 어긋나요(게임 내와 같은 규칙). */
  function paintTitleArt(){
    var cc=document.getElementById("pCat"); if(!cc) return;   /* 패널이 닫히면 루프 종료 */
    var gg=cc.getContext("2d"); gg.imageSmoothingEnabled=false;
    gg.clearRect(0,0,cc.width,cc.height);
    var now=performance.now();
    /* 사람도 고양이와 같은 스케일(64px 프레임, 인게임과 동일)로 직접 그려요 */
    drawHuman(gg,{rx:(34-20)/40,ry:(106-37)/40},now,2,false);
    /* 고양이 3종 라인업: A 고정 감시 · B 교대 감시 · C 순회 — 각자 idle/idle2 교대 + 숨쉬기 밥 */
    drawCatAt(gg,88,106,COATS.A,2,"A",now,{pose:catIdlePose({type:"A",id:0},now),noShadow:false,scale:1.0,seed:0});
    drawCatAt(gg,130,106,COATS.B,2,"B",now,{pose:catIdlePose({type:"B",id:1},now),noShadow:false,scale:1.0,seed:750});
    drawCatAt(gg,172,106,COATS.C,2,"C",now,{pose:catIdlePose({type:"C",id:2},now),noShadow:false,scale:1.0,seed:1500});
    requestAnimationFrame(paintTitleArt);
  }
  paintTitleArt();
  $("pStart").addEventListener("click",startGame);
}
function clearPanel(p){
  p.innerHTML='<div class="big">🎉</div><h2>탈출 성공!</h2><p>'+(G.stageIdx+1)+'번째 방을 무사히 빠져나왔어요.<br>다음 방에는 더 예민한 고양이가 있어요…</p><button id="pNext">다음 방으로 →<span class="kc">Enter</span></button>';
  $("pNext").addEventListener("click",nextStage);
}
function winPanel(p){
  p.innerHTML='<div class="big">🏆</div><h2>완탈출!</h2><p>10개의 방을 모두 통과했어요.<br>당신은 최고의 잠입가… 고양이는 아직 모릅니다.</p><button id="pAgain">처음부터 다시 🐾<span class="kc">Enter</span></button>';
  $("pAgain").addEventListener("click",restartFromStart);
}

/* ================= 리사이즈 ================= */
function resize(){
  var st=$("stage");
  var availW=st.clientWidth-6;
  var warnH=$("warn").offsetHeight+8;
  var availH=st.clientHeight-warnH-6;
  var fit=Math.min(availW,availH,470);
  fit=Math.max(fit,180);
  var dpr=Math.min(3,Math.max(1,window.devicePixelRatio||1));
  /* 화면에는 1도트 = 1 CSS px로 보여주고, 백킹은 dpr만큼 키운다 */
  var cssW=Math.min(Math.floor(fit),CV);
  var back=Math.max(CV,Math.round(cssW*dpr));
  cvEl.width=back; cvEl.height=back;
  cvEl.style.width=cssW+"px"; cvEl.style.height=cssW+"px";
  dctx.imageSmoothingEnabled=false;
}

/* ================= 시작 ================= */
window.addEventListener("resize",resize);
initFishButtons();
loadStage(0);
G.mode="title";
resize();
showPanel(titlePanel);
updateHUD();
requestAnimationFrame(loop);
