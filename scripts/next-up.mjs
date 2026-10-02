#!/usr/bin/env node
/* ATLASLANE6 · scripts/next-up.mjs · NEXT UP leave-by (upgrade 3) · NOT WIRED (no cron, no deploy).
   Writes data/next-up.json: {asOfIso, generatedAt, next, timer: null, source, warnings, reason?}.
   next = {label, copy, leaveAt, leaveIso, startIso, day} | null. copy is exactly "Leave 5:10." (h:mm, no am/pm).
   Pick: the next kid/family event (calendar, read-only) with a real place and a leave time, leave not passed,
   through the end of tomorrow. Leave time = lib.leaveByMs, the same rule pickup-chain uses (title "leave H:MM" >
   the event's own leave line > start earlier than the stated time). Dad's leave only: a ride someone else drives
   has no leave. Kids must be home (a 'Kids with Dan' span) at the start.
   Never: GET/BUY/REMIND/Atlas stubs, home or desk blocks, work, therapy/health, money, legal, phone/Zoom calls,
   Dan-only items, school-info rows. Label is rebuilt from kid names + a fixed word ("Hayes pickup"), never event text.
   timer: one slot, owned by Wright (house object, on the board). This script always writes null.
     Contract: {label, endsAt} -> "Oven 12:00." (m:ss remaining). Reference: timerCopy() below.
   Usage: node scripts/next-up.mjs [--data-dir data] [--events …] [--now ISO] [--out data/next-up.json] [--stdout] */
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs, loadInputs, DEFAULTS as HM_DEFAULTS } from "./house-mode.mjs";
import { RIDE_RE, ACTIVITY_RE, SCHOOL_INFO_RE, statedTime, placeOf, byOf } from "./pickup-chain.mjs";
import {
  asCalendar, calendarWarnings, kidsHomeSpans, kidsHomeAt, kidsAwayReason, ctDate, ctParts, ctWallMs, addDays, ctIso, fmtHM,
  writeJson, scanObject, bannedHits, PICKUP_EXCLUDE_RE, PARENT_IDS, kidsIn, leaveByMs,
} from "./house/lib.mjs";
import { momHits } from "./house/display-rename.mjs";
import { cliGuard, HOUSE_MODE_FLAGS } from "./house/cli-guard.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULTS = { ...HM_DEFAULTS, out: path.join(ROOT, "data/next-up.json") };

/* On top of the pickup-chain excludes: buy/to-do stubs, desk blocks, calls. */
export const NEXTUP_EXCLUDE_RE = /^\s*(GET|BUY|REMIND|TODO|Atlas)\b|\bdesk\b|\b(zoom|teams|google meet|webex|standup|stand-up|1:1|call|consult|meeting|sync)\b/i;
const VIRTUAL_PLACE_RE = /^(phone|zoom|teams|google meet|online|virtual|remote|tbd|call)\b/i;
const KIND_WORDS = ["swim", "baseball", "softball", "flag", "soccer", "football", "basketball", "volleyball", "lesson",
  "homework help", "tutoring", "rehearsal", "choir", "scouts", "camp", "practice", "game"];

export function realPlace(location) {
  const p = placeOf(location);
  if (!p || p === "Home" || VIRTUAL_PLACE_RE.test(p)) return null;
  return p;
}
function kindWord(seg, isRide) {
  if (isRide) {
    if (/\bdrop/i.test(seg)) return "drop-off";
    if (/\bpick/i.test(seg)) return "pickup";
    return "ride";
  }
  const m = ACTIVITY_RE.exec(seg);
  const w = m ? m[1].toLowerCase() : "";
  return KIND_WORDS.find((k) => w.startsWith(k.split(" ")[0])) || "activity";
}
function joinNames(names) { return names.join(" + "); }

