/* PORCH1 · porchlight flicker. Irregular bursts every 8-20 s, an occasional 0.5-1.5 s blackout, opacity only.
   Reduced motion: steady (or a very slow dim). A SPOOK1 beat can force a burst: WGPorch.burst().
   Layer: Prism's overlays/porchlight.png when present; until then a placeholder anchor (.wg-porch) with a soft glow. */
(function (root, f) { var m = f(); if (typeof module === "object" && module.exports) module.exports = m; else root.WGPorchCore = m; })(this, function () {
  "use strict";
  var BURST_MIN = 8000, BURST_MAX = 20000, BLACK_MIN = 500, BLACK_MAX = 1500, BLACK_P = 0.18;
  function nextGap(r) { return BURST_MIN + Math.floor((r == null ? Math.random() : r) * (BURST_MAX - BURST_MIN + 1)); }
  /* one burst = list of [opacity, ms] steps; returns to 1 at the end */
  function plan(rand, reduced) {
    rand = rand || Math.random;
    if (reduced) return [[0.85, 2400], [1, 2400]];   /* calm: one very slow dim, no flicker, no blackout */
    var s = [], n = 3 + Math.floor(rand() * 5);
    for (var i = 0; i < n; i++) { s.push([0.25 + rand() * 0.45, 170 + Math.floor(rand() * 130)]); s.push([0.8 + rand() * 0.2, 170 + Math.floor(rand() * 160)]);   /* each dip+recover >= 340 ms: under 3 flashes a second (Alfred) */ }
    if (rand() < BLACK_P) s.push([0, BLACK_MIN + Math.floor(rand() * (BLACK_MAX - BLACK_MIN + 1))]);
    s.push([1, 0]);
    return s;
  }
  /* PORCH2 · Prism's porchlight-flicker-curve.json is 24 fps and has raw 0.91 -> 0.35 -> 0.8 frame jumps (a flash).
     smooth(): centered moving average over a window that kills anything above maxHz, then resample to outFps.
     flashes(): counts opposing transitions of >= 0.1 opacity (a flash is a pair); the max in any 1 s window must stay <= 3. */
  function smooth(curve, fps, maxHz, outFps) {
    var a = (curve || []).filter(function (v) { return typeof v === "number" && isFinite(v); }), n = a.length;
    if (!n) return [];
    fps = fps || 24; maxHz = maxHz || 3; outFps = outFps || 8;
    var w = Math.max(1, Math.ceil(fps / maxHz)), h = Math.floor(w / 2), lp = [];
    for (var i = 0; i < n; i++) { var s = 0; for (var k = -h; k <= h; k++) s += a[(i + k + n) % n]; lp.push(s / (2 * h + 1)); }   /* loop-wrapped */
    for (var p = 0; p < 2; p++) for (var j = 0; j < n; j++) lp[j] = (lp[(j - 1 + n) % n] + 2 * lp[j] + lp[(j + 1) % n]) / 4;
    var out = [], m = Math.max(1, Math.round(n * outFps / fps));
    for (var q = 0; q < m; q++) { var v = lp[Math.min(n - 1, Math.round(q * fps / outFps))]; out.push(Math.round(Math.max(0.6, Math.min(1, v)) * 1000) / 1000); }
    return out;
  }
  function flashes(seq, fps) {
    var ext = [], dir = 0, last = seq[0], best = 0;
    for (var i = 1; i < seq.length; i++) {
      var sg = Math.sign(seq[i] - last);
      if (sg && sg === dir) last = seq[i];                                   /* still moving the same way: extend */
      else if (Math.abs(seq[i] - last) >= 0.1) { dir = sg; ext.push(i); last = seq[i]; }   /* a real reversal */
    }
    for (var s = 0; s < ext.length; s++) { var c = 0; for (var e = s; e < ext.length && ext[e] - ext[s] < fps; e++) c++; best = Math.max(best, c / 2); }
    return best;
  }
  return { smooth: smooth, flashes: flashes, BURST_MIN: BURST_MIN, BURST_MAX: BURST_MAX, BLACK_MIN: BLACK_MIN, BLACK_MAX: BLACK_MAX, nextGap: nextGap, plan: plan };
});
(function () {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  var C = window.WGPorchCore, RM = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)"), el, busy = 0, t = 0, lvl = 1, base = 1, curve = null, ci = 0;
  function paint() { if (el) el.style.opacity = String(Math.round(lvl * base * 1000) / 1000); }
  /* PORCH2 · the smoothed Prism curve is the bulb's living hum between bursts (8 fps, never above 3 Hz); bursts multiply on top */
  function hum() { if (!curve || !curve.length || reduced()) return; setInterval(function () { if (document.hidden) return; base = curve[ci++ % curve.length]; paint(); }, 125); }
  function loadCurve() {
    var A = window.WGArt; if (!A || !A.have["backgrounds/porchlight-flicker-curve.json"]) return;
    fetch(A.base + "backgrounds/porchlight-flicker-curve.json").then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (!j || !j.opacity) return; curve = C.smooth(j.opacity, j.fps || 24, 3, 8); hum();
    }).catch(function () {});
  }
  function reduced() { return !!(RM && RM.matches); }
  function run(steps) {
    if (!el || busy) return; busy = 1; var i = 0;
    (function step() { if (i >= steps.length) { busy = 0; return; } var s = steps[i++]; lvl = s[0]; paint(); setTimeout(step, s[1]); })();
  }
  /* PORCH1+ · a burst sometimes rides a draft: one hanging sign stirs as the light stutters */
  function burst() { run(C.plan(Math.random, reduced())); if (!reduced() && Math.random() < 0.35 && window.WGSway && WGSway.gustOne) setTimeout(WGSway.gustOne, 120); }
  function loop() { t = setTimeout(function () { if (!document.hidden) burst(); loop(); }, C.nextGap()); }
  function init() { el = document.querySelector(".wg-porch"); if (!el) return; el.style.transition = reduced() ? "opacity 2.4s ease-in-out" : "none"; loop(); if (window.WGArt) loadCurve(); else addEventListener("wg:caps", loadCurve, { once: true }); }
  window.WGPorch = { burst: burst };
  if (document.readyState !== "loading") init(); else addEventListener("DOMContentLoaded", init);
})();
