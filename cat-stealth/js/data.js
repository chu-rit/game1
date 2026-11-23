"use strict";
/* ===== Model-Data: 상수 · 생선 정의 · 스테이지 ===== */
var N=9, CELL=40, CV=N*CELL;
/* ---- 현재 스테이지 보드 크기 ----
   N·CV 는 9×9 기준값(에디터·스프라이트 좌표계)으로 남겨 두고,
   본게임 보드는 맵 줄 수(ROWS)·칸 수(COLS)에 맞춰 loadStage 가 갱신해요.
   맵이 9×9 면 CVW=CVH=CV 로 예전과 똑같아요. */
var ROWS=N, COLS=N, CVW=CV, CVH=CV;
function setBoardSize(rows,cols){
  ROWS=Math.max(1,rows|0); COLS=Math.max(1,cols|0);
  CVW=COLS*CELL; CVH=ROWS*CELL;
}
var DIRS=[[0,-1],[1,0],[0,1],[-1,0]]; /* 0↑ 1→ 2↓ 3← */
var SIGHT_LEN=4, FISH_RANGE=2, CHASE_LOST=3;
/* 기척(귀) 범위는 '고양이 종류'에 붙은 고정값 — 레벨마다 바뀌지 않아요.
   A 고정 감시 · B 교대 감시 · C 순회 */
var CAT_SENSE={ A:2, B:2, C:2 };   /* 모든 고양이 기척(귀) 기본 2칸 — 벽·가구 사이면 끊김(lineClear) */
var STEP_MS=200, ANIM_MS=210, FISH_MS=190, UNDO_MAX=80;
var STAM_MAX=3;   /* 추격 중 지구력: 들키면 3칸, 다 쓰면 제자리에서 1턴 대기 후 완충 */
var HINT_DEFAULT="바닥의 먹이를 밟으면 주워요 · 보라 점선(기척) 안에 서면 들켜요";

/* ---------------------------- 생선 3종 ----------------------------
   lure  : 유인 사거리(맨해튼 칸). 이 안에 떨어진 생선이 있으면 고양이가 걸어와요.
   eat   : 다 먹는 데 걸리는 턴 수. 1 = 한 입, 2 = 두 턴, -1 = 영원히(큰 통생선).
   range : 던지기 사거리(상하좌우 직선 칸 수). 작은 생선은 가벼워서 멀리 날아가요.
   생선은 아무도 먹지 않으면 바닥에서 절대 사라지지 않아요. 고양이가 다 먹었을 때만 없어져요. */
var KIND={
  small :{label:"작은 생선", lure:3, eat:1,  range:3},
  big   :{label:"큰 통생선", lure:3, eat:-1, range:2},
  catnip:{label:"캣닢",      lure:5, eat:2,  range:2}
};
var FISH_ORDER=["small","big","catnip"];
/* 아이템 상세 정보(인벤토리 슬롯을 길게 누르면 뜨는 카드) — 아래 수치는 KIND·model.js 실제 동작과 같아요. */
var FOOD_TIP="던지기는 상하좌우 직선 · 작은 생선 3칸, 통생선·캣닢 2칸 · 쫓거나 먹는 중인 고양이는 반응하지 않아요";
var FOOD_INFO={
  small:{ em:"🐟", name:"작은 생선", tag:"짧은 유인",
    rows:[["유인 사거리","3칸 안의 고양이가 냄새를 맡고 걸어와요"],
          ["먹는 시간","1턴 만에 한 입 먹고 제자리로 돌아가요"],
          ["이럴 때","잠깐 비켜 세우기 · 연쇄 반응의 첫 미끼"]],
    tip:"다 먹으면 바닥에서 사라져요" },
  big:{ em:"🐠", name:"큰 통생선", tag:"영구 유인",
    rows:[["유인 사거리","3칸 안의 고양이가 냄새를 맡고 걸어와요"],
          ["먹는 시간","끝없이 먹어요 · 먹는 동안 시야와 기척이 닫혀요"],
          ["이럴 때","길목을 막는 문지기를 계속 비켜 세우기"]],
    tip:"아무도 먹지 않으면 바닥에서 사라지지 않아요" },
  catnip:{ em:"🌿", name:"캣닢", tag:"광역 유인",
    rows:[["유인 사거리","5칸 · 가장 넓어요"],
          ["먹는 시간","2턴 동안 정신없이 먹은 뒤에야 돌아가요"],
          ["이럴 때","멀리 있는 고양이까지 끌어내기"]],
    tip:"먹는 동안은 그 고양이의 시야·기척이 닫혀요" }
};

