/* ATLASLANE8 · scripts/house/kid-layer-lib.mjs · House Face chore law, Atlas data side (pure, no DOM, no server). NOT WIRED.
   Law: Dan, locked Thu Oct 1 2026 8:01 PM CT (plates/2026-10-01/redesign/CHORE-LAW-2026-10-01.md). It replaces every older
   chore-chart rule; this file and config/kid-layer.config.json are the only copy in Atlas's lane.
   Taps reuse the existing hub keys (the hub /api/taps accepts only these), with law ids:
     house-checkoffs:<kid>:<YYYY-MM-DD>       {must-bed|must-hamper|must-dish|must-floor|must-dragon, close, choice-claim, choice-done}
     house-checkoffs:<kid>:week:<SunISO>      {pack-dragon|pack-bag|pack-charger}
   Values: true (local export) or {v, t} (hub). t (epoch ms) decides first claim, the CLOSE window, and repairs.
   A repair = a tap on the MISSED day's key made later, before Saturday fun of that week. Old chart ids are not read.
   Not here (other lanes): the savings tile (Ledger), the dinner vote (Vita), dispute photos (Prism). Never money, never a leaderboard,
   never a consequence on a miss. */
import { KIDS, ctParts, ctDate, ctWallMs, addDays, ctIso, kidsIn, kidsHomeAt, kidsHomeSpans, asCalendar,
  publicText, sentence, scanObject, PICKUP_EXCLUDE_RE, bannedHits, parseHM } from "./lib.mjs";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const ORDER = ["harris", "hayes", "ainsley"]; /* fixed output order: never sorted by how anyone did */
const NAME = Object.fromEntries(KIDS.map((k) => [k.id, k.name]));
const dowOf = (iso) => ctParts(ctWallMs(iso, 12, 0)).wd;
const daysBetween = (a, b) => Math.round((ctWallMs(b, 12, 0) - ctWallMs(a, 12, 0)) / 86400000);
const mod = (n, m) => ((n % m) + m) % m;
const hmOf = (s, dflt) => parseHM(s) || parseHM(dflt);
const at = (iso, s, dflt) => { const h = hmOf(s, dflt); return ctWallMs(iso, h.hh, h.mm); };
const minutesOf = (s, dflt) => { const h = hmOf(s, dflt); return h.hh * 60 + h.mm; };

/* ---------- weeks + days ---------- */
/** Law week holding a date: Sunday 12:00 AM -> next Sunday. */
export function lawWeek(iso) {
  const sun = addDays(iso, -DOW.indexOf(dowOf(iso)));
  return { id: sun, startsAt: ctWallMs(sun, 0, 0), endsAt: ctWallMs(addDays(sun, 7), 0, 0), days: Array.from({ length: 7 }, (_, i) => addDays(sun, i)) };
}
/** House day of an instant: before the 3:00 AM reset it is still yesterday. */
export function houseDay(t, config) {
  const p = ctParts(t);
  return p.minutes < minutesOf(config && config.week && config.week.dayResetAt, "03:00") ? addDays(p.iso, -1) : p.iso;
}
const dayEnd = (iso, config) => at(addDays(iso, 1), config.week && config.week.dayResetAt, "03:00");
/** Saturday fun edge for the week holding iso. A Saturday miss has no repair window. */
export function repairDeadline(iso, config) {
  const r = config.repair || {};
  const w = lawWeek(iso);
  return at(addDays(w.id, DOW.indexOf(r.untilDow || "Sat")), r.untilTime, "00:00");
}

