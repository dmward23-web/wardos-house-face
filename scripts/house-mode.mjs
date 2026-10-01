#!/usr/bin/env node
/* ATLASLANE1 · scripts/house-mode.mjs · branch wall-redesign-atlas · NOT WIRED (no cron, no deploy).
   Writes data/house-mode.json: {mode, label, since, until, asOfIso, generatedAt, source, reason, warnings}.

   Precedence: override (Guest/Quiet, manual) > Nashville week > Kids away > Weekend > After school > School day.
   Inputs (read-only): calendar JSON dump on the box, data/kids-week.json, config/house-mode.config.json,
   optional data/house-mode-override.json (absent by default).

   Usage:
     node scripts/house-mode.mjs [--events /workspace/cal-dmward23-week.json] [--kids-week data/kids-week.json]
                                 [--config config/house-mode.config.json] [--override data/house-mode-override.json]
                                 [--now 2026-10-02T07:30:00-05:00] [--out data/house-mode.json] [--stdout] */
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  MODES, MANUAL_ONLY, normalizeEvents, coverage, kidsHomeSpans, kidsHomeAt, schoolDayInfo, dismissalFor,
  nashvilleAt, ctDate, ctWallMs, addDays, parseHM, fmtWhen, fmtTime, ctIso, readJson, writeJson, scanObject,
} from "./house/lib.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const DEFAULTS = {
  events: "/workspace/cal-dmward23-week.json",
  kidsWeek: path.join(ROOT, "data/kids-week.json"),
  config: path.join(ROOT, "config/house-mode.config.json"),
  override: path.join(ROOT, "data/house-mode-override.json"),
  out: path.join(ROOT, "data/house-mode.json"),
};

/** Valid override = Guest/Quiet only, with a parseable future `until` (expiry is required). */
export function activeOverride(override, t) {
  if (!override || typeof override !== "object") return null;
  const mode = String(override.mode || "").toLowerCase();
  if (!MANUAL_ONLY.includes(mode)) return null;
  const until = Date.parse(override.until || "");
  if (!isFinite(until) || t >= until) return null;
  const since = override.since ? Date.parse(override.since) : NaN;
  if (isFinite(since) && t < since) return null;
  return { mode, sinceMs: isFinite(since) ? since : null, untilMs: until };
}

/** Pure: mode key + reason at instant t. ctx = {events (normalized), spans, kidsWeek, config, override}. */
export function modeAt(ctx, t) {
  const { events, spans, kidsWeek, config, override } = ctx;
  const ov = activeOverride(override, t);
  if (ov) return { mode: ov.mode, reason: `Set by hand until ${fmtWhen(ov.untilMs)}` };

  const trip = nashvilleAt(events, config, t);
  if (trip) return { mode: "nashville-week", reason: `Dan's Nashville travel week (all-day calendar event, through ${fmtWhen(trip.endMs - 60000).replace(/, .*$/, "")})` };

  if (!kidsHomeAt(spans, t)) {
    const next = spans.filter((s) => s.startMs > t).sort((a, b) => a.startMs - b.startMs)[0];
    return { mode: "kids-away", reason: "Kids are with their mom" + (next ? `; back with Dad ${fmtWhen(next.startMs)}` : "") };
  }

  const today = ctDate(t);
  const bed = parseHM((config && config.bedtime) || "20:00") || { hh: 20, mm: 0 };
  const bedMs = ctWallMs(today, bed.hh, bed.mm);
  const evening = t >= bedMs;
  const day = evening ? addDays(today, 1) : today; /* after bedtime the house is on tomorrow's footing */
  const info = schoolDayInfo(events, day);
  if (!info.school) {
    const why = info.weekday === "Sat" || info.weekday === "Sun" ? "Weekend" : "No school on the calendar";
    return { mode: "weekend", reason: evening ? `${why} tomorrow (after ${fmtTime(bedMs)} bedtime)` : why };
  }
  if (!evening) {
    const dis = dismissalFor(events, kidsWeek, today, config);
    if (t >= dis.ms) {
      return { mode: "after-school", reason: `School day; after dismissal ${fmtTime(dis.ms)} (${dis.source}) until ${fmtTime(bedMs)} bedtime` + (info.earlyRelease ? "; early release day (time not on calendar)" : "") };
    }
    return { mode: "school-day", reason: `School day; dismissal ${fmtTime(dis.ms)} (${dis.source})` + (info.earlyRelease ? "; early release day (time not on calendar)" : "") };
  }
  return { mode: "school-day", reason: `School night: tomorrow is a school day (after ${fmtTime(bedMs)} bedtime)` };
}

/** Find the edge of the current mode by stepping, then refine to the minute. Bounded by calendar coverage. */
function edgeOf(ctx, t, key, dir, cov) {
  const STEP = 15 * 60000, MAX = 21 * 24 * 60 * 60000;
  const lo = cov ? cov.fromMs : t - MAX, hi = cov ? cov.toMs : t + MAX;
  let a = t, b = t + dir * STEP, n = 0;
  while (n++ < MAX / STEP) {
    if (b < lo || b > hi) return null; /* no change inside the data we have */
    if (modeAt(ctx, b).mode !== key) break;
    a = b; b += dir * STEP;
  }
  if (n >= MAX / STEP) return null;
  /* a = same mode, b = different; binary search to the minute */
  while (Math.abs(b - a) > 60000) {
    const mid = Math.floor((a + b) / 2 / 60000) * 60000;
    if (modeAt(ctx, mid).mode === key) a = mid; else b = mid;
  }
  return dir > 0 ? b : a; /* until = first minute of next mode; since = first minute of this mode */
}

