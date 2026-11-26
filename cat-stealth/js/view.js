"use strict";
/* ================= 픽셀 렌더 기반 ================= */
var cvEl=document.getElementById("cv"), dctx=cvEl.getContext("2d");
var low=document.createElement("canvas"); low.width=CV; low.height=CV;
var ctx=low.getContext("2d");
var board=document.createElement("canvas"); board.width=CV; board.height=CV;
/* 스테이지 맵 크기(ROWS×COLS)가 바뀌면 두 작업용 캔버스를 그 크기로 다시 잡아요.
   (크기를 바꾸면 캔버스가 비워지므로 loadStage 가 곧바로 bakeBoard 로 다시 그립니다) */
function sizeBoardCanvases(){
  if(low.width!==CVW||low.height!==CVH){
    low.width=CVW; low.height=CVH;
    board.width=CVW; board.height=CVH;
    ctx.imageSmoothingEnabled=false;
  }
}
var $=function(id){ return document.getElementById(id); };
/* 인벤토리 슬롯·아이템 카드 DOM 은 controller.js 에서 다룹니다 */

function hashf(x,y,s){
  var h=((x|0)*374761393+(y|0)*668265263+((s||0)|0)*1274126177)>>>0;
  h=(h^(h>>>13))*1274126177>>>0;
  return ((h^(h>>>16))>>>0)/4294967296;
}
function pf(g,x,y,w,h,c){ g.fillStyle=c; g.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h)); }

var CRN={1:[1],2:[1,1],3:[2,1,1],4:[2,2,1,1],5:[3,2,2,1,1],6:[3,3,2,2,1,1],7:[4,3,3,2,2,1,1],8:[5,4,3,2,2,2,1,1]};
function cins(i,h,r){
  r=Math.min(r,8,Math.floor(h/2));
  if(r<1) return 0;
  if(i<r) return CRN[r][i];
  if(i>=h-r) return CRN[r][h-1-i];
  return 0;
}
function fillRR(g,x,y,w,h,r,c){
  g.fillStyle=c;
  for(var i=0;i<h;i++){ var s=cins(i,h,r); if(w-2*s<=0) continue; g.fillRect(x+s,y+i,w-2*s,1); }
}
function pathRR(g,x,y,w,h,r){
  g.beginPath();
  for(var i=0;i<h;i++){ var s=cins(i,h,r); if(w-2*s<=0) continue; g.rect(x+s,y+i,w-2*s,1); }
}
var BAYER=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
function dith2(g,x,y,w,h,c,level,phase){
  level=Math.max(0,Math.min(1,level));
  if(level<=0||w<=0||h<=0) return;
  g.fillStyle=c; phase=phase||0;
  var th=level*16;
  x=Math.round(x); y=Math.round(y);
  for(var j=0;j<h;j+=2){
    var yy=y+j, bj=((yy+phase)&3)<<2;
    for(var i=0;i<w;i+=2){
      var xx=x+i;
      if(BAYER[bj+((xx+phase)&3)]+0.5<th) g.fillRect(xx,yy,2,2);
    }
  }
}
function dith(g,x,y,w,h,c,level,phase){
  level=Math.max(0,Math.min(1,level));
  if(level<=0||w<=0||h<=0) return;
  g.fillStyle=c; phase=phase||0;
  var th=level*16;
  x=Math.round(x); y=Math.round(y);
  for(var j=0;j<h;j++){
    var yy=y+j, bj=((yy+phase)&3)<<2;
    for(var i=0;i<w;i++){
      var xx=x+i;
      if(BAYER[bj+((xx+phase)&3)]+0.5<th) g.fillRect(xx,yy,1,1);
    }
  }
}
function shadowPix(g,cx,cy,rx,ry,a,col){
  var c=col||"28,14,8";
  g.fillStyle="rgba("+c+","+a+")";
  for(var j=-ry;j<=ry;j++){
    for(var i=-rx;i<=rx;i++){
      var d=(i*i)/(rx*rx)+(j*j)/(ry*ry);
      if(d>1) continue;
      if(d>0.45 && (((i+j)&1)===0)) continue;
      g.fillRect(Math.round(cx+i),Math.round(cy+j),1,1);
    }
  }
}

/* 3x5 픽셀 폰트 */
var FONT3={
 "0":["111","101","101","101","111"],
 "1":["010","110","010","010","111"],
 "2":["111","001","111","100","111"],
 "3":["111","001","111","001","111"],
 "4":["101","101","111","001","001"],
 "5":["111","100","111","001","111"],
 "6":["111","100","111","101","111"],
 "7":["111","001","010","010","010"],
 "8":["111","101","111","101","111"],
 "9":["111","101","111","001","111"],
 "E":["111","100","110","100","111"],
 "X":["101","101","010","101","101"],
 "I":["111","010","010","010","111"],
 "T":["111","010","010","010","010"],
 "S":["111","100","111","001","111"],
 "P":["111","101","111","100","100"],
 "/":["001","001","010","100","100"],
 "!":["010","010","010","000","010"],
 "?":["111","001","011","000","010"],
 " ":["000","000","000","000","000"]
};
function text3(g,str,x,y,col){
  g.fillStyle=col;
  for(var i=0;i<str.length;i++){
    var ch=FONT3[str.charAt(i)]||FONT3[" "];
    for(var r=0;r<5;r++) for(var c=0;c<3;c++){
      if(ch[r].charAt(c)==="1") g.fillRect(x+i*4+c,y+r,1,1);
    }
  }
}

/* ================= 색 팔레트 ================= */
var FLOOR={seam:"#6a4326", d1:"#8f6036", base:"#a4713f", l1:"#b8844f", hi:"#c59261", grain:"#8c5f36"};
var COATS={
  /* A · 고정 감시 — 통통한 러시안 블루(은회색 태비) */
  A:{ id:"A", o:"#241f2a", body:"#9aa4b6", lit:"#ccd5e3", dark:"#767f93", deep:"#525a6c", stripe:"#7b8497",
      belly:"#eef3fb", paw:"#eef3fb", inner:"#e095a4", nose:"#e88f9f", eye:"#f5bc3c", eyeD:"#3a2a12",
      blush:"#cf94a0", whisk:"#eef3fb", tag:"#ffd166" },
  /* B · 교대 감시 — 복슬복슬 마멀레이드(주황 태비) */
  B:{ id:"B", o:"#2b1a11", body:"#e6a25c", lit:"#fdd09a", dark:"#bd7b3a", deep:"#8a5320", stripe:"#c87a30",
      belly:"#fdecd2", paw:"#fdecd2", inner:"#eb9d95", nose:"#e08983", eye:"#84e08f", eyeD:"#16361f",
      blush:"#ee8b84", whisk:"#fff6e6", tag:"#ffe08a" },
  /* C · 순회 — 매끈한 젠틀캣(턱시도) */
  C:{ id:"C", o:"#121017", body:"#3d3d50", lit:"#64647e", dark:"#262632", deep:"#17171f", stripe:"#4c4c62",
      belly:"#eaeaF6", paw:"#eaeaF6", inner:"#a8748a", nose:"#d68f9d", eye:"#5ff0b2", eyeD:"#0f2a22",
      blush:"#7d5a70", whisk:"#dfeae6", tag:"#f0b429" }
};
var GHOST={ id:"G", o:"#1b3247", body:"#4d86b8", lit:"#7fb4e0", dark:"#35618c", deep:"#264662", stripe:"#44749e",
      belly:"#8fc0e6", paw:"#8fc0e6", inner:"#5f93c0", nose:"#5f93c0", eye:"#bfe4ff", eyeD:"#1b3247",
      blush:"#5f93c0", whisk:"#cfe8ff", tag:"#8fc0e6" };

/* ================= 숲 타일 스테이지 판별 =================
   맵에 숲 타일(FOREST_TILES) 문자가 하나라도 있으면 숲 스테이지로 봐요.
   1단계 숲 공터가 이 경우고, 2~11단계 실내는 예전 실내 타일 경로 그대로예요.
   숲 스테이지는 타일 그림 자체가 배경이라 격자 점·비네트·바깥 외곽선을 얹지 않아요. */
function stageHasForest(st){
  if(!st||!st.grid) return false;
  for(var y=0;y<ROWS;y++) for(var x=0;x<COLS;x++){
    if(st.grid[y]&&FOREST_TILES[st.grid[y][x]]) return true;
  }
  return false;
}

/* ---------- 2레이어 지형 타일 (코드 181+) ----------
   terrain 필드가 있는 타일: 칸마다 이어지는 seamless 텍스처를 전역 좌표로 샘플링하고,
   feat 필드가 있으면 그 위에 투명 오브젝트 스프라이트를 얹어요.
   지형끼리 다른 칸이 붙으면 우선순위가 높은 지형이 낮은 쪽 가장자리에
   베이어 디더로 스며들어요 — 도트 게임 표준 전이. */
var TERRAIN_PRIO={water:0,floor:1,grass:2,dirt:3};
var terrainBakes={};
function stageHasTerrain(st){
  if(!st||!st.grid) return false;
  for(var y=0;y<ROWS;y++) for(var x=0;x<COLS;x++){
    var ft=st.grid[y]&&FOREST_TILES[st.grid[y][x]];
    if(ft&&ft.terrain) return true;
  }
  return false;
}
function terrainCanvas(id){
  var c=terrainBakes[id];
  if(c===undefined){
    var tex=TILEIMG["tg_"+id];
    if(!tex||!tex.width) return null;   /* 아직 로드 전 — 캐시하지 않고 다음에 재시도 */
    c=document.createElement("canvas"); c.width=CVW; c.height=CVH;
    var g=c.getContext("2d"); g.imageSmoothingEnabled=false;
    g.fillStyle=g.createPattern(tex,"repeat"); g.fillRect(0,0,CVW,CVH);
    terrainBakes[id]=c;
  }
  return c;
}
function terrainAt(st,x,y,useNew){
  var ch=tileAt(st,x,y); var ft=FOREST_TILES[ch];
  if(ft) return ft.terrain||null;
  if(ch==="#") return null;
  /* 지형 타일 스테이지에서 바닥·특수 칸(^·H·U 등) 밑은 잔디 텍스처 */
  return useNew?"grass":null;
}
function drawTerrainCell(g,st,x,y){
  var tc=terrainCanvas(terrainAt(st,x,y,true)); if(!tc) return;
  g.drawImage(tc,x*CELL,y*CELL,CELL,CELL,x*CELL,y*CELL,CELL,CELL);
}
var terrBand=null;
/* 우선순위 높은 지형 텍스처를 경계 안쪽으로 굴곡진 물결선으로 넣어요 —
   디더 얼룩 없이 경계가 ±2~3px 왔다갔다 하는 딱딱한 선이에요.
   rev=false: 경계가 밴드의 끝쪽, rev=true: 경계가 밴드의 시작쪽 */
function wavyTerrBand(g,tb,px,py,w,h,horiz,rev){
  var phase=px*0.317+py*0.731;
  if(horiz){ /* 세로 스트립: 경계는 좌(rev)·우(!rev) */
    for(var t=0;t<h;t++){
      var dw=Math.round(2.5+Math.sin(t*0.55+phase)*1.7+Math.sin(t*0.21+phase*1.9)*1.6);
      if(dw<=0)continue; if(dw>w)dw=w;
      var sx=rev?px:px+w-dw;
      g.drawImage(tb,sx,py+t,dw,1, sx,py+t,dw,1);
    }
  }else{     /* 가로 스트립: 경계는 위(rev)·아래(!rev) */
    for(var t2=0;t2<w;t2++){
      var dh=Math.round(2.5+Math.sin(t2*0.55+phase)*1.7+Math.sin(t2*0.21+phase*1.9)*1.6);
      if(dh<=0)continue; if(dh>h)dh=h;
      var sy=rev?py:py+h-dh;
      g.drawImage(tb,px+t2,sy,1,dh, px+t2,sy,1,dh);
    }
  }
}
/* 물가 오토타일 — 연못 사진에서 잘라낸 혼합 타일:
   sh_e1·e2 = 엣지(위 잔디·아래 물, 경계선이 타일 안을 물결로 지나감)
   sh_c     = 볼록 모퉁이(물이 오른쪽+아래 — 육지가 뾰족하게 들어간 곳)
   sh_i     = 오목 모퉁이(왼쪽+아래 대각에만 물이 파고든 노치)
   육지 칸에 물쪽 방향으로 돌려 얹어요. 물 칸은 순수 물결 그대로예요 */
var SHORE_N=3;
var shoreBake={}, shoreSrcC={};
/* 타일의 물 픽셀은 투명 처리 — 물 자리엔 칸 좌표로 샘플링한 전역 물결을 깔아서
   타일 물과 베이크 물 사이에 이음선이 안 생겨요 */
/* 타일의 물 픽셀만 투명 처리 — 물 자리엔 칸 좌표로 샘플링한 전역 물결이
   비쳐서 타일 물과 베이크 물 사이 이음선이 안 생겨요. 나머지는 이미지 그대로예요 */
function shoreSrc(key){
  var c=shoreSrcC[key];
  if(c===undefined){
    var src=TILEIMG[key]; c=null;
    if(src&&src.width){
      c=document.createElement("canvas");c.width=40;c.height=40;
      var g=c.getContext("2d");g.drawImage(src,0,0);
      var d=g.getImageData(0,0,40,40),P=d.data;
      for(var i=0;i<40*40;i++){
        var r=P[i*4],gg=P[i*4+1],b=P[i*4+2];
        if(b>150&&b>r+30) P[i*4+3]=0;   /* 물·물가 하이라이트 → 투명 */
      }
      g.putImageData(d,0,0);
      shoreSrcC[key]=c;
    }
  }
  return c;
}
function shoreImg(kind,rot,v){
  var key=kind+rot+"_"+v, c=shoreBake[key];
  if(c===undefined){
    c=null;
    if(kind==="c"){
      /* 볼록 모퉁이 — 아래·오른쪽 물 엣지 띠를 합치되 모서리는 대각 컷으로 깎아요
         (직각 꺾임이 아니라 이미지처럼 45° 모서리) */
      var base=shoreSrc("sh_e"+v), ic=shoreSrc("sh_i");
      if(base){
        c=document.createElement("canvas");c.width=40;c.height=40;
        var g=c.getContext("2d");
        g.drawImage(base,0,0);
        /* 오른쪽 엣지 = 물이 오른쪽인 상태로 돌린 타일 — 모서리 위까지만 */
        var tmp=document.createElement("canvas");tmp.width=40;tmp.height=40;
        var tg=tmp.getContext("2d");
        tg.translate(20,20); tg.rotate(-Math.PI/2); tg.drawImage(base,-20,-20);
        g.drawImage(tmp,24,0,16,30, 24,0,16,30);
        /* 우하 모서리 = i 타일의 대각 컷 부분 */
        if(ic) g.drawImage(ic,30,30,10,10, 30,30,10,10);
        var r2=document.createElement("canvas");r2.width=40;r2.height=40;
        var rg=r2.getContext("2d");
        rg.translate(20,20); rg.rotate(rot*Math.PI/180); rg.drawImage(c,-20,-20);
        c=r2;
        shoreBake[key]=c;
      }
    }else{
      var src=shoreSrc(kind==="i"?"sh_i":"sh_e"+v);
      if(src){
        c=document.createElement("canvas");c.width=40;c.height=40;
        var g=c.getContext("2d");
        g.translate(20,20); g.rotate(rot*Math.PI/180); g.drawImage(src,-20,-20);
        shoreBake[key]=c;
      }
    }
  }
  return c;
}
/* 물가 타일이 덮이는 영역에 먼저 전역 물결을 깔아요 — 투명한 물 자리가
   이 텍스처를 그대로 보여줘서 이웃 물 칸과 완전히 이어져요 */
function shoreFillWater(g,x,y,sx,sy,sw,sh){
  var wc=terrainCanvas("water"); if(!wc) return;
  g.drawImage(wc, x*CELL+sx, y*CELL+sy, sw, sh,  x*CELL+sx, y*CELL+sy, sw, sh);
}
/* dir(0=동 1=서 2=남 3=북) 기준 회전각 — canonical: 엣지는 물이 아래쪽 */
var SHORE_ROT=[270,90,0,180];
/* ---- 물가 오토타일: 변 단위 수위 전파 ----
   각 육지 칸의 4개 변마다 "물가선이 덮이는 구간"을 계산해요.
   물 칸과 맞닿은 변은 전체(0~40), 이웃 육지 칸의 물가선이 칸 경계를 넘어
   들어오는 구간은 그 폭만큼 스텁으로 그려요 — 그래야 물가선이 칸 사이에서
   끊기지 않고 이어져요. 모서리에 물이 닿으면 인접 변으로 10px 전파되고,
   두 변이 같은 모서리에 닿으면 45° 대각 컷으로 꺾어요.
   전파는 물 칸 기준 8방향 첫 번째 테두리 안에서만 돌아서 물 줄기가
   멀리 번지지 않아요 */
