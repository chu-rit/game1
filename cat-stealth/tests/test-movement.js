"use strict";
/* canPlayerMoveTo 테스트 — 고양이가 점유한 칸의 '후보 턴 시뮬레이션' 판정 검증.
   브라우저 없이 vm으로 data/model 로드, loadStage 없이 손으로 만든 스테이트 사용. */
const assert=require("assert");
const fs=require("fs");
const path=require("path");
const vm=require("vm");

const root=path.join(__dirname,"..","js");
const ctx={console};
vm.createContext(ctx);
for(const f of ["data.js","model.js"]){
  vm.runInContext(fs.readFileSync(path.join(root,f),"utf8"),ctx,{filename:f});
}
const E=n=>vm.runInContext(n,ctx);

/* 9x9 테두리 벽 + 바닥, 인간(2,4), 골(7,7), 스태미나3.
   catDefs: makeCat 인자 + state/home/fishes 같은 런타임 필드 덮어쓰기용 */
E(`var mk=function(catDefs,opts){
  var grid=[];
  for(var y=0;y<9;y++){ var row=[]; for(var x=0;x<9;x++) row.push((x===0||y===0||x===8||y===8)?"#":"."); grid.push(row); }
  var st={grid:grid,theme:{},player:{x:2,y:4},goal:{x:7,y:7},pickups:[],fishes:[],cats:[],
    inv:{small:0,big:0,catnip:0},turn:1,maxTurns:20,stam:3,name:"t",hint:""};
  (catDefs||[]).forEach(function(d,i){
    var c=makeCat(d,i);
    if(d.state) c.state=d.state;
    if(d.home) c.home={x:d.home[0],y:d.home[1],dir:c.dir};
    st.cats.push(c);
  });
  opts=opts||{};
  if(opts.fishes) st.fishes=opts.fishes;
  if(opts.stam!=null) st.stam=opts.stam;
  if(opts.player){ st.player.x=opts.player[0]; st.player.y=opts.player[1]; }
  if(opts.grid) opts.grid(st.grid);
  return st;
};`);

let passed=0;
function ok(name,fn){ fn(); passed++; console.log("ok -",name); }

ok("1) 고양이 칸으로 진입 — 순찰 고양이는 자기 스텝으로 칸을 비우고 옆 칸에서 발각 + 실제 시뮬 일치 + 원본 불변",()=>{
  const def=`[{type:"C",x:3,y:4,dir:2,patrol:[[3,4],[5,4]]}]`;
  const st0=E(`mk(${def})`);
  const snap=JSON.stringify(st0);
  /* 발각은 이동 후 위치 기준 — 고양이가 순찰 스텝으로 (3,4)를 비우면 진입이 허용돼요 */
  assert.strictEqual(E(`canPlayerMoveTo(mk(${def}),3,4)`),true);
  assert.strictEqual(E(`canPlayerMoveTo(mk(${def}),3,4)`),true);   /* 반복 호출해도 원본 그대로 */
  /* 실제 후보 턴 시뮬레이션: 고양이는 (4,4)로 이동한 뒤 옆 칸에서 발각 → 아직 caught는 아님 */
  const r=E(`(function(){
    var st=mk(${def}), ev=[];
    simStep(st,{t:"move",x:3,y:4},ev);
    return [st.player.x,st.player.y,st.cats[0].x,st.cats[0].y,
            ev.some(function(e){return e.k==="spot"}), ev.some(function(e){return e.k==="caught"})];
  })()`);
  assert.strictEqual(JSON.stringify(r),"[3,4,4,4,true,false]");
  assert.strictEqual(JSON.stringify(st0),snap,"원본 st 불변");
});

ok("2) 이번 턴 안 움직이는 고양이(A 고정·B 교대 방향·C 제자리 초소)는 차단",()=>{
  assert.strictEqual(E(`canPlayerMoveTo(mk([{type:"A",x:3,y:4,dir:0}]),3,4)`),false);
  assert.strictEqual(E(`canPlayerMoveTo(mk([{type:"B",x:3,y:4,dir:0,dirs:[0,2]}]),3,4)`),false);
  assert.strictEqual(E(`canPlayerMoveTo(mk([{type:"C",x:3,y:4,dir:0,patrol:[[3,4],[3,4]]}]),3,4)`),false);
});

