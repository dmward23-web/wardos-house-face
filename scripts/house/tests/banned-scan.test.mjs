import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { bannedHits, scanObject, readJson, ctWallMs, addDays, theirMom } from "../lib.mjs";
import { computeHouseMode, loadInputs, DEFAULTS } from "../../house-mode.mjs";
import { computePickupChain } from "../../pickup-chain.mjs";
import { calendar, CONFIG, KIDS_WEEK, ROOT } from "./fixture.mjs";

test("scanner catches every banned item", () => {
  const cases = {
    custody: "Custody week", dollar: "gift $150", Erin: "erin list", legal: "Legal call", therapy: "therapy 4pm",
    Wells: "WELLS number", balance: "card balance", autopay: "Autopay set",
  };
  for (const [id, text] of Object.entries(cases)) assert.ok(bannedHits(text).includes(id), `${id}: ${text}`);
  assert.ok(bannedHits("$9.99/mo").includes("dollar"));
  assert.ok(bannedHits("therapist chase").includes("therapy"));
  assert.ok(bannedHits("auto-pay").includes("autopay"));
  for (const ok of ["Kids away", "After school", "SRE pickup · 3:40", "Swim — Coach Ann · 5:00 practice", "Casey (Riley's mom)", "Kids are with their mom"]) {
    assert.deepEqual(bannedHits(ok), [], ok);
  }
});

test("'their mom' voice; other people's moms untouched", () => {
  assert.equal(theirMom("Kids with Mom"), "Kids with their mom");
  assert.equal(theirMom("Casey (Riley's mom)"), "Casey (Riley's mom)");
});

test("house-mode + pickup-chain output is clean every 30 min, Sep 25 – Oct 31 (fixture)", () => {
  for (let d = "2026-09-25"; d <= "2026-10-31"; d = addDays(d, 1)) {
    for (let h = 0; h < 24; h += 0.5) {
      const now = ctWallMs(d, Math.floor(h), (h % 1) * 60);
      const hm = computeHouseMode({ calendar: calendar(), kidsWeek: KIDS_WEEK, config: CONFIG, now });
      const pc = computePickupChain({ calendar: calendar(), kidsWeek: KIDS_WEEK, config: CONFIG, now });
      assert.deepEqual(scanObject(hm), [], `${d} ${h} house-mode`);
      assert.deepEqual(scanObject(pc), [], `${d} ${h} pickup-chain`);
    }
  }
});

test("real box calendar, if present: clean every 15 min over its window", { skip: !fs.existsSync(DEFAULTS.events) }, () => {
  const inp = loadInputs({ ...DEFAULTS, dataDir: "/workspace/wardos-house-face/data", override: "/nonexistent" });
  for (let d = "2026-09-28"; d <= "2026-10-08"; d = addDays(d, 1)) {
    for (let q = 0; q < 96; q++) {
      const now = ctWallMs(d, Math.floor(q / 4), (q % 4) * 15);
      assert.deepEqual(scanObject(computePickupChain({ ...inp, now })), [], `${d} q${q}`);
      if (q % 8 === 0) assert.deepEqual(scanObject(computeHouseMode({ ...inp, now })), [], `${d} q${q}`);
    }
  }
});

test("committed Atlas data/config/doc files are clean", () => {
  const files = [
    "data/house-mode.json", "data/pickup-chain.json", "data/house-mode-temps.json", "data/who-home.json",
    "data/pack-flags.json", "config/house-mode.config.json",
  ];
  for (const rel of files) {
    const fp = path.join(ROOT, rel);
    if (!fs.existsSync(fp)) continue;
    assert.deepEqual(scanObject(readJson(fp)), [], rel);
  }
  for (const rel of ["docs/wall-redesign/ATLAS-DATA-LANE.md"]) {
    const fp = path.join(ROOT, rel);
    if (fs.existsSync(fp)) assert.deepEqual(bannedHits(fs.readFileSync(fp, "utf8")), [], rel);
  }
});