var SHORE_LEAK=10;
/* 변 d의 l끝(0)·r끝(1) 모서리에 인접한 다른 변과 그 끝 — [다른변,그쪽끝] */
var SHORE_ADJ=[[[3,1],[2,1]],[[3,0],[2,0]],[[1,1],[0,1]],[[1,0],[0,0]]];
function paintShoreAll(g,st){
  var DX=[1,-1,0,0],DY=[0,0,1,-1],OPP=[1,0,3,2];
  var EX=[],x,y,d,i;
  for(y=0;y<ROWS;y++){EX[y]=[];for(x=0;x<COLS;x++){
    var ta=terrainAt(st,x,y,true), near=false;
    for(var dy=-1;dy<=1;dy++)for(var dx=-1;dx<=1;dx++){
      var nx=x+dx,ny=y+dy;
      if(nx>=0&&ny>=0&&nx<COLS&&ny<ROWS&&terrainAt(st,nx,ny,true)==="water") near=true;
    }
    EX[y][x]=(ta&&ta!=="water"&&near)?[{l:0,r:0},{l:0,r:0},{l:0,r:0},{l:0,r:0}]:null;
  }}
  function isW(x2,y2){return x2>=0&&y2>=0&&x2<COLS&&y2<ROWS&&terrainAt(st,x2,y2,true)==="water";}
  /* 칸의 변 dd에 실제로 보이는 물 수위 = 직접 수위 + 양끝 모서리 전파 */
  function showSpan(cell,dd){
    var s=cell[dd],ad=SHORE_ADJ[dd],o,e;
    o=cell[ad[0][0]];e=ad[0][1]===0?o.l:o.r;
    var l=Math.max(s.l,e>0?SHORE_LEAK:0);
    o=cell[ad[1][0]];e=ad[1][1]===0?o.l:o.r;
    return {l:l,r:Math.max(s.r,e>0?SHORE_LEAK:0)};
  }
  for(var it=0;it<4;it++){
    for(y=0;y<ROWS;y++)for(x=0;x<COLS;x++){
      var A=EX[y][x];if(!A)continue;
      for(d=0;d<4;d++){
        var nx=x+DX[d],ny=y+DY[d],t=null;
        if(isW(nx,ny))t={l:40,r:40};
        else if(nx>=0&&ny>=0&&nx<COLS&&ny<ROWS&&EX[ny][nx])t=showSpan(EX[ny][nx],OPP[d]);
        if(t){if(t.l>A[d].l)A[d].l=t.l;if(t.r>A[d].r)A[d].r=t.r;}
      }
    }
  }
  /* 모서리 컷 조건·회전·위치: [변A,끝A],[변B,끝B],i회전,dx,dy — NW,NE,SW,SE */
  var CORN=[[[3,0],[1,0],180,0,0],
            [[3,1],[0,0],270,26,0],
            [[2,0],[1,1],90,0,26],
            [[2,1],[0,1],0,26,26]];
  for(y=0;y<ROWS;y++)for(x=0;x<COLS;x++){
    var C=EX[y][x];if(!C)continue;
    var px=x*CELL,py=y*CELL;
    var v=1+Math.floor(hashf(x,y)*SHORE_N);
    for(d=0;d<4;d++){
      var s=C[d];if(s.l<=0&&s.r<=0)continue;
      var e=shoreImg("e",SHORE_ROT[d],v);if(!e)continue;
      var l=Math.min(40,s.l),r=Math.min(40,s.r);
      var spans=l+r>=40?[[0,40]]:(l>0&&r>0?[[0,l],[40-r,40]]:(l>0?[[0,l]]:[[40-r,40]]));
      for(i=0;i<spans.length;i++){
        var a=spans[i][0],b=spans[i][1],sx,sy,sw,sh;
        if(d===2){sx=a;sy=24;sw=b-a;sh=16;}
        else if(d===3){sx=a;sy=0;sw=b-a;sh=16;}
        else if(d===0){sx=24;sy=a;sw=16;sh=b-a;}
        else{sx=0;sy=a;sw=16;sh=b-a;}
        shoreFillWater(g,x,y,sx,sy,sw,sh);
        g.drawImage(e,sx,sy,sw,sh, px+sx,py+sy,sw,sh);
      }
    }
    for(var ci=0;ci<4;ci++){
      var cn=CORN[ci],eA=C[cn[0][0]],eB=C[cn[1][0]];
      var rA=cn[0][1]===0?eA.l:eA.r, rB=cn[1][1]===0?eB.l:eB.r;
      if(rA<=0||rB<=0)continue;
      var im=shoreImg("i",cn[2],1);if(!im)continue;
      shoreFillWater(g,x,y,cn[3],cn[4],14,14);
      g.drawImage(im,cn[3],cn[4],14,14, px+cn[3],py+cn[4],14,14);
    }
  }
}
function paintTerrainEdges(g,st){
  if(!stageHasTerrain(st)) return;
  /* 물가 오토타일 — 변 단위 수위 전파로 전체 물가선을 한 번에 그려요.
     물 칸은 건드리지 않아서 물은 항상 순수 물결이에요 */
  paintShoreAll(g,st);
  var B=6;
  for(var y=0;y<ROWS;y++) for(var x=0;x<COLS;x++){
    var ta=terrainAt(st,x,y,true); if(!ta) continue;
    var pa=TERRAIN_PRIO[ta];
    /* 나머지 지형 쌍은 기존 디더 전이 (오른쪽·아래쪽 이웃만 봐서 중복 방지) */
    if(x<COLS-1){
      var tb=terrainAt(st,x+1,y,true);
      if(tb&&tb!==ta&&TERRAIN_PRIO[tb]!=null&&tb!=="water"&&ta!=="water"){
        var pb=TERRAIN_PRIO[tb];
        var hi=pa<pb?tb:ta, loX=pa<pb?x:x+1, aIsLo=pa<pb;
        var tc=terrainCanvas(hi);
        if(tc) wavyTerrBand(g,tc,loX*CELL+(aIsLo?CELL-B:0),y*CELL,B,CELL,true,!aIsLo);
      }
    }
    if(y<ROWS-1){
      var td=terrainAt(st,x,y+1,true);
      if(td&&td!==ta&&TERRAIN_PRIO[td]!=null&&td!=="water"&&ta!=="water"){
        var pd=TERRAIN_PRIO[td];
        var hi2=pa<pd?td:ta, loY=pa<pd?y:y+1, aIsLo2=pa<pd;
        var tc3=terrainCanvas(hi2);
        if(tc3) wavyTerrBand(g,tc3,x*CELL,loY*CELL+(aIsLo2?CELL-B:0),CELL,B,false,!aIsLo2);
      }
    }
  }
}
/* 오브젝트를 칸보다 크게 그려 이웃 칸으로 살짝 넘치게 해요 —
   나뭇잎이 서로 겹치면서 칸 격자가 안 보이고 숲이 이어져요.
   s: 배율, a: "bottom"(바닥 기준·키 큰 것) | "center"(가운데·낮은 장식) */
var FEAT_DRAW={
  ob_tree_big:{s:1.55,a:"bottom",l:6}, ob_tree:{s:2.0,a:"bottom",l:8},
  ob_tree_wide:{s:2.0,a:"span2",im:"ob_tree",l:8},   /* 진짜 가로 2칸 — 칸 x~x+1에 걸쳐 그려요 */
  ob_pine:{s:1.5,a:"bottom",l:6,im:"ob_pine_hi"},
  ob_pine_wide:{s:2.0,a:"bottom",im:"ob_pine_hi",l:8},
  ob_pine_wide2:{s:2.8,a:"span2",im:"ob_pine_hi",l:8},   /* 진짜 가로 2칸 — 칸 x~x+1에 걸쳐 그려요 */
  ob_bush:{s:1.3,a:"bottom"}, ob_scrub:{s:1.25,a:"bottom"}, ob_fern:{s:1.1,a:"bottom"},
  ob_rock:{s:1.15,a:"bottom",l:5}, ob_stone:{s:2.0,a:"block2",im:"ob_stone_hi",l:5}, ob_stump:{s:0.85,a:"bottom",l:5,jx:0},
  ob_log:{s:1.25,a:"bottom"}, ob_tower:{s:1.4,a:"bottom"},
  ob_flower_p:{s:0.9,a:"bottom"}, ob_flower_w:{s:0.9,a:"bottom"}, ob_shroom:{s:0.9,a:"bottom"},
  ob_sapling:{s:0.85,a:"bottom",l:4,jx:0}
};
/* 한 칸의 구조물 스프라이트 그리기 — jxExtra는 수풀 흔들림 같은 프레임별 추가 오프셋 */
function paintFeatureCell(g,st,x,y,jxExtra){
  var ft=st.grid[y]&&FOREST_TILES[st.grid[y][x]];
  if(!ft||!ft.feat) return;
  var cfg=FEAT_DRAW[ft.feat]||{s:1.15,a:"bottom"};
  var im=TILEIMG[cfg.im||ft.feat];
  if(!im||!im.width) return;
  var w=CELL*cfg.s, h=CELL*cfg.s;
  /* 칸마다 살짝 다른 좌우 흔들림·반전으로 반복 패턴을 깨요 (결정적) — jx:0이면 중앙 고정 */
  var jx=(cfg.jx==null?((x*31+y*17)%5-2)*1.5:cfg.jx)+(jxExtra||0);
  /* span2: 자기 칸(x)부터 오른쪽 칸(x+1)까지 2칸 폭으로 그려요 — 밑동이 칸 경계에 와요
     block2: 자기 칸을 왼쪽 위로 해서 x~x+1·y~y+1, 2×2 영역을 덮어요 — 바닥이 (y+1)칸 아래에 와요 */
  var dx=cfg.a==="span2"||cfg.a==="block2"?x*CELL+CELL-w/2+jx:x*CELL+(CELL-w)/2+jx;
  var dy=cfg.a==="center"?y*CELL+(CELL-h)/2:cfg.a==="block2"?(y+2)*CELL-h-(cfg.l||0):(y+1)*CELL-h-(cfg.l||0);
  var flip=((x*13+y*29)%4)===0;
  if(flip){
    g.save(); g.translate(dx+w/2,0); g.scale(-1,1); g.translate(-(dx+w/2),0);
    g.drawImage(im,dx,dy,w,h); g.restore();
  }else g.drawImage(im,dx,dy,w,h);
}
function paintFeatures(g,st,compact){
  /* 위 행부터 아래로 — 아래쪽 오브젝트가 위쪽 나무 밑동을 덮어 깊이감이 생겨요 */
  for(var y=0;y<ROWS;y++) for(var x=0;x<COLS;x++){
    var ft=st.grid[y]&&FOREST_TILES[st.grid[y][x]];
    if(!ft||!ft.feat) continue;
    /* compact: 에디터용 — 칸 내용이 그대로 보이게 칸 크기로만 그려요 */
    if(compact){
      var cfg=FEAT_DRAW[ft.feat]||{s:1.15,a:"bottom"};
      var im=TILEIMG[cfg.im||ft.feat];
      if(im&&im.width) g.drawImage(im,x*CELL,y*CELL,CELL,CELL);
      continue;
    }
    /* 수풀 흔들림 중인 칸은 구운 보드에서 빼요 — draw()가 매 프레임 진동해서 다시 그려요 */
    if(G.bushShake&&G.bushShake[x+","+y]) continue;
    paintFeatureCell(g,st,x,y,0);
  }
}
/* 칸 위로 넘친 수관 부분만 엔티티(고양이·플레이어) 위에 다시 그려요 —
   고양이가 칸 아래에 서 있어도 앞 나무 잎에 가려져서 깊이감이 생겨요 */
function drawCanopyFront(g,st){
  if(!stageHasTerrain(st)) return;
  for(var y=0;y<ROWS;y++) for(var x=0;x<COLS;x++){
    var ft=st.grid[y]&&FOREST_TILES[st.grid[y][x]];
    if(!ft||!ft.feat) continue;
    var cfg=FEAT_DRAW[ft.feat]||{s:1.15,a:"bottom"};
    var h=CELL*cfg.s, over=h-CELL;
    if(over<=0) continue;
    var im=TILEIMG[cfg.im||ft.feat];
    if(!im||!im.width) continue;
    var w=CELL*cfg.s;
    var jx=((x*31+y*17)%5-2)*1.5;
    /* 수풀 진입·이탈 흔들림은 앞잎(넘친 수관)에도 똑같이 — 밑동과 어긋나지 않게 */
    var bsk=G.bushShake&&G.bushShake[x+","+y];
    if(bsk){
      var bAge=performance.now()-bsk.t0;
      if(bAge<620) jx+=Math.sin(bAge/52)*2.4*(1-bAge/620);
    }
    var dx=cfg.a==="span2"||cfg.a==="block2"?x*CELL+CELL-w/2+jx:x*CELL+(CELL-w)/2+jx;
    var dy=cfg.a==="block2"?(y+2)*CELL-h-(cfg.l||0):(y+1)*CELL-h-(cfg.l||0);
    var srcH=im.height*(over/h);
    var flip=((x*13+y*29)%4)===0;
    if(flip){ g.save(); g.translate(dx+w/2,0); g.scale(-1,1); g.translate(-(dx+w/2),0); }
    g.drawImage(im,0,0,im.width,srcH,dx,dy,w,over);
    if(flip) g.restore();
  }
}

/* ---------- 외래 이음새 디더 전이 ----------
   시트 원본에서 이웃하던 타일쌍은 손대지 않고, 다른 자리에서 온 타일이
   붙은 경계는 도트 디더링으로 서서히 바꿔요 — 블러 없이 선명한 도트 전이.
   같은 규칙(숲끼리·바닥끼리)일 때만 적용돼요. */
