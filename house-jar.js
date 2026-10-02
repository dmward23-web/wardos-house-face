/* LEDGER · house-jar.js · branch wall-redesign-ledger · not deployed, not wired, NOT LIVE until Alfred QAQC PASS.
   CHORE LAW (Dan, locked Thu Oct 1 2026 8:01 PM CT): a family jar plus a personal jar per kid. It pays TIME (minutes)
   and PICKS (a count of choices). Never cash. A stolen close zeros that kid's personal jar for the day.
   The rule text is shown on the tile; balances are NOT listed, so the wall API exports no numbers at all.
   Book = append-only entries, union by id (idempotent: no double-pay on resync). Totals are derived, never a stored bank.
   Shared write is DESIGNED but OFF (SHARED_WRITE_ENABLED=false, LAST-YES Dan): until then this is NOT a shared truth;
   local entries queue under wardos.jar.pending.v1 and the tile says "Not synced". Contract: docs/house-jar-CONTRACT.md */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.HouseJar = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var SHARED_WRITE_ENABLED = false;              /* LAST-YES (Dan). Do not flip without it. */
  var SHARED_KEY = "house.jar.shared.v1";        /* proposed hub allowed key; the endpoint is NOT changed */
  var PENDING_KEY = "wardos.jar.pending.v1";     /* this device's not-yet-shared entries */
  var SEED_URL = "data/house-jar.json";
  var TZ = "America/Chicago";
  var JARS = ["family", "harris", "hayes", "ainsley"];
  var KIDS = ["harris", "hayes", "ainsley"];
  var TYPES = ["add", "redeem", "zero-day", "reversal"];
  var UNITS = ["min", "pick"];

  /* Whole-string match without end anchors (house rule for this file: no currency glyph, not even in a regex). */
  function full(re, s) { if (typeof s !== "string") return false; var m = re.exec(s); return !!m && m.index === 0 && m[0].length === s.length; }
  var ISO_RE = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})/;
  var DAY_RE = /\d{4}-\d{2}-\d{2}/;
  var ID_RE = /[cndzr]-[a-z0-9-]{3,140}/;
  var SRC_RE = /[a-z0-9-]{2,60}/;

  /* ---------- time: America/Chicago calendar day, DST-safe via Intl ---------- */
  function pad(n) { return String(n).padStart(2, "0"); }
  function ctParts(ms) {
    var p = {};
    new Intl.DateTimeFormat("en-US", { timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .formatToParts(new Date(ms)).forEach(function (x) { p[x.type] = x.value; });
    return { y: +p.year, m: +p.month, d: +p.day, hh: +p.hour % 24, mi: +p.minute, ss: +p.second };
  }
  function dayKeyFor(ms) { var p = ctParts(ms); return p.y + "-" + pad(p.m) + "-" + pad(p.d); }
  function ctIso(ms) {
    var p = ctParts(ms);
    var asUtc = Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mi, p.ss);
    var off = Math.round((asUtc - Math.floor(ms / 1000) * 1000) / 60000), a = Math.abs(off);
    return p.y + "-" + pad(p.m) + "-" + pad(p.d) + "T" + pad(p.hh) + ":" + pad(p.mi) + ":" + pad(p.ss) +
      (off < 0 ? "-" : "+") + pad(Math.floor(a / 60)) + ":" + pad(a % 60);
  }
  function memStorage() {
    var m = {};
    return { getItem: function (k) { return k in m ? m[k] : null; }, setItem: function (k, v) { m[k] = String(v); }, removeItem: function (k) { delete m[k]; } };
  }
  function rand4() { return (Math.random().toString(36).slice(2, 6) + "0000").slice(0, 4).replace(/[^a-z0-9]/g, "0"); }
  function copy(e) {
    var o = { id: e.id, jar: e.jar, type: e.type, unit: e.unit, qty: e.qty, reason: e.reason, at: e.at, dayKey: e.dayKey };
    if (e.refId) o.refId = e.refId;
    return o;
  }
  function list(x) { return Array.isArray(x) ? x : []; }

  /* create({ seed, storage, now, parentGate, fetch, hubBase }) -> jar book */
  function create(opts) {
    opts = opts || {};
    var seed = opts.seed && typeof opts.seed === "object" ? opts.seed : {};
    var store = opts.storage || memStorage();
    var now = opts.now || function () { return Date.now(); };
    var parentGate = typeof opts.parentGate === "function" ? opts.parentGate : null;
    var undoMs = Number.isFinite(seed.undoWindowMin) ? seed.undoWindowMin * 60000 : 10 * 60000;
    var lim = seed.limits || {};
    var maxQty = { min: Number.isInteger(lim.maxMinPerEntry) ? lim.maxMinPerEntry : 120, pick: Number.isInteger(lim.maxPickPerEntry) ? lim.maxPickPerEntry : 3 };
    var ruleText = typeof seed.ruleText === "string" ? seed.ruleText : "";
    var jars = list(seed.jars).filter(function (j) { return j && JARS.indexOf(j.id) >= 0; });
    if (!jars.length) jars = JARS.map(function (id) { return { id: id, name: id === "family" ? "Family jar" : id[0].toUpperCase() + id.slice(1), kind: id === "family" ? "family" : "personal" }; });
    var jarIds = jars.map(function (j) { return j.id; });
    var chips = list(seed.niceOneChips).filter(function (c) { return c && typeof c.id === "string" && UNITS.indexOf(c.unit) >= 0 && Number.isInteger(c.qty) && c.qty > 0 && c.qty <= maxQty[c.unit]; });
    function reasonSet(x) { return list(x).filter(function (r) { return r && typeof r.id === "string" && typeof r.label === "string"; }); }
    var R = { nice: reasonSet(seed.niceOneReasons), credit: reasonSet(seed.creditReasons), redeem: reasonSet(seed.redeemReasons), zero: reasonSet(seed.zeroDayReasons) };
    function findReason(set, x) { return set.filter(function (r) { return r.id === x || r.label === x; })[0] || null; }
    function hasLabel(set, label) { return set.some(function (r) { return r.label === label; }); }

    var byId = {}, order = [];
    function valid(e) {
      if (!e || typeof e !== "object" || !full(ID_RE, e.id)) return false;
      if (jarIds.indexOf(e.jar) < 0 || TYPES.indexOf(e.type) < 0) return false;
      if (UNITS.indexOf(e.unit) < 0 || !Number.isInteger(e.qty) || e.qty < 0 || e.qty > Math.max(maxQty.min, maxQty.pick) * 10) return false;
      if (typeof e.reason !== "string" || !full(ISO_RE, e.at) || !isFinite(Date.parse(e.at)) || !full(DAY_RE, e.dayKey)) return false;
      if (e.type === "add") {
        if (e.qty < 1 || e.qty > maxQty[e.unit]) return false;
        if (!hasLabel(R.nice, e.reason) && !hasLabel(R.credit, e.reason)) return false;
        if (e.id.charAt(0) === "n" && !chips.some(function (c) { return c.unit === e.unit && c.qty === e.qty; })) return false;   /* Nice one = chips only */
      }
      if (e.type === "redeem" && (e.qty < 1 || !hasLabel(R.redeem, e.reason))) return false;
      if (e.type === "zero-day") {
        if (KIDS.indexOf(e.jar) < 0 || !hasLabel(R.zero, e.reason)) return false;              /* personal jars only */
        if (e.id !== "z-" + e.jar + "-" + e.dayKey) return false;                               /* one per kid per day */
      }
      if (e.type === "reversal" && (typeof e.refId !== "string" || e.id !== "r-" + e.refId)) return false;
      return true;
    }
    /* apply(entry) -> true if new; same id again = no-op. */
    function apply(e) { if (!valid(e) || byId[e.id]) return false; byId[e.id] = copy(e); order.push(e.id); return true; }
    /* merge(entries) -> count of new entries. Union by id. */
    function merge(xs) { var n = 0; list(xs).forEach(function (e) { if (apply(e)) n++; }); return n; }

    var pendingIds = [];
    function readPending() {
      try { var o = JSON.parse(store.getItem(PENDING_KEY) || "null"); return o && o.v === 1 ? list(o.entries) : []; } catch (e) { return []; }
    }
    function writePending() {
      var val = JSON.stringify({ v: 1, entries: pendingIds.map(function (id) { return byId[id]; }).filter(Boolean) });
      try { store.setItem(PENDING_KEY, val); } catch (e) { store = memStorage(); store.setItem(PENDING_KEY, val); }
    }
    merge(seed.entries);
    readPending().forEach(function (e) { if (!valid(e)) return; apply(e); if (pendingIds.indexOf(e.id) < 0) pendingIds.push(e.id); });
    function record(e) { if (!apply(e)) return false; pendingIds.push(e.id); writePending(); return true; }

    function all() { return order.map(function (id) { return byId[id]; }); }
    function voided(id) { return !!byId["r-" + id]; }
    function live() { return all().filter(function (e) { return e.type !== "reversal" && !voided(e.id); }); }
    function gateOk(pinOk, ctx) { return pinOk === true && (!parentGate || parentGate(ctx) === true); }

    /* ---------- derived balance (order-independent) ----------
       available(jar, unit) = max(0, sum(adds on days NOT zeroed for that jar) - sum(redeems)).
       zero-day {kid, dayKey}: that personal jar's adds dated that dayKey count 0. Redeems still count (spent stays spent).
       Other days, other kids and the family jar are untouched. Reversed entries count as if never made. */
    function available(jar, unit) {
      var L = live().filter(function (e) { return e.jar === jar; });
      var zeroed = {};
      L.forEach(function (e) { if (e.type === "zero-day") zeroed[e.dayKey] = true; });
      var adds = 0, spent = 0;
      L.forEach(function (e) {
        if (e.unit !== unit) return;
        if (e.type === "add" && !zeroed[e.dayKey]) adds += e.qty;
        if (e.type === "redeem") spent += e.qty;
      });
      return Math.max(0, adds - spent);
    }

    function fail(error) { return { ok: false, error: error }; }
    function stamp() { var t = now(); return { t: t, at: ctIso(t), dayKey: dayKeyFor(t) }; }

    /* niceOne({jar, chip, reason, pinOk}) -> parent-only add from a fixed chip + fixed reason. Never cash. */
    function niceOne(a) {
      a = a || {};
      if (!gateOk(a.pinOk, { action: "nice-one", jar: a.jar })) return fail("parent-gate");
      if (jarIds.indexOf(a.jar) < 0) return fail("bad-jar");
      var chip = chips.filter(function (c) { return c.id === a.chip || c.label === a.chip; })[0];
      if (!chip) return fail("not-a-chip");
      var why = findReason(R.nice, a.reason);
      if (!why) return fail("not-a-reason");
      var s = stamp();
      var e = { id: "n-" + a.jar + "-" + s.t + "-" + rand4(), jar: a.jar, type: "add", unit: chip.unit, qty: chip.qty, reason: why.label, at: s.at, dayKey: s.dayKey };
      return record(e) ? { ok: true, entry: copy(e) } : fail("duplicate");
    }
    /* credit({jar, unit, qty, sourceId, reason, at?}) -> Atlas's close credit (not a wall button). Deterministic id per
       source, so two screens recording the same close make one entry. Rate/schedule is Atlas + Dan's call (none seeded). */
    function credit(a) {
      a = a || {};
      if (jarIds.indexOf(a.jar) < 0) return fail("bad-jar");
      if (UNITS.indexOf(a.unit) < 0 || !Number.isInteger(a.qty) || a.qty < 1 || a.qty > maxQty[a.unit]) return fail("bad-qty");
      var src = String(a.sourceId || "").toLowerCase();
      if (!full(SRC_RE, src)) return fail("bad-source");
      var why = findReason(R.credit, a.reason);
      if (!why) return fail("not-a-reason");
      var at = full(ISO_RE, a.at || "") ? a.at : ctIso(now());
      var e = { id: "c-" + a.jar + "-" + src, jar: a.jar, type: "add", unit: a.unit, qty: a.qty, reason: why.label, at: at, dayKey: dayKeyFor(Date.parse(at)) };
      if (byId[e.id]) return { ok: true, entry: null, noop: true };
      return record(e) ? { ok: true, entry: copy(e) } : fail("invalid");
    }
    /* zeroDay({kid, dayKey? | at?, reason}) -> stolen close / took a claimed choice. Id z-<kid>-<dayKey>: once per kid per day. */
    function zeroDay(a) {
      a = a || {};
      if (KIDS.indexOf(a.kid) < 0) return fail("bad-kid");
      var why = findReason(R.zero, a.reason);
      if (!why) return fail("not-a-reason");
      var at = full(ISO_RE, a.at || "") ? a.at : ctIso(now());
      var dk = full(DAY_RE, a.dayKey || "") ? a.dayKey : dayKeyFor(Date.parse(at));
      var e = { id: "z-" + a.kid + "-" + dk, jar: a.kid, type: "zero-day", unit: "min", qty: 0, reason: why.label, at: at, dayKey: dk };
      if (byId[e.id]) return { ok: true, entry: null, noop: true };
      return record(e) ? { ok: true, entry: copy(e) } : fail("invalid");
    }
    /* redeem({jar, unit, qty, reason, pinOk}) -> parent-only spend. Can't go below 0. */
    function redeem(a) {
      a = a || {};
      if (!gateOk(a.pinOk, { action: "redeem", jar: a.jar })) return fail("parent-gate");
      if (jarIds.indexOf(a.jar) < 0) return fail("bad-jar");
      if (UNITS.indexOf(a.unit) < 0 || !Number.isInteger(a.qty) || a.qty < 1) return fail("bad-qty");
      var why = findReason(R.redeem, a.reason);
      if (!why) return fail("not-a-reason");
      if (a.qty > available(a.jar, a.unit)) return fail("not-enough");
      var s = stamp();
      var e = { id: "d-" + a.jar + "-" + s.t + "-" + rand4(), jar: a.jar, type: "redeem", unit: a.unit, qty: a.qty, reason: why.label, at: s.at, dayKey: s.dayKey };
      return record(e) ? { ok: true, entry: copy(e) } : fail("duplicate");
    }
    /* reverse(refId, {pinOk}) -> parent-only. Voids one entry by appending r-<refId> (never deletes).
       Nice one: within the undo window only. Zero-day (disputed close), credit, redeem: any time. */
    function reverse(refId, g) {
      g = g || {};
      var orig = byId[refId];
      if (!gateOk(g.pinOk, { action: "reverse", jar: orig && orig.jar })) return fail("parent-gate");
      if (!orig || orig.type === "reversal") return fail("not-reversible");
      if (voided(refId)) return { ok: true, entry: null, noop: true };
      if (refId.charAt(0) === "n" && now() - Date.parse(orig.at) > undoMs) return fail("undo-window-closed");
      var s = stamp();
      var e = { id: "r-" + refId, jar: orig.jar, type: "reversal", unit: orig.unit, qty: orig.qty, reason: "Reversed", at: s.at, dayKey: s.dayKey, refId: refId };
      return record(e) ? { ok: true, entry: copy(e) } : fail("invalid");
    }

    function syncState() {
      var synced = SHARED_WRITE_ENABLED && pendingIds.length === 0;
      return { sharedWriteEnabled: SHARED_WRITE_ENABLED, sharedKey: SHARED_KEY, pendingKey: PENDING_KEY, pendingCount: pendingIds.length, synced: synced, label: synced ? "Synced" : "Not synced" };
    }
    /* wallDisplay() -> the ONLY thing the tile renders: rule text, jar names, sync state. No numbers, no balances, no fill. */
    function wallDisplay() {
      var s = syncState();
      return { ruleText: ruleText, jars: jars.map(function (j) { return { jar: j.id, name: j.name }; }), synced: s.synced, syncLabel: s.label };
    }
    /* parentView({pinOk}) -> internal/parent redeem screen only (numbers live here, never on the wall). */
    function parentView(g) {
      g = g || {};
      if (!gateOk(g.pinOk, { action: "view" })) return fail("parent-gate");
      return { ok: true, jars: jars.map(function (j) { return { jar: j.id, name: j.name, min: available(j.id, "min"), pick: available(j.id, "pick") }; }) };
    }
    /* pushShared() -> with the flag off: no request, resolves {ok:false, reason:"shared-write-off"}. */
    function pushShared() {
      if (!SHARED_WRITE_ENABLED) return Promise.resolve({ ok: false, reason: "shared-write-off", pendingCount: pendingIds.length });
      var f = opts.fetch, base = opts.hubBase;
      if (typeof f !== "function" || !base) return Promise.resolve({ ok: false, reason: "no-hub" });
      var body = { changes: pendingIds.map(function (id) { return { key: SHARED_KEY, id: id, entry: byId[id] }; }) };
      return f(base + "/api/taps", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        .then(function (r) { return r.json(); })
        .then(function (res) {
          merge(res && res.jar);
          var acked = list(res && res.jarIds);
          pendingIds = pendingIds.filter(function (id) { return acked.indexOf(id) < 0; });
          writePending();
          return { ok: true, pendingCount: pendingIds.length };
        });
    }

    writePending();
    return {
      apply: apply, merge: merge, niceOne: niceOne, credit: credit, zeroDay: zeroDay, redeem: redeem, reverse: reverse,
      wallDisplay: wallDisplay, parentView: parentView, syncState: syncState, pushShared: pushShared,
      entries: function () { return all().map(copy); },
      pending: function () { return pendingIds.map(function (id) { return copy(byId[id]); }); },
      chips: function () { return chips.map(function (c) { return { id: c.id, unit: c.unit, label: c.label }; }); },
      reasons: function () { return { niceOne: R.nice.slice(), redeem: R.redeem.slice() }; }
    };
  }

  /* load({ fetch, storage, now, parentGate, url }) -> Promise<book>. Seed fetch failure still returns this device's pending book. */
  function load(opts) {
    opts = opts || {};
    var f = opts.fetch || (typeof fetch === "function" ? fetch : null);
    var go = f ? f((opts.url || SEED_URL) + "?t=" + Date.now(), { cache: "no-store" }).then(function (r) { return r && r.ok ? r.json() : null; }) : Promise.resolve(null);
    return go.catch(function () { return null; }).then(function (seed) {
      return create(Object.assign({}, opts, { seed: seed, storage: opts.storage || (typeof localStorage !== "undefined" ? localStorage : null) }));
    });
  }

  return { create: create, load: load, dayKeyFor: dayKeyFor, ctIso: ctIso,
    SHARED_WRITE_ENABLED: SHARED_WRITE_ENABLED, SHARED_KEY: SHARED_KEY, PENDING_KEY: PENDING_KEY, SEED_URL: SEED_URL };
});
