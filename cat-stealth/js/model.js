"use strict";
/* ---------------------------- 상태 ---------------------------- */
var G={ mode:"title", stageIdx:0, st:null, fishMode:false, fishKind:null,
        fishAim:null,
        undoStack:[], moveTiles:[], dangerTiles:[], pending:null, playerDir:2,
        panelTimer:null, warnT:0, t:0, fx:[], bites:[],
        tT0:0, clearMs:null, peekAlways:true };   /* tT0 = 이 방을 시작한 시각(performance.now), clearMs = 출구 도착까지 걸린 시간 · peekAlways = 다음 턴 영역 미리보기 항상 표시 */

function makeCat(def,id){
  var c={id:id,type:def.type,x:def.x,y:def.y,dir:(def.dir!=null?def.dir:0),
         home:{x:def.x,y:def.y,dir:(def.dir!=null?def.dir:0)},state:"idle",lure:0,
         sense:(CAT_SENSE[def.type]!=null?CAT_SENSE[def.type]:1),
         chaseSteps:0,dirs:def.dirs||null,patrol:def.patrol||null,pi:0,psign:1,rx:def.x,ry:def.y,alertT:0,
         freezeT:0,
         crouch:false,            /* 쿠키(C) 도약 준비 자세 — 들킨 턴에 웅크리고 다음 턴에 뛰어요 */
         lureMem:0,lureTgt:null};
  if(c.type==="C"){ c.pi=0; c.psign=1; if(def.patrol){ for(var k=0;k<def.patrol.length;k++){ if(def.patrol[k][0]===def.x&&def.patrol[k][1]===def.y){c.pi=k;} } } c.psign=(c.pi===0)?1:-1; }
  if(c.type==="B"&&c.dirs){ c.dir=c.dirs[0]; }
  return c;
}
function loadStage(idx){
  var s=STAGES[idx], grid=[], player=null, goal=null;
  /* 숫자 배열 행(새 맵 저장 형식)은 내부 한 글자 문자로 먼저 풀어요 — 이후 로직은 그대로 */
  var mrows=s.map.map(function(r){ return mapRowToChars(r); });
  /* 스테이지마다 맵 크기가 다를 수 있어요 — 줄 수/칸 수를 세어 보드 크기를 맞춰요 */
  var rows=mrows.length, cols=1;
  for(var ry=0;ry<rows;ry++){ if(mrows[ry]&&mrows[ry].length>cols) cols=mrows[ry].length; }
  setBoardSize(rows,cols);
  if(typeof sizeBoardCanvases==="function") sizeBoardCanvases();
  for(var y=0;y<ROWS;y++){
    var row=[];
    for(var x=0;x<COLS;x++){
      var ch=(mrows[y]||"").charAt(x);
      if(!ch) ch="#";                 /* 모자란 칸은 벽으로 막아 둬요 */
      if(ch==="P"){ player={x:x,y:y}; ch="."; }
      else if(ch==="G"){ goal={x:x,y:y}; ch="."; }
      row.push(ch);
    }
    grid.push(row);
  }
  if(s.start) player={x:s.start[0],y:s.start[1]};
  if(s.goalPos) goal={x:s.goalPos[0],y:s.goalPos[1]};
  var inv={small:0,big:0,catnip:0,choco:0};
  var pickups=(s.pickups||[]).map(function(p){ return {x:p.x,y:p.y,kind:p.kind}; });
  G.st={ idx:idx, grid:grid, theme:s.theme, name:s.name,
         player:player, goal:goal, inv:inv, pickups:pickups, fishes:[], turn:1,
         maxTurns:(s.maxTurns||20), stam:STAM_MAX,
         cats:s.cats.map(makeCat) };
  G.st.player.rx=player.x; G.st.player.ry=player.y;
  G.fishMode=false; G.fishKind=null; G.fishAim=null; G.pending=null; G.undoStack=[]; G.playerDir=2;
  G.moveTiles=[]; G.dangerTiles=[]; G.fx=[]; G.bites=[]; G.bushShake=null;
  if(G.panelTimer){ clearTimeout(G.panelTimer); G.panelTimer=null; }
  bakeBoard(G.st);
  updateHUD(); computeDanger();
  /* 스테이지 크기가 바뀌었으니 표시 크기도 다시 맞춰요 */
  if(typeof resize==="function") resize();
  /* 클리어 타임 측정 시작 — 스타트 화면 진입·다음 방·‹ ›·리셋·옵션 선택까지 모두 이 한 곳을 지나요 */
  G.tT0=performance.now(); G.clearMs=null;
}
function cloneState(st){ return JSON.parse(JSON.stringify(st)); }

/* 이동 규칙 판정 (안전성 판단 아님 — 들키는 칸도 합법 이동이에요).
   고양이가 서 있는 칸으로는 몸을 비비고 못 지나가요 — 고양이가 그 턴에
   비울 예정이어도 자리 교환은 불가예요. */
function canPlayerMoveTo(st,x,y){
  if(!st||!st.player||!Number.isInteger(x)||!Number.isInteger(y)) return false;
  if(Math.abs(x-st.player.x)+Math.abs(y-st.player.y)!==1||!humanWalkable(st,x,y)) return false;
  for(var i=0;i<st.cats.length;i++){
    var c=st.cats[i];
    if(st.stam<=0&&c.state==="chase") return false;
    if(c.x===x&&c.y===y) return false;
  }
  return true;
}

