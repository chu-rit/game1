"use strict";
/* ===== 맵 에디터 순수 로직 =====
   게임 규칙은 건드리지 않고, data.js/model.js 의 상수와 함수를 그대로 빌려
   스테이지 JSON을 정규화·검증·내보내기 해요. */

var ED_MAP_CHARS={".":1,"#":1,"~":1,"X":1,"S":1,"T":1,"B":1,"W":1,"^":1,"H":1,"U":1,"P":1,"G":1};
for(var _ec in FOREST_TILES) ED_MAP_CHARS[_ec]=1;   /* 숲 타일(FOREST_TILES)도 맵 문자로 허용 */
var ED_THEME_VALUES={counter:1,nightstand:1,sofa:1,table:1,bed:1,wardrobe:1,rug:1};
var ED_THEME_OPTIONS={X:["counter","nightstand"],S:["sofa"],T:["table"],B:["bed"],W:["wardrobe"],"~":["rug"]};
var ED_THEME_NAMES={counter:"부엌 카운터",nightstand:"협탁",sofa:"소파",table:"식탁",bed:"침대",wardrobe:"선반",rug:"러그"};
var ED_DEFAULT_THEME=function(){ return {X:"counter",S:"sofa",T:"table",B:"bed",W:"wardrobe","~":"rug"}; };
var ED_STAGE_KEYS={name:1,theme:1,map:1,start:1,goalPos:1,cats:1,pickups:1,maxTurns:1,hint:1};
var ED_CAT_KEYS={type:1,x:1,y:1,dir:1,dirs:1,patrol:1};
var ED_PICKUP_KEYS={x:1,y:1,kind:1};

function edErr(msg){ var e=new Error(msg); e.edError=true; return e; }
function edOwn(obj,key){ return Object.prototype.hasOwnProperty.call(obj,key); }
function edInt(v){ return typeof v==="number"&&isFinite(v)&&Math.floor(v)===v; }
function edCoord(v){
  if(!Array.isArray(v)||v.length!==2||!edInt(v[0])||!edInt(v[1])) return null;
  if(v[0]<0||v[1]<0||v[0]>=N||v[1]>=N) return null;
  return [v[0],v[1]];
}
function edCheckKeys(obj,allow,what){
  for(var k in obj){ if(edOwn(obj,k)&&!edOwn(allow,k)) throw edErr(what+"에 알 수 없는 필드 '"+k+"'"); }
}

/* 빈 초안: 테두리 벽 + 바닥, 시작/골 없음 */
function editorNewDraft(){
  var map=[];
  for(var y=0;y<N;y++) map.push((y===0||y===N-1)?"#########":"#.......#");
  return {name:"새 스테이지",theme:ED_DEFAULT_THEME(),map:map,start:null,goalPos:null,
          cats:[],pickups:[],maxTurns:20,hint:""};
}