/* ---------------------------- 숲 타일 56종 ----------------------------
   외부 시트 3장에서 자른 40×40 스프라이트 — assets.js TILESPR 키와 1:1 대응.
   (1군 25종 = 5×5 시트 · 2군 21종 = 8×8 시트에서 남긴 것 · 3군 10종 = 새 13×9 시트에서 고른 것)
   너무 비슷한 변형(잔디·흙길·돌길·덤불·버섯·꽃바닥의 거의 같은 반복)은 걷어냈어요.
   rule 규칙 하나로 모델 판정(model.js DECOR/SPECIAL)과 에디터 호환성이 자동 결정돼요:
   · decor : 사람·고양이 모두 밟을 수 있는 바닥 장식 (잔디·꽃·길·돌멩이 등)
   · solid : 사람·고양이 모두 못 지나고, 시선·기척도 차단 (나무·바위·덤불·통나무 등)
   · water : 사람·고양이 모두 못 지나지만 시선은 통과 — 너머로 생선 투척 불가(착지 불가)
   ※ '.'(바닥)은 숲 타일에 쓰지 않아요 — 맵의 '.' 바닥과 겹치면 마루 대신 숲 타일이 깔려요. */
var FOREST_TILES={
  /* ---- 1군: 기본 숲 25종 ---- */
  g:{spr:"f_grass",     name:"잔디",       rule:"decor"},
  f:{spr:"f_flower",    name:"꽃잔디",     rule:"decor"},
  d:{spr:"f_dirt",      name:"흙길",       rule:"decor"},
  p:{spr:"f_stone",     name:"돌길",       rule:"decor"},
  q:{spr:"f_bush",      name:"덤불",       rule:"solid"},
  v:{spr:"f_bramble",   name:"가시덤불",   rule:"solid"},
  e:{spr:"f_fern",      name:"고사리",     rule:"decor"},
  r:{spr:"f_tall",      name:"키 큰 풀",   rule:"decor"},
  o:{spr:"f_rock",      name:"이끼 바위",  rule:"solid"},
  i:{spr:"f_stones",    name:"돌멩이",     rule:"decor"},
  m:{spr:"f_stump",     name:"그루터기",   rule:"solid"},
  l:{spr:"f_log",       name:"통나무",     rule:"solid"},
  n:{spr:"f_roots",     name:"나무 뿌리",  rule:"solid"},
  w:{spr:"f_pond",      name:"연못",       rule:"water"},
  z:{spr:"f_stream",    name:"시냇물",     rule:"water"},
  j:{spr:"f_bridge",    name:"나무 다리",  rule:"decor"},
  k:{spr:"f_crate",     name:"나무 상자",  rule:"solid"},
  u:{spr:"f_mush",      name:"버섯",       rule:"decor"},
  y:{spr:"f_sign",      name:"돌 표지판",  rule:"solid"},
  t:{spr:"f_tree",      name:"나무",       rule:"solid"},
  a:{spr:"f_grit",      name:"자갈 잔디",  rule:"decor"},
  c:{spr:"f_leafy",     name:"낙엽 흙길",  rule:"decor"},
  s:{spr:"f_stone2",    name:"자갈길",     rule:"decor"},
  h:{spr:"f_flowerbush",name:"꽃덤불",     rule:"solid"},
  b:{spr:"f_darkbush",  name:"짙은 덤불",  rule:"solid"},
  /* ---- 2군: 8×8 시트에서 남긴 길·물·나무 21종 (같은 모양 반복 변형은 제거) ---- */
  "8":{spr:"f2_08",name:"흙길·가로",   rule:"decor"},
  "x":{spr:"f2_10",name:"흙길·세로",   rule:"decor"},
  "A":{spr:"f2_11",name:"흙길·교차",   rule:"decor"},
  "C":{spr:"f2_12",name:"흙길·삼거리", rule:"decor"},
  "D":{spr:"f2_13",name:"흙길·모퉁이", rule:"decor"},
  "L":{spr:"f2_19",name:"돌길·세로",  rule:"decor"},
  "N":{spr:"f2_21",name:"민물",        rule:"water"},
  "Y":{spr:"f2_26",name:"흰꽃덤불",    rule:"solid"},
  "&":{spr:"f2_32",name:"큰바위",      rule:"solid"},
  ")":{spr:"f2_35",name:"바위무더기",  rule:"solid"},
  "+":{spr:"f2_39",name:"통나무·단면", rule:"solid"},
  "]":{spr:"f2_41",name:"갈색버섯",    rule:"decor"},
  "}":{spr:"f2_43",name:"보라버섯",    rule:"decor"},
  ":":{spr:"f2_45",name:"파란꽃",      rule:"decor"},
  ",":{spr:"f2_46",name:"열매덤불",    rule:"solid"},
  "<":{spr:"f2_48",name:"나무·둥근",   rule:"solid"},
  "?":{spr:"f2_50",name:"침엽수",      rule:"solid"},
  "`":{spr:"f2_52",name:"큰나무·좌",   rule:"solid"},
  "ㄱ":{spr:"f2_53",name:"큰나무·중",  rule:"solid"},
  "ㄴ":{spr:"f2_54",name:"큰나무·우",  rule:"solid"},
  "ㄷ":{spr:"f2_55",name:"짙은나무",   rule:"solid"},
  /* ---- 3군: 새 13×9 시트에서 고른 10종 (기존과 겹치지 않는 것만) ---- */
  "ㅌ":{spr:"f3_waterfall",  name:"폭포",      rule:"solid"},
  "ㅍ":{spr:"f3_shore",      name:"물가",      rule:"water"},
  "ㅎ":{spr:"f3_lilypond",   name:"수련 못",   rule:"water"},
  "O":{spr:"f3_island",     name:"물가 섬",   rule:"water"},
  "E":{spr:"f3_dirtstone",  name:"돌 흙길",   rule:"decor"},
  "R":{spr:"f3_rootmass",   name:"뿌리 덩굴", rule:"solid"},
  "V":{spr:"f3_mushblue",   name:"회청 버섯", rule:"decor"},
  "Z":{spr:"f3_pinkflower", name:"분홍꽃",    rule:"decor"},
  "M":{spr:"f3_clover",     name:"클로버",    rule:"decor"},
  "Q":{spr:"f3_bigleaf",    name:"큰 잎 포기",rule:"decor"}
};