ok("3) 먹이에 끌린 고양이는 비켜남 / 먹는 중 고양이는 자리 지킴",()=>{
  const lured=`[{type:"A",x:3,y:4,dir:1,state:"lured"}]`;
  assert.strictEqual(E(`canPlayerMoveTo(mk(${lured},{fishes:[{x:5,y:4,kind:"big"}]}),3,4)`),true);
  const r=E(`(function(){
    var st=mk(${lured},{fishes:[{x:5,y:4,kind:"big"}]}), ev=[];
    simStep(st,{t:"move",x:3,y:4},ev);
    return [st.cats[0].x,st.cats[0].y,st.cats[0].state];
  })()`);
  assert.strictEqual(JSON.stringify(r),"[4,4,\"lured\"]");
  /* 큰 통생선 위에서 먹는 중 — 그 턴에 안 움직여요 */
  assert.strictEqual(E(`canPlayerMoveTo(mk([{type:"A",x:3,y:4,dir:0,state:"eat"}],
    {fishes:[{x:3,y:4,kind:"big"}]}),3,4)`),false);
  /* 작은 생선 마지막 한 입: 먹고 'return'으로 바뀌지만 그 턴엔 안 움직여요 */
  assert.strictEqual(E(`canPlayerMoveTo(mk([{type:"A",x:3,y:4,dir:0,state:"eat"}],
    {fishes:[{x:3,y:4,kind:"small",eatLeft:1}]}),3,4)`),false);
});

ok("4) 귀환 중 고양이도 이동 후 발각 — 귀환 스텝으로 칸을 비우고 옆 칸에서 발각, 집에 이미 있으면 차단",()=>{
  const ret=`[{type:"A",x:3,y:4,dir:1,state:"return",home:[5,4]}]`;
  /* 귀환 스텝으로 (4,4)로 이동한 뒤 거기서 발각 — 칸이 비니까 진입 허용 */
  assert.strictEqual(E(`canPlayerMoveTo(mk(${ret}),3,4)`),true);
  const r=E(`(function(){
    var st=mk(${ret}), ev=[];
    simStep(st,{t:"move",x:3,y:4},ev);
    return [st.cats[0].x,st.cats[0].y];
  })()`);
  assert.strictEqual(JSON.stringify(r),"[4,4]");
  /* 귀환 중이지만 집 == 현재 칸 → 그 자리에서 멈춤 */
  assert.strictEqual(E(`canPlayerMoveTo(mk([{type:"A",x:3,y:4,dir:0,state:"return",home:[3,4]}]),3,4)`),false);
});

ok("5) 길 막힌 유인 고양이는 왔다갔다 하며 칸을 비움 — 진입 가능하지만 다음 턴 밟힘 (복도)",()=>{
  const st=`mk([
    {type:"A",x:3,y:4,dir:1,state:"lured"},
    {type:"A",x:4,y:4,dir:0,state:"eat"}],
    {fishes:[{x:5,y:4,kind:"big"},{x:4,y:4,kind:"big"}],
     grid:function(g){ for(var y=1;y<8;y++) for(var x=1;x<8;x++) if(y!==4) g[y][x]="#"; }})`;
  /* 먹이가 다른 고양이에 막혀 못 가면 고양이는 제자리 대기가 아니라 한 발 물러나
     왔다갔다(페이싱) — 그래서 칸이 비고, 들어가면 다음 턴 되돌아오는 발걸음에 밟혀 잡혀요 */
  assert.strictEqual(E(`canPlayerMoveTo(${st},3,4)`),true);
  const r=E(`(function(){var s=${st};var ev=[];simStep(s,{t:"move",x:3,y:4},ev);
    var evs=ev.map(function(e){return e.k});
    var c=s.cats[0];
    /* 이번 턴: 고양이가 물러남(페이싱) → 플레이어 진입 성공. 아직 caught 아님 */
    var first={cat:[c.x,c.y],caught:evs.indexOf("caught")>=0};
    /* 다음 턴: 고양이가 되돌아오는 발걸음으로 플레이어 칸을 밟아 잡힘 */
    ev=[];simStep(s,{t:"wait"},ev);
    var second={cat:[s.cats[0].x,s.cats[0].y],caught:ev.map(function(e){return e.k}).indexOf("caught")>=0};
    return [first,second];})()`);
  assert.strictEqual(r[0].caught,false);
  assert.strictEqual(JSON.stringify(r[1].cat),"[3,4]");
  assert.strictEqual(r[1].caught,true);
});