/* 임포트/복제용 정규화 — 잘못된 입력은 throw, 원본 불변 */
function editorNormalize(src){
  if(!src||typeof src!=="object"||Array.isArray(src)) throw edErr("스테이지 객체가 아니에요");
  edCheckKeys(src,ED_STAGE_KEYS,"스테이지");
  if(!Array.isArray(src.map)||src.map.length!==N) throw edErr("map은 9줄이어야 해요");
  var map=[], start=null, goal=null, pCnt=0, gCnt=0;
  for(var y=0;y<N;y++){
    var row=src.map[y];
    /* 행은 문자열(레거시) 또는 길이 9 배열(숲 숫자 코드 또는 한 글자 문자열) 둘 다 허용 */
    if(Array.isArray(row)){
      if(row.length!==N) throw edErr("map "+(y+1)+"줄 길이가 9가 아니에요");
      var crow="";
      for(var ai=0;ai<N;ai++){
        var el=row[ai], eok=false;
        if(typeof el==="number"){ eok=(tileCodeToCh(el)!=null); }
        else if(typeof el==="string"&&el.length===1){ eok=edOwn(ED_MAP_CHARS,el); }
        if(!eok) throw edErr("알 수 없는 타일 코드 '"+el+"' ("+ai+","+y+")");
        crow+=tileCodeToCh(el);
      }
      row=crow;
    }
    if(typeof row!=="string"||row.length!==N) throw edErr("map "+(y+1)+"줄 길이가 9가 아니에요");
    var out="";
    for(var x=0;x<N;x++){
      var ch=row.charAt(x);
      if(!edOwn(ED_MAP_CHARS,ch)) throw edErr("알 수 없는 타일 '"+ch+"' ("+x+","+y+")");
      if(ch==="P"){ pCnt++; start=[x,y]; ch="."; }
      else if(ch==="G"){ gCnt++; goal=[x,y]; ch="."; }
      out+=ch;
    }
    map.push(out);
  }
  if(pCnt>1) throw edErr("시작(P)이 여러 개예요");
  if(gCnt>1) throw edErr("골(G)이 여러 개예요");
  /* 모델 로더와 동일: 명시 좌표가 있으면 P/G 표기보다 우선 */
  if(src.start!=null){ start=edCoord(src.start); if(!start) throw edErr("start 좌표가 올바르지 않아요"); }
  if(src.goalPos!=null){ goal=edCoord(src.goalPos); if(!goal) throw edErr("goalPos 좌표가 올바르지 않아요"); }

  var theme;
  if(src.theme==null){ theme=ED_DEFAULT_THEME(); }
  else{
    if(typeof src.theme!=="object"||Array.isArray(src.theme)) throw edErr("theme이 객체가 아니에요");
    theme={};
    for(var tk in src.theme){
      if(!Object.prototype.hasOwnProperty.call(src.theme,tk)) continue;
      if(tk.length!==1) throw edErr("theme 키는 한 글자여야 해요: '"+tk+"'");
      if(typeof src.theme[tk]!=="string"||!edOwn(ED_THEME_VALUES,src.theme[tk])) throw edErr("알 수 없는 테마 '"+src.theme[tk]+"'");
      theme[tk]=src.theme[tk];
    }
  }

  var cats=[];
  if(src.cats!=null){
    if(!Array.isArray(src.cats)) throw edErr("cats가 배열이 아니에요");
    for(var ci=0;ci<src.cats.length;ci++){
      var c=src.cats[ci];
      if(!c||typeof c!=="object"||Array.isArray(c)) throw edErr("고양이 "+(ci+1)+"이 객체가 아니에요");
      edCheckKeys(c,ED_CAT_KEYS,"고양이 "+(ci+1));
      if(c.type!=="A"&&c.type!=="B"&&c.type!=="C") throw edErr("고양이 "+(ci+1)+" 타입이 올바르지 않아요(A/B/C)");
      if(!edInt(c.x)||!edInt(c.y)||c.x<0||c.y<0||c.x>=N||c.y>=N) throw edErr("고양이 "+(ci+1)+" 좌표가 올바르지 않아요");
      var nc={type:c.type,x:c.x,y:c.y,dir:(c.dir==null?0:c.dir)};
      if(!edInt(nc.dir)||nc.dir<0||nc.dir>3) throw edErr("고양이 "+(ci+1)+" 방향은 0~3이어야 해요");
      if(c.dirs!=null){
        if(!Array.isArray(c.dirs)||c.dirs.length!==2||!edInt(c.dirs[0])||!edInt(c.dirs[1])||
           c.dirs[0]<0||c.dirs[0]>3||c.dirs[1]<0||c.dirs[1]>3) throw edErr("고양이 "+(ci+1)+" dirs가 올바르지 않아요");
        nc.dirs=[c.dirs[0],c.dirs[1]];
      }
      if(c.patrol!=null){
        if(!Array.isArray(c.patrol)||c.patrol.length<1) throw edErr("고양이 "+(ci+1)+" patrol이 올바르지 않아요");
        var pt=[];
        for(var pi=0;pi<c.patrol.length;pi++){
          var w=edCoord(c.patrol[pi]);
          if(!w) throw edErr("고양이 "+(ci+1)+" 순찰 좌표가 올바르지 않아요");
          pt.push(w);
        }
        nc.patrol=pt;
      }
      if(nc.type==="B"&&!nc.dirs) throw edErr("교대 감시(B) 고양이 "+(ci+1)+"에 dirs가 필요해요");
      if(nc.type==="C"&&!nc.patrol) throw edErr("순회(C) 고양이 "+(ci+1)+"에 patrol이 필요해요");
      if(nc.type!=="B"&&nc.dirs) throw edErr("고양이 "+(ci+1)+"에는 dirs를 쓸 수 없어요");
      if(nc.type!=="C"&&nc.patrol) throw edErr("고양이 "+(ci+1)+"에는 patrol을 쓸 수 없어요");
      cats.push(nc);
    }
  }

  var pickups=[];
  if(src.pickups!=null){
    if(!Array.isArray(src.pickups)) throw edErr("pickups가 배열이 아니에요");
    for(var ki=0;ki<src.pickups.length;ki++){
      var p=src.pickups[ki];
      if(!p||typeof p!=="object"||Array.isArray(p)) throw edErr("먹이 "+(ki+1)+"이 객체가 아니에요");
      edCheckKeys(p,ED_PICKUP_KEYS,"먹이 "+(ki+1));
      if(!edInt(p.x)||!edInt(p.y)||p.x<0||p.y<0||p.x>=N||p.y>=N) throw edErr("먹이 "+(ki+1)+" 좌표가 올바르지 않아요");
      if(typeof p.kind!=="string"||!edOwn(KIND,p.kind)) throw edErr("먹이 "+(ki+1)+" 종류가 올바르지 않아요(small/big/catnip)");
      pickups.push({x:p.x,y:p.y,kind:p.kind});
    }
  }

  var maxTurns=(src.maxTurns==null?20:src.maxTurns);
  if(!edInt(maxTurns)||maxTurns<=0) throw edErr("maxTurns는 양의 정수여야 해요");
  var name=(src.name==null?"새 스테이지":src.name);
  if(typeof name!=="string") throw edErr("name은 문자열이어야 해요");
  var hint=(src.hint==null?"":src.hint);
  if(typeof hint!=="string") throw edErr("hint는 문자열이어야 해요");
  return {name:name,theme:theme,map:map,start:start,goalPos:goal,
          cats:cats,pickups:pickups,maxTurns:maxTurns,hint:hint};
}

