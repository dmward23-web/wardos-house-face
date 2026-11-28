/* r61 · hub strip hit-test, offline lights card, Today lines, ahead cue. */
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const browser = spawnSync("python3", ["-c", "import playwright.sync_api"], { encoding: "utf8" }).status === 0 && process.env.QA_NO_BROWSER !== "1";

function load() {
  const r = spawnSync("python3", [path.join(ROOT, "scripts/qa/acer_r61_measure.py")], { encoding: "utf8", timeout: 120000 });
  assert.equal(r.status, 0, (r.stderr || "").slice(-800) + (r.stdout || "").slice(-400));
  return JSON.parse(r.stdout.trim().split("\n").pop());
}

const data = browser ? load() : null;
const SKIP = browser ? {} : { skip: "SKIP no playwright (QA_NO_BROWSER)" };

test("r61 hub strip rows hit the strip and chips are 64px at 24px type", SKIP, () => {
  const hub = data.hub;
  assert.ok(hub.rows.length >= 1, "no strip rows " + JSON.stringify(hub.strip));
  assert.equal(hub.overlap, false, "strip overlaps Music " + JSON.stringify({ strip: hub.strip, music: hub.music }));
  for (const row of hub.rows) {
    assert.equal(row.inStrip, true, "hit missed the strip " + JSON.stringify(row));
    assert.equal(row.inMusic, false, "row under Music " + JSON.stringify(row));
    assert.ok(row.b <= 1032 && row.top >= 48, JSON.stringify(row));
  }
  assert.ok(hub.hdr && hub.hdr.fs >= 24 && hub.hdr.h >= 24, "header " + JSON.stringify(hub.hdr));
  const wanted = ["Day", "Rail", "Who"];
  for (const name of wanted) assert.ok(hub.chips.some((c) => c.t === name), name + " " + JSON.stringify(hub.chips));
  for (const chip of hub.chips) {
    assert.ok(chip.w >= 64 && chip.h >= 64, JSON.stringify(chip));
    assert.ok(chip.fs >= 24, JSON.stringify(chip));
  }
  for (const gap of hub.gaps) assert.ok(gap >= 16, "chip gap " + gap);
});

test("r61 offline lights use the big card and a tap says so without a command", SKIP, () => {
  const lights = data.lights;
  const card = lights.card;
  assert.equal(card.offline, true);
  assert.ok(Math.abs(card.l - 48) <= 2 && Math.abs(card.t - 160) <= 2, JSON.stringify(card));
  assert.ok(Math.abs(card.w - 1824) <= 2 && Math.abs(card.h - 824) <= 2, JSON.stringify(card));
  assert.equal(lights.on.shown, true, JSON.stringify(lights.on));
  assert.equal(lights.on.t, "Lights are offline");
  assert.equal(lights.off.shown, true, JSON.stringify(lights.off));
  assert.equal(lights.off.t, "Lights are offline");
  assert.equal(lights.writes, 0, "commands " + lights.writes);
});

test("r61 Today kid lines do not stack, and the name and Board pill stay visible", SKIP, () => {
  const kids = data.today;
  assert.equal(kids.length, 3, JSON.stringify(kids));
  for (const kid of kids) {
    assert.equal(kid.name.hit, true, kid.kid + " name " + JSON.stringify(kid.name));
    assert.equal(kid.name.inside, true, kid.kid + " name clipped");
    assert.equal(kid.pill.hit, true, kid.kid + " pill " + JSON.stringify(kid.pill));
    assert.equal(kid.pill.inside, true, kid.kid + " pill clipped");
    assert.equal(kid.pill.t, "Board");
    assert.ok(kid.card.b <= 1032, kid.kid + " bottom " + kid.card.b);
    const lines = kid.lines.filter((line) => !line.more);
    for (let i = 0; i < lines.length; i++) {
      assert.ok(lines[i].b <= 1032, JSON.stringify(lines[i]));
      for (let j = i + 1; j < lines.length; j++) {
        const x = Math.min(lines[i].r, lines[j].r) - Math.max(lines[i].l, lines[j].l);
        const y = Math.min(lines[i].b, lines[j].b) - Math.max(lines[i].top, lines[j].top);
        assert.ok(!(x > 0.5 && y > 0.5), kid.kid + " overlap " + lines[i].text + " / " + lines[j].text);
      }
    }
    const cue = kid.lines.find((line) => line.more);
    if (kid.kid === "hayes") {
      const extra = cue ? Number((cue.text.match(/\d+/) || [0])[0]) : 0;
      assert.equal(lines.length + extra, data.hayesCount, JSON.stringify(kid.lines));
      if (lines.length < 8) assert.ok(cue && cue.b <= 1032, "missing cue " + JSON.stringify(kid.lines));
    }
  }
});

test("r61 a long ahead list is not clipped and shows how many are left", SKIP, () => {
  const ahead = data.ahead;
  assert.equal(ahead.missing, undefined, JSON.stringify(ahead));
  assert.deepEqual(ahead.clipped, [], JSON.stringify(ahead.clipped));
  assert.ok(ahead.maxLines <= 2, "wrapped " + ahead.maxLines);
  assert.ok(ahead.cue && /^\+\d+ more$/.test(ahead.cue.t), JSON.stringify(ahead.cue));
  assert.ok(ahead.n >= 1, JSON.stringify(ahead));
});
