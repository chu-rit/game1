"use strict";
/* ---------------------------- 상태 ---------------------------- */
var G={ mode:"title", stageIdx:0, st:null, fishMode:false, fishKind:null,
        fishAim:null,
        undoStack:[], moveTiles:[], dangerTiles:[], pending:null, playerDir:2,
        panelTimer:null, warnT:0, t:0, fx:[] };

function makeCat(def,id){
  var c={id:id,type:def.type,x:def.x,y:def.y,dir:(def.dir!=null?def.dir:0),
         home:{x:def.x,y:def.y,dir:(def.dir!=null?def.dir:0)},state:"idle",lure:0,
         sense:(CAT_SENSE[def.type]!=null?CAT_SENSE[def.type]:1),
         chaseSteps:0,dirs:def.dirs||null,patrol:def.patrol||null,pi:0,psign:1,rx:def.x,ry:def.y,alertT:0};
  if(c.type==="C"){ c.pi=0; c.psign=1; if(def.patrol){ for(var k=0;k<def.patrol.length;k++){ if(def.patrol[k][0]===def.x&&def.patrol[k][1]===def.y){c.pi=k;} } } c.psign=(c.pi===0)?1:-1; }
  if(c.type==="B"&&c.dirs){ c.dir=c.dirs[0]; }
  return c;
}
function loadStage(idx){
  var s=STAGES[idx], grid=[], player=null, goal=null;
  for(var y=0;y<N;y++){
    var row=[];
    for(var x=0;x<N;x++){
      var ch=s.map[y].charAt(x);
      if(ch==="P"){ player={x:x,y:y}; ch="."; }
      else if(ch==="G"){ goal={x:x,y:y}; ch="."; }
      row.push(ch);
    }
    grid.push(row);
  }
  if(s.start) player={x:s.start[0],y:s.start[1]};
  if(s.goalPos) goal={x:s.goalPos[0],y:s.goalPos[1]};
  var inv={small:0,big:0,catnip:0};
  var pickups=(s.pickups||[]).map(function(p){ return {x:p.x,y:p.y,kind:p.kind}; });
  G.st={ idx:idx, grid:grid, theme:s.theme, name:s.name,
         player:player, goal:goal, inv:inv, pickups:pickups, fishes:[], turn:1,
         maxTurns:(s.maxTurns||20),
         cats:s.cats.map(makeCat) };
  G.st.player.rx=player.x; G.st.player.ry=player.y;
  G.fishMode=false; G.fishKind=null; G.fishAim=null; G.pending=null; G.undoStack=[]; G.playerDir=2;
  G.moveTiles=[]; G.dangerTiles=[]; G.fx=[];
  if(G.panelTimer){ clearTimeout(G.panelTimer); G.panelTimer=null; }
  bakeBoard(G.st);
  updateHUD(); computeDanger();
}
function cloneState(st){ return JSON.parse(JSON.stringify(st)); }