/* 붙여넣기 임포트: 스테이지 객체 또는 9줄 map 배열(JSON) 둘 다 허용 */
function editorParseImport(text){
  var v;
  try{ v=JSON.parse(text); }catch(e){ throw edErr("JSON 형식이 아니에요"); }
  if(Array.isArray(v)) v={map:v};   /* 맵만 붙여넣은 경우 */
  return editorNormalize(v);
}

/* 오버레이용 런타임 상태 — beamTiles/senseHit/walkable 이 요구하는 최소 형태 */
function editorState(stage) {
  return {grid:stage.map.map(function(r){return r.split('');}),theme:stage.theme,
    player:stage.start?{x:stage.start[0],y:stage.start[1]}:null,
    goal:stage.goalPos?{x:stage.goalPos[0],y:stage.goalPos[1]}:null,
    cats:stage.cats.map(makeCat),pickups:stage.pickups||[],fishes:[]};
}
/* map 행은 한 줄 배열로 읽기 쉽게 접고, 나머지 필드는 기존 2칸 들여쓰기 유지 */
function editorExport(stage){
  var mapJson=null;
  var body=JSON.stringify(stage,function(k,v){ if(k==="map"){ mapJson=v; return "__EDMAP__"; } return v; },2);
  if(mapJson==null) return body;
  var lines=mapJson.map(function(r){ return "    "+JSON.stringify(r); });
  return body.replace('"__EDMAP__"',"[\n"+lines.join(",\n")+"\n  ]");
}

/* 단일 타일 문자 기준 이동 가능 여부(엔티티 호환성 판정용) */
function editorHumanTile(theme,ch){
  if(ch==="#"||ch==="W") return false;   /* W 장롱은 모델이 하드코드로 막아요 */
  var sp=SPECIAL[ch];
  if(sp) return !!sp.human;
  return !(theme[ch]!==undefined&&!DECOR[ch]);
}
function editorCatTile(theme,ch){
  if(ch==="#"||ch==="W") return false;
  var sp=SPECIAL[ch];
  if(sp) return !!sp.cat;
  return !(theme[ch]!==undefined&&!DECOR[ch]);
}

