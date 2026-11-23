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
  var going = false;
  function go(ev) {
    if (going) return;
    going = true;
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
      display: "flex", "align-items": "center", "justify-content": "center",
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
    btn.addEventListener("click", function (ev) { go(ev); });
  }
  function mount() {
    if (onHub()) {
      document.querySelectorAll(".wardos-home, .hub-home").forEach(function (el) {
        el.setAttribute("hidden", "");
        el.style.setProperty("display", "none", "important");
      });
      var clock = document.querySelector(".hdr-date-time, [data-live-clock], .live-clock");
      if (clock && clock.getAttribute("data-home-clock") !== "1") {
        clock.setAttribute("data-home-clock", "1");
        clock.style.cursor = "pointer";
        clock.style.setProperty("pointer-events", "auto", "important");
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
      "html[data-wall-page=sheet-google-home] .panel.cams-cmd{padding-top:112px!important;box-sizing:border-box!important}",
      "html[data-wall-page=sheet-google-home] .panel.cams-cmd>.hdr.gh-top,html[data-wall-page=sheet-google-home] .panel.cams-cmd>section.banner{margin-left:112px!important;width:calc(100% - 112px)!important;box-sizing:border-box!important}",
      "html[data-wall-page=sheet-google-home] .panel.cams-cmd .live-clock-host{position:relative!important;right:auto!important;top:auto!important;left:auto!important;width:auto!important;max-width:none!important;z-index:auto!important}",
      "html[data-wall-page=sheet-index] header.hdr{left:48px!important;padding-left:0!important}",
      "html:not(#hf-wall-off) body.lights-offline .panel.lights-cmd{position:fixed!important;left:48px!important;top:160px!important;width:1824px!important;height:824px!important;min-height:824px!important;max-width:none!important;max-height:none!important;background:#101820!important;z-index:4!important;box-sizing:border-box!important;padding:48px!important;display:flex!important;flex-direction:column!important;justify-content:center!important;align-items:flex-start!important;gap:24px!important}",
      "html:not(#hf-wall-off) body.lights-offline .panel.lights-cmd .pad-grid,html:not(#hf-wall-off) body.lights-offline .panel.lights-cmd .light-pad,html:not(#hf-wall-off) body.lights-offline .panel.lights-cmd #lights-stub-grid{display:none!important}",
      "html:not(#hf-wall-off) body.lights-offline .panel.lights-cmd .bulk{display:flex!important;flex-direction:row!important;gap:16px!important;align-items:center!important}",
      "html:not(#hf-wall-off) body.lights-offline #lights-all-on,html:not(#hf-wall-off) body.lights-offline #lights-all-off{display:inline-flex!important;visibility:visible!important;opacity:1!important;pointer-events:auto!important;min-width:96px!important;min-height:64px!important}",
      "html:not(#hf-wall-off) body.lights-offline .panel.lights-cmd .banner-title,html:not(#hf-wall-off) body.lights-offline #lights-connect-title{font-size:40px!important;color:#f4efe6!important}",
      "html:not(#hf-wall-off) body.lights-offline #lights-offline-say.is-on{display:block!important;font-size:32px!important;line-height:1.2!important;color:#f4efe6!important;background:#101820!important}",
      "html:not(#hf-wall-off) body .panel .tap-rail a::after{content:none!important}",
      "html:not(#hf-wall-off) body .panel .body>section.kids-col.kids-col{position:relative!important;top:0!important;height:100%!important;max-height:100%!important;overflow:hidden!important;display:flex!important;flex-direction:column!important;gap:16px!important;margin:0!important}",
      "html:not(#hf-wall-off):not(#hf-scroll-off) body .panel>.body:has(>section.kids-col){position:absolute!important;left:48px!important;top:160px!important;width:1824px!important;height:872px!important;max-height:872px!important;overflow:hidden!important;grid-template-rows:200px minmax(0,1fr) 224px!important;box-sizing:border-box!important}",
      "html:not(#hf-wall-off):not(#hf-scroll-off) body .panel>.body:has(>.sec[aria-label='Quick taps'])>section.kids-col.kids-col{grid-column:2!important;grid-row:1 / span 2!important}",
      "html:not(#hf-wall-off):not(#hf-scroll-off) body .panel>.body>section.sec[aria-label='Quick taps']{position:fixed!important;left:972px!important;top:806px!important;width:852px!important;height:224px!important;max-height:224px!important;min-height:0!important;overflow:hidden!important;z-index:4!important;box-sizing:border-box!important;padding:0!important}",
      "html:not(#hf-wall-off) body .panel .qtile{position:relative!important}",
      "html:not(#hf-wall-off) body .panel .qtile .qtile-sub{display:none!important}",
      "html:not(#hf-wall-off) body .panel .qtile .qtile-label{position:absolute!important;top:20px!important;left:88px!important;right:96px!important;height:24px!important;line-height:24px!important;margin:0!important;overflow:hidden!important;white-space:nowrap!important}",
      "html:not(#hf-wall-off) body .panel .qtile .qtile-tap{position:absolute!important;top:20px!important;right:28px!important;height:24px!important;line-height:24px!important;margin:0!important;max-width:72px!important}",
      "html:not(#hf-wall-off) body .panel> .body>section.sec[aria-label='Quick taps']>.sec-hdr{display:none!important}",
      "html:not(#hf-wall-off) body .panel .sec[aria-label='Quick taps'] .quick{height:100%!important;max-height:224px!important;min-height:0!important;overflow:hidden!important;display:flex!important;flex-direction:column!important;gap:16px!important}",
      "html:not(#hf-wall-off) body .panel .sec[aria-label='Quick taps'] .qtile{flex:0 0 64px!important;min-height:64px!important;height:64px!important;max-height:64px!important;overflow:hidden!important;padding:0 16px!important;box-sizing:border-box!important}",
      "html:not(#hf-wall-off) body .panel .body>section.kids-col.kids-col>.kid-card{flex:1 1 0!important;min-height:64px!important;height:auto!important;margin:0!important;overflow:hidden!important;position:relative!important;top:0!important;display:flex!important;flex-direction:column!important;gap:4px!important;padding:8px 16px!important;box-sizing:border-box!important}",
      "html:not(#hf-wall-off) body .panel .kids-col .kid-top{display:flex!important;flex:0 0 auto!important;align-items:center!important;justify-content:space-between!important;gap:12px!important;min-height:28px!important;position:relative!important;z-index:2!important}",
      "html:not(#hf-wall-off) body .panel .kids-col .kid-name,html:not(#hf-wall-off) body .panel .kids-col .kid-tap{position:static!important;overflow:visible!important;white-space:nowrap!important;line-height:28px!important;height:auto!important;max-height:none!important}",
      "html:not(#hf-wall-off) body .panel .kids-col .kid-card .kid-what{position:static!important;display:flex!important;flex-direction:column!important;gap:4px!important;min-height:0!important;overflow:hidden!important}",
      "html:not(#hf-wall-off) body .panel .kids-col .kid-card .kid-what-line{position:static!important;left:auto!important;right:auto!important;top:auto!important;bottom:auto!important;display:block!important;height:24px!important;max-height:24px!important;margin:0!important;line-height:24px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}",
      "html body .kid-what,html body .kid-what-line{color:#f4efe6!important;-webkit-text-fill-color:#f4efe6!important}",
      "html:not(#hf-wall-off) body .panel .leaveby.leaveby--hot{position:fixed!important;left:652px!important;top:400px!important;width:520px!important;height:200px!important;max-height:200px!important;margin:0!important;padding:8px!important;box-sizing:border-box!important;overflow:hidden!important;z-index:40!important;background:#101820!important;pointer-events:auto!important;display:flex!important;flex-direction:column!important;gap:4px!important}",
      "html:not(#hf-wall-off) body .lb-day-part,html:not(#hf-wall-off) body .leaveby-mode-label,html:not(#hf-wall-off) body .lb-list-hdr{font-size:24px!important;line-height:24px!important;min-height:24px!important;color:#f4efe6!important;-webkit-text-fill-color:#f4efe6!important}",
      "html:not(#hf-wall-off) body .leaveby-switch{position:relative!important;z-index:6!important;flex:0 0 auto!important;background:#101820!important;display:flex!important;flex-direction:column!important;align-items:flex-start!important;gap:4px!important}",
      "html:not(#hf-wall-off) body .leaveby-chips{display:flex!important;flex-wrap:wrap!important;gap:16px!important;align-items:center!important;position:relative!important;z-index:6!important;background:#101820!important}",
      "html:not(#hf-wall-off) body .leaveby-chip{min-width:64px!important;min-height:64px!important;width:64px!important;height:64px!important;padding:0!important;font-size:24px!important;line-height:24px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;box-sizing:border-box!important;overflow:hidden!important}",
      "html:not(#hf-wall-off) body .leaveby .lb-day-stop{display:flex!important;flex-direction:row!important;align-items:center!important;gap:8px!important;height:28px!important;max-height:28px!important;overflow:hidden!important;padding:0!important;border:0!important}",
      "html:not(#hf-wall-off) body .leaveby .lb-day-what,html:not(#hf-wall-off) body .leaveby .lb-day-t{font-size:24px!important;line-height:24px!important;height:24px!important;white-space:nowrap!important;overflow:hidden!important}",
      "html:not(#hf-wall-off) body .leaveby .lb-day-tags,html:not(#hf-wall-off) body .leaveby .lb-day-prep{display:none!important}",
      "html:not(#hf-wall-off) body .leaveby .lb-more{display:block!important;font-size:24px!important;line-height:24px!important;height:24px!important;color:#f4efe6!important}",
      "html[data-wall-page=sheet-today] header.hdr .hdr-ovals{margin-left:20px!important}",
      "html:not(#hf-wall-off) body .leaveby>.leaveby-body{display:flex!important;flex-direction:column!important;min-height:0!important;flex:1 1 auto!important;overflow:hidden!important;gap:8px!important}",
      "html:not(#hf-wall-off) body .leaveby .leaveby-main,html:not(#hf-wall-off) body .leaveby .leaveby-head,html:not(#hf-wall-off) body .leaveby .leaveby-sched,html:not(#hf-wall-off) body .leaveby .leaveby-detail{display:none!important}",
      "html:not(#hf-wall-off) body .leaveby [data-live=leaveby-layouts]{flex:1 1 auto!important;min-height:0!important;overflow:hidden!important;max-width:100%!important}",
      "html:not(#hf-wall-off) body .lb-day,html:not(#hf-wall-off) body .lb-day-cols,html:not(#hf-wall-off) body .lb-day-col,html:not(#hf-wall-off) body .lb-day-stop,html:not(#hf-wall-off) body .lb-day-what{max-width:100%!important;box-sizing:border-box!important}",
      "html:not(#hf-wall-off) body .hub-next{width:560px!important;max-width:560px!important;overflow:hidden!important}",
      "html:not(#hf-wall-off) body .hub-cam{overflow:visible!important}",
      "html[data-wall-page=sheet-today] body .qtile,html:not(#hf-wall-off) body .panel .qtile.qtile{height:80px!important;min-height:80px!important;max-height:80px!important;overflow:hidden!important}",
      "html:not(#hf-wall-off) body .panel:has(.month-grid){height:1080px!important;max-height:1080px!important;overflow:hidden!important}",
      "html:not(#hf-wall-off) body .month-grid{grid-auto-rows:88px!important;max-height:700px!important;overflow:hidden!important}",
      "html:not(#hf-wall-off) body .month-wrap{overflow:visible!important;max-height:none!important;height:auto!important}",
      "html:not(#hf-wall-off) body .chore.daily-week,html:not(#hf-wall-off) body .quest.daily-week{display:flex!important;flex-direction:column!important;align-items:flex-start!important;min-height:168px!important;margin:0 0 16px!important;overflow:visible!important;box-sizing:border-box!important;position:relative!important}",
      "html:not(#hf-wall-off) body .chore .what,html:not(#hf-wall-off) body .quest .what{position:static!important;height:32px!important;max-height:32px!important;overflow:hidden!important}",
      "html:not(#hf-wall-off) body .panel.panel>.hub-upper>section.leaveby.leaveby--hot{position:fixed!important;left:652px!important;top:400px!important;width:520px!important;height:200px!important;max-height:200px!important;margin:0!important;padding:8px!important;overflow:hidden!important;z-index:40!important;background:#101820!important;pointer-events:auto!important;display:flex!important;flex-direction:column!important;gap:4px!important}",
      "html:not(#hf-wall-off) body .leaveby-chips{flex-wrap:nowrap!important}",
      "html:not(#hf-wall-off) body .leaveby-chip{width:64px!important;min-width:64px!important;max-width:64px!important}",
      "html:not(#hf-wall-off) body a.hub-cam{overflow:visible!important;height:auto!important}",
      "html[data-wall-page=month] body .panel{overflow:visible!important;height:auto!important;max-height:none!important}",
      "html:not(#hf-wall-off) body .lb-day-cols{display:block!important;width:100%!important;min-width:0!important}",
      "html:not(#hf-wall-off) body .lb-day-what,html:not(#hf-wall-off) body .lb-day-t{min-width:0!important;max-width:100%!important;white-space:normal!important}",
      "html:not(#hf-wall-off) body .hub-cam{height:200px!important;min-height:200px!important;overflow:hidden!important}",
      "html.kw-root body.kw-on .live-clock,html.kw-root body.kw-on .live-clock-lab{display:none!important}",
      "html.kw-root body.kw-on #sec-musts .sec-list{max-height:none!important;overflow:visible!important}",
      "html:not(#hf-wall-off) body .wardos-stage{overflow:visible!important}",
      "html:not(#hf-wall-off) body .month-grid{overflow:visible!important;max-height:none!important;height:auto!important}",
      "html:not(#hf-wall-off) body .link-banner{overflow:visible!important;min-height:104px!important;height:auto!important}",
      "html body .panel.panel>.hub-upper .leaveby [data-live=leaveby-layouts],html body .panel.panel>.hub-upper .leaveby .lb-day,html body .panel.panel>.hub-upper .leaveby .lb-day-col,html body .panel.panel>.hub-upper .leaveby .lb-day-stop{display:block!important;visibility:visible!important}",
      "html body .lb-day-what,html body .lb-day-tchip,html body .leaveby-row-title,html body .kid-what-line{color:#f4efe6!important;-webkit-text-fill-color:#f4efe6!important;background:#101820!important;opacity:1!important;font-size:24px!important;line-height:1.2!important}",
      "html[data-wardos-stage] .live-clock,html[data-wardos-stage] .board-clock{font-size:32px!important;line-height:64px!important;height:64px!important;color:#f4efe6!important;-webkit-text-fill-color:#f4efe6!important;background:#101820!important;padding:0 16px!important;border-radius:16px!important;text-shadow:none!important}",
      "html[data-wardos-stage] .ftr-chip,html[data-wardos-stage] .cheer-badge{pointer-events:none!important}",
      "html.ori-nogl,html.ori-nogl body{background-color:#101820!important;background-image:url('month-theme/november/wall-day.webp')!important;background-size:cover!important;background-position:center!important}"
    ].join("");
    document.head.appendChild(s);
  }
  function parkChips() {
    if (!/sheet-today\.html$|month\.html$/i.test(file())) return;
    var home = document.querySelector("a.wardos-home");
    var chips = document.querySelectorAll(".hdr-ovals .oval");
    if (!home || !chips.length) return;
    var host = chips[0].parentElement;
    if (host && host.getAttribute("data-chip-parked") !== "1") {
      host.setAttribute("data-chip-parked", "1");
      host.style.setProperty("margin-left", "16px", "important");
    }
  }
  function parkHubTitle() {
    if (!onHub()) return;
    var name = document.querySelector(".name-accent, h1.name");
    if (!name) return;
    var r = name.getBoundingClientRect();
    if (r.width < 1) return;
    if (r.left < 48) name.style.setProperty("margin-left", (48 - r.left) + "px", "important");
  }
  function parkClock() {
    if (onHub() || /sheet-weekend\.html$/i.test(file()) || /sheet-google-home\.html$/i.test(file())) return;
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
    document.querySelectorAll(".qtile").forEach(function (el) {
      el.style.setProperty("height", "64px", "important");
      el.style.setProperty("max-height", "64px", "important");
      el.style.setProperty("padding", "0 16px", "important");
      el.style.setProperty("overflow", "hidden", "important");
    });
    if (/month\.html$/i.test(file())) {
      document.querySelectorAll("body, .panel").forEach(function (el) {
        el.style.setProperty("overflow", "visible", "important");
        el.style.setProperty("max-height", "none", "important");
      });
    }
    mount();
    parkClock();
    parkHubTitle();
    parkChips();
    kick();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  function again() { mount(); parkClock(); parkHubTitle(); parkChips(); }
  window.addEventListener("resize", again);
  window.addEventListener("load", again);
  setTimeout(again, 400);
  setTimeout(again, 650);
  g.HouseHome = { mount: mount, kick: kick, IDLE: IDLE_MS };
})(typeof window !== "undefined" ? window : globalThis);
