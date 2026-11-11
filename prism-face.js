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
    else if (/empty/.test(k)) body = '<path d="M7 12 h18 v12 H7 z"/><path d="M7 12 L5 7 h22 l-2 5"/><path d="M10 16 h12 M10 19 h12"/>';
    else if (/dish/.test(k)) body = '<path d="M6 7 v12 M4 7 h4 M6 10 H4 M6 13 H4"/><ellipse cx="19" cy="16" rx="8" ry="3.5"/><path d="M11 16 c2 6 14 6 16 0"/>';
    else if (/trash/.test(k)) body = '<path d="M8 10 H24"/><path d="M12 10 V7 H20 V10"/><path d="M10 12 L12 26 H20 L22 12"/>';
    else if (/shower/.test(k)) body = '<circle cx="11" cy="7" r="3"/><path d="M11 10 v2"/><path d="M7 13 h16"/><path d="M10 17 v5 M14 17 v6 M18 17 v5 M22 17 v4"/>';
    else if (/bath/.test(k)) body = '<path d="M5 16 h22 v3 a7 7 0 0 1-7 7 H12 a7 7 0 0 1-7-7 z"/>';
    else if (/shoe|living/.test(k)) body = '<path d="M5 21 C8 11 14 12 16 15 C20 10 27 14 27 21 Z"/>';
    else if (/laundry/.test(k)) body = '<path d="M9 7 h14 l2 18 H7 Z"/><circle cx="16" cy="17" r="4"/>';
    else if (/toy/.test(k)) body = '<circle cx="16" cy="11" r="4"/><path d="M10 15 h12 v8 H10 z"/><path d="M10 17 H7 M22 17 h3"/>';
    else if (/room/.test(k)) body = '<path d="M5 15 L16 6 L27 15 V26 H5 Z"/><path d="M13 26 v-7 h6 v7"/>';
    else if (/postgame/.test(k)) body = '<circle cx="16" cy="16" r="8"/><path d="M16 8 c2 5 2 11 0 16 M8 16 c5-2 11-2 16 0 M10 11 c4 2 8 2 12 0 M10 21 c4-2 8-2 12 0"/>';
    return '<svg viewBox="0 0 32 32" width="64" height="64" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round">' + body + "</svg>";
  }
  function paintJar() {
    var host = document.querySelector("#sec-jar");
    if (!host) return;
    var kid = (document.body && document.body.getAttribute("data-kid")) || "hayes";
    var color = kid === "ainsley" ? "#8a6394" : kid === "harris" ? "#42679a" : "#3f8b71";
    var real = 0;
    try {
      if (global.JarEngine && JarEngine.choreState) {
        var st = JarEngine.choreState(kid);
        var n = st && (st.todayDone != null ? st.todayDone : (st.shown != null ? st.shown : st.fill));
        if (typeof n === "number" && isFinite(n)) real = n;
      }
    } catch (eJ) { /* an empty jar still draws */ }
    var empty = !(real > 0);
    var fill = empty ? 0 : Math.max(0.12, Math.min(1, real > 1 ? real / 8 : real));
    var el = host.querySelector(".prism-jar");
    if (!el) {
      el = document.createElement("div");
      el.className = "prism-jar";
      host.appendChild(el);
    }
    var empty = !(fill > 0);
    var f = empty ? 0 : Math.max(0.12, Math.min(1, fill));
    var top = empty ? 176 : Math.round(168 - 118 * f);
    var stones = [[48, 168, 18], [78, 172, 20], [108, 166, 17], [64, 146, 16], [96, 150, 18], [78, 128, 15], [108, 130, 14], [58, 112, 13]];
    var dots = stones.map(function (s, i) {
      return '<ellipse cx="' + s[0] + '" cy="' + s[1] + '" rx="' + s[2] + '" ry="' + Math.round(s[2] * 0.78) + '" fill="' + color + '" opacity="' + (0.62 + (i % 3) * 0.12) + '"/>';
    }).join("");
    el.innerHTML = '<svg class="prism-jar-svg" viewBox="0 0 160 200" aria-hidden="true"><defs><clipPath id="prism-jar-clip"><rect x="34" y="' + top + '" width="92" height="' + (176 - top) + '"/></clipPath></defs>' +
      '<path d="M58 16 h44 v18 c16 8 26 24 26 42 v70 c0 20 -18 32 -48 32 s-48 -12 -48 -32 v-70 c0 -18 10 -34 26 -42 v-18 z" fill="rgba(15,26,34,0.35)" stroke="#f4efe6" stroke-width="3"/>' +
      '<path d="M62 16 h36" stroke="#f4efe6" stroke-width="3"/>' +
      '<g clip-path="url(#prism-jar-clip)">' + dots + "</g></svg>" +
      '<span class="prism-jar-label">Jar</span><span class="prism-jar-count">' + (empty ? 0 : stones.filter(function (s) { return s[1] >= top; }).length) + '</span><button type="button" class="prism-jar-plus" aria-label="Add">+</button>';
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
      deck.classList.toggle("cams-resting", !!(resting && wall));
      if (resting) {
        var labels = deck.querySelectorAll(".hub-cam-label");
        for (var li = 0; li < labels.length; li++) {
          var label = labels[li];
          var text = String(label.textContent || "").replace(/\s+/g, " ").trim();
          if (/pair/i.test(text)) continue;
          if (li === 0) { if (text !== "Cameras resting") label.textContent = "Cameras resting"; continue; }
          if (!/resting/i.test(text)) label.textContent = text + " \u00b7 resting";
        }
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
      hud.style.setProperty("display", "grid", "important");
      hud.style.setProperty("width", "1824px", "important");
      hud.style.setProperty("left", "48px", "important");
      hud.style.setProperty("top", "48px", "important");
      hud.style.setProperty("position", "fixed", "important");
      hud.style.setProperty("z-index", "40", "important");
    }
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
      "sheet-weekend": "<circle cx='16' cy='7' r='3'/><path d='M16 2v1.2M11.2 7H9.6M12.2 3.4l.9.9M19.8 3.4l-.9.9M20.8 7H22.4'/><path d='M8 27V17l8-6 8 6v10'/><path d='M14 27v-6h4v6'/>",
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
    if (document.body && document.body.classList.contains("allow-shell")) {
      var allowBody = document.querySelector(".panel > .body");
      if (allowBody) {
        allowBody.style.setProperty("padding-left", "40px", "important");
        allowBody.style.setProperty("padding-right", "48px", "important");
        allowBody.style.setProperty("box-sizing", "border-box", "important");
      }
    }
    var rail = document.querySelector("nav.family-rail");
    if (rail) rail.style.setProperty("margin-left", "40px", "important");
    var lightsTitle = document.querySelector(".hub-lights-title");
    var lightsBulk = document.querySelector(".hub-lights-bulk");
    if (lightsTitle && lightsBulk && lightsTitle.parentNode !== lightsBulk) lightsBulk.insertBefore(lightsTitle, lightsBulk.firstChild);
    else if (lightsTitle && lightsTitle.parentNode) lightsTitle.parentNode.insertBefore(lightsTitle, lightsTitle.parentNode.firstChild);
    document.body.style.setProperty("background-size", "auto", "important");
    var stageNode = document.querySelector(".wardos-stage") || document.body;
    document.querySelectorAll(".kw-clock, .live-clock, .hdr-date-time").forEach(function (el) {
      if (el.parentNode !== stageNode) stageNode.appendChild(el);
      el.style.setProperty("position", "absolute", "important");
      el.style.setProperty("top", "64px", "important");
      el.style.setProperty("left", "1500px", "important");
      el.style.setProperty("right", "auto", "important");
      el.style.setProperty("width", "260px", "important");
      el.style.setProperty("min-width", "260px", "important");
      el.style.setProperty("max-width", "260px", "important");
      el.style.setProperty("height", "64px", "important");
      el.style.setProperty("min-height", "64px", "important");
      el.style.setProperty("max-height", "64px", "important");
      el.style.setProperty("margin", "0", "important");
      el.style.setProperty("border", "2px solid #c4b49a", "important");
      el.style.setProperty("box-shadow", "none", "important");
      el.style.setProperty("z-index", "45", "important");
    });
    var tileInk = { ainsley: "#8a6394", hayes: "#3f8b71", harris: "#42679a", dan: "#c4b49a" };
    Object.keys(tileInk).forEach(function (kid) {
      document.querySelectorAll(".tile." + kid).forEach(function (tile) {
        tile.style.setProperty("border", "2px solid " + tileInk[kid], "important");
        tile.style.setProperty("box-shadow", "none", "important");
        tile.style.setProperty("outline", "none", "important");
      });
    });
    document.querySelectorAll(".roster-plate.roster-empty").forEach(function (plate) {
      plate.style.setProperty("height", "32px", "important");
      plate.style.setProperty("min-height", "32px", "important");
      plate.style.setProperty("max-height", "32px", "important");
      plate.style.setProperty("left", "0", "important");
      plate.style.setProperty("right", "0", "important");
      plate.style.setProperty("width", "100%", "important");
      plate.style.setProperty("bottom", "0", "important");
      plate.style.setProperty("box-shadow", "none", "important");
    });
    document.querySelectorAll(".roster-plate:not(.roster-empty)").forEach(function (plate) {
      plate.style.setProperty("height", "140px", "important");
      plate.style.setProperty("max-height", "140px", "important");
      plate.style.setProperty("left", "0", "important");
      plate.style.setProperty("right", "0", "important");
      plate.style.setProperty("width", "100%", "important");
      plate.style.setProperty("bottom", "0", "important");
      plate.style.setProperty("box-shadow", "none", "important");
    });
    var panel = document.querySelector(".panel");
    if (panel) panel.style.setProperty("box-shadow", "none", "important");
    function stripGoldFrame() {
      document.querySelectorAll("svg, svg *").forEach(function (el) {
        var r = el.getBoundingClientRect ? el.getBoundingClientRect() : null;
        if (r && r.width > 800) el.style.setProperty("filter", "none", "important");
      });
      var frame = document.querySelector(".panel");
      if (frame) frame.style.setProperty("box-shadow", "none", "important");
    }
    stripGoldFrame();
    setTimeout(stripGoldFrame, 600);
    setTimeout(stripGoldFrame, 1400);
    var r16 = document.getElementById("acer-r16");
    if (!r16) {
      r16 = document.createElement("style");
      r16.id = "acer-r16";
      document.body.appendChild(r16);
    }
    r16.textContent = [
      "html body .hdr-date-time, html body .live-clock, html body .kw-clock, html body [data-kw-clock], html body [data-live-clock] {",
      "position:fixed !important; top:64px !important; left:1500px !important; right:auto !important;",
      "width:260px !important; min-width:260px !important; max-width:260px !important;",
      "height:64px !important; min-height:64px !important; max-height:64px !important;",
      "padding:0 16px !important; box-sizing:border-box !important; display:inline-flex !important;",
      "align-items:center !important; justify-content:center !important;",
      "font-size:32px !important; line-height:1 !important; font-weight:700 !important; letter-spacing:0 !important;",
      "border:2px solid #c4b49a !important; border-radius:16px !important;",
      "background:#101820 !important; color:#f4efe6 !important; -webkit-text-fill-color:#f4efe6 !important;",
      "box-shadow:none !important; text-shadow:none !important; z-index:45 !important; overflow:hidden !important;",
      "}",
      "html body .live-clock-host, html body header .hdr-date, html body .panel > header.hdr { overflow:visible !important; }",
      "html body .panel.panel > header.hdr .hdr-ovals { margin-right:400px !important; }",
      "html body .panel.panel, html body .wardos-stage > .panel { box-shadow:none !important; border-top-width:0 !important; }",
      "html body .tile.ainsley { border:2px solid #8a6394 !important; box-shadow:none !important; }",
      "html body .tile.hayes { border:2px solid #3f8b71 !important; box-shadow:none !important; }",
      "html body .tile.harris { border:2px solid #42679a !important; box-shadow:none !important; }",
      "html body .tile.dan { border:2px solid #c4b49a !important; box-shadow:none !important; }",
      "html body .roster-plate { left:0 !important; right:0 !important; width:100% !important; bottom:0 !important; height:140px !important; max-height:140px !important; margin:0 !important; box-shadow:none !important; }",
      "html body .roster-plate.roster-empty { height:32px !important; min-height:32px !important; max-height:32px !important; padding:0 16px !important; background:transparent !important; }",
      "html body .roster-plate.roster-empty .roster-title { height:32px !important; line-height:32px !important; font-size:24px !important; padding:0 14px !important; }",
      "html body .chore .day-tap.is-past { opacity:0.45 !important; text-decoration:line-through !important; }",
      "html body .chore .day-tap.is-off:not(.done) { opacity:1 !important; text-decoration:none !important; background:transparent !important; border:2px solid rgba(196,180,154,0.75) !important; color:#f4efe6 !important; }",
      "html body section.col:not([data-show-all]) .chore-list > .chore:nth-child(n+5) { display:none !important; }",
      "html body section.col .chore { height:auto !important; min-height:0 !important; max-height:none !important; overflow:visible !important; }",
      "html body section.col .chore-list { overflow:visible !important; }",
      "html body .panel > section.cheer, html body .cheer { left:480px !important; width:980px !important; right:auto !important; }"
    ].join("");
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
  setTimeout(run, 2200);
})(typeof window !== "undefined" ? window : globalThis);
