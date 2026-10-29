/* mercury-run.js · chrome-liquid run. ORI1 (Dan via Atlas 10/27): the run is ALWAYS OPEN. The blob's size shows the
   week's filled days (a day is filled when every daily must is closed); a full jar unlocks the grove finale.
   One kid, one blob by default (?coop=2 / ?coop=3 bring back the sibling zones). A touch jumps on touch-down;
   sliding rolls. A fall or a drip gathers the metal back at the last lantern. No tally, no clock, no shame word.
   Kid look comes from ?kid= on the query. Original geometry only. Interim art: Phase 2 art drops into ART_SLOTS. */
(function () {
  "use strict";

  var q = new URLSearchParams(location.search);
  var kid = q.get("kid") || "hayes";
  if (kid !== "harris" && kid !== "ainsley") kid = "hayes";
  var THEME = {
    hayes: { sky: ["#123044", "#3d8eaa", "#e7c48a"], ground: "#164a34", metal: "#d7dde6", accent: "#ffd56a", back: "kid-hayes.html" },
    harris: { sky: ["#102018", "#67a85a", "#d7e8b0"], ground: "#1c3a22", metal: "#d5ddd8", accent: "#e2c56a", back: "kid-harris.html" },
    ainsley: { sky: ["#1a1424", "#8a4a48", "#e0a070"], ground: "#241610", metal: "#e4ddd6", accent: "#ffd8b0", back: "kid-ainsley.html" }
  }[kid];
  /* ORI1 · each kid's blob carries that kid's tint (the liquid shader multiplies by it). Ainsley plays as the blob too,
     in her rose gold; the boys keep their cool silver and green silver. */
  var TINT = { hayes: "#d7dde6", harris: "#d5ddd8", ainsley: "#f6c9b4" };

  var LIQUID = q.get("liquid") !== "0";
  var reduced = false;
  try { reduced = matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}

  var cv = document.getElementById("run");
  var ctx = cv.getContext("2d", { alpha: false });
  var ui = document.getElementById("run-ui");
  var off = document.createElement("canvas");
  var ox = off.getContext("2d", { alpha: false });
  var runPlates = {};
  var runPlatesReady = false;
  function loadRunPlates() {
    var book = window.HousePlates;
    var man = book && book.mercury;
    if (!man) { runPlatesReady = true; return; }
    var jobs = (man.layers || []).map(function (layer) {
      var urls = book.urlFor(kid, layer.id, "landscape", layer.standin).concat(book.urlFor("mercury", layer.id, "landscape", layer.standin));
      return new Promise(function (res) {
        var i = 0;
        function next() {
          if (i >= urls.length) { res(); return; }
          var im = new Image();
          var src = urls[i++];
          im.onload = function () { runPlates[layer.id] = im; res(); };
          im.onerror = function () { next(); };
          im.src = src;
        }
        next();
      });
    });
    Promise.all(jobs).then(function () { runPlatesReady = true; skyToJar(); });
  }
  /* ORI1 · Phase 2 art slots for the day pebbles (Prism). Each slot is null until a Phase 2 manifest names a file
     (HousePlates.mercury.slots[slot] = url, or ?artslots=1 with the default names below); a null slot keeps the interim
     pebbles. The hero and the finale scene come from the monthly skin (SKIN1 below), not from these slots. */
  var ART_SLOTS = { "pebble.on": null, "pebble.off": null };
  var ART_DEFAULTS = { "pebble.on": "art/mercury/pebbles/on.png", "pebble.off": "art/mercury/pebbles/off.png" };
  function loadArtSlots() {
    var man = window.HousePlates && HousePlates.mercury && HousePlates.mercury.slots;
    Object.keys(ART_SLOTS).forEach(function (slot) {
      var url = (man && man[slot]) || (q.get("artslots") === "1" ? ART_DEFAULTS[slot] : null);
      if (!url) return;
      var im = new Image();
      im.onload = function () { ART_SLOTS[slot] = im; };
      im.src = url;
    });
  }
  function art(slot) { var im = ART_SLOTS[slot]; return im && im.complete !== false && im.width ? im : null; }

  /* ORI1 · SKIN1 (Dan via Atlas 10/27): the hero is a monthly skin. Only the hero art and the finale scene change between
     skins; the mechanics never do (size from filled days, jump, landing, finale unlock are all skin-blind).
     Registry: one line per month (YYYY-MM). Art lives in a drop-in folder <dir><kid>/ (layout: SKIN_FILES below).
     The chrome blob is the ONLY fallback: a skin is worn only when its anchors JSON and every required sprite loaded;
     anything missing (or still loading) shows the blob, never a broken image and never code-drawn art.
     A missing finale scene falls back to the default grove finale.
     To add December: drop art/mercury/skins/2026-12/<kid>/ (same layout), list its PNGs in scripts/privacy-art-allowlist.txt,
     and add one line: "2026-12": { id: "...", dir: "art/mercury/skins/2026-12/" }. */
  var SKINS = {
    "2026-10": { id: "pumpkin", dir: "art/mercury/skins/2026-10/" },
    "2026-11": { id: "turkey", dir: "art/mercury/skins/2026-11/", extras: "art/mercury/skins/2026-11/extras/", from: { civil: "2026-11-01", hour: 6 } }
  };
  /* ORIXON1 · Dan's yes (2026-10-28 8:29 PM CT, relayed by Atlas). The r3 extras layer (shine, rim, shadow, breathe, sweep,
     grow, splash, wings, motes, pebbles) is ON BY DEFAULT for a skin worn BY DATE: the skin's month is the month the clock
     picks (skinMonthFor(ctNow())), so November's extras start with the turkey, Sun Nov 1 6:00 AM CT, and never before.
     A ?skin= / ?month= preview of a month the clock has not reached stays extras-free. URL overrides, read on every load
     and never stored (no storage, no cookie, no IndexedDB, no link carries them): ?orix=1 forces the layer on (preview,
     e.g. with ?skin=turkey before Nov 1); ?orix=0 forces it off (QA compare). Rollback = set ORIX_EXTRAS_LIVE to false. */
  var ORIX_EXTRAS_LIVE = true;
  var ORIX_Q = q.get("orix"); /* "1" = force on, "0" = force off, anything else = by date */
  function orixOn(s) { return ORIX_Q === "1" || (ORIX_Q !== "0" && ORIX_EXTRAS_LIVE && !!s && s.month === skinMonthFor(ctNow())); }
  /* layout, per kid folder, at 1x / 2x / 3x (Prism p2 drop with SUMS, bytes copied as is; ORI2: photoreal-r2 ships this
     exact <s>x/<name>.png layout, the art/mercury/platforms/<s>x/ convention; the repo's art allow-list holds plain
     [A-Za-z0-9_./-] paths only, so an older <name>@<s>x.png drop is filed as <s>x/<name>.png):
       <s>x/<state>.png for every state (roll has two frames, roll-1 and roll-2, right-facing: mirrored in code)
       <s>x/eyes-<open|half|closed|happy>.png
       anchors.json (1x px): { "bodyR": px, "states": { "<state>": { "contact": [x, y], "eyes": [x, y] } } }; extra keys ignored
       <s>x/finale.png (optional, lazy: fetched only when the finale shows on a wide or square view)
       <s>x/finale-portrait.png (ORI2, optional, lazy: fetched only when the finale shows on a view taller than wide)
       missing or failed scene = the other orientation's scene, then the default finale; never part of ready
     ORI2 · not wired (carried for a later hook): <month>/text/ caption plates + text.json and fonts/Fredoka-*.woff2; the
     run's captions stay live DOM text.
     ORI3 · a Prism extras layer (shine, rim, contact shadow, idle breathe, grow sweep + ripple, pebbles, splash, power
     marks) is read only for a month whose registry line names it (extras: "<dir>", see SKINX below), only after the base
     set is ready, and it never counts toward ready: an absent, partial or broken extras set can never block the base set.
     ORIX2 · November names the Prism r3 extras drop (art/mercury/skins/2026-11/extras/, SUMS sha16 0453f60fc620bf4b). */
  var SKIN_STATES = ["idle", "squash", "stretch", "fall", "roll-1", "roll-2", "happy", "sleep", "peek", "full"];
  var SKIN_EYES = ["open", "half", "closed", "happy"];
  var SKIN_EXT = ".png";
  (function () { var o = window.MercurySkinBook; if (o) Object.keys(o).forEach(function (m) { SKINS[m] = o[m]; }); })(); /* Prism / QA overlay */
  /* cutover: a month's skin starts at 6:00 AM CT on the 1st (the AMBIENT1 boundary). November reads its start from
     livinghouse/ambient/halloween-dates.json "end" when that loads (same source as AMBIENT1); until then the same value.
     TODO(Dec+): if AMBIENT grows a per-month dates file, read each month's start from it too. */
  var SKIN_HOUR = 6;
  try {
    fetch("livinghouse/ambient/halloween-dates.json", { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (j && j.end && /^\d{4}-\d{2}-\d{2}$/.test(j.end.civil) && SKINS[j.end.civil.slice(0, 7)]) { SKINS[j.end.civil.slice(0, 7)].from = { civil: j.end.civil, hour: +j.end.hour || 0 }; skinSync(); }
    }).catch(function () { /* the built-in rule stands */ });
  } catch (e) { /* no fetch: built-in rule */ }
  function ctNow() {
    try {
      var p = {}; new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" })
        .formatToParts(new Date()).forEach(function (x) { p[x.type] = x.value; });
      return { civil: p.year + "-" + p.month + "-" + p.day, hour: +p.hour % 24 };
    } catch (e) { var d = new Date(); return { civil: d.toISOString().slice(0, 10), hour: d.getHours() }; }
  }
  function prevMonth(m) { var y = +m.slice(0, 4), mo = +m.slice(5, 7) - 1; if (mo < 1) { mo = 12; y--; } return y + "-" + (mo < 10 ? "0" : "") + mo; }
  function before(a, b) { return a.civil < b.civil || (a.civil === b.civil && a.hour < b.hour); }
  function skinMonthFor(now) {
    var m = now.civil.slice(0, 7), sk = SKINS[m];
    var from = (sk && sk.from) || { civil: m + "-01", hour: SKIN_HOUR };
    return before(now, from) ? prevMonth(m) : m;
  }
  function pickSkinMonth() {
    var o = q.get("month") || q.get("skin");
    if (o) {
      if (/^\d{4}-\d{2}$/.test(o)) return o;
      for (var m in SKINS) if (SKINS[m].id === o) return m;
      return "default";
    }
    return skinMonthFor(ctNow());
  }
  var skin = { month: null, id: "blob", def: null, sprites: {}, eyes: {}, anchors: null, fin: {}, ready: false, scale: 1, kid: kid };
  function skinScale() { return Math.max(1, Math.min(3, Math.round((typeof view === "object" && view.dpr) || window.devicePixelRatio || 1))); }
  function loadSkin(month) {
    var def = SKINS[month] || null;
    var s = { month: month, id: def ? def.id : "blob", def: def, sprites: {}, eyes: {}, anchors: null, fin: {}, ready: false, scale: skinScale(), kid: kid };
    skin = s;
    if (!def || !def.dir) return;
    var base = def.dir + kid + "/", sx = s.scale + "x/", need = SKIN_STATES.length + SKIN_EYES.length + 1, got = 0, dead = false;
    function ok() { if (!dead && ++got === need && skin === s) s.ready = true; }
    function img(url, put) {
      var im = new Image();
      im.onload = function () { if (im.width && im.height) { put(im); ok(); } else dead = true; };
      im.onerror = function () { dead = true; };
      im.src = url;
    }
    SKIN_STATES.forEach(function (st) { img(base + sx + st + SKIN_EXT, function (im) { s.sprites[st] = im; }); });
    SKIN_EYES.forEach(function (e) { img(base + sx + "eyes-" + e + SKIN_EXT, function (im) { s.eyes[e] = im; }); });
    try {
      fetch(base + "anchors.json", { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
        if (j && j.states && SKIN_STATES.every(function (st) { return j.states[st] && j.states[st].contact; })) { s.anchors = j; ok(); } else dead = true;
      }).catch(function () { dead = true; });
    } catch (e) { dead = true; }
    /* ORI2 · the finale scenes are NOT preloaded and never count toward ready: finLoad() fetches one lazily when it shows */
  }
  /* ORI2 · lazy finale: one scene per orientation, fetched only when the finale first paints. key "land" = finale.png,
     "port" = finale-portrait.png. State per key: loading / ok / fail; a failed or missing file is never retried. */
  var FIN_FILE = { land: "finale", port: "finale-portrait" };
  function finLoad(s, key) {
    var f = s.fin[key]; if (f) return f;
    f = s.fin[key] = { st: "loading", im: null };
    if (!s.def || !s.def.dir) { f.st = "fail"; return f; }
    var im = new Image();
    im.onload = function () { if (im.width && im.height) { f.im = im; f.st = "ok"; } else f.st = "fail"; };
    im.onerror = function () { f.st = "fail"; };
    im.src = s.def.dir + s.kid + "/" + s.scale + "x/" + FIN_FILE[key] + SKIN_EXT;
    return f;
  }
  function skinSync() { var m = pickSkinMonth(); if (m !== skin.month) { var old = skin; loadSkin(m); skinTransition(old, skin); } }
  /* room left (built later, no-ops today): a per-skin month-boundary transition scene, and an accessory layer at the
     skin's optional accessory anchor (registry: transition: url, accessory: { <kid>: url }). */
  function skinTransition(from, to) { if (!to.def || !to.def.transition) return; /* TODO(SKIN2): play to.def.transition once */ }
  function paintAccessory(g, b, st, sc) { if (!skin.def || !skin.def.accessory || !skin.anchors || !skin.anchors.accessory) return; /* TODO(SKIN2): accessory layer */ }
  function heroArt() { return skin.ready && skin.anchors ? skin : null; }
  /* ORI3 · SKINX extras: an optional Prism layer set on top of a worn skin (registry key extras: "<dir>", same drop-in
     layout as Prism's extras/: <dir><kid>/<s>x/<name>.png, <dir><kid>/anchors-extras.json, <dir>fx/<s>x/<name>.png,
     <dir>fx/fx.json). Rules: nothing is requested until the base skin is ready (heroArt), most layers are fetched the
     first time their moment paints (per state for shadow / shine / rim; sweep + grow on the host's first grow pulse;
     splash on the first splash; wings / motes when that power is on; pebbles when the row first paints), every file
     has its own loading / ok / fail state, a missing or failed file is skipped silently and never retried, and no extra
     ever touches ready, so the base turkey can never fall back to the blob because of extras. Only Prism's layers are
     composited (tint, scale, fade); nothing here draws art. Reduced motion: no breathe, sweep, grow, splash, motes or
     pebble pop; the static layers (shadow, shine, rim, pebbles, wings) only. */
  var EX_BREATHE_MS = 350, EX_GROW_MS = 80, EX_SPLASH_MS = 50, EX_MOTE_MS = 120, EX_POP_MS = 160, EX_WING_MS = 200;
  var EX_AIR_H = 160; /* css px of height at which the airborne shadow reaches its 0.6 scale / 0.4 opacity floor */
  function exOn(s) {
    if (!orixOn(s)) return null; /* ORIXON1 · by date from the month cutover, or the URL override (see ORIX_EXTRAS_LIVE) */
    if (!s || !s.ready || !s.def || typeof s.def.extras !== "string" || !s.def.extras) return null;
    if (s.x) return s.x;
    var x = s.x = { dir: s.def.extras, scale: s.scale, kid: s.kid, ims: {}, req: [], order: [], anc: { st: "loading", j: null }, fxj: { st: "loading", j: null }, splashes: [] };
    function json(url, slot, okj) {
      x.req.push(url);
      try {
        fetch(url, { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
          if (j && typeof j === "object" && okj(j)) { slot.j = j; slot.st = "ok"; } else slot.st = "fail";
        }).catch(function () { slot.st = "fail"; });
      } catch (e) { slot.st = "fail"; }
    }
    json(x.dir + x.kid + "/anchors-extras.json", x.anc, function (j) { return j.bodyR > 0; });
    json(x.dir + "fx/fx.json", x.fxj, function (j) { return !!j.grow; });
    return x;
  }
  /* one file, one state; returns the image only once it loaded */
  function exIm(x, key, url) {
    var e = x.ims[key];
    if (!e) {
      e = x.ims[key] = { st: "loading", im: null };
      x.req.push(url);
      var im = new Image();
      im.onload = function () { if (im.width && im.height) { e.im = im; e.st = "ok"; } else e.st = "fail"; };
      im.onerror = function () { e.st = "fail"; };
      im.src = url;
    }
    return e.st === "ok" ? e.im : null;
  }
  function exKid(x, name) { return /^[a-z0-9-]+$/.test(name) ? exIm(x, "kid:" + name, x.dir + x.kid + "/" + x.scale + "x/" + name + SKIN_EXT) : null; }
  function exFx(x, name) { return /^[a-z0-9-]+$/.test(name) ? exIm(x, "fx:" + name, x.dir + "fx/" + x.scale + "x/" + name + SKIN_EXT) : null; }
  function exFxDef(x, key) { var j = x.fxj.st === "ok" && x.fxj.j[key]; return j && j.pivot3x && j.pivot3x.length === 2 ? j : null; }
  /* ORIX2 · the grow ripple is the grove ripple, grow-1..N, on every board. fx.json other grow entries are never read
     (Prism ships them unwired; its notWired list is pinned by orix2.test.mjs). */
  function exGrow(x) {
    var g = exFxDef(x, "grow"); if (!g) return null;
    return { prefix: "grow", n: Math.max(1, Math.min(12, +g.frames || 6)), pivot: g.pivot3x };
  }
  /* ORIX2 · r3 body layers are cropped to their alpha box: anchors-extras.json layers.<name>.offset1x puts the layer's
     top left inside the body canvas (times the scale). No anchors, or no offset for a layer = that layer is skipped,
     never drawn misregistered. */
  function exOff(x, name) {
    var L = x.anc.st === "ok" && x.anc.j.layers, e = L && L[name];
    return e && e.offset1x && e.offset1x.length === 2 && isFinite(e.offset1x[0]) && isFinite(e.offset1x[1]) ? e.offset1x : null;
  }
  function exLayer(g, x, name, op, alpha, ox, oy, tag) {
    var off = exOff(x, name); if (!off) return false;
    var im = exKid(x, name); if (!im) return false;
    g.save(); g.globalCompositeOperation = op; g.globalAlpha = alpha; g.drawImage(im, ox + off[0] * x.scale, oy + off[1] * x.scale); g.restore();
    x.order.push(tag || name); return true;
  }
  /* the floor under a blob (the highest platform top at or below its bottom), or null over a gap */
  function exGround(b, t) {
    var best = null;
    for (var i = 0; i < plats.length; i++) {
      var px = platX(plats[i], t), top = GY(plats[i].y);
      if (b.x > px - b.r * 0.4 && b.x < px + plats[i].w + b.r * 0.4 && top >= b.y + b.r - 1 && (best == null || top < best)) best = top;
    }
    return best;
  }
  function exShadow(g, x, b, st, an, sc, s, t) {
    var airborne = !b.grounded, h = 0;
    if (airborne) {
      var gy = exGround(b, t), sd = x.anc.st === "ok" && x.anc.j.shadow && x.anc.j.shadow[st];
      if (gy == null || !sd || !sd.center3x) return false; /* over a gap, or no shadow anchor: no shadow */
      h = Math.max(0, gy - (b.y + b.r));
    }
    var sh = x.anc.st === "ok" && x.anc.j.shadow && x.anc.j.shadow[st], shn = (sh && sh.name) || ("shadow-" + st), so = exOff(x, shn);
    if (!so) return false;
    var im = exKid(x, shn); if (!im) return false;
    var k = Math.min(1, h / EX_AIR_H);
    g.save(); g.globalCompositeOperation = "multiply"; g.globalAlpha = 1 - 0.6 * k;
    if (airborne) {
      var cx = sh.center3x[0] * s / 3 - an.contact[0] * s, cy = sh.center3x[1] * s / 3 - an.contact[1] * s;
      g.translate(cx, cy + h / sc); g.scale(1 - 0.4 * k, 1 - 0.4 * k);
      g.drawImage(im, -sh.center3x[0] * s / 3 + so[0] * s, -sh.center3x[1] * s / 3 + so[1] * s);
    } else g.drawImage(im, (so[0] - an.contact[0]) * s, (so[1] - an.contact[1]) * s);
    g.restore();
    x.order.push("shadow"); b.exShadow = true; return true;
  }
  /* idle breathe: frames 1-2-3-4 at 350 ms; frame 1 is the idle sprite itself (not fetched again) */
  function exBreathe(x, sk, t) {
    if (reduced || x.anc.st !== "ok") return null;
    var br = x.anc.j.breathe; if (!br || !br.length) return null;
    var i = Math.floor(t * 1000 / EX_BREATHE_MS) % br.length, f = br[i];
    for (var k = 1; k < br.length; k++) if (br[k] && br[k].name) exKid(x, br[k].name); /* fetch the loop once */
    if (!f || !f.contact || !f.eyes) return null;
    var off = i === 0 ? [0, 0] : exOff(x, f.name); /* frame 1 is the full-canvas idle sprite; 2-4 are cropped */
    var im = !off ? null : i === 0 ? sk.sprites.idle : exKid(x, f.name);
    return im ? { im: im, name: i === 0 ? "idle" : f.name, contact: f.contact, eyes: f.eyes, off: off } : null;
  }
  /* the host's grow pulse: sweep (Prism masked sweep-1..6 to the idle body and sweep-happy-1..6 to the happy pose, so
     each plays only over its own pose) + the grove grow ripple */
  function exPulse(b) {
    var sk = heroArt(), x = b === A && exOn(sk); if (!x || reduced) return;
    x.pulseAt = performance.now();
    for (var i = 1; i <= 6; i++) { exKid(x, "sweep-" + i); exKid(x, "sweep-happy-" + i); }
    var gr = exGrow(x); x.growWanted = true;
    if (gr) for (var j = 1; j <= gr.n; j++) exFx(x, gr.prefix + "-" + j);
  }
  function exPulseFrames(x, sk, st, s, ox, oy, g) {
    if (!x.pulseAt || reduced) return;
    var ms = performance.now() - x.pulseAt;
    if (x.growWanted && x.fxj.st !== "loading") { x.growWanted = false; var gw = exGrow(x); if (gw) for (var j = 1; j <= gw.n; j++) exFx(x, gw.prefix + "-" + j); }
    var sf = Math.floor(ms / EX_GROW_MS) + 1;
    if (sf <= 6 && st === "idle") exLayer(g, x, "sweep-" + sf, "screen", 1, ox, oy);
    else if (sf <= 6 && st === "happy") exLayer(g, x, "sweep-happy-" + sf, "screen", 1, ox, oy);
    var gr = exGrow(x);
    if (gr && sf <= gr.n) {
      var im = exFx(x, gr.prefix + "-" + sf), bodyR = (x.anc.st === "ok" && x.anc.j.bodyR) || sk.anchors.bodyR;
      if (im && bodyR) {
        g.save(); g.globalCompositeOperation = "screen";
        g.drawImage(im, -gr.pivot[0] * s / 3, -bodyR * s - gr.pivot[1] * s / 3);
        g.restore(); x.order.push(gr.prefix + "-" + sf);
      }
    }
    if (sf > Math.max(6, gr ? gr.n : 0)) x.pulseAt = 0;
  }
  /* body-relative scale for fx on any blob (same factor the hero art uses) */
  function exSc(x, sk, b) { var bodyR = (x.anc.st === "ok" && x.anc.j.bodyR) || sk.anchors.bodyR; return bodyR ? b.r / (bodyR * sk.scale) : 0; }
  function exAt(g, im, def, cx, cy, sc, op, alpha, z) {
    var s3 = (heroArt() || skin).scale / 3;
    g.save(); g.globalCompositeOperation = op; g.globalAlpha = alpha;
    g.translate(cx, cy); g.scale(sc * (z || 1), sc * (z || 1));
    g.drawImage(im, -def.pivot3x[0] * s3, -def.pivot3x[1] * s3);
    g.restore();
  }
  /* power marks from the existing power state only: wings while the double jump is ready (scale 1.0 to 1.2 + fade over
     200 ms when it is used), motes looping while the drop magnet is on. Returns which marks the art covered. */
  function exPowers(g, b, t) {
    var sk = heroArt(), x = exOn(sk), out = { wings: false, motes: false };
    if (!x || x.fxj.st !== "ok") return out;
    var pw = b.pw || {}, sc = exSc(x, sk, b), cx = b.x - cam, cy = b.y, now = performance.now();
    if (!sc) return out;
    if (pw.dbl) {
      var wd = exFxDef(x, "wings"), wi = wd && exFx(x, "wings");
      if (!b.air2) b.wingUse = 0; else if (!b.wingUse) b.wingUse = now;
      if (wi) {
        var u = b.wingUse ? (now - b.wingUse) / EX_WING_MS : 0;
        if (u < 1 && !(reduced && b.wingUse)) { exAt(g, wi, wd, cx, cy, sc, "source-over", 1 - u, 1 + 0.2 * u); x.order.push("wings"); }
        out.wings = true;
      }
    }
    if (pw.magnet && !reduced) {
      var md = exFxDef(x, "motes"), n = (md && +md.frames) || 4;
      if (md) for (var i = 1; i <= n; i++) exFx(x, "motes-" + i);
      var mi = md && exFx(x, "motes-" + (Math.floor(now / EX_MOTE_MS) % n + 1));
      if (mi) { exAt(g, mi, md, cx, cy, sc, "screen", 1); x.order.push("motes"); out.motes = true; }
    }
    return out;
  }
  /* splash: six frames at 50 ms, once, at the impact point, neutral silver tinted to the blob's kid in code */
  var exTintCv = null;
  function exSplash(b, x0, y0) {
    var x = exOn(heroArt()); if (!x || reduced) return;
    var sd = exFxDef(x, "splash"), n = (sd && +sd.frames) || 6;
    for (var i = 1; i <= n; i++) exFx(x, "splash-" + i);
    x.splashes.push({ b: b, x: x0, y: y0, at: performance.now(), n: n });
  }
  function exTinted(im, tint) {
    try {
      exTintCv = exTintCv || document.createElement("canvas");
      exTintCv.width = im.width; exTintCv.height = im.height;
      var c = exTintCv.getContext("2d"); c.clearRect(0, 0, im.width, im.height);
      c.globalCompositeOperation = "source-over"; c.drawImage(im, 0, 0);
      c.globalCompositeOperation = "multiply"; c.fillStyle = tint; c.fillRect(0, 0, im.width, im.height);
      c.globalCompositeOperation = "destination-in"; c.drawImage(im, 0, 0);
      c.globalCompositeOperation = "source-over";
      return exTintCv;
    } catch (e) { return im; }
  }
  function exSplashes(g) {
    var sk = heroArt(), x = sk && sk.x; if (!x || !x.splashes.length) return;
    var sd = exFxDef(x, "splash"), now = performance.now();
    x.splashes = x.splashes.filter(function (p) {
      var f = Math.floor((now - p.at) / EX_SPLASH_MS) + 1; if (f > p.n) return false;
      var im = sd && exFx(x, "splash-" + f), sc = exSc(x, sk, p.b);
      if (im && sc) { exAt(g, exTinted(im, p.b.tint || THEME.metal), sd, p.x - cam, p.y, sc, "source-over", 1); x.order.push("splash-" + f); }
      return true;
    });
  }
  /* day pebbles from the existing lit / daysOf state only (no new counts); Ainsley never sees a pebble row (she sees
     no counts), so her blob shows none, art or interim */
  function exPebble(g, b, i, px, y, on, t) {
    if (pebblesHiddenFor(b)) return false; /* ORIX2 · belt and braces: never a pebble for Ainsley, even if a caller forgets */
    var sk = heroArt(), x = exOn(sk), pd = x && exFxDef(x, "pebble");
    if (!pd) return false;
    var im = exFx(x, on ? "pebble-filled" : "pebble-empty");
    exFx(x, on ? "pebble-empty" : "pebble-filled");
    if (!im) return false;
    var z = 1;
    if (on && i === b.lit - 1 && b.litAt && !reduced) z = 0.6 + 0.4 * Math.min(1, (performance.now() - b.litAt) / EX_POP_MS);
    exAt(g, im, pd, px, y, EX_PEBBLE_PX / (pd.canvas3x || 384) * 3 / sk.scale, "source-over", 1, z);
    x.order.push(on ? "pebble-filled" : "pebble-empty");
    return true;
  }
  var EX_PEBBLE_PX = 30; /* css px across one pebble canvas (slots are 18 px apart) */
  function pebblesHiddenFor(b) { return b.kid === "ainsley"; }
  skinSync();
  /* ORI1 · the jar creature in the HUD reflects the run's own sky (it read a 1x1 dark placeholder before: a black ball cluster) */
  var hudJar = null;
  function skyToJar() { try { if (hudJar && hudJar.setEnv && runPlates.sky) hudJar.setEnv(runPlates.sky); } catch (e) { /* cosmetic */ } }
  loadRunPlates();
  loadArtSlots();
  /* SEAM1 · plates tile forever as mirrored copies (edge meets its own mirror, so no hard cut and no black strip
     at any width or scroll). Opaque sky plates get smeared/stretched edge columns trimmed once on load. */
  var plateTrim = typeof WeakMap === "function" ? new WeakMap() : null;
  function trimFor(img) {
    if (!plateTrim) return { l: 0, r: 0 };
    var hit = plateTrim.get(img); if (hit) return hit;
    var res = { l: 0, r: 0 };
    try {
      var sw = 256, sh = 144, c = document.createElement("canvas"); c.width = sw; c.height = sh;
      var g2 = c.getContext("2d", { willReadFrequently: true }); g2.drawImage(img, 0, 0, sw, sh);
      var d = g2.getImageData(0, 0, sw, sh).data, opaque = d[3] > 250 && d[(sw * sh - 1) * 4 + 3] > 250;
      if (opaque) {
        var colVar = function (x) { var s = 0, x2 = x < sw - 1 ? x + 1 : x - 1; for (var y = 0; y < sh; y++) { var a = (y * sw + x) * 4, b = (y * sw + x2) * 4; s += Math.abs(d[a] - d[b]) + Math.abs(d[a + 1] - d[b + 1]) + Math.abs(d[a + 2] - d[b + 2]); } return s / sh; }; /* smear = rows stretched sideways, so neighbour columns match */
        var ref = 0; for (var x = sw * 0.4; x < sw * 0.6; x++) ref += colVar(Math.floor(x)); ref /= sw * 0.2;
        var lim = Math.max(1.2, ref * 0.25), L = 0, R = 0;
        while (L < sw * 0.25 && colVar(L) < lim) L++;
        while (R < sw * 0.25 && colVar(sw - 1 - R) < lim) R++;
        res = { l: (L ? L + 2 : 0) / sw, r: (R ? R + 2 : 0) / sw, opaque: true };
      }
    } catch (e) {}
    plateTrim.set(img, res);
    return res;
  }
  /* SEAM2 · transparent layers (islands, ground, ferns) tile un-mirrored with a feathered 14% overlap, so the
     join crossfades instead of showing a mirror-symmetric fern pair. Opaque sky keeps the mirror tiling. */
  var FEATHER = 0.08, featherCache = typeof WeakMap === "function" ? new WeakMap() : null;
  function feathered(img) {
    var hit = featherCache && featherCache.get(img); if (hit) return hit;
    var c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
    var g2 = c.getContext("2d"); g2.drawImage(img, 0, 0);
    g2.globalCompositeOperation = "destination-in";
    var fw = img.width * FEATHER, gr = g2.createLinearGradient(0, 0, fw, 0);
    gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(0,0,0,1)");
    /* destination-in clears everything outside the drawn op, so one full-width fill: ramp then solid */
    var full = g2.createLinearGradient(0, 0, img.width, 0);
    full.addColorStop(0, "rgba(0,0,0,0)"); full.addColorStop(FEATHER, "rgba(0,0,0,1)"); full.addColorStop(1, "rgba(0,0,0,1)");
    g2.fillStyle = full; g2.fillRect(0, 0, img.width, img.height);
    g2.globalCompositeOperation = "source-over";
    /* some plates carry a cut-off, unpainted (pure black) island at an edge; clear those pixels in the outer 12% */
    try {
      var ew2 = Math.round(img.width * 0.12), hh = Math.round(img.height * 0.7);
      [0, img.width - ew2].forEach(function (x0) {
        var id = g2.getImageData(x0, 0, ew2, hh), dd = id.data, lo = ew2, hi2 = -1;
        for (var i = 0; i < dd.length; i += 4) if (dd[i + 3] > 40 && dd[i] + dd[i + 1] + dd[i + 2] < 25) { var cx = (i / 4) % ew2; if (cx < lo) lo = cx; if (cx > hi2) hi2 = cx; }
        if (hi2 < 0) return;
        /* wipe the whole cut-off island band (edge → past its last black column), so no dark outline is left */
        /* extend to the first empty column so the island goes whole, not sliced */
        var span = Math.round(img.width * 0.3), sd = g2.getImageData(x0 === 0 ? 0 : img.width - span, 0, span, hh).data;
        function colEmpty(c) { for (var y = 0; y < hh; y += 2) if (sd[(y * span + c) * 4 + 3] > 90) return false; return true; }
        if (x0 === 0) { var c = hi2; while (c < span - 1 && !colEmpty(c)) c++; g2.clearRect(0, 0, c + 2, hh); }
        else { var c2 = span - (ew2 - lo); while (c2 > 0 && !colEmpty(c2)) c2--; g2.clearRect(img.width - span + c2 - 2, 0, span - c2 + 2, hh); }
      });
    } catch (e) {}
    if (featherCache) featherCache.set(img, c);
    return c;
  }
  function drawRunPlate(g, img, W, H, oxOff, parallax) {
    if (!img) return;
    var tr = trimFor(img);
    if (!tr.opaque) {
      var fi = feathered(img), sc = Math.max(W / img.width, H / img.height) * 1.08;
      var fdw = img.width * sc, fdh = img.height * sc, step = fdw * (1 - FEATHER);
      var fx = (W - fdw) / 2 - cam * parallax + (oxOff || 0), fy = (H - fdh) / 2;
      var j0 = Math.floor(-fx / step) - 1, j1 = Math.ceil((W - fx) / step);
      for (var j = j0; j <= j1; j++) g.drawImage(fi, Math.floor(fx + j * step), fy, fdw, fdh);
      return;
    }
    var sx = img.width * tr.l, sw = img.width * (1 - tr.l - tr.r);
    var scale = Math.max(W / sw, H / img.height) * 1.08;
    var dw = Math.ceil(sw * scale), dh = img.height * scale;
    var x = (W - dw) / 2 - cam * parallax + (oxOff || 0), y = (H - dh) / 2;
    var k0 = Math.floor(-x / dw), k1 = Math.ceil((W - x) / dw);
    for (var k = k0; k < k1; k++) {
      var tx = Math.floor(x + k * dw);
      if (k & 1) { g.save(); g.translate(tx + dw, y); g.scale(-1, 1); g.drawImage(img, sx, 0, sw, img.height, -0.5, 0, dw + 1, dh); g.restore(); }
      else g.drawImage(img, sx, 0, sw, img.height, tx - 0.5, y, dw + 1, dh);
    }
  }

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function tone(kind, step) {
    try {
      if (!window.HouseSfx || (HouseSfx.isMuted && HouseSfx.isMuted())) return;
      var ac = HouseSfx.ensureCtx && HouseSfx.ensureCtx();
      var master = HouseSfx.masterGain && HouseSfx.masterGain();
      if (!ac || !master) return;
      var t0 = ac.currentTime;
      var o = ac.createOscillator();
      var g = ac.createGain();
      o.type = kind === "splash" ? "triangle" : "sine";
      var f0 = kind === "jump" ? 320 : kind === "land" ? 140 : kind === "grove" ? 520 : 220;
      var f1 = kind === "jump" ? 640 : kind === "land" ? 70 : kind === "grove" ? 880 : 90;
      var up = Math.pow(1.122, step || 0); /* ORI1 · reveal chimes climb a whole step per filled day */
      o.frequency.setValueAtTime(f0 * up, t0);
      o.frequency.exponentialRampToValueAtTime(Math.max(40, f1 * up), t0 + 0.18);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(kind === "splash" ? 0.09 : 0.06, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.28);
      o.connect(g); g.connect(master);
      o.start(t0); o.stop(t0 + 0.32);
      if (kind === "splash" || kind === "land") {
        var n = ac.createBuffer(1, 4000, ac.sampleRate);
        var d = n.getChannelData(0);
        for (var i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
        var s = ac.createBufferSource();
        var bp = ac.createBiquadFilter();
        bp.type = "lowpass"; bp.frequency.value = kind === "splash" ? 1800 : 400;
        var ng = ac.createGain();
        ng.gain.setValueAtTime(0.08, t0);
        ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2);
        s.buffer = n; s.connect(bp); bp.connect(ng); ng.connect(master); s.start(t0);
      }
    } catch (err) {}
  }

  /* SHARP1 · devicePixelRatio-aware backing: up to 2x, capped at 2560x1440 total pixels (a 1440p wall at 1:1).
     Floor = the old 1400px-wide cap. If frames run slow (avg > 20 ms over 2 s) the scale steps down toward the floor;
     if they run fast (< 13 ms over 4 s) it steps back up. ?adapt=0 pins the full target for measuring. */
  var MAX_PX = 2560 * 1440;
  var dprScale = 1, adaptT = 0, adaptN = 0, adaptSum = 0;
  var ADAPT = q.get("adapt") !== "0";
  function targetDpr(w, h) {
    var d = Math.min(2, devicePixelRatio || 1);
    if (w * h * d * d > MAX_PX) d = Math.sqrt(MAX_PX / (w * h));
    return d;
  }
  function floorDpr(w) { return Math.min(1.35, devicePixelRatio || 1, 1400 / w); }
  function adapt(dtMs) {
    if (!ADAPT) return;
    adaptT += dtMs; adaptN++; adaptSum += dtMs;
    var avg = adaptSum / adaptN, w = innerWidth, h = innerHeight;
    var lo = floorDpr(w) / targetDpr(w, h);
    if (adaptT > 2000 && avg > 20 && dprScale > lo + 0.001) { dprScale = Math.max(lo, dprScale * 0.85); resize(); }
    else if (adaptT > 4000 && avg < 13 && dprScale < 1) { dprScale = Math.min(1, dprScale / 0.85); resize(); }
    else if (adaptT <= 4000) return;
    adaptT = 0; adaptN = 0; adaptSum = 0;
  }
  function resize() {
    var w = innerWidth, h = innerHeight;
    var dpr = Math.max(floorDpr(w), targetDpr(w, h) * dprScale);
    cv.width = off.width = Math.round(w * dpr);
    cv.height = off.height = Math.round(h * dpr);
    cv.style.width = w + "px";
    cv.style.height = h + "px";
    if (view.dpr !== dpr) platCache = {};
    view.dpr = dpr;
    view.w = w; view.h = h;
  }

  /* course */
  var plats = [];
  var drips = [];
  var goalX = 0;
  (function build() {
    var x = 40;
    var y = 420;
    for (var i = 0; i < 16; i++) {
      var w = 150 + (i % 3) * 40;
      var gap = 70 + (i % 4) * 28;
      if (i === 0) gap = 0;
      x += gap;
      y = 280 + Math.sin(i * 0.7) * 70 + (i % 5 === 4 ? -50 : 0);
      plats.push({ x: x, y: y, w: w, h: 22, cp: i % 3 === 0, vx: i % 5 === 2 ? 36 : 0, phase: i });
      if (i % 4 === 3) { drips.push({ x: x + w * 0.5, y: y - 160, r: 16, p: i }); plats[plats.length - 1].drip = true; }
      x += w;
    }
    goalX = x + 40;
    plats.push({ x: goalX, y: 300, w: 180, h: 26, cp: true, vx: 0, phase: 0, grove: true });
  })();

  var gatherLog = [];
  function lowestTop() { var m = -1e9; for (var i = 0; i < plats.length; i++) m = Math.max(m, GY(plats[i].y)); return m; }
  function platX(p, t) { return p.x + (p.vx ? Math.sin(t * 0.8 + p.phase) * 46 : 0); }
  function GY(y) { return y - 340 + view.h * 0.62; }

  function Blob(x, y, echo) {
    this.x = x; this.y = y; this.vx = 0; this.vy = 0;
    this.r = this.r0 = q.get("demo") === "1" ? 30 : 26; /* BIG1: reads on a phone */ this.rT = this.r; this.days = -1; this.fillK = 0; this.grounded = false; this.coyote = 0; this.squash = 1;
    this.cp = { x: x, y: y }; this.alive = true; this.echo = echo; this.hold = null;
    this.tint = TINT.hayes; this.lit = 0; /* ORI1 · tint per kid; lit = day pebbles lit so far by the entry reveal */
    this.inv = 0;
  }
  var spawn = { x: plats[0].x + 40, y: plats[0].y - 30 };
  var A = new Blob(spawn.x, spawn.y, false);
  var B = new Blob(spawn.x + 28, spawn.y, true);
  /* POWERUPS1 · closed chores become power-ups. READ-ONLY: JarEngine.choreState(kid), the same read the gate uses.
     double jump = that kid's musts for today are all closed; drop magnet = that kid's week jar is at least half full.
     ?fixture=1 swaps in FIXTURE values (badge on screen) for proof captures only. */
  var KIDS = ["hayes", "harris", "ainsley"];
  var NAMES = { hayes: "Hayes", harris: "Harris", ainsley: "Ainsley" };
  var SIBS = KIDS.filter(function (k) { return k !== kid; });
  var FIXTURE = q.get("fixture") === "1";
  var FIX_PW = {}; FIX_PW[kid] = { dbl: true, magnet: true }; FIX_PW[SIBS[0]] = { dbl: true, magnet: false }; FIX_PW[SIBS[1]] = { dbl: false, magnet: false };
  /* COOP1 · up to three kids on one wall: host + siblings. The wall splits into one touch zone per kid
     (left to right); a zone with no hand runs its blob as a calm echo. ?coop=2 keeps it to two. */
  var C = new Blob(spawn.x + 56, spawn.y, true);
  A.kid = kid; B.kid = SIBS[0]; C.kid = SIBS[1];
  [A, B, C].forEach(function (b) { b.tint = TINT[b.kid] || TINT.hayes; });
  /* ORI1 · single player by default: one kid, one blob, the whole screen is that kid's zone. ?coop=2 / ?coop=3 bring back
     the sibling zones (COOP1) for a shared wall. */
  var COOP = q.get("coop");
  var blobs = COOP === "3" ? [A, B, C] : COOP === "2" ? [A, B] : [A];
  function zoneFor(x, w, n) { return n <= 1 ? 0 : Math.max(0, Math.min(n - 1, Math.floor(x / (w / n)))); }
  /* DEMO1 · ?demo=1 attract mode: the host blob runs itself too (preview captures / idle wall). */
  if (q.get("demo") === "1") A.auto = true;
  function powersFor(k) {
    if (FIXTURE) return FIX_PW[k];
    try {
      var st = window.JarEngine && JarEngine.choreState(k, { dayIso: liveDayIso() }); /* ORI1 · live today */
      if (!st) return { dbl: false, magnet: false };
      return { dbl: st.todayNeed > 0 && st.todayDone >= st.todayNeed, magnet: (st.fill || 0) >= 0.5 };
    } catch (e) { return { dbl: false, magnet: false }; }
  }
  /* NIGHT52 · GROW1: a day is "filled" when every daily must for that day is closed (same WardKids read as the jar).
     Each filled day this week grows the blob a step; a new filled day lands with an in-world pulse (FILLFX1). */
  /* ORI1 · GROW2: a visible step. Each filled day adds GROW_K of the base radius (26 px base: about 3.6 px a day,
     7 days = about twice the base). On entry the blob starts at its base size and the reveal grows it one day at a time. */
  var GROW_K = 0.14, WEEK_N = 7;
  function growR(r0, n) { return r0 * (1 + GROW_K * Math.max(0, n || 0)); }
  /* ORI1 · today is computed live every read (Chicago date now), never the date frozen when the page loaded,
     so a run left open across midnight moves to the new day. */
  function liveDayIso() {
    try { if (window.HouseClock && HouseClock.iso) return HouseClock.iso(new Date()); } catch (e) { /* fall through */ }
    try { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
    catch (e2) { var WK = window.WardKids; return WK && WK.DAY_ISO; }
  }
  function filledDays(k) {
    try {
      var WK = window.WardKids, data = WK && WK._data;
      if (!WK || !data || !data.kids || !data.kids[k] || typeof WK.mustQuests !== "function" || typeof WK.weekDayIsos !== "function") return null;
      var qs = (WK.mustQuests(k, data) || []).filter(function (x) { return x && !x.optional && x.cadence !== "addon" && (x.cadence || "daily") === "daily"; });
      if (!qs.length) return null;
      var days = WK.weekDayIsos(liveDayIso()) || [], n = 0;
      days.forEach(function (iso) { if (qs.every(function (x) { return !!WK.getCheck(x.id, data, iso); })) n += 1; });
      return { n: n, of: days.length || WEEK_N };
    } catch (e) { return null; }
  }
  /* ORI1 · entry fill reveal: once the week is known, each filled day lights its pebble, grows the blob one step and
     chimes (HouseSfx), one day at a time. A day filled later in the run reveals the same way. */
  var REVEAL_GAP = 0.6;
  var reveal = { count: 0, queue: [], next: 0, started: false, log: [] };
  function refreshGrowth() {
    allBlobs().forEach(function (b) {
      var fd = FIXTURE ? { n: b === A ? 4 : b === B ? 2 : 0, of: 7 } : filledDays(b.kid);
      if (!fd) { b.daysOf = 0; return; }
      b.days = fd.n; b.daysOf = fd.of;
      if (b.lit > fd.n) { b.lit = fd.n; b.rT = growR(b.r0, fd.n); } /* a day un-ticked (or a new week): shrink back, no fanfare */
      for (var i = b.lit + reveal.queue.filter(function (s) { return s.b === b; }).length; i < fd.n; i++) reveal.queue.push({ b: b, day: i });
    });
  }
  function stepReveal(t) {
    if (!reveal.queue.length) return;
    if (!reveal.started) { reveal.started = true; reveal.next = t + 0.5; }
    if (t < reveal.next) return;
    var s = reveal.queue.shift();
    var b = s.b;
    if (s.day >= b.days) return; /* the day was un-ticked before its turn */
    b.lit = s.day + 1; b.litAt = performance.now();
    b.rT = growR(b.r0, b.lit);
    reveal.count += 1;
    reveal.log.push([b.kid, b.lit]);
    fillPulse(b);
    chime(s.day);
    reveal.next = t + (reduced ? 0.3 : REVEAL_GAP);
  }
  function chime(i) {
    try { if (window.HouseSfx && typeof HouseSfx.quest === "function") HouseSfx.quest(); } catch (e) { /* sound is optional */ }
    tone("grove", i);
  }
  function fillPulse(b) {
    b.fillK = 1; b.squash = 1.25;
    exPulse(b); /* ORI3 · sweep + grow ripple (host, fetched on this first pulse) */
    burst(b.x, b.y - b.r * 0.4, reduced ? 6 : 14, "#ffe2a8");
    rings.push({ x: b.x, y: b.y, r: b.r, a: 0.7 });
  }
  window.__merc = function () { return blobs.map(function (b) { return { kid: b.kid, x: Math.round(b.x), y: Math.round(b.y), vy: Math.round(b.vy), r: +b.r.toFixed(1), rT: b.rT, r0: b.r0, days: b.days, of: b.daysOf, lit: b.lit, grounded: !!b.grounded, tint: b.tint }; }); }; /* read-only QA probe */
  window.__mercReveal = function () { return { count: reveal.count, pending: reveal.queue.length, log: reveal.log.slice() }; }; /* read-only QA probe */
  window.__mercFillTest = function (k) { var b = allBlobs().filter(function (x) { return x.kid === (k || kid); })[0]; if (!b) return null; b.days = Math.max(0, b.days) + 1; reveal.queue.push({ b: b, day: b.days - 1 }); return { days: b.days, rT: growR(b.r0, b.days) }; };
  var pebRects = []; /* ORIX2 · read-only QA probe: css px boxes of the pebbles painted in the last frame */
  window.__mercPebbles = function () { return pebRects.map(function (p) { return { kid: p.kid, x: p.x, y: p.y, w: p.w, h: p.h }; }); };
  function paintFill(g, t) {
    g.save();
    pebRects = [];
    blobs.forEach(function (b) {
      if (!b.daysOf || pebblesHiddenFor(b)) return;
      /* ORI1 · bigger day pebbles (6 px lit, 4.5 px waiting, 18 px apart) under the blob; a newly lit one glows */
      var x = b.x - cam, y = b.y + b.r + 18, n = b.daysOf, gap = 18, x0 = x - (n - 1) * gap / 2;
      var pOn = art("pebble.on"), pOff = art("pebble.off");
      for (var i = 0; i < n; i++) {
        var on = i < b.lit, px = x0 + i * gap, pr = on ? 6 : 4.5;
        pebRects.push({ kid: b.kid, x: px - EX_PEBBLE_PX / 2, y: y - EX_PEBBLE_PX / 2, w: EX_PEBBLE_PX, h: EX_PEBBLE_PX });
        var im = on ? pOn : pOff;
        if (exPebble(g, b, i, px, y, on, t)) continue; /* ORI3 · Prism pebbles when loaded */
        if (im) { g.drawImage(im, px - pr * 1.6, y - pr * 1.6, pr * 3.2, pr * 3.2); continue; }
        g.beginPath(); g.arc(px, y, pr, 0, 7);
        g.fillStyle = on ? "rgba(255,226,168,0.98)" : "rgba(255,255,255,0.26)"; g.fill();
        if (on) {
          var fresh = i === b.lit - 1 ? b.fillK : 0;
          g.globalCompositeOperation = "lighter"; g.beginPath(); g.arc(px, y, 11 + fresh * 10, 0, 7);
          g.fillStyle = "rgba(255,200,120," + (0.2 + fresh * 0.45).toFixed(3) + ")"; g.fill(); g.globalCompositeOperation = "source-over";
        }
      }
      if (b.fillK > 0.01) {
        var k = b.fillK, e = 1 - k;
        g.globalCompositeOperation = "lighter";
        var rg = g.createRadialGradient(x, b.y, b.r * 0.6, x, b.y, b.r * (1.4 + e * 1.2));
        rg.addColorStop(0, "rgba(255,220,150," + (0.45 * k).toFixed(3) + ")"); rg.addColorStop(1, "rgba(255,220,150,0)");
        g.fillStyle = rg; g.beginPath(); g.arc(x, b.y, b.r * (1.4 + e * 1.2), 0, 7); g.fill();
        g.globalCompositeOperation = "source-over";
      }
    });
    g.restore();
  }
  /* ORI1 · finale: a full jar unlocks the grove finale (the run itself is always open) */
  var finale = false;
  function refreshPowers() {
    allBlobs().forEach(function (b) { b.pw = powersFor(b.kid); });
    skinSync(); /* SKIN1 · a run open across the month cutover changes skin; mechanics untouched */
    refreshGrowth();
    var st = jarState(kid);
    if (st.full && !finale && playing) note("Your jar is full. Run the grove!");
    finale = !!st.full;
    paintPowerHud();
  }
  function jarState(k) {
    try { return window.JarEngine ? JarEngine.choreState(k, { dayIso: liveDayIso() }) : { full: false }; } catch (e) { return { full: false }; }
  }
  /* ORI1 · re-read the week whenever it can have changed: back to the tab, focus, another tab's tick (storage), a fresh
     week from the hub, a chore tick on this page; plus a 15 s heartbeat. */
  function rereadSoon() { if (!playing) return; clearTimeout(rereadSoon.t); rereadSoon.t = setTimeout(refreshPowers, 60); }
  ["focus", "pageshow", "storage"].forEach(function (ev) { window.addEventListener(ev, rereadSoon); });
  ["house:kids-data-ready", "house:cleared", "house:goal-hit"].forEach(function (ev) { document.addEventListener(ev, rereadSoon); });
  function allBlobs() { return blobs; }
  function paintPowerHud() {
    var el = ui.querySelector(".hud span"); if (!el) return;
    el.innerHTML = (FIXTURE ? '<b class="fixture">FIXTURE</b> ' : "") + allBlobs().map(function (b) {
      var pw = b.pw || {};
      return '<i class="pw">' + NAMES[b.kid] + ' <em class="' + (pw.dbl ? "on" : "off") + '">double jump</em> <em class="' + (pw.magnet ? "on" : "off") + '">drop magnet</em></i>';
    }).join(" ");
  }
  var drops = [];
  var rings = [];
  var cam = 0;
  var shake = 0;
  var won = false;
  var playing = false;
  var lastTouch = performance.now(); /* SKIN1 · the hero dozes (sleep sprite) after 30 s with no touch */
  var t0 = performance.now();
  var view = { w: 800, h: 600, dpr: 1 };
  var pointers = {};

  function burst(x, y, n, color) {
    if (reduced) n = Math.min(n, 6);
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2;
      var s = 60 + Math.random() * 150;
      drops.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 120, a: 1, r: 2 + Math.random() * 5, c: color });
    }
    rings.push({ x: x, y: y, r: 6, a: 0.85 });
  }
  function gather(b, why) {
    if (b.inv > 0) return;
    gatherLog.push([b.kid, why || "fall", Math.round(b.x)]);
    if (why === "drip" && b.pw && b.pw.magnet) { /* drop magnet: the splash pulls straight back in, no trip to the lantern */
      burst(b.x, b.y, 10, b.tint); tone("splash"); exSplash(b, b.x, b.y);
      b.vy = Math.min(b.vy, -260); b.inv = 0.6; b.magnetT = 0.6; return;
    }
    burst(b.x, Math.min(b.y, view.h * 0.86), 12, b.tint);
    tone("splash"); exSplash(b, b.x, Math.min(b.y, view.h * 0.86));
    shake = 0;
    b.ret = { x0: b.x, y0: Math.min(b.y, view.h * 0.86), k: 0 }; b.vx = 0; b.vy = 0; b.inv = 0.45; b.alive = true;
  }

  /* PILOT1 · echo + ?demo=1 blobs plan every hop: walk calmly to a take-off point, jump, then steer in the air
     toward a landing spot on the next platform (moving platforms predicted to the landing moment). If the next
     top is above the arc they use the double jump. Same physics as a kid's blob; only the steering is planned. */
  function platUnder(b, t) {
    for (var i = 0; i < plats.length; i++) {
      var px = platX(plats[i], t), top = GY(plats[i].y);
      if (b.x > px - b.r * 0.4 && b.x < px + plats[i].w + b.r * 0.4 && Math.abs(b.y + b.r - top) < 6) return i;
    }
    return -1;
  }
  function landSpot(pl, tt) { return platX(pl, tt) + (pl.drip ? 22 : Math.min(70, pl.w * 0.4)); } /* land short of a drip lane */
  function autoPilot(b, dt, t) {
    var WALK = 120;
    if (b.grounded) {
      var hi = platUnder(b, t);
      if (hi < 0) return;
      b.tgt = hi + 1 < plats.length ? hi + 1 : -1;
      var here = plats[hi];
      if (b.tgt < 0) { b.vx += clamp(platX(here, t) + here.w * 0.5 - b.x, -WALK, WALK) * 4 * dt; return; }
      var nx = plats[b.tgt];
      var off = platX(here, t) + here.w - 34;
      /* time the dark drips: stop short of one hanging in our lane, go the moment it has dropped past us */
      var dripClear = false;
      for (var di = 0; di < drips.length; di++) {
        var dr = drips[di], ddx = dr.x - b.x;
        if (ddx > -44 && ddx < 110 && Math.abs(GY(dr.y) + 160 - (b.y + b.r)) < 40) {
          var rel = ((t * 90 + dr.p * 40) % 180) - 160; /* collides while rel is in (-67, 7) */
          if (b.cross === di) { dripClear = true; continue; }       /* committed: keep rolling through */
          if (ddx > 38 && ddx < 95) { if (rel > 9) { b.cross = di; dripClear = true; } else { b.vx *= Math.pow(1e-6, dt); return; } }
          else if (ddx <= 38) dripClear = true;
        }
      }
      if (dripClear) { b.vx = 170; return; }
      if (b.x < off - 4) { b.vx += (WALK - b.vx) * Math.min(1, dt * 3); return; }
      /* moving target: wait on the lip until it is swinging toward us or near its closest point */
      if (nx.vx && Math.cos(t * 0.8 + nx.phase) > 0.2) { b.vx *= Math.pow(0.05, dt); return; }
      b.want = 0.14; b.press = true; b.jumps = (b.jumps || 0) + 1;
      b.flourish = !!(b.pw && b.pw.dbl && b.jumps % 3 === 0);
      return;
    }
    if (b.tgt == null || b.tgt < 0) return;
    var pl = plats[b.tgt], ty = GY(pl.y) - b.r, dy = ty - b.y;
    var disc = b.vy * b.vy + 3400 * dy;
    var canDbl = b.pw && b.pw.dbl && !b.air2;
    if (canDbl && (disc < 0 || (b.flourish && b.vy > -60 && b.vy < 120))) {
      b.vy = -600; b.air2 = true; b.flourish = false; b.squash = 0.8;
      rings.push({ x: b.x, y: b.y + b.r, r: 8, a: 0.5 }); tone("jump");
      disc = b.vy * b.vy + 3400 * dy;
    }
    if (disc < 0) return;
    var tau = (-b.vy + Math.sqrt(disc)) / 1700;
    if (tau < 0.02) return;
    var want = (landSpot(pl, t + tau) - b.x) / tau;
    b.vx += (clamp(want, -340, 340) - b.vx) * Math.min(1, dt * 10);
  }
  /* SOFT1 · a fall is a soft, on-purpose return: the metal mists and flows back to the last lantern along an arc
     (0.9 s, eased) instead of popping. Falling past the platform line counts, so nothing sinks into the painted ground. */
  function stepReturn(b, dt) {
    var r = b.ret; r.k = Math.min(1, r.k + dt / 0.9);
    var e = r.k * r.k * (3 - 2 * r.k);
    var cpy = cpY(b);
    b.x = r.x0 + (b.cp.x - r.x0) * e;
    b.y = r.y0 + (cpy - r.y0) * e - Math.sin(e * Math.PI) * 90;
    b.squash = 0.85 + 0.15 * e;
    if (r.k >= 1) { b.ret = null; b.vx = 0; b.vy = 0; b.inv = 0.3; b.grounded = b.cp.top != null; rings.push({ x: b.x, y: b.y + b.r, r: 8, a: 0.5 }); }
  }
  /* ORI1 · LAND2: a lantern remembers the platform top, not a centre height, so a blob that grew since is set back ON it
     (the old centre height put a grown blob's bottom below the top, past the landing check: it fell through and looped). */
  function cpY(b) { return b.cp.top != null ? b.cp.top - b.r : b.cp.y; }
  function landTol(r) { return Math.max(12, r * 0.5); }

  function stepBlob(b, dt, t, input) {
    if (won) return;
    if (b.ret) { stepReturn(b, dt); return; }
    b.inv = Math.max(0, b.inv - dt);
    var r1 = b.r;
    b.r += (b.rT - b.r) * Math.min(1, dt * 4); b.fillK = Math.max(0, (b.fillK || 0) - dt / 1.6);
    if (b.grounded) b.y -= b.r - r1; /* ORI1 · LAND2: grow upward from the platform, the bottom stays on the top */
    b.magnetT = Math.max(0, (b.magnetT || 0) - dt);
    var accel = 0;
    if (input) {
      var worldX = cam + input.x;
      accel = clamp(worldX - b.x, -160, 160);
      b.vx += accel * 8 * dt;
      if (input.jump) { b.want = 0.12; b.press = true; input.jump = false; }
    } else if (b.echo || b.auto) {
      autoPilot(b, dt, t);
    }
    b.want = (b.want || 0) - dt;
    if (b.want <= 0) b.press = false;
    if (b.grounded) b.coyote = 0.12; else b.coyote -= dt;
    if (b.grounded) b.air2 = false;
    if (b.want > 0 && (b.grounded || b.coyote > 0)) {
      b.vy = -720; b.grounded = false; b.coyote = 0; b.want = 0; b.squash = 0.72;
      tone("jump");
    } else if (b.want > 0 && b.press && b.pw && b.pw.dbl && !b.air2 && b.coyote <= 0) {
      b.vy = -600; b.air2 = true; b.want = 0; b.squash = 0.8; /* double jump: a soft second push, a quiet ring */
      rings.push({ x: b.x, y: b.y + b.r, r: 8, a: 0.5 });
      tone("jump");
    }
    b.vy += 1700 * dt;
    b.vx = clamp(b.vx, -380, 380);
    b.x += b.vx * dt;
    var nextY = b.y + b.vy * dt;
    var was = b.grounded;
    b.grounded = false;
    if (b.vy >= 0) {
      for (var p = 0; p < plats.length; p++) {
        var pl = plats[p];
        var left = platX(pl, t);
        if (b.x > left - b.r * 0.4 && b.x < left + pl.w + b.r * 0.4) {
          var top = GY(pl.y);
          if (b.y + b.r <= top + landTol(b.r) && nextY + b.r >= top) { /* ORI1 · LAND2: tolerance scales with the blob */
            nextY = top - b.r;
            if (b.vy > 220) { burst(b.x, top, 8, b.tint); tone("land"); b.squash = 1.35; }
            b.vy = 0; b.grounded = true;
            if (pl.vx) b.x += platX(pl, t) - platX(pl, t - dt); /* CARRY1: ride moving platforms */
            if (pl.cp) b.cp = { x: b.x, y: nextY, top: top };
          }
        }
      }
    }
    b.y = nextY;
    if (b.grounded) b.vx *= Math.pow(0.15, dt);
    else b.vx *= Math.pow(0.55, dt);
    b.squash += (1 - b.squash) * Math.min(1, dt * 8);
    if (b.y > lowestTop() + 70) gather(b); /* SOFT1: below every platform = gentle return, before it reaches the painted ground */
    for (var d = 0; d < drips.length; d++) {
      var dr = drips[d];
      var dy = GY(dr.y) + ((t * 90 + dr.p * 40) % 180);
      if (Math.hypot(b.x - dr.x, b.y - dy) < b.r + dr.r * 0.45) gather(b, "drip");
    }
    if (was && !b.grounded) { /* stepped off */ }
  }

  function stepDrops(dt) {
    for (var i = drops.length - 1; i >= 0; i--) {
      var d = drops[i];
      d.age = (d.age || 0) + dt;
    if (d.age > 0.22) {
      var near = blobs[0];
      blobs.forEach(function (b) { if (Math.hypot(b.x - d.x, b.y - d.y) < Math.hypot(near.x - d.x, near.y - d.y)) near = b; });
      var tx = near.x, ty = near.y;
      var pull = near.magnetT > 0 ? 22 : 8;
      d.vx += (tx - d.x) * pull * dt;
      d.vy += (ty - d.y) * pull * dt;
      d.r *= Math.max(0.2, 1 - dt * 1.4);
      if (Math.hypot(tx - d.x, ty - d.y) < 10 || d.r < 0.7) { drops.splice(i, 1); continue; }
    }
    d.vy += 900 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.a -= dt * 0.35;
      if (d.a <= 0) drops.splice(i, 1);
    }
    for (var r = rings.length - 1; r >= 0; r--) {
      rings[r].r += 140 * dt;
      rings[r].a -= dt * 1.35;
      if (rings[r].a <= 0) rings.splice(r, 1);
    }
  }

  function paintWorld(g, t, W, H) {
    if (runPlates.sky) drawRunPlate(g, runPlates.sky, W, H, Math.sin(t * 0.1) * 8, 0.05);
    else {
      var sky = g.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, THEME.sky[0]);
      sky.addColorStop(0.55, THEME.sky[1]);
      sky.addColorStop(1, THEME.sky[2]);
      g.fillStyle = sky;
      g.fillRect(0, 0, W, H);
    }
    drawRunPlate(g, runPlates.far, W, H, 0, 0.12);
    drawRunPlate(g, runPlates.mid, W, H, 0, 0.28);
    drawRunPlate(g, runPlates.near, W, H, 0, 0.46);
    var fog = g.createLinearGradient(0, H * 0.35, 0, H);
    fog.addColorStop(0, "rgba(8,12,16,0)");
    fog.addColorStop(1, "rgba(8,12,16,0.45)");
    g.fillStyle = fog;
    g.fillRect(0, H * 0.35, W, H * 0.65);
    g.fillStyle = "rgba(255,255,255,0.05)";
    for (var f = 0; f < 3; f++) {
      g.beginPath();
      g.ellipse((f * 280 - cam * 0.2) % (W + 100), H * 0.62, 120, 16, 0, 0, 7);
      g.fill();
    }
    g.save();
    g.translate(-cam, 0);
    for (var p = 0; p < plats.length; p++) {
      var pl = plats[p];
      var x = platX(pl, t);
      var py = GY(pl.y);
      livingPlat(g, x, py, pl.w, t, p, pl.grove);
      if (pl.cp) {
        var lx = x + 18, ly = py - 18;
        var lg = g.createRadialGradient(lx, ly, 1, lx, ly, 22);
        lg.addColorStop(0, "#fff");
        lg.addColorStop(0.4, THEME.accent);
        lg.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = lg;
        g.beginPath(); g.arc(lx, ly, 22, 0, 7); g.fill();
      }
    }
    for (var d = 0; d < drips.length; d++) {
      var dr = drips[d];
      var dy = GY(dr.y) + ((t * 90 + dr.p * 40) % 180);
      /* DRIP2 · the hazard reads as a dark-thorn ember with a violet glow, never as a second blob */
      var hg = g.createRadialGradient(dr.x, dy, 2, dr.x, dy, dr.r * 2.6);
      hg.addColorStop(0, "rgba(190,120,255,0.55)"); hg.addColorStop(0.45, "rgba(120,60,200,0.18)"); hg.addColorStop(1, "rgba(80,30,160,0)");
      g.fillStyle = hg; g.beginPath(); g.arc(dr.x, dy, dr.r * 2.6, 0, 7); g.fill();
      g.fillStyle = "rgba(30, 12, 48, 0.92)";
      g.beginPath();
      for (var sp = 0; sp < 14; sp++) { var an = sp / 14 * Math.PI * 2 + t * 0.4, rr = sp % 2 ? dr.r * 0.55 : dr.r * 1.05; g[sp ? "lineTo" : "moveTo"](dr.x + Math.cos(an) * rr, dy + Math.sin(an) * rr); }
      g.closePath(); g.fill();
      g.fillStyle = "rgba(220,170,255,0.7)"; g.beginPath(); g.arc(dr.x, dy, dr.r * 0.22, 0, 7); g.fill();
    }
    rings.forEach(function (ring) {
      g.globalAlpha = Math.max(0, ring.a);
      g.strokeStyle = THEME.metal;
      g.lineWidth = 2;
      g.beginPath(); g.arc(ring.x, ring.y, ring.r, 0, 7); g.stroke();
      g.globalAlpha = 1;
    });
    var grove = plats[plats.length - 1];
    var gy = GY(grove.y) - 36;
    var glow = g.createRadialGradient(goalX + 90, gy, 8, goalX + 90, gy, 130);
    glow.addColorStop(0, "rgba(255,255,255,0.95)");
    glow.addColorStop(0.35, THEME.accent);
    glow.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = glow;
    g.beginPath(); g.arc(goalX + 90, gy, 130, 0, 7); g.fill();
    g.restore();
  }

  /* PLATFORMS1 · painted root + stone platforms, Ori-style (layered, soft-lit, organic; never flat watercolor).
     ASSET SWAP: Prism's plates drop in as art/mercury/platforms/stone.png and art/mercury/platforms/root.png
     (transparent PNG, walkable top edge at PLAT_ART[type].top of the image height, end caps PLAT_ART[type].cap
     of the width each side; the middle stretches). If a file is missing the procedural placeholder below draws.
     Each platform is painted once into a cached sprite (per width/type/seed/dpr), so a frame is one drawImage. */
  /* Prism plates (2026-10-13/mercury-platforms, 2x set): <type>-<a..d>-{capL,mid,capR} 80x112 / 256x112 and matching
     -shadow-* 48px strips. Drawn at half size: caps 40 css px, mid tiles every 128 css px, 56 tall, walk line 12 px down. */
  var PLAT_ART = { dir: "art/mercury/platforms/", variants: ["a", "b", "c", "d"], parts: ["capL", "mid", "capR", "shadow-capL", "shadow-mid", "shadow-capR"], walk: 10, shY: 14, h: 56, sh: 24 }; /* Prism README: tile at y-10 (moss lip = walk line), shadow at y+14 */
  var platImg = {};
  if (q.get("platart") !== "0") ["stone", "root"].forEach(function (t) {
    PLAT_ART.variants.forEach(function (v) {
      var set = {}, left = PLAT_ART.parts.length;
      PLAT_ART.parts.forEach(function (part) {
        var im = new Image();
        im.onload = function () { set[part] = im; if (--left === 0) { platImg[t + "-" + v] = set; platCache = {}; } };
        im.onerror = function () { left = -99; };
        im.src = PLAT_ART.dir + ((devicePixelRatio || 1) > 1 || innerWidth >= 2400 ? "2x/" : "1x/") + t + "-" + v + "-" + part + ".png?v=PLATFORMS3";
      });
    });
  });
  var platCache = {};
  function platType(i, grove) { return grove ? "stone" : (i % 3 === 1 ? "root" : "stone"); }
  function rnd(seed) { var x = Math.sin(seed * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  var PAD = 40, DEPTH = 120; /* sprite margin around the slab; how far the body hangs below the walk line */
  function platSprite(type, w, i, grove) {
    var dpr = view.dpr || 1;
    var vr = type === "root" ? (i % 2 ? "c" : "a") : PLAT_ART.variants[i % 4]; /* Prism: prefer root-a / root-c */
    var art = platImg[type + "-" + vr];
    var key = type + "|" + Math.round(w) + "|" + i + "|" + dpr.toFixed(2) + "|" + (art ? "art" : "proc");
    if (platCache[key]) return platCache[key];
    var cw = w + PAD * 2, chh = DEPTH + PAD * 2;
    var c = document.createElement("canvas");
    c.width = Math.ceil(cw * dpr); c.height = Math.ceil(chh * dpr);
    var g = c.getContext("2d");
    g.scale(dpr, dpr);
    g.translate(PAD, PAD);
    if (art) paintPlatArt(g, art, w, grove);
    else if (type === "root") paintRoot(g, w, i);
    else paintStone(g, w, i, grove);
    platCache[key] = c;
    return c;
  }
  function paintPlatArt(g, set, w, grove) {
    var cap = 40, tile = 128, y0 = -PLAT_ART.walk;
    function strip(pre, y, h) {
      var mw = Math.max(0, w - cap * 2);
      for (var x = 0; x < mw; x += tile) { var tw = Math.min(tile, mw - x); var im = set[pre + "mid"]; g.drawImage(im, 0, 0, im.width * (tw / tile), im.height, cap + x, y, tw, h); }
      g.drawImage(set[pre + "capL"], 0, y, cap, h);
      g.drawImage(set[pre + "capR"], w - cap, y, cap, h);
    }
    strip("shadow-", PLAT_ART.shY, PLAT_ART.sh);
    strip("", y0, PLAT_ART.h);
    if (grove) { var gg = g.createRadialGradient(w / 2, 0, 4, w / 2, 0, w * 0.7); gg.addColorStop(0, "rgba(255,240,200,0.24)"); gg.addColorStop(1, "rgba(255,240,200,0)"); g.fillStyle = gg; g.fillRect(-PAD, -PAD, w + PAD * 2, PAD + 60); }
  }
  function stonePath(g, w, i, inset) {
    var n = 9, depth = 46 + rnd(i + 3) * 30;
    g.beginPath();
    g.moveTo(-6 + inset, 4);
    for (var k = 1; k < n; k++) { var x = (k / n) * w; g.lineTo(x, -2 + rnd(i * 13 + k) * 4 + inset * 0.3); }
    g.quadraticCurveTo(w + 12 - inset, 2, w + 4 - inset, 16);
    for (var k2 = n; k2 >= 0; k2--) {
      var u = k2 / n, bulge = Math.sin(u * Math.PI);
      var y = 16 + bulge * depth * (0.75 + rnd(i * 7 + k2) * 0.35) - inset;
      g.lineTo(u * w + (rnd(i * 5 + k2) - 0.5) * 10, y);
    }
    g.quadraticCurveTo(-14 + inset, 20, -6 + inset, 4);
    g.closePath();
  }
  function paintStone(g, w, i, grove) {
    /* 1 depth layer: a cooler, softer silhouette behind (atmosphere) */
    g.save(); g.translate(10, 10); g.globalAlpha = 0.35; g.filter = "blur(6px)";
    stonePath(g, w, i + 50, 0); g.fillStyle = "#0b1a1c"; g.fill();
    g.restore();
    /* 2 body: lit top to deep underside, soft mottling (no hard lines) */
    stonePath(g, w, i, 0);
    var body = g.createLinearGradient(0, -4, 0, 90);
    body.addColorStop(0, "#5f7468"); body.addColorStop(0.18, "#3a4c48"); body.addColorStop(0.55, "#1b2a2b"); body.addColorStop(1, "#0a1214");
    g.fillStyle = body; g.fill();
    g.save(); g.clip();
    for (var m = 0; m < 7; m++) {
      var mx = rnd(i * 31 + m) * w, my = 10 + rnd(i * 17 + m) * 50, mr = 18 + rnd(i * 3 + m) * 34;
      var mg = g.createRadialGradient(mx, my, 0, mx, my, mr);
      mg.addColorStop(0, m % 2 ? "rgba(140,170,150,0.16)" : "rgba(10,18,20,0.30)"); mg.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = mg; g.fillRect(mx - mr, my - mr, mr * 2, mr * 2);
    }
    /* 3 cool bounce light along the underside, warm key from the upper left */
    var bounce = g.createLinearGradient(0, 40, 0, 100); bounce.addColorStop(0, "rgba(90,160,170,0)"); bounce.addColorStop(1, "rgba(90,160,170,0.18)");
    g.fillStyle = bounce; g.fillRect(-20, 40, w + 40, 80);
    var key = g.createRadialGradient(w * 0.2, -10, 4, w * 0.2, -10, w * 0.9); key.addColorStop(0, "rgba(255,226,170,0.22)"); key.addColorStop(1, "rgba(255,226,170,0)");
    g.fillStyle = key; g.fillRect(-20, -20, w + 40, 80);
    /* lichen specks */
    for (var l = 0; l < Math.round(w / 14); l++) {
      g.fillStyle = "rgba(170,200,120," + (0.12 + rnd(i * 41 + l) * 0.18).toFixed(2) + ")";
      g.beginPath(); g.ellipse(rnd(i * 23 + l) * w, 8 + rnd(i * 29 + l) * 28, 2 + rnd(l + i) * 4, 1.4 + rnd(l * 3 + i) * 2, 0, 0, 7); g.fill();
    }
    g.restore();
    /* 4 rim light on the walk edge + moss tufts */
    rimAndMoss(g, w, i, grove ? "rgba(255,236,190,0.9)" : "rgba(255,226,170,0.65)");
    if (grove) { var gg = g.createRadialGradient(w / 2, 0, 4, w / 2, 0, w * 0.7); gg.addColorStop(0, "rgba(255,240,200,0.28)"); gg.addColorStop(1, "rgba(255,240,200,0)"); g.fillStyle = gg; g.fillRect(-PAD, -PAD, w + PAD * 2, PAD + 60); }
  }
  function paintRoot(g, w, i) {
    /* a gnarled root bridge: a tapering trunk with knots and hanging rootlets, glowing tips (Ori lanterns) */
    var th = 20;
    function trunk(off, inset) {
      g.beginPath();
      g.moveTo(-10, 2 + off);
      g.bezierCurveTo(w * 0.3, -3 + off, w * 0.7, 3 + off, w + 10, 0 + off);
      g.bezierCurveTo(w + 16, th * 0.6 + off, w + 6, th + 4 + off, w - 10, th + 6 + off - inset);
      g.bezierCurveTo(w * 0.65, th + 14 + off - inset, w * 0.35, th + 4 + off - inset, 6, th + 10 + off - inset);
      g.bezierCurveTo(-8, th + 6 + off, -16, th * 0.4 + off, -10, 2 + off);
      g.closePath();
    }
    g.save(); g.translate(8, 12); g.globalAlpha = 0.32; g.filter = "blur(5px)"; trunk(0, 0); g.fillStyle = "#120d0a"; g.fill(); g.restore();
    /* hanging rootlets behind the trunk */
    for (var r = 0; r < Math.round(w / 34); r++) {
      var rx = 10 + rnd(i * 11 + r) * (w - 20), len = 30 + rnd(i * 7 + r) * 60, sway = (rnd(r + i) - 0.5) * 24;
      g.strokeStyle = "rgba(38,28,22,0.9)"; g.lineWidth = 2.6 - rnd(r) * 1.2; g.lineCap = "round";
      g.beginPath(); g.moveTo(rx, th); g.bezierCurveTo(rx + sway * 0.3, th + len * 0.4, rx + sway, th + len * 0.7, rx + sway * 0.8, th + len); g.stroke();
      if (r % 2 === 0) {
        var tx = rx + sway * 0.8, ty = th + len, gl = g.createRadialGradient(tx, ty, 0, tx, ty, 9);
        gl.addColorStop(0, "rgba(190,240,255,0.85)"); gl.addColorStop(1, "rgba(120,200,255,0)");
        g.fillStyle = gl; g.beginPath(); g.arc(tx, ty, 9, 0, 7); g.fill();
      }
    }
    trunk(0, 0);
    var bark = g.createLinearGradient(0, -2, 0, th + 12);
    bark.addColorStop(0, "#7a5a3e"); bark.addColorStop(0.3, "#4a3424"); bark.addColorStop(1, "#160e0a");
    g.fillStyle = bark; g.fill();
    g.save(); g.clip();
    for (var k = 0; k < Math.round(w / 40); k++) { /* knots and soft bark grain */
      var kx = rnd(i * 19 + k) * w, ky = 8 + rnd(i * 37 + k) * 10;
      var kg = g.createRadialGradient(kx, ky, 0, kx, ky, 10); kg.addColorStop(0, "rgba(20,12,8,0.55)"); kg.addColorStop(1, "rgba(20,12,8,0)");
      g.fillStyle = kg; g.fillRect(kx - 10, ky - 10, 20, 20);
    }
    g.strokeStyle = "rgba(255,210,160,0.08)"; g.lineWidth = 1;
    for (var s2 = 0; s2 < 4; s2++) { g.beginPath(); g.moveTo(-10, 6 + s2 * 4); g.bezierCurveTo(w * 0.3, 2 + s2 * 4, w * 0.7, 8 + s2 * 4, w + 10, 4 + s2 * 4); g.stroke(); }
    g.restore();
    rimAndMoss(g, w, i, "rgba(255,214,150,0.7)");
  }
  function rimAndMoss(g, w, i, rim) {
    var rl = g.createLinearGradient(0, -4, 0, 6);
    rl.addColorStop(0, "rgba(0,0,0,0)"); rl.addColorStop(0.5, rim); rl.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = rl; g.beginPath(); g.ellipse(w / 2, 1, w / 2 + 4, 3.2, 0, 0, 7); g.fill();
    for (var m = 0; m < Math.round(w / 9); m++) {
      var mx = rnd(i * 53 + m) * w, mh = 3 + rnd(i * 59 + m) * 6;
      var mg = g.createLinearGradient(0, -mh, 0, 3); mg.addColorStop(0, "rgba(170,210,120,0.75)"); mg.addColorStop(1, "rgba(60,96,52,0.0)");
      g.fillStyle = mg; g.beginPath(); g.ellipse(mx, 0, 3 + rnd(m + i * 2) * 5, mh, 0, 0, 7); g.fill();
    }
  }
  function livingPlat(g, x, y, w, t, i, grove) {
    var sway = reduced ? 0 : Math.sin(t * 0.9 + i) * 1.5; /* calm: a slow breath, no bob */
    var spr = platSprite(platType(i, grove), w, i, grove);
    g.drawImage(spr, 0, 0, spr.width, spr.height, x - PAD, y + sway - PAD, w + PAD * 2, DEPTH + PAD * 2);
  }

  function blobPath(g, rad, t, squash) {
    g.beginPath();
    var n = 22;
    var sq = Math.max(0.55, squash);
    for (var i = 0; i <= n; i++) {
      var a = (i / n) * Math.PI * 2;
      var wob = 1 + 0.09 * Math.sin(a * 3 + t * 5) + 0.045 * Math.sin(a * 6 - t * 4);
      var x = Math.cos(a) * rad * wob * sq;
      var y = Math.sin(a) * rad * wob / sq;
      if (i) g.lineTo(x, y); else g.moveTo(x, y);
    }
    g.closePath();
  }

  function paintBlob(g, b, t) {
    if (b.inv > 0 && Math.floor(t * 18) % 2 === 0) return;
    var sx = b.x - cam, sy = b.y;
    var squash = b.squash;
    var rad = b.r;
    g.save();
    g.translate(sx, sy);
    if (b.echo) g.globalAlpha = 0.9;
    blobPath(g, rad, t + (b.echo ? 1.2 : 0), squash);
    g.save();
    g.clip();
    g.fillStyle = "#0a0c10";
    g.fillRect(-rad * 2, -rad * 2, rad * 4, rad * 4);
    g.fillStyle = "#8e96a0";
    g.fillRect(-rad * 2, -rad * 2, rad * 4, rad * 1.02);
    g.fillStyle = "rgba(248,250,252,0.95)";
    g.fillRect(-rad * 2, -rad * 0.06, rad * 4, Math.max(1.5, rad * 0.055));
    g.save();
    g.scale(1, -1);
    g.globalAlpha = 0.22;
    var src = rad * 2.4 * view.dpr;
    try {
      g.filter = "grayscale(1) contrast(1.8) brightness(0.22)";
      g.drawImage(off, (sx - rad) * view.dpr, (sy - rad) * view.dpr, src, src, -rad * 1.2, -rad * 1.2, rad * 2.4, rad * 2.4);
    } catch (err) {}
    g.restore();
    g.globalAlpha = 1;
    var rg = g.createLinearGradient(-rad, -rad * 0.2, rad * 0.4, rad);
    rg.addColorStop(0, "rgba(90,98,108,0.28)");
    rg.addColorStop(0.42, "rgba(12,14,18,0.15)");
    rg.addColorStop(1, "rgba(0,0,0,0.55)");
    g.fillStyle = rg;
    g.fillRect(-rad * 2, -rad * 2, rad * 4, rad * 4);
    g.fillStyle = "rgba(255,255,255,0.96)";
    g.beginPath();
    g.ellipse(-rad * 0.2, -rad * 0.32, rad * 0.11, rad * 0.045, -0.6, 0, 7);
    g.fill();
    g.restore();
    blobPath(g, rad * 0.98, t + (b.echo ? 1.2 : 0), squash);
    g.strokeStyle = "rgba(186, 204, 222, 0.72)";
    g.lineWidth = 1.1;
    g.stroke();
    g.fillStyle = "rgba(0,0,0,0.5)";
    g.beginPath();
    g.ellipse(0, rad * 0.95, rad * 0.72, rad * 0.14, 0, 0, 7);
    g.fill();
    g.fillStyle = "rgba(180, 190, 200, 0.16)";
    g.beginPath();
    g.ellipse(0, rad * 1.08, rad * 0.55, rad * 0.08, 0, 0, 7);
    g.fill();
    g.restore();
  }


  /* Liquid chrome: one metaball field for both blobs + every splash drop,
     shaded per cell with fresnel, the painted world reflected, and a soft key light. */
  var liq = document.createElement("canvas"), lq = liq.getContext("2d");
  var env = document.createElement("canvas"), eq = env.getContext("2d", { willReadFrequently: true });
  function paintLiquid(g, t, src, dpr) {
    var balls = [];
    blobs.forEach(function (b) { b.exShadow = false; });
    blobs.forEach(function (b, k) {
      if (b.inv > 0 && Math.floor(t * 6) % 2 === 0) return;
      /* ORI1 · Phase 2 art slot: a Prism creature sprite for this kid replaces the procedural liquid when it is loaded */
      if (b === A && paintHero(g, b, t)) return; /* SKIN1 · the month's hero art (host kid); otherwise the chrome blob */
      balls.push({ x: b.x - cam, y: b.y, r: b.r * 1.05, sq: Math.max(0.6, b.squash), w: t * 2.2 + k * 1.7, fade: b.echo ? 0.82 : 1, tint: b.tint });
    });
    drops.forEach(function (d) { if (d.a > 0.05) balls.push({ x: d.x - cam, y: d.y, r: d.r * 1.6 * Math.min(1, d.a * 1.6), sq: 1, w: 0, fade: 1, tint: A.tint }); });
    if (!balls.length) return;
    /* CHROME2 · cluster balls that can touch and shade each cluster on its own tight grid, so three blobs spread
       across the wall don't share one giant coarse grid (that was the blocky, flat-grey look). */
    var par = balls.map(function (_, i) { return i; });
    function root(i) { while (par[i] !== i) i = par[i] = par[par[i]]; return i; }
    for (var bi = 0; bi < balls.length; bi++) for (var bj = bi + 1; bj < balls.length; bj++) {
      var u = balls[bi], w2 = balls[bj];
      if (Math.hypot(u.x - w2.x, u.y - w2.y) < (u.r + w2.r) * 2.4) par[root(bi)] = root(bj);
    }
    var groups = {};
    balls.forEach(function (bb, i) { var r0 = root(i); (groups[r0] = groups[r0] || []).push(bb); });
    Object.keys(groups).forEach(function (key) { paintLiquidGroup(g, t, src, dpr, groups[key]); });
    g.save();
    blobs.forEach(function (b) { if (!b.grounded || b.exShadow) return; g.fillStyle = "rgba(0,0,0,0.35)"; g.beginPath(); g.ellipse(b.x - cam, b.y + b.r * 0.95, b.r * 0.8, b.r * 0.16, 0, 0, 7); g.fill(); });
    g.restore();
  }
  /* SKIN1 · hero state from motion only (the art never feeds back into the mechanics) */
  function heroState(b, t) {
    if (won && finale) return "happy";
    if (!b.grounded) return b.vy < 0 ? "stretch" : "fall";
    if (b.squash > 1.1) return "squash";
    if (Math.abs(b.vx) > 30) return Math.floor(t * 8) % 2 ? "roll-2" : "roll-1";
    if (b.fillK > 0.3) return "happy";
    if (t < 0.5) return "peek";
    if (performance.now() - lastTouch > 30000) return "sleep";
    return finale ? "full" : "idle";
  }
  function heroEyes(st, t) {
    if (st === "happy") return "happy";
    if (st === "sleep") return "closed";
    var ph = (t + 0.7) % 4.2; return ph < 0.06 ? "half" : ph < 0.16 ? "closed" : ph < 0.22 ? "half" : "open";
  }
  function paintHero(g, b, t) {
    var sk = heroArt(); if (!sk) return false;
    var st = heroState(b, t), im = sk.sprites[st], an = sk.anchors.states[st];
    if (!im || !an) return false;
    var sc = (b.r / ((sk.anchors.bodyR || im.width / 2.6 / sk.scale) * sk.scale)), flip = b.vx < -30 && /^roll/.test(st) ? -1 : 1;
    /* ORI3 · extras draw order: shadow, body (or breathe frame), eyes, shine, rim, sweep, grow ripple */
    var x = exOn(sk), s = sk.scale, body = im, ct = an.contact, eyAt = an.eyes;
    if (x) { var bf = st === "idle" && exBreathe(x, sk, t); if (bf) { body = bf.im; ct = bf.contact; eyAt = bf.eyes; } }
    var ox = -ct[0] * s, oy = -ct[1] * s, bo = bf ? bf.off : [0, 0];
    g.save();
    g.translate(b.x - cam, b.y + b.r);
    g.scale(flip * sc, sc);
    if (x) exShadow(g, x, b, st, an, sc, s, t);
    g.drawImage(body, ox + bo[0] * s, oy + bo[1] * s);
    if (x) x.order.push(bf ? "body:" + bf.name : "body:" + st);
    var ey = sk.eyes[heroEyes(st, t)];
    if (ey && eyAt) { g.drawImage(ey, (eyAt[0] - ct[0]) * s - ey.width / 2, (eyAt[1] - ct[1]) * s - ey.height / 2); if (x) x.order.push("eyes"); }
    paintAccessory(g, b, st, sk.scale);
    if (x) {
      var nm = x.anc.st === "ok" && x.anc.j;
      /* ORIX2 · r3 anchors give shine / rim per state as { name, offset1x, size1x } (ORI3 read a bare name) */
      var lnm = function (k) { var v = nm && nm[k] && nm[k][st]; v = v && typeof v === "object" ? v.name : v; return typeof v === "string" && /^[a-z0-9-]+$/.test(v) ? v : k + "-" + st; };
      exLayer(g, x, lnm("shine"), "screen", 1, ox, oy, "shine");
      exLayer(g, x, lnm("rim"), "screen", 1, ox, oy, "rim");
      exPulseFrames(x, sk, st, s, ox, oy, g);
    }
    g.restore();
    return true;
  }
  function paintLiquidGroup(g, t, src, dpr, balls) {
    var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    balls.forEach(function (b) { var m = b.r * 2.2; x0 = Math.min(x0, b.x - m); y0 = Math.min(y0, b.y - m); x1 = Math.max(x1, b.x + m); y1 = Math.max(y1, b.y + m); });
    x0 = Math.max(-40, x0); y0 = Math.max(-40, y0); x1 = Math.min(view.w + 40, x1); y1 = Math.min(view.h + 40, y1);
    if (!(x1 - x0 > 4 && y1 - y0 > 4)) return; /* group fully off-wall */
    var C = Math.max(1 / Math.min(2, dpr), Math.sqrt((x1 - x0) * (y1 - y0) / 30000)); /* css px per cell, capped work */
    var cw = Math.ceil((x1 - x0) / C), ch = Math.ceil((y1 - y0) / C);
    if (cw < 2 || ch < 2) return;
    var M = 24; /* env margin so reflections can look past the edge */
    var ew = cw + 2 * Math.ceil(M / C), eh = ch + 2 * Math.ceil(M / C);
    env.width = ew; env.height = eh;
    try { eq.drawImage(src, (x0 - M) * dpr, (y0 - M) * dpr, ew * C * dpr, eh * C * dpr, 0, 0, ew, eh); } catch (e) {}
    var ed = eq.getImageData(0, 0, ew, eh).data;
    liq.width = cw; liq.height = ch;
    var img = lq.createImageData(cw, ch), o = img.data;
    var em = Math.ceil(M / C);
    var lx = -0.45, ly = -0.7, lz = 0.55, ll = Math.hypot(lx, ly, lz); lx /= ll; ly /= ll; lz /= ll;
    var tint = balls[0].tint || THEME.metal, tr = parseInt(tint.substr(1, 2), 16), tg = parseInt(tint.substr(3, 2), 16), tb = parseInt(tint.substr(5, 2), 16);
    var FA = 1; /* SHARP1 perf: no per-call array; balls beyond 4r add < 0.07 and are skipped */
    balls.forEach(function (b) { b.cut = b.r * b.r * 16; });
    function field(px, py) {
      var f = 0, fa = 0;
      for (var i = 0; i < balls.length; i++) {
        var b = balls[i], dx = (px - b.x) / b.sq, dy = (py - b.y) * b.sq;
        if (dx * dx + dy * dy > b.cut) continue;
        if (b.w) { var a = Math.atan2(dy, dx); var wob = 1 + 0.05 * Math.sin(a * 3 + b.w) + 0.025 * Math.sin(a * 5 - b.w * 1.3); dx /= wob; dy /= wob; }
        var v = (b.r * b.r) / (dx * dx + dy * dy + 1);
        f += v; fa += v * b.fade;
      }
      FA = fa / (f || 1);
      return f;
    }
    for (var j = 0; j < ch; j++) {
      for (var i = 0; i < cw; i++) {
        var px = x0 + (i + 0.5) * C, py = y0 + (j + 0.5) * C;
        var f = field(px, py), fade = FA;
        var k = (j * cw + i) * 4;
        if (f < 0.85) { o[k + 3] = 0; continue; }
        var fx = field(px + C, py) - field(px - C, py);
        var fy = field(px, py + C) - field(px, py - C);
        var gl = Math.hypot(fx, fy) + 1e-6;
        var edge = Math.min(1, (f - 0.85) / 0.9); /* 0 at rim, 1 deep inside */
        var nz = Math.sqrt(edge) ;
        var s2 = Math.sqrt(Math.max(0, 1 - nz * nz));
        var nx = -fx / gl * s2, ny = -fy / gl * s2;
        /* CHROME2 · mirror chrome: the bent normal looks into the painted world (env), upper hemisphere reads sky,
           a crisp dark horizon band splits it, lower hemisphere goes dark with a warm ground bounce, bright fresnel rim,
           and a hard key spec + soft secondary. Contrast is what sells metal; flat grey reads as plastic. */
        var rx = Math.round(i + em + nx * 22 / C), ry = Math.round(j + em + ny * 22 / C - (1 - nz) * 8 / C);
        rx = rx < 0 ? 0 : rx >= ew ? ew - 1 : rx; ry = ry < 0 ? 0 : ry >= eh ? eh - 1 : ry;
        var e = (ry * ew + rx) * 4;
        var er = ed[e] / 255, eg = ed[e + 1] / 255, eb = ed[e + 2] / 255;
        var lum = er * 0.3 + eg * 0.55 + eb * 0.15;
        var hz = ny - 0.22 + 0.04 * Math.sin(t * 0.9 + px * 0.02); /* horizon wobbles slowly with the liquid */
        var up = hz < 0 ? Math.min(1, -hz * 2.2) : 0, down = hz > 0 ? Math.min(1, hz * 2.4) : 0;
        var line = Math.exp(-Math.pow(hz / 0.035, 2));
        /* studio chrome: bright cool sky above the horizon, dark warm ground below, env mixed in for the world */
        var sr, sg, sb;
        if (hz < 0) { sr = 0.92 - up * 0.25; sg = 0.95 - up * 0.15; sb = 1.0; }
        else { var dd = Math.min(1, down * 1.6); sr = 0.42 - dd * 0.32; sg = 0.38 - dd * 0.29; sb = 0.36 - dd * 0.28; }
        var em2 = 0.5;
        var cr = sr * (1 - em2) + er * em2 * (hz < 0 ? 1.1 : 0.6), cg = sg * (1 - em2) + eg * em2 * (hz < 0 ? 1.1 : 0.6), cb = sb * (1 - em2) + eb * em2 * (hz < 0 ? 1.1 : 0.6);
        cr *= 1 - line * 0.8; cg *= 1 - line * 0.8; cb *= 1 - line * 0.75;  /* chrome horizon */
        var fres = Math.pow(1 - nz, 2.5);
        cr += fres * 0.75; cg += fres * 0.8; cb += fres * 0.9;
        var dl = nx * lx + ny * ly + nz * lz;
        var spec = Math.pow(Math.max(0, dl), 90) * 2.2 + Math.pow(Math.max(0, dl), 12) * 0.25;
        var spec2 = Math.pow(Math.max(0, -nx * 0.6 + ny * 0.5 + nz * 0.62), 40) * 0.5;
        cr += spec + spec2; cg += spec + spec2; cb += spec + spec2 * 1.1;
        o[k] = Math.min(255, cr * tr * 1.02);
        o[k + 1] = Math.min(255, cg * tg * 1.02);
        o[k + 2] = Math.min(255, cb * tb * 1.04);
        o[k + 3] = Math.round(255 * Math.min(1, (f - 0.85) / 0.12) * fade);
      }
    }
    lq.putImageData(img, 0, 0);
    g.save();
    g.imageSmoothingEnabled = true;
    g.drawImage(liq, 0, 0, cw, ch, x0, y0, cw * C, ch * C);
    g.restore();
  }

  /* POWERUPS2 · power-ups live in the world: double jump = a pair of soft spirit-light wings riding the blob
     (they flare on the second jump); drop magnet = three warm motes orbiting slowly. No text on screen. */
  function paintPowers(g, t) {
    g.save();
    g.globalCompositeOperation = "lighter";
    blobs.forEach(function (b, k) {
      if (b.inv > 0 && Math.floor(t * 6) % 2 === 0) return;
      var pw = b.pw || {}, x = b.x - cam, y = b.y, r = b.r;
      var ex = exPowers(g, b, t); /* ORI3 · Prism's wings / motes replace these marks once loaded */
      g.globalCompositeOperation = "lighter";
      if (pw.dbl && !ex.wings) {
        var flare = b.air2 ? 1 : 0.55 + 0.15 * Math.sin(t * 1.6 + k);
        var halo = g.createRadialGradient(x, y, r * 0.6, x, y, r * 2.4);
        halo.addColorStop(0, "rgba(140,230,255," + (0.22 * flare) + ")"); halo.addColorStop(1, "rgba(140,230,255,0)");
        g.fillStyle = halo; g.beginPath(); g.arc(x, y, r * 2.4, 0, 7); g.fill();
        for (var sd = -1; sd <= 1; sd += 2) {
          var flap = Math.sin(t * 2.2 + k) * 0.18;
          g.save(); g.translate(x + sd * r * 0.85, y - r * 0.15); g.scale(sd, 1); g.rotate(-0.35 - flap);
          var wg = g.createLinearGradient(0, 0, r * 1.5, -r * 0.6);
          wg.addColorStop(0, "rgba(200,245,255," + (0.85 * flare) + ")"); wg.addColorStop(1, "rgba(120,210,255,0)");
          g.fillStyle = wg;
          g.beginPath(); g.moveTo(0, 0);
          g.quadraticCurveTo(r * 0.7, -r * 1.25, r * 1.6, -r * 0.85);
          g.quadraticCurveTo(r * 0.9, -r * 0.45, r * 1.35, -r * 0.2);
          g.quadraticCurveTo(r * 0.6, -r * 0.1, 0, 0);
          g.fill(); g.restore();
        }
      }
      if (pw.magnet && !ex.motes) {
        for (var m = 0; m < 3; m++) {
          var an = t * 0.9 + m * 2.094 + k, ox2 = x + Math.cos(an) * r * 1.7, oy2 = y + Math.sin(an) * r * 0.75 - r * 0.2;
          var mg = g.createRadialGradient(ox2, oy2, 0, ox2, oy2, r * 0.55);
          mg.addColorStop(0, "rgba(255,240,190,0.95)"); mg.addColorStop(0.3, "rgba(255,200,110,0.5)"); mg.addColorStop(1, "rgba(255,170,60,0)");
          g.fillStyle = mg; g.beginPath(); g.arc(ox2, oy2, r * 0.55, 0, 7); g.fill();
        }
      }
    });
    g.restore();
  }

  /* PUSHIN1 · ?demo=1 only: a slow push-in on the host blob (1.0 → 1.32 over ~9 s), origin eased so it glides. */
  var zoom = { z: 1, ox: null, oy: null };
  function pushIn(t, dt) {
    var goal = 1 + 0.32 * Math.min(1, Math.max(0, (t - 1) / 9));
    zoom.z += (goal - zoom.z) * Math.min(1, dt * 1.5);
    var hx = A.x - cam, hy = A.y;
    if (zoom.ox == null) { zoom.ox = hx; zoom.oy = hy; }
    zoom.ox += (hx - zoom.ox) * Math.min(1, dt * 1.2);
    zoom.oy += (hy - zoom.oy) * Math.min(1, dt * 0.8);
    cv.style.transformOrigin = zoom.ox.toFixed(1) + "px " + zoom.oy.toFixed(1) + "px";
    cv.style.transform = "scale(" + zoom.z.toFixed(4) + ")";
  }

  function paintBridge(g, t) {
    var dx = (A.x - B.x), dy = (A.y - B.y);
    var dist = Math.hypot(dx, dy);
    if (dist > 78 || dist < 8) return;
    g.save();
    g.strokeStyle = THEME.metal;
    g.globalAlpha = 1 - dist / 78;
    g.lineWidth = 8 * (1 - dist / 78);
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(A.x - cam, A.y);
    g.quadraticCurveTo((A.x + B.x) / 2 - cam, (A.y + B.y) / 2 - 10, B.x - cam, B.y);
    g.stroke();
    g.restore();
  }

  /* SKIN1 · the skin's finale scene over the grove once a full-jar run reaches home; no scene = the default finale
     (gold burst + ring), which plays either way */
  var finaleAt = 0;
  /* ORI2 · the scene that matches the view (portrait when taller than wide), fetched on first use; if it is missing or fails,
     the other orientation's scene; if both fail, null = the default finale (gold burst + ring) */
  function finState(k, no) { var f = skin.ready && skin.fin[k]; return !skin.ready ? no : !f ? "lazy" : f.st === "ok" ? "art" : f.st === "fail" ? no : "loading"; }
  function finaleFor(W, H) {
    if (!skin.ready) return null;
    var want = H > W ? "port" : "land", a = finLoad(skin, want);
    if (a.st === "ok") return a.im;
    if (a.st === "loading") return null;
    var b = finLoad(skin, want === "port" ? "land" : "port");
    return b.st === "ok" ? b.im : null;
  }
  function paintFinaleScene(g, W, H) {
    var im = won && finale && skin.ready && finaleFor(W, H); if (!im) return;
    if (!finaleAt) finaleAt = performance.now();
    var a = Math.min(1, (performance.now() - finaleAt) / 900), sc = Math.max(W / im.width, H / im.height);
    g.save(); g.globalAlpha = a; g.drawImage(im, (W - im.width * sc) / 2, (H - im.height * sc) / 2, im.width * sc, im.height * sc); g.restore();
  }
  function frame() {
    var now = performance.now();
    var t = (now - t0) / 1000;
    var dt = reduced ? 1 / 60 : Math.min(0.033, (frame.l ? (now - frame.l) / 1000 : 1 / 60));
    if (frame.l && playing) adapt(now - frame.l);
    frame.l = now;
    var W = view.w, H = view.h;
    if (skin.x) skin.x.order = []; /* ORI3 · this frame's extras draw order (QA probe) */
    var ids = Object.keys(pointers);
    var ins = blobs.map(function () { return null; });
    ids.forEach(function (id) { var k = Math.min(blobs.length - 1, pointers[id].blob); ins[k] = pointers[id]; });
    blobs.forEach(function (b, k) { if (k > 0) b.echo = !ins[k]; stepBlob(b, dt, t, ins[k]); });
    stepDrops(dt);
    if (playing) stepReveal(t);
    var mid = 0, home = !won;
    blobs.forEach(function (b) { mid += b.x / blobs.length; if (!(b.x > goalX + 20 && b.grounded)) home = false; });
    if (home) { won = true; tone("grove"); burst(mid, A.y, finale ? 60 : 30, finale ? "#ffe2a8" : "#fff"); if (finale) { rings.push({ x: mid, y: A.y, r: 20, a: 1 }); tone("grove", 4); } }
    var aim = (A.x * 0.8 + mid * 0.2) - W * 0.4; /* CAM2: favor the host blob so it never leaves frame */
    cam += (aim - cam) * (reduced ? 1 : 0.05);
    /* CAM2: soft keep-in — never let the host blob drift out of the middle 70% (eased, no snap) */
    var hx = A.x - cam;
    if (hx < W * 0.15) cam -= (W * 0.15 - hx) * 0.12;
    if (hx > W * 0.85) cam += (hx - W * 0.85) * 0.12;
    cam = Math.max(0, cam);
    shake *= 0.86;
    ox.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ox.clearRect(0, 0, W, H);
    paintWorld(ox, t, W, H);
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    shake = 0; /* calm: no camera jitter (Dan 10/12 rejected aggressive motion) */
    ctx.drawImage(off, 0, 0, off.width, off.height, 0, 0, W, H);
    if (LIQUID) paintLiquid(ctx, t, off, view.dpr);
    else {
      blobs.forEach(function (b) { if (!(b === A && paintHero(ctx, b, t))) paintBlob(ctx, b, t); });
      if (blobs.length > 1) paintBridge(ctx, t);
      drops.forEach(function (d) {
        ctx.globalAlpha = Math.max(0, d.a);
        ctx.fillStyle = d.c;
        ctx.beginPath(); ctx.ellipse(d.x - cam, d.y, d.r, d.r * 1.4, 0, 0, 7); ctx.fill();
      });
      ctx.globalAlpha = 1;
    }
    paintPowers(ctx, t);
    exSplashes(ctx);
    paintFill(ctx, t);
    paintFinaleScene(ctx, W, H);
    if (A.auto) pushIn(t, dt);
    if (playing && !document.hidden) requestAnimationFrame(frame);
  }

  function assignPointer(e) {
    var rec = cv.getBoundingClientRect();
    var x = e.clientX - rec.left, y = e.clientY - rec.top;
    var blob = zoneFor(x, view.w, blobs.length); /* the kid's own zone; single player = the whole screen */
    pointers[e.pointerId] = { x: x, y: y, blob: blob, ly: y, low: y, x0: x, y0: y, t0: performance.now(), jump: false, fired: false };
    try { cv.setPointerCapture(e.pointerId); } catch (err) {}
    if (window.HouseSfx && HouseSfx.unlockAudio) HouseSfx.unlockAudio();
  }

  cv.addEventListener("pointerdown", function (e) {
    lastTouch = performance.now();
    if (won) return;
    assignPointer(e);
    /* ORI1 · jump on touch-down (Dan): the press itself jumps; sliding the same finger rolls; a flick up later in the
       same touch is the second jump; lifting the finger never jumps again */
    var p = pointers[e.pointerId];
    if (p) { p.jump = true; p.fired = true; p.down = true; }
  });
  cv.addEventListener("pointermove", function (e) {
    var p = pointers[e.pointerId];
    if (!p) return;
    var rec = cv.getBoundingClientRect();
    var y = e.clientY - rec.top;
    /* JUMPFIX1 · the old check needed 28 px of upward travel inside ONE move event; real touch moves arrive in 4-10 px
       steps, so a flick almost never jumped. Measure the upward travel since the lowest point of the gesture instead. */
    if (y > p.low) p.low = y;
    if (p.low - y > 22 && !p.flicked) { p.jump = true; p.fired = true; p.flicked = true; p.low = y; }
    p.ly = y;
    p.x = e.clientX - rec.left;
    p.y = y;
  });
  function up(e) {
    var p = pointers[e.pointerId];
    if (p) {
      var rec = cv.getBoundingClientRect();
      var uy = e.clientY - rec.top, ux = e.clientX - rec.left;
      var tap = performance.now() - p.t0 < 280 && Math.hypot(ux - p.x0, uy - p.y0) < 14; /* JUMPFIX1 · a quick tap jumps too */
      var b = blobs[Math.min(blobs.length - 1, p.blob)];
      if (!p.down && ((!p.fired && p.low - uy > 16) || tap || p.jump)) { b.want = 0.14; b.press = true; }
    }
    delete pointers[e.pointerId];
  }
  cv.addEventListener("pointerup", up);
  cv.addEventListener("pointercancel", up);

  window.addEventListener("keydown", function (e) {
    if (e.key === "ArrowRight" || e.key === "d") A.vx += 40;
    if (e.key === "ArrowLeft" || e.key === "a") A.vx -= 40;
    if (e.key === "ArrowUp" || e.key === "w" || e.key === " ") { A.want = 0.12; A.press = true; }
    if (blobs.length < 2) return; /* ORI1 · single player: no sibling keys */
    if (e.key === "l") B.vx += 40;
    if (e.key === "j") B.vx -= 40;
    if (e.key === "i") { B.echo = false; B.want = 0.12; B.press = true; }
  });

  function ambience() {
    if (playing || document.hidden) return;
    var t = performance.now() / 1000;
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    paintWorld(ctx, t, view.w, view.h);
    if (!reduced) requestAnimationFrame(ambience);
  }

  /* ORI1 · ALWAYS OPEN: no full-jar gate screen. The run starts at once; the jar rides small in the HUD (lit by the run's
     sky) and the blob shows the week's filled days. */
  function note(text) {
    var n = ui.querySelector(".merc-note");
    if (!n) { n = document.createElement("div"); n.className = "merc-note"; ui.appendChild(n); }
    n.textContent = text; n.style.opacity = "1";
    clearTimeout(note.t); note.t = setTimeout(function () { n.style.opacity = "0"; }, 3600);
  }
  function showPlay() {
    if (playing) return;
    playing = true;
    setTimeout(refreshPowers, 0);
    setInterval(refreshPowers, 15000); /* heartbeat: a chore closed mid-run shows within 15 s even with no event */
    var coop = blobs.length > 1;
    var hint = coop ? "Each of you has a part of the wall. Slide to roll. Tap to jump." : "Slide to roll. Tap to jump. Every full day makes you bigger.";
    ui.innerHTML = '<div class="hud"><a href="' + THEME.back + '">Back</a><span></span><div class="je-mini" id="je" aria-hidden="true"></div></div><div class="hint">' + hint + '</div>' +
      (coop ? '<div class="zones">' + blobs.map(function (b) { return '<div class="zone"><span>' + NAMES[b.kid] + '</span></div>'; }).join("") + '</div>' : "");
    if (window.JarEngine) {
      try {
        hudJar = JarEngine.mount(document.getElementById("je"), { kid: kid, getState: function () { return jarState(kid); } });
        skyToJar();
      } catch (e) { hudJar = null; }
    }
    resize();
    frame();
    setTimeout(function () {
      var h = ui.querySelector(".hint");
      if (h) h.style.opacity = "0";
    }, 4200);
  }

  function winWatch() {
    var w = document.createElement("div");
    w.className = "merc-win" + (finale ? " merc-finale" : "");
    var msg = finale ? "The grove holds everyone." : "You made it to the grove. Fill your jar to light it up.";
    w.innerHTML = '<p>' + msg + '</p><a href="' + THEME.back + '">Back</a>';
    ui.appendChild(w);
  }

  var winShown = false;
  var orig = frame;
  frame = function () {
    orig();
    if (won && !winShown) { winShown = true; winWatch(); }
  };

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) return;
    if (playing) { requestAnimationFrame(frame); rereadSoon(); } /* ORI1 · back on the tab: re-read the week (live today) */
    else requestAnimationFrame(ambience);
  });

  function start() {
    resize();
    window.addEventListener("resize", resize);
    var top0 = GY(plats[0].y);
    [A, B, C].forEach(function (b, i) { b.x = spawn.x + 36 * i; b.y = top0 - b.r; b.cp = { x: b.x, y: b.y, top: top0 }; b.grounded = true; });
    showPlay();
  }

  var capMode = /(?:\?|&)mrcap=1(?:&|$)/.test(location.search);
  if (!capMode) {
    if (window.WardKids && WardKids.boot) {
      /* MERCNODATA1 · unpaired / offline: no kids week, so start the world with an empty week instead of a black canvas */
      var started = false;
      var go = function () { if (started) return; started = true; start(); };
      /* FOLLOWUP1 · ORI1: the run is always open, so a slow hub just starts it (or, once running, re-reads the week:
         the rereadSoon listener) */
      document.addEventListener("house:kids-data-ready", function () { if (!started) go(); });
      document.addEventListener("house:kids-data-missing", go);
      setTimeout(go, 4000);
      /* FOLLOWUP1 · paint the world before any data so the canvas is never black at start */
      try { resize(); ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0); paintWorld(ctx, 0, view.w, view.h); } catch (e) { /* first paint is cosmetic */ }
      WardKids.boot(kid);
    } else start();
  }

  var capCv = null;
  function exportFrame(t, cssW, cssH, dpr) {
    cssW = cssW || 1920;
    cssH = cssH || 1080;
    dpr = dpr || 1;
    if (!capCv) capCv = document.createElement("canvas");
    capCv.width = Math.round(cssW * dpr);
    capCv.height = Math.round(cssH * dpr);
    view.w = cssW;
    view.h = cssH;
    view.dpr = dpr;
    off.width = capCv.width;
    off.height = capCv.height;
    var close = t >= 4.2 && t < 6.4;
    var falling = t >= 11.2 && t < 12.6;
    var gathered = t >= 8.2 && t < 11.0;
    var splashOn = (t >= 6.4 && t < 8.2) || gathered;
    var travel = Math.min(goalX - 120, 90 + t * 95);
    var idx = 0;
    for (var i = 0; i < plats.length; i++) {
      if (plats[i].x + plats[i].w * 0.25 < travel) idx = i;
    }
    var pl = plats[idx];
    var gx = platX(pl, t) + 42;
    var gy = GY(pl.y) - 28;
    if (falling) gy = view.h * (0.55 + (t - 12) * 0.28);
    if (gathered) {
      var back = plats[Math.max(0, idx - 1)];
      gx = platX(back, t) + 30;
      gy = GY(back.y) - 28;
    }
    A.x = gx;
    A.y = gy;
    A.r = 26;
    A.squash = falling ? 0.7 : (splashOn ? 1.28 : 1);
    A.echo = false;
    A.inv = 0;
    B.x = gx - 62;
    B.y = gy + (falling ? -8 : 2);
    B.r = 22;
    B.squash = 1;
    B.echo = true;
    B.inv = 0;
    cam = Math.max(0, (A.x + B.x) / 2 - cssW * 0.42);
    var gctx = capCv.getContext("2d", { alpha: false });
    ox.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintWorld(ox, t, cssW, cssH);
    gctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    gctx.drawImage(off, 0, 0, off.width, off.height, 0, 0, cssW, cssH);
    paintBlob(gctx, A, t);
    paintBlob(gctx, B, t);
    paintBridge(gctx, t);
    if (falling) {
      gctx.strokeStyle = "rgba(255,255,255,0.45)";
      gctx.lineWidth = 3;
      gctx.beginPath();
      gctx.moveTo(A.x - cam, A.y - 80);
      gctx.lineTo(A.x - cam, A.y - 10);
      gctx.stroke();
    }
    if (splashOn) {
      var age = gathered ? (t - 8.2) : (t - 6.4);
      var sx = A.x - cam;
      var sy = gathered ? A.y : (GY(pl.y) - 10);
      gctx.strokeStyle = THEME.metal;
      gctx.globalAlpha = Math.max(0, 1 - age / 1.6);
      gctx.lineWidth = 4;
      gctx.beginPath();
      gctx.arc(sx, sy, 18 + age * 90, 0, 7);
      gctx.stroke();
      var outU = Math.min(1, age / 0.42);
      var backU = Math.max(0, (age - 0.38) / 0.75);
      var travel = outU * (1 - backU);
      for (var s = 0; s < 14; s++) {
        var ang = -Math.PI * 0.15 - (s / 13) * Math.PI * 0.7;
        var sp = 40 + (s % 5) * 22;
        var px = sx + Math.cos(ang) * sp * travel;
        var py = sy + Math.sin(ang) * sp * 0.55 * travel - Math.sin(travel * Math.PI) * 28;
        var rad = (4 + (s % 3) * 2) * (1 - backU * 0.9);
        if (backU > 0.12) {
          gctx.strokeStyle = "rgba(220,226,232,0.75)";
          gctx.globalAlpha = 0.8 * (1 - backU);
          gctx.lineWidth = Math.max(1, rad);
          gctx.beginPath();
          gctx.moveTo(sx, sy);
          gctx.lineTo(px, py);
          gctx.stroke();
        }
        gctx.globalAlpha = Math.max(0, 1 - backU);
        gctx.fillStyle = "#d5dbe3";
        gctx.beginPath();
        gctx.arc(px, py, Math.max(0.4, rad), 0, 7);
        gctx.fill();
      }
      gctx.globalAlpha = 1;
    }
    if (close) {
      var zoom = 1.85;
      var src = document.createElement("canvas");
      src.width = capCv.width;
      src.height = capCv.height;
      src.getContext("2d").drawImage(capCv, 0, 0);
      var cx = (A.x - cam) * dpr;
      var cy = (A.y + 70) * dpr;
      var cw = capCv.width / zoom;
      var ch = capCv.height / zoom;
      gctx.setTransform(1, 0, 0, 1, 0, 0);
      gctx.drawImage(src, cx - cw / 2, cy - ch / 2, cw, ch, 0, 0, capCv.width, capCv.height);
    }
    return capCv;
  }

  window.MercuryRun = {
    debug: function () { return { A: [A.x, A.y, A.r], B: [B.x, B.y], cam: cam, drops: drops.length, view: view, pw: allBlobs().map(function (b) { return [b.kid, b.pw]; }), air2: allBlobs().map(function (b) { return !!b.air2; }), gathers: gatherLog.slice(), won: won, xs: allBlobs().map(function (b) { return Math.round(b.x); }), finale: finale, blobs: blobs.length, playing: playing, reveal: reveal.count }; },
    artSlots: function () { return Object.keys(ART_SLOTS); }, /* ORI1 · Phase 2 art hook names */
    /* SKIN1 · read-only: which month's skin, and whether its art is worn (hero "art") or the blob fallback is showing */
    skin: function () { return { month: skin.month, id: skin.id, hero: heroArt() ? "art" : "blob", finale: finState("land", "default"), finalePortrait: finState("port", "none"), finaleFor: function (w, h) { var im = finaleFor(w, h); return im ? im.src : null; }, scale: skin.scale, kid: skin.kid, dir: skin.def ? skin.def.dir + kid + "/" : null, months: Object.keys(SKINS), state: heroArt() ? heroState(A, (performance.now() - t0) / 1000) : null }; },
    /* ORI3 · read-only: the extras layer (null until the base set is ready and the month names extras) */
    extras: function () {
      var x = heroArt() && skin.x; if (!x) return null;
      var st = {}; Object.keys(x.ims).forEach(function (k) { st[k] = x.ims[k].st; });
      var gr = exGrow(x);
      return { dir: x.dir, scale: x.scale, grow: gr ? { prefix: gr.prefix, n: gr.n } : null, anchors: x.anc.st, fx: x.fxj.st, req: x.req.slice(), st: st, order: x.order.slice(), reduced: reduced, pebblesHidden: blobs.filter(pebblesHiddenFor).map(function (b) { return b.kid; }) };
    },
    exportFrame: exportFrame,
    platesReady: function () { return runPlatesReady && !!runPlates.sky; }
  };
})();
