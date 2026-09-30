#!/usr/bin/env node
/**
 * WardOS House Face · calendar → cal-live.json (forever refresh kit)
 *
 * Ingests a Google Calendar–shaped events dump (MCP list_events ok) and writes
 * data/cal-live.json. Optionally patches kids-week.json (root + data/) so
 * boardStrip / dan.today / dan.week track the calendar clock.
 *
 * Law: EVERY create/update/delete on dmward23 must re-run this path onto glass.
 * Past/done (end < now) DROP. Next Up = first future event by start.
 * No Wright cron — Atlas owns standing refresh / on-arrival pull (see CAL-LIVE.md).
 *
 * Usage:
 *   node scripts/cal-from-events.mjs --events <dump.json> [--out data/cal-live.json] [--patch-week kids-week.json]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const TZ = "America/Chicago";

function parseArgs(argv) {
  const out = {
    eventsPath: null,
    outPath: path.join(ROOT, "data", "cal-live.json"),
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
          : path.join(ROOT, "kids-week.json");
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
  return { meta: data, events };
}

function normalizeDateField(v) {
  if (!v) return null;
  const s = String(v);
  /* True all-day YYYY-MM-DD */
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T00:00:00-05:00`);
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

function startIsoLocal(e) {
  if (e.start?.dateTime) return e.start.dateTime;
  if (e.start?.date) {
    const s = String(e.start.date);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s}T00:00:00-05:00`;
    return s; /* already datetime-shaped */
  }
  return null;
}

function endIsoLocal(e) {
  if (e.end?.dateTime) return e.end.dateTime;
  if (e.end?.date) {
    const s = String(e.end.date);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s}T00:00:00-05:00`;
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
    startMs: start ? start.getTime() : 0,
    endMs: end ? end.getTime() : 0,
  };
}

function shortPlace(summary) {
  let s = String(summary || "").trim();
  s = s.replace(/^Leave\s*[·•\-–—]\s*/i, "");
  /* Kid-safe: no Mom custody / handoff framing on glass strip */
  s = s.replace(/\(\s*Mom[^)]*\)/gi, "");
  s = s.replace(/\bMom\b[^·]*/gi, "");
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

function writeJson(outPath, payload) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const tmp = outPath + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(payload, null, 2) + "\n");
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
  const through = homeWeekThrough || "Fri Oct 2 · 3:00";
  rows.push({
    when: "home week",
    what: `Kids with Dad @ 147th through ${through}`,
    tone: "hot",
  });
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
    /* Insert before first Wed 30 row so 9:00 sits ahead of 12:40 therapy */
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
  const week = JSON.parse(raw);
  const todayIso = cal.asOfIso;
  const nowMs = Date.now();

  week.asOf = chicagoLong();
  week.asOfIso = todayIso;
  week.boardStrip = cal.boardStrip;
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
  /* Dedupe week display twins (Harris+Hayes PE → one SRE PE card) */
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
              what: "Base @ 147th with Dad",
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

  const text = JSON.stringify(week);
  fs.writeFileSync(weekPath, text + "\n");

  /* Keep data/kids-week.json identical */
  const dataCopy = path.join(ROOT, "data", "kids-week.json");
  if (path.resolve(weekPath) !== path.resolve(dataCopy)) {
    fs.mkdirSync(path.dirname(dataCopy), { recursive: true });
    fs.writeFileSync(dataCopy, text + "\n");
  }
  /* If patch target was data/, also sync root */
  const rootCopy = path.join(ROOT, "kids-week.json");
  if (path.resolve(weekPath) !== path.resolve(rootCopy)) {
    fs.writeFileSync(rootCopy, text + "\n");
  }

  return week;
}

function syncEmbedded(weekObj) {
  const kidsDataPath = path.join(ROOT, "kids-data.js");
  let src = fs.readFileSync(kidsDataPath, "utf8");
  const json = JSON.stringify(weekObj);
  const re = /var EMBEDDED = \{[\s\S]*?\};/;
  if (!re.test(src)) {
    console.error("WARN: EMBEDDED block not found in kids-data.js — skip sync");
    return false;
  }
  src = src.replace(re, `var EMBEDDED = ${json};`);
  fs.writeFileSync(kidsDataPath, src);
  return true;
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.eventsPath) {
    console.log(`Usage: node scripts/cal-from-events.mjs --events <dump.json> [--out data/cal-live.json] [--patch-week [kids-week.json]]`);
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
  /* PINSPEC1 2026-09-30 (Dan): today's SRE specials stay on the main board's
     today list (published as all-day so they sort to the top) until drop-off
     is done at 8:40 CT; the 10-min refresh drops them after that. */
  const ctMin = (() => {
    const b = {};
    for (const p of new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "numeric", minute: "2-digit", hourCycle: "h23" }).formatToParts(now)) b[p.type] = p.value;
    return Number(b.hour) * 60 + Number(b.minute);
  })();
  const isPinnedSpecial = (e) =>
    /SRE specials?/i.test(e.summary || "") && !/No Specials/i.test(e.summary || "") &&
    String(e.start || "").slice(0, 10) === todayIso && ctMin < 8 * 60 + 40 && e.startMs <= now.getTime();
  const upcoming = slimAll
    .filter((e) => e.startMs > now.getTime() || isPinnedSpecial(e))
    .map((e) => (isPinnedSpecial(e) ? { ...e, allDay: true, start: todayIso, end: todayIso, pinnedUntil: "8:40" } : e))
    .filter((e) => !/^GET\s*·/i.test(e.summary || "") && !/^Atlas:/i.test(e.summary || ""))
    .filter((e) => !isSoft(e))
    .sort((a, b) => a.startMs - b.startMs);

  /* nextLeave field = Next Up hero = first future event (Busy preferred only as tie-break same start) */
  const heroPool = upcoming.filter((e) => !e.pinnedUntil);
  let next = heroPool[0] || null;
  if (heroPool.length >= 2 && heroPool[0].startMs === heroPool[1].startMs) {
    const busy = heroPool.find((e) => e.busy && e.startMs === heroPool[0].startMs);
    if (busy) next = busy;
  }

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

  writeJson(args.outPath, cal);
  console.log(
    `cal-live → ${args.outPath} · status=${cal.status} · upcoming=${publicUpcoming.length} · next=${publicNext ? publicNext.summary : "(none)"}`
  );

  if (args.patchWeek) {
    const week = patchKidsWeek(args.patchWeek, cal, upcoming, slimAll);
    const ok = syncEmbedded(week);
    console.log(
      `patched kids-week asOfIso=${week.asOfIso} · EMBEDDED ${ok ? "synced" : "SKIPPED"} · HD in week=${JSON.stringify(week.kids.dan.week).includes("HD #2209")}`
    );
  }
}

main();
