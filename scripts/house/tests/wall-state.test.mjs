import { test } from "node:test";
import assert from "node:assert/strict";
import { whoHomeFor, checkIn, packFlagsFor, addPackFlag, bandsFromTemps, houseDay } from "../wall-state.mjs";
import { readJson } from "../lib.mjs";
import path from "node:path";
import { ROOT, at } from "./fixture.mjs";

test("who-home: three names, null by default, resets at 3:00 AM CT", () => {
  let s = whoHomeFor(null, at("2026-10-01T15:45:00-05:00"));
  assert.deepEqual(s.kids.map((k) => k.name), ["Hayes", "Ainsley", "Harris"]);
  assert.ok(s.kids.every((k) => k.checkedInAt === null));
  s = checkIn(s, "harris", at("2026-10-01T15:50:00-05:00"));
  assert.equal(s.kids.find((k) => k.id === "harris").checkedInAt, "2026-10-01T15:50:00-05:00");
  assert.equal(whoHomeFor(s, at("2026-10-02T02:59:00-05:00")).kids[2].checkedInAt, "2026-10-01T15:50:00-05:00");
  assert.equal(whoHomeFor(s, at("2026-10-02T03:00:00-05:00")).kids[2].checkedInAt, null);
  assert.equal(houseDay(at("2026-10-02T02:59:00-05:00")), "2026-10-01");
});

test("pack flags: kid + text + createdAt, cleared at end of CT day, banned text refused", () => {
  let p = addPackFlag(null, "Hayes", "flag 5:30, cleats", at("2026-10-01T07:10:00-05:00"));
  assert.equal(p.flags.length, 1);
  assert.deepEqual(Object.keys(p.flags[0]), ["kid", "text", "createdAt"]);
  p = addPackFlag(p, "Hayes", "bring $20", at("2026-10-01T07:11:00-05:00"));
  p = addPackFlag(p, "Theo", "cleats", at("2026-10-01T07:11:00-05:00"));
  assert.equal(p.flags.length, 1);
  assert.equal(packFlagsFor(p, at("2026-10-01T23:59:00-05:00")).flags.length, 1);
  assert.equal(packFlagsFor(p, at("2026-10-02T00:00:00-05:00")).flags.length, 0);
});

test("temps: all null 'awaiting Dan' -> no bands -> thermostat light can't flag", () => {
  const temps = readJson(path.join(ROOT, "data/house-mode-temps.json"));
  assert.equal(temps.note, "awaiting Dan");
  assert.equal(Object.keys(temps.modes).length, 7);
  assert.ok(Object.values(temps.modes).every((m) => m.heatSetpoint === null && m.coolSetpoint === null));
  assert.deepEqual(bandsFromTemps(temps), {});
  const set = { modes: { ...temps.modes, "school-day": { heatSetpoint: 68, coolSetpoint: null } } };
  assert.deepEqual(bandsFromTemps(set), { "school-day": { heatSetpoint: [68, 68] } });
});

test("thermostat light integration with Wright's stub: no flag while temps are null", async () => {
  const W = (await import("../../../house-wall-status.js")).default;
  const temps = readJson(path.join(ROOT, "data/house-mode-temps.json"));
  const now = at("2026-10-01T17:30:00-05:00");
  const sensi = { status: "live", updatedAt: new Date(now - 60000).toISOString(), thermostat: { online: true, ambient: 73, mode: "Auto", heatSetpoint: 65, coolSetpoint: 78 } };
  const mode = { id: "after-school", label: "After school" };
  const light = W.thermoLight(sensi, { mode, bands: bandsFromTemps(temps), now });
  assert.equal(light.ok, true);
  assert.equal(light.text, "73°, After school");
  const flagged = W.thermoLight(sensi, { mode, bands: bandsFromTemps({ modes: { "after-school": { heatSetpoint: 70 } } }), now });
  assert.equal(flagged.ok, false);
});
