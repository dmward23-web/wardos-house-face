/* F7: prism-face assets and the Home icon are in the first HTML, not injected at DOMContentLoaded. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SHEETS = [
  "sheet-google-home.html", "month.html", "sheet-allowance.html", "sheet-win.html",
  "sheet-groceries.html", "sheet-index.html", "sheet-lights.html", "sheet-chores.html",
  "sheet-today.html", "nest-webrtc.html", "sheet-spotify.html", "sheet-weekend.html"
];

test("r53 F7 each stage sheet links prism-face and the Home icon in the HTML", () => {
  for (const name of SHEETS) {
    const html = fs.readFileSync(path.join(ROOT, name), "utf8");
    assert.match(html, /<link id="prism-face-css" rel="stylesheet" href="prism-face\.css">/, name);
    assert.match(html, /<script id="prism-face-js" src="prism-face\.js"><\/script>/, name);
    assert.match(html, /assets\/icons\/home-key-light/, name);
  }
  const stage = fs.readFileSync(path.join(ROOT, "wardos-stage.js"), "utf8");
  assert.equal(stage.includes('face.href = "prism-face.css"'), false);
  assert.equal(stage.includes('faceJs.src = "prism-face.js"'), false);
});

const browser = spawnSync("python3", ["-c", "import playwright.sync_api"], { encoding: "utf8" }).status === 0 && process.env.QA_NO_BROWSER !== "1";

test("r53 F7 sixty loads of each sheet keep prism-face and the Home icon", { skip: browser ? false : "SKIP no playwright" }, () => {
  const r = spawnSync("python3", [path.join(ROOT, "scripts/qa/acer_r53_f7.py")], { encoding: "utf8", timeout: 600000 });
  assert.equal(r.status, 0, (r.stderr || "").slice(-600) + (r.stdout || "").slice(-400));
  const o = JSON.parse(r.stdout.trim().split("\n").pop());
  for (const name of SHEETS) {
    const row = o[name];
    assert.equal(row.loads, 60, name);
    assert.equal(row.missing, 0, name + " " + JSON.stringify(row));
    assert.equal(row.home, 60, name + " home");
  }
});
