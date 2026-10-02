/* ATLASLANE7 · scripts/house/kid-copy.mjs · board-safe kid copy for the kids-week build. NOT WIRED (runs inside the
   builders: calendar-refresh.mjs, cal-from-events.mjs). Pure.
   The builders PRESERVE kid sections (bankGoal, fun, missions, goal, quests…) from the previous kids-week.json, so old
   money copy came back on every refresh. This pass rewrites it at the source, every build:
     no $, jar, payday or balance text. Jar -> the kid's own goal word (Gems / Victory Coins / Tour goal), $N chore
     amounts -> N★ ("$7 wk" -> "7★ wk"). Only Ainsley's babysitting rateLabel "$15/hr" stays (DAN RULING t2812u #1).
   Wording matches Wright's KIDPATH1 scrub (24cb71f) exactly for every current string (EXACT below); RULES cover new ones.
   Not copy, left alone: id / *Id / key / href / cls values (e.g. bankGoal.id "gem-jar" keys saved state) and numbers. */

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
  ["🔥 ALL musts clear = gems in the jar", "🔥 ALL musts clear = gems"],
  ["💥 ALL musts clear = coins in the jar", "💥 ALL musts clear = coins"],
  ["ALL musts → jar $10 + $10 payday", "ALL musts clear"],
  ["not for jar · Dad handout", "Dad handout"],
  ["hire add-on · not for jar", "hire add-on"],
  ["Payday with Dad after honest musts", "Goal with Dad after honest musts"],
]);
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
  if (EXACT.has(s)) return EXACT.get(s);
  if (!/\$|\bjars?\b|\bpay-?days?\b|\bpay-?outs?\b|\bbalances?\b/i.test(s)) return s;
  const parts = s.split(ALLOWED_TAG);
  const out = parts.map((p) => { let x = p; for (const [re, rep] of rulesFor(kidId)) x = x.replace(re, rep); return x; }).join(ALLOWED_TAG);
  return tidy(out);
}
const CODE_KEY = (k) => k === "id" || /Id$|^key$|href$|^cls$/.test(k);
/** Deep pass over a kids-week object (all kids + dan + boardStrip). Returns a new object. */
export function kidCopyDeep(week) {
  const walk = (v, kidId, k) => {
    if (typeof v === "string") return CODE_KEY(k) ? v : kidCopyText(v, kidId);
    if (Array.isArray(v)) return v.map((x) => walk(x, kidId, k));
    if (v && typeof v === "object") { const o = {}; for (const kk of Object.keys(v)) o[kk] = walk(v[kk], kidId, kk); return o; }
    return v;
  };
  const out = walk(week, null, "");
  if (week && week.kids) for (const kidId of Object.keys(week.kids)) out.kids[kidId] = walk(week.kids[kidId], kidId, "");
  return out;
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
