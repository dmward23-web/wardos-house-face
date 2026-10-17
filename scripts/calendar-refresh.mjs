#!/usr/bin/env node
/**
 * WardOS House Face · dmward23 calendar → kids-week.json + boardStrip
 *
 * Durable path for standing routine "House board calendar refresh".
 * Reads a calendar events dump (MCP list_events / search shape), rewrites
 * schedule fields on kids-week.json, drops past items, advances Next Up
 * (boardStrip + queue with ISO), rebuilds kids-data.js EMBEDDED, mirrors
 * into board-os/house-face when present.
 *
 * NEVER invents calendar facts. NEVER touches Family calendar.
 * Preserves quests / jars / currency / missions / streaks.
 *
 * Usage:
 *   node scripts/calendar-refresh.mjs --events /path/to/events.json
 *   node scripts/calendar-refresh.mjs --events … --deploy "calendar refresh …"
 *   node scripts/calendar-refresh.mjs --events … --dry-run
 *
 * Events file shapes accepted:
 *   { events: [...] }  |  [ ... ]  |  MCP tool result with events[]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { privPath, assertPrivateOut, namesRe, privateNames } from "./private-dir.mjs"; /* PRIVFEED1 */
const OTHER_FAM = (privateNames().otherfamily || []).map((n) => n.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
const OTHER_HAYES = OTHER_FAM.length ? new RegExp("\\bhayes\\s+(?:" + OTHER_FAM.join("|") + ")\\b") : /(?!)/;
const COPARENT_RE = namesRe("coparent"); /* PRIVNAME1 · co-parent name from ~/.config/wardos, never in git */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const TZ = "America/Chicago";

const PRESERVE_KID = [
  "id", "name", "you", "theme", "themeLabel", "gradeVoice", "avatar",
  "currency", "bankGoal", "quests", "fun", "streakLabel", "missions",
  "goal", "bag", "rides", "appointmentsEmpty", "sportsEmpty",
];
const PRESERVE_DAN = ["id", "name", "theme", "themeLabel", "avatar", "note", "picks", "leaveBys"];

function parseArgs(argv) {
  const out = {
    eventsPath: null,
    weekPath: privPath("kids-week.json"), /* PRIVFEED1 · box-only */
    mirrorDir: null, /* PRIVFEED1 · no board-os mirror of private data */
    deployNote: null,
    dryRun: false,
    nowIso: null,
    help: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--events" && argv[i + 1]) out.eventsPath = path.resolve(argv[++i]);
    else if (a === "--week" && argv[i + 1]) out.weekPath = path.resolve(argv[++i]);
    else if (a === "--mirror" && argv[i + 1]) out.mirrorDir = path.resolve(argv[++i]);
    else if (a === "--no-mirror") out.mirrorDir = null;
    else if (a === "--deploy" && argv[i + 1]) out.deployNote = argv[++i];
    else if (a === "--deploy") out.deployNote = "calendar refresh";
    else if (a === "--now" && argv[i + 1]) out.nowIso = argv[++i];
    else if (a === "--dry-run") out.dryRun = true;
    else if (a === "--help" || a === "-h") out.help = true;
  }
  return out;
}

function die(msg, code = 1) {
  console.error("calendar-refresh: ERROR:", msg);
  process.exit(code);
}

/** Chicago "now" via Intl — forever America/Chicago. */
function chicagoNow(overrideIso) {
  if (overrideIso) {
    const d = new Date(overrideIso);
    if (Number.isNaN(d.getTime())) die("bad --now ISO: " + overrideIso);
    return d;
  }
  return new Date();
}

function partsInTZ(date, tz = TZ) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const bag = {};
  for (const p of fmt.formatToParts(date)) {
    if (p.type !== "literal") bag[p.type] = p.value;
  }
  const isoFmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const iso = isoFmt.format(date); // YYYY-MM-DD
  const dayNum = String(parseInt(bag.day, 10));
  const asOf = `${bag.weekday} ${bag.month} ${dayNum} ${bag.year}`;
  return {
    date,
    iso,
    asOf,
    weekday: bag.weekday,
    month: bag.month,
    day: dayNum,
    year: bag.year,
    hour12: bag.hour,
    minute: bag.minute,
    dayPeriod: bag.dayPeriod,
  };
}

/* ALLDAY1 · an all-day event (date-only start) is a whole civil day, never a clock time. It starts at that
   day's CT midnight (so it sorts before the day's timed rows, never as noon) and carries allDay: true. */
function ctMidnight(civil) {
  const guess = new Date(civil + "T00:00:00Z");
  if (Number.isNaN(guess.getTime())) return null;
  const f = new Intl.DateTimeFormat("en-US", { timeZone: TZ, timeZoneName: "shortOffset" }); // that civil day's offset (CDT -5 / CST -6)
  const off = (f.formatToParts(new Date(guess.getTime() + 12 * 3600000)).find((x) => x.type === "timeZoneName") || {}).value || "GMT-5";
  const m = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(off);
  const mins = m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] || 0)) : -300;
  return new Date(guess.getTime() - mins * 60000);
}

function isAllDay(ev) {
  const block = ev.start;
  if (block && typeof block === "object") return !block.dateTime && !!block.date;
  return typeof block === "string" && block.length === 10;
}

