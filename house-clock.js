/* House Face · America/Chicago clock — NEVER hardcode board day labels.
   All date strips / badges / "today" headers must call HouseClock. */
(function (global) {
  "use strict";
  var TZ = "America/Chicago";

  function parts(date) {
    var d = date || new Date();
    var map = {};
    try {
      new Intl.DateTimeFormat("en-US", {
        timeZone: TZ,
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true
      }).formatToParts(d).forEach(function (p) {
        if (p.type !== "literal") map[p.type] = p.value;
      });
    } catch (e) {
      /* fallback: treat local as CT (wall station is CT) */
      var wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()];
      var mo = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()];
      map = {
        weekday: wd,
        month: mo,
        day: String(d.getDate()),
        year: String(d.getFullYear()),
        hour: String(((d.getHours() + 11) % 12) + 1),
        minute: String(d.getMinutes()).padStart(2, "0"),
        dayPeriod: d.getHours() < 12 ? "AM" : "PM"
      };
    }
    return map;
  }

  function iso(date) {
    var p = parts(date);
    var m = String(p.month);
    /* formatToParts month is short name — rebuild via en-CA */
    try {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: TZ,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }).format(date || new Date()); /* YYYY-MM-DD */
    } catch (e) {
      var d = date || new Date();
      return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    }
  }

  function shortLabel(date) {
    var p = parts(date);
    return p.weekday + " " + p.month + " " + p.day;
  }

  function longLabel(date) {
    var p = parts(date);
    return p.weekday + " " + p.month + " " + p.day + " " + p.year;
  }

  function dow(date) {
    return parts(date).weekday;
  }

  function daypart(date) {
    var h;
    try {
      h = Number(new Intl.DateTimeFormat("en-US", {
        timeZone: TZ,
        hour: "numeric",
        hour12: false
      }).format(date || new Date()));
    } catch (e) {
      h = (date || new Date()).getHours();
    }
    if (h < 12) return "morning";
    if (h < 17) return "afternoon";
    return "evening";
  }

  function stamp(date) {
    return {
      tz: TZ,
      iso: iso(date),
      short: shortLabel(date),
      long: longLabel(date),
      dow: dow(date),
      daypart: daypart(date),
      year: parts(date).year
    };
  }

  global.HouseClock = {
    TZ: TZ,
    parts: parts,
    iso: iso,
    shortLabel: shortLabel,
    longLabel: longLabel,
    dow: dow,
    daypart: daypart,
    stamp: stamp,
    now: function () { return stamp(new Date()); }
  };
})(typeof window !== "undefined" ? window : globalThis);
