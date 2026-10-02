/* ATLASLANE7 · scripts/house/kid-copy.mjs · board-safe kid copy for the kids-week build. NOT WIRED (runs inside the
   builders: calendar-refresh.mjs, cal-from-events.mjs). Pure.
   The builders PRESERVE kid sections (bankGoal, fun, missions, goal, quests…) from the previous kids-week.json, so old
   money copy came back on every refresh. This pass rewrites it at the source, every build:
     no $, jar, payday or balance text. Jar -> the kid's own goal word (Gems / Victory Coins / Tour goal), $N chore
     amounts -> N★ ("$7 wk" -> "7★ wk"). Only Ainsley's babysitting rateLabel "$15/hr" stays (DAN RULING t2812u #1).
   Wording matches Wright's KIDPATH1 scrub (24cb71f) exactly for every current string (EXACT below); RULES cover new ones.
   Not copy, left alone: id / *Id / key / href / cls values (e.g. bankGoal.id "gem-jar" keys saved state) and numbers.
   WALLKIT9 (Wright, on Dan's ask Oct 1 7:52 PM CT, merged into wall-redesign-1): streak / flame copy is fixed here too, at the
   source: "🔥 6-day fire streak" -> "Week 6", no 🔥. Ainsley has a seat, not a score (KL-05): her streak/day count is dropped,
   not relabeled (streakLabel -> "", "N-day streak" removed from her strings; a calendar "Week 5" stays, it's a fact).
   ATLASLANE9 (Alfred QA, Oct 1 9:18 PM CT): the chore law runs here too, last, on every kids-week write (kidLawWeek):
     quests = exactly the 4 binary MUSTS from config/kid-layer.config.json (mustsFor: Dragon fed swaps Hayes's 4th only
     while the dragon is home) + the optional / add-on quests kept as they are. The old 5/7/7 daily chart and the weekly
     musts are gone. Ainsley has no stars, ever: no currency / bankGoal / goal, no stars keys, no star wording. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mustsFor } from "./kid-layer-lib.mjs";

export const ALLOWED_TAG = "$15/hr";
const GOAL_WORD = { harris: "Gems", hayes: "Victory Coins", ainsley: "Tour goal" };
const HONEST = "Honest Dad-week musts (Fri 3:00p→Fri 3:00p · taps Sat–Fri, leave Fri morning). ALL musts required. Save what you earned.";
export const EXACT = new Map([
  ["Gem Jar · earn then save", "Gems · earn then save"],
  ["Victory Jar · earn then save", "Victory Coins · earn then save"],
  ["Tour Jar", "Tour goal"],
  ["Tour Jar · $20", "Tour goal"],
  ["Honest Dad-week musts (Fri 3:00p→Fri 3:00p · taps Sat–Fri, leave Fri morning) hit Gem Jar $10 AND full $10 payday (1★=$1). ALL musts required — jar/allowance locked until every Must is done. Jar = save what you earned — not free money.", HONEST],
  ["Honest Dad-week musts (Fri 3:00p→Fri 3:00p · taps Sat–Fri, leave Fri morning) hit Victory Jar $10 AND full $10 payday (1★=$1). ALL musts required — jar/allowance locked until every Must is done. Jar = save what you earned — not free money.", HONEST],
  ["Dad-week musts unlock Tour Jar $20 + $20 payday. All musts required. Babysit $15/hr separate.", "Dad-week musts. All musts required. Babysitting is separate."],
  ["gems → jar → payday · craft optional", "gems · craft optional"],
  ["coins → jar → payday", "coins · earn then save"],
  ["💎 Gem Jar · save with Dad", "💎 Gems · save with Dad"],
  ["☂️ Victory Jar · save with Dad", "☂️ Victory Coins · save with Dad"],
  ["🔥 ALL musts clear = gems in the jar", "ALL musts clear = gems"],
  ["🔥 ALL musts clear = gems", "ALL musts clear = gems"],
  ["🔥 3-day craft streak — keep smashing", "Week 3 · craft — keep smashing"],
  ["🔥 6-day fire streak — don't break it", "Week 6 — don't break it"],
  ["💥 ALL musts clear = coins in the jar", "💥 ALL musts clear = coins"],
  ["ALL musts → jar $10 + $10 payday", "ALL musts clear"],
  ["not for jar · Dad handout", "Dad handout"],
  ["hire add-on · not for jar", "hire add-on"],
  ["Payday with Dad after honest musts", "Goal with Dad after honest musts"],
]);
const STREAK_RE = /streak|\u{1F525}|\b\d+-day\b/iu;
/** WALLKIT9 streak rules (after money rules). Ainsley: the count goes, nothing replaces it. */
export function streakRulesFor(kidId) {
  if (kidId === "ainsley") return [
    [/[◆\u{1F525}]?\s*\b\d+-day(?:\s+[a-z]+)?\s+streaks?\b\s*(?:—|-|·)?\s*/giu, ""],
    [/\bstreaks?\b/gi, ""],
    [/\s*\u{1F525}\s*/gu, " "],
  ];
  return [
    [/\b(\d+)-day(?:\s+[a-z]+)?\s+streaks?\b/gi, "Week $1"],
    [/\bStreaks?\b/g, "Week"], [/\bstreaks?\b/gi, "week"],
    [/\s*\u{1F525}\s*/gu, " "],
  ];
}
/** Generic rules for strings not in EXACT (new copy someone adds later). Order matters. */
export function rulesFor(kidId) {
  const goal = GOAL_WORD[kidId] || "Goal";
  return [
    [/\s*\(\s*\d*★\s*=\s*\$\d+(?:\.\d+)?\s*\)/g, ""],                           /* "(1★=$1)" */
    [/\bGems?\s+Jars?\b/gi, "Gems"], [/\bVictory\s+Jars?\b/gi, "Victory Coins"], [/\bTour\s+Jars?\b/gi, "Tour goal"],
    [/\b(?:Star|Coin)s?\s+Jars?\b/gi, goal],                                   /* "Gem Jar" -> "Gems" */
    [/\s*(?:→|->)\s*jars?\b/gi, ""],                                           /* "gems → jar" */
    [/\bjar\s*\/\s*allowance\b/gi, "goal"],
    [/\s*(?:\+|AND|and|&)?\s*(?:full\s+)?\$\d+(?:\.\d+)?\s+payday\b/g, ""],    /* "+ $10 payday" */
    [/\s*(?:→|->)\s*payday\b/gi, ""],
    [/\bpay-?days?\b/gi, "goal day"],
    [/\bpay-?outs?\b/gi, "goal"],
    [/\bBalances?\b/g, "Stars"], [/\bbalances?\b/gi, "stars"],
    [/\bjars?\b/gi, "goal"],
    [/\$(\d+)(?:\.00)?/g, "$1★"],                                              /* "$7 wk" -> "7★ wk" */
    [/\$/g, ""],
  ];
}
function tidy(s) {
  return s.replace(/\s{2,}/g, " ").replace(/\s+([.,;:])/g, "$1").replace(/(?:\s*·\s*){2,}/g, " · ").replace(/^\s*·\s*|\s*·\s*$/g, "").trim();
}
/** One visible string -> board-safe. The allowed tag survives anywhere it appears. */
export function kidCopyText(s, kidId) {
  if (typeof s !== "string") return s;
  if (EXACT.has(s) && !(kidId === "ainsley" && STREAK_RE.test(s))) return EXACT.get(s);
  const money = /\$|\bjars?\b|\bpay-?days?\b|\bpay-?outs?\b|\bbalances?\b/i.test(s), streak = STREAK_RE.test(s);
  if (!money && !streak) return s;
  const rules = (money ? rulesFor(kidId) : []).concat(streak ? streakRulesFor(kidId) : []);
  const parts = s.split(ALLOWED_TAG);
  const out = parts.map((p) => { let x = p; for (const [re, rep] of rules) x = x.replace(re, rep); return x; }).join(ALLOWED_TAG);
  return tidy(out);
}
const CODE_KEY = (k) => k === "id" || /Id$|^key$|href$|^cls$/.test(k);
/** Deep pass over a kids-week object (all kids + dan + boardStrip). Returns a new object. */
export function kidCopyDeep(week) {
  const walk = (v, kidId, k) => {
    if (typeof v === "string") {
      if (CODE_KEY(k)) return v;
      if (k === "streakLabel" && kidId === "ainsley") return ""; /* WALLKIT9 KL-05: a seat, not a score */
      return kidCopyText(v, kidId);
    }
    if (Array.isArray(v)) return v.map((x) => walk(x, kidId, k));
    if (v && typeof v === "object") { const o = {}; for (const kk of Object.keys(v)) o[kk] = walk(v[kk], kidId, kk); return o; }
    return v;
  };
  const out = walk(week, null, "");
  if (week && week.kids) for (const kidId of Object.keys(week.kids)) out.kids[kidId] = walk(week.kids[kidId], kidId, "");
  return kidLawWeek(out);
}

