/* TAPSYNC1 · kids chore taps shared across every device via the house hub (same key + tunnel as lights).
   Load BEFORE kids-data.js. Local taps still work offline; they push when the hub answers. */
(function () {
  "use strict";
  var PREFIX = "house-checkoffs:";
  var KEY_RE = /^house-checkoffs:(hayes|harris|ainsley):(week:)?\d{4}-\d{2}-\d{2}$/;
  var META = "house-tapsync:meta", SEEDED = "house-tapsync:seeded", QUEUE = "house-tapsync:queue";
  var PROXY_LS = "wardos-lights-proxy", TOKEN_LS = "wardos-lights-proxy-token";
  var ls = window.localStorage, rawSet = ls.setItem.bind(ls);
  var lastTap = 0, pushTimer = null, applying = false, offset = 0; /* TAPSTICK1 · hub clock − device clock */

  function jget(k, d) { try { return JSON.parse(ls.getItem(k) || "") || d; } catch (e) { return d; } }
  function jset(k, v) { try { rawSet(k, JSON.stringify(v)); } catch (e) { /* */ } }
  function qs(n) { var m = location.search.match(new RegExp("[?&]" + n + "=([^&]+)")); return m ? decodeURIComponent(m[1]) : ""; }

  var tok = qs("lightsProxyToken") || qs("proxyToken");
  if (tok && /^[A-Za-z0-9_-]{8,}$/.test(tok)) rawSet(TOKEN_LS, tok);

  function token() { return ls.getItem(TOKEN_LS) || ""; }
  var proxyP = null;
  function proxy() {
    if (proxyP) return proxyP;
    proxyP = fetch("data/lights-live.json?t=" + Date.now(), { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : {}; })
      .then(function (d) { var wp = d && d.writeProxy ? String(d.writeProxy).replace(/\/$/, "") : ""; return /^https:\/\//.test(wp) ? wp : (ls.getItem(PROXY_LS) || ""); })
      .catch(function () { return ls.getItem(PROXY_LS) || ""; });
    return proxyP;
  }
  function call(method, body) {
    return proxy().then(function (base) {
      if (!base || (!token() && !/\.github\.io$/i.test(location.hostname))) throw new Error("nokey"); /* NOKEY1 */
      return fetch(base + "/api/taps", {
        method: method, cache: "no-store",
        headers: token() ? { "Content-Type": "application/json", "X-Lights-Proxy-Token": token() } : { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined
      }).then(function (r) { if (!r.ok) throw new Error("http " + r.status); return r.json(); });
    });
  }

  /* capture every tap write, whoever writes it */
  ls.setItem = function (k, v) {
    var before = null;
    if (!applying && KEY_RE.test(k)) before = jget(k, {});
    rawSet(k, v);
    if (before === null) return;
    var after = jget(k, {}), now = Date.now(), meta = jget(META, {}), q = jget(QUEUE, []), changed = false;
    Object.keys(Object.assign({}, before, after)).forEach(function (id) {
      if (!!before[id] === !!after[id]) return;
      meta[k + "|" + id] = now;
      q.push({ key: k, id: id, v: !!after[id], t: now });
      changed = true;
    });
    if (!changed) return;
    lastTap = now; jset(META, meta); jset(QUEUE, q.slice(-2000));
    clearTimeout(pushTimer); pushTimer = setTimeout(push, 600);
  };

  function seedChanges() {
    var out = [];
    for (var i = 0; i < ls.length; i++) {
      var k = ls.key(i);
      if (!KEY_RE.test(k)) continue;
      var st = jget(k, {});
      Object.keys(st).forEach(function (id) { if (st[id] === true) out.push({ key: k, id: id, v: true, t: 0 }); });
    }
    return out;
  }

  function applyServer(taps) {
    var meta = jget(META, {}), changed = false;
    var pending = {};
    jget(QUEUE, []).forEach(function (c) { pending[c.key + "|" + c.id] = 1; }); /* never overwrite an unsent tap */
    applying = true;
    try {
      Object.keys(taps || {}).forEach(function (k) {
        if (!KEY_RE.test(k)) return;
        var st = jget(k, {}), dirty = false;
        Object.keys(taps[k]).forEach(function (id) {
          var s = taps[k][id], mt = meta[k + "|" + id] || 0;
          if (pending[k + "|" + id]) return;
          var st0 = s.t ? s.t - offset : 0; /* hub time → this device's clock */
          if (st0 < mt) return;
          if (!!st[id] !== !!s.v) { st[id] = !!s.v; dirty = true; }
          meta[k + "|" + id] = st0;
        });
        if (dirty) { rawSet(k, JSON.stringify(st)); changed = true; }
      });
    } finally { applying = false; }
    jset(META, meta);
    return changed;
  }

  function setBadge(ok) {
    document.documentElement.setAttribute("data-tapsync", ok ? "on" : "local");
    var b = document.getElementById("tapsync-badge");
    /* The home map is a scene, not a debug screen. Phone and wall both. */
    if (ok || document.documentElement.classList.contains("ori-home")) { if (b) b.remove(); return; }
    if (!document.body) return;
    if (!b) {
      b = document.createElement("div"); b.id = "tapsync-badge";
      b.style.cssText = "position:fixed;left:8px;bottom:8px;z-index:99;padding:4px 10px;border-radius:999px;background:rgba(0,0,0,.6);color:#fff;font:600 11px/1.4 system-ui;opacity:.7;pointer-events:none";
      b.textContent = "taps: this device only";
      document.body.appendChild(b);
    }
  }

  function afterPull(res, sentAt) {
    if (res && typeof res.now === "number") offset = res.now - (sentAt ? (sentAt + Date.now()) / 2 : Date.now());
    setBadge(true);
    rawSet(SEEDED, "1"); /* SEED2 · once the hub answered, never re-send what we downloaded */
    if (applyServer(res.taps) && Date.now() - lastTap > 30000 && !jget(QUEUE, []).length) {
      var n = +(sessionStorage.getItem("tapsync-reloads") || 0);
      if (n < 3) { sessionStorage.setItem("tapsync-reloads", String(n + 1)); location.reload(); return; }
    }
    sessionStorage.setItem("tapsync-reloads", "0");
  }

  function push() {
    var q = jget(QUEUE, []);
    if (!ls.getItem(SEEDED)) q = seedChanges().concat(q);
    if (!q.length) return pull();
    var sentAt = Date.now();
    var sent = q.map(function (c) { return { key: c.key, id: c.id, v: c.v, t: c.t, age: c.t ? Math.max(0, sentAt - c.t) : undefined }; });
    return call("POST", { changes: sent }).then(function (res) {
      rawSet(SEEDED, "1");
      /* drop only what we sent; taps made while in flight stay queued */
      var sentKeys = {}; q.forEach(function (c) { sentKeys[c.key + "|" + c.id + "|" + c.t] = 1; });
      jset(QUEUE, jget(QUEUE, []).filter(function (c) { return !sentKeys[c.key + "|" + c.id + "|" + c.t]; }));
      afterPull(res, sentAt);
    }).catch(function () { setBadge(false); });
  }
  function pull() {
    var sentAt = Date.now();
    return call("GET").then(function (res) { afterPull(res, sentAt); }).catch(function () { setBadge(false); });
  }

  function tick() { if (document.visibilityState !== "hidden") push(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", tick); else tick();
  setInterval(tick, 20000);
  document.addEventListener("visibilitychange", tick);
  window.HouseTapSync = { push: push, pull: pull };
})();
