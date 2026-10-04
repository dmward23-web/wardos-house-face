/* SPOTIFY1+2 · sheet-spotify.html · Ori-style living player (+ SPOTIFY2: like, queue, artist/album pages via sheet-spotify-lib.js). World: ori/ori-scene.js (WebGL2 painted parallax,
 * god rays, motes, fog, bloom). The world breathes with playback, tints to the album, and bursts on a new track.
 * All control goes through HouseSpotify (house box proxy). Honest gates; never a fake now-playing. */
(function () {
  "use strict";
  var SP = window.HouseSpotify, O = window.OriScene;
  var $ = function (id) { return document.getElementById(id); };
  var body = document.body, I = SP.icons;
  var hash = location.hash || ""; window.SPW_HASH = hash; /* #rooms / #search deep links (lib) */
  var fromM = /from=([\d.]+),([\d.]+)/.exec(hash);
  var from = fromM ? [Math.min(1, +fromM[1]), Math.min(1, +fromM[2])] : [0.5, 0.42];
  var wantSetup = /setup/.test(hash);
  try { if (hash) history.replaceState(null, "", location.pathname + location.search + (wantSetup ? "#setup" : "")); } catch (e) { /* */ }
  var reduced = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- the world ---------- */
  var W = null, col = { acc: "#38d6ff", key: "#1ed760" }, glow = 1, glowT = 1;
  function hex(rgb) { return "#" + rgb.map(function (v) { return ("0" + Math.max(0, Math.min(255, Math.round(v))).toString(16)).slice(-2); }).join(""); }
  function mountWorld() {
    if (!O) { body.classList.add("spw-nogl"); return null; }
    var host = $("spw-world");
    var w = new O.World(host, {
      plates: "ori/plates/", motes: 170, fonts: false, hotLight: 0.7,
      config: { sound: { muted: true, ambient: false }, fpsCap: 60, dprMax: 2 },
      theme: function (wd) { var t = O.oriTheme(wd, { acc: col.acc, key: col.key, rays: 1.15 }); return t; }
    });
    if (!w.S) { body.classList.add("spw-nogl"); return null; }
    /* spirit lanterns drifting in the middle distance, tinted to the album */
    var orbs = [[0.16, 0.30, 0.012], [0.86, 0.36, 0.010], [0.30, 0.62, 0.008], [0.74, 0.70, 0.011], [0.52, 0.18, 0.007]];
    orbs.forEach(function (o, i) { w.add(new O.Orb({ layer: i % 2 ? "mid" : "far", pass: i % 2 ? "mid" : "far", fx: o[0], fy: o[1], r: o[2], glow: 1.3, bob: 1.6 })); });
    w.stepWorld = function (t, dt) {
      glow += (glowT - glow) * Math.min(1, dt * 1.6);
      var p = SP.player(), playing = p && p.isPlaying;
      this.exposure = glow * (playing && !reduced ? 1 + 0.035 * Math.sin(t * 2.2) : 1);
    };
    w.afterRender = function () {
      /* the DOM lantern rides the same heavy camera as the painted layers (mid-depth parallax) */
      var cx = this.cam.x.v, cy = this.cam.y.v;
      var lan = $("spw-lantern"); if (lan) lan.style.setProperty("--par", "translate3d(" + (cx * 0.45).toFixed(1) + "px," + (cy * 0.45).toFixed(1) + "px,0)");
    };
    var started = false;
    w.onReady = function () { if (started) return; started = true; w.enter({ from: [from[0] * w.cssW, from[1] * w.cssH], dur: 1.45 }); revealUI(); };
    /* the UI sits above the canvas, so feed the heavy camera from the whole window (touch drags + mouse) */
    window.addEventListener("pointermove", function (e) { w.ptr = { x: e.clientX / innerWidth * 2 - 1, y: e.clientY / innerHeight * 2 - 1, t: O.util.now() }; w.kick(); }, { passive: true });
    w.start();
    setTimeout(function () { if (!started) { started = true; revealUI(); } }, 2600); /* plates slow? never hold the UI hostage */
    return w;
  }
  var revealed = false;
  function revealUI() {
    if (revealed) return; revealed = true;
    requestAnimationFrame(function () { body.classList.remove("spw-boot"); body.classList.add("spw-entered"); setTimeout(function () { body.classList.add("spw-settled"); }, 1900); });
  }
  W = mountWorld();
  window.spwWorld = W; /* handy for QA (stats(), fps) */
  if (!W) revealUI();

  /* back: the world irises shut toward the button, then home */
  document.querySelectorAll("[data-spw-back]").forEach(function (a) {
    a.addEventListener("click", function (ev) {
      ev.preventDefault();
      var href = a.getAttribute("href"); body.classList.add("spw-leaving");
      if (!W || reduced) { location.href = href; return; }
      var r = a.getBoundingClientRect();
      W.exit({ to: [r.left + r.width / 2, r.top + r.height / 2], dur: 0.7 }).then(function () { location.href = href; });
      setTimeout(function () { location.href = href; }, 1400);
    });
  });
  window.addEventListener("pageshow", function (e) { if (e.persisted) { body.classList.remove("spw-leaving"); if (W) { W.trans = null; W.kick(true); } } });

  /* ---------- static icons ---------- */
  document.querySelector('[data-a="shuffle"]').insertAdjacentHTML("afterbegin", I.shuffle);
  document.querySelector('[data-a="previous"]').innerHTML = I.previous;
  document.querySelector('[data-a="next"]').innerHTML = I.next;
  document.querySelector('[data-a="repeat"]').insertAdjacentHTML("afterbegin", I.repeat);
  document.querySelector(".spw-vol-ic").innerHTML = I.vol;

  /* ---------- toast ---------- */
  var toastT = 0;
  function toast(msg) { var t = $("spw-toast"); t.textContent = msg; t.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove("on"); }, 4200); }

  /* ---------- painting ---------- */
  var lastUri = "", lastArt = "", seekDrag = false, volDrag = false, volTimer = 0;
  var paintHooks = [];
  function setText(id, t) { var n = $(id); if (n && n.textContent !== t) n.textContent = t; }
  function paint(S) {
    var ph = S.phase, p = SP.player(), it = p && p.item;
    var live = ph === "playing" || ph === "paused" || ph === "idle";
    body.classList.toggle("spw-playing", ph === "playing");
    body.classList.toggle("spw-paused", ph !== "playing");
    var pill = $("spw-pill");
    pill.textContent = { loading: "…", playing: "LIVE", paused: "PAUSED", idle: "READY", need_app: "SETUP", need_auth: "CONNECT", no_key: "NEED KEY", bad_key: "NEED KEY", offline: "OFFLINE", error: "CHECK" }[ph] || "…";
    pill.classList.toggle("live", ph === "playing");
    glowT = ph === "playing" ? 1.06 : live ? 0.86 : 0.8;

    /* gate / setup */
    var gate = $("spw-gate"), setup = $("spw-setup"), liveBox = $("spw-live");
    var showSetup = ph === "need_app";
    setup.hidden = !showSetup; if (showSetup) setup.classList.add("spw-in");
    body.classList.toggle("spw-gated", !live);
    gate.hidden = live || showSetup || ph === "loading";
    liveBox.hidden = !live;
    $("spw-hub").hidden = !live; $("spw-rooms").hidden = !live;
    var gb = $("spw-gate-btn"), msg = "", sub = "", btn = "";
    if (ph === "need_auth") { msg = "Connect your Spotify once. Then the wall, your phone and every House screen can play, skip and switch speakers."; btn = "Connect Spotify"; sub = "Opens Spotify sign-in, then comes right back here."; }
    else if (ph === "no_key" || ph === "bad_key") { msg = ph === "bad_key" ? "This screen's house key didn't work." : "This screen needs the house key (same one the lights use)."; btn = "Add key"; sub = "Paste the setup link once. It stays on this screen."; }
    else if (ph === "offline") { msg = "The house box isn't answering right now."; btn = "Try again"; sub = "It comes back on its own — no need to do anything."; }
    else if (ph === "error") { msg = S.msg || "Spotify had a hiccup."; btn = "Try again"; sub = S.err === "not_allowlisted" ? "Spotify dashboard → your app → Settings → User Management → add your Spotify email." : S.err === "premium_required" ? "Playback control needs Spotify Premium on this account." : ""; }
    setText("spw-gate-msg", msg); setText("spw-gate-sub", sub); gb.textContent = btn; gb.hidden = !btn;
    gb.classList.toggle("warm", ph !== "need_auth");

    /* titles */
    if (live && it) {
      setText("spw-title", it.name); setText("spw-artist", it.artists || ""); setText("spw-album", it.album || "");
      $("spw-artist").disabled = !(it.artistList && it.artistList[0] && it.artistList[0].id) && !it.showId;
      $("spw-album").disabled = !it.albumId;
    } else if (live) {
      setText("spw-title", "Nothing playing"); setText("spw-artist", "Start Spotify on any speaker or phone"); setText("spw-album", "or pick a playlist below");
    } else if (ph === "need_app" || ph === "need_auth") {
      setText("spw-title", "Spotify"); setText("spw-artist", ""); setText("spw-album", "");
    } else { setText("spw-title", "Spotify"); setText("spw-artist", ""); setText("spw-album", ""); }
    document.title = (live && it ? it.name + " · " : "") + "Spotify · House";

    /* art + album tint + new-track burst */
    var art = it && (it.art || it.artSmall) || "", img = $("spw-art");
    if (art !== lastArt) {
      lastArt = art;
      if (art) {
        var pre = new Image(); pre.referrerPolicy = "no-referrer";
        pre.onload = function () { if (lastArt !== art) return; img.src = art; img.hidden = false; requestAnimationFrame(function () { img.classList.add("on"); }); };
        img.classList.remove("on"); pre.src = art;
        SP && window.HouseSpotifyColor(art, function (rgb) {
          if (lastArt !== art) return;
          document.documentElement.style.setProperty("--spw-c", rgb.join(","));
          col.acc = hex(rgb); col.key = hex([rgb[0] * 0.5 + 30 * 0.5, rgb[1] * 0.5 + 215 * 0.5, rgb[2] * 0.5 + 96 * 0.5]);
          if (W) W.kick(true);
        });
      } else { img.hidden = true; img.classList.remove("on"); img.removeAttribute("src"); }
    }
    var uri = it && it.uri || "";
    if (uri && lastUri && uri !== lastUri) newTrackFx();
    lastUri = uri;
    /* like + queue beside the title */
    var lk = $("spw-like"), qb = $("spw-qbtn");
    lk.hidden = !(live && it && it.kind === "track" && it.saved != null); qb.hidden = !(live && it);
    if (!lk.hidden) { var sv = !!it.saved; if (lk.getAttribute("data-on") !== String(sv)) { lk.innerHTML = sv ? I.heartOn : I.heart; lk.setAttribute("data-on", String(sv)); lk.setAttribute("aria-pressed", String(sv)); lk.setAttribute("aria-label", sv ? "Remove from Liked Songs" : "Save to Liked Songs"); lk.classList.toggle("on", sv); } }
    paintHooks.forEach(function (fn) { try { fn(S); } catch (e) { /* */ } });

    if (!live) return;
    /* transport */
    var playing = ph === "playing", pb = document.querySelector('[data-a="toggle"]');
    var wantIc = playing ? "pause" : "play";
    if (pb.getAttribute("data-ic") !== wantIc) { pb.innerHTML = I[wantIc]; pb.setAttribute("data-ic", wantIc); pb.setAttribute("aria-label", playing ? "Pause" : "Play"); }
    var sh = document.querySelector('[data-a="shuffle"]'), rp = document.querySelector('[data-a="repeat"]');
    sh.classList.toggle("on", !!(p && p.shuffle)); sh.setAttribute("aria-pressed", p && p.shuffle ? "true" : "false");
    var rep = (p && p.repeat) || "off"; rp.classList.toggle("on", rep !== "off"); rp.setAttribute("data-rep", rep); rp.setAttribute("aria-label", "Repeat " + rep);
    var dis = (p && p.disallows) || {}, idle = ph === "idle";
    document.querySelector('[data-a="next"]').disabled = idle || !!dis.skipping_next;
    document.querySelector('[data-a="previous"]').disabled = idle || !!dis.skipping_prev;
    sh.disabled = idle; rp.disabled = idle;
    document.querySelectorAll(".spw-b").forEach(function (b) { b.classList.toggle("busy", S.busy > 0 && S.pending === b.getAttribute("data-a")); });

    /* volume */
    var d = p && p.device, vol = $("spw-volume"), vbox = document.querySelector(".spw-vol");
    var canVol = !!(d && d.supportsVolume !== false && d.volume != null);
    vbox.classList.toggle("off", !canVol); vol.disabled = !canVol;
    if (!volDrag && canVol) { vol.value = d.volume; $("spw-vfill").style.width = d.volume + "%"; setText("spw-vol-n", d.volume + "%"); }
    if (!canVol) { $("spw-vfill").style.width = "0%"; setText("spw-vol-n", "–"); }

    /* device chip */
    var dn = d ? d.name : p && p.lastDevice ? p.lastDevice.name : "";
    $("spw-device").querySelector(".spw-dev-ic").innerHTML = SP.devIcon(d || (p && p.lastDevice));
    setText("spw-dev-txt", d ? (playing ? "Playing on " : "On ") + dn : dn ? "Resume on " + dn : "Pick a speaker");

    if (S.flash && S.flashAt && Date.now() - S.flashAt < 1500) { toast(S.flash); S.flashAt = 0; }
  }
  function newTrackFx() {
    var st = $("spw-stage"); st.classList.remove("spw-swap"); void st.offsetWidth; st.classList.add("spw-swap");
    if (!W || !W.S || reduced) return;
    var r = $("spw-lantern").getBoundingClientRect(), rs = W.rs || 1, c = O.util.hexRgb(col.acc).map(function (v) { return Math.pow(v / 255, 2.2) * 2.4; });
    W.burst([(r.left + r.width / 2) * rs, (r.top + r.height / 2) * rs], c, 70, { speed: 1.3, g: 60 });
    W.zoom.kick(-0.35); W.kick(true);
  }

  /* progress (interpolated between polls) */
  function tick() {
    var p = SP.player(), g = SP.progress();
    if (p && p.item && !seekDrag) {
      var f = g.f; $("spw-fill").style.width = (f * 100).toFixed(2) + "%"; $("spw-knob").style.left = (f * 100).toFixed(2) + "%";
      $("spw-seek").value = Math.round(f * 1000);
      setText("spw-t0", SP.fmt(g.ms)); setText("spw-t1", SP.fmt(g.dur));
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  /* ---------- controls ---------- */
  function hit(b) { b.classList.remove("hit"); void b.offsetWidth; b.classList.add("hit"); setTimeout(function () { b.classList.remove("hit"); }, 650); }
  document.querySelectorAll(".spw-ctrls [data-a]").forEach(function (b) {
    b.addEventListener("click", function () {
      var a = b.getAttribute("data-a"), p = SP.player(); hit(b);
      if (a === "shuffle") return SP.act("shuffle", { state: !(p && p.shuffle) });
      if (a === "repeat") { var n = { off: "context", context: "track", track: "off" }[(p && p.repeat) || "off"]; return SP.act("repeat", { state: n }); }
      if (a === "toggle" && SP.get().phase === "idle") {
        var last = p && p.lastDevice, item = p && p.item;
        if (p && p.fromRecent && item) return SP.act("play", item.context && item.context.uri ? { contextUri: item.context.uri, offsetUri: item.uri } : { uris: [item.uri] }).then(after);
        return SP.act("play", last ? { deviceId: last.id } : {}).then(after);
      }
      SP.act(a).then(after);
    });
  });
  function after(j) { if (j && j.ok === false) toast(j.message || "Spotify didn't take that."); if (j && j.error === "no_device") openSheet(); }

  var seek = $("spw-seek");
  seek.addEventListener("input", function () {
    seekDrag = true; var f = seek.value / 1000, g = SP.progress();
    $("spw-fill").style.width = f * 100 + "%"; $("spw-knob").style.left = f * 100 + "%"; setText("spw-t0", SP.fmt(f * g.dur));
  });
  seek.addEventListener("change", function () {
    var g = SP.progress(), ms = Math.round(seek.value / 1000 * g.dur);
    SP.act("seek", { positionMs: ms }).then(function (j) { seekDrag = false; after(j); });
    setTimeout(function () { seekDrag = false; }, 1500);
  });
  var vol = $("spw-volume");
  vol.addEventListener("input", function () {
    volDrag = true; $("spw-vfill").style.width = vol.value + "%"; setText("spw-vol-n", vol.value + "%");
    clearTimeout(volTimer); volTimer = setTimeout(function () { SP.act("volume", { volume: +vol.value }).then(function (j) { volDrag = false; after(j); }); }, 280);
  });

  /* gate button */
  $("spw-gate-btn").addEventListener("click", function () {
    var ph = SP.get().phase;
    if (ph === "need_auth") return SP.connect("sheet-spotify.html");
    if (ph === "no_key" || ph === "bad_key") {
      if (window.WardHubKeyEntry) return WardHubKeyEntry.open();
      var s = document.createElement("script"); s.src = "hub-key-entry.js?v=KEYAUTO2"; s.onload = function () { if (window.WardHubKeyEntry) WardHubKeyEntry.open(); }; document.body.appendChild(s); return;
    }
    SP.refresh();
  });

  /* one-time setup */
  $("spw-copy-btn").addEventListener("click", function () {
    var t = $("spw-redirect").textContent, b = this;
    function ok() { b.textContent = "Copied"; setTimeout(function () { b.textContent = "Copy"; }, 1600); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(ok, function () { selectCode(); });
    else selectCode();
    function selectCode() { var r = document.createRange(); r.selectNodeContents($("spw-redirect")); var s = getSelection(); s.removeAllRanges(); s.addRange(r); b.textContent = "Selected"; }
  });
  $("spw-setup-go").addEventListener("click", function () {
    var v = ($("spw-client").value || "").trim().replace(/\s+/g, ""), err = $("spw-setup-err");
    var m = /[0-9a-f]{32}/i.exec(v);
    if (!m) { err.textContent = "That doesn't look like a Client ID — it's 32 letters and numbers on the app's page."; return; }
    err.textContent = "Saving on the house box…";
    SP.setup(m[0], "sheet-spotify.html").then(function (j) {
      if (j && j.url) { err.textContent = "Opening Spotify sign-in…"; return; }
      err.textContent = (j && j.message) || (j && j.error === "offline" ? "House box didn't answer — try again in a minute." : "Couldn't save that. Try again.");
    });
  });

  /* ---------- device sheet ---------- */
  function openSheet() {
    var sh = $("spw-sheet"), list = $("spw-sheet-list");
    sh.hidden = false; list.innerHTML = '<div class="spw-sheet-ft">Looking for speakers…</div>';
    SP.devices().then(function (j) {
      var ds = (j && j.devices) || [];
      if (!ds.length) { list.innerHTML = '<div class="spw-sheet-ft">' + (j && j.ok === false ? SP.esc(j.message || "Couldn't reach Spotify.") : "No speakers awake right now.") + "</div>"; return; }
      list.innerHTML = ds.map(function (d) {
        return '<button type="button" class="spw-dev' + (d.active ? " on" : "") + '" data-id="' + SP.esc(d.id) + '"' + (d.restricted ? " disabled" : "") + ">" + SP.devIcon(d) + "<span>" + SP.esc(d.name) + '</span><span class="k">' + (d.active ? "NOW" : SP.esc((d.type || "").toUpperCase())) + "</span></button>";
      }).join("");
    });
  }
  $("spw-device").addEventListener("click", openSheet);
  $("spw-sheet").addEventListener("click", function (ev) {
    var t = ev.target;
    if (t === this || (t.closest && t.closest("[data-close]"))) { this.hidden = true; return; }
    var b = t.closest && t.closest(".spw-dev"); if (!b) return;
    var id = b.getAttribute("data-id"); this.hidden = true;
    SP.act("transfer", { deviceId: id, play: true }).then(function (j) { after(j); if (j && j.ok !== false) toast("Moved to " + (b.textContent || "").replace(/(NOW|SPEAKER|SMARTPHONE|COMPUTER|TV)$/, "").trim()); });
  });

  /* ---------- like / queue / go to artist + album (from the now-playing titles) ---------- */
  $("spw-qbtn").innerHTML = I.queue;
  $("spw-like").addEventListener("click", function () {
    var p = SP.player(), it = p && p.item; if (!it) return; hit(this);
    var on = !it.saved; burstAt(this, on ? [0.2, 1.6, 0.6] : null);
    SP.act(on ? "like" : "unlike", { uri: it.uri }).then(function (j) { after(j); if (j && j.ok !== false) toast(on ? "Saved to Liked Songs" : "Removed from Liked Songs"); });
  });
  $("spw-qbtn").addEventListener("click", function () { if (window.SpwLib) SpwLib.pane("queue", true); });
  $("spw-artist").addEventListener("click", function () { var it = (SP.player() || {}).item; if (!it || !window.SpwLib) return; if (it.showId) return SpwLib.open("show", it.showId); var a = it.artistList && it.artistList[0]; if (a && a.id) SpwLib.open("artist", a.id); });
  $("spw-album").addEventListener("click", function () { var it = (SP.player() || {}).item; if (it && it.albumId && window.SpwLib) SpwLib.open("album", it.albumId); });

  /* a burst of spirit light from any element (likes, plays, opening a page) */
  function burstAt(el, rgb, n) {
    if (!W || !W.S || reduced || !el) return;
    var r = el.getBoundingClientRect(), rs = W.rs || 1;
    var c = rgb || O.util.hexRgb(col.acc).map(function (v) { return Math.pow(v / 255, 2.2) * 2.4; });
    W.burst([(r.left + r.width / 2) * rs, (r.top + r.height / 2) * rs], c, n || 34, { speed: 1, g: 40 }); W.kick(true);
  }
  window.SPW = { toast: toast, after: after, burstAt: burstAt, hit: hit, onPaint: function (fn) { paintHooks.push(fn); }, openSheet: openSheet, world: function () { return W; } };

  SP.onChange(paint);
  SP.start({ fast: true, devices: true }); /* devices → the Home audio rooms */
  if (wantSetup) { /* the hub's Connect button jumps straight to the setup card */ }
})();
