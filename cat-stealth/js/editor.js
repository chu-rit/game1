"use strict";
/* ===== 맵 에디터 UI =====
   data.js · model.js · editor-model.js 위에서 동작하고,
   보드·도구 아이콘은 assets.js/view.js 의 게임 렌더러를 공유해요.
   게임 실행 엔트리(loadStage·controller·loop)는 쓰지 않아요. */
(function(){
var $=function(id){ return document.getElementById(id); };

var TERRAIN_TOOLS=[
  {ch:".",n:"바닥"},{ch:"#",n:"벽"},{ch:"~",n:"러그"},
  {ch:"X",n:"카운터"},{ch:"S",n:"소파"},{ch:"T",n:"식탁"},{ch:"B",n:"침대"},{ch:"W",n:"선반"},
  {ch:"^",n:"발판"},{ch:"H",n:"구멍"},{ch:"U",n:"수풀"}
];
var ENTITY_TOOLS=[
  {id:"start",n:"시작"},{id:"goal",n:"골"},
  {id:"catA",n:"고정 감시"},{id:"catB",n:"교대 감시"},{id:"catC",n:"순찰"},
  {id:"small",n:"작은 생선"},{id:"big",n:"큰 통생선"},{id:"catnip",n:"캣닢"},
  {id:"erase",g:"✕",n:"개체 지우기"},{id:"select",g:"☝",n:"선택"}
];
var TILE_KO={".":"바닥","#":"벽","~":"러그","X":"카운터","S":"소파","T":"식탁","B":"침대","W":"선반","^":"발판","H":"구멍","U":"수풀"};
var CAT_ROLE={A:"고정 감시",B:"교대 감시",C:"순찰"};
var DIR_GLYPH=["↑","→","↓","←"], DIR_NAME=["위","오른쪽","아래","왼쪽"];
var TERRAIN_CLASS={".":"t-dot","#":"t-wall","~":"t-rug","X":"t-X","S":"t-S","T":"t-T","B":"t-B","W":"t-W","^":"t-care","H":"t-H","U":"t-U"};
var SAVE_KEY="catStealthEditorDraft";

var draft=null, tool={kind:"terrain",ch:"."}, sel=null, patrolMode=false;
var undoStack=[], redoStack=[], dirty=false, painting=false, paintSnap=null;

/* ---------- 상태/유틸 ---------- */
function status(msg,bad){ var s=$("edStatus"); s.textContent=msg||""; s.className=bad?"err":""; }
function snap(){ return JSON.stringify(draft); }
function markDirty(){ dirty=true; autosave(); }
function autosave(){ try{ localStorage.setItem(SAVE_KEY,snap()); }catch(e){} }
function pushUndo(){ undoStack.push(snap()); if(undoStack.length>80) undoStack.shift(); redoStack=[]; }
function restore(json){ draft=JSON.parse(json); sel=null; patrolMode=false; renderAll(); }
function confirmReplace(){
  if(!dirty) return true;
  return window.confirm("저장하지 않은 편집 내용이 있어요. 덮어쓸까요?");
}
function cellChar(x,y){ return draft.map[y].charAt(x); }
function setCell(x,y,ch){
  draft.map[y]=draft.map[y].substring(0,x)+ch+draft.map[y].substring(x+1);
}
function entityAt(x,y){
  if(draft.start&&draft.start[0]===x&&draft.start[1]===y) return {kind:"start"};
  if(draft.goalPos&&draft.goalPos[0]===x&&draft.goalPos[1]===y) return {kind:"goal"};
  for(var i=0;i<draft.cats.length;i++) if(draft.cats[i].x===x&&draft.cats[i].y===y) return {kind:"cat",i:i};
  for(var j=0;j<draft.pickups.length;j++) if(draft.pickups[j].x===x&&draft.pickups[j].y===y) return {kind:"pickup",i:j};
  return null;
}

/* ---------- 격자 렌더 ---------- */
var cellEls=[];
function buildGrid(){
  var g=$("edGrid"); g.textContent=""; cellEls=[];
  var corner=document.createElement("div"); corner.className="ax"; g.appendChild(corner);
  for(var x=0;x<N;x++){ var h=document.createElement("div"); h.className="ax"; h.textContent=x; g.appendChild(h); }
  for(var y=0;y<N;y++){
    var rh=document.createElement("div"); rh.className="ax"; rh.textContent=y; g.appendChild(rh);
    for(var x2=0;x2<N;x2++){
      var b=document.createElement("button");
      b.className="cell"; b.dataset.x=x2; b.dataset.y=y;
      b.setAttribute("role","gridcell");
      g.appendChild(b);
      if(!cellEls[y]) cellEls[y]=[];
      cellEls[y][x2]=b;
    }
  }
  g.addEventListener("pointerdown",onCellDown);
  g.addEventListener("pointermove",onCellMove);
  window.addEventListener("pointerup",onPointerUp);
  window.addEventListener("pointercancel",onPointerUp);
  /* 키보드 활성화(Enter/Space) — detail 0 클릭만, 포인터 클릭과 이중 실행 방지 */
  g.addEventListener("click",function(e){
    if(e.detail!==0) return;
    var c=cellFromEvent(e); if(!c) return;
    if(patrolMode&&sel&&sel.kind==="cat"&&draft.cats[sel.i]&&draft.cats[sel.i].type==="C"){
      addPatrolPoint(c.x,c.y); return;
    }
    if(tool.kind==="terrain"){ pushUndo(); paintTerrain(c.x,c.y); markDirty(); renderAll(); }
    else applyEntity(c.x,c.y);
  });
  g.addEventListener("contextmenu",function(e){ e.preventDefault(); });
}

/* 실제 게임 렌더러로 보드를 그려요 (low/board 프리베이크 없이 표시 컨텍스트에 직접) */
function renderBoardArt(){
  var st=editorState(draft), g=dctx;
  g.imageSmoothingEnabled=false; g.clearRect(0,0,CV,CV);
  paintFloor(g,st); paintWalls(g,st); paintWallShadow(g,st); paintGrid(g,st);
  paintFurniture(g,st); paintSpecial(g,st);
  if(st.goal) paintGoalMat(g,st);
  drawPickupEntity(g,st,0);
  var entities=st.cats.map(function(c){return {y:c.y,x:c.x,cat:c};});
  if(st.player) entities.push({y:st.player.y,x:st.player.x,player:true});
  entities.sort(function(a,b){return a.y-b.y||a.x-b.x;});
  entities.forEach(function(e){
    if(e.player) drawHuman(g,{rx:e.x,ry:e.y},0,2,false);
    else{
      var lift=(st.grid[e.y][e.x]==="^")?(e.y*CELL+CELL-3-perchTopPx(e.x,e.y)):0;
      drawCatAt(g,e.x*CELL+CELL/2,e.y*CELL+CELL-3-lift,COATS[e.cat.type],e.cat.dir,e.cat.type,0,{pose:'idle',noEmote:true});
    }
  });
  if(st.player){st.player.rx=st.player.x;st.player.ry=st.player.y;drawBushFront(g,st);}
}

function renderGrid(){
  var danger=$("edDanger").checked?editorDangerTiles(draft):{};
  /* 선택된 C 고양이의 순찰 번호 */
  var pnums={};
  if(sel&&sel.kind==="cat"&&draft.cats[sel.i]&&draft.cats[sel.i].type==="C"){
    var pt=draft.cats[sel.i].patrol||[];
    for(var i=0;i<pt.length;i++) pnums[pt[i][1]*N+pt[i][0]]=i+1;
  }
  for(var y=0;y<N;y++) for(var x=0;x<N;x++){
    var el=cellEls[y][x], ch=cellChar(x,y);
    var dk=danger[y*N+x];
    el.className="cell "+(TERRAIN_CLASS[ch]||"t-dot")+(dk&&dk.beam?" beam":"")+(dk&&dk.sense?" sense":"");
    el.textContent="";
    var ent=entityAt(x,y), label=TILE_KO[ch]||ch;
    if(ent){
      if(ent.kind==="start") label="시작";
      else if(ent.kind==="goal") label="골";
      else if(ent.kind==="pickup") label="먹이 "+(KIND[draft.pickups[ent.i].kind]||{}).label||draft.pickups[ent.i].kind;
      else{
        var c=draft.cats[ent.i];
        label="고양이 · "+(CAT_ROLE[c.type]||c.type);
        var dg=document.createElement("span"); dg.className="dir";
        dg.textContent=DIR_GLYPH[c.type==="B"&&c.dirs?c.dirs[0]:c.dir]; el.appendChild(dg);
      }
    }
    var pn=pnums[y*N+x];
    if(pn){ var ps=document.createElement("span"); ps.className="pnum"; ps.textContent=pn; el.appendChild(ps); }
    if(sel&&sel.kind==="cell"&&sel.x===x&&sel.y===y) el.classList.add("sel");
    if(sel&&sel.kind==="cat"&&draft.cats[sel.i]&&draft.cats[sel.i].x===x&&draft.cats[sel.i].y===y) el.classList.add("sel");
    el.setAttribute("aria-label","("+x+","+y+") "+label);
    el.title=label;
  }
  renderBoardArt();
}

/* ---------- 도구 ---------- */
var toolIcons=[];   /* {cv, terrainCh, entityId} — 에셋 로드 후 다시 그려요 */

/* 게임 렌더러를 그대로 써서 48x48 도구 썸네일을 그려요.
   임시 스테이지: 전부 바닥 + (4,4)에 대상 타일, 가구는 기본 테마. */
function paintToolIcon(cv,terrainCh,entityId){
  var g=cv.getContext("2d");
  g.imageSmoothingEnabled=false;
  g.clearRect(0,0,48,48);
  var d=editorNewDraft();
  for(var y=0;y<N;y++) d.map[y]=".........";
  var st=editorState(d);
  if(terrainCh!=null){
    if(terrainCh!==".") st.grid[4][4]=terrainCh;
    g.save();
    g.translate(-156,-156);   /* (4,4) 칸(160,160,40,40) → 썸네일 (4,4)에 4px 여백 */
    paintFloor(g,st); paintWalls(g,st); paintFurniture(g,st); paintSpecial(g,st);
    g.restore();
    return;
  }
  g.save();
  g.translate(-156,-156);
  paintFloor(g,st);
  g.restore();
  if(entityId==="goal"){ st.goal={x:4,y:4}; g.save(); g.translate(-156,-156); paintGoalMat(g,st); g.restore(); }
  else if(entityId==="start"){
    g.save(); g.translate(24,45); g.scale(0.7,0.7); g.translate(-180,-197);
    drawHuman(g,{rx:4,ry:4},0,2,false); g.restore();
  }
  else if(entityId==="catA"||entityId==="catB"||entityId==="catC"){
    var type=entityId.charAt(3);
    g.save(); g.translate(24,46); g.scale(0.7,0.7);
    drawCatAt(g,0,0,COATS[type],2,type,0,{pose:"idle",noEmote:true,noShadow:true});
    g.restore();
  }
  else if(entityId==="small"||entityId==="big"||entityId==="catnip"){
    drawFishKind(g,24,25,entityId,0,{scale:0.7});
  }
}
function repaintToolIcons(){
  toolIcons.forEach(function(ic){ paintToolIcon(ic.cv,ic.terrainCh,ic.entityId); });
}

function buildTools(){
  var t=$("edTerrainTools"); t.textContent=""; toolIcons=[];
  TERRAIN_TOOLS.forEach(function(tt){
    var b=document.createElement("button"); b.className="tool"; b.dataset.tch=tt.ch;
    var cv=document.createElement("canvas"); cv.width=48; cv.height=48;
    paintToolIcon(cv,tt.ch,null); toolIcons.push({cv:cv,terrainCh:tt.ch,entityId:null});
    b.appendChild(cv);
    b.appendChild(document.createTextNode(tt.n));
    b.addEventListener("click",function(){ setTool({kind:"terrain",ch:tt.ch}); });
    t.appendChild(b);
  });
  var e=$("edEntityTools"); e.textContent="";
  ENTITY_TOOLS.forEach(function(tt){
    var b=document.createElement("button"); b.className="tool"; b.dataset.tid=tt.id;
    if(tt.id==="erase"||tt.id==="select"){
      var g=document.createElement("span"); g.className="g"; g.textContent=tt.g; b.appendChild(g);
    }else{
      var cv2=document.createElement("canvas"); cv2.width=48; cv2.height=48;
      paintToolIcon(cv2,null,tt.id); toolIcons.push({cv:cv2,terrainCh:null,entityId:tt.id});
      b.appendChild(cv2);
    }
    b.appendChild(document.createTextNode(tt.n));
    b.addEventListener("click",function(){ setTool({kind:"entity",id:tt.id}); });
    e.appendChild(b);
  });
}
function setTool(t2){ tool=t2; patrolMode=false;
  document.querySelectorAll("#edTerrainTools .tool").forEach(function(b){
    b.classList.toggle("on",tool.kind==="terrain"&&b.dataset.tch===tool.ch); });
  document.querySelectorAll("#edEntityTools .tool").forEach(function(b){
    b.classList.toggle("on",tool.kind==="entity"&&b.dataset.tid===tool.id); });
  renderSelPanel();
}

/* ---------- 칸 상호작용 ---------- */
function cellFromEvent(e){
  var t=e.target.closest?e.target.closest(".cell"):null;
  if(!t) return null;
  return {x:+t.dataset.x,y:+t.dataset.y};
}
function onCellDown(e){
  if(e.button!==0) return;
  var c=cellFromEvent(e); if(!c) return;
  e.preventDefault();
  if(patrolMode&&sel&&sel.kind==="cat"&&draft.cats[sel.i]&&draft.cats[sel.i].type==="C"){
    addPatrolPoint(c.x,c.y); return;
  }
  if(tool.kind==="terrain"){
    painting=true; paintSnap=snap();
    paintTerrain(c.x,c.y);
  }else{
    applyEntity(c.x,c.y);
  }
}
function onCellMove(e){
  if(!painting) return;
  /* 모바일은 pointerover가 안 오므로 좌표로 칸을 찾아요 */
  var t=document.elementFromPoint(e.clientX,e.clientY);
  var cell=t&&t.closest?t.closest(".cell"):null;
  if(!cell) return;
  paintTerrain(+cell.dataset.x,+cell.dataset.y);
}
function onPointerUp(){
  if(painting){
    painting=false;
    if(paintSnap!==snap()){ undoStack.push(paintSnap); if(undoStack.length>80) undoStack.shift(); redoStack=[]; markDirty(); }
    paintSnap=null;
    renderAll();
  }
}

/* 지형 칠하기 — 개체와 비호환이면 거부 */
function paintTerrain(x,y){
  var ch=tool.ch;
  if(cellChar(x,y)===ch) return;
  /* 테마가 없는 가구 타일을 칠할 때만 기본 테마를 등록 — 로드/임포트는 건드리지 않아요 */
  var theme=draft.theme;
  if(ED_THEME_OPTIONS[ch]&&draft.theme[ch]===undefined){
    theme={}; for(var k in draft.theme){ if(edOwn(draft.theme,k)) theme[k]=draft.theme[k]; }
    theme[ch]=ED_THEME_OPTIONS[ch][0];
  }
  var ent=entityAt(x,y);
  if(ent){
    var ok=false;
    if(ent.kind==="cat") ok=editorCatTile(theme,ch);
    else ok=editorHumanTile(theme,ch);
    if(!ok){ status("개체가 있는 칸이라 칠할 수 없어요 — 먼저 지우세요",true); return; }
  }
  draft.theme=theme;
  setCell(x,y,ch);
  renderCellSoon(x,y);
}
var rafPend=false;
function renderCellSoon(){
  if(rafPend) return; rafPend=true;
  requestAnimationFrame(function(){ rafPend=false; renderGrid(); renderConn(); });
}

/* 개체 도구 — 클릭마다 한 번 */
function applyEntity(x,y){
  var id=tool.id, ch=cellChar(x,y);
  if(id==="select"){
    var ent=entityAt(x,y);
    sel=ent?(ent.kind==="cat"?{kind:"cat",i:ent.i}:{kind:"cell",x:x,y:y}):{kind:"cell",x:x,y:y};
    patrolMode=false; renderAll();
    status(ent?("선택: ("+x+","+y+")"):"빈 칸 ("+x+","+y+")");
    return;
  }
  if(id==="erase"){
    var ent2=entityAt(x,y);
    if(!ent2) return;
    pushUndo();
    if(ent2.kind==="start") draft.start=null;
    else if(ent2.kind==="goal") draft.goalPos=null;
    else if(ent2.kind==="cat"){ draft.cats.splice(ent2.i,1); sel=null; }
    else draft.pickups.splice(ent2.i,1);
    markDirty(); renderAll(); status("개체를 지웠어요");
    return;
  }
  if(id==="start"||id==="goal"){
    if(!editorHumanTile(draft.theme,ch)){ status("인간이 설 수 없는 칸이에요",true); return; }
    var oc=entityAt(x,y);
    if(oc&&oc.kind==="cat"){ status("고양이와 겹칠 수 없어요",true); return; }
    var other=(id==="start")?draft.goalPos:draft.start;
    if(other&&other[0]===x&&other[1]===y){ status("시작과 골은 같은 칸에 둘 수 없어요",true); return; }
    pushUndo();
    if(id==="start") draft.start=[x,y]; else draft.goalPos=[x,y];
    markDirty(); renderAll(); status((id==="start"?"시작":"골")+" 배치 ("+x+","+y+")");
    return;
  }
  if(id==="catA"||id==="catB"||id==="catC"){
    if(!editorCatTile(draft.theme,ch)){ status("고양이가 설 수 없는 칸이에요",true); return; }
    var oc2=entityAt(x,y);
    if(oc2){ status(oc2.kind==="cat"?"이미 고양이가 있어요":"다른 개체와 겹칠 수 없어요",true); return; }
    var type=id.charAt(3);
    var nc={type:type,x:x,y:y,dir:0};
    if(type==="B"){ nc.dirs=[0,2]; nc.dir=0; }
    if(type==="C"){ nc.patrol=[[x,y],[x,y]]; }
    pushUndo();
    draft.cats.push(nc);
    sel={kind:"cat",i:draft.cats.length-1};
    markDirty(); renderAll(); status("고양이 · "+(CAT_ROLE[type]||type)+" 배치 — 아래에서 방향·경로를 정하세요");
    return;
  }
  /* 먹이 */
  if(!editorHumanTile(draft.theme,ch)){ status("먹이를 둘 수 없는 칸이에요",true); return; }
  var oc3=entityAt(x,y);
  if(oc3&&oc3.kind==="pickup"){ pushUndo(); draft.pickups[oc3.i].kind=id; markDirty(); renderAll(); status("먹이 종류를 바꿨어요"); return; }
  if(oc3){ status("다른 개체와 겹칠 수 없어요",true); return; }
  pushUndo();
  draft.pickups.push({x:x,y:y,kind:id});
  markDirty(); renderAll(); status("먹이 배치 ("+x+","+y+")");
}

/* 순찰 경로 찍기 — 선택된 C 고양이에 지점 추가 */
function addPatrolPoint(x,y){
  var c=draft.cats[sel.i]; if(!c||c.type!=="C") return;
  var ch=cellChar(x,y);
  if(!editorCatTile(draft.theme,ch)){ status("고양이가 지날 수 없는 칸이에요",true); return; }
  pushUndo();
  c.patrol=c.patrol||[[c.x,c.y]];
  c.patrol.push([x,y]);
  markDirty(); renderAll(); status("순찰 지점 "+c.patrol.length+" 추가 ("+x+","+y+")");
}

/* ---------- 선택 패널 ---------- */
function renderSelPanel(){
  var info=$("edSelInfo"), body=$("edSelBody");
  body.textContent="";
  if(!sel||sel.kind!=="cat"||!draft.cats[sel.i]){
    info.textContent="개체 선택 도구로 칸을 누르세요";
    return;
  }
  var c=draft.cats[sel.i];
  info.textContent="고양이 "+(sel.i+1)+" · "+(CAT_ROLE[c.type]||c.type)+" · ("+c.x+","+c.y+")";
  { /* A/B/C 모두 초기 방향을 정할 수 있어요 (C는 순찰 이동 전 대기 방향) */
    var d1=document.createElement("div"); d1.className="frow";
    var l1=document.createElement("label"); l1.textContent=(c.type==="B"?"방향 1":"방향");
    d1.appendChild(l1);
    var row1=dirRow(function(d){ pushUndo(); c.dir=d; if(c.type==="B"&&c.dirs)c.dirs[0]=d; markDirty(); renderAll(); },
      c.type==="B"?(c.dirs?c.dirs[0]:c.dir):c.dir);
    d1.appendChild(row1); body.appendChild(d1);
  }
  if(c.type==="A"||c.type==="B"){
    if(c.type==="B"){
      var d2=document.createElement("div"); d2.className="frow";
      var l2=document.createElement("label"); l2.textContent="방향 2";
      d2.appendChild(l2);
      d2.appendChild(dirRow(function(d){ pushUndo(); c.dirs[1]=d; markDirty(); renderAll(); },
        c.dirs?c.dirs[1]:2));
      body.appendChild(d2);
      var nt=document.createElement("div"); nt.className="note";
      nt.textContent="초기 방향은 방향 1이에요. 두 방향을 번갈아 봐요.";
      body.appendChild(nt);
    }
  }
  if(c.type==="C"){
    var pr=document.createElement("div"); pr.className="frow";
    var pl=document.createElement("label"); pl.textContent="순찰";
    pr.appendChild(pl);
    var pb=document.createElement("button"); pb.textContent=patrolMode?"경로 찍기 중… (끝내려면 다시 클릭)":"경로 찍기";
    pb.className=patrolMode?"accent":"";
    pb.addEventListener("click",function(){ patrolMode=!patrolMode; renderSelPanel(); });
    pr.appendChild(pb);
    var cb=document.createElement("button"); cb.textContent="경로 지우기";
    cb.addEventListener("click",function(){ pushUndo(); c.patrol=[[c.x,c.y]]; patrolMode=false; markDirty(); renderAll(); });
    pr.appendChild(cb);
    body.appendChild(pr);
    var pn=document.createElement("div"); pn.className="note";
    pn.textContent="경로 찍기 중 맵의 칸을 누르면 순서대로 지점이 추가돼요(분홍 숫자). 지점은 고양이가 걸을 수 있는 칸만.";
    body.appendChild(pn);
  }
  var del=document.createElement("button"); del.textContent="이 고양이 삭제"; del.style.marginTop="6px";
  del.addEventListener("click",function(){ pushUndo(); draft.cats.splice(sel.i,1); sel=null; markDirty(); renderAll(); });
  body.appendChild(del);
}
function dirRow(cb,cur){
  var row=document.createElement("div"); row.className="dirrow";
  for(var d=0;d<4;d++){
    (function(dd){
      var b=document.createElement("button"); b.className="dirbtn"+(dd===cur?" on":"");
      b.textContent=DIR_GLYPH[dd]; b.setAttribute("aria-label",DIR_NAME[dd]);
      b.addEventListener("click",function(){ cb(dd); });
      row.appendChild(b);
    })(d);
  }
  return row;
}

/* ---------- 검사 패널 ---------- */
function renderConn(){
  var v=editorValidate(draft), el=$("edConn");
  el.textContent="";
  function line(label,ok){
    var d=document.createElement("div");
    var s=document.createElement("span"); s.className=ok?"ok":"no"; s.textContent=ok?"연결됨":"끊김";
    d.appendChild(document.createTextNode(label+": ")); d.appendChild(s);
    el.appendChild(d);
  }
  var st=editorState(draft);
  line("지형 연결", draft.start&&draft.goalPos?editorReachable(st,false):false);
  line("고양이 자리를 피한 연결", draft.start&&draft.goalPos?editorReachable(st,true):false);
  v.warnings.forEach(function(w){
    var d=document.createElement("div"); d.className="warnline"; d.textContent="⚠ "+w; el.appendChild(d);
  });
  if(v.errors.length){
    var ul=document.createElement("ul"); ul.className="errlist";
    v.errors.forEach(function(m){ var li=document.createElement("li"); li.textContent=m; ul.appendChild(li); });
    el.appendChild(ul);
  }
}

/* ---------- 메타 필드 ---------- */
function renderMeta(){
  $("edName").value=draft.name;
  $("edTurns").value=draft.maxTurns;
  $("edHint").value=draft.hint;
  var th=$("edThemes"); th.textContent="";
  /* 기존 테마 키 ∪ 기본 가구 키 — 미지정이면 게임에서 바닥 취급 */
  var keyset={};
  Object.keys(draft.theme).forEach(function(k){ keyset[k]=1; });
  Object.keys(ED_DEFAULT_THEME()).forEach(function(k){ keyset[k]=1; });
  var keys=Object.keys(keyset).sort();
  keys.forEach(function(k){
    var row=document.createElement("div"); row.className="frow";
    var lb=document.createElement("label"); lb.textContent=TILE_KO[k]||("타일 "+k);
    row.appendChild(lb);
    var s=document.createElement("select");
    var cur=draft.theme[k];
    var none=document.createElement("option"); none.value="";
    none.textContent="미지정 (바닥)";
    if(cur===undefined) none.selected=true;
    s.appendChild(none);
    var opts=ED_THEME_OPTIONS[k]||Object.keys(ED_THEME_VALUES);
    if(cur!==undefined&&opts.indexOf(cur)<0) opts=opts.concat([cur]);
    opts.forEach(function(v){
      var o=document.createElement("option"); o.value=v;
      o.textContent=ED_THEME_NAMES[v]||v;
      if(v===cur) o.selected=true;
      s.appendChild(o);
    });
    s.addEventListener("change",function(){
      pushUndo();
      if(s.value==="") delete draft.theme[k]; else draft.theme[k]=s.value;
      markDirty(); renderAll();
    });
    row.appendChild(s);
    th.appendChild(row);
  });
}
function bindMeta(){
  $("edName").addEventListener("change",function(){ pushUndo(); draft.name=$("edName").value; markDirty(); });
  $("edHint").addEventListener("change",function(){ pushUndo(); draft.hint=$("edHint").value; markDirty(); });
  $("edTurns").addEventListener("change",function(){
    var v=Number($("edTurns").value);
    if(!edInt(v)||v<=0){ status("최대 턴은 양의 정수여야 해요",true); $("edTurns").value=draft.maxTurns; return; }
    pushUndo(); draft.maxTurns=v; markDirty();
  });
  $("edDanger").addEventListener("change",renderGrid);
}

/* ---------- 스테이지 목록/불러오기 ---------- */
function buildStageSel(){
  var s=$("edStageSel"); s.textContent="";
  STAGES.forEach(function(st,i){
    var o=document.createElement("option"); o.value=i;
    o.textContent=(i+1)+"단계 · "+(st.name||"이름 없음");
    s.appendChild(o);
  });
}
function loadDraft(d,msg){
  draft=d; sel=null; patrolMode=false; undoStack=[]; redoStack=[]; dirty=false;
  autosave(); renderAll(); status(msg||"");
}
function loadBuiltin(i){
  try{ return editorNormalize(JSON.parse(JSON.stringify(STAGES[i]))); }
  catch(e){ status("스테이지 로드 실패: "+e.message,true); return null; }
}

/* ---------- 내보내기/가져오기 ---------- */
function stageOut(){
  var o={name:draft.name,theme:draft.theme,map:draft.map.slice(),
    start:draft.start,goalPos:draft.goalPos,maxTurns:draft.maxTurns,
    cats:draft.cats.map(function(c){
      var n={type:c.type,x:c.x,y:c.y,dir:c.dir};
      if(c.type==="B") n.dirs=c.dirs.slice();
      if(c.type==="C") n.patrol=c.patrol.map(function(w){return w.slice();});
      return n;
    }),
    pickups:draft.pickups.map(function(p){ return {x:p.x,y:p.y,kind:p.kind}; }),
    hint:draft.hint};
  return o;
}
function doExport(){
  var v=editorValidate(draft);
  if(v.errors.length){ status("구조 오류 "+v.errors.length+"개 — 내보낼 수 없어요",true); renderConn(); return null; }
  var json=editorExport(stageOut());
  $("edJson").value=json;
  status("내보냈어요 — 복사해서 보내주세요"+(v.warnings.length?" (경고 "+v.warnings.length+"개)":""));
  return json;
}
function doDownload(){
  var json=doExport(); if(!json) return;
  var blob=new Blob([json],{type:"application/json"});
  var a=document.createElement("a");
  a.href=URL.createObjectURL(blob); a.download="stage.json";
  document.body.appendChild(a); a.click();
  setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); },0);
}
function doCopy(){
  var json=doExport(); if(!json) return;
  var ta=$("edJson");
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(json).then(function(){ status("클립보드에 복사했어요"); },
      function(){ fallbackCopy(ta); });
  }else fallbackCopy(ta);
}
function fallbackCopy(ta){
  ta.focus(); ta.select();
  var okc=false;
  try{ okc=document.execCommand("copy"); }catch(e){}
  if(okc) status("클립보드에 복사했어요");
  else status("복사 실패 — 선택된 텍스트를 직접 복사하세요",true);
}
function doImport(){
  if(!confirmReplace()) return;
  var d;
  try{ d=editorParseImport($("edJson").value); }
  catch(e){ status("가져오기 실패: "+e.message,true); return; }
  loadDraft(d,"가져왔어요");
}