/* ---------- taps ---------- */
/** Either tap shape -> {key: Map(id -> t | null)} (null = tapped, no time). Only house-checkoffs keys. */
export function normalizeTaps(src) {
  const out = {};
  const root = src && src.taps && typeof src.taps === "object" ? src.taps : src || {};
  for (const [key, val] of Object.entries(root)) {
    if (!/^house-checkoffs:(hayes|harris|ainsley):(week:)?\d{4}-\d{2}-\d{2}$/.test(key) || !val || typeof val !== "object") continue;
    const m = new Map();
    for (const [id, v] of Object.entries(val)) {
      if (v === true) m.set(id, null);
      else if (v && typeof v === "object" && v.v === true) m.set(id, Number.isFinite(v.t) ? v.t : null);
    }
    out[key] = m;
  }
  return out;
}
const tapOf = (tp, kid, iso, id) => { const m = tp[`house-checkoffs:${kid}:${iso}`]; return m && m.has(id) ? m.get(id) : undefined; };
const weekTapOf = (tp, kid, wid, id) => { const m = tp[`house-checkoffs:${kid}:week:${wid}`]; return m && m.has(id) ? m.get(id) : undefined; };

/* ---------- MUSTS ---------- */
/** Four MUSTS for a kid. Dragon fed replaces Hayes's fourth only while the dragon is in the house. */
export function mustsFor(kid, config) {
  const m = config.musts;
  const d = m.dragon;
  return m.items.map((it) => (d && d.inHouse === true && d.kid === kid && it.id === d.replaces ? d.item : it));
}
/** How one MUST stands for a day: "on-time" | "repaired" | null (open). Binary, no partial credit. */
export function mustState(tp, kid, iso, must, config, now) {
  const t = tapOf(tp, kid, iso, must.id);
  if (t === undefined) return null;
  if (t === null) return "on-time";
  if (now != null && t > now + 5 * 60000) return null;
  if (t < dayEnd(iso, config)) return "on-time";
  return t < repairDeadline(iso, config) ? "repaired" : null; /* after Saturday fun: does not carry */
}
export function dayClosed(tp, kid, iso, config, now) {
  return mustsFor(kid, config).every((m) => mustState(tp, kid, iso, m, config, now) != null);
}

/* ---------- home ---------- */
/** home(iso): a Kids with Dan span covers noon; outside the calendar window (or no span data) = home. */
export function homeDayFn(cal, spans) {
  const w = cal.window;
  return (iso) => (!cal.hasKidsHome || !w || iso < w.from || iso > w.to ? true : kidsHomeAt(spans, ctWallMs(iso, 12, 0)));
}
const homeNightFn = (cal, spans, config) => (iso) => {
  const w = cal.window;
  if (!cal.hasKidsHome || !w || iso < w.from || iso > w.to) return true;
  return kidsHomeAt(spans, at(iso, config.close && config.close.opensAt, "19:30"));
};

/* ---------- rewards by age ---------- */
/** Harris: every closed home day counts; a miss pauses the run, it never resets it. */
export function harrisStreak(tp, today, isHome, config, now, history) {
  const days = history.filter((d) => d <= today && isHome(d));
  const closed = (d) => dayClosed(tp, "harris", d, config, now);
  const prior = days.filter((d) => d < today);
  const last = prior[prior.length - 1];
  const n = days.filter(closed).length;
  return { days: n, paused: n > 0 && !closed(today) && !!last && !closed(last) };
}
/** Hayes: consecutive closed home days back from today (today still open is not a miss). Away days skip. */
export function hayesStreak(tp, today, isHome, config, now, lookback = 120) {
  let n = 0;
  for (let i = 0; i < lookback; i++) {
    const d = addDays(today, -i);
    if (!isHome(d)) continue;
    if (dayClosed(tp, "hayes", d, config, now)) n++;
    else if (i === 0) continue;
    else break;
  }
  return { days: n };
}
/** Captain of the night: rotates nightly through the kids home that night. */
export function captainFor(iso, homeKids, config) {
  const rot = ((config.captain && config.captain.rotation) || ORDER).filter((k) => homeKids.includes(k));
  return rot.length ? rot[mod(daysBetween(config.rotationEpoch, iso), rot.length)] : null;
}
/** Ainsley: jobs closed on her last N home days in a row (ending today if closed, else yesterday) -> no check. */
export function noCheckJobs(tp, today, isHome, config, now) {
  const n = (config.ainsley && config.ainsley.noCheckAfterDays) || 5;
  const run = (must, end) => {
    let c = 0;
    for (let i = 0; i < 120 && c < n; i++) {
      const d = addDays(end, -i);
      if (!isHome(d)) continue;
      if (mustState(tp, "ainsley", d, must, config, now) == null) break;
      c++;
    }
    return c >= n;
  };
  return mustsFor("ainsley", config).filter((m) => run(m, today) || run(m, addDays(today, -1)));
}

