// KIDPATH1 · scripts/wall/kid-path-copy.mjs · branch wall-redesign-1 (Wright).
// Pulls the words a kid can SEE out of a kid-path file and lists the banned ones (Alfred KL-05 / Dan rulings Oct 1):
// no $ except Ainsley's one babysit tag "$15/hr", no jar, no XP, no Bal, no "Show me the Money", no Mom wording.
// Visible copy = HTML text + aria-label/title/placeholder/alt, plus JS string literals (tags stripped) and JSON string values.
// Code tokens (class names, selectors, storage keys, ids) are not copy and are skipped.
// CLI: node scripts/wall/kid-path-copy.mjs [files...]  -> prints hits, exit 1 if any.
import fs from "node:fs";

export const KID_PATH_FILES = ["house-kid-engage.js", "sheet-index.html", "kid-ainsley.html", "kids-data.js", "kids-week.json",
  "sheet-chores.html", "sheet-allowance.html", "sheet-pack.html", "sheet-win.html"];
export const ALLOWED_TAG = "$15/hr";
export const BANNED = [
  ["$", (s) => s.split(ALLOWED_TAG).join("").includes("$")],
  ["jar", (s) => /\bjars?\b/i.test(s)],
  ["XP", (s) => /\bXP\b/.test(s)],
  ["Bal", (s) => /\bBal\b/.test(s)],
  ["Show me the Money", (s) => /show me the money/i.test(s)],
  ["Mom", (s) => /\bmoms?\b|\bmommy\b|\bmom['’]s\b/i.test(s)],
];
const ent = (s) => s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#36;/g, "$");
/** string looks like code, not copy: no whitespace, no $, and (has - _ [ ] # . : / = or is all lowercase/digits) */
export function codeToken(s) {
  const x = s.trim();
  if (!x) return true;
  if (/\s/.test(x)) return false;
  if (x.includes("$")) return false; /* a $ string is always copy: "$5/hr" must not hide as a token */
  return /[-_[\]#.:/=]/.test(x) || /^[a-z0-9]+$/.test(x);
}
/** JS string literals (and template text) in source order, comments skipped. Heuristic regex-literal skip. */
export function jsStrings(src) {
  const out = []; let i = 0; const n = src.length; let prev = "";
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === "/" && d === "/") { while (i < n && src[i] !== "\n") i++; continue; }
    if (c === "/" && d === "*") { const e = src.indexOf("*/", i + 2); i = e < 0 ? n : e + 2; continue; }
    if (c === '"' || c === "'" || c === "`") {
      let j = i + 1, s = "";
      while (j < n && src[j] !== c) {
        if (src[j] === "\\") { s += src[j + 1] === "n" ? "\n" : src[j + 1]; j += 2; continue; }
        if (c === "`" && src[j] === "$" && src[j + 1] === "{") { let depth = 1; j += 2; while (j < n && depth) { if (src[j] === "{") depth++; else if (src[j] === "}") depth--; j++; } s += " "; continue; }
        if (c !== "`" && src[j] === "\n") break;
        s += src[j]; j++;
      }
      out.push({ s, at: i }); i = j + 1; prev = "x"; continue;
    }
    if (c === "/" && /[(,=:[!&|?{};+\-*%<>~^]$|^$|return$|typeof$/.test(prev.trim() ? prev : "")) {
      let j = i + 1, cls = false;
      while (j < n && src[j] !== "\n") { if (src[j] === "\\") { j += 2; continue; } if (src[j] === "[") cls = true; else if (src[j] === "]") cls = false; else if (src[j] === "/" && !cls) break; j++; }
      i = j + 1; while (i < n && /[a-z]/i.test(src[i])) i++; prev = "x"; continue;
    }
    if (!/\s/.test(c)) prev = /[\w$]/.test(c) ? (/[\w$]/.test(prev.slice(-1)) ? prev + c : c) : c;
    i++;
  }
  return out;
}
function lineAt(src, at) { return src.slice(0, at).split("\n").length; }
/** [{line, text}] of visible copy */
export function visibleCopy(file, src) {
  const out = [];
  const push = (text, at, base = src) => { const t = ent(text).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(); if (t && !codeToken(t)) out.push({ line: lineAt(base, at), text: t }); };
  if (file.endsWith(".json")) {
    const lines = src.split("\n");
    const walk = (v, k) => {
      if (typeof v === "string") { if (k === "id" || /Id$|^key$|href$|^cls$/.test(k)) return; if (!codeToken(v)) { const ln = lines.findIndex((l) => l.includes(JSON.stringify(v).slice(1, -1).slice(0, 40))); out.push({ line: ln + 1, text: v }); } }
      else if (Array.isArray(v)) v.forEach((x) => walk(x, k));
      else if (v && typeof v === "object") for (const kk of Object.keys(v)) walk(v[kk], kk);
    };
    walk(JSON.parse(src), "");
    return out;
  }
  if (file.endsWith(".js")) { jsStrings(src).forEach((x) => push(x.s, x.at)); return out; }
  // HTML: scripts -> JS strings; style + comments + <svg> defs dropped; text nodes + copy attributes
  const re = /<script\b[^>]*>([\s\S]*?)<\/script>/gi; let m;
  while ((m = re.exec(src))) {
    const body = m[1], off = m.index + m[0].indexOf(body);
    jsStrings(body).forEach((x) => push(x.s, off + x.at));
  }
  const blank = (s) => s.replace(/[^\n]/g, " ");
  let h = src.replace(/<script\b[\s\S]*?<\/script>/gi, blank).replace(/<style\b[\s\S]*?<\/style>/gi, blank).replace(/<!--[\s\S]*?-->/g, blank);
  const at = /\s(?:aria-label|title|placeholder|alt)="([^"]*)"/g;
  while ((m = at.exec(h))) push(m[1], m.index);
  const tx = />([^<]+)</g;
  while ((m = tx.exec(h))) push(m[1], m.index + 1);
  return out;
}
export function hits(file, src) {
  const res = [];
  for (const v of visibleCopy(file, src)) for (const [name, f] of BANNED) if (f(v.text)) res.push({ file, line: v.line, rule: name, text: v.text.slice(0, 160) });
  return res;
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const root = new URL("../../", import.meta.url);
  const files = process.argv.slice(2).length ? process.argv.slice(2) : KID_PATH_FILES;
  let all = [];
  for (const f of files) all = all.concat(hits(f, fs.readFileSync(new URL(f, root), "utf8")));
  all.forEach((h) => console.log(`${h.file}:${h.line} [${h.rule}] ${h.text}`));
  console.log(all.length + " hits");
  process.exit(all.length ? 1 : 0);
}
