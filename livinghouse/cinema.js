/* LIVING HOUSE · cinema.js · idle cinema state. The page measures untouched time with LHClock
   and passes it in. Videos are named here only; lh.js sets a src after caps.json says video:true.
   Reduced motion never plays and never drifts. A touch (elapsed forced under the idle mark) stops it. */
(function (root) {
  "use strict";
  var IDLE_MS = 60000;
  var WALL = "../night/media/loop-night-rain-calm-wall.mp4";
  var PHONE = "../night/media/loop-night-rain-calm-phone.mp4";
  var POSTER_W = "../night/media/poster/loop-night-rain-calm-wall.webp";
  var POSTER_P = "../night/media/poster/loop-night-rain-calm-phone.webp";
  /* V52 · Prism batch 5 loops (v52/loop[-night]-{wall,phone}.mp4, posters/<same>-poster.webp) win when caps.art lists them;
     the clip itself still needs caps video:true, the listed poster is the fallback. Unlisted: the night-media loop as before. */
  function v52(opts) {
    var h = opts.art, b = opts.artBase || ""; if (!h) return null;
    var k = "loop-" + (opts.lit ? "" : "night-") + (opts.phone ? "phone" : "wall");
    var po = h["posters/" + k + "-poster.webp"] ? b + "posters/" + k + "-poster.webp" : "";
    var v = h["v52/" + k + ".mp4"] ? b + "v52/" + k + ".mp4" : "";
    return po || v ? { po: po, v: v } : null;
  }
  function consider(elapsedMs, opts) {
    opts = opts || {};
    var P = v52(opts);
    if (P) { var r = consider(elapsedMs, { reduced: opts.reduced, phone: opts.phone, caps: opts.caps });
      if (P.po) r.posterUrl = P.po; if (r.video && P.v) r.src = P.v; return r; }
    var off = { on: false, video: false, drift: false, poster: false, src: "", posterUrl: opts.phone ? POSTER_P : POSTER_W, mode: "off" };
    if (opts.reduced) return off;
    if (!(+elapsedMs >= IDLE_MS)) return off;
    var posterUrl = opts.phone ? POSTER_P : POSTER_W;
    if (opts.caps !== true) return { on: true, video: false, drift: true, poster: true, src: "", posterUrl: posterUrl, mode: "poster" };
    return { on: true, video: true, drift: false, poster: true, src: opts.phone ? PHONE : WALL, posterUrl: posterUrl, mode: "video" };
  }
  var api = { IDLE_MS: IDLE_MS, WALL: WALL, PHONE: PHONE, POSTER_W: POSTER_W, POSTER_P: POSTER_P, consider: consider, v52: v52 };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.LHCinema = api;
})(typeof window !== "undefined" ? window : globalThis);
