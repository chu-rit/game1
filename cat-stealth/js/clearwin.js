"use strict";
/* ================= 클리어 · 완탈출 창 (도트 나무 액자) + 도트 색종이 연출 =================
   · 창 디자인: assets/clear-frame.png(170×216 도트, 2배 = 340×432) · assets/clear-badge(-win).png
     글자는 스타트 화면과 같은 Galmuri11 도트 폰트, 버튼은 start-btn-wood.png 판때기 그대로.
   · 연출: 배경 암전 위로 도트 색종이(나뭇잎·별)가 흩날리고, 액자가 위에서 살짝 내려와
     제자리에 쓱 멈춰요(오버슈트 없음). 메달은 반 박자 늦게 톡 떠오릅니다. */

/* ---------- 창 내용 ---------- */
function cwTurnsUsed(){ return Math.max(1, (G.st ? G.st.turn : 1) - 1); }
/* 클리어 타임 표시: 1분 미만은 '12.4초'(0.1초 단위), 넘으면 '1:23' */
function cwTimeText(ms){
  if (ms == null || !(ms >= 0)) return "--";
  if (ms < 60000) return (Math.floor(ms / 100) / 10).toFixed(1) + "초";
  var m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000);
  return m + ":" + (s < 10 ? "0" : "") + s;
}
function cwStatHtml(label, value){
  return '<div class="cw-cell"><span class="cw-k">' + label + '</span><span class="cw-v">' + value + '</span></div>';
}
function buildClearPanel(p, mode){
  var win = mode === "win";
  var total = STAGES.length;
  var used = cwTurnsUsed();
  var maxT = (G.st && G.st.maxTurns) ? G.st.maxTurns : 20;
  var stageNo = win ? total : (G.stageIdx + 1);
  var html = '';
  html += '<div class="cw-card cw-' + (win ? "win" : "clear") + '">';
  html += '<img class="cw-badge" src="assets/' + (win ? "clear-badge-win.png" : "clear-badge.png") + '" alt="" draggable="false">';
  html += '<div class="cw-kicker">' + (win ? "ALL ROOMS CLEAR" : "STAGE " + (G.stageIdx + 1) + " OF " + total) + '</div>';
  html += '<div class="cw-title">' + (win ? "완탈출!" : "탈출 성공!") + '</div>';
  html += '<div class="cw-name">' + (G.st ? G.st.name : "") + '</div>';
  html += '<div class="cw-stats">' +
          cwStatHtml(win ? "방" : "스테이지", stageNo + " / " + total) +
          cwStatHtml("턴", used + " / " + maxT) +
          '</div>';
  /* 클리어 타임 — 완탈출 화면에서는 마지막 방 타임임을 라벨로 밝혀요 */
  html += '<div class="cw-time">' +
          '<span class="cw-k">' + (win ? "마지막 방 타임" : "클리어 타임") + '</span>' +
          '<span class="cw-tv">' + cwTimeText(G.clearMs) + '</span>' +
          '</div>';
  html += '<div class="cw-line">' + (win
        ? "모든 방을 통과했어요.<br>고양이는 아직 모릅니다."
        : "다음 방에는 더 예민한 고양이가 있어요…") + '</div>';
  html += '<button class="cw-btn" id="' + (win ? "pAgain" : "pNext") + '" type="button">' +
          (win ? "처음부터" : "다음 방으로") + '<span class="cw-kc">Enter</span></button>';
  html += '</div>';
  p.innerHTML = html;
  var btn = document.getElementById(win ? "pAgain" : "pNext");
  btn.addEventListener("click", win ? restartFromStart : nextStage);
  cwWirePress(btn);
}
/* iOS 사파리는 :active 가 아주 짧게 끝나서 — 손을 대는 순간 pressed 를 붙였다 뗀다(스타트 버튼과 같은 방식) */
function cwWirePress(btn){
  var on = function(){ btn.classList.add("pressed"); };
  var off = function(){ btn.classList.remove("pressed"); };
  btn.addEventListener("pointerdown", on);
  btn.addEventListener("pointerup", off);
  btn.addEventListener("pointercancel", off);
  btn.addEventListener("pointerleave", off);
  btn.addEventListener("touchstart", on, { passive: true });
  btn.addEventListener("touchend", off);
  btn.addEventListener("mousedown", on);
  btn.addEventListener("mouseup", off);
}