ok("6) 최종 점유는 모든 고양이 검사 — 추격 고양이가 목적지로 들어오면 차단",()=>{
  const st=`mk([
    {type:"C",x:3,y:4,dir:2,patrol:[[3,4],[5,4]]},
    {type:"A",x:3,y:3,dir:2,state:"chase"}])`;
  assert.strictEqual(E(`canPlayerMoveTo(${st},3,4)`),false);
});

ok("7) 스태미나·인접성·타일 규칙",()=>{
  /* 지침 + 추격 중: 모든 방향 차단 */
  const chase=`mk([{type:"A",x:5,y:5,dir:0,state:"chase"}],{stam:0})`;
  for(const d of [[3,4],[2,5],[1,4],[2,3]])
    assert.strictEqual(E(`canPlayerMoveTo(${chase},${d[0]},${d[1]})`),false,`stam0+chase ${d}`);
  /* 지침이지만 추격 고양이 없음 → 빈 칸 이동은 가능 */
  assert.strictEqual(E(`canPlayerMoveTo(mk([{type:"A",x:5,y:5,dir:0}],{stam:0}),3,4)`),true);
  const base="mk([])";
  assert.strictEqual(E(`canPlayerMoveTo(${base},4,4)`),false);      /* 비인접 */
  assert.strictEqual(E(`canPlayerMoveTo(${base},-1,4)`),false);     /* 범위 밖 */
  assert.strictEqual(E(`canPlayerMoveTo(${base},2.5,4)`),false);    /* 소수 */
  assert.strictEqual(E(`canPlayerMoveTo(${base},2,8)`),false);      /* 비인접 벽 */
  /* 벽 */
  assert.strictEqual(E(`canPlayerMoveTo(mk([],{player:[1,1]}),0,1)`),false);
  /* 장롱(W) · 발판(^): 사람은 못 올라감 */
  assert.strictEqual(E(`canPlayerMoveTo(mk([],{grid:function(g){g[4][3]="W";}}),3,4)`),false);
  assert.strictEqual(E(`canPlayerMoveTo(mk([],{grid:function(g){g[4][3]="^";}}),3,4)`),false);
  /* 구멍(H) · 수풀(U): 사람은 들어갈 수 있음 */
  assert.strictEqual(E(`canPlayerMoveTo(mk([],{grid:function(g){g[4][3]="H";}}),3,4)`),true);
  assert.strictEqual(E(`canPlayerMoveTo(mk([],{grid:function(g){g[4][3]="U";}}),3,4)`),true);
  /* 비어 있지만 위험한 칸(시야/기척 안)도 합법 이동 — 안전 판정 아님 */
  assert.strictEqual(E(`canPlayerMoveTo(mk([{type:"A",x:3,y:2,dir:2}]),3,4)`),true);
});

ok("8) 판정이 실제 simStep 결과와 일치 + 픽업·원본 불변",()=>{
  const def=`[{type:"C",x:3,y:4,dir:2,patrol:[[3,4],[5,4]]}]`;
  const st=E(`(function(){var s=mk(${def});s.pickups=[{x:5,y:5,kind:"catnip"}];return s;})()`);
  const snap=JSON.stringify(st);
  assert.strictEqual(E(`canPlayerMoveTo(${snap},3,4)`),true);   /* 이동 후 발각 — 순찰 스텝으로 칸을 비워서 허용 */
  /* 실제 턴 실행과 같은 결과 */
  const r=E(`(function(){
    var st=mk(${def}); st.pickups=[{x:5,y:5,kind:"catnip"}];
    var before=JSON.stringify(st);
    var okm=canPlayerMoveTo(st,3,4);
    var after=JSON.stringify(st);
    return [okm,before===after];
  })()`);
  assert.strictEqual(JSON.stringify(r),"[true,true]","헬퍼가 st·pickups 를 오염시키지 않음");
  /* 차단 경로도 원본 불변 */
  const r2=E(`(function(){
    var st=mk([{type:"A",x:3,y:4,dir:0}]); var before=JSON.stringify(st);
    var okm=canPlayerMoveTo(st,3,4);
    return [okm,JSON.stringify(st)===before];
  })()`);
  assert.strictEqual(JSON.stringify(r2),"[false,true]");
});