/* ---------------------------- 시뮬레이션 (프리뷰/실행 공용) ---------------------------- */
function tileAt(st,x,y){
  if(x<0||y<0||x>=COLS||y>=ROWS) return "#";
  return st.grid[y][x];
}
var DECOR={"~":1};
/* ---- 특수 타일 3종 ----
   ^ 고양이 전용 발판 : 고양이는 올라가고 지나가요. 작은 인간은 못 올라가요.
                        낮은 우드 단차라서 시선·기척은 그대로 통과해요.
   H 인간 전용 구멍   : 인간만 지나가요. 고양이는 몸이 커서 못 들어가고,
                        좁고 낮은 벽 틈이라 시선(beam)과 기척(sense)이 거기서 끊겨요.
   U 은신 수풀        : 인간만 들어가요(고양이는 커서 수풀에 못 들어가요).
                        잎이 빽빽해서 시선(beam)이 수풀에서 끊기고, 수풀 칸에 서 있는 동안은
                        기척(sense)에도 잡히지 않아요. 수풀로 들어가면 추격 중이던 고양이는
                        즉시 추격을 포기하고 제자리로 돌아갑니다. */
var SPECIAL={
  "^":{name:"고양이 발판", human:false, cat:true,  sight:false},
  "H":{name:"작은 구멍",   human:true,  cat:false, sight:true },
  "U":{name:"은신 수풀",   human:true,  cat:false, sight:true, soft:true }
};
/* 숲 타일(FOREST_TILES) — rule(data.js) 하나로 판정을 만들어요:
   decor=밟는 장식(DECOR), solid=이동·시선 차단, water/low=이동만 차단(시선 통과),
   hide=사람만 들어가 숨는 수풀(시선 차단, U 타일과 동일·냄새는 스며듦 soft) */
for(var _ft in FOREST_TILES){
  var _fr=FOREST_TILES[_ft];
  if(_fr.rule==="decor") DECOR[_ft]=1;
  else SPECIAL[_ft]={name:_fr.name, human:_fr.rule==="hide", cat:false,
                     sight:_fr.rule==="solid"||_fr.rule==="hide",
                     soft:_fr.rule==="hide"};
}
function specialAt(st,x,y){ return SPECIAL[tileAt(st,x,y)]||null; }
/* 큰 구조물에 덮인 칸인가 — block2(2×2, 왼쪽 위 앵커)는 앵커 후보 4곳을,
   span2(가로 2칸, 왼쪽 앵커)는 자기 칸·왼쪽 칸을 봐요 */
function coveredByBig(st,x,y){
  var t=FOREST_TILES[tileAt(st,x,y)];
  if(t&&(t.block2||t.span2)) return true;
  t=FOREST_TILES[tileAt(st,x-1,y)];
  if(t&&(t.block2||t.span2)) return true;
  t=FOREST_TILES[tileAt(st,x,y-1)];
  if(t&&t.block2) return true;
  t=FOREST_TILES[tileAt(st,x-1,y-1)];
  return !!(t&&t.block2);
}
/* 은신 수풀 칸인가 — 여기 서 있으면 눈에도 귀에도 안 잡혀요 (U 또는 rule:"hide" 숲 타일) */
function isHideTile(st,x,y){
  var ch=tileAt(st,x,y);
  if(ch==="U") return true;
  var ft=FOREST_TILES[ch];
  return !!(ft&&ft.rule==="hide");
}
/* 시선·기척을 막는 칸인가 — 구멍(H)은 막고, 발판(^)은 통과 */
function isBlocked(st,x,y){
  var ch=tileAt(st,x,y);
  if(ch==="#") return true;
  if(ch==="W") return true;             /* 장롱(W): 벽처럼 시선·기척을 막아요 */
  var sp=SPECIAL[ch];
  if(sp) return !!sp.sight;
  if(coveredByBig(st,x,y)) return true;
  return (st.theme[ch]!==undefined&&!DECOR[ch]);
}
/* 인간(플레이어)이 밟을 수 있는 칸 */
function humanWalkable(st,x,y){
  var ch=tileAt(st,x,y);
  if(ch==="#") return false;
  if(ch==="W") return false;             /* 장롱(W): 사람도 지나갈 수 없어요 */
  var sp=SPECIAL[ch];
  if(sp) return !!sp.human;
  if(coveredByBig(st,x,y)) return false;
  return !(st.theme[ch]!==undefined&&!DECOR[ch]);
}
/* 고양이가 밟을 수 있는 칸 (BFS·유인·추격 모두 이 기준) */
function catWalkable(st,x,y){
  var ch=tileAt(st,x,y);
  if(ch==="#") return false;
  if(ch==="W") return false;             /* 장롱(W): 고양이도 지나갈 수 없어요 */
  var sp=SPECIAL[ch];
  if(sp) return !!sp.cat;
  if(coveredByBig(st,x,y)) return false;
  return !(st.theme[ch]!==undefined&&!DECOR[ch]);
}
function walkable(st,x,y){ return humanWalkable(st,x,y); }
function man(a,b){ return Math.abs(a.x-b.x)+Math.abs(a.y-b.y); }
function dirFromTo(a,b){
  var dx=b.x-a.x, dy=b.y-a.y;
  if(Math.abs(dx)>=Math.abs(dy)) return dx>0?1:(dx<0?3:a.dir);
  return dy>0?2:(dy<0?0:a.dir);
}
function beamTiles(st,cat){
  var out=[], d=DIRS[cat.dir], x=cat.x, y=cat.y;
  for(var i=0;i<SIGHT_LEN;i++){
    x+=d[0]; y+=d[1];
    if(isBlocked(st,x,y)) break;
    out.push({x:x,y:y});
  }
  return out;
}
function inBeam(st,cat,pos){
  var b=beamTiles(st,cat);
  for(var i=0;i<b.length;i++){ if(b[i].x===pos.x&&b[i].y===pos.y) return true; }
  return false;
}
function bfsNext(st,from,target,ignoreCats){
  if(from.x===target.x&&from.y===target.y) return null;
  var blockedCat=function(x,y){
    if(ignoreCats) return false;
    for(var i=0;i<st.cats.length;i++){ var c=st.cats[i]; if(c!==from&&c.x===x&&c.y===y) return true; }
    return false;
  };
  var prev={}, key=function(x,y){return y*COLS+x;}, q=[{x:from.x,y:from.y}];
  prev[key(from.x,from.y)]=null;
  var found=false;
  while(q.length){
    var cur=q.shift();
    if(cur.x===target.x&&cur.y===target.y){ found=true; break; }
    for(var d=0;d<4;d++){
      var nx=cur.x+DIRS[d][0], ny=cur.y+DIRS[d][1];
      if(!catWalkable(st,nx,ny)||blockedCat(nx,ny)) continue;
      var k=key(nx,ny);
      if(prev.hasOwnProperty(k)) continue;
      prev[k]=cur; q.push({x:nx,y:ny});
    }
  }
  if(!found) return null;
  var node={x:target.x,y:target.y};
  while(node && prev[key(node.x,node.y)] && !(prev[key(node.x,node.y)].x===from.x&&prev[key(node.x,node.y)].y===from.y)){
    node=prev[key(node.x,node.y)];
  }
  if(!node) return null;
  if(node.x===from.x&&node.y===from.y) return null;
  return node;
}
/* 턱시도 쿠키(C)의 도약 — 웅크린 다음 턴에 최대 3칸(대각선 포함)을 뛰어넘어요.
   · 넘을 수 있는 낮은 것: 발판(^)·물(~)·작은 구멍(H)·은신 수풀·나무 그루터기(rule:"low")
   · 막는 높은 것: 벽(#)·장롱(W)·큰 화분 카운터 같은 테마 가구·숲 solid 타일·span2/block2·맵 밖
   착지 칸은 catWalkable 이어야 하고, 다른 고양이가 서 있으면 안 돼요.
   플레이어 칸에 착지하면 그대로 덮쳐요(simStep 마지막의 겹침 잡힘 판정). */
