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
/* ---- 출구 도착 연출(점프 → 구멍 속으로 뽕) 길이 ----
   EXIT_CROUCH_MS 웅크리기 → EXIT_ARC_MS 까지 포물선 점프 → EXIT_SINK_MS 까지 구멍으로 빨려 들어감.
   EXIT_MS 뒤엔 캐릭터가 안 보이고, EXIT_PANEL_MS 에 클리어 창을 띄워요. */
var EXIT_CROUCH_MS=110, EXIT_ARC_MS=370, EXIT_SINK_MS=560, EXIT_MS=620, EXIT_PANEL_MS=700;
var EXIT_HOP=17;        /* 점프 정점 높이(px) */
var EXIT_HOLE_DX=-1, EXIT_HOLE_DY=16.5;   /* 출구 칸 안 구멍 중심(칸 좌상단 기준 px) */
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
  catnip:{label:"캣닢",      lure:5, eat:2,  range:2},
  /* 🍫 초콜릿 — 고양이 먹이가 아니라 '사람이 먹는 간식'이에요. use:"wait" 면 인벤토리에서
     누를 때 조준 없이 바로 먹고 1턴 대기(action.t="wait")를 실행해요.
     던지지 않고 고양이도 반응하지 않으므로 lure·eat·range 는 0 (어디서도 안 쓰여요). */
  choco :{label:"초콜릿",    lure:0, eat:0,  range:0, use:"wait"}
};
var FISH_ORDER=["small","big","catnip","choco"];
/* 아이템 상세 정보(인벤토리 슬롯을 길게 누르면 뜨는 카드) — 아래 수치는 KIND·model.js 실제 동작과 같아요.
   FOOD_TIP 은 던지는 먹이(생선·캣닢) 공통 규칙이라, 아이템별로 다른 규칙은 FOOD_INFO[kind].rule 로 덮어써요. */
var FOOD_TIP="던지기는 상하좌우 직선 · 작은 생선 3칸, 통생선·캣닢 2칸 · 냄새는 수풀 사이로도 새어 나가고 막힌 칸 하나쯤은 돌아서도 닿아요 · 쫓거나 먹는 중인 고양이는 반응하지 않아요";
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
    tip:"먹는 동안은 그 고양이의 시야·기척이 닫혀요" },
  choco:{ em:"🍫", name:"초콜릿", tag:"1턴 대기",
    rows:[["쓰는 법","인벤토리에서 누르면 조준 없이 바로 먹어요"],
          ["효과","그 자리에서 1턴을 보내요 · 고양이는 한 걸음 더 움직여요"],
          ["이럴 때","순찰 박자를 늦추거나 고양이가 지나가길 기다릴 때"]],
    tip:"고양이 먹이가 아니에요 — 던질 수 없어요",
    rule:"인벤토리에서 누르면 바로 먹고 한 턴을 보내요 · 취소(U)로 되돌릴 수 있어요" }
};

/* ---------------------------- 고양이 상세 정보(보드에서 고양이 칸을 찍으면 뜨는 카드) ----------------------------
   종류별 고정 수치만 적어요 — 현재 상태·바라보는 방향은 카드를 띄울 때 붙여요 */
var CAT_INFO={
  A:{ name:"구름", tag:"고정 감시",
      rows:[["행동","한 자리에 앉아 한 방향만 감시해요"],
            ["시야","바라보는 방향 직선 "+SIGHT_LEN+"칸"],
            ["기척","주변 "+CAT_SENSE.A+"칸 안 발소리 · 벽에 막히면 못 들어요"],
            ["이럴 때","생선으로 비켜 세우거나 수풀에 숨어 지나가기"]],
      tip:"들키면 끝까지 쫓아와요" },
  B:{ name:"치즈", tag:"교대 감시",
      rows:[["행동","매 턴 두 방향을 번갈아 바라봐요"],
            ["시야","바라보는 방향 직선 "+SIGHT_LEN+"칸"],
            ["기척","주변 "+CAT_SENSE.B+"칸 안 발소리 · 벽에 막히면 못 들어요"],
            ["이럴 때","등을 돌린 턴을 노려 지나가기"]],
      tip:"들키면 끝까지 쫓아와요" },
  C:{ name:"쿠키", tag:"왕복 순찰",
      rows:[["행동","정해진 길을 끝과 끝 사이로 왕복해요"],
            ["시야","바라보는 방향 직선 "+SIGHT_LEN+"칸"],
            ["기척","주변 "+CAT_SENSE.C+"칸 안 발소리 · 벽에 막히면 못 들어요"],
            ["이럴 때","멀어진 틈을 노리거나 생선으로 불러내기"]],
      tip:"들키면 끝까지 쫓아와요" }
};

