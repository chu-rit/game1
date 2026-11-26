"use strict";
var DPADBTNS=[];   /* 하단 역T자 방향키 버튼 ({el,dir}) */
/* 인벤토리: 고정 3종 버튼이 아니라 5칸 슬롯 — G.st.inv 에 있는 아이템만 앞 칸부터 채워져요 */
var INVCAP=5;      /* 인벤토리 슬롯 수 (키보드 1~5 와 1:1) */
var INV=[];        /* 슬롯 DOM ({el,em,nm,n,kind}) 최대 5칸 */
var INVSIG="";     /* 지금 슬롯에 그려진 아이템 순서 — 바뀔 때만 다시 그려요 */
var TIP={open:false,t0:0};   /* 아이템 상세 정보 카드 상태 */
var LP={timer:0,fired:false,idx:-1,x:0,y:0}, LP_MS=400;   /* 슬롯 길게 누르기 */
/* ================= 인벤토리 (주운 아이템만 슬롯에) ================= */
/* 지금 들고 있는 아이템 종류를 슬롯 순서대로 — 데이터의 기본 순서(FISH_ORDER) 먼저,
   나중에 늘어난 종류가 있으면 뒤에 붙여요. UI가 3종에 고정되지 않게. */
function invKinds(){
  var inv=(G.st&&G.st.inv)||{}, out=[], k;
  for(var i=0;i<FISH_ORDER.length;i++){ k=FISH_ORDER[i]; if((inv[k]||0)>0) out.push(k); }
  for(k in inv){
    if(!inv.hasOwnProperty(k)) continue;
    if((inv[k]||0)<=0) continue;
    if(FISH_ORDER.indexOf(k)>=0) continue;
    out.push(k);
  }
  return out;
}
function foodInfoOf(kd){
  var f=FOOD_INFO[kd];
  if(f) return f;
  var kk=KIND[kd];   /* 데이터에 설명이 없어도 이름은 알 수 있게 */
  return {em:"🍽️",name:kk?kk.label:kd,tag:"",rows:[],tip:""};
}
/* 먹이 아이콘: 보드와 같은 도트 스프라이트(FOODICON=FOODSPR 여백 제거본)를 <img>로.
   스프라이트가 없는 종류만 이모지로 대신해요. */
function foodIconHtml(k){
  var b=(typeof FOODICON!=="undefined"&&FOODICON[k])||(typeof FOODSPR!=="undefined"&&FOODSPR[k]);
  if(b) return '<img class="sp-ic" src="data:image/png;base64,'+b+'" alt="" draggable="false">';
  var f=foodInfoOf(k);
  return f.em||"";
}
/* 슬롯 그리기: 구성(어떤 아이템이 몇 번째 칸에)이 바뀔 때만 다시 채워요 */
function renderInv(inv,busy){
  var kinds=invKinds(), sig=kinds.join("|"), i;
  if(sig!==INVSIG){
    INVSIG=sig;
    for(i=0;i<INV.length;i++){
      var s=INV[i], kd=kinds[i]||null;
      s.kind=kd;
      if(kd){
        var info=foodInfoOf(kd);
        s.el.classList.remove("empty","on");
        s.em.innerHTML=foodIconHtml(kd); s.nm.textContent=info.name;
        s.el.setAttribute("aria-label",info.name+" "+((inv[kd]||0))+"개 · 길게 누르면 설명");
      }else{
        s.el.classList.add("empty");
        s.el.classList.remove("on");
        s.em.textContent=""; s.nm.textContent="";
        s.el.setAttribute("aria-label","빈 인벤토리 슬롯 "+(i+1));
      }
    }
  }
  for(i=0;i<INV.length;i++){
    var sl=INV[i], k=sl.kind;
    if(k){
      sl.n.textContent="×"+((inv[k]||0));
      sl.el.disabled=busy||G.mode!=="play";
      sl.el.classList.toggle("on",!!G.fishMode&&G.fishKind===k);
    }else{
      sl.n.textContent="";
      sl.el.disabled=false;
      sl.el.classList.remove("on");
    }
  }
  /* 획득 애니메이션은 슬롯이 새로 그려진 뒤에 */
  if(G.gainPend){
    var pk=G.gainPend; G.gainPend=null;
    for(i=0;i<INV.length;i++){
      if(INV[i].kind===pk){ var el=INV[i].el; el.classList.remove("gain"); void el.offsetWidth; el.classList.add("gain"); break; }
    }
  }
}
/* 아이템 상세 정보 카드 */
function showItemTip(idx){
  var s=INV[idx];
  if(!s||!s.kind) return;
  var info=foodInfoOf(s.kind), n=(G.st.inv[s.kind]||0), rows="";
  for(var i=0;i<info.rows.length;i++){
    rows+='<div class="trow"><span class="tk">'+info.rows[i][0]+'</span><span class="tv">'+info.rows[i][1]+'</span></div>';
  }
  $("tipEm").innerHTML=foodIconHtml(s.kind);
  $("tipNm").textContent=info.name;
  $("tipTag").textContent=info.tag||"";
  $("tipTag").style.display=info.tag?"":"none";
  $("tipQty").textContent="보유 "+n+"개";
  $("tipQty").style.display="";
  $("tipBody").innerHTML=rows+(info.tip?'<div class="tnote">'+info.tip+'</div>':"")+
    (info.rule?'<div class="tnote trule">'+info.rule+'</div>'
              :(typeof FOOD_TIP==="string"?'<div class="tnote trule">'+FOOD_TIP+'</div>':""));
  $("itemTip").classList.remove("hidden");
  TIP.open=true; TIP.t0=performance.now();
  sBeepTip();
}
function hideItemTip(){
  if(!TIP.open) return;
  TIP.open=false;
  $("itemTip").classList.add("hidden");
}
/* 고양이 아이콘: 보드와 같은 도트 스프라이트(CATSPR) — 지금 상태(먹는 중이면 eat)와
   바라보는 방향 그대로 <img>로 보여 줘요. */
