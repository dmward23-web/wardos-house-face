/* R3-1 · a chore row that does not fully clear the more chip is hidden and counted. */
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const browser = spawnSync("python3", ["-c", "import playwright.sync_api"], { encoding: "utf8" }).status === 0 && process.env.QA_NO_BROWSER !== "1";
const SKIP = browser ? {} : { skip: "SKIP no playwright (QA_NO_BROWSER)" };

function measure() {
  const r = spawnSync("python3", [path.join(ROOT, "scripts/qa/choresfit1_render.py")], { encoding: "utf8", timeout: 150000 });
  assert.equal(r.status, 0, (r.stderr || "").slice(-600) + (r.stdout || "").slice(-400));
  return JSON.parse(r.stdout.trim().split("\n").pop());
}

const data = browser ? measure() : null;

function kids(set) {
  return set.cols.filter((c) => /Ainsley|Hayes|Harris/.test(c.name));
}

test("R3 chores rows end above the more chip and every day-tap hits at centre, top, and bottom", SKIP, () => {
  const cols = kids(data.day0);
  assert.equal(cols.length, 3, JSON.stringify(data.day0.cols));
  for (const col of cols) {
    assert.equal(col.low, 0, col.name + " " + JSON.stringify(col));
    assert.equal(col.misses, 0, col.name + " misses");
    assert.equal(col.chipTag, "BUTTON");
    assert.ok(col.chipH >= 64, col.name + " chip " + col.chipH);
  }
  const hayes = cols.find((c) => /Hayes/.test(c.name));
  const harris = cols.find((c) => /Harris/.test(c.name));
  assert.equal(hayes.chip, "+4 more", JSON.stringify(hayes));
  assert.equal(harris.chip, "+4 more", JSON.stringify(harris));
});

test("R3 chores pages cover every card once, and +K is the cards not on page 1", SKIP, () => {
  for (const [label, set] of [["day0", data.day0], ["overflow", data.overflow]]) {
    const cols = kids(set);
    assert.equal(cols.length, 3, label);
    for (const col of cols) {
      const flat = col.pages.flat();
      assert.deepEqual(flat.slice().sort(), col.all.slice().sort(), label + " " + col.name + " union " + JSON.stringify(col.pages));
      assert.equal(new Set(flat).size, flat.length, label + " " + col.name + " duplicate");
      const k = col.all.length - col.pages[0].length;
      assert.equal(col.chip, "+" + k + " more", label + " " + col.name + " chip " + JSON.stringify({ chip: col.chip, k, pages: col.pages.map((p) => p.length) }));
    }
  }
});

test("R5 every shown chore card has 7 day taps, the page-1 columns, and clears the chip", SKIP, () => {
  for (const [label, set] of [["day0", data.day0], ["overflow", data.overflow]]) {
    const cols = kids(set);
    assert.equal(cols.length, 3, label);
    for (const col of cols) {
      const fit = col.pageFit || [];
      assert.ok(fit.length >= 1, label + " " + col.name + " pages");
      const grid0 = fit[0].cards.length ? fit[0].cards[0].grid : "";
      assert.ok(grid0, label + " " + col.name + " grid");
      for (let pi = 0; pi < fit.length; pi++) {
        const page = fit[pi];
        assert.equal(page.low, 0, label + " " + col.name + " p" + (pi + 1) + " overlap");
        assert.equal(page.misses, 0, label + " " + col.name + " p" + (pi + 1) + " hits");
        for (const card of page.cards) {
          assert.equal(card.taps, 7, label + " " + col.name + " p" + (pi + 1) + " " + card.name + " taps " + card.taps);
          assert.equal(card.grid, grid0, label + " " + col.name + " p" + (pi + 1) + " " + card.name + " grid");
        }
      }
    }
  }
});
