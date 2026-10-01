/* ATLASLANE4 · scripts/house/kid-layer-lib.mjs · Kid layer v3 rules (pure, no DOM, no server). NOT WIRED.
   Reuses the existing chore tap shapes:
     daily musts  -> key "house-checkoffs:<kid>:<YYYY-MM-DD>"      value {<checkId>: true|false}
     weekly musts -> key "house-checkoffs:<kid>:week:<FriISO>"     value {<checkId>: true|false}
   (house-checkoffs.js / kids-data.js checkKeyFor). The hub store (lights-write-proxy /api/taps, TAPSYNC1)
   holds the same keys as {<checkId>: {v, t}}. Both shapes are accepted.
   Chore week = kids-data.js weekStartIso: Fri 3:00 PM -> next Fri 3:00 PM, tap days Sat..Fri (7).
   Week closed = MUSTGATE1 (kids-data.js mustSetComplete): every daily must tapped on all 7 tap days AND every
   weekly must tapped in that week's key. Optional / add-on quests never count.
   Public output never carries money, kid-reward, or rank words, never a name next to a miss, no stats. */
import { KIDS, ctParts, ctDate, ctWallMs, addDays, ctIso, kidsIn, kidsHomeAt, kidsHomeSpans, asCalendar,
  publicText, sentence, scanObject, PICKUP_EXCLUDE_RE, bannedHits } from "./lib.mjs";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const dowOf = (iso) => ctParts(ctWallMs(iso, 12, 0)).wd;
const NAME = Object.fromEntries(KIDS.map((k) => [k.id, k.name]));

/** kids-data.js weekStartIso, evaluated at instant t (Fri before 3:00 PM = still last week's leave morning). */
export function choreWeek(t, handoff = { hh: 15, mm: 0 }) {
  const p = ctParts(t);
  const sinceFri = (DOW.indexOf(p.wd) - 5 + 7) % 7;
  let fri = addDays(p.iso, -sinceFri);
  if (sinceFri === 0 && p.minutes < handoff.hh * 60 + handoff.mm) fri = addDays(fri, -7);
  const tapDays = Array.from({ length: 7 }, (_, i) => addDays(fri, i + 1));
  return { id: fri, startsAt: ctWallMs(fri, handoff.hh, handoff.mm), endsAt: ctWallMs(addDays(fri, 7), handoff.hh, handoff.mm), tapDays };
}

/** Normalize either tap shape into {key: Set(doneIds)}. */
export function normalizeTaps(src) {
  const out = {};
  const root = src && src.taps && typeof src.taps === "object" ? src.taps : src || {};
  for (const [key, val] of Object.entries(root)) {
    if (!/^house-checkoffs:(hayes|harris|ainsley):(week:)?\d{4}-\d{2}-\d{2}$/.test(key) || !val || typeof val !== "object") continue;
    const set = new Set();
    for (const [id, v] of Object.entries(val)) {
      const on = v && typeof v === "object" ? v.v === true : v === true;
      if (on) set.add(id);
    }
    out[key] = set;
  }
  return out;
}
const tapped = (taps, kid, id, iso) => !!(taps[`house-checkoffs:${kid}:${iso}`] && taps[`house-checkoffs:${kid}:${iso}`].has(id));
const tappedWeek = (taps, kid, id, fri) => !!(taps[`house-checkoffs:${kid}:week:${fri}`] && taps[`house-checkoffs:${kid}:week:${fri}`].has(id));

/** MUSTS = non-optional, non-addon quests (kids-data.js mustQuests). */
export function mustsFor(kidsWeek, kid) {
  const k = kidsWeek && kidsWeek.kids && kidsWeek.kids[kid];
  return (k && Array.isArray(k.quests) ? k.quests : []).filter((q) => !q.optional && q.cadence !== "addon")
    .map((q) => ({ id: q.id, cadence: q.cadence === "weekly" ? "weekly" : "daily" }));
}
export function dayClosed(musts, taps, kid, iso) {
  const daily = musts.filter((m) => m.cadence === "daily");
  return daily.length > 0 && daily.every((m) => tapped(taps, kid, m.id, iso));
}
export function weekClosed(musts, taps, kid, week) {
  if (!musts.length) return false;
  return musts.every((m) => (m.cadence === "daily"
    ? week.tapDays.every((d) => tapped(taps, kid, m.id, d))
    : tappedWeek(taps, kid, m.id, week.id)));
}