var SEAM_B=14, seamH=null, seamV=null;
/* 4×4 Bayer 행렬 — 경계에서 멀어질수록 B 쪽 픽셀이 촘촘해져요 */
var BAYER=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
function seamMaskInto(sg,w,h,horiz){
  /* destination-in에 쓸 디더 마스크: 경계 가까울수록(끝) 검정, 멀수록 흰색 */
  var d=sg.getImageData(0,0,w,h), p=d.data;
  for(var y=0;y<h;y++)for(var x=0;x<w;x++){
    var t=horiz?x/(w-1):y/(h-1);          /* 0=타일 안쪽, 1=경계 */
    var keep=BAYER[(y%4)*4+(x%4)]/16>t;   /* 안쪽은 A 유지, 경계로 갈수록 뚫림 */
    p[(y*w+x)*4+3]=keep?255:0;
  }
  sg.putImageData(d,0,0);
}
function forestSheetPos(spr){ var m=/^f_(\d+)_(\d+)$/.exec(spr||""); return m?{x:+m[1],y:+m[2]}:null; }
function seamTileInfo(st,ch,forest){
  var ft=FOREST_TILES[ch];
  if(ft) return ft.spr?{spr:ft.spr,rule:ft.rule}:null;   /* 2레이어 타일은 지형 전이가 처리 */
  /* 숲 스테이지에서 ^·H·U 같은 특수 칸 밑에는 잔디 타일(f_4_4)이 깔려요 —
     지형 타일 맵은 그쪽이 잔디 텍스처이므로 여기선 제외 */
  if(forest&&!stageHasTerrain(st)&&ch!=="#"&&TILEIMG.f_4_4) return {spr:"f_4_4",rule:"decor"};
  return null;
}
function drawSeamH(g,imA,imB,dx,dy){
  if(!seamH){ seamH=document.createElement("canvas"); seamH.width=SEAM_B; seamH.height=CELL; }
  var sg=seamH.getContext("2d");
  sg.globalCompositeOperation="source-over";
  sg.clearRect(0,0,SEAM_B,CELL);
  sg.drawImage(imA,CELL-SEAM_B,0,SEAM_B,CELL,0,0,SEAM_B,CELL);
  var m=sg.createLinearGradient(0,0,SEAM_B,0);
  m.addColorStop(0,"rgba(0,0,0,1)");m.addColorStop(1,"rgba(0,0,0,0)");
  sg.globalCompositeOperation="destination-in"; sg.fillStyle=m; sg.fillRect(0,0,SEAM_B,CELL);
  g.drawImage(seamH,dx,dy);
  sg.globalCompositeOperation="source-over";
  sg.clearRect(0,0,SEAM_B,CELL);
  sg.drawImage(imB,0,0,SEAM_B,CELL,0,0,SEAM_B,CELL);
  var m2=sg.createLinearGradient(0,0,SEAM_B,0);
  m2.addColorStop(0,"rgba(0,0,0,0)");m2.addColorStop(1,"rgba(0,0,0,1)");
  sg.globalCompositeOperation="destination-in"; sg.fillStyle=m2; sg.fillRect(0,0,SEAM_B,CELL);
  g.drawImage(seamH,dx,dy);
}
function drawSeamV(g,imA,imB,dx,dy){
  if(!seamV){ seamV=document.createElement("canvas"); seamV.width=CELL; seamV.height=SEAM_B; }
  var sg=seamV.getContext("2d");
  sg.globalCompositeOperation="source-over";
  sg.clearRect(0,0,CELL,SEAM_B);
  sg.drawImage(imA,0,CELL-SEAM_B,CELL,SEAM_B,0,0,CELL,SEAM_B);
  var m=sg.createLinearGradient(0,0,0,SEAM_B);
  m.addColorStop(0,"rgba(0,0,0,1)");m.addColorStop(1,"rgba(0,0,0,0)");
  sg.globalCompositeOperation="destination-in"; sg.fillStyle=m; sg.fillRect(0,0,CELL,SEAM_B);
  g.drawImage(seamV,dx,dy);
  sg.globalCompositeOperation="source-over";
  sg.clearRect(0,0,CELL,SEAM_B);
  sg.drawImage(imB,0,0,CELL,SEAM_B,0,0,CELL,SEAM_B);
  var m2=sg.createLinearGradient(0,0,0,SEAM_B);
  m2.addColorStop(0,"rgba(0,0,0,0)");m2.addColorStop(1,"rgba(0,0,0,1)");
  sg.globalCompositeOperation="destination-in"; sg.fillStyle=m2; sg.fillRect(0,0,CELL,SEAM_B);
  g.drawImage(seamV,dx,dy);
}
function blendForestSeams(g,st){
  var forest=stageHasForest(st); if(!forest) return;
  for(var y=0;y<ROWS;y++) for(var x=0;x<COLS;x++){
    var a=seamTileInfo(st,st.grid[y][x],forest); if(!a) continue;
    var pa=forestSheetPos(a.spr);
    if(x<COLS-1){
      var b=seamTileInfo(st,st.grid[y][x+1],forest);
      if(b&&b.rule===a.rule){
        var pb=forestSheetPos(b.spr);
        if(!(pa&&pb&&pb.x===pa.x+1&&pb.y===pa.y)){
          var ia=TILEIMG[a.spr], ib=TILEIMG[b.spr];
          if(ia&&ib&&ia.width&&ib.width) drawSeamH(g,ia,ib,x*CELL+CELL-SEAM_B,y*CELL);
        }
      }
    }
    if(y<ROWS-1){
      var c=seamTileInfo(st,st.grid[y+1][x],forest);
      if(c&&c.rule===a.rule){
        var pc=forestSheetPos(c.spr);
        if(!(pa&&pc&&pc.x===pa.x&&pc.y===pa.y+1)){
          var ia2=TILEIMG[a.spr], ic=TILEIMG[c.spr];
          if(ia2&&ic&&ia2.width&&ic.width) drawSeamV(g,ia2,ic,x*CELL,y*CELL+CELL-SEAM_B);
        }
      }
    }
  }
}

/* ================= 배경 베이크 ================= */
function bakeBoard(st){
  var g=board.getContext("2d");
  g.imageSmoothingEnabled=false;
  g.clearRect(0,0,CVW,CVH);
  var forest=stageHasForest(st);
  cvEl.classList.toggle("forest",forest);   /* 숲 스테이지는 보드 테두리도 숲 톤 */
  paintFloor(g,st);
  paintWalls(g,st);
  paintWallShadow(g,st);
  if(!forest) paintGrid(g,st);
  paintFurniture(g,st);
  paintSpecial(g,st);
  if(forest) blendForestSeams(g,st);
  paintTerrainEdges(g,st);
  paintFeatures(g,st);
  paintGoalMat(g,st);
  if(forest) return;                        /* 숲 타일은 그림 자체가 배경 — 비네트·외곽선 없음 */
  paintVignette(g,st);
  /* 바깥 프레임 */
  g.fillStyle="rgba(16,10,14,0.55)";
  g.fillRect(0,0,CVW,1); g.fillRect(0,CVH-1,CVW,1); g.fillRect(0,0,1,CVH); g.fillRect(CVW-1,0,1,CVH);
}

function paintFloor(g,st){
  /* 새 실내 바닥 타일 (downloads/tiles-indoor-set.png)
     · '~' 칸 = 크림 체크 타일 (부엌·욕실처럼 밝은 바닥)
     · 그 밖의 바닥 = 오크 마루 타일
     두 타일 모두 아트의 액자 테두리를 잘라 40×40으로 줄여, 이웃 칸과 무늬가 이어져요. */
  pf(g,0,0,CVW,CVH,FLOOR.base);
  var forest=stageHasForest(st);
  for(var y=0;y<ROWS;y++) for(var x=0;x<COLS;x++){
    var ch=st.grid[y][x];
    if(ch==="#") continue;
    /* 숲 타일(FOREST_TILES)은 배경이 구워진 40×40 아트라 그대로 칸을 덮어요 —
       장식·장애물 모두 바닥 패스에서 그려도 어차피 개체보다 아래 깔려요.
       2레이어 타일(terrain)은 전역 좌표로 샘플링해서 칸끼리 이어져요 */
    var ft=FOREST_TILES[ch];
    if(ft){
      if(ft.terrain) drawTerrainCell(g,st,x,y);
      else{
        var fim=TILEIMG[ft.spr];
        if(fim&&fim.width) g.drawImage(fim,x*CELL,y*CELL,CELL,CELL);
      }
      continue;
    }
    /* 숲 스테이지의 발판·구멍 같은 특수 칸 밑: 지형 타일 맵이면 잔디 텍스처,
       아니면 예전처럼 잔디 아트(f_4_4) */
    if(forest){
      if(stageHasTerrain(st)){ drawTerrainCell(g,st,x,y); continue; }
      if(TILEIMG.f_4_4&&TILEIMG.f_4_4.width){ g.drawImage(TILEIMG.f_4_4,x*CELL,y*CELL,CELL,CELL); continue; }
    }
    var im=TILEIMG[ch==="~"?"cream":"oak"];
    if(im&&im.width){
      if(ch!=="~"&&x%2){            /* 마루는 한 칸 걸러 좌우를 뒤집어 널 이음선이 세로로 줄 서지 않게 */
        g.save(); g.translate((x+1)*CELL,y*CELL); g.scale(-1,1); g.drawImage(im,0,0); g.restore();
      }
      else g.drawImage(im,x*CELL,y*CELL,CELL,CELL);
    }
    else if(ch==="~") pf(g,x*CELL,y*CELL,CELL,CELL,"#e8d5ab");
  }
}

function drawRugTile(g,st,x,y){
  var x0=x*CELL, y0=y*CELL;
  var up=tileAt(st,x,y-1)==="~", dn=tileAt(st,x,y+1)==="~",
      lf=tileAt(st,x-1,y)==="~", rt=tileAt(st,x+1,y)==="~";
  pf(g,x0,y0,CELL,CELL,"#e8d5ab");
  /* 직조 체크 */
  for(var j=0;j<CELL;j+=2){
    var off=((j/2)%2)*2;
    for(var i=off;i<CELL;i+=4){
      pf(g,x0+i,y0+j,2,2,"#ddc899");
    }
  }
  /* 가로 실 */
  for(var l=2;l<CELL;l+=4) pf(g,x0,y0+l,CELL,1,"#d2b98a");
  dith2(g,x0+1,y0+1,CELL-2,CELL-2,"#f4e7c5",0.16,1);
  /* 테두리 */
  if(!up){ pf(g,x0,y0,CELL,1,"#b79a68"); pf(g,x0,y0+1,CELL,1,"#f7eccf"); }
  if(!dn){ pf(g,x0,y0+CELL-2,CELL,1,"#f7eccf"); pf(g,x0,y0+CELL-1,CELL,1,"#b79a68"); }
  if(!lf){ pf(g,x0,y0,1,CELL,"#b79a68"); pf(g,x0+1,y0,1,CELL,"#f7eccf"); }
  if(!rt){ pf(g,x0+CELL-2,y0,1,CELL,"#f7eccf"); pf(g,x0+CELL-1,y0,1,CELL,"#b79a68"); }
  /* 프린지 */
  if(!up) for(var f1=2;f1<CELL;f1+=4) pf(g,x0+f1,y0-1,2,1,"#d8c396");
  if(!dn) for(var f2=2;f2<CELL;f2+=4) pf(g,x0+f2,y0+CELL,2,1,"#d8c396");
  if(!lf) for(var f3=2;f3<CELL;f3+=4) pf(g,x0-1,y0+f3,1,2,"#d8c396");
  if(!rt) for(var f4=2;f4<CELL;f4+=4) pf(g,x0+CELL,y0+f4,1,2,"#d8c396");
}

function paintRug(g,st){
  for(var y=0;y<ROWS;y++) for(var x=0;x<COLS;x++){
    if(st.grid[y][x]==="~") drawRugTile(g,st,x,y);
  }
}

/* 벽(#) = 새 실내 벽돌 스프라이트.
   벽돌 면 텍스처를 칸마다 이어 깔고, 벽 덩이의 맨 윗줄(위가 벽이 아닌 칸)에만
   아트의 밝은 윗면 띠를 얹어 벽이 하나의 덩이로 읽히게 했어요.
   스프라이트가 아직 안 풀렸을 때만 옛 픽셀 벽을 써요. */
function drawWallTile(g,st,x,y){
  var im=TILEIMG.brick;
  if(im&&im.width){
    g.drawImage(im,x*CELL,y*CELL,CELL,CELL);
    var tp=TILEIMG.walltop;
    if(tp&&tp.width&&(y===0||tileAt(st,x,y-1)!=="#")) g.drawImage(tp,x*CELL,y*CELL,CELL,tp.height);
    return;
  }
  drawWallTilePixel(g,st,x,y);
}
function drawWallTilePixel(g,st,x,y){
  var x0=x*CELL, y0=y*CELL;
  pf(g,x0,y0,CELL,CELL,"#241a20");
  var bh=9, bw=18;
  for(var r=0,py=y0; py<y0+CELL; py+=bh,r++){
    var off=(r%2)?9:0;
    for(var px=x0-off; px<x0+CELL; px+=bw){
      var bx=Math.max(x0,px), bx1=Math.min(x0+CELL,px+bw);
      if(bx1<=bx) continue;
      var hv=hashf(px,py,17);
      var base=hv<0.32?"#543c40":(hv<0.74?"#5f4648":"#6a4f4e");
      pf(g,bx,py,bx1-bx,bh-1,base);
      if(bx>x0) pf(g,bx,py,1,bh-1,"#241a20");
      pf(g,bx,py,bx1-bx,1,"#7d5f5c");
      pf(g,bx,py+bh-2,bx1-bx,1,"#3c2a30");
      if(hv<0.22) dith(g,bx+2,py+2,Math.max(1,bx1-bx-4),3,"#7a5c59",0.45,py);
      if(hv>0.86) dith(g,bx+2,py+4,Math.max(1,bx1-bx-4),2,"#4a3339",0.5,px);
    }
  }
}

function paintWalls(g,st){
  for(var y=0;y<ROWS;y++) for(var x=0;x<COLS;x++){
    if(st.grid[y][x]==="#") drawWallTile(g,st,x,y);
  }
}

function paintWallShadow(g,st){
  for(var y=0;y<ROWS;y++) for(var x=0;x<COLS;x++){
    if(st.grid[y][x]==="#") continue;
    var x0=x*CELL, y0=y*CELL;
    if(tileAt(st,x,y-1)==="#"){
      pf(g,x0,y0,CELL,1,"rgba(26,12,12,0.38)");
      dith(g,x0,y0+1,CELL,3,"rgba(26,12,12,0.30)",0.7,0);
      dith(g,x0,y0+4,CELL,4,"rgba(26,12,12,0.30)",0.28,0);
    }
    if(tileAt(st,x-1,y)==="#"){
      pf(g,x0,y0,1,CELL,"rgba(26,12,12,0.34)");
      dith(g,x0+1,y0,3,CELL,"rgba(26,12,12,0.28)",0.55,1);
    }
    if(tileAt(st,x+1,y)==="#"){
      pf(g,x0+CELL-1,y0,1,CELL,"rgba(26,12,12,0.34)");
      dith(g,x0+CELL-4,y0,3,CELL,"rgba(26,12,12,0.28)",0.55,1);
    }
    if(tileAt(st,x,y+1)==="#"){
      pf(g,x0,y0+CELL-1,CELL,1,"rgba(26,12,12,0.34)");
      dith(g,x0,y0+CELL-4,CELL,3,"rgba(26,12,12,0.28)",0.5,1);
    }
  }
  /* 벽 안쪽 턱(밝은 선) */
  for(var y2=0;y2<ROWS;y2++) for(var x2=0;x2<COLS;x2++){
    if(st.grid[y2][x2]!=="#") continue;
    var a=x2*CELL, b=y2*CELL;
    /* 벽 아랫면 턱 — 예전 밝은 회색 3줄은 새 벽돌 위에서 금속 띠처럼 보여서,
       벽돌에 어울리는 그늘 두 줄로 바꿨어요. */
    if(tileAt(st,x2,y2+1)!=="#"){
      pf(g,a,b+CELL-3,CELL,1,"#3b271d");
      pf(g,a,b+CELL-2,CELL,1,"#241812");
    }
    if(tileAt(st,x2,y2-1)!=="#") pf(g,a,b,CELL,1,"#3a2a2e");
    if(tileAt(st,x2-1,y2)!=="#") pf(g,a,b,1,CELL,"#3a2a2e");
    if(tileAt(st,x2+1,y2)!=="#") pf(g,a+CELL-1,b,1,CELL,"#3a2a2e");
    /* 벽 상단·외곽 캡 */
    if(y2===0){ pf(g,a,0,CELL,3,"#6b4d4a"); pf(g,a,3,CELL,1,"#3a2a2e"); }
    if(y2===ROWS-1){ pf(g,a,b+CELL-1,CELL,1,"#1a1116"); }
    if(x2===0){ pf(g,0,b,3,CELL,"#6b4d4a"); pf(g,3,b,1,CELL,"#3a2a2e"); }
    if(x2===COLS-1){ pf(g,a+CELL-1,b,1,CELL,"#1a1116"); }
  }
}

/* ---------- 가구 ---------- */
function counterRun(st,x,y,ch){
  return tileAt(st,x,y)===ch;
}

