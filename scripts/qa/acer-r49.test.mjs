/* Round 49. The r43 scrub, and the r44/r45 harnesses, hold on today and two other dates. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const bit = (...p) => p.join("");
const SHIFTS = [0, -21, 16];

function lawAt(clockMs) {
  const frozen = new Date(clockMs);
  const ctx = {
    Intl, Date, decodeURIComponent, WeakSet,
    document: { readyState: "complete", write() {}, documentElement: { getAttribute() { return null; }, setAttribute() {} } },
    LHClock: { now: () => frozen, ms: () => clockMs },
    HouseScene: { now: () => frozen }
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "house-event-display.js"), "utf8"), ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "house-face-law.js"), "utf8"), ctx);
  return ctx;
}

function scrubAt(clockMs) {
  const when = new Date(clockMs + 3 * 3600000).toISOString();
  const ctx = lawAt(clockMs);
  const data = {
    kids: {
      ainsley: { today: [
        { what: bit("H4", " yes", " check", "up"), who: bit("Hay", "es", " Wa", "rd"), kidName: bit("Harr", "is", " Wa", "rd"), htmlLink: "https://example.test/secret-link-token", startIso: when },
        { what: bit("Ven", "mo", " Er", "in"), startIso: when },
        { what: bit("Hay", "es", " soccer"), startIso: when },
        { what: "Dentist", description: "#wardos-show", startIso: when },
        { what: bit("Hay", "es", " ther", "apy"), description: "#wardos-show", who: bit("Hay", "es", " Wa", "rd"), startIso: when }
      ] },
      dan: { today: [{ what: bit("Pay", " child", " sup", "port"), startIso: when }, { what: bit("Mort", "gage", " due"), startIso: when }] }
    }
  };
  ctx.HouseFaceLaw.cleanKidsWeek(data);
  return { blob: JSON.stringify(data), data, labels: new Set(ctx.HouseEventDisplay.LABELS) };
}

test("r49 the scrubbed payload holds on today and two other dates", () => {
  for (const shift of SHIFTS) {
    const got = scrubAt(Date.now() + shift * 86400000);
    for (const banned of ["H4", "checkup", "Venmo", "Hayes", "Harris", "therapy", "Pay child", "Mortgage", "secret-link-token", "kidName", "htmlLink"]) {
      assert.equal(got.blob.includes(banned), false, shift + " " + banned);
    }
    assert.match(got.blob, /Soccer/, String(shift));
    assert.match(got.blob, /Appointment/, String(shift));
    for (const row of got.data.kids.ainsley.today) assert.equal(got.labels.has(row.what), true, row.what);
    for (const row of got.data.kids.dan.today) assert.equal(got.labels.has(row.what), true, row.what);
  }
});

const browser = spawnSync("python3", ["-c", "import playwright.sync_api"], { encoding: "utf8" }).status === 0 && process.env.QA_NO_BROWSER !== "1";
const SKIP = browser ? {} : { skip: "SKIP no playwright (QA_NO_BROWSER)" };

test("r49 the r44 views pass on this month and two others", SKIP, () => {
  for (const shift of SHIFTS) {
    const r = spawnSync("python3", [path.join(ROOT, "scripts/qa/acer_r44_views.py")], {
      encoding: "utf8",
      timeout: 240000,
      env: { ...process.env, WARDOS_DAY_SHIFT: String(shift) }
    });
    assert.equal(r.status, 0, shift + " " + (r.stderr || "").slice(-400) + (r.stdout || "").slice(-250));
    const o = JSON.parse(r.stdout.trim().split("\n").pop());
    assert.equal(o.pages.dad.has.Appointment, true, "dad " + shift);
    assert.equal(o.pages.dad.has["Mortgage due"], true, "dad raw " + shift);
    assert.equal(o.pages.month.has.Soccer, true, "month " + shift);
    assert.equal(o.pages.month.has.Appointment, true, "month appt " + shift);
    assert.equal(o.home.full, true, "clock " + shift);
  }
});

test("r49 the r45 live rows stay ahead of the wall clock on three dates", () => {
  const r = spawnSync("python3", ["-c", `
import os, sys
sys.path.insert(0, "scripts/qa")
from datetime import datetime
from zoneinfo import ZoneInfo
from fixture_clock import plan
wall = datetime.now(ZoneInfo("America/Chicago"))
for shift in (0, -21, 16):
    p = plan(shift)
    soon = datetime.fromisoformat(p["soon"])
    end = datetime.fromisoformat(p["soon_end"])
    pin = datetime.fromisoformat(p["pin"])
    assert soon > wall, (shift, soon, wall)
    assert end > soon
    assert pin.hour == 12 and pin.minute == 30
    assert p["day"].endswith("-01")
print("ok")
`], { encoding: "utf8", cwd: ROOT });
  assert.equal(r.status, 0, (r.stderr || "") + (r.stdout || ""));
  assert.match(r.stdout, /ok/);
});
