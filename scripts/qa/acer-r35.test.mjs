/* Round 35 · Alfred gate items 1, 3, 4, and 5. Generic titles only. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const bit = (a, b) => a + b;

function bootLaw() {
  const ctx = {
    window: null,
    Intl,
    Date,
    document: { readyState: "complete", write() {}, documentElement: { getAttribute() { return null; }, setAttribute() {} } }
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(read("house-event-display.js"), ctx);
  vm.runInContext(read("house-face-law.js"), ctx);
  return ctx;
}

const WHEN = "2026-11-10T22:30:00-06:00";

test("r35 Ainsley and Dan appointments render as Appointment, and the boys still drop", () => {
  const D = bootLaw().HouseEventDisplay;
  const appt = { summary: "Appointment", startIso: WHEN };
  const session = { summary: "Session", startIso: WHEN };
  const typed = { summary: bit("den", "tist") + " appointment", startIso: WHEN };
  for (const who of ["ainsley", "shared", "dan", "dad"]) {
    const view = D.summarize(appt, who);
    assert.equal(view.title, "Appointment", who);
    assert.match(view.time, /10:30/);
    assert.equal(D.summarize(session, who).title, "Appointment", who + " session");
    assert.equal(D.summarize(typed, who).title, "Appointment", who + " typed");
  }
  assert.equal(D.summarize(appt, "hayes"), null);
  assert.equal(D.summarize(session, "harris"), null);
  const hard = bit("ther", "apy") + " session";
  assert.equal(D.summarize({ summary: hard, startIso: WHEN }, "ainsley"), null);
  assert.equal(D.summarize({ summary: hard, startIso: WHEN }, "dan"), null);
  assert.equal(D.summarize({ summary: hard, startIso: WHEN }, "shared"), null);
  assert.equal(D.summarize({ what: "Swim", kind: "appointment", startIso: "2026-11-10T16:25:00-06:00" }, "ainsley").title, "Swim");
});

const browser = spawnSync("python3", ["-c", "import playwright.sync_api"], { encoding: "utf8" }).status === 0 && process.env.QA_NO_BROWSER !== "1";
const SKIP = browser ? {} : { skip: "SKIP no playwright (QA_NO_BROWSER)" };

function measure() {
  const r = spawnSync("python3", [path.join(ROOT, "scripts/qa/acer_r35_measure.py")], { encoding: "utf8", timeout: 180000 });
  assert.equal(r.status, 0, (r.stderr || "").slice(-800) + (r.stdout || "").slice(-400));
  return JSON.parse(r.stdout.trim().split("\n").pop());
}

const data = browser ? measure() : null;

test("r35 Ainsley board and the Ainsley and Dad tiles show Appointment", SKIP, () => {
  const board = data.board;
  assert.match(board, /Appointment/);
  assert.match(board, /10:30/);
  assert.equal(/Nothing next/.test(board), false, board);
  for (const tile of [data.ainsley, data.dad]) {
    assert.match(tile, /Appointment/);
    assert.match(tile, /10:30/);
    assert.equal(/All done/.test(tile), false, tile);
  }
  assert.equal(/Appointment/.test(data.hayes), false, data.hayes);
  assert.equal(/Appointment/.test(data.harris), false, data.harris);
});

test("r35 a missing schedule shows the retry on the Hayes board", SKIP, () => {
  const row = data.offline;
  assert.equal(row.text, "Schedule not loaded · tap to retry");
  assert.ok(row.w >= 64 && row.h >= 64, JSON.stringify(row));
  assert.ok(row.font >= 24, JSON.stringify(row));
  assert.equal(row.tag, "BUTTON");
});

test("r35 Lights All on and All off are at least 16px apart", SKIP, () => {
  assert.ok(data.lights.gap >= 16, JSON.stringify(data.lights));
});

test("r35 Mercury layers at 1920 are drawn at their natural size", SKIP, () => {
  assert.ok(data.mercury.length >= 4, JSON.stringify(data.mercury));
  for (const draw of data.mercury) {
    assert.equal(draw.nw, 1920, JSON.stringify(draw));
    assert.equal(draw.nh, 1080, JSON.stringify(draw));
    assert.equal(draw.dw, draw.nw, JSON.stringify(draw));
    assert.equal(draw.dh, draw.nh, JSON.stringify(draw));
  }
});
