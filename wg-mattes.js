/* WGMATTE1 · Prism black-matte sprites (candle flicker on the wax, smoke over the cauldron) screened onto their props, and
   the moon clock face. Clips only behind caps video:true + a listed file; the listed poster is the still fallback;
   unlisted = nothing requested (no 404). Reduced motion: posters only. Waits for wg-assets.js "wg:caps". */
(function () {
  "use strict";
  if (typeof window === "undefined") return;
  var RM = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)");
  function mattes(A) {
    var els = document.querySelectorAll("[data-matte]");
    Array.prototype.forEach.call(els, function (el) {
      if (el.querySelector(".wg-matte")) return;
      var k = el.getAttribute("data-matte"), po = A.have[k + "-poster.webp"] ? A.base + k + "-poster.webp" : "", m;
      if (A.video && A.have[k + ".mp4"] && !(RM && RM.matches)) {
        m = document.createElement("video"); m.muted = true; m.loop = true; m.playsInline = true; m.autoplay = true;
        m.setAttribute("muted", ""); m.setAttribute("playsinline", ""); if (po) m.poster = po; m.src = A.base + k + ".mp4";
        m.onerror = function () { m.removeAttribute("src"); };
      } else if (po) { m = document.createElement("img"); m.alt = ""; m.src = po; }
      if (!m) return;
      m.className = "wg-matte"; m.setAttribute("aria-hidden", "true"); el.appendChild(m); el.setAttribute("data-matte-on", "");
      if (m.play) { var p = m.play(); if (p && p.catch) p.catch(function () {}); }
    });
  }
  /* REALMOON1 · Prism's real NASA SVS disc (public domain, credit NASA's Scientific Visualization Studio) under Prism's phase mask;
     phase/up come from window.RealMoon (moon-real.js, the source of truth). Fallback: the old face clipped to the computed lit path. */
  function moon(A) {
    var svg = document.getElementById("lh-moon"); if (!svg || svg.querySelector(".lh-moonface")) return;
    var disc = ["props/moon-real-disc-512.webp", "props/moon-real-disc-512.png"].filter(function (k) { return A.have[k]; })[0];
    var mk = function (i) { var b = "props/moon-phase-mask-" + (i < 10 ? "0" : "") + i + "-1024."; return A.have[b + "webp"] ? b + "webp" : A.have[b + "png"] ? b + "png" : null; };
    var real = disc && mk(15), n = real ? disc : "props/moon-face-1024.webp"; if (!real && !A.have[n]) return;
    var NS = "http://www.w3.org/2000/svg", im = document.createElementNS(NS, "image"), et = svg.querySelector(".lh-etch");
    im.setAttribute("class", "lh-moonface"); im.setAttribute("href", A.base + n); im.setAttribute("x", "-100"); im.setAttribute("y", "-100");
    im.setAttribute("width", "200"); im.setAttribute("height", "200"); im.setAttribute("preserveAspectRatio", "xMidYMid slice");
    if (real) {
      var defs = svg.querySelector("defs"), m = document.createElementNS(NS, "mask"), mi = document.createElementNS(NS, "image");
      m.setAttribute("id", "lhphase"); m.setAttribute("maskUnits", "userSpaceOnUse"); m.setAttribute("x", "-100"); m.setAttribute("y", "-100"); m.setAttribute("width", "200"); m.setAttribute("height", "200");
      mi.setAttribute("x", "-100"); mi.setAttribute("y", "-100"); mi.setAttribute("width", "200"); mi.setAttribute("height", "200"); m.appendChild(mi); defs.appendChild(m);
      im.setAttribute("mask", "url(#lhphase)"); svg.setAttribute("data-moonreal", "");
      var cur = -1, set = function () { var R = window.RealMoon; if (!R || typeof R.phase !== "number") return;
        var i = Math.round(R.phase * 30) % 30, k = mk(i); if (i === cur || !k) return; cur = i; mi.setAttribute("href", A.base + k); svg.setAttribute("data-moonmask", String(i)); };
      set(); addEventListener("realmoon:update", set);
    } else im.setAttribute("clip-path", "url(#lit)");
    svg.insertBefore(im, et); svg.setAttribute("data-moonface", "");
  }
  function go() { var A = window.WGArt; if (!A) return; mattes(A); moon(A); }
  if (window.WGArt) go(); else addEventListener("wg:caps", go, { once: true });
})();
