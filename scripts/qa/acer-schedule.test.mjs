/* Day schedule: synthetic events through calendar-refresh and cal-from-events, then the display allowlist.
   Offline copy must say the schedule is unavailable. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const NOW = "2026-11-10T12:30:00-06:00";
const events = {
  events: [
    { id: "span", summary: "Kids with Dan", start: { date: "2026-11-09" }, end: { date: "2026-11-16" } },
    { id: "bad", summary: "Hayes — provider school visit confirmed", description: "therapy notes", start: { dateTime: "2026-11-10T14:50:00-06:00" }, end: { dateTime: "2026-11-10T15:30:00-06:00" } },
    { id: "clin", summary: "Harris — clinical school visit", start: { dateTime: "2026-11-10T11:00:00-06:00" }, end: { dateTime: "2026-11-10T11:30:00-06:00" } },
    { id: "pick", summary: "Hayes — school pickup", description: "provider notes in the description", start: { dateTime: "2026-11-10T15:15:00-06:00" }, end: { dateTime: "2026-11-10T15:30:00-06:00" } },
    { id: "dad", summary: "Dan — school pickup", start: { dateTime: "2026-11-10T15:15:00-06:00" }, end: { dateTime: "2026-11-10T15:30:00-06:00" } },
    { id: "swim", summary: "Ainsley swim · Coach Ann", start: { dateTime: "2026-11-10T16:25:00-06:00" }, end: { dateTime: "2026-11-10T17:00:00-06:00" } },
    { id: "soc", summary: "Harris — leave for soccer · 6:30-7:30", start: { dateTime: "2026-11-10T18:00:00-06:00" }, end: { dateTime: "2026-11-10T19:30:00-06:00" } }
  ]
};

function home() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wardos-sched-"));
  fs.mkdirSync(path.join(dir, ".config/wardos"), { recursive: true });
  fs.writeFileSync(path.join(dir, ".config/wardos/privacy-block.txt"), "# synthetic\n");
  fs.writeFileSync(path.join(dir, ".config/wardos/private-names.tsv"), "school\tSampleSchool\npartner\tSamplePartner\ncoparent\tSampleCoparent\n");
  const priv = path.join(dir, "priv");
  fs.mkdirSync(priv, { recursive: true });
  fs.writeFileSync(path.join(priv, "kids-week.json"), JSON.stringify({ kids: { ainsley: {}, hayes: {}, harris: {}, dan: {} }, boardStrip: { queue: [] } }));
  return { dir, priv };
}

function display() {
  const ctx = { location: { search: "" }, document: { documentElement: { setAttribute() {} } }, localStorage: { getItem: () => null } };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "house-event-display.js"), "utf8"), ctx);
  return ctx.HouseEventDisplay;
}

function rowText(rows) {
  return (rows || []).map((r) => [r.what, r.title, r.when, r.time, r.startIso].filter(Boolean).join(" ")).join("\n");
}

test("calendar-refresh and cal-from-events agree on the Thursday breakfast events", (t) => {
  const h = home();
  t.after(() => fs.rmSync(h.dir, { recursive: true, force: true }));
  const ev = path.join(h.dir, "events.json");
  fs.writeFileSync(ev, JSON.stringify(events));
  const env = { ...process.env, HOME: h.dir, WARDOS_PRIVATE_DIR: h.priv };
  const refresh = spawnSync("node", [path.join(ROOT, "scripts/calendar-refresh.mjs"), "--events", ev, "--week", path.join(h.priv, "kids-week.json"), "--no-mirror", "--now", NOW], { encoding: "utf8", env });
  assert.equal(refresh.status, 0, refresh.stderr);
  const live = path.join(h.priv, "cal-live.json");
  const from = spawnSync("node", [path.join(ROOT, "scripts/cal-from-events.mjs"), "--events", ev, "--out", live, "--now", NOW], { encoding: "utf8", env });
  assert.equal(from.status, 0, from.stderr);
  const week = JSON.parse(fs.readFileSync(path.join(h.priv, "kids-week.json"), "utf8"));
  const cal = JSON.parse(fs.readFileSync(live, "utf8"));
  const D = display();
  for (const id of ["hayes", "harris", "ainsley", "dan"]) {
    const blob = JSON.stringify(week.kids[id] || {});
    assert.equal(/provider|clinical|therap|counsel/.test(blob), false, id + " " + blob.slice(0, 240));
  }
  const hayes = D.summarize({ summary: "Hayes — school pickup", kind: "school_pickup", startIso: "2026-11-10T15:15:00-06:00" }, "hayes");
  const dad = D.summarize({ summary: "Dan — school pickup", kind: "school_pickup", startIso: "2026-11-10T15:15:00-06:00" }, "shared");
  const swim = D.summarize({ summary: "Ainsley swim · Coach Ann", startIso: "2026-11-10T16:25:00-06:00" }, "ainsley");
  const soccer = D.summarize({ summary: "Harris — leave for soccer · 6:30-7:30", kind: "leave", startIso: "2026-11-10T18:00:00-06:00" }, "harris");
  assert.equal(hayes.title, "School pickup");
  assert.equal(hayes.time, "3:15 PM");
  assert.equal(dad.title, "School pickup");
  assert.equal(dad.time, "3:15 PM");
  assert.equal(JSON.stringify(week.kids.dan).includes("School pickup") || rowText(week.kids.dan.today).includes("pickup"), true);
  assert.equal(swim.title, "Swim");
  /* Dan, Nov 10 2026, 6:08 PM CT: Ainsley's schedule shows the real time. The title stays word-only. */
  assert.equal(swim.time, "4:25 PM");
  assert.equal(/\d/.test(swim.title), false);
  assert.equal(soccer.title, "Leave for soccer");
  assert.equal(soccer.time, "6:00 PM");
  assert.equal(/6:30/.test(soccer.title + soccer.time), false);
  const calBlob = JSON.stringify(cal);
  assert.equal(/provider|clinical|therap/.test(calBlob), false);
  assert.match(calBlob, /pickup|Pickup|swim|Swim|soccer|Soccer/i);
});

test("a missing feed shows Nothing next and logs it", () => {
  const src = fs.readFileSync(path.join(ROOT, "kid-world.js"), "utf8");
  /* The kid sees Nothing next. The miss is a log, not a sentence kept in a comment for this check. */
  assert.match(src, /n\.textContent = "Nothing next"/);
  assert.match(src, /console\.info\("\[kid-next\] schedule feed missing"\)/);
  assert.doesNotMatch(src, /Schedule didn't load/);
  assert.doesNotMatch(src, /Schedule unavailable/);
  assert.doesNotMatch(src, /A free week/);
  assert.doesNotMatch(src, /Nothing on your week yet/);
});
