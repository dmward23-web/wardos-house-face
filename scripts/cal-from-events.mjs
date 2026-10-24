#!/usr/bin/env node
/**
 * WardOS House Face · calendar → cal-live.json (forever refresh kit)
 *
 * Ingests a Google Calendar–shaped events dump (MCP list_events ok) and writes
 * data/cal-live.json. Optionally patches kids-week.json (root + data/) so
 * boardStrip / dan.today / dan.week track the calendar clock.
 *
 * Law: EVERY create/update/delete on dmward23 must re-run this path onto glass.
 * Past/done (end < now) DROP. Next Up = best future in ~18h (Busy leave/DRIVE > Busy > Free; skip Sign-up noise).
 * No Wright cron — Atlas owns standing refresh / on-arrival pull (see CAL-LIVE.md).
 *
 * Usage:
 *   node scripts/cal-from-events.mjs --events <dump.json> [--out data/cal-live.json] [--patch-week kids-week.json]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { privPath, assertPrivateOut, namesRe, privateNames, externalEvents } from "./private-dir.mjs"; /* PRIVFEED1 · EXTFILTER1 */
import { createRequire } from "node:module";
import { ctMidnight, ctMidnightIso } from "./ct-midnight.mjs"; /* DATA1 P1-5 */
createRequire(import.meta.url)("../house-face-law.js");   /* PRIVFEED3 · LAW8C1: sets globalThis.HouseFaceLaw (one dress-up law, shared with the glass) */
const FACE_LAW = globalThis.HouseFaceLaw;
/* SCHOOLNAMES1 · school code from private-names.tsv role "school" (school-names.js); none known = no pinned specials */
const SCHOOL_SPECIALS_RE = new RegExp("(?:" + createRequire(import.meta.url)("../school-names.js").alt() + ") specials?", "i");
const PARTNER_RE = namesRe("partner"); /* PRIVNAME1 · "us" flag computed on the box so no name lives in client code */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const TZ = "America/Chicago";

function parseArgs(argv) {
  const out = {
    eventsPath: null,
    outPath: privPath("cal-live.json"), /* PRIVFEED1 · box-only, served by the hub with a token */
    patchWeek: null,
    help: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--events" && argv[i + 1]) out.eventsPath = path.resolve(argv[++i]);
    else if (a === "--out" && argv[i + 1]) out.outPath = path.resolve(argv[++i]);
    else if (a === "--patch-week") {
      out.patchWeek =
        argv[i + 1] && !argv[i + 1].startsWith("-")
          ? path.resolve(argv[++i])
          : privPath("kids-week.json");
    } else if (a === "--help" || a === "-h") out.help = true;
  }
  return out;
}

function chicagoParts(date = new Date()) {
  const map = {};
  new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .formatToParts(date)
    .forEach((p) => {
      if (p.type !== "literal") map[p.type] = p.value;
    });
  return map;
}