/* ---------------------------- 숲 타일 81칸 ----------------------------
   1단계 승인 그림(games/screenshots/hq-fullmap-aligned-art.png, 1254×1254 · 9×9 정합본)을
   360×360 으로 줄여 40×40 칸 81개로 자른 '그 자리 그대로' 조각이에요 — assets.js TILESPR
   (f_열_행)와 1:1, 칸마다 코드가 하나씩이라 9×9 맵에 그대로 얹으면 원본 그림과 픽셀 단위로 같아요.
   나무·통나무·바위가 2~3칸에 걸쳐 있어도 잘리지 않고, 흙길·폭포·연못 경계도 이어져요.
   rule 은 직전 맵(ec272e1)의 칸별 판정을 그대로 물려받았어요(게임 수치 불변):
   · decor : 사람·고양이 모두 밟는 바닥 (잔디·꽃잔디·흙길)
   · solid : 못 지나가고 시선·기척도 차단 (숲·나무·바위·통나무·폭포)
   · hide  : 사람만 들어가는 은신 수풀 — 시선·기척 차단, 고양이는 못 들어감 (U 타일과 동일)
   · water : 못 지나가지만 시선은 통과 (연못·물가) — 너머로 생선 투척 불가
   이름 뒤 숫자는 원본 그림에서의 칸 위치(열,행)예요. */
