/* SPOOK1 · a gentle on-device scare for the wall / hub screens (never phone).
   Trigger: front camera at 64x48 grayscale, frame diff in memory only (no frame is stored, sent, drawn visibly or logged);
   no camera / denied → idle tap. One visual beat + one low slow Web Speech line (no audio files).
   Laws: ~45 s cooldown; the voice plays ONLY 5:00 PM to 7:00 AM CT (7 AM to 5 PM = visual only); brass mute silences the voice; reduced motion =
   minimal visual; never blocks taps (pointer-events none, transform/opacity only); camera trouble shows nothing. */
(function (root, factory) {
  var core = factory();
  if (typeof module === "object" && module.exports) module.exports = core; else root.WGSpookCore = core;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var LINES = [
    "Who goes there?", "I see you, little one.", "Ooooh, a visitor.", "Something is watching.", "Shh. Did you hear that?",
    "Welcome, brave friend.", "The pumpkins are whispering.", "Something creaks softly.", "Boo. Did I spook you?",
    "The moon says hello.", "Tiptoe, tiptoe.", "The bats are awake tonight.", "A chilly wind blows by.",
    "The ghost is just saying hi.", "Mind the cobwebs.", "The cauldron bubbles.", "Who dares tiptoe past?",
    "The owls are counting you.", "Hee hee hee. Just kidding.", "Happy haunting.", "The crows are gossiping again.",
    "Is someone hiding there?"
  ];
  var BEATS = ["ghost", "lantern", "crow", "jolt"];
  var COOLDOWN_MS = 45000;
  var W = 64, H = 48;
  /* fraction of pixels whose gray value moved more than `px` between two equal-length frames */
  function frameDiff(a, b, px) {
    if (!a || !b || a.length !== b.length || !a.length) return 0;
    px = px == null ? 24 : px; var n = 0;
    for (var i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > px) n++;
    return n / a.length;
  }
  /* AMBIENT2 · centroid of changed pixels (0..1) and its shift since the last detection; numbers only, never pixels */
  function centroid(a, b, px, w) {
    w = w || W; var sx = 0, sy = 0, n = 0;
    for (var i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > (px || 24)) { sx += i % w; sy += (i / w) | 0; n++; }
    if (!n) return null; var h = a.length / w;
    return { cx: +(sx / n / Math.max(1, w - 1)).toFixed(4), cy: +(sy / n / Math.max(1, h - 1)).toFixed(4) };
  }
  function payload(c, prev, t) {
    var r = function (v) { v = Number(v); return isFinite(v) ? +v.toFixed(4) : 0; };
    /* contract (locked): {cx,cy,vx,vy,t} numbers only; v in frame-widths per second */
    var dt = prev && isFinite(Number(prev.t)) && isFinite(Number(t)) && t > prev.t ? (t - prev.t) / 1000 : 0.25;
    return { cx: r(c.cx), cy: r(c.cy), vx: r(prev ? (c.cx - prev.cx) / dt : 0), vy: r(prev ? (c.cy - prev.cy) / dt : 0), t: r(t) };
  }
  function motion(a, b) { return frameDiff(a, b, 24) > 0.06; }
  /* RGBA → gray, in place into a reused buffer */
  function toGray(rgba, out) { for (var i = 0, j = 0; j < out.length; i += 4, j++) out[j] = (rgba[i] * 77 + rgba[i + 1] * 150 + rgba[i + 2] * 29) >> 8; return out; }
  function ctHour(ms) {
    var p = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "numeric", hourCycle: "h23" }).formatToParts(new Date(ms));
    for (var i = 0; i < p.length; i++) if (p[i].type === "hour") return Number(p[i].value) % 24;
    return 12;
  }
  function voiceHours(ms) { var h = ctHour(ms); return h >= 17 || h < 7; }   /* Dan 10/23 6:55 PM FINAL: voice only 5 PM to 7 AM CT */
  function Policy() { this.last = -Infinity; this.prev = -1; }
  /* decide(now, {muted, reduced, rand}) → null (cooling) or {beat, line|null, voice, minimal} */
  Policy.prototype.decide = function (now, o) {
    o = o || {}; var r = o.rand || Math.random;
    if (now - this.last < COOLDOWN_MS) return null;
    this.last = now;
    var i = Math.floor(r() * LINES.length); if (i === this.prev) i = (i + 1) % LINES.length; this.prev = i;
    var voice = !o.muted && voiceHours(now);
    return { beat: o.reduced ? "lantern" : BEATS[Math.floor(r() * BEATS.length)], line: voice ? LINES[i] : null, voice: voice, minimal: !!o.reduced };
  };
  return { LINES: LINES, BEATS: BEATS, COOLDOWN_MS: COOLDOWN_MS, W: W, H: H, frameDiff: frameDiff, motion: motion, toGray: toGray, centroid: centroid, payload: payload, voiceHours: voiceHours, ctHour: ctHour, Policy: Policy };
});