export function computeHouseMode({ calendar, kidsWeek, config, override, now, sourceLabel, calendarFetchedMs }) {
  const t = now == null ? Date.now() : now;
  const events = normalizeEvents(calendar);
  const spans = kidsHomeSpans(events);
  const ctx = { events, spans, kidsWeek, config, override };
  const cur = modeAt(ctx, t);
  const cov = coverage(events);
  const warnings = [];

  let sinceMs, untilMs;
  const ov = activeOverride(override, t);
  if (ov) { sinceMs = ov.sinceMs; untilMs = ov.untilMs; }
  else {
    const s = edgeOf(ctx, t, cur.mode, -1, cov);
    sinceMs = s == null ? null : s;
    untilMs = edgeOf(ctx, t, cur.mode, +1, cov);
  }

  if (!events.length) warnings.push("no calendar events loaded");
  else if (cov && (t < cov.fromMs || t >= cov.toMs)) warnings.push("now is outside the calendar dump's date range");
  /* freshness = when the dump was fetched (file mtime); calendar.updated is only the calendar's last edit */
  const calFetched = isFinite(calendarFetchedMs) ? calendarFetchedMs : (calendar && calendar.updated ? Date.parse(calendar.updated) : NaN);
  if (isFinite(calFetched) && t - calFetched > 6 * 3600000) warnings.push("calendar dump older than 6h");
  if (kidsWeek && kidsWeek.asOfIso && kidsWeek.asOfIso !== ctDate(t)) warnings.push("kids-week.json asOfIso is not today");
  /* Cross-check: kids-week homeWeek.endIso should be the end of the active Kids with Dan span when kids are home. */
  if (kidsWeek && kidsWeek.homeWeek && kidsWeek.homeWeek.endIso && kidsHomeAt(spans, t)) {
    const active = spans.find((s) => s.startMs <= t && t < s.endMs);
    if (active && Date.parse(kidsWeek.homeWeek.endIso) !== active.endMs) warnings.push("kids-week homeWeek.endIso disagrees with calendar");
  }

  const out = {
    mode: cur.mode,
    label: MODES[cur.mode],
    since: ctIso(sinceMs),
    until: ctIso(untilMs),
    asOfIso: ctDate(t),
    generatedAt: ctIso(t),
    source: sourceLabel || "calendar (Kids with Dan + all-day travel + no-school events) + data/kids-week.json + config/house-mode.config.json",
    reason: cur.reason,
    warnings,
  };
  const hits = scanObject(out);
  if (hits.length) throw new Error("house-mode output failed wall-safe scan: " + JSON.stringify(hits));
  return out;
}

function parseArgs(argv) {
  const a = { ...DEFAULTS, now: null, stdout: false };
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i], v = argv[i + 1];
    if (k === "--events") { a.events = path.resolve(v); i++; }
    else if (k === "--kids-week") { a.kidsWeek = path.resolve(v); i++; }
    else if (k === "--config") { a.config = path.resolve(v); i++; }
    else if (k === "--override") { a.override = path.resolve(v); i++; }
    else if (k === "--out") { a.out = path.resolve(v); i++; }
    else if (k === "--now") { a.now = Date.parse(v); i++; }
    else if (k === "--stdout") a.stdout = true;
  }
  return a;
}

export function loadInputs(a) {
  const calendar = readJson(a.events);
  const kidsWeek = readJson(a.kidsWeek, null);
  const config = readJson(a.config);
  const override = fs.existsSync(a.override) ? readJson(a.override, null) : null;
  const cal = (kidsWeek && kidsWeek.sourceCalendar) || (calendar && calendar.summary) || "?";
  const calendarFetchedMs = fs.statSync(a.events).mtimeMs;
  const upd = `, fetched ${ctIso(calendarFetchedMs)}`;
  const who = `calendar ${cal} (${path.basename(a.events)}${upd}, read-only)`;
  const kw = kidsWeek && kidsWeek.refreshedAt ? ` + kids-week.json (refreshed ${ctIso(Date.parse(kidsWeek.refreshedAt))})` : "";
  return { calendar, kidsWeek, config, override, calendarFetchedMs, sourceLabel: `${who}${kw}${override ? " + house-mode-override.json" : ""}` };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const a = parseArgs(process.argv);
  const inp = loadInputs(a);
  const out = computeHouseMode({ ...inp, now: a.now == null || isNaN(a.now) ? Date.now() : a.now });
  if (a.stdout) process.stdout.write(JSON.stringify(out, null, 2) + "\n");
  else { writeJson(a.out, out); console.log(`house-mode: ${out.label} (${out.mode}) since ${out.since} until ${out.until} -> ${path.relative(process.cwd(), a.out)}`); }
}
