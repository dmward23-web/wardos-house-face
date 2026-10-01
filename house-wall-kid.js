/* KIDLAYER3 · house-wall-kid.js · branch wall-redesign-1 · loaded only by wall.html (not deployed).
   Kid layer v3 (Dan, Oct 1 6:03 PM): the kid's name is the button (check-in), a chore-done tap fills today's mark,
   and a 2-second hall light flash through the EXISTING Kasa client (HouseLights.setLight). One shared pattern, no
   per-kid color, no new scene. No key -> zero requests and no flash. One-use unlocks + seats read from Atlas's data (unlocks.json, kid-seats.json).
   Never touches the MUSTS book (house-checkoffs:*), the bank (house-bank:*), or any jar. Per-device state only. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.HouseWallKid = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var TZ = "America/Chicago";
  var KIDS = [{ id: "ainsley", name: "Ainsley" }, { id: "hayes", name: "Hayes" }, { id: "harris", name: "Harris" }];
  var NEVER_FLASH = ["harris-room"]; /* Dan: don't use Harris's Room */
  var DEFAULTS = { hallFlashLightIds: [], flashMs: 2000, flashCooldownMs: 15000 };
  var MARK_PREFIX = "wardos-wall-mark:";       /* wall-only daily mark; NOT house-checkoffs (that book banks toward the jar) */
  var WHO_KEY = "wardos-wall-whohome";          /* Atlas who-home shape, per device */
  var UNLOCK_PREFIX = "wardos-wall-unlock:";

  function nowMs(n) { return n == null ? Date.now() : (n instanceof Date ? n.getTime() : Number(n)); }
  function parse(iso) { var t = Date.parse(iso || ""); return isFinite(t) ? t : 0; }
  function ctIso(ms) { return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms)); }
  function houseDay(ms) { return ctIso(ms - 3 * 60 * 60 * 1000); } /* Atlas: resets 3:00 AM CT */
  function kidById(id) { return KIDS.filter(function (k) { return k.id === id; })[0] || null; }
  function memStore(init) { var m = Object.assign({}, init || {}); return { get: function (k) { return k in m ? m[k] : null; }, set: function (k, v) { m[k] = String(v); }, dump: function () { return m; } }; }

  function flashIds(cfg) {
    var ids = (cfg && Array.isArray(cfg.hallFlashLightIds)) ? cfg.hallFlashLightIds : [];
    return ids.filter(function (id, i) { return typeof id === "string" && NEVER_FLASH.indexOf(id) < 0 && ids.indexOf(id) === i; });
  }

  /* Hall flash: capture each light's prior on/off, invert for flashMs, then restore exactly. Debounced:
     no new flash while one runs or within flashCooldownMs of the last one. Unknown prior (on:null) -> that light is skipped. */
  function createFlash(deps) {
    deps = deps || {};
    var cfg = Object.assign({}, DEFAULTS, deps.config || {});
    var ids = flashIds(cfg);
    var now = deps.now || function () { return Date.now(); };
    var later = deps.setTimeout || function (fn, ms) { return setTimeout(fn, ms); };
    var L = deps.lights;
    var busy = false, lastAt = -Infinity;
    function hasKey() { return !!(deps.hasKey && deps.hasKey()); }
    function flash() {
      if (!ids.length) return { sent: 0, reason: "no hall light confirmed" };
      if (!hasKey() || !L || typeof L.setLight !== "function") return { sent: 0, reason: "NEED KEY" };
      if (typeof L.canWrite === "function" && !L.canWrite()) return { sent: 0, reason: "lights offline" };
      var t = now();
      if (busy || t - lastAt < cfg.flashCooldownMs) return { sent: 0, reason: "debounced" };
      var eff = (typeof L.effectiveLights === "function" ? L.effectiveLights() : null) || {};
      var byId = {};
      (eff.lights || []).forEach(function (x) { byId[x.id] = x; });
      var prior = ids.map(function (id) { var x = byId[id]; return x && typeof x.on === "boolean" ? { id: id, on: x.on } : null; }).filter(Boolean);
      if (!prior.length) return { sent: 0, reason: "prior state unknown" };
      busy = true; lastAt = t;
      prior.forEach(function (p) { L.setLight(p.id, { on: !p.on }); });
      later(function () {
        prior.forEach(function (p) { L.setLight(p.id, { on: p.on }); });
        busy = false; lastAt = now();
      }, cfg.flashMs);
      return { sent: prior.length * 2, prior: prior };
    }
    return { flash: flash, ids: ids, config: cfg };
  }

  /* Today's mark (wall-only). First mark of the day returns first:true (caller flashes once; repeat taps don't). */
  function markKey(kidId, ms) { return MARK_PREFIX + kidId + ":" + ctIso(ms); }
  function isMarked(store, kidId, now) { return !!store.get(markKey(kidId, nowMs(now))); }
  function choreDone(store, kidId, now) {
    if (!kidById(kidId)) return { marked: false, first: false };
    var t = nowMs(now), k = markKey(kidId, t);
    if (store.get(k)) return { marked: true, first: false };
    store.set(k, new Date(t).toISOString());
    return { marked: true, first: true };
  }

  /* Check-in: Atlas's who-home shape {date, resetsAt?, kids:[{id,name,checkedInAt}]} kept per device. */
  function readWho(store, now) {
    var day = houseDay(nowMs(now)), j = null;
    try { j = JSON.parse(store.get(WHO_KEY) || "null"); } catch (e) { j = null; }
    if (!j || j.date !== day || !Array.isArray(j.kids)) j = { date: day, kids: KIDS.map(function (k) { return { id: k.id, name: k.name, checkedInAt: null }; }) };
    return j;
  }
  function checkIn(store, kidId, now) {
    var t = nowMs(now), j = readWho(store, t);
    if (!kidById(kidId)) return j;
    j.kids = j.kids.map(function (k) { return k.id === kidId && !k.checkedInAt ? { id: k.id, name: k.name, checkedInAt: new Date(t).toISOString() } : k; });
    store.set(WHO_KEY, JSON.stringify(j));
    return j;
  }
  /* file (data/who-home.json) + this device: a real check-in from either counts. */
  function mergeWho(fileJson, localJson) {
    var base = localJson || fileJson; if (!base) return null;
    var out = { date: base.date, kids: KIDS.map(function (k) {
      function at(j) { var x = j && j.kids && j.kids.filter(function (y) { return y && (y.id === k.id || y.name === k.name); })[0]; return x && x.checkedInAt || null; }
      var a = localJson && localJson.date === base.date ? at(localJson) : null;
      var b = fileJson && fileJson.date === base.date ? at(fileJson) : null;
      return { id: k.id, name: k.name, checkedInAt: a || b || null };
    }) };
    return out;
  }

  /* One-use unlocks · Atlas's data (wall-redesign-atlas ATLASLANE4/5, docs/wall-redesign/ATLAS-DATA-LANE.md):
     data/unlocks.json {asOfIso, generatedAt, week:{id,startsAt,endsAt}, lit:[{id, seat, control, tile, choices?, uses:1, earnedWeek, copy}], source}
     Only lit entries are listed (dark / spent = absent). Missing / not today's / generatedAt > 24 h / no lit[] -> nothing shown (never inferred).
     Spends: Atlas's unlock-uses shape {note, uses:[{unlock, weekId (= earnedWeek), usedAt, choice?}]}, kept per device under USES_KEY. */
  var USES_KEY = "wardos-wall-unlock-uses";
  var USES_NOTE = "Per-device until a shared write path is approved. Each spend: {unlock, weekId (the week that earned it), usedAt, choice?}.";
  var CONTROL = { /* Atlas control / choice id -> the board it opens. Unknown ids are not drawn. */
    "dinner-vote": { label: "Dinner vote", href: "sheet-dinner.html" },
    "weekend-pick": { label: "Weekend fun", href: "sheet-weekend.html" },
    "gallery-photo": { label: "Gallery photo", href: "sheet-gallery-hero.html" }
  };
  var SEAT_KID = { Harris: "harris", Hayes: "hayes", Ainsley: "ainsley", House: "house" };
  function fileValid(j, now) {
    var t = nowMs(now);
    if (!j || typeof j !== "object" || j.asOfIso !== ctIso(t)) return false;
    var g = parse(j.generatedAt);
    return !!g && t - g <= 24 * 60 * 60 * 1000 && t - g >= -5 * 60 * 1000;
  }
  function readUses(store) {
    var u = null;
    try { u = JSON.parse(store.get(USES_KEY) || "null"); } catch (e) { u = null; }
    return u && Array.isArray(u.uses) ? u : { note: USES_NOTE, uses: [] };
  }
  function isSpent(uses, id, week) { return uses.uses.some(function (x) { return x && x.unlock === id && x.weekId === week; }); }
  function unlocks(j, store, now) {
    if (!fileValid(j, now) || !Array.isArray(j.lit)) return [];
    var uses = readUses(store);
    return j.lit.filter(function (u) { return u && typeof u.id === "string" && SEAT_KID[u.seat] && u.earnedWeek; }).map(function (u) {
      var keys = Array.isArray(u.choices) && u.choices.length ? u.choices : [u.control];
      var choices = keys.filter(function (k) { return CONTROL[k]; }).map(function (k) {
        return { key: k, label: keys.length > 1 && k === "weekend-pick" ? "Weekend pick" : CONTROL[k].label, href: CONTROL[k].href };
      });
      return { id: u.id, seat: u.seat, kid: SEAT_KID[u.seat], copy: String(u.copy || ""), earnedWeek: u.earnedWeek,
        multi: keys.length > 1, choices: choices, used: isSpent(uses, u.id, u.earnedWeek) };
    }).filter(function (u) { return u.choices.length; });
  }
  /* Spend: one use (Ainsley's two choices share it). Returns the href to open, or null when spent / not lit / bad choice. */
  function useUnlock(j, store, id, choiceKey, now) {
    var u = unlocks(j, store, now).filter(function (x) { return x.id === id; })[0];
    if (!u || u.used) return null;
    var ch = u.choices.filter(function (c) { return c.key === choiceKey; })[0] || (!u.multi ? u.choices[0] : null);
    if (!ch) return null;
    var uses = readUses(store), rec = { unlock: u.id, weekId: u.earnedWeek, usedAt: new Date(nowMs(now)).toISOString() };
    if (u.multi) rec.choice = ch.key;
    uses.uses.push(rec);
    store.set(USES_KEY, JSON.stringify(uses));
    return ch.href;
  }

  /* Seats · data/kid-seats.json (Atlas): {asOfIso, generatedAt, week, quiet, seats:{harris:{mission,today}, hayes:{row,countdown}, ainsley:{week}}, usTogether:{lit}}.
     Read only. Not today's / stale / quiet -> no seat extras (the name + Chore done still work). */
  var MARKS = ["closed", "empty", "ahead", "off"];
  function seats(j, now) {
    if (!fileValid(j, now) || !j.seats || typeof j.seats !== "object" || j.quiet === true) return null;
    var out = {}, h = j.seats.harris, y = j.seats.hayes, a = j.seats.ainsley;
    if (h && h.mission && typeof h.mission.word === "string" && h.mission.word)
      out.harris = { word: h.mission.word, copy: String(h.mission.copy || ""), closedToday: !!(h.today && h.today.closed === true) };
    if (y && Array.isArray(y.row) && y.row.length === 7 && y.row.every(function (r) { return r && MARKS.indexOf(r.mark) >= 0 && typeof r.dow === "string"; }))
      out.hayes = { row: y.row.map(function (r) { return { dow: r.dow, mark: r.mark, today: r.today === true }; }),
        countdown: y.countdown && typeof y.countdown.copy === "string" ? y.countdown.copy : null };
    if (a && a.week) out.ainsley = { weekClosed: a.week.closed === true };
    return out;
  }

  return { KIDS: KIDS, NEVER_FLASH: NEVER_FLASH, DEFAULTS: DEFAULTS, MARK_PREFIX: MARK_PREFIX, WHO_KEY: WHO_KEY, UNLOCK_PREFIX: UNLOCK_PREFIX,
    memStore: memStore, flashIds: flashIds, createFlash: createFlash, markKey: markKey, isMarked: isMarked, choreDone: choreDone,
    houseDay: houseDay, readWho: readWho, checkIn: checkIn, mergeWho: mergeWho,
    USES_KEY: USES_KEY, CONTROL: CONTROL, fileValid: fileValid, readUses: readUses, unlocks: unlocks, useUnlock: useUnlock, seats: seats };
});