function catIconHtml(cat){
  var sp=(typeof CATSPR!=="undefined"&&CATSPR[cat.type]);
  var pose=sp&&((cat.state==="eat"&&sp.eat)?sp.eat:sp.idle);
  var b=pose&&(pose[cat.dir]!=null?pose[cat.dir]:pose[2]);
  if(b) return '<img class="sp-ic" src="data:image/png;base64,'+b+'" alt="" draggable="false">';
  return "🐈";
}
/* 고양이 상세 정보 카드 — 고양이가 있는 칸을 콕 찍으면 떠요 (아이템 카드와 같은 틀) */
var CAT_STATE_LABEL={ idle:"경계 중", chase:"추격 중 — 도망가세요!", "return":"자리로 돌아가는 중",
                      lured:"먹이 냄새를 따라가는 중", eat:"먹는 중 — 시야·기척이 닫혀 있어요" };
function showCatTip(cat){
  var info=(typeof CAT_INFO!=="undefined"&&CAT_INFO[cat.type])||{name:"고양이",tag:"",rows:[],tip:""};
  var all=[["지금 상태",CAT_STATE_LABEL[cat.state]||cat.state],
           ["바라보는 방향",["위 ↑","오른쪽 →","아래 ↓","왼쪽 ←"][cat.dir]||"-"]].concat(info.rows);
  var rows="";
  for(var i=0;i<all.length;i++){
    rows+='<div class="trow"><span class="tk">'+all[i][0]+'</span><span class="tv">'+all[i][1]+'</span></div>';
  }
  $("tipEm").innerHTML=catIconHtml(cat);
  $("tipNm").textContent=info.name;
  $("tipTag").textContent=info.tag||"";
  $("tipTag").style.display=info.tag?"":"none";
  $("tipQty").textContent="";
  $("tipQty").style.display="none";
  $("tipBody").innerHTML=rows+(info.tip?'<div class="tnote">'+info.tip+'</div>':"");
  $("itemTip").classList.remove("hidden");
  TIP.open=true; TIP.t0=performance.now();
  sBeepTip();
}
/* 게임에서 한 번이라도 주워 본 아이템 종류 — 첫 습득 때 자동으로 정보창을 띄워요 */
function itemSeenSet(){
  try{ return JSON.parse(localStorage.getItem("cat-seen-items")||"{}"); }catch(e){ return {}; }
}
function markItemSeen(kind){
  try{ var s=itemSeenSet(); s[kind]=1; localStorage.setItem("cat-seen-items",JSON.stringify(s)); }catch(e){}
}
function sBeepTip(){ if(typeof beep==="function") beep(720,0.06,"sine",0.035,0); }

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
  renderInv(inv,busy);
  $("bUndo").disabled=busy||G.undoStack.length===0||!live;
  $("bReset").disabled=busy||!live;
  $("sPrev").disabled=G.stageIdx<=0;
  $("sNext").disabled=G.stageIdx>=STAGES.length-1;
  /* 하단 방향키·🎯 버튼 상태: 플레이 중이 아니면 전부 잠그고, 이동 가능한 방향만 밝게 */
  var ready=(G.mode==="play")&&!G.pending;
  var tired=(G.st&&G.st.stam<=0&&anyChasing());
  var vm=ready?validMoves():[];
  var canDir={};
  if(ready){
    if(G.fishMode||tired){ canDir={0:1,1:1,2:1,3:1}; }   /* 조준 중·지침 상태에선 네 방향 모두 열어 둬요 */
    else { for(var mi=0;mi<vm.length;mi++) canDir[vm[mi].dir]=1; }
  }
  for(var di=0;di<DPADBTNS.length;di++){
    var db=DPADBTNS[di];
    db.el.disabled=!ready||!canDir[db.dir];
    db.el.classList.toggle("aim",!!(G.fishMode&&G.fishAim&&G.fishAim.dir===db.dir));
  }
  var bw=$("bWait");
  /* 오른쪽 위 칸(🎯 투척)은 먹이 조준 중에만 등장 — 평소엔 빈 칸인 역T자 방향키 */
  bw.classList.toggle("hidden",!G.fishMode);
  bw.disabled=!ready;
  bw.classList.toggle("aimed",!!(G.fishMode&&G.fishAim));
  /* 잡혔을 때는 패널 없이 보드를 본 채로, 취소 버튼에만 은은한 강조 */
  $("bUndo").classList.toggle("hot",G.mode==="caught");
  /* 지구력 게이지는 보드 위 플레이어 머리 위에 도트로 그려요 (drawStamGauge — view.js) */
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
function anyChasing(){
  if(!G.st) return false;
  for(var i=0;i<G.st.cats.length;i++){ if(G.st.cats[i].state==="chase") return true; }
  return false;
}
function validMoves(){
  if(!G.st||!G.st.player) return [];
  var p=G.st.player, out=[];
  for(var d=0;d<4;d++){
    var nx=p.x+DIRS[d][0], ny=p.y+DIRS[d][1];
    if(canPlayerMoveTo(G.st,nx,ny)) out.push({x:nx,y:ny,dir:d});
  }
  return out;
}
function validFishTiles(){
  /* 상하좌우 직선으로 선택한 먹이의 사거리(range)까지만 · 대각선 불가 · 장애물(벽/가구/고양이/다른 생선/아직 줍지 않은 생선)을 만나면 그 방향은 거기서 끊김 */
  var p=G.st.player, out=[];
  var free=function(x,y){
    /* 벽·가구·구멍(H)은 넘지 못해요. 고양이 발판(^)에는 던져서 떨어뜨릴 수 있어요. */
    if(!catWalkable(G.st,x,y)) return false;
    for(var i=0;i<G.st.cats.length;i++){ if(G.st.cats[i].x===x&&G.st.cats[i].y===y) return false; }
    for(var fi=0;fi<G.st.fishes.length;fi++){ if(G.st.fishes[fi].x===x&&G.st.fishes[fi].y===y) return false; }
    for(var pi=0;pi<G.st.pickups.length;pi++){ if(G.st.pickups[pi].x===x&&G.st.pickups[pi].y===y) return false; }
    return true;
  };
  /* 낮은 장애물(그루터기 등 rule:"low")은 던진 먹이가 넘어가요 — 착지는 못 해요 */
  var low=function(x,y){
    var ft=FOREST_TILES[tileAt(G.st,x,y)];
    return !!(ft&&ft.rule==="low");
  };
  var rng=fishRange();
  for(var d=0;d<4;d++){
    for(var step=1;step<=rng;step++){
      var x=p.x+DIRS[d][0]*step, y=p.y+DIRS[d][1]*step;
      if(low(x,y)) continue;            /* 그루터기 위로 날아감 — 멈추지도 착지도 안 해요 */
      if(!free(x,y)) break;
      out.push({x:x,y:y});
    }
  }
  return out;
}
/* 선택한 먹이의 던지기 사거리 — 종류별 KIND.range (없으면 기본 FISH_RANGE) */
function fishRange(){ var k=KIND[G.fishKind]; return (k&&k.range!=null)?k.range:FISH_RANGE; }
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
  if(action.t==="move"&&!canPlayerMoveTo(G.st,action.x,action.y)) return;
  hideItemTip();
  var snap={st:cloneState(G.st),dir:G.playerDir};
  var next=cloneState(G.st), ev=[];
  simStep(next,action,ev);

  G.undoStack.push(snap);
  if(G.undoStack.length>UNDO_MAX) G.undoStack.shift();

  var st=G.st;
  if(action.t==="move") G.playerDir=action.dir;
  else if(action.t==="fish") G.playerDir=dirFromTo({x:st.player.x,y:st.player.y,dir:G.playerDir},{x:action.x,y:action.y});
  /* 수풀(rule:"hide") 진입·이탈 시 덤불이 바스락 흔들려요 — 나오는 칸과 들어가는 칸 둘 다 기록.
     구운 보드에는 정적 덤불이 남아 있으니, 그 칸을 뺀 채로 다시 구워서 이중 표시를 막아요 */
  var shkOut=null;
  if(action.t==="move"){
    var fFrom=FOREST_TILES[tileAt(st,st.player.x,st.player.y)];
    if(fFrom&&fFrom.rule==="hide") shkOut=st.player.x+","+st.player.y;
  }
  st.player.x=next.player.x; st.player.y=next.player.y;
  if(action.t==="move"){
    var fTo=FOREST_TILES[tileAt(st,st.player.x,st.player.y)];
    var shkIn=(fTo&&fTo.rule==="hide")?st.player.x+","+st.player.y:null;
    if(shkOut||shkIn){
      if(!G.bushShake) G.bushShake={};
      var bT=performance.now();
      if(shkOut) G.bushShake[shkOut]={t0:bT};
      if(shkIn) G.bushShake[shkIn]={t0:bT};
      bakeBoard(st);
    }
  }
  st.inv=next.inv; st.pickups=next.pickups; st.fishes=next.fishes; st.stam=next.stam;
  for(var i=0;i<st.cats.length;i++){
    var c=st.cats[i], nc=next.cats[i];
    c.x=nc.x; c.y=nc.y; c.dir=nc.dir; c.state=nc.state; c.lure=nc.lure;
    c.chaseSteps=nc.chaseSteps; c.pi=nc.pi; c.psign=nc.psign; c.freezeT=nc.freezeT;
    c.lureMem=nc.lureMem; c.lureTgt=nc.lureTgt; c.lureWait=nc.lureWait;
    c.crouch=nc.crouch; c.jump=null;
  }

  var arc=null, firstPickupKind=null, jumpPend=false;
  setWarn("");   /* 이번 턴 안내 문구를 먼저 지우고, 사건(줍기·연쇄)이 있으면 그걸 띄워요 */
  for(var e=0;e<ev.length;e++){
    var v=ev[e];
    if(v.k==="fish"){ arc={from:{x:snap.st.player.x,y:snap.st.player.y},to:{x:v.x,y:v.y},kind:v.kind,t0:performance.now()}; sFish(); }
    else if(v.k==="spot"){ var cat=catById(v.id); if(cat) cat.alertT=performance.now(); sSpot(); }
    else if(v.k==="pickup"){
      G.fx.push({kind:v.kind,x:v.x,y:v.y,t0:performance.now()});
      G.gainPend=v.kind;
      sPickup();
      if(!itemSeenSet()[v.kind]){ markItemSeen(v.kind); firstPickupKind=v.kind; }
      setWarn(KIND[v.kind].label+"을(를) 주웠어요! 아래 슬롯을 눌러 "+
        ((KIND[v.kind]&&KIND[v.kind].use==="wait")?"먹기 · 길게 누르면 설명":"던지기 · 길게 누르면 설명"),"fish");
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
      var hcat=catById(v.id); if(hcat) hcat.qT=performance.now();
      sHide();
      setWarn("🌿 수풀에 몸을 숨겼어요 — 고양이가 추격을 포기해요","fish");
      clearWarnSoon(2200);
    }
    else if(v.k==="lost"){
      var lcat=catById(v.id); if(lcat) lcat.qT=performance.now();
      sHide();
      setWarn("고양이가 놓쳤어요 — 추격을 포기해요","fish");
      clearWarnSoon(2000);
    }
    else if(v.k==="rest"){ setWarn("😮‍💨 제자리에서 숨을 골라요…","fish"); clearWarnSoon(1500); }
    else if(v.k==="jump"){
      /* 쿠키의 3칸 도약 — view 가 시작점→착지점을 포물선으로 그려요(G.pending 동안) */
      var jcat=catById(v.id);
      if(jcat){
        jcat.jump={fromX:v.fromX,fromY:v.fromY,toX:v.toX,toY:v.toY};
        jcat.rx=v.fromX; jcat.ry=v.fromY;
        jumpPend=true;
      }
    }
    else if(v.k==="choco"){
      sChoco();
      /* 플레이어 위에서 부스러기가 톡 터지듯 (view.js drawBiteFx) — 먹은 자리는 이동 전 좌표 */
      var eatPos=snap.st.player;
      G.bites.push({x:eatPos.x,y:eatPos.y,t0:performance.now()});
      setWarn("🍫 초콜릿을 먹고 한 턴을 보냈어요","fish");
      clearWarnSoon(1600);
    }
  }

  G.pending={next:next,ev:ev,t0:performance.now(),arc:arc,dur:jumpPend?JUMP_ANIM_MS:0};
  G.mode="anim"; G.fishMode=false; G.fishKind=null; G.fishAim=null;
  if(action.t==="move") sTap();
  updateHUD();
  /* 처음 주운 아이템이면 주운 즉시 상세 정보창을 띄워요 (인벤토리 슬롯이 갱신된 뒤라 인덱스를 찾을 수 있어요) */
  if(firstPickupKind){
    for(var fi=0;fi<INV.length;fi++){
      if(INV[fi].kind===firstPickupKind){ showItemTip(fi); break; }
    }
  }
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
    setWarn("😿 잡혔어요 — 취소 [U] 또는 리셋 [R]","bad");
    updateHUD();
    return;
  }
  G.st.turn++;
  if(goal){
    /* 클리어 타임: 출구로 들어선 순간(이번 턴을 시작한 시각)에 멈춰요.
       턴 애니메이션과 아래 출구 점프 0.7초 연출은 시간에 들어가지 않아요. */
    G.clearMs=Math.max(0, p.t0-G.tT0);
    /* 바로 클리어 창을 띄우지 않고, 점프 → 구멍 속으로 '뽕' 연출을 먼저 재생해요.
       (연출이 끝난 뒤 startExitAnim 이 클리어/완탈출 창을 띄웁니다) */
    updateHUD();
    startExitAnim(G.stageIdx>=STAGES.length-1?"win":"clear");
    return;
  }
  if(G.st.turn>G.st.maxTurns){
    /* 턴 초과 = 실패. 잡힌 것과 같은 처리: 마지막 수를 취소하거나 스테이지를 리셋할 수 있어요 */
    G.mode="caught";
    setWarn("⏳ 턴이 다 됐어요 — 취소 [U] 또는 리셋 [R]","bad");
    updateHUD();
    return;
  }
  G.mode="play";
  setWarn("");
  if(G.st.stam<=0&&anyChasing()) setWarn("😮‍💨 지쳤어요! 이번 턴은 제자리에서 쉬어야 해요","bad");
  computeDanger(); updateHUD();
}
/* ================= 출구 도착 연출 (view.js 가 G.exit 를 보고 그려요) =================
   클리어 판정은 model.js 의 simStep 그대로 — 여기서는 연출과 상태 전환만 맡아요.
   사람은 이미 출구 칸에 도착해 있어서, 그 자리에서 톡 튀어 올라 통나무 구멍으로 뽕 들어갑니다. */
