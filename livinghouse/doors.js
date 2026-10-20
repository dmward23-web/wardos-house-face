/* LIVING HOUSE · doors.js · one row per existing board page. The house scene is the nav.
   Labels are calm and short. Kid rows open a photoreal room, not the retired cartoon worlds.
   Browser: window.LHDoors. Node: module.exports. */
(function (g) {
  "use strict";
  var ROWS = [
    { id: "front", spot: "door", page: "../index.html", label: "Front door", aria: "Front door, the hub" },
    { id: "dad", spot: "lantern", page: "../sheet-dan.html", label: "Dad", aria: "Dad" },
    { id: "ainsley", spot: "window", page: "room.html?kid=ainsley", label: "Ainsley", aria: "Ainsley's room", kid: "ainsley" },
    { id: "hayes", spot: "window", page: "room.html?kid=hayes", label: "Hayes", aria: "Hayes's room", kid: "hayes" },
    { id: "harris", spot: "window", page: "room.html?kid=harris", label: "Harris", aria: "Harris's room", kid: "harris" },
    { id: "moon", spot: "moon", page: "../month.html", label: "Month", aria: "Month" },
    { id: "kitchen", spot: "kitchen", page: "../sheet-groceries.html", label: "Groceries", aria: "Groceries" },
    { id: "garage", spot: "garage", page: "room.html?door=garage", label: "Garage", aria: "Garage" },
    { id: "mail", spot: "mail", page: "../month-chat.html", label: "Mail", aria: "Mail" },
    { id: "chores", spot: "cauldron", page: "../sheet-chores.html", label: "Chores", aria: "Chores" },
    { id: "gate", spot: "gate", page: "../mercury-run.html", label: "Run", aria: "Run" },
    { id: "yard", spot: "yard", page: "yard.html", label: "Yard", aria: "Yard" },
    { id: "desk", spot: "yard-row", page: "../sheet-desk-gate.html", label: "Desk", aria: "Desk" },
    { id: "dinner", spot: "yard-row", page: "../sheet-dinner.html", label: "Dinner", aria: "Dinner" },
    { id: "frames", spot: "yard-row", page: "../sheet-gallery-hero.html", label: "Frames", aria: "Frames" },
    { id: "gallery", spot: "yard-row", page: "../sheet-gallery.html", label: "Gallery", aria: "Gallery" },
    { id: "home", spot: "yard-row", page: "../sheet-google-home.html", label: "Home", aria: "Home" },
    { id: "lights", spot: "yard-row", page: "../sheet-lights.html", label: "Lights", aria: "Lights" },
    { id: "load", spot: "yard-row", page: "../sheet-load-day.html", label: "Load day", aria: "Load day" },
    { id: "pack", spot: "yard-row", page: "../sheet-pack.html", label: "Pack", aria: "Pack" },
    { id: "heat", spot: "yard-row", page: "../sheet-sensi.html", label: "Heat", aria: "Heat" },
    { id: "music", spot: "yard-row", page: "../sheet-spotify.html", label: "Music", aria: "Music" },
    { id: "status", spot: "yard-row", page: "../sheet-status.html", label: "Status", aria: "Status" },
    { id: "today", spot: "yard-row", page: "../sheet-today.html", label: "Today", aria: "Today" },
    { id: "together", spot: "yard-row", page: "../sheet-us.html", label: "Together", aria: "Together" },
    { id: "ideas", spot: "yard-row", page: "../sheet-weekend.html", label: "Ideas", aria: "Ideas" },
    { id: "trips", spot: "yard-row", page: "../sheet-win.html", label: "Trips", aria: "Trips" },
    { id: "stars", spot: "yard-row", page: "../sheet-allowance.html", label: "Stars", aria: "Stars" },
    { id: "counts", spot: "yard-row", page: "../sheet-countdowns.html", label: "Countdowns", aria: "Countdowns" }
  ];
  /* room.html and yard.html carry their own House link. Every other page is opened with ?from=lh so the return chip can show. */
  function href(row) {
    var page = row.page;
    if (/^(?:room|yard)\.html(?:\?|$)/.test(page)) return page;
    return page + (page.indexOf("?") >= 0 ? "&" : "?") + "from=lh";
  }
  function rows() {
    return ROWS.map(function (r) { var o = {}; for (var k in r) o[k] = r[k]; o.href = href(r); return o; });
  }
  var api = { rows: rows, href: href };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  g.LHDoors = api;
})(typeof window !== "undefined" ? window : globalThis);
