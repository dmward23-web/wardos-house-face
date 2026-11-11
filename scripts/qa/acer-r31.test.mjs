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

test("r32 saves modal shows one Home tile matching kid-hayes", SKIP, () => {
  const d = data.d1;
  assert.equal(d.visible.length, 1, JSON.stringify(d.visible));
  const tile = d.visible[0];
  assert.equal(tile.imgs, 1);
  assert.equal(d.text.t, "");
  assert.ok(Math.abs(tile.x - d.pageHome.x) <= 1 && Math.abs(tile.y - d.pageHome.y) <= 1, JSON.stringify({ tile, pageHome: d.pageHome }));
  assert.ok(Math.abs(tile.w - d.pageHome.w) <= 1 && Math.abs(tile.h - d.pageHome.h) <= 1, JSON.stringify({ tile, pageHome: d.pageHome }));
  assert.ok(d.img && Math.abs(d.img.w - d.pageHome.iw) <= 1 && Math.abs(d.img.h - d.pageHome.ih) <= 1);
  for (const key of ["name", "need", "save"]) assert.ok(d[key].h >= 64, key + " " + d[key].h);
  assert.ok(d.need.x - (d.name.x + d.name.w) >= 16, "name to star");
  assert.ok(d.save.x - (d.need.x + d.need.w) >= 16, "star to save");
});

test("r32 Today and Month temp chips sit beside Home inside the safe area", SKIP, () => {
  for (const [route, row] of Object.entries(data.chips)) {
    assert.ok(row.home && row.ovals.length >= 1, route + " " + JSON.stringify(row));
    for (const chip of row.ovals) {
      assert.ok(chip.y >= 48, route + " top " + chip.y);
      assert.ok(chip.x >= row.home.x + row.home.w + 16, route + " gap " + JSON.stringify({ chip, home: row.home }));
    const first = row.ovals.slice().sort((a, b) => a.x - b.x)[0];
    assert.ok(first.x <= row.home.x + row.home.w + 32, route + " not beside Home " + JSON.stringify({ first, home: row.home }));
    }
  }
});

test("D2 Today and Month clock text sits inside one chip with no tail or hairline", SKIP, () => {
  for (const [name, row] of Object.entries(data.d2)) {
    const { clock, host, text, lines } = row;
    assert.ok(text.x >= clock.x - 0.5 && text.y >= clock.y - 0.5 && text.r <= clock.r + 0.5 && text.b <= clock.b + 0.5, name + " text " + JSON.stringify({ text, clock }));
    assert.ok(host.w <= clock.w + 4, name + " host tail " + host.w + " vs " + clock.w);
    assert.equal(lines.length, 0, name + " hairline " + JSON.stringify(lines));
  }
});

test("D3 Today boards container starts at x 48 and Tap and Board rows are at least 64px", SKIP, () => {
  assert.ok(data.d3.boards, "boards container missing");
  assert.ok(data.d3.boards.x >= 48, "boards left " + data.d3.boards.x);
  const xs = data.d3.boxes.map((b) => b.x);
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

test("r33 Today day header has no empty frosted backdrop over the roof", SKIP, () => {
  assert.equal(data.r33.today.hits.length, 0, JSON.stringify(data.r33.today));
  assert.equal(data.r33.today.hdr.bf, "none");
});

test("r33 Month night header has no hairline across the band", SKIP, () => {
  assert.equal(data.r33.month.lines.length, 0, JSON.stringify(data.r33.month));
  const clock = data.r33.month.clock;
  assert.ok(clock.y >= 48 && clock.b <= clock.y + clock.h + 0.5);
  assert.ok(clock.h >= 64, "clock " + clock.h);
});

test("r33 chore icons are 64 and day circles stay inside the card", SKIP, () => {
  for (const [name, set] of [["folded", data.r33.chores.folded], ["more", data.r33.chores.more]]) {
    assert.ok(set.rows.length >= 3, name + " " + JSON.stringify(set.cols));
    for (const row of set.rows) {
      assert.ok(row.icon, name + " missing icon");
      assert.ok(Math.abs(row.icon.w - 64) <= 1 && Math.abs(row.icon.h - 64) <= 1, name + " icon " + JSON.stringify(row.icon));
      assert.ok(inside(row.icon, row.card), name + " icon outside " + JSON.stringify(row));
      assert.ok(row.days.length === 7, name + " days " + row.days.length);
      const size = row.days[0].w;
      for (const day of row.days) {
        assert.ok(inside(day, row.card), name + " circle outside " + JSON.stringify({ day, card: row.card }));
        assert.ok(Math.abs(day.w - day.h) <= 1, name + " not round " + JSON.stringify(day));
        assert.ok(Math.abs(day.w - size) <= 1, name + " unequal " + JSON.stringify(day));
        assert.ok(day.w >= 40, name + " circle too small " + day.w);
        assert.ok(parseFloat(day.rad) >= day.w / 2 - 1, name + " radius " + day.rad);
      }
    }
  }
});
