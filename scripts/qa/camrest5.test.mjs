/* CAMREST5 · Alfred FAIL on CAMREST4 bd4d19cf: sheet-lights cut the pad src word at the wall widths (LPAD-CLIP), the lifted
   Harris kid pad left the hidden legacy hotbar under the pad and My week at 440 (KID1-TAPOV), the kid pad state was 12px
   (KIDPAD-12PX) and the resting cam labels added three 13px words to the desk (DESK-SMALL). CSS only. Real browser via
   scripts/qa/camrest4_viewport.py (the "cr5" probe). */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const browser = spawnSync("python3", ["-c", "import playwright.sync_api"], { encoding: "utf8" }).status === 0 && process.env.QA_NO_BROWSER !== "1";
const SKIP = browser ? {} : { skip: "SKIP no playwright (QA_NO_BROWSER)" };
const J = (o) => JSON.stringify(o).slice(0, 1200);
/* fe21d91f baseline, same probe, no key: sheet-index sub-14px text nodes */
const FE21_SUB14 = { 440: 4, 1920: 14 };

function run(mode, w, h) {
  return new Promise((resolve, reject) => {
    const p = spawn("python3", [path.join(ROOT, "scripts/qa/camrest4_viewport.py"), mode, String(w), String(h)]);
    let out = "", err = "";
    const t = setTimeout(() => p.kill("SIGTERM"), 180000);
    p.stdout.on("data", (d) => (out += d)); p.stderr.on("data", (d) => (err += d));
    p.on("close", (code) => {
      clearTimeout(t);
      if (code !== 0) return reject(new Error(mode + " exit " + code + " " + err.slice(-600)));
      try { resolve(JSON.parse(out.trim().split("\n").pop())); } catch (e) { reject(new Error(mode + " bad json " + out.slice(-300))); }
    });
  });
}

test("CAMREST5 · sheet-lights at 1920 and 2560, no key and revoked key: no pad is cut, the src words read in full", SKIP, async () => {
  for (const m of ["lights0", "lights401"]) for (const [w, h] of [[1920, 1080], [2560, 1440]]) {
    const r = await run(m, w, h), c = r.cr5, k = m + "@" + w;
    assert.deepEqual(r.errors, [], k + " " + J(r.errors));
    assert.ok(c.lightPads >= 3, k + " pads " + J(c));
    assert.deepEqual(c.lightClip, [], k + " clipped " + J(c.lightClip));
    const want = m === "lights0" ? "Needs pairing" : "Not connected";
    assert.ok(c.lightSrc.filter((s) => s === want).length >= 3, k + " src words " + J(c.lightSrc));
  }
});

test("CAMREST5 · every kid board at 440: the kid pad and My week overlap no other tap target; pad clears My week by 8px; pad state 14px", SKIP, async () => {
  for (const m of ["kid0", "kid401", "kidC", "ctl-hayes", "ctl-harris", "ctl-ainsley"]) {
    const r = await run(m, 440, 956), c = r.cr5;
    assert.deepEqual(r.errors, [], m + " " + J(r.errors));
    assert.deepEqual(c.tapOverlap, [], m + " overlaps " + J(c.tapOverlap));
    if (m === "ctl-hayes" || m === "ctl-ainsley") { assert.equal(c.padStateFont, null, m + " has no light pad"); continue; }
    assert.ok(c.padPathGap >= 8, m + " pad to My week gap " + c.padPathGap);
    assert.ok(c.padStateFont >= 14, m + " pad state " + c.padStateFont + "px");
    if (m === "kidC") assert.equal(r.writes, 1, "kidC tap still writes once " + J(r));
  }
});

test("CAMREST5 · desk at 440 and 1920: sub-14px text count at or under the fe21 baseline; no resting cam label under 14px", SKIP, async () => {
  for (const [w, h] of [[440, 956], [1920, 1080]]) {
    const r = await run("rest", w, h), c = r.cr5;
    assert.deepEqual(r.errors, [], w + " " + J(r.errors));
    assert.ok(c.sub14 <= FE21_SUB14[w], w + " sub-14 " + c.sub14 + " > fe21 " + FE21_SUB14[w] + " " + J(c.sub14List));
    assert.equal(c.camLabelSmall, 0, w + " cam labels under 14px");
  }
});

test("CAMREST5 · source: CSS only fixes and CAMREST5 tokens", () => {
  const L = read("house-lights.js"), S = read("sheet-lights.html"), C = read("tokens-hub-cams.css");
  assert.match(L, /\.kw-light \.light-pad-state\.cmd-pill \{[^}]*font-size:14px;/, "kid pad state 14px");
  assert.doesNotMatch(L, /\.kw-light \.light-pad-state\.cmd-pill \{[^}]*font-size:1[0-3]px/);
  assert.match(L, /body\.kw-on \.panel\.cmd-kid a\.hotbar \{ visibility:hidden !important; \}/, "hidden legacy hotbar never counts as a tap target");
  assert.match(S, /@media \(min-width: 1920px\) \{[^@]*article\.light-pad\.cmd-panel \{ flex-wrap: wrap !important;[^@]*\.light-pad-src \{ min-width: 0 !important;[^}]*white-space: normal !important;/);
  assert.match(C, /#hub-cam-deck \.hub-cam-label\.hub-cam-label \{ font-size: 14px !important; \}/);
  for (const f of ["sheet-index.html", "sheet-google-home.html"]) assert.match(read(f), /tokens-hub-cams\.css\?v=CAMREST5"/, f);
  for (const f of ["sheet-index.html", "sheet-google-home.html", "sheet-lights.html", "kid-harris.html"]) assert.match(read(f), /house-lights\.js\?v=CAMREST5"/, f);
});
