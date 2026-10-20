/* LIVING HOUSE · rhythm.js · COLLECT ONLY. A device-local log of weekday and minute.
   observe() never returns a light, a cloud, or a path. decide() is always idle.
   Titles, names, and places are not stored. */
(function (root) {
  "use strict";
  var KEY = "lh-rhythm-v1";
  var MAX = 48;
  function read(storage) {
    try {
      var raw = storage && storage.getItem(KEY);
      var j = raw ? JSON.parse(raw) : null;
      var rows = j && Array.isArray(j.rows) ? j.rows : [];
      return rows.filter(function (r) { return r && typeof r.wd === "number" && typeof r.min === "number"; }).slice(-MAX);
    } catch (_) { return []; }
  }
  function write(storage, rows) {
    try { storage.setItem(KEY, JSON.stringify({ v: 1, mode: "collect", rows: rows })); } catch (_) {}
  }
  function observe(info, storage) {
    var rows = read(storage);
    if (info && typeof info.wd === "number" && info.wd >= 0 && info.wd <= 6 && typeof info.min === "number" && info.min >= 0 && info.min < 1440) {
      var slot = { wd: info.wd, min: Math.floor(info.min) };
      var last = rows[rows.length - 1];
      if (!last || last.wd !== slot.wd || last.min !== slot.min) {
        rows.push(slot);
        if (rows.length > MAX) rows = rows.slice(-MAX);
        write(storage, rows);
      }
    }
    return { mode: "collect", act: false, lights: false, clouds: false, rows: rows };
  }
  function decide() { return { act: false, lights: false, clouds: false, mode: "collect" }; }
  var api = { KEY: KEY, observe: observe, decide: decide, read: read };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.LHRhythm = api;
})(typeof window !== "undefined" ? window : globalThis);
