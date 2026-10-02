/* ATLASLANE1 · scripts/house/lib.mjs · branch wall-redesign-atlas · NOT WIRED.
   Shared, pure helpers for house-mode.mjs + pickup-chain.mjs.
   Read-only on calendars: reads a calendar JSON dump already on the box. Never writes, edits,
   renames, or annotates a calendar event. No network. */
import fs from "node:fs";
import path from "node:path";
import { renameText } from "./display-rename.mjs";

export const TZ = "America/Chicago";

export const MODES = {
  "school-day": "School day",
  "after-school": "After school",
  "weekend": "Weekend",
  "day-off": "Day off",
  "kids-away": "Kids away",
  "nashville-week": "Nashville week",
  "guest": "Guest",
  "quiet": "Quiet",
};
export const MANUAL_ONLY = ["guest", "quiet"];
export const KIDS = [
  { id: "hayes", name: "Hayes" },
  { id: "ainsley", name: "Ainsley" },
  { id: "harris", name: "Harris" },
];

/* ---------- CT time ---------- */
const FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", weekday: "short", hourCycle: "h23",
});
export function ctParts(ms) {
  const o = {};
  for (const p of FMT.formatToParts(new Date(ms))) o[p.type] = p.value;
  const hh = Number(o.hour) % 24;
  return {
    y: Number(o.year), m: Number(o.month), d: Number(o.day), hh, mm: Number(o.minute),
    wd: o.weekday, iso: `${o.year}-${o.month}-${o.day}`, minutes: hh * 60 + Number(o.minute),
  };
}
export function ctDate(ms) { return ctParts(ms).iso; }
function ctOffsetMs(ms) {
  const p = ctParts(ms);
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm);
  return asUtc - Math.floor(ms / 60000) * 60000;
}
/** CT wall clock -> epoch ms. */
export function ctWallMs(isoDate, hh = 0, mm = 0) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  let t = guess - ctOffsetMs(guess);
  const off2 = ctOffsetMs(t);
  if (guess - off2 !== t) t = guess - off2;
  return t;
}
export function addDays(isoDate, n) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n, 12)).toISOString().slice(0, 10);
}
export function weekdayOf(isoDate) { return ctParts(ctWallMs(isoDate, 12, 0)).wd; }
export function fmtTime(ms) {
  const p = ctParts(ms);
  const h12 = p.hh % 12 === 0 ? 12 : p.hh % 12;
  return `${h12}:${String(p.mm).padStart(2, "0")} ${p.hh < 12 ? "AM" : "PM"}`;
}
/** Wall clock copy, no am/pm: "5:10". */
export function fmtHM(ms) {
  const p = ctParts(ms);
  return `${p.hh % 12 === 0 ? 12 : p.hh % 12}:${String(p.mm).padStart(2, "0")}`;
}
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function fmtWhen(ms) {
  const p = ctParts(ms);
  return `${p.wd} ${MON[p.m - 1]} ${p.d}, ${fmtTime(ms)}`;
}
/** ISO with explicit CT offset, e.g. 2026-10-01T15:40:00-05:00 */
export function ctIso(ms) {
  if (ms == null) return null;
  const p = ctParts(ms);
  const off = Math.round(ctOffsetMs(ms) / 60000);
  const sign = off <= 0 ? "-" : "+";
  const a = Math.abs(off);
  const pad = (n) => String(n).padStart(2, "0");
  return `${p.iso}T${pad(p.hh)}:${pad(p.mm)}:00${sign}${pad(Math.floor(a / 60))}:${pad(a % 60)}`;
}
export function parseHM(s) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || "").trim());
  return m ? { hh: Number(m[1]), mm: Number(m[2]) } : null;
}

/* ---------- files ---------- */
export function readJson(fp, fallback = undefined) {
  try { return JSON.parse(fs.readFileSync(fp, "utf8")); }
  catch (e) { if (fallback !== undefined) return fallback; throw e; }
}
export function writeJson(fp, obj) {
  fs.writeFileSync(fp, JSON.stringify(obj, null, 2) + "\n");
}

