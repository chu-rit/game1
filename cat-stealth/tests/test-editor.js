"use strict";
/* 에디터 순수 로직 테스트 — 브라우저 없이 vm으로 data/model/editor-model 로드 */
const assert=require("assert");
const fs=require("fs");
const path=require("path");
const vm=require("vm");

const root=path.join(__dirname,"..","js");
const ctx={console};
vm.createContext(ctx);
for(const f of ["data.js","model.js","editor-model.js"]){
  vm.runInContext(fs.readFileSync(path.join(root,f),"utf8"),ctx,{filename:f});
}
const E=n=>vm.runInContext(n,ctx);

let passed=0;
function ok(name,fn){ fn(); passed++; console.log("ok -",name); }

/* 유효한 기본 초안(스테이지 1 정규화)에 패치를 얹어 잘못된 입력을 만든다 */
const base=E(`editorNormalize(JSON.parse(JSON.stringify(STAGES[0])))`);
const baseJson=JSON.stringify(base);
function patched(patch){
  return Object.assign(JSON.parse(baseJson),patch);
}

ok("모든 기본 스테이지: normalize→export→parse→normalize 안정",()=>{
  const stages=E("STAGES");
  for(let i=0;i<stages.length;i++){
    const exp=E(`(function(){var d=editorNormalize(JSON.parse(JSON.stringify(STAGES[${i}])));return editorExport(d);})()`);
    const d2=E(`editorParseImport(${JSON.stringify(exp)})`);
    const exp2=E(`editorExport(JSON.parse(${JSON.stringify(JSON.stringify(d2))}))`);
    assert.strictEqual(exp2,exp,`stage ${i} roundtrip`);
  }
});
ok("C 고양이 순찰·B 교대 감시 스테이지 검증 통과",()=>{
  for(const i of [2,3,6,9]){
    const r=E(`(function(){var d=editorNormalize(JSON.parse(JSON.stringify(STAGES[${i}])));return editorValidate(d);})()`);
    assert.strictEqual(JSON.stringify(r.errors),"[]",`stage ${i} errors`);
  }
});
ok("잘못된 입력은 원본 불변으로 거부",()=>{
  const badMap9='["#########","#########","#########","#########","#########","#########","#########","#########","#########"]';
  const bad=[
    patched({name:1}),
    patched({map:["###"]}),
    patched({map:["#########","#########","#########","#########","#########","#########","#########","#########","########'"]}),
    patched({map:["#########","#P.....P#","#########","#########","#########","#########","#########","#########","#########"]}),
    patched({start:[1.5,2]}),patched({goalPos:[9,0]}),
    patched({maxTurns:0}),patched({maxTurns:-3}),patched({maxTurns:2.5}),
    patched({cats:[{type:"D",x:1,y:1}]}),
    patched({cats:[{type:"B",x:1,y:1}]}),
    patched({cats:[{type:"C",x:1,y:1,patrol:[[1,1]],evil:1}]}),
    patched({pickups:[{x:1,y:1,kind:"mega"}]}),
    patched({pickups:[{x:1,y:1,kind:"toString"}]}),
    patched({theme:{X:"marble"}}),
    patched({theme:{X:"toString"}}),
    patched({bogus:1}),
    patched({constructor:1})
  ];
  /* __proto__는 Object.assign이 아니라 원본 JSON의 own 프로퍼티로 검사 */
  const protoJson=JSON.stringify(base).replace(/^\{/,`{"__proto__":{"polluted":1},`);
  bad.push(protoJson);
  for(const b of bad){
    const json=typeof b==="string"?b:JSON.stringify(b);
    const before=JSON.stringify(E("STAGES[0]"));
    assert.throws(()=>E(`editorParseImport(${JSON.stringify(json)})`),null,json.slice(0,80));
    assert.strictEqual(JSON.stringify(E("STAGES[0]")),before);
  }
});
ok("P/G 맵 표기 정규화 + 명시 좌표 우선",()=>{
  const m='["#########","#.......#","#..G....#","#.......#","#.......#","#.......#","#.......#","#....P..#","#########"]';
  let d=E(`editorParseImport(${JSON.stringify(m)})`);
  assert.strictEqual(JSON.stringify(d.start),"[5,7]"); assert.strictEqual(JSON.stringify(d.goalPos),"[3,2]");
  assert.strictEqual(d.map[7].charAt(5),"."); assert.strictEqual(d.map[2].charAt(3),".");
  d=E(`editorNormalize({map:${m},start:[1,1],goalPos:[7,7]})`);
  assert.strictEqual(JSON.stringify(d.start),"[1,1]"); assert.strictEqual(JSON.stringify(d.goalPos),"[7,7]");
});
ok("임포트된 테마 매핑 보존 — 없는 키를 만들지 않음",()=>{
  const d=E(`editorNormalize(JSON.parse(JSON.stringify(STAGES[0])))`);
  assert.strictEqual(JSON.stringify(d.theme),JSON.stringify(E("STAGES[0].theme")));
  const d2=E(`editorParseImport(${JSON.stringify(E(`editorExport(${JSON.stringify(d)})`))})`);
  assert.strictEqual(JSON.stringify(d2.theme),JSON.stringify(E("STAGES[0].theme")));
});
ok("테마 미지정 가구 타일은 오류가 아니라 경고",()=>{
  const m='["#########","#.......#","#.......#","#.......#","#...S...#","#.......#","#.......#","#....P.G#","#########"]';
  const d=E(`editorNormalize({map:${m},theme:{"~":"rug"}})`);
  const v=E(`editorValidate(${JSON.stringify(d)})`);
  assert.strictEqual(JSON.stringify(v.errors),"[]");
  assert.ok(v.warnings.some(w=>w.indexOf("바닥으로 취급")>=0));
});
ok("가짜 벽 틈 맵은 지형 연결 끊김 경고",()=>{
  const m='["#########","#....####","#....####","#....####","#########","####....#","####....#","####...P#","#########"]';
  const d=E(`editorNormalize({map:${m},start:[7,7],goalPos:[1,1]})`);
  const v=E(`editorValidate(${JSON.stringify(d)})`);
  assert.ok(v.warnings.some(w=>w.indexOf("지형 연결")>=0));
});
ok("스테이지 1: 고양이 피한 연결 포함 모두 연결됨",()=>{
  const d=E(`editorNormalize(JSON.parse(JSON.stringify(STAGES[0])))`);
  const st=E(`editorState(${JSON.stringify(d)})`);
  assert.strictEqual(E(`editorReachable(${JSON.stringify(st)},false)`),true);
  assert.strictEqual(E(`editorReachable(${JSON.stringify(st)},true)`),true);
});
ok("시작·골이 못 서는 칸이면 연결 불가 판정",()=>{
  const st=E(`(function(){
    var d=editorNewDraft(); d.start=[1,1]; d.goalPos=[7,7];
    d.map[1]="#S.......#";   /* 소파가 시작 칸을 막음 */
    return editorState(d);
  })()`);
  assert.strictEqual(E(`editorReachable(${JSON.stringify(st)},false)`),false);
});
ok("avoidCats: 고양이가 시작/골에 있으면 불가",()=>{
  const r=E(`(function(){
    var d=editorNewDraft(); d.start=[1,1]; d.goalPos=[7,7];
    d.cats=[{type:"A",x:7,y:7,dir:0}];
    var st=editorState(d);
    return [editorReachable(st,false),editorReachable(st,true)];
  })()`);
  assert.strictEqual(JSON.stringify(r),"[true,false]");
});
ok("B 고양이 초기 방향은 dirs[0] (makeCat)",()=>{
  const c=E(`makeCat({type:"B",x:1,y:1,dir:2,dirs:[3,0]},0)`);
  assert.strictEqual(c.dir,3);
});
ok("벽은 기척(sense)을 차단 — 바닥에서는 감지됨",()=>{
  const r=E(`(function(){
    var grid=[];
    for(var y=0;y<9;y++) grid.push(".........".split(''));
    var st={grid:grid,theme:{},cats:[makeCat({type:"A",x:2,y:4,dir:1},0)],
      player:{x:4,y:4},goal:null,pickups:[],fishes:[]};
    var before=senseHit(st,st.cats[0],st.player);
    grid[4][3]="#";
    var after=senseHit(st,st.cats[0],st.player);
    return [before,after];
  })()`);
  assert.strictEqual(JSON.stringify(r),"[true,false]");
});

ok("장롱(W) 테마 맵 검증 통과 + 테마 보존",()=>{
  const d=E(`(function(){
    var d=editorNewDraft();
    d.theme={W:"wardrobe"};
    d.map[1]="#W.......";
    d.start=[1,7]; d.goalPos=[7,1];
    return editorNormalize(JSON.parse(JSON.stringify(d)));
  })()`);
  assert.strictEqual(d.theme.W,"wardrobe");
  assert.ok(d.map[1].indexOf("W")>=0,"맵에 W 타일 존재");
  const v=E(`editorValidate(${JSON.stringify(d)})`);
  assert.strictEqual(JSON.stringify(v.errors),"[]");
});
ok("테마 없는 W도 인간·고양이 모두 못 서는 칸",()=>{
  assert.strictEqual(E("editorHumanTile({},'W')"),false);
  assert.strictEqual(E("editorCatTile({},'W')"),false);
});
ok("시작·골·고양이·먹이를 W 위에 놓으면 오류",()=>{
  const v=E(`(function(){
    var d=editorNewDraft();
    d.map[4]="....W....";  /* (4,4)를 장롱으로 */
    d.start=[4,4]; d.goalPos=[1,1];
    d.cats=[{type:"A",x:4,y:4,dir:0}];
    d.pickups=[{x:4,y:4,kind:"small"}];
    return editorValidate(d);
  })()`);
  assert.ok(v.errors.some(e=>e.indexOf("시작 지점")>=0),"시작");
  assert.ok(v.errors.some(e=>e.indexOf("고양이가 못 서는")>=0),"고양이");
  assert.ok(v.errors.some(e=>e.indexOf("인간이 못 서는")>=0),"먹이");
});
ok("W 골 위치 오류 + 인간 연결에서 W는 막힘",()=>{
  const v=E(`(function(){
    var d=editorNewDraft();
    d.map[7]="....W....";
    d.start=[1,1]; d.goalPos=[4,7];
    return editorValidate(d);
  })()`);
  assert.ok(v.errors.some(e=>e.indexOf("골 지점")>=0),"골");
});

ok("숲 타일 81개 코드 ↔ 문자 ↔ spr 좌표 1:1 대응",()=>{
  const r=E(`(function(){var bad=[];for(var c=100;c<=180;c++){
    var ch=tileCodeToCh(c);
    var x=(c-100)%9, y=Math.floor((c-100)/9);
    if(!ch||!FOREST_TILES[ch]||FOREST_TILES[ch].spr!=="f_"+x+"_"+y) bad.push(c);
    if(tileChToCode(ch)!==c) bad.push(-c);
  }return bad;})()`);
  assert.strictEqual(JSON.stringify(r),"[]");
});
ok("숫자 배열 맵 임포트 → 내보내기 → 재임포트 왕복 동일",()=>{
  const rows=[];for(let y=0;y<9;y++){const r=[];for(let x=0;x<9;x++)r.push(100+y*9+x);rows.push(r);}
  const obj={name:"왕복",theme:{},map:rows,start:[1,7],goalPos:[7,1],cats:[],pickups:[],maxTurns:20,hint:""};
  const d=E(`editorParseImport(${JSON.stringify(JSON.stringify(obj))})`);
  const d2=E(`editorParseImport(editorExport(${JSON.stringify(d)}))`);
  assert.strictEqual(JSON.stringify(d2),JSON.stringify(d));
});
ok("배열 행의 잘못된 코드(99·300·\"Q\")는 거부",()=>{
  const mk=c=>{const rows=[];for(let y=0;y<9;y++){const r=[];for(let x=0;x<9;x++)r.push(100+y*9+x);rows.push(r);}rows[4][4]=c;return JSON.stringify({map:rows});};
  for(const c of [99,300,"Q"]){
    assert.throws(()=>E(`editorParseImport(${JSON.stringify(mk(c))})`),null,"code "+c);
  }
});
ok("배열 행 안의 레거시 한 글자(\"^\")는 허용",()=>{
  const d=E(`(function(){var rows=[];for(var y=0;y<9;y++){var r=[];for(var x=0;x<9;x++)r.push(100+y*9+x);rows.push(r);}
    rows[7][3]="^"; return editorParseImport(JSON.stringify({map:rows,start:[1,7],goalPos:[7,1]}));})()`);
  assert.strictEqual(d.map[7].charAt(3),"^");
});
ok("스테이지 1 맵은 정규화 후 mapRowToCodes로 원본 2xx 코드 왕복",()=>{
  const rows=E(`(function(){var st=editorNormalize(JSON.parse(JSON.stringify(STAGES[0])));
    return {rows:st.map.map(mapRowToCodes), src:STAGES[0].map};})()`);
  assert.strictEqual(rows.rows.length,9);
  for(let y=0;y<9;y++)for(let x=0;x<9;x++)assert.strictEqual(rows.rows[y][x],rows.src[y][x],`y${y}x${x}`);
});
ok("내보내기 JSON은 map 행이 한 줄 배열",()=>{
  const json=E(`editorExport({name:"t",theme:{},map:[[100,101,"^"]],start:null,goalPos:null,cats:[],pickups:[],maxTurns:1,hint:""})`);
  assert.ok(json.indexOf("[100,101,\"^\"]")>=0,"행 한 줄");
  assert.ok(!/\[\s*\n\s*100,\s*\n/.test(json),"원소 펼침 없음");
});

ok("🍫 초콜릿 픽업: 에디터 팔레트·정규화·검증·내보내기 왕복",()=>{
  const r=E(`(function(){
    var d=editorNewDraft(); d.start=[1,7]; d.goalPos=[6,1];
    d.pickups=[{x:3,y:7,kind:"choco"},{x:2,y:7,kind:"small"}];
    var n=editorNormalize(JSON.parse(JSON.stringify(d)));
    var v=editorValidate(n);
    var back=editorParseImport(editorExport(n));
    return {kind:n.pickups[0].kind, errors:v.errors.join("|"),
            round:JSON.stringify(back.pickups), label:KIND.choco.label,
            use:KIND.choco.use, order:FISH_ORDER.indexOf("choco")};
  })()`);
  assert.strictEqual(r.kind,"choco","정규화 후 종류 보존");
  assert.strictEqual(r.errors,"","검증 오류 없음");
  assert.strictEqual(r.round,"[{\"x\":3,\"y\":7,\"kind\":\"choco\"},{\"x\":2,\"y\":7,\"kind\":\"small\"}]","내보내기·재임포트 왕복");
  assert.strictEqual(r.label,"초콜릿");
  assert.strictEqual(r.use,"wait");
  assert.strictEqual(r.order,3,"FISH_ORDER 끝에 추가(기존 3종 순서 불변)");
  /* 생선 3종 순서는 그대로 */
  assert.strictEqual(E(`FISH_ORDER.slice(0,3).join(",")`),"small,big,catnip");
});

ok("솔버: 빈 맵 직선 경로는 클리어 가능",()=>{
  const r=E(`(function(){
    var d=editorNewDraft(); d.start=[1,7]; d.goalPos=[7,1];
    return editorSolve(d,20);
  })()`);
  assert.strictEqual(r.solved,true,"직선 경로 해결");
  assert.ok(r.turns<=20,"턴 한도 안");
  assert.ok(r.path.length>0,"경로 존재");
  assert.strictEqual(r.path[r.path.length-1].t,"move","마지막은 골로 이동");
});
ok("솔버: 벽으로 막힌 골은 클리어 불가",()=>{
  const r=E(`(function(){
    var d=editorNewDraft(); d.start=[1,7];
    /* 골을 벽으로 둘러싼 고립 칸 */
    d.map[1]="#..###..#".replace(/./g,function(c,i){return i===4?".":c;});
    d.map[1]="#..#.#..#"; d.map[2]="#..###..#"; d.goalPos=[4,1];
    return editorSolve(d,15);
  })()`);
  assert.strictEqual(r.unsolvable,true,"봉인된 골은 불가");
});
ok("솔버: 6~스테이지 10는 전부 클리어 가능",()=>{
  for(const i of [5,6,7,8,9]){
    const d=E(`editorNormalize(JSON.parse(JSON.stringify(STAGES[${i}])))`);
    const r=E(`editorSolve(JSON.parse(${JSON.stringify(JSON.stringify(d))}),40)`);
    assert.strictEqual(r.solved,true,`stage ${i+1} solvable (turns=${r.turns})`);
  }
});

console.log(`\n${passed} tests passed`);
