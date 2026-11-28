"use strict";
/* ================= 스테이지 선택 화면 (숲길 월드맵) =================
   시작하기(또는 Enter) → 타이틀 수풀 아웃트로 → 이 화면 → 길 위 숫자 노드 탭 → 바로 게임
   ‹ 타이틀(또는 Esc) → 타이틀 화면으로 돌아가요. 인게임 HUD 의 ‹ 목록 은 openStageSelect("ingame") 로 열려요.

   배경은 이 화면 전용 숲길 그림(assets/stage-map-bg.png) 한 장이에요. 화면 아래에서 시작해
   위로 S자로 굽이치는 흙길이 그림 안에 이미 그려져 있고, 길은 위 가장자리 밖으로 이어져요.
   노드·이름표는 DOM 이라 터치·키보드 포커스·Galmuri 폰트가 그대로 살아 있고,
   좌표(NODE_POS)는 그림 기준 % 라서 배경과 1:1 로 맞물려요.

   지도 높이 = 맵 영역 높이 × 구간 수. 그림 한 장이 스테이지 10개를 담으므로
   STAGES.length 가 10 이하면 한 화면(스크롤 없음), 넘으면 그림을 한 화면 높이씩 위로
   이어 붙여(홀수 구간은 좌우 반전) 세로 스크롤 지도가 돼요. 1번이 맨 아래, 위로 갈수록 다음 스테이지.

   해금 규칙: 클리어한 스테이지는 언제나 열리고,
              아직 클리어하지 않은 스테이지는 앞번호부터 3개까지만 열려요.
   클리어 기록은 js/controller.js 가 클리어 확정 시 localStorage "tp_cleared" 에 남기고
   ({스테이지 인덱스: {bestMs, bestTurns}}), 이 화면이 그걸 읽어요. */