/* ---------- ATLASLANE9 chore law on kids-week ---------- */
export const LAW_CONFIG = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../config/kid-layer.config.json");
let _law = null;
export function lawConfig() { return _law || (_law = JSON.parse(fs.readFileSync(LAW_CONFIG, "utf8"))); }
export const LAW_KIDS = ["harris", "hayes", "ainsley"];
const STAR_WORD = /\bstars?\b|★/i;
const isExtra = (q) => q && (q.optional === true || q.cadence === "addon");
const dropStars = (v) => {
  if (Array.isArray(v)) return v.map(dropStars);
  if (v && typeof v === "object") { const o = {}; for (const k of Object.keys(v)) if (k !== "stars") o[k] = dropStars(v[k]); return o; }
  return v;
};
/** The law on one kids-week object (new object; idempotent). */
export function kidLawWeek(week, config = lawConfig()) {
  if (!week || !week.kids) return week;
  const out = { ...week, kids: { ...week.kids } };
  for (const kidId of LAW_KIDS) {
    const k0 = week.kids[kidId];
    if (!k0 || typeof k0 !== "object") continue;
    const k = { ...k0 };
    const boy = kidId !== "ainsley";
    const musts = mustsFor(kidId, config).map((m) => (boy ? { id: m.id, what: m.word, cadence: "daily", must: true, stars: 1 } : { id: m.id, what: m.word, cadence: "daily", must: true }));
    k.quests = musts.concat((Array.isArray(k0.quests) ? k0.quests : []).filter(isExtra));
    if (Array.isArray(k.missions)) k.missions = k.missions.filter((m) => !(m && /^weekly$/i.test(String(m.when || "").trim())));
    if (!boy) {
      delete k.currency; delete k.bankGoal; delete k.goal;
      const starry = (x) => STAR_WORD.test(JSON.stringify(x));
      if (Array.isArray(k.missions)) k.missions = k.missions.filter((m) => !starry(m));
      if (Array.isArray(k.fun)) k.fun = k.fun.filter((m) => !starry(m));
      out.kids[kidId] = dropStars(k);
    } else out.kids[kidId] = k;
  }
  return out;
}
/** Law breaches on a kids-week object ([] = clean). */
export function kidLawHits(week, config = lawConfig()) {
  const hits = [];
  if (!week || !week.kids) return ["no kids"];
  for (const kidId of LAW_KIDS) {
    const k = week.kids[kidId];
    if (!k) { hits.push(`${kidId}: missing`); continue; }
    const want = mustsFor(kidId, config).map((m) => m.word);
    const musts = (k.quests || []).filter((q) => !isExtra(q));
    const got = musts.map((q) => q.what);
    if (JSON.stringify(got) !== JSON.stringify(want)) hits.push(`${kidId}: musts ${JSON.stringify(got)} != ${JSON.stringify(want)}`);
    if (musts.some((q) => q.cadence !== "daily" || q.must !== true)) hits.push(`${kidId}: a must is not binary daily`);
    if ((k.missions || []).some((m) => /^weekly$/i.test(String(m.when || "").trim()))) hits.push(`${kidId}: weekly mission`);
    if (kidId === "ainsley") {
      for (const f of ["currency", "bankGoal", "goal"]) if (f in k) hits.push(`ainsley: ${f}`);
      const s = JSON.stringify(k);
      if (/"stars"\s*:/.test(s)) hits.push("ainsley: stars key");
      if (STAR_WORD.test(s)) hits.push("ainsley: star wording");
    }
  }
  return hits;
}
/** Visible strings (not ids) still carrying $, jar, payday, payout or balance; the exact allowed tag is ignored. */
export function kidMoneyHits(obj) {
  const hits = [];
  const walk = (v, p, k) => {
    if (typeof v === "string") {
      if (CODE_KEY(k)) return;
      const x = v.split(ALLOWED_TAG).join("");
      if (/\$|\bjars?\b|\bpay-?days?\b|\bpay-?outs?\b|\bbalances?\b/i.test(x)) hits.push({ path: p, text: v });
    } else if (Array.isArray(v)) v.forEach((y, i) => walk(y, `${p}[${i}]`, k));
    else if (v && typeof v === "object") for (const kk of Object.keys(v)) walk(v[kk], `${p}.${kk}`, kk);
  };
  walk(obj, "$", "");
  return hits;
}
