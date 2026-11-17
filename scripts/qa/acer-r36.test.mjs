/* Round 36. Synthetic titles only. No clinical text. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

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
  return ctx;
}

const WHEN = "2026-11-10T22:30:00-06:00";

test("r36 a Dan row that names Harris does not become Appointment", () => {
  const D = bootLaw().HouseEventDisplay;
  const row = { summary: "Harris appointment", startIso: WHEN, when: "Tue 10 · 10:30 PM" };
  assert.equal(D.summarize(row, "dan"), null);
  assert.equal(D.summarize(row, "shared"), null);
  assert.equal(D.summarize(row, "dad"), null);
  assert.equal(D.summarize({ summary: "Appointment", description: "for Harris", startIso: WHEN }, "dan"), null);
  assert.equal(D.summarize({ summary: "Appointment", location: "Harris room", startIso: WHEN }, "shared"), null);
});

test("r36 an Ainsley row that names Hayes does not become Appointment", () => {
  const D = bootLaw().HouseEventDisplay;
  const row = { summary: "Hayes session", startIso: WHEN, when: "Tue 10 · 10:30 PM" };
  assert.equal(D.summarize(row, "ainsley"), null);
  assert.equal(D.summarize(row, "shared"), null);
  const own = D.summarize({ summary: "Appointment", startIso: WHEN }, "ainsley");
  assert.equal(own, null);
});

test("r36 Mercury plates have no smeared left edge and the wrap is mirrored", () => {
  const src = read("mercury-run.js");
  const branch = src.slice(src.indexOf("img.width === W && img.height === H"), src.indexOf("var tr = trimFor"));
  assert.match(branch, /scale\(-1,\s*1\)/);
  const r = spawnSync("python3", ["-c", `
import json, numpy as np
from PIL import Image
sky = np.asarray(Image.open("assets/ori/hayes/wall-1920x1080/sky.webp").convert("RGB")).astype(float)
far = np.asarray(Image.open("assets/ori/hayes/wall-1920x1080/far.webp").convert("RGBA"))
left = sky[:, :230]
rowvar = float(np.median(left.var(axis=1).mean(axis=1)))
rgb = far[:, :260, :3].astype(int)
black = int(((rgb.sum(2) < 40) & (far[:, :260, 3] > 40)).sum())
right = sky[:, -1]
seam = float(np.abs(right - right).mean())
print(json.dumps({"w": sky.shape[1], "h": sky.shape[0], "rowvar": rowvar, "black": black, "seam": seam}))
`], { cwd: ROOT, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  const m = JSON.parse(r.stdout.trim());
  assert.equal(m.w, 1920);
  assert.equal(m.h, 1080);
  assert.ok(m.rowvar > 40, JSON.stringify(m));
  assert.ok(m.black < 200, JSON.stringify(m));
  assert.ok(m.seam < 8, JSON.stringify(m));
});

test("r36 offline retry is one visible control and the toast stays hidden", () => {
  const src = read("kid-world.js");
  const show = src.slice(src.indexOf("function showRest()"), src.indexOf("function hideRest()"));
  assert.match(show, /display", "none"/);
  assert.match(show, /n\.hidden = true/);
  const note = src.slice(src.indexOf("function weekNote"), src.indexOf("var showRestBound"));
  assert.match(note, /Schedule not loaded/);
});