/* 시작→골 BFS. avoidCats=true 면 고양이가 앉은 칸도 못 지나감 */
function editorReachable(st,avoidCats){
  if(!st.player||!st.goal) return false;
  if(!humanWalkable(st,st.player.x,st.player.y)||!humanWalkable(st,st.goal.x,st.goal.y)) return false;
  var catAt=function(x,y){
    for(var i=0;i<st.cats.length;i++){ if(st.cats[i].x===x&&st.cats[i].y===y) return true; }
    return false;
  };
  if(avoidCats&&(catAt(st.player.x,st.player.y)||catAt(st.goal.x,st.goal.y))) return false;
  var seen={}, key=function(x,y){return y*N+x;}, q=[{x:st.player.x,y:st.player.y}];
  seen[key(st.player.x,st.player.y)]=1;
  while(q.length){
    var cur=q.shift();
    if(cur.x===st.goal.x&&cur.y===st.goal.y) return true;
    for(var d=0;d<4;d++){
      var nx=cur.x+DIRS[d][0], ny=cur.y+DIRS[d][1];
      if(!humanWalkable(st,nx,ny)) continue;
      if(avoidCats&&catAt(nx,ny)) continue;
      var k=key(nx,ny);
      if(seen[k]) continue;
      seen[k]=1; q.push({x:nx,y:ny});
    }
  }
  return false;
}

/* 고양이 발 기준 BFS(순찰 경로 연결 검사) — 다른 고양이 자리는 피함 */
function editorCatPath(st,from,to,self){
  if(from.x===to.x&&from.y===to.y) return true;
  var seen={}, key=function(x,y){return y*N+x;}, q=[{x:from.x,y:from.y}];
  seen[key(from.x,from.y)]=1;
  while(q.length){
    var cur=q.shift();
    for(var d=0;d<4;d++){
      var nx=cur.x+DIRS[d][0], ny=cur.y+DIRS[d][1];
      if(!catWalkable(st,nx,ny)) continue;
      var blocked=false;
      for(var i=0;i<st.cats.length;i++){
        var oc=st.cats[i];
        if(oc!==self&&oc.x===nx&&oc.y===ny){ blocked=true; break; }
      }
      if(blocked) continue;
      var k=key(nx,ny);
      if(seen[k]) continue;
      if(nx===to.x&&ny===to.y) return true;
      seen[k]=1; q.push({x:nx,y:ny});
    }
  }
  return false;
}