var C_JUMP=3;
function jumpBlocked(st,x,y){
  if(x<0||y<0||x>=COLS||y>=ROWS) return true;       /* 맵 밖 */
  var ch=tileAt(st,x,y);
  if(ch==="#") return true;
  if(ch==="W") return true;                         /* 장롱 */
  var ft=FOREST_TILES[ch];
  if(ft&&ft.rule==="solid") return true;            /* 숲·나무·바위·통나무·폭포 */
  if(coveredByBig(st,x,y)) return true;              /* span2·block2 큰 구조물 */
  var sp=SPECIAL[ch];
  if(sp) return false;                               /* ^ · H · U · low 그루터기 · 물은 넘어요 */
  return (st.theme[ch]!==undefined&&!DECOR[ch]);     /* 테마 가구(큰 화분 카운터 X 등) */
}
/* 도약선(직선) 위에 높은 장애물이 있는가 — 시작·착지 칸은 빼고 지나가는 칸만 봐요.
   대각선으로 지나갈 때는 양옆 두 칸도 확인해요(벽 모서리를 비스듬히 꿰뚫지 않게). */
function jumpLineClear(st,ax,ay,bx,by){
  var x=ax,y=ay,dx=Math.abs(bx-ax),dy=Math.abs(by-ay);
  var sx=ax<bx?1:-1, sy=ay<by?1:-1, err=dx-dy, guard=0;
  while(guard++<24){
    if(x===bx&&y===by) return true;
    var e2=err*2, ox=0, oy=0;
    if(e2>-dy){ err-=dy; x+=sx; ox=sx; }
    if(e2<dx){ err+=dx; y+=sy; oy=sy; }
    if(x===bx&&y===by) return true;
    if(ox&&oy){
      if(jumpBlocked(st,x-ox,y)||jumpBlocked(st,x,y-oy)) return false;
    }
    if(jumpBlocked(st,x,y)) return false;
  }
  return false;
}
function catAt(st,x,y,except){
  for(var i=0;i<st.cats.length;i++){
    var c=st.cats[i];
    if(c!==except&&c.x===x&&c.y===y) return c;
  }
  return null;
}
/* 직선 도약으로 갈 수 있는 칸 중 플레이어에게 가장 가까운 곳 — 못 찾으면 null */
function jumpLanding(st,cat){
  var best=null, bd=man(cat,st.player);
  for(var dy=-C_JUMP;dy<=C_JUMP;dy++)for(var dx=-C_JUMP;dx<=C_JUMP;dx++){
    if(!dx&&!dy) continue;
    var lx=cat.x+dx, ly=cat.y+dy;
    var d=Math.abs(lx-st.player.x)+Math.abs(ly-st.player.y);
    if(d>=bd) continue;                        /* 플레이어에게서 멀어지는 도약은 안 해요 */
    var onPlayer=(lx===st.player.x&&ly===st.player.y);
    if(!catWalkable(st,lx,ly)) continue;       /* 수풀·구멍 속 플레이어는 밟을 수 없어요 */
    if(!onPlayer&&catAt(st,lx,ly,cat)) continue;
    if(!jumpLineClear(st,cat.x,cat.y,lx,ly)) continue;
    if(d<bd){ bd=d; best={x:lx,y:ly}; }
  }
  return best;
}
/* 직선이 높은 장애물에 막혔을 때 — 길을 따라 최대 3칸까지 밟을 수 있는 마지막 칸.
   (bfsNextToAdj 의 여러 걸음판: 플레이어가 수풀·구멍에 있으면 그 옆 칸까지) */
