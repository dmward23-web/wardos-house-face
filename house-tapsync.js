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
  /* HUBHEAL1 · a slow or dead hub can never hang the page or strand taps:
     every request times out, a failed hub lookup is retried (not cached),
     failures retry fast with backoff, and we resync on online / visible / pageshow. */
  var TIMEOUT_MS = 6000, POLL_MS = 10000, inflight = null, retryTimer = null, fails = 0;
  function tfetch(url, opts) {
    opts = opts || {};
    var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = setTimeout(function () { try { if (ctrl) ctrl.abort(); } catch (e) { /* */ } }, TIMEOUT_MS);
    if (ctrl) opts.signal = ctrl.signal;
    return fetch(url, opts).then(function (r) { clearTimeout(timer); return r; }, function (e) { clearTimeout(timer); throw e; });
  }

  function jget(k, d) { try { return JSON.parse(ls.getItem(k) || "") || d; } catch (e) { return d; } }
  function jset(k, v) { try { rawSet(k, JSON.stringify(v)); } catch (e) { /* */ } }
  function qs(n) { var m = location.search.match(new RegExp("[?&]" + n + "=([^&]+)")); return m ? decodeURIComponent(m[1]) : ""; }

  /* SEEDGUARD1 · a legacy ?lightsProxyToken= / ?nestProxyToken= seed is saved ONLY when this screen holds no device key yet, so a crafted link can never replace (unpair) a paired screen's key. The param is still stripped. */
  function noDeviceKey() { var ks = ["wardos-lights-proxy-token", "wardosNestProxyToken", "wardos-private-feed-token"]; try { for (var i = 0; i < ks.length; i++) { if (localStorage.getItem(ks[i])) return false; } return true; } catch (e) { return false; } }
  var tok = qs("lightsProxyToken") || qs("proxyToken");
  if (tok && /^[A-Za-z0-9_-]{16,}$/.test(tok) && noDeviceKey()) rawSet(TOKEN_LS, tok); /* PRIVFEED3 · 16+ like the server */
  if (tok) { try { var _u = new URL(location.href); ["lightsProxyToken", "proxyToken"].forEach(function (k) { _u.searchParams.delete(k); }); history.replaceState(history.state, "", _u.pathname + _u.search + _u.hash); } catch (e) { /* */ } }

  function token() { return ls.getItem(TOKEN_LS) || ""; }
  var proxyP = null;
  function proxy() { /* HUBPIN1 · built-in hub only, never from data or a link */
    var H = window.HouseHub;
    return Promise.resolve(H ? H.lights() : "");
  }
  function call(method, body) {
    return proxy().then(function (base) {
      if (!base || !token()) throw new Error("nokey"); /* HUBPIN1 · the hub checks the key only; no key, no request */
      return tfetch(base + "/api/taps", {
        method: method, cache: "no-store",
        headers: token() && window.HouseHub && HouseHub.okForKey(base) ? { "Content-Type": "application/json", "X-Lights-Proxy-Token": token() } : { "Content-Type": "application/json" },
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
    clearTimeout(pushTimer); pushTimer = setTimeout(function () { if (inflight) inflight.then(sync); else sync(); }, 600);
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
    /* LAW8C1 · glass never shows sync chrome: the state lives on <html data-tapsync> for the health checks only */
    if (b) b.remove(); return;
    if (!document.body) return;
    if (!b) {
      b = document.createElement("div"); b.id = "tapsync-badge";
      /* P1FIX Prism P1 · a page with a [data-tapsync-slot] (Dad) carries the tag in its footer, in flow, so it never sits over a list */
      var slot = document.querySelector("[data-tapsync-slot]");
      b.style.cssText = slot
        ? "display:inline-block;padding:4px 10px;border-radius:999px;background:rgba(0,0,0,.6);color:#fff;font:600 13px/1.4 system-ui;opacity:.85;pointer-events:none"
        : "position:fixed;left:8px;bottom:8px;z-index:99;padding:4px 10px;border-radius:999px;background:rgba(0,0,0,.6);color:#fff;font:600 11px/1.4 system-ui;opacity:.7;pointer-events:none";
      b.textContent = "taps: this device only";
      (slot || document.body).appendChild(b);
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

  function ok() { fails = 0; clearTimeout(retryTimer); retryTimer = null; }
  function failed() {
    setBadge(false);
    proxyP = null; /* re-read writeProxy next time (address may have moved) */
    fails++;
    clearTimeout(retryTimer);
    retryTimer = setTimeout(sync, Math.min(POLL_MS, 1000 * Math.pow(2, Math.min(fails, 4)))); /* 2s,4s,8s,10s… */
  }
  function sync() {
    if (inflight) return inflight;
    inflight = push().then(function () { inflight = null; }, function () { inflight = null; });
    return inflight;
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
      ok();
      afterPull(res, sentAt);
    }).catch(failed);
  }
  function pull() {
    var sentAt = Date.now();
    return call("GET").then(function (res) { ok(); afterPull(res, sentAt); }).catch(failed);
  }

  function tick() { if (document.visibilityState !== "hidden") sync(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", tick); else tick();
  setInterval(tick, POLL_MS);
  document.addEventListener("visibilitychange", tick);
  window.addEventListener("online", tick);
  window.addEventListener("focus", tick);
  window.addEventListener("pageshow", tick);
  window.HouseTapSync = { push: sync, pull: pull, state: function () { return { fails: fails, queued: jget(QUEUE, []).length }; } };
})();