/* ---------- CHOICE ---------- */
export function choiceJobFor(iso, config) {
  const jobs = config.choice.jobs;
  return jobs[mod(daysBetween(config.rotationEpoch, iso), jobs.length)];
}
/** Owner = the first claim tap before lockAt (timed taps first by t; untimed ones after, in ORDER). Locked to that kid. */
export function choiceState(tp, iso, homeKids, config, now) {
  const job = choiceJobFor(iso, config);
  const lock = at(iso, config.choice.lockAt, "17:00");
  const claims = ORDER.filter((k) => homeKids.includes(k)).map((k) => ({ kid: k, t: tapOf(tp, k, iso, "choice-claim") }))
    .filter((c) => c.t !== undefined && (c.t === null || c.t < lock))
    .sort((a, b) => (a.t ?? Infinity) - (b.t ?? Infinity));
  const owner = claims.length ? claims[0].kid : null;
  const doneT = owner ? tapOf(tp, owner, iso, "choice-done") : undefined;
  return { date: iso, job: { id: job.id, word: job.word }, lockAt: ctIso(lock), owner, claimedAt: owner && claims[0].t ? ctIso(claims[0].t) : null,
    done: doneT !== undefined, doneT, exception: !owner && now >= lock && homeKids.length > 0 };
}
/** A claim tap: first tap owns it; a sibling can't take a claimed job; no claims after lockAt. Returns {ok, owner, taps}. */
export function claimChoice(tapsState, kid, iso, t, config) {
  const tp = normalizeTaps(tapsState);
  const s = choiceState(tp, iso, ORDER, config, t);
  if (s.owner || t >= at(iso, config.choice.lockAt, "17:00")) return { ok: s.owner === kid, owner: s.owner, taps: tapsState };
  const key = `house-checkoffs:${kid}:${iso}`;
  const next = { ...tapsState, [key]: { ...((tapsState || {})[key] || {}), "choice-claim": { v: true, t } } };
  return { ok: true, owner: kid, taps: next };
}

/* ---------- CLOSE ---------- */
export function closeWindow(iso, config) {
  const c = config.close || {};
  return { opensAt: at(iso, c.opensAt, "19:30"), closesAt: at(iso, c.closesAt, "21:30") };
}
/** A kid's own CLOSE for a night: tapped inside the bedtime window (untimed local taps count). */
export function closeTapped(tp, kid, iso, config) {
  const t = tapOf(tp, kid, iso, "close");
  if (t === undefined) return false;
  if (t === null) return true;
  const w = closeWindow(iso, config);
  return t >= w.opensAt && t <= w.closesAt;
}
/** A close tap from the wall: only that kid's tile, only inside the window. Returns {ok, taps}. */
export function closeTile(tapsState, kid, iso, t, config) {
  const w = closeWindow(iso, config);
  if (!ORDER.includes(kid) || t < w.opensAt || t > w.closesAt) return { ok: false, taps: tapsState };
  const key = `house-checkoffs:${kid}:${iso}`;
  return { ok: true, taps: { ...tapsState, [key]: { ...((tapsState || {})[key] || {}), close: { v: true, t } } } };
}

/* ---------- Us together ---------- */
export function usTogetherFor(tp, wk, isHomeNight, config, now) {
  const u = config.usTogether;
  let available = 0, closes = 0;
  for (const d of wk.days) {
    if (!u.nights.includes(dowOf(d)) || !isHomeNight(d)) continue;
    for (const k of ORDER) {
      available++;
      if (closeTapped(tp, k, d, config) && dayClosed(tp, k, d, config, now)) closes++;
    }
  }
  available = Math.min(available, u.available);
  closes = Math.min(closes, available);
  return { closes, available, unlockAt: u.unlockAt, lit: closes >= u.unlockAt };
}