/* ---------- 테스트 플레이 ---------- */
var playIframe=null, playSnapshot=null, playTimer=null;
function doPlaytest(){
  if(painting) onPointerUp();                       /* 진행 중인 드래그를 먼저 확정 */
  var ae=document.activeElement; if(ae&&ae.blur) ae.blur();  /* 포커스된 입력의 변경을 커밋 */
  var v=editorValidate(draft);
  if(v.errors.length){ status("구조 오류 "+v.errors.length+"개 — 먼저 고쳐 주세요",true); renderConn(); return; }
  playSnapshot=JSON.parse(JSON.stringify(stageOut()));
  $("edPlayErr").textContent="";
  openPlayFrame();
  $("edPlayDialog").showModal();
}
function openPlayFrame(){
  var box=$("edPlayBox");
  $("edPlayErr").textContent="";
  $("edPlayLoading").style.display="";
  $("edPlayRestart").disabled=true;
  if(playIframe){ playIframe.remove(); playIframe=null; }
  playIframe=document.createElement("iframe");
  playIframe.title="맵 테스트 플레이";
  box.appendChild(playIframe);
  clearTimeout(playTimer);
  playTimer=setTimeout(function(){
    if(playIframe){
      $("edPlayLoading").style.display="none";
      $("edPlayErr").textContent="게임을 불러오지 못했어요 — 서버가 켜져 있는지 확인하세요";
    }
  },10000);
  playIframe.src="index.html#editor-playtest";
}
function closePlaytest(){
  clearTimeout(playTimer);
  if(playIframe){ playIframe.remove(); playIframe=null; }   /* 게임 루프·타이머·오디오 정리 */
  var dlg=$("edPlayDialog");
  if(dlg.open) dlg.close();
  $("edPlayTest").focus();
}
window.addEventListener("message",function(e){
  if(!playIframe||e.source!==playIframe.contentWindow||e.origin!==location.origin||!e.data) return;
  var t=e.data.type;
  if(t==="cat-editor:ready"){
    playIframe.contentWindow.postMessage({type:"cat-editor:load",stage:playSnapshot},
      location.origin==="null"?"*":location.origin);
  }else if(t==="cat-editor:started"){
    clearTimeout(playTimer);
    $("edPlayLoading").style.display="none";
    $("edPlayRestart").disabled=false;
    playIframe.contentWindow.focus();
  }else if(t==="cat-editor:error"){
    clearTimeout(playTimer);
    $("edPlayLoading").style.display="none";
    $("edPlayErr").textContent="테스트 시작 실패: "+(e.data.message||"알 수 없는 오류");
  }else if(t==="cat-editor:return"){
    closePlaytest();
  }
});