function cancelExitAnim(){
  if(G.exitTimers&&G.exitTimers.length){
    for(var i=0;i<G.exitTimers.length;i++) clearTimeout(G.exitTimers[i]);
  }
  G.exitTimers=[]; G.exit=null;
}
function startExitAnim(finalMode){
  var st=G.st, pl=st.player, hp=exitHolePt(st.goal.x,st.goal.y);
  cancelExitAnim();
  G.exitTimers=[];
  G.exit={ t0:performance.now(), popT0:0,
           sx:pl.rx*CELL+CELL/2, sy:pl.ry*CELL+CELL-8,   /* 지금 발 위치에서 출발 */
           hx:hp.x, hy:hp.y };
  G.mode="exit";
  G.fishMode=false; G.fishKind=null; G.fishAim=null;
  sExitHop();
  /* 구멍에 들어가는 순간 '뽕' */
  G.exitTimers.push(setTimeout(function(){
    if(!G.exit||G.mode!=="exit") return;
    /* 이펙트 기준 시각은 연출 시작 시각에서 파생 — 타이머가 조금 늦어도 그림과 소리가 어긋나지 않아요 */
    G.exit.popT0=G.exit.t0+EXIT_ARC_MS;
    sExitPop();
  },EXIT_ARC_MS));
  /* 연출이 끝난 뒤 결과 창 */
  G.exitTimers.push(setTimeout(function(){
    G.exitTimers=[];
    if(!G.exit||G.mode!=="exit") return;
    G.mode=finalMode;
    sGoal();
    showPanel(finalMode==="win"?winPanel:clearPanel, finalMode);
    updateHUD();
  },EXIT_PANEL_MS));
  updateHUD();
}
function undo(){
  if(G.pending) return;
  if(!G.undoStack.length) return;
  if(G.mode!=="play"&&G.mode!=="caught") return;
  hideItemTip();
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
  cancelExitAnim();
  hideItemTip();
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
  var tx=Math.floor((e.clientX-r.left)/r.width*COLS);
  var ty=Math.floor((e.clientY-r.top)/r.height*ROWS);
  if(tx<0||ty<0||tx>=COLS||ty>=ROWS) return;
  if(G.fishMode){
    var ft=validFishTiles();
    for(var i=0;i<ft.length;i++){
      if(ft[i].x===tx&&ft[i].y===ty){ beginTurn({t:"fish",x:tx,y:ty,kind:G.fishKind}); return; }
    }
    setWarn("그곳에는 던질 수 없어요 (상하좌우 직선 "+fishRange()+"칸 · 장애물 불가)","fish");
    return;
  }
  /* 지침: 추격 중 지구력 0이면 화면 탭 = 제자리 대기 */
  if(G.st.stam<=0&&anyChasing()){ beginTurn({t:"wait"}); return; }
  var vm=G.moveTiles&&G.moveTiles.length?G.moveTiles:validMoves();
  for(var j=0;j<vm.length;j++){
    if(vm[j].x===tx&&vm[j].y===ty){ beginTurn({t:"move",x:tx,y:ty,dir:vm[j].dir}); return; }
  }
  /* 고양이가 있는 칸을 콕 찍으면: 아이템 카드처럼 고양이 상세 정보를 띄워요 */
  for(var ci=0;ci<G.st.cats.length;ci++){
    if(G.st.cats[ci].x===tx&&G.st.cats[ci].y===ty){ showCatTip(G.st.cats[ci]); return; }
  }
  if(vm.length===0){ setWarn("갈 수 있는 칸이 없어요 · 취소로 되돌아가세요","bad"); clearWarnSoon(1900); }
});
$("bUndo").addEventListener("click",function(){ this.blur(); undo(); });
$("bReset").addEventListener("click",function(){ this.blur(); resetStage(); });
/* 개발용 스테이지 넘기기 (‹ ›) — 앞뒤 자유 이동 */
function stageNav(d){
  var ni=G.stageIdx+d;
  if(ni<0||ni>=STAGES.length) return;
  cancelExitAnim();            /* 연출 타이머가 남아 다음 스테이지에 끼어들지 않게 */
  hidePanel(); G.stageIdx=ni; G.mode="play"; loadStage(ni); setWarn("");
}
$("sPrev").addEventListener("click",function(){ this.blur(); stageNav(-1); });
$("sNext").addEventListener("click",function(){ this.blur(); stageNav(1); });