var FOREST_TILES={
  "가":{spr:"f_0_0", name:"큰나무 0,0", rule:"solid"},
  "각":{spr:"f_1_0", name:"나무 1,0", rule:"solid"},
  "갂":{spr:"f_2_0", name:"큰나무 2,0", rule:"solid"},
  "갃":{spr:"f_3_0", name:"짙은숲 3,0", rule:"solid"},
  "간":{spr:"f_4_0", name:"짙은숲 4,0", rule:"solid"},
  "갅":{spr:"f_5_0", name:"짙은숲 5,0", rule:"solid"},
  "갆":{spr:"f_6_0", name:"큰나무 6,0", rule:"solid"},
  "갇":{spr:"f_7_0", name:"나무 7,0", rule:"solid"},
  "갈":{spr:"f_8_0", name:"나무 8,0", rule:"solid"},
  "갉":{spr:"f_0_1", name:"짙은숲 0,1", rule:"solid"},
  "갊":{spr:"f_1_1", name:"큰나무 1,1", rule:"solid"},
  "갋":{spr:"f_2_1", name:"수풀 2,1", rule:"solid"},
  "갌":{spr:"f_3_1", name:"흙길모퉁이 3,1", rule:"decor"},
  "갍":{spr:"f_4_1", name:"흙길 4,1", rule:"decor"},
  "갎":{spr:"f_5_1", name:"흙길 5,1", rule:"decor"},
  "갏":{spr:"f_6_1", name:"흙길모퉁이 6,1", rule:"decor"},
  "감":{spr:"f_7_1", name:"통나무 7,1", rule:"solid"},
  "갑":{spr:"f_8_1", name:"나무 8,1", rule:"solid"},
  "값":{spr:"f_0_2", name:"나무 0,2", rule:"solid"},
  "갓":{spr:"f_1_2", name:"큰나무 1,2", rule:"solid"},
  "갔":{spr:"f_2_2", name:"수풀 2,2", rule:"solid"},
  "강":{spr:"f_3_2", name:"흙길 3,2", rule:"decor"},
  "갖":{spr:"f_4_2", name:"꽃잔디 4,2", rule:"decor"},
  "갗":{spr:"f_5_2", name:"잔디 5,2", rule:"decor"},
  "갘":{spr:"f_6_2", name:"흙길 6,2", rule:"decor"},
  "같":{spr:"f_7_2", name:"통나무 7,2", rule:"solid"},
  "갚":{spr:"f_8_2", name:"나무 8,2", rule:"solid"},
  "갛":{spr:"f_0_3", name:"나무 0,3", rule:"solid"},
  "개":{spr:"f_1_3", name:"짙은숲 1,3", rule:"solid"},
  "객":{spr:"f_2_3", name:"수풀 2,3", rule:"solid"},
  "갞":{spr:"f_3_3", name:"흙길 3,3", rule:"decor"},
  "갟":{spr:"f_4_3", name:"꽃잔디 4,3", rule:"decor"},
  "갠":{spr:"f_5_3", name:"잔디 5,3", rule:"decor"},
  "갡":{spr:"f_6_3", name:"흙길 6,3", rule:"decor"},
  "갢":{spr:"f_7_3", name:"통나무 7,3", rule:"solid"},
  "갣":{spr:"f_8_3", name:"나무 8,3", rule:"solid"},
  "갤":{spr:"f_0_4", name:"큰나무 0,4", rule:"solid"},
  "갥":{spr:"f_1_4", name:"이끼바위 1,4", rule:"solid"},
  "갦":{spr:"f_2_4", name:"이끼바위 2,4", rule:"solid"},
  "갧":{spr:"f_3_4", name:"흙길 3,4", rule:"decor"},
  "갨":{spr:"f_4_4", name:"잔디 4,4", rule:"decor"},
  "갩":{spr:"f_5_4", name:"꽃잔디 5,4", rule:"decor"},
  "갪":{spr:"f_6_4", name:"흙길 6,4", rule:"decor"},
  "갫":{spr:"f_7_4", name:"통나무 7,4", rule:"solid"},
  "갬":{spr:"f_8_4", name:"나무 8,4", rule:"solid"},
  "갭":{spr:"f_0_5", name:"나무 0,5", rule:"solid"},
  "갮":{spr:"f_1_5", name:"이끼바위 1,5", rule:"solid"},
  "갯":{spr:"f_2_5", name:"통나무 2,5", rule:"solid"},
  "갰":{spr:"f_3_5", name:"흙길 3,5", rule:"decor"},
  "갱":{spr:"f_4_5", name:"잔디 4,5", rule:"decor"},
  "갲":{spr:"f_5_5", name:"꽃잔디 5,5", rule:"decor"},
  "갳":{spr:"f_6_5", name:"흙길 6,5", rule:"decor"},
  "갴":{spr:"f_7_5", name:"물가 7,5", rule:"water"},
  "갵":{spr:"f_8_5", name:"큰나무 8,5", rule:"solid"},
  "갶":{spr:"f_0_6", name:"큰나무 0,6", rule:"solid"},
  "갷":{spr:"f_1_6", name:"큰나무 1,6", rule:"solid"},
  "갸":{spr:"f_2_6", name:"그루터기 2,6", rule:"solid"},
  "갹":{spr:"f_3_6", name:"흙길 3,6", rule:"decor"},
  "갺":{spr:"f_4_6", name:"잔디 4,6", rule:"decor"},
  "갻":{spr:"f_5_6", name:"잔디 5,6", rule:"decor"},
  "갼":{spr:"f_6_6", name:"흙길 6,6", rule:"decor"},
  "갽":{spr:"f_7_6", name:"폭포 7,6", rule:"solid"},
  "갾":{spr:"f_8_6", name:"이끼바위 8,6", rule:"solid"},
  "갿":{spr:"f_0_7", name:"나무 0,7", rule:"solid"},
  "걀":{spr:"f_1_7", name:"큰나무 1,7", rule:"solid"},
  "걁":{spr:"f_2_7", name:"그루터기 2,7", rule:"solid"},
  "걂":{spr:"f_3_7", name:"흙길모퉁이 3,7", rule:"decor"},
  "걃":{spr:"f_4_7", name:"흙길 4,7", rule:"decor"},
  "걄":{spr:"f_5_7", name:"흙길 5,7", rule:"decor"},
  "걅":{spr:"f_6_7", name:"흙길모퉁이 6,7", rule:"decor"},
  "걆":{spr:"f_7_7", name:"물보라 7,7", rule:"water"},
  "걇":{spr:"f_8_7", name:"연못 8,7", rule:"water"},
  "걈":{spr:"f_0_8", name:"짙은숲 0,8", rule:"solid"},
  "걉":{spr:"f_1_8", name:"바위무더기 1,8", rule:"solid"},
  "걊":{spr:"f_2_8", name:"바위무더기 2,8", rule:"solid"},
  "걋":{spr:"f_3_8", name:"수풀 3,8", rule:"solid"},
  "걌":{spr:"f_4_8", name:"수풀 4,8", rule:"solid"},
  "걍":{spr:"f_5_8", name:"통나무 5,8", rule:"solid"},
  "걎":{spr:"f_6_8", name:"통나무 6,8", rule:"solid"},
  "걏":{spr:"f_7_8", name:"수련 7,8", rule:"water"},
  "걐":{spr:"f_8_8", name:"수련 8,8", rule:"water"}
};