function parseEventTime(ev, which) {
  const block = ev[which] || {};
  if (block.dateTime) {
    const d = new Date(block.dateTime);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (block.date) {
    // All-day: CT midnight of that civil date (ALLDAY1; was noon CT, which printed 12:00 on kid cards).
    // MCP dumps sometimes emit "2026-10-09T00:00:00Z" in date — take YYYY-MM-DD only.
    return ctMidnight(String(block.date).slice(0, 10));
  }
  // compact dump shape
  if (typeof ev[which] === "string") {
    const s = ev[which];
    if (s.length === 10) return ctMidnight(s);
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/* ALLDAY1 · the clock part of a row: "All day" for an all-day item, never 12:00 */
function whenTime(it) {
  return it.allDay ? "All day" : fmtTime(it.start);
}

/* NEXTLEAVE1 · what counts as a real leave-by for "Next leave": a leave, an SRE drop / pickup, a sport
   (event start = leave-by), an appointment, or any title that says pickup / drop / leave. Never an all-day note,
   never an SRE specials note. */
const LEAVE_KINDS = new Set(["leave", "school_drop", "school_pickup", "sport", "appointment"]);
const LEAVE_WORD_RE = /\b(pick\s*-?\s*up|drop(\s*-?\s*off)?|leave)\b/i; // "pickup at Quinn's" is a leave whatever its kind
function isRealLeave(it) {
  if (it.allDay || /SRE specials?/i.test(it.raw || "")) return false;
  return LEAVE_KINDS.has(it.kind) || LEAVE_WORD_RE.test(it.raw || "");
}

function isFree(ev) {
  if (ev.availability === "AVAILABILITY_FREE") return true;
  if (ev.transparency === "transparent") return true;
  return false;
}

function summaryOf(ev) {
  return String(ev.summary || ev.title || "").trim();
}

function isAdminNoise(summary) {
  return /^(GET\s*·|Atlas:)/i.test(summary);
}

function kidMentions(summary) {
  const s = summary.toLowerCase();
  /* SCHOOL2: "<Family> Kids [<initials> No School]" → each initial names a kid */
  const ns = /Ward Kids \[([AH]+) No School\]/i.exec(summary);
  const nsA = ns ? /A/i.test(ns[1]) : false;
  const nsH = ns ? /H/i.test(ns[1]) : false;
  return {
    ainsley: /\bainsley\b/.test(s) || nsA,
    hayes: (/\bhayes\b/.test(s) && !OTHER_HAYES.test(s)) || nsH, /* the other Hayes: surname from private-names.tsv role "otherfamily" */
    harris: /\bharris\b/.test(s) || nsH,
    boys: /\bboyes\b|\bharris\b.*\bhayes\b|\bhayes\b.*\bharris\b|\bboyes\b|SRE drop|SRE pickup|Hayes \+ Harris/i.test(summary),
  };
}

/* SOLOBOY1 2026-10-02 (Dan, Art Club Wed): "Hayes — SRE pickup · 3:40" names one boy →
   that boy only. "Hayes + Harris — SRE pickup" / untitled-kid SRE runs → both boys (unchanged). */
function soloBoy(summary) {
  const m = kidMentions(summary);
  if (m.hayes && !m.harris) return { kid: "hayes" };
  if (m.harris && !m.hayes) return { kid: "harris" };
  return {};
}
function isBoysRun(it, kidId) {
  return (it.kind === "school_drop" || it.kind === "school_pickup") && (!it.kid || it.kid === kidId);
}
/* KIDRIDE1 2026-10-02 (Dan): "<Kid> — … pickup/drop-off · t" (start = leave-by) is Dad's
   leave-by row for that one kid; it also stays on that kid's own glass (and wins his top card). */
const KID_RIDE = /^(Ainsley|Hayes|Harris)\s*—\s*.*\b(pick\s*-?\s*up|drop\s*-?\s*off)\b/i;
const KID_NAME = { ainsley: "Ainsley", hayes: "Hayes", harris: "Harris" };
function isKidRide(it, kidId) {
  return it.kind === "leave" && !!it.kidRide && it.kid === kidId;
}
/* Dad glass label: single-kid ride / SRE run says whose ("3:15 Hayes SRE pickup"). */
function danWhat(it) {
  const what = kidsSafeWhat(it.raw, it.kind);
  const solo = it.kidRide || it.kind === "school_drop" || it.kind === "school_pickup";
  if (!solo || !it.kid || !KID_NAME[it.kid]) return what;
  if (new RegExp("\\b" + it.kid + "\\b", "i").test(what)) return what;
  return `${KID_NAME[it.kid]} ${what}`;
}

function classify(ev) {
  const summary = summaryOf(ev);
  if (!summary || isAdminNoise(summary)) return null;
  if (/^Kids with Dan/i.test(summary)) return { kind: "custody", summary };
  if (/^Leave\s*·/i.test(summary) || /^Leave\b/i.test(summary)) {
    return { kind: "leave", summary, busy: !isFree(ev) };
  }
  /* RIDES LAW (Dan 9/29): Dad's own pickups/drop-offs ("Pick up <kid> + a friend…",
     "Drop <kid> at a friend's…") are Dad logistics, never a kid's activity. Treat as
     leave → Dad strip / dan box only; kid glass shows the kid's own practice event. */
  if (/^(Pick\s*up|Drop)\b/i.test(summary) && !/SRE (drop|pickup)/i.test(summary)) {
    return { kind: "leave", summary, busy: !isFree(ev), ride: true };
  }
  /* KIDRIDE1: "<co-parent>: <Kid> — … pickup/drop-off" (Free, their week) = awareness on the kid's
     glass only — never a Dad leave-by row or a sport card. */
  /* AWAY1 (Oct 11): co-parent events never reach the House Face. */
  if (COPARENT_RE.test(summary)) return null;
  /* SCHOOL first (before KIDRIDE1): titles like "… Math Counts · pickup 4:00" are school,
     not Dad leave-by rides. KIDRIDE1 still catches real kid pickup/drop-off leave-bys. */
  if (/SRE drop-off|SRE drop\b/i.test(summary)) return { kind: "school_drop", summary, ...soloBoy(summary) };
  if (/SRE pickup/i.test(summary)) return { kind: "school_pickup", summary, ...soloBoy(summary) };
  if (/Homework Help/i.test(summary)) return { kind: "school", summary, kid: "ainsley" };
  if (/hearing\/vision|Hearing\/Vision|PE \(tennis|SRE specials?|SRE spirit|SRE (Orange|Yellow|Green|Red) Day|Peace Week|field trip|yearbook|picture (retake|makeup)|baby pic|LKMS (choir|fall conferences|Cougar Night|Bingo|baby|Homework Help|Math Counts|Outsiders)|Outsiders Day|\b[A-Z][a-z]+ conference\b|choir Sing|permission form due|Ward Kids \[[AH]+ No School\]|no school \(elem|conference sign-ups|Tailgate|Halloween Bash|Halloween parade|Halloween class parties|Abraca-Boo|Fall Family Fun Night|Chat\s*&\s*Chew|Chat and Chew|Art Club|fall conferences/i.test(summary)) { /* SPECIALS1+SCHOOL2: all kids school info on kid boards + hub */
    return { kind: "school", summary };
  }
  { const kr = KID_RIDE.exec(summary);
    if (kr && !/SRE (drop|pickup)/i.test(summary)) {
      return { kind: "leave", summary, busy: !isFree(ev), ride: true, kidRide: true, kid: kr[1].toLowerCase() };
    } }
  if (/swim|Swim|Coach Ann/i.test(summary)) return { kind: "sport", sport: "swim", summary, kid: "ainsley" };
  if (/baseball|BASEBALL|Falcons/i.test(summary) && /hayes/i.test(summary)) {
    return { kind: "sport", sport: "baseball", summary, kid: "hayes" };
  }
  if (/flag/i.test(summary) && /harris/i.test(summary)) {
    return { kind: "sport", sport: "flag", summary, kid: "harris" };
  }
  if (/flag/i.test(summary) && /hayes/i.test(summary)) {
    return { kind: "sport", sport: "flag", summary, kid: "hayes" };
  }
  if (/^Ainsley\b.*\b(appointment|appt)\b/i.test(summary)) {
    return { kind: "appointment", summary, kid: "ainsley" };
  }
  if (/vanity|Jessy/i.test(summary) && /ainsley/i.test(summary)) {
    return { kind: "appointment", summary, kid: "ainsley", herSpace: true };
  }
  if (/DRIVE\s*→\s*Nashville|Dan DRIVE/i.test(summary)) {
    return { kind: "leave", summary, busy: !isFree(ev), travel: true };
  }
  if (/^Dan\s*—/i.test(summary) || /^Dan\s+—/i.test(summary)) {
    // Dad box only — skip pure adult chores unless Leave/Drive
    if (/Large Item|garage-sale|HOA|cleaners|\bDr\.? [A-Z][a-z]+|KS DL|tree-trim|\bgift\b/i.test(summary)) {
      return { kind: "dad", summary, busy: !isFree(ev) };
    }
  }
  if (/pack late-lunch|snacks/i.test(summary) && /hayes/i.test(summary)) {
    return { kind: "school", summary, kid: "hayes" };
  }
  if (/Madi|provider collab/i.test(summary)) {
    return { kind: "school", summary, kid: "hayes" };
  }
  // Fallback: kid-named timed events land on boards
  const kids = kidMentions(summary);
  if (kids.ainsley || kids.hayes || kids.harris) {
    return { kind: "other", summary, kids };
  }
  return null;
}

function fmtTime(date) {
  const p = partsInTZ(date);
  let h = p.hour12;
  const min = p.minute;
  const ap = (p.dayPeriod || "").toLowerCase().startsWith("p") ? "p" : "a";
  if (min === "00") return `${h}:00`;
  return `${h}:${min}`;
}

function fmtTimeShort(date) {
  const p = partsInTZ(date);
  return `${p.hour12}:${p.minute}`;
}

function fmtDayLabel(date) {
  const p = partsInTZ(date);
  return `${p.weekday} ${p.day}`;
}

function fmtDowShort(date) {
  return partsInTZ(date).weekday;
}

function loadEvents(filePath) {
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (Array.isArray(raw)) return dedupeEvents(raw);
  if (Array.isArray(raw.events)) return dedupeEvents(raw.events);
  if (raw.result && Array.isArray(raw.result.events)) return dedupeEvents(raw.result.events);
  die("events file has no events[]: " + filePath);
}

/* DEDUPE1 · same start + same who + same title (ignoring "(...)" notes, punctuation, case)
 * = one card. Keep the longest title (most detail). Stops double-booked calendar
 * writes (e.g. two "Hayes — SRE specials: PE + Library" at 7:00) from showing twice. */
function dedupeKey(ev) {
  const st = (ev.start && (ev.start.dateTime || ev.start.date)) || ev.start || "";
  const t = new Date(st);
  const when = isNaN(t) ? String(st) : t.toISOString();
  const base = String(ev.summary || ev.title || "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9+]+/g, " ")
    .trim();
  return when + "|" + base;
}
function dedupeEvents(list) {
  const keep = new Map();
  const out = [];
  for (const ev of list) {
    if (!ev || ev.status === "cancelled" || ev.status === "canceled") { out.push(ev); continue; }
    const k = dedupeKey(ev);
    if (!keep.has(k)) { keep.set(k, out.length); out.push(ev); continue; }
    const i = keep.get(k);
    const a = String(out[i].summary || ""), b = String(ev.summary || "");
    if (b.length > a.length) out[i] = ev;
    console.error("[dedupe] dropped duplicate: " + (b.length > a.length ? a : b));
  }
  return out;
}

function stripDollars(s) {
  return String(s || "").replace(/\$\d+(?:\.\d+)?/g, "").replace(/\s{2,}/g, " ").trim();
}

function kidsSafeWhat(summary, kind) {
  let s = summary
    .replace(/^Leave\s*·\s*/i, "")
    .replace(/^Ainsley\s*—\s*/i, "")
    .replace(/^Hayes\s*—\s*/i, "")
    .replace(/^Harris\s*—\s*/i, "")
    .replace(/^Hayes \+ Harris\s*—\s*/i, "")
    .replace(/^Dan\s*—\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
  s = stripDollars(s);
  s = s.replace(/\s*\((?:tennis shoes|wear [^)]*)\)/gi, "").trim(); /* LAW8C1 · no clothing hints */
  // kids-safe: drop Mom order IDs / adult refund chatter from leave titles on kid glass
  if (kind === "leave") {
    s = s.replace(/\(Mom[^)]*\)/gi, "").replace(/WK\d+/gi, "").trim();
  }
  // Drop trailing "· 3:00" / "· 5:00 practice" clock echo when strip already shows time
  s = s.replace(/\s*·\s*\d{1,2}:\d{2}(\s*(am|pm|a|p|practice|game))?\s*$/i, "").trim();
  s = s.replace(/\s*·\s*leave\s+\d{1,2}:\d{2}.*$/i, "").trim();
  return s;
}

/* LAW8C1 · no colour-day / dress-up / spirit / clothing prompts anywhere on glass (same law as house-face-law.js) */
const DRESS_RE = /\b(?:orange|red|blue|green|pink|purple|yellow|black|white|gold|maroon|colou?r|crazy hair|pajamas?|pj|twin|hat|jersey|spirit|outsiders)\s+day\b|dress[- ]?up|spirit\s+week|\bwear\b/i;
function buildBoardItems(events, now) {
  const items = [];
  for (const ev of events) {
    if (DRESS_RE.test(String(ev.summary || ""))) continue;
    if (ev.status === "cancelled" || ev.status === "canceled") continue;
    /* CANCELGONE1 · title marked canceled = gone from board */
    if (/^\s*[\[(]?\s*(cancel+ed|cxl)\b/i.test(String(ev.summary || ""))) continue;
    /* SOFTGONE1 · TBD / DONE / BACKUP / "cancel if" = no card, no countdown */
    if (ev.status === "tentative" || /(^\s*[\[(]?\s*(cancel+ed|cxl|done|backup|tentative)\b)|\btbd\b|\bcancel if\b/i.test(String(ev.summary || ""))) continue;
    const start = parseEventTime(ev, "start");
    const end = parseEventTime(ev, "end") || start;
    if (!start || !end) continue;
    const cls = classify(ev);
    if (!cls) continue;
    items.push({
      ...cls,
      id: ev.id,
      start,
      end,
      startIso: start.toISOString(),
      endIso: end.toISOString(),
      location: ev.location || "",
      free: isFree(ev),
      raw: summaryOf(ev),
      allDay: isAllDay(ev),
    });
  }
  items.sort((a, b) => a.start - b.start);
  return items;
}

/* PINSPEC1 2026-09-30 (Dan): today's SRE specials stay pinned at the top of
   Next Up until morning drop-off is done (8:40 CT), even after their 7:00 stub ends. */
function ctMinutes(date) {
  const f = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit", hourCycle: "h23" });
  const b = {};
  for (const p of f.formatToParts(date)) b[p.type] = p.value;
  return Number(b.hour) * 60 + Number(b.minute);
}
function pinnedSpecials(item, now) {
  if (!/SRE specials?/i.test(item.raw || "")) return false;
  if (partsInTZ(item.start).iso !== partsInTZ(now).iso) return false;
  return ctMinutes(now) < 8 * 60 + 40;
}

function stillRelevant(item, now) {
  if (pinnedSpecials(item, now)) return true;
  // Drop when ended (5 min grace so "just ended" clears quickly)
  return item.end.getTime() + 5 * 60 * 1000 > now.getTime();
}

function stripPriority(item) {
  // Lower = better for Next Up
  if (item.kind === "leave") return 0;
  if (item.kind === "school_pickup" || item.kind === "school_drop") return 1;
  if (item.kind === "sport") return 2;
  if (item.kind === "appointment") return 3;
  if (item.kind === "school") return 4;
  if (item.kind === "dad" && item.busy) return 5;
  if (item.kind === "custody") return 9;
  return 6;
}

function pickStripQueue(items, now, homeWeek) {
  /* Next Up = not-yet-started (or started <10m ago). In-progress long dad chores
     must NOT block kids/leaves. Past endIso already dropped by stillRelevant. */
  const leadMs = 10 * 60 * 1000;
  const upcoming = items
    .filter((it) => stillRelevant(it, now) && it.kind !== "custody")
    .filter((it) => it.kind !== "dad") // Dad chores stay on dan.today/week, not Next Up strip
    .filter((it) => !it.allDay) // ALLDAY1: Next Up is timed rows only; all-day notes live on the day lists as "All day"
    .filter((it) => pinnedSpecials(it, now) || it.start.getTime() + leadMs >= now.getTime()) // future / just-started only (PINSPEC1 keeps today's specials)
    .slice()
    .sort((a, b) => {
      const pa = pinnedSpecials(a, now) ? 0 : 1, pb = pinnedSpecials(b, now) ? 0 : 1;
      if (pa !== pb) return pa - pb;
      const dt = a.start - b.start;
      if (dt !== 0) return dt;
      return stripPriority(a) - stripPriority(b);
    });

  const queue = upcoming.slice(0, 12).map((it) => {
    const time = fmtTimeShort(it.start);
    let place;
    if (it.kind === "leave") place = it.kidRide ? danWhat(it) : kidsSafeWhat(it.raw, "leave");
    else if (it.kind === "school_pickup") place = it.kid ? `${KID_NAME[it.kid]} SRE pickup` : "Boys SRE pickup";
    else if (it.kind === "school_drop") place = it.kid ? `${KID_NAME[it.kid]} SRE drop` : "Boys SRE drop";
    else if (it.kind === "sport") place = kidsSafeWhat(it.raw, "sport");
    else place = kidsSafeWhat(it.raw, it.kind);
    // Cap length for strip
    if (place.length > 56) place = place.slice(0, 53) + "…";
    const dayPart = partsInTZ(it.start);
    const sameDay = dayPart.iso === partsInTZ(now).iso;
    const whenLabel = sameDay
      ? fmtTime(it.start)
      : `${fmtDowShort(it.start)} ${fmtTime(it.start)}`;
    return {
      label: sameDay ? "Next up · today" : `Next up · ${fmtDowShort(it.start)}`,
      time,
      place,
      detailHtml: detailFor(it, homeWeek, upcoming),
      badge: fmtDowShort(it.start),
      startIso: it.startIso,
      endIso: it.endIso,
      kind: it.kind,
      whenLabel,
      summary: it.raw,
      leaveBy: isRealLeave(it), // NEXTLEAVE1
    };
  });

  return queue;
}

function detailFor(it, homeWeek, upcoming) {
  const bits = [];
  const through = homeWeek && homeWeek.with === "away"
    ? (homeWeek.through ? `kids away · back ${homeWeek.through}` : "kids away")
    : (homeWeek && homeWeek.through
      ? `kids with Dad at <strong>home</strong> through ${homeWeek.through}`
      : "kids with Dad at <strong>home</strong>");
  // Add a couple of later same-day anchors
  const sameDay = upcoming.filter(
    (x) => partsInTZ(x.start).iso === partsInTZ(it.start).iso && x.id !== it.id && !x.allDay
  ).slice(0, 2);
  for (const x of sameDay) {
    if (x.kind === "sport") bits.push(`${fmtTime(x.start)} ${kidsSafeWhat(x.raw, "sport").split("·")[0].trim()}`);
    else if (x.kind === "leave") bits.push(`${fmtTime(x.start)} leave`);
    else if (x.kind === "school_pickup") bits.push(`${fmtTime(x.start)} ${x.kid ? KID_NAME[x.kid] : "boys"} pickup`);
  }
  const extra = bits.length ? bits.join(" · ") + " · " : "";
  return `${extra}${through}`;
}

function custodyFromItems(items, now) {
  const custody = items.filter((it) => it.kind === "custody").slice().sort((a, b) => a.start - b.start);
  // Active Dad span: start <= now < end
  const active = custody.find((it) => it.start <= now && now < it.end);
  if (active) {
    const endP = partsInTZ(active.end);
    const startP = partsInTZ(active.start);
    const through = `${endP.weekday} ${endP.month} ${endP.day} · ${fmtTime(active.end)}`;
    return {
      with: "Dad",
      place: "Home",
      through,
      throughLabel: `with Dad at home · ${startP.weekday} ${startP.month} ${startP.day} ${fmtTime(active.start)} → ${through}`,
      endIso: active.endIso,
    };
  }
  // Between / after Dad weeks → Mom week. Never name the co-parent on glass (CALENDAR LAW).
  const nextDad = custody.find((it) => it.start > now);
  const lastEnded = [...custody].filter((it) => it.end <= now).sort((a, b) => b.end - a.end)[0];
  if (nextDad) {
    const endP = partsInTZ(nextDad.start);
    const through = `${endP.weekday} ${endP.month} ${endP.day} · ${fmtTime(nextDad.start)}`;
    return {
      with: "away",
      place: "",
      through,
      throughLabel: `kids away · back ${through}`,
      endIso: nextDad.startIso,
    };
  }
  if (lastEnded) {
    return {
      with: "away",
      place: "",
      through: "next Dad week",
      throughLabel: "kids away",
      endIso: lastEnded.endIso,
    };
  }
  return {
    with: "Dad",
    place: "Home",
    through: "—",
    throughLabel: "with Dad at home",
  };
}

function rowWhen(it, now) {
  const same = partsInTZ(it.start).iso === partsInTZ(now).iso;
  const day = same ? partsInTZ(now).weekday.slice(0, 3) : fmtDayLabel(it.start);
  return `${day} · ${whenTime(it)}`;
}

function buildKidToday(kidId, items, now, homeWeek) {
  const todayIso = partsInTZ(now).iso;
  const rows = [];
  for (const it of items) {
    if (!stillRelevant(it, now)) continue;
    if (partsInTZ(it.start).iso !== todayIso && it.kind !== "custody") continue;
    const kids = kidMentions(it.raw);
    const mine =
      (kidId === "ainsley" && (it.kid === "ainsley" || kids.ainsley)) ||
      (kidId === "hayes" && (it.kid === "hayes" || kids.hayes || isBoysRun(it, "hayes"))) ||
      (kidId === "harris" && (it.kid === "harris" || kids.harris || isBoysRun(it, "harris")));
    if (!mine && it.kind !== "custody") continue;
    if (it.kind === "custody") continue;
    if (isAdminNoise(it.raw)) continue;
    let what = kidsSafeWhat(it.raw, it.kind);
    let tone = "act";
    let kind = "event";
    if (it.kind === "sport") { tone = "hot"; what = (kidId === "hayes" && /baseball/i.test(it.raw) ? "⚾ " : kidId === "harris" && /flag/i.test(it.raw) ? "🏁 " : kidId === "ainsley" && /swim/i.test(it.raw) ? "" : "") + what; }
    if (it.kind === "appointment") tone = "hot";
    if (it.kind === "leave" && !isKidRide(it, kidId)) continue; // leaves are Dad strip / dan box, not kid glass (KIDRIDE1: own ride stays)
    if (isKidRide(it, kidId) && !rows.some((r) => r.ride)) { rows.unshift({ kind, when: rowWhen(it, now), what, hint: "", tone: "hot", ride: true }); continue; }
    rows.push({
      kind,
      when: rowWhen(it, now),
      what,
      hint: it.kind === "sport" ? "YOUR board" : "",
      tone,
    });
  }
  const mom = homeWeek && homeWeek.with === "away";
  rows.push({
    kind: "note",
    when: "All day",
    what: mom
      ? "Kids away" /* AWAY1 */
      : (kidId === "ainsley" ? "Base at home with Dad" : kidId === "hayes" ? "🏡 DROP ZONE HQ with Dad" : "🏡 YOUR BASE with Dad"),
    hint: mom ? `back ${homeWeek.through}` : `through ${homeWeek.through}`,
    tone: "hot",
  });
  return rows.slice(0, 6).map(({ ride, ...r }) => r);
}

function buildKidSports(kidId, items, now) {
  const out = [];
  for (const it of items) {
    if (it.kind !== "sport") continue;
    if (!stillRelevant(it, now)) continue;
    if (it.kid && it.kid !== kidId) continue;
    const kids = kidMentions(it.raw);
    if (it.kid !== kidId && !(kids[kidId])) continue;
    const leaveHint = it.allDay ? "All day" : `leave ${fmtTime(it.start)}`;
    out.push({
      when: `${fmtDayLabel(it.start)} · ${leaveHint}`,
      what: kidsSafeWhat(it.raw, "sport"),
      hint: "YOUR board",
      tone: "hot",
    });
  }
  return out;
}

function buildKidSchool(kidId, items, now) {
  const out = [];
  for (const it of items) {
    if (!["school", "school_drop", "school_pickup"].includes(it.kind)) continue;
    if (!stillRelevant(it, now)) continue;
    const kids = kidMentions(it.raw);
    const mine =
      it.kid === kidId ||
      kids[kidId] ||
      (isBoysRun(it, kidId) && (kidId === "hayes" || kidId === "harris"));
    if (!mine) continue;
    if (kidId === "ainsley" && (it.kind === "school_drop" || it.kind === "school_pickup")) continue;
    out.push({
      when: `${fmtDayLabel(it.start)} · ${whenTime(it)}`,
      what: kidsSafeWhat(it.raw, "school"),
      tone: "act",
      hint: "",
    });
  }
  return out;
}

function buildKidAppointments(kidId, items, now) {
  const out = [];
  for (const it of items) {
    if (it.kind !== "appointment") continue;
    if (!stillRelevant(it, now)) continue;
    if (it.kid && it.kid !== kidId) continue;
    const row = {
      when: `${fmtDayLabel(it.start)} · ${whenTime(it)}`,
      what: kidsSafeWhat(it.raw, "appointment"),
      hint: "with Dad",
      tone: "hot",
    };
    if (it.herSpace) row.herSpace = true;
    out.push(row);
  }
  return out;
}

function hottestFor(kidId, items, now, homeWeek) {
  const upcoming = items.filter((it) => stillRelevant(it, now));
  const mine = upcoming.filter((it) => {
    if (isKidRide(it, kidId)) return true;
    if (it.kind === "leave" || it.kind === "dad" || it.kind === "custody") return false;
    if (it.kid === kidId) return true;
    const kids = kidMentions(it.raw);
    if (kids[kidId]) return true;
    if (isBoysRun(it, kidId) && (kidId === "hayes" || kidId === "harris")) return true;
    return false;
  });
  /* TOPDAY1 · a note that spans days (started before today, runs >20h) sinks below real timed items */
  const longNote = (x) => x.start < now && (x.end - x.start) > 20 * 3600 * 1000;
  mine.sort((a, b) => (longNote(a) - longNote(b)) || a.start - b.start || stripPriority(a) - stripPriority(b));
  /* KIDRIDE1: on a day with his own pickup/drop-off, that ride is the top card */
  const first = mine[0];
  const firstIso = first ? partsInTZ(first.start < now ? now : first.start).iso : "";
  const ride = first && mine.find((x) => x.kidRide && x.start >= now && partsInTZ(x.start).iso === firstIso); /* DADSPAN1 · same day as the real next thing */
  const hit = ride || first;
  const mom = homeWeek && homeWeek.with === "away";
  if (!hit) {
    return mom
      ? {
          when: `${partsInTZ(now).weekday.toUpperCase()} · kids away`,
          what: "KIDS AWAY",
          where: `until ${homeWeek.through}`,
          badges: ["KIDS AWAY"],
        }
      : {
          when: `${partsInTZ(now).weekday.toUpperCase()} · base at home`,
          what: "YOUR BASE WITH DAD",
          where: `through ${homeWeek.through}`,
          badges: ["DAD WEEK", "Home"],
        };
  }
  return {
    when: `${fmtDowShort(hit.start).toUpperCase()} · ${whenTime(hit)}`,
    what: kidsSafeWhat(hit.raw, hit.kind).toUpperCase().slice(0, 48),
    where: mom
      ? `kids away · back ${homeWeek.through}`
      : `with Dad at home · through ${homeWeek.through}`,
    badges: [fmtDowShort(hit.start).toUpperCase(), whenTime(hit)],
  };
}

function buildDanToday(items, now, homeWeek) {
  /* Full calendar day on Dad Today — do NOT drop past same-day (night void bug). */
  const todayIso = partsInTZ(now).iso;
  const rows = [];
  const seen = new Set();
  for (const it of items) {
    if (partsInTZ(it.start).iso !== todayIso) continue;
    if (it.kind === "custody") continue;
    if (isAdminNoise(it.raw)) continue;
    // Dad box: leaves, school logistics, sports, appointments, notable dad
    if (!["leave", "school_drop", "school_pickup", "sport", "appointment", "school", "dad"].includes(it.kind)) continue;
    const when = `${partsInTZ(now).weekday.slice(0, 3)} · ${whenTime(it)}`;
    const what = danWhat(it);
    const key = `${when}|${what}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      when,
      what,
      tone: it.kind === "leave" || it.kind === "sport" || it.kind === "appointment" || it.kind === "dad" ? "hot" : "act",
    });
  }
  rows.push({
    when: "home week",
    what: homeWeek.with === "away"
      ? `Kids away · back ${homeWeek.through}`
      : `Kids with Dad at home through ${homeWeek.through}`,
    tone: "hot",
  });
  return rows.slice(0, 10);
}

function buildDanWeek(items, now, homeWeek) {
  const rows = [];
  const seen = new Set();
  for (const it of items) {
    if (!stillRelevant(it, now)) continue;
    if (isAdminNoise(it.raw)) continue;
    if (!["leave", "school_drop", "school_pickup", "sport", "appointment", "school"].includes(it.kind)) continue;
    const when = `${fmtDayLabel(it.start)} · ${whenTime(it)}`;
    const what = danWhat(it);
    const key = `${when}|${what}`.toLowerCase();
    if (seen.has(key)) continue; /* Harris+Hayes PE → one card */
    seen.add(key);
    rows.push({
      when,
      what,
      tone: it.kind === "leave" || it.kind === "sport" ? "hot" : it.kind === "appointment" ? "act" : "act",
    });
  }
  rows.push({
    when: homeWeek.with === "away" ? `back ${homeWeek.through}` : `through ${homeWeek.through}`,
    what: homeWeek.with === "away" ? "Kids away" : "Kids with Dad at home",
    tone: "hot",
  });
  return rows.slice(0, 24);
}

function rebuildEmbed(kidsDataPath, weekObj) {
  const src = fs.readFileSync(kidsDataPath, "utf8");
  const json = JSON.stringify(weekObj);
  const next = src.replace(
    /var EMBEDDED = \{[\s\S]*?\};/,
    "var EMBEDDED = " + json + ";"
  );
  if (next === src) die("kids-data.js EMBEDDED replace failed — pattern miss");
  return next;
}

function writeWeekTree(weekPath, weekObj, _kidsDataPath, dryRun) {
  /* PRIVFEED1 · kids-week lives only in the private folder: no data/ twin, no kids-data.js EMBEDDED rebuild */
  const text = JSON.stringify(weekObj, null, 2) + "\n";
  if (dryRun) {
    console.log("dry-run: would write", weekPath);
    return;
  }
  assertPrivateOut(weekPath, "kids-week");
  const tmp = weekPath + ".tmp";
  fs.writeFileSync(tmp, text, { mode: 0o600 });
  fs.renameSync(tmp, weekPath);
}

function mirrorToBoardOs(mirrorDir) {
  /* PRIVFEED1 · board-os mirror retired: it copied private data into another work tree */
  if (mirrorDir) console.log("calendar-refresh: mirror retired (PRIVFEED1) · skip", mirrorDir);
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.eventsPath) {
    console.log(`Usage: node scripts/calendar-refresh.mjs --events <file.json> [--deploy [note]] [--dry-run]`);
    process.exit(args.help ? 0 : 2);
  }
  if (!fs.existsSync(args.eventsPath)) die("events file missing: " + args.eventsPath);

  const now = chicagoNow(args.nowIso);
  const nowP = partsInTZ(now);
  const events = loadEvents(args.eventsPath);
  /* DADSPAN1 · kid/strip/ride logistics only inside a "Kids with Dan" span. */
  const allItems = buildBoardItems(events, now);
  const spans = allItems.filter((it) => it.kind === "custody");
  const isKidLogistics = (it) => {
    if (it.kind === "custody") return false;
    /* SCHOOLALWAYS1 · school awareness (specials, dress-up days, conferences, no-school)
       stays on kid boards even on mom weeks / Nashville — standing "Kids school info on boards". */
    if (it.kind === "school") return false;
    if (it.kid || it.kidRide || it.ride || it.kind === "school_drop" || it.kind === "school_pickup" || it.kind === "sport") return true;
    const m = kidMentions(it.raw || it.summary || "");
    return !!(m.hayes || m.harris || m.ainsley);
  };
  const inDadSpan = (it) => spans.some((c) => it.start >= c.start && it.start < c.end);
  const nowInSpan = spans.some((c) => now >= c.start && now < c.end);
  /* an all-day kid note that started in Dad's span doesn't carry into the kids-away days */
  const items = allItems.filter((it) => !isKidLogistics(it) || (inDadSpan(it) && (nowInSpan || it.start >= now)));
  const homeWeek = custodyFromItems(items, now);
  const queue = pickStripQueue(items, now, homeWeek);
  const head = queue[0] || {
    label: "Next up · today",
    time: "",
    place: "House day at home",
    detailHtml: homeWeek.with === "away"
      ? `kids away · back ${homeWeek.through}`
      : `kids with Dad at <strong>home</strong> through ${homeWeek.through}`,
    badge: nowP.weekday,
    startIso: now.toISOString(),
    endIso: new Date(now.getTime() + 3600000).toISOString(),
    kind: "fallback",
  };

  const weekPath = args.weekPath;
  if (!fs.existsSync(weekPath)) die("kids-week.json missing: " + weekPath);
  const prev = JSON.parse(fs.readFileSync(weekPath, "utf8"));

  const next = {
    asOf: nowP.asOf,
    asOfIso: nowP.iso,
    refreshedAt: now.toISOString(),
    sourceCalendar: "primary", /* PRIVFEED1 · no address in data */
    leaveBys: prev.leaveBys || {
      SRE_drop: "leave 8:10 for 8:25",
      SRE_pickup: "leave 3:15 for 3:40",
      note: "sports: event START = leave-by",
    },
    homeWeek,
    boardStrip: {
      label: head.label,
      time: head.time,
      place: head.place,
      detailHtml: head.detailHtml,
      badge: head.badge,
      startIso: head.startIso,
      endIso: head.endIso,
      kind: head.kind,
      nextLeave: queue.find((q) => q.leaveBy) || null, // NEXTLEAVE1: Dad card "Next leave" (never specials / all-day)
      queue,
    },
    kids: {},
  };

  for (const kidId of ["harris", "hayes", "ainsley"]) {
    const prevKid = (prev.kids && prev.kids[kidId]) || {};
    const kept = {};
    for (const k of PRESERVE_KID) {
      if (prevKid[k] !== undefined) kept[k] = prevKid[k];
    }
    next.kids[kidId] = {
      ...kept,
      hottest: hottestFor(kidId, items, now, homeWeek),
      today: buildKidToday(kidId, items, now, homeWeek),
      sports: buildKidSports(kidId, items, now),
      school: buildKidSchool(kidId, items, now),
      appointments: buildKidAppointments(kidId, items, now),
    };
    // Ensure empty-state strings remain
    if (!next.kids[kidId].appointmentsEmpty && Array.isArray(next.kids[kidId].appointments) && next.kids[kidId].appointments.length === 0) {
      next.kids[kidId].appointmentsEmpty = prevKid.appointmentsEmpty || "No appointments on your board.";
    }
  }

  const prevDan = (prev.kids && prev.kids.dan) || {};
  const danKept = {};
  for (const k of PRESERVE_DAN) {
    if (prevDan[k] !== undefined) danKept[k] = prevDan[k];
  }
  /* BAGHINT1 · bag hint follows the live week end, never a frozen date; no kid-$ placeholder */
  for (const kidId of ["harris", "hayes", "ainsley"]) {
    const k = next.kids[kidId];
    if (!k) continue;
    if (k.bag) {
      k.bag.hint = homeWeek.with === "away"
        ? "Kids away"
        : `Home through ${homeWeek.through} · pack for Dad week`;
    }
    if (k.goal && typeof k.goal.placeholder === "string") k.goal.placeholder = k.goal.placeholder.replace(/\s*·?\s*\$\d+(\.\d+)?/g, "").trim();
  }
  next.kids.dan = {
    ...danKept,
    hottest: homeWeek.with === "away"
      ? {
          when: `${nowP.asOf} · kids away`,
          what: "Kids away",
          where: `until ${homeWeek.through}`,
          badges: ["Kids away"],
        }
      : {
          when: `${nowP.asOf} · kids with you at home`,
          what: "Dad week live",
          where: `through ${homeWeek.through}`,
          badges: ["Dad week", "Home"],
        },
    today: buildDanToday(items, now, homeWeek),
    week: buildDanWeek(items, now, homeWeek),
  };

  // HARD GATE: never ship stale asOf
  if (next.asOfIso !== nowP.iso) die("internal asOfIso mismatch");

  const kidsDataPath = path.join(path.dirname(weekPath), "kids-data.js");
  writeWeekTree(weekPath, next, kidsDataPath, args.dryRun);
  mirrorToBoardOs(args.mirrorDir, next, args.dryRun);

  // Receipt
  const receipt = {
    asOf: next.asOf,
    asOfIso: next.asOfIso,
    boardStrip: { time: next.boardStrip.time, place: next.boardStrip.place, startIso: next.boardStrip.startIso },
    queueLen: queue.length,
    pastDropped: items.filter((it) => !stillRelevant(it, now)).length,
    upcoming: queue.slice(0, 5).map((q) => `${q.whenLabel || q.time} · ${q.place}`),
    homeWeek,
  };
  console.log("calendar-refresh: OK", JSON.stringify(receipt, null, 2));

  if (args.deployNote && !args.dryRun) {
    /* PRIVFEED1 · nothing private is committed or pushed any more. The hub serves the private folder;
       --deploy is accepted for old callers and does nothing. */
    console.log("calendar-refresh: --deploy is a no-op (PRIVFEED1) · data stays in " + path.dirname(weekPath));
  }
}

main();
