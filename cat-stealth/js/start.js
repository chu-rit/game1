"use strict";
/* ================= 스타트 화면 · 인트로 시퀀스 =================
   ① 상단 숲(큰 나무·햇살)에서 아래 수풀로 카메라 패닝
   ② 수풀만 보이는 상태에서 고양이 A → B → C 한 마리씩 쏙
   ③ 작은 인간 빼꼼
   ④ 타이틀 + 시작하기 + 옵션 등장
   인트로 중 화면을 탭/클릭(또는 Enter·Space)하면 즉시 최종 상태로 건너뛰어요. */
(function(){
  var elStart=document.getElementById("start");
  if(!elStart) return;
  /* 에디터 테스트 플레이(iframe)에서는 인트로를 띄우지 않아요 */
  if(typeof EDITOR_PLAYTEST!=="undefined"&&EDITOR_PLAYTEST){ elStart.classList.add("hidden"); return; }

  var SW=863, SH=1822;                 /* start-bg.png 원본 크기(월드 좌표계) */
  var cam=document.getElementById("stCam");
  var tWrap=document.getElementById("stTitleWrap");
  var btnBox=document.getElementById("stBtns");
  var skipEl=document.getElementById("stSkip");
  var optWrap=document.getElementById("stOptPanel");
  var optSfx=document.getElementById("stSfx");
  var optClose=document.getElementById("stPClose");

  /* 캐릭터 배치(월드 좌표) — cx 가운데, by 발밑 y, w 폭 */
  var CHARS=[
    {id:"chA", w:200, cx:300, by:1243, cls:"a"},
    {id:"chB", w:190, cx:487, by:1239, cls:"b"},
    {id:"chC", w:205, cx:668, by:1197, cls:"c"},
    {id:"chH", w:128, cx:305, by:1367, cls:"h"}
  ];

  var VW=0, VH=0;                      /* 뷰포트 */
  var camStart={x:0,y:0,s:1}, camEnd={x:0,y:0,s:1};
  var state=0;                         /* 0 = 인트로 중, 1 = 최종 화면 */
  var started=false;                   /* 배경 그림이 준비된 뒤에 인트로를 시작해요 */
  var panT0=0, panDur=0, panDelay=0, rafId=0, timers=[];

  /* ---------- 배치 ---------- */
  function layout(){
    VW=window.innerWidth; VH=window.innerHeight;
    var base=Math.max(VW/SW, VH/SH);
    /* 최종: 아래쪽(수풀·통나무)까지 보이게, 위는 살짝 잘라요 */
    var sEnd=Math.max(base*1.04, VH/(SH*0.90));
    /* 아주 넓은 화면(데스크톱)에서는 너무 확대되어 캐릭터가 화면 밖으로 나가니 여기까지만 */
    var sMax=VH/(SH*0.66);
    if(sEnd>sMax) sEnd=sMax;
    if(VH/SH>sEnd) sEnd=VH/SH;
    var sStart=sEnd*1.42;
    if(sStart*SH<VH*1.02) sStart=VH*1.02/SH;
    camEnd.s=sEnd; camEnd.x=(VW-SW*sEnd)/2; camEnd.y=Math.min(0, VH-SH*sEnd);
    camStart.s=sStart; camStart.x=(VW-SW*sStart)/2; camStart.y=0;
    applyCam(state? camEnd : camStart);
  }
  function applyCam(c){
    cam.style.transform="translate3d("+c.x+"px,"+c.y+"px,0) scale("+c.s+")";
  }
  function camAt(p){
    var e=p<.5? 4*p*p*p : 1-Math.pow(-2*p+2,3)/2;   /* easeInOutCubic */
    applyCam({
      x:camStart.x+(camEnd.x-camStart.x)*e,
      y:camStart.y+(camEnd.y-camStart.y)*e,
      s:camStart.s+(camEnd.s-camStart.s)*e
    });
  }

  /* ---------- 캐릭터·UI ---------- */
  function placeChars(){
    for(var i=0;i<CHARS.length;i++){
      var c=CHARS[i], el=document.getElementById(c.id);
      if(!el) continue;
      el.style.width=c.w+"px";
      el.style.left=(c.cx-c.w/2)+"px";
      el.style.bottom=(SH-c.by)+"px";
    }
  }
  function rise(i){
    var c=CHARS[i], el=document.getElementById(c.id);
    if(!el) return;
    el.classList.add("up");
    if(i<3&&window.AC) popSound(i);
  }
  function popSound(i){
    try{
      var f=[660,780,900][i]||660;
      beep(f,0.09,"sine",0.05,140);
      setTimeout(function(){ beep(f*1.5,0.10,"sine",0.035,180); },70);
    }catch(e){}
  }

  var TL=[
    {t:2160, fn:function(){ rise(0); }},
    {t:2620, fn:function(){ rise(1); }},
    {t:3070, fn:function(){ rise(2); }},
    {t:3520, fn:function(){ rise(3); }},
    {t:3920, fn:function(){ if(tWrap) tWrap.classList.add("on"); }},
    {t:4250, fn:function(){ if(btnBox) btnBox.classList.add("on"); }},
    {t:4780, fn:function(){ finishIntro(); }}
  ];

  function runTimeline(){
    if(state) return;
    started=true;
    if(elStart) elStart.classList.add("ready");
    for(var i=0;i<TL.length;i++){
      (function(it){ timers.push(setTimeout(it.fn,it.t)); })(TL[i]);
    }
    panDelay=160; panDur=2000;
    panT0=performance.now();
    rafId=requestAnimationFrame(tick);
  }
  function tick(){
    rafId=0;
    if(state) return;
    var p=(performance.now()-panT0-panDelay)/panDur;
    if(p<0) p=0;
    if(p>=1){ applyCam(camEnd); return; }
    camAt(p);
    rafId=requestAnimationFrame(tick);
  }
  function clearTimers(){
    for(var i=0;i<timers.length;i++) clearTimeout(timers[i]);
    timers=[];
    if(rafId){ cancelAnimationFrame(rafId); rafId=0; }
  }

  function finishIntro(fast){
    if(state) return;
    state=1;
    started=true;
    if(elStart){
      elStart.classList.add("ready");
      if(fast){
        /* 탭으로 건너뛸 땐 기다리지 않고 바로 최종 화면으로 */
        elStart.classList.add("snap");
        setTimeout(function(){ elStart.classList.remove("snap"); },320);
      }
    }
    clearTimers();
    for(var i=0;i<CHARS.length;i++){
      var el=document.getElementById(CHARS[i].id);
      if(el) el.classList.add("up");
    }
    if(tWrap) tWrap.classList.add("on");
    if(btnBox) btnBox.classList.add("on");
    if(skipEl) skipEl.classList.add("gone");
    applyCam(camEnd);
  }

  /* ---------- 아웃트로: 캐릭터가 수풀 뒤로 슉 — 게임 화면으로 ----------
     시작하기(또는 Enter·스테이지 선택)를 누르면
       ① 누름 색(금색)이 잠깐 보이고(80ms)
       ② 타이틀·버튼이 부드럽게 사라지면서 고양이 3마리·작은 인간이 동시에 수풀 뒤로 슉 (0.24초)
       ③ 다 들어간 뒤 빈 수풀만 1초 동안 그대로 — 빛입자·햇살 배경 대기는 계속 돌아가요
       ④ 그 1초가 끝난 뒤에야 스타트 화면 전체가 페이드아웃(0.37초)되며 게임 화면이 드러남
     누른 순간부터 약 1.7초. 재생 중에는 isExit 가드로 두 번 시작되지 않아요. */
  var OUT_HOLD=80;      /* 눌림 색을 보여주는 여유 */
  var OUT_SINK=240;     /* 캐릭터가 수풀 뒤로 슉 들어가는 시간 — start.css .24s 와 같아요 */
  var OUT_WAIT=1000;    /* 다 들어간 뒤 빈 수풀 대기 */
  var OUT_FADE_AT=OUT_HOLD+OUT_SINK+OUT_WAIT;  /* 화면 페이드아웃 시작(1320ms) */
  var OUT_FADE=370;                            /* start.css #start.fading 과 같은 0.37초 */
  var OUT_TOTAL=OUT_FADE_AT+OUT_FADE+20;       /* 이때 스타트 화면을 display:none 으로 */
  var isExit=false;
  var outTimers=[];                    /* 아웃트로 타이머 — 스테이지 선택을 다녀올 때 곧바로 정리하려고 모아 둡니다 */
  function clearOutTimers(){
    for(var i=0;i<outTimers.length;i++) clearTimeout(outTimers[i]);
    outTimers=[];
  }

  function playOutro(then,onFade){
    if(isExit||!elStart) return false;
    isExit=true;
    if(!state) finishIntro(false);
    elStart.classList.remove("snap");
    if(then) then();                    /* 게임 화면은 원래 뒤에 그려져 있어요 */
    outTimers.push(setTimeout(function(){ elStart.classList.add("exiting"); },OUT_HOLD));
    outTimers.push(setTimeout(function(){
      elStart.classList.add("fading");
      /* 타이틀이 빠지기 시작하는 순간 다음 화면(스테이지 선택)이 함께 떠올라요 */
      if(onFade) onFade();
    },OUT_FADE_AT));
    outTimers.push(setTimeout(function(){
      outTimers=[];
      elStart.classList.add("hidden");
      elStart.classList.remove("exiting","fading");
      isExit=false;                     /* 스타트 화면은 이제 display:none — 상태만 되돌려 둬요 */
    },OUT_TOTAL));
    return true;
  }

  function hideStart(){ return playOutro(); }
  window.startScreenHide=hideStart;

  /* 스테이지 선택 화면에서 스테이지를 골랐을 때 — 수풀 아웃트로 없이 바로 그 스테이지로 들어가요.
     (아웃트로는 타이틀에서 시작하기를 누를 때 한 번 재생되고, 고른 판은 바로 시작하는 편이 짧고 깔끔해요) */
  function startStageNow(i){
    if(!elStart) return;
    closeOptions();
    settleHidden();                     /* 남아 있는 아웃트로 타이머를 정리하고 타이틀은 숨김으로 확정 */
    G.stageIdx=i; G.mode="play";
    loadStage(i);
    setWarn("");
    try{ beep(600,0.10,"triangle",0.05,200); }catch(e){}
  }
  window.startStageNow=startStageNow;   /* 스테이지 선택 화면(js/stageselect.js)이 부른다 */

  /* ---- 인게임 ↔ 스테이지 선택 ----
     게임 중 HUD 의 ‹ 목록 으로 선택 화면에 들어가면 타이틀 화면은 이미 숨김 상태예요.
     그때 남아 있는 아웃트로 타이머를 그대로 두면, 곧바로 다음 스테이지를 고를 때 startStageNow 가
     isExit 에 막혀 아무 일도 일어나지 않아요. 그래서 다녀오는 순간 숨김 상태로 확정해 둡니다. */
  function settleHidden(){
    if(!elStart) return;
    clearOutTimers();
    elStart.classList.add("hidden");
    elStart.classList.remove("exiting","fading","snap");
    isExit=false;
  }
  window.startScreenSettle=settleHidden;

  /* 선택 화면의 ‹ 타이틀 — 게임에서 들어왔더라도 타이틀 화면으로 돌아가요.
     인트로는 다시 돌리지 않고 아까 그 최종 화면(고양이 3마리·작은 인간·시작하기)을 그대로 보여 줍니다. */
  function showTitle(){
    if(!elStart) return;
    clearOutTimers();
    isExit=false;
    elStart.classList.remove("hidden","exiting","fading","snap");
    if(!state) finishIntro(false);
    for(var i=0;i<CHARS.length;i++){
      var el=document.getElementById(CHARS[i].id);
      if(el) el.classList.add("up");
    }
    if(tWrap) tWrap.classList.add("on");
    if(btnBox) btnBox.classList.add("on");
    if(skipEl) skipEl.classList.add("gone");
    applyCam(camEnd);
  }
  window.startScreenShow=showTitle;

  /* 시작하기·Enter → 타이틀 수풀 아웃트로가 먼저 재생되고, 타이틀이 빠지면서 스테이지 선택 화면이 열려요.
     선택 화면이 없으면 예전처럼 바로 1스테이지로 */
  var _startGame=(typeof startGame==="function")?startGame:null;
  function goStart(){
    if(typeof window.openStageSelect!=="function"){
      playOutro(function(){ if(_startGame) _startGame(); });
      return;
    }
    playOutro(null,function(){ window.openStageSelect(); });
  }
  window.startGame=function(){ goStart(); };

  /* ---------- 옵션 ---------- */
  function openOptions(){
    if(!optWrap) return;
    syncSfx();
    optWrap.classList.remove("hidden");
    void optWrap.offsetWidth;
    optWrap.classList.add("open");
  }
  function closeOptions(){
    if(!optWrap) return;
    optWrap.classList.remove("open");
    setTimeout(function(){ if(!optWrap.classList.contains("open")) optWrap.classList.add("hidden"); },230);
  }
  function syncSfx(){
    if(!optSfx) return;
    optSfx.setAttribute("aria-checked",(window.SFX_ON===false)?"false":"true");
  }
  function toggleSfx(){
    var on=!(window.SFX_ON!==false);
    window.SFX_ON=on;
    try{ localStorage.setItem("tp_sfx",on?"1":"0"); }catch(e){}
    syncSfx();
    if(on){ try{ beep(760,0.08,"square",0.05,180); }catch(e){} }
  }

  /* ---------- 이벤트 ---------- */
  elStart.addEventListener("pointerdown",function(e){
    if(state) return;
    /* 인트로 중에는 어디를 눌러도 건너뛰기 */
    if(optWrap&&optWrap.classList.contains("open")) return;
    e.preventDefault();
    finishIntro(true);
  },{passive:false});

  document.addEventListener("keydown",function(e){
    if(elStart.classList.contains("hidden")) return;
    if(optWrap&&optWrap.classList.contains("open")){
      /* 옵션 패널이 떠 있는 동안은 게임 키 입력이 새어 들어가지 않게 */
      if(e.key==="Escape") closeOptions();
      e.preventDefault(); e.stopPropagation();
      return;
    }
    if(state) return;
    if(e.key==="Enter"||e.key===" "||e.code==="Space"||e.key==="Escape"){
      e.preventDefault(); e.stopPropagation();
      finishIntro(true);
    }
  },true);

  var startBtn=document.getElementById("stStart");

  /* 나무판때기 버튼 눌림 표시 — 손을 대고 있는 동안 .pressed(금색 글자 + 2px 눌림).
     iOS 사파리는 :active 가 짧은 탭에서 거의 안 보이거나 pointerdown 의 preventDefault 에
     먹히기도 해서 클래스를 직접 켜고 끕니다. 손을 빨리 떼도 색 변화가 눈에 남게
     최소 110ms 는 유지해요. */
  var pressT0=0, pressTmr=0;
  function pressOn(){
    if(!startBtn) return;
    pressT0=performance.now();
    if(pressTmr){ clearTimeout(pressTmr); pressTmr=0; }
    startBtn.classList.add("pressed");
  }
  function pressOff(){
    if(!startBtn) return;
    var left=110-(performance.now()-pressT0);
    if(pressTmr){ clearTimeout(pressTmr); pressTmr=0; }
    if(left>0){
      pressTmr=setTimeout(function(){ pressTmr=0; startBtn.classList.remove("pressed"); },left);
    }else{
      startBtn.classList.remove("pressed");
    }
  }
  if(startBtn){
    startBtn.addEventListener("pointerdown",pressOn);
    startBtn.addEventListener("pointerup",pressOff);
    startBtn.addEventListener("pointercancel",pressOff);
    startBtn.addEventListener("pointerleave",pressOff);
    /* 포인터 이벤트가 없는 아주 옛 사파리를 위한 보험 */
    startBtn.addEventListener("touchstart",pressOn,{passive:true});
    startBtn.addEventListener("touchend",pressOff,{passive:true});
    startBtn.addEventListener("touchcancel",pressOff,{passive:true});
    startBtn.addEventListener("click",function(e){
      e.preventDefault(); e.stopPropagation();
      goStart();
    });
  }
  var optBtn=document.getElementById("stOpts");
  if(optBtn) optBtn.addEventListener("click",function(e){
    e.preventDefault(); e.stopPropagation();
    openOptions();
  });
  if(optClose) optClose.addEventListener("click",function(){ closeOptions(); });
  if(optWrap) optWrap.addEventListener("pointerdown",function(e){
    if(e.target===optWrap) closeOptions();
  });
  if(optSfx) optSfx.addEventListener("click",function(e){ e.stopPropagation(); toggleSfx(); });

  /* ---------- 부유하는 빛 입자 ---------- */
  function motes(){
    var box=document.getElementById("stMotes");
    if(!box) return;
    var n=18, html="";
    for(var i=0;i<n;i++){
      var l=8+Math.random()*84, t=10+Math.random()*72;
      var d=9+Math.random()*10, dl=-Math.random()*18;
      var sz=(Math.random()<.35)?4:2;
      html+='<i class="st-mote" style="left:'+l.toFixed(1)+'%;top:'+t.toFixed(1)+'%;'+
            'width:'+sz+'px;height:'+sz+'px;animation-duration:'+d.toFixed(1)+'s;'+
            'animation-delay:'+dl.toFixed(1)+'s"></i>';
    }
    box.innerHTML=html;
  }

  /* ---------- 시작 ---------- */
  placeChars();
  layout();
  motes();

  var bgImg=document.querySelector(".st-bg");
  var began=false;
  function begin(){
    if(began) return;
    began=true;
    if(window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches) finishIntro();
    else runTimeline();
  }
  /* 배경(2MB)이 늦게 와도 인트로를 놓치지 않게: 그림이 준비된 뒤에 시작, 최대 4초 기다림 */
  if(bgImg&&!bgImg.complete){
    bgImg.addEventListener("load",begin);
    bgImg.addEventListener("error",begin);
    setTimeout(begin,4000);
  }else{
    begin();
  }

  window.addEventListener("resize",function(){
    var wasFinal=state;
    layout();
    if(wasFinal) applyCam(camEnd);
  });
  window.addEventListener("orientationchange",function(){ setTimeout(layout,180); });

  /* 인트로 타이머가 백그라운드에서 멈춰도 복귀 시 이어지도록 */
  document.addEventListener("visibilitychange",function(){
    if(document.hidden||state||!started) return;
    if(performance.now()-panT0>panDur+panDelay+300) finishIntro();
  });
})();
