#!/usr/bin/env node
/**
 * PIIGUARD1/3/4 · builds the PRIVATE pii-guard denylist (HMAC hashes only) from the box's private config. Box only.
 *   node scripts/qa/pii-guard-gen.mjs [--out <file>] [--key <file>]
 * Sources (read, never copied): every street address in the private calendar caches
 *   (~/.local/share/wardos-private/{calendar-dump,cal-live,cal-months,kids-week}.json, calstrings.local.txt) and the
 *   filter-repo literals (~/.config/wardos/filter-repo/base-strings.tsv literal rows, replace-text.txt left sides,
 *   cal-strings.tsv). Each address adds "number street suffix" and "number street" word windows (normalized like
 *   pii-guard.mjs). Key: ~/.config/wardos/pii-guard.key (created 0600 if missing, 32 random bytes hex).
 * Output: ~/.config/wardos/pii-guard-denylist.txt (0600, outside git). Prints COUNTS only, never a value.
 * WARDOS_PRIVATE_DIR / PII_GUARD_CFG_DIR override the source dirs (tests use synthetic dirs).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { normTokens, hmac, parseKey } from "./pii-guard.mjs";

const args = process.argv.slice(2);
const val = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const CFG = process.env.PII_GUARD_CFG_DIR || "/home/box/.config/wardos";
const PRIV = process.env.WARDOS_PRIVATE_DIR || "/home/box/.local/share/wardos-private";
const OUT = val("--out") || path.join(CFG, "pii-guard-denylist.txt");
const KEY = val("--key") || path.join(CFG, "pii-guard.key");

const SUFFIX = "St|Street|Ave|Avenue|Rd|Road|Dr|Drive|Ln|Lane|Ct|Court|Blvd|Boulevard|Ter|Terrace|Pkwy|Parkway|Way|Cir|Circle|Pl|Place|Hwy|Highway|Trl|Trail|Plaza|Sq|Square";
/* case-sensitive on purpose: street words and the suffix are capitalized (or all caps), so prose like "10 at the
   court" or "9:30 pm put it on the way" never becomes an entry */
const UP = (s) => s.split("|").map((x) => x + "|" + x.toUpperCase()).join("|");
export const ADDR = new RegExp(String.raw`\b\d{2,6}\s+(?:[NSEW]{1,2}\.?\s+)?(?:\d+(?:st|nd|rd|th|ST|ND|RD|TH)|[A-Z][A-Za-z'-]+)(?:\s+[A-Z][A-Za-z'-]+){0,2}\s+(?:${UP(SUFFIX)})\b`, "g");
export const SUFFIX_NORM = new Set(SUFFIX.split("|").flatMap((x) => normTokens(x)));
const ORD_TAIL = new Set(["st", "nd", "rd", "th"]);
export const DIRS = new Set(["n", "s", "e", "w", "ne", "nw", "se", "sw"]);
const STOP = new Set(["am", "pm", "at", "the", "and", "to", "on", "in", "for", "of", "min", "mins", "hr", "hrs", "pts", "x"]);
export function addressEntries(text) {
  const out = new Set();
  for (const m of String(text).matchAll(ADDR)) {
    const t = normTokens(m[0]);
    if (t.length < 3 || t.length > 8 || STOP.has(t[1])) continue;
    out.add(t.join(" "));
    /* PIIGUARD3: normTokens splits ordinals ("136th" -> "136 th"), so the old length>=4 test on the last token dropped
       every ordinal window. Keep the no-suffix window whenever the dropped token is a street suffix and the street word
       is an ordinal tail (st/nd/rd/th) or 4+ chars (a bare 3-letter word window like "10 oak" stays out: prose FPs). */
    /* PIIGUARD4: with a direction word AND a 3+ digit number ("<num> N <word> St") the 3-letter window "<num> n <word>" is kept
       too (the direction makes it address-shaped, not prose), and the same address also adds its direction-less windows
       ("1234 elm st", "1234 elm"), so writing it without the N/S/E/W is still caught. Same digit rule for both. */
    const hasDir = t.length >= 4 && DIRS.has(t[1]), digits3 = /^\d{3,}$/.test(t[0]);
    const noSuffix = t.slice(0, -1), last = noSuffix[noSuffix.length - 1] || "";
    if (noSuffix.length >= 2 && SUFFIX_NORM.has(t[t.length - 1]) && (ORD_TAIL.has(last) || last.length >= 4 || (hasDir && digits3))) out.add(noSuffix.join(" "));
    if (hasDir && digits3) {
      const nd = [t[0], ...t.slice(2)]; out.add(nd.join(" "));
      if (nd.length >= 3 && SUFFIX_NORM.has(nd[nd.length - 1])) out.add(nd.slice(0, -1).join(" "));
    }
  }
  return out;
}
const read = (f) => { try { return fs.readFileSync(f, "utf8"); } catch { return ""; } };

export function collect() {
  const entries = new Set(); const stats = { sources: 0, addresses: 0 };
  const add = (txt) => { if (!txt) return; stats.sources++; for (const e of addressEntries(txt)) entries.add(e); };
  for (const f of ["calendar-dump.json", "cal-live.json", "cal-months.json", "kids-week.json", "calstrings.local.txt"]) add(read(path.join(PRIV, f)));
  const fr = path.join(CFG, "filter-repo");
  for (const ln of read(path.join(fr, "base-strings.tsv")).split("\n")) {
    if (!ln || ln.startsWith("#")) continue;
    const [kind, match, repl] = ln.split("\t");
    if (kind !== "literal" || !match) continue;
    add(match);
    /* address literals the filter-repo already maps to "1 Example <suffix>" are hashed whole too */
    if (/^1 Example\b/.test(repl || "")) { const t = normTokens(match); if (t.length >= 2 && t.length <= 8) entries.add(t.join(" ")); }
  }
  for (const ln of read(path.join(fr, "replace-text.txt")).split("\n")) { const i = ln.indexOf("==>"); add(i >= 0 ? ln.slice(0, i) : ln); }
  for (const ln of read(path.join(fr, "cal-strings.tsv")).split("\n")) add(ln.split("\t").slice(1).join(" "));
  stats.addresses = entries.size;
  return { entries, stats };
}

function main() {
  let keyHex;
  if (fs.existsSync(KEY)) keyHex = fs.readFileSync(KEY, "utf8").trim();
  else { keyHex = crypto.randomBytes(32).toString("hex"); fs.writeFileSync(KEY, keyHex + "\n", { mode: 0o600 }); }
  fs.chmodSync(KEY, 0o600);
  const key = parseKey(keyHex);
  const { entries, stats } = collect();
  if (!entries.size) { console.log("pii-guard-gen: FAIL 0 entries (sources missing?)"); process.exit(2); }
  const lines = [...entries].map((e) => `h:${e.split(" ").length}:${hmac(key, e)}`).sort();
  const tmp = OUT + ".tmp-" + process.pid;
  fs.writeFileSync(tmp, `# pii-guard denylist · PIIGUARD3 · HMAC-SHA256/32 hashes only · PIIGUARD4 windows · generated ${new Date().toISOString()} · never commit\n` + lines.join("\n") + "\n", { mode: 0o600 });
  fs.renameSync(tmp, OUT); fs.chmodSync(OUT, 0o600);
  console.log(`pii-guard-gen: ${stats.sources} source blobs · ${entries.size} hashed windows -> ${OUT} (0600) · key ${KEY} (0600)`);
}
if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(new URL(import.meta.url).pathname)) main();