/* ---- 2레이어 타일: 지형 × 구조물 조합 (코드 181~240) ----
   칸 하나는 지형(밑바닥) + 구조물(위에 얹는 그림) 두 층이에요.
   에디터에서 각 층을 따로 칠하고, 조합은 순서가 고정돼 코드가 안정적이에요:
   코드 = 181 + 지형번호*15 + 구조물번호 (지형: 잔디0·흙길1·숲바닥2·물3) */
var LAYER_TERR=["grass","dirt","floor","water"];
var LAYER_FEAT=[null,"ob_tree_big","ob_tree","ob_tree_wide","ob_pine","ob_pine_wide","ob_pine_wide2","ob_bush","ob_scrub",
                "ob_rock","ob_stone","ob_log","ob_stump",
                "ob_fern","ob_tower","ob_flower_p","ob_flower_w","ob_shroom","ob_sapling"];
var TERR_NAME={grass:"잔디",dirt:"흙길",floor:"숲바닥",water:"물"};
var FEAT_NAME={ob_tree_big:"큰나무",ob_tree:"나무(넓)",ob_tree_wide:"나무(2칸)",ob_pine:"침엽수",ob_pine_wide:"큰침엽수",ob_pine_wide2:"침엽수(2칸)",
               ob_bush:"덤불",ob_scrub:"수풀",
               ob_rock:"바위",ob_stone:"돌(2×2)",ob_log:"통나무",ob_stump:"그루터기",
               ob_fern:"고사리",ob_tower:"캣타워",ob_flower_p:"보라꽃",ob_flower_w:"흰꽃",ob_shroom:"버섯",ob_sapling:"아기나무"};
var FEAT_RULE={ob_tree_big:"solid",ob_tree:"solid",ob_tree_wide:"solid",ob_pine:"solid",ob_pine_wide:"solid",ob_pine_wide2:"solid",
               ob_bush:"hide",ob_scrub:"solid",
               ob_rock:"solid",ob_stone:"solid",ob_log:"solid",ob_stump:"low",
               ob_fern:"decor",ob_tower:"decor",ob_flower_p:"decor",ob_flower_w:"decor",ob_shroom:"decor",ob_sapling:"solid"};
/* 코드 칸(왼쪽 위 앵커)부터 우·하·우하까지 2×2 발자취를 차지하는 구조물 — 이동·시선 모두 막아요 */
var FEAT_BLOCK2={ob_stone:1};
/* 코드 칸(왼쪽 앵커)부터 오른쪽 칸까지 가로 2칸 발자취를 차지하는 구조물 */
var FEAT_SPAN2={ob_tree_wide:1,ob_pine_wide2:1};
/* 구조물을 레거시 칸에 올릴 때의 기본 지형 — 나무·돌류는 숲바닥, 꽃·캣타워는 잔디 */
var FEAT_TERR={ob_tree_big:"floor",ob_tree:"floor",ob_tree_wide:"floor",ob_pine:"floor",ob_pine_wide:"floor",ob_pine_wide2:"floor",
               ob_bush:"floor",ob_scrub:"floor",
               ob_rock:"floor",ob_stone:"floor",ob_log:"floor",ob_stump:"floor",ob_fern:"floor",
               ob_shroom:"floor",ob_tower:"grass",ob_flower_p:"grass",ob_flower_w:"grass",ob_sapling:"floor"};