/* ---------- 도트 색종이 ---------- */
var CFX = {
  cv: null, ctx: null, dpr: 1, w: 0, h: 0,
  parts: [], raf: 0, last: 0, on: false,
  /* 색: 금색 · 크림 · 새잎 · 이끼 · 분홍 · 나무 */
  colors: [[255, 210, 76], [255, 238, 196], [168, 202, 66], [114, 144, 24], [255, 158, 196], [188, 130, 66]]
};
function cfxResize(){
  if (!CFX.cv) return;
  var host = CFX.cv.parentNode;
  var r = host.getBoundingClientRect();
  CFX.dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
  CFX.w = Math.max(1, Math.round(r.width));
  CFX.h = Math.max(1, Math.round(r.height));
  CFX.cv.width = Math.round(CFX.w * CFX.dpr);
  CFX.cv.height = Math.round(CFX.h * CFX.dpr);
  CFX.ctx = CFX.cv.getContext("2d");
  if (CFX.ctx) CFX.ctx.imageSmoothingEnabled = false;
}
function cfxMake(seedInView){
  var c = CFX.colors[(Math.random() * CFX.colors.length) | 0];
  var kind = Math.random();
  var shape = kind < 0.55 ? "sq" : (kind < 0.82 ? "leaf" : "star");
  return {
    x: Math.random() * (CFX.w + 40) - 20,
    y: seedInView ? Math.random() * CFX.h * 1.15 - CFX.h * 0.2 : -8 - Math.random() * 40,
    vx: (Math.random() - 0.5) * 26,
    vy: 52 + Math.random() * 62,
    sway: 6 + Math.random() * 12,
    ph: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 0.5,
    rot: Math.random() * Math.PI,
    size: shape === "star" ? 5 : (Math.random() < 0.5 ? 4 : 6),
    col: c,
    shape: shape,
    life: seedInView ? 6 + Math.random() * 5 : 5 + Math.random() * 4
  };
}
function cfxDrawPart(g, p){
  g.save();
  g.translate(p.x, p.y);
  g.rotate(p.rot);
  var s = p.size;
  g.fillStyle = "rgb(" + p.col[0] + "," + p.col[1] + "," + p.col[2] + ")";
  if (p.shape === "sq") {
    g.fillRect(-s / 2, -s / 2, s, s);
    g.fillStyle = "rgba(255,255,255,.35)";
    g.fillRect(-s / 2, -s / 2, s, 1);
  } else if (p.shape === "leaf") {
    g.fillRect(-s / 2, -s / 2, s, s * 0.7);
    g.fillStyle = "rgba(0,0,0,.28)";
    g.fillRect(-s / 2, s / 2 - s * 0.45, s, s * 0.45);
  } else {
    g.fillRect(-s / 2, -s / 2, s, s);
    g.fillRect(-1, -s / 2 - 2, 2, s + 4);
    g.fillRect(-s / 2 - 2, -1, s + 4, 2);
  }
  g.restore();
}
function cfxStep(ts){
  if (!CFX.on) return;
  var g = CFX.ctx;
  if (!g) return;
  if (!CFX.last) CFX.last = ts;
  var dt = Math.min(0.05, (ts - CFX.last) / 1000);
  CFX.last = ts;
  g.setTransform(CFX.dpr, 0, 0, CFX.dpr, 0, 0);
  g.clearRect(0, 0, CFX.w, CFX.h);
  for (var i = 0; i < CFX.parts.length; i++) {
    var p = CFX.parts[i];
    p.life -= dt;
    p.ph += dt * 1.7;
    p.x += (p.vx + Math.sin(p.ph) * p.sway) * dt;
    p.y += p.vy * dt;
    p.rot += p.spin * dt;
    if (p.life <= 0 || p.y > CFX.h + 12) {
      /* 화면 밖으로 나가면 위에서 새로 떨어져요 (색종이가 끊기지 않게) */
      CFX.parts[i] = cfxMake(false);
      continue;
    }
    cfxDrawPart(g, p);
  }
  CFX.raf = requestAnimationFrame(cfxStep);
}
function startClearFx(kind){
  stopClearFx();
  CFX.cv = document.getElementById("cfx");
  if (!CFX.cv) return;
  cfxResize();
  var n = kind === "win" ? 104 : 92;
  CFX.parts = [];
  for (var i = 0; i < n; i++) CFX.parts.push(cfxMake(true));
  CFX.on = true;
  CFX.last = 0;
  CFX.raf = requestAnimationFrame(cfxStep);
}
function stopClearFx(){
  CFX.on = false;
  if (CFX.raf) cancelAnimationFrame(CFX.raf);
  CFX.raf = 0;
  CFX.parts = [];
  if (CFX.cv && CFX.ctx) CFX.ctx.clearRect(0, 0, CFX.cv.width, CFX.cv.height);
}
window.addEventListener("resize", function(){ if (CFX.on) cfxResize(); });
