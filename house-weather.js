/* House Face · HUBOVAL1 oval weather pill · house area (PRIVFEED1 · city-level coords, ~1 km) · client-side, no key.
   Primary: Open-Meteo. Fallback: wttr.in. Kids-safe · no $. */
(function (global) {
  "use strict";
  var LAT = 38.88;
  var LON = -94.67;
  var PLACE = ""; /* P1FIX · no city name on glass or in aria text */
  var CACHE_KEY = "house-wx:v4";
  var CACHE_MS = 10 * 60 * 1000;

  var WMO = {
    0: ["Clear", "☀"], 1: ["Mostly clear", "☀"], 2: ["Partly cloudy", "⛅"],
    3: ["Cloudy", "☁"], 45: ["Fog", "🌫"], 48: ["Fog", "🌫"],
    51: ["Drizzle", "🌦"], 53: ["Drizzle", "🌦"], 55: ["Drizzle", "🌦"],
    61: ["Rain", "🌧"], 63: ["Rain", "🌧"], 65: ["Heavy rain", "🌧"],
    71: ["Snow", "❄"], 73: ["Snow", "❄"], 75: ["Snow", "❄"],
    80: ["Showers", "🌦"], 81: ["Showers", "🌦"], 82: ["Showers", "🌧"],
    95: ["Storms", "⛈"], 96: ["Storms", "⛈"], 99: ["Storms", "⛈"]
  };

  function readCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (!o || !o.at || (Date.now() - o.at) > CACHE_MS) return null;
      return o.data;
    } catch (e) { return null; }
  }
  function writeCache(data) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data: data })); } catch (e) { /* */ }
  }


  /* RAINLINE1 · will it rain in the next 24h, and when (Open-Meteo hourly, CT) */
  function hourLabel(iso) {
    var h = Number(String(iso).slice(11, 13));
    var ap = h < 12 ? "a" : "p";
    var hh = h % 12 === 0 ? 12 : h % 12;
    return hh + ap;
  }
  function rainOutlook(hourly, nowIso) {
    if (!hourly || !hourly.time) return null;
    var t = hourly.time, pp = hourly.precipitation_probability || [], pr = hourly.precipitation || [];
    var nowKey = String(nowIso || "").slice(0, 13);
    var i0 = 0;
    for (var k = 0; k < t.length; k++) { if (String(t[k]).slice(0, 13) >= nowKey) { i0 = k; break; } }
    var iEnd = Math.min(t.length, i0 + 24);
    function wet(i) { return (pp[i] || 0) >= 40 || (pr[i] || 0) >= 0.02; }
    function damp(i) { return (pp[i] || 0) >= 30 || (pr[i] || 0) > 0; }
    var s = -1;
    for (var i = i0; i < iEnd; i++) { if (wet(i)) { s = i; break; } }
    if (s < 0) return { text: "No rain next 24 hrs", wet: false };
    var e = s, maxP = pp[s] || 0;
    while (e + 1 < t.length && damp(e + 1)) { e++; if ((pp[e] || 0) > maxP) maxP = pp[e]; }
    var dayNow = String(t[i0]).slice(0, 10);
    var tmrw = String(t[s]).slice(0, 10) !== dayNow ? "Tmrw " : "";
    var endIso = t[e + 1] || t[e];
    var when = (s === i0 ? "now" : tmrw + hourLabel(t[s])) + " to " + hourLabel(endIso); /* SCHOOLKEY2 · no en dash on glass */
    return { text: "Rain " + when + " · " + Math.round(maxP) + "%", wet: true };
  }

  function fromOpenMeteo() {
    var url = "https://api.open-meteo.com/v1/forecast"
      + "?latitude=" + LAT + "&longitude=" + LON
      + "&current=temperature_2m,weather_code,is_day"
      + "&daily=temperature_2m_max,temperature_2m_min"
      + "&hourly=precipitation_probability,precipitation"
      + "&temperature_unit=fahrenheit&precipitation_unit=inch&timezone=America%2FChicago&forecast_days=2";
    return fetch(url, { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("om " + r.status);
      return r.json();
    }).then(function (j) {
      var code = (j.current && j.current.weather_code) || 0;
      var pair = WMO[code] || ["Outside", "🌤"];
      /* AUDIT1 · no sun icon after dark */
      var night = j.current && j.current.is_day === 0;
      var icon = night && (pair[1] === "☀" || pair[1] === "⛅") ? (pair[1] === "☀" ? "🌙" : "☁") : pair[1];
      return {
        temp: Math.round(j.current.temperature_2m),
        condition: pair[0],
        icon: icon,
        high: Math.round(j.daily.temperature_2m_max[0]),
        low: Math.round(j.daily.temperature_2m_min[0]),
        rain: rainOutlook(j.hourly, j.current && j.current.time),
        place: PLACE,
        code: code,
        source: "open-meteo"
      };
    });
  }

  function fromWttr() {
    return fetch("https://wttr.in/" + LAT + "," + LON + "?format=j1", { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("wttr " + r.status);
      return r.json();
    }).then(function (j) {
      var c = j.current_condition[0];
      var d = j.weather[0];
      return {
        temp: Number(c.temp_F),
        condition: (c.weatherDesc && c.weatherDesc[0] && c.weatherDesc[0].value) || "Outside",
        icon: /snow/i.test(c.weatherDesc && c.weatherDesc[0] && c.weatherDesc[0].value) ? "❄"
          : /thunder|storm/i.test(c.weatherDesc && c.weatherDesc[0] && c.weatherDesc[0].value) ? "⛈"
          : /rain|drizzle|shower/i.test(c.weatherDesc && c.weatherDesc[0] && c.weatherDesc[0].value) ? "🌧"
          : /cloud|overcast/i.test(c.weatherDesc && c.weatherDesc[0] && c.weatherDesc[0].value) ? "☁"
          : "☀",
        high: Number(d.maxtempF),
        low: Number(d.mintempF),
        place: PLACE,
        source: "wttr"
      };
    });
  }

  /* RAINNOW1 · the forecast model misses a storm that's already here. Check the
   * real weather station (the nearest NWS airport station, a few miles
   * from home) and trust it for "is it raining right now". */
  var OBS_URL = "https://api.weather.gov/stations/KOJC/observations/latest";
  /* A hung station request must not hold the plate on the LIVE placeholder. */
  function within(ms, promise) {
    return new Promise(function (resolve, reject) {
      var done = false;
      var timer = setTimeout(function () {
        if (done) return;
        done = true;
        reject(new Error("wx timeout"));
      }, ms);
      promise.then(function (v) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(v);
      }, function (err) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        reject(err);
      });
    });
  }
  function fromObs() {
    return within(2500, fetch(OBS_URL, { cache: "no-store", headers: { Accept: "application/geo+json" } }).then(function (r) {
      if (!r.ok) throw new Error("obs " + r.status);
      return r.json();
    }).then(function (j) {
      var p = j && j.properties;
      if (!p || !p.timestamp) return null;
      if (Date.now() - Date.parse(p.timestamp) > 100 * 60 * 1000) return null;
      var txt = String(p.textDescription || "");
      var c = p.temperature && p.temperature.value;
      return { text: txt, tempF: c == null ? null : Math.round(c * 9 / 5 + 32) };
    })).catch(function () { return null; });
  }
  function rainyText(t) { return /rain|shower|thunder|storm|drizzle/i.test(t || ""); }
  function mergeObs(d, obs, omCode) {
    var nowWet = (obs && rainyText(obs.text)) || (omCode >= 51 && omCode < 70) || omCode >= 80;
    if (obs && obs.text) {
      d.condition = obs.text.replace(/^Light /, "Light ").slice(0, 22);
      if (rainyText(obs.text)) d.icon = /thunder|storm/i.test(obs.text) ? "⛈" : "🌧";
    }
    if (obs && obs.tempF != null) d.temp = obs.tempF;
    if (nowWet) {
      var later = d.rain && d.rain.wet && / now/.test(d.rain.text) ? d.rain.text.replace(/^Rain now/, "Raining now") : "Raining now";
      d.rain = { text: later, wet: true };
    }
    return d;
  }

  /* P1FIX B73 (wall re-judge) · dark = the sun is below the horizon at the house (solar elevation under -0.833 deg,
     NOAA low-precision formula), so 6:41 AM in October (before sunrise) gets a moon, not a sun. */
  function sunDown(now) {
    var rad = Math.PI / 180, ms = now.getTime();
    var n = ms / 86400000 + 2440587.5 - 2451545.0;            /* days since J2000 */
    var L = (280.460 + 0.9856474 * n) % 360, g = ((357.528 + 0.9856003 * n) % 360) * rad;
    var lam = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * rad, eps = (23.439 - 0.0000004 * n) * rad;
    var ra = Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam)), dec = Math.asin(Math.sin(eps) * Math.sin(lam));
    var gmst = (18.697374558 + 24.06570982441908 * n) % 24, lst = (gmst * 15 + Number(LON)) * rad;
    var ha = lst - ra, lat = Number(LAT) * rad;
    var el = Math.asin(Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(ha)) / rad;
    return el < -0.833;
  }
  /* P1FIX B73 · no sun after dark on any source or cached reading (a cached afternoon reading painted a sun at 9:48 PM).
     Night = sunDown() (solar elevation under -0.833 deg at the house); sun and sun-cloud icons read as moon and cloud. */
  function nightIcon(d) {
    if (!d || !d.icon) return d;
    if (!sunDown(new Date())) return d;
    var map = { "\u2600": "\ud83c\udf19", "\u2600\ufe0f": "\ud83c\udf19", "\u26c5": "\u2601", "\ud83c\udf24": "\u2601", "\ud83c\udf24\ufe0f": "\u2601", "\ud83c\udf25": "\u2601" };
    if (!map[d.icon]) return d;
    var o = {}; for (var k in d) o[k] = d[k];
    o.icon = map[d.icon];
    return o;
  }
  function load(cb0) {
    var cb = function (err, d) { cb0(err, nightIcon(d)); };
    var cached = readCache();
    if (cached) { cb(null, cached); return; }
    Promise.all([within(4000, fromOpenMeteo()), fromObs()]).then(function (res) {
      var d = mergeObs(res[0], res[1], res[0].code);
      writeCache(d); cb(null, d);
    }).catch(function () {
      return within(4000, fromWttr()).then(function (d) {
        writeCache(d); cb(null, d);
      });
    }).catch(function (err) {
      cb(err || new Error("wx fail"), null);
    });
  }

  function paint(el, data) {
    if (!el || !data) return;
    var hi = (data.high != null && data.low != null)
      ? ("H " + data.high + "° · L " + data.low + "°")
      : "LIVE";
    var ico = data.icon || "🌤";
    el.classList.add("wx-card", "wx-live", "is-live");
    el.hidden = false; el.style.removeProperty("display");
    el.innerHTML =
      '<div class="wx-hdr-ico" aria-hidden="true">' + ico + "</div>"
      + '<div class="wx-hdr-text wx-text">'
      + '<div class="wx-kicker">Weather</div>'
      + '<div class="wx-line">'
      + '<span class="wx-temp">' + data.temp + "°</span>"
      + '<span class="wx-cond">' + data.condition + "</span>"
      + '<span class="wx-mode">OUT</span>'
      + "</div>"
      + '<div class="wx-sub"><i class="hdr-live-dot" aria-hidden="true"></i>' + hi + "</div>"
      + (data.rain ? '<div class="wx-rain' + (data.rain.wet ? ' is-wet' : '') + '">' + (data.rain.wet ? "☂ " : "") + '<span class="wx-rain-full">' + data.rain.text + '</span><span class="wx-rain-short" style="display:none">' + shortRain(data.rain.text) + "</span></div>" : "")
      + "</div>";
    el.classList.toggle("has-rain", !!(data.rain && data.rain.wet));
  }

  /* RAINSHORT1 · phone-size rain line: "Raining now–2a · 51%" -> "Rain till 2a" */
  function shortRain(t) {
    t = String(t || "");
    if (/^No rain/i.test(t)) return "No rain 24h";
    t = t.replace(/\s*·\s*\d+%$/, "");
    var m = t.match(/^Rain(?:ing)? now(?:\s+to\s+|[–-])(.+)$/i);
    if (m) return "Rain till " + m[1];
    return t;
  }

  function mount(selector) {
    var el = typeof selector === "string" ? document.querySelector(selector) : selector;
    if (!el) return;
    el.setAttribute("aria-label", "Weather");
    el.classList.add("wx-card", "wx-live");
    /* LAW8C1 · no empty pill while loading: the chip stays hidden until a real reading lands; a failed load stays hidden and is
       flagged on the element (data-wx-state="down") for the health checks, never drawn as a dash */
    if (!el.classList.contains("is-live")) { el.style.setProperty("display", "none", "important"); el.setAttribute("data-wx-state", "loading"); }
    el.innerHTML =
      '<div class="wx-hdr-ico" aria-hidden="true">🌤</div>'
      + '<div class="wx-hdr-text wx-text">'
      + '<div class="wx-kicker">Weather</div>'
      + '<div class="wx-line"><span class="wx-temp"></span><span class="wx-cond"></span></div>'
      + '<div class="wx-sub"><i class="hdr-live-dot" aria-hidden="true"></i>LIVE</div>'
      + "</div>";
    load(function (err, data) {
      if (!(err || !data)) { el.style.removeProperty("display"); el.setAttribute("data-wx-state", "live"); }
      if (err || !data) {
        el.classList.remove("is-live");
        el.setAttribute("data-wx-state", "down"); el.style.setProperty("display", "none", "important"); /* P1FIX · offline: no icon-only row */
        el.innerHTML =
          '<div class="wx-hdr-ico" aria-hidden="true">🌤</div>'
          + '<div class="wx-hdr-text wx-text">'
          + '<div class="wx-kicker">Weather</div>'
          + '<div class="wx-line"><span class="wx-temp"></span><span class="wx-cond">Weather later</span></div>'
          + '<div class="wx-sub">retry</div>'
          + "</div>";
        el.style.setProperty("display", "none", "important"); /* NODATA1 · no reading = no chip (never show a dash); comes back on the next good load. NODATA3 · !important so the phone header's display:flex !important can't show a bare dash */
        return;
      }
      paint(el, data);
    });
    /* RAINLINE1 · wall stays open all day: repaint every 20 min */
    if (!el.__wxTimer) {
      el.__wxTimer = setInterval(function () {
        load(function (err, data) { if (!err && data) { el.style.removeProperty("display"); paint(el, data); } });
      }, CACHE_MS);
    }
  }

  global.HouseWeather = { load: load, paint: paint, mount: mount, PLACE: PLACE };
})(typeof window !== "undefined" ? window : globalThis);
