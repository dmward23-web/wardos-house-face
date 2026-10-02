#!/usr/bin/env node
/* LIVEDATA1 · scripts/who-home.mjs · writes data/who-home.json for the current house day (resets 3:00 AM CT).
   Keeps today's check-ins from --state (a local export {kids:[{id,checkedInAt}]}) or the existing file; any check-in
   from an earlier house day drops to null (wall-state.mjs whoHomeFor). No network. Never sends to a person.
   Usage: node scripts/who-home.mjs [--state <file>] [--now ISO] [--out data/who-home.json] [--stdout] [--help] */
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { readJson, writeJson } from "./house/lib.mjs";
import { whoHomeFor } from "./house/wall-state.mjs";
import { cliArgs } from "./house/cli-args.mjs";
const USAGE = "Usage: node scripts/who-home.mjs [--state <file>] [--now ISO] [--out data/who-home.json] [--stdout] [--help]\n--help prints this and writes nothing. Unknown flags exit 2, nothing written.";
const r = cliArgs(process.argv, { name: "who-home", usage: USAGE, values: ["--state", "--now", "--out"], bools: ["--stdout"] });
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = r.values["--out"] ? path.resolve(r.values["--out"]) : path.join(ROOT, "data/who-home.json");
const statePath = r.values["--state"] ? path.resolve(r.values["--state"]) : out;
const n = r.values["--now"] ? Date.parse(r.values["--now"]) : NaN;
const t = isNaN(n) ? Date.now() : n;
const prev = fs.existsSync(statePath) ? readJson(statePath, null) : null;
const v = whoHomeFor(prev, t);
if (r.bools.has("--stdout")) process.stdout.write(JSON.stringify(v, null, 2) + "\n");
else { writeJson(out, v); console.log(`who-home: house day ${v.date} · ${v.kids.filter((k) => k.checkedInAt).length} in -> ${path.relative(process.cwd(), out)}`); }