(function(){
  for(var t=0;t<LAYER_TERR.length;t++)for(var f=0;f<LAYER_FEAT.length;f++){
    var code=181+t*20+f, ch=String.fromCharCode(0xAC00+code-100), ft=LAYER_FEAT[f];
    FOREST_TILES[ch]=ft?{terrain:LAYER_TERR[t],feat:ft,name:FEAT_NAME[ft],rule:FEAT_RULE[ft],block2:!!FEAT_BLOCK2[ft],span2:!!FEAT_SPAN2[ft]}
                       :{terrain:LAYER_TERR[t],name:TERR_NAME[LAYER_TERR[t]],
                         rule:LAYER_TERR[t]==="water"?"water":"decor"};
  }
})();
/* 지형+구조물 조합에 맞는 타일 문자를 찾아요 */
function tileForLayers(terrain,feat){
  for(var k in FOREST_TILES){
    var f=FOREST_TILES[k];
    if(f.terrain===terrain&&(f.feat||null)===(feat||null)) return k;
  }
  return null;
}

/* ---- 타일 숫자 코드 (저장·임포트/익스포트 전용) ----
   첫 자리가 테마 번호예요 — 숲은 1. 숲 타일 코드는 100 + 칸 번호(y*9+x):
   100=(0,0) … 108=(8,0), 109=(0,1) … 180=(8,8).
   내부 표현(st.grid·draft.map·FOREST_TILES 키)은 지금처럼 한 글자 문자 그대로예요.
   실내·특수 레거시 타일(. # ~ X S T B W ^ H U 와 P/G 표기)은 그대로 써요. */
function tileCodeToCh(v){
  if(typeof v==="number"&&Number.isInteger(v)&&v>=100&&v<400){
    var ch=String.fromCharCode(0xAC00+v-100);
    return FOREST_TILES[ch]?ch:null;
  }
  if(typeof v==="string"&&v.length===1) return v;
  return null;
}
function tileChToCode(ch){
  if(typeof ch==="string"&&ch.length===1&&FOREST_TILES[ch]){ return 100+(ch.charCodeAt(0)-0xAC00); }
  return ch;
}
function mapRowToChars(row){
  if(typeof row==="string") return row;
  if(!Array.isArray(row)) return null;
  var s="";
  for(var i=0;i<row.length;i++){ var ch=tileCodeToCh(row[i]); if(ch==null) return null; s+=ch; }
  return s;
}
function mapRowToCodes(str){
  var out=[];
  for(var i=0;i<str.length;i++) out.push(tileChToCode(str.charAt(i)));
  return out;
}

/* 지형 이름 → 그 지형만 깐 '평지' 타일 문자 (feat 없는 첫 타일) — 도구 아이콘 배경용 */
var TERRAIN_BASE={};
for(var _tb in FOREST_TILES){
  var _tf=FOREST_TILES[_tb];
  if(_tf.terrain&&!_tf.feat&&!TERRAIN_BASE[_tf.terrain]) TERRAIN_BASE[_tf.terrain]=_tb;
}
function terrainBaseChar(t){ return TERRAIN_BASE[t]||null; }

/* ---- 타일 세트: 한 클릭에 여러 칸을 칠하는 스탬프 ----
   at = 원본 9×9 시트의 왼쪽 위 좌표, w/h = 칸 수.
   칸 하나하나는 시트의 같은 자리 타일(코드 100+번호)이에요.
   tileSetCells → [{dx,dy,ch}] (ch = 내부 한 글자 문자) */
var TILE_SETS=[
  {name:"큰나무", at:[0,0], w:2, h:3}
];
function tileSetCells(set){
  var out=[];
  for(var j=0;j<set.h;j++) for(var i=0;i<set.w;i++){
    var ch=tileCodeToCh(100+(set.at[1]+j)*9+set.at[0]+i);
    if(ch) out.push({dx:i,dy:j,ch:ch});
  }
  return out;
}

