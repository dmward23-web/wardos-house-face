/* House Face · HUBOVAL1 oval weather pill · Overland Park / 147th · client-side, no key.
   Primary: Open-Meteo. Fallback: wttr.in. Kids-safe · no $. */
(function (global) {
  "use strict";
  var LAT = 38.884;
  var LON = -94.671;
  var PLACE = "Overland Park · 147th";
  var CACHE_KEY = "house-wx:v1";
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

  function fromOpenMeteo() {
    var url = "https://api.open-meteo.com/v1/forecast"
      + "?latitude=" + LAT + "&longitude=" + LON
      + "&current=temperature_2m,weather_code"
      + "&daily=temperature_2m_max,temperature_2m_min"
      + "&temperature_unit=fahrenheit&timezone=America%2FChicago&forecast_days=1";
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
      + "</div>";
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
  }

  global.HouseWeather = { load: load, paint: paint, mount: mount, PLACE: PLACE };
})(typeof window !== "undefined" ? window : globalThis);
