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
import { cliArgs } from "./house/cli-args.mjs";
const USAGE = "Usage: node scripts/logistics-taps.mjs [--state <local export>] [--now ISO] [--out data/logistics-taps.json] [--stdout] [--help]\n--help prints this and writes nothing. Unknown flags exit 2, nothing written.";
const r = cliArgs(process.argv, { name: "logistics-taps", usage: USAGE, values: ["--state", "--now", "--out"], bools: ["--stdout"] }); /* --help print-only; unknown flags exit 2 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const a = { state: null, now: null, out: path.join(ROOT, "data/logistics-taps.json"), stdout: false };
if (r.values["--state"]) a.state = path.resolve(r.values["--state"]);
if (r.values["--now"]) a.now = Date.parse(r.values["--now"]);
if (r.values["--out"]) a.out = path.resolve(r.values["--out"]);
a.stdout = r.bools.has("--stdout");
const t = a.now == null || isNaN(a.now) ? Date.now() : a.now;
const state = a.state && fs.existsSync(a.state) ? readJson(a.state, null) : null;
const out = logisticsFile(state, t);
const hits = scanObject(out).concat(momHits(out));
if (hits.length) throw new Error("logistics-taps failed wall-safe scan: " + JSON.stringify(hits));
if (a.stdout) process.stdout.write(JSON.stringify(out, null, 2) + "\n");
else { writeJson(a.out, out); console.log(`logistics-taps: ${out.taps.length} tap(s) · status ${out.status ? out.status.line : "none"} -> ${path.relative(process.cwd(), a.out)}`); }