/** Harris: one mission at a time = first open must today (daily in order, then open weekly). */
export function harrisMission(musts, taps, week, today, config) {
  const order = (config && config.harrisMissionOrder) || musts.map((m) => m.id);
  const byId = Object.fromEntries(musts.map((m) => [m.id, m]));
  for (const id of order) {
    const m = byId[id]; if (!m) continue;
    const done = m.cadence === "daily" ? tapped(taps, "harris", id, today) : tappedWeek(taps, "harris", id, week.id);
    if (!done) {
      const word = (config && config.missionWords && config.missionWords[id]) || null;
      if (!word) continue; /* no approved wall word -> never invent copy */
      return { id, word, copy: `Harris. ${word}.` };
    }
  }
  return null;
}

/** Hayes: Mon–Sun row for the calendar week holding today. mark = closed | empty | ahead | off. No counts. */
export function hayesRow(musts, taps, spans, today, t) {
  const sinceMon = (DOW.indexOf(dowOf(today)) + 6) % 7;
  const mon = addDays(today, -sinceMon);
  return Array.from({ length: 7 }, (_, i) => {
    const iso = addDays(mon, i);
    const home = kidsHomeAt(spans, ctWallMs(iso, 12, 0)); /* Fri leave morning counts; Fri arrival day doesn't */
    let mark;
    if (dayClosed(musts, taps, "hayes", iso)) mark = "closed";
    else if (iso > today) mark = home ? "ahead" : "off";
    else if (!home) mark = "off";
    else mark = iso === today ? "ahead" : "empty"; /* today still open = ahead, never a miss */
    return { dow: DOW[(i + 1) % 7], date: iso, mark, today: iso === today };
  });
}

