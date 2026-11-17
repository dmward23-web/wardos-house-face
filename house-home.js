/* R58 · one home control on every board. 96 px, above the iris, pointerup, idle return. */
(function (g) {
  "use strict";
  var HUB = "sheet-index.html";
  var IDLE_MS = 120000;
  function file() {
    try { return String(g.location.pathname || "").split("/").pop() || ""; } catch (e) { return ""; }
  }
  function onHub() { return /sheet-index\.html$/i.test(file()); }
  function href() {
    try { if (g.HouseAudit && g.HouseAudit.href) return g.HouseAudit.href(HUB); } catch (e) {}
    return HUB;
  }
  function go(ev) {
    if (ev) { ev.preventDefault(); ev.stopPropagation(); }
    try { g.location.assign(href()); } catch (e) { g.location.href = href(); }
  }
  function paint(btn) {
    btn.classList.add("wardos-home");
    btn.setAttribute("data-kw-home", "");
    if (!btn.getAttribute("aria-label")) btn.setAttribute("aria-label", "Home");
    btn.setAttribute("href", href());
    btn.setAttribute("draggable", "false");
    var box = {
      position: "fixed", left: "48px", top: "48px", width: "96px", height: "96px",
      "min-width": "96px", "min-height": "96px", "max-width": "96px", "max-height": "96px",
      "z-index": "2147483646", display: "flex", "align-items": "center", "justify-content": "center",
      "touch-action": "manipulation", "-webkit-touch-callout": "none", "user-select": "none",
      "pointer-events": "auto", margin: "0", padding: "0"
    };
    Object.keys(box).forEach(function (k) { btn.style.setProperty(k, box[k], "important"); });
    var img = btn.querySelector("img");
    if (!img) {
      img = document.createElement("img");
      img.alt = "";
      img.src = "assets/icons/home-key-light.svg";
      btn.appendChild(img);
    }
    img.setAttribute("draggable", "false");
    img.alt = "";
    img.style.setProperty("pointer-events", "none", "important");
    img.style.setProperty("width", "64px", "important");
    img.style.setProperty("height", "64px", "important");
    if (btn.getAttribute("data-home-armed") === "1") return;
    btn.setAttribute("data-home-armed", "1");
    btn.addEventListener("pointerup", function (ev) {
      if (ev.button > 0) return;
      go(ev);
    });
    btn.addEventListener("contextmenu", function (ev) { ev.preventDefault(); });
    btn.addEventListener("click", function (ev) { ev.preventDefault(); });
  }
  function mount() {
    if (onHub()) {
      document.querySelectorAll(".wardos-home, .hub-home").forEach(function (el) {
        el.setAttribute("hidden", "");
        el.style.setProperty("display", "none", "important");
      });
      var clock = document.querySelector("[data-live-clock], .live-clock");
      if (clock && clock.getAttribute("data-home-clock") !== "1") {
        clock.setAttribute("data-home-clock", "1");
        clock.style.cursor = "pointer";
        clock.addEventListener("pointerup", function () {
          try { g.location.assign("sheet-today.html"); } catch (e) { g.location.href = "sheet-today.html"; }
        });
      }
      return;
    }
    var all = document.querySelectorAll("a.wardos-home, a.kw-home, a.hub-home");
    var btn = all[0];
    if (!btn) {
      btn = document.createElement("a");
      btn.className = "wardos-home";
    }
    for (var i = 0; i < all.length; i++) {
      if (all[i] !== btn && all[i].parentNode) all[i].parentNode.removeChild(all[i]);
    }
    if (document.body && btn.parentNode !== document.body) document.body.appendChild(btn);
    paint(btn);
  }
  var timer = 0;
  function paused() {
    var el = document.activeElement;
    if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return true;
    if (document.documentElement.getAttribute("data-no-idle") === "1") return true;
    return false;
  }
  function kick() {
    if (timer) clearTimeout(timer);
    if (onHub() || paused()) return;
    timer = setTimeout(function () {
      if (onHub() || paused()) return;
      try { g.location.replace(href()); } catch (e) { g.location.href = href(); }
    }, IDLE_MS);
  }
  document.addEventListener("contextmenu", function (ev) {
    var t = ev.target && ev.target.closest && ev.target.closest(".wardos-home, .kw-home, .hub-home");
    if (t) ev.preventDefault();
  }, true);
  ["pointerdown", "keydown", "wheel"].forEach(function (type) {
    document.addEventListener(type, kick, { capture: true, passive: true });
  });
  function wallCss() {
    if (document.getElementById("r58-wall")) return;
    var s = document.createElement("style");
    s.id = "r58-wall";
    s.textContent = [
      "html body .tab{min-height:64px!important;color:#f4efe6!important;background:transparent!important;border:2px solid #f4efe6!important}",
      "html body .tab.on{background:#101820!important;color:#f4efe6!important}",
      "html body .beat .pill{color:#062018!important;background:#f4efe6!important}",
      "html:not(#hf-wall-off) body .cam-grid{grid-template-columns:1fr 1fr!important;grid-template-rows:1fr 1fr!important}",
      "html:not(#hf-wall-off) body .cam-tile,html:not(#hf-wall-off) body .climate-hero,html:not(#hf-wall-off) body .cmd-panel{background:#101820!important;opacity:1!important}",
      "html:not(#hf-wall-off) body .panel.lights-cmd{min-height:600px!important;background:#101820!important}",
      "html:not(#hf-wall-off) body .panel.lights-cmd .pad-grid,html:not(#hf-wall-off) body .panel.lights-cmd .light-pad,html:not(#hf-wall-off) body .panel.lights-cmd .cmd-panel{width:100%!important;min-height:96px!important}",
      "html:not(#hf-wall-off) body .panel.lights-cmd .cmd-rocker{width:96px!important;min-width:96px!important;max-width:96px!important;height:96px!important;min-height:96px!important;max-height:96px!important}",
      "html:not(#hf-wall-off) body .panel.lights-cmd .cmd-chip{min-width:96px!important;min-height:64px!important}",
      "html body .panel.weekend-cmd h1.name{margin-left:160px!important}",
      "html body .panel.weekend-cmd .name-accent{background:#101820!important;color:#f4efe6!important;-webkit-text-fill-color:#f4efe6!important;padding:8px 16px!important;border-radius:12px!important}",
      "html body .chore.done{opacity:.45!important;animation:r58done 280ms ease}",
      "html body .chore.done .ring{width:48px!important;height:48px!important;min-width:48px!important;min-height:48px!important;border-radius:50%!important;background:#3f8b71!important;display:flex!important;align-items:center!important;justify-content:center!important}",
      "html body .chore.done .ring::after{content:'\\2713';color:#fff!important;font-size:28px!important}",
      "@keyframes r58done{50%{transform:scale(1.04)}}",
      "html[data-wall-page=sheet-status] body,html[data-wall-page=sheet-status] .row,html[data-wall-page=sheet-status] td,html[data-wall-page=sheet-status] .card{background:#101820!important;color:#f4efe6!important}",
      "html body .pick,html body .treat{outline:none!important;box-shadow:none!important;border:none!important}",
      "html[data-wall-page=sheet-groceries] .body{max-height:900px!important;overflow:auto!important}",
      "html body .mbtn{min-width:64px!important;min-height:64px!important;font-size:32px!important}",
      "html[data-wardos-stage] .live-clock-host{position:fixed!important;right:64px!important;top:48px!important;left:auto!important;width:auto!important;max-width:420px!important;overflow:visible!important;z-index:40!important}",
      "html[data-wardos-stage] .live-clock,html[data-wardos-stage] .board-clock{font-size:32px!important;line-height:64px!important;height:64px!important;color:#f4efe6!important;-webkit-text-fill-color:#f4efe6!important;background:#101820!important;padding:0 16px!important;border-radius:16px!important;text-shadow:none!important}",
      "html[data-wardos-stage] .ftr-chip,html[data-wardos-stage] .cheer-badge{pointer-events:none!important}",
      "html.ori-nogl,html.ori-nogl body{background-color:#101820!important;background-image:url('month-theme/november/wall-day.webp')!important;background-size:cover!important;background-position:center!important}"
    ].join("");
    document.head.appendChild(s);
  }
  function parkClock() {
    if (onHub() || /sheet-weekend\.html$/i.test(file())) return;
    document.querySelectorAll(".live-clock-host").forEach(function (host) {
      if (document.body && host.parentNode !== document.body) document.body.appendChild(host);
      ["position", "fixed", "right", "64px", "top", "48px", "left", "auto", "width", "auto", "max-width", "420px", "z-index", "40"].forEach(function (v, i, a) {
        if (i % 2 === 0) host.style.setProperty(a[i], a[i + 1], "important");
      });
    });
    document.querySelectorAll(".live-clock, .board-clock").forEach(function (el) {
      el.style.setProperty("font-size", "32px", "important");
      el.style.setProperty("line-height", "64px", "important");
      el.style.setProperty("height", "64px", "important");
      el.style.setProperty("color", "#f4efe6", "important");
      el.style.setProperty("-webkit-text-fill-color", "#f4efe6", "important");
      el.style.setProperty("background", "#101820", "important");
      el.style.setProperty("padding", "0 16px", "important");
      el.style.setProperty("border-radius", "16px", "important");
      el.style.setProperty("text-shadow", "none", "important");
    });
  }
  function boot() {
    try { document.documentElement.setAttribute("data-wall-page", file().replace(/\.html$/i, "")); } catch (e) {}
    wallCss();
    mount();
    parkClock();
    kick();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  function again() { mount(); parkClock(); }
  window.addEventListener("load", again);
  setTimeout(again, 400);
  setTimeout(again, 650);
  g.HouseHome = { mount: mount, kick: kick, IDLE: IDLE_MS };
})(typeof window !== "undefined" ? window : globalThis);
