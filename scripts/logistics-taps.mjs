#!/usr/bin/env node
/* ATLASLANE6 · scripts/logistics-taps.mjs · writes data/logistics-taps.json (empty or normalized per-device state).
   NOT WIRED. No network. Never sends to a person. Contract: docs/wall-redesign/LOGISTICS-TAPS.md.
   Usage: node scripts/logistics-taps.mjs [--state <local export {taps:[…]}>] [--now ISO] [--out data/logistics-taps.json] [--stdout] */
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { readJson, writeJson, scanObject } from "./house/lib.mjs";
import { logisticsFile } from "./house/logistics-lib.mjs";
import { momHits } from "./house/display-rename.mjs";
import { cliGuard } from "./house/cli-guard.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const USAGE = "Usage: node scripts/logistics-taps.mjs [--state <local export {taps:[…]}>] [--now ISO] [--out data/logistics-taps.json] [--stdout] [--help|-h]\n  Writes data/logistics-taps.json (or --out) unless --stdout. --help prints this and writes nothing.";
cliGuard(process.argv, { usage: USAGE, flags: { "--state": true, "--now": true, "--out": true, "--stdout": false } }); /* CLIGUARD1: before any read/write */
const a = { state: null, now: null, out: path.join(ROOT, "data/logistics-taps.json"), stdout: false };
for (let i = 2; i < process.argv.length; i++) {
  const k = process.argv[i], v = process.argv[i + 1];
  if (k === "--state") { a.state = path.resolve(v); i++; }
  else if (k === "--now") { a.now = Date.parse(v); i++; }
  else if (k === "--out") { a.out = path.resolve(v); i++; }
  else if (k === "--stdout") a.stdout = true;
}
const t = a.now == null || isNaN(a.now) ? Date.now() : a.now;
const state = a.state && fs.existsSync(a.state) ? readJson(a.state, null) : null;
const out = logisticsFile(state, t);
const hits = scanObject(out).concat(momHits(out));
if (hits.length) throw new Error("logistics-taps failed wall-safe scan: " + JSON.stringify(hits));
if (a.stdout) process.stdout.write(JSON.stringify(out, null, 2) + "\n");
else { writeJson(a.out, out); console.log(`logistics-taps: ${out.taps.length} tap(s) · status ${out.status ? out.status.line : "none"} -> ${path.relative(process.cwd(), a.out)}`); }
