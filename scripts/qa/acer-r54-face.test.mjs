/* r54 · the law alone drops therapy, psychiatrist, and custody rows, and a restored page remounts the world. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function lawAlone() {
  const src = fs.readFileSync(path.join(ROOT, "house-face-law.js"), "utf8");
  const box = { document: { readyState: "complete", write() {} } };
  box.window = box;
  vm.createContext(box);
  vm.runInContext(src, box);
  assert.equal(box.HouseEventDisplay, undefined);
  return box.HouseFaceLaw;
}

test("r54 cleanFeed drops therapy, psychiatrist, and custody rows with the law alone", () => {
  const L = lawAlone();
  const cal = L.cleanFeed("cal-live", { upcomingLeaves: [
    { summary: "Smith therapy", start: "2026-11-16T14:00:00-06:00" },
    { summary: "Jones psychiatrist", start: "2026-11-16T15:00:00-06:00" },
    { summary: "Kids with Dad this week", start: "2026-11-16T16:00:00-06:00" },
    { summary: "Hayes dentist", start: "2026-11-16T17:00:00-06:00" },
    { summary: "Skate City Night", start: "2026-11-16T18:00:00-06:00" },
  ] });
  assert.equal(cal.upcomingLeaves.map((e) => String(e.summary)).join("\n"), "Skate City Night");
});

test("r54 a restored page remounts the world or marks ori-nogl", () => {
  const src = fs.readFileSync(path.join(ROOT, "house-ori-world.js"), "utf8");
  assert.match(src, /function mountWorld\(\)/);
  assert.match(src, /pagehide[\s\S]{0,500}world\.destroy\(\)/);
  assert.match(src, /if \(ev\.persisted && !world\) bootWorld\(\);/);
  assert.match(src, /function bootWorld\(\) \{\s*mountWorld\(\);\s*bindWorld\(\);/);
});
