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
import { createRequire } from "node:module";
createRequire(import.meta.url)("../house-face-law.js");   /* sets globalThis.HouseFaceLaw */
const FACE_LAW = globalThis.HouseFaceLaw;
import { spawnSync } from "node:child_process";
import { ctMidnight } from "./ct-midnight.mjs"; /* DATA1 P1-5 · one all-day clock for both feeds */
import { privPath, assertPrivateOut, namesRe, privateNames, externalEvents, EXT_ROLES } from "./private-dir.mjs"; /* PRIVFEED1 · EXTFILTER1 */
/* EXTNAMES1 · private-names.tsv role "external" names people outside the household (never in git). A kid's first name
   followed by one of them is not our kid, so it is cut out before the kid tests. ONLY "external" is filtered, plus the
   old key "otherfamily" during the transition (a later commit drops it). partner, coparent, household, school and every
   other role are never filtered. An unknown role gets one count-only warning and stays unfiltered. No external rows at
   all (and none under the old key) = a config error: one count-only warning. */
const PN = privateNames();
const KNOWN_ROLES = new Set(EXT_ROLES.concat(["partner", "coparent", "household", "school"]));
const EXT_NAMES = EXT_ROLES.flatMap((r) => PN[r] || []).map((n) => n.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
const UNKNOWN_ROLES = Object.keys(PN).filter((r) => !KNOWN_ROLES.has(r)).length;
if (UNKNOWN_ROLES) process.stderr.write("WARN private-names: " + UNKNOWN_ROLES + " unknown role(s), not filtered\n");
if (!EXT_NAMES.length) process.stderr.write("WARN private-names: role external has 0 entries (config error)\n");
const EXT_KID = EXT_NAMES.length ? new RegExp("\\b(?:ainsley|hayes|harris)\\s+(?:" + EXT_NAMES.join("|") + ")\\b", "g") : null;
/* SCHOOLNAMES1 · the kids' school code never lives in git: role "school" from private-names.tsv (school-names.js, same
   sources as LHRules). None known = every school pattern below matches nothing (no school drop / pickup / specials). */
const SchoolNames = createRequire(import.meta.url)("../school-names.js");
const SCH = "(?:" + SchoolNames.alt() + ")";
const RX = (src, flags) => new RegExp(src.replace(/§/g, SCH), flags);
const SCHOOL_WORD = SchoolNames.label("school");
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
/* ctMidnight lives in ./ct-midnight.mjs (DATA1 P1-5) */

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

/* NEXTLEAVE1 · what counts as a real leave-by for "Next leave": a leave, a school drop / pickup, a sport
   (event start = leave-by), an appointment, or any title that says pickup / drop / leave. Never an all-day note,
   never a school specials note. */
const LEAVE_KINDS = new Set(["leave", "school_drop", "school_pickup", "sport", "appointment"]);
const LEAVE_WORD_RE = /\b(pick\s*-?\s*up|drop(\s*-?\s*off)?|leave)\b/i; // "pickup at Quinn's" is a leave whatever its kind
function isRealLeave(it) {
  if (it.allDay || RX(String.raw`§ specials?`, "i").test(it.raw || "")) return false;
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
  const s0 = summary.toLowerCase();
  const s = EXT_KID ? s0.replace(EXT_KID, " ") : s0; /* EXTNAMES1 */
  /* SCHOOL2: "<Family> Kids [<initials> No School]" → each initial names a kid */
  const ns = /Ward Kids \[([AH]+) No School\]/i.exec(summary);
  const nsA = ns ? /A/i.test(ns[1]) : false;
  const nsH = ns ? /H/i.test(ns[1]) : false;
  return {
    ainsley: /\bainsley\b/.test(s) || nsA,
    hayes: /\bhayes\b/.test(s) || nsH,
    harris: /\bharris\b/.test(s) || nsH,
    boys: RX(String.raw`\bboyes\b|\bharris\b.*\bhayes\b|\bhayes\b.*\bharris\b|\bboyes\b|§ drop|§ pickup|Hayes \+ Harris`, "i").test(s),
  };
}

/* SOLOBOY1 2026-10-02 (Dan, Art Club Wed): "Hayes — school pickup · 3:40" names one boy →
   that boy only. "Hayes + Harris — school pickup" / untitled-kid school runs → both boys (unchanged). */
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
/* DATA1 helpers */
const KID_PREFIX_RE = /^(Ainsley|Hayes|Harris)\s*[—-]/i;
const SCHOOL_NOTICE_RE = { exec(s) {
  const k = KID_PREFIX_RE.exec(s);
  if (/\bLKMS\b.*\b(raffle|donation|due)\b/i.test(s)) return [s, k ? k[1] : "Ainsley"];
  if (k && RX(String.raw`^(Ainsley|Hayes|Harris)\s*[—-]\s*(?:LKMS|§)\b`, "i").test(s)) return [s, k[1]];
  return null;
} };
const RIDE_WORD_RE = /\b(pick\s*-?\s*up|drop\s*-?\s*off)\b/i;
const DRESS_NOTICE_RE = /\b(pj'?s?|pajamas?|pyjamas?|costumes?|spirit)\b/i;
function soloKid(summary) {
  const m = kidMentions(summary);
  const n = ["ainsley", "hayes", "harris"].filter((k) => m[k]);
  return n.length === 1 ? { kid: n[0] } : {};
}
function isKidRide(it, kidId) {
  return it.kind === "leave" && !!it.kidRide && it.kid === kidId;
}
/* Dad glass label: single-kid ride / school run says whose ("3:15 Hayes school pickup"). */
function danWhat(it) {
  const what = kidsSafeWhat(it.raw, it.kind);
  const solo = it.kidRide || it.kind === "school_drop" || it.kind === "school_pickup" || ((it.kind === "school" || it.kind === "appointment" || it.kind === "other") && it.kid); /* DATA1 P2-7 */
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
  if (/^(Pick\s*up|Drop)\b/i.test(summary) && !RX(String.raw`§ (drop|pickup)`, "i").test(summary)) {
    return { kind: "leave", summary, busy: !isFree(ev), ride: true };
  }
  /* KIDRIDE1: "<co-parent>: <Kid> — … pickup/drop-off" (Free, their week) = awareness on the kid's
     glass only — never a Dad leave-by row or a sport card. */
  /* AWAY1 (Oct 11): co-parent events never reach the House Face. */
  if (COPARENT_RE.test(summary)) return null;
  /* SCHOOL first (before KIDRIDE1): titles like "… Math Counts · pickup 4:00" are school,
     not Dad leave-by rides. KIDRIDE1 still catches real kid pickup/drop-off leave-bys. */
  if (RX(String.raw`§ drop-off|§ drop\b`, "i").test(summary)) return { kind: "school_drop", summary, ...soloBoy(summary) };
  if (RX(String.raw`§ pickup`, "i").test(summary)) return { kind: "school_pickup", summary, ...soloBoy(summary) };
  if (/Homework Help/i.test(summary)) return { kind: "school", summary, kid: "ainsley" };
  /* DATA1 P0-1 · "<kid> — LKMS raffle / donation / … due" and any "<kid> — <school> <notice>" is school info (never a
     ride: pickup / drop-off titles fall through to KIDRIDE1). P0-2 · school dress-up notices (PJ / pajama / costume /
     spirit days, Dan 10/23) are school rows too; colour days stay schedule markers (house-face-law.js isColorDay). */
  { const km = SCHOOL_NOTICE_RE.exec(summary);
    if (km && !RIDE_WORD_RE.test(summary.replace(/\([^)]*\)/g, ""))) return { kind: "school", summary, kid: km[1] ? km[1].toLowerCase() : undefined }; }
  if (DRESS_NOTICE_RE.test(summary) && KID_PREFIX_RE.test(summary)) return { kind: "school", summary, kid: KID_PREFIX_RE.exec(summary)[1].toLowerCase(), dressNotice: true };
  if (RX(String.raw`hearing\/vision|Hearing\/Vision|PE \(tennis|§ specials?|§ spirit|§ (Orange|Yellow|Green|Red) Day|Peace Week|field trip|yearbook|picture (retake|makeup)|baby pic|LKMS (choir|fall conferences|Cougar Night|Bingo|baby|Homework Help|Math Counts|Outsiders)|Outsiders Day|\b[A-Z][a-z]+ conference\b|choir Sing|permission form due|Ward Kids \[[AH]+ No School\]|no school \(elem|conference sign-ups|Tailgate|Halloween Bash|Halloween parade|Halloween class parties|Abraca-Boo|Fall Family Fun Night|Chat\s*&\s*Chew|Chat and Chew|Art Club|fall conferences`, "i").test(summary)) { /* SPECIALS1+SCHOOL2: all kids school info on kid boards + hub */
    return { kind: "school", summary, ...soloKid(summary) }; /* DATA1 P2-7 · a one-kid specials row knows whose */
  }
  { const kr = KID_RIDE.exec(summary);
    if (kr && !RX(String.raw`§ (drop|pickup)`, "i").test(summary)) {
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
  /* DATA1 P1-4 · dentist / doctor / appointment works for any kid (was Ainsley only) */
  { const am = /^(Ainsley|Hayes|Harris)\b.*\b(appointment|appt|dentist|doctor|dr\.?|orthodontist|ortho|checkup|check-up|physical|eye exam)\b/i.exec(summary);
    if (am) return { kind: "appointment", summary, kid: am[1].toLowerCase() }; }
  if (/vanity|Jessy/i.test(summary) && /ainsley/i.test(summary)) {
    return { kind: "appointment", summary, kid: "ainsley", herSpace: true };
  }
  /* DATA1 P1-4 · "✈️ Dan …" flights are Dad travel leaves (leave-by = event start) */
  if (/^\s*\u2708\uFE0F?\s*Dan\b/u.test(summary)) return { kind: "leave", summary, busy: !isFree(ev), travel: true };
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
    return { kind: "other", summary, kids, ...soloKid(summary) };
  }
  /* DATA1 P1-4 · Dad-only and household items (HOA pickup, curbside order, "Kids — pack night") reach Dad's week */
  if (/^Dan\s*[—-]/i.test(summary)) return { kind: "dad", summary, busy: !isFree(ev) };
  return { kind: "generic", summary, busy: !isFree(ev) };
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
  /* EXTFILTER1 · external calendar rows filtered at ingest (same rule as cal-months.py) */
  if (Array.isArray(raw)) return dedupeEvents(externalEvents(raw));
  if (Array.isArray(raw.events)) return dedupeEvents(externalEvents(raw.events));
  if (raw.result && Array.isArray(raw.result.events)) return dedupeEvents(externalEvents(raw.result.events));
  die("events file has no events[]: " + filePath);
}

/* DEDUPE1 · same start + same who + same title (ignoring "(...)" notes, punctuation, case)
 * = one card. Keep the longest title (most detail). Stops double-booked calendar
 * writes (e.g. two "Hayes — school specials: PE + Library" at 7:00) from showing twice. */
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

export const schoolWord = (s) => FACE_LAW.schoolWord(s);
export const momFree = (s) => FACE_LAW.momFree(s);
function stripDollars(s) {
  return String(s || "").replace(/\$\d+(?:\.\d+)?(?:\s*\/\s*(?:hr|hour|h|wk|week|day|mo|month)\b)?/gi, "") /* DATA1 P2-10 · rates go whole */.replace(/\s{2,}/g, " ").trim();
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
  s = momFree(schoolWord(s)); /* DATA1 P2-8 · one school word + whole "for mom" phrase, same law as cal-live */
  s = s.replace(/^Kids\s*[—-]\s*/i, "").replace(/\s*#[A-Z0-9]{5,8}\b/g, "").trim(); /* DATA1 P1-4 · no booking codes */
  s = s.replace(/\s*\((?:tennis shoes|wear [^)]*)\)/gi, "").trim(); /* LAW8C1 · no clothing hints */
  s = FACE_LAW.faceText(s); /* DRESSOK1 · a colour day keeps its marker, never the "wear …" prompt */
  // kids-safe: drop parenthesised adult notes / refund chatter from leave titles on kid glass
  if (kind === "leave") {
    s = s.replace(/\(Mom[^)]*\)/gi, "").replace(/WK\d+/gi, "").trim();
  }
  // Drop trailing "· 3:00" / "· 5:00 practice" clock echo when strip already shows time
  s = s.replace(/\s*·\s*\d{1,2}:\d{2}(\s*(am|pm|a|p|practice|game))?\s*$/i, "").trim();
  s = s.replace(/\s*·\s*leave\s+\d{1,2}:\d{2}.*$/i, "").trim();
  return s;
}

/* LAW8C1 · no colour-day / dress-up / spirit / clothing prompts anywhere on glass (Dan: no colour or clothing prompts) */
const DRESS_RE = FACE_LAW.DRESS;   /* AWAYONE1 · one dress-up law, shared with the glass (house-face-law.js) */
function buildBoardItems(events, now) {
  const items = [];
  for (const ev of events) {
    if (DRESS_RE.test(String(ev.summary || ""))) continue; /* LAW8C1 · colour days stay calendar markers (cal-live), never board rows */
    if (FACE_LAW.isTherapy(String(ev.summary || ""))) continue; /* LIVEFIX1 · therapy never reaches a board */
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

/* PINSPEC1 2026-09-30 (Dan): today's school specials stay pinned at the top of
   Next Up until morning drop-off is done (8:40 CT), even after their 7:00 stub ends. */
function ctMinutes(date) {
  const f = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit", hourCycle: "h23" });
  const b = {};
  for (const p of f.formatToParts(date)) b[p.type] = p.value;
  return Number(b.hour) * 60 + Number(b.minute);
}
function pinnedSpecials(item, now) {
  if (!RX(String.raw`§ specials?`, "i").test(item.raw || "")) return false;
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
    .filter((it) => it.kind !== "generic") // DATA1 P1-4 · household items live on Dad's week, never Next Up
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
    else if (it.kind === "school_pickup") place = it.kid ? `${KID_NAME[it.kid]} ${SCHOOL_WORD} pickup` : `Boys ${SCHOOL_WORD} pickup`;
    else if (it.kind === "school_drop") place = it.kid ? `${KID_NAME[it.kid]} ${SCHOOL_WORD} drop` : `Boys ${SCHOOL_WORD} drop`;
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
  /* DATA1 P2-11 · no custody wording in the detail line (was "kids with Dad at home through …" / "kids away") */
  // Add a couple of later same-day anchors
  const sameDay = upcoming.filter(
    (x) => partsInTZ(x.start).iso === partsInTZ(it.start).iso && x.id !== it.id && !x.allDay
  ).slice(0, 2);
  for (const x of sameDay) {
    if (x.kind === "sport") bits.push(`${fmtTime(x.start)} ${kidsSafeWhat(x.raw, "sport").split("·")[0].trim()}`);
    else if (x.kind === "leave") bits.push(`${fmtTime(x.start)} leave`);
    else if (x.kind === "school_pickup") bits.push(`${fmtTime(x.start)} ${x.kid ? KID_NAME[x.kid] : "boys"} pickup`);
  }
  return bits.length ? bits.join(" · ") : `${fmtDayLabel(it.start)} · ${whenTime(it)}`;
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
      throughLabel: through, /* DATA1 P2-11 · a date, never a computed custody label */
      endIso: active.endIso,
    };
  }
  // Outside the week windows: away. Never name the co-parent on glass (CALENDAR LAW).
  const nextDad = custody.find((it) => it.start > now);
  const lastEnded = [...custody].filter((it) => it.end <= now).sort((a, b) => b.end - a.end)[0];
  if (nextDad) {
    const endP = partsInTZ(nextDad.start);
    const through = `${endP.weekday} ${endP.month} ${endP.day} · ${fmtTime(nextDad.start)}`;
    return {
      with: "away",
      place: "",
      through,
      throughLabel: through,
      endIso: nextDad.startIso,
    };
  }
  if (lastEnded) {
    return {
      with: "away",
      place: "",
      through: "",
      throughLabel: "",
      endIso: lastEnded.endIso,
    };
  }
  return {
    with: "Dad",
    place: "Home",
    through: "",
    throughLabel: "",
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
  /* DATA1 P2-11 · no custody note row on a kid's today (was "YOUR BASE with Dad" / "Kids away") */
  if (!rows.length) rows.push({ kind: "note", when: "Today", what: "Nothing else on the calendar today", hint: "", tone: "act" });
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

/* DATA1 P1-4 · every kid gets an "upcoming" list: his own future rows across the week (no Dad-only leaves) */
function buildKidUpcoming(kidId, items, now) {
  const out = [];
  const seen = new Set();
  for (const it of items) {
    if (!stillRelevant(it, now)) continue;
    if (["custody", "dad", "generic"].includes(it.kind)) continue;
    if (it.kind === "leave" && !isKidRide(it, kidId)) continue;
    if (kidId === "ainsley" && (it.kind === "school_drop" || it.kind === "school_pickup")) continue;
    const kids = kidMentions(it.raw);
    const mine = it.kid === kidId || kids[kidId] || (isBoysRun(it, kidId) && (kidId === "hayes" || kidId === "harris"));
    if (!mine) continue;
    const row = { when: `${fmtDayLabel(it.start)} · ${whenTime(it)}`, what: kidsSafeWhat(it.raw, it.kind), tone: it.kind === "sport" || it.kind === "appointment" ? "hot" : "act" };
    const key = `${row.when}|${row.what}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
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
  /* DATA1 P2-11 · no custody fallback or "where" text (was KIDS AWAY / YOUR BASE WITH DAD / DAD WEEK) */
  if (!hit) {
    return { when: partsInTZ(now).weekday.toUpperCase(), what: "NOTHING NEXT ON THE CALENDAR", where: "", badges: [partsInTZ(now).weekday.toUpperCase()] };
  }
  return {
    when: `${fmtDowShort(hit.start).toUpperCase()} · ${whenTime(hit)}`,
    what: kidsSafeWhat(hit.raw, hit.kind).toUpperCase().slice(0, 48),
    where: fmtDayLabel(hit.start),
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
    if (!["leave", "school_drop", "school_pickup", "sport", "appointment", "school", "dad", "generic", "other"].includes(it.kind)) continue; /* DATA1 P1-4 */
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
  /* DATA1 P2-11 · no custody closing row (was "Kids with Dad at home through …") */
  if (!rows.length) rows.push({ when: partsInTZ(now).weekday.slice(0, 3), what: "Nothing else on the calendar today", tone: "act" });
  return rows.slice(0, 10);
}

function buildDanWeek(items, now, homeWeek) {
  const rows = [];
  const seen = new Set();
  for (const it of items) {
    if (!stillRelevant(it, now)) continue;
    if (isAdminNoise(it.raw)) continue;
    if (!["leave", "school_drop", "school_pickup", "sport", "appointment", "school", "dad", "generic", "other"].includes(it.kind)) continue; /* DATA1 P1-4 · Dad + household items too */
    const when = `${fmtDayLabel(it.start)} · ${whenTime(it)}`;
    const what = danWhat(it);
    const key = `${when}|${what}`.toLowerCase();
    if (seen.has(key)) continue; /* Harris+Hayes PE → one card */
    seen.add(key);
    rows.push({
      when,
      what,
      tone: it.kind === "leave" || it.kind === "sport" || it.kind === "dad" ? "hot" : "act",
    });
  }
  /* DATA1 P1-3 · no row cap (slice(0,24) cut Fri 10/30 off) and always one neutral closing row */
  rows.push({ when: "Later", what: "More on the month calendar", tone: "act", closing: true });
  return rows;
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
       stays on kid boards every week and on trips (standing "Kids school info on boards"). */
    if (it.kind === "school") return false;
    if (it.kid || it.kidRide || it.ride || it.kind === "school_drop" || it.kind === "school_pickup" || it.kind === "sport") return true;
    const m = kidMentions(it.raw || it.summary || "");
    return !!(m.hayes || m.harris || m.ainsley);
  };
  /* DATA1 P0-1 · an all-day item that OVERLAPS Dad's span stays (start-only check dropped the 10/23 raffle note) */
  const inDadSpan = (it) => spans.some((c) => (it.allDay ? (it.start < c.end && it.end > c.start) : (it.start >= c.start && it.start < c.end)));
  const nowInSpan = spans.some((c) => now >= c.start && now < c.end);
  /* an all-day kid note that started in Dad's span doesn't carry into the kids-away days */
  const items = allItems.filter((it) => !isKidLogistics(it) || (inDadSpan(it) && (nowInSpan || it.start >= now)));
  const homeWeek = custodyFromItems(items, now);
  const queue = pickStripQueue(items, now, homeWeek);
  const head = queue[0] || {
    label: "Next up · today",
    time: "",
    place: "House day at home",
    detailHtml: "", /* DATA1 P2-11 · no custody fallback text */
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
      school_drop: "leave 8:10 for 8:25",
      school_pickup: "leave 3:15 for 3:40",
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
      upcoming: buildKidUpcoming(kidId, items, now),
    };
    /* DATA1 P2-10 · Ainsley sees no stars, star counts, dollar amounts, rates or streaks; the builder strips them */
    if (kidId === "ainsley") {
      for (const k of ["streakLabel", "currency", "bankGoal"]) delete next.kids[kidId][k];
      if (next.kids[kidId].goal && typeof next.kids[kidId].goal === "object") for (const g of Object.keys(next.kids[kidId].goal)) if (typeof next.kids[kidId].goal[g] === "string") next.kids[kidId].goal[g] = FACE_LAW.ainsleyText(next.kids[kidId].goal[g]).replace(/\bstreaks?\b|\bstars?\b/gi, "").trim();
      const MONEYISH = /[\u2605\u2606\u2b50]|\$\s*\d|\/\s*hr\b|\bstreaks?\b|\bstars?\b/i;
      const scrub = (v) => {
        if (Array.isArray(v)) return v.map(scrub);
        if (!v || typeof v !== "object") return typeof v === "string" && MONEYISH.test(v) ? FACE_LAW.ainsleyText(v).replace(/\bstreaks?\b|\bstars?\b/gi, "").replace(/\s{2,}/g, " ").trim() : v;
        for (const k of Object.keys(v)) { if (/rate|stars?|streak|dollar|price|amount|reward|earn|pay/i.test(k)) delete v[k]; else v[k] = scrub(v[k]); }
        return v;
      };
      for (const k of ["quests", "missions", "fun", "rides", "goal"]) if (next.kids[kidId][k] !== undefined) next.kids[kidId][k] = scrub(next.kids[kidId][k]);
      FACE_LAW.cleanAinsley(next.kids[kidId]);
    }
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
      k.bag.hint = "Pack the night before"; /* DATA1 P2-11 · no custody wording in the bag hint */
    }
    if (k.goal && typeof k.goal.placeholder === "string") k.goal.placeholder = k.goal.placeholder.replace(/\s*·?\s*\$\d+(\.\d+)?/g, "").trim();
  }
  next.kids.dan = {
    ...danKept,
    /* DATA1 P2-11 · Dad's hottest is his real next thing, never "Dad week live" / "Kids away" */
    hottest: queue[0]
      ? { when: queue[0].whenLabel, what: queue[0].place, where: "", badges: [queue[0].badge, queue[0].time].filter(Boolean) }
      : { when: nowP.asOf, what: "Nothing next on the calendar", where: "", badges: [] },
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

/* DATA1 · importable for tests; runs only as a script */
export { classify, buildBoardItems, buildDanWeek, buildDanToday, buildKidUpcoming, buildKidToday, hottestFor, detailFor, custodyFromItems, kidsSafeWhat, danWhat, pickStripQueue };
if (process.argv[1] && fs.existsSync(process.argv[1]) && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) main();