/* 구조 오류(내보내기 거부)와 경고(연결/시작 발각) 분리 */
function editorValidate(draft){
  var errors=[], warnings=[];
  var st=editorState(draft);
  var chAt=function(x,y){ return draft.map[y].charAt(x); };
  var catCell=function(x,y,skip){
    for(var i=0;i<draft.cats.length;i++){ if(i!==skip&&draft.cats[i].x===x&&draft.cats[i].y===y) return draft.cats[i]; }
    return null;
  };
  if(!draft.start) errors.push("시작 지점이 없어요");
  if(!draft.goalPos) errors.push("골 지점이 없어요");
  if(draft.start&&!editorHumanTile(draft.theme,chAt(draft.start[0],draft.start[1])))
    errors.push("시작 지점이 인간이 못 서는 칸이에요");
  if(draft.goalPos&&!editorHumanTile(draft.theme,chAt(draft.goalPos[0],draft.goalPos[1])))
    errors.push("골 지점이 인간이 못 서는 칸이에요");
  if(draft.start&&draft.goalPos&&draft.start[0]===draft.goalPos[0]&&draft.start[1]===draft.goalPos[1])
    errors.push("시작과 골이 같은 칸이에요");

  /* 맵에 쓰인 가구 글자마다 테마가 있어야 게임에서 벽으로 동작해요 */
  var pkCells={};
  for(var y=0;y<N;y++) for(var x=0;x<N;x++){
    var ch=chAt(x,y);
    if(!DECOR[ch]&&ch!=="."&&ch!=="#"&&ch!=="W"&&!SPECIAL[ch]&&draft.theme[ch]===undefined)
      warnings.push("타일 '"+ch+"'("+x+","+y+")의 테마가 없어 바닥으로 취급돼요");
  }

  for(var ci=0;ci<draft.cats.length;ci++){
    var c=draft.cats[ci], tag="고양이 "+(ci+1)+"("+c.type+")";
    if(!editorCatTile(draft.theme,chAt(c.x,c.y))) errors.push(tag+"이(가) 고양이가 못 서는 칸에 있어요");
    if(catCell(c.x,c.y,ci)) errors.push(tag+"이(가) 다른 고양이와 겹쳐 있어요");
    if(draft.start&&draft.start[0]===c.x&&draft.start[1]===c.y) errors.push(tag+"이(가) 시작 지점과 겹쳐 있어요");
    if(c.type==="B"){
      if(!c.dirs||c.dirs.length!==2) errors.push(tag+"에 방향 2개(dirs)가 필요해요");
    }
    if(c.type==="C"){
      if(!c.patrol||!c.patrol.length){ errors.push(tag+"에 순찰 경로가 없어요"); }
      else{
        var onRoute=false;
        for(var wi=0;wi<c.patrol.length;wi++){
          var w=c.patrol[wi];
          if(w[0]===c.x&&w[1]===c.y) onRoute=true;
          if(!editorCatTile(draft.theme,chAt(w[0],w[1]))) errors.push(tag+" 순찰 지점 "+(wi+1)+"이(가) 고양이가 못 서는 칸이에요");
        }
        if(!onRoute) errors.push(tag+"의 현재 위치가 순찰 경로 위에 없어요");
        var rc=st.cats[ci];
        for(var wj=1;wj<c.patrol.length;wj++){
          var a={x:c.patrol[wj-1][0],y:c.patrol[wj-1][1]}, b={x:c.patrol[wj][0],y:c.patrol[wj][1]};
          if(!editorCatPath(st,a,b,rc)) errors.push(tag+" 순찰 지점 "+wj+"→"+(wj+1)+" 사이가 끊겨 있어요");
        }
      }
    }
  }
  for(var ki=0;ki<draft.pickups.length;ki++){
    var p=draft.pickups[ki], ptag="먹이 "+(ki+1)+"("+p.kind+")";
    if(!editorHumanTile(draft.theme,chAt(p.x,p.y))) errors.push(ptag+"이(가) 인간이 못 서는 칸에 있어요");
    if(catCell(p.x,p.y,-1)) errors.push(ptag+"이(가) 고양이와 겹쳐 있어요");
    var pk=p.x+","+p.y;
    if(pkCells[pk]) errors.push("같은 칸에 먹이가 두 개예요 ("+pk+")");
    pkCells[pk]=1;
  }

  if(draft.start&&draft.goalPos){
    if(!editorReachable(st,false)) warnings.push("지형 연결: 시작에서 골까지 사람이 갈 수 없어요");
    if(!editorReachable(st,true)) warnings.push("고양이 자리를 피한 연결: 고양이를 피해서는 골에 닿을 수 없어요");
    for(var si=0;si<st.cats.length;si++){
      var sc=st.cats[si];
      if(inBeam(st,sc,st.player)||senseHit(st,sc,st.player)){
        warnings.push("시작 지점이 고양이 "+(si+1)+"의 시야·기척 안이에요");
        break;
      }
    }
  }
  return {errors:errors,warnings:warnings};
}

/* 고양이 시야+기척 오버레이 타일 목록 {x,y,beam,sense} */
function editorDangerTiles(draft){
  var st=editorState(draft), out={};
  for(var i=0;i<st.cats.length;i++){
    var cat=st.cats[i];
    var beam=beamTiles(st,cat);
    for(var b=0;b<beam.length;b++){
      var k=beam[b].y*N+beam[b].x;
      out[k]=out[k]||{x:beam[b].x,y:beam[b].y,beam:false,sense:false};
      out[k].beam=true;
    }
    var r=cat.sense||0;
    for(var y=Math.max(0,cat.y-r);y<=Math.min(N-1,cat.y+r);y++){
      for(var x=Math.max(0,cat.x-r);x<=Math.min(N-1,cat.x+r);x++){
        if(senseHit(st,cat,{x:x,y:y})){
          var k2=y*N+x;
          out[k2]=out[k2]||{x:x,y:y,beam:false,sense:false};
          out[k2].sense=true;
        }
      }
    }
  }
  return out;
}
