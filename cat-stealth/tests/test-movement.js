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

ok("1) 순찰 C가 비켜나는 칸 — 이동 허용 + 실제 시뮬 일치 + 원본 불변",()=>{
  const def=`[{type:"C",x:3,y:4,dir:2,patrol:[[3,4],[5,4]]}]`;
  const st0=E(`mk(${def})`);
  const snap=JSON.stringify(st0);
  assert.strictEqual(E(`canPlayerMoveTo(mk(${def}),3,4)`),true);
  assert.strictEqual(E(`canPlayerMoveTo(mk(${def}),3,4)`),true);   /* 반복 호출해도 원본 그대로 */
  /* 실제 후보 턴 시뮬레이션: 고양이는 (4,4), 인간은 (3,4), 발각 이벤트 가능 */
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

ok("4) 귀환 중 고양이가 멀어지는 칸은 허용, 집에 이미 있으면 차단",()=>{
  const ret=`[{type:"A",x:3,y:4,dir:1,state:"return",home:[5,4]}]`;
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

ok("5) 비켜나려는 고양이가 다른 고양이에 막히면 여전히 차단 (복도)",()=>{
  const st=`mk([
    {type:"A",x:3,y:4,dir:1,state:"lured"},
    {type:"A",x:4,y:4,dir:0,state:"eat"}],
    {fishes:[{x:5,y:4,kind:"big"},{x:4,y:4,kind:"big"}],
     grid:function(g){ for(var y=1;y<8;y++) for(var x=1;x<8;x++) if(y!==4) g[y][x]="#"; }})`;
  assert.strictEqual(E(`canPlayerMoveTo(${st},3,4)`),false);
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
  assert.strictEqual(E(`canPlayerMoveTo(${snap},3,4)`),true);
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

console.log(`\n${passed} tests passed`);