/* ---------- Caught-it, Week win ---------- */
/** One line about the actual thing a kid did on a day (choice done > repair > all four before school). null if none. */
export function caughtLine(tp, iso, homeKids, config, now) {
  const kids = ORDER.filter((k) => homeKids.includes(k));
  const ch = choiceState(tp, iso, kids, config, now);
  if (ch.owner && ch.done) return { date: iso, kid: ch.owner, line: `${NAME[ch.owner]} ${choiceJobFor(iso, config).did}.` };
  const from = ctWallMs(iso, 0, 0), to = dayEnd(iso, config);
  for (const k of kids) for (let back = 1; back <= 6; back++) {
    const d = addDays(iso, -back);
    if (lawWeek(d).id !== lawWeek(iso).id) break;
    for (const m of mustsFor(k, config)) {
      const t = tapOf(tp, k, d, m.id);
      if (t != null && t >= from && t < to && mustState(tp, k, d, m, config, now) === "repaired") return { date: iso, kid: k, line: `${NAME[k]} went back and ${m.did}.` };
    }
  }
  const school = at(iso, config.choice.schoolAt, "08:00");
  for (const k of kids) {
    const ts = mustsFor(k, config).map((m) => tapOf(tp, k, iso, m.id));
    if (ts.every((t) => typeof t === "number" && t < school)) return { date: iso, kid: k, line: `${NAME[k]} had all four done before school.` };
  }
  return null;
}
/** Week win for a finished law week: rotating name + one real reason, else house held. */
export function weekWinFor(tp, wk, isHome, config, now) {
  const rot = config.weekWin.rotation;
  const kid = rot[mod(Math.round(daysBetween(config.rotationEpoch, wk.id) / 7), rot.length)];
  const days = wk.days.filter(isHome);
  let reason = null;
  if (days.length) {
    for (const d of days) {
      const ch = choiceState(tp, d, ORDER, config, now);
      if (ch.owner === kid && ch.done) { reason = sentence(choiceJobFor(d, config).did) + "."; break; }
    }
    if (!reason) for (const d of days) {
      const m = mustsFor(kid, config).find((x) => mustState(tp, kid, d, x, config, now) === "repaired");
      if (m) { reason = `Went back and ${m.did}.`; break; }
    }
    if (!reason && days.every((d) => dayClosed(tp, kid, d, config, now))) reason = "All MUSTS, every day home.";
  }
  return reason
    ? { weekId: wk.id, name: NAME[kid], reason, houseHeld: false, copy: `Week win: ${NAME[kid]}. ${reason}` }
    : { weekId: wk.id, name: null, reason: null, houseHeld: true, copy: "Week win: house held." };
}

