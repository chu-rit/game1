"use strict";
/* ===== 맵 에디터 테스트 플레이 브리지 =====
   index.html 이 #editor-playtest 해시로 iframe 안에서 열렸을 때만 활성.
   부모(에디터)와 postMessage 핸드셰이크로 스냅샷을 받아 STAGES 를 1개짜리로 교체해요. */
var EDITOR_PLAYTEST=window.parent!==window&&location.hash==="#editor-playtest";
function playtestTargetOrigin(){ return location.origin==="null"?"*":location.origin; }
function playtestReturn(){ if(EDITOR_PLAYTEST) window.parent.postMessage({type:"cat-editor:return"},playtestTargetOrigin()); }
function playtestReady(){
  if(!EDITOR_PLAYTEST) return;
  window.addEventListener("message",function(e){
    if(e.source!==window.parent||e.origin!==location.origin||!e.data||e.data.type!=="cat-editor:load") return;
    try{
      var stage=editorNormalize(e.data.stage), valid=editorValidate(stage);
      if(valid.errors.length) throw new Error(valid.errors.join(" · "));
      STAGES=[JSON.parse(JSON.stringify(stage))];
      hideItemTip(); hidePanel(); G.stageIdx=0; G.mode="play"; loadStage(0); setWarn(""); resize(); updateHUD();
      window.parent.postMessage({type:"cat-editor:started"},playtestTargetOrigin());
    }catch(err){ window.parent.postMessage({type:"cat-editor:error",message:err.message},playtestTargetOrigin()); }
  });
  window.addEventListener("keydown",function(e){
    /* 캡처 단계 — 아이템 팁(TIP.open)이 아직 열려 있으면 게임 Escape 처리에 양보 */
    if(e.key==="Escape"&&!TIP.open){ e.preventDefault(); playtestReturn(); }
  },true);
  /* 커스텀 맵 1개뿐이라 스테이지 넘기기 버튼은 숨겨요 */
  document.getElementById("sPrev").style.display="none";
  document.getElementById("sNext").style.display="none";
  /* 스냅샷이 오기 전 대기 상태에서는 되돌리기·리셋이 동작할 수 없게 */
  document.getElementById("bUndo").disabled=true;
  document.getElementById("bReset").disabled=true;
  window.parent.postMessage({type:"cat-editor:ready"},playtestTargetOrigin());
}