/* ================= 하단 버튼 조작 ================= */
/* 방향키: 이동 / 먹이 조준 / 지침(지구력 0) 상태에선 제자리 대기 */
function pressDir(d){
  if(G.mode!=="play"||G.pending) return;
  if(G.st.stam<=0&&anyChasing()&&!G.fishMode){ beginTurn({t:"wait"}); return; }
  if(G.fishMode){ aimFishDir(d); return; }
  var vm=validMoves();
  for(var i=0;i<vm.length;i++){ if(vm[i].dir===d){ beginTurn({t:"move",x:vm[i].x,y:vm[i].y,dir:d}); return; } }
}
/* 🎯 버튼(먹이 모드에서만 표시): 조준한 칸에 투척. 일반 모드엔 보이지 않아요 */
function pressAction(){
  if(G.mode!=="play"||G.pending) return;
  if(!G.fishMode) return;
  if(G.fishAim){ throwAimedFish(); return; }
  setWarn("방향키로 던질 칸을 고르세요","fish");
  clearWarnSoon(1800);
}
function initDpad(){
  var bs=document.querySelectorAll("#dpad .dk");
  for(var i=0;i<bs.length;i++){
    (function(el){
      var d=parseInt(el.getAttribute("data-dir"),10);
      DPADBTNS.push({el:el,dir:d});
      el.addEventListener("click",function(){ el.blur(); pressDir(d); });
    })(bs[i]);
  }
  $("bWait").addEventListener("click",function(){ this.blur(); pressAction(); });
}
/* 인벤토리 슬롯 5칸
   - 짧게 터치/클릭: 그 칸의 아이템으로 던지기 모드 토글
   - 0.4초 길게 누르기(또는 우클릭): 아이템 상세 정보 카드 */
