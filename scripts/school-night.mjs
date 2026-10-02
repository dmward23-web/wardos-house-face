#!/usr/bin/env node
/* ATLASLANE6 · scripts/school-night.mjs · school-night strip (upgrade 5) · NOT WIRED (no cron, no deploy).
   Writes data/school-night.json. Visible 15:00-19:00 CT on school nights only; outside that the strip is gone
   (no placeholder): the file carries only {asOfIso, generatedAt, visibleFrom, visibleUntil, …Iso, schoolNight, visible:false}.
   School night = tonight's house mode is not Day off / Kids away / Nashville week, the kids are home now and tomorrow
   7:30 AM, and tomorrow is a school day (Sun-Thu unless no school tomorrow).
   Contents (only real items; a missing one is omitted, never invented):
     pickup  today's remaining pickups from pickup-chain (Dad's or someone else's), short label + time + leave.
     gear    tonight's remaining activities + tomorrow's events (sport bag, gear the event text names, "send X to")
             + today's Pack flags. Fixed vocabulary only.
     form    the first real form / slip / due item (calendar, kid-named, today after now or tomorrow; GET/BUY stubs never).
     weather null + weatherSource "source needed": no field-weather source on the box without a new key or a new
             network path from this lane (last-yes). Render nothing for it.
   Usage: node scripts/school-night.mjs [--data-dir data] [--events …] [--pack-flags data/pack-flags.json] [--now ISO] [--stdout] */
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs, loadInputs, modeAt, DEFAULTS as HM_DEFAULTS } from "./house-mode.mjs";
import { computePickupChain, ACTIVITY_RE, gearIn } from "./pickup-chain.mjs";
import {
  asCalendar, kidsHomeSpans, kidsHomeAt, schoolDayInfo, ctDate, ctParts, ctWallMs, addDays, ctIso, fmtHM, readJson, writeJson,
  scanObject, bannedHits, PICKUP_EXCLUDE_RE, PARENT_IDS, kidsIn, sentence,
} from "./house/lib.mjs";
import { packFlagsFor } from "./house/wall-state.mjs";
import { momHits } from "./house/display-rename.mjs";
import { NEXTUP_EXCLUDE_RE } from "./next-up.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const VISIBLE_FROM = "15:00", VISIBLE_UNTIL = "19:00";
const HIDE_MODES = new Set(["day-off", "kids-away", "nashville-week"]);
const BAGS = { baseball: "Baseball bag", softball: "Softball bag", swim: "Swim bag", flag: "Flag bag", soccer: "Soccer bag",
  basketball: "Basketball bag", volleyball: "Volleyball bag", football: "Football bag" };
export const FORM_RE = /\b(form|permission slip|slip|waiver|due)\b/i;

function hm(s) { const [h, m] = s.split(":").map(Number); return { h, m }; }
function bagFor(text) { const m = /\b(baseball|softball|swim|flag|soccer|basketball|volleyball|football)\b/i.exec(text); return m ? BAGS[m[1].toLowerCase()] : null; }
function cap(s) { return sentence(String(s).trim()); }
function okEvent(e) {
  if (e.cancelled) return false;
  if (PICKUP_EXCLUDE_RE.test(e.summary) || NEXTUP_EXCLUDE_RE.test(e.summary)) return false;
  if (bannedHits(`${e.summary} ${e.location}`).some((h) => !PARENT_IDS.includes(h))) return false;
  if (/^\s*Dan\s*[—–-]/i.test(e.summary)) return false;
  return kidsIn(e.summary).length > 0;
}
/** "· 3pm" / "· 3:00" style due time in a title. */
function dueTime(title, day) {
  const m = /(\d{1,2})(?::(\d{2}))?\s*(am|pm|a|p)\b/i.exec(title) || /·\s*(\d{1,2}):(\d{2})\b/.exec(title);
  if (!m) return null;
  let h = Number(m[1]) % 12; const mm = Number(m[2] || 0);
  if (m[3] ? /p/i.test(m[3]) : h < 7) h += 12;
  return ctWallMs(day, h, mm);
}
function cleanForm(title) {
  return cap(title.replace(/^\s*(?:(?:Hayes|Harris|Ainsley)\s*(?:\+|&|and)?\s*)+[—–-]\s*/i, "")
    .replace(/\s*·\s*\d{1,2}(?::\d{2})?\s*(?:am|pm|a|p)?\s*$/i, "").replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s{2,}/g, " "));
}