function jumpPathLanding(st,cat,maxStep){
  var goal=st.player;
  var reachable=function(x,y){ return catWalkable(st,x,y)&&!catAt(st,x,y,cat); };
  var seen={}, prev={}, depth={};
  var key=function(x,y){return y*COLS+x;};
  var q=[{x:cat.x,y:cat.y}], qi=0;
  seen[key(cat.x,cat.y)]=1; depth[key(cat.x,cat.y)]=0;
  var best=null, bd=man(cat,goal);
  while(qi<q.length){
    var cur=q[qi++], cd=depth[key(cur.x,cur.y)];
    if(cur.x!==cat.x||cur.y!==cat.y){
      var d=Math.abs(cur.x-goal.x)+Math.abs(cur.y-goal.y);
      if(d<bd){ bd=d; best={x:cur.x,y:cur.y}; }
    }
    if(cd>=maxStep) continue;
    for(var i=0;i<4;i++){
      var nx=cur.x+DIRS[i][0], ny=cur.y+DIRS[i][1], k=key(nx,ny);
      if(seen[k]) continue;
      // 목표(플레이어) 칸은 다른 고양이 점유 검사 없이 도달만 보되, 착지로는 안 써요
      if(!(nx===goal.x&&ny===goal.y)&&!reachable(nx,ny)) continue;
      if(!catWalkable(st,nx,ny)) continue;
      seen[k]=1; depth[k]=cd+1; prev[k]=cur; q.push({x:nx,y:ny});
    }
  }
  return best;
}
/* 목표 칸 자체를 고양이가 못 밟을 때(수풀·구멍에 든 플레이어) —
   목표 옆의 밟을 수 있는 칸까지 다가가는 첫 스텝을 찾아요 */
function bfsNextToAdj(st,from,target){
  if(catWalkable(st,target.x,target.y)) return bfsNext(st,from,target);
  for(var d=0;d<4;d++){
    var ax=target.x+DIRS[d][0], ay=target.y+DIRS[d][1];
    if(!catWalkable(st,ax,ay)) continue;
    var n=bfsNext(st,from,{x:ax,y:ay});
    if(n) return n;
  }
  return null;
}
/* 먹이로 가는 길이 아예 막혔을 때 — 닿을 수 있는 칸 중 먹이에 가장 가까운 칸.
   다른 고양이는 어차피 자리를 옮기니 도달성 판단에선 무시해요. */
function closestReachable(st,from,target){
  var seen={}; seen[from.x+","+from.y]=1;
  var q=[{x:from.x,y:from.y}], qi=0, best={x:from.x,y:from.y}, bd=man(from,target);
  while(qi<q.length){
    var cur=q[qi++];
    for(var i=0;i<4;i++){
      var nx=cur.x+DIRS[i][0], ny=cur.y+DIRS[i][1], k=nx+","+ny;
      if(seen[k]||!catWalkable(st,nx,ny)) continue;
      seen[k]=1;
      var d=Math.abs(nx-target.x)+Math.abs(ny-target.y);
      if(d<bd){ bd=d; best={x:nx,y:ny}; }
      q.push({x:nx,y:ny});
    }
  }
  return best;
}
/* 최근접 칸에 선 고양이가 먹이 쪽으로 기웃거리는 한 발 —
   먹이에 가장 가까운 이웃 빈 칸(다른 고양이 점유 칸 제외)으로 나갔다가 다음 턴 돌아와요 */
function paceStep(st,cat,nf){
  var best=null,bd=1e9;
  for(var d=0;d<4;d++){
    var nx=cat.x+DIRS[d][0], ny=cat.y+DIRS[d][1];
    if(!catWalkable(st,nx,ny)) continue;
    var occ=false;
    for(var i=0;i<st.cats.length;i++){ var oc=st.cats[i]; if(oc!==cat&&oc.x===nx&&oc.y===ny){ occ=true; break; } }
    if(occ) continue;
    var dd=Math.abs(nx-nf.x)+Math.abs(ny-nf.y);
    if(dd<bd){ bd=dd; best={x:nx,y:ny}; }
  }
  return best;
}
function faceToward(cat,t){ cat.dir=dirFromTo(cat,t); }
/* 바닥의 그 칸에 놓인 생선 */
function fishAt(st,x,y){
  if(!st.fishes) return null;
  for(var i=0;i<st.fishes.length;i++){ if(st.fishes[i].x===x&&st.fishes[i].y===y) return st.fishes[i]; }
  return null;
}
function lureRange(f){ var k=KIND[f.kind]; return k?k.lure:3; }
/* 먹이를 알아채는 거리 = 그 먹이의 유인 사거리, 또는 그 고양이의 기척 반경 중 큰 쪽.
   (귀가 밝은 고양이는 냄새도 멀리서 맡아요 → 연쇄 반응이 끊기지 않아요) */
function noticeRange(f,cat){
  var lr=lureRange(f), sr=(cat.sense||0);
  return lr>sr?lr:sr;
}
/* 지금 서 있는 자리에서 알아챌 수 있는 가장 가까운 먹이(없으면 null).
   clear=true면 냄새가 사거리 안으로 번져 닿는지도 봐요(막힌 칸은 돌아서도 가능) —
   '처음 눈치채는 순간'에만 쓰고, 이미 유인돼 걷는 중에는 위치를 기억하고 있으니
   clear 없이 계속 따라가요(걷다가 냄새가 끊겼다고 유인이 풀리면 안 되니까요). */
