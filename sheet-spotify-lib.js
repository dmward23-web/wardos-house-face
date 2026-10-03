/* SPOTIFY2 · sheet-spotify.html · everything Spotify does, Ori-style (Dan 10/3 6:29 PM):
 *   HOME AUDIO rooms (house speakers + groups as Spotify Connect devices: move music, per-room volume, Everywhere)
 *   Search (songs / artists / albums / playlists / podcasts) · Library (Liked Songs, playlists, albums, artists, podcasts)
 *   Queue (up next + add) · Recent · album / artist / playlist / podcast / Liked Songs pages · like + unlike.
 * All calls: HouseSpotify → house box → Spotify Web API (Feb-2026 dev-mode endpoints). */
(function () {
  "use strict";
  var SP = window.HouseSpotify, X = window.SPW, I = SP.icons, esc = SP.esc;
  var $ = function (id) { return document.getElementById(id); };
  document.querySelectorAll("[data-ic]").forEach(function (n) { n.innerHTML = I[n.getAttribute("data-ic")] || ""; });

  function fmtDur(ms) { if (!ms) return ""; var m = Math.round(ms / 60000); return ms >= 3600000 ? Math.floor(m / 60) + " hr " + (m % 60) + " min" : ms > 600000 ? m + " min" : SP.fmt(ms); }
  function img(src, cls) { return '<div class="' + (cls || "im") + '">' + (src ? '<img loading="lazy" decoding="async" referrerpolicy="no-referrer" alt="" src="' + esc(src) + '">' : '<span class="ph">' + I.note + "</span>") + "</div>"; }
  function errMsg(j) { return (j && j.message) || (j && j.error === "offline" ? "House box didn't answer. Try again." : "Couldn't load that just now."); }
  function curDevice() { var p = SP.player(); return p && !p.active && p.lastDevice ? p.lastDevice.id : ""; }
  function playArgs(a) { var d = curDevice(); if (d && !a.deviceId) a.deviceId = d; return a; }
  function play(args, label, el) {
    if (el) { X.hit(el); X.burstAt(el, null, 40); }
    return SP.act("play", playArgs(args)).then(function (j) {
      /* Liked Songs as a context can be refused on some accounts → play the list itself */
      if (j && j.ok === false && args.fallbackUris && j.error !== "no_device") return SP.act("play", playArgs({ uris: args.fallbackUris, offsetUri: args.offsetUri })).then(function (k) { X.after(k); if (k && k.ok !== false) X.toast("Playing " + label); return k; });
      X.after(j); if (j && j.ok !== false && label) X.toast("Playing " + label); return j;
    });
  }
  function like(uri, on, el) {
    if (el) { X.hit(el); if (on) X.burstAt(el, [0.2, 1.6, 0.6], 26); }
    return SP.act(on ? "like" : "unlike", { uri: uri }).then(function (j) { X.after(j); return j; });
  }
  function enqueue(x, el) {
    if (el) { X.hit(el); X.burstAt(el, null, 22); }
    return SP.act("queue", { uri: x.uri }).then(function (j) { X.after(j); if (j && j.ok !== false) { X.toast("Added to queue · " + x.name); if (pane === "queue") loadPane(); } });
  }

  /* ---------------- rows + cards ---------------- */
  var reg = []; /* index → item for the current render (rows/cards carry data-r) */
  function R(x, ctx) { reg.push({ x: x, ctx: ctx || {} }); return reg.length - 1; }
  function rowHtml(x, ctx, n) {
    var i = R(x, ctx), canLike = x.kind === "track" && x.saved != null, cur = (SP.player() || {}).item;
    var on = cur && cur.uri === x.uri;
    return '<div class="spw-tr' + (on ? " now" : "") + '" role="listitem" style="--k:' + Math.min(n || 0, 14) + '">' +
      '<button type="button" class="spw-tr-main" data-r="' + i + '" data-do="play">' +
        (ctx && ctx.numbered ? '<span class="n">' + (x.n || (n + 1)) + "</span>" : img(x.artSmall || x.art, "im")) +
        '<span class="tx"><span class="nm">' + esc(x.name) + '</span><span class="sb">' + (x.explicit ? '<i class="e">E</i>' : "") + esc(x.sub || x.artists || "") + (x.durationMs ? " · " + fmtDur(x.durationMs) : "") + "</span></span></button>" +
      (canLike ? '<button type="button" class="spw-ib' + (x.saved ? " on" : "") + '" data-r="' + i + '" data-do="like" aria-label="' + (x.saved ? "Remove from Liked Songs" : "Save to Liked Songs") + '">' + (x.saved ? I.heartOn : I.heart) + "</button>" : "") +
      (x.kind === "track" || x.kind === "episode" ? '<button type="button" class="spw-ib" data-r="' + i + '" data-do="queue" aria-label="Add to queue">' + I.addq + "</button>" : "") +
      "</div>";
  }
  function cardHtml(x, n) {
    var i = R(x);
    return '<button type="button" class="spw-cd k-' + x.kind + '" data-r="' + i + '" data-do="open" style="--k:' + Math.min(n || 0, 14) + '">' + img(x.art, "im") +
      '<span class="nm">' + esc(x.name) + '</span><span class="sb">' + esc(x.sub || (x.kind === "artist" ? "Artist" : "")) + (x.total ? " · " + x.total : "") + "</span></button>";
  }
  function section(title, inner, more) { return inner ? '<section class="spw-sec"><h3>' + esc(title) + (more || "") + "</h3>" + inner + "</section>" : ""; }
  function grid(items) { return items && items.length ? '<div class="spw-grid">' + items.map(cardHtml).join("") + "</div>" : ""; }
  function strip(items) { return items && items.length ? '<div class="spw-strip">' + items.map(cardHtml).join("") + "</div>" : ""; }
  function list(items, ctx) { return items && items.length ? '<div class="spw-list" role="list">' + items.map(function (x, n) { return rowHtml(x, ctx, n); }).join("") + "</div>" : ""; }
  function empty(t) { return '<div class="spw-empty">' + esc(t) + "</div>"; }
  function loading() { return '<div class="spw-loading"><i></i><i></i><i></i></div>'; }

  /* one click handler for rows + cards everywhere (pane + detail) */
  function onItemClick(ev) {
    var b = ev.target.closest && ev.target.closest("[data-do]"); if (!b || !this.contains(b)) return;
    var dd = b.getAttribute("data-do");
    if (dd === "more") return loadMore(b);
    if (dd === "lsub") { libSub = b.getAttribute("data-sub"); return loadPane(); }
    if (dd === "sfilter") { sFilter = b.getAttribute("data-f"); return runSearch(true); }
    if (dd === "liked") return open("liked", "", b);
    if (dd === "dplay" || dd === "dshuffle" || dd === "dlike") return detailAction(dd, b);
    var e = reg[+b.getAttribute("data-r")]; if (!e) return;
    var x = e.x, ctx = e.ctx;
    if (dd === "open") return open(x.kind, x.id, b);
    if (dd === "like") { var on = !x.saved; x.saved = on; b.classList.toggle("on", on); b.innerHTML = on ? I.heartOn : I.heart; return like(x.uri, on, b); }
    if (dd === "queue") return enqueue(x, b);
    if (dd === "play") {
      if (x.kind === "album" || x.kind === "artist" || x.kind === "playlist" || x.kind === "show") return open(x.kind, x.id, b);
      if (ctx.noPlay) return;
      var args = ctx.contextUri ? { contextUri: ctx.contextUri, offsetUri: x.uri } : ctx.uris ? { uris: ctx.uris.slice(ctx.uris.indexOf(x.uri)).slice(0, 50) } :
        x.context && x.context.uri && /^spotify:(playlist|album|artist|show):/.test(x.context.uri) ? { contextUri: x.context.uri, offsetUri: x.uri } : { uris: [x.uri] };
      if (ctx.fallbackUris) { args.fallbackUris = ctx.fallbackUris; }
      var row = b.closest(".spw-tr"); if (row) { document.querySelectorAll(".spw-tr.now").forEach(function (r) { r.classList.remove("now"); }); row.classList.add("now"); }
      return play(args, x.name, b.querySelector(".im,.n") || b);
    }
  }

  /* ---------------- HOME AUDIO ---------------- */
  var roomsBox = $("spw-room-list"), volT = {};
  function paintRooms() {
    var rs = SP.rooms(), p = SP.player(), act = p && p.device ? p.device.id : "";
    if (!rs) { roomsBox.innerHTML = loading(); return; }
    if (!rs.length) { roomsBox.innerHTML = empty("No speakers awake for Spotify right now."); }
    else {
      var html = rs.map(function (r) {
        var on = r.id === act, vol = on && p.device.volume != null ? p.device.volume : r.volume;
        var state = on ? (p.isPlaying ? "Playing" : "Paused") : r.awake === false ? "Asleep · tap to wake" : r.group ? "Speaker group" : (r.type || "").replace(/^Cast/, "Cast ");
        return '<div class="spw-room' + (on ? " on" : "") + (r.awake === false ? " asleep" : "") + (r.group ? " grp" : "") + '" data-id="' + esc(r.id) + '">' +
          '<button type="button" class="spw-room-main" data-room="go">' + '<span class="ic">' + SP.devIcon(r) + "</span>" +
          '<span class="tx"><span class="nm">' + esc(r.name) + '</span><span class="sb">' + esc(state) + "</span></span>" +
          (on ? '<span class="eq" aria-hidden="true"><i></i><i></i><i></i></span>' : '<span class="go">Play here</span>') + "</button>" +
          (on && r.supportsVolume !== false && vol != null ? '<div class="spw-room-vol"><span class="vi">' + I.vol + '</span><input type="range" min="0" max="100" step="1" value="' + vol + '" aria-label="' + esc(r.name) + ' volume" data-room="vol" style="--v:' + vol + '%"><b>' + vol + "</b></div>" : "") +
          "</div>";
      }).join("");
      if (roomsBox._h !== html && !roomsBox.querySelector("input:active") && !dragVol) { roomsBox._h = html; roomsBox.innerHTML = html; }
    }
    var hasGroup = rs && rs.some(function (r) { return r.group; });
    var ft = hasGroup ? "Pick a group to play the whole house. Groups and rooms come from Google Home." :
      'Whole house at once: in the Google Home app make a speaker group (e.g. “Everywhere”). It shows up here as one room.';
    if ($("spw-room-ft").textContent !== ft) $("spw-room-ft").textContent = ft;
  }
  var dragVol = false;
  roomsBox.addEventListener("click", function (ev) {
    var b = ev.target.closest && ev.target.closest('[data-room="go"]'); if (!b) return;
    var row = b.closest(".spw-room"), id = row.getAttribute("data-id"), p = SP.player();
    if (p && p.device && p.device.id === id) { SP.act(p.isPlaying ? "pause" : "play").then(X.after); return; }
    X.hit(b); X.burstAt(row.querySelector(".ic"), null, 30);
    var name = row.querySelector(".nm").textContent;
    row.classList.add("moving");
    SP.act("transfer", { deviceId: id, play: true }).then(function (j) { row.classList.remove("moving"); X.after(j); if (j && j.ok !== false) X.toast("Now playing on " + name); });
  });
  roomsBox.addEventListener("input", function (ev) {
    var r = ev.target; if (r.getAttribute("data-room") !== "vol") return;
    dragVol = true; r.style.setProperty("--v", r.value + "%"); r.nextElementSibling.textContent = r.value;
    var id = r.closest(".spw-room").getAttribute("data-id");
    clearTimeout(volT[id]); volT[id] = setTimeout(function () { SP.act("volume", { volume: +r.value, deviceId: id }).then(function (j) { dragVol = false; X.after(j); }); }, 260);
  });
  $("spw-rooms-refresh").addEventListener("click", function () { X.hit(this); SP.devices().then(function () { SP.refresh(); }); });

  /* ---------------- panes ---------------- */
  var pane = "library", libSub = "playlists", sFilter = "all", sQuery = "", paneGen = 0, paneData = null;
  var paneBox = $("spw-pane");
  paneBox.addEventListener("click", onItemClick);
  document.querySelector(".spw-nav").addEventListener("click", function (ev) { var b = ev.target.closest && ev.target.closest("[data-pane]"); if (b) setPane(b.getAttribute("data-pane")); });
  function setPane(p, scroll) {
    pane = p;
    document.querySelectorAll(".spw-nav [data-pane]").forEach(function (b) { var on = b.getAttribute("data-pane") === p; b.classList.toggle("on", on); b.setAttribute("aria-selected", String(on)); });
    loadPane();
    if (scroll) $("spw-hub").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function paint(html) { paneBox.innerHTML = html; paneBox.classList.remove("spw-fresh"); void paneBox.offsetWidth; paneBox.classList.add("spw-fresh"); }
  function loadPane() {
    var g = ++paneGen; if (reg.length > 4000 && !detOpen) reg = [];
    if (pane === "search") return paintSearch();
    if (pane === "library") {
      var subs = [["playlists", "Playlists"], ["albums", "Albums"], ["artists", "Artists"], ["shows", "Podcasts"]];
      var head = '<button type="button" class="spw-liked" data-do="liked"><span class="hrt">' + I.heartOn + '</span><span class="tx"><span class="nm">Liked Songs</span><span class="sb" id="spw-liked-n">Your saved songs</span></span><span class="pl">' + I.play + "</span></button>" +
        '<div class="spw-chips">' + subs.map(function (s) { return '<button type="button" data-do="lsub" data-sub="' + s[0] + '" class="' + (libSub === s[0] ? "on" : "") + '">' + s[1] + "</button>"; }).join("") + "</div>";
      paint(head + loading());
      SP.browse(libSub).then(function (j) {
        if (g !== paneGen) return;
        paneData = j;
        if (!j || j.ok === false) return paint(head + empty(errMsg(j)));
        var items = j.items || [];
        paint(head + (items.length ? grid(items) + (j.total > items.length ? '<button type="button" class="spw-more" data-do="more" data-kind="' + libSub + '">Show more</button>' : "") :
          empty({ playlists: "No playlists yet.", albums: "No saved albums yet.", artists: "You're not following any artists yet.", shows: "No saved podcasts yet." }[libSub])));
      });
      return;
    }
    if (pane === "queue") {
      paint(loading());
      SP.browse("queue").then(function (j) {
        if (g !== paneGen) return;
        if (!j || j.ok === false) return paint(empty(errMsg(j)));
        paint(section("Now playing", j.current ? list([j.current], { noPlay: true }) : empty("Nothing playing.")) +
          section("Up next", (j.items || []).length ? list(j.items, { noPlay: true }) : empty("Queue is empty. Add songs with the ＋ on any song.")));
      });
      return;
    }
    if (pane === "recent") {
      paint(loading());
      SP.browse("recent").then(function (j) {
        if (g !== paneGen) return;
        if (!j || j.ok === false) return paint(empty(errMsg(j)));
        paint((j.items || []).length ? list(j.items.map(function (x) { return x; })) : empty("Nothing played lately."));
      });
    }
  }
  function loadMore(b) {
    var kind = b.getAttribute("data-kind"), have = paneBox.querySelectorAll(".spw-cd").length;
    b.textContent = "Loading…"; b.disabled = true;
    SP.browse(kind, { offset: have }).then(function (j) {
      if (!j || j.ok === false) { b.textContent = "Try again"; b.disabled = false; return; }
      var g = paneBox.querySelector(".spw-grid");
      if (g) g.insertAdjacentHTML("beforeend", (j.items || []).map(cardHtml).join(""));
      if (have + (j.items || []).length >= (j.total || 0) || !(j.items || []).length) b.remove(); else { b.textContent = "Show more"; b.disabled = false; }
    });
  }

  /* ---------------- search ---------------- */
  var sTimer = 0;
  function paintSearch() {
    var fs = [["all", "All"], ["track", "Songs"], ["artist", "Artists"], ["album", "Albums"], ["playlist", "Playlists"], ["show", "Podcasts"]];
    paint('<div class="spw-search"><span class="ic">' + I.search + '</span><input type="search" id="spw-q" placeholder="Songs, artists, albums, podcasts" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" value="' + esc(sQuery) + '"></div>' +
      '<div class="spw-chips">' + fs.map(function (f) { return '<button type="button" data-do="sfilter" data-f="' + f[0] + '" class="' + (sFilter === f[0] ? "on" : "") + '">' + f[1] + "</button>"; }).join("") + "</div>" +
      '<div id="spw-sres">' + (sQuery ? loading() : empty("Search all of Spotify. Tap a song to play it, ＋ to queue it, ♡ to save it.")) + "</div>");
    var q = $("spw-q");
    q.addEventListener("input", function () { sQuery = q.value; clearTimeout(sTimer); sTimer = setTimeout(function () { runSearch(false); }, 380); });
    q.addEventListener("keydown", function (e) { if (e.key === "Enter") { clearTimeout(sTimer); runSearch(false); q.blur(); } });
    if (sQuery) runSearch(false);
  }
  function runSearch(repaintChips) {
    if (repaintChips) document.querySelectorAll('[data-do="sfilter"]').forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-f") === sFilter); });
    var box = $("spw-sres"); if (!box) return;
    var text = (sQuery || "").trim(), g = ++paneGen;
    if (!text) { box.innerHTML = empty("Search all of Spotify. Tap a song to play it, ＋ to queue it, ♡ to save it."); return; }
    box.innerHTML = loading();
    var types = sFilter === "all" ? "track,artist,album,playlist,show,episode" : sFilter === "show" ? "show,episode" : sFilter;
    SP.browse("search", { q: text, types: types }).then(function (j) {
      if (g !== paneGen || !$("spw-sres")) return;
      if (!j || j.ok === false) { box.innerHTML = empty(errMsg(j)); return; }
      var it = j.items || {};
      var html = section("Songs", list(sFilter === "all" ? (it.tracks || []).slice(0, 6) : it.tracks)) +
        section("Artists", (sFilter === "all" ? strip : grid)(it.artists)) + section("Albums", (sFilter === "all" ? strip : grid)(it.albums)) +
        section("Playlists", (sFilter === "all" ? strip : grid)(it.playlists)) + section("Podcasts", (sFilter === "all" ? strip : grid)(it.shows)) +
        section("Episodes", list(sFilter === "all" ? (it.episodes || []).slice(0, 4) : it.episodes));
      box.innerHTML = html || empty("Nothing found for “" + text + "”.");
      box.classList.remove("spw-fresh"); void box.offsetWidth; box.classList.add("spw-fresh");
    });
  }

  /* ---------------- detail pages (album / artist / playlist / show / liked) ---------------- */
  var det = $("spw-detail"), detBody = $("spw-detail-body"), detData = null, detGen = 0, detOpen = false;
  det.addEventListener("click", onItemClick);
  det.addEventListener("click", function (ev) { if (ev.target.closest && ev.target.closest("[data-detail-close]")) { if (history.state && history.state.spwDetail) history.back(); else closeDetail(); } });
  window.addEventListener("popstate", function () { if (detOpen) closeDetail(true); });
  window.addEventListener("keydown", function (e) { if (e.key === "Escape" && detOpen) history.back(); });
  function open(kind, id, fromEl) {
    if (fromEl) X.burstAt(fromEl, null, 46);
    var g = ++detGen;
    if (!detOpen) { try { history.pushState({ spwDetail: 1 }, ""); } catch (e) { /* */ } }
    detOpen = true; det.hidden = false; document.body.classList.add("spw-in-detail");
    det.classList.remove("show"); void det.offsetWidth; det.classList.add("show");
    $("spw-detail-scroll").scrollTop = 0;
    detBody.innerHTML = '<div class="spw-dhead skel"><div class="dim"></div><div class="dtx"><div class="kind">' + esc({ album: "Album", artist: "Artist", playlist: "Playlist", show: "Podcast", liked: "Playlist" }[kind] || "") + "</div><h2>&nbsp;</h2></div></div>" + loading();
    SP.browse(kind, kind === "liked" ? {} : { id: id }).then(function (j) {
      if (g !== detGen) return;
      if (!j || j.ok === false) { detBody.innerHTML = empty(errMsg(j)); return; }
      detData = j; paintDetail(j);
      if (j.art && window.HouseSpotifyColor) HouseSpotifyColor(j.art, function (rgb) { det.style.setProperty("--dc", rgb.join(",")); });
    });
  }
  function closeDetail() {
    detOpen = false; det.classList.remove("show"); det.classList.add("hide"); document.body.classList.remove("spw-in-detail");
    setTimeout(function () { if (!detOpen) { det.hidden = true; det.classList.remove("hide"); detBody.innerHTML = ""; } }, 380);
    if (pane !== "search") loadPane(); /* hearts may have changed */
  }
  function paintDetail(j) {
    var k = j.kind, items = j.items || [];
    var kindLbl = { album: (j.albumType === "single" ? "Single" : "Album") + (j.year ? " · " + j.year : ""), artist: "Artist", playlist: "Playlist", show: "Podcast", liked: "Playlist" }[k];
    var sub = k === "album" ? (j.artists || []).map(function (a) { return '<button type="button" class="lnk" data-do="open" data-r="' + R({ kind: "artist", id: a.id, name: a.name }) + '">' + esc(a.name) + "</button>"; }).join(", ") :
      k === "liked" ? esc((j.total || items.length) + " songs") : esc(j.sub || "") + (j.total ? " · " + j.total + (k === "show" ? " episodes" : " songs") : "");
    var canSave = k !== "liked" && j.saved != null, saveLbl = k === "artist" ? (j.saved ? "Following" : "Follow") : j.saved ? "Saved" : "Save";
    var ctx = k === "artist" ? { uris: items.map(function (x) { return x.uri; }) } : k === "liked" ? { contextUri: j.contextUri, fallbackUris: items.map(function (x) { return x.uri; }) } : { contextUri: j.uri, numbered: k === "album" };
    var head = '<div class="spw-dhead k-' + k + '">' + (k === "liked" ? '<div class="dim liked">' + I.heartOn + "</div>" : img(j.art, "dim")) +
      '<div class="dtx"><div class="kind">' + esc(kindLbl) + "</div><h2>" + esc(j.name) + '</h2><div class="dsub">' + sub + "</div>" +
      (j.description ? '<div class="ddesc">' + esc(j.description) + "</div>" : "") + "</div></div>" +
      '<div class="spw-dacts">' +
        (items.length || k !== "playlist" ? '<button type="button" class="spw-dplay" data-do="dplay" aria-label="Play">' + I.play + "</button>" : "") +
        (items.length ? '<button type="button" class="spw-dbtn" data-do="dshuffle">' + I.shuffle + "<span>Shuffle</span></button>" : "") +
        (canSave ? '<button type="button" class="spw-dbtn' + (j.saved ? " on" : "") + '" data-do="dlike">' + (j.saved ? I.heartOn : I.heart) + "<span>" + saveLbl + "</span></button>" : "") +
      "</div>";
    var bodyHtml = "";
    if (k === "artist") bodyHtml = section("Songs", list(items, ctx)) + section("Albums & singles", grid(j.albums));
    else if (k === "playlist" && j.limited) bodyHtml = empty("Spotify only shows the songs of playlists you own here. Tap ▶ to play it.");
    else bodyHtml = list(items, ctx) || empty(k === "liked" ? "No liked songs yet. Tap ♡ on any song." : "Nothing here yet.");
    if (k === "liked" && j.total > items.length) bodyHtml += '<div class="spw-empty">Showing your latest ' + items.length + " of " + j.total + ". ▶ plays them all.</div>";
    detBody.innerHTML = head + bodyHtml;
  }
  function detailAction(dd, b) {
    var j = detData; if (!j) return;
    var items = j.items || [];
    if (dd === "dlike") {
      var on = !j.saved; j.saved = on; b.classList.toggle("on", on);
      b.innerHTML = (on ? I.heartOn : I.heart) + "<span>" + (j.kind === "artist" ? (on ? "Following" : "Follow") : on ? "Saved" : "Save") + "</span>";
      return like(j.uri, on, b);
    }
    var args = j.kind === "liked" ? { contextUri: j.contextUri, fallbackUris: items.map(function (x) { return x.uri; }) } : j.kind === "artist" && !j.uri ? { uris: items.map(function (x) { return x.uri; }) } : { contextUri: j.uri };
    if (!args.contextUri && !(args.uris && args.uris.length)) { args = { uris: items.map(function (x) { return x.uri; }).slice(0, 50) }; }
    if (dd === "dshuffle") {
      X.hit(b);
      return SP.act("shuffle", { state: true }).then(function () { return play(args, j.name + " · shuffled", b); });
    }
    return play(args, j.name, b);
  }

  /* repaint hearts / now-playing marks when the track changes; rooms every paint */
  var lastItem = "";
  X.onPaint(function () {
    paintRooms();
    var it = (SP.player() || {}).item, u = it ? it.uri : "";
    if (u !== lastItem) { lastItem = u; document.querySelectorAll(".spw-tr").forEach(function (r) { var b = r.querySelector("[data-r]"); var e = b && reg[+b.getAttribute("data-r")]; r.classList.toggle("now", !!(e && e.x.uri === u)); }); if (pane === "queue") loadPane(); }
  });

  /* first paint once live; deep links from the hub (#rooms, #search) */
  var booted = false;
  X.onPaint(function (S) {
    if (booted || !(S.phase === "playing" || S.phase === "paused" || S.phase === "idle")) return;
    booted = true; loadPane();
    var h = window.SPW_HASH || "";
    if (/rooms/.test(h)) setTimeout(function () { $("spw-rooms").scrollIntoView({ behavior: "smooth", block: "center" }); }, 1300);
    if (/search/.test(h)) setTimeout(function () { setPane("search", true); }, 1300);
  });

  window.SpwLib = { open: open, pane: setPane, close: function () { if (detOpen) history.back(); } };
})();
