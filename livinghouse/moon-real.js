/* REALMOON1 · real moon, computed on-device with no fetch of its own; the only input from outside is the coarse sky cell
   (one decimal) that rides the hub's /wx reply (see cell() below); the file itself carries no location.
   Frame vendored from SunCalc (c) Vladimir Agafonkin, BSD-2-Clause (Meeus-based); moon series from Montenbruck & Pfleger MiniMoon and Meeus ch.47. */
(function (root) {
  "use strict";
  var PI = Math.PI, sin = Math.sin, cos = Math.cos, tan = Math.tan, asin = Math.asin, atan = Math.atan2, acos = Math.acos, rad = PI / 180;
  var dayMs = 864e5, J1970 = 2440588, J2000 = 2451545, e = rad * 23.4397;
  /* LIVEWX2 · no location literal in the client: the coarse sky cell comes from the hub's /wx reply (the scene caches it
     as localStorage wxsky). Before the first reply: the time zone's own meridian (standard offset x 15 deg) at a mid latitude. */
  var TZCELL = { lat: 40, lng: -new Date(new Date().getFullYear(), 0, 1).getTimezoneOffset() / 4 }, SET = null;
  function cell() {
    if (SET) return SET;
    try { var s = JSON.parse(root.localStorage.getItem("wxsky") || "null"); if (s && isFinite(s.lat) && isFinite(s.lon)) return { lat: +s.lat, lng: +s.lon }; } catch (_) { /* none yet */ }
    return TZCELL;
  }
  function setCell(c) { SET = c && isFinite(c.lat) && isFinite(c.lon) ? { lat: Math.round(c.lat * 10) / 10, lng: Math.round(c.lon * 10) / 10 } : null; CACHE = null; }
  function toDays(d) { return d.valueOf() / dayMs - 0.5 + J1970 - J2000; }
  function ra(l, b) { return atan(sin(l) * cos(e) - tan(b) * sin(e), cos(l)); }
  function dec(l, b) { return asin(sin(b) * cos(e) + cos(b) * sin(e) * sin(l)); }
  function azimuth(H, phi, d) { return atan(sin(H), cos(H) * sin(phi) - tan(d) * cos(phi)); }
  function altitude(H, phi, d) { return asin(sin(phi) * sin(d) + cos(phi) * cos(d) * cos(H)); }
  function sidereal(d, lw) { return rad * (280.46061837 + 360.98564736629 * d) - lw; }   /* GMST (IAU 1982), UT days */
  function solarM(d) { return rad * (357.5291 + 0.98560028 * d); }
  function eclLng(M) { var C = rad * (1.9148 * sin(M) + 0.02 * sin(2 * M) + 0.0003 * sin(3 * M)); return M + C + rad * 102.9372 + PI; }
  function sunCoords(d) { var L = eclLng(solarM(d)); return { dec: dec(L, 0), ra: ra(L, 0) }; }
  /* Moon: Montenbruck & Pfleger MiniMoon series (about 1 arcmin) + Meeus ch.47 distance terms */
  function frac(x) { return x - Math.floor(x); }
  function moonCoords(d) {
    var T = (d + 69.2 / 86400) / 36525, P2 = 2 * PI, ARC = 206264.806;
    var L0 = frac(0.606433 + 1336.855225 * T), l = P2 * frac(0.374897 + 1325.552410 * T), ls = P2 * frac(0.993133 + 99.997361 * T);
    var D = P2 * frac(0.827361 + 1236.853086 * T), F = P2 * frac(0.259086 + 1342.227825 * T);
    var dL = 22640 * sin(l) - 4586 * sin(l - 2 * D) + 2370 * sin(2 * D) + 769 * sin(2 * l) - 668 * sin(ls) - 412 * sin(2 * F) - 212 * sin(2 * l - 2 * D)
      - 206 * sin(l + ls - 2 * D) + 192 * sin(l + 2 * D) - 165 * sin(ls - 2 * D) - 125 * sin(D) - 110 * sin(l + ls) + 148 * sin(l - ls) - 55 * sin(2 * F - 2 * D);
    var S = F + (dL + 412 * sin(2 * F) + 541 * sin(ls)) / ARC, h = F - 2 * D;
    var N = -526 * sin(h) + 44 * sin(l + h) - 31 * sin(-l + h) - 23 * sin(ls + h) + 11 * sin(-ls + h) - 25 * sin(-2 * l + F) + 21 * sin(-l + F);
    var lam = P2 * frac(L0 + dL / 1296000), bet = (18520 * sin(S) + N) / ARC;
    var dist = 385000.56 - 20905.355 * cos(l) - 3699.111 * cos(2 * D - l) - 2955.968 * cos(2 * D) - 569.925 * cos(2 * l);
    return { ra: ra(lam, bet), dec: dec(lam, bet), dist: dist, lam: lam };
  }
  /* geometric altitude minus the standard rise altitude h0 = 0.7275 * parallax - 34' (Meeus 15) */
  function riseFn(date, lat, lng) {
    var lw = rad * -lng, phi = rad * lat, d = toDays(date), c = moonCoords(d), H = sidereal(d, lw) - c.ra;
    return altitude(H, phi, c.dec) - (0.7275 * asin(6378.14 / c.dist) - rad * 0.5667);
  }
  function position(date, lat, lng) {
    var C0 = cell(); lat = lat == null ? C0.lat : lat; lng = lng == null ? C0.lng : lng;
    var lw = rad * -lng, phi = rad * lat, d = toDays(date), c = moonCoords(d), H = sidereal(d, lw) - c.ra;
    var h = altitude(H, phi, c.dec);
    h = h + rad * 0.017 / tan(h + rad * 10.26 / (h + rad * 5.10));
    return { altitude: h, azimuth: azimuth(H, phi, c.dec) };
  }
  /* fraction lit, phase 0 new .25 first quarter .5 full .75 last; waxing = lit limb on the right (northern hemisphere) */
  function illumination(date) {
    var d = toDays(date || new Date()), s = sunCoords(d), m = moonCoords(d), sd = 149598000;
    var phi = acos(sin(s.dec) * sin(m.dec) + cos(s.dec) * cos(m.dec) * cos(s.ra - m.ra));
    var inc = atan(sd * sin(phi), m.dist - sd * cos(phi));
    var ang = atan(cos(s.dec) * sin(s.ra - m.ra), sin(s.dec) * cos(m.dec) - cos(s.dec) * sin(m.dec) * cos(s.ra - m.ra));
    /* LIVEWX2 (Alfred P3) · phase and waxing from the ecliptic elongation (moon minus sun longitude), so waxing flips AT the
       true full moon (Oct 25 2026 11:12 PM CDT), not hours late as the bright-limb angle sign did */
    /* the sun formula is J2000-equinox (fixed perihelion); MiniMoon is of-date: add general precession (1.3970 deg/century) to the sun */
    var el = ((m.lam - eclLng(solarM(d)) - rad * 1.3970 * d / 36525) % (2 * PI) + 2 * PI) % (2 * PI);
    var fr = (1 + cos(inc)) / 2, ph = el / (2 * PI);
    return { fraction: fr, phase: ph, waxing: ph < 0.5, angle: ang };
  }
  function hoursLater(d, h) { return new Date(d.valueOf() + h * dayMs / 24); }
  /* rise/set within the 24 h from t0 (use CT midnight of the civil day) */
  /* LIVEWX2 (Alfred P3) · t1 = the next CT midnight: the 25 h fall-back day (Nov 1) and the 23 h spring day scan their whole civil day */
  function times(t0, lat, lng, t1) {
    var C0 = cell(); lat = lat == null ? C0.lat : lat; lng = lng == null ? C0.lng : lng;
    var r = {}, step = 10 * 6e4, t = t0.valueOf(), f0 = riseFn(new Date(t), lat, lng), any = false, hi = f0;
    var n = Math.ceil(((t1 ? t1.valueOf() : t + dayMs) - t) / step);
    for (var k = 1; k <= n; k++) {
      var t1 = t0.valueOf() + k * step, f1 = riseFn(new Date(t1), lat, lng); hi = Math.max(hi, f1);
      if ((f0 < 0) !== (f1 < 0)) { var a = t1 - step, b = t1, fa = f0;      /* bisect to about 1 s */
        for (var j = 0; j < 20; j++) { var m = (a + b) / 2, fm = riseFn(new Date(m), lat, lng); if ((fm < 0) === (fa < 0)) { a = m; fa = fm; } else b = m; }
        var at = new Date(Math.round((a + b) / 2)); if (f0 < 0) { if (!r.rise) r.rise = at; } else if (!r.set) r.set = at; any = true; }
      f0 = f1;
    }
    if (!any) r[hi > 0 ? "alwaysUp" : "alwaysDown"] = true; return r;
  }
  /* CT civil midnight for a Date, DST-safe (same rule as scripts/ct-midnight.mjs) */
  function ctOffsetMinutes(civil) {
    var g = new Date(civil + "T06:00:00Z"), off = "";   /* 06:00Z is CT midnight hour, before the 2 AM switch, so the day's own midnight offset */
    try { off = (new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", timeZoneName: "shortOffset" }).formatToParts(g).filter(function (x) { return x.type === "timeZoneName"; })[0] || {}).value || ""; } catch (_) {}
    var m = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(off); return m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] || 0)) : -300;
  }
  function ctCivil(d) { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(d); }
  function ctMidnight(civil) { return new Date(new Date(civil + "T00:00:00Z").getTime() - ctOffsetMinutes(civil) * 6e4); }
  /* the board's moon: phase from now; up/down and arc t (0 at rise, 1 at set) from the sky cell */
  var CACHE = null;
  function state(now) {
    now = now || new Date(); var il = illumination(now), pos = position(now), up = pos.altitude > 0;
    var civ = ctCivil(now), t0 = ctMidnight(civ), rise = null, set = null;
    var ck = civ + "@" + cell().lat + "," + cell().lng; if (!CACHE || CACHE.day !== ck) { var tp = ctMidnight(ctCivil(new Date(t0.valueOf() - 12 * 36e5))), tn = ctMidnight(ctCivil(new Date(t0.valueOf() + 30 * 36e5))), tnn = ctMidnight(ctCivil(new Date(tn.valueOf() + 30 * 36e5)));
      CACHE = { day: ck, tt: [times(tp, null, null, t0), times(t0, null, null, tn), times(tn, null, null, tnn)] }; }   /* rise/set recomputed once per CT civil day (refresh at CT midnight) */
    CACHE.tt.forEach(function (x) {
      if (x.rise && x.rise <= now && (!rise || x.rise > rise)) rise = x.rise;
      if (x.set && x.set > now && (!set || x.set < set)) set = x.set; });
    if (!up) { rise = null; set = null;   /* moon down: report the NEXT pass (next rise, then the set after it) */
      CACHE.tt.forEach(function (x) { if (x.rise && x.rise > now && (!rise || x.rise < rise)) rise = x.rise; });
      if (rise) CACHE.tt.forEach(function (x) { if (x.set && x.set > rise && (!set || x.set < set)) set = x.set; }); }
    var t = up && rise && set ? Math.max(0, Math.min(1, (now - rise) / (set - rise))) : null;
    return { phase: il.phase, fraction: il.fraction, waxing: il.waxing, up: up, altitude: pos.altitude / rad, azimuth: pos.azimuth / rad, arc: t, rise: rise, set: set, day: civ, nextMidnight: ctMidnight(ctCivil(new Date(t0.valueOf() + 30 * 36e5))) };
  }
  var API = { illumination: illumination, position: position, times: times, state: state, ctMidnight: ctMidnight, ctCivil: ctCivil, cell: cell, setCell: setCell };
  if (typeof module === "object" && module.exports) module.exports = API; else root.RealMoonMath = API;
})(typeof window !== "undefined" ? window : this);
