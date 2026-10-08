/* SPOTIFY1 · House Face · Spotify now-playing + control (Dan 10/3: "Add my Spotify to the main house
 * control board with control and press into Ori control").
 *
 * Path: this screen → box proxy (same hub key + tunnel as lights/Sensi) → Spotify Web API.
 * The box keeps the ONE Spotify login for the house (PKCE, no secret); screens never hold a Spotify
 * token. Every screen that already has the hub key just works once Spotify is connected once.
 *
 * window.HouseSpotify: start(opts) · onChange(fn) · get() · act(action, args) · connect(returnTo)
 *   · setup(clientId) · library() · devices() · progress() · mountTiles(root) · openPlayer(el, ev)
 * SPOTIFY2 (Dan 10/3 6:29–6:30): browse(kind, params) for search / library / queue / detail pages, like + queue
 *   actions, and HOME AUDIO rooms (the house speakers as Spotify Connect devices; box remembers sleepers).
 * Honest gate: LIVE only from a real box answer. No DEMO, no fake now-playing. */
(function () {
  "use strict";
  var PROXY_LS = "wardos-lights-proxy";
  var KEY_LS = "wardos-lights-proxy-token";
  var DEFAULT_PROXY = "http://127.0.0.1:8788";
  var PLAYER = "sheet-spotify.html";

  function qs(n) { try { return new URL(location.href).searchParams.get(n); } catch (e) { return null; } }
  function isPages() { return /\.github\.io$/i.test(location.hostname || ""); }
  function isLoop(u) { return /^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/i.test(String(u || "")); }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* */ } }

  var liveProxy = "";
  function loadLiveProxy() {
    return fetch("data/lights-live.json?sp=" + Date.now(), { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      var wp = d && d.writeProxy ? String(d.writeProxy).replace(/\/$/, "") : "";
      if (!wp || (isPages() && isLoop(wp))) return;
      liveProxy = wp;
      /* PROXYFOLLOW1 (same rule as house-lights.js): always follow the newest public tunnel address */
      if (/^https:\/\//i.test(wp) && lsGet(PROXY_LS) !== wp) lsSet(PROXY_LS, wp);
    }).catch(function () {});
  }
  function base() {
    var q = qs("spotifyProxy") || qs("lightsProxy") || qs("proxy");
    if (q) return String(q).replace(/\/$/, "");
    var ls = lsGet(PROXY_LS);
    if (ls && !(isPages() && isLoop(ls))) return String(ls).replace(/\/$/, "");
    if (liveProxy) return liveProxy;
    return isPages() ? "" : DEFAULT_PROXY;
  }
  function key() { return qs("lightsProxyToken") || qs("proxyToken") || lsGet(KEY_LS) || ""; }

  function req(method, path, body, timeoutMs) {
    var b = base(), k = key();
    if (!k) return Promise.resolve({ ok: false, error: "no_key" });
    if (!b) return Promise.resolve({ ok: false, error: "offline" });
    var ctl = window.AbortController ? new AbortController() : null;
    var to = setTimeout(function () { if (ctl) ctl.abort(); }, timeoutMs || 12000);
    var h = { Accept: "application/json", "X-Lights-Proxy-Token": k };
    if (body) h["Content-Type"] = "application/json";
    return fetch(b + path, { method: method, headers: h, body: body ? JSON.stringify(body) : undefined, cache: "no-store", signal: ctl ? ctl.signal : undefined })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (r.status === 401) return { ok: false, error: "bad_key" };
          if (!r.ok && j && j.ok === undefined) j.ok = false;
          if (!r.ok && !j.error) j.error = "http_" + r.status;
          return j;
        });
      })
      .catch(function () { return { ok: false, error: "offline" }; })
      .then(function (j) { clearTimeout(to); return j; });
  }

  /* ---------- state ---------- */
  var S = { phase: "loading", snap: null, at: 0, msg: "", busy: 0, devices: null, offlineStreak: 0 };
  var listeners = [];
  function emit() { listeners.forEach(function (fn) { try { fn(S); } catch (e) { /* */ } }); }
  function phaseOf(j) {
    if (!j) return "offline";
    if (j.error === "no_key" || j.error === "offline" || j.error === "bad_key") return j.error;
    if (j.ok === false && j.state !== "error") return "error";
    return j.state || "error";
  }
  function absorb(j) {
    var ph = phaseOf(j);
    if (ph === "offline" && S.snap && S.offlineStreak < 2) { S.offlineStreak++; return; } /* ride out one tunnel blip */
    S.offlineStreak = ph === "offline" ? (S.offlineStreak || 0) + 1 : 0;
    S.phase = ph;
    S.msg = j && j.message || "";
    S.err = j && j.error || "";
    if (j && (j.player || j.setup)) { S.snap = j; S.at = Date.now(); }
    if (j && j.devices) S.devices = j.devices;
    if (j && j.rooms) S.rooms = j.rooms;
    emit();
  }

  var timer = 0, opts = { fast: false }, started = false, inflight = false, actGen = 0;
  function interval() {
    var p = S.phase;
    if (p === "playing") return opts.fast ? 2500 : 5000;
    if (p === "paused" || p === "idle") return opts.fast ? 5000 : 12000;
    if (p === "offline") return 15000;
    if (p === "no_key" || p === "bad_key") return 60000;
    return 20000; /* need_app / need_auth / error */
  }
  function schedule(ms) { clearTimeout(timer); if (document.hidden) return; timer = setTimeout(poll, ms == null ? interval() : ms); }
  function poll() {
    if (inflight) return schedule(600);
    if (S.busy) return schedule(800);
    inflight = true;
    var gen = actGen;
    var p = req("GET", "/api/spotify" + (opts.devices ? "?devices=1" : ""), null, 10000);
    p.then(function (j) {
      inflight = false;
      if (gen !== actGen || S.busy) return schedule(); /* a command ran meanwhile: this read is older than its answer */
      if (j && j.error === "offline" && !liveProxy) return loadLiveProxy().then(function () { absorb(j); schedule(); });
      absorb(j); schedule();
    });
  }
  function start(o) {
    if (o) for (var k in o) opts[k] = o[k];
    if (started) { schedule(0); return api; }
    started = true;
    document.addEventListener("visibilitychange", function () { if (!document.hidden) schedule(0); else clearTimeout(timer); });
    window.addEventListener("pageshow", function () { schedule(0); });
    window.addEventListener("storage", function (e) { if (e.key === KEY_LS || e.key === PROXY_LS) schedule(0); });
    loadLiveProxy().then(function () { poll(); });
    return api;
  }

  function player() { return S.snap && S.snap.player || null; }
  function progress() {
    var p = player();
    if (!p || !p.item) return { ms: 0, dur: 0, f: 0 };
    var ms = (p.progressMs || 0) + (p.isPlaying ? Date.now() - (S.at || Date.now()) : 0);
    var dur = p.item.durationMs || 0;
    if (dur) ms = Math.min(ms, dur);
    return { ms: ms, dur: dur, f: dur ? ms / dur : 0 };
  }

  /* optimistic tweak + real call + real read-back; rollback on fail */
  function act(action, args) {
    args = args || {};
    var p = player(), before = S.snap ? JSON.parse(JSON.stringify(S.snap)) : null, beforePhase = S.phase, beforeAt = S.at;
    if (action === "toggle") action = p && p.isPlaying ? "pause" : "play";
    if (action === "transfer" && S.rooms) S.rooms.forEach(function (r) { r.active = r.id === args.deviceId; });
    if (opts.devices) args.withRooms = true;
    var body = { action: action };
    for (var k in args) body[k] = args[k];
    if (p && p.active) {
      var cur = progress().ms;
      if (action === "pause") { p.isPlaying = false; p.progressMs = cur; S.at = Date.now(); S.phase = "paused"; }
      if (action === "play" && !args.contextUri && !args.uris) { p.isPlaying = true; p.progressMs = cur; S.at = Date.now(); S.phase = "playing"; }
      if (action === "seek") { p.progressMs = args.positionMs; S.at = Date.now(); }
      if (action === "volume" && p.device && (!args.deviceId || args.deviceId === p.device.id)) p.device.volume = args.volume;
      if (action === "volume" && S.rooms) S.rooms.forEach(function (r) { if (r.id === (args.deviceId || (p.device && p.device.id))) r.volume = args.volume; });
      if ((action === "like" || action === "unlike") && p.item && p.item.uri === args.uri) p.item.saved = action === "like";
      if (action === "shuffle") p.shuffle = !!args.state;
      if (action === "repeat") p.repeat = args.state;
    }
    S.busy++; S.pending = action; actGen++; emit();
    clearTimeout(timer);
    return req("POST", "/api/spotify/control", body, 15000).then(function (j) {
      S.busy = Math.max(0, S.busy - 1); S.pending = ""; actGen++;
      if (j && j.ok !== false && (j.player || j.setup)) { absorb(j); S.flash = ""; }
      else {
        if (before) { S.snap = before; S.phase = beforePhase; S.at = beforeAt; }
        S.flash = (j && j.message) || (j && j.error === "offline" ? "House box didn't answer. Try again." : j && j.error === "bad_key" ? "This screen's key didn't work." : "Spotify didn't take that.");
        S.flashAt = Date.now();
        emit();
      }
      schedule(j && j.ok !== false ? 1200 : 3000);
      return j;
    });
  }
  function connect(returnTo) {
    return req("POST", "/api/spotify/auth-start", { returnTo: returnTo || PLAYER }).then(function (j) {
      if (j && j.url) { location.href = j.url; return j; }
      S.flash = (j && j.message) || "Couldn't start the Spotify sign-in."; S.flashAt = Date.now(); emit(); return j;
    });
  }
  function setup(clientId, returnTo) {
    return req("POST", "/api/spotify/setup", { clientId: String(clientId || "").trim(), connect: true, returnTo: returnTo || PLAYER }).then(function (j) {
      if (j && j.url) { location.href = j.url; }
      return j;
    });
  }
  function library() { return req("GET", "/api/spotify/library", null, 15000); }
  /* SPOTIFY2 · kind: search|liked|playlists|albums|artists|shows|recent|queue|album|artist|playlist|show */
  function browse(kind, params) {
    var q = "kind=" + encodeURIComponent(kind);
    for (var k in (params || {})) if (params[k] != null && params[k] !== "") q += "&" + encodeURIComponent(k) + "=" + encodeURIComponent(params[k]);
    return req("GET", "/api/spotify/browse?" + q, null, 15000);
  }
  function rooms() { return S.rooms || (S.snap && S.snap.rooms) || null; }
  function devices() { return req("GET", "/api/spotify/devices", null, 10000).then(function (j) { if (j && j.devices) { S.devices = j.devices; emit(); } return j; }); }

  /* ---------- helpers for painters ---------- */
  function fmt(ms) { ms = Math.max(0, ms || 0); var s = Math.floor(ms / 1000), m = Math.floor(s / 60); s = s % 60; return m + ":" + (s < 10 ? "0" : "") + s; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  var DEV_ICON = { Speaker: "spk", Smartphone: "phone", Computer: "pc", TV: "tv", CastVideo: "tv", CastAudio: "spk", AVR: "spk", Tablet: "phone", Automobile: "car", GameConsole: "tv" };
  var ICONS = {
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>',
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="5" width="4" height="14" rx="1.2" fill="currentColor"/><rect x="13.5" y="5" width="4" height="14" rx="1.2" fill="currentColor"/></svg>',
    next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 5.5v13l9-6.5z" fill="currentColor"/><rect x="16" y="5.5" width="2.8" height="13" rx="1" fill="currentColor"/></svg>',
    previous: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.5 5.5v13l-9-6.5z" fill="currentColor"/><rect x="5.2" y="5.5" width="2.8" height="13" rx="1" fill="currentColor"/></svg>',
    shuffle: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h3.5c2 0 3.2 1 4.3 2.6l2.4 3.8c1 1.6 2.3 2.6 4.3 2.6H21M17.5 13.5 21 17l-3.5 3.5M3 17h3.5c1.3 0 2.3-.4 3-1.1M13.6 8.1c.7-.7 1.7-1.1 3-1.1H21M17.5 3.5 21 7l-3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    repeat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11V9.5A3.5 3.5 0 0 1 7.5 6H19m-3-3 3 3-3 3M20 13v1.5a3.5 3.5 0 0 1-3.5 3.5H5m3 3-3-3 3-3" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    vol: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a7.6 7.6 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    spk: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="3" width="12" height="18" rx="3" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="14" r="3.2" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="7.3" r="1.2" fill="currentColor"/></svg>',
    phone: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="2.5" width="10" height="19" rx="2.6" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M10.5 18.3h3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    pc: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4.5" width="18" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8.5 20h7M12 16.5V20" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    tv: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="5" width="19" height="12.5" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 20.5h8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    car: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 15.5V12l2-4.5h12L20 12v3.5M4 15.5h16M4 15.5v2.5M20 15.5v2.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8" cy="13" r="1" fill="currentColor"/><circle cx="16" cy="13" r="1" fill="currentColor"/></svg>',
    heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.3s-7.6-4.6-7.6-10.2A4.3 4.3 0 0 1 12 7.4a4.3 4.3 0 0 1 7.6 2.7c0 5.6-7.6 10.2-7.6 10.2z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/></svg>',
    heartOn: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.3s-7.6-4.6-7.6-10.2A4.3 4.3 0 0 1 12 7.4a4.3 4.3 0 0 1 7.6 2.7c0 5.6-7.6 10.2-7.6 10.2z" fill="currentColor"/></svg>',
    addq: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6.5h11M4 11.5h11M4 16.5h7M18 13v7M14.5 16.5h7" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>',
    queue: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 11h16M4 16h9" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><path d="M16 14.5v6l4.5-3z" fill="currentColor"/></svg>',
    search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M15 15l5 5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>',
    lib: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4v16M9.5 4v16M14 4.8l5 14.6" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>',
    clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M12 7.5V12l3 2" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>',
    home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11 12 4.5l8 6.5v8.5h-5.5v-5h-5v5H4z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/></svg>',
    group: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="6" width="7" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><rect x="14.5" y="6" width="7" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="6" cy="13.5" r="1.8" fill="currentColor"/><circle cx="18" cy="13.5" r="1.8" fill="currentColor"/><path d="M10.5 9.5c1-.7 2-.7 3 0" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    minus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12M12 6v12" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    note: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18.5V6.2l10-2.2v12" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><circle cx="6.6" cy="18.4" r="2.6" fill="currentColor"/><circle cx="16.6" cy="16" r="2.6" fill="currentColor"/></svg>'
  };
  function devIcon(d) { return d && d.group ? ICONS.group : ICONS[DEV_ICON[d && d.type] || "spk"]; }

  /* ---------- home-board tile ---------- */
  var TILE_HTML =
    '<div class="sp-aura" aria-hidden="true"></div>' +
    '<div class="sp-art-wrap" aria-hidden="true"><div class="sp-art-ph">' + ICONS.note + '</div><img class="sp-art" alt="" decoding="async" referrerpolicy="no-referrer" hidden></div>' +
    '<div class="sp-meta">' +
      '<div class="sp-kick"><span class="sp-brand">Music</span><span class="sp-sub">Spotify · Home audio</span><span class="sp-eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span class="sp-pill">Wait</span></div>' +
      '<div class="sp-title">Spotify</div>' +
      '<div class="sp-artist"></div>' +
      '<div class="sp-dev"></div>' +
      '<div class="sp-prog" aria-hidden="true"><i></i></div>' +
    '</div>' +
    '<div class="sp-ctrls" role="group" aria-label="Spotify controls">' +
      '<button type="button" class="sp-btn" data-sp-act="previous" aria-label="Previous track">' + ICONS.previous + '</button>' +
      '<button type="button" class="sp-btn sp-play" data-sp-act="toggle" aria-label="Play">' + ICONS.play + '</button>' +
      '<button type="button" class="sp-btn" data-sp-act="next" aria-label="Next track">' + ICONS.next + '</button>' +
    '</div>' +
    '<div class="sp-rooms" role="group" aria-label="Home audio rooms" hidden></div>' +
    '<button type="button" class="sp-connect" data-sp-act="connect" hidden>Connect Spotify</button>' +
    '<div class="sp-flash" role="status" aria-live="polite"></div>';

  var tiles = [];
  function mountTiles(root) {
    (root || document).querySelectorAll("[data-sp-tile]").forEach(function (el) {
      if (el._sp) return; el._sp = 1;
      el.innerHTML = TILE_HTML;
      el.setAttribute("role", "link"); el.setAttribute("tabindex", "0");
      el.setAttribute("aria-label", "Music and home audio · open the player");
      el.addEventListener("click", function (ev) { onTileClick(el, ev); });
      el.addEventListener("keydown", function (ev) { if (ev.key === "Enter" && ev.target === el) openPlayer(el, null); });
      el.addEventListener("pointerdown", function () { try { if (window.HouseSfx && HouseSfx.tap) HouseSfx.tap(); } catch (e) { /* */ } }, { passive: true });
      tiles.push(el);
    });
    if (tiles.length) opts.devices = true; /* the tile shows the house speakers (rooms) */
    paintTiles(); return api;
  }
  function onTileClick(el, ev) {
    var b = ev.target && ev.target.closest && ev.target.closest("[data-sp-act]");
    if (b && el.contains(b)) {
      ev.preventDefault(); ev.stopPropagation();
      var a = b.getAttribute("data-sp-act");
      b.classList.remove("sp-hit"); void b.offsetWidth; b.classList.add("sp-hit");
      if (a === "room") {
        var id = b.getAttribute("data-id"), rm = (rooms() || []).filter(function (r) { return r.id === id; })[0];
        if (rm && rm.active) { openPlayer(el, ev, "#rooms"); return; }
        act("transfer", { deviceId: id, play: true }); return;
      }
      if (a === "vol-") { volStep(-1); return; }
      if (a === "vol+") { volStep(1); return; }
      if (a === "rooms") { openPlayer(el, ev, "#rooms"); return; }
      if (a === "connect") {
        if (S.phase === "no_key" || S.phase === "bad_key") { if (window.WardHubKeyEntry) WardHubKeyEntry.open(); return; }
        if (S.phase === "need_app") { openPlayer(el, ev, "#setup"); return; }
        if (S.phase === "offline") { schedule(0); return; }
        connect("sheet-index.html"); return;
      }
      act(a); return;
    }
    ev.preventDefault();
    openPlayer(el, ev);
  }
  var volT = 0, volWant = null;
  function volStep(dir) {
    var p = player(), d = p && p.device; if (!d || d.volume == null) return;
    volWant = Math.max(0, Math.min(100, (volWant != null ? volWant : d.volume) + dir * 6));
    d.volume = volWant; (rooms() || []).forEach(function (r) { if (r.id === d.id) r.volume = volWant; }); paintTiles();
    clearTimeout(volT); volT = setTimeout(function () { var v = volWant; volWant = null; act("volume", { volume: v, deviceId: d.id }); }, 350);
  }
  /* the tap swells into light, then the Ori player page irises open from that same spot */
  function openPlayer(el, ev, hash) {
    var x = ev && ev.clientX != null ? ev.clientX : null, y = ev && ev.clientY != null ? ev.clientY : null;
    var r = el.getBoundingClientRect();
    if (x == null || (x === 0 && y === 0)) { x = r.left + r.width / 2; y = r.top + r.height / 2; }
    var fx = Math.max(0, Math.min(1, x / innerWidth)), fy = Math.max(0, Math.min(1, y / innerHeight));
    var url = PLAYER + (hash || "") + (hash ? "&" : "#") + "from=" + fx.toFixed(3) + "," + fy.toFixed(3);
    var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { location.href = url; return; }
    var burst = document.createElement("div");
    burst.className = "sp-burst";
    burst.style.left = x + "px"; burst.style.top = y + "px";
    document.body.appendChild(burst);
    el.classList.add("sp-launch");
    setTimeout(function () { location.href = url; }, 430);
    setTimeout(function () { el.classList.remove("sp-launch"); burst.remove(); }, 2500);
  }
  window.addEventListener("pageshow", function (e) { if (e.persisted) document.querySelectorAll(".sp-burst").forEach(function (b) { b.remove(); }); });

  function setTxt(el, sel, t) { var n = el.querySelector(sel); if (n && n.textContent !== t) n.textContent = t; return n; }
  function paintTile(el) {
    var ph = S.phase, p = player(), it = p && p.item, live = ph === "playing" || ph === "paused" || ph === "idle";
    el.setAttribute("data-sp-phase", ph);
    var pill = { loading: "Wait", playing: "LIVE", paused: "PAUSED", idle: "READY", need_app: "CONNECT", need_auth: "CONNECT", no_key: "NEED KEY", bad_key: "NEED KEY", offline: "OFFLINE", error: "CHECK" }[ph] || "Wait";
    setTxt(el, ".sp-pill", pill);
    var title = "Spotify", artist = "", dev = "", showCtl = false, connectTxt = "";
    if (live && it) {
      title = it.name; artist = it.artists + (it.album ? " · " + it.album : "");
      var d = p.device || (p.lastDevice ? { name: p.lastDevice.name } : null);
      dev = ph === "idle" ? (p.fromRecent ? "Last played · " : "Nothing playing · ") + (d && d.name ? "tap ▶ for " + d.name : "tap ▶ to resume") :
        (d ? (ph === "paused" ? "Paused on " : "Playing on ") + d.name + (d.volume != null ? " · " + d.volume + "%" : "") : "");
      showCtl = true;
    } else if (live) {
      title = "Nothing playing"; artist = "Start Spotify on any speaker or phone"; dev = "Then control it right here"; showCtl = true;
    } else if (ph === "need_app" || ph === "need_auth") {
      title = "Connect Spotify"; artist = "One tap, once · then every screen"; connectTxt = "Connect Spotify";
    } else if (ph === "no_key" || ph === "bad_key") {
      /* Key-less screens stay quiet: the NEED KEY pill only. No sentence, no Add key button. */
      title = "Spotify"; artist = ""; dev = ""; connectTxt = "";
    } else if (ph === "offline") {
      title = "Spotify"; artist = "House box isn't answering"; dev = "Comes back on its own"; connectTxt = "Retry";
    } else if (ph === "error") {
      title = "Spotify"; artist = S.msg || "Spotify had a hiccup"; dev = "Tap to open the player";
    } else { title = "Spotify"; artist = "Checking"; }
    setTxt(el, ".sp-title", title); setTxt(el, ".sp-artist", artist); setTxt(el, ".sp-dev", dev);
    var c = el.querySelector(".sp-ctrls"); if (c) c.hidden = !showCtl;
    var cb = el.querySelector(".sp-connect"); if (cb) { cb.hidden = !connectTxt; if (connectTxt) cb.textContent = connectTxt; }
    var img = el.querySelector(".sp-art"), src = it && (it.art || it.artSmall) || "";
    if (img) {
      if (src && img.getAttribute("src") !== src) { img.onload = function () { img.hidden = false; el.classList.add("sp-has-art"); }; img.onerror = function () { img.hidden = true; el.classList.remove("sp-has-art"); }; img.src = src; }
      if (!src) { img.hidden = true; img.removeAttribute("src"); el.classList.remove("sp-has-art"); }
    }
    var playing = ph === "playing";
    el.classList.toggle("sp-is-playing", playing);
    var pb = el.querySelector(".sp-play");
    if (pb) { var want = playing ? "pause" : "play"; if (pb.getAttribute("data-icon") !== want) { pb.innerHTML = ICONS[want]; pb.setAttribute("data-icon", want); pb.setAttribute("aria-label", playing ? "Pause" : "Play"); } }
    var dis = (p && p.disallows) || {};
    el.querySelectorAll(".sp-btn").forEach(function (b) { b.disabled = !!S.busy && b.getAttribute("data-sp-act") === S.pending; });
    var nb = el.querySelector('[data-sp-act="next"]'), pv = el.querySelector('[data-sp-act="previous"]');
    if (nb) nb.classList.toggle("sp-dim", !!dis.skipping_next || ph === "idle");
    if (pv) pv.classList.toggle("sp-dim", !!dis.skipping_prev || ph === "idle");
    paintRooms(el, live);
    var fl = el.querySelector(".sp-flash");
    if (fl) { var on = S.flash && Date.now() - (S.flashAt || 0) < 5000; fl.textContent = on ? S.flash : ""; fl.classList.toggle("on", !!on); }
    if (window.HouseSpotifyColor && src) HouseSpotifyColor(src, function (rgb) { el.style.setProperty("--sp-c", rgb.join(",")); });
  }
  function paintRooms(el, live) {
    var box = el.querySelector(".sp-rooms"); if (!box) return;
    var rs = (rooms() || []).filter(function (r) { return r.room || r.active; });
    box.hidden = !live || !rs.length;
    el.classList.toggle("sp-has-rooms", !box.hidden);
    if (box.hidden) return;
    var p = player(), activeId = p && p.device ? p.device.id : "";
    var max = el.classList.contains("sp-strip") ? 6 : 5;
    var html = rs.slice(0, max).map(function (r) {
      var on = r.id === activeId, vol = on && p.device && p.device.volume != null ? p.device.volume : null;
      return '<div class="sp-room' + (on ? " on" : "") + (r.awake === false ? " asleep" : "") + (r.group ? " grp" : "") + '">' +
        '<button type="button" data-sp-act="room" data-id="' + esc(r.id) + '" aria-label="' + (on ? "Playing on " : "Play on ") + esc(r.name) + '">' + devIcon(r) + '<span>' + esc(r.name) + '</span></button>' +
        (on && vol != null ? '<button type="button" class="v" data-sp-act="vol-" aria-label="Volume down">' + ICONS.minus + '</button><b>' + vol + '</b><button type="button" class="v" data-sp-act="vol+" aria-label="Volume up">' + ICONS.plus + '</button>' : "") +
        '</div>';
    }).join("") + (rs.length > max ? '<button type="button" class="sp-room-more" data-sp-act="rooms">+' + (rs.length - max) + '</button>' : "");
    if (box._h !== html) { box._h = html; box.innerHTML = html; }
  }
  function paintTiles() { tiles.forEach(paintTile); }
  function tickProgress() {
    var f = progress().f;
    tiles.forEach(function (el) { var i = el.querySelector(".sp-prog i"); if (i) i.style.transform = "scaleX(" + f.toFixed(4) + ")"; });
  }
  setInterval(function () { if (!document.hidden && tiles.length) { tickProgress(); if (S.flash && Date.now() - S.flashAt > 5000) { S.flash = ""; paintTiles(); } } }, 500);
  listeners.push(function () { paintTiles(); tickProgress(); });

  /* album colour → glow tint (CORS-clean on i.scdn.co); cached per url */
  var colorCache = {};
  window.HouseSpotifyColor = function (url, cb) {
    if (colorCache[url]) { if (colorCache[url].rgb) cb(colorCache[url].rgb); else colorCache[url].cbs.push(cb); return; }
    var rec = colorCache[url] = { rgb: null, cbs: [cb] };
    var im = new Image(); im.crossOrigin = "anonymous"; im.referrerPolicy = "no-referrer";
    im.onload = function () {
      try {
        var c = document.createElement("canvas"); c.width = c.height = 24; var g = c.getContext("2d"); g.drawImage(im, 0, 0, 24, 24);
        var d = g.getImageData(0, 0, 24, 24).data, best = null, bs = -1, sum = [0, 0, 0], n = 0;
        for (var i = 0; i < d.length; i += 4) {
          var r = d[i], gg = d[i + 1], b = d[i + 2], mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), sat = mx ? (mx - mn) / mx : 0, score = sat * (mx / 255) * (mx > 40 ? 1 : 0.2);
          sum[0] += r; sum[1] += gg; sum[2] += b; n++;
          if (score > bs) { bs = score; best = [r, gg, b]; }
        }
        var avg = [sum[0] / n, sum[1] / n, sum[2] / n], pick = bs > 0.18 ? best : avg;
        var mx2 = Math.max(pick[0], pick[1], pick[2], 1), k = Math.max(1, 200 / mx2);   /* lift to a glow-bright tone */
        rec.rgb = pick.map(function (v) { return Math.min(255, Math.round(v * k)); });
      } catch (e) { rec.rgb = [30, 215, 96]; }
      rec.cbs.forEach(function (f) { f(rec.rgb); }); rec.cbs = [];
    };
    im.onerror = function () { rec.rgb = [30, 215, 96]; rec.cbs.forEach(function (f) { f(rec.rgb); }); rec.cbs = []; };
    im.src = url;
  };

  var api = {
    start: start, onChange: function (fn) { listeners.push(fn); return api; }, get: function () { return S; }, player: player, progress: progress,
    act: act, connect: connect, setup: setup, library: library, browse: browse, rooms: rooms, devices: devices, refresh: function () { schedule(0); },
    mountTiles: mountTiles, openPlayer: openPlayer, fmt: fmt, esc: esc, icons: ICONS, devIcon: devIcon, base: base, hasKey: function () { return !!key(); }
  };
  window.HouseSpotify = api;
})();