/** Candidate leaves from the calendar: [{label, leaveMs, startMs, timeMs}] (Dad's leaves only). */
export function leaveCandidates(cal, t, { through } = {}) {
  const events = cal.events;
  const spans = kidsHomeSpans(events);
  const homeAt = (ms) => !cal.hasKidsHome || kidsHomeAt(spans, ms);
  const out = [];
  for (const e of events) {
    if (e.allDay || e.cancelled || e.endMs <= t) continue;
    if (through != null && e.startMs >= through) continue;
    const full = `${e.summary} ${e.location}`;
    if (PICKUP_EXCLUDE_RE.test(e.summary) || PICKUP_EXCLUDE_RE.test(e.location) || NEXTUP_EXCLUDE_RE.test(e.summary)) continue;
    if (bannedHits(full).some((h) => !PARENT_IDS.includes(h))) continue;
    if (/^\s*Dan\s*[—–-]/i.test(e.summary)) continue;
    if (!kidsIn(e.summary).length) continue;
    if (!realPlace(e.location)) continue;
    const isRide = RIDE_RE.test(e.summary);
    const isActivity = !isRide && ACTIVITY_RE.test(e.summary);
    if (!isRide && !isActivity) continue;
    if (!isRide && SCHOOL_INFO_RE.test(e.summary)) continue;
    if (!homeAt(e.startMs)) continue;
    const timeMs = statedTime(e.summary, e.startMs) || e.startMs;
    const leaveMs = leaveByMs(e, timeMs);
    if (leaveMs == null) continue;
    /* Dad's segments only ("Dan picks up Harris | Casey picks up Hayes" -> Harris) */
    const segs = e.summary.split(/\s+\|\s+/).map((s) => s.split(/;\s*/)[0]).filter((s) => kidsIn(s).length);
    const mine = segs.filter((s) => { const by = byOf(s); return !by || by === "Dad"; });
    if (!mine.length) continue;
    const names = [...new Set(mine.flatMap((s) => kidsIn(s).map((k) => k.name)))];
    const label = `${joinNames(names)} ${kindWord(mine[0], isRide)}`;
    out.push({ label, leaveMs, startMs: e.startMs, timeMs, isRide });
  }
  return out.sort((a, b) => a.leaveMs - b.leaveMs || a.startMs - b.startMs);
}

export function computeNextUp({ calendar, now, sourceLabel }) {
  const t = now == null ? Date.now() : now;
  const cal = asCalendar(calendar);
  const today = ctDate(t);
  const through = ctWallMs(addDays(today, 2), 0, 0); /* end of tomorrow */
  const spans = kidsHomeSpans(cal.events);
  const floorMin = Math.floor(t / 60000) * 60000;
  const c = leaveCandidates(cal, t, { through }).find((x) => x.leaveMs >= floorMin) || null;
  const next = c ? {
    label: c.label,
    copy: `Leave ${fmtHM(c.leaveMs)}.`,
    leaveAt: fmtHM(c.leaveMs),
    leaveIso: ctIso(c.leaveMs),
    startIso: ctIso(c.startMs),
    day: ctDate(c.leaveMs) === today ? "Today" : ctParts(c.leaveMs).wd,
  } : null;
  const out = {
    asOfIso: today, generatedAt: ctIso(t), next, timer: null,
    source: sourceLabel || "calendar (read-only)", warnings: calendarWarnings(cal, t),
  };
  if (!next && cal.hasKidsHome && !kidsHomeAt(spans, t)) out.reason = kidsAwayReason(spans, t);
  const hits = scanObject(out).concat(momHits(out));
  if (hits.length) throw new Error("next-up output failed wall-safe scan: " + JSON.stringify(hits));
  return out;
}

/** Wright's timer, reference render: {label, endsAt ISO} -> "Oven 12:00." (m:ss remaining, clamps at 0:00).
    label: 1-12 letters/spaces, wall-safe. Anything else -> null (render nothing). */
export function timerCopy(timer, now) {
  if (!timer || typeof timer !== "object") return null;
  const label = String(timer.label || "").trim();
  const end = Date.parse(timer.endsAt || "");
  if (!/^[A-Za-z][A-Za-z ]{0,11}$/.test(label) || !isFinite(end) || bannedHits(label).length) return null;
  const t = now == null ? Date.now() : now;
  const rem = Math.max(0, Math.ceil((end - t) / 1000));
  return `${label} ${Math.floor(rem / 60)}:${String(rem % 60).padStart(2, "0")}.`;
}

export const USAGE = "Usage: node scripts/next-up.mjs [--data-dir data] [--events …] [--cal-live …] [--kids-week …] [--config …] [--override …] [--now ISO] [--out data/next-up.json] [--stdout] [--help|-h]\n  Writes data/next-up.json (or --out) unless --stdout. --help prints this and writes nothing.";

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  cliGuard(process.argv, { usage: USAGE, flags: HOUSE_MODE_FLAGS }); /* CLIGUARD1: before any read/write */
  const a = parseArgs(process.argv, DEFAULTS);
  const inp = loadInputs(a);
  const out = computeNextUp({ ...inp, now: a.now == null || isNaN(a.now) ? Date.now() : a.now });
  if (a.stdout) process.stdout.write(JSON.stringify(out, null, 2) + "\n");
  else { writeJson(a.out, out); console.log(`next-up: ${out.next ? `${out.next.label} · ${out.next.copy} (${out.next.day})` : `none${out.reason ? " · " + out.reason : ""}`} -> ${path.relative(process.cwd(), a.out)}`); }
}
