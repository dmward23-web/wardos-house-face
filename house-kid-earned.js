/* LEDGER · house-kid-earned.js · branch wall-redesign-ledger · not deployed, not wired.
   DAN 7:54 PM Oct 1: each kid seat shows the dollars earned THIS WEEK, plus a parent-only "nice one" bonus
   (fixed chips, no keyboard). Ledger owns the book and the math. Wright only renders.
   Book = append-only entries, integer cents, union by id (idempotent, so no double-pay on resync).
   Totals are DERIVED from entries, never stored as a mutable bank. Earned is partial (sum of what was earned),
   never all-or-nothing. Old entries are never deleted; a week "resets" because the display filters to the current weekKey.
   Shared write path is DESIGNED but OFF (SHARED_WRITE_ENABLED=false, LAST-YES Dan). Until then this is NOT a
   shared source: local entries queue under wardos.kidEarned.pending.v1 and the display says "Not synced".
   Contract: docs/kid-earned-CONTRACT.md */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.HouseKidEarned = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var SHARED_WRITE_ENABLED = false;                      /* LAST-YES (Dan). Do not flip without it. */
  var SHARED_KEY = "house.kidEarned.shared.v1";          /* proposed hub allowed key; the endpoint is NOT changed */
  var PENDING_KEY = "wardos.kidEarned.pending.v1";       /* this device's not-yet-shared entries */
  var SEED_URL = "data/kid-earned.json";
  var TZ = "America/Chicago";
  var KIDS = ["harris", "hayes", "ainsley"];
  var DEFAULT_WEEK = { rule: "fri-1500", startDow: 5, startTime: "15:00" }; /* existing Dad-week convention */
  var UNDO_MS_DEFAULT = 10 * 60 * 1000;
  var MAX_CENTS = 100000;
  var ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;
  var DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
  var ID_RE = /^[ebr]-[a-z0-9-]{3,120}$/;
  var REASON_RE = /^[A-Za-z0-9 '·,.\-]{1,40}$/;

  /* ---------- time (America/Chicago, DST-safe via Intl) ---------- */
  var DOW = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  function ctParts(ms) {
    var p = {};
    new Intl.DateTimeFormat("en-US", { timeZone: TZ, hourCycle: "h23", weekday: "short", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .formatToParts(new Date(ms)).forEach(function (x) { p[x.type] = x.value; });
    return { y: +p.year, m: +p.month, d: +p.day, hh: +p.hour % 24, mi: +p.minute, ss: +p.second, dow: DOW[p.weekday] };
  }
  function pad(n) { return String(n).padStart(2, "0"); }
  function ctIso(ms) {
    var p = ctParts(ms);
    var asUtc = Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mi, p.ss);
    var off = Math.round((asUtc - Math.floor(ms / 1000) * 1000) / 60000), a = Math.abs(off);
    return p.y + "-" + pad(p.m) + "-" + pad(p.d) + "T" + pad(p.hh) + ":" + pad(p.mi) + ":" + pad(p.ss) +
      (off < 0 ? "-" : "+") + pad(Math.floor(a / 60)) + ":" + pad(a % 60);
  }
  function normWeek(w) {
    w = w || {};
    if (w.rule === "sun-0000") return { rule: "sun-0000", startDow: 0, startTime: "00:00" };
    var dow = Number.isInteger(w.startDow) && w.startDow >= 0 && w.startDow <= 6 ? w.startDow : DEFAULT_WEEK.startDow;
    var t = /^\d{2}:\d{2}$/.test(w.startTime || "") ? w.startTime : DEFAULT_WEEK.startTime;
    return { rule: w.rule || DEFAULT_WEEK.rule, startDow: dow, startTime: t };
  }
  /* weekKey = CT calendar date of the day the week starts (fri-1500: the Friday; sun-0000: the Sunday). */
  function weekKeyFor(ms, week) {
    var w = normWeek(week), p = ctParts(ms);
    var startMin = (+w.startTime.slice(0, 2)) * 60 + (+w.startTime.slice(3, 5));
    var back = (p.dow - w.startDow + 7) % 7;
    if (back === 0 && p.hh * 60 + p.mi < startMin) back = 7;
    var d = new Date(Date.UTC(p.y, p.m - 1, p.d - back));
    return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate());
  }

  /* ---------- money ---------- */
  function formatCents(c) {
    c = Math.round(Number(c) || 0);
    var a = Math.abs(c), dollars = Math.floor(a / 100), cents = a % 100;
    return (c < 0 ? "-" : "") + "$" + dollars + (cents ? "." + pad(cents) : "");
  }

  function memStorage() {
    var m = {};
    return { getItem: function (k) { return k in m ? m[k] : null; }, setItem: function (k, v) { m[k] = String(v); }, removeItem: function (k) { delete m[k]; } };
  }
  function copy(e) {
    var o = { id: e.id, kid: e.kid, type: e.type, amount: e.amount, reason: e.reason, at: e.at, weekKey: e.weekKey };
    if (e.reversalOf) o.reversalOf = e.reversalOf;
    if (e.sourceId) o.sourceId = e.sourceId;
    return o;
  }
  function rand4() { return Math.random().toString(36).slice(2, 6).replace(/[^a-z0-9]/g, "0").padEnd(4, "0"); }

  /* create({ seed, storage, now, parentGate, fetch, hubBase }) -> book API */
  function create(opts) {
    opts = opts || {};
    var seed = opts.seed && typeof opts.seed === "object" ? opts.seed : {};
    var store = opts.storage || memStorage();
    var now = opts.now || function () { return Date.now(); };
    var parentGate = typeof opts.parentGate === "function" ? opts.parentGate : null;
    var week = normWeek(seed.week);
    var undoMs = Number.isFinite(seed.undoWindowMin) ? seed.undoWindowMin * 60000 : UNDO_MS_DEFAULT;
    var kids = (Array.isArray(seed.kids) && seed.kids.length ? seed.kids : KIDS.map(function (k) { return { id: k, name: k[0].toUpperCase() + k.slice(1) }; }))
      .filter(function (k) { return k && KIDS.indexOf(k.id) >= 0; });
    var kidIds = kids.map(function (k) { return k.id; });
    var amounts = (Array.isArray(seed.bonusAmounts) ? seed.bonusAmounts : [])
      .filter(function (a) { return a && Number.isInteger(a.cents) && a.cents > 0 && a.cents <= MAX_CENTS; });
    var reasons = (Array.isArray(seed.bonusReasons) ? seed.bonusReasons : [])
      .filter(function (r) { return r && typeof r.id === "string" && typeof r.label === "string" && REASON_RE.test(r.label); });

    var byId = {}, order = [];
    function valid(e) {
      if (!e || typeof e !== "object") return false;
      if (typeof e.id !== "string" || !ID_RE.test(e.id)) return false;
      if (kidIds.indexOf(e.kid) < 0) return false;
      if (e.type !== "earned" && e.type !== "bonus") return false;
      if (!Number.isInteger(e.amount) || e.amount === 0 || Math.abs(e.amount) > MAX_CENTS) return false;
      if (typeof e.reason !== "string" || !REASON_RE.test(e.reason)) return false;
      if (typeof e.at !== "string" || !ISO_RE.test(e.at) || !isFinite(Date.parse(e.at))) return false;
      if (typeof e.weekKey !== "string" || !DAY_RE.test(e.weekKey)) return false;
      if (e.amount < 0 && typeof e.reversalOf !== "string") return false;           /* negatives are reversals only */
      if (e.type === "bonus" && e.amount > 0 && !amounts.some(function (a) { return a.cents === e.amount; })) return false;
      return true;
    }
    /* apply(entry) -> true if newly added; same id again = no-op (idempotent). */
    function apply(e) {
      if (!valid(e) || byId[e.id]) return false;
      byId[e.id] = copy(e); order.push(e.id);
      return true;
    }
    /* merge(entries) -> how many were new. Union by id: overlap never double counts. */
    function merge(list) {
      var n = 0;
      (Array.isArray(list) ? list : []).forEach(function (e) { if (apply(e)) n++; });
      return n;
    }

    /* pending = entries made on THIS device that no shared store has acknowledged */
    function readPending() {
      try { var raw = store.getItem(PENDING_KEY); var o = raw ? JSON.parse(raw) : null; return o && o.v === 1 && Array.isArray(o.entries) ? o.entries : []; }
      catch (e) { return []; }
    }
    var pendingIds = [];
    function writePending() {
      var val = JSON.stringify({ v: 1, entries: pendingIds.map(function (id) { return byId[id]; }).filter(Boolean) });
      try { store.setItem(PENDING_KEY, val); } catch (e) { store = memStorage(); store.setItem(PENDING_KEY, val); }
    }
    merge(seed.entries);
    readPending().forEach(function (e) {
      if (!valid(e)) return;
      apply(e);                                              /* already in the seed = no-op, still pending until acked */
      if (pendingIds.indexOf(e.id) < 0) pendingIds.push(e.id);
    });
    function record(e) {
      if (!apply(e)) return false;
      pendingIds.push(e.id); writePending();
      return true;
    }

    function all() { return order.map(function (id) { return byId[id]; }); }
    function netFor(pred) { return all().filter(pred).reduce(function (s, e) { return s + e.amount; }, 0); }
    function reversed(id) { return all().some(function (e) { return e.reversalOf === id; }); }

    /* ---------- earned (Atlas chore-done -> Ledger) ---------- */
    /* addEarned({kid, sourceId, amountCents, reason?, at?}) -> {ok, entry|error}. Not parent-gated (Atlas's chore tap).
       id is deterministic per tap source, so two devices recording the same tap make the SAME id (no double count).
       A re-tap after undoEarned gets the next generation id (-2, -3 …), also deterministic. */
    function addEarned(a) {
      a = a || {};
      if (kidIds.indexOf(a.kid) < 0) return { ok: false, error: "bad-kid" };
      var src = String(a.sourceId || "").toLowerCase();
      if (!/^[a-z0-9-]{2,60}$/.test(src)) return { ok: false, error: "bad-source" };
      if (!Number.isInteger(a.amountCents) || a.amountCents <= 0 || a.amountCents > MAX_CENTS) return { ok: false, error: "bad-amount" };
      var mine = function (e) { return e.kid === a.kid && e.type === "earned" && e.sourceId === src; };
      if (netFor(mine) > 0) return { ok: true, entry: null, noop: true };
      var gen = all().filter(function (e) { return mine(e) && e.amount > 0; }).length + 1;
      var at = a.at && ISO_RE.test(a.at) ? a.at : ctIso(now());
      var e = { id: "e-" + a.kid + "-" + src + (gen > 1 ? "-" + gen : ""), kid: a.kid, type: "earned", amount: a.amountCents,
        reason: a.reason && REASON_RE.test(a.reason) ? a.reason : "Chores", at: at, weekKey: weekKeyFor(Date.parse(at), week), sourceId: src };
      return record(e) ? { ok: true, entry: copy(e) } : { ok: true, entry: null, noop: true };
    }
    /* undoEarned({kid, sourceId}) -> reversal of the live earned entry for that tap (Atlas un-tap). */
    function undoEarned(a) {
      a = a || {};
      var src = String(a.sourceId || "").toLowerCase();
      var live = all().filter(function (e) { return e.kid === a.kid && e.type === "earned" && e.sourceId === src && e.amount > 0 && !reversed(e.id); }).pop();
      if (!live) return { ok: true, entry: null, noop: true };
      var e = { id: "r-" + live.id, kid: live.kid, type: "earned", amount: -live.amount, reason: live.reason, at: ctIso(now()),
        weekKey: live.weekKey, reversalOf: live.id, sourceId: src };
      return record(e) ? { ok: true, entry: copy(e) } : { ok: true, entry: null, noop: true };
    }

    /* ---------- bonus (parent only, fixed chips) ---------- */
    function gateOk(pinOk, ctx) {
      if (pinOk !== true) return false;
      if (parentGate && parentGate(ctx) !== true) return false;
      return true;
    }
    function chipAmount(x) {
      return amounts.filter(function (a) { return a.cents === x || a.label === x; })[0] || null;
    }
    function chipReason(x) {
      return reasons.filter(function (r) { return r.id === x || r.label === x; })[0] || null;
    }
    /* addBonus({kid, amountChip, reasonChip, pinOk}) -> {ok, entry|error}. No free text, no free amount. */
    function addBonus(a) {
      a = a || {};
      if (!gateOk(a.pinOk, { action: "bonus", kid: a.kid })) return { ok: false, error: "parent-gate" };
      if (kidIds.indexOf(a.kid) < 0) return { ok: false, error: "bad-kid" };
      var amt = chipAmount(a.amountChip);
      if (!amt) return { ok: false, error: "amount-not-a-chip" };
      var why = chipReason(a.reasonChip);
      if (!why) return { ok: false, error: "reason-not-a-chip" };
      var t = now();
      var e = { id: "b-" + a.kid + "-" + t + "-" + rand4(), kid: a.kid, type: "bonus", amount: amt.cents, reason: why.label,
        at: ctIso(t), weekKey: weekKeyFor(t, week) };
      return record(e) ? { ok: true, entry: copy(e) } : { ok: false, error: "duplicate" };
    }
    /* undoBonus(id, {pinOk}) -> reversal entry (negative, reversalOf = id). Within the undo window only. Never deletes. */
    function undoBonus(id, g) {
      g = g || {};
      var orig = byId[id];
      if (!gateOk(g.pinOk, { action: "undo", kid: orig && orig.kid })) return { ok: false, error: "parent-gate" };
      if (!orig || orig.type !== "bonus" || orig.amount <= 0) return { ok: false, error: "not-a-bonus" };
      if (reversed(id)) return { ok: true, entry: null, noop: true };
      if (now() - Date.parse(orig.at) > undoMs) return { ok: false, error: "undo-window-closed" };
      var e = { id: "r-" + id, kid: orig.kid, type: "bonus", amount: -orig.amount, reason: orig.reason, at: ctIso(now()),
        weekKey: orig.weekKey, reversalOf: id };
      return record(e) ? { ok: true, entry: copy(e) } : { ok: true, entry: null, noop: true };
    }

    /* ---------- derived totals ---------- */
    function capFor(kid) {
      var k = kids.filter(function (x) { return x.id === kid; })[0];
      return k && Number.isInteger(k.earnedCapCents) && k.earnedCapCents > 0 ? k.earnedCapCents : null;
    }
    function totals(weekKey) {
      var wk = weekKey || weekKeyFor(now(), week);
      return kids.map(function (k) {
        var inWeek = function (e) { return e.kid === k.id && e.weekKey === wk; };
        var earned = Math.max(0, netFor(function (e) { return inWeek(e) && e.type === "earned"; }));
        var cap = capFor(k.id);
        if (cap != null) earned = Math.min(earned, cap);
        var bonus = Math.max(0, netFor(function (e) { return inWeek(e) && e.type === "bonus"; }));
        var bonusCount = all().filter(function (e) { return inWeek(e) && e.type === "bonus" && e.amount > 0 && !reversed(e.id); }).length;
        return { kid: k.id, name: k.name, earnedCents: earned, bonusCents: bonus, totalCents: earned + bonus, bonusCount: bonusCount };
      });
    }
    function syncState() {
      var n = pendingIds.length;
      var synced = SHARED_WRITE_ENABLED ? n === 0 : false;
      return { sharedWriteEnabled: SHARED_WRITE_ENABLED, sharedKey: SHARED_KEY, pendingKey: PENDING_KEY, pendingCount: n,
        synced: synced, label: synced ? "Synced" : "Not synced" };
    }
    /* display(now?) -> exactly what the seat renders. weekTotal + bonusCount only. No per-chore amounts, no reasons, no links. */
    function display(atMs) {
      var t = atMs == null ? now() : atMs;
      var wk = weekKeyFor(t, week), s = syncState();
      return {
        weekKey: wk,
        kids: totals(wk).map(function (r) { return { kid: r.kid, name: r.name, weekTotal: formatCents(r.totalCents), bonusCount: r.bonusCount }; }),
        synced: s.synced,
        syncLabel: s.label
      };
    }
    /* pushShared() -> what a sync would do. With SHARED_WRITE_ENABLED=false: NO network, resolves {ok:false, reason}. */
    function pushShared() {
      if (!SHARED_WRITE_ENABLED) return Promise.resolve({ ok: false, reason: "shared-write-off", pendingCount: pendingIds.length });
      var f = opts.fetch, base = opts.hubBase;
      if (typeof f !== "function" || !base) return Promise.resolve({ ok: false, reason: "no-hub" });
      var body = { changes: pendingIds.map(function (id) { return { key: SHARED_KEY, id: id, entry: byId[id] }; }) };
      return f(base + "/api/taps", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        .then(function (r) { return r.json(); })
        .then(function (res) {
          merge(res && res.kidEarned);
          var acked = (res && res.kidEarnedIds) || [];
          pendingIds = pendingIds.filter(function (id) { return acked.indexOf(id) < 0; });
          writePending();
          return { ok: true, pendingCount: pendingIds.length };
        });
    }

    writePending();
    return {
      apply: apply, merge: merge, addEarned: addEarned, undoEarned: undoEarned, addBonus: addBonus, undoBonus: undoBonus,
      totals: totals, display: display, syncState: syncState, pushShared: pushShared,
      entries: function () { return all().map(copy); },
      pending: function () { return pendingIds.map(function (id) { return copy(byId[id]); }); },
      bonusAmounts: function () { return amounts.map(function (a) { return { cents: a.cents, label: a.label }; }); },
      bonusReasons: function () { return reasons.map(function (r) { return { id: r.id, label: r.label }; }); },
      weekKeyNow: function () { return weekKeyFor(now(), week); }
    };
  }

  /* load({ fetch, storage, now, parentGate, url }) -> Promise<book>. Seed fetch failure still returns the device's pending book. */
  function load(opts) {
    opts = opts || {};
    var f = opts.fetch || (typeof fetch === "function" ? fetch : null);
    var go = f ? f((opts.url || SEED_URL) + "?t=" + Date.now(), { cache: "no-store" }).then(function (r) { return r && r.ok ? r.json() : null; }) : Promise.resolve(null);
    return go.catch(function () { return null; }).then(function (seed) {
      return create(Object.assign({}, opts, { seed: seed, storage: opts.storage || (typeof localStorage !== "undefined" ? localStorage : null) }));
    });
  }

  return { create: create, load: load, weekKeyFor: weekKeyFor, formatCents: formatCents, ctIso: ctIso,
    SHARED_WRITE_ENABLED: SHARED_WRITE_ENABLED, SHARED_KEY: SHARED_KEY, PENDING_KEY: PENDING_KEY, SEED_URL: SEED_URL };
});
