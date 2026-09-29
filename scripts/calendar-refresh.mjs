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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const TZ = "America/Chicago";
const HOME = "6719 W 147th Terrace, Overland Park, KS 66223";

const PRESERVE_KID = [
  "id", "name", "you", "theme", "themeLabel", "gradeVoice", "avatar",
  "currency", "bankGoal", "quests", "fun", "streakLabel", "missions",
  "goal", "bag", "rides", "appointmentsEmpty", "sportsEmpty",
];
const PRESERVE_DAN = ["id", "name", "theme", "themeLabel", "avatar", "note", "picks", "leaveBys"];

function parseArgs(argv) {
  const out = {
    eventsPath: null,
    weekPath: path.join(ROOT, "kids-week.json"),
    mirrorDir: "/workspace/board-os/house-face",
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

function parseEventTime(ev, which) {
  const block = ev[which] || {};
  if (block.dateTime) {
    const d = new Date(block.dateTime);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (block.date) {
    // All-day: treat as midnight CT of that civil date
    const d = new Date(block.date + "T12:00:00-05:00");
    return Number.isNaN(d.getTime()) ? null : d;
  }
  // compact dump shape
  if (typeof ev[which] === "string") {
    const s = ev[which];
    const d = new Date(s.length === 10 ? s + "T12:00:00-05:00" : s);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
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
  return {
    ainsley: /\bainsley\b/.test(s),
    hayes: /\bhayes\b/.test(s),
    harris: /\bharris\b/.test(s),
    boys: /\bboyes\b|\bharris\b.*\bhayes\b|\bhayes\b.*\bharris\b|\bboyes\b|SRE drop|SRE pickup|Hayes \+ Harris/i.test(summary),
  };
}

function classify(ev) {
  const summary = summaryOf(ev);
  if (!summary || isAdminNoise(summary)) return null;
  if (/^Kids with Dan/i.test(summary)) return { kind: "custody", summary };
  if (/^Leave\s*·/i.test(summary) || /^Leave\b/i.test(summary)) {
    return { kind: "leave", summary, busy: !isFree(ev) };
  }
  /* RIDES LAW (Dan 9/29): Dad's own pickups/drop-offs ("Pick up Hayes + Theo…",
     "Drop Hayes at Maria's…") are Dad logistics, never a kid's activity. Treat as
     leave → Dad strip / dan box only; kid glass shows the kid's own practice event. */
  if (/^(Pick\s*up|Drop)\b/i.test(summary) && !/SRE (drop|pickup)/i.test(summary)) {
    return { kind: "leave", summary, busy: !isFree(ev), ride: true };
  }
  if (/SRE drop-off|SRE drop\b/i.test(summary)) return { kind: "school_drop", summary };
  if (/SRE pickup/i.test(summary)) return { kind: "school_pickup", summary };
  if (/Homework Help/i.test(summary)) return { kind: "school", summary, kid: "ainsley" };
  if (/hearing\/vision|Hearing\/Vision|PE \(tennis|field trip|yearbook/i.test(summary)) {
    return { kind: "school", summary };
  }
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
  if (/^Ainsley\b.*\bappointment\b/i.test(summary)) {
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
    if (/Large Item|garage-sale|HOA|cleaners|Dr Ramirez|KS DL|tree-trim|Johnson gift/i.test(summary)) {
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
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw.events)) return raw.events;
  if (raw.result && Array.isArray(raw.result.events)) return raw.result.events;
  die("events file has no events[]: " + filePath);
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
  // kids-safe: drop Mom order IDs / adult refund chatter from leave titles on kid glass
  if (kind === "leave") {
    s = s.replace(/\(Mom[^)]*\)/gi, "").replace(/WK\d+/gi, "").trim();
  }
  // Drop trailing "· 3:00" / "· 5:00 practice" clock echo when strip already shows time
  s = s.replace(/\s*·\s*\d{1,2}:\d{2}(\s*(am|pm|a|p|practice|game))?\s*$/i, "").trim();
  s = s.replace(/\s*·\s*leave\s+\d{1,2}:\d{2}.*$/i, "").trim();
  return s;
}

function buildBoardItems(events, now) {
  const items = [];
  for (const ev of events) {
    if (ev.status === "cancelled" || ev.status === "canceled") continue;
    /* CANCELGONE1 · title marked canceled = gone from board */
    if (/^\s*[\[(]?\s*(cancel+ed|cxl)\b/i.test(String(ev.summary || ""))) continue;
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
    });
  }
  items.sort((a, b) => a.start - b.start);
  return items;
}

function stillRelevant(item, now) {
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
    .filter((it) => it.start.getTime() + leadMs >= now.getTime()) // future / just-started only
    .slice()
    .sort((a, b) => {
      const dt = a.start - b.start;
      if (dt !== 0) return dt;
      return stripPriority(a) - stripPriority(b);
    });

  const queue = upcoming.slice(0, 12).map((it) => {
    const time = fmtTimeShort(it.start);
    let place;
    if (it.kind === "leave") place = kidsSafeWhat(it.raw, "leave");
    else if (it.kind === "school_pickup") place = "Boys SRE pickup";
    else if (it.kind === "school_drop") place = "Boys SRE drop";
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
    };
  });

  return queue;
}

function detailFor(it, homeWeek, upcoming) {
  const bits = [];
  const through = homeWeek && homeWeek.through
    ? `kids with Dad @ <strong>147th</strong> through ${homeWeek.through}`
    : "kids with Dad @ <strong>147th</strong>";
  // Add a couple of later same-day anchors
  const sameDay = upcoming.filter(
    (x) => partsInTZ(x.start).iso === partsInTZ(it.start).iso && x.id !== it.id
  ).slice(0, 2);
  for (const x of sameDay) {
    if (x.kind === "sport") bits.push(`${fmtTime(x.start)} ${kidsSafeWhat(x.raw, "sport").split("·")[0].trim()}`);
    else if (x.kind === "leave") bits.push(`${fmtTime(x.start)} leave`);
    else if (x.kind === "school_pickup") bits.push(`${fmtTime(x.start)} boys pickup`);
  }
  const extra = bits.length ? bits.join(" · ") + " · " : "";
  return `${extra}${through}`;
}

function custodyFromItems(items, now) {
  const custody = items.filter((it) => it.kind === "custody");
  // Active span: start <= now < end
  let active = custody.find((it) => it.start <= now && now < it.end);
  if (!active) {
    // Next upcoming or last that ended
    active = custody.find((it) => it.end > now) || custody[custody.length - 1];
  }
  if (!active) {
    return {
      with: "Dad",
      place: "147th",
      through: "—",
      throughLabel: "with Dad @ 147th",
    };
  }
  const endP = partsInTZ(active.end);
  const startP = partsInTZ(active.start);
  const through = `${endP.weekday} ${endP.month} ${endP.day} · ${fmtTime(active.end)}`;
  return {
    with: "Dad",
    place: "147th",
    through,
    throughLabel: `with Dad @ 147th · ${startP.weekday} ${startP.month} ${startP.day} ${fmtTime(active.start)} → ${through}`,
    endIso: active.endIso,
  };
}

function rowWhen(it, now) {
  const same = partsInTZ(it.start).iso === partsInTZ(now).iso;
  const day = same ? partsInTZ(now).weekday.slice(0, 3) : fmtDayLabel(it.start);
  return `${day} · ${fmtTime(it.start)}`;
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
      (kidId === "hayes" && (it.kid === "hayes" || kids.hayes || it.kind === "school_drop" || it.kind === "school_pickup")) ||
      (kidId === "harris" && (it.kid === "harris" || kids.harris || it.kind === "school_drop" || it.kind === "school_pickup"));
    if (!mine && it.kind !== "custody") continue;
    if (it.kind === "custody") continue;
    if (isAdminNoise(it.raw)) continue;
    let what = kidsSafeWhat(it.raw, it.kind);
    let tone = "act";
    let kind = "event";
    if (it.kind === "sport") { tone = "hot"; what = (kidId === "hayes" && /baseball/i.test(it.raw) ? "⚾ " : kidId === "harris" && /flag/i.test(it.raw) ? "🏁 " : kidId === "ainsley" && /swim/i.test(it.raw) ? "" : "") + what; }
    if (it.kind === "appointment") tone = "hot";
    if (it.kind === "leave") continue; // leaves are Dad strip / dan box, not kid glass
    rows.push({
      kind,
      when: rowWhen(it, now),
      what,
      hint: it.kind === "sport" ? "YOUR board" : "",
      tone,
    });
  }
  rows.push({
    kind: "note",
    when: "All day",
    what: kidId === "ainsley" ? "Base @ 147th with Dad" : kidId === "hayes" ? "🏡 DROP ZONE HQ with Dad" : "🏡 YOUR BASE with Dad",
    hint: `through ${homeWeek.through}`,
    tone: "hot",
  });
  return rows.slice(0, 6);
}

function buildKidSports(kidId, items, now) {
  const out = [];
  for (const it of items) {
    if (it.kind !== "sport") continue;
    if (!stillRelevant(it, now)) continue;
    if (it.kid && it.kid !== kidId) continue;
    const kids = kidMentions(it.raw);
    if (it.kid !== kidId && !(kids[kidId])) continue;
    const leaveHint = `leave ${fmtTime(it.start)}`;
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
      ((it.kind === "school_drop" || it.kind === "school_pickup") && (kidId === "hayes" || kidId === "harris"));
    if (!mine) continue;
    if (kidId === "ainsley" && (it.kind === "school_drop" || it.kind === "school_pickup")) continue;
    out.push({
      when: `${fmtDayLabel(it.start)} · ${fmtTime(it.start)}`,
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
      when: `${fmtDayLabel(it.start)} · ${fmtTime(it.start)}`,
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
    if (it.kind === "leave" || it.kind === "dad" || it.kind === "custody") return false;
    if (it.kid === kidId) return true;
    const kids = kidMentions(it.raw);
    if (kids[kidId]) return true;
    if ((it.kind === "school_drop" || it.kind === "school_pickup") && (kidId === "hayes" || kidId === "harris")) return true;
    return false;
  });
  const hit = mine.sort((a, b) => a.start - b.start || stripPriority(a) - stripPriority(b))[0];
  if (!hit) {
    return {
      when: `${partsInTZ(now).weekday.toUpperCase()} · base @ 147th`,
      what: "YOUR BASE WITH DAD",
      where: `through ${homeWeek.through}`,
      badges: ["DAD WEEK", "147th"],
    };
  }
  return {
    when: `${fmtDowShort(hit.start).toUpperCase()} · ${fmtTime(hit.start)}`,
    what: kidsSafeWhat(hit.raw, hit.kind).toUpperCase().slice(0, 48),
    where: `with Dad @ 147th · through ${homeWeek.through}`,
    badges: [fmtDowShort(hit.start).toUpperCase(), fmtTime(hit.start)],
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
    const when = `${partsInTZ(now).weekday.slice(0, 3)} · ${fmtTime(it.start)}`;
    const what = kidsSafeWhat(it.raw, it.kind);
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
    what: `Kids with Dad @ 147th through ${homeWeek.through}`,
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
    const when = `${fmtDayLabel(it.start)} · ${fmtTime(it.start)}`;
    const what = kidsSafeWhat(it.raw, it.kind);
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
    when: `through ${homeWeek.through}`,
    what: "Kids with Dad @ 147th",
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

function writeWeekTree(weekPath, weekObj, kidsDataPath, dryRun) {
  const dataTwin = path.join(path.dirname(weekPath), "data", "kids-week.json");
  const text = JSON.stringify(weekObj, null, 2) + "\n";
  if (dryRun) {
    console.log("dry-run: would write", weekPath);
    console.log("dry-run: would write", dataTwin);
    console.log("dry-run: would rebuild EMBEDDED in", kidsDataPath);
    return;
  }
  fs.mkdirSync(path.dirname(dataTwin), { recursive: true });
  fs.writeFileSync(weekPath, text);
  fs.writeFileSync(dataTwin, text);
  const embedded = rebuildEmbed(kidsDataPath, weekObj);
  fs.writeFileSync(kidsDataPath, embedded);
}

function mirrorToBoardOs(mirrorDir, weekObj, dryRun) {
  if (!mirrorDir || !fs.existsSync(mirrorDir)) {
    console.log("calendar-refresh: mirror skip (no dir)", mirrorDir);
    return;
  }
  const weekPath = path.join(mirrorDir, "kids-week.json");
  const dataTwin = path.join(mirrorDir, "data", "kids-week.json");
  const kidsDataPath = path.join(mirrorDir, "kids-data.js");
  const stripPath = path.join(mirrorDir, "house-board-strip.js");
  const text = JSON.stringify(weekObj, null, 2) + "\n";
  if (dryRun) {
    console.log("dry-run: mirror", weekPath);
    return;
  }
  fs.mkdirSync(path.dirname(dataTwin), { recursive: true });
  fs.writeFileSync(weekPath, text);
  fs.writeFileSync(dataTwin, text);
  if (fs.existsSync(kidsDataPath)) {
    fs.writeFileSync(kidsDataPath, rebuildEmbed(kidsDataPath, weekObj));
  }
  // mirror strip js from repo
  const repoStrip = path.join(ROOT, "house-board-strip.js");
  if (fs.existsSync(repoStrip)) fs.copyFileSync(repoStrip, stripPath);
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
  const items = buildBoardItems(events, now);
  const homeWeek = custodyFromItems(items, now);
  const queue = pickStripQueue(items, now, homeWeek);
  const head = queue[0] || {
    label: "Next up · today",
    time: "",
    place: "House day @ 147th",
    detailHtml: `kids with Dad @ <strong>147th</strong> through ${homeWeek.through}`,
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
    sourceCalendar: "dmward23@gmail.com",
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
  next.kids.dan = {
    ...danKept,
    hottest: {
      when: `${nowP.asOf} · kids with you @ 147th`,
      what: "Dad week live",
      where: `through ${homeWeek.through}`,
      badges: ["Dad week", "147th"],
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
    // HARDEN 2026-09-28: data-only push. NEVER house-face-deploy.sh (full
    // board-os copy stomped HEAT/CONSUME HTML/CSS + sensi/nest on cal refresh).
    const allow = [
      "kids-week.json",
      "data/kids-week.json",
      "data/cal-live.json",
      "kids-data.js",
    ];
    // Mirror DATA only into board-os (no HTML/CSS/sensi/nest)
    if (args.mirrorDir && fs.existsSync(args.mirrorDir)) {
      for (const f of ["kids-week.json", "kids-data.js"]) {
        const s = path.join(ROOT, f);
        const d = path.join(args.mirrorDir, f);
        if (fs.existsSync(s)) fs.copyFileSync(s, d);
      }
      fs.mkdirSync(path.join(args.mirrorDir, "data"), { recursive: true });
      for (const f of ["kids-week.json", "cal-live.json"]) {
        const s = path.join(ROOT, "data", f);
        const d = path.join(args.mirrorDir, "data", f);
        if (fs.existsSync(s)) fs.copyFileSync(s, d);
      }
    }
    const note = args.deployNote.includes("calendar")
      ? args.deployNote
      : `calendar refresh ${next.asOfIso} CT · ${args.deployNote}`;
    const addArgs = ["add", "--", ...allow.filter((f) => fs.existsSync(path.join(ROOT, f)))];
    let r = spawnSync("git", addArgs, { cwd: ROOT, stdio: "inherit" });
    if (r.status !== 0) die("git add failed exit " + r.status, r.status || 5);
    // Refuse anything outside allowlist
    const staged = spawnSync("git", ["diff", "--cached", "--name-only"], {
      cwd: ROOT,
      encoding: "utf8",
    });
    const allowSet = new Set(allow);
    const bad = (staged.stdout || "").split("\n").map((s) => s.trim()).filter((s) => s && !allowSet.has(s));
    if (bad.length) {
      spawnSync("git", ["reset", "HEAD", "--", "."], { cwd: ROOT });
      die("refusing to stage non-data files in calendar --deploy: " + bad.join(", "), 7);
    }
    const dirty = spawnSync("git", ["diff", "--cached", "--quiet"], { cwd: ROOT });
    if (dirty.status === 0) {
      console.log("calendar-refresh: CLEAN · no data changes to push");
      return;
    }
    const msg = `House Face · ${note} · data-only`;
    r = spawnSync(
      "git",
      ["-c", "user.email=dmward23@gmail.com", "-c", "user.name=dmward23-web", "commit", "-m", msg],
      { cwd: ROOT, stdio: "inherit" }
    );
    if (r.status !== 0) die("git commit failed exit " + r.status, r.status || 5);
    r = spawnSync("git", ["push", "origin", "main"], { cwd: ROOT, stdio: "inherit" });
    if (r.status !== 0) die("git push failed exit " + r.status, r.status || 5);
    console.log("calendar-refresh: PUSHED data-only · protected HTML/CSS/sensi/nest untouched");
  }
}

main();
