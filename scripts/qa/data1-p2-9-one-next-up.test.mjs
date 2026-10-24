/* DATA1 P2-9 · ONE Next Up builder: cal-from-events --patch-week keeps calendar-refresh's boardStrip (queue + nextLeave)
   instead of overwriting it with the queue-less cal-live hero. */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { ROOT, NAMES } from "./data1-lib.mjs";
test("patch-week leaves the refresh-built strip alone", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "data1-p29-"));
  try {
    const t = new Date(Date.now() + 2 * 3600e3), e = new Date(t.getTime() + 1800e3);
    fs.writeFileSync(path.join(dir, "ev.json"), JSON.stringify({ events: [{ id: "a", summary: "Leave · Hayes practice", start: { dateTime: t.toISOString() }, end: { dateTime: e.toISOString() } }] }));
    const strip = { label: "Next up · today", place: "from refresh", queue: [{ place: "from refresh", leaveBy: true }], nextLeave: { place: "from refresh" } };
    fs.writeFileSync(path.join(dir, "kw.json"), JSON.stringify({ kids: { dan: { id: "dan" } }, boardStrip: strip }));
    fs.copyFileSync(path.join(ROOT, "kids-data.js"), path.join(dir, "kids-data.js"));
    execFileSync("node", [path.join(ROOT, "scripts/cal-from-events.mjs"), "--events", path.join(dir, "ev.json"), "--out", path.join(dir, "cal.json"), "--patch-week", path.join(dir, "kw.json")], { stdio: "pipe", env: { ...process.env, WARDOS_NAMES: NAMES, WARDOS_PRIVATE_DIR: dir } });
    const w = JSON.parse(fs.readFileSync(path.join(dir, "kw.json"), "utf8"));
    assert.equal(w.boardStrip.place, "from refresh");
    assert.ok(Array.isArray(w.boardStrip.queue) && w.boardStrip.nextLeave);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