function drawCounter(g,st,x,y,prop){
  var x0=x*CELL, y0=y*CELL;
  var lf=counterRun(st,x-1,y,"X"), rt=counterRun(st,x+1,y,"X");
  var xA=x0+(lf?0:1), xB=x0+CELL-(rt?0:1);
  var topY=y0+3, faceY=y0+21, botY=y0+33;
  var w=xB-xA, cx=x0+CELL/2;
  pf(g,xA+2,botY+1,w-2,2,"rgba(28,13,8,0.40)");
  dith(g,xA+2,botY+2,w-2,4,"rgba(28,13,8,0.34)",0.6,0);
  fillRR(g,xA-1,topY-1,w+2,botY-topY+2,2,"#22160f");
  /* 상판 */
  fillRR(g,xA,topY,w,faceY-topY,1,"#cbb68c");
  pf(g,xA+1,topY+1,w-2,2,"#ecdfbe");
  pf(g,xA+1,topY+3,w-2,1,"#dbcba4");
  dith2(g,xA+1,topY+4,w-2,faceY-topY-6,"#b7a179",0.35,0);
  /* 앞면 */
  pf(g,xA,faceY,w,botY-faceY,"#8a5a34");
  pf(g,xA,faceY,w,1,"#c08f5c");
  pf(g,xA,faceY+1,w,1,"#5e3a1e");
  pf(g,xA+1,faceY+2,w-2,botY-faceY-4,"#8a5a34");
  pf(g,xA,faceY+2,1,botY-faceY-2,"#6b4426");
  pf(g,xB-1,faceY+2,1,botY-faceY-2,"#57341a");
  pf(g,xA+1,botY-2,w-2,1,"#4a2c14");
  /* 서랍 */
  var n=(w>34)?2:1, dw=Math.floor(w/n);
  for(var di=0;di<n;di++){
    var dx=xA+di*dw;
    if(di>0) pf(g,dx,faceY+2,1,botY-faceY-2,"#5e3a1e");
    pf(g,dx+Math.floor(dw/2)-2,faceY+4,5,1,"#e8cf95");
    pf(g,dx+Math.floor(dw/2)-2,faceY+5,5,1,"#8a6a3a");
  }
  /* 상판 소품 */
  if(prop==="sink"){
    var bx=cx-9, by=topY+6;
    fillRR(g,bx-1,by-1,20,11,2,"#5b6470");
    fillRR(g,bx,by,18,9,2,"#aab4c0");
    fillRR(g,bx+2,by+2,14,5,1,"#79838f");
    pf(g,bx+3,by+1,7,1,"#e2e8f0");
    pf(g,bx+2,by+4,10,1,"#5f6874");
    /* 수전 */
    pf(g,cx-3,topY-2,3,9,"#b9c0ca");
    pf(g,cx-3,topY-3,6,2,"#d4dae2");
    pf(g,cx+2,topY-2,4,2,"#b9c0ca");
    pf(g,cx+5,topY-1,1,4,"#8e97a3");
    pf(g,cx-4,topY+1,1,3,"#8e97a3");
  }else if(prop==="stove"){
    fillRR(g,xA+1,topY+1,w-2,faceY-topY-2,1,"#3b3742");
    pf(g,xA+1,topY+1,w-2,1,"#544e5e");
    dith2(g,xA+2,topY+3,w-4,faceY-topY-5,"#302c36",0.4,1);
    var bs=[cx-9,cx+9];
    for(var i=0;i<2;i++){
      var bxx=bs[i], byy=topY+7;
      fillRR(g,bxx-6,byy-3,13,8,3,"#14121a");
      fillRR(g,bxx-5,byy-2,11,6,2,"#4a4552");
      fillRR(g,bxx-3,byy-1,7,4,1,"#23202a");
      pf(g,bxx-1,byy,3,1,"#e07a2a");
      pf(g,bxx,byy-1,1,1,"#ffc05e");
    }
    pf(g,xA+2,faceY+1,w-4,9,"#2c2833");
    pf(g,xA+2,faceY+1,w-4,1,"#151320");
    fillRR(g,xA+5,faceY+4,w-10,4,1,"#453e4e");
    pf(g,xA+6,faceY+5,w-12,1,"#6a6274");
    pf(g,xA+4,faceY+2,w-8,1,"#8e8798");
  }else{
    var bx2=cx-11, by2=topY+5;
    fillRR(g,bx2-1,by2-1,24,14,2,"#6b4426");
    fillRR(g,bx2,by2,22,12,1,"#dcae74");
    pf(g,bx2+1,by2+1,20,1,"#f2d29d");
    dith2(g,bx2+2,by2+3,18,7,"#c99a63",0.4,0);
    pf(g,bx2+3,by2+5,4,4,"#cf4436");
    pf(g,bx2+4,by2+4,2,1,"#4d7a3a");
    pf(g,bx2+4,by2+6,1,1,"#f08a6a");
    pf(g,bx2+11,by2+6,5,3,"#f0c256");
    pf(g,bx2+11,by2+5,5,1,"#ffdb84");
    pf(g,bx2+13,by2+8,1,1,"#c99a3f");
    pf(g,bx2+4,by2+2,9,1,"#b8bec8");
    pf(g,bx2+12,by2+1,3,2,"#6b4426");
  }
}

function drawNightstand(g,st,x,y){
  var x0=x*CELL, y0=y*CELL;
  var xA=x0+6, xB=x0+CELL-6, topY=y0+14, botY=y0+33;
  pf(g,xA+2,botY+1,xB-xA-2,2,"rgba(28,13,8,0.40)");
  dith(g,xA+2,botY+2,xB-xA-2,4,"rgba(28,13,8,0.34)",0.6,0);
  fillRR(g,xA-1,topY-1,xB-xA+2,botY-topY+2,2,"#22160f");
  fillRR(g,xA,topY,xB-xA,4,1,"#cbb68c");
  pf(g,xA+1,topY+1,xB-xA-2,1,"#ecdfbe");
  pf(g,xA,topY+4,xB-xA,1,"#8a5a34");
  fillRR(g,xA,topY+5,xB-xA,botY-topY-5,1,"#8a5a34");
  pf(g,xA,topY+5,1,botY-topY-5,"#6b4426");
  pf(g,xB-1,topY+5,1,botY-topY-5,"#57341a");
  pf(g,xA+1,topY+9,xB-xA-2,1,"#5e3a1e");
  var kx=xA+Math.floor((xB-xA)/2);
  pf(g,kx-3,topY+11,6,1,"#e8cf95");
  pf(g,kx-3,topY+12,6,1,"#8a6a3a");
  var cx=x0+CELL/2;
  pf(g,cx-5,topY-3,11,2,"#6b4a28");
  pf(g,cx-1,topY-9,2,6,"#cbb68c");
  fillRR(g,cx-8,topY-17,17,9,2,"#5e3f22");
  fillRR(g,cx-7,topY-16,15,7,1,"#f2d79c");
  pf(g,cx-6,topY-15,13,2,"#ffeec4");
  pf(g,cx-4,topY-13,9,1,"#e0b060");
  dith2(g,cx-14,topY-22,28,22,"rgba(255,196,110,0.20)",0.5,1);
}

function drawSofa(g,st,x,y){
  var x0=x*CELL,y0=y*CELL;
  var lf=counterRun(st,x-1,y,"S"), rt=counterRun(st,x+1,y,"S");
  var xA=x0+(lf?0:1), xB=x0+CELL-(rt?0:1), w=xB-xA;
  pf(g,xA+2,y0+CELL-5,w-2,2,"rgba(30,12,10,0.38)");
  dith(g,xA+2,y0+CELL-4,w-2,5,"rgba(30,12,10,0.32)",0.6,0);
  fillRR(g,xA-1,y0+3,w+2,18,3,"#301c1c");
  fillRR(g,xA,y0+4,w,16,2,"#a4574a");
  pf(g,xA+1,y0+5,w-2,2,"#c9806d");
  dith(g,xA+1,y0+7,w-2,2,"#b46a5a",0.45,0);
  dith(g,xA+1,y0+16,w-2,3,"#8a4239",0.55,0);
  for(var sx=xA+18;sx<xB-6;sx+=18) pf(g,sx,y0+5,1,15,"#8a4239");
  fillRR(g,xA-1,y0+18,w+2,15,3,"#301c1c");
  fillRR(g,xA,y0+19,w,13,2,"#b56454");
  pf(g,xA+1,y0+19,w-2,2,"#d08774");
  dith(g,xA+1,y0+27,w-2,4,"#8a4239",0.55,0);
  for(var sx2=xA+16;sx2<xB-6;sx2+=16){
    pf(g,sx2,y0+20,1,11,"#8a4239");
    pf(g,sx2-1,y0+25,3,1,"#6f332c");
  }
  if(!lf){
    fillRR(g,xA-2,y0+8,9,23,2,"#301c1c");
    fillRR(g,xA-1,y0+9,7,21,2,"#8e453c");
    pf(g,xA,y0+10,5,2,"#ad5c4c");
    pf(g,xA,y0+28,5,1,"#6f332c");
  }
  if(!rt){
    fillRR(g,xB-7,y0+8,9,23,2,"#301c1c");
    fillRR(g,xB-6,y0+9,7,21,2,"#8e453c");
    pf(g,xB-5,y0+10,5,2,"#ad5c4c");
    pf(g,xB-5,y0+28,5,1,"#6f332c");
  }
  pf(g,xA,y0+31,w,2,"#63302a");
}

function drawTable(g,st,x,y){
  var x0=x*CELL,y0=y*CELL;
  pf(g,x0+5,y0+CELL-6,CELL-10,2,"rgba(28,12,8,0.36)");
  dith(g,x0+4,y0+CELL-5,CELL-8,5,"rgba(28,12,8,0.30)",0.6,0);
  pf(g,x0+9,y0+23,4,11,"#3a2415");
  pf(g,x0+CELL-13,y0+23,4,11,"#3a2415");
  pf(g,x0+10,y0+24,2,9,"#75502c");
  pf(g,x0+CELL-12,y0+24,2,9,"#75502c");
  fillRR(g,x0+1,y0+9,CELL-2,17,4,"#2a1a10");
  fillRR(g,x0+2,y0+10,CELL-4,15,3,"#8f5f36");
  fillRR(g,x0+2,y0+10,CELL-4,11,3,"#b6824a");
  pf(g,x0+4,y0+11,CELL-8,2,"#d5a066");
  dith2(g,x0+4,y0+14,CELL-8,5,"#a4713f",0.35,0);
  pf(g,x0+3,y0+20,CELL-6,1,"#6f4626");
  /* 접시 + 촛불 */
  var cx=x0+CELL/2;
  fillRR(g,cx-6,y0+13,13,6,2,"#6b4426");
  fillRR(g,cx-5,y0+14,11,4,2,"#efe6d2");
  pf(g,cx-3,y0+15,7,1,"#fffdf4");
  pf(g,cx-1,y0+16,3,1,"#d9a24a");
  pf(g,cx+8,y0+12,2,4,"#f3e7cf");
  pf(g,cx+8,y0+11,2,1,"#fff8e8");
  pf(g,cx+8,y0+9,1,2,"#ffcb5e");
  pf(g,cx+9,y0+8,1,1,"#fff0b8");
}

function drawBed(g,st,x,y){
  var x0=x*CELL,y0=y*CELL;
  var lf=counterRun(st,x-1,y,"B"), rt=counterRun(st,x+1,y,"B");
  var xA=x0+(lf?0:1), xB=x0+CELL-(rt?0:1), w=xB-xA;
  pf(g,xA+2,y0+CELL-4,w-2,2,"rgba(28,12,10,0.36)");
  dith(g,xA+2,y0+CELL-3,w-2,4,"rgba(28,12,10,0.30)",0.6,0);
  fillRR(g,xA-1,y0+4,w+2,30,3,"#3a2a20");
  fillRR(g,xA,y0+5,w,26,2,"#efe6d2");
  pf(g,xA+1,y0+6,w-2,2,"#fdf6e6");
  fillRR(g,xA,y0+18,w,13,1,"#7d9db4");
  pf(g,xA+1,y0+19,w-2,2,"#a3c0d4");
  dith(g,xA+1,y0+26,w-2,4,"#5f7f96",0.5,0);
  for(var sx=xA+8;sx<xB-4;sx+=13) pf(g,sx,y0+20,1,10,"#6f8ea5");
  var pw=Math.min(14,w-6);
  if(!lf){
    fillRR(g,xA+2,y0+7,pw,8,2,"#d8cbb0");
    fillRR(g,xA+3,y0+8,pw-2,6,2,"#fffdf4");
    pf(g,xA+4,y0+9,pw-4,1,"#ffffff");
  }
  pf(g,xA,y0+30,w,3,"#8a5a34");
  pf(g,xA,y0+30,w,1,"#b5875a");
  pf(g,xA,y0+33,w,1,"#4a2c14");
  /* 헤드보드 */
  if(!lf){
    fillRR(g,xA-1,y0+7,4,24,2,"#3a2a20");
    pf(g,xA,y0+8,2,22,"#8a5a34");
    pf(g,xA,y0+8,2,2,"#b5875a");
    pf(g,xA,y0+18,2,1,"#6b4426");
  }
}

/* ---------- 특수 타일 ---------- */
/* 🐾 고양이 발판(^) : 따뜻한 우드 단차 + 발바닥·수염 마크. 작은 인간은 올라갈 수 없어요. */
function drawCatPerch(g,st,x,y){
  var x0=x*CELL, y0=y*CELL;
  /* 단차 밑동 그림자 — 바닥에서 살짝 떠 보이게 */
  pf(g,x0+6,y0+CELL-6,CELL-12,3,"rgba(24,11,6,0.42)");
  dith(g,x0+5,y0+CELL-5,CELL-10,3,"rgba(24,11,6,0.32)",0.55,0);
  /* 옆면(단 높이) */
  fillRR(g,x0+2,y0+10,CELL-4,CELL-14,3,"#2e1a0d");
  fillRR(g,x0+3,y0+11,CELL-6,CELL-15,2,"#8a5a34");
  pf(g,x0+4,y0+13,CELL-8,1,"#a4713f");
  pf(g,x0+4,y0+CELL-6,CELL-8,1,"#5a361c");
  /* 상판 */
  fillRR(g,x0+3,y0+6,CELL-6,CELL-15,3,"#6b4426");
  fillRR(g,x0+4,y0+7,CELL-8,CELL-16,2,"#c58f55");
  fillRR(g,x0+5,y0+8,CELL-10,CELL-13,2,"#d9ab6e");
  pf(g,x0+6,y0+9,CELL-12,1,"#f2cd95");
  /* 나뭇결 */
  pf(g,x0+7,y0+13,CELL-14,1,"#c1884c");
  pf(g,x0+10,y0+16,CELL-20,1,"#c1884c");
  pf(g,x0+6,y0+20,CELL-13,1,"#b07c46");
  pf(g,x0+12,y0+23,CELL-22,1,"#b07c46");
  /* 고양이 발바닥 도장 */
  var px=x0+20, py=y0+22;
  fillRR(g,px-4,py-1,9,5,2,"#43260f");
  pf(g,px-3,py,7,3,"#6b4426");
  pf(g,px-6,py-6,2,3,"#43260f");
  pf(g,px-3,py-7,2,3,"#43260f");
  pf(g,px+1,py-7,2,3,"#43260f");
  pf(g,px+4,py-6,2,3,"#43260f");
  /* 수염 두 줄 */
  pf(g,px+8,py-4,3,1,"#f2cd95");
  pf(g,px+8,py-1,3,1,"#f2cd95");
  pf(g,px-11,py-4,3,1,"#f2cd95");
  pf(g,px-11,py-1,3,1,"#f2cd95");
  /* 네 모서리 앰버 표식 — 바닥과 한눈에 구분되도록 */
  pf(g,x0+1,y0+1,2,2,"#ffb338"); pf(g,x0+CELL-3,y0+1,2,2,"#ffb338");
  pf(g,x0+1,y0+CELL-3,2,2,"#ffb338"); pf(g,x0+CELL-3,y0+CELL-3,2,2,"#ffb338");
}
/* 🕳️ 작은 구멍(H) : 벽 틈에 뚫린 어두운 아치 + 사람 발자국. 고양이는 들어올 수 없어요. */
function drawHoleTile(g,st,x,y){
  var x0=x*CELL, y0=y*CELL;
  drawWallTile(g,st,x,y);
  /* 구멍 둘레를 파낸 느낌의 그늘 */
  dith(g,x0+4,y0+6,32,32,"rgba(18,10,14,0.55)",0.55,1);
  /* 돌 턱(상인방) — 벽돌과 구분되는 밝은 돌 테두리 */
  fillRR(g,x0+7,y0+6,26,6,2,"#3a2a30");
  fillRR(g,x0+8,y0+7,24,4,1,"#9c7b70");
  pf(g,x0+9,y0+7,22,1,"#c2a294");
  /* 아치 입구(어두운 틈) */
  fillRR(g,x0+9,y0+11,22,27,9,"#0b0709");
  fillRR(g,x0+11,y0+13,18,24,8,"#1a1219");
  dith(g,x0+12,y0+15,16,18,"#2b2029",0.5,1);
  /* 구멍 너머에서 새어 나오는 빗빛 */
  dith(g,x0+13,y0+26,14,10,"rgba(255,186,110,0.30)",0.5,1);
  pf(g,x0+12,y0+13,16,1,"rgba(255,206,140,0.42)");
  pf(g,x0+11,y0+14,1,12,"rgba(255,206,140,0.22)");
  /* 입구 좌우 기둥(돌) */
  pf(g,x0+8,y0+12,1,25,"#a98c80");
  pf(g,x0+31,y0+12,1,25,"#6a5058");
  /* 안쪽 바닥 턱 — 드나들 수 있는 틈이라는 신호 */
  pf(g,x0+10,y0+34,20,4,"#3c2d27");
  pf(g,x0+10,y0+34,20,1,"#5f4a3c");
  dith(g,x0+11,y0+35,18,3,"#241a16",0.5,1);
  /* 사람 발자국 두 개 (밝게) */
  pf(g,x0+14,y0+29,3,4,"#e6d4b6"); pf(g,x0+14,y0+33,3,1,"#a8927a");
  pf(g,x0+21,y0+25,3,4,"#f4e6cc"); pf(g,x0+21,y0+29,3,1,"#b09a80");
  /* 구멍 밖으로 새는 빗살 광 */
  pf(g,x0+7,y0+4,1,3,"rgba(255,206,140,0.18)");
  pf(g,x0+32,y0+4,1,3,"rgba(255,206,140,0.12)");
  pf(g,x0+13,y0+3,14,1,"rgba(255,206,140,0.14)");
}
/* 은신 수풀 · 잎 한 덩이 — 타원형 블롭에 외곽선 → 몸통 → 볕 받는 윗면 순으로 쌓아요 */
function leafBlob(g,cx,cy,rx,ry,o,mid,lit,hi){
  var j,t,w;
  for(j=-ry;j<=ry;j++){
    t=1-(j*j)/((ry+0.6)*(ry+0.6)); if(t<=0) continue;
    w=Math.round(rx*Math.sqrt(t));
    pf(g,cx-w,cy+j,w*2+1,1,o);
  }
  for(j=-ry+1;j<=ry-1;j++){
    t=1-(j*j)/((ry-0.3)*(ry-0.3)); if(t<=0) continue;
    w=Math.round((rx-1)*Math.sqrt(t)); if(w<=0) continue;
    pf(g,cx-w,cy+j,w*2+1,1,mid);
  }
  var bot=-ry+1+Math.max(2,Math.round(ry*0.55));
  for(j=-ry+1;j<=bot;j++){
    t=1-(j*j)/((ry-0.3)*(ry-0.3)); if(t<=0) continue;
    w=Math.round((rx-2)*Math.sqrt(t)); if(w<=0) continue;
    pf(g,cx-w,cy+j,w*2+1,1,lit);
  }
  if(hi) pf(g,cx-Math.round(rx*0.5),cy-Math.round(ry*0.55),2,1,hi);
}
/* 🪴 은신 수풀(U) : 테라코타 화분에 심긴 큼직한 관엽 수풀.
   잎 다발을 여러 덩이로 나눠 그려서 잎 끝이 삐죽삐죽한 실루엣을 만들고,
   테라코타 화분이 아래에 보이게 해서 캣닢(바닥의 잎다발)과도 한눈에 구분돼요.
   앞쪽 잎은 drawBushFront 가 나중에 다시 덮어서, 플레이어가 들어가면 잎사이로 얼굴만 보여요. */