/* ---------- Hayes row + countdown (tile frame, not chore rules) ---------- */
/** Hayes: Mon–Sun row of his MUSTS days. mark = closed | empty | ahead | off. No counts, no names on marks. */
export function hayesRow(tp, spans, today, config, now) {
  const sinceMon = (DOW.indexOf(dowOf(today)) + 6) % 7;
  const mon = addDays(today, -sinceMon);
  return Array.from({ length: 7 }, (_, i) => {
    const iso = addDays(mon, i);
    const home = kidsHomeAt(spans, ctWallMs(iso, 12, 0));
    let mark;
    if (dayClosed(tp, "hayes", iso, config, now)) mark = "closed";
    else if (iso > today) mark = home ? "ahead" : "off";
    else if (!home) mark = "off";
    else mark = iso === today ? "ahead" : "empty";
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
    if (!kidsIn(e.summary).some((k) => k.id === "hayes")) continue;
    if (!sport.test(e.summary) || PICKUP_EXCLUDE_RE.test(e.summary) || bannedHits(e.summary).length) continue;
    if (/\bpractice\b/i.test(e.summary) && c.gameOnly !== false) continue;
    const today = ctDate(t), day = ctDate(e.startMs);
    const inDays = Math.round((ctWallMs(day, 12, 0) - ctWallMs(today, 12, 0)) / 86400000);
    if (inDays > maxDays) return null;
    const sp = sentence(sport.exec(e.summary)[1].toLowerCase());
    const vs = /\bvs\.?\s+([^·(|]+?)(?:\s*\(|\s*·|$)/i.exec(e.summary);
    const gm = /\bgame\s+(\d{1,2}):(\d{2})\b|\b(\d{1,2}):(\d{2})\s+game\b/i.exec(e.summary);
    let gameMs = e.startMs;
    if (gm) { const hh = gm[1] || gm[3], mi = gm[2] || gm[4]; const h = Number(hh) % 12; const cands = [ctWallMs(day, h, Number(mi)), ctWallMs(day, h + 12, Number(mi))]; gameMs = cands.sort((a, b) => Math.abs(a - e.startMs) - Math.abs(b - e.startMs))[0]; }
    const what = publicText(`${sp}${vs ? " · vs " + vs[1].trim() : ""}`);
    const when = inDays === 0 ? "Today" : inDays === 1 ? "Tomorrow" : `${inDays} days`;
    const out = { what, startIso: ctIso(gameMs), day: ctParts(gameMs).wd, inDays, copy: `${what} · ${when}` };
    return scanObject(out).length ? null : out;
  }
  return null;
}

/* ---------- unlock spends (carry until spent, newer replaces, no stacking) ---------- */
export function spent(uses, unlockId, weekId) {
  return ((uses && uses.uses) || []).some((u) => u && u.unlock === unlockId && u.weekId === weekId);
}
/** Every law week the tap data touches, up to the current one. */
export function candidateWeeks(tp, current) {
  const ids = new Set([current.id]);
  for (const key of Object.keys(tp)) {
    const m = /:(week:)?(\d{4}-\d{2}-\d{2})$/.exec(key);
    if (m) ids.add(m[1] ? m[2] : lawWeek(m[2]).id);
  }
  return [...ids].filter((id) => id <= current.id).sort();
}
/** Continuous days from the first tapped day (max 120 back) to today, so a day with no taps at all still counts as open. */
const historyDays = (tp, today) => {
  let first = today;
  for (const key of Object.keys(tp)) { const m = /:(\d{4}-\d{2}-\d{2})$/.exec(key); if (m && !/:week:/.test(key) && m[1] < first) first = m[1]; }
  const n = Math.min(120, daysBetween(first, today));
  return Array.from({ length: n + 1 }, (_, i) => addDays(today, i - n));
};

/* ---------- build ---------- */
export function computeKidLayer({ calendar, taps, uses, config, now }) {
  const t = now == null ? Date.now() : now;
  const cal = asCalendar(calendar);
  const spans = kidsHomeSpans(cal.events);
  const isHome = homeDayFn(cal, spans);
  const isHomeNight = homeNightFn(cal, spans, config);
  const tp = normalizeTaps(taps);
  const today = houseDay(t, config);
  const wk = lawWeek(today);
  const home = cal.hasKidsHome ? kidsHomeAt(spans, t) : true;
  const homeKids = home ? ORDER.slice() : [];
  const weekOut = { id: wk.id, startsAt: ctIso(wk.startsAt), endsAt: ctIso(wk.endsAt) };
  const base = { asOfIso: ctDate(t), generatedAt: ctIso(t), law: "House Face chore law · locked Oct 1 2026", week: weekOut };
  const weekClosed = (k) => { const d = wk.days.filter(isHome); return d.length > 0 && d.every((x) => dayClosed(tp, k, x, config, t)); };
  const mustRows = (k) => mustsFor(k, config).map((m) => ({ id: m.id, word: m.word, closed: mustState(tp, k, today, m, config, t) != null }));
  const usTogether = usTogetherFor(tp, wk, isHomeNight, config, t);
  const minutes = ctParts(t).minutes;
  const cw = config.close || {};

  const seats = Object.fromEntries(ORDER.map((k) => [k, { name: NAME[k], week: { closed: weekClosed(k) } }]));
  let choice = null, close = null, dadSeat = null, pack = null, weekWin = null;
  if (home) {
    const hist = historyDays(tp, today);
    const ch = choiceState(tp, today, homeKids, config, t);
    choice = { date: ch.date, job: ch.job, lockAt: ch.lockAt, claimedBy: ch.owner ? NAME[ch.owner] : null, claimedAt: ch.claimedAt, locked: !!ch.owner,
      done: ch.done, open: !ch.owner && !ch.exception, exception: ch.exception,
      copy: ch.owner ? `${ch.job.word} · ${NAME[ch.owner]}.` : ch.exception ? `${ch.job.word} · Dad Seat.` : `${ch.job.word}. First tap owns it.` };

    const homeTonight = isHomeNight(today) ? homeKids : [];
    const captain = homeTonight.length ? captainFor(today, homeTonight, config) : null;
    const w = closeWindow(today, config);
    close = { date: today, opensAt: ctIso(w.opensAt), closesAt: ctIso(w.closesAt), open: t >= w.opensAt && t <= w.closesAt,
      captain: captain ? NAME[captain] : null, kids: Object.fromEntries(homeTonight.map((k) => [k, { closed: closeTapped(tp, k, today, config) }])),
      copy: captain ? `Close at the wall. Captain tonight: ${NAME[captain]}.` : "Close at the wall." };

    const mystery = (config.mystery && config.mystery.days || [])[mod(Math.round(daysBetween(config.rotationEpoch, wk.id) / 7), (config.mystery.days || [1]).length)];
    const pool = (config.mystery && config.mystery.pool) || [];
    const mysteryToday = mystery && dowOf(today) === mystery && pool.length;
    const mysteryFor = (k) => (!mysteryToday ? undefined : dayClosed(tp, k, today, config, t)
      ? { hidden: false, copy: pool[mod(Math.round(daysBetween(config.rotationEpoch, wk.id) / 7), pool.length)] } : { hidden: true });

    const hm = mustRows("harris");
    const next = hm.find((m) => !m.closed);
    const hs = harrisStreak(tp, today, isHome, config, t, hist);
    Object.assign(seats.harris, { musts: hm, mission: next ? { id: next.id, word: next.word, copy: `Harris. ${next.word}.` } : null,
      today: { closed: !next }, streak: hs, copy: next ? `Harris. ${next.word}.` : "Harris. All four done." });

    const ys = hayesStreak(tp, today, isHome, config, t);
    const cap = captain === "hayes";
    Object.assign(seats.hayes, { musts: mustRows("hayes"), today: { closed: dayClosed(tp, "hayes", today, config, t) }, streak: ys, captainTonight: cap,
      row: hayesRow(tp, spans, today, config, t), countdown: hayesCountdown(cal.events, t, config),
      copy: ["Hayes.", ys.days ? `${ys.days} ${ys.days === 1 ? "day" : "days"}.` : null, cap ? "Captain tonight." : null].filter(Boolean).join(" ") });

    const nc = noCheckJobs(tp, today, isHome, config, t);
    const newNc = nc.find((m) => { /* rare: only on the day a job crosses into no check, once per week */
      const y = noCheckJobs(tp, addDays(today, -1), isHome, config, t);
      return !y.some((x) => x.id === m.id);
    });
    const earlierThisWeek = wk.days.filter((d) => d < today).some((d) => {
      const a = noCheckJobs(tp, d, isHome, config, t), b = noCheckJobs(tp, addDays(d, -1), isHome, config, t);
      return a.some((m) => !b.some((x) => x.id === m.id));
    });
    Object.assign(seats.ainsley, { musts: mustRows("ainsley"), today: { closed: dayClosed(tp, "ainsley", today, config, t) },
      trustedWith: config.ainsley.trustedWith.map((x) => x.word).concat(nc.map((m) => `No check · ${m.word}`)),
      line: newNc && !earlierThisWeek ? `Ainsley. ${newNc.word} is yours now. No check.` : null });
    for (const k of ORDER) { const m = mysteryFor(k); if (m) seats[k].mystery = m; }

    /* Dad Seat: open loops only (overnight / morning), the 5 PM choice exception, one Caught-it line shown once. */
    const mode = minutes >= minutesOf(cw.closesAt, "21:30") || minutes < minutesOf(cw.morningAt, "06:00") ? "overnight"
      : minutes < minutesOf(cw.middayAt, "12:00") ? "morning" : "day";
    const loopDay = mode === "day" || minutes >= minutesOf(cw.closesAt, "21:30") ? ctDate(t) : addDays(ctDate(t), -1);
    const loopKids = isHome(loopDay) ? ORDER : [];
    const loops = [];
    const lch = choiceState(tp, loopDay, loopKids, config, mode === "day" ? t : Math.max(t, at(loopDay, config.choice.lockAt, "17:00")));
    if (lch.exception) loops.push({ kind: "choice", kid: null, what: lch.job.word, copy: `${lch.job.word} · no claim.` });
    if (mode !== "day") {
      for (const k of loopKids) {
        for (const m of mustsFor(k, config)) if (mustState(tp, k, loopDay, m, config, t) == null) loops.push({ kind: "must", kid: k, name: NAME[k], what: m.word, copy: `${NAME[k]} · ${m.word}.` });
        if (isHomeNight(loopDay) && !closeTapped(tp, k, loopDay, config)) loops.push({ kind: "close", kid: k, name: NAME[k], what: "Close", copy: `${NAME[k]} · Close.` });
      }
      if (lch.owner && !lch.done) loops.push({ kind: "choice", kid: lch.owner, name: NAME[lch.owner], what: lch.job.word, copy: `${NAME[lch.owner]} · ${lch.job.word}.` });
    }
    const caught = mode === "day" ? null : caughtLine(tp, loopDay, loopKids, config, t);
    const strip = wk.days.filter((d) => at(addDays(d, 1), cw.middayAt, "12:00") <= t)
      .map((d) => caughtLine(tp, d, isHome(d) ? ORDER : [], config, t)).filter(Boolean).map((c) => ({ date: c.date, line: c.line }));
    dadSeat = { mode, loopDay, loops, caughtIt: caught ? { date: caught.date, line: caught.line } : null, weekStrip: strip,
      noCheck: nc.map((m) => `Ainsley · ${m.word}`) };

    /* Pack: travel week = an all-day trip with the kids on the calendar overlaps this law week (config tripPattern), or Dan
       lists the week id. A plain handoff Friday is not travel (that would light every home week). Dark once the bag is at the door. */
    const p = config.pack;
    const trip = new RegExp(p.tripPattern || "^Dan\\s*\\+\\s*Kids\\b", "i");
    const onTrip = cal.events.some((e) => e.allDay && !e.cancelled && trip.test(e.summary || "") && e.startMs < wk.endsAt && e.endMs > wk.startsAt);
    const travelWeek = onTrip || (p.travelWeeks || []).includes(wk.id);
    const done = (id) => ORDER.some((k) => weekTapOf(tp, k, wk.id, id) !== undefined);
    const dark = !travelWeek || done(p.doneWhen);
    pack = { travelWeek, dark, items: dark ? [] : p.items.map((x) => ({ id: x.id, word: x.word, done: done(x.id) })) };

  }
  if (dowOf(today) === "Sun") weekWin = weekWinFor(tp, lawWeek(addDays(today, -7)), isHome, config, t); /* the Sunday tile, home or not */
  const kidSeats = { ...base, quiet: !home, seats, choice, close, dadSeat, pack, weekWin, usTogether };

  /* unlocks.json: Weekend fun from Us together (10+ of 12 closes). Latest earned week, lit until spent, no stacking. */
  const u = config.usTogether.unlock;
  let earned = null;
  for (const id of candidateWeeks(tp, wk)) if (usTogetherFor(tp, lawWeek(id), isHomeNight, config, t).lit) earned = id;
  const lit = earned && !spent(uses, u.id, earned)
    ? [{ id: u.id, seat: "House", control: u.control, tile: u.tile, uses: 1, earnedWeek: earned, copy: u.copy }] : [];
  const unlocks = { ...base, lit };

  for (const [n, o] of [["kid-seats", kidSeats], ["unlocks", unlocks]]) {
    const hits = scanObject(o).concat(missNameHits(o), scoreHits(o), consequenceHits(o));
    if (hits.length) throw new Error(`${n} failed chore-law scan: ${JSON.stringify(hits)}`);
  }
  return { kidSeats, unlocks };
}

/** A wall tap spends a lit unlock: returns the new uses state (caller persists). Not lit -> unchanged. */
export function consumeUnlock(usesState, unlockId, layer, t, choice) {
  const state = { ...(usesState && usesState.note ? { note: usesState.note } : {}), uses: [...(((usesState && usesState.uses) || []))] };
  const u = layer.unlocks.lit.find((x) => x.id === unlockId);
  if (!u) return state;
  if (u.choices && !u.choices.includes(choice)) return state;
  state.uses.push({ unlock: unlockId, weekId: u.earnedWeek, usedAt: ctIso(t), ...(choice ? { choice } : {}) });
  return state;
}

/* ---------- scans ---------- */
/** Ainsley gets no stars and no counts (Alfred KL-05 under the law): no score words and no numbers on her seat. $ nowhere. */
export const SCORE_RE = /\bXP\b|\bpoints?\b|\bpts\b|\b\d+\s*\/\s*\d+\b|\bstreaks?\b|\bstars?\b|★|\bscores?\b|\bcoins?\b|\bgems?\b|\b\d+\b|\b(one|two|three|four|five|six|seven)\b|\$/i;
export function scoreHits(obj) {
  const hits = [];
  const walk = (v, p, ain) => {
    if (typeof v === "string") { if ((ain && SCORE_RE.test(v)) || /\$/.test(v)) hits.push({ path: p, text: v }); }
    else if (typeof v === "number" && ain) hits.push({ path: p, text: String(v) });
    else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${p}[${i}]`, ain));
    else if (v && typeof v === "object") for (const k of Object.keys(v)) {
      const a = ain || /^\$\.seats\.ainsley$/.test(`${p}.${k}`);
      if (a && SCORE_RE.test(k) && k !== "streak") hits.push({ path: `${p}.${k}`, text: k });
      if (a && k === "streak") hits.push({ path: `${p}.${k}`, text: k });
      walk(v[k], `${p}.${k}`, a);
    }
  };
  walk(obj, "$", false);
  return hits;
}
/** No consequence on a miss, no generic praise, no leaderboard wording. */
export const CONSEQUENCE_RE = /\b(lose|loses|lost|losing|grounded|penalt\w*|consequences?|punish\w*|owes?|no screens?|takes? away|taken away|because you|you didn'?t|didn'?t|forgot|lazy|great job|good job|awesome|amazing|proud of|winner|first place|leader-?board|beat (?:harris|hayes|ainsley)|best kid)\b/i;
export function consequenceHits(obj) {
  const hits = [];
  const walk = (v, p) => {
    if (typeof v === "string") { if (CONSEQUENCE_RE.test(v)) hits.push({ path: p, hit: "consequence", text: v }); }
    else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${p}[${i}]`));
    else if (v && typeof v === "object") for (const k of Object.keys(v)) walk(v[k], `${p}.${k}`);
  };
  walk(obj, "$");
  return hits;
}
/** Kid tiles never put a name next to a miss, and no miss words anywhere. The Dad Seat is Dad's list of open loops
    (names allowed there, neutral copy only). */
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
      if (isMiss(v) && !/^\$\.dadSeat/.test(p)) {
        const s = JSON.stringify(v);
        for (const n of names) if (new RegExp(`\\b${n}\\b`, "i").test(s)) hits.push({ path: p, hit: "name-in-miss", text: n });
      }
      for (const k of Object.keys(v)) walk(v[k], `${p}.${k}`);
    }
  };
  walk(obj, "$");
  return hits;
}