function lpAbort(){ if(LP.timer){ clearTimeout(LP.timer); LP.timer=0; } LP.idx=-1; }
function initInv(){
  var bs=document.querySelectorAll("#invbar .slot");
  for(var i=0;i<bs.length&&i<INVCAP;i++){
    (function(el,idx){
      var s={el:el,em:el.querySelector(".em"),nm:el.querySelector(".nm"),n:el.querySelector(".n"),kind:null};
      INV.push(s);
      el.addEventListener("pointerdown",function(e){
        if(el.disabled) return;
        if(e.pointerType==="mouse"&&e.button!==0) return;   /* 우클릭은 contextmenu 로 */
        lpAbort();
        LP.fired=false; LP.idx=idx; LP.x=e.clientX; LP.y=e.clientY;
        LP.timer=setTimeout(function(){
          LP.timer=0;
          if(LP.idx!==idx||!s.kind) return;   /* 빈 슬롯·앞 칸으로 옮긴 아이템은 무시 */
          LP.fired=true; LP.idx=-1;
          showItemTip(idx);
        },LP_MS);
      });
      el.addEventListener("pointermove",function(e){
        if(!LP.timer||LP.idx!==idx) return;
        if(Math.abs(e.clientX-LP.x)>10||Math.abs(e.clientY-LP.y)>10) lpAbort();   /* 스크롤·드래그로 보면 취소 */
      });
      el.addEventListener("pointerup",lpAbort);
      el.addEventListener("pointercancel",lpAbort);
      el.addEventListener("pointerleave",lpAbort);
      el.addEventListener("click",function(e){
        /* 방금 길게 눌러 카드가 떴으면 손을 뗄 때의 클릭은 무시 */
        if(LP.fired){ LP.fired=false; e.preventDefault(); return; }
        if(!s.kind){
          setWarn("빈 슬롯이에요 · 바닥의 먹이를 밟으면 이 자리에 들어와요","fish");
          clearWarnSoon(1900);
          return;
        }
        useItem(s.kind);
      });
      el.addEventListener("contextmenu",function(e){
        e.preventDefault();
        if(s.kind) showItemTip(idx);
      });
    })(bs[i],i);
  }
  /* 카드 바깥(배경)이나 ✕ 를 탭하면 닫기 — 새로 누르는 순간(pointerdown)에 닫아서
     길게 누르던 손가락을 떼는 동작으로는 닫히지 않게 */
  $("itemTip").addEventListener("pointerdown",function(){
    if((performance.now()-(TIP.t0||0))<180) return;
    hideItemTip();
  });
  $("tipCard").addEventListener("pointerdown",function(e){ e.stopPropagation(); });
  $("tipX").addEventListener("click",function(e){ e.stopPropagation(); hideItemTip(); });
}
/* 인벤토리 슬롯 사용 라우팅 — 생선·캣닢은 투척 조준 모드, 🍫 초콜릿은 조준 없이 바로 먹고 1턴 대기.
   슬롯 짧게 누르기와 키보드 1~5 가 모두 이 함수를 거칩니다. */