(function () {
  "use strict";
  if (typeof window === "undefined" || typeof document === "undefined") return;
  var C = window.WGSpookCore, html = document.documentElement;
  var PERM = "wg-spook:cam";   /* remembered once per screen: "ok" | "no" */
  function phone() { return html.classList.contains("lh-phone") || matchMedia("(max-width: 600px)").matches || /[?&]phone=1/.test(location.search); }
  function reduced() { return !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches); }
  function muted() { try { return !!(window.HouseSound && !window.HouseSound.isOn()); } catch (e) { return true; } }
  var pol = new C.Policy(), layer = null;
  function ensureLayer() {
    if (layer) return layer;
    layer = document.createElement("div"); layer.className = "wg-spook"; layer.setAttribute("aria-hidden", "true");
    layer.innerHTML = '<i class="sp-ghost"></i><i class="sp-lantern"></i><i class="sp-crow"></i>';
    document.body.appendChild(layer); ghostArt(); return layer;
  }
  /* SPOOK2 · Prism's ghost loop (black matte, blend screen) rides the ghost beat. Video only behind caps video:true and a
     listed file; otherwise the listed poster still drifts; otherwise the CSS wisp. Never a 404: only listed names load. */
  var gv = null;
  function ghostArt() {
    var A = window.WGArt; if (!A || !layer || gv) return;
    var ph = innerWidth / innerHeight < 0.8, k = "overlays/ghost-black-" + (ph ? "phone" : "wall"), poster = A.have[k + "-poster.webp"] ? A.base + k + "-poster.webp" : "";
    if (A.video && A.have[k + ".mp4"]) {
      gv = document.createElement("video"); gv.className = "sp-ghostv"; gv.muted = true; gv.playsInline = true; gv.loop = false; gv.preload = "auto";
      gv.setAttribute("muted", ""); gv.setAttribute("playsinline", ""); if (poster) gv.poster = poster; gv.src = A.base + k + ".mp4";
      gv.onerror = function () { if (gv) gv.removeAttribute("src"); };
    } else if (poster) { gv = document.createElement("img"); gv.className = "sp-ghostv"; gv.alt = ""; gv.src = poster; }
    if (gv) { gv.setAttribute("aria-hidden", "true"); layer.appendChild(gv); layer.classList.add("has-ghostv"); }
  }
  addEventListener("wg:caps", function () { if (layer) ghostArt(); });
  function say(line) {
    try {
      if (!line || !window.speechSynthesis) return;
      var u = new SpeechSynthesisUtterance(line); u.rate = 0.72; u.pitch = 0.45; u.volume = 0.9;
      speechSynthesis.cancel(); speechSynthesis.speak(u);
    } catch (e) {}
  }
  function jolt() {
    var all = document.querySelectorAll("[data-sway]:not([data-sway=post]) .wg-gu");
    Array.prototype.forEach.call(all, function (g, i) {
      setTimeout(function () { g.style.setProperty("--gu-amp", (6 + Math.random() * 2) * (i % 2 ? -1 : 1) + "deg"); g.classList.remove("gust"); void g.offsetWidth; g.classList.add("gust"); }, i * 90);
    });
  }
  function fire(now) {
    var d = pol.decide(now || Date.now(), { muted: muted(), reduced: reduced() });
    if (!d) return null;
    try { window.dispatchEvent(new CustomEvent("spook:scare", { detail: { t: Date.now() } })); } catch (e) {}
    var L = ensureLayer(); L.className = "wg-spook on b-" + d.beat + (d.minimal ? " min" : "");
    if (d.beat === "jolt") jolt();
    if (d.beat === "ghost" && !d.minimal && gv && gv.play) { try { gv.currentTime = 0; var pr = gv.play(); if (pr && pr.catch) pr.catch(function () {}); } catch (e) {} }
    if ((d.beat === "lantern" || d.beat === "ghost") && window.WGPorch) window.WGPorch.burst();   /* PORCH1 */
    setTimeout(function () { L.className = "wg-spook"; }, d.minimal ? 1200 : 3200);
    say(d.line);
    return d;
  }
  /* camera: hidden <video> + offscreen canvas only; frames live in two reused buffers, never leave this closure */
  var lastC = null;
  function camera() {
    var md = navigator.mediaDevices;
    if (!md || !md.getUserMedia) return Promise.reject(0);
    return md.getUserMedia({ video: { facingMode: "user", width: { ideal: 160 }, height: { ideal: 120 }, frameRate: { ideal: 5 } }, audio: false }).then(function (s) {
      try { localStorage.setItem(PERM, "ok"); } catch (e) {}
      var v = document.createElement("video"); v.muted = true; v.playsInline = true; v.srcObject = s; v.play();
      var cv = (typeof OffscreenCanvas !== "undefined") ? new OffscreenCanvas(C.W, C.H) : document.createElement("canvas");
      cv.width = C.W; cv.height = C.H;
      var cx = cv.getContext("2d", { willReadFrequently: true }), a = new Uint8Array(C.W * C.H), b = new Uint8Array(C.W * C.H), have = false;
      setInterval(function () {
        if (document.hidden || v.readyState < 2) return;
        cx.drawImage(v, 0, 0, C.W, C.H); C.toGray(cx.getImageData(0, 0, C.W, C.H).data, b);
        if (have && C.motion(a, b)) {
          var c = C.centroid(a, b); if (c) { try { window.dispatchEvent(new CustomEvent("spook:motion", { detail: C.payload(c, lastC, Date.now()) })); } catch (e) {} lastC = { cx: c.cx, cy: c.cy, t: Date.now() }; }
          fire();
        }
        var t = a; a = b; b = t; have = true;
      }, 250);
    });
  }
  function idleTap() {
    var lastTap = Date.now();
    addEventListener("pointerdown", function () { var n = Date.now(); if (n - lastTap > 60000) fire(n); lastTap = n; }, { passive: true });
  }
  function init() {
    if (phone()) return;   /* the phone view never uses the camera and never spooks */
    var p = null; try { p = localStorage.getItem(PERM); } catch (e) {}
    if (p === "no") { idleTap(); return; }
    camera().catch(function () { try { localStorage.setItem(PERM, "no"); } catch (e) {} idleTap(); });
  }
  window.WGSpook = { fire: fire, init: init };
  if (!/[?&]spook=0/.test(location.search)) {
    if (document.readyState !== "loading") setTimeout(init, 1500); else addEventListener("DOMContentLoaded", function () { setTimeout(init, 1500); });
  }
})();
