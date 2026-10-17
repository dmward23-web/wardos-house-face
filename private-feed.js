/* PRIVFEED1+2 · private runtime feed client. Load FIRST on every page (before any script that fetches data).
 *
 * The public site carries no calendar, kids-week, camera or house-device files. This shim answers the old same-origin URLs
 *   data/cal-live.json · data/cal-months.json · kids-week.json · data/kids-week.json · data/nest-snaps/<cam>.jpg
 *   data/lights-live.json · data/sensi-live.json · data/nest-live.json (PRIVFEED2)
 * from the house hub's token-only routes (/api/private/...), keeps a device-local cache, and when neither is
 * available answers 503 {"status":"offline"} so boards render EMPTY with an "offline" flag (never demo data).
 *
 * Token: localStorage "wardos-private-feed-token" or the hub device token "wardos-lights-proxy-token"
 *        (seed once with ?lightsProxyToken=… like the lights/taps hub). Never in git.
 * Hub:   localStorage "wardos-lights-proxy" (https only; already saved on every device that ran the lights tile),
 *        HUBPIN1: the hub is built in (house-hub.js, SHA-256 pinned origins); links cannot set it. Pair via QR.
 *        ?pfBase=http://127.0.0.1:<port> is honoured ONLY for a loopback http base (local tests / box preview).
 * ?pfOffline=1 forces the offline path (QA screenshots). */