function useItem(kind){
  if(G.mode!=="play"||G.pending) return;
  if((G.st.inv[kind]||0)<=0){
    setWarn(KIND[kind].label+"이(가) 아직 없어요 · 바닥의 아이템을 밟아서 주우세요","fish");
    clearWarnSoon(2100);
    return;
  }
  var kd=KIND[kind];
  if(kd&&kd.use==="wait"){ beginTurn({t:"wait",kind:kind}); return; }
  toggleFishMode(kind);
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
    /* 캐릭터가 바라보는 방향의 앞 칸을 기본 조준으로 — 그쪽에 못 던지면 던질 수 있는 다른 방향을 자동 탐색 */
    if(!aimFishDir(G.playerDir)){
      for(var d2=0;d2<4;d2++){
        if(d2!==G.playerDir&&aimFishDir(d2)) break;
      }
    }
  }
  updateHUD();
}

/* ================= 키보드 조준 · 투척 ================= */
/* 이 방향으로 던질 수 있는 칸들 (가까운 칸부터) */
function fishAimOptions(d){
  if(!G.st||!G.st.player) return [];
  var p=G.st.player, ft=validFishTiles(), out=[];
  for(var step=1;step<=fishRange();step++){
    var x=p.x+DIRS[d][0]*step, y=p.y+DIRS[d][1]*step;
    for(var i=0;i<ft.length;i++){
      if(ft[i].x===x&&ft[i].y===y) out.push({x:x,y:y,dir:d,step:step});
    }
  }
  return out;
}
/* 방향키/WASD로 조준: 현재 표시된 칸을 커서로 움직여요 — 누른 방향 반평면에서 가장 가까운
   던질 칸으로 이동(같은 가로/세로축 우선). 그쪽 끝까지 가면 그 방향 광선의 안쪽 끝으로 돌아와요. */
