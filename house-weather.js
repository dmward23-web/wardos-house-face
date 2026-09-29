/* House Face · HUBOVAL1 oval weather pill · Overland Park / 147th · client-side, no key.
   Primary: Open-Meteo. Fallback: wttr.in. Kids-safe · no $. */
(function (global) {
  "use strict";
  var LAT = 38.884;
  var LON = -94.671;
  var PLACE = "Overland Park · 147th";
  var CACHE_KEY = "house-wx:v2";
  var CACHE_MS = 20 * 60 * 1000;

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
    var when = (s === i0 ? "now" : tmrw + hourLabel(t[s])) + "–" + hourLabel(endIso);
    return { text: "Rain " + when + " · " + Math.round(maxP) + "%", wet: true };
  }

  function fromOpenMeteo() {
    var url = "https://api.open-meteo.com/v1/forecast"
      + "?latitude=" + LAT + "&longitude=" + LON
      + "&current=temperature_2m,weather_code"
      + "&daily=temperature_2m_max,temperature_2m_min"
      + "&hourly=precipitation_probability,precipitation"
      + "&temperature_unit=fahrenheit&precipitation_unit=inch&timezone=America%2FChicago&forecast_days=2";
    return fetch(url, { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("om " + r.status);
      return r.json();
    }).then(function (j) {
      var code = (j.current && j.current.weather_code) || 0;
      var pair = WMO[code] || ["Outside", "🌤"];
      return {
        temp: Math.round(j.current.temperature_2m),
        condition: pair[0],
        icon: pair[1],
        high: Math.round(j.daily.temperature_2m_max[0]),
        low: Math.round(j.daily.temperature_2m_min[0]),
        rain: rainOutlook(j.hourly, j.current && j.current.time),
        place: PLACE,
        source: "open-meteo"
      };
    });
  }

  function fromWttr() {
    return fetch("https://wttr.in/Overland+Park?format=j1", { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("wttr " + r.status);
      return r.json();
    }).then(function (j) {
      var c = j.current_condition[0];
      var d = j.weather[0];
      return {
        temp: Number(c.temp_F),
        condition: (c.weatherDesc && c.weatherDesc[0] && c.weatherDesc[0].value) || "Outside",
        icon: "🌤",
        high: Number(d.maxtempF),
        low: Number(d.mintempF),
        place: PLACE,
        source: "wttr"
      };
    });
  }

  function load(cb) {
    var cached = readCache();
    if (cached) { cb(null, cached); return; }
    fromOpenMeteo().then(function (d) {
      writeCache(d); cb(null, d);
    }).catch(function () {
      return fromWttr().then(function (d) {
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
      + (data.rain ? '<div class="wx-rain' + (data.rain.wet ? ' is-wet' : '') + '">' + (data.rain.wet ? "☂ " : "") + data.rain.text + "</div>" : "")
      + "</div>";
    el.classList.toggle("has-rain", !!(data.rain && data.rain.wet));
  }

  function mount(selector) {
    var el = typeof selector === "string" ? document.querySelector(selector) : selector;
    if (!el) return;
    el.setAttribute("aria-label", "Weather · " + PLACE);
    el.classList.add("wx-card", "wx-live");
    el.innerHTML =
      '<div class="wx-hdr-ico" aria-hidden="true">🌤</div>'
      + '<div class="wx-hdr-text wx-text">'
      + '<div class="wx-kicker">Weather</div>'
      + '<div class="wx-line"><span class="wx-temp">…</span><span class="wx-cond">loading</span></div>'
      + '<div class="wx-sub"><i class="hdr-live-dot" aria-hidden="true"></i>LIVE</div>'
      + "</div>";
    load(function (err, data) {
      if (err || !data) {
        el.classList.remove("is-live");
        el.innerHTML =
          '<div class="wx-hdr-ico" aria-hidden="true">🌤</div>'
          + '<div class="wx-hdr-text wx-text">'
          + '<div class="wx-kicker">Weather</div>'
          + '<div class="wx-line"><span class="wx-temp">—</span><span class="wx-cond">glance later</span></div>'
          + '<div class="wx-sub">retry</div>'
          + "</div>";
        return;
      }
      paint(el, data);
    });
    /* RAINLINE1 · wall stays open all day: repaint every 20 min */
    if (!el.__wxTimer) {
      el.__wxTimer = setInterval(function () {
        load(function (err, data) { if (!err && data) paint(el, data); });
      }, CACHE_MS);
    }
  }

  global.HouseWeather = { load: load, paint: paint, mount: mount, PLACE: PLACE };
})(typeof window !== "undefined" ? window : globalThis);
