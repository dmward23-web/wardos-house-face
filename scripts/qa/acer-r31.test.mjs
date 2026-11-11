/* Round 31 · four 1920x1080@1 box checks. These fail on 6e5ff7d9. */
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const browser = spawnSync("python3", ["-c", "import playwright.sync_api"], { encoding: "utf8" }).status === 0 && process.env.QA_NO_BROWSER !== "1";
const SKIP = browser ? {} : { skip: "SKIP no playwright (QA_NO_BROWSER)" };

function measure() {
  const r = spawnSync("python3", [path.join(ROOT, "scripts/qa/acer_r31_measure.py")], { encoding: "utf8", timeout: 120000 });
  assert.equal(r.status, 0, (r.stderr || "").slice(-800) + (r.stdout || "").slice(-400));
  return JSON.parse(r.stdout.trim().split("\n").pop());
}

const data = browser ? measure() : null;

function inside(inner, outer) {
  return inner.x >= outer.x - 0.5 && inner.y >= outer.y - 0.5 && inner.r <= outer.r + 0.5 && inner.b <= outer.b + 0.5;
}

test("D1 saves Home is an icon tile and the add controls are 64px with 16px gaps", SKIP, () => {
  const d = data.d1;
  assert.ok(d.img && d.img.w >= 32 && d.img.h >= 32, "icon " + JSON.stringify(d.img));
  assert.equal(d.text.t, "");
  assert.ok(d.home.x >= 48 && d.home.y >= 48, JSON.stringify(d.home));
  assert.ok(d.home.w >= 64 && d.home.h >= 64, JSON.stringify(d.home));
  const textOverlapsIcon = d.text.w > 1 && d.text.h > 1 && d.text.x < d.img.r && d.text.r > d.img.x && d.text.y < d.img.b && d.text.b > d.img.y;
  assert.equal(textOverlapsIcon, false);
  for (const key of ["name", "need", "save"]) assert.ok(d[key].h >= 64, key + " " + d[key].h);
  assert.ok(d.need.x - (d.name.x + d.name.w) >= 16, "name to star");
  assert.ok(d.save.x - (d.need.x + d.need.w) >= 16, "star to save");
});

test("D2 Today and Month clock text sits inside one chip with no tail or hairline", SKIP, () => {
  for (const [name, row] of Object.entries(data.d2)) {
    const { clock, host, text, lines } = row;
    assert.ok(text.x >= clock.x - 0.5 && text.y >= clock.y - 0.5 && text.r <= clock.r + 0.5 && text.b <= clock.b + 0.5, name + " text " + JSON.stringify({ text, clock }));
    assert.ok(host.w <= clock.w + 4, name + " host tail " + host.w + " vs " + clock.w);
    assert.equal(lines.length, 0, name + " hairline " + JSON.stringify(lines));
  }
});

test("D3 Today content starts at x 48 and Tap and Board rows are at least 64px", SKIP, () => {
  const xs = data.d3.boxes.map((b) => b.x);
  assert.ok(xs.length > 0);
  assert.ok(Math.min(...xs) >= 48, JSON.stringify(data.d3.boxes.filter((b) => b.x < 48)));
  for (const pill of data.d3.pills) {
    if (pill.own) assert.ok(pill.h >= 64, pill.t);
    else {
      assert.equal(pill.inside, true, pill.t);
      assert.ok(pill.rowH >= 64, pill.t + " row " + pill.rowH);
    }
  }
});

test("D4 chore icons sit inside their cards, including More", SKIP, () => {
  for (const set of [data.d4.folded, data.d4.more]) {
    assert.ok(set.length >= 3, JSON.stringify(set));
    for (const row of set) {
      assert.ok(inside(row.icon, row.card), JSON.stringify(row));
    }
  }
});