/* ---------- 실행 취소 ---------- */
function doUndo(){ if(!undoStack.length) return; redoStack.push(snap()); restore(undoStack.pop()); markDirty(); status("되돌렸어요"); }
function doRedo(){ if(!redoStack.length) return; undoStack.push(snap()); restore(redoStack.pop()); markDirty(); status("다시했어요"); }

/* ---------- 렌더 ---------- */
function renderAll(){ renderGrid(); renderSelPanel(); renderConn(); renderMeta();
  $("edUndo").disabled=!undoStack.length; $("edRedo").disabled=!redoStack.length; }

/* 스프라이트가 늦게 디코드돼도 보드·도구 아이콘을 한 번씩 다시 그려요 */
var refreshScheduled=false;
function scheduleVisualRefresh(){
  if(refreshScheduled) return;
  refreshScheduled=true;
  requestAnimationFrame(function(){ refreshScheduled=false; renderGrid(); repaintToolIcons(); });
}
function subscribeAssets(){
  var imgs=[], k;
  for(k in TILEIMG) imgs.push(TILEIMG[k]);
  for(var t in CATIMG) for(var p in CATIMG[t]) for(var d in CATIMG[t][p]) imgs.push(CATIMG[t][p][d]);
  for(k in HUMIMG) imgs.push(HUMIMG[k]);
  for(k in FOODIMG) imgs.push(FOODIMG[k]);
  imgs.forEach(function(im){
    if(im&&im.addEventListener) im.addEventListener("load",scheduleVisualRefresh);
  });
}

