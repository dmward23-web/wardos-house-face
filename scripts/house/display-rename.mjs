/* ATLASLANE6 · scripts/house/display-rename.mjs · display-only renames for public board data. NOT WIRED.
   DAN RULING (t2812u): "Mom & Dad" -> "Nonna and Papa", "Mom birthday" -> "Nonna birthday" (unless the title names
   someone else's mom). Erin stays Erin. The source calendar is never edited: this runs at build time only.
   Rules live in config/display-rename.json (scripts/cal-months.py reads the same file).
   displayText(s) -> renamed + parent-scrubbed string, or null when a parent word survives (caller drops it).
   displayDeep(obj) -> deep copy; array entries whose strings can't be cleaned are dropped, other such strings -> "". */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const RENAME_CONFIG = path.join(ROOT, "config/display-rename.json");
let CACHE = null;
export function loadRenames(fp = RENAME_CONFIG) {
  if (CACHE && CACHE.fp === fp) return CACHE.rules;
  const c = JSON.parse(fs.readFileSync(fp, "utf8"));
  const rules = {
    renames: c.renames.map((r) => ({ id: r.id, re: new RegExp(r.pattern, "gi"), replace: r.replace })),
    paren: new RegExp(c.parentScrub.parenthetical, "gi"),
    poss: new RegExp(c.parentScrub.possessive, "g"),
    residual: new RegExp(c.parentScrub.residual, "i"),
    moneyParen: new RegExp(c.moneyScrub.parenthetical, "g"),
    moneyToken: new RegExp(c.moneyScrub.token, "g"),
    moneyAllow: c.moneyScrub.allow,
  };
  CACHE = { fp, rules };
  return rules;
}
/** Money scrub for calendar labels (cal-months): drops "($30)" and bare amounts; the allow-list string stays. */
export function moneyText(s, rules = loadRenames()) {
  if (typeof s !== "string") return s;
  if (rules.moneyAllow.includes(s.trim())) return s;
  const keep = [];
  let out = s;
  rules.moneyAllow.forEach((a, i) => { out = out.split(a).join(`\u0000${i}\u0000`); keep.push(a); });
  out = out.replace(rules.moneyParen, "").replace(rules.moneyToken, "");
  keep.forEach((a, i) => { out = out.split(`\u0000${i}\u0000`).join(a); });
  return out === s ? s : out.replace(/\s{2,}/g, " ").trim();
}
/** Every string with a dollar sign other than the allow-listed tag. Empty = clean. */
export function moneyHits(obj, rules = loadRenames()) {
  const hits = [];
  const walk = (v, p) => {
    if (typeof v === "string") { let x = v; for (const a of rules.moneyAllow) x = x.split(a).join(""); if (x.includes("$")) hits.push({ path: p, text: v }); }
    else if (Array.isArray(v)) v.forEach((y, i) => walk(y, `${p}[${i}]`));
    else if (v && typeof v === "object") for (const k of Object.keys(v)) walk(v[k], `${p}.${k}`);
  };
  walk(obj, "$");
  return hits;
}
/** Renames only (no scrub). */
export function renameText(s, rules = loadRenames()) {
  let out = String(s == null ? "" : s);
  for (const r of rules.renames) out = out.replace(r.re, r.replace);
  return out;
}
export function displayText(s, rules = loadRenames()) {
  if (typeof s !== "string") return s;
  let out = renameText(s, rules).replace(rules.paren, "").replace(rules.poss, "$1$2");
  out = out.replace(/\s{2,}/g, " ").replace(/\s+([·,;:])/g, " $1").trim();
  if (out !== s.trim() && /^\s*$/.test(out)) return null;
  return rules.residual.test(out) ? null : (out === s.trim() ? s : out);
}
/** Deep display pass over a public JSON object. Returns {value, renamed: [{from, to}], dropped: [text]}. */
export function displayDeepReport(obj, rules = loadRenames(), { money = false } = {}) {
  const renamed = [], dropped = [];
  const fix = (s) => {
    const d = displayText(money ? moneyText(s, rules) : s, rules);
    if (d === null) { dropped.push(s); return null; }
    if (d !== s) renamed.push({ from: s, to: d });
    return d;
  };
  const bad = (v) => {
    if (typeof v === "string") return displayText(v, rules) === null;
    if (Array.isArray(v)) return false;
    if (v && typeof v === "object") return Object.values(v).some((x) => typeof x === "string" && displayText(x, rules) === null);
    return false;
  };
  const walk = (v) => {
    if (typeof v === "string") { const d = fix(v); return d === null ? "" : d; }
    if (Array.isArray(v)) {
      const out = [];
      for (const x of v) {
        if (bad(x)) { dropped.push(typeof x === "string" ? x : JSON.stringify(x)); continue; }
        out.push(walk(x));
      }
      return out;
    }
    if (v && typeof v === "object") { const o = {}; for (const k of Object.keys(v)) o[k] = walk(v[k]); return o; }
    return v;
  };
  return { value: walk(obj), renamed, dropped };
}
export function displayDeep(obj, rules, opts) { return displayDeepReport(obj, rules, opts).value; }
/** Every string (and key) in obj that still names a mom. Empty = clean. */
export function momHits(obj) {
  const hits = [];
  const re = /\bmoms?\b|\bmommy\b/i;
  const walk = (v, p) => {
    if (typeof v === "string") { if (re.test(v)) hits.push({ path: p, text: v }); }
    else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${p}[${i}]`));
    else if (v && typeof v === "object") for (const k of Object.keys(v)) { if (re.test(k)) hits.push({ path: `${p}.${k}`, text: k }); walk(v[k], `${p}.${k}`); }
  };
  walk(obj, "$");
  return hits;
}