ok("9) 🍫 초콜릿: 밟아 줍기 → 먹고 1턴 대기(고양이 1스텝) → 취소 스냅샷으로 수량·위치 원복",()=>{
  /* 밟아 줍기 — 먹이 픽업과 같은 경로(pickups→inv), 이벤트도 pickup */
  const picked=E(`(function(){
    var st=mk([]); st.pickups=[{x:3,y:4,kind:"choco"}];
    var ev=[]; simStep(st,{t:"move",x:3,y:4},ev);
    return [st.inv.choco,st.pickups.length,ev.map(function(e){return e.k}).join(","),st.player.x,st.player.y];
  })()`);
  assert.strictEqual(picked[0],1,"inv.choco +1");
  assert.strictEqual(picked[1],0,"바닥에서 사라짐");
  assert.strictEqual(picked[2],"pickup","픽업 이벤트");
  assert.strictEqual(picked[3]+","+picked[4],"3,4");

  /* 먹기 = action.t "wait" + kind choco — 수량 1 차감, 조준 없음, 고양이는 한 스텝 순찰 */
  const ate=E(`(function(){
    var st=mk([{type:"C",x:1,y:1,dir:1,patrol:[[1,1],[7,1]]}]);
    st.player.x=3; st.player.y=4; st.inv.choco=1;
    var before=cloneState(st);
    var ev=[]; simStep(st,{t:"wait",kind:"choco"},ev);
    var out={inv:st.inv.choco,ev:ev.map(function(e){return e.k}).join(","),
             cat:[st.cats[0].x,st.cats[0].y],player:[st.player.x,st.player.y],
             beforeInv:before.inv.choco,beforeCat:[before.cats[0].x,before.cats[0].y],
             catState:st.cats[0].state};
    /* 취소(Undo)는 컨트롤러가 action 전에 cloneState 로 떠 둔 스냅샷으로 되돌려요 */
    st=before;
    out.undone=[st.inv.choco,st.cats[0].x,st.cats[0].y];
    return out;
  })()`);
  assert.strictEqual(ate.inv,0,"사용 시 1 차감");
  assert.strictEqual(ate.ev,"choco","choco 이벤트(rest 아님)");
  assert.strictEqual(JSON.stringify(ate.cat),"[2,1]","고양이 순찰 1스텝 진행");
  assert.strictEqual(JSON.stringify(ate.player),"[3,4]","사람은 제자리");
  assert.strictEqual(ate.catState,"idle");
  assert.strictEqual(JSON.stringify(ate.undone),"[1,1,1]","취소 시 수량·고양이 위치 원복");

  /* 보유 0이면 아무 일도 없이 지구력만 회복하는 평범한 대기 (던지기·유인 없음) */
  const none=E(`(function(){
    var st=mk([],{stam:1}); st.inv.choco=0;
    var ev=[]; simStep(st,{t:"wait",kind:"choco"},ev);
    return [st.inv.choco,ev.map(function(e){return e.k}).join(","),st.stam,st.fishes.length];
  })()`);
  assert.strictEqual(JSON.stringify(none),"[0,\"rest\",3,0]","수량 0 → rest · 생선 투척 없음");

  /* 추경 중에도 평범한 '대기' 한 턴과 똑같이 지구력이 완충되고 초콜릿만 줄어들어요 */
  const stam=E(`(function(){
    var st=mk([{type:"A",x:5,y:4,dir:3,state:"chase"}],{stam:1});
    st.inv.choco=1;
    var ev=[]; simStep(st,{t:"wait",kind:"choco"},ev);
    return [st.inv.choco,st.stam,ev.map(function(e){return e.k}).join(",")];
  })()`);
  assert.strictEqual(stam[0],0,"먹은 만큼 1 차감");
  assert.strictEqual(stam[1],3,"대기와 같은 지구력 완충");
  assert.strictEqual(stam[2],"choco");

  /* 고양이 먹이가 아님: 생선 목록(fishes)에 들어가지 않고, 바닥 초콜릿은 고양이를 유인하지 않아요 */
  const notLure=E(`(function(){
    var st=mk([{type:"A",x:5,y:4,dir:3}],{fishes:[]});
    return [nearestFish(st,st.cats[0],true), KIND.choco.use, KIND.choco.lure];
  })()`);
  assert.strictEqual(notLure[0],null,"유인 대상 없음");
  assert.strictEqual(notLure[1],"wait","use:wait 표시");
  assert.strictEqual(notLure[2],0,"유인 사거리 0");
});

console.log(`\n${passed} tests passed`);