function nearestFish(st,cat,clear,onlyKind){
  if(!st.fishes||!st.fishes.length) return null;
  var best=null,bd=1e9;
  for(var i=0;i<st.fishes.length;i++){
    var f=st.fishes[i], d=man(cat,f), nr=noticeRange(f,cat);
    /* 이미 어떤 고양이가 물고 있는(eater) 먹이는 없는 먹이 취급 — 다른 고양이는 안 쫓아가요.
       단 캣닢(ttl)은 예외: 누가 물고 있어도 향기는 계속 나서 4턴 동안 전부 끌어요 */
    if(f.eater!=null&&f.ttl==null) continue;
    if(onlyKind&&f.kind!==onlyKind) continue;
    if(d<=nr&&d<bd&&(!clear||smellReaches(st,cat,f,nr))){ bd=d; best=f; }
  }
  return best;
}
/* 아직 줍지 않은 바닥의 생선 */
function pickupAt(st,x,y){
  if(!st.pickups) return null;
  for(var i=0;i<st.pickups.length;i++){ if(st.pickups[i].x===x&&st.pickups[i].y===y) return st.pickups[i]; }
  return null;
}
function removeFish(st,f){
  for(var i=0;i<st.fishes.length;i++){
    if(st.fishes[i].x===f.x&&st.fishes[i].y===f.y){ st.fishes.splice(i,1); return; }
  }
}
/* 기척(발소리) 감지: 맨해튼 거리 <= sense 이고 두 칸 사이를 벽/가구가 막지 않을 때 */
function lineClear(st,a,b){
  var x=a.x,y=a.y,dx=Math.abs(b.x-a.x),dy=Math.abs(b.y-a.y);
  var sx=a.x<b.x?1:-1, sy=a.y<b.y?1:-1, err=dx-dy, guard=0;
  while(guard++<14){
    if(x===b.x&&y===b.y) return true;
    var e2=err*2;
    if(e2>-dy){ err-=dy; x+=sx; }
    if(e2<dx){ err+=dx; y+=sy; }
    if(x===b.x&&y===b.y) return true;
    if(isBlocked(st,x,y)) return false;
  }
  return false;
}
/* 냄새가 지나지 못하는 칸 — 수풀·화분(soft)은 잎 사이로 스며들지만
   벽·가구·구멍·나무·돌(시선 차단 타일)은 냄새도 막아요. */
function smellBlocked(st,x,y){
  var sp=SPECIAL[tileAt(st,x,y)];
  if(sp&&sp.soft) return false;
  return isBlocked(st,x,y);
}
/* 냄새는 직선이 아니라 칸 단위로 번져요 — 막힌 칸 하나가 껴 있어도
   옆으로 돌아서 닿을 수 있어요. 사거리(range) 안에 뚫린 경로가 하나라도
   있으면 알아채고, 대각선 사이의 두 칸이 '둘 다' 막혔을 때만 못 맡아요. */