(function (g) {
  "use strict";
  if (g.PrivateFeed) return;
  var ls; try { ls = g.localStorage; } catch (e) { ls = null; }
  var lsGet = function (k) { try { return ls ? ls.getItem(k) : null; } catch (e) { return null; } };
  var lsSet = function (k, v) { try { if (ls) ls.setItem(k, v); } catch (e) { /* quota */ } };
  var TOKEN_KEYS = ["wardos-private-feed-token", "wardos-lights-proxy-token"];
  var CACHE = "wardos-private:";
  var DEVICE = { "lights-live": 1, "sensi-live": 1, "nest-live": 1 }; /* house device state: own tile flags, short cache */
  var DEVICE_MAX_AGE = 15 * 60 * 1000;
  var MAX_AGE = 24 * 3600 * 1000, STALE_SHOW = 2 * 3600 * 1000, TIMEOUT = 6000;
  var origFetch = g.fetch ? g.fetch.bind(g) : null;
  function qs(n) { var m = String(g.location && g.location.search || "").match(new RegExp("[?&]" + n + "=([^&]+)")); return m ? decodeURIComponent(m[1]) : ""; }

  /* PRIVFEED3 · a pairing seed is stored once (16+ chars, same rule as the server), then stripped from the address bar */
  var seed = qs("lightsProxyToken") || qs("proxyToken");
  if (seed && /^[A-Za-z0-9_-]{16,}$/.test(seed)) lsSet("wardos-lights-proxy-token", seed);
  if (seed) stripParams(["lightsProxyToken", "proxyToken"]);
  function stripParams(keys) {
    try {
      var u = new URL(g.location.href), hit = false;
      keys.forEach(function (k) { if (u.searchParams.has(k)) { u.searchParams.delete(k); hit = true; } });
      if (hit && g.history && g.history.replaceState) g.history.replaceState(g.history.state, "", u.pathname + u.search + u.hash);
    } catch (e) { /* old browser: leave the URL */ }
  }
  function token() { for (var i = 0; i < TOKEN_KEYS.length; i++) { var t = lsGet(TOKEN_KEYS[i]); if (t) return t; } return ""; }
  var forceOffline = qs("pfOffline") === "1";

  var baseP = null;
  /* HUBPIN1 · the hub is built in (HouseHub allow-list); no ?lightsProxy= / ?proxy= link can set it.
     ?pfBase= (loopback http) is honoured only when this page itself is served from 127.0.0.1 / localhost. */
  function hubBase() {
    if (baseP) return baseP;
    var H = g.HouseHub, o = qs("pfBase");
    if (o && H && /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(o) && H.okForKey(o)) return (baseP = Promise.resolve(o.replace(/\/$/, "")));
    var b = H ? H.lights() : "";
    if (!b) return Promise.resolve(""); /* never cache "no hub" */
    return (baseP = Promise.resolve(b));
  }

  function tfetch(url, opts) {
    var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var t = setTimeout(function () { try { if (ctrl) ctrl.abort(); } catch (e) { /* */ } }, TIMEOUT);
    if (ctrl) opts.signal = ctrl.signal;
    return origFetch(url, opts).then(function (r) { clearTimeout(t); return r; }, function (e) { clearTimeout(t); throw e; });
  }

  var state = { status: "idle", lastOk: 0, stale: false, feeds: {} };
  function note(name, st, at) {
    state.feeds[name] = { status: st, at: at || 0 };
    var anyOffline = false, anyStale = false, newest = 0;
    for (var k in state.feeds) {
      var f = state.feeds[k];
      if (k.indexOf("nest/") === 0 || DEVICE[k]) continue; /* a missing cam still hides only its <img>, never the calendar */
      if (f.status === "offline") anyOffline = true;
      if (f.status === "stale") anyStale = true;
      if (f.at > newest) newest = f.at;
    }
    state.status = anyOffline ? "offline" : anyStale ? "stale" : "live";
    state.lastOk = newest;
    paintFlag();
  }

  /* name: cal-live | cal-months | kids-week → Promise<{data, status:"live"|"stale"|"offline", at}> */
  /* PRIVFEED3 · face law (house-face-law.js, loaded right after this file) on every calendar payload, live or cached */
  var LAW_FEEDS = { "cal-live": 1, "cal-months": 1, "kids-week": 1 };
  function law(name, d) { try { return (LAW_FEEDS[name] && g.HouseFaceLaw && g.HouseFaceLaw.cleanFeed) ? g.HouseFaceLaw.cleanFeed(name, d) : d; } catch (e) { return d; } }
  function getJSON(name) {
    /* PRIVFEED3 · a #pair= link is redeemed first (house-pair.js), so the first fetch already carries the new key */
    var wait = (g.HousePairing && g.HousePairing.ready) || Promise.resolve();
    return wait.then(function () { return getRaw(name); }, function () { return getRaw(name); }).then(function (res) { if (res && res.data) res.data = law(name, res.data); return res; });
  }
  function getRaw(name) {
    var cacheKey = CACHE + name;
    function fromCache(why) {
      var c = null; try { c = JSON.parse(lsGet(cacheKey) || "null"); } catch (e) { c = null; }
      if (c && c.data && Date.now() - c.at < (DEVICE[name] ? DEVICE_MAX_AGE : MAX_AGE)) { note(name, "stale", c.at); return { data: c.data, status: "stale", at: c.at, why: why }; }
      note(name, "offline", 0);
      return { data: null, status: "offline", at: 0, why: why };
    }
    if (forceOffline || !origFetch) return Promise.resolve(fromCache("forced"));
    var tok = token();
    if (!tok) return Promise.resolve(fromCache("no device token"));
    return hubBase().then(function (b) {
      if (!b) return fromCache("no hub");
      return tfetch(b + "/api/private/" + name + ".json", { cache: "no-store", headers: { "X-Private-Feed-Token": tok }, credentials: "omit", referrerPolicy: "no-referrer" })
        .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
        .then(function (d) {
          var at = Date.now();
          lsSet(cacheKey, JSON.stringify({ at: at, data: d }));
          note(name, "live", at);
          return { data: d, status: "live", at: at };
        })
        .catch(function (e) { return fromCache(String(e && e.message || e)); });
    });
  }

  var camUrls = {};
  function getCam(cam) {
    if (camUrls[cam]) return camUrls[cam];
    camUrls[cam] = (forceOffline || !origFetch || !token()) ? Promise.resolve("") : hubBase().then(function (b) {
      if (!b) return "";
      return tfetch(b + "/api/private/nest/" + cam + ".jpg", { cache: "no-store", headers: { "X-Private-Feed-Token": token() }, credentials: "omit", referrerPolicy: "no-referrer" })
        .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.blob(); })
        .then(function (bl) { return URL.createObjectURL(bl); })
        .catch(function () { delete camUrls[cam]; return ""; });
    });
    return camUrls[cam];
  }

  var JSON_RE = /(?:^|\/)(?:data\/)?(cal-live|cal-months|kids-week|lights-live|sensi-live|nest-live)\.json(?:[?#].*)?$/;
  var CAM_RE = /(?:^|\/)data\/nest-snaps\/(front-door|garage|backyard)\.jpg(?:[?#].*)?$/;
  function sameOriginPath(u) {
    try { var x = new URL(u, g.location.href); return x.origin === g.location.origin ? x.pathname + x.search : null; } catch (e) { return null; }
  }
  function feedName(u) {
    var p = sameOriginPath(u); if (!p) return null;
    var m = JSON_RE.exec(p); if (!m) return null;
    if (m[1] !== "kids-week" && !/data\/(cal-live|cal-months|lights-live|sensi-live|nest-live)\.json/.test(p)) return null;
    return m[1];
  }

  if (origFetch) {
    g.fetch = function (input, init) {
      var url = typeof input === "string" ? input : (input && input.url) || "";
      var name = feedName(url);
      if (!name) {
        var p = sameOriginPath(url), cm = p && CAM_RE.exec(p);
        if (cm) return getCam(cm[1]).then(function (blobUrl) {
          return blobUrl ? origFetch(blobUrl) : new Response("", { status: 503, statusText: "private feed offline" });
        });
        return origFetch(input, init);
      }
      return getJSON(name).then(function (res) {
        if (res.data) return new Response(JSON.stringify(res.data), { status: 200, headers: { "Content-Type": "application/json", "X-Private-Feed": res.status } });
        return new Response(JSON.stringify({ status: "offline", offline: true, privateFeed: "offline" }), { status: 503, headers: { "Content-Type": "application/json", "X-Private-Feed": "offline" } });
      });
    };
  }

  /* camera stills in markup: <img src="data/nest-snaps/<cam>.jpg"> */
  var BLANK = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
  function fixImg(img) {
    var src = img.getAttribute("data-pf-snap") || img.getAttribute("src") || "";  /* data-pf-snap: markup that never hits the static path */
    var p = sameOriginPath(src), m = p && CAM_RE.exec(p);
    if (!m || img.getAttribute("data-pf-cam") === m[1] + "|" + src) return;
    img.removeAttribute("data-pf-snap");
    img.setAttribute("data-pf-cam", m[1] + "|" + src);
    img.setAttribute("src", BLANK);
    getCam(m[1]).then(function (u) {
      if (u) { img.setAttribute("data-pf-cam", m[1] + "|" + u); img.setAttribute("src", u); img.removeAttribute("data-pf-offline"); }
      else { img.setAttribute("data-pf-offline", "1"); note("nest/" + m[1], "offline", 0); }
    });
  }
  function scanImgs(root) { var list = (root || document).querySelectorAll ? (root || document).querySelectorAll("img[src*='nest-snaps/'],img[data-pf-snap]") : []; for (var i = 0; i < list.length; i++) fixImg(list[i]); }
  if (typeof MutationObserver !== "undefined") {
    new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var m = muts[i];
        if (m.type === "attributes" && m.target.tagName === "IMG") fixImg(m.target);
        else for (var j = 0; j < m.addedNodes.length; j++) { var n = m.addedNodes[j]; if (n.nodeType === 1) { if (n.tagName === "IMG") fixImg(n); else scanImgs(n); } }
      }
    }).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ["src", "data-pf-snap"] });
  }

  /* offline / stale flag: one calm chip, never demo data */
  function hm(t) { var d = new Date(t); var h = d.getHours() % 12 || 12; return h + ":" + String(d.getMinutes()).padStart(2, "0") + (d.getHours() < 12 ? " AM" : " PM"); }
  var chip = null;
  function paintFlag() {
    var root = document.documentElement;
    if (!root) return;
    root.classList.toggle("pf-offline", state.status === "offline");
    root.classList.toggle("pf-stale", state.status === "stale");
    var show = state.status === "offline" || (state.status === "stale" && Date.now() - state.lastOk > STALE_SHOW);
    if (!document.body) { document.addEventListener("DOMContentLoaded", paintFlag, { once: true }); return; }
    if (!show) { if (chip) chip.style.display = "none"; return; }
    if (!chip) {
      chip = document.createElement("div");
      chip.className = "pf-flag";
      chip.setAttribute("role", "status");
      chip.setAttribute("data-private-feed-flag", "");
      chip.style.cssText = "position:fixed;left:16px;bottom:16px;z-index:2147483000;padding:8px 14px;border-radius:999px;" +
        "font:600 13px/1.2 Inter,system-ui,sans-serif;letter-spacing:.02em;color:rgba(255,255,255,.92);" +
        "background:rgba(20,24,30,.78);border:1px solid rgba(255,255,255,.18);backdrop-filter:blur(8px);pointer-events:none;transition:opacity .6s ease";
      document.body.appendChild(chip);
    }
    var dadOnly = !!document.querySelector("[data-dad-only]") || /sheet-dan\.html$/.test(g.location.pathname);
    var unpaired = !token() && !forceOffline; /* PRIVFEED3 · honest: this screen has no house key yet */
    chip.textContent = unpaired ? "This screen needs pairing · ask Dad for a code"
      : state.status === "offline"
      ? (dadOnly && state.lastOk ? "Calendar offline since " + hm(state.lastOk) : "Calendar offline")
      : "Calendar as of " + hm(state.lastOk);
    chip.style.display = "block";
  }
  var css = document.createElement("style");
  css.setAttribute("data-private-feed", "");
  /* PRIVFEED1 · offline: no kid time rows, no camera stills, no leave-by times (fail closed) */
  css.textContent = "html.pf-offline [data-mount-today-events],html.pf-offline [data-mount-sports],html.pf-offline [data-mount-school]," +
    "html.pf-offline [data-mount-appointments],html.pf-offline [data-mount-consume-next],html.pf-offline [data-mount-consume-ahead]," +
    "html.pf-offline [data-mount-dan-leave],html.pf-offline [data-mount-dan-week]{display:none!important}" +
    "img[data-pf-offline]{visibility:hidden}";
  (document.head || document.documentElement).appendChild(css);
  document.addEventListener("DOMContentLoaded", function () { scanImgs(document); });

  g.PrivateFeed = { hasHub: function () { return !!(g.HouseHub && (g.HouseHub.lights() || (qs("pfBase") && g.HouseHub.okForKey(qs("pfBase"))))); }, get: getJSON, cam: getCam, canSnap: function () { return !forceOffline && !!token() && !!origFetch; }, bindSnap: function (img, url) { img.setAttribute("data-pf-snap", url); fixImg(img); }, /* PRIVFEED3 · cam stills never hit the static path */ state: function () { return state; }, _hubBase: hubBase };
})(window);
