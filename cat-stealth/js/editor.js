"use strict";
/* ===== 맵 에디터 UI =====
   data.js · model.js · editor-model.js 위에서 동작하고,
   보드·도구 아이콘은 assets.js/view.js 의 게임 렌더러를 공유해요.
   게임 실행 엔트리(loadStage·controller·loop)는 쓰지 않아요. */
(function(){
var $=function(id){ return document.getElementById(id); };

var TILE_KO={".":"바닥","#":"벽","~":"러그","X":"카운터","S":"소파","T":"식탁","B":"침대","W":"선반","^":"발판","H":"구멍","U":"수풀"};
for(var _fk in FOREST_TILES) TILE_KO[_fk]=FOREST_TILES[_fk].name;
/* 지형 도구를 규칙별 그룹으로 — 기본 / 바닥·장식 / 물 / 장애물.
   숲 타일은 FOREST_TILES.rule 로 자동 분류, 그룹 안은 이름순 */
/* 실내(.#~XSTBW)·특수(^HU) 타일은 도구에서 숨김 — 기존 맵에 있으면 그대로 그려지고 판정도 같아요 */
/* 레이어 도구 — 바닥(지형)과 구조물을 따로 칠해요.
   바닥 칠하기는 구조물을, 구조물 칠하기는 바닥을 그대로 둬요 */
var GROUND_TOOLS=["grass","dirt","floor","water"];
var FEAT_TOOLS=LAYER_FEAT.slice(1);   /* null 제외 — 표시 순서만, 코드는 LAYER_FEAT 순서가 정해요 */
/* 아기나무(239)를 나무 도구 맨 앞으로 — LAYER_FEAT 순서(=코드)는 그대로 두고 팔레트만 바꿔요 */
FEAT_TOOLS.splice(FEAT_TOOLS.indexOf("ob_sapling"),1);
FEAT_TOOLS.unshift("ob_sapling");
/* 원본 시트에서 자른 '그림 타일' — 규칙별 그룹, 한 장짜리 타일이라 칸이 통째로 바뀌어요 */
var TERRAIN_GROUPS=[
  {n:"그림 · 바닥·장식",  tools:[]},
  {n:"그림 · 물 (못 지나감·시선 통과)", tools:[]},
  {n:"그림 · 장애물 (이동·시선 차단)",  tools:[]}
];
for(var _ft in FOREST_TILES){
  var _d=FOREST_TILES[_ft];
  if(!_d.spr) continue;              /* 2레이어 타일은 레이어 도구로 칠해요 */
  var _r=_d.rule;
  TERRAIN_GROUPS[_r==="decor"?0:_r==="water"?1:2].tools.push(_ft);
}
TERRAIN_GROUPS.forEach(function(g){
  g.tools.sort(function(a,b){ return tileChToCode(a)-tileChToCode(b); });
});
var ENTITY_TOOLS=[
  {id:"start",n:"시작"},{id:"goal",n:"골"},
  {id:"catA",n:"고정 감시"},{id:"catB",n:"교대 감시"},{id:"catC",n:"순찰"},
  {id:"small",n:"작은 생선"},{id:"big",n:"큰 통생선"},{id:"catnip",n:"캣닢"},{id:"choco",n:"초콜릿"},
  {id:"erase",g:"✕",n:"개체 지우기"},{id:"select",g:"☝",n:"선택"}
];
var CAT_ROLE={A:"고정 감시",B:"교대 감시",C:"순찰"};
var DIR_GLYPH=["↑","→","↓","←"], DIR_NAME=["위","오른쪽","아래","왼쪽"];
var TERRAIN_CLASS={".":"t-dot","#":"t-wall","~":"t-rug","X":"t-X","S":"t-S","T":"t-T","B":"t-B","W":"t-W","^":"t-care","H":"t-H","U":"t-U"};
var SAVE_KEY="catStealthEditorDraft";

var draft=null, tool={kind:"ground",t:"grass"}, sel=null, patrolMode=false;
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
  /* 세트 도구: 칸 위를 지날 때 찍힐 범위를 미리 보여 줘요 */
  g.addEventListener("pointerover",function(e){
    var cell=e.target.closest?e.target.closest(".cell"):null;
    if(cell) setGhostCells(+cell.dataset.x,+cell.dataset.y);
  });
  g.addEventListener("pointerleave",clearSetGhost);
  window.addEventListener("pointerup",onPointerUp);
  window.addEventListener("pointercancel",onPointerUp);
  /* 키보드 활성화(Enter/Space) — detail 0 클릭만, 포인터 클릭과 이중 실행 방지 */
  g.addEventListener("click",function(e){
    if(e.detail!==0) return;
    var c=cellFromEvent(e); if(!c) return;
    if(patrolMode&&sel&&sel.kind==="cat"&&draft.cats[sel.i]&&draft.cats[sel.i].type==="C"){
      addPatrolPoint(c.x,c.y); return;
    }
    if(tool.kind==="terrain"||tool.kind==="ground"||tool.kind==="feat"){ pushUndo(); paintTerrain(c.x,c.y); markDirty(); renderAll(); }
    else if(tool.kind==="set"){ pushUndo(); paintSet(c.x,c.y); markDirty(); renderAll(); }
    else if(tool.kind==="refpaste"){ pushUndo(); paintRefPaste(c.x,c.y); markDirty(); renderAll(); }
    else applyEntity(c.x,c.y);
  });
  g.addEventListener("contextmenu",function(e){ e.preventDefault(); });
}

/* 실제 게임 렌더러로 보드를 그려요 (low/board 프리베이크 없이 표시 컨텍스트에 직접) */
function renderBoardArt(){ drawBoardArt(draft,dctx); }
function drawBoardArt(d,g){
  var st=editorState(d);
  g.imageSmoothingEnabled=false; g.clearRect(0,0,CV,CV);
  paintFloor(g,st); paintWalls(g,st); paintWallShadow(g,st); paintGrid(g,st);
  paintFurniture(g,st); paintSpecial(g,st);
  if(stageHasForest(st)) blendForestSeams(g,st);
  paintTerrainEdges(g,st); paintFeatures(g,st);
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
  drawCanopyFront(g,st);
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
    /* 2레이어 타일 아이콘: 주변을 같은 지형으로 채워 전이 가장자리까지 보여줘요 */
    var nft=FOREST_TILES[terrainCh];
    if(nft&&nft.terrain){
      var bc=terrainBaseChar(nft.terrain);
      if(bc) for(var by=0;by<N;by++) st.grid[by]=st.grid[by].map(function(){return bc;});
    }
    g.save();
    g.translate(-156,-156);   /* (4,4) 칸(160,160,40,40) → 썸네일 (4,4)에 4px 여백 */
    paintFloor(g,st); paintWalls(g,st); paintFurniture(g,st); paintSpecial(g,st);
    paintTerrainEdges(g,st); paintFeatures(g,st,true);
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
  else if(entityId==="small"||entityId==="big"||entityId==="catnip"||entityId==="choco"){
    drawFishKind(g,24,25,entityId,0,{scale:0.7});
  }
}
function repaintToolIcons(){
  toolIcons.forEach(function(ic){
    if(ic.setI!=null) paintSetIcon(ic.cv,TILE_SETS[ic.setI]);
    else if(ic.featErase) paintFeatEraseIcon(ic.cv);
    else if(ic.featId) paintFeatIcon(ic.cv,ic.featId);
    else paintToolIcon(ic.cv,ic.terrainCh,ic.entityId);
  });
}

/* 세트 버튼 미리보기 — 스프라이트를 칸 20px로 나란히 */
function paintSetIcon(cv,set){
  var g=cv.getContext("2d");
  g.imageSmoothingEnabled=false; g.clearRect(0,0,cv.width,cv.height);
  tileSetCells(set).forEach(function(t){
    var ft=FOREST_TILES[t.ch]; if(!ft) return;
    if(ft.terrain){
      var tc=terrainCanvas(ft.terrain);
      if(tc) g.drawImage(tc,0,0,40,40,t.dx*20,t.dy*20,20,20);
    }else{
      var im=TILEIMG[ft.spr];
      if(im&&im.width) g.drawImage(im,t.dx*20,t.dy*20,20,20);
    }
    if(ft.feat){ var fm=TILEIMG[ft.feat]; if(fm&&fm.width) g.drawImage(fm,t.dx*20,t.dy*20,20,20); }
  });
}

/* 구조물 아이콘 — 바닥 없이 개체만 크게 (도구는 개체만 칠하니까) */
function paintFeatIcon(cv,fk){
  var g=cv.getContext("2d");
  g.imageSmoothingEnabled=false; g.clearRect(0,0,cv.width,cv.height);
  g.fillStyle="#232b20"; g.fillRect(0,0,cv.width,cv.height);
  var im=TILEIMG[(FEAT_DRAW[fk]&&FEAT_DRAW[fk].im)||fk];
  if(im&&im.width) g.drawImage(im,4,4,cv.width-8,cv.height-8);
}
/* 구조물 지우기 아이콘 — 어두운 배경에 빨간 ✕ (바닥 그림 없음) */
function paintFeatEraseIcon(cv){
  var g=cv.getContext("2d");
  g.imageSmoothingEnabled=false; g.clearRect(0,0,cv.width,cv.height);
  g.fillStyle="#232b20"; g.fillRect(0,0,cv.width,cv.height);
  g.strokeStyle="#e5484d"; g.lineWidth=4; g.lineCap="round";
  g.beginPath(); g.moveTo(12,12); g.lineTo(36,36); g.moveTo(36,12); g.lineTo(12,36); g.stroke();
}
function buildTools(){
  var t=$("edTerrainTools"); t.textContent=""; toolIcons=[];
  /* 바닥 — 지형 레이어만 칠해요 (구조물은 그대로) */
  var lbg=document.createElement("div"); lbg.className="tglabel"; lbg.textContent="바닥";
  t.appendChild(lbg);
  GROUND_TOOLS.forEach(function(tt){
    var ch=tileForLayers(tt,null);
    var b=document.createElement("button"); b.className="tool terr"; b.dataset.gt=tt;
    b.title="바닥 · "+TERR_NAME[tt]+" — 구조물은 그대로";
    var cv=document.createElement("canvas"); cv.width=48; cv.height=48;
    paintToolIcon(cv,ch,null); toolIcons.push({cv:cv,terrainCh:ch,entityId:null});
    b.appendChild(cv);
    b.addEventListener("click",function(){ setTool({kind:"ground",t:tt}); });
    t.appendChild(b);
  });
  /* 구조물 — 피처 레이어만 칠해요 */
  var lbf=document.createElement("div"); lbf.className="tglabel"; lbf.textContent="구조물";
  t.appendChild(lbf);
  var be=document.createElement("button"); be.className="tool terr"; be.dataset.ft="";
  be.title="구조물 지우기 — 바닥만 남겨요";
  var cve=document.createElement("canvas"); cve.width=48; cve.height=48;
  paintFeatEraseIcon(cve); toolIcons.push({cv:cve,featErase:true});
  be.appendChild(cve);
  be.addEventListener("click",function(){ setTool({kind:"feat",f:null}); });
  t.appendChild(be);
  FEAT_TOOLS.forEach(function(fk){
    var b=document.createElement("button"); b.className="tool terr"; b.dataset.ft=fk;
    var code=tileChToCode(tileForLayers(FEAT_TERR[fk],fk));
    b.title="구조물 · "+FEAT_NAME[fk]+" — 코드 "+code;
    var cv=document.createElement("canvas"); cv.width=48; cv.height=48;
    paintFeatIcon(cv,fk); toolIcons.push({cv:cv,featId:fk});
    b.appendChild(cv);
    var cd=document.createElement("span"); cd.className="tcode"; cd.textContent=code;
    b.appendChild(cd);
    b.addEventListener("click",function(){ setTool({kind:"feat",f:fk}); });
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
function setTool(t2){ tool=t2; patrolMode=false; clearSetGhost();
  document.querySelectorAll("#edTerrainTools .tool").forEach(function(b){
    b.classList.toggle("on",(tool.kind==="terrain"&&b.dataset.tch===tool.ch)||
                            (tool.kind==="set"&&+b.dataset.si===tool.si)||
                            (tool.kind==="ground"&&b.dataset.gt===tool.t)||
                            (tool.kind==="feat"&&b.dataset.ft===String(tool.f||""))); });
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
/* 세트 도구 유령 미리보기 — 칠해질 칸에 윤곽을 띄워요 */
function clearSetGhost(){
  for(var y=0;y<cellEls.length;y++) for(var x=0;x<cellEls[y].length;x++)
    cellEls[y][x].classList.remove("setghost");
}
function setGhostCells(x,y){
  clearSetGhost();
  var cells=null;
  if(tool.kind==="set"&&TILE_SETS[tool.si]) cells=tileSetCells(TILE_SETS[tool.si]);
  else if(tool.kind==="refpaste"&&tool.cells) cells=tool.cells;
  else if(tool.kind==="terrain"||tool.kind==="ground") cells=[{dx:0,dy:0}];
  else if(tool.kind==="feat"){
    /* 2칸짜리 구조물은 덮이는 칸까지 같이 표시해요 */
    var cfg=FEAT_DRAW[tool.f];
    cells=cfg&&cfg.a==="span2"?[{dx:0,dy:0},{dx:1,dy:0}]
        :cfg&&cfg.a==="block2"?[{dx:0,dy:0},{dx:1,dy:0},{dx:0,dy:1},{dx:1,dy:1}]
        :[{dx:0,dy:0}];
  }
  if(!cells) return;
  cells.forEach(function(t){
    var tx=x+t.dx, ty=y+t.dy;
    if(tx>=0&&ty>=0&&tx<N&&ty<N) cellEls[ty][tx].classList.add("setghost");
  });
}

function onCellDown(e){
  if(e.button!==0) return;
  var c=cellFromEvent(e); if(!c) return;
  e.preventDefault();
  if(patrolMode&&sel&&sel.kind==="cat"&&draft.cats[sel.i]&&draft.cats[sel.i].type==="C"){
    addPatrolPoint(c.x,c.y); return;
  }
  if(tool.kind==="terrain"||tool.kind==="ground"||tool.kind==="feat"||tool.kind==="set"||tool.kind==="refpaste"){
    painting=true; paintSnap=snap();
    if(tool.kind==="set") paintSet(c.x,c.y);
    else if(tool.kind==="refpaste") paintRefPaste(c.x,c.y);
    else paintTerrain(c.x,c.y);
  }else{
    applyEntity(c.x,c.y);
  }
}
function onCellMove(e){
  if(!painting||(tool.kind!=="terrain"&&tool.kind!=="ground"&&tool.kind!=="feat")) return;   /* 세트·붙여넣기는 드래그로 여러 번 찍지 않아요 */
  /* 모바일은 pointerover가 안 오므로 좌표로 칸을 찾아요 */
  var t=document.elementFromPoint(e.clientX,e.clientY);
  var cell=t&&t.closest?t.closest(".cell"):null;
  if(!cell) return;
  paintTerrain(+cell.dataset.x,+cell.dataset.y);
}
function onPointerUp(){
  if(refDrag) finishRefDrag();
  if(painting){
    painting=false;
    if(paintSnap!==snap()){ undoStack.push(paintSnap); if(undoStack.length>80) undoStack.shift(); redoStack=[]; markDirty(); }
    paintSnap=null;
    renderAll();
  }
}

/* 칠하기 — 바닥은 구조물을, 구조물은 바닥을 그대로 두고 한 층만 바꿔요.
   레거시(그림) 타일을 칠할 때는 칸이 통째로 바뀌어요. 개체와 비호환이면 거부 */
function paintTerrain(x,y){
  var ch=cellChar(x,y), ft=FOREST_TILES[ch];
  if(tool.kind==="ground"){
    var nc=tileForLayers(tool.t,(ft&&ft.feat)||null);
    if(nc) paintCellChar(x,y,nc);
    return;
  }
  if(tool.kind==="feat"){
    var terr=(ft&&ft.terrain)?ft.terrain:(tool.f?(FEAT_TERR[tool.f]||"floor"):"grass");
    var nc2=tileForLayers(terr,tool.f);
    if(nc2){
      paintCellChar(x,y,nc2);
      /* span2·block2는 덮이는 칸의 구조물도 지워요 — 안 보이는데 이동만 막는 장애물이 안 남게 */
      var cfg=FEAT_DRAW[tool.f];
      var offs=cfg&&cfg.a==="span2"?[[1,0]]:cfg&&cfg.a==="block2"?[[1,0],[0,1],[1,1]]:null;
      if(offs) offs.forEach(function(o){
        var cf=FOREST_TILES[cellChar(x+o[0],y+o[1])];
        if(cf&&cf.feat){ var cc=tileForLayers(cf.terrain,null); if(cc) paintCellChar(x+o[0],y+o[1],cc); }
      });
    }
    return;
  }
  paintCellChar(x,y,tool.ch);
}
/* 타일 세트 스탬프 — 클릭한 칸이 세트의 왼쪽 위 */
function paintSet(x,y){
  var set=TILE_SETS[tool.si]; if(!set) return;
  paintBlockCells(x,y,tileSetCells(set));
}
/* 참고 맵에서 복사한 영역 붙여넣기 */
function paintRefPaste(x,y){ if(tool.cells) paintBlockCells(x,y,tool.cells); }
/* 여러 칸 스탬프 공통 — 경계 밖·개체 비호환 칸은 건너뛰어요 */
function paintBlockCells(x,y,cells){
  var skipped=0;
  cells.forEach(function(t){
    var tx=x+t.dx, ty=y+t.dy;
    if(tx<0||ty<0||tx>=N||ty>=N) return;
    var ent=entityAt(tx,ty);
    if(ent){
      var ok=ent.kind==="cat"?editorCatTile(draft.theme,t.ch):editorHumanTile(draft.theme,t.ch);
      if(!ok){ skipped++; return; }
    }
    paintCellChar(tx,ty,t.ch);
  });
  if(skipped) status(skipped+"칸은 개체가 있어 건너뛰었어요");
}
function paintCellChar(x,y,ch){
  if(x<0||y<0||x>=N||y>=N) return;
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
/* ---------- 참고용 맵 (읽기 전용 + 영역 선택 붙여넣기) ---------- */
var refDraft=null, refDrag=null, refRect=null;
var REFCELL=40;   /* 캔버스상 칸 크기(게임 CELL과 같음) */

function initRef(){
  var sel=$("edRefSel"), cv=$("edRefCv");
  STAGES.forEach(function(s,i){
    var o=document.createElement("option"); o.value=i;
    o.textContent=(i+1)+"단계 · "+(s.name||("스테이지 "+(i+1)));
    sel.appendChild(o);
  });
  $("edRefLoad").addEventListener("click",function(){ loadRefStage(+sel.value); });
  $("edRefClear").addEventListener("click",function(){
    refDraft=null; refRect=null; refDrag=null;
    cv.getContext("2d").clearRect(0,0,cv.width,cv.height);
    $("edRefHint").textContent="스테이지를 골라 불러오세요";
  });
  cv.addEventListener("pointerdown",onRefDown);
  cv.addEventListener("pointermove",onRefMove);
  cv.addEventListener("contextmenu",function(e){ e.preventDefault(); });
}

function loadRefStage(i){
  try{ refDraft=editorNormalize(JSON.parse(JSON.stringify(STAGES[i]))); }
  catch(e){ status("참고 맵 로드 실패: "+e.message,true); return; }
  refRect=null; refDrag=null;
  drawRef();
  $("edRefHint").textContent="드래그로 영역을 고르면 위 맵에 클릭해 붙여넣을 수 있어요";
}

function drawRef(){
  if(!refDraft) return;
  var g=$("edRefCv").getContext("2d");
  drawBoardArt(refDraft,g);
  var r=refDrag||refRect;
  if(r){
    var x0=Math.min(r.x0,r.x1)*REFCELL, y0=Math.min(r.y0,r.y1)*REFCELL;
    var w=(Math.abs(r.x1-r.x0)+1)*REFCELL, h=(Math.abs(r.y1-r.y0)+1)*REFCELL;
    g.fillStyle="rgba(255,217,166,0.18)"; g.fillRect(x0,y0,w,h);
    g.strokeStyle="#ffd9a6"; g.lineWidth=2; g.strokeRect(x0+1,y0+1,w-2,h-2);
  }
}

function refCellFromEvent(e){
  var cv=$("edRefCv"), r=cv.getBoundingClientRect();
  var ts=r.width/N;
  var x=Math.floor((e.clientX-r.left)/ts), y=Math.floor((e.clientY-r.top)/ts);
  return {x:Math.max(0,Math.min(N-1,x)), y:Math.max(0,Math.min(N-1,y))};
}
function onRefDown(e){
  if(!refDraft||e.button!==0) return;
  e.preventDefault();
  var c=refCellFromEvent(e);
  refDrag={x0:c.x,y0:c.y,x1:c.x,y1:c.y}; refRect=null;
  drawRef();
}
function onRefMove(e){
  if(!refDrag) return;
  var c=refCellFromEvent(e);
  refDrag.x1=c.x; refDrag.y1=c.y;
  drawRef();
}
function finishRefDrag(){
  var r=refDrag; refDrag=null; if(!r) return;
  var x0=Math.min(r.x0,r.x1), x1=Math.max(r.x0,r.x1);
  var y0=Math.min(r.y0,r.y1), y1=Math.max(r.y0,r.y1);
  refRect={x0:x0,y0:y0,x1:x1,y1:y1};
  var cells=[];
  for(var y=y0;y<=y1;y++) for(var x=x0;x<=x1;x++)
    cells.push({dx:x-x0,dy:y-y0,ch:refDraft.map[y].charAt(x)});
  setTool({kind:"refpaste",cells:cells});
  drawRef();
  status("참고 영역 "+(x1-x0+1)+"×"+(y1-y0+1)+" 선택 — 위 맵을 클릭해 붙여넣어요 (Esc 해제)");
  $("edRefHint").textContent="영역 선택됨 — 위 맵 클릭으로 붙여넣기 · 다시 드래그하면 새로 골라요";
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
  var o={name:draft.name,theme:draft.theme};
  o.map=draft.map.map(mapRowToCodes);   /* 내보낼 때만 숲 타일을 1xx 숫자 코드로 */
  o.start=draft.start; o.goalPos=draft.goalPos; o.maxTurns=draft.maxTurns;
  o.cats=draft.cats.map(function(c){
      var n={type:c.type,x:c.x,y:c.y,dir:c.dir};
      if(c.type==="B") n.dirs=c.dirs.slice();
      if(c.type==="C") n.patrol=c.patrol.map(function(w){return w.slice();});
      return n;
    });
  o.pickups=draft.pickups.map(function(p){ return {x:p.x,y:p.y,kind:p.kind}; });
  o.hint=draft.hint;
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
/* file:// 로 열면 iframe 메시지 origin이 "null" — source(우리 iframe) 고정이라 그 경우도 허용 */
function edMsgOriginOK(e){ return e.origin===location.origin||(e.origin==="null"&&location.protocol==="file:"); }
/* file:// 에서는 상대 origin이 "null" 이라 구체 origin으론 못 받아요 → "*" 사용 */
function edMsgTargetOrigin(){ return (location.origin==="null"||location.protocol==="file:")?"*":location.origin; }
window.addEventListener("message",function(e){
  if(!playIframe||e.source!==playIframe.contentWindow||!edMsgOriginOK(e)||!e.data) return;
  var t=e.data.type;
  if(t==="cat-editor:ready"){
    playIframe.contentWindow.postMessage({type:"cat-editor:load",stage:playSnapshot},
      edMsgTargetOrigin());
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
  requestAnimationFrame(function(){ refreshScheduled=false; renderGrid(); repaintToolIcons(); drawRef(); });
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
  buildGrid(); buildTools(); buildStageSel(); bindMeta(); subscribeAssets(); initRef();
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
      edMsgTargetOrigin());
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
    if(e.key==="Escape"&&tool.kind==="refpaste"){ setTool({kind:"entity",id:"select"}); status("붙여넣기 해제"); }
  });

  var d=null, saved=null;
  try{ saved=localStorage.getItem(SAVE_KEY); }catch(e){}
  if(saved){ try{ d=editorParseImport(saved); }catch(e){} }
  if(d){ loadDraft(d,"이전 편집을 복원했어요"); }
  else{ loadDraft(loadBuiltin(0)||editorNewDraft()); }
}
init();
})();
