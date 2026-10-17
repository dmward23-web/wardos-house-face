#!/usr/bin/env node
/**
 * PRIVFEED1 · privacy scan. The repo is PUBLIC: nothing private may enter any commit on any branch.
 * Prints path:line and the CATEGORY only, never the matched value. Exit 1 on any hit.
 *
 *   node scripts/privacy-scan.mjs --staged            pre-commit: staged blobs
 *   node scripts/privacy-scan.mjs --range A..B        pre-push: every blob changed by every commit in the range
 *   node scripts/privacy-scan.mjs --rev <rev>         whole tree of a commit
 *   node scripts/privacy-scan.mjs --tree              whole working tree (tracked + untracked, not ignored)
 *   --report <file.md>                                also write a markdown report (categories only)
 *
 * Generic patterns live here. Names, places, schools, providers and figures that must never appear are read from
 * the box: private-names.tsv (~/.local/share/wardos-private, fallback ~/.config/wardos; every name column) + ~/.config/wardos/privacy-denylist.txt
 * (one regex per line). WARDOS_PRIVACY_DENYLIST / WARDOS_PRIVATE_NAMES override. When neither exists (CI, cloud
 * builders) the generic patterns still run and a WARN line says so (--require-denylist turns that into a failure).
 * A line may opt out of ONE generic category with a trailing comment:  privacy-scan:allow <category>
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const has = (k) => args.includes(k);
const val = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const git = (a, opts = {}) => execFileSync("git", a, { cwd: ROOT, maxBuffer: 1 << 28, ...opts });

const BIN = /\.(png|jpe?g|webp|gif|ico|woff2?|ttf|otf|mp4|mov|pdf|zip|gz)$/i;
const IMG = /\.(png|jpe?g|webp|gif|heic)$/i;
const PRIVATE_PATHS = [
  /^data\/(cal-live|cal-months|kids-week|cash|lights-live|sensi-live|nest-live)\.json$/, /* PRIVFEED2: house device state */ /^kids-week\.json$/, /(^|\/)[^/]*\.private\.(json|tsv)$/,
  /^data\/calendar-.*\.json$/, /\.ics$/i, /(^|\/)\.env/, /\.token$/,
];
const PRIVATE_IMG_DIRS = [/^data\//, /^phone-shots\//, /(^|\/)nest-snaps\//, /(^|\/)photos?\//i];
/* PRIVFEED3 · ANY image or video in the tree is flagged unless its exact repo path is in
   scripts/privacy-art-allowlist.txt (hand-made art, icons, UI vectors only; one path per line). Camera stills,
   screenshots and photos can never ride in by accident: a new image is a deliberate, reviewed allow-list line. */
const ANY_IMG = /\.(png|jpe?g|webp|gif|heic|heif|avif|bmp|tiff?|svg|mp4|mov|m4v|webm)$/i;
function loadArtAllow() {
  let txt = "";
  try { txt = val("--rev") ? git(["show", val("--rev") + ":scripts/privacy-art-allowlist.txt"]).toString() : fs.readFileSync(path.join(ROOT, "scripts", "privacy-art-allowlist.txt"), "utf8"); } catch { txt = ""; }
  return new Set(txt.split(/\r?\n/).map((l) => l.replace(/#.*/, "").trim()).filter(Boolean));
}
const ART_ALLOW = loadArtAllow();

const GENERIC = [
  ["email", /[A-Za-z0-9._%+-]+@(?!users\.noreply\.github\.com)[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.(?!png|jpe?g|webp|svg|js|css|json|mjs|html)[A-Za-z]{2,}\b/],
  ["money_figure", /\$\s?\d{1,3}(?:,\d{3})+(?:\.\d\d)?|\$\d+\.\d\d\b|\$\d+(?:\.\d)?k\b/i],
  ["booking_code", /#(?=[A-Z0-9]{6}\b)(?=[A-Z0-9]*[G-Z])(?=[A-Z0-9]*\d)[A-Z0-9]{6}\b/],
  ["flight_number", /\b(?:WN|AA|UA|DL|AS|B6|NK|F9)\s?\d{2,4}\b/],
  ["street_address", /\b\d{3,6}\s+(?:[NSEW]\.?\s+)?(?:\d+(?:st|nd|rd|th)|[A-Z][a-z]+)(?:\s[A-Z][a-z]+)?\s(?:St|Street|Ave|Avenue|Rd|Road|Dr|Drive|Ln|Lane|Ct|Court|Blvd|Ter|Terrace|Pkwy|Parkway|Way|Cir|Circle|Pl|Place)\b/],
  ["phone", /(?<![\d.\w])\(?\d{3}\)?[-. ]\d{3}[-. ]\d{4}(?![\d])/],
  ["precise_coords", /\b(?:LAT|LON|LNG|latitude|longitude)\b["']?\s*[:=]\s*-?\d{1,3}\.\d{3,}/i],
  ["token_shape", /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|ya29\.[0-9A-Za-z_-]{20,}|1\/\/0[0-9A-Za-z_-]{20,}|AIza[0-9A-Za-z_-]{35}|GOCSPX-[0-9A-Za-z_-]{10,}|sk_live_[0-9A-Za-z]{10,}|xox[bp]-[0-9A-Za-z-]{10,})|-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  /* PRIVFEED2 · house device state + hub addresses + allowance + kid birthday markup */
  ["device_path", /\benterprises\/[A-Za-z0-9_-]{6,}\/devices\/[A-Za-z0-9_-]{6,}/],
  ["hardware_id", /\b[0-9a-f]{2}(?:[-:][0-9a-f]{2}){5,7}\b/i],
  ["hub_url", /"(?:writeProxy|nestProxy|lightsProxy|hubUrl)"\s*:\s*"https:\/\/|https:\/\/[a-z0-9-]+\.trycloudflare\.com/i],
  ["allowance_figure", /\$\d{1,3}(?:\.\d\d)?\s?(?:ea\s?)?(?:wk|\/\s?hr|\/\s?week|per week)\b|\bJar\s*·\s*\$\d+|\$\d+\s*\/\s*\$\d+/i],
  /* CALSCRUB1 · stadium/venue seat codes (section / row / seats), any order */
  ["seat_code", /\bSec(?:tion)?\.?\s*[A-Z]?\d{1,4}[A-Z]?\b\s*[,·\/-]?\s*Row\s*[A-Z0-9]{1,3}\b|\bRow\s*[A-Z0-9]{1,3}\s*[,·\/-]?\s*Seats?\s*\d{1,3}\b|\bSec(?:tion)?\.?\s*\d{1,4}\s*[,·\/-]?\s*Seats?\s*\d{1,3}\b/i],
  ["kid_birthday", /\b(?:Ainsley|Hayes|Harris)(?:'s)?\s+(?:birthday|bday)\b/i],
];
/* dated birthday rows (calendar-shaped content only) */
const BDAY = /\b[A-Z][a-z]+ (?:birthday|bday)\b/;
const DATEISH = /\b\d{4}-\d\d-\d\d\b|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2}\b/;

function loadDeny() {
  const pats = [];
  const home = os.homedir();
  /* NAMESDIR1 · same order as scripts/private-dir.mjs privateNamesPath(): env, private data dir, old ~/.config/wardos */
  const namesPrimary = path.join(process.env.WARDOS_PRIVATE_DIR || path.join(home, ".local", "share", "wardos-private"), "private-names.tsv");
  const namesFp = process.env.WARDOS_PRIVATE_NAMES || (fs.existsSync(namesPrimary) ? namesPrimary : path.join(home, ".config", "wardos", "private-names.tsv"));
  const denyFp = process.env.WARDOS_PRIVACY_DENYLIST || path.join(home, ".config", "wardos", "privacy-denylist.txt");
  let found = 0;
  if (fs.existsSync(namesFp)) {
    found++;
    for (const ln of fs.readFileSync(namesFp, "utf8").split("\n")) {
      if (!ln.trim() || ln.startsWith("#") || !ln.includes("\t")) continue;
      const role = ln.slice(0, ln.indexOf("\t")).trim().toLowerCase();
      const name = ln.slice(ln.indexOf("\t") + 1).trim();
      const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      /* SCHOOLKEY2 · school names: '_' and digits count as a boundary, so "<code>_drop" style keys are caught (\b treats
         '_' as a word character and missed them). No i flag: each letter is its own [Xx] class, so a capital right after the
         name (<CODE>Drop, <CODE>X) is caught while a lowercase letter after it, or any letter before it, still blocks. */
      if (role === "school" && name.length >= 2) {
        const cls = Array.from(name).map((ch) => /[A-Za-z]/.test(ch) ? "[" + ch.toUpperCase() + ch.toLowerCase() + "]" : /\s/.test(ch) ? "\\s+" : ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("");
        pats.push(new RegExp("(?<![A-Za-z])" + cls + "(?![a-z])"));
      }
      else if (name.length >= 3) pats.push(new RegExp("\\b" + esc + "\\b", "i"));
    }
  }
  if (fs.existsSync(denyFp)) {
    found++;
    for (const ln of fs.readFileSync(denyFp, "utf8").split("\n")) {
      const t = ln.trim();
      if (!t || t.startsWith("#")) continue;
      try { pats.push(new RegExp(t, "i")); } catch { console.error("privacy-scan: bad denylist regex skipped (line not shown)"); }
    }
  }
  return { pats, found };
}

/* CALSCRUB1 · calendar-derived strings (event titles, places, seat and confirmation codes) from the private caches.
 * Box-only list: WARDOS_CAL_STRINGS or <private dir>/calstrings.local.txt ("kind<TAB>string" lines). Exact,
 * case-insensitive substring match; the strings themselves are never printed. Missing list = skipped (noted). */
function loadCalStrings() {
  const dir = process.env.WARDOS_PRIVATE_DIR || path.join(os.homedir(), ".local", "share", "wardos-private");
  const fp = process.env.WARDOS_CAL_STRINGS || path.join(dir, "calstrings.local.txt");
  if (!fs.existsSync(fp)) return null;
  const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const needles = fs.readFileSync(fp, "utf8").split("\n").filter((l) => l && !l.startsWith("#") && l.includes("\t")).map((l) => l.slice(l.indexOf("\t") + 1).trim()).filter((x) => x.length >= 6);
  return needles.length ? new RegExp(needles.sort((a, b) => b.length - a.length).map(esc).join("|"), "i") : null;
}
const CAL_STRINGS = has("--no-calstrings") ? null : loadCalStrings();

/* synthetic QA fixtures may carry fake money figures and fake dated birthdays (denylist still applies) */
const FIXTURE_ALLOW = { seat_code: /^scripts\/qa\/fixtures\//, money_figure: /^scripts\/qa\/fixtures\//, birthday_dated: /^scripts\/qa\/fixtures\//, allowance_figure: /^scripts\/qa\/fixtures\// };
function scanText(rel, text, deny, hits) {
  const isJson = /\.json$/i.test(rel);
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.length > 20000 && !isJson) { /* minified blob: still scanned */ }
    const allow = /privacy-scan:allow\s+([a-z_]+)/.exec(line);
    for (const [cat, rx] of GENERIC) {
      if (allow && allow[1] === cat) continue;
      if (FIXTURE_ALLOW[cat] && FIXTURE_ALLOW[cat].test(rel)) continue;
      if (rx.test(line)) hits.push({ rel, line: i + 1, cat });
    }
    if (BDAY.test(line) && (isJson || DATEISH.test(line)) && !(allow && allow[1] === "birthday_dated") && !FIXTURE_ALLOW.birthday_dated.test(rel)) hits.push({ rel, line: i + 1, cat: "birthday_dated" });
    for (const rx of deny.pats) if (rx.test(line)) { hits.push({ rel, line: i + 1, cat: "denylist" }); break; }
    if (CAL_STRINGS && CAL_STRINGS.test(line) && !(allow && allow[1] === "calendar_string")) hits.push({ rel, line: i + 1, cat: "calendar_string" });
  }
}

function checkPath(rel, hits) {
  if (PRIVATE_PATHS.some((rx) => rx.test(rel))) hits.push({ rel, line: 0, cat: "private_data_file" });
  if (IMG.test(rel) && PRIVATE_IMG_DIRS.some((rx) => rx.test(rel))) hits.push({ rel, line: 0, cat: "private_image" });
  else if (ANY_IMG.test(rel) && !ART_ALLOW.has(rel)) hits.push({ rel, line: 0, cat: "unlisted_image" });
}

function blobsFor() {
  /* returns [{rel, read: () => Buffer}] */
  if (has("--staged")) {
    const names = git(["diff", "--cached", "--name-only", "-z", "--diff-filter=ACMR"]).toString().split("\0").filter(Boolean);
    return names.map((rel) => ({ rel, read: () => git(["show", ":" + rel]) }));
  }
  if (val("--range")) {
    const out = [];
    const seen = new Set();
    const revs = git(["rev-list", ...val("--range").split(/\s+/).filter(Boolean)]).toString().split("\n").filter(Boolean);
    for (const c of revs) {
      const changed = git(["diff-tree", "--no-commit-id", "-r", "-z", "--diff-filter=ACMR", "--name-only", "--root", c]).toString().split("\0").filter(Boolean);
      for (const rel of changed) {
        const key = c + ":" + rel; if (seen.has(key)) continue; seen.add(key);
        out.push({ rel: rel + " @" + c.slice(0, 8), path: rel, read: () => git(["show", c + ":" + rel]) });
      }
    }
    return out;
  }
  if (val("--rev")) {
    const rev = val("--rev");
    const names = git(["ls-tree", "-r", "-z", "--name-only", rev]).toString().split("\0").filter(Boolean);
    return names.map((rel) => ({ rel, read: () => git(["show", rev + ":" + rel]) }));
  }
  const names = git(["ls-files", "-z", "--cached", "--others", "--exclude-standard"]).toString().split("\0").filter(Boolean);
  return names.filter((rel) => fs.existsSync(path.join(ROOT, rel))).map((rel) => ({ rel, read: () => fs.readFileSync(path.join(ROOT, rel)) }));
}

function main() {
  const deny = loadDeny();
  const hits = [];
  /* HUBPIN1 · test isolation: --only <regex> scans just matching paths, --skip <regex> leaves matching paths out
     (parallel tests plant files under their own zz-* names and never see each other's plants) */
  const only = val("--only") ? new RegExp(val("--only")) : null, skip = val("--skip") ? new RegExp(val("--skip")) : null;
  const blobs = blobsFor().filter((b) => { const p = b.path || b.rel; return (!only || only.test(p)) && (!skip || !skip.test(p)); });
  for (const b of blobs) {
    const p = b.path || b.rel;
    if (p === "scripts/privacy-scan.mjs") { checkPath(p, hits); continue; } /* the patterns themselves */
    checkPath(p, hits.length >= 0 ? hits : hits);
    if (has("--images")) continue; /* PRIVFEED3 · pre-push full-tree image check at the pushed commit */
    if (BIN.test(p)) continue;
    let buf; try { buf = b.read(); } catch { continue; }
    if (buf.includes(0)) continue;
    const sub = [];
    scanText(p, buf.toString("utf8"), deny, sub);
    for (const h of sub) hits.push({ ...h, rel: b.rel });
  }
  const byCat = {};
  for (const h of hits) byCat[h.cat] = (byCat[h.cat] || 0) + 1;
  const mode = has("--staged") ? "staged" : val("--range") ? "range " + val("--range") : val("--rev") ? "rev " + val("--rev") : "tree";
  const warn = deny.found ? "" : "WARN: no private names/denylist on this machine; generic patterns only";
  for (const h of hits.slice(0, 400)) console.log(`PRIVACY ${h.cat}  ${h.rel}${h.line ? ":" + h.line : ""}`);
  if (hits.length > 400) console.log(`… ${hits.length - 400} more`);
  if (warn) console.log(warn);
  console.log(`privacy-scan (${mode}): ${blobs.length} files · ${hits.length} hit(s) · ${JSON.stringify(byCat)} · denylist patterns ${deny.pats.length}`);
  const rep = val("--report");
  if (rep) {
    const md = [`# privacy-scan · ${mode}`, "", `- files scanned: ${blobs.length}`, `- denylist patterns loaded: ${deny.pats.length}${warn ? " (" + warn + ")" : ""}`,
      `- hits: ${hits.length} ${JSON.stringify(byCat)}`, "", "| category | path:line |", "|---|---|",
      ...hits.map((h) => `| ${h.cat} | ${h.rel}${h.line ? ":" + h.line : ""} |`), ""].join("\n");
    fs.writeFileSync(rep, md);
  }
  if (!deny.found && has("--require-denylist")) process.exit(2);
  process.exit(hits.length ? 1 : 0);
}
main();
