#!/usr/bin/env node
/* PREVIEW1 · build a read-only public preview of the house face.
 *
 *   node scripts/preview/publish-preview.mjs [--out /workspace/preview-out] [--ref HEAD]
 *        [--live-data https://dmward23-web.github.io/wardos-house-face/data/] [--skip-gates]
 *
 * DRY RUN ONLY. This builds the preview folder and checks it. It does not create a
 * repo, push, or publish anything; it prints the steps that publishing would take
 * so Dan can OK them. The wall build is never touched: the guard is injected into
 * the copy in --out only.
 *
 * Gates (a failed gate = the build is marked NOT PUBLISHABLE, exit 1):
 *   scripts/wall/press-map.py 1920x1080   every press lands somewhere real
 *   scripts/wall/alfred/space.py          no dead space on the wall: REAL data at the CURRENT clock, 5 viewports
 *                                         (SPACE-01 10/2; fixtures never block)
 *   extra, never blocks: scripts/wall/deadspace.py --wall  (the pinned 06:45 / 15:30 fixture replays, reported only)
 *   scripts/preview/check-preview.py     the built copy: no writes, keys ignored, noindex, chip, hint
 *   preview checks below                  guard first in every page, noindex, robots.txt,
 *                                         no keys in the copy, no house writer scripts left live */
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const OUT = path.resolve(arg("--out", "/workspace/preview-out"));
const REF = arg("--ref", "HEAD");
const LIVE = arg("--live-data", "https://dmward23-web.github.io/wardos-house-face/data/");
const SKIP = process.argv.includes("--skip-gates");
if (process.argv.includes("--publish")) {
  console.error("publish-preview: --publish is not wired. Publishing a public site needs Dan's OK first; this script only builds the dry run.");
  process.exit(2);
}
if (OUT === ROOT || ROOT.startsWith(OUT + path.sep)) { console.error("refusing to build into the repo"); process.exit(2); }

const git = (...a) => execFileSync("git", a, { cwd: ROOT, encoding: "utf8" }).trim();
const sha = git("rev-parse", "--short", REF);
const fails = [];
const SPACE_OUT = path.join(OUT, "..", "preview-gates-space-now");

// 1. fresh copy of the tracked tree at REF (untracked/private files never ship)
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const tar = spawnSync("sh", ["-c", `git archive --format=tar ${REF} | tar -x -C "${OUT}"`], { cwd: ROOT, encoding: "utf8" });
if (tar.status !== 0) { console.error(tar.stderr); process.exit(1); }
for (const p of ["scripts", "docs", ".github", "test", "tests", "node_modules", "CNAME"]) fs.rmSync(path.join(OUT, p), { recursive: true, force: true });

// notes, scripts and setup docs never ship (a preview is pages + assets + data)
(function prune(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) prune(f);
    else if (/\.(md|sh|py|mjs|plist|private\.json)$/i.test(e.name) || /\.test\./.test(e.name)) fs.rmSync(f);
  }
})(OUT);

// 2. inject the guard + config first in every page, noindex meta
fs.copyFileSync(path.join(ROOT, "scripts/preview/preview-guard.js"), path.join(OUT, "preview-guard.js"));
const cfg = JSON.stringify({ sha, liveData: LIVE, builtAt: new Date().toISOString() });
const HEAD_INJECT =
  `<meta name="robots" content="noindex,nofollow">\n` +
  `<script>window.__WARDOS_PREVIEW_CFG__=${cfg};</script>\n` +
  `<script src="preview-guard.js"></script>\n`;
const pages = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) walk(f);
    else if (e.name.endsWith(".html")) pages.push(f);
  }
})(OUT);
for (const f of pages) {
  let s = fs.readFileSync(f, "utf8");
  const rel = path.relative(OUT, f);
  const depth = rel.split(path.sep).length - 1;
  const inj = depth ? HEAD_INJECT.replace('src="preview-guard.js"', `src="${"../".repeat(depth)}preview-guard.js"`) : HEAD_INJECT;
  const m = s.match(/<head[^>]*>/i);
  if (!m) { fails.push(`${rel}: no <head>`); continue; }
  s = s.replace(/<meta[^>]+name=["']robots["'][^>]*>\s*/gi, "");
  s = s.replace(m[0], m[0] + "\n" + inj);
  fs.writeFileSync(f, s);
}
fs.writeFileSync(path.join(OUT, "robots.txt"), "User-agent: *\nDisallow: /\n");
fs.writeFileSync(path.join(OUT, "PREVIEW.json"), JSON.stringify({ sha, ref: REF, liveData: LIVE, readOnly: true, pages: pages.length }, null, 1) + "\n");

// 3. preview checks
for (const f of pages) {
  const s = fs.readFileSync(f, "utf8"), rel = path.relative(OUT, f);
  const firstScript = s.search(/<script\b/i), guard = s.indexOf("preview-guard.js"), cfgAt = s.indexOf("__WARDOS_PREVIEW_CFG__");
  if (guard < 0 || cfgAt !== firstScript + "<script>window.".length) fails.push(`${rel}: guard is not the first script`);
  if (!/<meta name="robots" content="noindex,nofollow">/.test(s)) fails.push(`${rel}: no noindex`);
}
const KEY_PAT = /\b(lights|nest)-[A-Za-z0-9]{16,}\b|gh[opsu]_[A-Za-z0-9]{20,}|lightsProxyToken=[A-Za-z0-9_-]{8,}|nestProxyToken=[A-Za-z0-9_-]{8,}/;
(function scan(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) { scan(f); continue; }
    if (!/\.(html|js|json|css|txt|md)$/.test(e.name)) continue;
    const s = fs.readFileSync(f, "utf8");
    const m = s.match(KEY_PAT);
    if (m) fails.push(`${path.relative(OUT, f)}: looks like a key (${m[0].slice(0, 10)}…)`);
  }
})(OUT);
if (fs.existsSync(path.join(OUT, "data/display-rename.private.json"))) fails.push("private rename file in the copy");

