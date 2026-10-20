/* MONTHFX1 · ONE shared month overlay for every board: each board keeps its base theme (kid worlds, v5.2 night scene) and this merges on top. Picked by the current month; ?month=10 (1-12) or ?month=0 (off) overrides.
   Only October has content; every other month adds nothing. Photoreal footage only, calm motion, never takes taps. */
(function () {
  var q = new URLSearchParams(location.search), m = q.has("month") ? parseInt(q.get("month"), 10) : new Date().getMonth() + 1;
  var base = ((document.currentScript && document.currentScript.src) || "month-theme/month-overlay.js").replace(/month-theme\/month-overlay\.js.*$/, "");
  var RM = matchMedia("(prefers-reduced-motion: reduce)");
  var THEMES = {
    10: { cls: "km-oct", vids: [["km-bats", "night/media/bats-matte.mp4"], ["km-fog", "night/media/smoke-black.mp4"], ["km-embers", "night/media/embers-black.mp4"]], glow: true, grade: true }
  };
  var t = THEMES[m]; if (!t) return;
  function mount() {
    var L = document.createElement("div"); L.className = "km-layer " + t.cls + (document.querySelector(".kw-canvas") ? " km-kid" : ""); L.setAttribute("aria-hidden", "true");
    if (t.grade) { var g = document.createElement("div"); g.className = "km-grade"; L.appendChild(g); }
    if (t.glow) ["l", "r"].forEach(function (s) { var d = document.createElement("div"); d.className = "km-glow " + s; L.appendChild(d); });
    var vids = t.vids.map(function (p) {
      var v = document.createElement("video"); v.className = "km-vid " + p[0]; v.muted = true; v.loop = true; v.playsInline = true; v.setAttribute("playsinline", "");
      v.preload = "metadata"; v.dataset.src = base + p[1]; v.playbackRate = 0.8;
      v.onerror = function () { v.classList.remove("on"); v.removeAttribute("src"); try { v.load(); } catch (_) {} };   /* LHVID1: a load error drops the player quietly (it only shows once frames load) */
      v.addEventListener("loadeddata", function () { v.classList.add("on"); }, { once: true });
      L.appendChild(v); return v;
    });
    /* LHVID1 · set the sources only when night/media/caps.json says the videos are reachable (the proxy); Pages never requests an mp4 */
    fetch(base + "night/media/caps.json", { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (j && j.video === true) { vids.forEach(function (v) { v.src = v.dataset.src; }); sync(); }
    }).catch(function () {});
    function sync() { vids.forEach(function (v) { if (!v.getAttribute("src")) return; if (RM.matches || document.hidden) v.pause(); else v.play().catch(function () {}); }); }
    RM.addEventListener && RM.addEventListener("change", sync); document.addEventListener("visibilitychange", sync);
    /* sits right above each board's base layer and under its UI */
    var kw = document.querySelector(".kw-canvas"), fr = document.querySelector("iframe.night52-scene"), fx = document.getElementById("fx");
    if (kw) { L.style.zIndex = "2"; kw.parentNode.insertBefore(L, kw.nextSibling); }
    else if (fr) { L.style.zIndex = "-1"; fr.parentNode.insertBefore(L, fr.nextSibling); }
    else if (fx) { L.style.zIndex = "auto"; fx.parentNode.insertBefore(L, fx.nextSibling); }
    else { L.style.zIndex = "0"; document.body.insertBefore(L, document.body.firstChild); }
    document.documentElement.setAttribute("data-month-theme", String(m));
    setTimeout(sync, 300);
  }
  function ready() { return document.querySelector(".kw-canvas,iframe.night52-scene,#fx"); }
  function go() { if (ready()) mount(); else { var n = 0, iv = setInterval(function () { if (ready() || ++n > 40) { clearInterval(iv); mount(); } }, 100); } }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go); else go();
})();