function smellReaches(st,a,b,range){
  var seen={}; seen[a.x+","+a.y]=1;
  var q=[{x:a.x,y:a.y,d:0}], qi=0;
  while(qi<q.length){
    var c=q[qi++];
    if(c.d>=range) continue;
    for(var i=0;i<4;i++){
      var nx=c.x+DIRS[i][0], ny=c.y+DIRS[i][1], k=nx+","+ny;
      if(seen[k]) continue;
      seen[k]=1;
      if(nx===b.x&&ny===b.y) return true;   /* 도착 칸 자체는 막힘 검사 없이 도달 */
      if(smellBlocked(st,nx,ny)) continue;
      q.push({x:nx,y:ny,d:c.d+1});
    }
  }
  return false;
}
function senseHit(st,cat,pos){
  if(!cat.sense) return false;
  if(man(cat,pos)>cat.sense) return false;
  /* 구멍(H) 속에 몸을 숨기면 소리도 새지 않아요 */
  if(isBlocked(st,pos.x,pos.y)) return false;
  return lineClear(st,cat,pos);
}
function startEat(st,cat,f,events){
  var k=KIND[f.kind]||KIND.small;
  f.eatLeft=(k.eat<0)?-1:k.eat;
  f.eater=cat.id;
  cat.state="eat"; cat.chaseSteps=0;
  events.push({k:"bite",id:cat.id,kind:f.kind});
}
function nearestPatrolIdx(cat){
  var best=0,bd=1e9;
  for(var i=0;i<cat.patrol.length;i++){
    var d=Math.abs(cat.patrol[i][0]-cat.x)+Math.abs(cat.patrol[i][1]-cat.y);
    if(d<bd){bd=d;best=i;}
  }
  return best;
}
function catStep(st,cat,events){
  /* 추격(chase)에서 벗어난 상태면 도약 준비 자세를 먼저 풀어요 */
  if(cat.state!=="chase") cat.crouch=false;
  /* 수풀에 놓친 직후 이동금지 — freezeT턴 동안 제자리에서 마지막으로 본 쪽만 바라봐요 */
  if(cat.freezeT){ cat.freezeT--; cat.dir=dirFromTo(cat,st.player); return; }
  if(cat.state==="chase"){
    /* 발각한 턴엔 이미 자기 이동을 끝낸 뒤라, 다음 턴부터는 바로 추격해요 */
    /* 플레이어와 CHASE_DIST칸 이상 벌어지면 수풀 은신과 같은 방식으로 놓쳐요:
       '?'를 띄우며 이 턴은 제자리에 서고, 다음 턴은 멍하니(freezeT) 본 쪽을
       바라보다가 그 다음 턴부터 자리로 돌아가요 */
    if(Math.abs(cat.x-st.player.x)+Math.abs(cat.y-st.player.y)>=CHASE_DIST){
      cat.state="return"; cat.chaseSteps=0; cat.crouch=false;
      cat.dir=dirFromTo(cat,st.player);
      cat.freezeT=1;
      events.push({k:"lost",id:cat.id});
      return;
    }
    /* 턱시도 쿠키(C)는 1칸 걸음 대신 '웅크리기 → 3칸 도약'을 번갈아 해요.
       들킨 턴에 웅크리고(crouch), 다음 턴에 뛰고, 착지한 다음 턴에 또 웅크려요. */
    if(cat.type==="C"){
      if(cat.crouch){
        var land=jumpLanding(st,cat);
        if(!land) land=jumpPathLanding(st,cat,C_JUMP);   /* 직선이 막혔으면 길 따라 3칸까지 */
        var fx=cat.x, fy=cat.y;
        if(land){
          cat.dir=dirFromTo({x:fx,y:fy,dir:cat.dir},land);
          cat.x=land.x; cat.y=land.y;
          events.push({k:"jump",id:cat.id,fromX:fx,fromY:fy,toX:land.x,toY:land.y});
        }else{
          cat.dir=dirFromTo(cat,st.player);              /* 뛸 곳이 없으면 쫓는 쪽만 봐요 */
        }
        cat.crouch=false;
        return;
      }
      cat.crouch=true;                                  /* 착지한 다음 턴: 다시 웅크려요 */
      cat.dir=dirFromTo(cat,st.player);
      return;
    }
    /* 플레이어가 수풀·구멍에 있으면 그 칸까지가 아니라 가장자리까지 쫓아가요 */
    var nxt=bfsNextToAdj(st,cat,st.player);
    if(nxt){ cat.dir=dirFromTo(cat,nxt); cat.x=nxt.x; cat.y=nxt.y; }
    else{ cat.dir=dirFromTo(cat,st.player); }   /* 못 움직여도 쫓는 쪽은 바라봐요 */
  }else if(cat.state==="return"){
    var tgt, arrive=null;
    if(cat.type==="C"){ var ni=nearestPatrolIdx(cat); tgt={x:cat.patrol[ni][0],y:cat.patrol[ni][1],ni:ni}; }
    else tgt={x:cat.home.x,y:cat.home.y};
    var stp=bfsNext(st,cat,tgt);
    /* 작은 인간의 칸으로 가는 발걸음은 그대로 밟아요 — 겹치면 바로 잡혀요 */
    if(stp){ cat.dir=dirFromTo(cat,stp); cat.x=stp.x; cat.y=stp.y; }
    /* 길이 막혔으면 그 턴은 제자리에서 기다립니다(방향도 그대로) */
    else{
      cat.state="idle"; cat.chaseSteps=0;
      if(cat.type==="C"){
        cat.pi=tgt.ni; cat.psign=(cat.pi===0)?1:-1;
        /* 같은 칸만 도는 제자리 초소라면 처음 지켜보던 방향(home.dir)으로 다시 돌아서요 */
        var stat=true;
        for(var q=1;q<cat.patrol.length;q++){ if(cat.patrol[q][0]!==cat.patrol[0][0]||cat.patrol[q][1]!==cat.patrol[0][1]){ stat=false; break; } }
        if(stat) cat.dir=cat.home.dir;
      }
      else{ cat.dir=cat.home.dir; if(cat.dirs){ cat.dir=cat.dirs[0]; } }
      events.push({k:"calm",id:cat.id});
    }
  }else if(cat.state==="eat"){
    /* 생선 위에 올라가 오물오물. 다 먹을 때까지 그 자리에 붙박여 있고,
       이 동안은 눈(시야)도 귀(기척)도 닫혀 있어요. */
    var ef=fishAt(st,cat.x,cat.y);
    var ek=ef?KIND[ef.kind]:null;
    if(!ef||!ek){ cat.state="return"; events.push({k:"calm",id:cat.id}); }
    else if(ek.eat<0){
      events.push({k:"chew",id:cat.id,kind:ef.kind});   /* 큰 통생선: 판이 끝날 때까지 계속 먹어요 */
    }else{
      ef.eatLeft=(ef.eatLeft==null?ek.eat:ef.eatLeft)-1;
      if(ef.eatLeft<=0){
        removeFish(st,ef);
        events.push({k:"ate",id:cat.id,kind:ef.kind,x:cat.x,y:cat.y});
        /* 연쇄 반응: 다 먹은 바로 그 자리에서 또 다른 먹이가 냄새나면
           제자리로 돌아가지 않고 곧장 다음 먹이로 걸어가요 */
        var nxf=nearestFish(st,cat,true);
        if(nxf){
          cat.state="lured"; cat.chaseSteps=0;
          events.push({k:"chain",id:cat.id,kind:nxf.kind});
        }else{
          cat.state="return"; cat.chaseSteps=0;
        }
      }else{
        events.push({k:"chew",id:cat.id,kind:ef.kind});
      }
    }
  }else if(cat.state==="lured"){
    /* 생선 냄새를 따라 생선 '위'까지 걸어가요. 다 와서 올라서면 그 자리에서 먹기 시작. */
    var nf=nearestFish(st,cat);
    /* 사거리 밖이어도 1턴 기억(lureTgt)으로 마지막 먹이 자리를 향해 계속 걸어요 —
       단 그 자리에 먹이가 아직 있을 때만(다른 고양이가 먹었으면 그냥 포기) */
    if(!nf&&cat.lureTgt){ var mf=fishAt(st,cat.lureTgt.x,cat.lureTgt.y); if(mf&&(mf.eater==null||mf.ttl!=null)) nf=mf; }
    if(!nf){
      cat.state="return"; cat.chaseSteps=0; cat.lureTgt=null;
      events.push({k:"calm",id:cat.id});
    }else if(cat.x===nf.x&&cat.y===nf.y){
      startEat(st,cat,nf,events);
    }else if(cat.lureWait){
      /* '?' 반응 턴: 냄새를 맡은 그 턴은 먹이 쪽을 바라만 보고, 다음 턴부터 걸어가요 */
      cat.lureWait=0; faceToward(cat,nf);
    }else{
      var f=bfsNext(st,cat,nf);
      /* 작은 인간의 칸으로 가는 발걸음도 그대로 밟아요 — 겹치면 바로 잡혀요 */
      if(f){ cat.dir=dirFromTo(cat,f); cat.x=f.x; cat.y=f.y; }
      if(cat.x===nf.x&&cat.y===nf.y){ startEat(st,cat,nf,events); }
      else if(f){ if(man(cat,nf)<=1){ faceToward(cat,nf); } }
      else{
        /* 길이 아예 막힌 먹이 — 멍하니 서있지 않고 닿을 수 있는 최근접 칸까지 가서
           그 자리를 왔다갔다(기웃거렸다 물러났다) 해요 */
        var cp=closestReachable(st,cat,nf);
        var g=(cat.x!==cp.x||cat.y!==cp.y)?bfsNext(st,cat,cp):null;
        if(g){ cat.dir=dirFromTo(cat,g); cat.x=g.x; cat.y=g.y; }
        else{
          /* 최근접 칸 도착, 또는 그 칸을 먹는 중인 고양이가 차지해서 못 가면 —
             제자리에 서있지 않고 먹이 쪽으로 기웃거리듯 이웃 칸을 왔다갔다 해요 */
          var pv=paceStep(st,cat,nf);
          if(pv){ cat.dir=dirFromTo(cat,pv); cat.x=pv.x; cat.y=pv.y; }
          else cat.dir=dirFromTo(cat,nf);
        }
      }
    }
  }else{ /* idle */
    if(cat.type==="B"&&cat.dirs){ cat.dir=(cat.dir===cat.dirs[0])?cat.dirs[1]:cat.dirs[0]; }
    else if(cat.type==="C"&&cat.patrol){
      if(cat.pi<0||cat.pi>=cat.patrol.length) cat.pi=0;
      var pt={x:cat.patrol[cat.pi][0],y:cat.patrol[cat.pi][1]};
      if(cat.x===pt.x&&cat.y===pt.y){
        var nxi=cat.pi+cat.psign;
        if(nxi<0||nxi>=cat.patrol.length){ cat.psign*=-1; nxi=cat.pi+cat.psign; }
        if(nxi<0||nxi>=cat.patrol.length) nxi=cat.pi;   /* 지점이 하나뿐이면 제자리 초소 */
        cat.pi=nxi;
        pt={x:cat.patrol[nxi][0],y:cat.patrol[nxi][1]};
      }
      var pst=bfsNext(st,cat,pt);
      if(pst){ cat.dir=dirFromTo(cat,pst); cat.x=pst.x; cat.y=pst.y; }
    }
  }
}
/* 감지 패스: 평소(idle)·복귀 중인 고양이는 눈(시야)과 귀(기척)를 모두 열어 둡니다.
   생선에 정신이 팔린 lured/eat 상태에서는 기척도 시야도 없어요.
   발각 = chase 전환 — 발각한 그 턴엔 이미 움직인 뒤라 다음 턴부터 곧장 쫓아와요. */
