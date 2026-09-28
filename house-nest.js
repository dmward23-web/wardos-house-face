/* House Face · Nest / Google Home cams
   Poll data/nest-live.json (Atlas nest-fetch → Pages).
   NEVER invent video. LIVE pulse only when status=live + fresh + ≥1 snapshotUrl.
   See NEST-LIVE.md */
(function (global) {
  "use strict";

  var LIVE_URL = "data/nest-live.json";
  var LIVE_FRESH_MS = 30 * 60 * 1000;
  var LIVE_POLL_MS = 60 * 1000;
  var DOCS = "NEST-LIVE.md";

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

  function hasFreshSnapshots(data) {
    if (!data || data.status !== "live") return false;
    if (ageMs(data) > LIVE_FRESH_MS) return false;
    var cams = data.cameras || [];
    for (var i = 0; i < cams.length; i++) {
      if (cams[i] && cams[i].snapshotUrl) return true;
    }
    return false;
  }

  /** Gate for UI. Never returns live:true without fresh snapshots. */
  function gate(data) {
    if (!data) {
      return { live: false, needToken: true, label: "STUB · NO JSON", reason: "missing nest-live.json" };
    }
    if (data.status === "need_token") {
      return { live: false, needToken: true, label: "STUB · NEED TOKEN", reason: data.error || "need SDM token" };
    }
    if (data.status === "error") {
      return { live: false, needToken: false, label: "STUB · ERROR", reason: data.error || "error" };
    }
    if (data.status === "live") {
      if (hasFreshSnapshots(data)) {
        return { live: true, needToken: false, label: "LIVE", reason: null };
      }
      var fresh = ageMs(data) <= LIVE_FRESH_MS;
      if (fresh) {
        return {
          live: false,
          needToken: false,
          label: "LINKED · NO SNAP",
          reason: "SDM live but no embeddable snapshotUrl yet (see NEST-LIVE.md)",
        };
      }
      return { live: false, needToken: false, label: "STUB · STALE", reason: "nest-live.json stale" };
    }
    return { live: false, needToken: true, label: "STUB", reason: "unknown status" };
  }

  function notify() {
    for (var i = 0; i < _listeners.length; i++) {
      try { _listeners[i](); } catch (e) { /* */ }
    }
  }

  function onChange(fn) {
    if (typeof fn === "function") _listeners.push(fn);
  }

  function cachedData() {
    return _liveCache && _liveCache.data ? _liveCache.data : null;
  }

  function fetchLive() {
    return fetch(LIVE_URL + "?t=" + Date.now(), { cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (data) {
        _liveCache = { at: Date.now(), data: data };
        notify();
        return data;
      })
      .catch(function () {
        if (!_liveCache) _liveCache = { at: Date.now(), data: null };
        notify();
        return null;
      });
  }

  var _pollTimer = null;
  function startPolling() {
    fetchLive();
    if (_pollTimer) return;
    _pollTimer = setInterval(fetchLive, LIVE_POLL_MS);
  }

  function glyphFor(cam) {
    var n = String((cam && (cam.where || cam.name)) || "").toLowerCase();
    if (/entry|front|door/.test(n)) return "🚪";
    if (/drive/.test(n)) return "🚗";
    if (/yard|back|patio/.test(n)) return "🌳";
    if (/garage/.test(n)) return "🏠";
    return "📷";
  }

  function paintPads(root) {
    root = root || document;
    var grid = root.querySelector(".cam-grid");
    if (!grid) return;
    var data = cachedData();
    var g = gate(data);
    var cams = (data && data.cameras && data.cameras.length) ? data.cameras : null;
    var articles = grid.querySelectorAll(".cam");

    var zoneMeta = root.querySelector(".cam-zone .zone-meta");
    if (zoneMeta) {
      if (g.live) zoneMeta.textContent = "LIVE · snapshots";
      else if (g.label.indexOf("LINKED") === 0) zoneMeta.textContent = "SDM linked · no snapshot URLs";
      else if (g.needToken) zoneMeta.textContent = "4 pads · STUB · need SDM token";
      else zoneMeta.textContent = g.label;
    }

    var path = root.querySelector(".cam-path");
    if (path) {
      if (g.live) {
        path.textContent = "Nest SDM live · fresh snapshots · see " + DOCS;
      } else if (g.label.indexOf("LINKED") === 0) {
        path.innerHTML = "SDM auth ok · device names live · <strong>no embeddable snapshot yet</strong> (GenerateImage needs eventId + auth header; bridge go2rtc/Scrypted HTTPS into <code>snapshotUrl</code>) · " + DOCS;
      } else {
        path.innerHTML = "WORKING path staged · no fake LIVE video · hand Atlas Nest refresh_token via secret-request → <code>~/.config/wardos/nest-refresh.token</code> + <code>nest-sdm.json</code> · see <code>" + DOCS + "</code>";
      }
    }

    var note = root.getElementById("cam-next-step");
    if (note) {
      if (g.live) {
        note.innerHTML = "<strong>Cams = LIVE.</strong> Snapshots from nest-live.json · polling ~60s.";
      } else if (g.needToken) {
        note.innerHTML = "<strong>Cams = STUB (need token).</strong> Stage ready: <code>scripts/nest-fetch.mjs</code> + <code>" + DOCS + "</code>. Dan: enable Google Device Access (SDM) → hand Atlas refresh_token via <em>secret-request</em> (masked). Until then pads stay honest STUB — no invented video.";
      } else if (g.label.indexOf("LINKED") === 0) {
        note.innerHTML = "<strong>Cams = linked · no snap.</strong> SDM devices listed; snapshotUrl still null (Pages cannot use auth-gated GenerateImage URLs). Bridge HTTPS snapshots or wait for event images proxied by Atlas.";
      } else {
        note.innerHTML = "<strong>Cams = " + g.label + ".</strong> " + (g.reason || "") + " · see <code>" + DOCS + "</code>.";
      }
    }

    if (!articles || !articles.length) return;

    for (var i = 0; i < articles.length; i++) {
      var el = articles[i];
      var cam = cams && cams[i] ? cams[i] : null;
      var feed = el.querySelector(".cam-feed");
      var liveEl = el.querySelector(".cam-live");
      var stubEl = el.querySelector(".cam-stub");
      var glyph = el.querySelector(".cam-glyph");
      var nameEl = el.querySelector(".cam-name");
      var whereEl = el.querySelector(".cam-where");
      var img = feed && feed.querySelector("img.cam-snap");

      if (cam) {
        if (nameEl) nameEl.textContent = cam.name || "Nest cam";
        if (whereEl) whereEl.textContent = cam.where || "Cam";
        if (glyph) glyph.textContent = glyphFor(cam);
        el.setAttribute("aria-label", (cam.name || "camera") + " camera");
      }

      var showLive = g.live && cam && cam.snapshotUrl;
      if (liveEl) {
        if (showLive) {
          liveEl.className = "cam-live on";
          liveEl.innerHTML = "<i></i>LIVE";
        } else if (g.label.indexOf("LINKED") === 0 && cam && !String(cam.id || "").startsWith("stub-")) {
          liveEl.className = "cam-live stub";
          liveEl.innerHTML = "<i></i>LINKED · NO SNAP";
        } else {
          liveEl.className = "cam-live stub";
          liveEl.innerHTML = "<i></i>STUB · NO FEED";
        }
      }

      if (stubEl) {
        if (showLive) stubEl.textContent = "SDM";
        else if (g.needToken) stubEl.textContent = "Need SDM token";
        else if (g.label.indexOf("LINKED") === 0) stubEl.textContent = "No snapshot URL";
        else stubEl.textContent = g.label;
      }

      if (feed) {
        if (showLive) {
          if (!img) {
            img = document.createElement("img");
            img.className = "cam-snap";
            img.alt = (cam && cam.name) || "Nest snapshot";
            img.decoding = "async";
            feed.insertBefore(img, feed.firstChild);
          }
          if (img.getAttribute("src") !== cam.snapshotUrl) img.src = cam.snapshotUrl;
          if (glyph) glyph.style.display = "none";
        } else {
          if (img) img.remove();
          if (glyph) glyph.style.display = "";
        }
      }
    }

    var bannerTitle = root.querySelector(".banner-title");
    var bannerSub = root.querySelector(".banner-sub");
    if (bannerTitle) {
      if (g.live) bannerTitle.textContent = "Climate + Nest cams LIVE";
      else if (g.label.indexOf("LINKED") === 0) bannerTitle.textContent = "Climate LIVE · Nest linked · no snap";
      else bannerTitle.textContent = "Climate LIVE glass · Nest cams STUB";
    }
    if (bannerSub) {
      if (g.live) bannerSub.textContent = "Sensi + Nest snapshots · Elo 3202L";
      else bannerSub.textContent = "Sensi polls live JSON · Nest needs SDM token or snapshot bridge · no fake video";
    }
  }

  global.HouseNest = {
    gate: function () { return gate(cachedData()); },
    cachedData: cachedData,
    fetchLive: fetchLive,
    startPolling: startPolling,
    onChange: onChange,
    paintPads: paintPads,
    docs: DOCS,
  };
})(typeof window !== "undefined" ? window : globalThis);
