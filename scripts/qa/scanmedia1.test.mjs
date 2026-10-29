/* SCANMEDIA1 · Alfred P2 1213: .ico, .jxl, .mkv and .avi outside the art allow-list are flagged like any image
   (node --test scripts/qa/scanmedia1.test.mjs). Synthetic bytes, zz-media plants only, removed in finally. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
process.env.WARDOS_NAMES = "partner=Partnerly;coparent=Coparentia";
/* TESTFIX1 · --generic-only (as the CI privacy job runs it): it only lifts the 0-pattern fail-closed exit 2 (privacy-scan.mjs:242);
   a loaded box denylist still runs, and every generic / unlisted_image hit still exits 1 (testfix1-guard pins both). */
const scan = (...extra) => spawnSync("node", [path.join(ROOT, "scripts/privacy-scan.mjs"), "--tree", "--generic-only", ...extra], { cwd: ROOT, encoding: "utf8" });

test("SCANMEDIA1 · unlisted .ico / .jxl / .mkv / .avi (any case) each fail the scan as unlisted_image", () => {
  const plants = ["zz-media/fav.ico", "zz-media/art.jxl", "zz-media/clip.mkv", "zz-media/clip.AVI"].map((f) => path.join(ROOT, f));
  try {
    for (const p of plants) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, Buffer.from("synthetic-media-bytes")); }
    const r = scan("--only", "(^|/)zz-media/");
    assert.equal(r.status, 1, r.stdout);
    for (const f of ["fav.ico", "art.jxl", "clip.mkv", "clip.AVI"]) assert.match(r.stdout, new RegExp("PRIVACY unlisted_image +zz-media/" + f.replace(".", "\\.")), f);
    assert.equal((r.stdout.match(/PRIVACY unlisted_image /g) || []).length, plants.length, r.stdout);
  } finally { fs.rmSync(path.join(ROOT, "zz-media"), { recursive: true, force: true }); }
});

test("SCANMEDIA1 · the tracked tree still scans clean with the wider list", () => {
  const r = scan("--skip", "(^|/)zz-");
  assert.equal(r.status, 0, r.stdout);
});
