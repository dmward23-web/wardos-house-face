#!/usr/bin/env node
/**
 * PIIGUARD1/2/3 · PII guard for the PUBLIC repo. Fails on content that pins the house or a person down:
 *   precise_coords  lat/long finer than 0.1° (keyed lat/lon values, or a plausible lat,lon / lon,lat pair)
 *   phone / email   outside scripts/qa/pii-guard-allow.txt (public business contacts only)
 *   token           provider token / key shapes and secret-looking key=value pairs
 *   device_id       device, account, project and terminal ids, MACs, Nest device paths, OAuth client ids
 *   denylist        any normalized word window whose keyed hash is in the PRIVATE denylist (addresses, street +
 *                   house number). HMAC-SHA256 hashes only, never plaintext, NEVER committed: box =
 *                   ~/.config/wardos/pii-guard-denylist.txt + pii-guard.key (0600, made by pii-guard-gen.mjs); CI =
 *                   secrets PII_GUARD_DENYLIST + PII_GUARD_KEY. The key is secret, so the hashes can't be brute-forced.
 *   private_list    (box only, --private-lists) private-names.tsv names + privacy-denylist.txt regexes
 * Output: category + path:line + sha256/16 of the matched text. NEVER the matched text itself.
 *
 *   node scripts/qa/pii-guard.mjs --staged             pre-commit: staged blobs
 *   node scripts/qa/pii-guard.mjs --range A..B         CI / pre-push: every blob changed by each commit in the range
 *   node scripts/qa/pii-guard.mjs --rev <rev>          whole tree of a commit
 *   node scripts/qa/pii-guard.mjs --tree               working tree (tracked + untracked, not ignored)
 *   --require-denylist   exit 2 when no private denylist loads (box hooks use it; CI without the secret warns)
 *   --private-lists      also load the box name/regex lists (category private_list)
 *   --only <rx> / --skip <rx>   path filters
 * A line may opt out of ONE category:  pii-guard:allow <category>   (reviewed, never for denylist/private_list; only in files
 *   listed as "marker <path>" in pii-guard-allow.txt, and every marker is printed as an ALLOW line each run)
 *   hex_key / uuid / nul_in_text / text_in_binary / allow_unlisted are PIIGUARD2 categories.
 * Exit 0 clean, 1 hits, 2 config failure.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const sha16 = (s) => crypto.createHash("sha256").update(String(s)).digest("hex").slice(0, 16);

/* ---------- normalization (shared with pii-guard-gen.mjs) ---------- */
const ABBR = { street: "st", avenue: "ave", av: "ave", drive: "dr", road: "rd", lane: "ln", court: "ct", terrace: "ter", terr: "ter",
  boulevard: "blvd", parkway: "pkwy", pky: "pkwy", circle: "cir", place: "pl", highway: "hwy", trail: "trl", north: "n", south: "s",
  east: "e", west: "w", northeast: "ne", northwest: "nw", southeast: "se", southwest: "sw", apartment: "apt", suite: "ste" };
export function normTokens(s) {
  return String(s).toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ")
    .replace(/(\d)(?=[a-z])|([a-z])(?=\d)/g, "$1$2 ").trim() /* PIIGUARD2: "4321fakeview" -> "4321 fakeview" */
    .split(" ").filter(Boolean).map((t) => ABBR[t] || t);
}
export const hmac = (key, s) => crypto.createHmac("sha256", key).update(s).digest("hex").slice(0, 32);

/* ---------- denylist ----------
 * Denylist file = hashes only:  h:<k>:<hmac32>   (k = word-window length). The HMAC key lives apart from it:
 * box ~/.config/wardos/pii-guard.key (0600, 64 hex), CI secret PII_GUARD_KEY. Hashes: box
 * ~/.config/wardos/pii-guard-denylist.txt, CI secret PII_GUARD_DENYLIST (file contents). Neither is ever in git. */