/* 1단계 숲 공터 — 81칸 전부 원본 그림의 같은 좌표 조각(위 FOREST_TILES)이라
   보드가 승인 그림과 픽셀 단위로 같아요. 판정은 예전과 똑같아요(이동 28칸·막힘 53칸).
   아래 주석의 그림은 칸별 규칙이에요 — · 통행 / ■ 막힘 / ≈ 물(시선 통과).
   row0 ■■■■■■■■■
   row1 ■■■····■■
   row2 ■■■····■■
   row3 ■■■····■■
   row4 ■■■····■■
   row5 ■■■····≈■
   row6 ■■■····■■
   row7 ■■■····≈≈
   row8 ■■■■■■■≈≈
*/

/* ---------------------------- 스테이지 데이터 ---------------------------- */
var STAGES=[
 { /* 1단계 숲 공터 — 흙길(201) 공터를 침엽수·바위·그루터기 테두리가 둘러싼 맵. */
   name:"고양이 사이로", theme:{},
   map:[[225,221,230,221,221,221,230,221,226],
        [227,221,201,201,201,201,201,227,221],
        [226,221,201,201,201,201,201,221,226],
        [227,221,201,201,201,201,201,227,221],
        [226,221,201,201,201,201,201,221,226],
        [227,221,201,201,201,201,201,227,221],
        [226,221,201,201,201,201,201,221,226],
        [227,221,201,201,201,201,201,227,221],
        [226,221,233,221,221,221,233,221,226]],
   start:[6,7], goalPos:[3,1], maxTurns:20,
   cats:[{type:"A",x:3,y:6,dir:0},{type:"A",x:6,y:2,dir:3}],
   pickups:[], hint:"" },
 { /* 2단계 숲길 — 숲바닥(221) 공터에 나무·바위·그루터기가 흩어진 맵.
      흙길(201)이 위쪽 통로와 아래 가로길로 이어져요. */
   name:"숲길", theme:{},
   map:[[222,221,232,221,221,222,201,221,223],
        [221,221,221,222,224,221,201,227,221],
        [224,221,226,221,222,233,201,221,221],
        [232,222,221,224,221,225,201,221,221],
        [221,221,221,222,201,201,201,221,221],
        [222,224,221,221,201,233,201,227,221],
        [227,221,224,221,201,230,201,232,222],
        [201,201,201,201,201,201,201,201,201],
        [230,230,221,230,221,230,221,230,221]],
   start:[1,7], goalPos:[6,1], maxTurns:20,
   cats:[{type:"A",x:6,y:5,dir:2}],
   pickups:[{x:2,y:7,kind:"small"}], hint:"" },
 { name:"연쇄 먹이", theme:{},
   map:[[227,221,221,221,221,221,221,224,221],
        [221,223,201,201,201,201,230,221,234],
        [224,221,231,221,233,201,227,221,221],
        [227,221,221,221,233,201,230,221,221],
        [221,222,201,201,201,201,233,224,221],
        [224,221,201,231,221,201,230,221,236],
        [221,222,201,221,221,201,227,221,221],
        [227,221,201,201,201,201,234,231,221],
        [221,222,221,221,221,221,221,221,221]],
   start:[2,7], goalPos:[2,1], maxTurns:20,
   cats:[{type:"C",x:5,y:4,dir:3,patrol:[[5,4],[5,4]]}],
   pickups:[{x:3,y:7,kind:"small"},{x:4,y:7,kind:"small"}], hint:"" },
 {
   /* 4단계 복도 순찰 — 아기나무 울타리 사이 흙길 복도를 C형이 왕복하고, A형이 출구를 지켜요. */
   name:"복도 순찰", theme:{},
   map:[[225,234,234,234,234,234,234,234,225],
        [225,221,221,221,221,201,231,221,225],
        [225,224,221,224,221,201,221,221,225],
        [225,201,201,201,201,201,201,234,225],
        [225,239,239,233,239,239,201,239,225],
        [225,201,201,201,201,201,201,201,225],
        [225,239,239,228,239,239,201,239,225],
        [225,201,201,201,201,201,201,201,225],
        [225,201,234,234,234,234,234,234,225]],
   start:[1,7], goalPos:[5,1], maxTurns:20,
   cats:[{type:"A",x:5,y:2,dir:0},{type:"C",x:1,y:5,dir:1,patrol:[[1,5],[7,5]]}],
   pickups:[{x:2,y:7,kind:"big"}] },
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
