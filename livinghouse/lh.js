/* LIVING HOUSE · lh.js · layer 1. The scene is the interface: every element is pinned to the v5.2 house plate
   (1280x720 wall footage) and filled only from a real feed. Feeds: ../data/cal-live.json, ../kids-week.json,
   ../data/lights-live.json, ../data/sensi-live.json, ../data/nest-live.json, scene weather (night/scene.html __env).
   Laws: kid-safe, calm, no em dashes, no colour / dress-up days, never names from the external feed, no kid times or logistics in the away state,
   no LKMS legs for Ainsley, "Hayes <Surname>" is never our Hayes. Debug: ?now=<iso> pins the clock (stills only). */
(function () {
  var de = document.documentElement, q = new URLSearchParams(location.search), TZ = "America/Chicago";
  var C = window.LHClock; /* clock.js: the only reader of the current time (?now= override) */
  function now() { return C.now(); }
  var RM = matchMedia("(prefers-reduced-motion: reduce)");
  var $ = function (s, r) { return (r || document).querySelector(s); }, $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  /* ---------- clean filter (display side; data is also cleaned upstream) ---------- */
  var CLOTH = /\b(orange|red|blue|green|pink|purple|yellow|black|white|gold|maroon|colou?r|crazy hair|pajama|pj|twin|hat|jersey|spirit|outsiders)\s+day\b|dress[- ]?up|spirit\s+week|\bwear\b/i;
  var KID0 = /\b(ainsley|harris|hayes)\b|\blkms\b|\bkids?\b/i, KID = { test: function (t) { return KID0.test(t) || LHRules.isSchoolText(t); } };   /* school token: runtime only (LHRules) */
  var LAW = function () { return window.HouseFaceLaw || null; };
  function face(t) { var L = LAW(); try { t = L && L.faceText ? L.faceText(String(t || "")) : String(t || ""); } catch (_) { t = String(t || ""); } t = school(t); t = LHRules.seatsResidue(t); return (!t || LHRules.orphan(t) || (L && L.isCustody && L.isCustody(t)) || LHRules.stateText(t)) ? "" : t; }   /* Alfred P3: a strip remnant (a dangling joiner or a bare kid or house word) drops whole */
  function school(t) { return LHRules.stripSchool(String(t || "")); }   /* school tokens through main's school-names.js path (Alfred 5b): stripped before a word, "school" anywhere else */   /* main's face law (seat codes, school word, dashes, the arrangement law) on every visible line */
  function dress(t) { var L = LAW(); return (L ? L.isDressDay(t) : false) || CLOTH.test(String(t || "")); }
  function clean(s) {
    var L = LAW(); s = String(s || ""); if (L) s = L.faceDash(s);
    s = s.replace(/#\w+(\/#\w+)*/g, "").replace(/\(?\b[A-Z]{2} ?\d{3,4}\b\)?/g, "").replace(/\b[A-Z]{3}(→|->)[A-Z]{3}\b/g, "")
      .replace(/\bmom'?s?\b/gi, "").replace(/\[[^\]]*\]/g, "").replace(/\s*—\s*/g, " · ").replace(/\s*\bMOVED\s*(→|->)\s*/g, " moved to ").replace(/\s*(→|->|⇒|➜)\s*/g, " to ");
    if (window.LHRules) s = LHRules.stripPrivate(s);
    return s.replace(/(\s·\s*)+$/, "").replace(/\s{2,}/g, " ").trim();
  }
  function short(s) { return clean(s).replace(/\s*\([^)]*\)/g, "").replace(/\s*·\s*(game\s*)?\d{1,2}:\d\d\s*$/i, "").replace(/\s{2,}/g, " ").trim(); }
  var fT = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
  var fW = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" });
  var fD = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short", month: "short", day: "numeric" });
  var fK = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
  var fH = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "numeric", hourCycle: "h23" });
  function key(d) { return fK.format(d); }
  function dayIdx(d, n) { return Math.round((Date.parse(key(d)) - Date.parse(key(n))) / 864e5); }
  function hm(d) { var p = fH.format(d).split(":"); return +p[0] + (+p[1]) / 60; }
  function t12(d) { return fT.format(d).replace(/\u202f/g, " "); }
  function nb(s) { return String(s || "").replace(/(\d)[ \u202f]([AP]M)\b/g, function (m, d, ap) { return d + "\u00a0" + ap; }).replace(/\bLeave (\d)/g, function (m, d) { return "Leave\u00a0" + d; }); }   /* times never split: "1:50<nbsp>PM", "Leave<nbsp>1:50" */
  /* ---------- plate mapping ---------- */
  var S = 1, OX = 0, OY = 0, phone = false, bandY = 0, K = 1, VW = 0, VH = 0;
  function P(x, y) { return [x * S + OX, y * S + OY]; }
  function frame() { return $("iframe.night52-scene"); }
  function post(m) { var f = frame(); try { f && f.contentWindow && f.contentWindow.postMessage(m, location.origin); } catch (_) {} }
  function layout() {
    VW = innerWidth; VH = innerHeight; phone = VW / VH < 0.8; de.classList.toggle("lh-phone", phone); de.classList.toggle("lh-wall", !phone);
    if (phone) { S = VW / 1120; OX = -30 * S; bandY = Math.round(VH * 0.215); OY = bandY - 20 * S; K = 1; post({ night: "band", y: bandY }); }
    else { S = Math.max(VW / 1280, VH / 720); OX = (VW - 1280 * S) / 2; OY = (VH - 720 * S) / 2; K = Math.max(0.62, Math.min(1.4, VW / 1920)); post({ night: "band", y: null }); }
    $("#lh").style.setProperty("--k", K);
    $$("#lh [data-at]").forEach(function (el) { var a = ((phone && el.getAttribute("data-at-ph")) || el.getAttribute("data-at")).split(",").map(Number), p = P(a[0], a[1]); el.style.left = p[0] + "px"; el.style.top = p[1] + "px"; });
    $$("#lh [data-rect]").forEach(function (el) { var r = el.getAttribute("data-rect").split(",").map(Number), a = P(r[0], r[1]), b = P(r[2], r[3]); el.style.left = a[0] + "px"; el.style.top = a[1] + "px"; el.style.width = (b[0] - a[0]) + "px"; el.style.height = (b[1] - a[1]) + "px"; });
    var kwEl = $("#lh-kidwins");
    if (phone) { kwEl.style.left = Math.min(VW * 0.74, VW - 92) + "px"; kwEl.style.top = (bandY + 6) + "px"; }
    else { var kp = P(854, 11); kwEl.style.left = kp[0] + "px"; kwEl.style.top = (kp[1] + 6 * K) + "px";   /* Prism P2: about 6 px of air above the windows */ kwEl.style.setProperty("--s", S); } /* Prism art fit: windows at plate x 862 / 950 / 1038, y 11 on Prism's gable band (it covers the plate's own windows) */
    var aw0 = $(".lh-away"), la = ((phone && aw0.getAttribute("data-lan-ph")) || aw0.getAttribute("data-lan")).split(",").map(Number), lp = P(la[0], la[1]), lh = phone ? 56 : 93.3 * S;
    aw0.style.left = lp[0] + "px"; aw0.style.top = (lp[1] - lh) + "px"; aw0.style.setProperty("--lw", (phone ? 40 : 66.7 * S) + "px"); aw0.style.setProperty("--lh", lh + "px"); /* lantern foot on the porch rail (wall) / bottom step (phone); words under it */
    if (phone) { /* portrait recomposition: moon top, house mid (band), porch cards + tombstones lower */
      var Z = bandY + 640 * S;
      var cd = $(".lh-candle"); var cw = Math.min(300, VW * 0.72); cd.style.width = cw + "px"; cd.style.left = Math.min(VW * 0.7, VW - cw / 2 - 8) + "px"; cd.style.top = (Z + 2) + "px";   /* Prism P2: pulled up 60 px to close the dead band (fitPhone keeps it clear of the scene words) */
    }
    if (!phone) { var st = Math.min(P(0, 712)[1], VH - 10 * K) - 196 * K, cdw = $(".lh-candle"); cdw.style.left = P(520, 0)[0] + "px"; cdw.style.top = (st - 104 * K) + "px"; } /* candle lane above the stone row, off the steps */
    paint();
  }
  /* ---------- moon: real phase, arcs with the time of night ---------- */
  function moonPhase(d) { var jd = d.getTime() / 864e5 + 2440587.5, p = ((jd - 2451550.1) / 29.530588853) % 1; return p < 0 ? p + 1 : p; }
  function litPath(p) {
    var c = Math.cos(2 * Math.PI * p), rx = Math.abs(c) * 100, wax = p < 0.5, cres = c > 0;
    if (wax) return "M0,-100 A100,100 0 0 1 0,100 A" + rx + ",100 0 0 " + (cres ? 0 : 1) + " 0,-100 Z";
    return "M0,-100 A100,100 0 0 0 0,100 A" + rx + ",100 0 0 " + (cres ? 1 : 0) + " 0,-100 Z";
  }
  var CIRC = "M-100,0 A100,100 0 1,0 100,0 A100,100 0 1,0 -100,0 Z ";
  function moon(n) {
    var p = moonPhase(n), lp = litPath(p);
    $("#litp").setAttribute("d", lp); $("#darkp").setAttribute("d", CIRC + lp); $("#dark path").setAttribute("clip-rule", "evenodd"); $("#darkp").setAttribute("clip-rule", "evenodd");
    var h = hm(n), t = ((h - 18 + 24) % 24) / 12; t = t > 1 ? 0.5 : 0.25 + 0.5 * t; /* gentle arc through the night; by day it holds mid-sky */
    var m = $("#lh-moon"), x, y, size;
    if (phone) { /* item 6: the moon (and the date on it) sits clear of the mute button and the CLOCK OVERRIDE tag */
      var top = 10; [".night52-snd", ".lh-clocktag"].forEach(function (sel) { var o = document.querySelector(sel); if (o) { var r = o.getBoundingClientRect(); if (r.height) top = Math.max(top, r.bottom + 8); } });
      size = Math.max(96, Math.min(170, bandY - top - 6)); x = VW * (0.22 + 0.56 * t); y = top + size / 2; }
    else { var a = P(320 + 280 * t, 205 - 110 * Math.sin(Math.PI * t)); x = a[0]; y = Math.max(a[1], 135 * K); size = 250 * K;
      [".night52-snd", ".lh-clocktag"].forEach(function (sel) { var o = document.querySelector(sel); if (!o) return; var r = o.getBoundingClientRect();   /* wall: the moon never sits on the mute button or the CLOCK OVERRIDE tag */
        if (r.height && x - size / 2 < r.right + 8 && x + size / 2 > r.left - 8) y = Math.max(y, r.bottom + 8 + size / 2); }); }
    m.style.left = x + "px"; m.style.top = y + "px"; m.style.width = m.style.height = size + "px";
    var tt = t12(n).replace(/\s?[AP]M$/, ""), ap = /PM$/.test(t12(n)) ? "PM" : "AM";
    $$("[data-lh=time]").forEach(function (e) { e.textContent = tt; }); $$("[data-lh=date]").forEach(function (e) { e.textContent = fD.format(n).toUpperCase().replace(",", ""); }); $$("[data-lh=ap]").forEach(function (e) { e.textContent = ap; });
    de.setAttribute("data-moon", (Math.round(p * 1000) / 1000) + "");
  }
  /* ---------- data ---------- */
  var D = { cal: null, raw: null, months: null, kw: null, lights: null, sensi: null, nest: null, taps: null, tapsWhy: "loading", feeds: { cal: "offline", lights: "offline", sensi: "offline", nest: "offline", taps: "offline" } };
  function J(u) { if (!FEEDS_OK) return Promise.resolve(null); return fetch(u + "?t=" + Math.floor(C.realMs() / 6e4)).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }); }
  var FEEDS_OK = LHRules.feedsAllowed(location);   /* Alfred 5b hard guard: no real feeds on live Pages until FEEDS.md's three conditions hold */
  function load() {
    return Promise.all([J("../data/cal-live.json"), J("../kids-week.json"), J("../data/lights-live.json"), J("../data/sensi-live.json"), J("../data/nest-live.json"), J("../data/cal-months.json"), q.get("rec") === "1" ? J("../data/cal-live.raw.json") : Promise.resolve(null)])   /* the raw sidecar exists only in recording snapshots (?rec=1) */
      .then(function (a) { var L = LAW(); function lw(n, d) { try { return L && L.cleanFeed && d ? L.cleanFeed(n, d) : d; } catch (_) { return d; } }   /* main's face law over the feeds, as private-feed.js does on every board */
        a[0] = lw("cal-live", a[0]); a[1] = lw("kids-week", a[1]); a[5] = lw("cal-months", a[5]);
        D.cal = a[0]; D.kw = a[1]; try { if (L && D.kw) L.cleanKidsWeek(D.kw); } catch (_) {} D.lights = a[2]; D.sensi = a[3]; D.nest = a[4]; D.months = a[5]; try { window.AwayFilter && AwayFilter.setMonths(a[5]); } catch (_) {}   /* a missing or junk feed resets to unknown (the normal board) */ D.raw = a[6] || a[0]; feeds(); loadTaps().then(function () { feeds(); paint(); }); /* RAW events feed LeaveBy; cal-live.raw.json exists only in recording snapshots (pre rec-clean); live, cal-live.json IS raw */ paint(); de.classList.add("lh-ready"); });
  }
  var STATE = q.get("state"); /* ?state=home: labelled PREVIEW of the home-state look, never live */
  /* Away state (Atlas ruling): the per-day flag in data/cal-months.json days[YYYY-MM-DD]. On a change day it flips at the hour
     away-filter.js keeps. Nothing about it is ever shown: no time, no day, no count, no event. */
  function wd(d) { var x = D.months && D.months.days && D.months.days[key(d)]; return x ? x.withDan : null; }
  var AF = function () { return window.AwayFilter && window.AwayFilter.hasMonths() ? window.AwayFilter : null; };
  function homeState(n) { /* AWAYLAW1 (away-filter.js): the cal-months day flag. Drives the law filters only, never any words. */
    if (STATE === "home") return { away: false, preview: true };
    var A = AF(); if (!A) return { away: false, unknown: true };
    var t = n.getTime(); if (!A.isAwayAt(t)) return { away: false };
    for (var h = 1; h <= 24 * 40; h++) { var u = t + h * 36e5; if (!A.isAwayAt(u)) { var end = C.at(u - (u % 36e5)); return { away: true, end: end }; } }
    return { away: true, end: C.at(t + 40 * 864e5) };
  }
  /* kid items: cal-live only (works under ?now), through AwayFilter.keepItem and the dress-up law; pickup rows and away-state rows never count */
  var NOTITEM = { test: function (s) { return /\bpick-?up\b|\bdrop-?off\b|\bexchange\b|\bback home\b|\bmom/i.test(s) || LHRules.stateText(s); } };   /* Atlas law: away-state wording never shows, the row drops whole */
  function kidItems(k, n) {
    var A = AF(), t = n.getTime();   /* no valid away-state feed: the normal board, kid items included (Atlas: missing feed = awake board) */
    return ((D.cal && D.cal.upcomingLeaves) || []).filter(function (e) { var s = String(e.summary || ""); var end = C.at(e.end || e.start);
      return LHRules.kidName(k, s) && !dress(s) && !NOTITEM.test(s) && !LHRules.money(s) && end > n && !(k === "ainsley" && /lkms/i.test(s) && /(pick|drop|leave)/i.test(s)) && (!A || A.keepItem(e, t)); })
      .sort(function (a, b) { return C.at(a.start) - C.at(b.start); });
  }
  function events(n, cu) {
    return ((D.cal && D.cal.upcomingLeaves) || []).map(function (e) { return { id: e.id, start0: e.start, loc: String(e.location || ""), s: C.at(e.start), e: C.at(e.end), all: e.allDay === true || e.allDay === "True", raw: String(e.summary || ""), desc: String(e.description || ""), lb: e.leaveBy || null }; })
      .filter(function (e) {
        var t = e.raw; var L = LAW(); if (!t || dress(t) || (L && !L.keepEvent({ summary: t })) || e.e <= n) return false;          /* only what has ended leaves; all-day items stay the whole day */
        if (/lkms/i.test(t) && /ainsley/i.test(t)) return false;
        if (LHRules.otherPerson(t)) return false;                     /* "<KidFirstName> <Surname>" is someone else: off the candle and the stones */
        if (/\bpick-?up\b|\bdrop-?off\b|\bexchange\b/i.test(t) || LHRules.stateText(t)) return false;   /* Atlas law: no away-state words, no computed replacement */              /* a pickup is never an item */                                             /* no LKMS legs for Ainsley */
        if (KID.test(t) && LHRules.money(t)) return false;   /* Alfred P2: no dollar figure on a kid row */
        var A = AF(); if (A && !A.keepItem({ summary: t, start: e.start0, allDay: e.all }, n.getTime())) return false; /* AWAYLAW1: no kid time or logistics on away time */
        return true; })
      .map(function (e) { e.t = window.LHRules ? LHRules.glassTitle(clean(e.raw)) : short(e.raw); e.t = face(e.t); return e; }).filter(function (e) { return e.t && !LHRules.stateText(e.t); })   /* Atlas law: no AwayFilter.glass rewording; away-state rows drop whole */.sort(function (a, b) { return (a.s - b.s) || (b.all - a.all); });
  }
  function stone(e, n, far, i) {
    var el = document.createElement("div"); el.className = "lh-stone";
    var di = e.day != null ? e.day : Math.max(0, dayIdx(e.s, n)), day = di === 0 ? "Today" : di === 1 ? "Tomorrow" : fW.format(e.s);
    var d = document.createElement("div"); d.className = "d"; d.textContent = nb(day + " · " + (e.all ? "All day" : t12(e.s).replace(":00", "")));
    var w = document.createElement("div"); w.className = "w"; w.textContent = e.t;
    el.appendChild(d); el.appendChild(w); if (far) { el.style.setProperty("--b", (0.35 * Math.max(0, di - 1)) + "px"); el.style.setProperty("--br", String(1 - 0.06 * Math.max(0, di - 1))); }
    return el;
  }
  function stones(n, ev, ce) { /* LHRules.pickStones: today's remaining items first (all-day stays all day), then the next days fogged by
     days out; the candle's own item is not repeated; birthdays off. Max 4 wall, 3 phone, no overlap. */
    var list = LHRules.pickStones(ev, n.getTime(), { max: phone ? 3 : 4, skipId: ce && ce.ev && ce.ev.id });
    var N = $("#lh-near"), F = $("#lh-far"); N.innerHTML = ""; F.innerHTML = "";
    function fog(el, e) { var d = e.day; if (d > 1) { el.classList.add("fog"); el.style.setProperty("--fo", String(Math.min(0.5, 0.16 * (d - 1)))); } } /* the stone fades into fog; its text keeps full contrast */
    if (phone) {
      var Z = bandY + 640 * S, sh = Math.min(140, (VH - Z - 160) / 2 - 10), sw = Math.min(196, VW * 0.44), rows = [Z + 160 + sh, Z + 175 + 2 * sh];
      N.style.setProperty("--sw", sw + "px"); N.style.setProperty("--sh", sh + "px"); N.style.setProperty("--fd", "11px"); N.style.setProperty("--fw", "17px");
      list.slice(0, 3).forEach(function (e, i) { var s = stone(e, n, false, i); fog(s, e); s.style.left = (VW * (i % 2 ? 0.75 : 0.25)) + "px"; s.style.top = Math.min(rows[i >> 1], VH - 4) + "px"; N.appendChild(s); });
    } else {
      N.style.setProperty("--sw", 262 * K + "px"); N.style.setProperty("--sh", 196 * K + "px"); N.style.setProperty("--fd", 16 * K + "px"); N.style.setProperty("--fw", 25 * K + "px");
      var nx = [106, 292, 478, 664]; list.forEach(function (e, i) { var p = P(nx[i], 712), s = stone(e, n, false, i); fog(s, e); s.style.left = p[0] + "px"; s.style.top = Math.min(p[1], VH - 10 * K) + "px"; N.appendChild(s); });
    }
    de.classList.toggle("lh-no-stones", !list.length);
    de.setAttribute("data-stones", list.map(function (e) { return e.day + ":" + (e.all ? "all" : "t"); }).join(","));
  }
  var hooted = false;
  function rawOf(id) { return ((D.raw && D.raw.upcomingLeaves) || []).filter(function (r) { return r.id === id; })[0] || null; }
  function rawAll() { return ((D.raw && D.raw.upcomingLeaves) || []).map(function (r) { var o = {}; for (var k in r) o[k] = r[k]; o.allDay = r.allDay === true || r.allDay === "True"; return o; }); }
  function candleEvent(ev, n) { return window.LeaveBy ? LHRules.candlePick(ev, (D.raw && D.raw.upcomingLeaves) || [], n.getTime(), LeaveBy.find) : null; }   /* Prism (b): the next leave-by only */
  function candle(n, pick) { /* Prism (b): Dad's next leave-by (kid trips he drives included, never Ainsley's LKMS); none = unlit and empty.
     LHRules.candle: lit only on the leave day, a later leave names its day. Text from the cleaned event, leave-by from the RAW one. */
    var c = $(".lh-candle"); c.hidden = false;
    if (!pick) { c.classList.add("unlit", "empty"); $("[data-lh=cand-v]").textContent = ""; $("[data-lh=cand-k]").textContent = ""; c.style.setProperty("--h", ((phone ? 44 : 110 * K) * 0.5) + "px"); return; }
    var e = pick.ev, lb = pick.lb, lv = lb.leave, rem = (lv - n) / 6e4;
    var when = t12(lb.depart || e.s), place = window.LHRules ? school(LHRules.placeShort(e.loc)) : "";   /* airport code or a short place, never an address */
    var ct = e.t.replace(/^Dad:\s*/, ""), cd = LHRules.candle(lv.getTime(), n.getTime());
    c.classList.remove("empty"); c.classList.toggle("unlit", !cd.lit);
    $("[data-lh=cand-v]").textContent = nb(cd.label); $("[data-lh=cand-k]").textContent = nb([ct, when, place].filter(Boolean).join(" · "));
    fitCandle(c);
    var max = phone ? 44 : 110 * K, f = Math.max(0.08, Math.min(1, rem / 720)); c.style.setProperty("--h", (max * f) + "px");
    if (rem < 10 && !hooted) { hooted = true; try { var w = frame().contentWindow; w.__fire && (w.__fire("owl"), w.__fire("bats")); } catch (_) {} } /* near zero: owl + crows lift (scene sound stays muted until a tap) */
  }
  function fitCandle(c) { /* item 1: one line each; the value shrinks a little before it would ever wrap, the detail line ellipsizes on width */
    var v = c.querySelector(".v"); v.style.fontSize = ""; var fs = parseFloat(getComputedStyle(v).fontSize), min = phone ? 17 : 24 * K;
    while (v.scrollWidth > v.clientWidth + 1 && fs > min) { fs -= 1; v.style.fontSize = fs + "px"; }
    var k = c.querySelector(".k"); k.style.fontSize = ""; var fk = parseFloat(getComputedStyle(k).fontSize), mk = phone ? 11 : 16 * K;   /* the detail line shrinks a little before it ellipsizes */
    while (k.scrollWidth > k.clientWidth + 1 && fk > mk) { fk -= 0.5; k.style.fontSize = fk + "px"; }
  }
  function signFit() { /* Alfred P3 (phone): no name-tag tap box reaches the title board (390: was 33 x 10); the sign drops just enough */
    var sg = $(".lh-sign"); sg.style.transform = ""; if (!phone) return;
    var bd0 = $(".lh-board").getBoundingClientRect(), need = 0;
    $$(".lh-kw .name").forEach(function (e) { var r = e.getBoundingClientRect(); if (r.right > bd0.left && r.left < bd0.right && r.bottom + 2 > bd0.top) need = Math.max(need, r.bottom + 2 - bd0.top); });
    if (need) sg.style.transform = "translate(-50%, " + Math.ceil(need) + "px)";
  }
  function fitPhone() { /* phone: the candle (wax and flame included) clears the scene words above it, and every stone sits below the candle */
    if (!phone) return;
    var cl = $(".lh-cauldron"), lab = cl.querySelector(".lab"); cl.style.marginLeft = "0px"; var lr = lab.getBoundingClientRect();   /* the chores label stays inside the screen (390 wide) */
    if (lr.left < 6) cl.style.marginLeft = (6 - lr.left) + "px"; else if (lr.right > VW - 6) cl.style.marginLeft = (VW - 6 - lr.right) + "px";
    cl.style.marginTop = "0px"; var pr = cl.querySelector(".pot").getBoundingClientRect(), br = $(".lh-board").getBoundingClientRect();   /* that nudge must not tuck the pot under the title board */
    if (pr.right > br.left && pr.left < br.right && pr.top < br.bottom + 4 && pr.bottom > br.top) cl.style.marginTop = (br.bottom + 4 - pr.top) + "px";
    var c = $(".lh-candle"); if (c.hidden) return;
    var cr = c.getBoundingClientRect(), wx = c.querySelector(".wax").getBoundingClientRect(), fl = c.querySelector(".flame").getBoundingClientRect();
    var topNow = Math.min(cr.top, wx.top, fl.height ? fl.top : cr.top), need = 0;
    [".lh-away .lan", ".lh-cauldron .lab", ".lh-board", ".lh-dad .lh-plaque", "#lh-callout"].forEach(function (sel) { var o = $(sel); if (!o || o.closest("[hidden]")) return; var r = o.getBoundingClientRect();
      if (!r.height || r.right < Math.min(cr.left, wx.left) || r.left > Math.max(cr.right, wx.right)) return; if (r.bottom + 8 > topNow) need = Math.max(need, r.bottom + 8 - topNow); });
    if (need) { c.style.top = (parseFloat(c.style.top) + need) + "px"; cr = c.getBoundingClientRect(); }
    var cb = c.classList.contains("empty") ? cr.bottom : c.querySelector(".slate").getBoundingClientRect().bottom, stones = $$("#lh-near .lh-stone"), shift = 0;
    stones.forEach(function (s) { var r = s.getBoundingClientRect(); if (r.right > cr.left && r.left < cr.right && r.top < cb + 10) shift = Math.max(shift, cb + 10 - r.top); });
    if (shift) stones.forEach(function (s) { s.style.top = Math.min(parseFloat(s.style.top) + shift, VH - 4) + "px"; });
    /* Prism P2: close the dead band, the stones follow the candle up (the top stones sit 14 px under it), never above it */
    if (stones.length) { var sh = stones[0].getBoundingClientRect().height, r0 = cb + 14 + sh, r1 = r0 + 15 + sh;
      stones.forEach(function (s, i) { s.style.top = Math.min(i >> 1 ? r1 : r0, VH - 4) + "px"; }); }
  }
  /* ---------- windows, plaques, away lantern, callout ---------- */
  function lightOn(id) { var l = D.lights && D.feeds.lights === "live" && (D.lights.lights || []).filter(function (x) { return x.id === id; })[0]; return l ? !!(l.on && l.online !== false) : null; }
  function kidToday(k, n) { return kidItems(k, n).some(function (e) { return dayIdx(C.at(e.start), n) === 0; }); }
  function windows(n, cu) {   /* Prism (a): window glow = kid home with the room lamp on; something today = brass plaque + warm dot */
    ["ainsley", "hayes", "harris"].forEach(function (k) {
      var w = $(".lh-win[data-kid=" + k + "]"); w.classList.remove("dim", "dark", "glow", "lit");
      var lamp = k === "harris" ? lightOn("harris-room") : null;                    /* real Kasa dimmer in Harris's room; the others have no lamp feed */
      var ps = LHRules.plaqueState({ away: cu.away, unknown: cu.unknown, lamp: lamp, today: kidToday(k, n) });
      w.classList.add(ps.win);
      var pl = $(".lh-kw .name[data-kid=" + k + "]"), nx = cu.away ? null : kidItems(k, n)[0];
      pl.classList.toggle("today", ps.plaque === "today");
      pl.setAttribute("href", "../kid-" + k + ".html" + (nx && nx.id ? "?next=" + encodeURIComponent(nx.id) : ""));   /* the room opens on the next item */
    });
    var aw = $(".lh-away"); aw.hidden = !cu.away;   /* Alfred: the lantern carries no words (no return countdown, no away wording); Dad has no coarse status feed yet, so nothing */
    var fv = $(".lan-fire"); if (fv && fv.getAttribute("src")) try { if (cu.away && !RM.matches) fv.play().catch(function () {}); else fv.pause(); } catch (_) {}
    var st = ["ainsley", "hayes", "harris"].map(function (k) { var w = $(".lh-win[data-kid=" + k + "]"); return w.classList.contains("dark") ? "dark" : "lit"; }), anyGlow = !!$(".lh-win.glow");
    var kw = $("#lh-kidwins"); kw.style.setProperty("--strip", "url(art/facade-strip-" + st.join("-") + "-576x180.webp)");
    kw.style.setProperty("--sglow", st.indexOf("lit") < 0 ? "none" : "url(art/facade-strip-glow-" + st.join("-") + "-576x180.webp)"); kw.style.setProperty("--sgo", anyGlow ? "1" : ".6");
  }
  function kidLine(k, n, cu) {
    if (cu.away) return ""; /* away: no callout, no per-kid card; the one lantern says it */
    var e = kidItems(k, n)[0]; if (!e) return "";
    var s = C.at(e.start), di = dayIdx(s, n), day = di === 0 ? "Today" : di === 1 ? "Tomorrow" : fW.format(s), all = e.allDay === true || e.allDay === "True";
    var what = LHRules.stripSchool(short(e.summary)).replace(KIDRE[k], "").replace(/^\s*[·:,-]\s*/, "").replace(/^\s*(?:has|have|gets?|got|is)\s+(?=[a-z])/i, "").replace(/\bLKMS\s+/g, "").replace(/\s*·\s*\d{1,2}:\d\d$/, "").trim();
    what = face(what); what = what.charAt(0).toUpperCase() + what.slice(1); if (!what || LHRules.stateText(what) || LHRules.money(what)) return "";   /* Atlas law: never reworded, dropped */
    return day + (all ? "" : " " + t12(s).replace(":00", "")) + " · " + what;
  }
  function calloutKid(n, cu) { /* ?kid= picks one; else the kid whose next item comes first */
    var want = q.get("kid"); if (want && KIDRE[want]) return want;
    var best = null, bs = Infinity; ["ainsley", "hayes", "harris"].forEach(function (k) { var e = cu.away ? null : kidItems(k, n)[0]; if (e) { var t = +C.at(e.start); if (t < bs) { bs = t; best = k; } } });
    return best;
  }
  function callout(n, cu) { /* Prism P1: plain glass hanging straight from the kid's plaque, centred on that plaque, below every plaque */
    var g = $("#lh-callout"), k = calloutKid(n, cu), line = k ? kidLine(k, n, cu) : ""; if (!line) { g.hidden = true; return; }
    g.hidden = false; $("[data-lh=c-line]").textContent = nb(line);
    var pr = $(".lh-kw .name[data-kid=" + k + "]").getBoundingClientRect(), low = 0;
    $$(".lh-kw .name").forEach(function (e) { low = Math.max(low, e.getBoundingClientRect().bottom); });
    var top = low + (phone ? 6 : 10 * K);
    if (phone) { var dp = $(".lh-dad .lh-plaque").getBoundingClientRect(), sg = $(".lh-board").getBoundingClientRect(); top = Math.max(top, dp.bottom + 8, sg.bottom + 8); }
    var gw = g.offsetWidth, cx = pr.left + pr.width / 2, lx = Math.max(gw / 2 + 8, Math.min(VW - gw / 2 - 8, cx));
    g.style.left = lx + "px"; g.style.top = top + "px"; g.style.setProperty("--th", (top - pr.bottom) + "px");
    g.querySelector(".thread").style.left = (50 + (cx - lx) / gw * 100) + "%";   /* the thread stays under the plaque even when the glass is clamped */
  }

  /* ---------- cauldron (chores) + weather fog ---------- */
  /* chore cauldron: the hub tap store (TAPSYNC1, GET /api/taps on the house hub; the same key and tunnel as lights, read only,
     never written here, never committed). Fill = daily musts done today / daily musts due today, all three kids (LHRules.choreFill).
     Away days the pot rests. No hub key on this device, or no answer = an honest EMPTY pot, flagged (no demo data). */
  var TOKEN_LS = "wardos-lights-proxy-token";
  function loadTaps() {
    var base = D.lights && /^https:\/\//.test(String(D.lights.writeProxy || "")) ? String(D.lights.writeProxy).replace(/\/$/, "") : "", tok = "";
    try { tok = localStorage.getItem(TOKEN_LS) || ""; } catch (_) {}
    if (!base || (!tok && !/\.github\.io$/i.test(location.hostname))) { D.taps = null; D.tapsWhy = base ? "no hub key on this device" : "no hub address"; return Promise.resolve(); }
    var ctl = typeof AbortController !== "undefined" ? new AbortController() : null, tm = setTimeout(function () { try { ctl && ctl.abort(); } catch (_) {} }, 6000);
    return fetch(base + "/api/taps", { cache: "no-store", headers: tok ? { "X-Lights-Proxy-Token": tok } : {}, signal: ctl ? ctl.signal : undefined })
      .then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { D.taps = j && j.ok && j.taps ? j.taps : null; D.tapsWhy = D.taps ? "" : "hub did not answer"; })
      .catch(function () { D.taps = null; D.tapsWhy = "hub did not answer"; }).then(function () { clearTimeout(tm); });
  }
  /* feed health (real clock, not ?now): stale or offline feeds draw nothing and are flagged in data-feeds; the calendar keeps its
     last real sync on screen with an honest "Calendar offline · last <time>" tag */
  var FMAX = { cal: 180, lights: 30, sensi: 30, nest: 30 };
  function feeds() {
    var r = C.realMs(); for (var k in FMAX) D.feeds[k] = LHRules.feedState(D[k], r, FMAX[k]); D.feeds.taps = D.taps ? "live" : "offline";
    de.setAttribute("data-feeds", Object.keys(D.feeds).map(function (k) { return k + "=" + D.feeds[k]; }).join(" "));
    var tag = $("#lh-feedtag"), t = LHRules.feedTime(D.cal); tag.hidden = D.feeds.cal === "live";
    if (!tag.hidden) tag.textContent = "Calendar offline" + (t ? " · last " + fW.format(new Date(t)) + " " + t12(new Date(t)) : "");
  }
  function cauldron(n, cu) {
    var c = $(".lh-cauldron"), r = cu.away ? null : LHRules.choreFill(D.taps, D.kw, key(n)), f = r ? Math.max(0, Math.min(1, r.done / r.total)) : null;
    c.setAttribute("data-feed", cu.away ? "rest" : f == null ? "missing" : "live"); c.style.setProperty("--fill", f == null ? "0" : String(f));
    if (f == null && !cu.away) c.setAttribute("data-why", D.tapsWhy || "no chore feed"); else c.removeAttribute("data-why");
    $("[data-lh=chores-sub]").textContent = cu.away ? "Resting" : f == null ? "No chore feed yet" : ""; }
  function weatherFog() {
    try { var e = frame().contentWindow.__env && frame().contentWindow.__env(); var c = e && e.cur; var t = c && (c.temp != null ? c.temp : c.temperature);
      if (e && e.wx && /live|meteo|api/i.test(String(e.wx)) && typeof t === "number") { var f = Math.max(0, Math.min(1, (10 - t) / 15)); /* scene temp is in C */
        $("#lh").style.setProperty("--fognear", String(0.14 + 0.22 * f)); $("#lh").style.setProperty("--fogfar", String(0.12 + 0.2 * f)); de.setAttribute("data-wx", "live " + t.toFixed(1) + "C"); }
    } catch (_) {}
  }
  function leaves() { var L = $("#lh-leaves"); if (L.childElementCount || RM.matches) return; for (var i = 0; i < 9; i++) { var l = document.createElement("i"); l.className = "lh-leaf";
    l.style.left = (8 + i * 10.5) + "%"; l.style.setProperty("--d", (16 + (i * 7) % 9) + "s"); l.style.setProperty("--dl", (-i * 2.3) + "s"); l.style.setProperty("--dx", ((i % 2 ? 1 : -1) * (30 + i * 6)) + "px"); L.appendChild(l); } }
  /* ---------- layer 2: creatures, away-state look, season arc, real-house mirror ---------- */
  var KIDRE = { ainsley: /\bainsley\b/i, hayes: /\bhayes\b/i, harris: /\bharris\b/i };
  function creatures(n, cu) { /* perch when clear, pace when something of theirs starts within 60 min; absent in the away state (CSS) */
    var raw = ((D.cal && D.cal.upcomingLeaves) || []);
    $$(".lh-cr").forEach(function (c) { var k = c.getAttribute("data-kid"), soon = !cu.away && raw.some(function (e) { var s = C.at(e.start), m = (s - n) / 6e4;
      return !(e.allDay === true || e.allDay === "True") && m > 0 && m <= 60 && LHRules.kidName(k, e.summary || "") && !dress(e.summary); }); c.classList.toggle("pace", soon && !RM.matches); });
  }
  function season(n) { /* scene pack from clock.now() via LHScenePacks.forDate. Oct 24 starts the count. Oct 31 is street mode. */
    var pack = window.LHScenePacks.forDate(n), hw = pack.glow || q.get("halloween") === "preview", G = $("#lh-pglow");
    de.setAttribute("data-season", pack.id); de.setAttribute("data-plate", pack.plate); de.setAttribute("data-art", pack.art);
    de.classList.toggle("lh-halloween", hw); de.classList.toggle("lh-street", !!pack.street);
    if (pack.streetArt) de.setAttribute("data-street-art", pack.streetArt); else de.removeAttribute("data-street-art");
    G.innerHTML = "";
    if (hw) [[680, 494], [987, 550], [1066, 511], [1087, 427]].forEach(function (a) { var p = P(a[0], a[1]), i = document.createElement("i"), r = 90 * S; i.style.left = p[0] + "px"; i.style.top = p[1] + "px"; i.style.width = i.style.height = r + "px"; G.appendChild(i); });
    if (q.get("halloween") === "preview") { var pv = $("#lh-preview"); pv.hidden = false; pv.textContent = "PREVIEW · Halloween night look"; }
    $("#lh-leaves").hidden = !pack.leaves;
    countdown(pack); emptyPlate(pack); yard(n);
  }
  function countdown(pack) {
    var el = $("#lh-count"); if (!el) return;
    if (!pack.countdown || !pack.days) { el.hidden = true; el.setAttribute("data-days", "0"); return; }
    el.hidden = false; el.setAttribute("data-days", String(pack.days));
    el.querySelector("[data-lh=count]").textContent = String(pack.days);
    var host = el.querySelector(".pumpkins"); host.innerHTML = "";
    for (var i = 0; i < pack.days; i++) { var pump = document.createElement("i"); pump.className = "pumpkin"; host.appendChild(pump); }
    if (phone) { el.style.left = "12px"; el.style.top = Math.max(72, VH - 92) + "px"; }
  }
  function emptyPlate(pack) {
    var el = $("#lh-plate"); if (!el) return;
    if (pack.art !== "missing") { el.hidden = true; return; }
    el.hidden = false; el.setAttribute("data-feed", "missing"); el.setAttribute("data-plate", pack.plate); el.setAttribute("data-why", pack.why);
    $("[data-lh=plate]").textContent = pack.id === "december" ? "No snow plate yet" : "No harvest plate yet";
  }
  function monthKey(d) {
    var y = "", m = "";
    new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "2-digit" }).formatToParts(d).forEach(function (p) {
      if (p.type === "year") y = p.value; if (p.type === "month") m = p.value;
    });
    return y && m ? y + "-" + m : "";
  }
  function cryptFill(ev) {
    var box = $("#lh-jars"); if (!box || !window.LHCrypt) return;
    var photo = LHCrypt.photoHook();
    var slot = $(".lh-crypt-photo");
    slot.setAttribute("data-feed", photo.feed); slot.setAttribute("data-why", photo.why); slot.removeAttribute("src");
    var items = (ev || []).map(function (e) { return { t: e.t, month: monthKey(e.s) }; }).filter(function (e) { return e.t && !LHRules.stateText(e.t) && !LHRules.money(e.t); });
    var list = LHCrypt.jars(items);
    box.innerHTML = "";
    box.setAttribute("data-feed", list.length ? "live" : (D.feeds.cal === "live" ? "empty" : "missing"));
    if (!list.length) { var p = document.createElement("p"); p.className = "empty"; p.textContent = "No moments yet"; box.appendChild(p); return; }
    list.forEach(function (j) {
      var sec = document.createElement("section"), h = document.createElement("h2"), ul = document.createElement("ul");
      h.textContent = j.label; sec.className = "jar"; sec.appendChild(h);
      j.items.forEach(function (it) { var li = document.createElement("li"); li.textContent = it.t; ul.appendChild(li); });
      sec.appendChild(ul); box.appendChild(sec);
    });
  }
  function leaveSlot(d) {
    var map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }, wd = 0, h = 0, mi = 0;
    new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short", hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(d).forEach(function (p) {
      if (p.type === "weekday") wd = map[p.value] || 0; if (p.type === "hour") h = +p.value; if (p.type === "minute") mi = +p.value;
    });
    return { wd: wd, min: h * 60 + mi };
  }
  function rhythm(pick) {
    if (!window.LHRhythm) return;
    var info = pick && pick.lb && pick.lb.leave ? leaveSlot(pick.lb.leave) : null, store = null;
    try { store = localStorage; } catch (_) { store = null; }
    LHRhythm.observe(info, store);
    de.setAttribute("data-rhythm", LHRhythm.decide().mode);
  }
  function yard(n) { /* MISSING FEED hooks: weekly yard element + memory yard need a shared chore history; nothing is drawn until one exists */
    var Y = $("#lh-yard"); Y.innerHTML = ""; return null; }
  function mirror() {
    var t = D.sensi && D.feeds.sensi === "live" && D.sensi.thermostat, heat = !!(t && t.online && /heat|auto/i.test(t.mode || "") && typeof t.ambient === "number" && typeof t.heatSetpoint === "number" && t.ambient < t.heatSetpoint);
    $(".lh-smoke").hidden = !heat || phone;  /* chimney wisp only while the furnace would be calling for heat */
    var cam = D.nest && D.feeds.nest === "live" && (D.nest.cameras || []).some(function (c) { return c.online === true || !!c.snapshotUrl || !!c.streamUrl; });
    $(".lh-camlamp").hidden = !cam;            /* eave lamp only if a camera reports live; garage door state is a MISSING FEED hook */
    de.setAttribute("data-mirror", "heat=" + heat + " cam=" + !!cam + " harris=" + lightOn("harris-room"));
  }
  function paint() {
    if (!VW) return; var n = now(), cu = homeState(n);
    moon(n); windows(n, cu); var ev = events(n, cu), ce = candleEvent(ev, n); stones(n, ev, ce); candle(n, ce); signFit(); callout(n, cu); fitPhone(); cauldron(n, cu); weatherFog(); leaves();
    de.classList.toggle("lh-state-away", cu.away); de.classList.toggle("lh-state-home", !cu.away);
    creatures(n, cu); season(n); mirror(); cryptFill(ev); rhythm(ce);
    if (phone) { var door = $("#lh-crypt-door"); door.style.left = "8px"; door.style.top = (bandY + 8) + "px"; door.style.transform = "none"; }
    var pv = $("#lh-preview"); pv.hidden = !cu.preview; if (cu.preview) pv.textContent = "PREVIEW · sample look · not live data";
  }
  var lastTouch = C.ms(), capsVideo = false;
  function applyCinema(elapsed) {
    if (!window.LHCinema) return;
    var v = $("#lh-cinema"), view = LHCinema.consider(elapsed, { reduced: RM.matches, caps: capsVideo === true, phone: phone });
    var dead = !!(v && v.dataset.dead);
    de.setAttribute("data-cinema", view.on ? (view.video && !dead ? "video" : "poster") : "off");
    de.classList.toggle("lh-drift", !!view.on && (view.drift || dead) && !RM.matches);
    if (!v) return;
    if (!view.on) {
      v.hidden = true; try { v.pause(); } catch (_) {}
      if (v.getAttribute("src")) { v.removeAttribute("src"); try { v.load(); } catch (_) {} }
      return;
    }
    v.hidden = false; if (view.posterUrl) v.poster = view.posterUrl;
    if (view.video && view.src && !dead) {
      if (v.getAttribute("src") !== view.src) v.src = view.src;
      try { v.play().catch(function () {}); } catch (_) {}
    } else if (v.getAttribute("src")) { v.removeAttribute("src"); try { v.load(); } catch (_) {} }
  }
  function noteIdle(ms) { lastTouch = C.ms() - ms; applyCinema(ms); }
  function touchCinema() { lastTouch = C.ms(); applyCinema(0); }
  function go() { layout(); load(); var f = frame(); if (f) f.addEventListener("load", function () { layout(); setTimeout(weatherFog, 3000); }); }
  addEventListener("resize", layout);
  setInterval(function () { paint(); }, 20000); setInterval(load, 5 * 6e4); setInterval(function () { moon(now()); }, 1000);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(go, 50); }); else setTimeout(go, 50);
  if (q.get("probe") === "1") { var ps = document.createElement("script"); ps.src = "probe.js?v=LH1"; document.body.appendChild(ps); } /* perf probe, off by default */
  addEventListener("pointerdown", touchCinema, true);
  addEventListener("keydown", touchCinema, true);
  setInterval(function () { applyCinema(C.ms() - lastTouch); }, 1000);
  fetch("../night/media/caps.json", { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
    capsVideo = !!(j && j.video === true); applyCinema(C.ms() - lastTouch);
  }).catch(function () { capsVideo = false; });
  var cryptPanel = $("#lh-crypt");
  $("#lh-crypt-door").addEventListener("click", function () { cryptPanel.hidden = !cryptPanel.hidden; });
  $("#lh-crypt-close").addEventListener("click", function () { cryptPanel.hidden = true; });
  window.LivingHouse = { paint: paint, data: D, phase: moonPhase, noteIdle: noteIdle };
})();
/* LHVID1 · the porch-lantern flame video gets its src only when night/media/caps.json says the videos are reachable (the proxy).
   On Pages it stays the poster still and never requests the mp4; a later load error drops the src (onerror in index.html). */
(function () {
  var v = document.querySelector(".lan-fire"); if (!v || !v.dataset.src) return;
  fetch("../night/media/caps.json", { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
    if (!(j && j.video === true) || v.dataset.dead) return;
    v.src = v.dataset.src;
    var aw = document.querySelector(".lh-away"), rm = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (aw && !aw.hidden && !rm) v.play().catch(function () {});
  }).catch(function () {});
})();