function drawBushTile(g,st,x,y){
  var x0=x*CELL, y0=y*CELL;
  /* 바닥 그림자 */
  dith(g,x0+3,y0+CELL-8,CELL-6,7,"rgba(14,9,5,0.46)",0.55,0);
  pf(g,x0+7,y0+CELL-5,CELL-14,2,"rgba(14,9,5,0.40)");
  /* 화분 — 테라코타(립 + 몸통 + 흙) */
  fillRR(g,x0+9,y0+27,22,5,1,"#2b160c");
  fillRR(g,x0+10,y0+28,20,3,1,"#c06a3a");
  pf(g,x0+11,y0+28,18,1,"#e8a06a");
  fillRR(g,x0+11,y0+32,18,7,2,"#2b160c");
  fillRR(g,x0+12,y0+32,16,6,2,"#8f4527");
  pf(g,x0+13,y0+33,5,1,"#b25b32");
  pf(g,x0+22,y0+33,1,4,"#6b3218");
  pf(g,x0+13,y0+37,14,1,"#5e2b14");
  pf(g,x0+14,y0+31,12,2,"#2a1a11");
  pf(g,x0+15,y0+31,10,1,"#452c1a");
  /* 뒤쪽 잎(그늘) — 화분 뒤로 깔리는 진한 덩이 */
  leafBlob(g,x0+12,y0+13,9,7,"#081c10","#164a2b","#1d5731",null);
  leafBlob(g,x0+28,y0+13,9,7,"#081c10","#144528","#1b5230",null);
  leafBlob(g,x0+20,y0+8,9,6,"#081c10","#124023","#18502c",null);
  /* 앞쪽 잎 — 몸통 → 볕 받는 면 → 하이라이트 */
  leafBlob(g,x0+11,y0+16,9,7,"#07180d","#1d5a34","#2f7f47","#52ae6c");
  leafBlob(g,x0+29,y0+16,9,7,"#07180d","#1a5230","#2b7742","#49a363");
  leafBlob(g,x0+14,y0+10,8,6,"#07180d","#1f6038","#35894c","#5fbb78");
  leafBlob(g,x0+26,y0+10,8,6,"#07180d","#1d5a34","#2f7f47","#52ae6c");
  leafBlob(g,x0+20,y0+16,10,6,"#07180d","#22703d","#3a9153","#6ac383");
  leafBlob(g,x0+20,y0+5,8,5,"#07180d","#1a5230","#2f7f47","#5fbb78");
  /* 잎맥 · 잎 사이 그늘 */
  pf(g,x0+7,y0+16,3,1,"#0d3019");
  pf(g,x0+29,y0+17,4,1,"#0d3019");
  pf(g,x0+16,y0+13,3,1,"#0f3a20");
  pf(g,x0+22,y0+20,4,1,"#0f3a20");
  pf(g,x0+13,y0+19,3,1,"#123f24");
  /* 수풀 밖으로 뻗은 잎 끝 — 실루엣이 둥글지 않게 */
  pf(g,x0+2,y0+16,2,1,"#164a2b");
  pf(g,x0+1,y0+13,2,2,"#1d5a34");
  pf(g,x0+36,y0+17,2,1,"#144528");
  pf(g,x0+35,y0+11,2,2,"#1a5230");
  pf(g,x0+9,y0+4,2,2,"#1d5a34");
  pf(g,x0+30,y0+3,2,2,"#1a5230");
  pf(g,x0+19,y0+2,2,2,"#22703d");
  pf(g,x0+6,y0+10,1,2,"#164a2b");
  pf(g,x0+33,y0+21,1,2,"#123f24");
  /* 뾰족한 잎 두 장 — 잎사귀가 밖으로 뻗은 느낌 */
  pf(g,x0+4,y0+8,1,2,"#1d5a34"); pf(g,x0+3,y0+7,1,1,"#2a7642");
  pf(g,x0+35,y0+6,1,2,"#1a5230"); pf(g,x0+36,y0+5,1,1,"#24703c");
}
/* 수풀 앞잎 — 수풀 칸에 들어선 플레이어를 스프라이트 잎으로 반쯤 가려요.
   매트와 같은 수풀 이미지의 '잎이 빽빽한 가운데 띠'만 다시 얹는 방식이라
   화분·바닥은 아래 깔린 수풀 타일 그대로 남아요. */
function drawBushFront(g,st){
  var pl=st.player;
  if(!pl||tileAt(st,pl.x,pl.y)!=="U") return;   /* 화분 잎 앞면 덮기는 U 타일 전용 */
  var im=TILEIMG.bush;
  if(!im||!im.width) return;
  var x0=Math.round(pl.rx*CELL), y0=Math.round(pl.ry*CELL);
  /* 스프라이트에서 잎이 가장 빽빽한 윗부분(2~18행)을 플레이어의 머리·몸통 자리(칸 11~27행)에
     한 번 더 얹어요. 화분과 바닥은 그대로 남아 수풀로 계속 읽히고, 머리와 어깨는 잎에 덮여요. */
  var sy=2, sh=14, dy=y0+10;
  g.drawImage(im,0,sy,im.width,sh,x0,dy,im.width,sh);
}

/* 발판(^) 상판의 화면 y — 스프라이트는 아래 맞춤이라 위에서 약 8px 지점이 고양이가 서는 면.
   벡터 대체 그림(낮은 우드 단차)이면 상판이 칸 위에서 약 9px 지점이에요. */
function perchTopPx(x,y){
  var im=TILEIMG.perch;
  if(im&&im.height) return y*CELL+CELL-im.height+8;
  return y*CELL+9;
}

/* 특수 타일 스프라이트 — 바닥 판은 칸 바닥에 붙고, 오브젝트는 위 칸으로 살짝 솟아요 */
function spriteTileAt(g,key,x,y){
  var im=TILEIMG[key];
  if(!im||!im.width) return false;
  g.drawImage(im,x*CELL,y*CELL+CELL-im.height);
  return true;
}

function paintSpecial(g,st){
  var drawn=false;
  for(var y=0;y<ROWS;y++) for(var x=0;x<COLS;x++){
    var ch=st.grid[y][x];
    if(ch==="^"){ drawn=true; if(!spriteTileAt(g,"perch",x,y)) drawCatPerch(g,st,x,y); }
    else if(ch==="H"){ drawn=true; if(!spriteTileAt(g,"hole",x,y)) drawHoleTile(g,st,x,y); }
    else if(ch==="U"){ drawn=true; if(!spriteTileAt(g,"bush",x,y)) drawBushTile(g,st,x,y); }
  }
  return drawn;
}

function paintFurniture(g,st){
  /* 가구·장애물(X) = 새 목재 가구/카운터 블록. 같은 모듈이 길게 이어지므로
     한 칸 걸러 좌우를 뒤집어 늘어놓아 반복이 눈에 덜 띄게 했어요. */
  var counterN=0, im=TILEIMG.furn, hasTile=!!(im&&im.width);
  for(var y=0;y<ROWS;y++) for(var x=0;x<COLS;x++){
    var ch=st.grid[y][x];
    if(ch==="X"){
      if(hasTile){
        g.save();
        if(x%2){ g.translate(x*CELL+CELL,y*CELL); g.scale(-1,1); g.drawImage(im,0,0); }
        else g.drawImage(im,x*CELL,y*CELL);
        g.restore();
      }
      else if(st.theme.X==="nightstand") drawNightstand(g,st,x,y);
      else{
        var props=["sink","stove","board"];
        drawCounter(g,st,x,y,props[counterN%3]);
        counterN++;
      }
    }
    else if(ch==="S") drawSofa(g,st,x,y);
    else if(ch==="T") drawTable(g,st,x,y);
    else if(ch==="B") drawBed(g,st,x,y);
    else if(ch==="W") drawWardrobe(g,st,x,y);
  }
}

/* 모듈형 장롱(W) = downloads/tile-wardrobe.png 의 2도어 모듈 한 칸(40×40).
   가로로 이어 붙인 칸은 안쪽 모듈 프레임 1px을 잘라 그려 이음선이 겹치지 않게 하고,
   줄의 양 끝 칸만 프레임을 남겨 장롱 덩이의 끝이 또렷해요. */
function drawWardrobe(g,st,x,y){
  var im=TILEIMG.wardrobe;
  var x0=x*CELL, y0=y*CELL;
  if(!im||!im.width){ drawWardrobeFallback(g,x0,y0); return; }
  var lf=counterRun(st,x-1,y,"W"), rt=counterRun(st,x+1,y,"W");
  var sx=lf?1:0, ex=rt?1:0;
  g.drawImage(im,sx,0,im.width-sx-ex,im.height,x0,y0,CELL,CELL);
}
/* 스프라이트 디코드 전 폴백 — 갈색 장롱 두 짝. */
function drawWardrobeFallback(g,x0,y0){
  pf(g,x0+3,y0+35,CELL-6,2,"rgba(24,10,6,0.42)");
  dith(g,x0+3,y0+36,CELL-6,4,"rgba(24,10,6,0.30)",0.6,0);
  fillRR(g,x0+1,y0+3,CELL-2,33,2,"#2a1708");
  fillRR(g,x0+2,y0+4,CELL-4,31,1,"#6b4426");
  pf(g,x0+2,y0+4,CELL-4,3,"#9a6432");          /* 몰딩 */
  pf(g,x0+2,y0+7,CELL-4,1,"#3d2410");
  pf(g,x0+5,y0+10,13,22,"#58351a");            /* 왼쪽 문 */
  pf(g,x0+CELL-18,y0+10,13,22,"#58351a");      /* 오른쪽 문 */
  pf(g,x0+6,y0+11,11,1,"#8a5a34");
  pf(g,x0+6,y0+20,11,1,"#3d2410");
  pf(g,x0+CELL-17,y0+11,11,1,"#8a5a34");
  pf(g,x0+CELL-17,y0+20,11,1,"#3d2410");
  pf(g,x0+17,y0+17,2,6,"#e8cf95");             /* 손잡이 */
  pf(g,x0+CELL-19,y0+17,2,6,"#e8cf95");
  pf(g,x0+1,y0+33,CELL-2,2,"#3d2410");
}

/* EXIT 칸 = 통나무 탈출구 스프라이트(EXIT 각인 포함). */
function paintGoalMat(g,st){
  var x0=st.goal.x*CELL, y0=st.goal.y*CELL;
  var im=TILEIMG.exitlog;
  if(im&&im.width){
    g.drawImage(im,x0,y0);
    return;
  }
  im=TILEIMG.mat;
  if(im&&im.width){
    g.drawImage(im,x0,y0);
    /* 매트 화살표 아래에 작은 EXIT 글자 — 예전과 같은 3×5 픽셀 폰트 */
    text3(g,"EXIT",x0+13,y0+22,"#f2ffe4");
    return;
  }
  var mx=x0+5, my=y0+6, mw=CELL-10, mh=CELL-12;
  dith(g,mx+1,my+mh+1,mw-2,4,"rgba(20,60,40,0.30)",0.6,0);
  fillRR(g,mx-1,my-1,mw+2,mh+2,3,"#123c28");
  fillRR(g,mx,my,mw,mh,2,"#2f9e6a");
  pf(g,mx+1,my+1,mw-2,2,"#57c48c");
  dith(g,mx+1,my+4,mw-2,mh-6,"#268455",0.22,1);
  pf(g,mx+1,my+mh-2,mw-2,1,"#1f7a50");
  var ax=mx+Math.floor(mw/2)-3, ay=my+4;
  var AR=[".###.","#####",".###.",".###.",".###."];
  for(var r=0;r<AR.length;r++) for(var c=0;c<5;c++){
    if(AR[r].charAt(c)==="#") pf(g,ax+c+1,ay+r+1,1,1,"#0f3f28");
  }
  for(var r2=0;r2<AR.length;r2++) for(var c2=0;c2<5;c2++){
    if(AR[r2].charAt(c2)==="#") pf(g,ax+c2,ay+r2,1,1,"#eafff3");
  }
  text3(g,"EXIT",mx+Math.floor((mw-15)/2),my+mh-10,"#d9ffe9");
}

function paintGrid(g,st){
  g.fillStyle="rgba(0,0,0,0.10)";
  for(var x=1;x<COLS;x++) for(var y=1;y<ROWS;y++){
    g.fillRect(x*CELL-1,y*CELL,1,1);
  }
}

function paintVignette(g,st){
  var lx=CVW*0.5, ly=CVH*0.28;
  var vx=CVW*0.5, vy=CVH*0.5;
  for(var j=0;j<CVH;j++){
    for(var i=0;i<CVW;i++){
      var b=BAYER[((j&3)<<2)+(i&3)]+0.5;
      var dl=Math.sqrt(Math.pow((i-lx)/(CVW*0.60),2)+Math.pow((j-ly)/(CVH*0.52),2));
      var warm=1-dl;
      if(warm>0){
        if(b < Math.min(11,warm*10)){ g.fillStyle="rgba(255,198,122,0.09)"; g.fillRect(i,j,1,1); }
      }
      var dx=(i-vx)/(CVW*0.5), dy=(j-vy)/(CVH*0.5);
      var d=Math.sqrt(dx*dx+dy*dy);
      var t=(d-0.70)/0.62;
      if(t>0 && b < Math.min(15,t*15)){ g.fillStyle="rgba(20,9,16,0.22)"; g.fillRect(i,j,1,1); }
    }
  }
}

/* ================= 스프라이트: 인간 / 생선 ================= */
function drawHuman(g,pl,now,dir,moving){
  var cx=pl.rx*CELL+CELL/2, gy=pl.ry*CELL+CELL-8;
  shadowPix(g,cx,gy-1,7,3,0.32);
  var spr=HUMIMG[dir|0]||HUMIMG[2];
  if(!spr||!spr.width) return;                  /* 스프라이트 로드 전 */
  var bob=(moving&&(Math.floor(now/110)%2))?1:0;   /* 걷기 밥 */
  g.save();
  g.translate(Math.round(cx),Math.round(gy-bob));
  g.drawImage(spr,-Math.round(spr.width/2),-spr.height+1);
  g.restore();
}

