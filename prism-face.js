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
    Array.prototype.forEach.call(list.children, function (row) {
      if (row.classList && row.classList.contains("chore")) row.style.removeProperty("display");
    });
  }
  function choreSvg(id) {
    var k = String(id || "");
    var body = '<rect x="8" y="8" width="16" height="16" rx="2"/>';
    if (/bed/.test(k)) body = '<path d="M5 22 V13 H10 V8 H22 V13 H27 V22"/><path d="M5 17 H27"/>';
    else if (/backpack|cubby/.test(k)) body = '<path d="M12 11 V8 a4 4 0 0 1 8 0 v3"/><path d="M8 12 h16 v13 a2 2 0 0 1-2 2 H10 a2 2 0 0 1-2-2 z"/><path d="M8 18 h16"/><path d="M14 12 v5 h4 v-5"/>';
    else if (/empty/.test(k)) body = '<rect x="7" y="7" width="18" height="18" rx="2"/><path d="M7 14 h18"/><circle cx="16" cy="19" r="2.2"/>';
    else if (/dish/.test(k)) body = '<ellipse cx="16" cy="17" rx="10" ry="4"/><path d="M7 17 c2 7 16 7 18 0"/>';
    else if (/trash/.test(k)) body = '<path d="M8 10 H24"/><path d="M12 10 V7 H20 V10"/><path d="M10 12 L12 26 H20 L22 12"/>';
    else if (/shower/.test(k)) body = '<path d="M8 7 h14"/><path d="M15 7 v5"/><path d="M10 14 c0 7 12 7 12 0"/>';
    else if (/bath/.test(k)) body = '<path d="M5 16 h22 v3 a7 7 0 0 1-7 7 H12 a7 7 0 0 1-7-7 z"/>';
    else if (/shoe|living/.test(k)) body = '<path d="M5 21 C8 11 14 12 16 15 C20 10 27 14 27 21 Z"/>';
    else if (/laundry/.test(k)) body = '<path d="M9 7 h14 l2 18 H7 Z"/><circle cx="16" cy="17" r="4"/>';
    else if (/toy/.test(k)) body = '<circle cx="16" cy="11" r="4"/><path d="M10 15 h12 v8 H10 z"/><path d="M10 17 H7 M22 17 h3"/>';
    else if (/room/.test(k)) body = '<path d="M5 15 L16 6 L27 15 V26 H5 Z"/><path d="M13 26 v-7 h6 v7"/>';
    else if (/postgame/.test(k)) body = '<circle cx="16" cy="16" r="8"/><path d="M16 8 V24 M8 16 H24"/>';
    return '<svg viewBox="0 0 32 32" width="48" height="48" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round">' + body + "</svg>";
  }
  function paintJar() {
    var host = document.querySelector("#sec-jar");
    if (!host) return;
    var kid = (document.body && document.body.getAttribute("data-kid")) || "hayes";
    var color = kid === "ainsley" ? "#8a6394" : kid === "harris" ? "#42679a" : "#3f8b71";
    var fill = 0.55;
    try {
      if (global.JarEngine && JarEngine.choreState) {
        var st = JarEngine.choreState(kid);
        var n = st && (st.shown != null ? st.shown : st.fill);
        if (typeof n === "number" && isFinite(n)) fill = Math.max(0.55, Math.min(1, n));
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
    var stones = [[48, 168, 18], [78, 172, 20], [108, 166, 17], [64, 146, 16], [96, 150, 18], [78, 128, 15], [108, 130, 14], [58, 112, 13]];
    var dots = stones.map(function (s, i) {
      return '<ellipse cx="' + s[0] + '" cy="' + s[1] + '" rx="' + s[2] + '" ry="' + Math.round(s[2] * 0.78) + '" fill="' + color + '" opacity="' + (0.62 + (i % 3) * 0.12) + '"/>';
    }).join("");
    el.innerHTML = '<svg class="prism-jar-svg" viewBox="0 0 160 200" aria-hidden="true"><defs><clipPath id="prism-jar-clip"><rect x="34" y="' + top + '" width="92" height="' + (176 - top) + '"/></clipPath></defs>' +
      '<path d="M58 16 h44 v18 c16 8 26 24 26 42 v70 c0 20 -18 32 -48 32 s-48 -12 -48 -32 v-70 c0 -18 10 -34 26 -42 v-18 z" fill="rgba(15,26,34,0.35)" stroke="#f4efe6" stroke-width="3"/>' +
      '<path d="M62 16 h36" stroke="#f4efe6" stroke-width="3"/>' +
      '<g clip-path="url(#prism-jar-clip)">' + dots + "</g></svg>" +
      '<span class="prism-jar-label">Jar</span><span class="prism-jar-count">' + stones.filter(function (s) { return s[1] >= top; }).length + '</span><button type="button" class="prism-jar-plus" aria-label="Add">+</button>';
    var plus = el.querySelector(".prism-jar-plus");
    if (plus) plus.onclick = function () {
      var old = host.querySelector(".saves-plus");
      if (old) old.click();
    };
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
    var kidColor = { ainsley: "#8a6394", hayes: "#3f8b71", harris: "#42679a" };
    var kidNow = document.body && document.body.getAttribute("data-kid");
    document.querySelectorAll(".kw-name, .col-name, .roster-full, .tile-label").forEach(function (el) {
      var next = titleCase(el.textContent);
      if (next && next !== el.textContent) el.textContent = next;
      var key = kidNow || (el.closest && el.closest(".ainsley, .hayes, .harris, .tile") && (el.closest(".ainsley") ? "ainsley" : el.closest(".hayes") ? "hayes" : el.closest(".harris") ? "harris" : ""));
      var bg = kidColor[key];
      if (!bg && el.classList.contains("col-name")) {
        var label = (el.closest("section") && el.closest("section").getAttribute("aria-label")) || "";
        if (/ainsley/i.test(label)) bg = kidColor.ainsley;
        else if (/hayes/i.test(label)) bg = kidColor.hayes;
        else if (/harris/i.test(label)) bg = kidColor.harris;
      }
      if (bg) {
        el.style.setProperty("background", bg, "important");
        el.style.setProperty("color", "#fff", "important");
        el.style.setProperty("-webkit-text-fill-color", "#fff", "important");
        el.style.setProperty("padding", "4px 14px", "important");
        el.style.setProperty("border-radius", "14px", "important");
      }
    });
    var hud = document.querySelector(".kw-hud");
    if (hud) {
      hud.style.setProperty("display", "flex", "important");
      hud.style.setProperty("align-items", "center", "important");
      hud.style.setProperty("width", "880px", "important");
      hud.style.setProperty("z-index", "40", "important");
      hud.style.setProperty("position", "absolute", "important");
    }
    var clock = document.querySelector(".kw-clock");
    if (clock) clock.style.setProperty("margin-left", "auto", "important");
    document.querySelectorAll(".kw-clock, .live-clock, .consume-hero-when, .roster-time, .hub-next-time").forEach(function (el) {
      var next = clockFace(el.textContent);
      if (next !== el.textContent) el.textContent = next;
    });
    paintJar();
    var NAV = {
      "sheet-today": "<circle cx='16' cy='16' r='5'/><path d='M16 4v3M16 25v3M4 16h3M25 16h3M7.5 7.5l2 2M22.5 22.5l2 2M24.5 7.5l-2 2M9.5 22.5l-2 2'/>",
      "month.html": "<rect x='6' y='7' width='20' height='18' rx='2'/><path d='M6 13h20M11 5v4M21 5v4'/>",
      "sheet-lights": "<path d='M12 22h8M13 26h6'/><path d='M16 5a7 7 0 0 1 4 12c-1 1-1.5 2-1.5 4h-5c0-2-.5-3-1.5-4A7 7 0 0 1 16 5z'/>",
      "sheet-google-home": "<path d='M7 12h4l2-3h6l2 3h4v12H7z'/><circle cx='16' cy='18' r='3'/>",
      "sheet-chores": "<path d='M13 8h12M13 16h12M13 24h12'/><path d='M5 8l2 2 4-4M5 16l2 2 4-4M5 24l2 2 4-4'/>",
      "sheet-groceries": "<path d='M6 8h4l2 12h12l2-8H11'/><circle cx='13' cy='24' r='1.6'/><circle cx='22' cy='24' r='1.6'/>",
      "sheet-weekend": "<circle cx='9' cy='9' r='3'/><path d='M9 4v2M4 9h2'/><path d='M22 27V15'/><path d='M16 27h12'/><path d='M17 20c2-6 8-6 10 0'/>",
      "sheet-win": "<rect x='7' y='11' width='18' height='14' rx='2'/><path d='M12 11V8h8v3M12 18h8'/>"
    };
    document.querySelectorAll(".hub-launch a").forEach(function (a) {
      if (a.querySelector(".hub-ico")) return;
      var href = a.getAttribute("href") || "";
      var body = "";
      Object.keys(NAV).forEach(function (key) { if (!body && href.indexOf(key) >= 0) body = NAV[key]; });
      if (!body) return;
      var ink = href.indexOf("sheet-chores") >= 0 ? "#d7f3e8" : "#f4efe6";
      var svg = document.createElement("span");
      svg.className = "hub-ico";
      svg.setAttribute("aria-hidden", "true");
      svg.innerHTML = "<svg viewBox='0 0 32 32' width='48' height='48' fill='none' stroke='" + ink + "' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'>" + body + "</svg>";
      a.insertBefore(svg, a.firstChild);
    });
    document.querySelectorAll("section.col .chore[data-check]").forEach(function (row) {
      if (row.querySelector(".chore-ico")) return;
      var ico = document.createElement("span");
      ico.className = "chore-ico";
      ico.setAttribute("aria-hidden", "true");
      ico.innerHTML = choreSvg(row.getAttribute("data-check"));
      row.insertBefore(ico, row.firstChild);
    });
    var lightsTitle = document.querySelector(".hub-lights-title");
    var lightsBulk = document.querySelector(".hub-lights-bulk");
    if (lightsTitle && lightsBulk && lightsTitle.parentNode !== lightsBulk) lightsBulk.insertBefore(lightsTitle, lightsBulk.firstChild);
    else if (lightsTitle && lightsTitle.parentNode) lightsTitle.parentNode.insertBefore(lightsTitle, lightsTitle.parentNode.firstChild);
    document.documentElement.style.setProperty("background-image", "url(\"month-theme/november/wall-dusk.webp\")", "important");
    document.documentElement.style.setProperty("background-size", "cover", "important");
    document.documentElement.style.setProperty("background-position", "center", "important");
    document.documentElement.style.setProperty("background-repeat", "no-repeat", "important");
    document.body.style.setProperty("background", "transparent", "important");
    document.querySelectorAll(".more-chip").forEach(function (chip) {
      if (chip.getAttribute("data-wired") === "1") return;
      chip.setAttribute("data-wired", "1");
      chip.addEventListener("click", function () {
        var col = chip.closest("section") || chip.parentElement;
        if (col) col.setAttribute("data-show-all", "1");
        if (col) col.querySelectorAll(".chore").forEach(function (card) { card.style.removeProperty("display"); });
        chip.remove();
      });
    });
    if (!document.documentElement.getAttribute("data-prism-nav")) {
      document.documentElement.setAttribute("data-prism-nav", "1");
      document.addEventListener("click", function (ev) {
        var a = ev.target && ev.target.closest && ev.target.closest("a.tile[href]");
        if (!a) return;
        var href = a.getAttribute("href");
        if (!href || href.charAt(0) === "#") return;
        ev.preventDefault();
        window.location.assign(href);
      }, true);
    }
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
