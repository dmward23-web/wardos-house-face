/* Round 50. Sheet-today must show the pinned-day rows. Empty today fails.
   The three clocks are the harness wall, not the product clock. */
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SHOWN = ["Soccer", "Swim", "School pickup", "School drop", "Baseball", "Flag", "Homework", "Choir", "Raffle", "Conference", "Donation", "HOA"];
const browser = spawnSync("python3", ["-c", "import playwright.sync_api"], { encoding: "utf8" }).status === 0 && process.env.QA_NO_BROWSER !== "1";
const SKIP = browser ? {} : { skip: "SKIP no playwright (QA_NO_BROWSER)" };

function ctDay(hour, minute, ymd) {
  const day = ymd || new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return day + "T" + String(hour).padStart(2, "0") + ":" + String(minute).padStart(2, "0") + ":00";
}

function run(script, wall, extra) {
  const r = spawnSync("python3", [path.join(ROOT, "scripts/qa", script)], {
    encoding: "utf8",
    timeout: 240000,
    env: { ...process.env, WARDOS_WALL: wall, WARDOS_SKIP_TAPS: "1", ...extra }
  });
  assert.equal(r.status, 0, wall + " " + script + " " + (r.stderr || "").slice(-400) + (r.stdout || "").slice(-250));
  return JSON.parse(r.stdout.trim().split("\n").pop());
}

test("r50 sheet-today shows its rows at today, 11:30 PM, and Nov 30 11:30 PM", SKIP, () => {
  const walls = [ctDay(15, 0), ctDay(23, 30), "2026-11-30T23:30:00"];
  for (const wall of walls) {
    const r44 = run("acer_r44_views.py", wall);
    const sheet = r44.pages["sheet-today"];
    assert.ok(sheet.rows > 0, wall + " r44 empty " + JSON.stringify(sheet.titles));
    for (const label of SHOWN) assert.equal((sheet.titles || []).includes(label), true, wall + " r44 " + label);
    assert.equal(r44.pages.dad.has.Appointment, true, wall + " dad");
    const r45 = run("acer_r45_real.py", wall);
    const today = r45.pages["sheet-today.html"];
    assert.ok(today.rows > 0, wall + " r45 empty");
    assert.equal(today.todaySoccer, true, wall + " r45 soccer " + JSON.stringify(today.titles));
    assert.equal(r45.pages["sheet-dan.html"].appointment, true, wall + " r45 dad");
  }
});
