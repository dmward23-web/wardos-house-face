/* r58 · way home, no dev routes, no internal copy, idle return, and the P1 checks. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const browser = spawnSync("python3", ["-c", "import playwright.sync_api"], { encoding: "utf8" }).status === 0 && process.env.QA_NO_BROWSER !== "1";

const FAMILY = ["sheet-index.html", "sheet-today.html", "sheet-weekend.html", "sheet-pack.html", "sheet-google-home.html", "sheet-chores.html", "sheet-groceries.html", "sheet-win.html", "sheet-load-day.html", "sheet-us.html", "kid-hayes.html", "kid-harris.html", "kid-ainsley.html"];
const BANNED = ["LIVE EMPTY JAR", "LIVE · EMPTY", "LIVE jar", "Empty LIVE jar", "checklist · no money", "Elo · Nest", "Sensi live · Nest", "Sensi live", "Elo 3202L", "Calendar unavailable", "MUSTS OPEN", "JAR OPEN", "DAYS OPEN", "Harbor display lock"];

test("r58 family screens do not show internal copy", () => {
  for (const f of FAMILY) {
    const html = read(f);
    for (const s of BANNED) assert.equal(html.includes(s), false, f + " " + s);
  }
  assert.equal(read("wall-board-sheets.css").includes('content: "Open"'), false);
  assert.equal(read("house-nest.js").includes("Elo 3202L"), false);
  assert.equal(read("house-nest.js").includes("Sensi live"), false);
});

test("r58 no wall route leads to the dev status page", () => {
  const links = read("house-links.js");
  assert.doesNotMatch(links, /\["\*",[^\]]*STATUS\]/);
  assert.doesNotMatch(links, /\["nest-webrtc\.html", "\.hud \.pill", STATUS\]/);
  assert.doesNotMatch(links, /\["sheet-weekend\.html", "\.cheer-badge", STATUS\]/);
  assert.doesNotMatch(links, /\["sheet-google-home\.html"[^\]]*nest-webrtc/);
  assert.doesNotMatch(links, /\["sheet-us\.html", "\.safe-note", DESK\]/);
  assert.doesNotMatch(links, /\["sheet-load-day\.html", "article\.beat"[^\]]*DESK\]/);
  assert.equal(read("house-nest.js").includes('location.href = url'), false);
  assert.equal(read("nest-webrtc.html").includes("Cannot reach nest-webrtc-proxy"), false);
  assert.equal(read("nest-webrtc.html").includes("NEED PROXY"), false);
  const pages = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html") && !f.startsWith("kid-") || f.startsWith("kid-") && !f.includes("pre-theme"));
  for (const f of fs.readdirSync(ROOT)) {
    if (!f.endsWith(".html") || f.includes("pre-theme")) continue;
    if (f === "sheet-status.html" || f === "sheet-desk-gate.html" || f === "nest-webrtc.html") continue;
    const html = read(f);
    assert.equal(html.includes('href="sheet-status.html"'), false, f);
    assert.equal(html.includes('href="sheet-desk-gate.html"'), false, f);
    assert.equal(html.includes('href="nest-webrtc.html"'), false, f);
  }
  void pages;
});

test("r58 P1 the veil is skipped on the stage and the month buttons stay enabled at 64px", () => {
  const world = read("house-ori-world.js");
  assert.match(world, /data-wardos-stage/);
  assert.match(world, /setTimeout\(go, 250\)/);
  assert.doesNotMatch(world, /setTimeout\(go, 800\)/);
  const month = read("month.html");
  assert.match(month, /disabled = false/);
  assert.match(read("prism-face.css"), /\.mbtn \{ min-width: 64px/);
  const day = read("house-day-view.js");
  assert.match(day, /min-width:64px/);
  assert.match(day, /\.panel > \*:not\(header\):not\(\.day-view\)/);
  assert.doesNotMatch(read("house-addlist.js"), /window\.prompt/);
  assert.doesNotMatch(read("house-saves.js"), /window\.prompt/);
  assert.match(read("house-saves.js"), /saves-add-close/);
  assert.match(read("prism-face.css"), /chore\.done \.ring/);
  assert.doesNotMatch(read("hub-compose.js"), /Calendar unavailable/);
  assert.match(read("house-sensi-ctl.js"), /Ask Dad to connect the thermostat/);
});

test("r58 every route has a 96px home button above the veil and pointerup reaches the hub", { skip: browser ? false : "SKIP no playwright" }, () => {
  const r = spawnSync("python3", [path.join(ROOT, "scripts/qa/acer_r58_touch.py")], { encoding: "utf8", timeout: 180000 });
  assert.equal(r.status, 0, (r.stderr || "").slice(-800) + (r.stdout || "").slice(-400));
  const o = JSON.parse(r.stdout.trim().split("\n").pop());
  const names = Object.keys(o.pages);
  assert.ok(names.length >= 20, String(names.length));
  const bad = [];
  for (const name of names) {
    if (name === "sheet-index.html") continue;
    const row = o.pages[name];
    const why = [];
    if (!row.present) why.push("missing");
    if (row.hidden) why.push("hidden");
    if (!(row.w >= 96 && row.h >= 96)) why.push((row.w || 0) + "x" + (row.h || 0));
    if (!row.overVeil) why.push("under-veil");
    if (!row.reached) why.push("no-hub " + row.url);
    if (why.length) bad.push(name + " " + why.join(", "));
  }
  assert.deepEqual(bad, [], bad.join("\n"));
  assert.equal(o.idle.ok, true, JSON.stringify(o.idle));
});
