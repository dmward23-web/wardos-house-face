/* KID-FEED-SAFETY · synthetic events only. Isolated HOME. No live feeds. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(import.meta.url);
require(path.join(ROOT, "house-event-display.js"));
const D = globalThis.HouseEventDisplay;

function home() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wardos-kidsafe-"));
  fs.mkdirSync(path.join(dir, ".config/wardos"), { recursive: true });
  fs.writeFileSync(path.join(dir, ".config/wardos/privacy-block.txt"), "# synthetic\\n\\\\bSampleProvider\\\\b\\n");
  fs.writeFileSync(path.join(dir, ".config/wardos/private-names.tsv"), "school\tSampleSchool\n");
  const priv = path.join(dir, "priv");
  fs.mkdirSync(priv, { recursive: true });
  fs.writeFileSync(path.join(priv, "kids-week.json"), JSON.stringify({ kids: { ainsley: {}, hayes: {}, harris: {}, dan: {} }, boardStrip: { queue: [] } }));
  return { dir, priv };
}

const events = {
  events: [
    { id: "span", summary: "Kids with Dan", start: { date: "2026-11-09" }, end: { date: "2026-11-16" } },
    { id: "bad", summary: "Hayes — provider check-in · confirmed Mon 9:00", description: "<img src=x onerror=alert(1)> therapy notes", start: { dateTime: "2026-11-10T14:50:00-06:00" }, end: { dateTime: "2026-11-10T15:30:00-06:00" } },
    { id: "counsel", summary: "Harris counseling check in", kind: "school", start: { dateTime: "2026-11-10T13:00:00-06:00" }, end: { dateTime: "2026-11-10T13:30:00-06:00" } },
    { id: "pick", summary: "Hayes — school pickup", description: "front door", start: { dateTime: "2026-11-10T15:15:00-06:00" }, end: { dateTime: "2026-11-10T15:30:00-06:00" } },
    { id: "swim", summary: "Ainsley swim", start: { dateTime: "2026-11-10T16:25:00-06:00" }, end: { dateTime: "2026-11-10T17:00:00-06:00" } },
    { id: "soc", summary: "Harris — leave for soccer · 6:30-7:30", start: { dateTime: "2026-11-10T18:00:00-06:00" }, end: { dateTime: "2026-11-10T19:30:00-06:00" } },
    { id: "gone", summary: "Canceled Sample visit", status: "confirmed", start: { dateTime: "2026-11-10T19:00:00-06:00" }, end: { dateTime: "2026-11-10T20:00:00-06:00" } },
    { id: "opt", summary: "Hayes provider check-in", providerOptIn: true, start: { dateTime: "2026-11-12T15:00:00-06:00" }, end: { dateTime: "2026-11-12T16:00:00-06:00" } }
  ]
};

function runRefresh(t) {
  const h = home();
  t.after(() => fs.rmSync(h.dir, { recursive: true, force: true }));
  const ev = path.join(h.dir, "events.json");
  fs.writeFileSync(ev, JSON.stringify(events));
  const r = spawnSync("node", [path.join(ROOT, "scripts/calendar-refresh.mjs"), "--events", ev, "--week", path.join(h.priv, "kids-week.json"), "--no-mirror", "--now", "2026-11-10T12:30:00-06:00"], {
    encoding: "utf8",
    env: { ...process.env, HOME: h.dir, WARDOS_PRIVATE_DIR: h.priv }
  });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(fs.readFileSync(path.join(h.priv, "kids-week.json"), "utf8"));
}

test("client allowlist fails closed for boys", () => {
  const bad = { summary: "provider check-in · confirmed Mon 9:00", description: "therapy", kind: "school", startIso: "2026-11-10T14:50:00-06:00" };
  assert.equal(D.summarize(bad, "hayes"), null);
  assert.equal(D.summarize(bad, "harris"), null);
  assert.equal(D.summarize({ ...bad, providerOptIn: true }, "hayes"), null);
  assert.equal(D.summarize({ summary: "Harris — clinical check-in", providerOptIn: true }, "harris"), null);
  assert.equal(D.summarize({ summary: "Hayes — provider check-in · confirmed Mon 9:00", providerOptIn: true }, "hayes"), null);
  assert.equal(D.isDenied({ summary: "clinical check-in", providerOptIn: true }), true);
});

test("generator drops provider rows and keeps pickup, swim, and one soccer time", (t) => {
  const week = runRefresh(t);
  const blob = JSON.stringify(week.kids.hayes) + JSON.stringify(week.kids.harris);
  assert.equal(blob.includes("provider"), false);
  assert.equal(blob.includes("therapy"), false);
  assert.equal(blob.includes("onerror"), false);
  assert.equal(blob.includes("counsel"), false);
  assert.equal(blob.includes("6:30"), false);
  assert.match(blob, /pickup/i);
  assert.match(JSON.stringify(week.kids.harris), /soccer/i);
  assert.match(JSON.stringify(week.kids.ainsley), /swim/i);
});
