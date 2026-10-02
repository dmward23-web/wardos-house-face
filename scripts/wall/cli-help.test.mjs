// CLIGUARD1 → WALLKIT9 · node scripts/wall/cli-help.test.mjs · --help / -h print usage and exit 0 and write nothing, now
// against Atlas's own ATLASLANE7 --help (our cli-guard.mjs is gone; his CLIs win). His CLIs do NOT reject unknown flags
// (an unknown flag runs the build and writes data/*.json), so that case is not exercised here: known gap, Atlas's lane. Every data/*.json (and config/*.json) is copied to a temp dir first; contents + mtime are
// compared after each run, and anything a run changed is restored from the copy before the test fails.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CLIS = ["scripts/school-night.mjs", "scripts/next-up.mjs", "scripts/logistics-taps.mjs"];
const ALSO_HELP = ["scripts/pickup-chain.mjs", "scripts/house-mode.mjs", "scripts/kid-layer.mjs", "scripts/display-rename.mjs"]; /* rest of Atlas's CLIs: --help only */
const watched = ["data", "config"].flatMap((d) => fs.readdirSync(path.join(ROOT, d)).filter((f) => f.endsWith(".json")).map((f) => path.join(d, f)));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cli-help-"));
const snap = () => Object.fromEntries(watched.map((f) => { const p = path.join(ROOT, f); return [f, { sha: crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex"), mtimeMs: fs.statSync(p).mtimeMs }]; }));
for (const f of watched) { fs.mkdirSync(path.dirname(path.join(tmp, f)), { recursive: true }); fs.copyFileSync(path.join(ROOT, f), path.join(tmp, f)); }
const before = snap();
const restore = () => { const now = snap(); const changed = watched.filter((f) => now[f].sha !== before[f].sha || now[f].mtimeMs !== before[f].mtimeMs);
  for (const f of changed) { fs.copyFileSync(path.join(tmp, f), path.join(ROOT, f)); fs.utimesSync(path.join(ROOT, f), new Date(before[f].mtimeMs), new Date(before[f].mtimeMs)); }
  return changed; };
let n = 0;
const t = (name, fn) => { try { fn(); } finally { const ch = restore(); assert.deepEqual(ch, [], `${name}: wrote ${ch.join(", ")} (restored)`); } n++; console.log("ok -", name); };
const run = (cli, ...args) => spawnSync(process.execPath, [cli, ...args], { cwd: ROOT, encoding: "utf8", timeout: 20000 });
try {
  for (const cli of CLIS) {
    const base = path.basename(cli);
    for (const h of ["--help", "-h"]) t(`${base} ${h}: usage on stdout, exit 0, no file written`, () => {
      const r = run(cli, h); assert.equal(r.status, 0, r.stderr); assert.match(r.stdout, new RegExp("^Usage: node scripts/" + base.replace(".", "\\.")));
      assert.doesNotMatch(r.stdout, /->\s*data\//, "no 'wrote' line"); assert.match(r.stdout, /writes nothing/);
    });
    t(`${base} --help with other flags still writes nothing`, () => { const r = run(cli, "--now", "2026-10-01T18:00:00-05:00", "--help"); assert.equal(r.status, 0); });
    t(`${base} --help with --out elsewhere writes nothing there either`, () => {
      const out = path.join(tmp, "out-" + base + ".json"); const r = run(cli, "--help", "--out", out); assert.equal(r.status, 0); assert.equal(fs.existsSync(out), false);
    });
  }
  for (const cli of ALSO_HELP) for (const h of ["--help", "-h"]) t(`${path.basename(cli)} ${h}: usage, exit 0, no file written`, () => {
    const r = run(cli, h, "kids-week.json"); assert.equal(r.status, 0, r.stderr); assert.match(r.stdout, /^Usage: node scripts\//); assert.match(r.stdout, /writes nothing/);
  });
  t("our cli-guard.mjs is gone and no CLI imports it (Atlas's --help is the one)", () => {
    assert.equal(fs.existsSync(path.join(ROOT, "scripts/house/cli-guard.mjs")), false);
    for (const cli of CLIS.concat(ALSO_HELP)) assert.doesNotMatch(fs.readFileSync(path.join(ROOT, cli), "utf8"), /cli-guard/, cli);
  });
  t("a valid --stdout run still works and writes nothing", () => {
    for (const cli of CLIS) { const r = run(cli, "--now", "2026-10-01T18:40:00-05:00", "--stdout"); assert.equal(r.status, 0, cli + " " + r.stderr); JSON.parse(r.stdout); }
  });
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }
console.log(`cli-help: ${n} tests PASS`);
