#!/usr/bin/env node
/* ATLASLANE6 · scripts/display-rename.mjs · apply the display-only renames to built public files in place.
   NOT WIRED. Never touches the calendar. Builders already call the same rules (calendar-refresh.mjs, cal-from-events.mjs,
   cal-months.py); this is for files already built (and a --check for CI).
   --money also drops dollar amounts (calendar-label files: cal-months.json); "$15/hr" is the one allowed tag.
   Usage: node scripts/display-rename.mjs [--check] [--money] data/cal-months.json data/kids-week.json kids-week.json data/cal-live.json kids-data.js */
import fs from "node:fs";
import { displayDeepReport, momHits } from "./house/display-rename.mjs";

const args = process.argv.slice(2);
const check = args.includes("--check");
const money = args.includes("--money"); /* calendar-label files only (cal-months.json) */
let bad = 0;
for (const fp of args.filter((a) => !a.startsWith("--"))) {
  if (!fs.existsSync(fp)) { console.log(`${fp}: absent, skip`); continue; }
  const src = fs.readFileSync(fp, "utf8");
  let obj, wrap = null;
  if (fp.endsWith(".js")) {
    const m = /var EMBEDDED = (\{[\s\S]*?\});/.exec(src);
    if (!m) { console.log(`${fp}: no EMBEDDED block, skip`); continue; }
    obj = JSON.parse(m[1]); wrap = m;
  } else obj = JSON.parse(src);
  const { value, renamed, dropped } = displayDeepReport(obj, undefined, { money });
  for (const r of renamed) console.log(`${fp}: renamed ${JSON.stringify(r.from)} -> ${JSON.stringify(r.to)}`);
  for (const d of dropped) console.log(`${fp}: dropped ${JSON.stringify(d)}`);
  const left = momHits(value);
  if (left.length) { bad++; console.log(`${fp}: STILL ${JSON.stringify(left)}`); }
  if (check) { if (renamed.length || dropped.length) bad++; continue; }
  if (!renamed.length && !dropped.length) continue;
  let out;
  if (wrap) out = src.replace(/var EMBEDDED = \{[\s\S]*?\};/, () => "var EMBEDDED = " + JSON.stringify(value) + ";");
  else {
    const pretty = /^\{\n  "/.test(src);
    out = (pretty ? JSON.stringify(value, null, 2) : JSON.stringify(value)) + (src.endsWith("\n") ? "\n" : "");
  }
  fs.writeFileSync(fp, out);
}
process.exit(bad ? 1 : 0);
