/* LIVING HOUSE · lh-rules.js · pure text and date rules (browser: window.LHRules; node: module.exports). Unit tested in
   tests/lh-rules.test.mjs.
   glassTitle(s): shared-glass title cleanup, mirroring TEXTLAW1 in scripts/cal-from-events.mjs (codes, flight numbers,
     airport legs, em dashes, arrows, bracketed tags, private names read at run time) plus the L1 review rules: "A @ B" reads "A vs B", seat and row
     notes in brackets drop, a partner name never shows ("<Name> + Dan", "Dan+<Name>", trailing "with <Name>"), and a
     "· leave H:MM" tail drops (the leave belongs to the candle).
   Shared glass says Dad: Dan's own items read "Dad: ..." (trips, flights), and "Dan" never shows.
   pickStones / candle: see below (tests cover today's stones and the candle day).
   placeShort(loc): an airport code when the place names one ("Springfield SPX" -> "SPX"), else a short place name with no
     digits (never an address), else "". */
(function (root) {
  "use strict";
  var TZ = "America/Chicago";
  var EXACT = [
    [/^(<strong>[^<]*<\/strong>\s*)?Dan\s*\+\s*[A-Z][a-z]+\s+([A-Z]{3})\b[^·]*(·.*)?$/, function (m, a, c) { return (a || "") + c + " trip"; }],   /* "Dan+<Name> <AAA> ..." -> "<AAA> trip" (generic) */
    [/^Flight to ([A-Z][a-z]+(?:\s+(?!(?:With|And|Plus|For|Via|From|To|On|At)\b)[A-Z][a-z]+)*)\b.*$/, function (m, c) { return "Fly to " + c; }],   /* whole place ("New York"); the page truncates on width only (lh.css line clamp) */
    [/^✈️ Dan .*?leave ([0-9:apm]+).*$/, "Dad: Fly home"],
    [/^[A-Z]{2,5} Game (\d+): (.*)$/, function (m, n, t) { return t + ", Game " + n; }]
  ];
  var PARTNER = [/^\s*[A-Z][a-z]+\s*\+\s*Dan\b/, /^\s*(<strong>[^<]*<\/strong>\s*)?Dan\s*\+\s*[A-Z][a-z]+/, /\s+with\s+(?!(?:Dad|Daddy|Mom|Mommy|Grandma|Grandpa|Ainsley|Hayes|Harris|Kids|Boys|Family|Friends|Team)\s*$)[A-Z][a-z]+\s*$/];   /* \"Dinner with Dad\" is not a partner plan (Alfred P3) */
  function glassTitle(s) {
    s = String(s == null ? "" : s);
    var dad = PARTNER.some(function (r) { return r.test(s); });   /* Dan's plans with his partner read "Dad: ..." on shared glass, no name */
    for (var i = 0; i < EXACT.length; i++) s = s.replace(EXACT[i][0], EXACT[i][1]);
    s = s.replace(/#\w+(\/#\w+)*/g, "")
      .replace(/\(?\b[A-Z]{2} ?\d{3,4}\b\)?/g, "")
      .replace(/\b[A-Z]{3}\s*(→|->)\s*[A-Z]{3}\b/g, "")
      .replace(/\bmom'?s?\b/gi, "")
      .replace(/\[[^\]]*\]/g, "")                                     /* bracketed tags ("[AB Tag]") */
      .replace(/\s*\([^)]*\)/g, "")                                   /* seat / row / notes */
      .replace(/^\s*[A-Z][a-z]+\s*\+\s*Dan\s*(—|-|·)?\s*/, "")        /* "<Name> + Dan — ..." */
      .replace(/^\s*Dan\s*\+\s*[A-Z][a-z]+\s*(—|-|·)?\s*/, "")        /* "Dan+<Name> ..." */
      .replace(/\s+with\s+(?!(?:Dad|Daddy|Mom|Mommy|Grandma|Grandpa|Ainsley|Hayes|Harris|Kids|Boys|Family|Friends|Team)\s*$)[A-Z][a-z]+\s*$/, "")   /* "... with <Name>"; "with Dad" stays */
      .replace(/\s*·\s*leave\s+\d{1,2}:\d\d\s*[ap]?\.?m?\.?(\s*ET)?\s*$/i, "")
      .replace(/\s+@\s+/g, " vs ")
      .replace(/\s*—\s*/g, " · ").replace(/\s*\bMOVED\s*(→|->)\s*/g, " moved to ").replace(/\s*(→|->|⇒|➜)\s*/g, " to ");
    s = stripPrivate(s);
    s = s.replace(/(\s·\s*)+$/, "").replace(/^\s*·\s*/, "").replace(/\s+,/g, ",").replace(/\s{2,}/g, " ").trim();
    if (/^Fly\b/.test(s)) dad = true;                                 /* Dan's own flights are Dad items on shared glass */
    s = s.replace(/^Dan\s*[:,·-]\s*/, "").replace(/\bDan\b/g, "Dad");   /* shared glass says Dad, never Dan */
    return dad && s && !/^Dad:/.test(s) ? "Dad: " + s : s;
  }
  /* pickStones(evs, nowMs, opts): today's remaining items first, then the next days. Only items whose time has passed leave:
     an all-day item stays the whole day (until its end), a timed item stays until it ends. Birthdays stay off, the candle's
     own item (opts.skipId) is not repeated, one stone per title per day, max opts.max (4 wall, 3 phone).
     evs: [{ id, s, e, all, raw, t }] with s / e as Date or ms. Returns the kept events with .day (0 = today) added. */
  function pickStones(evs, nowMs, opts) {
    opts = opts || {}; var max = opts.max || 4, seen = {}, out = [];
    (evs || []).map(function (x) { var o = {}; for (var k in x) o[k] = x[k]; o.sM = +new Date(x.s); o.eM = +new Date(x.e || x.s); o.day = Math.max(0, dayDiff(nowMs, o.sM)); return o; })
      .filter(function (o) { return o.eM > nowMs && (o.all || o.eM > o.sM || o.sM > nowMs) && o.day <= 6 && o.id !== opts.skipId && !(o.all && /\b(birthday|bday)\b/i.test(o.raw || o.t || "")); })
      .sort(function (a, b) { return (a.day - b.day) || ((b.all ? 1 : 0) - (a.all ? 1 : 0)) || (a.sM - b.sM); })
      .forEach(function (o) { var k = o.day + "|" + o.t; if (seen[k] || out.length >= max) return; seen[k] = 1; out.push(o); });
    return out;
  }
  var fT = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
  var fW = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" });
  function t12(ms) { return fT.format(new Date(ms)).replace(/\u202f/g, " "); }
  /* candle(leaveMs, nowMs): the porch candle for a LeaveBy.find result. It lights only on the leave day; a later leave
     names its day ("Today · Leave 2:10 PM", "Tomorrow · Leave 2:10 PM", "Sat · Leave 2:10 PM"). */
  function candle(leaveMs, nowMs) {
    if (!(leaveMs > nowMs)) return null;
    var d = dayDiff(nowMs, leaveMs), v = "Leave " + t12(leaveMs);
    return { lit: d === 0, day: d, label: d === 0 ? "Today · " + v : (d === 1 ? "Tomorrow" : fW.format(new Date(leaveMs))) + " · " + v };
  }
  /* candlePick(evs, raws, nowMs, find): Prism ruling (b). The candle is Dad's next LEAVE-BY: the first future timed event whose RAW
     text gives a leave-by (LeaveBy.find) after now, kid trips he drives included. evs are display events already through the
     laws (no Ainsley LKMS legs, no away-day kid items); raws are the raw feed rows (by id). Ainsley + LKMS is refused here too.
     No leave-by anywhere = null: the candle stays unlit and empty. Returns { ev, lb } (lb = LeaveBy result). */
  function candlePick(evs, raws, nowMs, find) {
    if (typeof find !== "function") return null;
    var byId = {}; (raws || []).forEach(function (r) { if (r && r.id != null) byId[r.id] = r; });
    var list = (evs || []).filter(function (e) { return e && !e.all && +new Date(e.s) > nowMs; }).sort(function (a, b) { return +new Date(a.s) - +new Date(b.s); });
    for (var i = 0; i < list.length; i++) {
      var e = list[i], r = byId[e.id]; if (!r) continue;
      var txt = String(r.summary || "") + " " + String(e.raw || "");
      if (/\blkms\b/i.test(txt) && /\bainsley\b/i.test(txt)) continue;
      var rr = {}; for (var k in r) rr[k] = r[k]; rr.allDay = r.allDay === true || r.allDay === "True";
      var all = (raws || []).map(function (x) { var o = {}; for (var kk in x) o[kk] = x[kk]; o.allDay = x.allDay === true || x.allDay === "True"; return o; });
      var lb = null; try { lb = find(rr, all); } catch (_) { lb = null; }
      if (lb && +lb.leave > nowMs) return { ev: e, lb: lb };
    }
    return null;
  }
  /* plaqueState(o): Prism ruling (a). Window: "glow" only when the kid is home AND their room lamp reports on; "lit" when home
     (no lamp feed or lamp unknown); "dark" when away, state unknown, or the lamp reports off. Having something today never
     changes the window: it puts the brass fill + warm dot on the name plaque instead (plaque "today"). o: { away, unknown, lamp, today } */
  function plaqueState(o) {
    o = o || {}; var home = !o.away;   /* Atlas P2 feed: an unknown state (feed missing, empty or junk) is the normal awake board; only a valid feed that says away goes dark */
    var win = !home || o.lamp === false ? "dark" : o.lamp === true ? "glow" : "lit";
    return { win: win, plaque: home && o.today ? "today" : "" };
  }
  /* stateText(s): Atlas law, no away-state wording on any board and no computed replacement. Text that names the arrangement
     (main's NOCUSTODY phrases plus the ones STATE_RE lists: a countdown to a change, a kid returning) is never shown;
     neutral words alone (Away game, Back to school night, Return library books, Dinner with Dad) are not the arrangement:
     the item is dropped whole, nothing is reworded in its place. */
  var STATE_RE = /kids with (?:dad|mom|dan)\b|\b(?:dad|mom)(?:['\u2019]?s)? weeks?\b|\bhome week\b|\baway week\b|\bcustody\b|\b(?:their )?mom['\u2019]?s week\b|\bkids? (?:are )?(?:away|back)\b|\btheir week\b|kids-with-dan|\byour base\b|\bhand-?\s?offs?\b|\b(?:chores|payday) with dad\b|who.{1,6}s where|\bkids? with\b|\bwith you\b|\bfri(?:day)?\W{0,3}(?:at\s+)?3(?::00)?\s*(?:p\.?m\.?)?\b|\b(?:before|after|until|till|by) fri(?:day)?\b|\bother house\b|\bswap day\b|\bback in \d+ days?\b|\bback (?:tomorrow|today|on (?:mon|tue|wed|thu|fri|sat|sun)\w*)\b|\b(?:ainsley|hayes|harris|kids?|boys) (?:returns?|is back|are back|comes? back)\b(?=\s*(?:$|[.,;:!|(\u00b7-]|home\b|from\b|on\b|at\b|to (?:dad|mom|you|us)\b|tomorrow\b|today\b|tonight\b|(?:mon|tue|wed|thu|fri|sat|sun)|\d))/i;   /* custody-law:allow (matcher) */
  /* Alfred P3 residue: a row is about the other household when it names it or comes back from it; it drops whole, never stripped
     ("Kids at <their mom's>" never leaves "Kids at"). A co-parent name (runtime role coparent, never in git) counts the same. */
  var LEAVE_RE = /\bmom(?:my|ma|s)?\b|\bmom['\u2019]s\b|\bmother(?:['\u2019]?s)?\b|\bback home\b|\breturns?\s+to\s+(?:dad|dan|daddy)\b|\bkids?\s+(?:go|goes|going|head|heads|heading)\s+to\b(?!\s+(?:school|practice|camp|the\s+(?:park|pool|game|movies?|library|dentist|doctor|zoo|museum|fair)|bed)\b)/i;   /* custody-law:allow (matcher) */
  function parentRef(s) {
    var t = String(s || ""); if (LEAVE_RE.test(t)) return true;
    var cp = coparentNames(); return (t.match(/[A-Za-z][A-Za-z'\u2019]+/g) || []).some(function (w) { return Object.prototype.hasOwnProperty.call(cp, w.toLowerCase().replace(/['\u2019]s?$/, "")); });
  }
  /* orphan(s): what a strip can leave behind and is never a title: a dangling preposition or joiner at the end, or a bare kid or
     house word alone ("Kids at", "Kids go to", "kids", "house", "at"). Such a row drops whole. */
  function orphan(s) { var t = String(s || "").trim(); return !t || /(?:^|\s)(?:at|to|with|from|and|for|of|into|by|the|&|\+)\s*$/i.test(t) || /[:&+]\s*$/.test(t) || /^(?:kids?|boys|house|home|place|at|to|the|our|their)$/i.test(t); }
  function stateText(s) {   /* main's law (HouseFaceLaw.isCustody) when loaded, plus the Living House list above */
    var t = String(s || ""), L = typeof window !== "undefined" ? window.HouseFaceLaw : (typeof globalThis !== "undefined" ? globalThis.HouseFaceLaw : null);
    return STATE_RE.test(t) || parentRef(t) || !!(L && L.isCustody && L.isCustody(t));
  }
  /* money(s): any money figure on a kid row drops the row whole, never stripped (Alfred P2 x2): "$5", "5$", "5 dollars", "dollars 5",
     "USD 5", "5 USD", "five bucks", "50 cents", a cent sign, "jar 5.00", "5-dollar", "five-dollar", "jar 5", "jar: 5". "Room 5", "Grade 5", "5:00 practice", "Jar of pickles" are not money. */
  /* seats(s): a seat code never shows, even bare (a section, row and seat list with no lead-in) where main's faceText needs a lead-in (Alfred P2) */
  var SEAT_RE = /(?:^|[\s,(·|-]+)(?:sec(?:tion)?\.?\s*[A-Z]?\d+[A-Z]?|row\s+[A-Z]{1,2}\d?|seats?\s+\d+(?:\s*[-\u2013&,]\s*\d+)*)\b/gi;
  function seats(s) { var t = String(s || ""), o; do { o = t; t = t.replace(SEAT_RE, ""); } while (t !== o); return t.replace(/^[\s,·|:;-]+|[\s,·|:;(-]+$/g, ""); }
  var NUMW = "(?:a|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|couple(?: of)?|few)";
  var JARN = NUMW.replace("a|", "").replace("|couple(?: of)?|few", "");   /* a number word after "jar" (not "a", "few") */
  var MONEY = [/\$\s?\d/, /\d\s?\$/, /[\u00a2\u20ac\u00a3]/, /\b\d+(?:[.,]\d+)?[\s-]*(?:dollars?|bucks?|cents?|usd)\b/i, /\b(?:usd|dollars?|bucks?)[\s-]*\d/i,
    new RegExp("\\b" + NUMW + "(?:[\\s-]+" + NUMW + ")*[\\s-]+(?:dollars?|bucks?|cents?)\\b", "i"), /\bjar\b[^0-9]{0,12}\d+[.,]\d{1,2}\b/i,
    /\bjars?\b\W{0,3}\d/i, new RegExp("\\bjars?\\b\\W{0,3}" + JARN + "\\b", "i")];   /* Alfred P2 x3: "5-dollar", "five-dollar", "jar 5", "jar: 5", "jar five" */
  function money(s) { var t = String(s || ""); return MONEY.some(function (r) { return r.test(t); }); }
  /* residue(s): what a strip leaves behind (Alfred P3). "" = drop the row whole:
     - the subject was stripped (a name, then a verb, loses its name): a line that now starts with a bare lower-case verb;
     - separators with nothing between them ("Play / /", "Game ·,2,3");
     a bare section-row-seats code ("112 F 3-4") is stripped, with the seat numbers left dangling after it ("& 6").
     A time range stays: "3-4 PM practice" has no number-letter lead-in and carries AM/PM. */
  var BARE_CODE = /(?:^|[\s,(\u00b7|\/-]+)\d{1,4}\s+[A-Z]{1,2}\s+\d{1,3}(?:\s*[-\u2013&,]\s*\d{1,3})*(?!\d|\s*[-\u2013&,:]\s*\d)(?!\s*(?:[aApP]\.?[mM]\b|o'?clock))/g;
  function residue(s) {
    var t = String(s || ""), o = t;
    t = t.replace(BARE_CODE, function (m, off, all) { return /\b(?:room|rm|suite|ste|unit|apt|bldg|building|lab|court|ct|field|gate|door|bay|lane|lot)\.?\s*$/i.test(all.slice(0, off)) ? m : ""; });   /* "Room 112 B 2" is a place, not a seat code (Alfred UNVERIFIED) */
    if (/(?:[\/\u00b7,&|;:]\s*){2,}/.test(t) || /(?:^|\s)[\/\u00b7,&|;]\s*\d{1,3}(?:\s*[,&]\s*\d{1,3})*\s*$/.test(t) && /\b(?:game|play|show|concert|match|seats?)\b/i.test(t)) {
      return /(?:[\/\u00b7,&|;:]\s*){2,}/.test(t) ? "" : t.replace(/(?:^|\s)[\/\u00b7,&|;]\s*\d{1,3}(?:\s*[,&]\s*\d{1,3})*\s*$/, "").trim();
    }
    if (t !== o) t = t.replace(/(?:\s*[&,\u00b7\/|]\s*\d{1,3})+\s*$/, "");
    t = t.replace(/^[\s,\u00b7|:;\/&-]+|[\s,\u00b7|:;\/&(-]+$/g, "");
    if (/^(?:has|have|had|is|are|was|were|takes?|took|gets?|got|keeps?|picks?|drops?|with|and|\+)\b/.test(t)) return "";
    return t;
  }
  function seatsResidue(s) { return residue(seats(s)); }
  /* stripPrivate(s): drops private first names (roles partner, coparent, external, plus the old key otherfamily) read at
     RUN TIME, never from git: setPrivateNames([...]) (tests: stand-ins) · window.WARDOS_PRIVATE_NAMES.<role> (filled by the
     hub's token-only, no-store names route when it serves the role; the route serves role school only today) · node:
     WARDOS_NAMES "partner=X;..." · WARDOS_PRIVATE_NAMES=<path> · ~/.local/share/wardos-private/private-names.tsv ·
     ~/.config/wardos/private-names.tsv. No names = nothing stripped here; glassTitle's PARTNER patterns stay the fallback.
     An empty read is never cached, so names that arrive later are picked up. */
  var NAME_ROLES = { partner: 1, coparent: 1, external: 1, otherfamily: 1 }, PNAMES = null;
  function readRole(roles) {
    var out = [];
    try {
      var w = typeof window !== "undefined" && window.WARDOS_PRIVATE_NAMES;
      if (w) { var hit = false; for (var r in roles) if (w[r]) { hit = true; out = out.concat(w[r]); } if (hit) return out; }
      if (typeof process !== "undefined" && process.versions && process.versions.node && typeof require === "function") {
        var env = process.env || {};
        if (env.WARDOS_NAMES) { env.WARDOS_NAMES.split(";").forEach(function (kv) { var i = kv.indexOf("="); if (i > 0 && roles[kv.slice(0, i).trim().toLowerCase()]) out.push(kv.slice(i + 1).trim()); }); return out; }
        var fs = require("fs"), path = require("path"), H = env.HOME || "";
        var fps = [env.WARDOS_PRIVATE_NAMES, path.join(H, ".local/share/wardos-private/private-names.tsv"), path.join(H, ".config/wardos/private-names.tsv")];
        for (var i = 0; i < fps.length; i++) {
          if (!fps[i] || !fs.existsSync(fps[i])) continue;
          fs.readFileSync(fps[i], "utf8").split("\n").forEach(function (ln) { if (!ln.trim() || ln.charAt(0) === "#") return; var c = ln.split("\t"); if (roles[String(c[0]).trim().toLowerCase()] && c[1]) out.push(c[1].trim()); });
          break;
        }
      }
    } catch (e) { out = []; }
    return out;
  }
  function nameSet(list) {
    var set = {}, n = 0;
    [].concat(list || []).forEach(function (v) { String(v || "").split(/\s+/).forEach(function (w) { w = w.toLowerCase().replace(/[^a-z'\u2019-]/g, ""); if (w.length >= 2) { set[w] = 1; n++; } }); });
    return n ? set : null;
  }
  var CPNAMES = null;
  function coparentNames() { if (!CPNAMES) CPNAMES = nameSet(readRole({ coparent: 1 })); return CPNAMES || {}; }
  function privateNames() { if (!PNAMES) PNAMES = nameSet(readRole(NAME_ROLES)); return PNAMES || {}; }
  function setPrivateNames(list, coparent) { PNAMES = list ? nameSet(list) : null; CPNAMES = coparent ? nameSet(coparent) : null; }
  function isPrivateName(tok) { var k = String(tok).toLowerCase().replace(/['\u2019]s?$/, ""); return Object.prototype.hasOwnProperty.call(privateNames(), k); }
  function stripPrivate(s) { return String(s || "").replace(/\b[A-Za-z][A-Za-z]+(?:['\u2019]s?)?/g, function (t) { return isPrivateName(t) ? "" : t; }).replace(/\s{2,}/g, " ").trim(); }
  var fK = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
  function dayDiff(aMs, bMs) { return Math.round((Date.parse(fK.format(new Date(bMs))) - Date.parse(fK.format(new Date(aMs)))) / 864e5); }

  function placeShort(loc) {
    loc = String(loc || "").trim(); if (!loc) return "";
    var m = loc.match(/\b([A-Z]{3})\b/); if (m && /airport|\b[A-Z]{3}\b/.test(loc) && !/\d/.test(loc.split(",")[0])) return m[1];
    return (!/\d/.test(loc) && loc.length <= 24) ? loc : "";
  }
  /* kidName(kid, text): does this text name OUR kid? A first name followed by another surname is someone else ("Hayes
     <Surname>" is never our Hayes). The next word counts as a surname when it is Title-case letters and not one of our
     own words (Ward, possessives, activity words). Unknown Title-case words fail SAFE: the item stays off that kid's window. */
  var OURS = /^(Ward|Chat|Target|Flag|Soccer|Football|Basketball|Baseball|Volleyball|Tennis|Practice|Game|Games|Swim|Piano|Art|Music|Dentist|Doctor|Ortho|Appt|Appointment|School|Camp|Party|Pickup|Drop|Birthday|Room|Bus|Club|Tryout|Tryouts|Lesson|Lessons|Haircut|Recital|Concert|Conference|Night|Day|Week|Gym|Run|Meet|Match|Team|Specials|Field|Trip|Away|Home|Back|Return|Returns|Library|Book|Books|Show|Play|Fair|Photo|Picture|Report|Project|Homework|Dinner|Lunch|Breakfast|Movie|Sleepover|Playdate|Tutor|Tutoring|Test|Quiz|Exam|Costume|Halloween|Open|Science|Math|Reading|Spelling|First|Last|Early|Late|Morning|Afternoon|Evening|Bday|Awards|Graduation|Rehearsal|Scouts|Dance|Karate|Track|Robotics|Chess|Drama|Band|Choir|Checkup|Shots|Physical|Orientation|Grade|Jar|Class|Spirit|Pajama|Pizza|Bake|Cookie|Earned|Earns|Chore|Chores|Allowance|Payday|Savings|Bank|Has|Gets|Got)$/;   /* capitalised event words, not a surname (Alfred P3: "Hayes Away game" is ours) */
  var KIDN = { ainsley: "Ainsley", hayes: "Hayes", harris: "Harris" };
  function kidName(kid, text) {
    var n = KIDN[kid]; if (!n) return false;
    var re = new RegExp("\\b" + n + "\\b(?:['’]s?)?(\\s+([A-Za-z][A-Za-z'’-]*))?", "gi"), m, t = stripSchool(String(text || ""));   /* a school name after a kid name is not a surname (Alfred P3) */
    while ((m = re.exec(t))) {
      var w = m[2] || "";
      if (/^[A-Z][a-z][a-z'’-]+$/.test(w) && !OURS.test(w)) continue;   /* "<First> <Surname>": someone else */
      return true;
    }
    return false;
  }
  /* choreFill(taps, kw, dayKey, kids): the cauldron level from the hub tap store (GET /api/taps on the house hub, TAPSYNC1;
     keys house-checkoffs:{kid}:{YYYY-MM-DD} -> {questId: {v, t}}) over kids-week.json kids.<kid>.quests[] with cadence
     "daily". Returns { done, total } or null when the store or the quests are missing (the pot then shows empty, flagged). */
  function choreFill(taps, kw, dayKey, kids) {
    if (!taps || typeof taps !== "object" || !kw || !kw.kids) return null;
    var done = 0, total = 0;
    (kids || ["ainsley", "hayes", "harris"]).forEach(function (k) {
      var qs = ((kw.kids[k] && kw.kids[k].quests) || []).filter(function (q) { return q && q.cadence === "daily" && q.id; });
      var st = taps["house-checkoffs:" + k + ":" + dayKey] || {};
      qs.forEach(function (q) { total++; var v = st[q.id]; if (v === true || (v && v.v === true)) done++; });
    });
    return total ? { done: done, total: total } : null;
  }
  /* feedState(d, nowMs, maxMin): "live" when the feed file says live and its own timestamp is within maxMin of the real
     clock, "stale" when it says live but is older, "offline" when missing or not live. Stale and offline feeds draw nothing
     (the calendar keeps its last real sync on screen, labelled "Calendar offline"). */
  function feedState(d, nowMs, maxMin) {
    if (!d || d.status !== "live") return "offline";
    var t = Date.parse(d.fetchedAt || d.refreshedAt || d.updatedAt || d.ts || "");
    return isFinite(t) && nowMs - t <= maxMin * 6e4 ? "live" : "stale";
  }
  function feedTime(d) { var t = Date.parse((d && (d.fetchedAt || d.refreshedAt || d.updatedAt || d.ts)) || ""); return isFinite(t) ? t : null; }
  /* otherPerson(text): the text names one of our kids' first names, but never our kid (e.g. "<First> <Surname>"). Such
     items belong to someone else and stay off the candle and the stones. */
  /* School tokens (kid school calendar abbreviations) never live in git (PRIVNAME1, role school). Runtime sources, first hit wins:
     setSchools([...]) (tests: synthetic token) · window.WARDOS_PRIVATE_NAMES.school (hub-injected, not in git) ·
     node: WARDOS_NAMES "school=X" · WARDOS_PRIVATE_NAMES=<path> · ~/.local/share/wardos-private/private-names.tsv · ~/.config/wardos/private-names.tsv.
     None found = empty list: kid items still match by kid name or kid colour key, school words alone do not. */
  var SCHOOLS = null;
  function readSchools() {
    var out = [];
    try {
      var w = typeof window !== "undefined" && window.WARDOS_PRIVATE_NAMES;
      if (w && w.school) return [].concat(w.school);
      if (typeof process !== "undefined" && process.versions && process.versions.node && typeof require === "function") {
        var env = process.env || {};
        if (env.WARDOS_NAMES) { env.WARDOS_NAMES.split(";").forEach(function (kv) { var i = kv.indexOf("="); if (i > 0 && kv.slice(0, i).trim().toLowerCase() === "school") out.push(kv.slice(i + 1).trim()); }); return out; }
        var fs = require("fs"), path = require("path"), H = env.HOME || "";
        var fps = [env.WARDOS_PRIVATE_NAMES, path.join(H, ".local/share/wardos-private/private-names.tsv"), path.join(H, ".config/wardos/private-names.tsv")];
        for (var i = 0; i < fps.length; i++) {
          if (!fps[i] || !fs.existsSync(fps[i])) continue;
          fs.readFileSync(fps[i], "utf8").split("\n").forEach(function (ln) { if (!ln.trim() || ln.charAt(0) === "#") return; var c = ln.split("\t"); if (String(c[0]).trim().toLowerCase() === "school" && c[1]) out.push(c[1].trim()); });
          break;
        }
      }
    } catch (e) { out = []; }
    return out;
  }
  function mainSchools() { var g = typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null); return g && g.SchoolNames && g.SchoolNames.schoolTokens ? g.SchoolNames : null; }
  /* Same row rule as main's school-names.js: a TOKEN is 2 to 8 letters, a FULL name is 2 to 4 words of letters. */
  var TOK_RE = /^[A-Za-z]{2,8}$/, FULL_RE = /^[A-Za-z]{2,}(?: [A-Za-z]{2,}){1,3}$/;
  function schoolAll() {   /* main's school-names.js path first (one source for every board); the empty list is never cached */
    if (SCHOOLS) return SCHOOLS;
    var M = mainSchools(), l = M ? [].concat(M.schoolTokens(), M.fullNames ? M.fullNames() : []) : readSchools();
    l = cleanSchools(l);
    if (l.length) SCHOOLS = l;
    return l;
  }
  function cleanSchools(list) { return [].concat(list || []).map(function (t) { return String(t || "").trim().replace(/\s+/g, " "); }).filter(function (t) { return TOK_RE.test(t) || FULL_RE.test(t); }); }
  function schoolTokens() { return schoolAll().filter(function (t) { return TOK_RE.test(t); }); }
  function schoolFull() { return schoolAll().filter(function (t) { return FULL_RE.test(t); }); }
  function setSchools(list) { var l = list ? cleanSchools(list) : []; SCHOOLS = l.length ? l : null; }   /* [] = not cached */
  /* schoolAlt(): one alternation, full names first (longest wins), then the tokens; any case, any spacing inside a name */
  function schoolAlt() { var f = schoolFull().map(function (n) { return n.split(" ").join("\\s+"); }), t = schoolTokens(); return f.concat(t).join("|"); }
  /* feedsAllowed(loc): Living House reads data feeds only on a local server (127.0.0.1, localhost, ::1, file:). On live Pages
     (or any other host) it reads none: the board stays feedless until it is wired the way FEEDS.md requires (Alfred 5b). */
  function feedsAllowed(loc) { loc = loc || {}; if (loc.protocol === "file:") return true; return /^(?:127\.0\.0\.1|localhost|\[::1\]|::1)$/i.test(String(loc.hostname || "")); }
  function schoolRe(flags) { var a = schoolAlt(); return a ? new RegExp("\\b(?:" + a + ")\\b", flags || "i") : null; }
  function isSchoolText(s) { var re = schoolRe(); return !!(re && re.test(String(s || ""))); }
  /* stripSchool(s): a token or full name before a word drops (any case, Alfred P3); one left anywhere else reads "school" */
  function stripSchool(s) { var a = schoolAlt(); s = String(s || ""); if (!a) return s; return s.replace(new RegExp("\\b(?:" + a + ")\\b['\u2019]?s?\\s+(?=\\S)", "gi"), "").replace(new RegExp("\\b(?:" + a + ")\\b", "gi"), "school").replace(/\s{2,}/g, " ").trim(); }
  /* stripNamesakes(s): removes "<KidFirstName> <private surname>" (runtime private names), so someone else who shares a kid's first name
     never reads as our kid (used by away-filter.js isKidText). */
  function stripNamesakes(s) { return String(s || "").replace(/\b(ainsley|hayes|harris)\s+([A-Za-z]+)\b/gi, function (m, a, b) { return isPrivateName(b) ? "" : m; }); }
  function otherPerson(text) { var t = String(text || ""); return /\b(ainsley|hayes|harris)\b/i.test(t) && !kidName("ainsley", t) && !kidName("hayes", t) && !kidName("harris", t); }
  var api = { orphan: orphan, schoolFull: schoolFull, setSchools: setSchools, schoolTokens: schoolTokens, isSchoolText: isSchoolText, stripSchool: stripSchool, stripNamesakes: stripNamesakes, setPrivateNames: setPrivateNames, stripPrivate: stripPrivate, otherPerson: otherPerson, feedState: feedState, feedTime: feedTime, candlePick: candlePick, plaqueState: plaqueState, stateText: stateText, money: money, seats: seats, residue: residue, seatsResidue: seatsResidue, feedsAllowed: feedsAllowed, kidName: kidName, choreFill: choreFill, glassTitle: glassTitle, placeShort: placeShort, dayDiff: dayDiff, pickStones: pickStones, candle: candle, t12: t12 };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.LHRules = api;
})(typeof window !== "undefined" ? window : this);