export function parseDenylist(txt) {
  const byK = new Map(); let n = 0;
  for (const raw of String(txt).split(/\r?\n/)) {
    const ln = raw.trim();
    if (!ln || ln.startsWith("#")) continue;
    const m = /^h:(\d{1,2}):([0-9a-f]{32})$/.exec(ln);
    if (!m) throw new Error("pii-guard: malformed denylist line (not shown)");
    const k = +m[1]; if (!byK.has(k)) byK.set(k, new Set()); byK.get(k).add(m[2]); n++;
  }
  return { byK, n };
}
export function parseKey(txt) {
  const t = String(txt || "").trim();
  if (!/^[0-9a-f]{64}$/.test(t)) throw new Error("pii-guard: key is not 64 hex chars (not shown)");
  return Buffer.from(t, "hex");
}
const BOX_CFG = "/home/box/.config/wardos";
function firstFile(...c) { return c.filter(Boolean).find((f) => fs.existsSync(f)); }
export function loadDenylist() {
  const cfg = path.join(os.homedir(), ".config", "wardos");
  const boxOk = !process.env.PII_GUARD_NO_BOX_DEFAULT; /* tests turn the real box lists off */
  let txt = null, src = "none", keyTxt = null;
  if (process.env.PII_GUARD_DENYLIST && process.env.PII_GUARD_DENYLIST.trim()) { txt = process.env.PII_GUARD_DENYLIST; src = "secret"; }
  else { const f = firstFile(process.env.PII_GUARD_DENYLIST_FILE, boxOk && path.join(cfg, "pii-guard-denylist.txt"), boxOk && path.join(BOX_CFG, "pii-guard-denylist.txt")); if (f) { txt = fs.readFileSync(f, "utf8"); src = "file"; } }
  if (process.env.PII_GUARD_KEY && process.env.PII_GUARD_KEY.trim()) keyTxt = process.env.PII_GUARD_KEY;
  else { const f = firstFile(process.env.PII_GUARD_KEY_FILE, boxOk && path.join(cfg, "pii-guard.key"), boxOk && path.join(BOX_CFG, "pii-guard.key")); if (f) keyTxt = fs.readFileSync(f, "utf8"); }
  if (txt == null) return { key: null, byK: new Map(), n: 0, src };
  const d = parseDenylist(txt);
  if (d.n && keyTxt == null) throw new Error("pii-guard: denylist loaded but no key (PII_GUARD_KEY / pii-guard.key)");
  return { ...d, key: d.n ? parseKey(keyTxt) : null, src };
}
/* PIIGUARD2: the denylist runs over the WHOLE file's token stream (whitespace and line breaks collapsed), so an address
   split across lines or glued to its number is still caught; each hit reports the line its first token is on. */
function denyHitsText(lines, deny) {
  if (!deny.n) return [];
  const toks = [], at = [];
  lines.forEach((ln, i) => { for (const t of normTokens(ln)) { toks.push(t); at.push(i); } });
  const out = [];
  for (const [k, set] of deny.byK)
    for (let i = 0; i + k <= toks.length; i++) {
      const w = toks.slice(i, i + k).join(" ");
      if (set.has(hmac(deny.key, w))) out.push({ v: w, line: at[i], end: at[i + k - 1] });
    }
  return out;
}

/* ---------- allowlist (public business contacts only) ---------- */
export function loadAllow(txt) {
  /* email <addr> | phone <digits> | id sha16:<16hex> (a reviewed public 64-hex / UUID value, by hash only)
     | marker <path>  (the ONLY files allowed to carry inline "pii-guard:allow <cat>" markers) */
  const a = { email: new Set(), phone: new Set(), id: new Set(), marker: new Set() };
  for (const raw of String(txt || "").split(/\r?\n/)) {
    const ln = raw.replace(/#.*/, "").trim(); if (!ln) continue;
    const [cat, v] = ln.split(/\s+/, 2);
    if (cat === "email" && v) a.email.add(v.toLowerCase());
    if (cat === "phone" && v) a.phone.add(v.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, ""));
    if (cat === "id" && /^sha16:[0-9a-f]{16}$/.test(v || "")) a.id.add(v.slice(6));
    if (cat === "marker" && v) a.marker.add(v);
  }
  return a;
}
const SAFE_EMAIL_DOMAIN = /@(?:[a-z0-9-]+\.)*(?:example\.(?:com|org|net|invalid)|example|invalid|test|localhost|users\.noreply\.github\.com)$/i;

