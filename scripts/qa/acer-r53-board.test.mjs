/* r53b · one unpaired banner, and one 1920x1080 board scaled to the viewport. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = process.env.WARDOS_ROOT
  ? path.resolve(process.env.WARDOS_ROOT)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

test("r53b the unpaired banner is one plain line and the board scales with the viewport", () => {
  const html = read("sheet-index.html");
  const css = read("hub-compose.css");
  const stage = read("wardos-stage.js");
  const feed = read("private-feed.js");
  assert.match(html, /id="wardos-pair-banner"[^>]*>This screen isn't paired with the house yet</);
  assert.doesNotMatch(html, /id="wardos-pair-banner"[^>]*href=/);
  assert.match(css, /html\[data-pair-banner="1"\] #wardos-pair-banner \{ display: block; \}/);
  assert.match(css, /pointer-events: none/);
  assert.match(feed, /data-pair-banner/);
  assert.match(stage, /Math\.min\(b\.innerWidth \/ STAGE_W, b\.innerHeight \/ STAGE_H\)/);
  assert.doesNotMatch(stage, /Math\.min\(1, b\.innerWidth/);
});

test("r53b2 one offline message, a labeled music card, the day hero plate, and bar viewports", () => {
  const html = read("sheet-index.html");
  const css = read("hub-compose.css");
  const js = read("hub-compose.js");
  const overlay = read("month-theme/month-overlay.js");
  const proof = read("scripts/qa/acer_r53_board.py");
  const version = read("version.json");
  assert.match(version, /"token":"r53b6"/);
  assert.match(html, /<meta name="wardos-build" content="r53b6"\s*\/?>/);
  assert.match(html, /id="hub-offline-line"[^>]*>\s*<span data-offline-text>/);
  assert.match(css, /html\[data-pair-banner="1"\] body #hub-offline-line \{ display: none !important; \}/);
  assert.match(css, /#hub-offline-line \{[\s\S]*background: #101820 !important;/);
  assert.match(css, /html body #hub-spotify-tile \.sp-title,\s*html body #hub-spotify-tile \.sp-art-wrap \{ display: block !important; \}/);
  assert.match(js, /data-pair-banner/);
  assert.match(js, /show \? OFFLINE_LINE : ""/);
  assert.match(overlay, /phase === "night" \? "night" : phase === "dusk" \? "dusk" : "day"/);
  assert.match(proof, /\(1024, 768\), \(1280, 1024\)/);
  assert.match(proof, /OFFLINE not in body/);
  assert.match(proof, /Music offline/);
});

test("r53b3 resting cameras stay in a row and an empty roster chip is hidden", () => {
  const css = read("hub-compose.css");
  const face = read("prism-face.js");
  const sheet = read("prism-face.css");
  assert.match(css, /roster-plate\.roster-empty \.roster-title:empty \{[\s\S]*display: none !important;/);
  assert.match(face, /grid-template-columns:repeat\(3, minmax\(80px, 1fr\)\) !important/);
  assert.doesNotMatch(face, /flex-direction:column !important/);
  assert.match(sheet, /grid-template-columns: repeat\(3, minmax\(80px, 1fr\)\) !important/);
  assert.match(read("scripts/qa/acer_r53_board.py"), /same top/);
});

const browser = spawnSync("python3", ["-c", "import playwright.sync_api"], { encoding: "utf8" }).status === 0 && process.env.QA_NO_BROWSER !== "1";

test("r53b banner, letterbox and Home tap", { skip: browser ? false : "SKIP no playwright" }, () => {
  const r = spawnSync("python3", [path.join(ROOT, "scripts/qa/acer_r53_board.py")], { encoding: "utf8", timeout: 180000 });
  assert.equal(r.status, 0, (r.stderr || "").slice(-800) + (r.stdout || "").slice(-800));
});
