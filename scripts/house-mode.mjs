#!/usr/bin/env node
/* ATLASLANE1 · scripts/house-mode.mjs · branch wall-redesign-atlas · NOT WIRED (no cron, no deploy).
   Writes data/house-mode.json: {mode, label, since, until, asOfIso, generatedAt, source, reason, warnings}.

   Precedence: override (Guest/Quiet, manual) > Kids home (a 'Kids with Dan' span covers now: Nashville week
   ends, e.g. handoff Fridays) > Nashville week > Kids away > Day off / Weekend > After school > School day.
   Inputs (read-only): repo data/cal-live.json + data/kids-week.json when present; box dump
   /workspace/cal-dmward23-week.json as fallback + supplement (cal-live never carries 'Kids with Dan');
   config/house-mode.config.json; optional data/house-mode-override.json (absent by default).
   Warns (never guesses) when now+7d is outside the calendar window.

   Usage:
     node scripts/house-mode.mjs [--data-dir data] [--cal-live data/cal-live.json] [--events /workspace/cal-dmward23-week.json]
                                 [--kids-week data/kids-week.json] [--config config/house-mode.config.json]
                                 [--override data/house-mode-override.json] [--now ISO] [--out data/house-mode.json] [--stdout] */
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  MODES, MANUAL_ONLY, kidsHomeSpans, kidsHomeAt, schoolDayInfo, dismissalFor, asCalendar, windowMs, calendarWarnings,
  nashvilleAt, ctDate, ctWallMs, addDays, parseHM, fmtWhen, fmtTime, ctIso, readJson, writeJson, scanObject, loadInputs as loadAll,
  kidsAwayReason,
} from "./house/lib.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const DEFAULTS = {
  dataDir: path.join(ROOT, "data"),
  calLive: null,      /* default <dataDir>/cal-live.json */
  events: "/workspace/cal-dmward23-week.json",
  kidsWeek: null,     /* default <dataDir>/kids-week.json */
  config: path.join(ROOT, "config/house-mode.config.json"),
  override: null,     /* default <dataDir>/house-mode-override.json */
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

/** Pure: mode key + reason at instant t. ctx = {events (normalized), spans, spansKnown, kidsWeek, config, override}. */
export function modeAt(ctx, t) {
  const { events, spans, kidsWeek, config, override } = ctx;
  const spansKnown = ctx.spansKnown !== false;
  const ov = activeOverride(override, t);
  if (ov) return { mode: ov.mode, reason: `Set by hand · until ${fmtWhen(ov.untilMs)}` };

  /* Kids home beats Nashville week: once a 'Kids with Dan' span covers now, travel week is over. */
  const kidsHome = spansKnown && kidsHomeAt(spans, t);
  if (!kidsHome) {
    const trip = nashvilleAt(events, config, t);
    if (trip) return { mode: "nashville-week", reason: `Nashville week · through ${fmtWhen(trip.endMs - 60000).replace(/, .*$/, "")}` };
    if (spansKnown) return { mode: "kids-away", reason: kidsAwayReason(spans, t) };
  }

  const today = ctDate(t);
  const bed = parseHM((config && config.bedtime) || "20:00") || { hh: 20, mm: 0 };
  const bedMs = ctWallMs(today, bed.hh, bed.mm);
  const evening = t >= bedMs;
  const day = evening ? addDays(today, 1) : today; /* after bedtime the house is on tomorrow's footing */
  const info = schoolDayInfo(events, day);
  if (!info.school) {
    const wkend = info.weekday === "Sat" || info.weekday === "Sun";
    const mode = wkend ? "weekend" : "day-off";
    const why = wkend ? "Weekend" : "Day off · no school";
    return { mode, reason: evening ? (wkend ? "Weekend tomorrow" : "Day off tomorrow · no school") : why };
  }
  if (!evening) {
    const dis = dismissalFor(events, kidsWeek, today, config);
    if (t >= dis.ms) {
      return { mode: "after-school", reason: `After school · until ${fmtTime(bedMs)}` + (info.earlyRelease ? " · early release, time not on calendar" : "") };
    }
    return { mode: "school-day", reason: `School day · dismissal ${fmtTime(dis.ms)}` + (info.earlyRelease ? " · early release, time not on calendar" : "") };
  }
  return { mode: "school-day", reason: "School night · school tomorrow" };
}