/* ---------------------------- 시뮬레이션 (프리뷰/실행 공용) ---------------------------- */
function tileAt(st,x,y){
  if(x<0||y<0||x>=N||y>=N) return "#";
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
  "U":{name:"은신 수풀",   human:true,  cat:false, sight:true }
};
function specialAt(st,x,y){ return SPECIAL[tileAt(st,x,y)]||null; }
/* 은신 수풀 칸인가 — 여기 서 있으면 눈에도 귀에도 안 잡혀요 */
function isHideTile(st,x,y){ return tileAt(st,x,y)==="U"; }
/* 시선·기척을 막는 칸인가 — 구멍(H)은 막고, 발판(^)은 통과 */
function isBlocked(st,x,y){
  var ch=tileAt(st,x,y);
  if(ch==="#") return true;
  var sp=SPECIAL[ch];
  if(sp) return !!sp.sight;
  return (st.theme[ch]!==undefined&&!DECOR[ch]);
}
/* 인간(플레이어)이 밟을 수 있는 칸 */
function humanWalkable(st,x,y){
  var ch=tileAt(st,x,y);
  if(ch==="#") return false;
  var sp=SPECIAL[ch];
  if(sp) return !!sp.human;
  return !(st.theme[ch]!==undefined&&!DECOR[ch]);
}
/* 고양이가 밟을 수 있는 칸 (BFS·유인·추격 모두 이 기준) */
function catWalkable(st,x,y){
  var ch=tileAt(st,x,y);
  if(ch==="#") return false;
  var sp=SPECIAL[ch];
  if(sp) return !!sp.cat;
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
  var prev={}, key=function(x,y){return y*N+x;}, q=[{x:from.x,y:from.y}];
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
/* 지금 서 있는 자리에서 알아챌 수 있는 가장 가까운 먹이(없으면 null) */
function nearestFish(st,cat){
  if(!st.fishes||!st.fishes.length) return null;
  var best=null,bd=1e9;
  for(var i=0;i<st.fishes.length;i++){
    var f=st.fishes[i], d=man(cat,f);
    if(d<=noticeRange(f,cat)&&d<bd){ bd=d; best=f; }
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
  if(cat.state==="chase"){
    var nxt=bfsNext(st,cat,st.player);
    if(nxt){ cat.dir=dirFromTo(cat,nxt); cat.x=nxt.x; cat.y=nxt.y; }
    /* 시야나 기척에 잡히면 계속 추격: 보이면(들키면) 리셋, 안 보인 채 CHASE_LOST턴이면 포기 */
    if(inBeam(st,cat,st.player)||senseHit(st,cat,st.player)){ cat.chaseSteps=0; }
    else{ cat.chaseSteps++; if(cat.chaseSteps>=CHASE_LOST){ cat.state="return"; } }
  }else if(cat.state==="return"){
    var tgt, arrive=null;
    if(cat.type==="C"){ var ni=nearestPatrolIdx(cat); tgt={x:cat.patrol[ni][0],y:cat.patrol[ni][1],ni:ni}; }
    else tgt={x:cat.home.x,y:cat.home.y};
    var stp=bfsNext(st,cat,tgt);
    /* 돌아가는 길에도 작은 인간의 칸은 밟지 않아요(그 턴은 제자리에서 기다림) */
    if(stp&&!(stp.x===st.player.x&&stp.y===st.player.y)){ cat.dir=dirFromTo(cat,stp); cat.x=stp.x; cat.y=stp.y; }
    /* 길이 막혔으면 그 턴은 제자리에서 기다립니다(방향도 그대로) */
    else if(!stp){
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
        var nxf=nearestFish(st,cat);
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
    if(!nf){
      cat.state="return"; cat.chaseSteps=0;
      events.push({k:"calm",id:cat.id});
    }else if(cat.x===nf.x&&cat.y===nf.y){
      startEat(st,cat,nf,events);
    }else{
      var f=bfsNext(st,cat,nf);
      /* 작은 인간의 칸은 밟지 않아요(그 턴은 그 자리에서 기다림) */
      if(f&&!(f.x===st.player.x&&f.y===st.player.y)){ cat.dir=dirFromTo(cat,f); cat.x=f.x; cat.y=f.y; }
      if(cat.x===nf.x&&cat.y===nf.y){ startEat(st,cat,nf,events); }
      else if(man(cat,nf)<=1){ faceToward(cat,nf); }
    }
  }else{ /* idle */
    if(cat.type==="B"&&cat.dirs){ cat.dir=(cat.dir===cat.dirs[0])?cat.dirs[1]:cat.dirs[0]; }
    else if(cat.type==="C"&&cat.patrol){
      var pt={x:cat.patrol[cat.pi][0],y:cat.patrol[cat.pi][1]};
      if(cat.x===pt.x&&cat.y===pt.y){
        var nxi=cat.pi+cat.psign;
        if(nxi<0||nxi>=cat.patrol.length){ cat.psign*=-1; nxi=cat.pi+cat.psign; }
        cat.pi=nxi;
        pt={x:cat.patrol[nxi][0],y:cat.patrol[nxi][1]};
      }
      var pst=bfsNext(st,cat,pt);
      if(pst&&!(pst.x===st.player.x&&pst.y===st.player.y)){ cat.dir=dirFromTo(cat,pst); cat.x=pst.x; cat.y=pst.y; }
    }
  }
}
function simStep(st,action,events){
  if(action){
    if(action.t==="move"){
      st.player.x=action.x; st.player.y=action.y;
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
        st.fishes.push({x:action.x,y:action.y,kind:kind});
        events.push({k:"fish",x:action.x,y:action.y,kind:kind});
      }
    }
  }
  /* 🌿 은신 수풀: 수풀 칸에 들어서면 추격 중이던 고양이는 그 턴에 바로 추격을 멈추고
     (return · chaseSteps=0) 제자리로 돌아가요. 잎에 가려 눈에도 귀에도 안 잡혀요. */
  if(isHideTile(st,st.player.x,st.player.y)){
    for(var hi=0;hi<st.cats.length;hi++){
      var hc=st.cats[hi];
      if(hc.state==="chase"){
        hc.state="return"; hc.chaseSteps=0;
        events.push({k:"hide",id:hc.id});
      }
    }
  }
  /* 유인: 사거리 안에 생선이 있으면 idle·돌아가는 중인 고양이가 그쪽으로 끌려가요.
     생선은 아무도 먹지 않으면 판이 끝날 때까지 바닥에 그대로 있습니다. */
  for(var i=0;i<st.cats.length;i++){
    var c=st.cats[i];
    if(c.state!=="idle"&&c.state!=="lured"&&c.state!=="return") continue;
    var lf=nearestFish(st,c);
    if(lf){
      if(c.state!=="lured"){
        /* 먹이를 다 먹고 돌아가던 길에 또 먹이가 코앞에 있으면 → 연쇄 반응으로 바로 다음 먹이로! */
        events.push({k:(c.state==="return")?"chain":"lure",id:c.id,kind:lf.kind});
        c.state="lured"; c.chaseSteps=0;
      }
      faceToward(c,lf);
    }else if(c.state==="lured"){
      c.state="return"; c.chaseSteps=0;
      events.push({k:"calm",id:c.id});
    }
  }
  for(var j=0;j<st.cats.length;j++){ catStep(st,st.cats[j],events); }
  /* 감지: 평소(idle)·복귀 중인 고양이는 눈(시야)과 귀(기척)를 모두 열어 둡니다.
     생선에 정신이 팔린 lured/eat 상태에서는 기척도 시야도 없어요. */
  for(var k2=0;k2<st.cats.length;k2++){
    var c2=st.cats[k2];
    if(c2.state!=="idle"&&c2.state!=="return") continue;
    var seen=inBeam(st,c2,st.player), heard=senseHit(st,c2,st.player);
    if(seen||heard){
      c2.state="chase"; c2.chaseSteps=0; c2.alertT=0;
      events.push({k:"spot",id:c2.id,bySense:!seen&&heard});
    }
  }
  for(var k3=0;k3<st.cats.length;k3++){
    var c3=st.cats[k3];
    if(c3.state==="chase"&&c3.x===st.player.x&&c3.y===st.player.y){ events.push({k:"caught",id:c3.id}); }
  }
  if(st.player.x===st.goal.x&&st.player.y===st.goal.y){ events.push({k:"goal"}); }
  return st;
}
