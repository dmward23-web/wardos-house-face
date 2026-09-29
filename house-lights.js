/* House Face · Lights control (Kasa LIVE only)
   Read: poll data/lights-live.json (Atlas fetcher → Pages).
   Write: POST Atlas lights-write-proxy (creds on box only).
   HARD LAW: nothing ever DEMO. No fake taps. If proxy/token missing →
   controls disabled + honest NEED TOKEN / PROXY OFF / OFFLINE.
   See LIGHTS-LIVE.md
   Keys: wardos-lights-proxy · wardos-lights-proxy-token */
(function (global) {
  "use strict";

  var STATE_KEY = "house-lights-state"; /* legacy — unused for write */
  var LIVE_URL = "data/lights-live.json";
  var LIVE_FRESH_MS = 30 * 60 * 1000;
  var LIVE_POLL_MS = 60 * 1000;
  var DOCS = "LIGHTS-LIVE.md";
  var PROXY_LS_KEY = "wardos-lights-proxy";
  var PROXY_TOKEN_LS_KEY = "wardos-lights-proxy-token";
  var DEFAULT_PROXY = "http://127.0.0.1:8788";

  var STARTER = [
    { id: "dining-room", name: "Dining Room", where: "Dining Room", kind: "dimmer", on: true, brightness: 52 },
    { id: "harris-room", name: "Harris's Room", where: "Harris's Room", kind: "dimmer", on: true, brightness: 100 },
    { id: "kitchen", name: "Kitchen", where: "Kitchen", kind: "dimmer", on: true, brightness: 1 }
  ];


  var _liveCache = null;
  var _listeners = [];
  var _optimistic = {}; /* id -> {on,brightness,pending} — LIVE only, rolled back on fail */
  var _proxyReachable = null; /* null unknown · true/false after probe */
  var _proxyProbeAt = 0;
  var _writeInFlight = 0;

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

  function qs(name) {
    try {
      var u = new URL(location.href);
      return u.searchParams.get(name);
    } catch (e) {
      return null;
    }
  }

  function isPagesHost() {
    try {
      return /\.github\.io$/i.test(location.hostname || "");
    } catch (e) {
      return false;
    }
  }

  function isLoopbackProxy(url) {
    return /^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/i.test(String(url || ""));
  }

  /** Seed proxy URL/token from ?lightsProxy= / ?proxy= (once) into localStorage. */
  function ingestProxyFromQuery() {
    try {
      var p = qs("lightsProxy") || qs("proxy");
      var t = qs("lightsProxyToken") || qs("proxyToken");
      if (p) localStorage.setItem(PROXY_LS_KEY, String(p).replace(/\/$/, ""));
      if (t) localStorage.setItem(PROXY_TOKEN_LS_KEY, String(t));
    } catch (e) { /* */ }
  }

  function proxyBase() {
    ingestProxyFromQuery();
    var fromQs = qs("lightsProxy") || qs("proxy");
    if (fromQs) return String(fromQs).replace(/\/$/, "");
    try {
      var ls = localStorage.getItem(PROXY_LS_KEY);
      if (ls) return String(ls).replace(/\/$/, "");
      // Nest private-link once-seed (wardos may share box tunnel host)
      var nest = localStorage.getItem("wardos-nest-proxy") || localStorage.getItem("nestProxy");
      if (nest) return String(nest).replace(/\/$/, "");
    } catch (e) { /* */ }
    var data = (_liveCache && _liveCache.data) || null;
    if (data && data.writeProxy) return String(data.writeProxy).replace(/\/$/, "");
    // Pages cannot reach Atlas loopback — leave empty so UI stays PROXY OFF (honest).
    if (isPagesHost()) return "";
    return DEFAULT_PROXY;
  }

  function proxyToken() {
    var t = qs("lightsProxyToken") || qs("proxyToken");
    if (t) return t;
    try {
      var ls = localStorage.getItem(PROXY_TOKEN_LS_KEY);
      if (ls) return ls;
    } catch (e) { /* */ }
    var data = (_liveCache && _liveCache.data) || null;
    if (data && data.writeProxyToken) return String(data.writeProxyToken);
    return "";
  }

  function proxyHeaders() {
    var h = { "Content-Type": "application/json", Accept: "application/json" };
    var t = proxyToken();
    if (t) {
      h["X-Lights-Proxy-Token"] = t;
      h["Authorization"] = "Bearer " + t;
    }
    return h;
  }

  function canWrite() {
    var g = gate();
    return !!(g.live && g.writeSupported && _proxyReachable && proxyBase());
  }

  function probeProxy(cb) {
    var base = proxyBase();
    if (!base) {
      _proxyReachable = false;
      _proxyProbeAt = Date.now();
      if (cb) cb(false);
      notify();
      return;
    }
    // Skip loopback probe on Pages (that IP is the phone/Elo, not Atlas).
    if (isPagesHost() && isLoopbackProxy(base)) {
      _proxyReachable = false;
      _proxyProbeAt = Date.now();
      if (cb) cb(false);
      notify();
      return;
    }
    var url = base + "/health?t=" + Date.now();
    var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = setTimeout(function () { try { if (ctrl) ctrl.abort(); } catch (e) {} }, 4000);
    fetch(url, {
      cache: "no-store",
      signal: ctrl ? ctrl.signal : undefined,
      headers: proxyHeaders()
    }).then(function (r) {
      return r.json().then(function (j) {
        return { ok: r.ok, j: j };
      }).catch(function () { return { ok: r.ok, j: null }; });
    }).then(function (res) {
      clearTimeout(timer);
      var j = res.j || {};
      _proxyReachable = !!(res.ok && j.ok && (
        j.writeSupported === true ||
        j.lightsWrite === true ||
        j.service === "lights-write-proxy"
      ));
      _proxyProbeAt = Date.now();
      if (cb) cb(_proxyReachable);
      notify();
    }).catch(function () {
      clearTimeout(timer);
      _proxyReachable = false;
      _proxyProbeAt = Date.now();
      if (cb) cb(false);
      notify();
    });
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
   * Never invent LIVE. No DEMO overlays.
   */
  function gate(data) {
    data = data || (_liveCache && _liveCache.data) || null;
    var age = ageMs(data);
    var st = data && data.status;
    if (!data) {
      return {
        kind: "offline",
        live: false,
        needToken: true,
        label: "OFFLINE",
        writeSupported: false,
        data: null,
        ageMs: Infinity
      };
    }
    if (st === "need_token" || st === "need_creds" || st === "stage") {
      return {
        kind: "need_token",
        live: false,
        needToken: true,
        label: "NEED TOKEN",
        writeSupported: false,
        data: data,
        ageMs: age
      };
    }
    if (st === "live" && age <= LIVE_FRESH_MS) {
      var ws = !!data.writeSupported;
      var label = "LIVE";
      if (ws && _proxyReachable === false) label = "LIVE · PROXY OFF";
      else if (ws && _proxyReachable === null) label = "LIVE";
      else if (!ws) label = "LIVE · READ ONLY";
      return {
        kind: "live",
        live: true,
        needToken: false,
        label: label,
        writeSupported: ws,
        data: data,
        ageMs: age
      };
    }
    if (st === "live" && age > LIVE_FRESH_MS) {
      return {
        kind: "stale",
        live: false,
        needToken: false,
        label: "STALE",
        writeSupported: !!data.writeSupported,
        data: data,
        ageMs: age
      };
    }
    return {
      kind: "error",
      live: false,
      needToken: false,
      label: (st === "error" ? "ERROR" : "OFFLINE"),
      writeSupported: false,
      data: data,
      ageMs: age
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

  /* Legacy localStorage readers kept as no-ops for API compat — NEVER used as truth. */
  function loadDemo() { return {}; }
  function saveDemo(map) { /* killed · HARD LAW no DEMO */ }

  /**
   * Effective per-light state for UI — LIVE reads only.
   * Optimistic overlay while a write is in flight; never DEMO localStorage.
   */
  function effectiveLights() {
    var g = gate();
    var data = g.data || (_liveCache && _liveCache.data) || null;
    var roster = rosterFromLive(data);
    var reserved = reservedFromLive(data);
    var items = [];
    var liveOk = !!g.live;
    for (var i = 0; i < roster.length; i++) {
      var L = roster[i];
      var id = L.id;
      var opt = _optimistic[id];
      var on = null;
      var brightness = null;
      if (opt && typeof opt.on === "boolean") on = opt.on;
      else if (typeof L.on === "boolean") on = L.on;
      if (opt && typeof opt.brightness === "number") brightness = opt.brightness;
      else if (typeof L.brightness === "number") brightness = L.brightness;
      items.push({
        id: id,
        name: L.name || id,
        where: L.where || "",
        kind: L.kind || "bulb",
        on: on,
        brightness: brightness != null ? clampBright(brightness) : null,
        online: liveOk ? (L.online !== false) : null,
        source: liveOk ? "live" : "offline",
        pending: !!(opt && opt.pending),
        disabled: !canWrite()
      });
    }
    return {
      gate: g,
      lights: items,
      reserved: reserved,
      writeSupported: !!(g.writeSupported),
      proxyReachable: _proxyReachable,
      canWrite: canWrite(),
      source: liveOk ? "live" : (g.needToken ? "need_token" : "offline")
    };
  }

  function applyOptimistic(id, patch) {
    var cur = _optimistic[id] || {};
    var next = {
      on: typeof patch.on === "boolean" ? patch.on : cur.on,
      brightness: typeof patch.brightness === "number" ? clampBright(patch.brightness) : cur.brightness,
      pending: true,
      prev: cur.prev || null
    };
    if (!cur.prev) {
      var eff = effectiveLights();
      for (var i = 0; i < eff.lights.length; i++) {
        if (eff.lights[i].id === id) {
          next.prev = { on: eff.lights[i].on, brightness: eff.lights[i].brightness };
          break;
        }
      }
    }
    _optimistic[id] = next;
  }

  function clearOptimistic(id) {
    if (id) delete _optimistic[id];
    else _optimistic = {};
  }

  function rollbackOptimistic(id) {
    var o = _optimistic[id];
    if (o && o.prev) {
      _optimistic[id] = { on: o.prev.on, brightness: o.prev.brightness, pending: false, prev: null };
      setTimeout(function () { clearOptimistic(id); notify(); }, 50);
    } else {
      clearOptimistic(id);
    }
  }

  function postWrite(body) {
    var base = proxyBase();
    if (!base) {
      return Promise.reject(new Error("PROXY OFF · no lights write proxy URL"));
    }
    var url = base + "/api/lights/set";
    _writeInFlight++;
    return fetch(url, {
      method: "POST",
      cache: "no-store",
      headers: proxyHeaders(),
      body: JSON.stringify(body)
    }).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok || !j || !j.ok) {
          var err = new Error((j && j.error) || ("write HTTP " + r.status));
          err.payload = j;
          throw err;
        }
        return j;
      });
    }).finally(function () {
      _writeInFlight = Math.max(0, _writeInFlight - 1);
    });
  }

  function mergeWriteIntoCache(writePayload) {
    if (!writePayload || !writePayload.live) return;
    applyLivePayload(writePayload.live);
  }

  function setLight(id, patch) {
    var g = gate();
    if (!(g.live && g.writeSupported)) {
      notify();
      return null;
    }
    if (!canWrite()) {
      probeProxy();
      notify();
      return null;
    }
    applyOptimistic(id, patch || {});
    notify();
    var body = { id: id };
    if (patch && typeof patch.on === "boolean") body.on = patch.on;
    if (patch && typeof patch.brightness === "number") body.brightness = clampBright(patch.brightness);
    postWrite(body).then(function (j) {
      clearOptimistic(id);
      if (j.live) mergeWriteIntoCache(j);
      else fetchLive();
      notify();
    }).catch(function (err) {
      rollbackOptimistic(id);
      notify();
      try { console.warn("[HouseLights] write fail", err && err.message); } catch (e) {}
    });
    return _optimistic[id] || null;
  }

  function setAll(on) {
    var g = gate();
    if (!(g.live && g.writeSupported) || !canWrite()) {
      probeProxy();
      notify();
      return;
    }
    var eff = effectiveLights();
    for (var i = 0; i < eff.lights.length; i++) {
      applyOptimistic(eff.lights[i].id, { on: !!on });
    }
    notify();
    postWrite(on ? { allOn: true } : { allOff: true }).then(function (j) {
      clearOptimistic();
      if (j.live) mergeWriteIntoCache(j);
      else fetchLive();
      notify();
    }).catch(function () {
      for (var i = 0; i < eff.lights.length; i++) rollbackOptimistic(eff.lights[i].id);
      notify();
    });
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
    /* Clear optimistic once live snapshot catches up (no DEMO seed — HARD LAW). */
    if (g.live && data && Array.isArray(data.lights)) {
      for (var i = 0; i < data.lights.length; i++) {
        var L = data.lights[i];
        if (!L || !L.id || !_optimistic[L.id]) continue;
        var o = _optimistic[L.id];
        if (o.pending) continue;
        var matchOn = (typeof o.on !== "boolean") || o.on === L.on;
        var matchBr = (typeof o.brightness !== "number") || o.brightness === L.brightness;
        if (matchOn && matchBr) clearOptimistic(L.id);
      }
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
    ingestProxyFromQuery();
    fetchLive(function () { probeProxy(); });
    probeProxy();
    if (_pollTimer) return;
    _pollTimer = setInterval(function () {
      fetchLive();
      if (!_proxyProbeAt || Date.now() - _proxyProbeAt > 30000) probeProxy();
    }, LIVE_POLL_MS);
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
      meta.textContent = canWrite()
        ? ("Lights LIVE · " + eff.lights.length + " pads · write armed")
        : (g.live
          ? ("Lights LIVE · " + eff.lights.length + " pads · " + (g.writeSupported ? "PROXY OFF" : "READ ONLY"))
          : (g.needToken
            ? ("Lights · NEED TOKEN · controls dark")
            : ("Lights · " + g.label + " · controls dark")));
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
    var armed = canWrite();
    if (allOn) {
      allOn.disabled = !armed;
      allOn.style.pointerEvents = armed ? "auto" : "none";
      allOn.style.opacity = armed ? "1" : "0.45";
      allOn.style.cursor = armed ? "pointer" : "not-allowed";
    }
    if (allOff) {
      allOff.disabled = !armed;
      allOff.style.pointerEvents = armed ? "auto" : "none";
      allOff.style.opacity = armed ? "1" : "0.45";
      allOff.style.cursor = armed ? "pointer" : "not-allowed";
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
    if (canWrite()) return "LIVE";
    if (g.live && g.writeSupported && _proxyReachable === false) return "LIVE · PROXY OFF";
    if (g.live && g.writeSupported) return "LIVE · PROXY…";
    if (g.live) return "LIVE · READ ONLY";
    if (g.needToken) return "NEED TOKEN";
    return g.label || "OFFLINE";
  }

  function hubHonesty(g) {
    g = g || gate();
    if (canWrite()) return "LIVE";
    if (g.live && g.writeSupported && _proxyReachable === false) return "PROXY OFF";
    if (g.live && g.writeSupported) return "LIVE";
    if (g.live) return "READ ONLY";
    if (g.needToken) return "NEED TOKEN";
    return g.label || "OFFLINE";
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
    panel.classList.toggle("is-demo-write", false);
    panel.classList.toggle("is-proxy-off", !!(g.live && g.writeSupported && !canWrite()));
    panel.classList.toggle("is-disabled", !canWrite());

    var pill = doc.getElementById("hub-lights-pill");
    if (pill) {
      pill.textContent = hubHonesty(g);
      pill.classList.toggle("on", !!g.live);
      pill.classList.toggle("off", !g.live);
    }
    var sub = doc.getElementById("hub-lights-sub");
    if (sub) {
      sub.textContent = canWrite()
        ? "Kasa live · wall switches"
        : (g.live && g.writeSupported
          ? "PROXY OFF · open once with ?lightsProxy=… to enable taps"
          : (g.live
            ? "LIVE read · write not armed"
            : (g.needToken ? "NEED TOKEN · controls dark" : ((g.label || "OFFLINE") + " · controls dark"))));
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
        + '<button type="button" class="hub-sw-rocker' + onCls + (canWrite() ? "" : " is-disabled") + '" data-act="toggle" data-id="'
        + L.id + '" aria-pressed="' + (L.on ? "true" : "false") + '" aria-label="'
        + escapeHtml(L.name) + ' power"' + (canWrite() ? "" : " disabled") + '>'
        + '<span class="hub-sw-rocker-on">ON</span>'
        + '<span class="hub-sw-rocker-knob" aria-hidden="true"></span>'
        + '<span class="hub-sw-rocker-off">OFF</span>'
        + "</button>"
        + "</div>"
        + (dim
          ? ('<div class="hub-sw-dim">'
            + '<input class="hub-sw-bright light-bright" type="range" min="1" max="100" value="'
            + bright + '" data-id="' + L.id + '" aria-label="' + escapeHtml(L.name) + ' brightness"'
            + (canWrite() ? "" : " disabled") + ' />'
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
      if (!canWrite()) { probeProxy(); return; }
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
      if (!canWrite()) { probeProxy(); return; }
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
    var gateLab = hubHonesty(g);
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
    canWrite: canWrite,
    probeProxy: probeProxy,
    proxyBase: proxyBase,
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
