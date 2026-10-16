/* MONTHFX1 · month theme over the kid boards. Picked by the current month; ?month=10 (1-12) or ?month=0 (off) overrides.
   Only October has content; every other month adds nothing. Photoreal footage only, calm motion, never takes taps. */
(function () {
  var q = new URLSearchParams(location.search), m = q.has("month") ? parseInt(q.get("month"), 10) : new Date().getMonth() + 1;
  var base = ((document.currentScript && document.currentScript.src) || "month-theme/kid-month.js").replace(/month-theme\/kid-month\.js.*$/, "");
  var RM = matchMedia("(prefers-reduced-motion: reduce)");
  var THEMES = {
    10: { cls: "km-oct", vids: [["km-bats", "night/media/bats-matte.mp4"], ["km-fog", "night/media/smoke-black.mp4"], ["km-embers", "night/media/embers-black.mp4"]], glow: true, grade: true }
  };
  var t = THEMES[m]; if (!t) return;
  function mount() {
    var L = document.createElement("div"); L.className = "km-layer " + t.cls; L.setAttribute("aria-hidden", "true");
    if (t.grade) { var g = document.createElement("div"); g.className = "km-grade"; L.appendChild(g); }
    if (t.glow) ["l", "r"].forEach(function (s) { var d = document.createElement("div"); d.className = "km-glow " + s; L.appendChild(d); });
    var vids = t.vids.map(function (p) {
      var v = document.createElement("video"); v.className = "km-vid " + p[0]; v.muted = true; v.loop = true; v.playsInline = true; v.setAttribute("playsinline", "");
      v.preload = "metadata"; v.src = base + p[1]; v.playbackRate = 0.8;
      v.addEventListener("loadeddata", function () { v.classList.add("on"); }, { once: true });
      L.appendChild(v); return v;
    });
    function sync() { vids.forEach(function (v) { if (RM.matches || document.hidden) v.pause(); else v.play().catch(function () {}); }); }
    RM.addEventListener && RM.addEventListener("change", sync); document.addEventListener("visibilitychange", sync);
    var canvas = document.querySelector(".kw-canvas");
    if (canvas && canvas.parentNode) canvas.parentNode.insertBefore(L, canvas.nextSibling); else document.body.appendChild(L);
    document.documentElement.setAttribute("data-month-theme", String(m));
    setTimeout(sync, 300);
  }
  function go() { if (document.querySelector(".kw-canvas")) mount(); else { var n = 0, iv = setInterval(function () { if (document.querySelector(".kw-canvas") || ++n > 40) { clearInterval(iv); mount(); } }, 100); } }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go); else go();
})();
