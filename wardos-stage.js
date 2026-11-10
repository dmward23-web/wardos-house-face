/* ACERFIX · one 1920x1080 stage. Smaller viewports get a single scale-to-fit.
   s = min(1, innerWidth/1920, innerHeight/1080), origin 0 0, letterboxed.
   Internal coordinates stay 1920x1080. ?diag=1 is a local overlay only: no network, no storage, no secrets. */
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
    document.documentElement.style.setProperty("--wardos-s", String(s));
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
    var title = document.createElement("p");
    title.className = "wardos-diag-title";
    title.textContent = "Display";
    host.appendChild(title);
    var lines = [
      ["inner", snap.innerWidth + " x " + snap.innerHeight],
      ["dpr", String(snap.devicePixelRatio)],
      ["screen", snap.screenWidth + " x " + snap.screenHeight],
      ["avail", snap.availWidth + " x " + snap.availHeight],
      ["visual", (snap.visualWidth == null ? "none" : snap.visualWidth + " x " + snap.visualHeight + " @" + snap.visualScale)],
      ["stage", String(snap.stageScale)],
      ["ct", snap.ct || ""]
    ];
    for (var i = 0; i < lines.length; i++) {
      var row = document.createElement("p");
      var k = document.createElement("b");
      k.textContent = lines[i][0];
      row.appendChild(k);
      row.appendChild(document.createTextNode(" " + lines[i][1]));
      host.appendChild(row);
    }
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
