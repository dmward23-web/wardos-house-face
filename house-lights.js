/* House Face · Lights control (Kasa / Google Home)
   Live path: poll data/lights-live.json (Atlas fetcher → Pages).
   DEMO localStorage toggles when need_token / not live.
   NEVER invent LIVE. NEVER label DEMO as LIVE.
   See LIGHTS-LIVE.md
   Keys: house-lights-state */
(function (global) {
  "use strict";

  var STATE_KEY = "house-lights-state";
  var LIVE_URL = "data/lights-live.json";
  var LIVE_FRESH_MS = 30 * 60 * 1000;
  var LIVE_POLL_MS = 60 * 1000;
  var DOCS = "LIGHTS-LIVE.md";

  var STARTER = [
    { id: "dining-room", name: "Dining Room", where: "Dining Room", kind: "dimmer", on: true, brightness: 52 },
    { id: "harris-room", name: "Harris's Room", where: "Harris's Room", kind: "dimmer", on: true, brightness: 100 },
    { id: "kitchen", name: "Kitchen", where: "Kitchen", kind: "dimmer", on: true, brightness: 1 }
  ];


  var _liveCache = null;
  var _listeners = [];

  function parseUpdatedAt(iso) {
    if (!iso) return 0;
    var t = Date.parse(iso);
    return Number.isFinite(t) ? t : 0;
  }

  function ageMs(data) {
    if (!data) return Infinity;
    var t = parseUpdatedAt(data.fetchedAt || data.updatedAt);
    if (!t) return Infinity;
    return Date.now() - t;
  }

  function loadDemo() {
    var base = {};
    for (var i = 0; i < STARTER.length; i++) {
      var s = STARTER[i];
      base[s.id] = {
        on: typeof s.on === "boolean" ? s.on : false,
        brightness: typeof s.brightness === "number" ? clampBright(s.brightness) : 100
      };
    }
    try {
      var raw = localStorage.getItem(STATE_KEY);
      if (!raw) return base;
      var o = JSON.parse(raw);
      if (!o || typeof o !== "object") return base;
      for (var id in o) {
        if (!Object.prototype.hasOwnProperty.call(o, id)) continue;
        if (!base[id]) base[id] = { on: false, brightness: 100 };
        if (typeof o[id].on === "boolean") base[id].on = o[id].on;
        if (typeof o[id].brightness === "number") {
          base[id].brightness = clampBright(o[id].brightness);
        }
      }
      return base;
    } catch (e) {
      return base;
    }
  }

  function saveDemo(map) {
    try {
      localStorage.setItem(STATE_KEY, JSON.stringify(map || loadDemo()));
    } catch (e) { /* */ }
  }

  function clampBright(n) {
    n = Math.round(Number(n) || 0);
    if (n < 0) n = 0;
    if (n > 100) n = 100;
    return n;
  }

  /**
   * Gate for UI labels.
   * LIVE only when status==="live" + fresh-ish roster.
   * NEED TOKEN when status need_token|stage.
   * Never invent LIVE from DEMO localStorage.
   */
  function gate(data) {
    data = data || (_liveCache && _liveCache.data) || null;
    if (!data) {
      return {
        kind: "stub",
        label: "STUB",
        live: false,
        needToken: false,
        writeSupported: false,
        error: "missing lights-live.json",
        lightCount: 0
      };
    }
    if (data.status === "need_token" || data.status === "stage") {
      var n = ((data.lights && data.lights.length) || STARTER.length);
      return {
        kind: "need_token",
        label: "NEED TOKEN",
        live: false,
        needToken: true,
        writeSupported: false,
        error: data.error || "need Kasa token",
        lightCount: n,
        data: data
      };
    }
    if (data.status === "error") {
      return {
        kind: "error",
        label: "FETCH ERR",
        live: false,
        needToken: false,
        writeSupported: false,
        error: data.error || "error",
        lightCount: 0,
        data: data
      };
    }
    if (data.status === "live") {
      var lights = data.lights || [];
      var aging = ageMs(data) > LIVE_FRESH_MS;
      return {
        kind: aging ? "aging" : "live",
        label: aging ? "LIVE · aging" : "LIVE",
        live: true,
        needToken: false,
        writeSupported: !!data.writeSupported,
        error: null,
        lightCount: lights.length,
        updatedAt: data.fetchedAt || data.updatedAt,
        data: data
      };
    }
    return {
      kind: "stub",
      label: "STUB",
      live: false,
      needToken: false,
      writeSupported: false,
      error: "unknown status",
      lightCount: 0,
      data: data
    };
  }

  function rosterFromLive(data) {
    var out = [];
    var list = (data && data.lights) || [];
    if (list.length) {
      for (var i = 0; i < list.length; i++) {
        if (list[i] && list[i].id) out.push(list[i]);
      }
    } else {
      for (var j = 0; j < STARTER.length; j++) {
        out.push({
          id: STARTER[j].id,
          name: STARTER[j].name,
          where: STARTER[j].where,
          kind: STARTER[j].kind,
          on: null,
          brightness: null,
          online: null
        });
      }
    }
    return out;
  }

  function reservedFromLive(data) {
    var r = (data && data.reserved) || [];
    return r.length ? r : [];
  }

  /**
   * Effective per-light state for UI.
   * Live reads when gate.live; otherwise DEMO localStorage.
   */
  function effectiveLights() {
    var g = gate();
    var demo = loadDemo();
    var data = g.data || (_liveCache && _liveCache.data) || null;
    var roster = rosterFromLive(data);
    var reserved = reservedFromLive(data);
    var items = [];
    /* LIVE + writeSupported → pure live reads.
       LIVE + !writeSupported → DEMO overlay (seeded from live on fetch; taps visible until next poll).
       else → pure DEMO. */
    var usePureLive = !!(g.live && g.writeSupported);
    for (var i = 0; i < roster.length; i++) {
      var L = roster[i];
      var id = L.id;
      var d = demo[id] || { on: false, brightness: 100 };
      if (usePureLive) {
        items.push({
          id: id,
          name: L.name || id,
          where: L.where || "",
          kind: L.kind || "bulb",
          on: typeof L.on === "boolean" ? L.on : !!d.on,
          brightness: typeof L.brightness === "number" ? L.brightness : d.brightness,
          online: L.online !== false,
          source: "live",
          pending: !!L.pending
        });
      } else {
        items.push({
          id: id,
          name: L.name || id,
          where: L.where || "",
          kind: L.kind || "bulb",
          on: !!d.on,
          brightness: clampBright(d.brightness),
          online: g.live ? (L.online !== false) : null,
          source: g.live ? "live-demo" : "demo",
          pending: false
        });
      }
    }
    return {
      gate: g,
      lights: items,
      reserved: reserved,
      writeSupported: !!(g.writeSupported),
      source: usePureLive ? "live" : (g.live ? "live-demo" : "demo")
    };
  }

  function setLight(id, patch) {
    var g = gate();
    if (g.live && g.writeSupported) {
      /* live write path not wired — fall through to demo flag only if ever enabled */
    }
    var demo = loadDemo();
    if (!demo[id]) demo[id] = { on: false, brightness: 100 };
    if (patch && typeof patch.on === "boolean") demo[id].on = patch.on;
    if (patch && typeof patch.brightness === "number") {
      demo[id].brightness = clampBright(patch.brightness);
    }
    saveDemo(demo);
    notify();
    return demo[id];
  }

  function setAll(on) {
    var eff = effectiveLights();
    var demo = loadDemo();
    for (var i = 0; i < eff.lights.length; i++) {
      var id = eff.lights[i].id;
      if (!demo[id]) demo[id] = { on: false, brightness: 100 };
      demo[id].on = !!on;
    }
    saveDemo(demo);
    notify();
  }

  function notify() {
    for (var i = 0; i < _listeners.length; i++) {
      try { _listeners[i](effectiveLights()); } catch (e) { /* */ }
    }
  }

  function onChange(fn) {
    if (typeof fn === "function") _listeners.push(fn);
  }

  function applyLivePayload(data) {
    _liveCache = { at: Date.now(), data: data };
    var g = gate(data);
    /* Seed DEMO from LIVE snapshot when writes are not yet proxied —
       so hub switches match reality on poll, and taps stay visible between polls. */
    if (g.live && !g.writeSupported) {
      var demo = loadDemo();
      var list = (data && data.lights) || [];
      for (var i = 0; i < list.length; i++) {
        var L = list[i];
        if (!L || !L.id) continue;
        demo[L.id] = {
          on: typeof L.on === "boolean" ? L.on : !!(demo[L.id] && demo[L.id].on),
          brightness: typeof L.brightness === "number"
            ? clampBright(L.brightness)
            : clampBright((demo[L.id] && demo[L.id].brightness) || 100)
        };
      }
      saveDemo(demo);
    }
    notify();
    return g;
  }

  function fetchLive(cb) {
    var url = LIVE_URL + (LIVE_URL.indexOf("?") >= 0 ? "&" : "?") + "t=" + Date.now();
    fetch(url, { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("live json " + r.status);
      return r.json();
    }).then(function (j) {
      var g = applyLivePayload(j);
      if (cb) cb(null, g, j);
    }).catch(function (err) {
      if (!_liveCache) {
        applyLivePayload({
          status: "need_token",
          fetchedAt: null,
          source: "kasa-pending",
          writeSupported: false,
          lights: STARTER.map(function (s) {
            return {
              id: s.id, name: s.name, where: s.where, kind: s.kind,
              on: null, brightness: null, online: null
            };
          }),
          reserved: [],
          error: "data/lights-live.json unavailable"
        });
      }
      if (cb) cb(err || new Error("live fetch fail"), gate(), null);
    });
  }

  var _pollTimer = null;
  function startPolling() {
    fetchLive();
    if (_pollTimer) return;
    _pollTimer = setInterval(function () { fetchLive(); }, LIVE_POLL_MS);
  }

  function countOn(items) {
    var n = 0;
    for (var i = 0; i < items.length; i++) if (items[i].on) n++;
    return n;
  }

  function paintChip(el) {
    if (!el) return;
    var eff = effectiveLights();
    var g = eff.gate;
    var n = eff.lights.length;
    var onN = countOn(eff.lights);
    var hdr = el.classList.contains("lights-hdr") || el.classList.contains("sensi-hdr") || el.classList.contains("nest-hdr");
    el.classList.add("lights-chip");
    el.classList.toggle("is-live", !!g.live);
    el.classList.toggle("is-need", g.kind === "need_token" || !!g.needToken);
    el.setAttribute("href", el.getAttribute("href") || "sheet-lights.html");
    var status = g.label;
    if (hdr) {
      var ico = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18h6"/><path d="M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.7c.6.5 1 1.2 1.1 2H14.4c.1-.8.5-1.5 1.1-2A6 6 0 0 0 12 3z"/></svg>';
      var big = n ? String(n) : "—";
      var unit = n ? "pads" : "";
      var quiet = g.needToken ? "Kasa" : (onN ? (onN + " on") : "all off");
      el.innerHTML =
        '<div class="lights-hdr-ico nest-hdr-ico" aria-hidden="true">' + ico + "</div>"
        + '<div class="lights-hdr-text nest-hdr-text">'
        + '<div class="lights-hdr-kicker nest-hdr-kicker">Lights</div>'
        + '<div class="lights-hdr-line nest-hdr-line">'
        + '<span class="lights-hdr-main nest-hdr-main">' + big + "</span>"
        + '<span class="sensi-hdr-set">' + unit + "</span>"
        + '<span class="lights-hdr-mode nest-hdr-mode">' + quiet + "</span>"
        + "</div>"
        + '<div class="lights-hdr-sub nest-hdr-sub"><i class="hdr-live-dot" aria-hidden="true"></i>' + status + "</div>"
        + "</div>";
      return;
    }
    el.innerHTML =
      '<div class="lights-chip-ico" aria-hidden="true">💡</div>'
      + '<div class="lights-chip-text">'
      + '<div class="lights-chip-kicker">Lights · house</div>'
      + '<div class="lights-chip-line">'
      + '<span class="lights-chip-temp">' + n + "</span>"
      + '<span class="lights-chip-set">' + (onN ? onN + " on" : "off") + "</span>"
      + "</div>"
      + '<div class="lights-chip-sub">' + status + "</div>"
      + "</div>";
  }

  function mountChip(selector) {
    var el = typeof selector === "string" ? document.querySelector(selector) : selector;
    if (!el) return;
    paintChip(el);
    onChange(function () { paintChip(el); });
    startPolling();
  }

  /** Paint Google Home secondary Lights tile + optional pad row. */
  function paintPads(doc) {
    doc = doc || document;
    var eff = effectiveLights();
    var g = eff.gate;
    var meta = doc.getElementById("lights-zone-meta") || doc.querySelector(".sec-zone .zone-meta");
    if (meta && meta.closest && meta.closest(".sec-zone")) {
      meta.textContent = g.live
        ? ("Lights LIVE · " + eff.lights.length + " pads")
        : (g.needToken
          ? ("Lights · NEED TOKEN · " + eff.lights.length + " pads · DEMO")
          : ("Lights · " + g.label + " · garage/door stubs"));
    }
    var sub = doc.getElementById("lights-ctrl-sub");
    if (sub) {
      var names = eff.lights.map(function (L) { return L.name; }).join(" · ");
      sub.textContent = names || "Dining Room · Harris's Room · Kitchen";
    }
    var pill = doc.getElementById("lights-ctrl-pill");
    if (pill) {
      pill.textContent = g.label;
      pill.classList.toggle("on", !!g.live);
    }
    var allOn = doc.getElementById("lights-all-on");
    var allOff = doc.getElementById("lights-all-off");
    if (allOn) {
      allOn.disabled = false;
      allOn.style.pointerEvents = "auto";
      allOn.style.opacity = "1";
      allOn.style.cursor = "pointer";
    }
    if (allOff) {
      allOff.disabled = false;
      allOff.style.pointerEvents = "auto";
      allOff.style.opacity = "1";
      allOff.style.cursor = "pointer";
    }
    var grid = doc.getElementById("lights-pad-grid");
    if (grid) {
      var html = "";
      for (var i = 0; i < eff.lights.length; i++) {
        var L = eff.lights[i];
        var onCls = L.on ? " is-on" : "";
        var dim = L.kind === "dimmer";
        html +=
          '<article class="light-pad' + onCls + '" data-light-id="' + L.id + '">'
          + '<div class="light-pad-top">'
          + '<div class="light-pad-ico" aria-hidden="true">💡</div>'
          + '<div><div class="light-pad-name">' + escapeHtml(L.name) + "</div>"
          + '<div class="light-pad-where">' + escapeHtml(L.where || L.kind) + "</div></div>"
          + '<div class="light-pad-state">' + (L.on ? "ON" : "OFF") + "</div>"
          + "</div>"
          + '<div class="light-pad-actions">'
          + '<button type="button" class="light-btn loud" data-act="on" data-id="' + L.id + '">On</button>'
          + '<button type="button" class="light-btn" data-act="off" data-id="' + L.id + '">Off</button>'
          + (dim
            ? '<input class="light-bright" type="range" min="1" max="100" value="' + clampBright(L.brightness || 100) + '" data-id="' + L.id + '" aria-label="Brightness" />'
            : "")
          + "</div>"
          + '<div class="light-pad-src">' + hubSrcLabel(eff, g) + "</div>"
          + "</article>";
      }
      /* reserved OP slot */
      for (var r = 0; r < eff.reserved.length; r++) {
        var R = eff.reserved[r];
        html +=
          '<article class="light-pad is-pending" data-light-id="' + R.id + '">'
          + '<div class="light-pad-top">'
          + '<div class="light-pad-ico" aria-hidden="true">⏳</div>'
          + '<div><div class="light-pad-name">' + escapeHtml(R.name || R.id) + "</div>"
          + '<div class="light-pad-where">' + escapeHtml(R.where || "pending") + " · fold-in</div></div>"
          + '<div class="light-pad-state">PENDING</div>'
          + "</div>"
          + '<div class="light-pad-actions">'
          + '<button type="button" class="light-btn" disabled>On</button>'
          + '<button type="button" class="light-btn" disabled>Off</button>'
          + "</div>"
          + '<div class="light-pad-src">reserved · fold-in</div>'
          + "</article>";
      }
      grid.innerHTML = html;
      bindPadHandlers(grid);
    }
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function bindPadHandlers(grid) {
    if (!grid || grid.getAttribute("data-lights-bound") === "1") {
      /* re-bind each paint — clear flag first */
    }
    grid.setAttribute("data-lights-bound", "1");
    grid.onclick = function (ev) {
      var t = ev.target;
      if (!t || !t.getAttribute) return;
      var act = t.getAttribute("data-act");
      var id = t.getAttribute("data-id");
      if (!act || !id) return;
      try { if (global.HouseSfx && HouseSfx.tap) HouseSfx.tap(); } catch (e) {}
      if (act === "on") setLight(id, { on: true });
      if (act === "off") setLight(id, { on: false });
      var d0 = grid.ownerDocument || document;
      paintPads(d0); paintHubPanel(d0);
    };
    grid.onchange = function (ev) {
      var t = ev.target;
      if (!t || !t.classList || !t.classList.contains("light-bright")) return;
      var id = t.getAttribute("data-id");
      if (!id) return;
      setLight(id, { on: true, brightness: clampBright(t.value) });
      var d1 = grid.ownerDocument || document;
      paintPads(d1); paintHubPanel(d1);
    };
  }

  function wireAllButtons(doc) {
    doc = doc || document;
    function tap() {
      try { if (global.HouseSfx && HouseSfx.tap) HouseSfx.tap(); } catch (e) {}
    }
    var onB = doc.getElementById("lights-all-on");
    var offB = doc.getElementById("lights-all-off");
    if (onB && !onB._lightsWired) {
      onB._lightsWired = true;
      onB.addEventListener("click", function () {
        tap(); setAll(true); paintPads(doc); paintHubPanel(doc); paintChip(doc.getElementById("index-lights-chip"));
      });
    }
    if (offB && !offB._lightsWired) {
      offB._lightsWired = true;
      offB.addEventListener("click", function () {
        tap(); setAll(false); paintPads(doc); paintHubPanel(doc); paintChip(doc.getElementById("index-lights-chip"));
      });
    }
  }



  function hubSrcLabel(eff, g) {
    g = g || (eff && eff.gate) || gate();
    if (g.live && g.writeSupported) return "LIVE";
    if (g.live) return "LIVE · DEMO write";
    if (g.needToken) return "NEED TOKEN · DEMO";
    return (g.label || "DEMO") + (eff && eff.source === "demo" ? " · DEMO" : "");
  }

  function hubHonesty(g) {
    g = g || gate();
    if (g.live && g.writeSupported) return "LIVE";
    if (g.live) return "LIVE";
    if (g.needToken) return "NEED TOKEN · DEMO";
    return (g.label || "STUB") + " · DEMO";
  }

  /** Hub primary control · rocker switches on sheet-index (Dining / Harris / Kitchen). */
  function paintHubPanel(doc) {
    doc = doc || document;
    var panel = doc.getElementById("hub-lights-panel");
    if (!panel) return;
    var eff = effectiveLights();
    var g = eff.gate;
    panel.classList.toggle("is-live", !!g.live);
    panel.classList.toggle("is-need", !!(g.needToken || g.kind === "need_token"));
    panel.classList.toggle("is-demo-write", !!(g.live && !g.writeSupported));

    var pill = doc.getElementById("hub-lights-pill");
    if (pill) {
      pill.textContent = hubHonesty(g);
      pill.classList.toggle("on", !!g.live);
      pill.classList.toggle("off", !g.live);
    }
    var sub = doc.getElementById("hub-lights-sub");
    if (sub) {
      sub.textContent = g.live
        ? (g.writeSupported
          ? "Kasa live · wall switches"
          : "LIVE read · taps DEMO until write proxy")
        : (g.needToken
          ? "NEED TOKEN · DEMO toggles"
          : ((g.label || "STUB") + " · DEMO"));
    }

    var grid = doc.getElementById("hub-lights-grid");
    if (!grid) return;
    var html = "";
    for (var i = 0; i < eff.lights.length; i++) {
      var L = eff.lights[i];
      var onCls = L.on ? " is-on" : " is-off";
      var dim = (L.kind === "dimmer" || L.kind === "switch/dimmer");
      var bright = clampBright(L.brightness || (L.on ? 100 : 0));
      html +=
        '<article class="hub-sw' + onCls + '" data-light-id="' + L.id + '">'
        + '<div class="hub-sw-main">'
        + '<div class="hub-sw-text">'
        + '<div class="hub-sw-name">' + escapeHtml(L.name) + "</div>"
        + '<div class="hub-sw-meta">' + (L.on ? "ON" : "OFF")
        + (dim ? (" · " + bright + "%") : "")
        + "</div>"
        + "</div>"
        + '<button type="button" class="hub-sw-rocker' + onCls + '" data-act="toggle" data-id="'
        + L.id + '" aria-pressed="' + (L.on ? "true" : "false") + '" aria-label="'
        + escapeHtml(L.name) + ' power">'
        + '<span class="hub-sw-rocker-on">ON</span>'
        + '<span class="hub-sw-rocker-knob" aria-hidden="true"></span>'
        + '<span class="hub-sw-rocker-off">OFF</span>'
        + "</button>"
        + "</div>"
        + (dim
          ? ('<div class="hub-sw-dim">'
            + '<input class="hub-sw-bright light-bright" type="range" min="1" max="100" value="'
            + bright + '" data-id="' + L.id + '" aria-label="' + escapeHtml(L.name) + ' brightness" />'
            + '<span class="hub-sw-pct" data-pct-for="' + L.id + '">' + bright + "%</span>"
            + "</div>")
          : "")
        + "</article>";
    }
    grid.innerHTML = html;
    bindHubHandlers(panel);
  }

  function bindHubHandlers(panel) {
    if (!panel) return;
    panel.setAttribute("data-hub-lights-bound", "1");
    panel.onclick = function (ev) {
      var t = ev.target;
      if (!t) return;
      var btn = t.closest ? t.closest("[data-act]") : null;
      if (!btn) {
        while (t && t !== panel && !(t.getAttribute && t.getAttribute("data-act"))) t = t.parentNode;
        btn = (t && t.getAttribute && t.getAttribute("data-act")) ? t : null;
      }
      if (!btn) return;
      var act = btn.getAttribute("data-act");
      var id = btn.getAttribute("data-id");
      if (!act || !id) return;
      ev.preventDefault();
      try { if (global.HouseSfx && HouseSfx.tap) HouseSfx.tap(); } catch (e) {}
      if (act === "toggle") {
        var eff = effectiveLights();
        var cur = false;
        for (var i = 0; i < eff.lights.length; i++) {
          if (eff.lights[i].id === id) { cur = !!eff.lights[i].on; break; }
        }
        setLight(id, { on: !cur });
      } else if (act === "on") {
        setLight(id, { on: true });
      } else if (act === "off") {
        setLight(id, { on: false });
      }
      paintHubPanel(panel.ownerDocument || document);
      paintPads(panel.ownerDocument || document);
      paintChip((panel.ownerDocument || document).getElementById("index-lights-chip"));
    };
    panel.oninput = function (ev) {
      var t = ev.target;
      if (!t || !t.classList || !t.classList.contains("hub-sw-bright")) return;
      var id = t.getAttribute("data-id");
      if (!id) return;
      var v = clampBright(t.value);
      var pct = panel.querySelector('[data-pct-for="' + id + '"]');
      if (pct) pct.textContent = v + "%";
    };
    panel.onchange = function (ev) {
      var t = ev.target;
      if (!t || !t.classList || !t.classList.contains("hub-sw-bright")) return;
      var id = t.getAttribute("data-id");
      if (!id) return;
      try { if (global.HouseSfx && HouseSfx.tap) HouseSfx.tap(); } catch (e) {}
      setLight(id, { on: true, brightness: clampBright(t.value) });
      paintHubPanel(panel.ownerDocument || document);
      paintPads(panel.ownerDocument || document);
      paintChip((panel.ownerDocument || document).getElementById("index-lights-chip"));
    };
  }

  function mountHubPanel(selector) {
    var doc = document;
    var panel = typeof selector === "string" ? doc.querySelector(selector) : selector;
    if (!panel) panel = doc.getElementById("hub-lights-panel");
    if (!panel) return null;
    wireAllButtons(doc);
    onChange(function () { paintHubPanel(doc); });
    startPolling();
    paintHubPanel(doc);
    return panel;
  }

  /** Kid-board secondary shortcut: one named pad only (hub stays full roster). */
  function paintKidPad(host, lightId, doc) {
    doc = doc || document;
    host = typeof host === "string" ? doc.querySelector(host) : host;
    if (!host || !lightId) return;
    var eff = effectiveLights();
    var g = eff.gate;
    var L = null;
    for (var i = 0; i < eff.lights.length; i++) {
      if (eff.lights[i].id === lightId) { L = eff.lights[i]; break; }
    }
    if (!L) {
      host.innerHTML = '<div class="kid-light-miss">Light not in roster</div>';
      return;
    }
    var onCls = L.on ? " is-on" : "";
    var dim = (L.kind === "dimmer" || L.kind === "switch/dimmer");
    var gateLab = g.label || (g.needToken ? "NEED TOKEN" : "DEMO");
    host.innerHTML =
      '<article class="light-pad kid-light-pad' + onCls + '" data-light-id="' + L.id + '">'
      + '<div class="light-pad-top">'
      + '<div class="light-pad-ico" aria-hidden="true">💡</div>'
      + '<div><div class="light-pad-name">' + escapeHtml(L.name) + "</div>"
      + '<div class="light-pad-where">My room · shortcut</div></div>'
      + '<div class="light-pad-state">' + (L.on ? "ON" : "OFF") + "</div>"
      + "</div>"
      + '<div class="light-pad-actions">'
      + '<button type="button" class="light-btn loud" data-act="on" data-id="' + L.id + '">On</button>'
      + '<button type="button" class="light-btn" data-act="off" data-id="' + L.id + '">Off</button>'
      + (dim
        ? '<input class="light-bright" type="range" min="1" max="100" value="' + clampBright(L.brightness || 100) + '" data-id="' + L.id + '" aria-label="Brightness" />'
        : "")
      + "</div>"
      + '<div class="light-pad-src">' + hubSrcLabel(eff, g) + " · " + escapeHtml(gateLab) + " · full house → Lights</div>"
      + "</article>";
    host.onclick = function (ev) {
      var el = ev.target;
      if (!el || !el.getAttribute) return;
      var act = el.getAttribute("data-act");
      var id = el.getAttribute("data-id");
      if (!act || !id) return;
      try { if (global.HouseSfx && HouseSfx.tap) HouseSfx.tap(); } catch (e) {}
      if (act === "on") setLight(id, { on: true });
      if (act === "off") setLight(id, { on: false });
      paintKidPad(host, lightId, doc);
    };
    host.onchange = function (ev) {
      var el = ev.target;
      if (!el || !el.classList || !el.classList.contains("light-bright")) return;
      var id = el.getAttribute("data-id");
      if (!id) return;
      setLight(id, { on: true, brightness: clampBright(el.value) });
      paintKidPad(host, lightId, doc);
    };
  }

  function mountKidLight(selector, lightId) {
    var doc = document;
    var host = typeof selector === "string" ? doc.querySelector(selector) : selector;
    if (!host || !lightId) return;
    function repaint() { paintKidPad(host, lightId, doc); }
    onChange(repaint);
    startPolling();
    repaint();
  }

  global.HouseLights = {
    STATE_KEY: STATE_KEY,
    LIVE_URL: LIVE_URL,
    DOCS: DOCS,
    STARTER: STARTER,
    gate: gate,
    effectiveLights: effectiveLights,
    loadDemo: loadDemo,
    saveDemo: saveDemo,
    setLight: setLight,
    setAll: setAll,
    fetchLive: fetchLive,
    startPolling: startPolling,
    onChange: onChange,
    paintChip: paintChip,
    mountChip: mountChip,
    paintPads: paintPads,
    wireAllButtons: wireAllButtons,
    paintHubPanel: paintHubPanel,
    mountHubPanel: mountHubPanel,
    paintKidPad: paintKidPad,
    mountKidLight: mountKidLight,
    clampBright: clampBright,
    hubHonesty: hubHonesty
  };
})(typeof window !== "undefined" ? window : globalThis);