/* ---------- events ---------- */
function rawEvents(src) {
  if (!src) return [];
  if (Array.isArray(src)) return src;
  if (Array.isArray(src.events)) return src.events;
  if (src.result && Array.isArray(src.result.events)) return src.result.events;
  if (Array.isArray(src.upcomingLeaves)) return src.upcomingLeaves; /* data/cal-live.json shape */
  return [];
}
function edge(v, allDayHint) {
  if (v == null) return null;
  if (typeof v === "string") {
    if (allDayHint) return { allDay: true, date: v.slice(0, 10) };
    return { allDay: false, ms: Date.parse(v) };
  }
  if (v.dateTime) return { allDay: false, ms: Date.parse(v.dateTime) };
  if (v.date) return { allDay: true, date: String(v.date).slice(0, 10) };
  return null;
}
/** Normalize Google Calendar (MCP dump) or cal-live rows into {summary, description, location, startMs, endMs, allDay, startDate, endDate, cancelled}. */
export function normalizeEvents(src) {
  const out = [];
  for (const ev of rawEvents(src)) {
    const s = edge(ev.start, ev.allDay === true);
    const e = edge(ev.end, ev.allDay === true);
    if (!s) continue;
    const summary = String(ev.summary || ev.title || "").trim();
    const n = {
      id: ev.id || null, summary,
      description: String(ev.description || ""),
      location: String(ev.location || ""),
      allDay: !!s.allDay,
      cancelled: ev.status === "cancelled" || /^\s*CANCELL?ED\b/i.test(summary),
    };
    if (s.allDay) {
      n.startDate = s.date;
      let endDate = e && e.allDay ? e.date : addDays(s.date, 1);
      if (endDate <= s.date) endDate = addDays(s.date, 1); /* zero-length all-day = one day */
      n.endDate = endDate;
      n.startMs = ctWallMs(n.startDate, 0, 0);
      n.endMs = ctWallMs(n.endDate, 0, 0);
    } else {
      n.startMs = s.ms;
      n.endMs = e && !e.allDay && isFinite(e.ms) ? e.ms : s.ms;
      if (!isFinite(n.startMs)) continue;
      n.startDate = ctDate(n.startMs);
    }
    out.push(n);
  }
  out.sort((a, b) => a.startMs - b.startMs);
  return out;
}
/** Days the dump covers (CT): first event start date .. last event start date (inclusive). */
export function coverage(events) {
  if (!events.length) return null;
  let lo = Infinity, hi = -Infinity;
  for (const e of events) { lo = Math.min(lo, e.startMs); hi = Math.max(hi, e.startMs); }
  return { fromMs: ctWallMs(ctDate(lo), 0, 0), toMs: ctWallMs(addDays(ctDate(hi), 1), 0, 0) };
}

/** Merge calendar sources (priority order; earlier wins on the same event id) into one read-only view.
    source = {name, data, window?: {from, to} (CT dates, inclusive), fetchedMs?}. Window defaults to the
    first..last event start date in that source (same rule as cal-from-events.mjs windowBounds). */
