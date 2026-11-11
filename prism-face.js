/* Prism · behaviors the shared stylesheet cannot do alone. */
(function (global) {
  "use strict";
  function titleCase(s) {
    s = String(s || "").trim().toLowerCase();
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  }
  function clockFace(s) {
    return String(s || "").replace(/\b(\d{1,2}:\d{2})\s*([ap])\.?m\.?\b/ig, function (_, hm, ap) {
      return hm + " " + ap.toUpperCase() + "M";
    });
  }
  function snapMusts() {
    var list = document.querySelector("#sec-musts .chore-list, #sec-musts [data-mount-quests]");
    if (!list) return;
    var rows = Array.prototype.filter.call(list.children, function (el) { return el.classList && el.classList.contains("chore"); });
    var n = Math.max(1, Math.floor(list.clientHeight / 128));
    rows.forEach(function (row, i) {
      if (i >= n) row.style.setProperty("display", "none", "important");
      else row.style.removeProperty("display");
    });
  }
  function paintJar() {
    var host = document.querySelector("#sec-jar");
    if (!host) return;
    var kid = (document.body && document.body.getAttribute("data-kid")) || "hayes";
    var color = kid === "ainsley" ? "#8a6394" : kid === "harris" ? "#42679a" : "#3f8b71";
    var fill = 0.42;
    try {
      if (global.JarEngine && JarEngine.choreState) {
        var st = JarEngine.choreState(kid);
        var n = st && (st.shown != null ? st.shown : st.fill);
        if (typeof n === "number" && isFinite(n)) fill = Math.max(0.12, Math.min(1, n));
      }
    } catch (eJ) { /* a visible fill still draws */ }
    var el = host.querySelector(".prism-jar");
    if (!el) {
      el = document.createElement("div");
      el.className = "prism-jar";
      host.appendChild(el);
    }
    var f = Math.max(0.12, Math.min(1, fill));
    var top = Math.round(168 - 118 * f);
    var stones = [[46, 156, 14], [72, 162, 16], [100, 154, 13], [118, 164, 12], [58, 136, 13], [86, 140, 15], [112, 132, 12], [70, 116, 11]];
    var dots = stones.map(function (s, i) {
      return '<ellipse cx="' + s[0] + '" cy="' + s[1] + '" rx="' + s[2] + '" ry="' + Math.round(s[2] * 0.78) + '" fill="' + color + '" opacity="' + (0.62 + (i % 3) * 0.12) + '"/>';
    }).join("");
    el.innerHTML = '<svg class="prism-jar-svg" viewBox="0 0 160 200" aria-hidden="true"><defs><clipPath id="prism-jar-clip"><rect x="34" y="' + top + '" width="92" height="' + (176 - top) + '"/></clipPath></defs>' +
      '<path d="M58 16 h44 v18 c16 8 26 24 26 42 v70 c0 20 -18 32 -48 32 s-48 -12 -48 -32 v-70 c0 -18 10 -34 26 -42 v-18 z" fill="rgba(15,26,34,0.35)" stroke="#f4efe6" stroke-width="3"/>' +
      '<path d="M62 16 h36" stroke="#f4efe6" stroke-width="3"/>' +
      '<g clip-path="url(#prism-jar-clip)">' + dots + "</g></svg>" +
      '<span class="prism-jar-label">Jar</span>';
  }
  function run() {
    snapMusts();
    var deck = document.getElementById("hub-cam-deck");
    if (deck) {
      var cams = deck.querySelectorAll(".hub-cam");
      var resting = cams.length > 0 && Array.prototype.every.call(cams, function (cam) {
        return /rest|unavailable/i.test((cam.className || "") + " " + (cam.textContent || ""));
      });
      var wall = (global.innerWidth || 0) >= 1400 && (global.innerHeight || 0) >= 700;
      deck.classList.toggle("cams-resting", resting && wall);
      if (resting) {
        var label = deck.querySelector(".hub-cam-label");
        if (label) label.textContent = "Cameras resting";
      }
    }
    document.querySelectorAll(".kw-name, .col-name, .roster-full, .tile-label").forEach(function (el) {
      var next = titleCase(el.textContent);
      if (next && next !== el.textContent) el.textContent = next;
    });
    document.querySelectorAll(".kw-clock, .live-clock, .consume-hero-when, .roster-time, .hub-next-time").forEach(function (el) {
      var next = clockFace(el.textContent);
      if (next !== el.textContent) el.textContent = next;
    });
    paintJar();
    var cheer = document.querySelector(".cheer-title");
    if (cheer && /vibe|dad checks|3 kids|on this screen/i.test(document.body.innerText || "")) {
      cheer.textContent = "Tap your day when it's done";
    }
    document.querySelectorAll(".cheer-badge, .cheer-label").forEach(function (el) { el.hidden = true; });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
  else run();
  document.addEventListener("house:kids-data-ready", run);
  setTimeout(run, 400);
  setTimeout(run, 1200);
})(typeof window !== "undefined" ? window : globalThis);