function detectStep(st,events){
  for(var k2=0;k2<st.cats.length;k2++){
    var c2=st.cats[k2];
    if(c2.state!=="idle"&&c2.state!=="return") continue;
    var seen=inBeam(st,c2,st.player), heard=senseHit(st,c2,st.player);
    if(seen||heard){
      c2.state="chase"; c2.chaseSteps=0; c2.alertT=0;
      /* 쿠키(C)는 들킨 그 자리에서 바로 웅크려 다음 턴 도약을 준비해요 */
      if(c2.type==="C") c2.crouch=true;
      /* 발각 순간 플레이어 쪽으로 몸을 돌려요 — 귀로 들었든 눈으로 봤든 쫓는 쪽을 봐야 자연스러워요 */
      c2.dir=dirFromTo(c2,st.player);
      events.push({k:"spot",id:c2.id,bySense:!seen&&heard});
    }
  }
}
function simStep(st,action,events){
  var chase0=false;
  for(var c0=0;c0<st.cats.length;c0++){ if(st.cats[c0].state==="chase"){ chase0=true; break; } }
  if(action){
    if(action.t==="move"){
      st.player.x=action.x; st.player.y=action.y;
      /* 추격 중 이동은 지구력 1칸 소모 — 다 쓰면 제자리 대기만 가능 */
      if(chase0&&st.stam>0) st.stam--;
      /* 밟은 칸에 생선이 떨어져 있으면 자동으로 주워요 */
      var pk=pickupAt(st,action.x,action.y);
      if(pk){
        st.inv[pk.kind]=(st.inv[pk.kind]||0)+1;
        for(var pi=0;pi<st.pickups.length;pi++){ if(st.pickups[pi]===pk){ st.pickups.splice(pi,1); break; } }
        events.push({k:"pickup",kind:pk.kind,x:action.x,y:action.y});
      }
    }
    else if(action.t==="fish"){
      var kind=action.kind||"small";
      if((st.inv[kind]||0)>0){
        st.inv[kind]--;
        var fe={x:action.x,y:action.y,kind:kind};
        if(KIND[kind]&&KIND[kind].ttl!=null) fe.ttl=KIND[kind].ttl;   /* 캣닢: 시간제 유인 */
        st.fishes.push(fe);
        events.push({k:"fish",x:action.x,y:action.y,kind:kind});
      }
    }
    else if(action.t==="wait"){
      /* 지침: 제자리에서 한 턴 숨을 고르고 지구력 완충 (고양이는 그대로 움직여요).
         🍫 초콜릿(action.kind="choco"): 하나를 먹고 같은 'wait' 턴을 보내요 —
         숨 고르기와 똑같이 지구력도 완충되고, 초콜릿만 1개 줄어요.
         보유 수량이 0이면 아무 일도 없이 평범한 대기(컨트롤러가 막지만 이중 확인). */
      if(action.kind&&KIND[action.kind]&&KIND[action.kind].use==="wait"&&(st.inv[action.kind]||0)>0){
        st.inv[action.kind]--;
        st.stam=STAM_MAX;
        events.push({k:"choco",kind:action.kind});
      }else{
        st.stam=STAM_MAX;
        events.push({k:"rest"});
      }
    }
  }
  var hidCats=[];
  /* 유인: 사거리 안에 생선이 있으면 idle·돌아가는 중인 고양이가 그쪽으로 끌려가요.
     생선은 아무도 먹지 않으면 판이 끝날 때까지 바닥에 그대로 있습니다. */
  for(var i=0;i<st.cats.length;i++){
    var c=st.cats[i];
    if(c.state!=="idle"&&c.state!=="lured"&&c.state!=="return"&&c.state!=="chase") continue;
    /* 아직 유인되지 않은 고양이만 냄새가 '새로' 닿는지 봐요 — 벽·가구에 막히면 모른 채로 있어요.
       추격(chase) 중엔 일반 생선엔 눈도 안 돌리지만 캣닢만은 못 참아요 — 탈출용 비상 아이템. */
    var lf=(c.state==="chase")?nearestFish(st,c,true,"catnip"):nearestFish(st,c,c.state!=="lured");
    if(lf){
      if(c.state!=="lured"){
        /* 먹이를 다 먹고 돌아가던 길에 또 먹이가 코앞에 있으면 → 연쇄 반응으로 바로 다음 먹이로! */
        events.push({k:(c.state==="return")?"chain":"lure",id:c.id,kind:lf.kind});
        c.state="lured"; c.chaseSteps=0; c.lureWait=1; c.crouch=false;
      }
      /* '저기 먹이 있었지' 2턴 기억 — 사거리를 스치듯 벗어나도 바로 잊지 않아요
         (cloneState가 매 턴 깊은 복사를 하니 객체 참조 대신 좌표를 기억해요) */
      c.lureMem=2; c.lureTgt={x:lf.x,y:lf.y};
      faceToward(c,lf);
    }else if(c.state==="lured"){
      if(c.lureMem>0){ c.lureMem--; }   /* 사거리 밖 2턴은 기억하고 그대로 걸어가요 */
      else{ c.state="return"; c.chaseSteps=0; c.lureTgt=null;
        events.push({k:"calm",id:c.id}); }
    }
  }
  /* 감지는 이동(catStep) 후 위치 기준으로만 봐요 — 수풀에서 나오는 턴도 예외 없이
     고양이가 자기 차례의 이동(순찰이면 앞으로 한 칸)을 끝내고 나서야 시야·기척을
     확인하고, 발각하면 이동한 지점에서 '!'를 띄워요. 다음 턴부터 곧장 추격해요. */
  for(var j=0;j<st.cats.length;j++){ catStep(st,st.cats[j],events); }
  detectStep(st,events);
  /* 🌿 은신 수풀: 수풀 칸에 들어서는 '그 턴까지' 추격하던 고양이는 이번 턴 이동을
     끝내고 나서야 놓쳐요 — '?'를 띄우고 다음 턴 한 번 멍하니 서요( freezeT ).
     잎에 가린 플레이어는 눈에도 귀에도 안 잡혀요. */
  if(isHideTile(st,st.player.x,st.player.y)){
    for(var hi=0;hi<st.cats.length;hi++){
      var hc=st.cats[hi];
      if(hc.state==="chase"){
        hc.state="return"; hc.chaseSteps=0; hc.crouch=false; hidCats.push(hc);
        events.push({k:"hide",id:hc.id});
      }
    }
  }
  /* 수풀에 놓친 고양이의 1턴 이동금지는 '다음 턴'부터 — 이 턴의 catStep 은 정상적으로 끝난 뒤에 걸어요 */
  for(var hf=0;hf<hidCats.length;hf++){ hidCats[hf].freezeT=1; }
  for(var k3=0;k3<st.cats.length;k3++){
    var c3=st.cats[k3];
    /* 어떤 상태의 고양이든 사람 칸에 올라가면 잡혀요 — 순찰·복귀 중에도 겹치면 끝 */
    if(c3.x===st.player.x&&c3.y===st.player.y){ events.push({k:"caught",id:c3.id}); }
  }
  if(st.player.x===st.goal.x&&st.player.y===st.goal.y){ events.push({k:"goal"}); }
  /* 🌿 시간제 먹이(캣닢) 카운트다운 — ttl턴이 지나면 향기가 사라져요.
     사라지면 유인된 고양이들은 다음 턴 목표를 잃고 자리로 돌아가요( !nf → calm ). */
  for(var fi=st.fishes.length-1;fi>=0;fi--){
    var ff=st.fishes[fi];
    if(ff.ttl==null) continue;
    ff.ttl--;
    if(ff.ttl<=0){ removeFish(st,ff); events.push({k:"fade",x:ff.x,y:ff.y,kind:ff.kind}); }
  }
  /* 쫓기는 고양이가 한 마리도 없으면 지구력은 자동 완충 (다음 추격 때 다시 3칸) */
  var stillC=false;
  for(var c9=0;c9<st.cats.length;c9++){ if(st.cats[c9].state==="chase"){ stillC=true; break; } }
  if(!stillC) st.stam=STAM_MAX;
  return st;
}
