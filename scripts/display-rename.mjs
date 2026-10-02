#!/usr/bin/env node
/* ATLASLANE6 · scripts/display-rename.mjs · apply the display-only renames to built public files in place.
   NOT WIRED. Never touches the calendar. Builders already call the same rules (calendar-refresh.mjs, cal-from-events.mjs,
   cal-months.py); this is for files already built (and a --check for CI).
   --money also drops dollar amounts (calendar-label files: cal-months.json); "$15/hr" is the one allowed tag.
   Usage: node scripts/display-rename.mjs [--check] [--money] data/cal-months.json data/kids-week.json kids-week.json data/cal-live.json kids-data.js */
import fs from "node:fs";
import { displayDeepReport, momHits } from "./house/display-rename.mjs";
import { kidCopyDeep, kidMoneyHits, kidLawHits } from "./house/kid-copy.mjs";
import { cliArgs } from "./house/cli-args.mjs";
const USAGE = "Usage: node scripts/display-rename.mjs [--check] [--money] [--kid-copy] <files…>\n--help prints this and writes nothing. Unknown flags exit 2, nothing written.";
const r = cliArgs(process.argv, { name: "display-rename", usage: USAGE, bools: ["--check", "--money", "--kid-copy"], positional: true }); /* --help print-only */
const check = r.bools.has("--check");
const money = r.bools.has("--money"); /* calendar-label files only (cal-months.json) */
const kidCopy = r.bools.has("--kid-copy"); /* kids-week files: no money copy, only the babysitting rate tag (ATLASLANE7) + chore law (ATLASLANE9) */
let bad = 0;
for (const fp of r.positional) {
  if (!fs.existsSync(fp)) { console.log(`${fp}: absent, skip`); continue; }
  const src = fs.readFileSync(fp, "utf8");
  let obj, wrap = null;
  if (fp.endsWith(".js")) {
    const m = /var EMBEDDED = (\{[\s\S]*?\});/.exec(src);
    if (!m) { console.log(`${fp}: no EMBEDDED block, skip`); continue; }
    obj = JSON.parse(m[1]); wrap = m;
  } else obj = JSON.parse(src);
  const rep = displayDeepReport(obj, undefined, { money });
  let { value } = rep;
  const { renamed, dropped } = rep;
  if (kidCopy) {
    const before = JSON.stringify(value);
    value = kidCopyDeep(value);
    if (JSON.stringify(value) !== before) renamed.push({ from: `kid copy + chore law (${kidMoneyHits(JSON.parse(before)).length} money strings, ${kidLawHits(JSON.parse(before)).length} law breaches)`, to: `${kidMoneyHits(value).length} / ${kidLawHits(value).length}` });
    const law = kidLawHits(value);
    if (law.length) { bad++; console.log(`${fp}: LAW ${JSON.stringify(law)}`); }
  }
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
