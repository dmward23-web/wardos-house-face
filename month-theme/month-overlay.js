/* MONTHFX1 · ONE shared month overlay for every board: each board keeps its base theme (kid worlds, v5.2 night scene) and this merges on top.
   October keeps the footage coat. November and December are a code-drawn coat from month-theme/season-math.js
   (late harvest into cold, then living snow and window lights through the 25th). ?month=10 (1-12) or ?month=0 (off).
   ?now=<iso> pins the coat the same way the living house clock does. Photoreal layers only, calm motion, never takes taps. */
(function () {
  var q = new URLSearchParams(location.search);
  if (q.get("month") === "0") return;
  var base = ((document.currentScript && document.currentScript.src) || "month-theme/month-overlay.js").replace(/month-theme\/month-overlay\.js.*$/, "");
  var RM = matchMedia("(prefers-reduced-motion: reduce)");
  var THEMES = {
    10: { cls: "km-oct", vids: [["km-bats", "night/media/bats-matte.mp4"], ["km-fog", "night/media/smoke-black.mp4"], ["km-embers", "night/media/embers-black.mp4"]], glow: true, grade: true }
  };
  function seasonDate() {
    if (q.get("now")) {
      var pinned = new Date(q.get("now"));
      if (!isNaN(+pinned)) return pinned;
    }
    if (q.has("month")) {
      var m = parseInt(q.get("month"), 10);
      if (m >= 1 && m <= 12) {
        var y = new Date().getFullYear();
        try { y = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", year: "numeric" }).format(new Date())); } catch (eY) { /* keep local year */ }
        return new Date(Date.UTC(y, m - 1, 15, 18, 0, 0));
      }
    }
    return new Date();
  }
  function specNow() {
    var S = window.MonthSeason;
    return (S && S.decide) ? S.decide(seasonDate()) : { id: "other", cold: 0, flakes: 0, snow: 0, lit: 0, windows: 0 };
  }
  var spec = specNow();
  if (spec.id === "november") { mountNovember(); return; }
  if (spec.id === "december") { mountCoat(spec); return; }
  function ctHour(d) {
    try {
      var p = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "numeric", hourCycle: "h23" }).formatToParts(d);
      for (var i = 0; i < p.length; i++) if (p[i].type === "hour") return Number(p[i].value) % 24;
    } catch (e) { /* local hour */ }
    return d.getHours();
  }
  function scenePack(when) {
    var S = window.HouseScene;
    if (S && S.plates) return S.plates(when);
    return { phase: "night", wall: "month-theme/november/wall-night.webp", phone: "month-theme/november/phone-night.webp", hub: "month-theme/november/hub-window-night-900x864.webp" };
  }
  function mountNovember() {
    function go() {
      var when = seasonDate();
      var pack = scenePack(when);
      var phase = pack.phase === "day" ? "morning" : pack.phase;
      var phone = document.documentElement.getAttribute("data-wardos-stage") !== "1" && (window.innerWidth || 0) < 700;
      /* CSS consumes --km-bg from month-overlay.css, so a page-relative url doubles month-theme/. */
      var plate = base + (phone ? pack.phone : pack.wall);
      var kidPage = /\/kid-[a-z]+/.test(location.pathname || "") || !!(document.body && document.body.hasAttribute("data-kid-world"));
      document.documentElement.setAttribute("data-month-theme", "11");
      document.documentElement.setAttribute("data-nov-phase", pack.phase);
      document.documentElement.setAttribute("data-scene-phase", pack.phase);
      document.querySelectorAll("iframe.night52-scene").forEach(function (fr) {
        fr.removeAttribute("src");
        fr.style.display = "none";
      });
      if (!kidPage) {
        var url = "url(\"" + plate + "\")";
        document.documentElement.style.setProperty("--km-bg", url);
        document.documentElement.style.setProperty("--wg-hubbg", url);
      }
      var fig = document.querySelector(".hub-window");
      if (fig) {
        var img = fig.querySelector("img");
        if (!img) { img = document.createElement("img"); img.alt = ""; img.width = 900; img.height = 864; fig.appendChild(img); }
        if (img.getAttribute("src") !== pack.hub) img.src = pack.hub;
      }
    }
    function arm() {
      go();
      var S = window.HouseScene;
      if (S && S.subscribe && !arm.done) { arm.done = true; S.subscribe(go); if (S.start) S.start(); }
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", arm); else arm();
  }
  var m = q.has("month") ? parseInt(q.get("month"), 10) : new Date().getMonth() + 1;
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

  function mountCoat(sp) {
    function place(L) {
      var kw = document.querySelector(".kw-canvas"), fr = document.querySelector("iframe.night52-scene"), fx = document.getElementById("fx");
      var mode = kw ? "kid" : fr ? "scene" : "board";
      L.classList.add(mode === "kid" ? "km-kid" : mode === "scene" ? "km-scene" : "km-board");
      if (kw) { L.style.zIndex = "2"; kw.parentNode.insertBefore(L, kw.nextSibling); }
      else if (fr) { L.style.zIndex = "1"; fr.parentNode.insertBefore(L, fr.nextSibling); }
      else if (fx) { L.style.zIndex = "1"; fx.parentNode.insertBefore(L, fx.nextSibling); }
      else { L.style.zIndex = "0"; if (document.body) document.body.insertBefore(L, document.body.firstChild); }
      return mode;
    }
    function goCoat() {
      if (document.getElementById("km-coat")) return;
      var L = document.createElement("div");
      L.id = "km-coat";
      L.className = "km-layer " + (sp.id === "december" ? "km-dec" : "km-nov");
      L.setAttribute("aria-hidden", "true");
      var cv = document.createElement("canvas");
      cv.className = "km-paint";
      L.appendChild(cv);
      var mode = place(L);
      document.documentElement.setAttribute("data-month-theme", sp.id === "december" ? "12" : "11");
      document.documentElement.setAttribute("data-season-id", sp.id);
      document.documentElement.setAttribute("data-season-lit", String(sp.lit || 0));
      document.documentElement.setAttribute("data-season-cold", String(sp.cold || 0));
      var ctx = cv.getContext("2d");
      var raf = 0, t0 = 0;
      function size() {
        var dpr = Math.min(2, window.devicePixelRatio || 1);
        var w = window.innerWidth || 1, h = window.innerHeight || 1;
        cv.width = Math.max(1, Math.round(w * dpr));
        cv.height = Math.max(1, Math.round(h * dpr));
        cv.style.width = w + "px";
        cv.style.height = h + "px";
        return { w: cv.width, h: cv.height, dpr: dpr };
      }
      function frame(now) {
        var box = size();
        var t = RM.matches ? 0 : ((now || 0) - t0) / 1000;
        drawCoat(ctx, box.w, box.h, sp, t, mode);
        if (!RM.matches && !document.hidden) raf = requestAnimationFrame(frame);
      }
      function start() { cancelAnimationFrame(raf); t0 = performance.now(); frame(t0); }
      RM.addEventListener && RM.addEventListener("change", start);
      document.addEventListener("visibilitychange", function () { if (!document.hidden) start(); });
      window.addEventListener("resize", start);
      start();
    }
    function hostReady() { return document.querySelector(".kw-canvas,iframe.night52-scene,#fx"); }
    function kick() {
      if (hostReady()) { goCoat(); return; }
      var n = 0, iv = setInterval(function () { if (hostReady() || ++n > 40) { clearInterval(iv); goCoat(); } }, 100);
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", kick);
    else kick();
  }

  function drawCoat(ctx, W, H, sp, t, mode) {
    var veil = mode === "scene" ? 0.42 : mode === "kid" ? 0.62 : 1;
    ctx.clearRect(0, 0, W, H);
    var sky = ctx.createLinearGradient(0, 0, 0, H);
    if (sp.id === "december") {
      sky.addColorStop(0, "rgba(6,12,28," + (0.16 * veil) + ")");
      sky.addColorStop(0.55, "rgba(10,18,32," + (0.1 * veil) + ")");
      sky.addColorStop(1, "rgba(18,24,32," + (0.22 * veil) + ")");
    } else {
      var warm = 1 - (sp.cold || 0);
      sky.addColorStop(0, "rgba(48,22,8," + ((0.04 + warm * 0.14) * veil) + ")");
      sky.addColorStop(0.45, "rgba(16,24,36," + ((0.06 + (sp.cold || 0) * 0.12) * veil) + ")");
      sky.addColorStop(1, "rgba(28,20,12," + (0.14 * veil) + ")");
    }
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    var sunX = W * (sp.id === "december" ? 0.22 : 0.78 - (sp.cold || 0) * 0.12);
    var sunY = H * (0.16 + (sp.cold || 0) * 0.08);
    var rad = Math.min(W, H) * (sp.id === "december" ? 0.22 : 0.28);
    var glow = ctx.createRadialGradient(sunX, sunY, 2, sunX, sunY, rad);
    if (sp.id === "december") {
      glow.addColorStop(0, "rgba(232,238,255,0.55)");
      glow.addColorStop(0.35, "rgba(180,198,230,0.18)");
      glow.addColorStop(1, "rgba(180,198,230,0)");
    } else {
      glow.addColorStop(0, "rgba(255,196,110," + (0.28 + (1 - (sp.cold || 0)) * 0.4) + ")");
      glow.addColorStop(0.4, "rgba(255,120,40,0.12)");
      glow.addColorStop(1, "rgba(255,120,40,0)");
    }
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(sunX, sunY, rad, 0, Math.PI * 2); ctx.fill();

    var groundTop = mode === "kid" ? H * 0.82 : H * 0.72;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, mode === "kid" ? H * 0.78 : 0, W, H);
    ctx.clip();
    ctx.globalAlpha = 0.55 * veil;
    ctx.strokeStyle = sp.id === "december" ? "#101820" : "#1c140e";
    ctx.fillStyle = ctx.strokeStyle;
    ctx.lineWidth = Math.max(1.5, W * 0.002);
    var baseY = mode === "kid" ? H * 0.9 : H * 0.8;
    for (var i = 0; i < 8; i++) {
      var tx = ((i + 0.35) / 8) * W;
      var th = H * (0.1 + (i % 3) * 0.035) * (mode === "kid" ? 0.55 : 1);
      ctx.beginPath();
      ctx.moveTo(tx, baseY);
      ctx.lineTo(tx - W * 0.004, baseY - th);
      ctx.lineTo(tx + W * 0.004, baseY - th);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(tx, baseY - th * 0.62);
      ctx.quadraticCurveTo(tx - W * 0.03, baseY - th * 0.78, tx - W * 0.05, baseY - th * 0.48);
      ctx.moveTo(tx, baseY - th * 0.42);
      ctx.quadraticCurveTo(tx + W * 0.028, baseY - th * 0.6, tx + W * 0.046, baseY - th * 0.36);
      ctx.stroke();
    }
    ctx.restore();

    var depth = sp.id === "december" ? (sp.snow || 0.35) : (sp.cold || 0) * 0.45;
    var packH = H * (0.045 + depth * (mode === "kid" ? 0.06 : 0.11));
    var frost = ctx.createLinearGradient(0, H - packH, 0, H);
    frost.addColorStop(0, "rgba(255,255,255,0)");
    frost.addColorStop(1, "rgba(236,242,250," + (0.18 + depth * 0.55) + ")");
    ctx.fillStyle = frost;
    ctx.fillRect(0, H - packH, W, packH);

    var nWin = sp.id === "december" ? 8 : 2;
    var litN = sp.id === "december" ? Math.max(0, Math.round(((sp.lit || 0) / 25) * 8)) : 2;
    if (sp.id === "december" && (sp.lit || 0) > 0 && litN < 1) litN = 1;
    var ww = Math.max(8, Math.min(W * 0.028, 28));
    var gap = ww * 0.7;
    var total = nWin * ww + (nWin - 1) * gap;
    var x0 = mode === "kid" ? W * 0.06 : (W - total) / 2;
    var yW = mode === "kid" ? H * 0.86 : H * 0.58;
    for (var w = 0; w < nWin; w++) {
      var x = x0 + w * (ww + gap);
      var on = w < litN;
      ctx.fillStyle = on ? "rgba(255,198,120,0.9)" : "rgba(12,16,24,0.45)";
      ctx.fillRect(x, yW, ww, ww * 1.4);
      if (!on) continue;
      var wg = ctx.createRadialGradient(x + ww / 2, yW + ww, 1, x + ww / 2, yW + ww, ww * 3);
      wg.addColorStop(0, "rgba(255,170,70,0.4)");
      wg.addColorStop(1, "rgba(255,170,70,0)");
      ctx.fillStyle = wg;
      ctx.beginPath(); ctx.arc(x + ww / 2, yW + ww, ww * 3, 0, Math.PI * 2); ctx.fill();
    }

    var flakes = sp.flakes || 0;
    if (sp.id === "november" && flakes < 0.04) {
      var leaves = Math.round((1 - (sp.cold || 0)) * (mode === "kid" ? 8 : 16));
      ctx.fillStyle = "rgba(168,78,28,0.62)";
      for (var n = 0; n < leaves; n++) {
        var lx = ((n * 97 + t * (10 + (n % 5))) % (W + 40)) - 20;
        var ly = ((n * 53 + t * (16 + (n % 7))) % (H * (mode === "kid" ? 0.28 : 0.62))) + (mode === "kid" ? H * 0.7 : 0);
        ctx.save();
        ctx.translate(lx, ly);
        ctx.rotate(n + t * 0.2);
        ctx.beginPath(); ctx.ellipse(0, 0, 7, 3, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    } else if (flakes > 0) {
      var count = Math.round(flakes * (sp.id === "december" ? (mode === "kid" ? 46 : 90) : 40));
      for (var s = 0; s < count; s++) {
        var sx = ((s * 131 + t * (16 + (s % 5) * 7) * (0.35 + flakes)) % (W + 24)) - 12;
        var sy = ((s * 77 + t * (26 + (s % 4) * 11) * (0.35 + flakes)) % (H + 16)) - 8;
        if (mode === "kid" && sy < H * 0.55 && s % 3 !== 0) continue;
        ctx.globalAlpha = 0.35 + (s % 5) * 0.1;
        ctx.fillStyle = "#f4f7fb";
        ctx.beginPath();
        ctx.arc(sx, sy, (s % 3) * 0.7 + 0.7, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }
})();