function chicagoIso(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function chicagoShort(date = new Date()) {
  const p = chicagoParts(date);
  return `${p.weekday} ${p.month} ${p.day}`;
}

function chicagoLong(date = new Date()) {
  const p = chicagoParts(date);
  return `${p.weekday} ${p.month} ${p.day} ${p.year}`;
}

function clockTime(date) {
  const p = chicagoParts(date);
  /* "3:00" style — drop leading space / minutes keep */
  const h = p.hour;
  const m = p.minute;
  return `${h}:${m}`;
}

function clockTimeShort(date) {
  /* strip :00 minutes for cleaner strip? keep full */
  return clockTime(date).replace(/\s?(AM|PM)$/i, "").trim();
}

function parseDump(raw) {
  let t = String(raw);
  /* Strip XML / fence / connector preamble — find outermost JSON object */
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("no JSON object in events dump");
  t = t.slice(start, end + 1);
  const data = JSON.parse(t);
  const events = Array.isArray(data.events)
    ? data.events
    : Array.isArray(data)
      ? data
      : Array.isArray(data.items)
        ? data.items
        : null;
  if (!events) throw new Error("dump missing events[]");
  return { meta: data, events: externalEvents(events) };   /* EXTFILTER1 · same filter as cal-months.py */
}

export function normalizeDateField(v) {
  if (!v) return null;
  const s = String(v);
  /* True all-day YYYY-MM-DD */
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return ctMidnight(s); /* DATA1 P1-5 · CST after Nov 1 */
  /* Some dumps put an ISO datetime in .date — parse directly */
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function eventStart(e) {
  if (!e || !e.start) return null;
  if (e.start.dateTime) {
    const d = new Date(e.start.dateTime);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (e.start.date) return normalizeDateField(e.start.date);
  return null;
}

function eventEnd(e) {
  if (!e || !e.end) return null;
  if (e.end.dateTime) {
    const d = new Date(e.end.dateTime);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (e.end.date) return normalizeDateField(e.end.date);
  return null;
}

function isBusy(e) {
  if (!e) return false;
  if (e.transparency === "transparent") return false;
  if (e.availability === "AVAILABILITY_FREE") return false;
  /* Google: opaque / missing transparency = busy */
  return true;
}

/* CANCELGONE1 · Google status OR a title marked canceled (how Atlas marks a
 * rained-out practice) → never on the board, Who's up, or a leave countdown. */
const CANCEL_TITLE = /^\s*[\[(]?\s*(cancel+ed|canceled|cancelled|cxl)\b/i;
/* SOFTGONE1 · placeholders never own the big card, Who's up, or a countdown:
 * CANCELED / DONE / BACKUP / tentative titles, "time TBD",
 * "cancel if…". Retitle with a real time and it comes right back. */
const SOFT_TITLE = /(^\s*[\[(]?\s*(cancel+ed|cxl|done|backup|tentative)\b)|\btbd\b|\bcancel if\b/i;
function isSoft(e) {
  return !!(e && (e.status === "tentative" || SOFT_TITLE.test(String(e.summary || ""))));
}
function isCancelled(e) {
  return !!(e && (e.status === "cancelled" || e.status === "canceled" || CANCEL_TITLE.test(String(e.summary || ""))));
}

export function startIsoLocal(e) {
  if (e.start?.dateTime) return e.start.dateTime;
  if (e.start?.date) {
    const s = String(e.start.date);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return ctMidnightIso(s); /* DATA1 P1-5 */
    return s; /* already datetime-shaped */
  }
  return null;
}

export function endIsoLocal(e) {
  if (e.end?.dateTime) return e.end.dateTime;
  if (e.end?.date) {
    const s = String(e.end.date);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return ctMidnightIso(s); /* DATA1 P1-5 */
    return s;
  }
  return null;
}

function slimEvent(e) {
  const start = eventStart(e);
  const end = eventEnd(e);
  return {
    id: e.id || null,
    summary: e.summary || "(no title)",
    start: startIsoLocal(e),
    end: endIsoLocal(e),
    location: e.location || "",
    busy: isBusy(e),
    allDay: !!(e.start && e.start.date && !e.start.dateTime),
    us: PARTNER_RE.test(e.summary || "") || /\btogether\b/i.test(e.summary || ""),
    startMs: start ? start.getTime() : 0,
    endMs: end ? end.getTime() : 0,
  };
}

export function shortPlace(summary) {
  let s = String(summary || "").trim();
  s = s.replace(/^Leave\s*[·•\-–—]\s*/i, "");
  /* Kid-safe: parenthesised adult notes never reach the glass strip */
  s = s.replace(/\(\s*Mom[^)]*\)/gi, "");
  s = FACE_LAW.momFree(FACE_LAW.schoolWord(s)); /* DATA1 P2-8 · whole "for mom" phrase + one school word (was: cut Mom..end) */
  s = s.replace(/\s{2,}/g, " ").replace(/\s·\s*$/g, "").trim();
  if (s.length > 56) s = s.slice(0, 53) + "…";
  return s;
}

function kidSafeDetail(ev, nextLeaveish) {
  const t = clockTimeShort(new Date(ev.startMs));
  const bits = [];
  bits.push(`<strong>${esc(t)}</strong> ${esc(shortPlace(ev.summary))}`);
  if (nextLeaveish && nextLeaveish.id !== ev.id) {
    const lt = clockTimeShort(new Date(nextLeaveish.startMs));
    const dow = chicagoParts(new Date(nextLeaveish.startMs)).weekday;
    bits.push(
      `next Leave · ${esc(dow)} <strong>${esc(lt)}</strong> ${esc(shortPlace(nextLeaveish.summary))}`
    );
  }
  return bits.join(" · ");
}

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildBoardStrip(next, todayIso, leaveish) {
  if (!next) {
    return {
      label: "Next up · today",
      time: "",
      place: "Clear · no future on glass",
      detailHtml: "Calendar window empty · America/Chicago",
      badge: chicagoParts().weekday,
    };
  }
  const start = new Date(next.startMs);
  const startIso = chicagoIso(start);
  const dow = chicagoParts(start).weekday;
  const isToday = startIso === todayIso;
  const label = isToday ? "Next up · today" : `Next up · ${dow}`;
  const time = clockTimeShort(start).replace(/\s?(AM|PM)$/i, "");
  /* Prefer 12h without AM/PM for strip time slot — House Face uses "3:15" style */
  const p = chicagoParts(start);
  const timeClean = `${p.hour}:${p.minute}`;
  return {
    label,
    time: timeClean,
    place: shortPlace(next.summary),
    detailHtml: kidSafeDetail(next, leaveish && leaveish.id !== next.id ? leaveish : null),
    badge: isToday ? chicagoParts().weekday : dow,
  };
}

function windowBounds(events) {
  let min = null;
  let max = null;
  for (const e of events) {
    const s = eventStart(e);
    if (!s) continue;
    const iso = chicagoIso(s);
    if (!min || iso < min) min = iso;
    if (!max || iso > max) max = iso;
  }
  const today = chicagoIso();
  return {
    windowStart: min || today,
    windowEnd: max || today,
  };
}

/* TEXTLAW1 (ported in PRIVFEED3 from the v52 line) · every string the glass shows is written clean by this script, on
 * every refresh: no booking codes / flight numbers / airport legs, no em dashes or arrows, no other-house names, no partner
 * name, and the few raw titles get a human name. Rules live in scripts/text-law.json (shared with scripts/text_law.py /
 * cal-months.py). {PARTNER}/{COPARENT} come from private-names.tsv (~/.local/share/wardos-private, fallback ~/.config/wardos; never git); missing = hard fail.
 * Ids, ISO times, URLs and custody are never touched. Idempotent. */
const TEXT_LAW = JSON.parse(fs.readFileSync(path.join(__dirname, "text-law.json"), "utf8"));
let TEXT_RULES = null;
function textRules() {
  if (TEXT_RULES) return TEXT_RULES;
  const names = privateNames();
  for (const role of ["partner", "coparent"]) if (!names[role] || !names[role].length) throw new Error("HARD FAIL: private names have no " + role + " (private-names.tsv), refusing to write glass text");
  const reEsc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const fill = (re) => re.replace(/\{(PARTNER|COPARENT)\}/g, (_, k) => "(?:" + names[k.toLowerCase()].map(reEsc).join("|") + ")");
  /* CALSCRUB1 · event-specific rules live box-only (WARDOS_TEXT_LAW_PRIVATE or <private dir>/text-law.private.json), applied first */
  let priv = [];
  try { priv = JSON.parse(fs.readFileSync(process.env.WARDOS_TEXT_LAW_PRIVATE || privPath("text-law.private.json"), "utf8")).rules || []; } catch { priv = []; }
  return (TEXT_RULES = [...priv, ...TEXT_LAW.rules].map((r) => [new RegExp(fill(r.re), (r.flags || "") + (r.global ? "g" : "")), r.to]));
}
export function cleanText(s) {
  if (typeof s !== "string" || !s.trim() || s.length >= TEXT_LAW.maxLen || /^(https?:|\d{4}-\d\d-\d\d)/.test(s)) return s;
  for (const [a, b] of textRules()) s = s.replace(a, b);
  return s.replace(/\s{2,}/g, " ").trim();
}
const TEXT_SKIP_KEY = /^(id|icdId|href|url|link|htmlLink|sourceCalendar|source|tz|status|kind|tone|cadence|theme|.*Iso|start|end|fetchedAt|refreshedAt|updatedAt|windowStart|windowEnd)$/;
export function cleanDeep(o, key) {
  if (Array.isArray(o)) return o.map((v) => cleanDeep(v, key));
  if (o && typeof o === "object") { const r = {}; for (const k of Object.keys(o)) r[k] = cleanDeep(o[k], k); return r; }
  if (typeof o === "string" && !(key && TEXT_SKIP_KEY.test(key))) return cleanText(o);
  return o;
}
/* LAW8C1 · colour-day / dress-up rows are dropped at the source (same regex the glass uses) */
/* ALLDAY1 · start > now is upcoming; an all-day row that began at midnight stays until its (exclusive) end date passes.
   Before: today's all-day kid items (e.g. a school item due today) vanished at 00:00. */
export function isUpcomingOrAllDayToday(e, nowMs) {
  if (!e || !e.startMs) return false;
  if (e.startMs > nowMs) return true;
  return !!(e.allDay && e.endMs && e.endMs > nowMs);
}
export function dressFree(list) { return (list || []).filter((e) => { const t = e && (e.summary || e.what || e.title) || ""; return !FACE_LAW.isDressDay(t) || FACE_LAW.isColorDay(t); }); }

function writeJson(outPath, payload) {
  assertPrivateOut(outPath, "cal-live"); /* PRIVFEED1 */
  fs.mkdirSync(path.dirname(outPath), { recursive: true, mode: 0o700 });
  const tmp = outPath + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(payload, null, 2) + "\n", { mode: 0o600 });
  fs.renameSync(tmp, outPath);
}

function danTodayFromDayEvents(dayEvents, todayIso, homeWeekThrough) {
  /* Dad Today leave stack = FULL calendar day (past + future). Night refresh must not void the column. */
  const dayNum = Number(todayIso.slice(8));
  const dow = chicagoParts().weekday; /* Chicago today */
  const rows = [];
  const seen = new Set();
  const list = (dayEvents || []).slice().sort((a, b) => (a.startMs || 0) - (b.startMs || 0));
  for (const ev of list) {
    if (!ev.start || String(ev.start).slice(0, 10) !== todayIso) continue;
    if (ev.allDay && /Kids with Dan/i.test(ev.summary || "")) continue;
    const sum = ev.summary || "";
    /* Dad glass: skip pure Atlas/GET desk stubs — keep leave / school / sports / kid / house tasks */
    if (/^Atlas:/i.test(sum)) continue;
    if (/^GET\s*·/i.test(sum)) continue;
    const start = new Date(ev.startMs);
    const end = ev.endMs ? new Date(ev.endMs) : null;
    const p = chicagoParts(start);
    const when =
      end && !ev.allDay
        ? `${dow} ${dayNum} · ${p.hour}:${p.minute}–${chicagoParts(end).hour}:${chicagoParts(end).minute}`
        : `${dow} ${dayNum} · ${p.hour}:${p.minute}`;
    let what = shortPlace(sum);
    /* Collapse identical when+what (e.g. Harris+Hayes PE → one card) */
    const key = `${when}|${what}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    let tone = "act";
    if (/^Leave/i.test(sum)) tone = "hot";
    else if (/baseball|flag|swim|practice|game/i.test(sum)) tone = "hot";
    else if (/Large Item|HOA|DRIVE/i.test(sum)) tone = "hot";
    rows.push({ when, what, tone });
  }
  /* DATA1 P2-11 · no custody row on Dad's glass (was "Kids with Dad at home through …") */
  return rows;
}

function ensureHdInWeek(week, hd) {
  const list = Array.isArray(week) ? week.slice() : [];
  const marker = /HD\s*#?\s*2209|vanity return/i;
  const already = list.some((r) => marker.test(r.what || "") || marker.test(r.when || ""));
  if (!already && hd) {
    const row = {
      when: "Wed 30 · 9:00–10:30",
      what: "Leave · HD #2209 vanity return",
      tone: "hot",
    };
    /* Insert before the first Wed 30 row so the 9:00 item sits ahead of later rows */
    const idx = list.findIndex((r) => /^Wed 30/i.test(r.when || ""));
    if (idx >= 0) list.splice(idx, 0, row);
    else list.push(row);
  }
  /* Drop past vanity / Sun garage if any linger on week (defensive) */
  return list.filter((r) => {
    const blob = `${r.when || ""} ${r.what || ""}`;
    if (/Sun\s*27|vanity\s*·\s*Jessy|Ainsley vanity/i.test(blob) && !/HD\s*#?\s*2209/i.test(blob)) {
      return false;
    }
    return true;
  });
}

function dropPastFromToday(rows, nowMs) {
  /* dan.today rows are label-based — drop obvious Sun / vanity Jessy past */
  return (rows || []).filter((r) => {
    const blob = `${r.when || ""} ${r.what || ""}`;
    if (/Sun\s*·|Sun\s*27|garage sale|vanity\s*·\s*Jessy|Ainsley vanity/i.test(blob)) return false;
    return true;
  });
}

function patchKidsWeek(weekPath, cal, upcoming, slimAll) {
  const raw = fs.readFileSync(weekPath, "utf8");
  let week = JSON.parse(raw);
  const todayIso = cal.asOfIso;
  const nowMs = Date.now();

  week.asOf = chicagoLong();
  week.asOfIso = todayIso;
  /* DATA1 P2-9 · ONE Next Up builder: calendar-refresh.mjs owns kids-week.boardStrip (queue + nextLeave the glass reads);
     this script only seeds it when the week has none, and never overwrites it with the queue-less cal-live hero. */
  if (!week.boardStrip || !Array.isArray(week.boardStrip.queue)) week.boardStrip = cal.boardStrip;
  week.calMeta = {
    fetchedAt: cal.fetchedAt,
    source: cal.source,
    status: cal.status,
  };

  if (!week.kids) week.kids = {};
  if (!week.kids.dan) week.kids.dan = { id: "dan", name: "Dad" };

  const hd = upcoming.find(
    (e) => e.id === "4n0c5k6h39q3rvqrbavhlo1kv4" || /Leave\s*·\s*HD\s*#?\s*2209/i.test(e.summary || "")
  );

  /* Refresh dan.today from FULL today window (not future-only) — night must not void the stack */
  const daySrc = Array.isArray(slimAll) && slimAll.length ? slimAll : upcoming;
  week.kids.dan.today = danTodayFromDayEvents(daySrc, todayIso, week.homeWeek && week.homeWeek.through);
  week.kids.dan.today = dropPastFromToday(week.kids.dan.today, nowMs);
  /* Dedupe week display twins (Harris+Hayes PE → one school PE card) */
  if (Array.isArray(week.kids.dan.week)) {
    const seenW = new Set();
    week.kids.dan.week = week.kids.dan.week.filter((r) => {
      const k = `${String(r.when || "").toLowerCase()}|${String(r.what || "").toLowerCase()}`;
      if (seenW.has(k)) return false;
      seenW.add(k);
      return true;
    });
  }

  week.kids.dan.week = ensureHdInWeek(week.kids.dan.week, hd);

  /* Soft-drop past vanity from ainsley glass (DROP not invent) */
  if (week.kids.ainsley) {
    if (Array.isArray(week.kids.ainsley.appointments)) {
      week.kids.ainsley.appointments = week.kids.ainsley.appointments.filter(
        (r) => !/Sun\s*27|vanity\s*·\s*Jessy/i.test(`${r.when || ""} ${r.what || ""}`)
      );
    }
    if (week.kids.ainsley.hottest && /vanity|Jessy|SUN/i.test(JSON.stringify(week.kids.ainsley.hottest))) {
      /* Point hottest at next real ainsley item if still sun-locked */
      const nextA = upcoming.find((e) => /Ainsley/i.test(e.summary || "") && e.startMs > nowMs);
      if (nextA) {
        const p = chicagoParts(new Date(nextA.startMs));
        week.kids.ainsley.hottest = {
          when: `${p.weekday.toUpperCase()} · ${p.hour}:${p.minute}`,
          what: "ON THE BOARD",
          where: shortPlace(nextA.summary),
          badges: [p.weekday.toUpperCase(), `${p.hour}:${p.minute}`],
        };
      }
    }
    if (Array.isArray(week.kids.ainsley.today)) {
      const stillSun = week.kids.ainsley.today.some((r) =>
        /vanity|garage sale|Sun/i.test(`${r.when || ""} ${r.what || ""}`)
      );
      if (stillSun) {
        const monRows = upcoming
          .filter((e) => /Ainsley/i.test(e.summary || "") && e.start && e.start.slice(0, 10) === todayIso)
          .map((e) => {
            const p = chicagoParts(new Date(e.startMs));
            return {
              kind: "event",
              when: `${p.hour}:${p.minute}`,
              what: shortPlace(e.summary),
              hint: "on your board",
              tone: "act",
            };
          });
        if (monRows.length) {
          week.kids.ainsley.today = monRows.concat([
            {
              kind: "note",
              when: "All day",
              what: "Base at home with Dad",
              hint: "through Fri Oct 2 3:00",
              tone: "hot",
            },
          ]);
        } else {
          week.kids.ainsley.today = week.kids.ainsley.today.filter(
            (r) => !/vanity|garage sale|Sun\s*27/i.test(`${r.when || ""} ${r.what || ""}`)
          );
        }
      }
    }
  }

  week = cleanWeek(week); /* PRIVFEED3 · TEXTLAW1 words + LAW8C1 no dress-up rows, at the source */
  const text = JSON.stringify(week);
  assertPrivateOut(weekPath, "kids-week"); /* PRIVFEED1 */
  fs.writeFileSync(weekPath, text + "\n");

  /* PRIVFEED1 · one private copy only (no data/ twin, no root copy, no kids-data.js EMBEDDED) */

  return week;
}

/* PRIVFEED3 · kids-week through the same law: dress-up / colour-day rows out (FACE_LAW.cleanFeed), then text law words */
export function cleanWeek(week) { return cleanDeep(FACE_LAW.cleanFeed("kids-week", week)); }
export function cleanCal(cal) { return cleanDeep(FACE_LAW.cleanFeed("cal-live", cal)); }

/* TEXTLAW3-style --reclean for the PRIVATE copies (words + dress rows only; no fetch, ids/times/custody untouched; idempotent) */
function reclean() {
  for (const [name, fn] of [["cal-live.json", cleanCal], ["kids-week.json", cleanWeek]]) {
    const f = privPath(name);
    if (!fs.existsSync(f)) { console.log(`--reclean · ${name} not found`); continue; }
    assertPrivateOut(f, name);
    const j = JSON.parse(fs.readFileSync(f, "utf8"));
    const c = fn(j);
    const changed = JSON.stringify(c) !== JSON.stringify(j);
    if (changed) { const tmp = f + ".tmp"; fs.writeFileSync(tmp, JSON.stringify(c, null, 2) + "\n", { mode: 0o600 }); fs.renameSync(tmp, f); }
    console.log(`--reclean · ${name} ${changed ? "rewritten" : "already clean"} (private)`);
  }
}

function syncEmbedded() {
  /* PRIVFEED1 · kids-data.js carries no embedded copy any more (public file). Kept as a no-op for callers. */
  return false;
}

function main() {
  if (process.argv.includes("--reclean")) return reclean();
  const args = parseArgs(process.argv);
  if (args.help || !args.eventsPath) {
    console.log(`Usage: node scripts/cal-from-events.mjs --events <dump.json> [--out <private>/cal-live.json] [--patch-week [<private>/kids-week.json]]`);
    process.exit(args.help ? 0 : 1);
  }

  const now = new Date();
  const todayIso = chicagoIso(now);
  const fetchedAt = now.toISOString();

  let dump;
  try {
    dump = parseDump(fs.readFileSync(args.eventsPath, "utf8"));
  } catch (err) {
    const errPayload = {
      status: "error",
      source: "dmward23",
      fetchedAt,
      tz: TZ,
      windowStart: todayIso,
      windowEnd: todayIso,
      asOfIso: todayIso,
      nextLeave: null,
      upcomingLeaves: [],
      boardStrip: {
        label: "Next up · today",
        time: "",
        place: "CAL ERROR",
        detailHtml: esc(`cal error: ${err.message || err}`),
        badge: chicagoParts(now).weekday,
      },
      error: String(err.message || err),
    };
    writeJson(args.outPath, errPayload);
    console.error("cal-from-events ERROR:", err.message || err);
    process.exit(1);
  }

  const slimAll = dump.events
    .filter((e) => e && !isCancelled(e))
    .map(slimEvent)
    .filter((e) => e.startMs);

  const { windowStart, windowEnd } = windowBounds(dump.events);

  /* Upcoming = start > now (Next Up advances by clock). Drop past forever.
     House glass: drop Desk GET · / Atlas: stubs from Next Up (still in raw dump). */
  /* PINSPEC1 2026-09-30 (Dan): today's school specials stay on the main board's
     today list (published as all-day so they sort to the top) until drop-off
     is done at 8:40 CT; the 10-min refresh drops them after that. */
  const ctMin = (() => {
    const b = {};
    for (const p of new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "numeric", minute: "2-digit", hourCycle: "h23" }).formatToParts(now)) b[p.type] = p.value;
    return Number(b.hour) * 60 + Number(b.minute);
  })();
  const isPinnedSpecial = (e) =>
    SCHOOL_SPECIALS_RE.test(e.summary || "") && !/No Specials/i.test(e.summary || "") &&
    String(e.start || "").slice(0, 10) === todayIso && ctMin < 8 * 60 + 40 && e.startMs <= now.getTime();
  const upcoming = slimAll
    .filter((e) => isUpcomingOrAllDayToday(e, now.getTime()) || isPinnedSpecial(e))   /* ALLDAY1 · an all-day row runs until its end date */
    .map((e) => (isPinnedSpecial(e) ? { ...e, allDay: true, start: todayIso, end: todayIso, pinnedUntil: "8:40" } : e))
    .filter((e) => !/^GET\s*·/i.test(e.summary || "") && !/^Atlas:/i.test(e.summary || ""))
    .filter((e) => !isSoft(e))
    .filter((e) => !FACE_LAW.isDressDay(e.summary || "") || FACE_LAW.isColorDay(e.summary || ""))   /* LAW8C1 · DRESSOK1: colour days pass as markers */
    .sort((a, b) => a.startMs - b.startMs);

  /* nextLeave field = Next Up hero.
     Hallway glance: prefer Busy leave/DRIVE over Free admin (Sign up / ParentSquare).
     Rank within the next 18h window, then earliest start. */
  const ADMIN_HERO_SKIP = /^Sign up\b|ParentSquare|conference sign-?ups?/i;
  const heroPool = upcoming.filter((e) => !e.pinnedUntil && e.startMs > now.getTime() && !ADMIN_HERO_SKIP.test(e.summary || ""));
  function heroRank(e) {
    const t = String(e.summary || "");
    if (e.busy && /\bDRIVE\b/.test(t)) return 0; // case-sensitive DRIVE token (not "before drive")
    if (e.busy && (/\bLeave\b/i.test(t) || /^Dan\b/i.test(t))) return 1;
    if (e.busy) return 2;
    return 4;
  }
  const horizonMs = now.getTime() + 18 * 60 * 60 * 1000;
  const near = heroPool.filter((e) => e.startMs <= horizonMs);
  const pool = (near.length ? near : heroPool).slice().sort((a, b) => {
    const ra = heroRank(a), rb = heroRank(b);
    if (ra !== rb) return ra - rb;
    return a.startMs - b.startMs;
  });
  let next = pool[0] || null;

  const leaveTitles = upcoming.filter(
    (e) => e.busy && (/^Leave\b/i.test(e.summary) || /^Leave\s*·/i.test(e.summary))
  );
  const nextLeaveish = leaveTitles[0] || null;

  const boardStrip = buildBoardStrip(next, todayIso, nextLeaveish);

  /* Public slim (no startMs/endMs internals in committed JSON — keep them for UI filter ease actually keep start/end ISO) */
  const publicUpcoming = upcoming.map(({ startMs, endMs, ...rest }) => rest);
  const publicNext = next
    ? (({ startMs, endMs, ...rest }) => rest)(next)
    : null;

  const cal = {
    status: "live",
    source: "dmward23",
    fetchedAt,
    tz: TZ,
    windowStart,
    windowEnd,
    asOfIso: todayIso,
    nextLeave: publicNext,
    upcomingLeaves: publicUpcoming,
    boardStrip,
    error: null,
  };

  writeJson(args.outPath, cleanCal(cal));   /* TEXTLAW1 + LAW8C1 */
  console.log(
    `cal-live → ${args.outPath} · status=${cal.status} · upcoming=${publicUpcoming.length} · next=${publicNext ? publicNext.summary : "(none)"}`
  );

  if (args.patchWeek) {
    const week = patchKidsWeek(args.patchWeek, cal, upcoming, slimAll);
    console.log(`patched kids-week asOfIso=${week.asOfIso} → ${args.patchWeek} (private, no EMBEDDED)`);
  }
}

/* run as a script (the refresh), not when a test imports cleanText */
if (process.argv[1] && fs.existsSync(process.argv[1]) && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) main();