/* ---------- generic rules ---------- */
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.(?!png\b|jpe?g\b|webp\b|svg\b|js\b|css\b|json\b|mjs\b|html\b|gif\b)[A-Za-z]{2,}\b/g;
const PHONE = /(?<![\d.\w$#-])(?:\+?1[-. ]?)?\(?([2-9]\d{2})\)?[-. ]([2-9]\d{2})[-. ](\d{4})(?![\d\w])/g;
/* PIIGUARD2: tel: links in any file; bare 10/11-digit NANP numbers in data/markup/contact files */
const TEL = /\btel:\s*(?:\+?1)?[-. (]*([2-9]\d{2})[-. )]*([2-9]\d{2})[-. ]*(\d{4})(?!\d)/gi;
/* bare: only as a quoted value, element text, a JSON value or a vCard/iCal TEL field, never in CSS/JS math (z-index:2147483647) */
const BARE_PHONE = /(?<=^|["'>\s]|":\s?|\bTEL[^\n:]*:)\+?1?([2-9]\d{2})([2-9]\d{2})(\d{4})(?![\d\w])/g;
const BARE_PHONE_FILES = /\.(?:json|html?|ics|vcf|md|txt|csv|tsv|xml|ya?ml)$/i;
/* PIIGUARD3 · JS/TS: a quoted string that is ONLY a 10/11-digit NANP number, or a number (quoted or not) on a
   phone/tel/mobile/cell/sms key. Unquoted numbers elsewhere stay clean (ids, PRNG moduli, epoch seconds). */
/* integer limits that happen to have the NANP shape (z-index / bitmask constants). PIIGUARD4: exempt ONLY as a bare
   10-digit run (no +1, no separators, no parentheses) from the bare/quoted rules, and only when the text right before it
   is a z-index property or a numeric operator / int-limit name. tel:, formatted (NNN) NNN-NNNN and phone/cell-keyed
   values are never exempt. */
const NOT_PHONE = new Set([2 ** 31 - 1, 2 ** 31, 2 ** 32 - 1, 2 ** 32].map(String)); // int32/uint32 limits, built so no literal sits in source
const NUM_CTX = /(?:\bz-?index|\bzIndex|\b(?:max|min|limit|int32|uint32|mask|mod|modulus|seed)\w*|[%*\/+&|^~-]|>>>?|<<)\s*[:=]?\s*["'`]?$/i;
export const notPhoneCtx = (src, idx, raw) => /^["'`]?\d{10}["'`]?$/.test(raw) && NUM_CTX.test(src.slice(Math.max(0, idx - 40), idx));
const JS_FILES = /\.(?:[mc]?js|jsx|tsx?)$/i;
const JS_QUOTED_PHONE = /(["'`])\+?1?[-. ]?\(?([2-9]\d{2})\)?[-. ]?([2-9]\d{2})[-. ]?(\d{4})\1/g;
const JS_KEYED_PHONE = /\b(?:\w*phone\w*|tel|mobile|cell|sms)(?:[_-]?(?:no|num|number|phone))?["'`]?\s*[:=]\s*["'`]?\+?1?[-. ]?\(?([2-9]\d{2})\)?[-. ]?([2-9]\d{2})[-. ]?(\d{4})(?![\d\w])/gi;
const TOKENS = [
  /\bgh[pousr]_[A-Za-z0-9]{30,}/g, /\bgithub_pat_[A-Za-z0-9_]{40,}/g, /\bya29\.[0-9A-Za-z_-]{20,}/g, /\b1\/\/0[0-9A-Za-z_-]{20,}/g,
  /\bAIza[0-9A-Za-z_-]{35}/g, /\bGOCSPX-[0-9A-Za-z_-]{10,}/g, /\b[sr]k_(?:live|test)_[0-9A-Za-z]{10,}/g, /\bxox[abprs]-[0-9A-Za-z-]{10,}/g,
  /\bsk-(?:proj-|ant-)?[A-Za-z0-9_-]{20,}/g, /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g, /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/g, /\bxai-[A-Za-z0-9]{20,}/g,
  /\b(?:api[_-]?key|apikey|secret|client[_-]?secret|password|passwd|refresh[_-]?token|access[_-]?token|auth[_-]?token|bearer)["']?\s*[:=]\s*["'][A-Za-z0-9._~+\/=-]{16,}["']/gi,
];
const DEVICE = [
  /\benterprises\/[A-Za-z0-9_-]{6,}\/(?:devices|structures)\/[A-Za-z0-9_-]{6,}/g, /\b[0-9a-f]{2}(?:[-:][0-9a-f]{2}){5,7}\b/gi,
  /\b\d{6,}-[a-z0-9]{20,}\.apps\.googleusercontent\.com\b/g,
  /\b(?:device[_-]?id|deviceId|account[_-]?id|accountId|terminal[_-]?uuid|term[_-]?id|project[_-]?id|projectId|serial(?:[_-]?(?:no|number))?|hw[_-]?id|tunnel[_-]?id|user[_-]?id|userId|client[_-]?id|clientId)["']?\s*[:=]\s*["'][A-Za-z0-9:._-]{8,}["']/gi,
];
/* PIIGUARD2 coordinates run over the WHOLE masked file text, so \s spans line breaks (pretty-printed JSON pairs, a lat
   key with its value on the next line). Separators: comma, semicolon, whitespace, degree sign, N/S/E/W. */
const NUM = String.raw`(-?\d{1,3}\.\d+)`;
const KEYED_COORD = new RegExp(String.raw`\b(?:lat|latitude|lng|lon|longitude|long(?=["']?\s*[:=]))\b["']?\s*(?:[:=]\s*)?["']?\s*` + NUM, "gi");
const PAIR = new RegExp(String.raw`(?<![\w.\/#-])` + NUM + String.raw`\s*°?\s*(?:[,;]\s*|\s+)` + NUM + String.raw`\s*°?(?![\w.%])`, "g");
/* PIIGUARD4: hemisphere letters may be glued to the next number (47.1N122.1W) or slash-separated (47.1N/122.1W) */
const NSEW = new RegExp(String.raw`(?<![\w.])(\d{1,3}\.\d+)\s*°?\s*([NS])(?![A-Za-z])[\s,;\/]*(\d{1,3}\.\d+)\s*°?\s*([EW])(?![A-Za-z])`, "g");
const NSEW_PRE = new RegExp(String.raw`(?<![\w.])([NS])\s*(\d{1,3}\.\d+)\s*°?[\s,;\/]*([EW])\s*(\d{1,3}\.\d+)(?![\d.])`, "g");
const GEO = /\b(?:lat|lon|lng|geo|coord|location|home|house|center|centre|position|map|weather|wx|place|address)\w*/i;
const dec = (s) => (s.split(".")[1] || "").length;
/* blank (same length, newlines kept) ONLY the values of SVG geometry attributes and the args of CSS/canvas transform
   functions: they carry px-style pairs, not places. Everything else in .svg/.css (text, comments) is scanned. */
const blank = (t) => t.replace(/[^\n]/g, " ");
export function maskExempt(text, spans) {
  /* spans (optional): collects { at, v } of every blanked value so masked-span geo pairs can be checked (PIIGUARD3) */
  return String(text)
    .replace(/(\b(?:d|points|viewBox|transform|gradientTransform|patternTransform)\s*=\s*)(["'])([\s\S]*?)\2/gi, (m, p, q, v, off) => { spans && spans.push({ at: off + p.length + 1, v }); return p + q + blank(v) + q; })
    .replace(/(\b(?:matrix3?d?|translate(?:3d|X|Y|Z)?|rotate[XYZ]?|scale(?:3d|X|Y)?|skew[XY]?|cubic-bezier|moveTo|lineTo|bezierCurveTo|quadraticCurveTo|arc|rect)\s*\()([^)]*)\)/g, (m, p, v, off) => { spans && spans.push({ at: off + p.length, v }); return p + blank(v) + ")"; });
}
/* PIIGUARD3 shadow copies. Each keeps the line count, so a hit maps back to its source line.
   stripComments: JS/CSS block and line comments -> spaces (same length, newlines kept). "//" right after ":" (URLs)
     is left alone. Run on every text file: the original is scanned too, so blanking never hides anything.
   decodeLine: %XX (twice, for %252C) and NFKC (fullwidth digits, odd commas), per line. */
export function stripComments(text) {
  return String(text).replace(/\/\*[\s\S]*?(?:\*\/|$)/g, blank).replace(/(^|[^:\\\/])(\/\/[^\n]*)/gm, (m, a, c) => a + blank(c));
}
const pct1 = (s) => s.replace(/%([0-9a-f]{2})/gi, (m, h) => { const c = parseInt(h, 16); return c === 10 || c === 13 ? " " : c < 32 || c > 126 ? m : String.fromCharCode(c); });
export const decodeLine = (ln) => pct1(pct1(String(ln).normalize("NFKC")));
/* PIIGUARD3 P3: a lat/lon pair with 4+ decimals inside a MASKED span (d=, arc(), translate()) is still a hit when a
   geo word sits nearby (160 chars before the span, 40 after). Narrow word list: lat lon lng geo coord location home. */
const GEO_MASKED = /\b(?:lat|lon|lng|geo|coord|location|home)\w*/i;
/* PIIGUARD4 F3: the first number may be glued to an SVG path command letter (M<lat>,<lon> / L<lat> <lon>)
   and the pair may be split by the sign alone (M<lat>-<lon>) */
const PAIR4 = /(?<![\d.])(-?\d{1,3}\.\d{4,})(?:px|deg|%)?\s*(?:[,;]\s*|\s+|(?=-))(-?\d{1,3}\.\d{4,})(?![\d.])/g;
/* the same glued form OUTSIDE a masked span (a path string in JS/JSON/inline HTML that is not a d= attribute) */
const PAIR_SVG = /(?<![\w.])[MLCSQTAmlcsqta]\s*(-?\d{1,3}\.\d{4,})\s*(?:[,;]\s*|\s+|(?=-))(-?\d{1,3}\.\d{4,})(?![\d.])/g;
export function coordHitsText(text) {
  const spans = []; const t = maskExempt(text, spans); const out = [];
  const push = (m, v) => out.push({ v, at: m.index, endAt: m.index + m[0].length });
  for (const m of t.matchAll(KEYED_COORD)) if (dec(m[1]) >= 2) push(m, m[0]);
  for (const m of t.matchAll(NSEW)) if (dec(m[1]) >= 2 && dec(m[3]) >= 2 && +m[1] <= 90 && +m[3] <= 180) push(m, m[0]);
  for (const m of t.matchAll(NSEW_PRE)) if (dec(m[2]) >= 2 && dec(m[4]) >= 2 && +m[2] <= 90 && +m[4] <= 180) push(m, m[0]);
  for (const m of t.matchAll(PAIR)) {
    const a = +m[1], b = +m[2];
    if (dec(m[1]) < 2 || dec(m[2]) < 2) continue;
    const latlon = Math.abs(a) <= 90 && Math.abs(b) <= 180, lonlat = Math.abs(b) <= 90 && Math.abs(a) <= 180;
    const big = Math.abs(a) >= 10 && Math.abs(b) >= 10;
    const near = t.slice(Math.max(0, m.index - 160), m.index + m[0].length + 40);
    if ((latlon || lonlat) && big && (a < 0 || b < 0 || GEO.test(near))) push(m, m[0]);
  }
  for (const m of t.matchAll(PAIR_SVG)) {
    const a = +m[1], b = +m[2];
    const latlon = Math.abs(a) <= 90 && Math.abs(b) <= 180, lonlat = Math.abs(b) <= 90 && Math.abs(a) <= 180;
    if (!(latlon || lonlat) || Math.abs(a) < 1 || Math.abs(b) < 1) continue;
    if (GEO_MASKED.test(t.slice(Math.max(0, m.index - 160), m.index + m[0].length + 40))) push(m, m[0]);
  }
  for (const sp of spans) for (const m of sp.v.matchAll(PAIR4)) {
    const a = +m[1], b = +m[2];
    const latlon = Math.abs(a) <= 90 && Math.abs(b) <= 180, lonlat = Math.abs(b) <= 90 && Math.abs(a) <= 180;
    if (!(latlon || lonlat) || Math.abs(a) < 1 || Math.abs(b) < 1) continue;
    const near = t.slice(Math.max(0, sp.at - 160), sp.at + sp.v.length + 40);
    if (GEO_MASKED.test(near)) out.push({ v: m[0], at: sp.at + m.index, endAt: sp.at + m.index + m[0].length, masked: true });
  }
  return out;
}
/* ---------- box-only private lists (names + regexes); values never printed ---------- */
function loadPrivateLists() {
  const pats = []; const home = os.homedir();
  if (process.env.PII_GUARD_NO_BOX_DEFAULT) return { pats, loaded: false };
  const names = [process.env.WARDOS_PRIVATE_NAMES, path.join(home, ".local/share/wardos-private/private-names.tsv"), "/home/box/.local/share/wardos-private/private-names.tsv", path.join(home, ".config/wardos/private-names.tsv")].filter(Boolean).find((f) => fs.existsSync(f));
  const deny = [process.env.WARDOS_PRIVACY_DENYLIST, path.join(home, ".config/wardos/privacy-denylist.txt"), "/home/box/.config/wardos/privacy-denylist.txt"].filter(Boolean).find((f) => fs.existsSync(f));
  if (names) for (const ln of fs.readFileSync(names, "utf8").split("\n")) {
    if (!ln.trim() || ln.startsWith("#") || !ln.includes("\t")) continue;
    const name = ln.slice(ln.indexOf("\t") + 1).trim(); if (name.length < 3) continue;
    pats.push(new RegExp("\\b" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "gi"));
  }
  if (deny) for (const ln of fs.readFileSync(deny, "utf8").split("\n")) {
    const t = ln.trim(); if (!t || t.startsWith("#")) continue;
    try { pats.push(new RegExp(t, "gi")); } catch { /* bad regex skipped, not shown */ }
  }
  return { pats, loaded: !!(names || deny) };
}

/* ---------- scan ---------- */
const PH = /YOUR_|EXAMPLE|PLACEHOLDER|REDACTED|<[a-z_-]+>|x{6,}|\.\.\./i; /* documented placeholders are not secrets */
const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi; /* PIIGUARD2: bare UUID */
const HEX64 = /(?<![0-9a-fA-F])[0-9a-f]{64}(?![0-9a-fA-F])/g;
/* PIIGUARD4: a 64-hex value is exempt only when a hash label DIRECTLY precedes it ("sha256: <h>", "pin=<h>",
   "\"digest\": \"<h>\"", "checksum <h>"), or it is a sha256sum line ("<h>  path"). A label elsewhere on the line, e.g.
   a trailing "// pin" comment, no longer exempts it. */
const HEX_OK = /\b(?:pins?|pinned|sha-?256|sha256sum|digest|integrity|checksum|hash)(?:[_-][a-z0-9]{1,12})?["'`]?\s*[:=]?\s*["'`(\[]?\s*(?:sha-?256[:-])?$/i;
/* ...or an element of an array literal assigned to such a label on the same line: PIN = ["<h>", "<h>"] */
const HEX_OK_ARR = /\b(?:pins?|pinned|sha-?256|digests?|checksums?|hash(?:es)?)(?:[_-][a-z0-9]{1,12})?["'`]?\s*[:=]\s*\[\s*(?:["'`][0-9a-f]{64}["'`]\s*,\s*)*["'`]$/i;
const hexOk = (line, m) => HEX_OK.test(line.slice(Math.max(0, m.index - 48), m.index)) || HEX_OK_ARR.test(line.slice(0, m.index)) || (m.index === 0 && /^ [ *]\S/.test(line.slice(64, 67)));
const MARK = /pii-guard:allow\s+([a-z_]+)/;
const DATA_URI = /data:(text\/[\w.+-]+|application\/(?:json|xml|javascript|ecmascript|x-javascript|geo\+json|[\w.-]+\+(?:json|xml))|image\/svg\+xml)(?:;[\w.-]+=[\w.-]+)*;base64,([A-Za-z0-9+\/_-]+={0,2})/gi;
export function scanText(rel, text, ctx) {
  const lines = String(text).split("\n"); const out = []; const markers = [];
  lines.forEach((ln, i) => { const m = MARK.exec(ln); if (m) markers.push({ line: i + 1, cat: m[1] }); });
  const markAt = (i) => (MARK.exec(lines[i] || "") || [])[1];
  const add = (cat, v, i, j = i) => {
    if (cat !== "denylist" && cat !== "private_list" && (markAt(i) === cat || markAt(j) === cat)) return;
    out.push({ rel, line: i + 1, cat, h: sha16(v) });
  };
  /* whole-text passes */
  const starts = [0]; for (let i = 0; i < text.length; i++) if (text[i] === "\n") starts.push(i + 1);
  const lineOf = (off) => { let lo = 0, hi = starts.length - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid] <= off) lo = mid; else hi = mid - 1; } return lo; };
  /* PIIGUARD3: coords run on the original AND shadow copies (comments blanked; %XX/NFKC decoded per line); one hit per
     line + number pair (dedupe), the hash is over the numbers only */
  const decLines = lines.map(decodeLine), decText = decLines.join("\n");
  const variants = [text, stripComments(text)];
  if (decText !== text) variants.push(decText, stripComments(decText));
  const coordSeen = new Set();
  for (const vt of variants) {
    const st = [0]; for (let i = 0; i < vt.length; i++) if (vt[i] === "\n") st.push(i + 1);
    const lo = (off) => { let a = 0, b = st.length - 1; while (a < b) { const mid = (a + b + 1) >> 1; if (st[mid] <= off) a = mid; else b = mid - 1; } return a; };
    for (const c of coordHitsText(vt)) {
      const nums = (c.v.match(/-?\d+\.\d+/g) || []).join(","), i = lo(c.at), j = lo(Math.max(c.at, c.endAt - 1));
      if (coordSeen.has(i + "|" + nums)) continue; coordSeen.add(i + "|" + nums);
      add("precise_coords", nums, i, j);
    }
  }
  for (const d of denyHitsText(lines, ctx.deny)) add("denylist", d.v, d.line, d.end);
  /* line passes */
  const barePhones = BARE_PHONE_FILES.test(rel), jsPhones = JS_FILES.test(rel);
  lines.forEach((line, i) => {
    const seenE = new Set(), seen = new Set();
    const phone = (a, b, c, src, m) => { const d = a + b + c; if (seen.has(d) || b === "555" || ctx.allow.phone.has(d)) return; if (m && NOT_PHONE.has(d) && notPhoneCtx(src, m.index, m[0])) return; seen.add(d); add("phone", d, i); };
    for (const src of decLines[i] === line ? [line] : [line, decLines[i]]) { /* PIIGUARD3: also the %XX/NFKC-decoded line */
      const decoded = src.replace(/%40/gi, "@").replace(/&#0*64;?/g, "@").replace(/&#x0*40;?/gi, "@").replace(/&commat;/gi, "@");
      for (const m of decoded.matchAll(EMAIL)) { const v = m[0].toLowerCase(); if (seenE.has(v)) continue; seenE.add(v); if (!SAFE_EMAIL_DOMAIN.test(v) && !ctx.allow.email.has(v)) add("email", m[0], i); }
      for (const m of src.matchAll(PHONE)) phone(m[1], m[2], m[3]);
      for (const m of src.matchAll(TEL)) phone(m[1], m[2], m[3]);
      if (barePhones) for (const m of src.matchAll(BARE_PHONE)) phone(m[1], m[2], m[3], src, m); /* only bare rules pass m */
      if (jsPhones) { for (const m of src.matchAll(JS_QUOTED_PHONE)) phone(m[2], m[3], m[4], src, m); for (const m of src.matchAll(JS_KEYED_PHONE)) phone(m[1], m[2], m[3]); }
    }
    for (const rx of TOKENS) for (const m of line.matchAll(rx)) if (!PH.test(m[0])) add("token", m[0], i);
    for (const rx of DEVICE) for (const m of line.matchAll(rx)) if (!PH.test(m[0])) add("device_id", m[0], i);
    for (const m of line.matchAll(UUID)) if (!ctx.allow.id.has(sha16(m[0].toLowerCase()))) add("uuid", m[0], i);
    for (const m of line.matchAll(HEX64)) if (!hexOk(line, m) && !ctx.allow.id.has(sha16(m[0]))) add("hex_key", m[0], i);
    if (ctx.priv) for (const rx of ctx.priv.pats) for (const m of line.matchAll(rx)) add("private_list", m[0], i);
  });
  /* PIIGUARD3 P3: base64 data: URIs with a text MIME type (<= 64 KB decoded) are decoded and scanned as text; hits
     report the line the URI starts on. One level deep. */
  if (!ctx.inData) for (const m of text.matchAll(DATA_URI)) {
    if (m[2].length > 87400) continue;
    let dec; try { dec = Buffer.from(m[2].replace(/\s+/g, ""), m[2].includes("-") || m[2].includes("_") ? "base64url" : "base64"); } catch { continue; }
    if (dec.length > 65536 || !isText(dec)) continue;
    const at = lineOf(m.index);
    for (const h of scanText(rel, dec.toString("utf8"), { ...ctx, inData: true, audit: null })) if (h.cat !== "allow_unlisted") out.push({ rel, line: at + 1, cat: h.cat, h: h.h });
  }
  /* PIIGUARD2 allow-marker audit: every marker is listed; a marker outside a "marker <path>" file is itself a hit */
  for (const mk of markers) {
    ctx.audit && ctx.audit.push({ rel, ...mk });
    if (!ctx.allow.marker.has(rel)) out.push({ rel, line: mk.line, cat: "allow_unlisted", h: sha16(rel + ":" + mk.line) });
  }
  const uniq = new Set();
  return out.filter((h) => { const k = h.line + "|" + h.cat + "|" + h.h; if (uniq.has(k)) return false; uniq.add(k); return true; });
}
export function scanLine(line, rel, ctx) { return scanText(rel, line, ctx).map(({ cat, h }) => ({ cat, h })); }

/* ---------- blobs ---------- */
const BIN = /\.(png|jpe?g|webp|gif|ico|jxl|heic|avif|bmp|tiff?|mkv|avi|webm|mp3|ogg|wav|m4a|woff2?|ttf|otf|eot|mp4|mov|m4v|pdf|zip|gz|tgz|br|wasm)$/i;
/* PIIGUARD2: no SELF exemption. The guard's own files are scanned like any other; fixtures are built at runtime and
   the few literal lines carry a reviewed allow marker (marker files are listed in pii-guard-allow.txt). */
class GuardError extends Error {}
function blobs(args, git) {
  const val = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
  const g = (a, what) => { try { return git(a); } catch { throw new GuardError(what); } };
  if (args.includes("--staged")) return g(["diff", "--cached", "--name-only", "-z", "--diff-filter=ACMR"], "cannot list staged files").toString().split("\0").filter(Boolean).map((rel) => ({ rel, read: () => git(["show", ":" + rel]) }));
  if (val("--range")) {
    const range = val("--range"); const out = [], seen = new Set();
    if (/(^|\.\.)(0{40})?$|^\s*$/.test(range) || /\b0{40}\b/.test(range)) throw new GuardError("range has an empty or all-zero end (force-push / new ref): scan the full tree with --rev instead");
    for (const end of range.split("..")) g(["rev-parse", "--verify", "--quiet", end + "^{commit}"], `range end not found (force-pushed or not fetched): ${end.slice(0, 12)}`);
    for (const c of g(["rev-list", ...range.split(/\s+/)], "rev-list failed").toString().split("\n").filter(Boolean))
      for (const rel of git(["diff-tree", "--no-commit-id", "-r", "-z", "--diff-filter=ACMR", "--name-only", "--root", c]).toString().split("\0").filter(Boolean)) {
        if (seen.has(c + rel)) continue; seen.add(c + rel);
        out.push({ rel, at: c.slice(0, 8), read: () => git(["show", c + ":" + rel]) });
      }
    return out;
  }
  if (val("--rev")) { const r = val("--rev"); return g(["ls-tree", "-r", "-z", "--name-only", r], `rev not found: ${String(r).slice(0, 40)}`).toString().split("\0").filter(Boolean).map((rel) => ({ rel, read: () => git(["show", r + ":" + rel]) })); }
  const root = g(["rev-parse", "--show-toplevel"], "not a git work tree").toString().trim();
  return git(["ls-files", "-z", "--cached", "--others", "--exclude-standard"]).toString().split("\0").filter(Boolean)
    .filter((rel) => { try { return fs.statSync(path.join(root, rel)).isFile(); } catch { return false; } })
    .map((rel) => ({ rel, read: () => fs.readFileSync(path.join(root, rel)) }));
}
const utf8 = new TextDecoder("utf-8", { fatal: true });
const isText = (buf) => { if (buf.includes(0)) return false; try { utf8.decode(buf); return true; } catch { return false; } };

export function main(args = process.argv.slice(2), cwd = process.cwd()) {
  const val = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
  const git = (a) => execFileSync("git", a, { cwd, maxBuffer: 1 << 28, stdio: ["ignore", "pipe", "ignore"] });
  const gh = !!process.env.GITHUB_ACTIONS;
  let deny;
  try { deny = loadDenylist(); } catch (e) { console.log("FAIL: " + e.message); return 2; }
  const allowFp = path.join(HERE, "pii-guard-allow.txt");
  const ctx = { deny, allow: loadAllow(fs.existsSync(allowFp) ? fs.readFileSync(allowFp, "utf8") : ""), priv: args.includes("--private-lists") ? loadPrivateLists() : null, audit: [] };
  const only = val("--only") ? new RegExp(val("--only")) : null, skip = val("--skip") ? new RegExp(val("--skip")) : null;
  let all;
  try { all = blobs(args, git); } catch (e) { if (e instanceof GuardError) { console.log("FAIL: pii-guard: " + e.message); return 2; } console.log("FAIL: pii-guard: git error (not shown)"); return 2; }
  const skips = { path_filter: 0, binary_ext: 0, unreadable: 0 }; const hits = []; let scanned = 0;
  for (const b of all) {
    if ((only && !only.test(b.rel)) || (skip && skip.test(b.rel))) { skips.path_filter++; continue; }
    let buf; try { buf = b.read(); } catch { skips.unreadable++; continue; }
    const rel = b.at ? `${b.rel} @${b.at}` : b.rel;
    if (BIN.test(b.rel)) {
      /* a binary extension must hold binary: text under a .png etc. is scanned AND flagged */
      if (buf.length && isText(buf)) { hits.push({ rel, line: 0, cat: "text_in_binary", h: sha16(b.rel) }); }
      else { skips.binary_ext++; continue; }
    } else if (buf.includes(0)) { hits.push({ rel, line: 0, cat: "nul_in_text", h: sha16(b.rel) }); continue; }
    scanned++;
    for (const h of scanText(b.rel, buf.toString("utf8"), ctx)) hits.push({ ...h, rel });
  }
  const byCat = {};
  for (const h of hits) byCat[h.cat] = (byCat[h.cat] || 0) + 1;
  for (const h of hits.slice(0, 500)) console.log(`PII ${h.cat}  ${h.rel}:${h.line}  sha16=${h.h}`);
  if (hits.length > 500) console.log(`… ${hits.length - 500} more`);
  for (const a of ctx.audit) console.log(`ALLOW ${a.cat}  ${a.rel}:${a.line}${ctx.allow.marker.has(a.rel) ? "" : "  (UNLISTED)"}`);
  if (!deny.n) console.log((gh ? "::warning::" : "WARN: ") + "no private pii-guard denylist loaded (box file or PII_GUARD_DENYLIST/PII_GUARD_KEY secrets); generic rules only");
  if (ctx.priv && !ctx.priv.loaded) console.log("WARN: --private-lists asked but no box name/regex list found");
  console.log(`pii-guard: ${scanned} files · ${hits.length} hit(s) · ${JSON.stringify(byCat)} · skips ${JSON.stringify(skips)} · allow-markers ${ctx.audit.length} · denylist hashes ${deny.n} (${deny.src})`);
  if (args.includes("--require-denylist") && !deny.n) { console.log("FAIL: --require-denylist and no denylist loaded"); return 2; }
  return hits.length ? 1 : 0;
}
let isMain = false;
try { isMain = !!process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url)); } catch { isMain = false; }
if (isMain) process.exit(main());