/** Find the edge of the current mode by stepping, then refine to the minute. Bounded by calendar coverage. */
function edgeOf(ctx, t, key, dir, cov) {
  const STEP = 15 * 60000, MAX = 21 * 24 * 60 * 60000;
  const lo = cov ? cov.fromMs : t - MAX, hi = cov ? cov.toMs : t + MAX;
  const t0 = Math.floor(t / 60000) * 60000; /* minute-aligned so the bisection always converges */
  let a = t0, b = t0 + dir * STEP, n = 0;
  while (n++ < MAX / STEP) {
    if (b < lo || b > hi) return null; /* no change inside the data we have */
    if (modeAt(ctx, b).mode !== key) break;
    a = b; b += dir * STEP;
  }
  if (n >= MAX / STEP) return null;
  /* a = same mode, b = different; binary search to the minute */
  for (let guard = 0; Math.abs(b - a) > 60000 && guard < 64; guard++) {
    const mid = Math.floor((a + b) / 2 / 60000) * 60000;
    if (modeAt(ctx, mid).mode === key) a = mid; else b = mid;
  }
  return dir > 0 ? b : a; /* until = first minute of next mode; since = first minute of this mode */
}

export function computeHouseMode({ calendar, kidsWeek, config, override, now, sourceLabel }) {
  const t = now == null ? Date.now() : now;
  const cal = asCalendar(calendar);
  const events = cal.events;
  const spans = kidsHomeSpans(events);
  const ctx = { events, spans, spansKnown: cal.hasKidsHome, kidsWeek, config, override };
  const cur = modeAt(ctx, t);
  const cov = windowMs(cal);
  const warnings = calendarWarnings(cal, t);

  let sinceMs, untilMs;
  const ov = activeOverride(override, t);
  if (ov) { sinceMs = ov.sinceMs; untilMs = ov.untilMs; }
  else {
    sinceMs = edgeOf(ctx, t, cur.mode, -1, cov);
    untilMs = edgeOf(ctx, t, cur.mode, +1, cov);
  }

  if (kidsWeek && kidsWeek.asOfIso && kidsWeek.asOfIso !== ctDate(t)) warnings.push("Kids-week data is not from today");
  /* Cross-check: kids-week homeWeek.endIso should be the end of the active Kids with Dan span when kids are home. */
  if (kidsWeek && kidsWeek.homeWeek && kidsWeek.homeWeek.endIso && kidsHomeAt(spans, t)) {
    const active = spans.find((s) => s.startMs <= t && t < s.endMs);
    if (active && Date.parse(kidsWeek.homeWeek.endIso) !== active.endMs) warnings.push("Kids-week homeWeek.endIso disagrees with calendar");
  }

  const out = {
    mode: cur.mode,
    label: MODES[cur.mode],
    since: ctIso(sinceMs),
    until: ctIso(untilMs),
    asOfIso: ctDate(t),
    generatedAt: ctIso(t),
    source: sourceLabel || "Calendar (read-only) + kids-week.json + config/house-mode.config.json",
    reason: cur.reason,
    warnings,
  };
  const hits = scanObject(out);
  if (hits.length) throw new Error("house-mode output failed wall-safe scan: " + JSON.stringify(hits));
  return out;
}

export function parseArgs(argv, defaults = DEFAULTS) {
  const a = { ...defaults, now: null, stdout: false };
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i], v = argv[i + 1];
    if (k === "--data-dir") { a.dataDir = path.resolve(v); i++; }
    else if (k === "--cal-live") { a.calLive = path.resolve(v); i++; }
    else if (k === "--events") { a.events = path.resolve(v); i++; }
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
  return { ...loadAll(a), config: readJson(a.config) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const a = parseArgs(process.argv);
  const inp = loadInputs(a);
  const out = computeHouseMode({ ...inp, now: a.now == null || isNaN(a.now) ? Date.now() : a.now });
  if (a.stdout) process.stdout.write(JSON.stringify(out, null, 2) + "\n");
  else { writeJson(a.out, out); console.log(`house-mode: ${out.label} (${out.mode}) since ${out.since} until ${out.until}${out.warnings.length ? " · WARN " + out.warnings.join("; ") : ""} -> ${path.relative(process.cwd(), a.out)}`); }
}
