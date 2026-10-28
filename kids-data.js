/* House face · kids shared data + bank · kids-safe · localStorage only */
(function (global) {
  "use strict";
  /* SCHOOLNAMES1 · the school code / name never live in git: "§" = role "school" tokens, "¶" = full names, from school-names.js
     (private runtime source; none known = the school part of the pattern matches nothing). */
  var SCHRX = function (src, flags) {
    var S = (typeof globalThis !== "undefined" ? globalThis : window).SchoolNames;
    return S ? S.rx(src, flags) : new RegExp(String(src).split("§").join("(?!)").split("¶").join("(?!)"), flags || "");
  };

  var DAY_ISO = (function () {
    try {
      if (typeof HouseClock !== "undefined" && HouseClock.iso) return HouseClock.iso();
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Chicago",
        year: "numeric", month: "2-digit", day: "2-digit"
      }).format(new Date());
    } catch (e) {
      try {
        var d = new Date();
        return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
      } catch (e2) {
        return "1970-01-01";
      }
    }
  })();

  var CHECK_KEY = "house-checkoffs:chores-v2"; /* legacy flat key — migrate-read only */
  /* DAYPKG1 v2e · Atlas ruling (Oct 28 12:40 AM CT): scope by KEY, not by device. The Dad ledger has its own namespace,
     dad-ledger:v1. Only the Dad sheets (not a kid board) read or write it. house-bank:v1 is the legacy key, moved once */
  var BANK_KEY = "dad-ledger:v1";
  var LEGACY_BANK_KEY = "house-bank:v1";
  var LEDGER_SIDE = "dad-ledger:v1:legacy:"; /* a raw legacy blob parked by a kid board when dad-ledger:v1 already exists */
  var LEDGER_LOSER = "dad-ledger:v1:superseded"; /* the older copy kept raw when two ledgers met (nothing is lost) */
  var CHECK_PREFIX = "house-checkoffs:";
  /* DAYPKG1 v2 · Atlas ruling (Oct 27 11:44 PM CT): no paid amount in kid-board storage. house-bank-paid-amount:<kid> had no
     reader; it is never written now, and any old copy is removed when kids-data.js boots on any page */
  (function dropPaidAmount() {
    try {
      var drop = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && (k.indexOf("house-bank-paid-amount:") === 0 || k === "house-bank-paid-amount")) drop.push(k); /* DAYPKG1 v2d · exact prefix + bare key only (Alfred nit) */
      }
      for (var j = 0; j < drop.length; j++) localStorage.removeItem(drop[j]);
    } catch (e) { /* */ }
  })();

  /* DAYPKG1 v2d · a kid board is /kid-<name>.html or the same path without .html (GitHub Pages serves both).
     DAYPKG1 v2f D2 · mercury-run.html?kid= is opened from a kid board (kid-world.js), so it is a kid page too */
  var KID_PAGE_RE = /\/(?:kid-[a-z]+|mercury-run)(\.html)?$/;
  function kidPage() { try { return KID_PAGE_RE.test((global.location && global.location.pathname) || ""); } catch (e) { return false; } }
  /* DAYPKG1 v2f D2 · the other kid-reachable pages that load this file (a kid board links them one hop away: HOME, CHORES,
     jar and payday rows) are kid SCOPE for storage: no dad-ledger:v1 read or write, bank in memory. The ledger lives only on
     the Dad sheets no kid board links to (the Paid sheet and the Dad sheet) */
  var KID_REACH_RE = /\/(?:sheet-chores|sheet-index)(\.html)?$/;
  function kidScope() { if (kidPage()) return true; try { return KID_REACH_RE.test((global.location && global.location.pathname) || ""); } catch (e) { return false; } }
  /* DAYPKG1 v2d · Atlas ruling (Oct 28 12:15 AM CT) B: no balance or lifetime on a kid device. On a kid board the bank root
     lives in memory only (rebuilt from the chore checks on every load). The kid device keeps only its chore checks and the
     paid / jar reset state; the ledger lives on the Dad sheets */
  var MEM_BANK = null;
  /* DAYPKG1 v2e · presence of a key without reading its value: walk the key names only */
  function hasKey(k) {
    try { for (var i = 0; i < localStorage.length; i++) if (localStorage.key(i) === k) return true; } catch (e) { /* */ }
    return false;
  }
  /* DAYPKG1 v2e · Atlas 12:40 AM: a kid board that finds house-bank:v1 does a BLIND move. It reads the legacy string only to
     copy it raw (never parsed, never used), writes it to dad-ledger:v1 only when that key is absent (else to a unique
     dad-ledger:v1:legacy:<ms> side key for the Dad sheet to reconcile), checks the copy landed, and only then removes
     house-bank:v1. It never reads, parses or deletes dad-ledger:v1 */
  function blindMoveLegacyBank() {
    try {
      if (!hasKey(LEGACY_BANK_KEY)) return "none";
      var raw = localStorage.getItem(LEGACY_BANK_KEY);
      if (raw == null) return "none";
      var dest = BANK_KEY;
      if (hasKey(BANK_KEY)) { dest = LEDGER_SIDE + Date.now(); while (hasKey(dest)) dest += "x"; }
      localStorage.setItem(dest, raw);
      if (!hasKey(dest)) return "kept"; /* the copy did not land (quota): house-bank:v1 stays for the next load */
      localStorage.removeItem(LEGACY_BANK_KEY);
      return dest === BANK_KEY ? "moved" : "parked";
    } catch (e) { return "kept"; }
  }
  /* DAYPKG1 v2f D1 + D4 · the money sign scrub runs before anything else reads a stamp (expiry and a synced stamp no longer
     skip it). A stamp with no paid-at (legacy) gets paid-at = now when first seen, so it expires like any other */
  var PAID_KIDS = ["hayes", "harris", "ainsley"];
  function scrubPaidStamp(kidId) {
    try {
      var k = "house-bank-paid:" + kidId, v = localStorage.getItem(k) || "";
      if (!v) return "";
      if (v.indexOf("\u0024") >= 0) { v = /^Paid/.test(v) ? "Paid \u2713" : "Jar reset \u2713"; localStorage.setItem(k, v); }
      var atK = "house-bank-paid-at:" + kidId;
      if (isNaN(Date.parse(localStorage.getItem(atK) || ""))) localStorage.setItem(atK, new Date().toISOString());
      return v;
    } catch (e) { return ""; }
  }
  /* DAYPKG1 v2f D3 · Atlas final ruling (Oct 28 1:47 AM CT), option B with the guards in code. From LEDGER_PURGE_FROM a kid
     device drops dad-ledger:v1 (and any :legacy: side key) ONLY when BOTH: (a) this device has no dad-device marker (set by
     the Dad sheet that owns the ledger the first time it opens; checked by key name, never by reading the ledger), and
     (b) the private kids-week feed, fetched live from the hub just now, says ledger.serverLive === true and
     ledger.carryHeld === true with a fresh ledger.asOf. Anything else (no feed, fetch error, cached or stale feed, missing
     or non-true field, old asOf) = no purge. The purge removes by key name and never reads a value */
  var LEDGER_PURGE_FROM = Date.parse("2026-11-06T00:00:00-06:00"); /* Fri Nov 6 2026 00:00 CT (CST, -06:00) = 06:00 UTC = 1793944800000 */
  var DAD_DEVICE_KEY = "dad-device:v1";
  var PURGE_FEED_MAX_AGE = 15 * 60 * 1000, PURGE_ASOF_MAX_AGE = 24 * 3600 * 1000;
  function ledgerPurgeOk(feed, now) {
    try {
      if (!(typeof now === "number" && now >= LEDGER_PURGE_FROM)) return false;
      if (hasKey(DAD_DEVICE_KEY)) return false;
      if (!feed || typeof feed !== "object" || feed.status !== "live") return false;
      if (typeof feed.at !== "number" || !(now - feed.at >= 0 && now - feed.at <= PURGE_FEED_MAX_AGE)) return false;
      var L = feed.data && typeof feed.data === "object" ? feed.data.ledger : null;
      if (!L || typeof L !== "object") return false;
      if (L.serverLive !== true || L.carryHeld !== true) return false;
      var asOf = Date.parse(typeof L.asOf === "string" ? L.asOf : "");
      if (isNaN(asOf) || now - asOf > PURGE_ASOF_MAX_AGE || asOf - now > 5 * 60 * 1000) return false;
      return true;
    } catch (e) { return false; }
  }
  function purgeKidLedger(feed) {
    if (!kidScope()) return "not-kid";
    if (!ledgerPurgeOk(feed, Date.now())) return "held";
    var drop = [];
    try {
      for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k === BANK_KEY || (k && k.indexOf(LEDGER_SIDE) === 0)) drop.push(k); }
      for (var j = 0; j < drop.length; j++) localStorage.removeItem(drop[j]);
    } catch (e) { return "held"; }
    if (drop.length && global.console && console.info) console.info("[dad-ledger] kid device purge (Nov 6 rule): " + drop.length + " key(s) removed unread");
    return drop.length ? "purged" : "none";
  }
  function scheduleKidLedgerPurge() {
    if (!kidScope()) return "not-kid";
    if (!(Date.now() >= LEDGER_PURGE_FROM)) return "before"; /* no feed call before the date */
    if (hasKey(DAD_DEVICE_KEY)) return "dad-device";
    var PF = global.PrivateFeed;
    if (!PF || typeof PF.get !== "function") return "no-feed";
    try { return Promise.resolve(PF.get("kids-week")).then(function (res) { return purgeKidLedger(res); }, function () { return "held"; }); } catch (e) { return "held"; }
  }
  /* DAYPKG1 v2f D3 (a) · marks this device as Dad's (value = first mark time, no money).
     DAYPKG1 v2g · Atlas P1-2 ruling: set ONLY by a completed 2 s Paid hold on the Dad Paid sheet (bindHold fire -> dadPaid), never by
     opening a page. Dad sheets are URL-only (no link from any kid board or kid nav), so a kid device never holds Paid */
  /* the Dad Paid sheet declares itself in markup (<meta name="ward-money" content="dad">); no page name lives here, so this file
     carries no route to it. Never true on kid scope */
  function dadPayPage() {
    if (kidScope()) return false;
    try { var m = global.document && global.document.querySelector && global.document.querySelector('meta[name="ward-money"]'); return !!(m && m.getAttribute("content") === "dad"); } catch (e) { return false; }
  }
  var HOLD_FIRING = false;
  function markDadDevice() {
    if (!HOLD_FIRING || !dadPayPage()) return false;
    try { if (!hasKey(DAD_DEVICE_KEY)) localStorage.setItem(DAD_DEVICE_KEY, new Date().toISOString()); return true; } catch (e) { return false; }
  }
  var PURGE_RUN = null;
  (function kidBankBoot() {
    for (var i = 0; i < PAID_KIDS.length; i++) scrubPaidStamp(PAID_KIDS[i]); /* DAYPKG1 v2f D1 · all 3 kids, every page */
    if (!kidScope()) return; /* DAYPKG1 v2g · no dad-device mark on boot (Atlas P1-2) */
    MEM_BANK = {};
    blindMoveLegacyBank();
    PURGE_RUN = scheduleKidLedgerPurge();
  })();
  /* DAYPKG1 v2e · Dad sheet boot: house-bank:v1 (and any blob a kid board parked) moves into dad-ledger:v1, then the old key
     goes. When both exist the newer wins (write stamp _w, else the latest day in it; unreadable = oldest; a tie keeps
     dad-ledger:v1), the older is kept raw in dad-ledger:v1:superseded, and the choice is logged */
  function ledgerAge(raw) {
    var o; try { o = JSON.parse(raw); } catch (e) { return -1; }
    if (!o || typeof o !== "object") return -1;
    var t = typeof o._w === "number" ? o._w : 0;
    Object.keys(o).forEach(function (k) {
      var d = o[k] && o[k].days;
      if (d && typeof d === "object") Object.keys(d).forEach(function (iso) { var ms = Date.parse(iso + "T12:00:00"); if (!isNaN(ms) && ms > t) t = ms; });
    });
    return t;
  }
  /* the older or unreadable ledger is never lost: kept raw in dad-ledger:v1:superseded (a second one gets its own :<ms> key) */
  function keepRawLedger(raw) {
    for (var i = 0; i < localStorage.length; i++) { var o = localStorage.key(i); if (o && o.indexOf(LEDGER_LOSER) === 0 && localStorage.getItem(o) === raw) return o; } /* same bytes already kept */
    var k = LEDGER_LOSER;
    if (hasKey(k)) { k = LEDGER_LOSER + ":" + Date.now(); while (hasKey(k)) k += "x"; }
    localStorage.setItem(k, raw);
    return k;
  }
  function migrateDadLedger() {
    if (kidScope()) return null;
    var log = [];
    try {
      var srcs = [];
      if (hasKey(LEGACY_BANK_KEY)) srcs.push(LEGACY_BANK_KEY);
      for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.indexOf(LEDGER_SIDE) === 0) srcs.push(k); }
      srcs.sort(function (a, b) { return a === LEGACY_BANK_KEY ? -1 : b === LEGACY_BANK_KEY ? 1 : (a < b ? -1 : 1); });
      for (var j = 0; j < srcs.length; j++) {
        var raw = localStorage.getItem(srcs[j]);
        if (raw == null) continue;
        var cur = localStorage.getItem(BANK_KEY);
        if (cur == null) { localStorage.setItem(BANK_KEY, raw); log.push(srcs[j] + " moved to " + BANK_KEY); }
        else if (ledgerAge(raw) > ledgerAge(cur)) { var lk = keepRawLedger(cur); localStorage.setItem(BANK_KEY, raw); log.push(srcs[j] + " is newer: kept it, older " + BANK_KEY + " saved as " + lk); }
        else { var lk2 = keepRawLedger(raw); log.push(BANK_KEY + " is newer: kept it, older " + srcs[j] + " saved as " + lk2); }
        if (localStorage.getItem(BANK_KEY) != null) localStorage.removeItem(srcs[j]);
      }
    } catch (e) { log.push("migrate failed, nothing removed"); }
    if (log.length && global.console && console.info) console.info("[dad-ledger] " + log.join("; "));
    return log;
  }
  var LEDGER_LOG = migrateDadLedger();

  var KID_FROM_CHECK = {
    "ain-bed": "ainsley", "ain-toys": "ainsley",
    "ain-dishwasher": "ainsley", "ain-empty": "ainsley", "ain-living": "ainsley",
    "ain-bath": "ainsley", "ain-laundry": "ainsley", "ain-cubby": "ainsley", "ain-babysit": "ainsley",
    "hay-bed": "hayes", "hay-backpack": "hayes", "hay-dishes": "hayes", "hay-empty": "hayes", "hay-trash": "hayes",
    "hay-postgame": "hayes", "hay-shower": "hayes", "hay-room": "hayes", "hay-shoes": "hayes", "hay-cubby": "hayes",
    "har-bed": "harris", "har-backpack": "harris", "har-dishes": "harris", "har-empty": "harris", "har-trash": "harris",
    "har-postgame": "harris", "har-shower": "harris", "har-toys": "harris", "har-shoes": "harris", "har-cubby": "harris"
  };

  function pad2(n) { return String(n).padStart(2, "0"); }

  /** Chicago hour 0 to 23 (for the chore week change). */
  function chicagoHourNow() {
    try {
      var parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Chicago",
        hour: "numeric",
        hourCycle: "h23"
      }).formatToParts(new Date());
      for (var i = 0; i < parts.length; i++) {
        if (parts[i].type === "hour") return Number(parts[i].value) % 24;
      }
    } catch (e) { /* */ }
    try { return new Date().getHours(); } catch (e2) { return 12; }
  }

  /**
   * Chore week: seven tap days from one week change to the next.
   * The last day still counts, so no day in the week is chore-free.
   */
  function weekStartIso(dayIso) {
    var iso = dayIso || DAY_ISO;
    var parts = String(iso).split("-");
    if (parts.length !== 3) return iso;
    /* Noon CT anchor — box TZ is America/Chicago */
    var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0);
    var dow = d.getDay(); /* 0=Sun … 5=Fri */
    var sinceFri = (dow - 5 + 7) % 7; /* Fri=0 … Thu=6 */
    d.setDate(d.getDate() - sinceFri);
    /* On the week-change day, today counts in the prior week until the change hour. */
    if (sinceFri === 0) {
      if (iso === DAY_ISO) {
        if (chicagoHourNow() < 15) d.setDate(d.getDate() - 7);
      } else {
        /* A past week-change day counts in the prior week. */
        d.setDate(d.getDate() - 7);
      }
    }
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }

  function dowIndexFromIso(iso) {
    var parts = String(iso).split("-");
    if (parts.length !== 3) return 0;
    var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0);
    return d.getDay();
  }

  function questMeta(kidId, checkId, data) {
    var kid = data && data.kids && data.kids[kidId];
    if (!kid || !kid.quests) return { cadence: "daily", stars: 1, optional: false };
    for (var i = 0; i < kid.quests.length; i++) {
      if (kid.quests[i].id === checkId) {
        var q = kid.quests[i];
        var optional = !!(q.optional || q.cadence === "addon");
        var cadence = q.cadence || (optional ? "addon" : "daily");
        var stars = optional ? 0 : (typeof q.stars === "number" ? q.stars : 1);
        return { cadence: cadence, stars: stars, optional: optional };
      }
    }
    return { cadence: "daily", stars: 1, optional: false };
  }

  var WEEKLY_IDS = {
    "ain-bath": 1, "ain-laundry": 1, "ain-cubby": 1,
    "hay-room": 1, "hay-shoes": 1, "hay-cubby": 1,
    "har-toys": 1, "har-shoes": 1, "har-cubby": 1
  };
  var DOW_SHORT = ["S", "M", "T", "W", "T", "F", "S"];
  var DOW_LONG = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  function checkKeyFor(checkId, data, dayIso) {
    var kidId = KID_FROM_CHECK[checkId];
    if (!kidId) return CHECK_KEY;
    var meta = questMeta(kidId, checkId, data || (global.WardKids && global.WardKids._data));
    var weekly = meta.cadence === "weekly" || !!WEEKLY_IDS[checkId];
    var iso = dayIso || DAY_ISO;
    if (weekly) {
      return CHECK_PREFIX + kidId + ":week:" + weekStartIso(iso);
    }
    /* daily musts + soft/addon — keyed per Chicago day (Sat→Fri Dad-week taps) */
    return CHECK_PREFIX + kidId + ":" + iso;
  }

  /** Seven tap days per chore week. */
  var DAD_WEEK_DAYS = 7;

  function weekDayIsos(anchorIso) {
    var start = weekStartIso(anchorIso || DAY_ISO);
    var parts = String(start).split("-");
    /* First tap day = the day after the week change (start+1). */
    var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0);
    d.setDate(d.getDate() + 1);
    var out = [];
    for (var i = 0; i < DAD_WEEK_DAYS; i++) {
      out.push(d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()));
      d.setDate(d.getDate() + 1);
    }
    return out;
  }

  function dadWeekLen() {
    return weekDayIsos(DAY_ISO).length || DAD_WEEK_DAYS;
  }

  function dailyDoneCount(checkId, data) {
    var n = 0;
    var days = weekDayIsos(DAY_ISO);
    for (var i = 0; i < days.length; i++) {
      if (getCheckRaw(checkId, data, days[i])) n += 1;
    }
    return n;
  }

  function dailyWeekComplete(checkId, data) {
    return dailyDoneCount(checkId, data) >= weekDayIsos(DAY_ISO).length;
  }

  /* Stars credited to jar for a must. Daily = stars×DAD_WEEK_DAYS once Sat→Fri complete (not per-day pay). */
  function bankStarsFor(kidId, checkId, data) {
    var meta = questMeta(kidId, checkId, data);
    if (meta.optional) return 0;
    if (meta.cadence === "daily") return (meta.stars || 1) * dadWeekLen();
    return meta.stars || 1;
  }

  function recomputeDayStars(kidId, dayBag, data) {
    var sum = 0;
    if (!dayBag || !dayBag.earned) return 0;
    Object.keys(dayBag.earned).forEach(function (k) {
      if (k === MUST_GATE_FLAG) return;
      if (dayBag.earned[k]) sum += bankStarsFor(kidId, k, data);
    });
    dayBag.stars = sum;
    return sum;
  }

  function ensureDayBag(root, kidId, iso) {
    if (!root[kidId]) root[kidId] = { days: {}, lifetime: 0, balance: 0 };
    if (!root[kidId].days) root[kidId].days = {};
    if (!root[kidId].days[iso]) root[kidId].days[iso] = { stars: 0, earned: {} };
    if (!root[kidId].days[iso].earned) root[kidId].days[iso].earned = {};
    return root[kidId].days[iso];
  }

  /** MUSTGATE1 · non-optional quests that must ALL clear before jar/allowance unlocks. */
  var MUST_GATE_FLAG = "__mustgate__";

  function mustQuests(kidId, data) {
    var kid = data && data.kids && data.kids[kidId];
    if (!kid || !kid.quests) return [];
    var out = [];
    for (var i = 0; i < kid.quests.length; i++) {
      var q = kid.quests[i];
      if (q.optional || q.cadence === "addon") continue;
      out.push(q);
    }
    return out;
  }

  function mustSetComplete(kidId, data) {
    var qs = mustQuests(kidId, data);
    if (!qs.length) return false;
    for (var i = 0; i < qs.length; i++) {
      var q = qs[i];
      var cadence = q.cadence || "daily";
      if (cadence === "daily") {
        if (!dailyWeekComplete(q.id, data)) return false;
      } else if (!getCheckRaw(q.id, data)) {
        return false;
      }
    }
    return true;
  }

  function mustProgress(kidId, data) {
    var qs = mustQuests(kidId, data);
    var done = 0;
    for (var i = 0; i < qs.length; i++) {
      var q = qs[i];
      var cadence = q.cadence || "daily";
      var ok = cadence === "daily" ? dailyWeekComplete(q.id, data) : getCheckRaw(q.id, data);
      if (ok) done += 1;
    }
    return { done: done, need: qs.length, complete: qs.length > 0 && done >= qs.length };
  }

  function mustPayStars(kidId, data) {
    var qs = mustQuests(kidId, data);
    var pay = 0;
    for (var i = 0; i < qs.length; i++) pay += bankStarsFor(kidId, qs[i].id, data);
    return pay;
  }

  /**
   * MUSTGATE1 · jar/allowance unlocks only when EVERY must is done for the week
   * (daily = all Sat→Fri taps; weekly = one tap). One chore done for the week does NOT credit $.
   * Credits all must stars onto first Sat tap day when gate opens; scrubs when gate closes.
   */
  function syncMustGateBank(kidId, data) {
    if (!kidId) return null;
    var root = loadBankRoot();
    if (!root[kidId]) root[kidId] = { days: {}, lifetime: 0, balance: 0 };
    var days = weekDayIsos(DAY_ISO);
    if (!days.length) return getBankView(kidId, data);
    var ws = days[0];
    /* DAYPKG1 · a week Dad already paid (Paid before Fri 15:00) is never credited again from the checks, on any boot or sync */
    if (root[kidId].paidWeek === ws) return getBankView(kidId, data);
    /* DAYPKG1 v2d · the synced Paid marker (written by the Dad sheet, carried by tapsync) also marks the week paid on a kid
       board (no ledger there). DAYPKG1 v2e · on another Dad screen the marker is mirrored once (mirrorSyncedPaid) */
    if (!MEM_BANK && mirrorSyncedPaid(kidId, data)) { root = loadBankRoot(); if (!root[kidId]) root[kidId] = { days: {}, lifetime: 0, balance: 0 }; }
    if (root[kidId].paidWeek === ws) return getBankView(kidId, data);
    if (paidMarkerAt(kidId, weekStartIso(DAY_ISO)) === "paid") return getBankView(kidId, data);
    var qs = mustQuests(kidId, data);
    var complete = mustSetComplete(kidId, data);
    var wsBag = ensureDayBag(root, kidId, ws);
    var wasGate = !!(wsBag.earned && wsBag.earned[MUST_GATE_FLAG]);
    var pay = mustPayStars(kidId, data);
    var di, qi, bag, id;

    for (di = 0; di < days.length; di++) {
      bag = ensureDayBag(root, kidId, days[di]);
      for (qi = 0; qi < qs.length; qi++) {
        id = qs[qi].id;
        if (bag.earned && bag.earned[id]) delete bag.earned[id];
      }
      if (bag.earned && bag.earned[MUST_GATE_FLAG]) delete bag.earned[MUST_GATE_FLAG];
      recomputeDayStars(kidId, bag, data);
    }

    if (complete) {
      wsBag = ensureDayBag(root, kidId, ws);
      for (qi = 0; qi < qs.length; qi++) {
        wsBag.earned[qs[qi].id] = true;
      }
      wsBag.earned[MUST_GATE_FLAG] = true;
      recomputeDayStars(kidId, wsBag, data);
    }

    if (complete && !wasGate) {
      root[kidId].lifetime = (root[kidId].lifetime || 0) + pay;
    } else if (!complete && wasGate) {
      root[kidId].lifetime = Math.max(0, (root[kidId].lifetime || 0) - pay);
    }
    saveBankRoot(root);
    return getBankView(kidId, data);
  }

  /** Legacy name — re-syncs full Must gate for the kid owning this check. */
  function syncDailyWeekBank(checkId, data) {
    var kidId = KID_FROM_CHECK[checkId];
    if (!kidId) return null;
    return syncMustGateBank(kidId, data);
  }

  function weekStarsFor(kidId) {
    var root = loadBankRoot();
    var bag = root[kidId];
    if (!bag || !bag.days) return 0;
    /* Sum this chore week's tap days only (matches syncDailyWeekBank credit bucket). */
    var days = weekDayIsos(DAY_ISO);
    var sum = 0;
    for (var i = 0; i < days.length; i++) {
      var iso = days[i];
      if (bag.days[iso] && bag.days[iso].stars) sum += bag.days[iso].stars;
    }
    return sum;
  }

  /* PRIVFEED1 · no embedded copy: kids-week is private and arrives through private-feed.js (hub + device cache). */
  var EMBEDDED = null;

  /* NODATA3 · no em dashes or arrows on the face: " — " reads " · ", "MOVED →" reads "moved to", "3:30p→CLE" reads "3:30p to CLE" */
  function faceDash(s) {
    return String(s == null ? "" : s)
      .replace(/\bMOVED\s*[\u2192\u21d2\u27a1]\s*/g, "moved to ").replace(/\bmoved\s*[\u2192\u21d2\u27a1]\s*/gi, "moved to ")
      .replace(/\s*[\u2192\u21d2\u27a1]\s*/g, " to ")
      .replace(/\s*\u2014\s*/g, " \u00b7 ")
      .replace(/(\s*\u00b7\s*){2,}/g, " \u00b7 ").replace(/^\s*\u00b7\s*|\s*\u00b7\s*$/g, "");
  }
  function esc(s) {
    return faceDash(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function loadJSON(cb) {
    /* LIVELAW1 · every kids-week payload (fresh or embedded) passes Dan's face laws before any board renders it:
       no colour / dress-up day rows, no rows that already ended today, NEXT is the next real item */
    var cbRaw = cb;
    cb = function (err, d) {
      function go() { if (d && global.HouseFaceLaw) { try { HouseFaceLaw.cleanKidsWeek(d); } catch (e) { /* */ } } cbRaw(err, d); }
      /* AWAYLAW1 · no kid times on away days (cal-months withDan via away-filter.js), embedded copy included */
      var AF = global.AwayFilter;
      if (!d || !AF) { go(); return; }
      AF.ready().then(function () { try { AF.filterKidsWeek(d); } catch (e) { /* */ } go(); }, go);
    };
    var urls = ["kids-week.json", "data/kids-week.json"];
    var i = 0;
    function tryNext() {
      if (i >= urls.length) {
        if (EMBEDDED) { cb(null, EMBEDDED); return; }
        cb(new Error("kids-week.json missing"), null);
        return;
      }
      var u = urls[i++];
      if (typeof fetch !== "function") { tryNext(); return; }
      fetch(u, { cache: "no-store" })
        .then(function (r) {
          if (!r.ok) throw new Error("HTTP " + r.status);
          return r.json();
        })
        .then(function (data) {
          EMBEDDED = data;
          cb(null, data);
        })
        .catch(function () { tryNext(); });
    }
    /* CANCELGONE1 · the embedded copy rides a cached kids-data.js and can be
     * hours old. Always try the fresh kids-week.json first (3s), embedded only
     * if the network is down. */
    if (EMBEDDED && typeof fetch === "function") {
      var done = false, emb = EMBEDDED;
      var t = setTimeout(function () { if (!done) { done = true; cb(null, emb); } }, 3000);
      fetch(urls[0] + "?t=" + Date.now(), { cache: "no-store" })
        .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
        .then(function (d) {
          if (done) { EMBEDDED = d; return; }
          done = true; clearTimeout(t); EMBEDDED = d; cb(null, d);
        })
        .catch(function () { if (!done) { done = true; clearTimeout(t); cb(null, emb); } });
      return;
    }
    if (EMBEDDED) { cb(null, EMBEDDED); return; }
    tryNext();
  }

  function loadKeyState(key) {
    try { return JSON.parse(localStorage.getItem(key) || "{}") || {}; }
    catch (e) { return {}; }
  }
  function saveKeyState(key, state) {
    try { localStorage.setItem(key, JSON.stringify(state)); } catch (e) { /* */ }
  }

  /* Legacy flat blob — only for one-shot migrate into day keys */
  function loadChecks() {
    try { return JSON.parse(localStorage.getItem(CHECK_KEY) || "{}") || {}; }
    catch (e) { return {}; }
  }
  function saveChecks(state) {
    try { localStorage.setItem(CHECK_KEY, JSON.stringify(state)); } catch (e) { /* */ }
  }

  var MALFORMED_KEPT = "";
  function loadBankRoot() {
    if (MEM_BANK) return JSON.parse(JSON.stringify(MEM_BANK));
    if (kidScope()) return {}; /* DAYPKG1 v2e · never dad-ledger:v1 on a kid board */
    var raw = null;
    try { raw = localStorage.getItem(BANK_KEY); } catch (e) { raw = null; }
    if (raw == null) return {};
    try { var o = JSON.parse(raw); if (o && typeof o === "object") return o; } catch (e) { /* below */ }
    /* DAYPKG1 v2e · an unreadable ledger is kept raw (dad-ledger:v1:superseded) before the sheet starts a fresh one */
    try { if (!MALFORMED_KEPT) { MALFORMED_KEPT = keepRawLedger(raw); if (global.console && console.info) console.info("[dad-ledger] unreadable " + BANK_KEY + " kept raw as " + MALFORMED_KEPT); } } catch (e) { /* */ }
    return {};
  }
  function saveBankRoot(root) {
    if (MEM_BANK) { MEM_BANK = JSON.parse(JSON.stringify(root || {})); return; }
    if (kidScope()) return;
    root = root || {};
    root._w = Date.now(); /* DAYPKG1 v2e · write stamp: the newer ledger wins a migration meet */
    try { localStorage.setItem(BANK_KEY, JSON.stringify(root)); } catch (e) { /* */ }
  }

  function kidDayBank(kidId) {
    var root = loadBankRoot();
    if (!root[kidId]) root[kidId] = { days: {}, lifetime: 0, balance: 0 };
    if (typeof root[kidId].balance !== "number") root[kidId].balance = Number(root[kidId].balance) || 0;
    if (typeof root[kidId].lifetime !== "number") root[kidId].lifetime = Number(root[kidId].lifetime) || 0;
    if (!root[kidId].days[DAY_ISO]) root[kidId].days[DAY_ISO] = { stars: 0, earned: {} };
    return { root: root, day: root[kidId].days[DAY_ISO], bag: root[kidId] };
  }

  function questStarsFor(kidId, checkId, data) {
    return questMeta(kidId, checkId, data).stars;
  }

  function applyCheckToBank(checkId, done, data) {
    var kidId = KID_FROM_CHECK[checkId];
    if (!kidId) return null;
    var meta = questMeta(kidId, checkId, data);
    /* MUSTGATE1 · optional/hire never fills jar; all musts route through full-set gate */
    if (meta.optional) return getBankView(kidId, data);
    return syncMustGateBank(kidId, data);
  }

  function allowanceCap(goal) {
    var g = goal || {};
    var cap = typeof g.weeklyAllowance === "number" ? g.weeklyAllowance : null;
    if (cap == null || isNaN(cap)) cap = typeof g.need === "number" ? g.need : 0;
    return Math.max(0, Number(cap) || 0);
  }

  function starDollarOf(goal) {
    var g = goal || {};
    return g.starDollar != null ? Number(g.starDollar) : 1;
  }

  function weekEarnDollars(kidId, data) {
    if (!mustSetComplete(kidId, data)) return 0;
    var kid = (data && data.kids && data.kids[kidId]) || {};
    var goal = kid.bankGoal || {};
    var week = weekStarsFor(kidId);
    var sd = starDollarOf(goal);
    var cap = allowanceCap(goal);
    var raw = week * (isNaN(sd) ? 1 : sd);
    return Math.min(raw, cap);
  }

  /* DAYPKG1 v2e · caveat (c) fix: a second Dad screen keeps its own dad-ledger:v1, so a Paid or Jar reset done on the other
     Dad screen reaches it only as the synced marker. Each marker (this marker week and the one before) is mirrored ONCE:
     Paid = everything owed through that week was paid (drop those days, carry to zero; this week also marked paid);
     Jar reset of a week with stars = that week moves into the carry. Done marker weeks are kept in syncPaid (the screen
     that paid records its own), so nothing is applied twice and the two Dad screens agree */
  function mirrorSyncedPaid(kidId, data) {
    if (MEM_BANK || kidScope() || !PAID_PFX || !PAID_PFX[kidId]) return false;
    var root = loadBankRoot();
    var bag = root[kidId];
    if (!bag) return false;
    var curM = weekStartIso(DAY_ISO), changed = false;
    var sp = bag.syncPaid && typeof bag.syncPaid === "object" ? bag.syncPaid : {};
    /* DAYPKG1 v2f residual · install marker: the first mirror pass on this ledger records its week (bag.mirrorSince). A synced
       marker for a week before it is never mirrored, so the week before the install cannot zero this device's own carry */
    if (typeof bag.mirrorSince !== "string") { bag.mirrorSince = curM; changed = true; }
    var since = bag.mirrorSince;
    [addDaysIsoLocal(curM, -7), curM].forEach(function (wm) {
      if (sp[wm]) return;
      if (wm < since) return;
      var m = paidMarkerAt(kidId, wm);
      if (!m) return;
      var taps = weekDayIsos(addDaysIsoLocal(wm, 1));
      var last = taps[taps.length - 1];
      if (!bag.days) bag.days = {};
      if (m === "paid") {
        Object.keys(bag.days).forEach(function (iso) { if (iso <= last) bag.days[iso] = { stars: 0, earned: {} }; });
        bag.balance = 0;
        if (wm === curM) bag.paidWeek = taps[0];
      } else if (wm === curM) {
        var stars = 0;
        for (var i = 0; i < taps.length; i++) if (bag.days[taps[i]] && bag.days[taps[i]].stars) stars += bag.days[taps[i]].stars;
        if (stars > 0) {
          var goal = ((data && data.kids && data.kids[kidId]) || {}).bankGoal || {};
          var sd = starDollarOf(goal); if (isNaN(sd)) sd = 1;
          bag.balance = (Number(bag.balance) || 0) + Math.min(stars * sd, allowanceCap(goal));
          for (var j = 0; j < taps.length; j++) if (bag.days[taps[j]]) bag.days[taps[j]] = { stars: 0, earned: {} };
          bag.paidWeek = taps[0];
        }
      }
      sp[wm] = 1; changed = true;
    });
    if (!changed) return false;
    var old = addDaysIsoLocal(curM, -35);
    Object.keys(sp).forEach(function (k) { if (k < old) delete sp[k]; });
    bag.syncPaid = sp;
    saveBankRoot(root);
    return true;
  }

  /** Move prior (completed) weeks' stars into durable balance$ so unpaid carry survives rollover. */
  function settlePriorWeeksIntoBalance(kidId, data) {
    mirrorSyncedPaid(kidId, data);
    var pack = kidDayBank(kidId);
    var bag = pack.bag;
    if (!bag.days) return;
    var kid = (data && data.kids && data.kids[kidId]) || {};
    var goal = kid.bankGoal || {};
    var sd = starDollarOf(goal);
    if (isNaN(sd)) sd = 1;
    var cap = allowanceCap(goal);
    var curDays = weekDayIsos(DAY_ISO);
    var curSet = {};
    for (var ci = 0; ci < curDays.length; ci++) curSet[curDays[ci]] = 1;
    var byWeek = {};
    Object.keys(bag.days).forEach(function (iso) {
      if (curSet[iso]) return; /* current Sat→Fri stays as week stars */
      var taps = weekDayIsos(iso);
      var wk = taps[0] || iso; /* first tap day = week bank key */
      if (bag.paidWeek && wk === bag.paidWeek) return; /* DAYPKG1 · a paid week never settles again */
      if (!byWeek[wk]) byWeek[wk] = { stars: 0, taps: taps };
      byWeek[wk].stars += (bag.days[iso] && bag.days[iso].stars) ? bag.days[iso].stars : 0;
    });
    var added = 0;
    Object.keys(byWeek).forEach(function (wk) {
      var stars = byWeek[wk].stars || 0;
      if (stars <= 0) return;
      var earn = Math.min(stars * sd, cap);
      bag.balance = (bag.balance || 0) + earn;
      added += earn;
      var taps = byWeek[wk].taps || [];
      for (var i = 0; i < taps.length; i++) {
        var iso = taps[i];
        if (bag.days[iso]) bag.days[iso] = { stars: 0, earned: {} };
      }
    });
    if (added) saveBankRoot(pack.root);
    return added;
  }

  function getBankView(kidId, data) {
    settlePriorWeeksIntoBalance(kidId, data);
    var pack = kidDayBank(kidId);
    var kid = (data && data.kids && data.kids[kidId]) || {};
    var goal = kid.bankGoal || { need: 10, title: "", blurb: "", reward: "" }; /* KIDCRIT AINSGOAL1 · no "Goal" placeholder when the builder drops bankGoal (Ainsley) */
    var cur = kid.currency || { plural: "stars", symbol: "★", label: "Stars" };
    var today = pack.day.stars || 0;
    /* Week star tally → jar / weekly allowance goal (existing need $ amounts) */
    var week = weekStarsFor(kidId);
    var life = pack.bag.lifetime || 0;
    var balance = typeof pack.bag.balance === "number" ? pack.bag.balance : (Number(pack.bag.balance) || 0);
    var weeklyAllowance = allowanceCap(goal);
    var starDollar = starDollarOf(goal);
    var weekEarn = Math.min(week * (isNaN(starDollar) ? 1 : starDollar), weeklyAllowance);
    var toward = Math.min(week, goal.need);
    var pct = goal.need ? Math.round((toward / goal.need) * 100) : 0;
    /* Available $ toward jar / personal saves = carry + this week's earn */
    var available = balance + weekEarn;
    var gate = mustProgress(kidId, data);
    /* MUSTGATE1 · jar fill only when full Must set is clear (week stars already scrubbed if locked) */
    var reached = !!gate.complete && weekEarn >= weeklyAllowance && weeklyAllowance > 0;
    if (!gate.complete) {
      week = 0;
      weekEarn = 0;
      toward = 0;
      pct = 0;
      available = balance;
      reached = false;
    }
    /* BINDFIX2 · never jar-full / JAR FULL CTA at $0 */
    if (!(weekEarn > 0 || toward > 0 || (balance > 0 && gate.complete))) {
      reached = false;
    }
    return {
      kidId: kidId,
      today: today,
      week: week,
      weekEarn: weekEarn,
      balance: balance,
      available: available,
      weeklyAllowance: weeklyAllowance,
      starDollar: isNaN(starDollar) ? 1 : starDollar,
      lifetime: life,
      need: goal.need,
      toward: toward,
      pct: Math.min(100, pct),
      reached: reached,
      mustGate: gate,
      mustComplete: !!gate.complete,
      goalTitle: goal.title,
      goalBlurb: goal.blurb,
      reward: goal.reward,
      currency: cur,
      dayIso: DAY_ISO,
      weekStart: weekStartIso(DAY_ISO),
      earned: Object.assign({}, pack.day.earned)
    };
  }

  function getCheckRaw(checkId, data, dayIso) {
    /* HAYESJAR1C · jar-met: Hayes's backpack on the locked days reads done on every device (empty storage too) while the
       lock holds (HAYESJAR1D: until Mon 11-02 CT). A boolean read, so a real tap on the same day can not count twice. Nothing is written. */
    if (hayesJar1Locked(checkId, dayIso)) return true;
    var key = checkKeyFor(checkId, data, dayIso);
    var state = loadKeyState(key);
    if (Object.prototype.hasOwnProperty.call(state, checkId)) return !!state[checkId];
    /* KIDCRIT DAYFRESH1 (Atlas R4) · no migrate from the legacy flat blob: it carries no day, was written on every today-check
       and never cleared, so on a fresh day (Sun to Mon) it copied old checks into the new day key and the chore showed done.
       A day or week with no key of its own is not done. */
    return false;
  }

  function getCheck(checkId, data, dayIso) {
    return getCheckRaw(checkId, data, dayIso);
  }

  function setCheck(checkId, done, data, dayIso) {
    var kidId = KID_FROM_CHECK[checkId];
    /* HAYESJAR1C · Hayes's backpack on a locked day is a true no-op: no write, so house-tapsync never sees or sends an uncheck. */
    if (hayesJar1Locked(checkId, dayIso)) return kidId ? getBankView(kidId, data) : null;
    var meta = kidId
      ? questMeta(kidId, checkId, data || (global.WardKids && global.WardKids._data))
      : { cadence: "daily", stars: 1, optional: false };
    var before = kidId ? getBankView(kidId, data) : null;
    var was = before ? before.reached : false;
    var beforeGate = kidId ? mustSetComplete(kidId, data) : false;

    var key = checkKeyFor(checkId, data, dayIso);
    var state = loadKeyState(key);
    state[checkId] = !!done;
    saveKeyState(key, state);
    /* KIDCRIT DAYFRESH1 · the legacy flat blob is no longer written (no reader left; it is what made a fresh day show done) */

    var bank = null;
    var newlyBanked = false;
    if (kidId && !meta.optional) {
      bank = syncMustGateBank(kidId, data);
      var afterGate = mustSetComplete(kidId, data);
      newlyBanked = afterGate && !beforeGate;
    } else if (kidId) {
      bank = getBankView(kidId, data);
    }

    if (bank && bank.reached && !was) {
      try { localStorage.setItem("house-bank-goal:" + bank.kidId, "1"); } catch (e) {}
      try {
        document.dispatchEvent(new CustomEvent("house:goal-hit", { detail: { kidId: bank.kidId, reward: bank.reward, bank: bank } }));
      } catch (e) {}
    }
    /* Flash $ only when FULL Must set unlocks jar — existing allowance cap (star value + cap from the private kids-week) */
    if (bank && newlyBanked) {
      try {
        var bucks = weekEarnDollars(kidId, data);
        if (bucks > 0) {
          document.dispatchEvent(new CustomEvent("house:earn", {
            detail: { kidId: kidId, dollars: bucks, checkId: checkId, bank: bank, mustGate: true }
          }));
        }
      } catch (eEarn) { /* */ }
    }
    return bank;
  }

  function syncBankFromChecks(data) {
    var seen = {};
    Object.keys(KID_FROM_CHECK).forEach(function (id) {
      var kidId = KID_FROM_CHECK[id];
      if (!kidId || seen[kidId]) return;
      seen[kidId] = 1;
      syncMustGateBank(kidId, data);
    });
  }

  function cardHTML(item) {
    var tone = item.tone || "act";
    var cls = "card " + tone;
    if (item.compact) cls += " compact";
    var tag = item.href ? "a" : "div";
    var hrefAttr = item.href ? ' href="' + esc(item.href) + '"' : "";
    var html = "<" + tag + ' class="' + cls + '"' + hrefAttr + ">";
    if (item.when) html += '<div class="when">' + esc(item.when) + "</div>";
    if (item.what) html += '<div class="what">' + esc(item.what) + "</div>";
    if (item.hint) html += '<div class="hint">' + esc(item.hint) + "</div>";
    html += "</" + tag + ">";
    return html;
  }

  function quietHTML(msg) {
    return '<div class="card quiet">' + esc(msg) + "</div>";
  }

  function questHTML(q, done, kidId, data) {
    var optional = !!(q.optional || q.cadence === "addon");
    var cadence = q.cadence || (optional ? "addon" : "daily");
    var stars = optional ? 0 : (typeof q.stars === "number" ? q.stars : 1);
    var weekPay = cadence === "daily" && !optional ? stars * dadWeekLen() : stars;
    var dayCount = 0;
    var weekDone = false;
    if (cadence === "daily" && !optional) {
      dayCount = dailyDoneCount(q.id, data);
      weekDone = dayCount >= weekDayIsos(DAY_ISO).length;
      done = weekDone;
    }
    var open = done ? "done" : "open";
    var ring = done ? "✓" : (optional ? "+" : "·");
    /* KIDCHORES1 · musts = title + day checks only. Jar/payout lives once at board level. */
    var hint = "";
    var earn = "";
    if (optional) {
      if (q.hire && kidId === "ainsley") {
        var rate = (q.rateLabel && !/\/(?:kid-[a-z]+|mercury-run)(\.html)?$/.test(location.pathname || "")) ? String(q.rateLabel) : ""; /* PRIVFEED2 · rate lives in the private kids-week. DELTA2 · never on a kid page */
        hint = done
          ? "hire logged" + (rate ? " · " + rate : "") + " Dad handout"
          : "hire path" + (rate ? " · " + rate : "") + " · Dad books you · never fills jar";
        earn = '<span class="star-earn addon-tag">' + esc(/\/(?:kid-[a-z]+|mercury-run)(\.html)?$/.test(location.pathname || "") ? "Hire job" : rate) + (done ? " ✓" : "") + "</span>"; /* DELTA2 · kid row reads Hire job */
      } else {
        hint = done
          ? (q.hire ? "hire logged · booked" : "logged")
          : (q.hire ? "hire path · Dad books you · never fills jar" : "add-on · never fills jar");
        earn = '<span class="star-earn addon-tag">' + (done ? "OPTIONAL ✓" : "OPTIONAL") + "</span>";
      }
    }
    var optAttr = optional ? ' data-optional="1"' : "";
    var hireAttr = (optional && q.hire) ? ' data-hire="1"' : "";
    var cadAttr = ' data-cadence="' + esc(cadence) + '"';
    var softClass = optional ? " addon soft" : "";
    var dailyClass = (cadence === "daily" && !optional) ? " daily-week" : "";
    var starsAttr = ' data-stars="' + (cadence === "daily" && !optional ? weekPay : stars) + '"';

    if (cadence === "daily" && !optional) {
      var days = weekDayIsos(DAY_ISO);
      var taps = "";
      for (var di = 0; di < days.length; di++) {
        var iso = days[di];
        var dayOn = getCheck(q.id, data, iso);
        var isToday = iso === DAY_ISO;
        var cls = "day-tap" + (dayOn ? " done" : "") + (isToday ? " is-today" : "");
        taps += '<button type="button" class="' + cls + '" data-check="' + esc(q.id) + '" data-day-iso="' + esc(iso) +
          '" data-kid-quest="1" data-cadence="daily"' + starsAttr +
          ' aria-label="' + DOW_LONG[dowIndexFromIso(iso)] + " · " + esc(q.what) + '" aria-pressed="' + (dayOn ? "true" : "false") + '">' +
          DOW_SHORT[dowIndexFromIso(iso)] + "</button>";
      }
      return (
        '<div class="quest ' + open + softClass + dailyClass + '" data-quest-id="' + esc(q.id) + '" data-kid-quest="1"' +
        optAttr + hireAttr + cadAttr + starsAttr + ">" +
        '<div class="quest-body"><div class="what">' + esc(q.what) + "</div>" +
        '<div class="quest-days" role="group" aria-label="Days this week">' + taps + "</div></div>" +
        "</div>"
      );
    }

    var hintBlock = hint ? '<div class="hint">' + esc(hint) + "</div>" : "";
    return (
      '<div class="quest ' + open + softClass + '" data-check="' + esc(q.id) + '" data-kid-quest="1"' + optAttr + hireAttr + cadAttr + starsAttr + ' role="button" tabindex="0">' +
      '<span class="ring">' + ring + "</span>" +
      '<div><div class="what">' + esc(q.what) + "</div>" + hintBlock + "</div>" +
      earn +
      "</div>"
    );
  }

  function renderList(el, items, emptyMsg) {
    if (!el) return;
    if (!items || !items.length) {
      el.innerHTML = quietHTML(emptyMsg || "none on your board yet");
      return;
    }
    el.innerHTML = items.map(cardHTML).join("");
  }

  function renderQuests(el, quests, data, kidId) {
    if (!el) return;
    el.innerHTML = (quests || []).map(function (q) {
      var optional = !!(q.optional || q.cadence === "addon");
      var cadence = q.cadence || (optional ? "addon" : "daily");
      var done = cadence === "daily" && !optional
        ? dailyWeekComplete(q.id, data)
        : getCheck(q.id, data);
      return questHTML(q, done, kidId, data);
    }).join("");
  }

  /** Upgrade static sheet-chores rows: daily musts get Sat→Fri Dad-week taps. */
  function enhanceSharedChores(root, data) {
    root = root || document;
    data = data || (global.WardKids && global.WardKids._data);
    if (!data) return;
    var nodes = root.querySelectorAll(".chore[data-check], .quest[data-check]");
    Array.prototype.forEach.call(nodes, function (el) {
      if (el.classList.contains("day-tap")) return;
      if (el.querySelector(".quest-days")) return;
      var id = el.getAttribute("data-check");
      if (!id || !KID_FROM_CHECK[id]) return;
      var kidId = KID_FROM_CHECK[id];
      var meta = questMeta(kidId, id, data);
      el.setAttribute("data-cadence", meta.cadence);
      var nDays = dadWeekLen();
      el.setAttribute("data-stars", String(meta.optional ? 0 : (meta.cadence === "daily" ? meta.stars * nDays : meta.stars)));
      if (meta.optional) {
        el.setAttribute("data-optional", "1");
        var earnOpt = el.querySelector(".star-earn");
        if (earnOpt && el.getAttribute("data-check") === "ain-babysit") {
          earnOpt.classList.add("addon-tag");
          earnOpt.textContent = /\/(?:kid-[a-z]+|mercury-run)(\.html)?$/.test(location.pathname || "") ? "Hire job" : (meta.rateLabel ? String(meta.rateLabel) : ""); /* PRIVFEED2 · private rate. DELTA2 · kid page reads Hire job */
          earnOpt.setAttribute("data-money", "babysit");
          if (!meta.rateLabel && global.HouseMoney && global.HouseMoney.ready()) global.HouseMoney.paint();
          earnOpt.setAttribute("data-stars", "0");
        }
        return;
      }
      if (meta.cadence === "weekly") {
        /* KIDCHORES1 · no per-row $ / jar hint on musts */
        var earnW = el.querySelector(".star-earn");
        if (earnW && !earnW.classList.contains("addon-tag")) earnW.remove();
        var hintW = el.querySelector(".hint");
        if (hintW) hintW.remove();
        return;
      }
      if (meta.cadence !== "daily") return;

      var weekPay = meta.stars * nDays;
      var dayCount = dailyDoneCount(id, data);
      var weekDone = dayCount >= weekDayIsos(DAY_ISO).length;
      var whatEl = el.querySelector(".what");
      var what = whatEl ? whatEl.textContent : id;
      var days = weekDayIsos(DAY_ISO);
      var taps = document.createElement("div");
      taps.className = "quest-days";
      taps.setAttribute("role", "group");
      taps.setAttribute("aria-label", "Days this week");
      for (var di = 0; di < days.length; di++) {
        var iso = days[di];
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "day-tap" + (getCheck(id, data, iso) ? " done" : "") + (iso === DAY_ISO ? " is-today" : "");
        btn.setAttribute("data-check", id);
        btn.setAttribute("data-day-iso", iso);
        btn.setAttribute("data-kid-quest", "1");
        btn.setAttribute("data-cadence", "daily");
        btn.setAttribute("data-stars", String(weekPay));
        btn.setAttribute("aria-label", DOW_LONG[dowIndexFromIso(iso)] + " · " + what);
        btn.setAttribute("aria-pressed", getCheck(id, data, iso) ? "true" : "false");
        btn.textContent = DOW_SHORT[dowIndexFromIso(iso)];
        taps.appendChild(btn);
      }
      var txt = el.querySelector(".txt") || el;
      var hint = el.querySelector(".hint");
      if (hint) hint.remove();
      var earn = el.querySelector(".star-earn");
      if (earn && !earn.classList.contains("addon-tag")) earn.remove();
      var kids = el.children;
      for (var ri = 0; ri < kids.length; ri++) {
        if (kids[ri].classList && kids[ri].classList.contains("ring")) {
          kids[ri].style.display = "none";
          break;
        }
      }
      el.classList.add("daily-week");
      el.classList.toggle("done", weekDone);
      el.classList.toggle("open", !weekDone);
      el.removeAttribute("role");
      el.removeAttribute("tabindex");
      /* Move data-check off the row so only day-taps toggle */
      el.setAttribute("data-quest-id", id);
      el.removeAttribute("data-check");
      if (txt && txt !== el) txt.appendChild(taps);
      else el.appendChild(taps);
    });
  }


  /** Next payday = next Friday 6:00p America/Chicago (box TZ). Ledger default. */
  function nextPaydayInfo(now) {
    now = now || new Date();
    var day = now.getDay();
    var hours = now.getHours();
    var daysUntilFri = (5 - day + 7) % 7;
    if (daysUntilFri === 0 && hours >= 18) daysUntilFri = 7;
    var label;
    if (daysUntilFri === 0) label = "Tonight · Fri payday";
    else if (daysUntilFri === 1) label = "Tomorrow · Fri payday";
    else label = daysUntilFri + " days · Fri payday";
    return { days: daysUntilFri, label: label, when: "Fri evening CT", rule: "Next Payday = next Friday 6:00p CT" };
  }

  /* DAYPKG1 v2d · Atlas A: the Paid marker rides the existing chore-tap sync (house-tapsync.js, hub /api/taps). It is a
     boolean id in the kid's week checkoffs key, house-checkoffs:<kid>:week:<week start>, id <hay|har|ain>-paid or
     -jar-reset: no amount, no number in the value, and the hub already accepts that key and id shape */
  var PAID_PFX = { hayes: "hay", harris: "har", ainsley: "ain" };
  var PAID_STAMP_MS = 14 * 24 * 3600 * 1000;
  function paidMarkerAt(kidId, ws) {
    var p = PAID_PFX[kidId];
    if (!p || !ws) return "";
    var st = loadKeyState(CHECK_PREFIX + kidId + ":week:" + ws);
    if (st[p + "-paid"] === true) return "paid";
    if (st[p + "-jar-reset"] === true) return "jar-reset";
    return "";
  }
  /* the marker sits in the week that was paid out: this week when it held stars (Paid before Fri 15:00), else the week that
     just settled (Paid at or after Fri 15:00), so a fresh week is never marked paid */
  function writePaidMarker(kidId, paid, thisWeek) {
    var p = PAID_PFX[kidId];
    if (!p) return;
    var ws = weekStartIso(DAY_ISO);
    if (!thisWeek) ws = addDaysIsoLocal(ws, -7);
    var key = CHECK_PREFIX + kidId + ":week:" + ws;
    var st = loadKeyState(key);
    st[p + "-paid"] = !!paid;
    st[p + "-jar-reset"] = !paid;
    saveKeyState(key, st);
  }
  function syncedPaidStamp(kidId) {
    var ws = weekStartIso(DAY_ISO);
    var m = paidMarkerAt(kidId, ws) || paidMarkerAt(kidId, addDaysIsoLocal(ws, -7));
    return m === "paid" ? "Paid \u2713" : m === "jar-reset" ? "Jar reset \u2713" : "";
  }

  function getPaidStamp(kidId) {
    /* DAYPKG1 v2f D1 · the money sign scrub (and the D4 paid-at for a legacy stamp) runs FIRST, before the synced and the
       expiry returns, so no '$' stamp survives a read on any path */
    var v = scrubPaidStamp(kidId);
    var synced = syncedPaidStamp(kidId);
    if (synced) return synced;
    try {
      /* DAYPKG1 v2e · the local stamp fades two weeks after its paid-at, like the synced marker window */
      if (v) {
        var at = Date.parse(localStorage.getItem("house-bank-paid-at:" + kidId) || "");
        if (!isNaN(at) && Date.now() - at > PAID_STAMP_MS) return "";
      }
      return v;
    } catch (e) { return ""; }
  }

  /**
   * Payday / jar reset.
   * 1) Convert this week's stars into durable balance$ (capped by weeklyAllowance).
   * 2) Subtract what Dad paid (optional paidAmount; default 0 = full carry).
   * 3) Clear week star buckets. Never zeros lifetime (long save goals stay intact).
   */
  function resetJarCycle(kidId, paidAmount, data) {
    if (kidScope()) return ""; /* DAYPKG1 v2d · Atlas A: no Paid on a kid board, ever */
    data = data || (global.WardKids && global.WardKids._data) || null;
    settlePriorWeeksIntoBalance(kidId, data);
    var pack = kidDayBank(kidId);
    var kid = (data && data.kids && data.kids[kidId]) || {};
    var goal = kid.bankGoal || {};
    var week = weekStarsFor(kidId);
    var sd = starDollarOf(goal);
    if (isNaN(sd)) sd = 1;
    var cap = allowanceCap(goal);
    var weekEarn = Math.min(week * sd, cap);
    if (typeof pack.bag.balance !== "number") pack.bag.balance = Number(pack.bag.balance) || 0;
    /* Week stars → balance (survive rollover); unpaid stays as carry */
    pack.bag.balance = (pack.bag.balance || 0) + weekEarn;
    var paid = 0;
    if (paidAmount != null && paidAmount !== "") {
      paid = Math.max(0, Number(paidAmount));
      if (isNaN(paid)) paid = 0;
    }
    paid = Math.min(paid, pack.bag.balance);
    pack.bag.balance = Math.max(0, pack.bag.balance - paid);
    /* DO NOT zero lifetime — personal long saves use lifetime/balance separately */
    /* Clear this week's Sat→Fri tap-day star buckets so jar/week bar resets */
    var taps = weekDayIsos(DAY_ISO);
    /* DAYPKG1 · mark the week paid only when it held stars (Paid before Fri 15:00); an empty new week stays open */
    if (week > 0 && taps.length) pack.bag.paidWeek = taps[0];
    /* DAYPKG1 v2e · this screen's own marker week is done here, never mirrored back onto itself */
    var ownM = weekStartIso(DAY_ISO);
    if (!(week > 0)) ownM = addDaysIsoLocal(ownM, -7);
    if (!pack.bag.syncPaid || typeof pack.bag.syncPaid !== "object") pack.bag.syncPaid = {};
    pack.bag.syncPaid[ownM] = 1;
    for (var i = 0; i < taps.length; i++) {
      var iso = taps[i];
      if (pack.root[kidId] && pack.root[kidId].days) {
        pack.root[kidId].days[iso] = { stars: 0, earned: {} };
      }
    }
    saveBankRoot(pack.root);
    /* DAYPKG1 v2 · the stamp is a marker only: no money sign, no amount (Alfred P2, Atlas ruling). Readers test /^Paid/ only */
    var stamp = paid > 0 ? "Paid \u2713" : "Jar reset \u2713";
    try {
      localStorage.removeItem("house-bank-goal:" + kidId);
      localStorage.setItem("house-bank-paid:" + kidId, stamp);
      localStorage.setItem("house-bank-paid-at:" + kidId, new Date().toISOString());
    } catch (e) {}
    writePaidMarker(kidId, paid > 0, week > 0);
    return stamp;
  }

  /* DAYPKG1 v2d · Atlas ruling (Oct 28 12:15 AM CT) A: Dad taps Paid per kid on the Dad Paid sheet. One tap pays what is owed
     (carry plus this week) through the same resetJarCycle; the kid boards only show the stamp it leaves */
  function dadPaid(kidId, data) {
    data = data || (global.WardKids && global.WardKids._data) || null;
    if (kidScope() || !data) return "";
    var v = getBankView(kidId, data);
    var stamp = resetJarCycle(kidId, String(v.available || 0), data);
    syncBankFromChecks(data);
    markDadDevice(); /* DAYPKG1 v2g · only inside a completed hold on the Dad Paid sheet (markDadDevice checks both) */
    return stamp;
  }

  /* DAYPKG1 v2e · Atlas 12:40 AM: hold to confirm Paid (about 2 s). Pointer events cover a real mouse and real touch; Space or
     Enter held works too. Lifting early, leaving the button or a cancel does nothing. One hold fires once (a held or
     repeating key never fires twice; the press must end before it arms again). A plain click does nothing. The button
     gets data-holding while held so the sheet can show the fill. Never on a kid board */
  var HOLD_MS = 2000;
  function bindHold(btn, fire, ms) {
    if (!btn || typeof fire !== "function" || kidScope()) return null;
    ms = typeof ms === "number" && ms > 0 ? ms : HOLD_MS;
    var timer = null, armed = true, fired = 0;
    function stop() {
      if (timer) { clearTimeout(timer); timer = null; }
      try { btn.removeAttribute("data-holding"); } catch (e) { /* */ }
    }
    function start(ev) {
      if (!armed || timer) return;
      if (ev && ev.type === "pointerdown" && ev.button != null && ev.button !== 0) return;
      armed = false;
      try { btn.setAttribute("data-holding", ""); } catch (e) { /* */ }
      try { if (ev && ev.pointerId != null && btn.setPointerCapture) btn.setPointerCapture(ev.pointerId); } catch (e) { /* */ }
      timer = setTimeout(function () { timer = null; try { btn.removeAttribute("data-holding"); } catch (e) { /* */ } fired++; HOLD_FIRING = true; try { fire(btn); } finally { HOLD_FIRING = false; } }, ms);
    }
    function end() { stop(); armed = true; }
    btn.addEventListener("pointerdown", function (ev) { if (ev && ev.preventDefault) ev.preventDefault(); start(ev); });
    ["pointerup", "pointercancel", "pointerleave", "lostpointercapture"].forEach(function (t) { btn.addEventListener(t, end); });
    btn.addEventListener("keydown", function (ev) {
      if (!ev || (ev.key !== " " && ev.key !== "Enter")) return;
      if (ev.preventDefault) ev.preventDefault();
      if (ev.repeat) return;
      start(ev);
    });
    btn.addEventListener("keyup", function (ev) { if (ev && (ev.key === " " || ev.key === "Enter")) end(); });
    btn.addEventListener("blur", end);
    btn.addEventListener("click", function (ev) { if (ev && ev.preventDefault) ev.preventDefault(); });
    btn.addEventListener("contextmenu", function (ev) { if (ev && ev.preventDefault) ev.preventDefault(); });
    return { fired: function () { return fired; }, ms: ms };
  }

  /* DAYPKG1 v2d · the kid board stamp sits outside the collapsed panel, above the world canvas, read only (kid-world.css) */
  function renderKidPaidChip(kidId) {
    if (!kidPage() || typeof document === "undefined" || !document.body) return null;
    var paid = getPaidStamp(kidId);
    var chip = document.querySelector("[data-kw-paid]");
    if (!chip && paid && document.createElement) {
      chip = document.createElement("div");
      chip.className = "kw-paid";
      chip.setAttribute("data-kw-paid", "");
      chip.setAttribute("aria-live", "polite");
      document.body.appendChild(chip);
    }
    if (chip) { chip.hidden = !paid; chip.textContent = paid || ""; }
    return chip;
  }

  function personalGoalView(kidId, data, bank) {
    var kid = data && data.kids && data.kids[kidId];
    var g = (kid && kid.goal) || {};
    var placeholder = g.placeholder || "Add a save on your board";
    var name = "";
    var need = 0;
    // Kid write-in saves win (HouseSaves localStorage) — first with ★ target, else first
    if (global.HouseSaves && typeof global.HouseSaves.list === "function") {
      try {
        var saves = global.HouseSaves.list(kidId) || [];
        var pick = null;
        for (var si = 0; si < saves.length; si++) {
          if (saves[si] && saves[si].need > 0) { pick = saves[si]; break; }
        }
        if (!pick && saves.length) pick = saves[0];
        if (pick && pick.name) {
          name = String(pick.name).trim();
          need = typeof pick.need === "number" ? pick.need : (parseInt(pick.need, 10) || 0);
        }
      } catch (eS) { /* */ }
    }
    if (!name) {
      need = typeof g.need === "number" ? g.need : 0;
      name = (g.name || "").trim();
    }
    name = kidSafeGoalText(name); /* DAYPKG1 v2i · kid scope: no money in a save name */
    if (!name || need <= 0) {
      return { active: false, placeholder: placeholder, name: name || "", need: need || 0, toward: 0, met: false };
    }
    /* Prefer durable balance$ (+ this week earn) for money carry; lifetime stars remain available */
    var money = 0;
    if (bank) {
      if (bank.balance != null || bank.weekEarn != null) {
        money = (Number(bank.balance) || 0) + (Number(bank.weekEarn) || 0);
      } else if (bank.available != null) {
        money = Number(bank.available) || 0;
      } else {
        money = Number(bank.lifetime || bank.toward || 0) || 0;
      }
    }
    var toward = Math.min(money, need);
    return { active: true, placeholder: placeholder, name: name, need: need, toward: toward, met: toward >= need, unit: "$" };
  }

  function buildNoSurprise(kid, data) {
    var bits = [];
    var cust = data && data.homeWeek;
    /* NOCUSTODY1 · no "who has the kids" row on glass */
    if (kid && kid.hottest) bits.push({ kind: "next", when: kid.hottest.when || "Next", what: kid.hottest.what || "Next up", hint: kid.hottest.where || "", tone: "hot" });
    (kid && kid.today || []).slice(0, 2).forEach(function (t) {
      bits.push({ kind: "today", when: t.when || "Today", what: t.what || "", hint: t.hint || "next 24h", tone: t.tone || "act" });
    });
    (kid && kid.appointments || []).forEach(function (a) {
      var when = (a.when || "").toLowerCase();
      // surface near-term appts (Sun/Mon/today-ish labels already in data)
      if (a.tone === "hot" || /sun|mon|today|tonight/.test(when)) {
        bits.push({ kind: "appt", when: a.when, what: a.what, hint: a.hint || "on your board", tone: a.tone || "hot" });
      }
    });
    // NOSURP2 · dedupe case-insensitive (hottest vs today repeat), drop today's past items
    var seen = {};
    var now = new Date();
    var dows = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    var todayDow = dows[now.getDay()];
    function pastToday(when) {
      var w = String(when || "").toLowerCase();
      var m = w.match(/(\d{1,2}):(\d{2})\s*(am|pm|a|p)?/);
      if (!m) return false;
      var isToday = /today|tonight/.test(w) || w.indexOf(todayDow) === 0 || new RegExp("^" + todayDow + "\\b").test(w);
      if (!isToday) return false;
      var h = Number(m[1]), mi = Number(m[2]), ap = m[3] || "";
      if (/^p/.test(ap) && h < 12) h += 12;
      else if (/^a/.test(ap) && h === 12) h = 0;
      else if (!ap && h >= 1 && h <= 6) h += 12;
      var t = new Date(now); t.setHours(h, mi, 0, 0);
      return now.getTime() > t.getTime() + 30 * 60000;
    }
    return bits.filter(function (b) {
      if (!b.what) return false;
      if (b.kind !== "house" && pastToday(b.when)) return false;
      var k = String(b.what).toLowerCase().replace(/\s+/g, " ").trim() + "|" + String(b.when || "").toLowerCase().replace(/\s+/g, " ").trim();
      if (seen[k]) return false;
      seen[k] = 1;
      return true;
    }).slice(0, 5);
  }

  /* DAYPKG1 v2i · Alfred v2h defect 1 (P1 law): the feed's goal title/blurb can carry money (a star rate in dollars, a dollar target).
     On kid scope it is scrubbed BEFORE any DOM write (no transient '$' for house-nomoney to strip later): currency signs,
     amounts, money words and every digit go, plus em dashes and arrows (kid copy law); leftover separators are tidied.
     Adult pages keep the text as is. */
  function kidSafeGoalText(v) {
    var t = String(v == null ? "" : v);
    if (!kidScope()) return t.trim();
    t = t.replace(/[$\u00a2\u00a3\u00a5\u20ac\u20b9]\s*\d[\d,.]*\s*k?\b/gi, " ")
         .replace(/\b\d[\d,.]*\s*(?:dollars?|bucks|usd|cents?)\b/gi, " ")
         .replace(/\b(?:dollars?|bucks|usd|cents?|cash|money)\b/gi, " ")
         .replace(/[$\u00a2\u00a3\u00a5\u20ac\u20b9]/g, " ")
         .replace(/\d+(?:[.,]\d+)*%?/g, " ")
         .replace(/[\u2014\u2013\u2192\u2190\u21d2\u27a1]|->|=>/g, " · ")
         .replace(/\(\s*\)|\[\s*\]/g, " ")
         .replace(/(?:\s*[=:+\/]\s*)+(?=\s*(?:·|$))/g, " ")
         .replace(/\s+/g, " ")
         .replace(/(?:\s*·\s*){2,}/g, " · ")
         .replace(/^[\s·:,;=+\/-]+|[\s·:,;=+\/-]+$/g, "");
    return t.trim();
  }
  function renderBank(root, bank) {
    if (!root || !bank) return;
    var goalTitleSafe = kidSafeGoalText(bank.goalTitle), goalBlurbSafe = kidSafeGoalText(bank.goalBlurb);
    var sym = bank.currency.symbol || "★";
    var plural = bank.currency.plural || "stars";
    root.querySelectorAll("[data-bank-today]").forEach(function (el) {
      el.textContent = String(bank.today);
    });
    root.querySelectorAll("[data-bank-life]").forEach(function (el) {
      /* Week star tally drives the jar number */
      el.textContent = String(bank.week != null ? bank.week : bank.lifetime);
    });
    root.querySelectorAll("[data-bank-week]").forEach(function (el) {
      el.textContent = String(bank.week != null ? bank.week : bank.toward);
    });
    root.querySelectorAll("[data-bank-need]").forEach(function (el) {
      el.textContent = String(bank.need);
    });
    root.querySelectorAll("[data-bank-toward]").forEach(function (el) {
      el.textContent = String(bank.toward);
    });
    root.querySelectorAll("[data-bank-pct]").forEach(function (el) {
      el.textContent = bank.pct + "%";
    });
    root.querySelectorAll("[data-bank-fill]").forEach(function (el) {
      el.style.width = bank.pct + "%";
      el.classList.toggle("is-full", bank.reached);
    });
    /* KIDCRIT AINSGOAL1 (Atlas R3) · a goal line with no text is hidden, never an empty label or a placeholder */
    root.querySelectorAll("[data-bank-goal-title]").forEach(function (el) {
      var tt = goalTitleSafe; /* DAYPKG1 v2i · scrubbed on kid scope before the write */
      el.textContent = tt;
      el.hidden = !tt;
    });
    root.querySelectorAll("[data-bank-goal-blurb]").forEach(function (el) {
      var tb = goalBlurbSafe; /* DAYPKG1 v2i · scrubbed on kid scope before the write */
      el.textContent = tb;
      el.hidden = !tb;
    });
    root.querySelectorAll("[data-bank-reward]").forEach(function (el) {
      el.textContent = bank.reward;
    });
    root.querySelectorAll("[data-bank-unit]").forEach(function (el) {
      el.textContent = plural;
    });
    root.querySelectorAll("[data-bank-symbol]").forEach(function (el) {
      el.textContent = sym;
    });
    var dollar = true; // House override 2026-09-27 · show $ deal on kid glass
    var bal = bank.balance != null ? bank.balance : 0;
    var we = bank.weekEarn != null ? bank.weekEarn : bank.toward;
    root.querySelectorAll("[data-bank-balance]").forEach(function (el) {
      el.textContent = String(bal);
    });
    root.querySelectorAll("[data-bank-week-earn]").forEach(function (el) {
      el.textContent = String(we);
    });
    root.querySelectorAll("[data-bank-available]").forEach(function (el) {
      el.textContent = String(bank.available != null ? bank.available : (bal + we));
    });
    root.querySelectorAll("[data-bank-allowance]").forEach(function (el) {
      el.textContent = String(bank.weeklyAllowance != null ? bank.weeklyAllowance : bank.need);
    });
    function bankMetaText() {
      if (dollar) {
        if (bank.mustComplete === false) {
          var g = bank.mustGate || { done: 0, need: 0 };
          return "Musts " + g.done + "/" + g.need + " · jar locked · Balance $" + bal;
        }
        return "Balance $" + bal + " · This week $" + we + " · Jar $" + bank.toward + " / $" + bank.need;
      }
      return "week " + bank.toward + " / " + bank.need + " ★";
    }
    var metaTxt = bankMetaText().replace(/\$\s?\d[\d,]*(?:\.\d+)?(?:\s*\/\s*hr)?/g, "\u2605").replace(/\$/g, ""); /* JARTAP1-DELTA1 · never write '$' into [data-bank-meta] (hidden incl.): same text house-nomoney would leave */
    root.querySelectorAll("[data-bank-meta]").forEach(function (el) {
      el.textContent = metaTxt;
    });
    /* BINDFIX1 · also paint .bank-meta hosts that lack a child span */
    root.querySelectorAll(".bank-meta").forEach(function (el) {
      var span = el.querySelector("[data-bank-meta]");
      if (span) return;
      /* keep Today sibling; only replace leading text node / empty host */
      var first = el.firstChild;
      if (first && first.nodeType === 3) {
        first.textContent = metaTxt + " ";
      } else if (!el.querySelector(".bank-meta-today")) {
        el.textContent = metaTxt;
      }
    });
    var left = Math.max(0, bank.need - bank.toward);
    root.querySelectorAll("[data-bank-left]").forEach(function (el) {
      if (bank.reached) el.textContent = /\/(?:kid-[a-z]+|mercury-run)(\.html)?$/.test(location.pathname || "") ? "Jar full" : ("Jar full · $" + bank.need + " · Balance $" + bal); /* DELTA2 kid guard */
      else if (dollar) el.textContent = /\/(?:kid-[a-z]+|mercury-run)(\.html)?$/.test(location.pathname || "") ? "Jar open" : ("$" + left + " left on jar · Balance $" + bal); /* DELTA2 kid guard */
      else el.textContent = left + " ★ to unlock";
    });
    root.querySelectorAll("[data-payday-chip]").forEach(function (el) {
      var info = nextPaydayInfo();
      el.textContent = "Next payday · " + info.label;
      el.setAttribute("title", info.rule);
    });
    root.querySelectorAll("[data-payday-copy]").forEach(function (el) {
      el.textContent = (bank.kidId === "ainsley")
        ? "Friday drop · payday after honest musts"
        : "Payday after honest musts";
    });
    root.querySelectorAll("[data-bank-goal-blurb]").forEach(function (el) {
      // already set above from goalBlurb; ensure cash blurbs stick (DAYPKG1 v2i · the kid-scope-scrubbed text, never raw)
      if (goalBlurbSafe) el.textContent = goalBlurbSafe;
    });
    root.querySelectorAll("[data-unlock-cta]").forEach(function (el) {
      var full = !!bank.reached && (Number(bank.toward) > 0 || Number(bank.weekEarn) > 0 || Number(bank.available) > 0);
      /* musts incomplete OR zero toward → never jar-full chrome */
      if (!bank.mustComplete || !(Number(bank.toward) > 0 || Number(bank.weekEarn) >= Number(bank.weeklyAllowance || bank.need || 0))) {
        full = false;
      }
      full = full && !!bank.reached;
      el.hidden = !full;
      if (full) {
        el.textContent = /\/(?:kid-[a-z]+|mercury-run)(\.html)?$/.test(location.pathname || "") ? "JAR FULL · show Dad" : "JAR FULL · saved $" + bank.need + " · show Dad"; /* DELTA2 · kid pages: no amount, no star, all 3 kids (Atlas 4:32) */
        el.classList.add("is-loud");
      } else {
        el.textContent = ""; /* never show saved $N at $0 */
        el.classList.remove("is-loud");
      }
    });
    var paid = getPaidStamp(bank.kidId);
    /* DAYPKG1 v2g · Atlas (a): Dad's weekly figure sits next to each kid's Paid hold, the Dad Paid sheet only (URL-only,
       never kid glass). Painted here so every renderBank pass (each paint after a Paid hold or a checkoff sync) rewrites it;
       the sheet-chores '+$N wk' it replaces was wiped by that page's chore row rebuild */
    root.querySelectorAll("[data-dad-wk]").forEach(function (el) {
      var okPage = dadPayPage();
      var wa = bank.weeklyAllowance;
      el.textContent = okPage && typeof wa === "number" && wa > 0 ? "$" + wa + " wk" : "";
      el.hidden = !el.textContent;
    });
    root.querySelectorAll("[data-paid-stamp]").forEach(function (el) {
      if (paid) { el.hidden = false; el.textContent = paid; } /* DAYPKG1 v2d · Atlas 12:15 AM A: every page shows the stored marker, Paid or Jar reset with a tick (no amount, no star, no digit) */
      else { el.hidden = true; }
    });
    /* DAYPKG1 v2h · Atlas: a CTA row whose items are all hidden is hidden too, so the jar card has no empty gap */
    root.querySelectorAll("[data-cta-row]").forEach(function (row) {
      var kids = row.children || [], on = false;
      for (var i = 0; i < kids.length; i++) { if (!kids[i].hidden) on = true; }
      row.hidden = !on;
    });
    if (bank.kidId) renderKidPaidChip(bank.kidId);
    root.querySelectorAll("[data-got-it]").forEach(function (el) {
      var full = !!bank.reached && (Number(bank.toward) > 0 || Number(bank.weekEarn) > 0 || Number(bank.available) > 0);
      if (!bank.mustComplete || !(Number(bank.toward) > 0 || Number(bank.weekEarn) >= Number(bank.weeklyAllowance || bank.need || 0))) {
        full = false;
      }
      full = full && !!bank.reached;
      el.hidden = !full;
    });
    document.body.classList.toggle("bank-goal-hit", !!bank.reached);
    try {
      renderGrow(root, bank.kidId, global.WardKids && global.WardKids._data, bank);
    } catch (eG) { /* */ }
  }


  function growGoalView(kidId, data, bank) {
    /* JARMATH1 · the jar always shows the jar's real target (bankGoal), never a
     * personal save — those live on the Saves line only. */
    var gv = personalGoalView(kidId, data, bank);
    var kid = data && data.kids && data.kids[kidId];
    var bg = (kid && kid.bankGoal) || {};
    var need = typeof bg.dollarNeed === "number" ? bg.dollarNeed : (typeof bg.need === "number" ? bg.need : 0);
    var name = kidSafeGoalText(String(bg.title || "Jar").split("·")[0].trim()) || "Jar"; /* DAYPKG1 v2i · the jar name, aria-label and Saves line are scrubbed on kid scope too (browser observer, v2i) */
    var money = 0;
    if (bank) {
      if (bank.available != null) money = Number(bank.available) || 0;
      else money = (Number(bank.balance) || 0) + (Number(bank.weekEarn) || 0);
    }
    if (need <= 0) {
      return { active: false, placeholder: (gv && gv.placeholder) || "Add a save", name: "", need: 0, toward: 0, met: false, unit: "$" };
    }
    var toward = Math.min(money, need);
    return { active: true, placeholder: "", name: name, need: need, toward: toward, met: toward >= need, unit: "$", fallback: true };
  }

  var GROW_THEME = {
    harris: { cls: "grow-gems", token: "◆", label: "GROW · gems" },
    hayes: { cls: "grow-coins", token: "◎", label: "GROW · victory coins" },
    ainsley: { cls: "grow-jar", token: "★", label: "GROW · jar" }
  };

  function renderGrow(root, kidId, data, bank) {
    if (!root || !bank) return;
    var theme = GROW_THEME[kidId] || GROW_THEME.harris;
    var gv = growGoalView(kidId, data || (global.WardKids && global.WardKids._data), bank);
    var bal = bank.balance != null ? Number(bank.balance) || 0 : 0;
    var we = bank.weekEarn != null ? Number(bank.weekEarn) || 0 : 0;
    var available = bank.available != null ? Number(bank.available) || 0 : (bal + we);
    var need = gv.active ? gv.need : 0;
    var toward = gv.active ? gv.toward : Math.min(available, need || available);
    var pct = need > 0 ? Math.max(0, Math.min(100, Math.round((toward / need) * 100))) : 0;

    root.querySelectorAll("[data-grow-meter]").forEach(function (meter) {
      meter.classList.remove("grow-gems", "grow-coins", "grow-jar");
      meter.classList.add("grow-meter", theme.cls);
      meter.setAttribute("data-kid", kidId);
      meter.setAttribute("aria-label", theme.label + (gv.active ? (" · " + gv.name) : ""));
      if (!meter._growWired) {
        meter._growWired = true;
        meter.addEventListener("click", function () {
          /* HouseSfx.wireGrowFx owns pointerdown poke — click = a11y fallback only */
          if (window.HouseSfx && HouseSfx.jarPoke) return;
          meter.classList.remove("is-animating", "is-poking");
          void meter.offsetWidth;
          meter.classList.add("is-animating", "is-poking");
          setTimeout(function () { meter.classList.remove("is-animating", "is-poking"); }, 750);
        });
      }
      if (window.HouseSfx && HouseSfx.wireGrowFx) HouseSfx.wireGrowFx();
    });

    var balPct = need > 0 ? Math.max(0, Math.min(100, (bal / need) * 100)) : 0;
    var weekPct = need > 0 ? Math.max(0, Math.min(100 - balPct, (we / need) * 100)) : 0;
    var jarHit = !!(gv.active && gv.met && bank.mustComplete !== false && (toward > 0));
    root.querySelectorAll("[data-grow-fill]").forEach(function (el) {
      el.style.height = pct + "%";
      el.classList.toggle("is-full", jarHit);
    });
    root.querySelectorAll("[data-grow-fill-balance]").forEach(function (el) {
      el.style.height = balPct + "%";
      el.style.bottom = "0%";
    });
    root.querySelectorAll("[data-grow-fill-week]").forEach(function (el) {
      el.style.height = weekPct + "%";
      el.style.bottom = balPct + "%";
    });
    root.querySelectorAll("[data-grow-pct]").forEach(function (el) {
      el.textContent = pct + "%";
    });
    root.querySelectorAll("[data-grow-title]").forEach(function (el) {
      el.textContent = theme.label;
    });
    root.querySelectorAll("[data-grow-jar-name]").forEach(function (el) {
      el.textContent = gv.active ? (gv.fallback ? gv.name : gv.name) : (theme.label.split("·")[0].trim() || "Jar");
      if (gv.active && !gv.fallback) {
        /* keep jar brand from theme when personal save is active — show save in Save for line */
        var brands = { harris: "Gem Jar", hayes: "Victory Jar", ainsley: "Tour Jar" };
        el.textContent = brands[kidId] || gv.name;
      } else if (gv.active) {
        el.textContent = gv.name;
      }
    });
    root.querySelectorAll("[data-grow-total]").forEach(function (el) {
      /* HTML already prints $ before the span inside .grow-total */
      el.textContent = /\/kid-ainsley(\.html)?$/.test(location.pathname || "") ? "" : ((el.closest && el.closest(".grow-total")) || /\/(?:kid-[a-z]+|mercury-run)(\.html)?$/.test(location.pathname || "")) ? String(toward) : ("$" + toward); /* DELTA2 kid guard */
    });
    root.querySelectorAll("[data-grow-week-rising]").forEach(function (el) {
      el.textContent = /\/(?:kid-[a-z]+|mercury-run)(\.html)?$/.test(location.pathname || "") ? "" : ("week +$" + we + " rising ↑"); /* DAYPKG1 kid guard: no money sign, no arrow */
    });
    root.querySelectorAll("[data-grow-goal-lab]").forEach(function (el) {
      el.textContent = need > 0 ? ("GOAL " + need) : "GOAL";
    });
    root.querySelectorAll("[data-grow-balance]").forEach(function (el) {
      el.textContent = /\/(?:kid-[a-z]+|mercury-run)(\.html)?$/.test(location.pathname || "") ? (/\/kid-ainsley(\.html)?$/.test(location.pathname || "") ? "" : "\u2605") : ("$" + bal); /* DELTA2 kid guard */
    });
    root.querySelectorAll("[data-grow-week]").forEach(function (el) {
      el.textContent = /\/(?:kid-[a-z]+|mercury-run)(\.html)?$/.test(location.pathname || "") ? (/\/kid-ainsley(\.html)?$/.test(location.pathname || "") ? "" : "\u2605") : ("$" + we); /* DELTA2 kid guard */
    });
    root.querySelectorAll("[data-grow-save-name]").forEach(function (el) {
      el.textContent = gv.active ? gv.name : (gv.placeholder || "Add a save");
    });
    root.querySelectorAll("[data-grow-save-toward]").forEach(function (el) {
      el.textContent = String(gv.active ? toward : 0);
    });
    root.querySelectorAll("[data-grow-save-need]").forEach(function (el) {
      var n = gv.active ? need : 0;
      /* HTML already prints $ before both spans inside .grow-total — bare digits only */
      el.textContent = String(n);
    });
    root.querySelectorAll("[data-grow-save-line]").forEach(function (el) {
      if (!gv.active) el.textContent = gv.placeholder || "Add a save";
      else el.textContent = /\/(?:kid-[a-z]+|mercury-run)(\.html)?$/.test(location.pathname || "") ? gv.name : (gv.name + " · $" + toward + "/$" + need); /* DAYPKG1 kid guard */
    });

    /* Stack tokens scale with fill (max 8) */
    var n = need > 0 ? Math.max(0, Math.min(8, Math.ceil((pct / 100) * 8))) : 0;
    root.querySelectorAll("[data-grow-icons]").forEach(function (box) {
      var html = "";
      for (var i = 0; i < n; i++) {
        html += '<span class="grow-token" style="animation-delay:' + (i * 0.04) + 's">' + theme.token + "</span>";
      }
      box.innerHTML = html;
    });
  }

  function renderPersonalGoal(root, kidId, data, bank) {
    if (!root) return;
    var gv = personalGoalView(kidId, data, bank);
    root.querySelectorAll("[data-goal-chip]").forEach(function (el) {
      el.classList.remove("is-met", "is-active", "is-empty");
      if (!gv.active) {
        el.textContent = gv.placeholder;
        el.classList.add("is-empty");
      } else if (gv.met) {
        el.textContent = /\/(?:kid-[a-z]+|mercury-run)(\.html)?$/.test(location.pathname || "") ? ("Goal met · " + gv.name + " · show Dad") : ("Tell Dad — goal met · " + gv.name + " ($" + gv.need + ")"); /* DAYPKG1 kid guard: no money sign, no dash */
        el.classList.add("is-met", "is-active");
      } else {
        el.textContent = /\/(?:kid-[a-z]+|mercury-run)(\.html)?$/.test(location.pathname || "") ? gv.name : (gv.name + " · $" + gv.toward + "/$" + gv.need); /* DAYPKG1 kid guard */
        el.classList.add("is-active");
      }
    });
    try { renderGrow(root, kidId, data, bank || getBankView(kidId, data)); } catch (ePG) { /* */ }
  }

  function renderHarborStrips(kidId, data) {
    var kid = data.kids[kidId];
    if (!kid) return;
    var ns = document.querySelector("[data-mount-no-surprise]");
    if (ns) {
      var items = buildNoSurprise(kid, data);
      ns.innerHTML = items.length
        ? items.map(cardHTML).join("")
        : quietHTML(kidId === "ainsley" ? "side quiet · drop the needle on musts" : "quiet board · check musts");
    }
    var rides = document.querySelector("[data-mount-rides]");
    if (rides) {
      var list = kid.rides || [];
      rides.innerHTML = list.length
        ? list.map(function (r) {
            var tone = r.clear ? "fun" : "act";
            return cardHTML({ when: r.when || (r.clear ? "you're clear" : "check timing"), what: r.what, hint: r.hours || (r.clear ? "your move · no conflict flagged" : "ask Dad"), tone: tone });
          }).join("")
        : quietHTML("rides land here when set");
    }
    var bag = document.querySelector("[data-bag-strip]");
    if (bag && kid.bag) {
      bag.hidden = false;
      var lab = bag.querySelector("[data-bag-label]");
      var hint = bag.querySelector("[data-bag-hint]");
      if (lab) lab.textContent = kid.bag.label || ("This week @ " + (kid.bag.place || "Dad") + " · bag");
      if (hint) hint.textContent = kid.bag.hint || "";
    } else if (bag) {
      bag.hidden = false;
      var lab2 = bag.querySelector("[data-bag-label]");
      if (lab2) lab2.textContent = "Bag list";
    }
    var her = document.querySelector("[data-mount-her-space]");
    if (her) {
      var space = [];
      (kid.appointments || []).forEach(function (a) {
        if (a.herSpace || /vanity|jessy|room/i.test((a.what || "") + (a.hint || ""))) {
          space.push({ when: a.when, what: a.what, hint: a.hint || "your space", tone: a.tone || "hot" });
        }
      });
      // room reset quest as light status if present
      (kid.quests || []).forEach(function (q) {
        if (q.id === "ain-toys" || /room reset/i.test(q.what || "")) {
          var done = getCheck(q.id);
          space.push({ when: "Room", what: done ? "Room reset · clear" : "Room reset · still open", hint: "your space · your pace", tone: done ? "fun" : "act" });
        }
      });
      her.innerHTML = space.length ? space.map(cardHTML).join("") : quietHTML(kidId === "ainsley" ? "her space · needle up" : "your space · quiet");
    }
  }



  /* GRAPHICS2 · forged SVG marks (sprite must be inlined on kid boards) */
  function g2Ico(sym) {
    return '<svg class="g2" viewBox="0 0 32 32" aria-hidden="true"><use href="#' + sym + '"/></svg>';
  }
  /* CONSUME1 · schedule consume layout (week strip · NEXT UP · HQ · routine · ahead) */
  var CONSUME_DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var CONSUME_META = {
    hayes: { world: "Victory world", loadout: "Victory loadout", markSym: "g2-hayes", hqTitle: "DROP ZONE HQ", hqSym: "g2-home" },
    harris: { world: "Gem world", loadout: "Gem loadout", markSym: "g2-harris", hqTitle: "YOUR BASE", hqSym: "g2-home" },
    ainsley: { world: "Ainsley", loadout: "Musts", markSym: "g2-ainsley", hqTitle: "Home base", hqSym: "g2-home" }
  };

  /* SPECIALS-COLOR1 2026-10-15 (Dan: "fix the schedule"). school specials follow the
     4-day COLOR rotation (Orange → Yellow → Green → Red, school days only), NOT the weekday.
     Sourced: Allen letters 9/25, 10/4, 10/9 + Lind letters 9/25, 10/12, matched to the
     school newsletter color days (10/12 Orange … 10/15 Red). Library checkout is a
     fixed WEEKDAY: Hayes Wed, Harris Thu. Color comes only from a "<school> <Color> Day" row in
     the feed — no color row, no special (never guessed from the weekday). Live calendar
     specials always win over this table. */
  var SCHOOL_SPECIALS = {
    hayes: { source: "Ms. Allen letters · school color day", Orange: "Music", Yellow: "PE · tennis shoes", Green: "Art", Red: "Spanish", libraryDow: "Wed" },
    harris: { source: "Ms. Lind letters · school color day", Orange: "PE · tennis shoes", Yellow: "Art", Green: "Spanish", Red: "Music", libraryDow: "Thu" }
  };

  function schoolColorForIso(rows, iso) {
    if (!rows || !iso) return null;
    var dow = CONSUME_DOW[dowIndexFromIso(iso)];
    var dn = String(Number(String(iso).split("-")[2]));
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i] || {};
      var m = SCHRX(String.raw`§ (Orange|Yellow|Green|Red) Day`, "i").exec(String(r.what || ""));
      if (!m) continue;
      var w = String(r.when || "");
      var hit = new RegExp("^" + dow + "\\s+" + dn + "\\b").test(w) || (iso === DAY_ISO && new RegExp("^(" + dow + "|Today)\\s*·").test(w));
      if (hit) return m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase();
    }
    return null;
  }

  function specialForIso(kidId, iso, rows) {
    var map = SCHOOL_SPECIALS[kidId];
    if (!map || !iso) return null;
    /* LIVELAW1 · colour rows never print, but they still pick the quiet specials rotation */
    var lk = global.WardKids && WardKids._data && WardKids._data.kids && WardKids._data.kids[kidId];
    if (lk && lk._lawColorRows && lk._lawColorRows.length) rows = (rows || []).concat(lk._lawColorRows);
    var dow = CONSUME_DOW[dowIndexFromIso(iso)];
    var color = schoolColorForIso(rows, iso);
    if (!dow || !color || !map[color]) return null;
    var what = map[color] + (map.libraryDow === dow ? " + Library checkout (library book)" : "");
    return {
      when: dow + " · Special",
      what: "Special · " + what,
      hint: map.source || "",
      tone: "act",
      kind: "special"
    };
  }

  function kidsSafeGlass(s) {
    var t = String(s == null ? "" : s);
    t = t.replace(/\s*\bcustody\b\s*/gi, " ").replace(/\s{2,}/g, " ").trim(); /* NOCUSTODY1 · the word is removed, nothing put in its place */ /* custody-law:allow */
    if (typeof window !== "undefined" && window.AwayFilter) t = window.AwayFilter.glass(t); /* AWAYLAW1 */
    return faceDash(t);
  }

  function addDaysIsoLocal(iso, days) {
    var parts = String(iso || "").split("-");
    if (parts.length !== 3) return "";
    var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0);
    d.setDate(d.getDate() + days);
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }

  function mondayOfIso(iso) {
    var parts = String(iso || DAY_ISO).split("-");
    if (parts.length !== 3) return DAY_ISO;
    var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0);
    var toMon = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - toMon);
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }

  function consumeIsRoutine(item) {
    /* SCHOOLKEY2 · rows the generator tagged as the school run count as school with or without the private names */
    if (item && /^school_(drop|pickup)$/.test(String(item.kind || ""))) return true;
    var what = String((item && item.what) || "");
    var when = String((item && item.when) || "");
    var blob = what + " " + when;
    if (/Hearing\s*\/?\s*Vision|field\s*trip|PE\b|collab|Homework Help|yearbook|appointment|swim|flag|baseball|game|practice/i.test(what)) {
      if (!SCHRX(String.raw`§\s*(drop|pickup|drop-off)`, "i").test(what)) return false;
    }
    if (SCHRX(String.raw`§\s*(drop-?off|drop|pickup)`, "i").test(what)) return true;
    if (SCHRX(String.raw`^(Boys\s+)?§\s+(drop|pickup)`, "i").test(what)) return true;
    if (/\bdrop-?off\b/i.test(what) && SCHRX(String.raw`§|Boys`, "i").test(blob)) return true;
    if (/\bpickup\b/i.test(what) && SCHRX(String.raw`§|Boys`, "i").test(blob)) return true;
    return false;
  }

  function consumeIsHq(item) {
    if (!item) return false;
    if (item.kind === "note") return true;
    var what = String(item.what || "");
    return /DROP ZONE HQ|YOUR BASE|Base @|with Dad|Dad week|base at home\b/i.test(what) && /All day|home|HQ|BASE|Dad/i.test((item.when || "") + " " + what); /* custody-law:allow (matcher that hides these rows) */
  }

  function consumeParseWhen(when) {
    var s = String(when || "").trim();
    var out = { dow: "", dayNum: "", time: "", leave: false, allDay: /\bAll day\b/i.test(s), raw: s }; /* ALLDAY1 */
    var m = s.match(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b(?:\s+(\d{1,2}))?/i);
    if (m) {
      out.dow = m[1].slice(0, 1).toUpperCase() + m[1].slice(1, 3).toLowerCase();
      if (m[2]) out.dayNum = String(Number(m[2]));
    }
    var t = out.allDay ? null : s.match(/(?:leave\s*)?(\d{1,2}:\d{2})\s*(am|pm)?/i);
    if (t) {
      out.time = t[1];
      out.leave = /leave/i.test(s);
      if (t[2]) out.time += t[2].toLowerCase();
    }
    return out;
  }

  /* AUDIT1 · "4:55" / "7:00am" → minutes after midnight CT (kid-schedule hours 1–6 read as pm) */
  function consumeTimeMin(t) {
    var m = /^(\d{1,2}):(\d{2})\s*(am|pm)?/i.exec(String(t || ""));
    if (!m) return null;
    var h = +m[1] % 12;
    if (m[3]) { if (/pm/i.test(m[3])) h += 12; }
    else if (+m[1] === 12 || +m[1] <= 6) h += 12;
    return h * 60 + (+m[2]);
  }
  function consumeNowCtMin() {
    try {
      var p = {};
      new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "numeric", minute: "2-digit", hourCycle: "h23" })
        .formatToParts(new Date()).forEach(function (x) { p[x.type] = x.value; });
      return (+p.hour % 24) * 60 + (+p.minute);
    } catch (e) { var d = new Date(); return d.getHours() * 60 + d.getMinutes(); }
  }

  function consumeIsoForParsed(parsed, weekIsos) {
    if (!parsed) return "";
    if (parsed.dayNum) {
      for (var i = 0; i < weekIsos.length; i++) {
        var dn = String(Number(weekIsos[i].split("-")[2]));
        if (dn === parsed.dayNum) return weekIsos[i];
      }
    }
    if (parsed.dow) {
      for (var j = 0; j < weekIsos.length; j++) {
        if (CONSUME_DOW[dowIndexFromIso(weekIsos[j])] === parsed.dow) return weekIsos[j];
      }
    }
    return "";
  }

  function consumeCollectEvents(kid) {
    var list = [];
    function push(arr, bucket) {
      (arr || []).forEach(function (it) {
        if (!it || !it.what) return;
        list.push({
          when: it.when || "",
          what: kidsSafeGlass(it.what),
          hint: kidsSafeGlass(it.hint || ""),
          tone: it.tone || "act",
          kind: it.kind || bucket,
          bucket: bucket
        });
      });
    }
    push(kid.today, "today");
    push(kid.sports, "sports");
    push(kid.school, "school");
    push(kid.appointments, "appointments");
    /* Daily SPECIAL into school strip · sourced rotation only */
    var kidId = kid && kid.id;
    /* LIVESPEC1 · live calendar specials win; the hardcoded table is only a fallback when the feed has none */
    var liveSpecial = list.some(function (x) { return /special/i.test(String(x.what || "") + " " + String(x.when || "") + " " + String(x.hint || "")); });
    if (kidId && SCHOOL_SPECIALS[kidId] && !liveSpecial) {
      var weekStart = mondayOfIso(DAY_ISO);
      for (var si = 0; si < 7; si++) {
        var iso = addDaysIsoLocal(weekStart, si);
        var sp = specialForIso(kidId, iso, list);
        if (!sp) continue;
        /* Stamp day num so consumeParseWhen buckets correctly */
        var dow = CONSUME_DOW[dowIndexFromIso(iso)];
        var dn = String(Number(String(iso).split("-")[2]));
        list.push({
          when: dow + " " + dn + " · Special",
          what: kidsSafeGlass(sp.what),
          hint: kidsSafeGlass(sp.hint || ""),
          tone: "act",
          kind: "special",
          bucket: "school"
        });
      }
    }
    return list;
  }

  function consumeEventIcon(what) {
    var w = String(what || "").toLowerCase();
    if (/baseball|ball/.test(w)) return { html: '<span class="g2-lead">' + g2Ico("g2-baseball") + "</span>", text: "" };
    if (/flag/.test(w)) return { html: '<span class="g2-lead">' + g2Ico("g2-flag") + "</span>", text: "" };
    if (/swim/.test(w)) return { html: '<span class="g2-lead">' + g2Ico("g2-swim") + "</span>", text: "" };
    if (/hearing|vision|screening/.test(w)) return { html: "", text: "👁️" };
    if (/field\s*trip|museum/.test(w)) return { html: "", text: "🚌" };
    if (/special|\bart\b|spanish|music/.test(w)) return { html: "", text: "🎨" };
    if (/\bpe\b|tennis/.test(w)) return { html: "", text: "👟" };
    if (/collab|madi|provider/.test(w)) return { html: "", text: "👥" };
    if (/doctor|clinic|therap|appt/.test(w)) return { html: "", text: "🩺" };
    if (SCHRX(String.raw`homework|yearbook|school|lkms|§`, "i").test(w)) return { html: "", text: "📚" };
    return { html: '<span class="g2-lead">' + g2Ico("g2-next") + "</span>", text: "" };
  }

  function consumeStripKidName(what, kid) {
    var w = String(what || "");
    if (!kid) return w;
    var re = new RegExp("^" + kid.name + "\\s*[—\\-·]\\s*", "i");
    w = w.replace(re, "");
    re = new RegExp("^" + kid.name + "\\s+", "i");
    /* keep sports titles like "Hayes baseball" */
    if (/baseball|flag|swim/i.test(w)) return w;
    return w.replace(re, "");
  }

  function consumeQueueForKid(data, kidId) {
    var kid = data.kids[kidId];
    var q = (data.boardStrip && data.boardStrip.queue) || [];
    var name = (kid && kid.name) || kidId;
    var out = [];
    for (var i = 0; i < q.length; i++) {
      var item = q[i];
      var blob = ((item.summary || "") + " " + (item.place || "")).toLowerCase();
      var mine = false;
      if (kidId === "hayes") mine = /hayes/.test(blob) || (SCHRX(String.raw`boys|§`, "i").test(blob) && !/ainsley|harris flag|harris —/.test(blob));
      else if (kidId === "harris") mine = /harris/.test(blob) || (SCHRX(String.raw`boys|§`, "i").test(blob) && !/ainsley|hayes baseball|hayes flag|hayes —|madi/.test(blob));
      else if (kidId === "ainsley") mine = /ainsley/.test(blob);
      /* shared boys school counts for both */
      if ((kidId === "hayes" || kidId === "harris") && SCHRX(String.raw`hayes \+ harris|boys §|§ (drop|pickup|hearing)`, "i").test(blob)) mine = true;
      /* SCHOOLKEY2 · a generator-tagged school run is the boys' (or the named boy's) with or without the private names */
      if ((kidId === "hayes" || kidId === "harris") && /^school_(drop|pickup)$/.test(String(item.kind || "")) && (blob.indexOf(kidId) >= 0 || !/\bhayes\b|\bharris\b/.test(blob))) mine = true;
      if (kidId === "hayes" && /madi|provider collab/i.test(blob)) mine = true;
      if (!mine && kidId === "ainsley" && /appointment/i.test(blob)) mine = true;
      if (!mine) continue;
      /* QARELAY1 · RIDES law: Dad logistics (kind leave/ride, "Pick up …"/"Drop …") never kid NEXT UP */
      if (item.kind === "leave" || item.kind === "ride") continue;
      if (/^(Pick\s*-?\s*up|Drop)\b/i.test(String(item.summary || item.place || "").trim())) continue;
      out.push(item);
    }
    return out;
  }

  function consumePickNext(data, kidId, kid) {
    var now = Date.now();
    var queue = consumeQueueForKid(data, kidId);
    for (var i = 0; i < queue.length; i++) {
      var it = queue[i];
      var end = Date.parse(it.endIso || "") || 0;
      var start = Date.parse(it.startIso || "") || 0;
      if (end && end < now) continue;
      if (!end && start && start + 90 * 60 * 1000 < now) continue;
      if (consumeIsRoutine({ what: it.place || it.summary || "", kind: it.kind }) && queue.length > 1) {
        /* Prefer unique over routine when another future unique exists */
        var hasUniqueLater = false;
        for (var j = i; j < queue.length; j++) {
          var jt = queue[j];
          var js = Date.parse(jt.startIso || "") || 0;
          var je = Date.parse(jt.endIso || "") || 0;
          if (je && je < now) continue;
          if (!je && js && js + 90 * 60 * 1000 < now) continue;
          if (!consumeIsRoutine({ what: jt.place || jt.summary || "", kind: jt.kind })) { hasUniqueLater = true; break; }
        }
        if (hasUniqueLater && start && start > now + 45 * 60 * 1000) continue;
      }
      return {
        whenLabel: (it.badge ? String(it.badge).toUpperCase() : "") + (it.time ? (" · " + it.time) : ""),
        time: it.time || "",
        badge: it.badge || "",
        title: kidsSafeGlass(it.place || shortConsumeTitle(it.summary) || "Next up"),
        summary: kidsSafeGlass(it.summary || ""),
        startIso: it.startIso || "",
        endIso: it.endIso || "",
        kind: it.kind || "",
        source: "queue"
      };
    }
    /* Fallback: kid hottest / first unique timed event */
    var events = consumeCollectEvents(kid).filter(function (e) {
      return !consumeIsHq(e) && !consumeIsRoutine(e);
    });
    if (events.length) {
      var e0 = events[0];
      var p = consumeParseWhen(e0.when);
      return {
        whenLabel: ((p.dow || "").toUpperCase() + (p.time ? (" · " + p.time) : p.allDay ? " · All day" : "")).replace(/^\s·\s/, ""), /* ALLDAY1 */
        time: p.time || "",
        badge: p.dow || "",
        title: e0.what,
        summary: e0.hint || "",
        startIso: "",
        endIso: "",
        kind: e0.bucket,
        source: "kid"
      };
    }
    if (kid.hottest) {
      return {
        whenLabel: String(kid.hottest.when || ""),
        time: "",
        badge: "",
        title: kidsSafeGlass(kid.hottest.what || "Next up"),
        summary: kidsSafeGlass(kid.hottest.where || ""),
        startIso: "",
        endIso: "",
        kind: "hot",
        source: "hottest"
      };
    }
    return null;
  }

  function shortConsumeTitle(summary) {
    var s = String(summary || "");
    s = s.replace(/\s·\s.*$/, "").trim();
    return s;
  }

  function consumeCountdown(next) {
    if (!next) return "";
    var start = Date.parse(next.startIso || "") || 0;
    if (!start) {
      if (/today/i.test(next.source || "") || (next.badge && /mon|tue|wed|thu|fri|sat|sun/i.test(next.badge))) {
        return "ON DECK";
      }
      return "NEXT";
    }
    var mins = Math.round((start - Date.now()) / 60000);
    if (mins <= 5) return "LEAVE · NOW";
    if (mins <= 45) return "LEAVE · " + mins + "m";
    if (mins <= 120) return "LEAVE · " + Math.round(mins / 5) * 5 + "m";
    try {
      var p = {};
      new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Chicago",
        weekday: "short", hour: "numeric", minute: "2-digit", hour12: true
      }).formatToParts(new Date(start)).forEach(function (x) {
        if (x.type !== "literal") p[x.type] = x.value;
      });
      return (p.weekday || "").toUpperCase().slice(0, 3) + " · " + (p.hour || "") + ":" + (p.minute || "");
    } catch (e) {
      return "UPCOMING";
    }
  }

  function consumeThruChip(through) {
    var t = String(through || "");
    var m = t.match(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/i);
    if (m) return "THRU " + m[1].toUpperCase().slice(0, 3);
    return "THIS WEEK";
  }

  /* DAYPICK1 · plain list of one day's items for the My Week drawer */
  function consumeEventsForIso(kidId, data, iso) {
    var kid = data && data.kids && data.kids[kidId];
    if (!kid || !iso) return [];
    var ws = mondayOfIso(iso), wk = [];
    for (var i = 0; i < 7; i++) wk.push(addDaysIsoLocal(ws, i));
    var seen = {}, out = [];
    consumeCollectEvents(kid).forEach(function (e) {
      if (consumeIsHq(e)) return;
      var p = consumeParseWhen(e.when);
      var d = consumeIsoForParsed(p, wk);
      if (!d && !p.dayNum && !p.dow && e.bucket === "today") d = DAY_ISO;
      if (d !== iso) return;
      var key = String(e.what).toLowerCase().replace(/\s+/g, " ");
      if (seen[key]) return;
      seen[key] = 1;
      out.push({ time: p.allDay ? "All day" : (p.time || ""), what: e.what, min: consumeTimeMin(p.time) });
    });
    out.sort(function (a, b) { return (a.min == null ? -1 : a.min) - (b.min == null ? -1 : b.min); });
    return out;
  }

  function renderConsumeSchedule(kidId, data) {
    var root = document.querySelector(".sec-schedule.consume-sched");
    if (!root || !data || !data.kids || !data.kids[kidId]) return;
    var kid = data.kids[kidId];
    var meta = CONSUME_META[kidId] || CONSUME_META.hayes;
    var weekStart = mondayOfIso(DAY_ISO);
    var weekIsos = [];
    for (var i = 0; i < 7; i++) weekIsos.push(addDaysIsoLocal(weekStart, i));

    var selected = root.getAttribute("data-consume-sel") || DAY_ISO;
    if (weekIsos.indexOf(selected) < 0) selected = DAY_ISO;

    var all = consumeCollectEvents(kid);
    var unique = all.filter(function (e) { return !consumeIsRoutine(e) && !consumeIsHq(e); });

    /* Dedupe by what+day */
    var seen = {};
    unique = unique.filter(function (e) {
      var p = consumeParseWhen(e.when);
      var iso = consumeIsoForParsed(p, weekIsos) || e.when + "|" + e.what;
      var key = iso + "::" + String(e.what).toLowerCase().replace(/\s+/g, " ");
      if (seen[key]) return false;
      seen[key] = 1;
      return true;
    });

    var byIso = {};
    weekIsos.forEach(function (iso) { byIso[iso] = []; });
    unique.forEach(function (e) {
      var p = consumeParseWhen(e.when);
      var iso = consumeIsoForParsed(p, weekIsos);
      if (iso && byIso[iso]) byIso[iso].push({ e: e, p: p });
      else if (!p.dayNum && !p.dow && e.bucket === "today") {
        if (byIso[DAY_ISO]) byIso[DAY_ISO].push({ e: e, p: p });
      }
    });

    /* Header */
    var hdr = root.querySelector("[data-mount-consume-hdr]");
    if (hdr) {
      hdr.innerHTML =
        '<div class="consume-mark g2-mark">' + g2Ico(meta.markSym || "g2-next") + "</div>" +
        '<div class="consume-hdr-text">' +
        '<div class="consume-title">' + esc(kid.name) + " · Schedule</div>" +
        '<div class="consume-sub">Loadout · ' + esc(meta.world) + "</div>" +
        "</div>";
    }

    /* Week strip */
    var weekEl = root.querySelector("[data-mount-consume-week]");
    if (weekEl) {
      var wh = "";
      weekIsos.forEach(function (iso) {
        var dow = CONSUME_DOW[dowIndexFromIso(iso)];
        var dn = kidId === "ainsley" ? "" : String(Number(iso.split("-")[2]));   /* LIVEFIX3 · her week strip: letters only */
        var bits = byIso[iso] || [];
        var sel = iso === selected ? " sel" : "";
        var dots = "";
        if (bits.length >= 2) dots = '<span class="consume-dot"></span><span class="consume-dot cyan"></span>';
        else if (bits.length === 1) dots = '<span class="consume-dot cyan"></span>';
        else dots = '<span class="consume-dot muted"></span>';
        wh += '<button type="button" class="consume-day' + sel + '" data-consume-day="' + esc(iso) + '" aria-pressed="' + (iso === selected ? "true" : "false") + '">' +
          '<span class="wd">' + dow + "</span>" +
          '<span class="dn">' + dn + "</span>" +
          '<div class="dots">' + dots + "</div></button>";
      });
      weekEl.innerHTML = wh;
      if (!weekEl._consumeWired) {
        weekEl._consumeWired = true;
        weekEl.addEventListener("click", function (ev) {
          var btn = ev.target.closest("[data-consume-day]");
          if (!btn) return;
          root.setAttribute("data-consume-sel", btn.getAttribute("data-consume-day"));
          renderConsumeSchedule(kidId, data);
        });
      }
    }

    /* NEXT UP */
    var next = consumePickNext(data, kidId, kid);
    var nextMount = root.querySelector("[data-mount-consume-next]");
    if (nextMount) {
      if (!next) {
        nextMount.className = "consume-hero empty";
        nextMount.innerHTML = '<div class="consume-hero-inner"><div class="consume-hero-title">Nothing timed next</div><div class="consume-hero-meta">Quests still on</div></div>';
      } else {
        var cd = consumeCountdown(next);
        var title = consumeStripKidName(next.title, kid);
        var ico = consumeEventIcon(title);
        nextMount.className = "consume-hero";
        nextMount.innerHTML =
          '<div class="consume-hero-inner">' +
          '<div class="consume-hero-top">' +
          '<div class="consume-hero-when">' + esc(next.whenLabel || "NEXT") + "</div>" +
          '<div class="consume-countdown"><span class="pulse"></span><span>' + esc(cd) + "</span></div>" +
          "</div>" +
          '<div class="consume-hero-title">' + (ico.html || "") + esc(((ico.text ? ico.text + " " : "") + title)) + "</div>" +
          '<div class="consume-hero-meta">YOUR board · <b>' + esc(meta.loadout) + "</b></div>" +
          "</div>";
      }
    }

    /* Today label + HQ punch */
    var selDow = CONSUME_DOW[dowIndexFromIso(selected)];
    var selDn = String(Number(selected.split("-")[2]));
    var todayLab = root.querySelector("[data-mount-consume-today-label]");
    if (todayLab) {
      var labDn = kidId === "ainsley" ? "" : " " + selDn;   /* LIVEFIX3 · weekday words only on her board */
      var lab = selected === DAY_ISO ? ("Today · " + selDow + labDn) : (selDow + labDn);
      todayLab.innerHTML = '<span class="tag">' + esc(lab) + '</span><span class="line"></span>';
    }

    var punch = root.querySelector("[data-mount-consume-punch]");
    if (punch) {
      var hw = data.homeWeek || {};
      var through = kidsSafeGlass(hw.through || hw.throughLabel || "this week");
      var place = hw.place ? (" @ " + hw.place) : "";
      var sub = "Multi-day · " + through + (hw.with ? "" : "");
      if (hw.with && hw.place) sub = "Multi-day · through " + through;
      punch.innerHTML =
        '<div class="consume-punch-card">' +
        '<div class="consume-punch-ico g2-mark">' + g2Ico(meta.hqSym || "g2-home") + "</div>" +
        '<div class="consume-punch-body">' +
        '<div class="consume-punch-title">' + esc(meta.hqTitle) + "</div>" +
        (kidId === "ainsley" ? "" : '<div class="consume-punch-sub">' + esc(kidsSafeGlass(sub)) + "</div>") +   /* LIVEFIX3 · no away-window end on her board */
        "</div>" +
        (kidId === "ainsley" ? "" : '<div class="consume-punch-chip">' + esc(consumeThruChip(through)) + "</div>") +
        "</div>";
    }

    /* Routine rail */
    var routine = root.querySelector("[data-mount-consume-routine]");
    if (routine) {
      var lb = data.leaveBys || {};
      /* SCHOOLNAMES1 + SCHOOLKEY2 · leave-by keys end in "_drop" / "_pickup" (generator default school_drop / school_pickup); read them by suffix */
      var lbPick = function (suf) { for (var k in lb) if (Object.prototype.hasOwnProperty.call(lb, k) && /^[A-Za-z]{2,8}_/.test(k) && k.slice(-suf.length - 1) === "_" + suf) return lb[k]; return ""; };
      var drop = String(lbPick("drop") || "leave 8:10 for 8:25");
      var pick = String(lbPick("pickup") || "leave 3:15 for 3:40");
      var dropT = (drop.match(/(\d{1,2}:\d{2})/) || [])[1] || "8:10";
      var pickT = (pick.match(/(\d{1,2}:\d{2})/) || [])[1] || "3:15";
      if (kidId === "ainsley") {
        var swimDays = unique.filter(function (e) { return /swim/i.test(e.what); });
        if (swimDays.length >= 2) {
          routine.hidden = false;
          routine.innerHTML =
            '<span class="consume-routine-ico g2-inline">' + g2Ico("g2-routine") + "</span>" +
            '<div class="consume-routine-txt"><b>Swim</b> · leave 4:25 · Coach Ann</div>' +
            '<span class="consume-routine-badge">Tue/Thu</span>';
        } else if (swimDays.length === 1) {
          routine.hidden = true;
          routine.innerHTML = "";
        } else {
          routine.hidden = true;
          routine.innerHTML = "";
        }
      } else {
        var hasSchoolRun = all.some(consumeIsRoutine);
        if (hasSchoolRun) {
          routine.hidden = false;
          routine.innerHTML =
            '<span class="consume-routine-ico g2-inline">' + g2Ico("g2-routine") + "</span>" +
            '<div class="consume-routine-txt"><b>' + esc(((typeof globalThis !== "undefined" ? globalThis : window).SchoolNames || { label: function () { return "School"; } }).label("School")) + '</b> · drop ' + esc(dropT) + " · pickup " + esc(pickT) + "</div>" +
            '<span class="consume-routine-badge">Tue-Fri</span>';
        } else {
          routine.hidden = true;
          routine.innerHTML = "";
        }
      }
    }

    /* Ahead · unique (not next, not routine, preferably after selected/today) */
    var ahead = root.querySelector("[data-mount-consume-ahead]");
    if (ahead) {
      var nextKey = next ? String(next.title || "").toLowerCase().replace(/\s+/g, " ") : "";
      var rows = [];
      weekIsos.forEach(function (iso) {
        if (iso < selected) return;
        (byIso[iso] || []).forEach(function (pack) {
          var e = pack.e;
          var p = pack.p;
          var titleKey = String(e.what || "").toLowerCase().replace(/\s+/g, " ");
          if (nextKey && (titleKey.indexOf(nextKey.slice(0, 18)) >= 0 || nextKey.indexOf(titleKey.slice(0, 18)) >= 0)) {
            if (iso === DAY_ISO || iso === selected) return; /* hide current next from ahead */
          }
          /* On selected=today, still show later unique same day only if not the next hero */
          rows.push({ iso: iso, e: e, p: p });
        });
      });
      /* If selected is today and next is today's event, drop first matching */
      if (next && rows.length) {
        var nk = nextKey.replace(/[^a-z0-9]+/g, "");
        rows = rows.filter(function (r, idx) {
          var tk = String(r.e.what || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
          if (idx === 0 && r.iso === DAY_ISO && nk && (tk.indexOf(nk.slice(0, 12)) >= 0 || nk.indexOf(tk.slice(0, 12)) >= 0)) return false;
          return true;
        });
      }
      /* AUDIT1 · Ahead = after now, in start order (today's past rows drop; untimed today rows drop after 5p) */
      var nowMin = consumeNowCtMin();
      rows = rows.filter(function (r) {
        if (r.iso !== DAY_ISO) return true;
        var m = consumeTimeMin(r.p.time);
        if (m == null) return nowMin < 17 * 60;
        return m > nowMin;
      });
      rows.sort(function (a, b) {
        if (a.iso !== b.iso) return a.iso < b.iso ? -1 : 1;
        var ma = consumeTimeMin(a.p.time), mb = consumeTimeMin(b.p.time);
        if (ma == null && mb == null) return 0;
        if (ma == null) return -1;
        if (mb == null) return 1;
        return ma - mb;
      });
      if (!rows.length) {
        ahead.innerHTML = '<div class="consume-ahead-empty">No unique events ahead · routines collapsed above</div>';
      } else {
        ahead.innerHTML = rows.slice(0, 8).map(function (r) {
          var dow = CONSUME_DOW[dowIndexFromIso(r.iso)].toUpperCase();
          var dn = String(Number(r.iso.split("-")[2]));
          var what = consumeStripKidName(r.e.what, kid);
          var dim = "";
          var hint = r.e.hint || "";
          if (hint && !/YOUR board/i.test(hint)) {
            dim = ' <span class="dim">· ' + esc(hint) + "</span>";
          } else {
            var paren = what.match(/\(([^)]+)\)/);
            if (paren) {
              what = what.replace(/\s*\([^)]+\)\s*$/, "").trim();
              dim = ' <span class="dim">· ' + esc(paren[1]) + "</span>";
            } else if (/·/.test(what)) {
              var parts = what.split("·");
              what = parts[0].trim();
              dim = ' <span class="dim">· ' + esc(parts.slice(1).join("·").trim()) + "</span>";
            }
          }
          var time = r.p.time || "";
          if (r.p.leave && time) time = time; /* already leave-aware in when */
          return '<div class="consume-ahead-row">' +
            '<span class="consume-ahead-day">' + esc(kidId === "ainsley" ? dow : (dow + " " + dn)) + "</span>" +   /* LIVEFIX3 */
            '<div class="consume-ahead-what">' + esc(what) + dim + "</div>" +
            '<span class="consume-ahead-time">' + esc(time || (r.p.allDay ? "All day" : "")) + "</span>" + /* ALLDAY1 */
            "</div>";
        }).join("");
      }
    }
    if (kidId === "ainsley") consumeAinsleyScrub(root);   /* LIVEFIX3 */
  }

  /* LIVEFIX3 · Ainsley law on her schedule section: no digit, time or date anywhere in it (weekday words only),
     no countdown, and no away-window end (no week-change framing). The boys' render path is untouched. */
  function consumeAinsleyScrub(root) {
    var L = global.HouseFaceLaw;
    var strip = function (t) {
      var out = (L && L.ainsleyText) ? L.ainsleyText(String(t)) : String(t).replace(/[\d$%\u2605\u2606\u2b50]/g, "");
      return out.replace(/[\d$%\u2605\u2606\u2b50]/g, "");
    };
    try {
      Array.prototype.forEach.call(root.querySelectorAll(".consume-countdown, .consume-punch-sub, .consume-punch-chip"), function (el) {
        el.textContent = ""; el.hidden = true; el.style.setProperty("display", "none", "important");
      });
      var w = document.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */), n, list = [];
      while ((n = w.nextNode())) { if (!(n.parentElement && n.parentElement.closest("[data-mount-consume-hdr]"))) list.push(n); }   /* the header clock is chrome */
      list.forEach(function (tn) {
        if (/[\d$%\u2605\u2606\u2b50]/.test(tn.nodeValue)) {
          var lead = /^\s/.test(tn.nodeValue) ? " " : "", trail = /\s$/.test(tn.nodeValue) ? " " : "";
          var v = strip(tn.nodeValue);
          tn.nodeValue = v ? lead + v + trail : "";
        }
      });
    } catch (e) { /* never break her board over a filter */ }
  }

  function renderKidPage(kidId, data) {
    var kid = data && data.kids && data.kids[kidId]; /* EMPTYFEED1 · a {} feed keeps the normal board */
    if (!kid) return;
    syncBankFromChecks(data);
    var bank = getBankView(kidId, data);

    var hotTitle = document.querySelector("[data-hot-title]");
    if (hotTitle && kid.hottest) hotTitle.innerHTML = esc(kid.hottest.when).replace(/(\d+:\d+|Leave\s+\d+:\d+)/g, function (m) {
      return '<span class="hl">' + m + "</span>";
    });
    // simpler: just set text with hl on numbers already in template — overwrite text
    if (hotTitle && kid.hottest) {
      hotTitle.textContent = "";
      hotTitle.innerHTML = esc(kid.hottest.when);
    }
    var hotSub = document.querySelector("[data-hot-sub]");
    if (hotSub && kid.hottest) {
      hotSub.innerHTML = "<strong>" + esc(kid.hottest.what) + "</strong> · " + esc(kid.hottest.where || "");
    }
    var hotPill = document.querySelector("[data-hot-pill]");
    if (hotPill && kid.hottest) {
      hotPill.innerHTML = '<span class="spark">◆</span> ' + esc(kid.hottest.what) + " · " + esc((kid.hottest.when || "").split("·")[0].trim());
    }

    var hotLabel = document.querySelector("[data-hot-label]");
    if (hotLabel && kid.hottest) {
      var whenHead = String(kid.hottest.when || "").split("·")[0].trim();
      hotLabel.textContent = whenHead ? ("ON THE BOARD · " + whenHead) : "ON THE BOARD";
    }
    var hotBadges = document.querySelector("[data-hot-badges]");
    if (hotBadges && kid.hottest) {
      var badges = kid.hottest.badges;
      if (!badges || !badges.length) {
        badges = String(kid.hottest.when || "").split("·").map(function (s) { return s.trim(); }).filter(Boolean).slice(0, 2);
      }
      hotBadges.innerHTML = (badges || []).map(function (b) {
        return '<div class="hot-badge">' + esc(b) + "</div>";
      }).join("") || '<div class="hot-badge">…</div>';
    }

    renderQuests(document.querySelector("[data-mount-quests]"), kid.quests, data, kidId);
    if (document.querySelector(".sec-schedule.consume-sched")) {
      renderConsumeSchedule(kidId, data);
    } else {
      renderList(document.querySelector("[data-mount-today-events]"), kid.today, "easy day · your quests below");
      renderList(document.querySelector("[data-mount-sports]"), kid.sports, kid.sportsEmpty || "no sports on your board right now");
      (function () {
        var schoolRows = (kid.school || []).slice();
        var hasLive = schoolRows.some(function (x) { return /special/i.test(String(x.what || "")); });
        var sp = hasLive ? null : specialForIso(kidId, DAY_ISO, schoolRows.concat(kid.today || []));
        if (sp) {
          schoolRows = [{ when: "Today · Special", what: sp.what, hint: sp.hint, tone: "act" }].concat(schoolRows);
        }
        renderList(document.querySelector("[data-mount-school]"), schoolRows, "school bits show up when known");
      })();
      renderList(document.querySelector("[data-mount-appointments]"), kid.appointments, kid.appointmentsEmpty || "none on your board · quiet is good");
    }
    renderList(document.querySelector("[data-mount-fun]"), kid.fun, "fun picks land here");
    renderList(document.querySelector("[data-mount-missions]"), kid.missions || kid.fun, "bonus missions land here");

    var streak = document.querySelector("[data-streak-label]");
    if (streak && kid.streakLabel) streak.textContent = kid.streakLabel;

    var prevReached = false;
    try { prevReached = localStorage.getItem("house-bank-goal:" + kidId) === "1"; } catch (e) {}
    renderBank(document, bank);
    renderPersonalGoal(document, kidId, data, bank);
    if (kidId === "ainsley") renderHarborStrips(kidId, data);
    if (bank.reached) {
      try { localStorage.setItem("house-bank-goal:" + kidId, "1"); } catch (e) {}
      document.body.classList.add("bank-goal-hit");
      var unlock = document.querySelector("[data-goal-unlock]");
      if (unlock) {
        unlock.hidden = false;
        unlock.textContent = "JAR FULL · Payday";
      }
      if (!prevReached) {
        try {
          document.dispatchEvent(new CustomEvent("house:goal-hit", { detail: { kidId: kidId, reward: bank.reward, bank: bank } }));
        } catch (e) {}
      }
    } else {
      var unlock2 = document.querySelector("[data-goal-unlock]");
      if (unlock2) unlock2.hidden = true;
      try { localStorage.removeItem("house-bank-goal:" + kidId); } catch (eClr) {}
      document.body.classList.remove("bank-goal-hit");
    }

    try {
      document.dispatchEvent(new CustomEvent("house:kid-rendered", { detail: { kidId: kidId, bank: bank } }));
    } catch (e) { /* */ }
  }

  function withHref(items, href) {
    return (items || []).map(function (it) {
      var o = {};
      for (var k in it) if (Object.prototype.hasOwnProperty.call(it, k)) o[k] = it[k];
      if (!o.href) o.href = href;
      return o;
    });
  }

  function pickHref(item) {
    var blob = ((item && item.what) || "") + " " + ((item && item.when) || "") + " " + ((item && item.hint) || "");
    blob = blob.toLowerCase();
    if (/harris/.test(blob)) return "kid-harris.html";
    if (/hayes/.test(blob)) return "kid-hayes.html";
    if (/ainsley/.test(blob)) return "kid-ainsley.html";
    /* DAYPKG1 v2e · Atlas 12:40 AM: the Paid sheet is reachable by URL only, so jar / payday rows open the chores sheet */
    if (/chore|must|jar|allowance|gem|coin|payday/.test(blob)) return "sheet-chores.html";
    if (/pack/.test(blob)) return "sheet-pack.html";
    return "sheet-today.html";
  }

  function dedupeDanRows(items) {
    var seen = Object.create(null);
    var out = [];
    (items || []).forEach(function (it) {
      var k = String((it && it.when) || "").toLowerCase() + "|" + String((it && it.what) || "").toLowerCase();
      if (seen[k]) return;
      seen[k] = 1;
      out.push(it);
    });
    return out;
  }

  function densifyDanToday(data) {
    var dan = data.kids.dan;
    var rows = dedupeDanRows((dan && dan.today) || []).slice();
    var strip = data.boardStrip || {};
    var blob = rows.map(function (r) { return ((r.when || "") + " " + (r.what || "")).toLowerCase(); }).join(" | ");
    if (strip.time && strip.place && blob.indexOf(String(strip.place).toLowerCase().slice(0, 18)) < 0) {
      rows.unshift({
        when: (strip.label || "Next") + " · " + strip.time,
        what: strip.place,
        tone: "hot",
        href: "sheet-today.html"
      });
    }
    if (blob.indexOf("must") < 0) {
      rows.splice(Math.min(2, rows.length), 0, {
        when: "Musts",
        what: "Kids clear · chores board",
        tone: "act",
        href: "sheet-chores.html"
      });
    }
    return rows.map(function (it) {
      var o = {};
      for (var k in it) if (Object.prototype.hasOwnProperty.call(it, k)) o[k] = it[k];
      if (!o.href) {
        var w = ((o.what || "") + " " + (o.when || "")).toLowerCase();
        if (/must|chore/.test(w)) o.href = "sheet-chores.html";
        else if (SCHRX(String.raw`§ drop|§ pickup|leave|swim|flag|baseball|pack`, "i").test(w)) o.href = "sheet-countdowns.html";
        else o.href = "sheet-today.html";
      }
      return o;
    });
  }

  function renderDanPage(data) {
    var dan = data && data.kids && data.kids.dan; /* EMPTYFEED1 */
    if (!dan) return;
    /* DADFIX1 · denser Today (next/musts/leave) · dedupe PE twins · every card → dest */
    renderList(document.querySelector("[data-mount-dan-today]"), densifyDanToday(data), "quiet day");
    renderList(document.querySelector("[data-mount-dan-week]"), withHref(dedupeDanRows(dan.week), "month.html"), "week fills from Atlas");
    renderList(document.querySelector("[data-mount-dan-leave]"), withHref(dan.leaveBys, "sheet-countdowns.html"), "leave-bys when known");
    var picks = (dan.picks || []).map(function (it) {
      var o = {};
      for (var k in it) if (Object.prototype.hasOwnProperty.call(it, k)) o[k] = it[k];
      if (!o.href) o.href = pickHref(o);
      return o;
    });
    renderList(document.querySelector("[data-mount-dan-picks]"), picks, "picks later");
  }

  /* HAYESJAR1C (Atlas 6:54, 6:57, 4:58) · LAW8C1 hid Hayes's daily backpack chore on the board behind the weekly
     "Backpack + sports bag" chore (fix A in kid-world.js now only folds same-cadence chores), so it could not be tapped from
     Sat 10-24 through Tue 10-27 of the chore week that starts Fri 2026-10-23. The fix is code, not data, and keeps NO record
     on the device: hay-backpack (Hayes only) on those four days reads done (getCheckRaw, so the jar rule counts it met on
     every device, an empty one too) and can not be toggled (setCheck no-op plus a capture-phase tap guard on every surface).
     HAYESJAR1D (Atlas 5:17) · it holds from that chore week until the start of Mon 2026-11-02 (local CT date, so the DST
     change on Sun 11-01 does not move it): those days stay done through the Fri 10-30 15:00 settle and the jar payout, then end
     by themselves. The new week (10-30 on) has no locked day, so its jar and counts are untouched. Other kids, other chores,
     other days and other weeks are unchanged. The earlier one-time write credit (HAYESJAR1/1B, never live) is gone:
     the read above makes it redundant, and a leftover house-migrate:hayesjar1 flag is never read. */
  var HAYESJAR1_WEEK = "2026-10-23";
  var HAYESJAR1_DAYS = ["2026-10-24", "2026-10-25", "2026-10-26", "2026-10-27"];
  var HAYESJAR1_UNTIL = "2026-11-02"; /* HAYESJAR1D · first local CT date with no lock (Mon 11-02 00:00 America/Chicago) */
  /** HAYESJAR1D · true for Hayes's backpack on a locked day from that chore week until the start of Mon 11-02 (CT date). */
  function hayesJar1Locked(checkId, dayIso) {
    try {
      if (checkId !== "hay-backpack" || KID_FROM_CHECK[checkId] !== "hayes") return false;
      var iso = dayIso || DAY_ISO;
      if (HAYESJAR1_DAYS.indexOf(iso) < 0) return false;
      return weekStartIso(DAY_ISO) >= HAYESJAR1_WEEK && DAY_ISO < HAYESJAR1_UNTIL;
    } catch (e) { return false; }
  }
  function hayesJar1Guard(ev) {
    try {
      if (ev.type === "keydown" && ev.key !== "Enter" && ev.key !== " ") return;
      var t = ev.target;
      var el = t && t.closest ? t.closest("[data-check],[data-claim],[data-hq-claim]") : null;
      if (!el) return;
      var id = el.getAttribute("data-check") || el.getAttribute("data-claim") || el.getAttribute("data-hq-claim");
      if (id !== "hay-backpack") return;
      var iso = el.getAttribute("data-day-iso") || DAY_ISO;
      if (!hayesJar1Locked(id, iso)) return;
      ev.preventDefault();
      ev.stopPropagation();
      if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
    } catch (e) { /* */ }
  }
  try {
    if (typeof document !== "undefined" && document && typeof document.addEventListener === "function") {
      document.addEventListener("click", hayesJar1Guard, true);
      document.addEventListener("keydown", hayesJar1Guard, true);
    }
  } catch (eG) { /* */ }

  function boot(kidId) {
    loadJSON(function (err, data) {
      if (err || !data) {
        /* MERCNODATA1 · no public kids week anymore: quiet when this screen has no key, info otherwise */
        var tok = "";
        try { tok = localStorage.getItem("wardos-private-feed-token") || localStorage.getItem("wardos-lights-proxy-token") || ""; } catch (e) { /* */ }
        if (tok) console.info("[kids-data]", err && err.message ? err.message : err);
        try { document.dispatchEvent(new CustomEvent("house:kids-data-missing", { detail: { kidId: kidId } })); } catch (e) { /* */ }
        return;
      }
      global.WardKids._data = data;
      if (kidId === "dan") renderDanPage(data);
      else if (kidId) renderKidPage(kidId, data);
      try {
        document.dispatchEvent(new CustomEvent("house:kids-data-ready", { detail: { kidId: kidId, data: data } }));
      } catch (e) { /* */ }
    });
  }

  global.WardKids = {
    DAY_ISO: DAY_ISO,
    CHECK_KEY: CHECK_KEY,
    BANK_KEY: BANK_KEY,
    bindHold: bindHold,
    HOLD_MS: HOLD_MS,
    LEGACY_BANK_KEY: LEGACY_BANK_KEY,
    blindMoveLegacyBank: blindMoveLegacyBank,
    /* DAYPKG1 v2f */
    kidScope: kidScope,
    kidSafeGoalText: kidSafeGoalText,
    scrubPaidStamp: scrubPaidStamp,
    LEDGER_PURGE_FROM: LEDGER_PURGE_FROM,
    DAD_DEVICE_KEY: DAD_DEVICE_KEY,
    ledgerPurgeOk: ledgerPurgeOk,
    purgeKidLedger: purgeKidLedger,
    scheduleKidLedgerPurge: scheduleKidLedgerPurge,
    purgeRun: function () { return PURGE_RUN; },
    migrateDadLedger: migrateDadLedger,
    ledgerLog: function () { return LEDGER_LOG; },
    KID_FROM_CHECK: KID_FROM_CHECK,
    checkKeyFor: checkKeyFor,
    weekStartIso: weekStartIso,
    weekDayIsos: weekDayIsos,
    dadWeekLen: dadWeekLen,
    DAD_WEEK_DAYS: DAD_WEEK_DAYS,
    dowIndexFromIso: dowIndexFromIso,
    chicagoHourNow: chicagoHourNow,
    weekStarsFor: weekStarsFor,
    dailyDoneCount: dailyDoneCount,
    dailyWeekComplete: dailyWeekComplete,
    bankStarsFor: bankStarsFor,
    mustQuests: mustQuests,
    mustSetComplete: mustSetComplete,
    mustProgress: mustProgress,
    mustPayStars: mustPayStars,
    syncMustGateBank: syncMustGateBank,
    HAYESJAR1_DAYS: HAYESJAR1_DAYS.slice(),
    HAYESJAR1_UNTIL: HAYESJAR1_UNTIL,
    hayesJar1Locked: hayesJar1Locked,
    syncDailyWeekBank: syncDailyWeekBank,
    enhanceSharedChores: enhanceSharedChores,
    questMeta: questMeta,
    loadChecks: loadChecks,
    saveChecks: saveChecks,
    loadKeyState: loadKeyState,
    saveKeyState: saveKeyState,
    getCheck: getCheck,
    setCheck: setCheck,
    getBankView: getBankView,
    applyCheckToBank: applyCheckToBank,
    syncBankFromChecks: syncBankFromChecks,
    renderBank: renderBank,
    renderPersonalGoal: renderPersonalGoal,
    renderHarborStrips: renderHarborStrips,
    renderKidPage: renderKidPage,
    renderConsumeSchedule: renderConsumeSchedule,
    eventsForIso: consumeEventsForIso,
    nextPaydayInfo: nextPaydayInfo,
    resetJarCycle: resetJarCycle,
    dadPaid: dadPaid,
    paidMarkerAt: paidMarkerAt,
    renderKidPaidChip: renderKidPaidChip,
    kidPage: kidPage,
    settlePriorWeeksIntoBalance: settlePriorWeeksIntoBalance,
    weekEarnDollars: weekEarnDollars,
    allowanceCap: allowanceCap,
    getPaidStamp: getPaidStamp,
    personalGoalView: personalGoalView,
    growGoalView: growGoalView,
    renderGrow: renderGrow,
    buildNoSurprise: buildNoSurprise,
    boot: boot,
    loadJSON: loadJSON,
    _data: null
  };
})(window);
