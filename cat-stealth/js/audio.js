"use strict";
/* ================= 오디오 ================= */
var AC=null;
/* 효과음 켜기/끄기 — 스타트 화면 옵션 패널(+ 옵션 +)의 토글이 이 값을 바꿔요. 선택은 기기에 기억돼요. */
var SFX_ON=true;
try{ if(localStorage.getItem("tp_sfx")==="0") SFX_ON=false; }catch(e){}
function beep(f,d,type,v,slide){
  if(!SFX_ON) return;
  try{
    AC=AC||new (window.AudioContext||window.webkitAudioContext)();
    var o=AC.createOscillator(), g=AC.createGain();
    o.type=type||"square"; o.frequency.value=f;
    if(slide){ o.frequency.linearRampToValueAtTime(f+slide,AC.currentTime+d); }
    g.gain.value=v||0.05;
    g.gain.exponentialRampToValueAtTime(0.0001,AC.currentTime+d);
    o.connect(g); g.connect(AC.destination);
    o.start(); o.stop(AC.currentTime+d);
  }catch(e){}
}
function sTap(){ beep(520,0.06,"square",0.04); }
function sFish(){ beep(700,0.12,"sine",0.06,300); }
function sSpot(){ beep(880,0.09,"square",0.06); beep(660,0.14,"square",0.05); }
function sCatch(){ beep(200,0.4,"sawtooth",0.08,-120); }
function sGoal(){ setTimeout(function(){beep(523,0.1,"square",0.05);},0); setTimeout(function(){beep(659,0.1,"square",0.05);},110); setTimeout(function(){beep(784,0.22,"square",0.06);},220); }
function sUndo(){ beep(430,0.07,"triangle",0.05,-90); }
function sReset(){ beep(320,0.09,"triangle",0.05,140); }
function sPickup(){ beep(660,0.07,"square",0.05,180); setTimeout(function(){ beep(880,0.10,"square",0.05,120); },70); }
function sBite(){ beep(300,0.09,"triangle",0.06,-80); }
function sAte(){ beep(520,0.09,"sine",0.05,160); }
function sChain(){ beep(600,0.08,"square",0.05,220); setTimeout(function(){ beep(820,0.10,"square",0.05,160); },90); }
function sHide(){ beep(240,0.09,"triangle",0.05,130); setTimeout(function(){ beep(180,0.12,"triangle",0.04,-40); },70); }
/* 🍫 초콜릿 한 입 — 짧게 '냠·바식' (높은 톡 → 낮은 톡 → 바스러지는 작은 톤) */
function sChoco(){ beep(380,0.05,"square",0.045,-90); setTimeout(function(){ beep(250,0.06,"square",0.04,-70); },55); setTimeout(function(){ beep(310,0.04,"triangle",0.03,140); },115); }
/* 출구 연출 — 톡 튀어 오르는 소리와 구멍에 빠지는 '뽕'(피치 업 팝) */
function sExitHop(){ beep(320,0.10,"triangle",0.05,280); }
function sExitPop(){ beep(420,0.13,"sine",0.06,620); setTimeout(function(){ beep(880,0.07,"square",0.04,180); },55); }

