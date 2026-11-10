/* ACERFIX · one 1920x1080 stage. Smaller viewports get a single scale-to-fit.
   s = min(1, innerWidth/1920, innerHeight/1080), origin 0 0, letterboxed.
   Gate scales: 1920x1080 → 1, 1536x864 → 0.8, 1536x816 → min(1536/1920, 816/1080) = 0.7556.
   Scale is not clamped. A 0.8 floor would paint 864px into an 816px work area and clip.
   Touch targets are 88 stage px (66.5 CSS px at 0.7556) and type is 24 stage px (18.1 CSS px).
   Home is 96 stage px (72.5 CSS px at 0.7556). ?diag=1 is a local overlay only. */
if (typeof document !== "undefined" && typeof document.write === "function" && !window.HouseAudit && document.readyState === "loading") {
  document.write('<script src="house-audit.js?v=AUDIT1"><\/script>');
}
(function (global) {
  "use strict";
  var STAGE_W = 1920;
  var STAGE_H = 1080;
  var stage = null;

  function viewport() {
    var vv = global.visualViewport;
    return {
      innerWidth: global.innerWidth || 0,
      innerHeight: global.innerHeight || 0,
      dpr: global.devicePixelRatio || 1,
      screenWidth: global.screen ? global.screen.width : 0,
      screenHeight: global.screen ? global.screen.height : 0,
      availWidth: global.screen ? global.screen.availWidth : 0,
      availHeight: global.screen ? global.screen.availHeight : 0,
      visualWidth: vv ? vv.width : null,
      visualHeight: vv ? vv.height : null,
      visualScale: vv ? vv.scale : null
    };
  }

  function scaleOf(box) {
    var b = box || viewport();
    var s = Math.min(1, b.innerWidth / STAGE_W, b.innerHeight / STAGE_H);
    if (!isFinite(s) || s <= 0) s = 1;
    return s;
  }

  function ensureStage() {
    if (stage && stage.isConnected) return stage;
    stage = document.querySelector(".wardos-stage");
    if (!stage) {
      stage = document.createElement("div");
      stage.className = "wardos-stage";
    }
    var kids = [];
    var i;
    for (i = 0; i < document.body.childNodes.length; i++) kids.push(document.body.childNodes[i]);
    if (stage.parentNode !== document.body) document.body.appendChild(stage);
    for (i = 0; i < kids.length; i++) {
      var n = kids[i];
      if (n === stage) continue;
      if (n.nodeType === 1 && (n.id === "wardos-diag" || n.classList.contains("pair-screen") || n.classList.contains("chore-shortcuts"))) continue;
      stage.appendChild(n);
    }
    return stage;
  }

  function wanted() {
    var w = global.innerWidth || 0, h = global.innerHeight || 0;
    return (w >= 1400 && h >= 700) || (h >= 1400 && w >= 700);
  }

  function place() {
    if (!document.body) return null;
    if (!wanted()) {
      document.documentElement.removeAttribute("data-wardos-stage");
      return null;
    }
    var node = ensureStage();
    var box = viewport();
    var s = scaleOf(box);
    var left = Math.max(0, Math.round((box.innerWidth - STAGE_W * s) / 2));
    var top = Math.max(0, Math.round((box.innerHeight - STAGE_H * s) / 2));
    node.style.position = "absolute";
    node.style.left = left + "px";
    node.style.top = top + "px";
    node.style.width = STAGE_W + "px";
    node.style.height = STAGE_H + "px";
    node.style.transformOrigin = "0 0";
    node.style.transform = "scale(" + s + ")";
    document.documentElement.setAttribute("data-wardos-stage", "1");
    ensureHome(node);
    document.documentElement.style.setProperty("--wardos-s", String(s));
    var bar = document.querySelector("body > .chore-shortcuts");
    if (bar) {
      bar.style.setProperty("left", Math.round(left + 160 * s) + "px", "important");
      bar.style.setProperty("top", Math.round(top + 66 * s) + "px", "important");
      bar.style.setProperty("transform", "scale(" + s + ")", "important");
      bar.style.setProperty("transform-origin", "0 0", "important");
    }
    var link = document.querySelector('link[data-wardos-stage-css="1"]');
    if (link && link.parentNode) link.parentNode.appendChild(link);
    return { s: s, left: left, top: top, box: box };
  }

  function point(ev) {
    var node = stage || document.querySelector(".wardos-stage");
    var s = scaleOf();
    if (!node) return { x: ev.clientX, y: ev.clientY, s: s };
    var r = node.getBoundingClientRect();
    return { x: (ev.clientX - r.left) / s, y: (ev.clientY - r.top) / s, s: s };
  }

  function diagWanted() {
    try {
      return new URLSearchParams(global.location.search).get("diag") === "1";
    } catch (e) {
      return false;
    }
  }

  function diagSnapshot() {
    var box = viewport();
    var s = scaleOf(box);
    var stamp = "";
    try { stamp = global.HouseScene && HouseScene.ctStamp ? HouseScene.ctStamp() : ""; } catch (e) { stamp = ""; }
    return {
      innerWidth: box.innerWidth,
      innerHeight: box.innerHeight,
      devicePixelRatio: box.dpr,
      screenWidth: box.screenWidth,
      screenHeight: box.screenHeight,
      availWidth: box.availWidth,
      availHeight: box.availHeight,
      visualWidth: box.visualWidth,
      visualHeight: box.visualHeight,
      visualScale: box.visualScale,
      stageScale: s,
      ct: stamp
    };
  }

  function ensureHome(node) {
    var path = (global.location && global.location.pathname) || "";
    var existing = document.querySelector(".kw-home, .hub-home, .wardos-home");
    if (existing) {
      existing.classList.add("wardos-home");
      if (!existing.getAttribute("aria-label")) existing.setAttribute("aria-label", "Home");
      var icon = existing.querySelector("img");
      if (icon && !icon.getAttribute("src")) icon.setAttribute("src", "assets/icons/home-key-light.svg");
      return;
    }
    if (/sheet-index\.html$/.test(path)) return;
    var btn = document.createElement("a");
    btn.className = "wardos-home";
    btn.href = "sheet-index.html";
    btn.setAttribute("aria-label", "Home");
    var img = document.createElement("img");
    img.src = "assets/icons/home-key-light.svg";
    img.alt = "";
    btn.appendChild(img);
    node.appendChild(btn);
  }

  function paintDiag() {
    var old = document.getElementById("wardos-diag");
    if (!diagWanted()) {
      if (old && old.parentNode) old.parentNode.removeChild(old);
      return;
    }
    var snap = diagSnapshot();
    var host = old || document.createElement("aside");
    host.id = "wardos-diag";
    host.setAttribute("role", "status");
    host.setAttribute("aria-label", "Display diagnostics");
    while (host.firstChild) host.removeChild(host.firstChild);
    var line = document.createElement("p");
    line.textContent = "inner " + snap.innerWidth + "x" + snap.innerHeight
      + "  dpr " + snap.devicePixelRatio
      + "  screen " + snap.screenWidth + "x" + snap.screenHeight
      + "  avail " + snap.availWidth + "x" + snap.availHeight
      + "  stage " + snap.stageScale
      + (snap.ct ? "  " + snap.ct : "")
      + (global.HouseAudit && HouseAudit.active() ? "  audit on" : "");
    host.appendChild(line);
    var close = document.createElement("button");
    close.type = "button";
    close.className = "wardos-diag-close";
    close.textContent = "Close";
    close.addEventListener("click", function () {
      if (host.parentNode) host.parentNode.removeChild(host);
    });
    host.appendChild(close);
    var node = stage || document.body;
    if (host.parentNode !== node) node.appendChild(host);
  }

  function boot() {
    place();
    paintDiag();
    global.addEventListener("resize", function () { place(); paintDiag(); });
    if (global.visualViewport) global.visualViewport.addEventListener("resize", function () { place(); paintDiag(); });
    document.addEventListener("fullscreenchange", function () { place(); paintDiag(); });
  }

  global.WardosStage = {
    STAGE_W: STAGE_W,
    STAGE_H: STAGE_H,
    viewport: viewport,
    scaleOf: scaleOf,
    place: place,
    point: point,
    diagSnapshot: diagSnapshot,
    diagWanted: diagWanted
  };

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
    else boot();
  }
})(typeof window !== "undefined" ? window : globalThis);