(function(){
  var el=document.getElementById("stageSel");
  if(!el) return;
  /* 에디터 테스트 플레이(iframe)에서는 인트로·선택 화면 없이 바로 테스트 */
  if(typeof EDITOR_PLAYTEST!=="undefined"&&EDITOR_PLAYTEST){ el.classList.add("hidden"); return; }

  var map=document.getElementById("ssMap");
  var world=document.getElementById("ssWorld");
  var bands=document.getElementById("ssBands");
  var nodes=document.getElementById("ssNodes");
  var prog=document.getElementById("ssProg");
  var foot=document.getElementById("ssFoot");
  var back=document.getElementById("ssBack");
  var FOOT_NOTE=foot?foot.textContent:"";
  var open=false, entering=false, footTmr=0;
  var origin="title";          /* 어디서 들어왔나 — "title" | "ingame" (인게임 HUD 의 ‹ 목록) */

  /* 그림 한 장(stage-map-bg.png) 위 흙길 좌표 — 그림 기준 %.
     1번이 아래 입구, 10번이 위 숲길 끝. 순서대로 이으면 낮은 곳에서 숲 위쪽으로
     구불구불 올라가는 S자 길이 돼요. 그림을 새로 그리면 이 값만 옮겨 적으면 돼요. */
  var NODE_POS=[
    {x:47.4, y:90.0 },
    {x:39.7, y:81.75},
    {x:54.5, y:73.5 },
    {x:61.3, y:65.25},
    {x:36.0, y:57.0 },
    {x:43.0, y:48.75},
    {x:58.3, y:40.5 },
    {x:56.7, y:32.25},
    {x:38.5, y:24.0 },
    {x:58.9, y:15.75}
  ];
  var BAND=NODE_POS.length;        /* 그림 한 장에 담기는 스테이지 수 */

  function readCleared(){
    try{
      var all=JSON.parse(localStorage.getItem("tp_cleared")||"{}");
      return (all&&typeof all==="object")?all:{};
    }catch(e){ return {}; }
  }
  /* 미클리어 스테이지는 앞번호부터 최대 3개까지 열어요 */
  function unlockMap(cleared){
    var m=[], left=3;
    for(var i=0;i<STAGES.length;i++){
      if(cleared[i]){ m[i]=true; continue; }
      if(left>0){ m[i]=true; left--; } else m[i]=false;
    }
    return m;
  }
  function esc(s){
    return String(s).replace(/[&<>\"]/g,function(c){
      return ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"})[c];
    });
  }
  function bestText(rec){
    if(!rec) return "";
    var tm=(rec.bestMs!=null&&isFinite(rec.bestMs))
      ?((typeof cwTimeText==="function")?cwTimeText(rec.bestMs):"--") : "--";
    var tn=(rec.bestTurns!=null&&isFinite(rec.bestTurns))?(rec.bestTurns+"턴") : "--";
    return "최고 "+tm+" · "+tn;
  }

  /* ---------- 지도 기하 ----------
     한 구간(그림 한 장) = 맵 영역 높이. 10개 이하면 세계 높이도 한 화면이라 스크롤이 없어요. */
  function geom(){
    var h=(map&&map.clientHeight)||844;
    var nb=Math.max(1,Math.ceil(STAGES.length/BAND));
    return {bandH:h, bands:nb, worldH:h*nb};
  }
  /* 스테이지 인덱스 → 지도 위 위치(%)
     위 구간(11번~)은 같은 그림을 좌우 반전해 이어 붙여요 — 흙길이 계속 이어지도록. */
  function nodePos(i,g){
    var band=Math.floor(i/BAND), slot=i%BAND, p=NODE_POS[slot];
    var flip=(band%2===1);
    var x=flip?(100-p.x):p.x;
    var top=g.worldH-(band+1)*g.bandH;        /* 그 구간의 위쪽 끝 */
    var y=top+p.y/100*g.bandH;                /* 지도 위에서부터의 px */
    return {x:x, y:(y/g.worldH)*100};
  }

  /* ---------- 노드 ---------- */
  function render(){
    var g=geom();
    /* 지도 높이에 맞춰 배지·이름표 크기를 한 단계씩 줄여요(노치 안전영역 포함) */
    if(map){
      var mh=map.clientHeight;
      el.classList.toggle("compact",mh<720&&mh>=640);
      el.classList.toggle("tight",mh<640);
    }
    /* 배경 그림 — 구간마다 한 장씩, 홀수 구간은 좌우 반전 */
    if(world) world.style.height=g.worldH+"px";
    if(bands){
      var bh="";
      /* 위 구간부터 그려요 — 지도 위에서부터 쌓이니 마지막 구간이 첫 번째 자식 */
      for(var b=g.bands-1;b>=0;b--){
        bh+='<div class="ss-band'+(b%2?" flip b2":"")+'" style="height:'+g.bandH+'px"></div>';
      }
      bands.innerHTML=bh;
    }

    var cleared=readCleared(), unlock=unlockMap(cleared), nClear=0, html="";
    var nextIdx=-1;
    for(var n=0;n<STAGES.length;n++){ if(!cleared[n]&&unlock[n]){ nextIdx=n; break; } }
    for(var i=0;i<STAGES.length;i++){
      var rec=cleared[i], isClear=!!rec;
      if(isClear) nClear++;
      var cls=isClear?"clear":(unlock[i]?"open":"lock");
      var pos=nodePos(i,g);
      var state=isClear?("클리어 · "+bestText(rec)):(unlock[i]?"도전 가능":"잠김");
      var kids='<span class="ss-num">'+(i+1)+'</span>'+
               '<span class="ss-lbl">'+esc(STAGES[i].name)+'</span>';
      if(isClear) kids+='<span class="ss-star" aria-hidden="true">★</span>';
      if(!isClear&&!unlock[i]){
        kids+='<svg class="ss-lk" viewBox="0 0 9 10" aria-hidden="true">'+
              '<path d="M2 4.2V2.6a2.5 2.5 0 0 1 5 0v1.6" fill="none" stroke="currentColor" stroke-width="1.5"/>'+
              '<rect x="1" y="4.2" width="7" height="5.2" fill="currentColor"/></svg>';
      }
      html+='<button type="button" class="ss-node '+cls+(i===nextIdx?" next":"")+'"'+
            ' data-i="'+i+'" style="left:'+pos.x.toFixed(2)+'%;top:'+pos.y.toFixed(3)+'%"'+
            ' aria-label="스테이지 '+(i+1)+' '+esc(STAGES[i].name)+' — '+esc(state)+'">'+
            kids+'</button>';
    }
    if(nodes) nodes.innerHTML=html;
    if(prog) prog.innerHTML='<b>'+nClear+'</b> / '+STAGES.length+' ★';
  }
  /* 지도가 한 화면보다 길면 맨 아래(1번)가 보이게 — 위로 올라가며 다음 스테이지로 */
  function scrollToBottom(){
    if(map) map.scrollTop=map.scrollHeight;
  }


  /* ---------- 열기 / 닫기 ---------- */
  function openSelect(from){
    if(open||entering) return;
    open=true;
    origin=(from==="ingame")?"ingame":"title";
    if(footTmr){ clearTimeout(footTmr); footTmr=0; }
    if(foot) foot.textContent=FOOT_NOTE;
    el.classList.remove("hidden");
    void el.offsetWidth;              /* 지도 크기를 재려면 먼저 보여야 해요 */
    render();
    scrollToBottom();
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
    /* 고른 스테이지는 아웃트로 없이 바로 시작해요 (js/start.js) */
    if(typeof window.startStageNow==="function"){
      window.startStageNow(i);
    }else{
      G.stageIdx=i; G.mode="play"; loadStage(i); setWarn("");
    }
    setTimeout(function(){ entering=false; },400);
  }
  /* ‹ 타이틀 — 타이틀에서 왔으면 그대로 타이틀, 인게임에서 왔으면 숨겨 둔 타이틀 화면을 다시 보여 줘요.
     (게임 판은 HUD 의 돌아가기에서 이미 끝내 두었으니 이어서 하지 않아요) */
  function leaveSelect(){
    if(origin==="ingame"&&typeof window.startScreenShow==="function") window.startScreenShow();
    closeSelect();
  }
  function lockedNode(node){
    node.classList.remove("shake");
    void node.offsetWidth;
    node.classList.add("shake");
    if(foot){
      foot.textContent="🔒 미클리어 스테이지는 앞번호부터 3개까지 열려요";
      if(footTmr) clearTimeout(footTmr);
      footTmr=setTimeout(function(){ foot.textContent=FOOT_NOTE; footTmr=0; },1600);
    }
    try{ if(typeof sBeepTip==="function") sBeepTip(); }catch(e){}
  }

  /* ---------- 이벤트 ---------- */
  if(nodes) nodes.addEventListener("click",function(e){
    var b=e.target.closest?e.target.closest(".ss-node"):null;
    if(!b) return;
    if(b.classList.contains("lock")){ b.blur(); lockedNode(b); return; }
    var i=parseInt(b.getAttribute("data-i"),10);
    if(isNaN(i)) return;
    b.blur();
    enterStage(i);
  });
  if(back) back.addEventListener("click",function(){ back.blur(); leaveSelect(); });

  document.addEventListener("keydown",function(e){
    if(!open) return;
    if(e.key==="Escape"){ e.preventDefault(); e.stopPropagation(); leaveSelect(); return; }
    if(e.ctrlKey||e.metaKey||e.altKey) return;
    var k=e.key;
    var isActivate=(k==="Enter"||k===" "||k==="Spacebar"||e.code==="Space");
    if(isActivate){
      /* 노드에 포커스가 있으면 Enter·Space 는 그 노드를 누르는 기본 동작에 맡겨요 */
      var a=document.activeElement;
      if(!(a&&a.classList&&a.classList.contains("ss-node"))) e.stopPropagation();
      return;
    }
    /* 화면이 떠 있는 동안 인게임 키(방향키·U·R·1~5)가 새어 들어가지 않게 */
    if(k.indexOf("Arrow")===0||k==="u"||k==="U"||k==="r"||k==="R"||k==="Backspace"||
       (k.length===1&&k>="1"&&k<="5")){
      e.preventDefault(); e.stopPropagation();
    }
  },true);

  window.addEventListener("resize",function(){
    if(!open) return;
    render();
    scrollToBottom();          /* 지도가 길어도 늘 아래(1번) 쪽을 보고 있게 */
  });

  /* 시작하기·Enter 가 이 화면을 열도록 js/start.js 가 불러요 */
  window.openStageSelect=openSelect;
})();
