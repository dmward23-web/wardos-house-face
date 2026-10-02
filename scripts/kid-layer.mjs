#!/usr/bin/env node
/* ATLASLANE8 · scripts/kid-layer.mjs · House Face chore law, Atlas data side (no UI) · NOT WIRED (no cron, no deploy).
   Writes data/kid-seats.json + data/unlocks.json from law taps + the calendar (read-only) + config/kid-layer.config.json.
   Taps: --taps <file> (hub store {key:{id:{v,t}}} or a localStorage export {key:{id:true}}).
         Default: the hub store ~/.config/wardos/kid-taps.json if present (taps are per-device unless the hub has them).
   Spends: --uses <file>, default data/unlock-uses.json = {note, uses:[{unlock, weekId (earned week), usedAt, choice?}]}. */
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadInputs, readJson, writeJson, ctIso } from "./house/lib.mjs";
import { computeKidLayer } from "./house/kid-layer-lib.mjs";
import { cliArgs } from "./house/cli-args.mjs";
const USAGE = "Usage: node scripts/kid-layer.mjs [--data-dir data] [--cal-live …] [--events …] [--taps …] [--uses …] [--config …] [--out-dir data] [--now ISO] [--stdout] [--help]\n--help prints this and writes nothing. Unknown flags exit 2, nothing written.";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VALUE_FLAGS = { "--data-dir": "dataDir", "--cal-live": "calLive", "--events": "events", "--kids-week": "kidsWeek", "--taps": "taps", "--uses": "uses", "--config": "config", "--out-dir": "outDir" };

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const r = cliArgs(process.argv, { name: "kid-layer", usage: USAGE, values: Object.keys(VALUE_FLAGS).concat("--now"), bools: ["--stdout"] });
  const a = {
    dataDir: path.join(ROOT, "data"), calLive: null, events: "/workspace/cal-dmward23-week.json", kidsWeek: null,
    taps: path.join(os.homedir(), ".config/wardos/kid-taps.json"), uses: null,
    config: path.join(ROOT, "config/kid-layer.config.json"), outDir: path.join(ROOT, "data"),
  };
  for (const [f, k] of Object.entries(VALUE_FLAGS)) if (f in r.values) a[k] = path.resolve(r.values[f]);
  const now = "--now" in r.values ? Date.parse(r.values["--now"]) : Date.now();
  const inp = loadInputs({ dataDir: a.dataDir, calLive: a.calLive, events: a.events, kidsWeek: a.kidsWeek, override: "/nonexistent" });
  const taps = fs.existsSync(a.taps) ? readJson(a.taps, {}) : {};
  const usesPath = a.uses || path.join(ROOT, "data/unlock-uses.json");
  const uses = fs.existsSync(usesPath) ? readJson(usesPath, { uses: [] }) : { uses: [] };
  const { kidSeats, unlocks } = computeKidLayer({ calendar: inp.calendar, taps, uses, config: readJson(a.config), now });
  const tapsNote = fs.existsSync(a.taps) ? `chore-law taps (${path.basename(a.taps)}, updated ${ctIso(fs.statSync(a.taps).mtimeMs)})` : "chore-law taps (none found)";
  kidSeats.source = unlocks.source = `${tapsNote} + config/kid-layer.config.json + ${inp.sourceLabel.replace(/ \+ kids-week\.json.*$/, "")}`;
  if (r.bools.has("--stdout")) process.stdout.write(JSON.stringify({ "kid-seats": kidSeats, unlocks }, null, 2) + "\n");
  else {
    writeJson(path.join(a.outDir, "kid-seats.json"), kidSeats);
    writeJson(path.join(a.outDir, "unlocks.json"), unlocks);
    console.log(`kid-layer: law week ${kidSeats.week.id} · us together ${kidSeats.usTogether.closes}/${kidSeats.usTogether.available} · lit ${unlocks.lit.length} -> ${path.relative(process.cwd(), a.outDir)}/{kid-seats,unlocks}.json`);
  }
}
