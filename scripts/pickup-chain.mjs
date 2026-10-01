#!/usr/bin/env node
/* ATLASLANE1 · scripts/pickup-chain.mjs · branch wall-redesign-atlas · NOT WIRED (no cron, no deploy).
   Writes data/pickup-chain.json: today's school-day kid pickups / drop-offs / activity rides from the calendar.
   Row: {who[], by, what, where, time, timeIso, leaveBy, leaveByIso, gear[], status, startIso, endIso}.

   Rules (brief + Dan):
   - Empty at/after 7:00 PM CT, and on non-school days.
   - Kid/family logistics only. Never work, therapy/health, money, Erin, legal, admin (GET/REMIND/Atlas) items.
   - Only rows while the kids are with Dad (calendar "Kids with Dan" span); their mom's rides aren't Dad's chain.
   - Cancelled events dropped. Rows whose event already ended are dropped.
   - Public text never names anyone's parent: "(Riley's …)"-style parentheticals are dropped and any row still
     hitting the banned list is not published. Kids-away reason = "Kids away · back Fri 3:00". Text is rebuilt
     from the event title, never the description. Sentence case, no "!".
   - gear only if the event text names it; leaveBy only if the text says "leave H:MM" or the event start
     is earlier than the stated time (repo convention: kids-week leaveBys.note "event START = leave-by").

   Inputs: same loader as house-mode (repo data/cal-live.json + data/kids-week.json when present; box dump
   /workspace/cal-dmward23-week.json as fallback + supplement). warnings[] when now+7d is outside the calendar window.

   Usage: node scripts/pickup-chain.mjs [--data-dir data] [--cal-live …] [--events …] [--kids-week …] [--config …]
                                        [--now ISO] [--out data/pickup-chain.json] [--stdout] */
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs, loadInputs, DEFAULTS as HM_DEFAULTS } from "./house-mode.mjs";
import {
  asCalendar, calendarWarnings, kidsHomeSpans, kidsHomeAt, schoolDayInfo, ctDate, ctParts, ctWallMs, parseHM,
  fmtTime, ctIso, readJson, writeJson, scanObject, bannedHits, PICKUP_EXCLUDE_RE, PARENT_IDS, publicText, kidsAwayReason, sentence, kidsIn,
} from "./house/lib.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULTS = { ...HM_DEFAULTS, out: path.join(ROOT, "data/pickup-chain.json") };

const RIDE_RE = /\b(pick(?:s|ing)?\s*(?:\w+\s+)?up|pickup|drop(?:s|ping)?(?:\s*-?\s*off)?|ride|carpool)\b/i;
const ACTIVITY_RE = /\b(swim|practice|game|baseball|softball|flag|soccer|football|basketball|volleyball|lesson|homework help|tutor\w*|rehearsal|choir|scouts|camp)\b/i;
/* School-day info (specials, spirit days, field trips, in-school parties) is the Pack/Today tile, not a ride. */
const SCHOOL_INFO_RE = /\b(SRE specials?|spirit day|Peace Week|field trip|Tailgate|yearbook|picture|baby pic|send .* to|pack\b|snacks?)\b/i;
const GEAR = [
  "cleats", "glove", "mitt", "bat", "helmet", "jersey", "uniform", "goggles", "swim bag", "swimsuit", "towel",
  "cap", "tennis shoes", "shin guards", "mouthguard", "flag belt", "water bottle", "library book", "backpack",
  "instrument", "ball", "racket", "pads",
];