// 4. gates on the source tree at this commit
const gates = [
  ["press map 1920", "python3", ["scripts/wall/press-map.py", "1920x1080", "--out", path.join(OUT, "..", "preview-gates-press.json")]],
  ["preview guard", "python3", ["scripts/preview/check-preview.py", OUT]],
  ["dead space wall (real data, now)", "python3", ["scripts/wall/alfred/space.py", ROOT, SPACE_OUT], { SPACE_PAGES: "wall.html" }, spaceVerdict],
];
/* SPACE-01 (10/2): the dead-space gate reads the wall at the CURRENT clock on the real data/ (no pinned 06:45 / 15:30
   replay); space.py reports, this decides: any real-now render with a fail or an error blocks */
function spaceVerdict() {
  let rows = [];
  try { rows = JSON.parse(fs.readFileSync(path.join(SPACE_OUT, "space.json"), "utf8")); } catch (e) { return { ok: false, lines: ["no space.json: " + e.message] }; }
  const real = rows.filter((r) => !String(r.state).endsWith("-FIXTURE"));
  const bad = real.filter((r) => (r.fails && r.fails.length) || r.error);
  return { ok: real.length > 0 && !bad.length, lines: bad.map((r) => `FAIL ${r.page} ${r.state} ${r.vp}: ${r.error || r.fails.join("; ")}`), note: `${real.length - bad.length}/${real.length} real-now renders pass` };
}
const extras = [ /* reported, never block the build */
  ["dead space wall, pinned fixtures (extra)", "python3", ["scripts/wall/deadspace.py", "--wall", "--vp", "1920x1080", "--out", path.join(OUT, "..", "preview-gates-deadspace")]],
];
const gateResults = [];
for (const [name, cmd, a, env, verdict] of gates) {
  if (SKIP) { gateResults.push([name, "SKIPPED"]); continue; }
  const r = spawnSync(cmd, a, { cwd: ROOT, encoding: "utf8", timeout: 1500000, env: { ...process.env, ...(env || {}) } });
  const v = verdict ? verdict(r) : { ok: r.status === 0, lines: (r.stdout || "").split("\n").filter((l) => /FAIL/.test(l)) };
  const ok = r.status === 0 && v.ok;
  gateResults.push([name, (ok ? "PASS" : "FAIL") + (v.note ? ` (${v.note})` : "")]);
  if (!ok) fails.push(`gate ${name} failed:\n${v.lines.slice(0, 12).join("\n")}`);
}
for (const [name, cmd, a] of extras) {
  if (SKIP) { gateResults.push([name, "SKIPPED"]); continue; }
  const r = spawnSync(cmd, a, { cwd: ROOT, encoding: "utf8", timeout: 1500000 });
  gateResults.push([name, (r.status === 0 ? "pass" : "fail") + " · extra, does not block"]);
}

console.log(`preview build ${sha} -> ${OUT}  (${pages.length} pages, live data ${LIVE})`);
for (const [n, s] of gateResults) console.log(`  gate ${n}: ${s}`);
const publishable = !fails.length && !SKIP;
if (fails.length) { console.log("NOT PUBLISHABLE:"); for (const f of fails) console.log("  - " + f); }
else if (SKIP) console.log("NOT PUBLISHABLE: gates skipped");
console.log(`
Publishing (NOT done; needs Dan's OK):
  1. gh repo create dmward23-web/<preview-repo> --public   (or reuse an existing preview repo)
  2. push the contents of ${OUT} to its gh-pages branch, enable Pages
  3. open https://dmward23-web.github.io/<preview-repo>/wall.html and confirm the chip reads ${sha}`);
process.exit(publishable ? 0 : 1);
