/* SCENEHERO1 · the October night scene is the hero on every board (Dan 10/16 9:16 PM: "Don't make me hunt for it").
   Shared layer: <html data-sh="hub|dad|sheet|month|kid|game" [data-sh-after="<css>"]> + this script + scene-hero.css.
   - glass: every dark, near-opaque card plate on a night52 board gets a lower-alpha fill (same gradient, same hue) and a
     blur + dim backdrop (.sh-glass), so the scene reads through while words stay AA. Headers, the Dad tile/chip, the sound
     button and the scene/overlay layers are never touched. No card moves, hides or changes order.
   - band (portrait only): an open window of scene under the header (or data-sh-after). The scene iframe frames the wall
     plate's key strip into it (night/scene.html band mode), and the month overlay's bats fly there.
   - kid / game boards keep their own worlds (MONTHFX2 rules unchanged): this layer only tags them.
   ?hero=0 turns it off. Reduced motion: nothing here animates. */
(function () {
  var de = document.documentElement, q = new URLSearchParams(location.search);
  if (q.get("hero") === "0") return;
  var prof = de.getAttribute("data-sh") || "sheet";
  de.classList.add("sh-on", "sh-" + prof);
  if (prof === "kid" || prof === "game") return;
  var BR_W = 1120, BR_H = 690; /* must match BR in night/scene.html */
  var KEEP = "header,.hdr,.night52-snd,.night52-scene,.km-layer,.dad-seat,.tile.dan,[data-sh-keep],#bandT,#bandB";
  var RX = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)/g;
  /* AA guard: plates holding small dim labels (per page: <html data-sh-dense="<css>">) keep a little more fill on the wall */
  var DENSE = de.getAttribute("data-sh-dense") || "";
  function target(el) { var portrait = innerWidth / innerHeight < 0.8; if (!portrait && DENSE && el && el.matches(DENSE)) return 0.6; return portrait ? 0.6 : 0.24; }
  function cols(s) { var out = [], m; RX.lastIndex = 0; while ((m = RX.exec(s))) { var a = m[4] == null ? 1 : (/%$/.test(m[4]) ? parseFloat(m[4]) / 100 : +m[4]); out.push([+m[1], +m[2], +m[3], a]); } return out; }
  function dark(c) { return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255 < 0.16; }
  function scale(s, k) { return s.replace(RX, function (_, r, g, b, a) { var al = a == null ? 1 : (/%$/.test(a) ? parseFloat(a) / 100 : +a); return "rgba(" + r + ", " + g + ", " + b + ", " + (Math.round(al * k * 1000) / 1000) + ")"; }); }
  var tuned = [];
  function plate(el) {
    var cs = getComputedStyle(el), bi = cs.backgroundImage, bc = cs.backgroundColor;
    if (/url\(/.test(bi)) return null;
    if (/gradient/.test(bi)) { var c = cols(bi); if (c.length >= 2 && c.every(function (x) { return x[3] >= 0.8 && dark(x); })) return { bi: bi, k: target(el) / Math.max.apply(null, c.map(function (x) { return x[3]; })) }; return null; }
    var b = cols(bc)[0]; if (b && b[3] >= 0.8 && dark(b)) return { bc: bc, k: target(el) / b[3] };
    return null;
  }
  function tune(el) {
    if (el.__sh) { el.style.removeProperty("background-image"); el.style.removeProperty("background-color"); }
    var p = plate(el); if (!p) { if (el.__sh) { el.classList.remove("sh-glass"); el.__sh = 0; tuned = tuned.filter(function (e) { return e !== el; }); } return; }
    if (p.bi) el.style.setProperty("background-image", scale(p.bi, p.k), "important");
    else el.style.setProperty("background-color", scale(p.bc, p.k), "important");
    if (!el.classList.contains("sh-glass")) el.classList.add("sh-glass"); if (DENSE && el.matches(DENSE) && !el.classList.contains("sh-dense")) el.classList.add("sh-dense"); if (!el.__sh) { el.__sh = 1; tuned.push(el); }
  }
  function scan(root) {
    var list = (root || document.body).querySelectorAll("*");
    for (var i = 0; i < list.length; i++) {
      var el = list[i]; if (el.__sh || el.closest(KEEP)) continue;
      var r = el.getBoundingClientRect(); if (r.width * r.height < 4000 || r.width < 60) continue;
      tune(el);
    }
  }
  /* ---- portrait band ---- */
  var anc = null, bandOn = false, lastY = null;
  function frame() { return document.querySelector("iframe.night52-scene"); }
  function post(m) { var f = frame(); try { if (f && f.contentWindow) f.contentWindow.postMessage(m, location.origin); } catch (_) {} }
  function scrollOff(el) { var t = window.scrollY || 0; for (var a = el.parentElement; a && a !== document.body && a !== de; a = a.parentElement) t += a.scrollTop || 0; return t; }
  function band(force) {
    var portrait = innerWidth / innerHeight < 0.8, f = frame();
    if (!portrait || !f) { if (bandOn) { bandOn = false; de.classList.remove("sh-band"); if (anc) { anc.style.removeProperty("margin-bottom"); anc.classList.remove("sh-band-anchor"); } post({ night: "band", y: null }); lastY = null; } return; }
    var sel = de.getAttribute("data-sh-after");
    anc = (sel && document.querySelector(sel)) || document.querySelector("body header, body .hdr"); if (!anc) return;
    var h = Math.round(innerWidth * BR_H / BR_W);
    if (!anc.classList.contains("sh-band-anchor")) anc.classList.add("sh-band-anchor"); anc.style.removeProperty("margin-bottom");
    var base = parseFloat(getComputedStyle(anc).marginBottom) || 0;
    anc.style.setProperty("margin-bottom", (base + h + 6) + "px", "important");
    var y = Math.round(anc.getBoundingClientRect().bottom + scrollOff(anc) + 2);
    de.style.setProperty("--sh-by", y + "px"); de.style.setProperty("--sh-bh", h + "px");
    de.classList.add("sh-band"); bandOn = true;
    /* only tell the scene when the band moved: a scene re-layout resizes (clears) its canvases */
    if (y !== lastY || force) { lastY = y; post({ night: "band", y: y }); }
  }
  var t1 = 0, t2 = 0, adds = [];
  function soon() { clearTimeout(t1); t1 = setTimeout(function () { band(); var a = adds; adds = []; if (a.length > 40) scan(); else a.forEach(function (n) { if (n.isConnected) { scan(n); if (!n.__sh && !n.closest(KEEP)) tune(n); } }); }, 400); }
  function retune() { clearTimeout(t2); t2 = setTimeout(function () { tuned = tuned.filter(function (e) { return e.isConnected; }); tuned.forEach(tune); }, 300); }
  function start() {
    if (!document.querySelector("iframe.night52-scene")) return; /* no night scene on this board (Ainsley's venue, ?night=0): nothing to reveal */
    de.classList.add("sh-night");
    scan(); band();
    var f = frame(); if (f) f.addEventListener("load", function () { band(true); });
    new MutationObserver(function (ms) {
      var cls = false;
      ms.forEach(function (m) { if (m.type === "attributes") cls = true; else m.addedNodes.forEach(function (n) { if (n.nodeType === 1) adds.push(n); }); });
      if (adds.length) soon(); if (cls) retune();
    }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
    addEventListener("resize", function () { soon(); retune(); });
    if (window.ResizeObserver && anc) new ResizeObserver(function () { soon(); }).observe(anc);
    [600, 1800, 4000].forEach(function (ms) { setTimeout(function () { scan(); band(); }, ms); });
  }
  function go() { var n = 0, iv = setInterval(function () { if (frame() || ++n > 30) { clearInterval(iv); start(); } }, 100); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go); else go();
})();