/* ---------- 초기화 ---------- */
function init(){
  buildGrid(); buildTools(); buildStageSel(); bindMeta(); subscribeAssets();
  setTool({kind:"terrain",ch:"."});
  $("edLoad").addEventListener("click",function(){
    if(!confirmReplace()) return;
    var d=loadBuiltin(+$("edStageSel").value);
    if(d) loadDraft(d,"스테이지를 불러왔어요");
  });
  $("edStageSel").addEventListener("change",function(){
    $("edLoad").click();
  });
  $("edNew").addEventListener("click",function(){
    if(!confirmReplace()) return;
    loadDraft(editorNewDraft(),"새 맵 — 시작과 골을 배치하세요");
  });
  $("edPlayTest").addEventListener("click",doPlaytest);
  $("edPlayBack").addEventListener("click",closePlaytest);
  $("edPlayRestart").addEventListener("click",function(){
    /* 지금 편집 상태로 다시 테스트 — 이미 열린 게임에 새 스냅샷 주입 */
    playSnapshot=JSON.parse(JSON.stringify(stageOut()));
    $("edPlayErr").textContent="";
    $("edPlayLoading").style.display="";
    $("edPlayRestart").disabled=true;
    playIframe.contentWindow.postMessage({type:"cat-editor:load",stage:playSnapshot},
      location.origin==="null"?"*":location.origin);
  });
  $("edPlayDialog").addEventListener("close",function(){
    /* Escape(cancel)·버튼 어디로 닫혀도 iframe·타이머 정리, 포커스는 버튼으로 */
    clearTimeout(playTimer);
    if(playIframe){ playIframe.remove(); playIframe=null; }
    $("edPlayTest").focus();
  });
  $("edUndo").addEventListener("click",doUndo);
  $("edRedo").addEventListener("click",doRedo);
  $("edImport").addEventListener("click",doImport);
  $("edExport").addEventListener("click",doExport);
  $("edCopy").addEventListener("click",doCopy);
  $("edDl").addEventListener("click",doDownload);
  document.addEventListener("keydown",function(e){
    if($("edPlayDialog").open) return;             /* 테스트 모달 동안 에디터 단축키 잠금 */
    var t=e.target, tag=t&&t.tagName;
    if(tag==="INPUT"||tag==="TEXTAREA"||tag==="SELECT"||(t&&t.isContentEditable)) return;
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="z"){ e.preventDefault(); e.shiftKey?doRedo():doUndo(); }
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="y"){ e.preventDefault(); doRedo(); }
  });

  var d=null, saved=null;
  try{ saved=localStorage.getItem(SAVE_KEY); }catch(e){}
  if(saved){ try{ d=editorParseImport(saved); }catch(e){} }
  if(d){ loadDraft(d,"이전 편집을 복원했어요"); }
  else{ loadDraft(loadBuiltin(0)||editorNewDraft()); }
}
init();
})();
