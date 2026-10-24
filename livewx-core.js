/* LIVEWX2 · livewx-core.js · the ONE weather parser and LiveWx shape, shared by the hub /wx route (server) and the boards (client).
   It holds no location: the hub keeps the coarse cell server-side and the client only ever calls /wx.
   parse(raw)  -> w        (raw = Open-Meteo {current, minutely_15}; metric, as the scene shaders expect)
   state(w)    -> 'clear'|'cloudy'|'fog'|'drizzle'|'downpour'|'storm'|'snow'
   toLiveWx(w, ts, stale, nowMs) -> {state, intensity, windMph, gustMph, windDirDeg (FROM), cloudPct, fog, wet, tempF, ts, stale, ageMin, code}
   code = the raw WMO weather code (null if unknown); lightning keys on it. This is the ONE LiveWx publisher (scene/wall lwPub and the
   hub /wx reply both build through toLiveWx); the field names match the ambient line's contract so no second publisher is needed.
   No reading = null everywhere: callers show no weather motion, never a calm stand-in. */
(function (root) {
  "use strict";
  var CURRENT = "temperature_2m,dew_point_2m,precipitation,rain,showers,snowfall,snow_depth,weather_code,cloud_cover,wind_speed_10m,wind_gusts_10m,wind_direction_10m,visibility,is_day";
  var MINUTELY = "precipitation,rain,snowfall,weather_code,visibility,wind_speed_10m,wind_gusts_10m";
  function num(v) { return typeof v === "number" && isFinite(v) ? v : null; }
  function parse(raw) {
    if (!raw || !raw.current) return null;
    var c = raw.current, m = raw.minutely_15 || {};
    var nx = function (k) { return m[k] && m[k].length > 1 ? num(m[k][1]) : null; };
    var per = (c.interval || 900) / 3600;
    var rainNow = ((c.rain || 0) + (c.showers || 0)) || c.precipitation || 0;
    var rainNx = nx("rain"); if (rainNx == null) rainNx = nx("precipitation"); if (rainNx == null) rainNx = rainNow;
    var ws = num(c.wind_speed_10m), wg = num(c.wind_gusts_10m);
    if (ws == null || num(c.temperature_2m) == null) return null;   /* a reading without wind or temperature is not a reading */
    return {
      /* LIVEWX2 (Alfred P2/P3) · no parser defaults: a value the feed did not send stays null (unknown), never 0 or "clear" */
      c: num(c.cloud_cover), code: num(c.weather_code),
      rain: Math.max(rainNow, (rainNx + rainNow) / 2) / per, snow: Math.max(c.snowfall || 0, nx("snowfall") || 0) / per,
      temp: c.temperature_2m, dew: num(c.dew_point_2m), vis: num(c.visibility),
      ws: ws, wg: wg == null ? null : Math.max(ws, wg),   /* gusts come from wind_gusts_10m only; none reported = null (unknown), never a multiple of the mean */
      wd: num(c.wind_direction_10m), depth: num(c.snow_depth), isDay: c.is_day === 1 ? 1 : c.is_day === 0 ? 0 : null
    };
  }
  function state(w) {
    var c = w.code == null ? -1 : w.code, lowVis = w.vis != null && w.vis < 1000;   /* null code / visibility = unknown, never a match */
    if (c >= 95) return "storm";
    if ((c >= 71 && c <= 77) || c === 85 || c === 86 || w.snow > 0.05) return "snow";
    if ((c >= 51 && c <= 57) || (w.rain > 0 && w.rain < 0.5)) return "drizzle";
    if (w.rain >= 0.5 || (c >= 61 && c <= 67) || (c >= 80 && c <= 82)) return "downpour";
    if (c === 45 || c === 48 || lowVis) return "fog";
    if (w.c != null && w.c >= 60) return "cloudy";
    return "clear";
  }
  var KMH_MPH = 0.621371;
  function toLiveWx(w, ts, stale, nowMs) {
    if (!w || !ts) return null;
    var st = state(w), now = typeof nowMs === "number" ? nowMs : Date.now();
    var intensity = st === "storm" || st === "downpour" ? Math.min(1, Math.sqrt(w.rain / 10)) : st === "drizzle" ? Math.min(1, 0.2 + w.rain)
      : st === "snow" ? Math.min(1, 0.25 + w.snow / 2) : st === "fog" ? Math.min(1, Math.max(0.3, w.vis == null ? 0.3 : 1 - w.vis / 4000)) : 0;
    return {
      state: st, intensity: intensity,
      windMph: Math.round(w.ws * KMH_MPH * 10) / 10, gustMph: w.wg == null ? null : Math.round(w.wg * KMH_MPH * 10) / 10, windDirDeg: w.wd,
      cloudPct: w.c == null ? null : Math.max(0, Math.min(100, w.c)), fog: st === "fog", wet: w.rain > 0 && st !== "snow",
      tempF: w.temp == null ? null : Math.round((w.temp * 9 / 5 + 32) * 10) / 10, ts: ts, stale: !!stale, ageMin: Math.max(0, Math.round((now - ts) / 6e4)), code: w.code == null ? null : w.code
    };
  }
  /* "12 min ago", "3 h ago", "2 d ago": the age a stale reading shows (Dan boards only; the kid boards stay digit-free) */
  function ageText(ms) { var m = Math.max(0, Math.round(ms / 6e4)); return m < 60 ? m + " min ago" : m < 48 * 60 ? Math.round(m / 60) + " h ago" : Math.round(m / 1440) + " d ago"; }
  /* /wx on this origin first (the hub serves the boards), then the pinned cams hub (HouseHub, HUBPIN1) for Pages-hosted
     boards. No URL input picks the target; no key is ever sent (the reply is public, coarse weather). */
  function wxUrls(win) {
    var u = ["/wx"];
    try { var H = (win && win.HouseHub) || (win && win.parent && win.parent.HouseHub), b = H && H.cams && H.cams();
      if (b && !/\.invalid$/.test(b) && b !== win.location.origin) u.push(String(b).replace(/\/+$/, "") + "/wx"); } catch (e) { /* cross-origin parent */ }
    return u;
  }
  function fetchWx(win, ms) {
    var urls = wxUrls(win || root), i = 0;
    function next() {
      if (i >= urls.length) return Promise.reject(new Error("no /wx reading"));
      var u = urls[i++], ac = typeof AbortController === "function" ? new AbortController() : null, t = ac && setTimeout(function () { ac.abort(); }, ms || 8000);
      return fetch(u, { cache: "no-store", signal: ac ? ac.signal : undefined }).then(function (r) { if (!r.ok) throw new Error("wx " + r.status); return r.json(); })
        .then(function (j) { clearTimeout(t); if (!j || !j.raw || !parse(j.raw)) throw new Error("no reading"); return j; })
        .catch(function () { clearTimeout(t); return next(); });
    }
    return next();
  }
  var api = { CURRENT: CURRENT, wxUrls: wxUrls, fetchWx: fetchWx, MINUTELY: MINUTELY, parse: parse, state: state, toLiveWx: toLiveWx, ageText: ageText };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.LiveWxCore = api;
})(typeof window !== "undefined" ? window : globalThis);