/* ---------------------------- 스테이지 데이터 ---------------------------- */
var STAGES=[
 { name:"고양이 사이로", bg:"assets/stage1-forest-bg.webp", theme:{S:"sofa","~":"rug",X:"counter"},
   map:["#########","###~...##","###.~~.##","###.~~.##","###.~~.##","###.~~.##","###.~~.##","###....##","#########"],
   start:[6,7], goalPos:[3,1], maxTurns:20,
   cats:[{type:"A",x:3,y:6,dir:0},{type:"A",x:6,y:2,dir:3}],
   pickups:[], hint:"" },
 { name:"거실 소파", theme:{S:"sofa","~":"rug",X:"counter",W:"wardrobe",T:"table"},
   map:["#########","#####X.##","#####X~##","#####X~##","#####X~##","#WWWWX~##","#~~~~~~##","#..^.^..#","#########"],
   start:[1,7], goalPos:[6,1], maxTurns:20,
   cats:[{type:"A",x:6,y:5,dir:2}],
   pickups:[{x:2,y:7,kind:"small"}], hint:"" },
 { name:"연쇄 먹이", theme:{X:"counter","~":"rug",S:"sofa",W:"wardrobe"},
   map:["#########","##~~~~###","##WWW~###","##WWW~###","##~~~~###","##~XX~###","##~SS~###","##~~~~###","#########"],
   start:[2,7], goalPos:[2,1], maxTurns:20,
   cats:[{type:"C",x:5,y:4,dir:3,patrol:[[5,4],[5,4]]}],
   pickups:[{x:3,y:7,kind:"small"},{x:4,y:7,kind:"small"}], hint:"" },
 {
   /* 4단계 복도 순찰 — 동서로 오가는 순찰 고양이(C). 순찰 복도는 1칸 폭이라 몸으로 길을 막아요.
      순찰이 서쪽 끝에 있을 때를 노려 (6,5)를 건너고, 출구 계단의 문지기(A)는 큰 통생선으로 부른다. */
   name:"복도 순찰", theme:{X:"counter","~":"rug"},
   map:["#########","#XXXXGXX#","#XXXX.XX#","#......X#","#XXXXX.X#","#.......#","#XXXXX.X#","#P......#","#########"],
   cats:[{type:"A",x:5,y:2,dir:0},{type:"C",x:1,y:5,dir:1,patrol:[[1,5],[7,5]]}],
   pickups:[{x:2,y:7,kind:"big"},{x:7,y:7,kind:"small"}] },
 {
   /* 5단계 식탁 미로 — 자물쇠 두 개. 큰 통생선 두 개가 각각 한 문씩 열어요.
      두 번째 먹이는 첫 문 너머 식탁 위(5,4)에 있어서 순서가 정해져 있어요.
      각 문은 '문지기 뒤쪽 복도 끝'으로 먹이를 던져 고양이를 비켜 세우는 방식. */
   name:"식탁 미로", theme:{T:"table","~":"rug"},
   map:["#########","#TGTTTTT#","#T.TTTTT#","#T.TTTTT#","#......T#","#TTTTT.T#","#TTTTT.T#","#P......#","#########"],
   cats:[{type:"A",x:6,y:5,dir:2},{type:"A",x:2,y:3,dir:0}],
   pickups:[{x:2,y:7,kind:"big"},{x:5,y:4,kind:"big"}] },
 {
   /* 6단계 안방 탈출 — 왕복. 큰 통생선으로 문을 영구히 열어 두고, 문 안쪽 골방(6,3)의 먹이를
      회수해 다시 계단을 내려와 두 번째 문으로 가요. 작은 생선으로는 안쪽에 있는 동안 문이 닫혀요.
      가구는 모듈형 장롱(W) — 예전 침대(B) 자리를 그대로 W로 바꿔 지형·판정은 똑같고 그림만 장롱이에요.
      (B 침대 타입은 엔진에 그대로 남아 있어요) */
   name:"안방 탈출", theme:{W:"wardrobe",B:"bed",X:"nightstand","~":"rug"},
   map:["#########","#WGWWWWW#","#W.XWWWW#","#W.WWW.X#","#......W#","#XWWXW.W#","#XWWXW.W#","#P......#","#########"],
   cats:[{type:"A",x:6,y:5,dir:0},{type:"A",x:2,y:3,dir:0}],
   pickups:[{x:2,y:7,kind:"big"},{x:6,y:3,kind:"big"}] },
 {
   /* 7단계 서재 — 연쇄 반응. 큰 통생선이 없어서 작은 생선 두 개를 복도에 이어 던져요.
      고양이가 첫 먹이를 다 먹고 그 자리에서 둘째 냄새를 맡아 이어서 걸어가니,
      그만큼 문이 오래 비어 그 사이 왕복이 가능해요. */
   name:"서재", theme:{T:"table","~":"rug"},
   map:["#########","#TGTTTTT#","#T.TTTTT#","#T.TTT.T#","#......T#","#TTTTT.T#","#TTTTT.T#","#P......#","#########"],
   cats:[{type:"A",x:6,y:5,dir:0},{type:"A",x:2,y:3,dir:0}],
   pickups:[{x:3,y:7,kind:"small"},{x:5,y:7,kind:"small"},{x:6,y:3,kind:"big"}] },
 {
   /* 8단계 창고 선반 — 고양이 발판(^). 문지기(A)가 세로 통로(x=2) 가운데(2,3)를 몸으로 막고 있어요.
      작은 인간은 발판에 올라갈 수 없어서, (2,5)에서 동쪽으로 생선을 던져 발판(3,5) 위에 떨어뜨려야 해요.
      고양이가 발판으로 올라가 먹는 동안 통로가 비어 EXIT(2,1)까지 올라갈 수 있어요.
      통로 안쪽((2,4)나 (2,5))으로 던지면 고양이가 내려와 앉아 길을 그대로 막아 버려요. */
   name:"창고 선반", theme:{X:"counter","~":"rug"},
   map:["#########","#XGXXXXX#","#X.XXXXX#","#X.XXXXX#","#X.XXXXX#","#X.^XXXX#","#X.XXXXX#","#XPXXXXX#","#########"],
   cats:[{type:"A",x:2,y:3,dir:0}],
   pickups:[{x:2,y:6,kind:"big"}],
   hint:"🪵 발판(^)은 고양이만 올라가요 · 발판에 먹이를 던져 고양이를 불러내세요" },
 {
   /* 9단계 다락 틈 — 인간 전용 구멍(H). 아래 방과 위 방을 잇는 길은 벽 틈(y=4)의 작은 구멍(4,4) 하나뿐이고,
      고양이는 그 구멍을 지나가지도, 봐내지도 못해요(시선·기척이 구멍에서 끊김).
      위 통로(x=4)는 한 칸 폭으로 이어지고, 문지기(A)가 도어(1,2)를 막아요. 도어를 여는 생선은
      통로 위쪽 발판(3,1)에만 떨어지고, 사람은 발판에 오를 수 없어서 몸으로 유인할 수가 없어요. */
   name:"다락 틈", theme:{X:"counter","~":"rug"},
   map:["#########","#G#^#####","#....####","####.####","####H####","#.......#","#.......#","#P......#","#########"],
   cats:[{type:"A",x:1,y:2,dir:2}],
   pickups:[{x:2,y:7,kind:"big"},{x:5,y:7,kind:"catnip"}],
   hint:"🕳️ 구멍(H)은 나만 지나가요 · 고양이 시선과 기척도 구멍에서 끊겨요" },
 {
   /* 10단계 지하 창고 — 특수 타일 3종의 첫 결합. 아래 복도 문지기(A, (4,6))는 발판(5,6)으로,
      위 골방 문지기(A, (1,2))는 발판(3,1)으로 빼내요. 벽 틈의 구멍(4,4)은 아래·위를 잇는 유일한 길이고,
      고양이는 구멍을 못 지나가요. 생선은 문지기 하나당 하나씩 — 어느 먹이를 어느 문에 쓸지 정해야 해요.
      목 앞 (5,7)이 은신 수풀(U)이라, 문지기에게 들킨 채 돌아와도 수풀에 들어서면 추격이 바로 끊겨요.
      수풀에 숨은 자리에서 바로 위 발판(5,6)으로 먹이를 던지면 문지기가 걸어와 앉아요. */
   name:"지하 창고", theme:{X:"counter",T:"table","~":"rug"},
   map:["#########","#G#^#####","#....####","####.####","####H####","####.####","####.^###","####.U.P#","#########"],
   cats:[{type:"A",x:1,y:2,dir:2},{type:"A",x:4,y:6,dir:2}],
   pickups:[{x:6,y:7,kind:"big"},{x:4,y:2,kind:"small"},{x:3,y:2,kind:"catnip"}],
   hint:"🪴 수풀(U)에는 나만 들어가요 · 수풀에 숨으면 추격이 끊겨요 · 발판(^)은 고양이만" },
 {
   /* 11단계 마지막 방 — 총집합. 아래 창고 문지기(A, (4,6))는 발판(5,6)으로, 위 골방 문지기(A, (1,2))는
      발판(3,1)으로 빼내고, 그 사이는 가운데 방을 지나 구멍(4,4) 하나로만 넘어가요. 가운데 방에도
      먹이가 있어서 왕복이 한 번 더 필요해요 — 먹이 3종을 어느 문에 쓸지 정하는 마지막 방.
      특수 타일 3종이 모두 살아 있어요: 발판(^) · 구멍(H) · 은신 수풀(U: (5,7)·(7,5)). */
   name:"마지막 방", theme:{S:"sofa",X:"counter","~":"rug"},
   map:["#########","#G#^#####","#....####","####.####","####H####","#......U#","####.^###","####.U.P#","#########"],
   cats:[{type:"A",x:1,y:2,dir:2},{type:"A",x:4,y:6,dir:2}],
   pickups:[{x:6,y:7,kind:"big"},{x:2,y:5,kind:"big"},{x:4,y:2,kind:"catnip"},{x:3,y:2,kind:"small"}],
   hint:"🪴 수풀은 나만 · 발판은 고양이만 · 구멍은 나만 · 먹이 3종을 어디에 쓸지 정하세요" }
];