export function buildCalendar(sources) {
  const seen = new Set();
  const events = [];
  const windows = [];
  const used = [];
  for (const src of sources || []) {
    if (!src || !src.data) continue;
    const evs = normalizeEvents(src.data);
    used.push({ name: src.name || "calendar", fetchedMs: src.fetchedMs == null ? null : src.fetchedMs, count: evs.length });
    for (const e of evs) {
      const key = e.id || `${e.summary.toLowerCase()}|${e.startMs}`;
      const alt = `${e.summary.toLowerCase()}|${e.startMs}`;
      if (seen.has(key) || seen.has(alt)) continue;
      seen.add(key); seen.add(alt);
      events.push(e);
    }
    let w = src.window && src.window.from && src.window.to ? { from: src.window.from, to: src.window.to } : null;
    if (!w && evs.length) {
      const c = coverage(evs);
      w = { from: ctDate(c.fromMs), to: addDays(ctDate(c.toMs), -1) };
    }
    if (w) windows.push(w);
  }
  events.sort((a, b) => a.startMs - b.startMs);
  const window = windows.length
    ? { from: windows.map((w) => w.from).sort()[0], to: windows.map((w) => w.to).sort().slice(-1)[0] }
    : null;
  return { __built: true, events, window, sources: used, hasKidsHome: events.some((e) => !e.cancelled && KIDS_HOME_RE.test(e.summary)) };
}
export function asCalendar(calendar) {
  if (calendar && calendar.__built) return calendar;
  return buildCalendar([{ name: "calendar", data: calendar }]);
}
export function windowMs(cal) {
  if (!cal.window) return null;
  return { fromMs: ctWallMs(cal.window.from, 0, 0), toMs: ctWallMs(addDays(cal.window.to, 1), 0, 0) };
}
/** Shared input warnings: window must reach now+7d; feeds must be fresh; kids-home must be knowable. Never guesses. */
export function calendarWarnings(cal, t) {
  const out = [];
  const w = windowMs(cal);
  const horizon = t + 7 * 24 * 3600000;
  if (!cal.events.length || !w) out.push("No calendar events loaded");
  else if (t < w.fromMs || horizon >= w.toMs) {
    out.push(`Calendar window ${cal.window.from}..${cal.window.to} does not reach now+7d (${ctDate(horizon)})`);
  }
  for (const s of cal.sources) {
    if (s.fetchedMs != null && isFinite(s.fetchedMs) && t - s.fetchedMs > 6 * 3600000) out.push(`Calendar feed ${s.name} older than 6h`);
  }
  if (!cal.hasKidsHome) out.push("No 'Kids with Dan' events in calendar data; kids away not evaluated");
  return out;
}
/** CLI loader. Repo data first (data/cal-live.json, data/kids-week.json), box dump as fallback + supplement:
    cal-live never publishes 'Kids with Dan' or events that already started, so the dump (when present) fills those. */
export const BOX_DUMP = "/workspace/cal-dmward23-week.json";
export function loadInputs({ dataDir, calLive, events, kidsWeek, override } = {}) {
  const sources = [];
  const cl = calLive || (dataDir ? path.join(dataDir, "cal-live.json") : null);
  if (cl && fs.existsSync(cl)) {
    const d = readJson(cl, null);
    if (d && d.status === "live" && Array.isArray(d.upcomingLeaves)) {
      sources.push({ name: "data/cal-live.json", data: d, window: d.windowStart && d.windowEnd ? { from: d.windowStart, to: d.windowEnd } : null, fetchedMs: d.fetchedAt ? Date.parse(d.fetchedAt) : null });
    }
  }
  const dump = events || BOX_DUMP;
  if (dump && fs.existsSync(dump)) {
    sources.push({ name: path.basename(dump), data: readJson(dump), fetchedMs: fs.statSync(dump).mtimeMs });
  }
  if (!sources.length) throw new Error(`no calendar data: neither ${cl} nor ${dump} found`);
  const calendar = buildCalendar(sources);
  const kwPath = kidsWeek || (dataDir ? path.join(dataDir, "kids-week.json") : null);
  const kw = kwPath && fs.existsSync(kwPath) ? readJson(kwPath, null) : null;
  const ovPath = override || (dataDir ? path.join(dataDir, "house-mode-override.json") : null);
  const ov = ovPath && fs.existsSync(ovPath) ? readJson(ovPath, null) : null;
  const parts = calendar.sources.map((s) => `${s.name}${s.fetchedMs ? ` fetched ${ctIso(s.fetchedMs)}` : ""}`);
  const label = `Calendar (${parts.join(" + ")}, read-only)` +
    (kw ? ` + kids-week.json${kw.refreshedAt ? ` (refreshed ${ctIso(Date.parse(kw.refreshedAt))})` : ""}` : "") +
    (ov ? " + house-mode-override.json" : "");
  return { calendar, kidsWeek: kw, override: ov, sourceLabel: label };
}

/* ---------- kids home / away ---------- */
/** The calendar's recurring "Kids with Dan" event (Fri 3:00 PM -> Fri 3:00 PM, plus one-offs like
    "Kids with Dan — Christmas morning") is the ONLY home signal. Outside every such span = kids away (with their mom). */
