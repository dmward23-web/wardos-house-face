import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { bannedHits, publicHits, scanObject, readJson, ctWallMs, addDays, publicText } from "../lib.mjs";
import { computeHouseMode, loadInputs, DEFAULTS } from "../../house-mode.mjs";
import { computePickupChain } from "../../pickup-chain.mjs";
import { calendar, CONFIG, KIDS_WEEK, ROOT } from "./fixture.mjs";

test("scanner catches every banned item", () => {
  const cases = {
    custody: "Custody week", $: "gift $150", Erin: "erin list", legal: "Legal call", therapy: "therapy 4pm",
    Wells: "WELLS number", balance: "card balance", autopay: "Autopay set", jar: "Reward jar", payout: "Friday payout",
    mom: "Riley's mom", "their mom": "Kids with their mom",
  };
  for (const [id, text] of Object.entries(cases)) assert.ok(bannedHits(text).includes(id), `${id}: ${text}`);
  assert.ok(bannedHits("$9.99/mo").includes("$"));
  assert.ok(bannedHits("costs $").includes("$"));
  assert.ok(bannedHits("Gem jars").includes("jar"));
  assert.ok(bannedHits("pay-out").includes("payout"));
  assert.ok(bannedHits("at Mom's").includes("mom"));
  assert.ok(publicHits("Go team!").includes("exclamation"));
  assert.ok(bannedHits("therapist chase").includes("therapy"));
  assert.ok(bannedHits("auto-pay").includes("autopay"));
  for (const ok of ["Kids away", "Kids away · back Fri 3:00", "After school", "SRE pickup · 3:40", "Swim — Coach Ann · 5:00 practice", "Casey's", "Day off · no school"]) {
    assert.deepEqual(bannedHits(ok), [], ok);
  }
});

test("public text drops parent mentions and '!'", () => {
  assert.equal(publicText("Pick up Hayes at Casey's (Riley's mom)"), "Pick up Hayes at Casey's");
  assert.equal(publicText("Casey (Riley's mom) picks up Hayes"), "Casey picks up Hayes");
  assert.equal(publicText("Game day!"), "Game day");
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

const VISIBLE = new Set(["label", "reason", "what", "where", "by", "text", "note", "rule", "source"]);
function visibleStrings(obj, out = []) {
  if (Array.isArray(obj)) obj.forEach((v) => visibleStrings(v, out));
  else if (obj && typeof obj === "object") for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "string" && VISIBLE.has(k)) out.push(v);
    else if (k === "warnings" && Array.isArray(v)) v.forEach((w) => out.push(w));
    else visibleStrings(v, out);
  }
  return out;
}

test("committed public JSON (data/ + atlas-samples/) is clean: banned words, '!', sentence case", () => {
  const files = [
    "data/house-mode.json", "data/pickup-chain.json", "data/house-mode-temps.json", "data/who-home.json",
    "data/pack-flags.json", "config/house-mode.config.json",
    ...fs.readdirSync(path.join(ROOT, "docs/wall-redesign/atlas-samples")).map((f) => `docs/wall-redesign/atlas-samples/${f}`),
  ];
  for (const rel of files) {
    const obj = readJson(path.join(ROOT, rel));
    assert.deepEqual(scanObject(obj), [], rel);
    for (const v of visibleStrings(obj)) {
      if (rel.startsWith("config/")) continue; /* config notes are not wall text */
      assert.doesNotMatch(v, /^[^A-Za-z0-9]*[a-z]/, `${rel}: not sentence case: ${v}`);
    }
  }
});

test("Atlas lane source never mentions a jar, payouts, balances, or $ in user-visible strings", () => {
  for (const rel of ["scripts/house-mode.mjs", "scripts/pickup-chain.mjs", "scripts/house/wall-state.mjs"]) {
    const src = fs.readFileSync(path.join(ROOT, rel), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    const literals = (src.match(/"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g) || []).map((q) => q.replace(/\$\{[^}]*\}/g, ""));
    for (const lit of literals) {
      assert.doesNotMatch(lit, /\bjars?\b|pay-?outs?|\bbalances?\b|\bmom\b|!/i, `${rel}: ${lit}`);
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