function statedTime(text, startMs) {
  /* "· 3:40", "5:00 practice", "game 5:30", "for 8:25", "@ 3:40" — pick the H:MM closest to the event start (am/pm). */
  const re = /(?:^|[\s·@(])(?:(?:for|at|game|arrive)\s+)?(\d{1,2}):(\d{2})\b(?!\s*[–-]\s*\d)/gi;
  const day = ctDate(startMs);
  let best = null;
  for (const m of String(text).matchAll(re)) {
    if (/leave\s*$/i.test(text.slice(Math.max(0, m.index - 7), m.index + 1))) continue; /* that's the leave-by */
    const h = Number(m[1]) % 12, mm = Number(m[2]);
    for (const hh of [h, h + 12]) {
      const ms = ctWallMs(day, hh, mm);
      const d = Math.abs(ms - startMs);
      if (d <= 3 * 3600000 && (!best || d < best.d)) best = { ms, d };
    }
  }
  return best ? best.ms : null;
}
function leaveText(text, startMs) {
  const m = /\bleave\s+(\d{1,2}):(\d{2})\b/i.exec(text);
  if (!m) return null;
  const day = ctDate(startMs), h = Number(m[1]) % 12, mm = Number(m[2]);
  const cands = [ctWallMs(day, h, mm), ctWallMs(day, h + 12, mm)];
  return cands.sort((a, b) => Math.abs(a - startMs) - Math.abs(b - startMs))[0];
}
function placeOf(location) {
  const first = publicText(String(location || "").split(",")[0]);
  if (!first) return null;
  if (/^Home$/i.test(first) || /^\d+ W 147th/i.test(first)) return "Home";
  return first;
}
function gearIn(text) {
  const s = String(text || "").toLowerCase();
  return GEAR.filter((g) => new RegExp(`\\b${g}s?\\b`, "i").test(s));
}
function cleanWhat(seg) {
  let s = seg;
  s = s.replace(/^\s*(?:Dan|Dad)\s+picks?\s+up\s+(?:(?:Hayes|Harris|Ainsley)\s*(?:\+|&|and)?\s*)+[—–-]\s*/i, ""); /* "Dan picks up Harris — " */
  s = s.replace(/^\s*(?:(?:Hayes|Harris|Ainsley)\s*(?:\+|&|and)?\s*)+[—–-]\s*/i, ""); /* "Hayes + Harris — " */
  s = s.replace(/^\s*(?:Hayes|Harris|Ainsley)\s+(?=[a-z])/, "");                          /* "Ainsley swim — …" */
  s = s.replace(/\s*·\s*\d{1,2}:\d{2}\s*$/, "");                                    /* trailing "· 3:40" */
  s = s.trim();
  return sentence(publicText(s));
}
function byOf(seg) {
  if (/^\s*(Pick\s*up|Drop)\b/i.test(seg)) return "Dad"; /* imperative on Dad's own calendar = Dad's ride (RIDES LAW) */
  const m = /^\s*(.+?)\s+picks?\s+(?:\w+\s+)?up\b/i.exec(seg);
  if (!m) return null;
  const who = m[1].trim();
  if (/^(Dan|Dad)$/i.test(who)) return "Dad";
  if (kidsIn(who).length) return null;
  return sentence(publicText(who));
}

export function computePickupChain({ calendar, kidsWeek, config, now, sourceLabel }) {
  const t = now == null ? Date.now() : now;
  const cal = asCalendar(calendar);
  const events = cal.events;
  const spans = kidsHomeSpans(events);
  const spansKnown = cal.hasKidsHome;
  const homeAt = (ms) => !spansKnown || kidsHomeAt(spans, ms); /* unknown: keep rows, warning says so */
  const warnings = calendarWarnings(cal, t);
  const today = ctDate(t);
  const cut = parseHM((config && config.pickupCutoff) || "19:00") || { hh: 19, mm: 0 };
  const cutoffMs = ctWallMs(today, cut.hh, cut.mm);
  const info = schoolDayInfo(events, today);
  const base = {
    asOfIso: today, generatedAt: ctIso(t), date: today, schoolDay: info.school,
    cutoff: ctIso(cutoffMs), source: sourceLabel || "calendar (read-only)", warnings, rows: [],
  };
  if (t >= cutoffMs) return { ...base, reason: `Pickup chain ends at ${fmtTime(cutoffMs)}` };
  if (!info.school) return { ...base, reason: "Not a school day" };

  const rows = [];
  for (const e of events) {
    if (e.allDay || e.cancelled || e.startDate !== today) continue;
    if (e.endMs <= t) continue;
    const full = `${e.summary} ${e.location}`;
    /* content bans drop the event; a parent-mention alone is scrubbed (publicText), then re-scanned per row */
    if (PICKUP_EXCLUDE_RE.test(e.summary) || PICKUP_EXCLUDE_RE.test(e.location) || bannedHits(full).some((h) => !PARENT_IDS.includes(h))) continue;
    if (/^\s*Dan\s*[—–-]/i.test(e.summary)) continue;                /* Dan's own items */
    if (!kidsIn(e.summary).length) continue;                         /* kid logistics only */
    const isRide = RIDE_RE.test(e.summary);
    const isActivity = !isRide && ACTIVITY_RE.test(e.summary) && placeOf(e.location) !== "Home";
    if (!isRide && !isActivity) continue;
    if (!isRide && SCHOOL_INFO_RE.test(e.summary)) continue;
    if (!homeAt(e.startMs)) continue;                     /* kids with their mom then */

    /* "Dan picks up Harris — SRE pickup · 3:40 | Casey (Riley's mom) picks up Hayes; …" -> one row per segment */
    const segs = e.summary.split(/\s+\|\s+/).map((s) => s.split(/;\s*/)[0]).filter((s) => kidsIn(s).length);
    const timeMs = statedTime(e.summary, e.startMs) || e.startMs;
    const explicitLeave = leaveText(e.summary, e.startMs);
    const leaveMs = explicitLeave || (e.startMs < timeMs ? e.startMs : null);
    const gear = gearIn(`${e.summary} ${e.description}`);
    for (const seg of segs) {
      const kids = kidsIn(seg);
      const by = byOf(seg);
      /* a leave-by is Dad's; never pin Dad's leave time on someone else's pickup */
      const rowLeave = by && by !== "Dad" ? null : leaveMs;
      const row = {
        who: kids.map((k) => k.name),
        by,
        what: cleanWhat(seg),
        where: placeOf(e.location),
        time: fmtTime(timeMs),
        timeIso: ctIso(timeMs),
        leaveBy: rowLeave ? fmtTime(rowLeave) : null,
        leaveByIso: ctIso(rowLeave),
        gear,
        status: e.startMs <= t ? "now" : "next",
        kind: isRide ? "ride" : "activity",
        startIso: ctIso(e.startMs),
        endIso: ctIso(e.endMs),
      };
      if (scanObject(row).length) continue;                         /* belt and braces */
      rows.push(row);
    }
  }
  rows.sort((a, b) => Date.parse(a.timeIso) - Date.parse(b.timeIso));
  const reason = rows.length ? `${rows.length} kid ride${rows.length === 1 ? "" : "s"} left today`
    : (!homeAt(t) ? kidsAwayReason(spans, t) : "No kid rides left today");
  const out = { ...base, rows, reason };
  const hits = scanObject(out);
  if (hits.length) throw new Error("pickup-chain output failed wall-safe scan: " + JSON.stringify(hits));
  return out;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const a = parseArgs(process.argv, DEFAULTS);
  const inp = loadInputs(a);
  const out = computePickupChain({ ...inp, now: a.now == null || isNaN(a.now) ? Date.now() : a.now });
  if (a.stdout) process.stdout.write(JSON.stringify(out, null, 2) + "\n");
  else { writeJson(a.out, out); console.log(`pickup-chain: ${out.rows.length} row(s) · ${out.reason}${out.warnings.length ? " · WARN " + out.warnings.join("; ") : ""} -> ${path.relative(process.cwd(), a.out)}`); }
}