/** Hayes: next real game in the calendar (no stats). */
export function hayesCountdown(events, t, config) {
  const c = (config && config.hayesCountdown) || {};
  const sport = new RegExp(c.match || "\\b(baseball|flag)\\b", "i");
  const maxDays = c.maxDays || 14;
  for (const e of events) {
    if (e.cancelled || e.allDay || e.startMs <= t) continue;
    const who = kidsIn(e.summary).map((k) => k.id);
    if (!who.includes("hayes")) continue;
    if (!sport.test(e.summary) || PICKUP_EXCLUDE_RE.test(e.summary) || bannedHits(e.summary).length) continue;
    if (/\bpractice\b/i.test(e.summary) && c.gameOnly !== false) continue;
    const today = ctDate(t), day = ctDate(e.startMs);
    const inDays = Math.round((ctWallMs(day, 12, 0) - ctWallMs(today, 12, 0)) / 86400000);
    if (inDays > maxDays) return null;
    const sp = sentence(sport.exec(e.summary)[1].toLowerCase());
    const vs = /\bvs\.?\s+([^·(|]+?)(?:\s*\(|\s*·|$)/i.exec(e.summary);
    const gm = /\bgame\s+(\d{1,2}):(\d{2})\b|\b(\d{1,2}):(\d{2})\s+game\b/i.exec(e.summary); /* "game 9:00" | "5:30 game" */
    let gameMs = e.startMs;
    if (gm) { const hh = gm[1] || gm[3], mi = gm[2] || gm[4]; const h = Number(hh) % 12; const cands = [ctWallMs(day, h, Number(mi)), ctWallMs(day, h + 12, Number(mi))]; gameMs = cands.sort((a, b) => Math.abs(a - e.startMs) - Math.abs(b - e.startMs))[0]; }
    const what = publicText(`${sp}${vs ? " · vs " + vs[1].trim() : ""}`);
    const when = inDays === 0 ? "Today" : inDays === 1 ? "Tomorrow" : `${inDays} days`;
    const out = { what, startIso: ctIso(gameMs), day: ctParts(gameMs).wd, inDays, copy: `${what} · ${when}` };
    return scanObject(out).length ? null : out;
  }
  return null;
}

/** Spends: [{unlock, weekId, usedAt, choice?}] (per-device wall tap today; shape only). */
export function spentThisWeek(uses, unlockId, week) {
  return ((uses && uses.uses) || []).some((u) => u && u.unlock === unlockId && u.weekId === week.id);
}

export function computeKidLayer({ calendar, kidsWeek, taps, uses, config, now }) {
  const t = now == null ? Date.now() : now;
  const cal = asCalendar(calendar);
  const spans = kidsHomeSpans(cal.events);
  const tp = normalizeTaps(taps);
  const week = choreWeek(t);
  const today = ctDate(t);
  const home = cal.hasKidsHome ? kidsHomeAt(spans, t) : true;
  const musts = Object.fromEntries(KIDS.map((k) => [k.id, mustsFor(kidsWeek, k.id)]));
  const closed = Object.fromEntries(KIDS.map((k) => [k.id, weekClosed(musts[k.id], tp, k.id, week)]));
  const weekOut = { id: week.id, startsAt: ctIso(week.startsAt), endsAt: ctIso(week.endsAt) };
  const base = { asOfIso: today, generatedAt: ctIso(t), week: weekOut };

  /* kid-seats.json */
  const seats = {
    harris: { name: "Harris", week: { closed: closed.harris } },
    hayes: { name: "Hayes", week: { closed: closed.hayes } },
    ainsley: { name: "Ainsley", week: { closed: closed.ainsley } },
  };
  if (home) {
    const mission = harrisMission(musts.harris, tp, week, today, config);
    seats.harris.mission = mission;
    seats.harris.today = { closed: dayClosed(musts.harris, tp, "harris", today) };
    seats.harris.copy = mission ? mission.copy : (seats.harris.today.closed ? "Harris. Done today." : null);
    seats.hayes.row = hayesRow(musts.hayes, tp, spans, today, t);
    seats.hayes.countdown = hayesCountdown(cal.events, t, config);
  }
  for (const k of KIDS) if (closed[k.id]) {
    seats[k.id].copy = k.id === "harris" ? "Harris. Week closed." : k.id === "hayes" ? "Hayes. Week closed. You pick." : "Ainsley. Week closed.";
  }
  const allClosed = KIDS.every((k) => closed[k.id]);
  const kidSeats = { ...base, quiet: !home, seats, usTogether: { lit: allClosed } };

  /* unlocks.json: only LIT unlocks are listed. Dark or spent = absent (never a name next to a miss). */
  const U = (config && config.unlocks) || {};
  const lit = [];
  const open = t < week.endsAt;
  for (const k of KIDS) {
    const u = U[k.id];
    if (!u || !closed[k.id] || !open || spentThisWeek(uses, u.id, week)) continue;
    lit.push({ id: u.id, seat: NAME[k.id], control: u.control, tile: u.tile, ...(u.choices ? { choices: u.choices } : {}), uses: 1, copy: u.copy });
  }
  if (allClosed && U.house && open && !spentThisWeek(uses, U.house.id, week)) {
    lit.push({ id: U.house.id, seat: "House", control: U.house.control, tile: U.house.tile, uses: 1, copy: U.house.copy });
  }
  const unlocks = { ...base, resetsAt: weekOut.endsAt, lit };

  for (const [n, o] of [["kid-seats", kidSeats], ["unlocks", unlocks]]) {
    const hits = scanObject(o).concat(missNameHits(o));
    if (hits.length) throw new Error(`${n} failed kid-layer scan: ${JSON.stringify(hits)}`);
  }
  return { kidSeats, unlocks };
}

/** A wall tap spends a lit unlock: returns the new uses state (caller persists). Not lit -> unchanged. */
export function consumeUnlock(usesState, unlockId, layer, t, choice) {
  const state = { uses: [...(((usesState && usesState.uses) || []))] };
  const u = layer.unlocks.lit.find((x) => x.id === unlockId);
  if (!u) return state;
  if (u.choices && !u.choices.includes(choice)) return state;
  state.uses.push({ unlock: unlockId, weekId: layer.unlocks.week.id, usedAt: ctIso(t), ...(choice ? { choice } : {}) });
  return state;
}

/** Any object in a miss / dark / empty state must not carry a kid name. Also no miss words anywhere. */
const MISS_WORD_RE = /\b(miss(?:ed|es|ing)?|fail(?:ed|s|ing)?|broke|broken|behind|late|incomplete|not done|x)\b/i;
export function missNameHits(obj) {
  const hits = [];
  const names = KIDS.map((k) => k.name);
  const isMiss = (o) => o && typeof o === "object" && !Array.isArray(o) &&
    (o.closed === false || o.lit === false || o.mark === "empty" || o.state === "dark" || o.state === "spent");
  const walk = (v, p) => {
    if (typeof v === "string") { if (MISS_WORD_RE.test(v)) hits.push({ path: p, hit: "miss-word", text: v }); return; }
    if (Array.isArray(v)) return v.forEach((x, i) => walk(x, `${p}[${i}]`));
    if (v && typeof v === "object") {
      if (isMiss(v)) {
        const s = JSON.stringify(v);
        for (const n of names) if (new RegExp(`\\b${n}\\b`, "i").test(s)) hits.push({ path: p, hit: "name-in-miss", text: n });
      }
      for (const k of Object.keys(v)) walk(v[k], `${p}.${k}`);
    }
  };
  walk(obj, "$");
  return hits;
}