function aimFishDir(d){
  var p=G.st.player, a=G.fishAim, pick=null;
  if(a){
    var ft=validFishTiles(), cand=[];
    for(var i=0;i<ft.length;i++){
      var t=ft[i];
      if(d===0&&t.y>=a.y) continue;
      if(d===2&&t.y<=a.y) continue;
      if(d===1&&t.x<=a.x) continue;
      if(d===3&&t.x>=a.x) continue;
      var ax=(d<2)?(t.x===a.x):(t.y===a.y);   /* 누른 방향 축과 같은 선상 우선 */
      cand.push({t:t,dist:Math.abs(t.x-a.x)+Math.abs(t.y-a.y),ax:ax?0:1});
    }
    cand.sort(function(u,v){ return u.ax-v.ax||u.dist-v.dist; });
    if(cand.length) pick=cand[0].t;
    else{
      var ray=fishAimOptions(d);
      if(ray.length) pick=ray[0];           /* 그 방향 끝이면 안쪽 끝으로 순환 */
    }
  }else{
    var opts=fishAimOptions(d);
    if(opts.length) pick=opts[0];
  }
  if(!pick){
    setWarn("그 방향에는 던질 칸이 없어요 (상하좌우 직선 "+fishRange()+"칸 · 장애물 불가)","fish");
    clearWarnSoon(1700);
    return false;
  }
  var dx=pick.x-p.x, dy=pick.y-p.y;
  var rd=dx>0?1:(dx<0?3:(dy>0?2:0));
  var stp=Math.abs(dx)+Math.abs(dy);
  G.fishAim={x:pick.x,y:pick.y,dir:rd,step:stp};
  setWarn("🎯 "+KIND[G.fishKind].label+" 조준 "+stp+"칸 · 오른쪽 위 🎯 버튼(Enter)으로 투척","fish");
  updateHUD();
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
  if(EDITOR_PLAYTEST&&!G.st) return;
  var k=e.key;
  /* 스크롤 · 뒤로가기 같은 브라우저 기본 동작 막기 */
  if(k==="ArrowUp"||k==="ArrowRight"||k==="ArrowDown"||k==="ArrowLeft"||k===" "||k==="Spacebar"||k==="Backspace"||e.code==="Space") e.preventDefault();
  var enter=isEnterKey(e);

  /* ---- 아이템 상세 카드: Escape 로만 닫고, 그동안 게임 입력은 막음 ---- */
  if(TIP.open){ if(k==="Escape") hideItemTip(); return; }

  /* ---- 오버레이 패널 ---- */
  if(G.mode==="title"){ if(enter) startGame(); return; }
  if(G.mode==="clear"){ if(enter) nextStage(); return; }
  if(G.mode==="win"){ if(enter) restartFromStart(); return; }
  if(G.mode==="exit") return;      /* 출구 연출 중에는 입력을 받지 않아요 */
  if(G.mode==="caught"){
    if(enter||k==="u"||k==="U"||k==="z"||k==="Z"||k==="Backspace") undo();
    else if(k==="r"||k==="R") resetStage();
    return;
  }

  /* ---- 취소(U) · 리셋(R) — 아이콘만 있는 버튼 ---- */
  if(k==="u"||k==="U"||k==="z"||k==="Z"||k==="Backspace"){ undo(); return; }
  if(k==="r"||k==="R"){ resetStage(); return; }

  /* ---- 인벤토리 슬롯 선택 (1~5 = 지금 그 칸에 있는 아이템, 누를 때마다 조준 초기화) ---- */
  if(k>="1"&&k<="5"&&k.length===1){
    var si=parseInt(k,10)-1, sslot=INV[si];
    if(sslot&&sslot.kind){ useItem(sslot.kind); }
    else{ setWarn("빈 슬롯이에요 · 바닥의 먹이를 밟으면 이 자리에 들어와요","fish"); clearWarnSoon(1900); }
    return;
  }

  /* ---- Escape: 먹이 모드 해제 → 플레이 중이면 리셋 ---- */
  if(k==="Escape"){
    if(G.fishMode){ G.fishMode=false; G.fishKind=null; clearFishAim(); setWarn(""); updateHUD(); }
    else if(G.mode==="play"){ resetStage(); }
    return;
  }

  if(G.mode!=="play"||G.pending) return;

  /* ---- 지침(추격 중 지구력 0): 먹이 조준 중이 아니면 아무 입력이나 제자리 대기 ---- */
  if(G.st.stam<=0&&anyChasing()&&!G.fishMode&&(enter||arrowDirOf(k)>=0)){ beginTurn({t:"wait"}); return; }

  /* ---- 🎯 버튼과 같은 동작: 먹이 모드에서 조준한 칸에 투척(일반 모드에선 동작 없음) ---- */
  if(enter){ pressAction(); return; }

  /* ---- 이동 / 먹이 모드에서는 조준 ---- */
  var d=arrowDirOf(k);
  if(d<0) return;
  if(G.fishMode){ aimFishDir(d); return; }
  var vm=validMoves();
  for(var i=0;i<vm.length;i++){ if(vm[i].dir===d){ beginTurn({t:"move",x:vm[i].x,y:vm[i].y,dir:d}); return; } }
});

