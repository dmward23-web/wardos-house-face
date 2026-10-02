#!/usr/bin/env node
/* ATLASLANE4+5 · scripts/kid-layer.mjs · Kid layer v3 data (no UI) · NOT WIRED (no cron, no deploy).
   Writes data/kid-seats.json + data/unlocks.json from MUSTS taps + kids-week.json + calendar (read-only).
   Taps: --taps <file> (hub store {key:{id:{v,t}}} or a localStorage export {key:{id:bool}}).
         Default: the hub store ~/.config/wardos/kid-taps.json if present (taps are per-device unless the hub has them).
   Spends: --uses <file>, default data/unlock-uses.json = {note, uses:[{unlock, weekId (earned week), usedAt, choice?}]}.
           Per-device until a shared write path is approved. Unlocks carry over until spent (no weekly reset, no stacking).
   Usage: node scripts/kid-layer.mjs [--data-dir data] [--events …] [--taps …] [--uses …] [--now ISO] [--stdout] */
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadInputs, readJson, writeJson, ctIso } from "./house/lib.mjs";
import { computeKidLayer } from "./house/kid-layer-lib.mjs";
const USAGE = "Usage: node scripts/kid-layer.mjs [--data-dir data] [--events …] [--taps …] [--uses …] [--now ISO] [--stdout] [--help]\n--help prints this and writes nothing.";
if (process.argv.includes("--help") || process.argv.includes("-h")) { /* ATLASLANE7 --help is print-only, never writes */
  process.stdout.write(USAGE + "\n");
  process.exit(0);
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const a = {
    dataDir: path.join(ROOT, "data"), calLive: null, events: "/workspace/cal-dmward23-week.json", kidsWeek: null,
    taps: path.join(os.homedir(), ".config/wardos/kid-taps.json"), uses: null,
    config: path.join(ROOT, "config/kid-layer.config.json"), outDir: path.join(ROOT, "data"), now: null, stdout: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i], v = argv[i + 1];
    if (k === "--data-dir") { a.dataDir = path.resolve(v); i++; }
    else if (k === "--cal-live") { a.calLive = path.resolve(v); i++; }
    else if (k === "--events") { a.events = path.resolve(v); i++; }
    else if (k === "--kids-week") { a.kidsWeek = path.resolve(v); i++; }
    else if (k === "--taps") { a.taps = path.resolve(v); i++; }
    else if (k === "--uses") { a.uses = path.resolve(v); i++; }
    else if (k === "--config") { a.config = path.resolve(v); i++; }
    else if (k === "--out-dir") { a.outDir = path.resolve(v); i++; }
    else if (k === "--now") { a.now = Date.parse(v); i++; }
    else if (k === "--stdout") a.stdout = true;
  }
  return a;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const a = parseArgs(process.argv);
  const inp = loadInputs({ dataDir: a.dataDir, calLive: a.calLive, events: a.events, kidsWeek: a.kidsWeek, override: "/nonexistent" });
  const taps = fs.existsSync(a.taps) ? readJson(a.taps, {}) : {};
  const usesPath = a.uses || path.join(ROOT, "data/unlock-uses.json");
  const uses = fs.existsSync(usesPath) ? readJson(usesPath, { uses: [] }) : { uses: [] };
  const now = a.now == null || isNaN(a.now) ? Date.now() : a.now;
  const { kidSeats, unlocks } = computeKidLayer({ calendar: inp.calendar, kidsWeek: inp.kidsWeek, taps, uses, config: readJson(a.config), now });
  const tapsNote = fs.existsSync(a.taps) ? `MUSTS taps (${path.basename(a.taps)}, updated ${ctIso(fs.statSync(a.taps).mtimeMs)})` : "MUSTS taps (none found)";
  kidSeats.source = unlocks.source = `${tapsNote} + kids-week.json quests + ${inp.sourceLabel.replace(/ \+ kids-week\.json.*$/, "")}`;
  if (a.stdout) process.stdout.write(JSON.stringify({ "kid-seats": kidSeats, unlocks }, null, 2) + "\n");
  else {
    writeJson(path.join(a.outDir, "kid-seats.json"), kidSeats);
    writeJson(path.join(a.outDir, "unlocks.json"), unlocks);
    console.log(`kid-layer: week ${kidSeats.week.id} · closed ${Object.entries(kidSeats.seats).filter(([, s]) => s.week.closed).length}/3 · lit ${unlocks.lit.length} -> ${path.relative(process.cwd(), a.outDir)}/{kid-seats,unlocks}.json`);
  }
}