export function computeSchoolNight({ calendar, kidsWeek, config, packFlags, now, sourceLabel }) {
  const t = now == null ? Date.now() : now;
  const cal = asCalendar(calendar);
  const events = cal.events;
  const spans = kidsHomeSpans(events);
  const today = ctDate(t), tomorrow = addDays(today, 1);
  const f = hm(VISIBLE_FROM), u = hm(VISIBLE_UNTIL);
  const fromMs = ctWallMs(today, f.h, f.m), untilMs = ctWallMs(today, u.h, u.m);
  const homeAt = (ms) => !cal.hasKidsHome || kidsHomeAt(spans, ms);
  const mode = modeAt({ events, spans, spansKnown: cal.hasKidsHome, kidsWeek, config, override: null }, Math.max(t, fromMs)).mode;
  const schoolNight = !HIDE_MODES.has(mode) && homeAt(t) && homeAt(ctWallMs(tomorrow, 7, 30)) && schoolDayInfo(events, tomorrow).school;
  const visible = schoolNight && t >= fromMs && t < untilMs;
  const base = {
    asOfIso: today, generatedAt: ctIso(t), visibleFrom: VISIBLE_FROM, visibleUntil: VISIBLE_UNTIL,
    visibleFromIso: ctIso(fromMs), visibleUntilIso: ctIso(untilMs), schoolNight, visible,
  };
  if (!visible) return base;

  /* pickup: from pickup-chain (today, remaining) */
  const chain = computePickupChain({ calendar: cal, kidsWeek, config, now: t });
  const pickup = chain.rows.filter((r) => r.kind === "ride" && /\bpick/i.test(r.what)).map((r) => {
    const time = fmtHM(Date.parse(r.timeIso));
    const leave = r.leaveByIso ? fmtHM(Date.parse(r.leaveByIso)) : null;
    const label = `${r.who.join(" + ")} pickup`;
    const who = r.by && r.by !== "Dad" ? ` · ${r.by}` : ""; /* someone else's pickup: who, never a leave */
    const copy = leave && leave === time ? `${label}. Leave ${leave}.` : `${label} ${time}${who}.` + (leave ? ` Leave ${leave}.` : "");
    return { who: r.who, label, time, leaveBy: leave, by: r.by, copy };
  });

  /* gear: tonight's remaining activities + tomorrow's events + today's pack flags */
  const gearMap = new Map();
  const add = (who, item) => { if (!item || bannedHits(item).length) return; const k = `${who}|${item.toLowerCase()}`; if (!gearMap.has(k)) gearMap.set(k, { who, item: cap(item) }); };
  const tonightEnd = untilMs, tomorrowEnd = ctWallMs(addDays(tomorrow, 1), 0, 0);
  for (const e of events) {
    if (e.allDay || !okEvent(e) || e.endMs <= t || e.startMs >= tomorrowEnd) continue;
    const isTomorrow = e.startDate === tomorrow;
    if (!isTomorrow && e.startMs >= tonightEnd) continue;
    if (!homeAt(e.startMs)) continue;
    const kids = kidsIn(e.summary).map((k) => k.name);
    const bag = ACTIVITY_RE.test(e.summary) ? bagFor(e.summary) : null;
    const send = /\bsend\s+(.+?)\s+to\b/i.exec(e.summary);
    const items = [bag, ...gearIn(e.summary), send ? send[1].replace(/\s*\([^)]*\)/g, "") : null].filter(Boolean);
    for (const k of kids) for (const it of items) add(k, it);
  }
  for (const fl of (packFlags ? packFlagsFor(packFlags, t).flags : [])) add(fl.kid, fl.text);
  const gearList = [...gearMap.values()];
  const byKid = [];
  for (const g of gearList) { let r = byKid.find((x) => x.who === g.who); if (!r) byKid.push(r = { who: g.who, items: [] }); r.items.push(g.item); }
  for (const r of byKid) r.copy = `${r.who} · ${r.items.map((x) => x.toLowerCase()).join(", ")}.`;

  /* form: first real form / due item, today after now or tomorrow */
  let form = null;
  for (const e of events) {
    if (!okEvent(e) || !FORM_RE.test(e.summary) || e.startDate < today || e.startDate > tomorrow) continue;
    if (!e.allDay && e.endMs <= t) continue;
    if (!homeAt(e.allDay ? ctWallMs(e.startDate, 12, 0) : e.startMs)) continue;
    const due = dueTime(e.summary, e.startDate);
    if (due != null && due <= t) continue;
    const who = kidsIn(e.summary).map((k) => k.name);
    const what = cleanForm(e.summary);
    const day = e.startDate === today ? "today" : ctParts(ctWallMs(e.startDate, 12, 0)).wd;
    form = { who, what, dueIso: due != null ? ctIso(due) : null, day,
      copy: `${who.join(" + ")} · ${/^[A-Z][a-z]/.test(what) ? what.charAt(0).toLowerCase() + what.slice(1) : what} ${day}${due != null ? " " + fmtHM(due) : ""}.` };
    break;
  }

  const out = { ...base, pickup, gear: byKid, ...(form ? { form } : {}), weather: null, weatherSource: "source needed",
    source: sourceLabel || "calendar (read-only) + pickup-chain + pack-flags" };
  const hits = scanObject(out).concat(momHits(out));
  if (hits.length) throw new Error("school-night output failed wall-safe scan: " + JSON.stringify(hits));
  return out;
}

const USAGE = "Usage: node scripts/school-night.mjs [--data-dir data] [--events …] [--pack-flags data/pack-flags.json] [--now ISO] [--out data/school-night.json] [--stdout] [--help]\n--help prints this and writes nothing. Unknown flags exit 2, nothing written.";
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const a = parseArgs(process.argv, { ...HM_DEFAULTS, out: path.join(ROOT, "data/school-night.json"), packFlags: null },
    { name: "school-night", usage: USAGE, extra: { "--pack-flags": "packFlags" } }); /* --help print-only; unknown flags exit 2 */
  const pf = a.packFlags;
  const inp = loadInputs(a);
  const pfPath = pf || path.join(ROOT, "data/pack-flags.json");
  const packFlags = fs.existsSync(pfPath) ? readJson(pfPath, null) : null;
  const out = computeSchoolNight({ ...inp, packFlags, now: a.now == null || isNaN(a.now) ? Date.now() : a.now });
  if (a.stdout) process.stdout.write(JSON.stringify(out, null, 2) + "\n");
  else { writeJson(a.out, out); console.log(`school-night: ${out.visible ? `visible · pickup ${out.pickup.length} · gear ${out.gear.length} · form ${out.form ? "yes" : "none"}` : `hidden (schoolNight ${out.schoolNight})`} -> ${path.relative(process.cwd(), a.out)}`); }
}