/* ================= 패널 ================= */
function showPanel(fn,kind){
  hideItemTip();
  var ov=$("overlay"), p=$("panel");
  p.innerHTML=""; fn(p);
  var cw=(kind==="clear"||kind==="win")&&!EDITOR_PLAYTEST;
  ov.classList.toggle("cw",cw);
  ov.classList.remove("hidden");
  if(cw) startClearFx(kind);          /* 배경 암전 + 도트 색종이 (js/clearwin.js) */
}
function hidePanel(){
  var ov=$("overlay");
  ov.classList.add("hidden"); ov.classList.remove("cw");
  if(typeof stopClearFx==="function") stopClearFx();
}
/* 패널 버튼 동작 — 터치/클릭과 키보드(Enter·Space·u·z·r)가 같은 함수를 씁니다 */
function startGame(){ cancelExitAnim(); hidePanel(); G.mode="play"; G.stageIdx=0; loadStage(0); setWarn(""); beep(600,0.1,"triangle",0.05,200); }
function nextStage(){ if(G.stageIdx>=STAGES.length-1) return; cancelExitAnim(); hidePanel(); G.stageIdx++; G.mode="play"; loadStage(G.stageIdx); setWarn(""); }
function restartFromStart(){ cancelExitAnim(); hidePanel(); G.stageIdx=0; G.mode="play"; loadStage(0); setWarn(""); }
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
function clearPanel(p){ buildClearPanel(p,"clear"); }   /* 도트 나무 액자 클리어 창 — js/clearwin.js */
function winPanel(p){
  if(EDITOR_PLAYTEST){
    p.innerHTML='<div class="big">🎉</div><h2>테스트 클리어!</h2><p>만든 스테이지를 탈출했어요.</p><button id="pAgain">다시 테스트 <span class="kc">Enter</span></button><button id="pEdit">편집으로 돌아가기</button>';
    $('pAgain').addEventListener('click',restartFromStart);
    $('pEdit').addEventListener('click',playtestReturn);return;
  }
  buildClearPanel(p,"win");   /* 마지막 방도 같은 톤 — 왕관 메달 */
}

/* ================= 리사이즈 ================= */
function resize(){
  var st=$("stage");
  /* 보드는 #stage 안에서 HUD(위)·조작부(아래) 사이의 가용 상자에 맞춰요.
     가로를 먼저 꽉 채우고, 세로(긴 맵·큰 맵)에 걸리면 min()으로 비례 축소. */
  var availW=st.clientWidth;
  var chrome=($("warn").offsetHeight||0)+($("stam").offsetHeight||0)+14+6;  /* flex gap 7×2 + 여유 */
  var availH=st.clientHeight-chrome;
  if(availW<1) availW=1;
  if(availH<1) availH=1;
  var tile=Math.min(availW/COLS,availH/ROWS);
  if(!(tile>0)) tile=1;
  var cssW=Math.max(1,Math.floor(tile*COLS));
  var cssH=Math.max(1,Math.floor(tile*ROWS));
  var dpr=Math.min(3,Math.max(1,window.devicePixelRatio||1));
  /* 화면 도트(dpr) 기준으로 백킹을 키워 1도트가 뭉개지지 않게 */
  var s=Math.max(1,(cssW*dpr)/CVW);
  cvEl.width=Math.round(CVW*s); cvEl.height=Math.round(CVH*s);
  cvEl.style.width=cssW+"px"; cvEl.style.height=cssH+"px";
  dctx.imageSmoothingEnabled=false;
}

/* ================= 시작 ================= */
window.addEventListener("resize",resize);
initDpad();initInv();
if(EDITOR_PLAYTEST){G.mode="test-wait";resize();playtestReady();}
else{loadStage(0);G.mode="title";resize();updateHUD();}
/* 시작 화면(인트로)이 떠 있는 동안 보드는 그대로 뒤에 있어요. js/start.js 가 시작 버튼을 이어받아요. */
requestAnimationFrame(loop);
