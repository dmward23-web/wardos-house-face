/* PRIVFEED1 · the one box-only folder that holds every private runtime file (calendar, kids-week, cam stills,
 * Ledger QA contract). Never inside a git work tree, never served by Pages. The house hub serves it with a token.
 *   WARDOS_PRIVATE_DIR overrides (tests point it at a temp dir). Default ~/.local/share/wardos-private (mode 700). */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const PRIVATE_DIR = path.resolve(process.env.WARDOS_PRIVATE_DIR || path.join(os.homedir(), ".local", "share", "wardos-private"));

export function privPath(...parts) {
  return path.join(PRIVATE_DIR, ...parts);
}

/** true when p sits inside this repo checkout (or any git work tree we can see). */
export function insideRepo(p) {
  const abs = path.resolve(p);
  if (abs === ROOT || abs.startsWith(ROOT + path.sep)) return true;
  let d = path.dirname(abs);
  while (d && d !== path.dirname(d)) {
    if (fs.existsSync(path.join(d, ".git"))) return true;
    d = path.dirname(d);
  }
  return false;
}

/** Producers call this before writing private data. Fail closed: private data never lands in a work tree. */
export function assertPrivateOut(p, what = "private data") {
  if (insideRepo(p)) {
    console.error(`PRIVFEED1 HARD FAIL: refusing to write ${what} inside a git work tree: ${p}\n` +
      `  private files live in ${PRIVATE_DIR} (set WARDOS_PRIVATE_DIR to move it).`);
    process.exit(9);
  }
  fs.mkdirSync(path.dirname(p), { recursive: true, mode: 0o700 });
  return p;
}

/** NAMESDIR1 · where private-names.tsv lives: WARDOS_PRIVATE_NAMES=<path>, else the private data dir
 *  (~/.local/share/wardos-private/private-names.tsv, mode 600), else the old ~/.config/wardos/private-names.tsv (fallback). */
export function privateNamesPath() {
  if (process.env.WARDOS_PRIVATE_NAMES) return process.env.WARDOS_PRIVATE_NAMES;
  const primary = path.join(PRIVATE_DIR, "private-names.tsv");
  if (fs.existsSync(primary)) return primary;
  return path.join(os.homedir(), ".config", "wardos", "private-names.tsv");
}
/** PRIVNAME1 roles (partner / coparent / …) from private-names.tsv (privateNamesPath()), WARDOS_PRIVATE_NAMES=<path>,
 *  or WARDOS_NAMES="partner=X;coparent=Y" (tests). Never in git. Missing = empty lists (callers decide). */
export function privateNames() {
  const out = {};
  const add = (role, name) => {
    role = String(role || "").trim().toLowerCase(); name = String(name || "").trim();
    if (role && name) (out[role] = out[role] || []).push(name);
  };
  if (process.env.WARDOS_NAMES) {
    for (const kv of process.env.WARDOS_NAMES.split(";")) { const i = kv.indexOf("="); if (i > 0) add(kv.slice(0, i), kv.slice(i + 1)); }
    return out;
  }
  const fp = privateNamesPath();
  if (!fs.existsSync(fp)) return out;
  for (const ln of fs.readFileSync(fp, "utf8").split("\n")) {
    if (!ln.trim() || ln.startsWith("#") || !ln.includes("\t")) continue;
    const i = ln.indexOf("\t"); add(ln.slice(0, i), ln.slice(i + 1));
  }
  return out;
}
export function namesRe(role, flags = "i") {
  const list = (privateNames()[role] || []).map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return list.length ? new RegExp("\\b(?:" + list.join("|") + ")\\b", flags) : /(?!)/;
}

/* EXTFILTER1 · twin of scripts/text_law.py external_filter(): external calendar rows are filtered (terms from
   privateNames(), never in git). A matching row is dropped; any other match is replaced by the placeholder. Case-insensitive. */
/* EXTNAMES1 · the only roles ever filtered (partner, coparent, household and school never are); calendar-refresh.mjs
   imports this, scripts/text_law.py carries the Python twin. */
export const EXT_ROLES = Object.freeze(["external", "otherfamily"]);
export const EXT_PLACEHOLDER = "Friends";
let _exCache = null;
function exRes() {
  if (_exCache) return _exCache;
  /* case-insensitive term */
  const ci = (n) => n.split("").map((c) => (/[a-z]/i.test(c) ? "[" + c.toUpperCase() + c.toLowerCase() + "]" : c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))).join("");
  const pn = privateNames();
  const list = EXT_ROLES.flatMap((r) => pn[r] || []).map(ci);
  if (!list.length) return (_exCache = {});
  const alt = "(?:" + list.join("|") + ")";
  return (_exCache = {
    drop: new RegExp("\\b(?!(?:The|Ward|Kids|Dad|Dan|At)\\b)[A-Z][a-z]+ " + alt + "\\b(?![ \\t]+(?:[Kk]ids|KIDS|[Ff]amily|FAMILY|[Hh]ouse|HOUSE)\\b)"),
    dropRev: new RegExp("\\b" + alt + ",\\s*(?!(?:Kids|Family|House)\\b)[A-Z][a-z]+\\b"),
    poss: new RegExp("\\b" + alt + "['\\u2019][Ss]\\b", "g"),
    word: new RegExp("\\b" + alt + "(?:[Ee]?[Ss])?\\b", "g"),
  });
}
export function externalDrop(s) {
  const r = exRes(); if (!r.drop || typeof s !== "string") return false;
  return r.drop.test(s) || r.dropRev.test(s);
}
export function externalMask(s) {
  const r = exRes(); if (!r.word || typeof s !== "string") return s;
  return s.replace(r.poss, EXT_PLACEHOLDER + "'").replace(r.word, EXT_PLACEHOLDER).replace(/\s{2,}/g, " ").trim();
}
/* LIVEFIX1 · therapy law at ingest: generic words (house-face-law.js THERAPY, shared with the glass) plus provider / person
   names from the box-only ~/.config/wardos/privacy-block.txt (one regex per line, never in git; missing = generic only). */
let _thCache = null;
function therapyRe() {
  if (_thCache) return _thCache;
  const g = (globalThis.HouseFaceLaw && globalThis.HouseFaceLaw.THERAPY) ? globalThis.HouseFaceLaw.THERAPY.source : "\\btherap|\\bcounsel|\\bpsycholog|\\bpsychiatr|\\banxiety\\b";
  let extra = [];
  try {
    extra = fs.readFileSync(path.join(os.homedir(), ".config", "wardos", "privacy-block.txt"), "utf8").split("\n")
      .map((l) => l.trim()).filter((l) => l && !l.startsWith("#"))
      .filter((l) => { try { new RegExp(l, "i"); return true; } catch { return false; } });
  } catch { extra = []; }
  return (_thCache = new RegExp([g].concat(extra).join("|"), "i"));
}
export function therapyDrop(s) { return typeof s === "string" && therapyRe().test(s); }
/** filter any event list: matching rows out, term masked in summary/title. LIVEFIX1: therapy rows out. */
export function externalEvents(events) {
  return (events || []).filter((e) => !(e && (externalDrop(e.summary) || externalDrop(e.title) || therapyDrop(e.summary) || therapyDrop(e.title))))
    .map((e) => (e && (typeof e.summary === "string" || typeof e.title === "string"))
      ? { ...e, ...(typeof e.summary === "string" ? { summary: externalMask(e.summary) } : {}), ...(typeof e.title === "string" ? { title: externalMask(e.title) } : {}) }
      : e);
}