export const KIDS_HOME_RE = /^Kids with Dan\b/i;
export function kidsHomeSpans(events) {
  return events.filter((e) => !e.cancelled && KIDS_HOME_RE.test(e.summary))
    .map((e) => ({ startMs: e.startMs, endMs: e.endMs }));
}
export function kidsHomeAt(spans, t) { return spans.some((s) => s.startMs <= t && t < s.endMs); }

/* ---------- school day ---------- */
const DOW_SCHOOL = new Set(["Mon", "Tue", "Wed", "Thu", "Fri"]);
/** Which Ward kids have no school on isoDate, from all-day calendar events. Johnson kids are a different family: ignored. */
export function noSchoolKids(events, isoDate) {
  const off = new Set();
  let earlyRelease = false;
  for (const e of events) {
    if (!e.allDay || e.cancelled) continue;
    if (!(e.startDate <= isoDate && isoDate < e.endDate)) continue;
    const s = e.summary;
    if (/Johnson Kids/i.test(s)) continue;
    const ward = /Ward Kids \[([A-Z]+) (No School|Early Release)\]/i.exec(s);
    if (ward) {
      if (/early/i.test(ward[2])) { earlyRelease = true; continue; }
      if (/A/i.test(ward[1])) off.add("ainsley");
      if (/H/i.test(ward[1])) { off.add("hayes"); off.add("harris"); }
      continue;
    }
    if (/Ward Kids\s*[—–-]\s*no school/i.test(s)) { KIDS.forEach((k) => off.add(k.id)); continue; }
    const named = /^((?:Hayes|Harris|Ainsley)(?:\s*(?:\+|and|&)\s*(?:Hayes|Harris|Ainsley))*)\s*[—–-]\s*no school\b/i.exec(s);
    if (named) for (const k of KIDS) if (new RegExp(`\\b${k.name}\\b`, "i").test(named[1])) off.add(k.id);
  }
  return { off, earlyRelease };
}
export function schoolDayInfo(events, isoDate) {
  const wd = weekdayOf(isoDate);
  const { off, earlyRelease } = noSchoolKids(events, isoDate);
  const weekday = DOW_SCHOOL.has(wd);
  return { isoDate, weekday: wd, school: weekday && off.size < KIDS.length, noSchool: [...off], earlyRelease };
}

/** Dismissal for isoDate: today's "SRE pickup · 3:40" event > kids-week leaveBys.SRE_pickup "for 3:40" > config default (3:00 PM). */
export function dismissalFor(events, kidsWeek, isoDate, config) {
  for (const e of events) {
    if (e.allDay || e.cancelled || e.startDate !== isoDate) continue;
    if (!/SRE pickup/i.test(e.summary)) continue;
    const m = /SRE pickup\s*[·@-]?\s*(\d{1,2}):(\d{2})/i.exec(e.summary);
    if (m) {
      let hh = Number(m[1]); if (hh < 12) hh += 12;
      return { ms: ctWallMs(isoDate, hh, Number(m[2])), source: "calendar SRE pickup event" };
    }
  }
  const lb = kidsWeek && kidsWeek.leaveBys && kidsWeek.leaveBys.SRE_pickup;
  const m2 = lb ? /for\s+(\d{1,2}):(\d{2})/i.exec(lb) : null;
  if (m2) {
    let hh = Number(m2[1]); if (hh < 12) hh += 12;
    return { ms: ctWallMs(isoDate, hh, Number(m2[2])), source: "kids-week leaveBys.SRE_pickup" };
  }
  const d = parseHM((config && config.defaultDismissal) || "15:00") || { hh: 15, mm: 0 };
  return { ms: ctWallMs(isoDate, d.hh, d.mm), source: "default" };
}

