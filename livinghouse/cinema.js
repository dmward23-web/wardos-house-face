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
  function consider(elapsedMs, opts) {
    opts = opts || {};
    var off = { on: false, video: false, drift: false, poster: false, src: "", posterUrl: opts.phone ? POSTER_P : POSTER_W, mode: "off" };
    if (opts.reduced) return off;
    if (!(+elapsedMs >= IDLE_MS)) return off;
    var posterUrl = opts.phone ? POSTER_P : POSTER_W;
    if (opts.caps !== true) return { on: true, video: false, drift: true, poster: true, src: "", posterUrl: posterUrl, mode: "poster" };
    return { on: true, video: true, drift: false, poster: true, src: opts.phone ? PHONE : WALL, posterUrl: posterUrl, mode: "video" };
  }
  var api = { IDLE_MS: IDLE_MS, WALL: WALL, PHONE: PHONE, POSTER_W: POSTER_W, POSTER_P: POSTER_P, consider: consider };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.LHCinema = api;
})(typeof window !== "undefined" ? window : globalThis);