/* ================= 출구 도착 연출: 점프 → 구멍 속으로 '뽕' =================
   클리어 판정은 model.js 그대로 두고 그리기만 여기서 해요.
   출발점·구멍 중심·시작 시각은 controller.js 가 G.exit 에 넣어 줍니다. */
function exitHolePt(x,y){ return {x:x*CELL+CELL/2+EXIT_HOLE_DX, y:y*CELL+EXIT_HOLE_DY}; }
/* 픽셀 도트로 그리는 타원 테두리 — 파동 링용 */
function exitEllipseDots(g,cx,cy,rx,ry,col){
  g.fillStyle=col;
  var steps=Math.max(18,Math.round((rx+ry)*2.4));
  for(var i=0;i<steps;i++){
    var a=i/steps*Math.PI*2;
    g.fillRect(Math.round(cx+Math.cos(a)*rx),Math.round(cy+Math.sin(a)*ry),1,1);
  }
}
function drawExitPlayer(g,now,dir){
  var ex=G.exit;
  if(!ex) return;
  var t=now-ex.t0;
  if(t<0||t>=EXIT_MS) return;              /* 연출 끝 → 사람은 구멍 속(안 그림) */
  var spr=HUMIMG[dir|0]||HUMIMG[2];
  if(!spr||!spr.width) return;
  var fx=ex.sx, fy=ex.sy, sc=1, alpha=1, sqx=1, sqy=1, sh=1;
  if(t<EXIT_CROUCH_MS){                    /* 1) 웅크리기 */
    var u=t/EXIT_CROUCH_MS;
    sqy=1-0.18*Math.sin(Math.PI*u);
    sqx=1+0.09*Math.sin(Math.PI*u);
  }else if(t<EXIT_ARC_MS){                 /* 2) 포물선 점프 — 솟았다가 구멍 위로 꽂힘 */
    var u2=(t-EXIT_CROUCH_MS)/(EXIT_ARC_MS-EXIT_CROUCH_MS);
    fx=ex.sx+(ex.hx-ex.sx)*u2;
    fy=ex.sy+(ex.hy-ex.sy)*u2-EXIT_HOP*Math.sin(Math.PI*u2);
    var lift=Math.max(0,1-u2*2.4);         /* 이륙 순간 살짝 늘어나요 */
    sqy=1+0.12*lift; sqx=1-0.06*lift;
    if(u2>0.7) sc=1-0.25*((u2-0.7)/0.3);   /* 구멍에 가까워지며 살짝 작아지기 시작 */
    sh=1-u2;                               /* 바닥 그림자는 점점 옅게 */
  }else{                                   /* 3) 구멍 속으로 뽕 — 작아지며 사라짐 */
    var u3=Math.min(1,(t-EXIT_ARC_MS)/(EXIT_SINK_MS-EXIT_ARC_MS));
    fx=ex.hx; fy=ex.hy+11*u3;
    sc=0.75*(1-0.80*Math.pow(u3,0.9));
    alpha=u3>0.55?Math.max(0,1-(u3-0.55)/0.45):1;
  }
  if(sh>0.02) shadowPix(g,ex.sx,ex.sy+1,7,3,0.30*sh);
  g.save();
  if(alpha<1) g.globalAlpha=alpha;
  g.translate(Math.round(fx),Math.round(fy));
  g.scale(sc*sqx,sc*sqy);
  g.drawImage(spr,-Math.round(spr.width/2),-spr.height+1);
  g.restore();
}
/* '뽕' 이펙트 — 작은 동심원 파동 2겹 + 먼지·별 6점 + 짧은 섬광 (구멍 위에 얹어요) */
var EXIT_POP_MS=380, EXIT_POP_DIRS=[[-1,-0.85],[1,-0.95],[-0.7,-1.45],[0.8,-1.35],[-1.35,-0.25],[1.35,-0.15]];
function drawExitPop(g,now){
  var ex=G.exit;
  if(!ex||!ex.popT0) return;
  var t=now-ex.popT0;
  if(t<0||t>=EXIT_POP_MS) return;
  var cx=ex.hx, cy=ex.hy, i;
  for(i=0;i<2;i++){                        /* 동심원 파동 — 두 번째는 조금 늦게 */
    var tt=t-i*70; if(tt<0) continue;
    var u=Math.min(1,tt/300), k=Math.pow(u,0.55);
    var a=(1-u)*(i?0.55:0.85);
    exitEllipseDots(g,cx,cy,2+12*k,1.6+9*k,i?"rgba(150,240,190,"+a.toFixed(3)+")":"rgba(240,255,245,"+a.toFixed(3)+")");
  }
  for(i=0;i<EXIT_POP_DIRS.length;i++){     /* 톡 터지는 먼지·별 */
    var u2=Math.min(1,t/330), e=1-Math.pow(1-u2,2), dv=EXIT_POP_DIRS[i];
    var dx=dv[0]*(3+7*e), dy=dv[1]*(3+7*e)+6*u2*u2;   /* 살짝 중력으로 떨어져요 */
    var aa=Math.max(0,1-u2);
    pf(g,cx+dx-0.5,cy+dy-0.5,2,2,(i%2?"rgba(198,255,214,":"rgba(255,255,240,")+aa.toFixed(3)+")");
  }
  var uf=Math.min(1,t/120);                /* 들어가는 순간의 짧은 밝은 섬광 */
  if(uf<1){
    var aa2=(1-uf)*0.75, rr=3+6*uf;
    exitEllipseDots(g,cx,cy,rr,rr*0.7,"rgba(255,255,240,"+aa2.toFixed(3)+")");
    exitEllipseDots(g,cx,cy,rr*0.5,rr*0.35,"rgba(255,255,255,"+(aa2*0.9).toFixed(3)+")");
  }
}

/* ---------- 먹이 스프라이트 3종 ---------- */
/* 스프라이트 3종: small(작은생선) · big(통생선) · catnip(캣닢) */
function drawFishKind(g,cx,cy,kind,now,opt){
  opt=opt||{};
  var spr=FOODIMG[kind]||FOODIMG.small;
  if(!spr||!spr.width) return;                  /* 스프라이트 로드 전 */
  g.save();
  if(opt.alpha!=null) g.globalAlpha=opt.alpha;
  var x=Math.round(cx), y=Math.round(cy)+(opt.bob||0);
  if(opt.glow){
    var rr=(kind==="small")?10:15;
    dith(g,x-rr,y-rr+2,rr*2,rr*2-2,"rgba(255,150,196,0.20)",0.4,1);
  }
  var half=Math.round(32*(opt.scale!=null?opt.scale:1));
  g.drawImage(spr,x-half,y-half,half*2,half*2);
  g.restore();
}
function drawFish(g,cx,cy,now,alpha,glow){
  drawFishKind(g,cx,cy,"small",now,{alpha:alpha,glow:glow});
}
/* 먹이 스프라이트의 노란 실루엣 — 줍는 아이템의 '띠 윤곽선'에 써요 (kind별 캐시).
   표시 크기(0.7×) 그대로 스무딩 켜서 구워요 — 최근접 축소로 굽으면 띠가 들쭉날쭉 깨져요 */
var FOOD_OUTLINE={};
var OUT_OFF=[[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]];
function foodOutlineSpr(kind){
  if(FOOD_OUTLINE[kind]!==undefined) return FOOD_OUTLINE[kind];
  var spr=FOODIMG[kind]||FOODIMG.small;
  if(!spr||!spr.width){ FOOD_OUTLINE[kind]=null; return null; }
  var half=Math.round(32*0.7);
  var oc=document.createElement("canvas"); oc.width=half*2+8; oc.height=half*2+8;
  var og=oc.getContext("2d");
  og.imageSmoothingEnabled=true;
  og.drawImage(spr,4,4,half*2,half*2);
  og.globalCompositeOperation="source-in";
  og.fillStyle="#ffd94a"; og.fillRect(0,0,oc.width,oc.height);
  FOOD_OUTLINE[kind]=oc; return oc;
}

/* ================= 렌더 레이어 ================= */
function drawBeam(g,st,cat,now){
  var b=beamTiles(st,cat);
  if(!b.length) return;
  var lured=(cat.state==="lured"), chasing=(cat.state==="chase");
  /* 시선 색: 평상시 진한 호박주황 · 미끼 중 분홍 · 추격 중 적동색.
     크림색 러그 위에서도 한눈에 티가 나도록 '고른 색면 + 2px 실선 테두리 + 바깥 1px 진한 대비선'으로 그려요. */
  var rgb=lured?"255,116,186":(chasing?"255,74,74":"245,128,24");
  var tintA=lured?0.36:(chasing?0.40:0.40);
  var edge=lured?"rgba(219,39,119,0.95)":(chasing?"rgba(220,38,38,0.95)":"rgba(234,88,12,0.95)");
  var outer=lured?"rgba(92,10,55,0.46)":(chasing?"rgba(72,10,10,0.50)":"rgba(88,30,6,0.46)");
  var glow=lured?"#ffd0e6":(chasing?"#ffd2d2":"#ffe0bd");
  var amp=0.90+0.10*Math.sin(now/340);
  var scan=Math.floor(now/90)%CELL;
  for(var i=0;i<b.length;i++){
    var t=b[i], fade=1-i*0.10; if(fade<0.80) fade=0.80;
    var x0=t.x*CELL, y0=t.y*CELL;
    /* 1) 칸 전체를 고른 색면으로 채색 (체크무늬 대신) */
    pf(g,x0,y0,CELL,CELL,"rgba("+rgb+","+(tintA*fade*amp).toFixed(3)+")");
    /* 2) 위에서 아래로 흐르는 스캔라인 (시선 방향이 읽히는 점멸감) */
    pf(g,x0,y0+scan,CELL,2,"rgba("+rgb+","+(0.30*fade).toFixed(3)+")");
    /* 3) 바깥 1px 진한 대비선 — 크림 바닥에서도 타일 윤곽이 서도록 */
    pf(g,x0,y0,CELL,1,outer); pf(g,x0,y0+CELL-1,CELL,1,outer);
    pf(g,x0,y0,1,CELL,outer); pf(g,x0+CELL-1,y0,1,CELL,outer);
    /* 4) 안쪽 2px 크리스프 실선 테두리 */
    pf(g,x0+1,y0+1,CELL-2,2,edge); pf(g,x0+1,y0+CELL-3,CELL-2,2,edge);
    pf(g,x0+1,y0+1,2,CELL-2,edge); pf(g,x0+CELL-3,y0+1,2,CELL-2,edge);
  }
  /* 눈 앞 광점 */
  var d=DIRS[cat.dir];
  var ex=cat.x*CELL+CELL/2+d[0]*13, ey=cat.y*CELL+CELL/2+d[1]*13;
  pf(g,ex-2,ey-2,5,5,edge);
  pf(g,ex-1,ey-1,3,3,glow);
}

function stepBadge(g,x,y,n,amber){
  fillRR(g,x-1,y-1,11,11,2,"rgba(12,9,14,0.86)");
  pf(g,x,y,9,9,amber?"#3a2a14":"#182430");
  pf(g,x,y,9,1,amber?"#e0ad5c":"#7fb4dc");
  pf(g,x,y+8,9,1,amber?"#6b4a22":"#2c4256");
  text3(g,String(n),x+3,y+2,amber?"#ffe1a8":"#d8f0ff");
}

