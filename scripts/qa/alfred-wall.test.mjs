/* Alfred fail on 55b408c4: hub doors, 1:1 painted assets, cubby rows, safe box and sibling gaps. */
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const browser = spawnSync("python3", ["-c", "import playwright.sync_api"], { encoding: "utf8" }).status === 0 && process.env.QA_NO_BROWSER !== "1";
const SKIP = browser ? {} : { skip: "SKIP no playwright (QA_NO_BROWSER)" };

function run(mode) {
  return new Promise((resolve, reject) => {
    const p = spawn("python3", [path.join(ROOT, "scripts/qa/alfred_wall.py"), mode]);
    let out = "", err = "";
    const t = setTimeout(() => p.kill("SIGTERM"), 180000);
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (code) => {
      clearTimeout(t);
      if (code !== 0) return reject(new Error(mode + " exit " + code + " " + err.slice(-800) + out.slice(-400)));
      try { resolve(JSON.parse(out.trim().split("\n").pop())); }
      catch (e) { reject(new Error(mode + " bad json " + out.slice(-400))); }
    });
  });
}

test("hub doors take real clicks at the four tile centers and home returns", SKIP, async () => {
  const r = await run("doors");
  for (const door of r.doors) {
    assert.ok(door.hit.door, JSON.stringify(door));
    assert.equal(door.hit.panel, false, JSON.stringify(door.hit));
    assert.ok(door.url.includes(door.dest), JSON.stringify(door));
    assert.equal(door.money, false, JSON.stringify(door));
    assert.ok(door.home && door.home.includes("sheet-index.html"), JSON.stringify(door));
  }
});

test("eight wall routes paint rasters 1:1, including drawImage", SKIP, async () => {
  const r = await run("census");
  for (const page of r.pages) {
    assert.deepEqual(page.badImg, [], page.route + " " + JSON.stringify(page.badImg));
    assert.deepEqual(page.badBg, [], page.route + " " + JSON.stringify(page.badBg));
    assert.deepEqual(page.draws, [], page.route + " " + JSON.stringify(page.draws));
    if (page.route.startsWith("kid-")) {
      assert.deepEqual(page.canvas, { w: 900, h: 864, css: [900, 864] }, page.route + " " + JSON.stringify(page.canvas));
    }
  }
});

test("every must row is fully visible and its center hits that row", SKIP, async () => {
  const r = await run("cubby");
  for (const kid of ["hayes", "harris", "ainsley"]) {
    const info = r.kids[kid];
    assert.ok(info.rows.length >= 9, kid + " " + JSON.stringify(info));
    for (const row of info.rows) {
      assert.equal(row.full, true, kid + " " + row.id + " " + JSON.stringify(row) + " list " + JSON.stringify(info.list));
      assert.equal(row.own, true, kid + " " + row.id + " hit " + row.hit);
    }
  }
});

test("controls and text stay inside x48-1872 y48-1032 with 16px between sibling targets", SKIP, async () => {
  const r = await run("bounds");
  for (const page of r.pages) {
    assert.equal(page.outsideN, 0, page.route + " " + JSON.stringify(page.outside));
    assert.equal(page.gapN, 0, page.route + " " + JSON.stringify(page.gaps));
    assert.equal(page.adjacentN, 0, page.route + " " + JSON.stringify(page.adjacent));
  }
});

test("wall taps do not scale cards, shrink gaps, or move the jar", SKIP, async () => {
  const r = await run("press");
  for (const kid of ["ainsley", "hayes", "harris"]) {
    const info = r.kids[kid];
    assert.ok(info.frames > 10, kid + " frames " + info.frames);
    assert.equal(info.badN, 0, kid + " " + JSON.stringify(info.bad));
  }
});

test("chores header shortcuts are one on-screen row and each center hits that shortcut", SKIP, async () => {
  const r = await run("shortcuts");
  const chips = r.pages["sheet-chores.html"];
  assert.equal(chips.length, 3, JSON.stringify(chips));
  let prev = null;
  for (const chip of chips) {
    assert.ok(chip.w >= 64 && chip.h >= 64, JSON.stringify(chip));
    assert.ok(chip.l >= 48 && chip.r <= 1872 && chip.t >= 48 && chip.b <= 1032, JSON.stringify(chip));
    assert.ok(chip.t >= 60 && chip.t <= 72, JSON.stringify(chip));
    assert.equal(chip.own, true, JSON.stringify(chip));
    if (prev) assert.ok(chip.l - prev.r >= 16, JSON.stringify([prev, chip]));
    prev = chip;
  }
  for (const route of ["kid-ainsley.html", "kid-hayes.html", "kid-harris.html"]) {
    for (const chip of r.pages[route]) assert.equal(chip.own, true, route + " " + JSON.stringify(chip));
  }
});