/* ---------- Nashville week ---------- */
export function inExcludedRange(config, isoDate) {
  const list = (config && config.nashvilleWeek && config.nashvilleWeek.excludeDateRanges) || [];
  return list.some((r) => r && r.from && r.to && r.from <= isoDate && isoDate <= r.to);
}
export function nashvilleAt(events, config, t) {
  const pat = new RegExp((config && config.nashvilleWeek && config.nashvilleWeek.summaryPattern) || "^Dan(?:\\s*\\+\\s*Kids)?\\s+Nashville\\b", "i");
  if (inExcludedRange(config, ctDate(t))) return null;
  return events.find((e) => e.allDay && !e.cancelled && pat.test(e.summary) && e.startMs <= t && t < e.endMs) || null;
}

/* ---------- wall-safe text ---------- */
/** Banned on wall output (Dan/brief). Scan is case-insensitive and word-bounded. */
export const BANNED_PATTERNS = [
  { id: "custody", re: /\bcustody\b/i },
  { id: "$", re: /\$|\b\d+(?:\.\d{2})?\s?(?:dollars|bucks)\b|\bUSD\b/i },
  { id: "jar", re: /\bjars?\b/i },
  { id: "payout", re: /\bpay-?outs?\b|\bpayday\b/i },
  { id: "Erin", re: /\berin\b/i },
  { id: "legal", re: /\blegal\b/i },
  { id: "therapy", re: /\btherap(?:y|ist|ies)\b/i },
  { id: "Wells", re: /\bwells\b/i },
  { id: "balance", re: /\bbalances?\b/i },
  { id: "autopay", re: /\bauto-?pay\b/i },
  { id: "rank", re: /\brank(?:s|ing|ings|ed)?\b|\bleader-?board\b/i },
  { id: "their mom", re: /\btheir\s+moms?\b/i },
  { id: "mom", re: /\bmoms?\b|\bmommy\b/i },
];
/* Parent-mention ids: scrubbed by publicText() rather than dropping the whole event. */
export const PARENT_IDS = ["mom", "their mom"];
/* Public wall JSON style: no exclamation marks. */
export const STYLE_PATTERNS = [{ id: "exclamation", re: /!/ }];
/** Extra source-side excludes for the pickup chain (never even considered): work, health, money, legal, admin. */
export const PICKUP_EXCLUDE_RE = /\b(custody|erin|legal|lawyer|attorney|court|mediat\w*|8332|therap\w*|counsel\w*|LPC|anxiety|psych\w*|doctor|dr\.?\s|clinic|appt|appointment|wells|balances?|autopay|bill|payment|budget|ledger|harbor|cursor|wardos|atlas|work|invoice|tax|jars?|pay-?outs?|payday|allowance|reward)\b|\$|^\s*(GET|REMIND|Atlas)\b\s*[·:]/i;
export function bannedHits(text) {
  const s = String(text == null ? "" : text);
  return BANNED_PATTERNS.filter((p) => p.re.test(s)).map((p) => p.id);
}
/** Public-data hits: banned words + style (no "!"). */
export function publicHits(text) {
  const s = String(text == null ? "" : text);
  return bannedHits(s).concat(STYLE_PATTERNS.filter((p) => p.re.test(s)).map((p) => p.id));
}
/** Recursively scan every string value (and key) in an object for public-data hits. */
export function scanObject(obj, path = "$") {
  const hits = [];
  const walk = (v, p) => {
    if (typeof v === "string") { const h = publicHits(v); if (h.length) hits.push({ path: p, hits: h, text: v }); }
    else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${p}[${i}]`));
    else if (v && typeof v === "object") for (const k of Object.keys(v)) {
      const hk = bannedHits(k); if (hk.length) hits.push({ path: `${p}.${k}`, hits: hk, text: k });
      walk(v[k], `${p}.${k}`);
    }
  };
  walk(obj, path);
  return hits;
}
/** Public text: display renames first (Nonna and Papa, DAN RULING; patterns in the private box file), then drop any parenthetical naming someone's parent ("Casey's (Riley's …)" -> "Casey's"),
    drop "!", tidy spaces. Anything still banned after this is dropped by the caller, never published. */
export function publicText(text) {
  return renameText(String(text || "")) /* ATLASLANE6 display-only renames (config/display-rename.json) */
    .replace(/\s*\([^)]*\b(?:moms?|mommy|mother|dad)\b[^)]*\)/gi, "")
    .replace(/!+/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
/** "Kids away · back Fri 3:00" (weekday + time within 6 days, else with the date). */
export function kidsAwayReason(spans, t) {
  const next = spans.filter((s) => s.startMs > t).sort((a, b) => a.startMs - b.startMs)[0];
  if (!next) return "Kids away";
  const p = ctParts(next.startMs);
  const hm = `${p.hh % 12 === 0 ? 12 : p.hh % 12}:${String(p.mm).padStart(2, "0")}`;
  const day = next.startMs - t < 6 * 24 * 3600000 ? p.wd : `${p.wd} ${MON[p.m - 1]} ${p.d}`;
  return `Kids away · back ${day} ${hm}`;
}
/** Sentence case: first letter upper-case. */
export function sentence(s) {
  const str = String(s || "");
  const i = str.search(/[A-Za-z]/);
  return i < 0 ? str : str.slice(0, i) + str.charAt(i).toUpperCase() + str.slice(i + 1);
}

/* ---------- leave-by (ATLASLANE6: shared by pickup-chain, next-up, school-night) ---------- */
/** Calendar says it's not Dad's leave ("Awareness only — not a leave from 147th", "Leave-by: none"). */
export const NOT_A_LEAVE_RE = /\bnot a leave\b|\bleave-?by\s*:\s*none\b/i;
function nearestOf(day, h, mm, ap, anchorMs) {
  const hh = h % 12;
  const cands = ap ? [ctWallMs(day, /p/i.test(ap) ? hh + 12 : hh, mm)] : [ctWallMs(day, hh, mm), ctWallMs(day, hh + 12, mm)];
  return cands.sort((a, b) => Math.abs(a - anchorMs) - Math.abs(b - anchorMs))[0];
}
/** Leave-by for an event, in order:
    1. the title says "leave H:MM"                         ("Dan DRIVE … · leave 8:30")
    2. the event's own leave reminder line in the description ("Leave-by 4:25pm", "Leave home 4:45";
       text after "Was:" is history and ignored). Only the time is used; description text is never published.
    3. the event START is earlier than the stated time    ("SRE drop-off · 8:25" starting 8:10, kids-week
       leaveBys.note "event START = leave-by")
    null when the calendar says it isn't a leave, or none of these hold. */
export function leaveByMs(e, timeMs) {
  const day = ctDate(e.startMs);
  const anchor = timeMs == null ? e.startMs : timeMs;
  if (NOT_A_LEAVE_RE.test(e.summary) || NOT_A_LEAVE_RE.test(e.description)) return null;
  const t = /\bleave\s+(\d{1,2}):(\d{2})\s*([ap])?\.?m?\b/i.exec(e.summary);
  if (t) return nearestOf(day, Number(t[1]), Number(t[2]), t[3], e.startMs);
  const desc = String(e.description || "").split(/\bWas:/i)[0];
  const d = /\bleave(?:-by|\s+by|\s+home)\s*:?\s*(\d{1,2}):(\d{2})\s*([ap])?\.?m?\b/i.exec(desc);
  if (d) {
    const ms = nearestOf(day, Number(d[1]), Number(d[2]), d[3], anchor);
    if (ms <= anchor && anchor - ms <= 3 * 3600000) return ms;
  }
  return e.startMs < anchor ? e.startMs : null;
}

/* ---------- kid mentions ---------- */
export function kidsIn(text) {
  const s = String(text || "").replace(/\bHayes Johnson\b/gi, " ").replace(/\bJohnson Kids\b/gi, " ");
  const found = [];
  for (const k of KIDS) {
    const m = new RegExp(`\\b${k.name}\\b`, "i").exec(s);
    if (m) found.push({ id: k.id, name: k.name, at: m.index });
  }
  if (!found.length && /\bboys\b/i.test(s)) {
    found.push({ id: "hayes", name: "Hayes", at: 0 }, { id: "harris", name: "Harris", at: 1 });
  }
  return found.sort((a, b) => a.at - b.at).map(({ id, name }) => ({ id, name }));
}