/* ================= 다음 수 의도 / 위험 표시 ================= */
function catIntent(st,cat){
  /* '?'를 띄운 뒤 자리로 돌아가는(return) 고양이도 다음 발걸음을 보여줘요 —
     스턴(freezeT) 턴엔 아직 못 움직이니 궤적을 옅게 그려서 '풀리면 저리 간다'로 읽혀요 */
  if(cat.state==="return"){
    var tgt=(cat.type==="C"&&cat.patrol)?{x:cat.patrol[nearestPatrolIdx(cat)][0],y:cat.patrol[nearestPatrolIdx(cat)][1]}:cat.home;
    var rstp=bfsNext(st,cat,tgt);
    if(rstp) return {dir:dirFromTo(cat,rstp),next:{x:rstp.x,y:rstp.y},frozen:!!cat.freezeT};
    return {dir:cat.dir,next:null,frozen:!!cat.freezeT};
  }
  /* 먹이 냄새에 '?'가 뜬(lured) 고양이 — 다음 턴 먹이 쪽으로 걸어가는 스텝을 보여줘요.
     먹이 위에 이미 올라섰으면 다음 턴 물기라 제자리, 길이 막혔으면 최근접 칸까지. */
  if(cat.state==="lured"){
    var nf=nearestFish(st,cat);
    if(!nf&&cat.lureTgt){ var mf=fishAt(st,cat.lureTgt.x,cat.lureTgt.y); if(mf&&(mf.eater==null||mf.ttl!=null)) nf=mf; }
    if(!nf) return {dir:cat.dir,next:null};
    if(cat.x===nf.x&&cat.y===nf.y) return {dir:cat.dir,next:null};
    var lstp=bfsNext(st,cat,nf);
    if(lstp) return {dir:dirFromTo(cat,lstp),next:{x:lstp.x,y:lstp.y}};
    var lcp=closestReachable(st,cat,nf);
    if(lcp&&(lcp.x!==cat.x||lcp.y!==cat.y)){ var lg=bfsNext(st,cat,lcp); if(lg) return {dir:dirFromTo(cat,lg),next:{x:lg.x,y:lg.y}}; }
    return {dir:dirFromTo(cat,nf),next:null};
  }
  if(cat.state!=="idle") return null;
  if(cat.type==="B"&&cat.dirs){
    return {dir:(cat.dir===cat.dirs[0])?cat.dirs[1]:cat.dirs[0],next:null};
  }
  if(cat.type==="C"&&cat.patrol){
    var pi=cat.pi, ps=cat.psign;
    var pt={x:cat.patrol[pi][0],y:cat.patrol[pi][1]};
    if(cat.x===pt.x&&cat.y===pt.y){
      var nxi=pi+ps;
      if(nxi<0||nxi>=cat.patrol.length){ ps*=-1; nxi=pi+ps; }
      pi=nxi; pt={x:cat.patrol[nxi][0],y:cat.patrol[nxi][1]};
    }
    var stp=bfsNext(st,cat,pt);
    if(stp) return {dir:dirFromTo(cat,stp),next:{x:stp.x,y:stp.y}};
    return {dir:cat.dir,next:null};
  }
  return null;
}
function drawIntent(g,st,now){
  var pu=0.34+0.20*(0.5+0.5*Math.sin(now/340));
  for(var i=0;i<st.cats.length;i++){
    var c=st.cats[i], it=catIntent(st,c);
    if(!it) continue;
    var fa=it.frozen?0.5:1;
    var cx=c.x*CELL+CELL/2, cy=c.y*CELL+CELL/2;
    if(it.next){
      var nx=it.next.x*CELL+CELL/2, ny=it.next.y*CELL+CELL/2;
      for(var s=0.2;s<=1.001;s+=0.13){
        pf(g,Math.round(cx+(nx-cx)*s)-1,Math.round(cy+(ny-cy)*s)-1,2,2,"rgba(120,226,190,"+(pu*0.55*fa).toFixed(3)+")");
      }
      var mx=it.next.x*CELL+13, my=it.next.y*CELL+13;
      pf(g,mx,my,8,1,"rgba(120,226,190,"+(pu*0.7*fa).toFixed(3)+")");
      pf(g,mx,my+7,8,1,"rgba(120,226,190,"+(pu*0.7*fa).toFixed(3)+")");
      pf(g,mx,my,1,8,"rgba(120,226,190,"+(pu*0.7*fa).toFixed(3)+")");
      pf(g,mx+7,my,1,8,"rgba(120,226,190,"+(pu*0.7*fa).toFixed(3)+")");
    }
  }
}
/* 이동 방향 화살촉: dir 쪽으로 뾰족한 채워진 삼각형 */
function arrowTip(g,cx,cy,dir,len,half,col){
  /* 밑변은 뒤쪽, 꼭짓점은 dir 쪽 — 상하좌우 모두 그 방향으로 뾰족하게 */
  var d=DIRS[dir]||[0,0];
  for(var t=-len;t<=len;t++){
    var w=Math.round(half*(1-(t+len)/(2*len)));
    if(w<0) continue;
    if(d[0]!==0) pf(g,cx+t*d[0],cy-w,1,w*2+1,col);
    else pf(g,cx-w,cy+t*d[1],w*2+1,1,col);
  }
}
function drawTargets(g,st,now){
  /* 모바일 화면에서도 한눈에 보이도록: 칸 전체 색 채움 + 2px 실선 테두리 + 중앙 화살촉 */
  var blink=0.5+0.5*Math.sin(now/220);
  var fish=!!G.fishMode;
  var targets=fish?validFishTiles():(G.moveTiles||[]);
  var col=fish?(G.fishKind==="catnip"?"150,235,170":(G.fishKind==="big"?"255,176,110":"255,158,196")):"86,205,255";
  var edge=fish?col:"196,246,255";
  var a=(fish?0.30:0.16)+0.10*blink*(fish?1:0.5);
  var edgeA=fish?0.96:0.50, edgeA2=fish?0.88:0.42, outerA=fish?0.60:0.26;
  for(var ti=0;ti<targets.length;ti++){
    var tt=targets[ti], x0=tt.x*CELL, y0=tt.y*CELL;
    /* 1) 칸 전체를 옅게 물들인다 */
    pf(g,x0,y0,CELL,CELL,"rgba("+col+","+a.toFixed(3)+")");
    pf(g,x0+2,y0+2,CELL-4,CELL-4,"rgba("+col+","+(a*0.50).toFixed(3)+")");
    /* 2) 바깥 1px 진한 선 — 크림색 러그에서도 윤곽이 서도록 */
    pf(g,x0,y0,CELL,1,"rgba(10,32,44,"+outerA+")");
    pf(g,x0,y0+CELL-1,CELL,1,"rgba(10,32,44,"+outerA+")");
    pf(g,x0,y0,1,CELL,"rgba(10,32,44,"+outerA+")");
    pf(g,x0+CELL-1,y0,1,CELL,"rgba(10,32,44,"+outerA+")");
    /* 3) 안쪽 2px 실선 테두리 */
    pf(g,x0+1,y0+1,CELL-2,2,"rgba("+edge+","+edgeA+")");
    pf(g,x0+1,y0+CELL-3,CELL-2,2,"rgba("+edge+","+edgeA2+")");
    pf(g,x0+1,y0+1,2,CELL-2,"rgba("+edge+","+edgeA+")");
    pf(g,x0+CELL-3,y0+1,2,CELL-2,"rgba("+edge+","+edgeA2+")");
    if(fish){
      pf(g,x0+CELL/2-3,y0+CELL/2-1,5,3,"rgba("+col+",0.95)");
      pf(g,x0+CELL/2-5,y0+CELL/2-2,2,2,"rgba("+col+",0.80)");
    }else{
      var md=(tt.dir!=null)?tt.dir:(G.playerDir||0);
      var cx=Math.round(x0+CELL/2), cy=Math.round(y0+CELL/2);
      arrowTip(g,cx,cy,md,10,7,"rgba(6,28,40,0.30)");
      arrowTip(g,cx,cy,md,8,5,"rgba(240,253,255,"+(0.60+0.16*blink).toFixed(3)+")");
    }
  }
}
/* 키보드로 조준한 칸 — 선명한 노랑(외곽)+흰색(안쪽) 이중 타겟 테두리 */
function drawFishAim(g,now){
  if(!G.fishMode||!G.fishAim) return;
  var a=G.fishAim, x0=a.x*CELL, y0=a.y*CELL, cx=Math.round(x0+CELL/2), cy=Math.round(y0+CELL/2);
  var bl=0.5+0.5*Math.sin(now/140);
  var amber="rgba(255,214,64,"+(0.78+0.22*bl).toFixed(3)+")";
  var white="rgba(255,255,255,"+(0.80+0.20*bl).toFixed(3)+")";
  /* 1) 밝은 바탕 — 다른 표시 위에서도 조준 칸만 훤해지게 */
  pf(g,x0,y0,CELL,CELL,"rgba(255,255,255,"+(0.12+0.10*bl).toFixed(3)+")");
  /* 2) 바깥 3px 노랑 테두리 */
  pf(g,x0,y0,CELL,3,amber); pf(g,x0,y0+CELL-3,CELL,3,amber);
  pf(g,x0,y0,3,CELL,amber); pf(g,x0+CELL-3,y0,3,CELL,amber);
  /* 3) 안쪽 2px 흰색 테두리 */
  pf(g,x0+3,y0+3,CELL-6,2,white); pf(g,x0+3,y0+CELL-5,CELL-6,2,white);
  pf(g,x0+3,y0+3,2,CELL-6,white); pf(g,x0+CELL-5,y0+3,2,CELL-6,white);
  /* 4) 네 모서리 굵은 브래킷 */
  var arm=9, th=3, o=2, edge="rgba(255,214,64,0.98)";
  pf(g,x0-o,y0-o,arm,th,edge); pf(g,x0-o,y0-o,th,arm,edge);
  pf(g,x0+CELL+o-arm,y0-o,arm,th,edge); pf(g,x0+CELL+o-th,y0-o,th,arm,edge);
  pf(g,x0-o,y0+CELL+o-th,arm,th,edge); pf(g,x0-o,y0+CELL+o-arm,th,arm,edge);
  pf(g,x0+CELL+o-arm,y0+CELL+o-th,arm,th,edge); pf(g,x0+CELL+o-th,y0+CELL+o-arm,th,arm,edge);
  /* 5) 가운데 십자선 — 선명한 흰색 */
  pf(g,cx-8,cy-1,16,3,"rgba(18,12,6,0.55)");
  pf(g,cx-1,cy-8,3,16,"rgba(18,12,6,0.55)");
  pf(g,cx-6,cy-1,12,2,"rgba(255,255,255,0.98)");
  pf(g,cx-1,cy-6,2,12,"rgba(255,255,255,0.98)");
  /* 6) 2칸 조준이면 거리 배지 */
  if(a.step===2) stepBadge(g,x0+CELL-13,y0+3,2,true);
}
function drawWarnMarks(g,st,now){
  var blink=0.5+0.5*Math.sin(now/190);
  for(var wi=0;wi<G.dangerTiles.length;wi++){
    var wt=G.dangerTiles[wi];
    var wx=wt.x*CELL, wy=wt.y*CELL;
    var crit=!!wt.killed;
    /* 1) 칸 전체 붉은 색면 — 이동칸(하늘색)과 헷갈리지 않게 확실히 빨갛게 */
    pf(g,wx,wy,CELL,CELL,"rgba(239,68,68,"+((crit?0.34:0.30)+0.06*blink).toFixed(3)+")");
    /* 2) 바깥 1px 진홍 대비선 + 안쪽 2px 실선 테두리 */
    pf(g,wx,wy,CELL,1,"rgba(90,10,18,0.55)"); pf(g,wx,wy+CELL-1,CELL,1,"rgba(90,10,18,0.55)");
    pf(g,wx,wy,1,CELL,"rgba(90,10,18,0.55)"); pf(g,wx+CELL-1,wy,1,CELL,"rgba(90,10,18,0.55)");
    pf(g,wx+1,wy+1,CELL-2,2,"rgba(220,38,38,0.95)"); pf(g,wx+1,wy+CELL-3,CELL-2,2,"rgba(220,38,38,0.95)");
    pf(g,wx+1,wy+1,2,CELL-2,"rgba(220,38,38,0.95)"); pf(g,wx+CELL-3,wy+1,2,CELL-2,"rgba(220,38,38,0.95)");
  }
}

/* ---------- 기척(발소리) 범위 ---------- */
function senseTilesOf(st,cat){
  var out=[];
  if(!cat.sense) return out;
  for(var y=0;y<ROWS;y++) for(var x=0;x<COLS;x++){
    if(x===cat.x&&y===cat.y) continue;
    if(Math.abs(x-cat.x)+Math.abs(y-cat.y)>cat.sense) continue;
    if(isBlocked(st,x,y)) continue;
    if(!lineClear(st,cat,{x:x,y:y})) continue;
    out.push({x:x,y:y});
  }
  return out;
}
/* 이 칸이 (어느 고양이든) 시선 안에 있는지 */
function inAnyBeam(st,px,py){
  for(var i=0;i<st.cats.length;i++){
    var c=st.cats[i];
    if(c.state!=="idle"&&c.state!=="lured"&&c.state!=="chase") continue;
    var b=beamTiles(st,c);
    for(var j=0;j<b.length;j++){ if(b[j].x===px&&b[j].y===py) return true; }
  }
  return false;
}
function drawSense(g,st,cat,now){
  /* 눈(시야 콘)과 구분되는 보랏빛 색면 = 귀(기척)가 보는 반경.
     생선에 정신이 팔린 lured/eat 중에는 귀도 닫혀서 안 그려집니다. */
  if(cat.state!=="idle"&&cat.state!=="return") return;
  if(!cat.sense) return;
  var tl=senseTilesOf(st,cat);
  var pulse=0.5+0.5*Math.sin(now/520+cat.x*1.3);
  var fill="rgba(139,69,247,"+(0.28+0.06*pulse).toFixed(3)+")";
  for(var i=0;i<tl.length;i++){
    var t=tl[i], x0=t.x*CELL, y0=t.y*CELL;
    /* 시선(호박색)이 이미 깔린 칸은 보라색을 겹치지 않게 건넌다.
       그 칸은 어차피 '보이는 칸'이라 들키는 결과가 더 세고, 두 색이 섞이면 둘 다 탁해져요. */
    if(inAnyBeam(st,t.x,t.y)) continue;
    /* 1) 칸 전체 보랏빛 색면 — 크림 타일 위에서도 한눈에 티가 나도록 */
    pf(g,x0,y0,CELL,CELL,fill);
    /* 2) 바깥 1px 진보라 대비선 + 안쪽 2px 실선 테두리 */
    pf(g,x0,y0,CELL,1,"rgba(45,16,95,0.50)"); pf(g,x0,y0+CELL-1,CELL,1,"rgba(45,16,95,0.50)");
    pf(g,x0,y0,1,CELL,"rgba(45,16,95,0.50)"); pf(g,x0+CELL-1,y0,1,CELL,"rgba(45,16,95,0.50)");
    pf(g,x0+1,y0+1,CELL-2,2,"rgba(124,58,237,0.92)"); pf(g,x0+1,y0+CELL-3,CELL-2,2,"rgba(124,58,237,0.92)");
    pf(g,x0+1,y0+1,2,CELL-2,"rgba(124,58,237,0.92)"); pf(g,x0+CELL-3,y0+1,2,CELL-2,"rgba(124,58,237,0.92)");
    /* 3) 모서리 3px 진한 악센트 */
    pf(g,x0+1,y0+1,3,3,"rgba(76,29,149,0.95)"); pf(g,x0+CELL-4,y0+1,3,3,"rgba(76,29,149,0.95)");
    pf(g,x0+1,y0+CELL-4,3,3,"rgba(76,29,149,0.95)"); pf(g,x0+CELL-4,y0+CELL-4,3,3,"rgba(76,29,149,0.95)");
  }
}

/* ---------- 다음 턴 시야·기척 미리보기 ---------- */
/* 고양이가 "이번 턴 이동을 마친 뒤" 서 있을 자리와 방향을 예측해요.
   chase는 플레이어 행동에 따라 달라져서 예측 불가 → 표시 안 함.
   lured는 먹이 방향 다음 칸만, eat는 제자리라 표시할 게 없어요. */
function nextCatPose(st,cat){
  if(cat.freezeT) return {x:cat.x,y:cat.y,dir:cat.dir};        /* 스턴 — 제자리 그대로 */
  if(cat.state==="chase"||cat.state==="eat") return null;
  /* 유인 중: 먹이 쪽으로 걸어가는 다음 칸 — 시야·기척이 닫혀 있으니 위치만 예측해요 */
  if(cat.state==="lured"){
    var nf=nearestFish(st,cat);
    if(!nf&&cat.lureTgt){ var mf=fishAt(st,cat.lureTgt.x,cat.lureTgt.y); if(mf&&(mf.eater==null||mf.ttl!=null)) nf=mf; }
    if(!nf||(cat.x===nf.x&&cat.y===nf.y)) return {x:cat.x,y:cat.y,dir:cat.dir,blind:true};
    var lf=bfsNext(st,cat,nf);
    if(lf) return {x:lf.x,y:lf.y,dir:dirFromTo(cat,lf),blind:true};
    var lcp=closestReachable(st,cat,nf);
    if(lcp&&(lcp.x!==cat.x||lcp.y!==cat.y)){ var lg=bfsNext(st,cat,lcp); if(lg) return {x:lg.x,y:lg.y,dir:dirFromTo(cat,lg),blind:true}; }
    return {x:cat.x,y:cat.y,dir:dirFromTo(cat,nf),blind:true};
  }
  if(cat.state==="return"){
    var tgt=(cat.type==="C"&&cat.patrol)?{x:cat.patrol[nearestPatrolIdx(cat)][0],y:cat.patrol[nearestPatrolIdx(cat)][1]}:cat.home;
    var stp=bfsNext(st,cat,tgt);
    return stp?{x:stp.x,y:stp.y,dir:dirFromTo(cat,stp)}:{x:cat.x,y:cat.y,dir:cat.dir};
  }
  if(cat.type==="B"&&cat.dirs){
    return {x:cat.x,y:cat.y,dir:(cat.dir===cat.dirs[0])?cat.dirs[1]:cat.dirs[0]};
  }
  if(cat.type==="C"&&cat.patrol){
    var it=catIntent(st,cat);
    if(it&&it.next) return {x:it.next.x,y:it.next.y,dir:it.dir};
    return {x:cat.x,y:cat.y,dir:(it&&it.dir!=null)?it.dir:cat.dir};
  }
  return {x:cat.x,y:cat.y,dir:cat.dir};                        /* A형 — 자리·방향 고정 */
}
function drawNextZones(g,st,now){
  for(var i=0;i<st.cats.length;i++){
    var c=st.cats[i], pose=nextCatPose(st,c);
    if(!pose) continue;
    /* 유인 고양이는 시야·기척이 닫혀 있어서(blind) 영역 점선 없이 다음 위치만 찍어요 */
    var fake={x:pose.x,y:pose.y,dir:pose.dir,sense:c.sense};
    var beam=pose.blind?[]:beamTiles(st,fake), beamKey={};
    for(var j=0;j<beam.length;j++) beamKey[beam[j].x+","+beam[j].y]=1;
    var senseT=(!pose.blind&&c.sense)?senseTilesOf(st,fake):[];
    for(var s=0;s<senseT.length;s++){
      var t=senseT[s]; if(beamKey[t.x+","+t.y]) continue;
      zoneTileDash(g,t.x,t.y,"rgba(160,130,255,",0.42);
    }
    for(var b=0;b<beam.length;b++){
      var t2=beam[b];
      zoneTileDash(g,t2.x,t2.y,"rgba(120,220,255,",0.55);
    }
    /* 다음 위치 표시 — 고양이 실루엣 대신 작은 점선 괄호 */
    var nx=pose.x*CELL, ny=pose.y*CELL, kc="rgba(160,240,255,0.75)";
    pf(g,nx+5,ny+5,6,2,kc); pf(g,nx+5,ny+5,2,6,kc);
    pf(g,nx+CELL-11,ny+5,6,2,kc); pf(g,nx+CELL-7,ny+5,2,6,kc);
    pf(g,nx+5,ny+CELL-7,6,2,kc); pf(g,nx+5,ny+CELL-11,2,6,kc);
    pf(g,nx+CELL-11,ny+CELL-7,6,2,kc); pf(g,nx+CELL-7,ny+CELL-11,2,6,kc);
  }
}
/* 한 칸에 고정 점선 테두리만 */
function zoneTileDash(g,tx,ty,rgb,edgeA){
  var x0=tx*CELL, y0=ty*CELL;
  for(var a=0;a<CELL;a+=8){
    var w=Math.min(4,CELL-a);
    pf(g,x0+a,y0,w,2,rgb+edgeA+")"); pf(g,x0+a,y0+CELL-2,w,2,rgb+edgeA+")");
    pf(g,x0,y0+a,2,w,rgb+edgeA+")"); pf(g,x0+CELL-2,y0+a,2,w,rgb+edgeA+")");
  }
}

/* ---------- 바닥에 떨어져 있는 생선(줍기) ---------- */
function drawPickupEntity(g,st,now){
  if(!st.pickups||!st.pickups.length) return;
  for(var i=0;i<st.pickups.length;i++){
    var pk=st.pickups[i];
    var onP=st.grid[pk.y]&&st.grid[pk.y][pk.x]==="^";
    var ptop=onP?perchTopPx(pk.x,pk.y):0;
    var x0=pk.x*CELL, y0=pk.y*CELL, cx=x0+CELL/2, cy=onP?ptop+3:y0+CELL/2;
    var pulse=0.5+0.5*Math.sin(now/430+pk.x*1.7);
    /* 그림자는 바닥에 그대로 — 몸만 살짝 공중에 떠서 '주울 수 있음'을 표시 */
    shadowPix(g,cx,onP?ptop+7:y0+CELL-7,9,3,0.24);
    var bob=Math.round(Math.sin(now/430+pk.x*1.7)*2);
    var fcy=cy-7+bob;
    /* 노란색 띠 윤곽선 — 노란 실루엣을 8방향으로 살짝 어긋나게 깔고 그 위에 본체 */
    var os=foodOutlineSpr(pk.kind);
    if(os){
      var half=Math.round(32*0.7);
      for(var oi=0;oi<8;oi++){
        g.drawImage(os,Math.round(cx)+OUT_OFF[oi][0]-half-4,Math.round(fcy)+OUT_OFF[oi][1]-half-4);
      }
    }
    drawFishKind(g,cx,fcy,pk.kind,now,{scale:0.7});
    var sx=Math.round(cx+7), sy=Math.round(fcy-7);
    pf(g,sx,sy-1,1,3,"rgba(255,246,208,"+(0.35+0.45*pulse).toFixed(3)+")");
    pf(g,sx-1,sy,3,1,"rgba(255,246,208,"+(0.35+0.45*pulse).toFixed(3)+")");
  }
}

function drawFishEntity(g,st,now){
  /* 던져 둔 생선: 아무도 먹지 않으면 판이 끝날 때까지 바닥에 그대로.
     캣닢만 시간제 — ttl턴이 지나면 향기가 사라지고, 남은 턴수를 칸 구석에 표시해요.
     먹는 중인 고양이가 그 칸을 차지하고 있으면 바닥 생선은 그리지 않아요 —
     그 고양이는 '입에 생선을 문' eat 프레임으로 그려지므로 생선이 두 번 보이면 안 되니까요.
     (게임 상태 st.fishes·eater·eatLeft는 그대로 두고 그리기만 건너뜀) */
  if(!st.fishes||!st.fishes.length) return;
  for(var i=0;i<st.fishes.length;i++){
    var f=st.fishes[i];
    var onP=st.grid[f.y]&&st.grid[f.y][f.x]==="^";
    var ptop=onP?perchTopPx(f.x,f.y):0;
    var cx=f.x*CELL+CELL/2, cy=onP?ptop+4:f.y*CELL+CELL/2;
    if(f.eater!=null){
      var held=false;
      for(var ci=0;ci<st.cats.length;ci++){
        var cc=st.cats[ci];
        if(cc.id===f.eater&&cc.x===f.x&&cc.y===f.y&&cc.state==="eat"){ held=true; break; }
      }
      if(held) continue;                       /* 입에 물고 있는 중 → 바닥 중복 렌더 생략 */
    }
    dith(g,cx-11,cy-9,22,18,"rgba(255,170,205,0.14)",0.4,1);
    drawFishKind(g,cx,cy,f.kind,now,{scale:0.7});
    if(f.ttl!=null) stepBadge(g,f.x*CELL+CELL-13,f.y*CELL+2,f.ttl,false);
  }
}

/* ================= 메인 드로우 ================= */
function draw(){
  var now=performance.now();
  G.t=now;
  ctx.imageSmoothingEnabled=false;
  ctx.clearRect(0,0,CVW,CVH);
  if(!G.st){
    dctx.imageSmoothingEnabled=false;
    dctx.clearRect(0,0,cvEl.width,cvEl.height);
    return;
  }
  var st=G.st;

  if(G.mode==="anim"&&G.pending&&now-G.pending.t0>=(G.pending.dur||ANIM_MS)){
    finishTurn();
  }

  ctx.drawImage(board,0,0);

  /* 수풀 흔들림 — 보드에서 빼 둔 칸을 매 프레임 감쇠 진동으로 다시 그려요.
     흔들림이 끝난 칸은 다음 구울 때 되돌리려 즉시 재베이크해요 */
  if(G.bushShake){
    var reBake=false;
    for(var bsk2 in G.bushShake){
      var bt2=G.bushShake[bsk2], bAge2=now-bt2.t0;
      if(bAge2>=620){ delete G.bushShake[bsk2]; reBake=true; continue; }
      var bxy=bsk2.split(",");
      paintFeatureCell(ctx,st,+bxy[0],+bxy[1],Math.sin(bAge2/52)*2.4*(1-bAge2/620));
    }
    if(reBake) bakeBoard(st);
  }

  if(G.mode!=="title"){
    for(var i=0;i<st.cats.length;i++){
      var c=st.cats[i];
      if(c.state==="idle"||c.state==="lured"||c.state==="chase") drawBeam(ctx,st,c,now);
    }
    /* 기척은 시선 위에 얹는다(시선이 깔린 칸은 기척을 건너뛰므로 두 색이 섞이지 않아요) */
    for(var si=0;si<st.cats.length;si++) drawSense(ctx,st,st.cats[si],now);
  }
  if(G.mode==="play"){
    drawTargets(ctx,st,now);
    drawFishAim(ctx,now);
  }

  if(!(G.pending&&G.pending.arc)){ drawPickupEntity(ctx,st,now); drawFishEntity(ctx,st,now); }

  if(G.pending&&G.pending.arc){
    var fa=G.pending.arc, t2=Math.min(1,(now-fa.t0)/FISH_MS);
    if(t2<1){
      var fx0=fa.from.x*CELL+CELL/2, fy0=fa.from.y*CELL+CELL/2;
      var fx1=fa.to.x*CELL+CELL/2, fy1=fa.to.y*CELL+CELL/2;
      if(st.grid[fa.to.y][fa.to.x]==="^") fy1=perchTopPx(fa.to.x,fa.to.y)+4;
      var ax=fx0+(fx1-fx0)*t2, ay=fy0+(fy1-fy0)*t2-CELL*0.6*Math.sin(Math.PI*t2);
      drawFishKind(ctx,ax,ay,fa.kind||"small",now,{glow:true});
    }
  }

  /* 주운 생선이 떠오르며 사라지는 연출 */
  if(G.fx&&G.fx.length){
    for(var fi2=G.fx.length-1;fi2>=0;fi2--){
      var fxo=G.fx[fi2], k2=(now-fxo.t0)/520;
      if(k2>=1){ G.fx.splice(fi2,1); continue; }
      var fxp=fxo.x*CELL+CELL/2, fyp=fxo.y*CELL+CELL/2-8-k2*22;
      drawFishKind(ctx,fxp,fyp,fxo.kind,now,{alpha:1-k2,glow:false});
      pf(ctx,Math.round(fxp+6),Math.round(fyp-8),1,1,"rgba(255,246,208,"+(1-k2).toFixed(3)+")");
    }
  }

  /* 엔티티 깊이 정렬 */
  var ents=[];
  for(var k=0;k<st.cats.length;k++){ ents.push({y:st.cats[k].ry,cat:st.cats[k]}); }
  ents.sort(function(a,b){ return a.y-b.y; });

  var pDrawn=false;
  for(var e2=0;e2<ents.length;e2++){
    if(!pDrawn&&st.player.ry<ents[e2].y){
      drawPlayerNow(st,now,G.playerDir); pDrawn=true;
    }
    var cat=ents[e2].cat;
    /* 쿠키(C)의 3칸 도약: 턴 애니메이션 동안 시작점→착지점을 직선으로 옮기고
       몸만 sin(πt) 높이로 띄워요 — 그림자는 바닥선에 그대로 남습니다. */
    var jp=catJumpProgress(cat,now);
    if(jp){ cat.rx=jp.x; cat.ry=jp.y; }
    else{
      cat.rx+=(cat.x-cat.rx)*0.30; cat.ry+=(cat.y-cat.ry)*0.30;
      if(Math.abs(cat.rx-cat.x)<0.01) cat.rx=cat.x;
      if(Math.abs(cat.ry-cat.y)<0.01) cat.ry=cat.y;
    }
    /* 발판(^)을 오르내릴 때: 논리 위치(목적지)가 발판이면 이동 시작과 함께 몸이 먼저 뜨고,
       뜬 채로 상판 위로 들어가요 — 들어간 뒤에 올라가는 게 아니라 '타고' 오르는 느낌.
       내려올 때도 먼저 몸을 숙이듯 내려오면서 빠져나가요. lift = 발 들어올림 픽셀. */
    var onP2=(cat.x>=0&&cat.x<COLS&&cat.y>=0&&cat.y<ROWS&&st.grid[cat.y][cat.x]==="^");
    var liftT=onP2?(cat.y*CELL+CELL-4-perchTopPx(cat.x,cat.y)):0;
    if(cat.lift==null) cat.lift=liftT;
    cat.lift+=(liftT-cat.lift)*0.42;
    if(Math.abs(cat.lift-liftT)<0.4) cat.lift=liftT;
    drawCatEntity(ctx,cat,now,jp?{pose:"jump",airLift:jp.lift}:null);
  }
  if(!pDrawn) drawPlayerNow(st,now,G.playerDir);
  drawBushFront(ctx,st);
  drawCanopyFront(ctx,st);
  drawBiteFx(ctx,now);              /* 🍫 초콜릿 한 입 부스러기 */
  drawExitPop(ctx,now);            /* '뽕' 이펙트는 나뭇잎 위에 얹어 보이게 */

  if(G.mode==="play"){
    drawIntent(ctx,st,now);
    if(!G.fishMode) drawWarnMarks(ctx,st,now);
    if(G.nextPeek||G.peekAlways) drawNextZones(ctx,st,now);
  }
  if((G.mode==="play"||G.mode==="anim")&&anyChasing()) drawStamGauge(ctx,st,now);

  blit();
}

function blit(){
  dctx.imageSmoothingEnabled=false;
  dctx.drawImage(low,0,0,cvEl.width,cvEl.height);
}

/* ---------- 🍫 초콜릿 한 입: 머리 위로 부스러기가 톡 터져 사라져요 ----------
   수명·상태는 controller 가 G.bites 에 남기고 다 그린 항목은 여기서 지워요 (520ms). */
var BITE_DIRS=[[-1,-1],[0,-1],[1,-1],[-1,1],[1,1],[0,1]];
function drawBiteFx(g,now){
  if(!G.bites||!G.bites.length) return;
  for(var i=G.bites.length-1;i>=0;i--){
    var b=G.bites[i], k=(now-b.t0)/520;
    if(k>=1){ G.bites.splice(i,1); continue; }
    var cx=Math.round(b.x*CELL+CELL/2), cy=Math.round(b.y*CELL+CELL-8-25)+4;
    var a=1-k;
    for(var j=0;j<BITE_DIRS.length;j++){
      var d=BITE_DIRS[j], sp=2+(j%3)+k*11;
      var px=Math.round(cx+d[0]*sp-1), py=Math.round(cy+d[1]*sp+6*k*k);
      /* 진한 초콜릿 + 밝은 부스러기 테두리 — 흙바닥·잔디 어디서나 눈에 들어오게 */
      pf(g,px+1,py+1,2,2,"rgba(48,26,10,"+(a*0.55).toFixed(3)+")");
      pf(g,px,py,2,2,
         (j%2?"rgba(246,206,140,":"rgba(138,86,42,")+a.toFixed(3)+")");
      if(j%3===0) pf(g,px,py,1,1,"rgba(255,240,205,"+(a*0.9).toFixed(3)+")");
    }
  }
}

function drawPlayerNow(st,now,plDir){
  var pl=st.player;
  if(G.exit){ drawExitPlayer(ctx,now,plDir); return; }   /* 출구 연출 중엔 사람 대신 점프 연출 */
  pl.rx+=(pl.x-pl.rx)*0.26; pl.ry+=(pl.y-pl.ry)*0.26;
  if(Math.abs(pl.rx-pl.x)<0.01) pl.rx=pl.x;
  if(Math.abs(pl.ry-pl.y)<0.01) pl.ry=pl.y;
  var moving=Math.abs(pl.rx-pl.x)>0.02||Math.abs(pl.ry-pl.y)>0.02;
  /* 수풀 칸에 자리 잡으면 사람은 잎 속에 완전히 가려져 그리지 않아요 (들어가는 순간엔 보여요) */
  if(!moving&&isHideTile(st,pl.x,pl.y)) return;
  drawHuman(ctx,{rx:pl.rx,ry:pl.ry},now,plDir,moving);
}

/* ---------- 추격 지구력 게이지: 플레이어 머리 위 도트 스타일 ----------
   번개 아이콘 + 에너지 핍 3개. 다 쓰면 빨간 점멸 — 이번 턴 못 움직인다는 신호 */
function drawStamGauge(g,st,now){
  var pl=st.player;
  var cx=Math.round(pl.rx*CELL+CELL/2);
  var headY=Math.round(pl.ry*CELL+CELL-8-25);      /* 인간 스프라이트 머리 꼭대기 */
  var pw=34, ph=12, x0=cx-(pw>>1), y0=headY-15;
  var out=(st.stam||0)<=0;
  fillRR(g,x0,y0,pw,ph,3,"rgba(9,7,14,0.80)");
  pf(g,x0+1,y0, pw-2,1,"rgba(255,255,255,0.10)");
  if(out){
    var a=(0.55+0.45*Math.sin(now/140)).toFixed(3);
    pf(g,x0,y0,pw,1,"rgba(255,80,95,"+a+")"); pf(g,x0,y0+ph-1,pw,1,"rgba(255,80,95,"+a+")");
    pf(g,x0,y0,1,ph,"rgba(255,80,95,"+a+")"); pf(g,x0+pw-1,y0,1,ph,"rgba(255,80,95,"+a+")");
  }
  /* 번개 아이콘: 1px 도트 + 진한 외곽선 */
  var BM=["..##.",".##..",".##..","####.","..##.","##...","#...."];
  var bx=x0+4, by=y0+3, bw=BM[0].length, bh=BM.length;
  for(var oy=-1;oy<=1;oy++)for(var ox=-1;ox<=1;ox++){
    if(!ox&&!oy) continue;
    g.fillStyle="#241505";
    for(var r1=0;r1<bh;r1++)for(var i1=0;i1<bw;i1++)
      if(BM[r1][i1]==="#") g.fillRect(bx+i1+ox,by+r1+oy,1,1);
  }
  g.fillStyle="#ffd45e";
  for(var r2=0;r2<bh;r2++)for(var i2=0;i2<bw;i2++)
    if(BM[r2][i2]==="#") g.fillRect(bx+i2,by+r2,1,1);
  /* 에너지 핍 3개: 채움 = 초록(마지막 1칸은 호박 경고), 빈 칸 = 어두운 속 빈 슬롯 */
  for(var i=0;i<STAM_MAX;i++){
    var px0=x0+12+i*7, py0=y0+2, full=i<(st.stam||0);
    fillRR(g,px0,py0,5,8,1,full?"#0c2417":"#101a15");
    if(full){
      var warn1=(st.stam===1);
      pf(g,px0+1,py0+1,3,6,warn1?"#ffb347":"#5fe08d");
      pf(g,px0+1,py0+1,3,1,warn1?"#ffe3ad":"#d6ffe6");
    }else{
      pf(g,px0+1,py0+1,3,6,"#2a3b32");
      pf(g,px0+1,py0+6,3,1,"#172019");
    }
  }
}

function loop(){ draw(); requestAnimationFrame(loop); }

/* ---------- 쿠키(C) 웅크림 도약 진행률 ----------
   턴 애니메이션(G.pending) 안에서만 동작해요. x·y = 바닥선(그림자) 위치,
   lift = 몸이 떠오른 높이(px). 뛰는 칸 수가 많을수록 조금 더 높게 뜁니다. */
function catJumpProgress(cat,now){
  if(!cat||!cat.jump||!G.pending) return null;
  var dur=G.pending.dur||JUMP_ANIM_MS;
  var t=(now-G.pending.t0)/dur;
  if(t<0) t=0; if(t>1) t=1;
  var j=cat.jump;
  var span=Math.max(Math.abs(j.toX-j.fromX),Math.abs(j.toY-j.fromY));
  return { x:j.fromX+(j.toX-j.fromX)*t, y:j.fromY+(j.toY-j.fromY)*t,
           lift:Math.sin(Math.PI*t)*CAT_JUMP_H*(0.7+0.1*span), t:t };
}

