/* DATA1 · shared runner for the data1-*.test.mjs regressions (Atlas board data audit, Oct 23 2026).
   Synthetic fixture only (QXS school code, Smith/Jones stand-ins); every write goes to a temp dir that is removed. */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
export const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
export const FX = path.join(ROOT, "scripts/qa/fixtures/data1.events.json");
export const NAMES = "school=QXS;partner=Jones;coparent=Smithson";
export const NOW = "2026-10-23T18:50:00-05:00";
export function refresh(seed, now = NOW) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "data1-"));
  try {
    const week = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts/qa/fixtures/private/kids-week.synthetic.json"), "utf8"));
    if (seed) seed(week);
    fs.writeFileSync(path.join(dir, "kids-week.json"), JSON.stringify(week));
    fs.copyFileSync(path.join(ROOT, "kids-data.js"), path.join(dir, "kids-data.js"));
    execFileSync("node", [path.join(ROOT, "scripts/calendar-refresh.mjs"), "--events", FX, "--week", path.join(dir, "kids-week.json"), "--no-mirror", "--now", now], { stdio: "pipe", env: { ...process.env, WARDOS_NAMES: NAMES } });
    return JSON.parse(fs.readFileSync(path.join(dir, "kids-week.json"), "utf8"));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
let cached;
export const W = () => (cached ||= refresh((w) => {
  const a = w.kids && w.kids.ainsley; if (a) { a.streakLabel = "3 day streak \u2605"; a.goal = { label: "$20 for 5 \u2605 stars" }; }
  for (const k of ["harris", "hayes", "ainsley"]) if (w.kids && w.kids[k]) w.kids[k].bag = { hint: "old" };
}));
export const rows = (w, k, list) => (w.kids[k] && w.kids[k][list]) || [];
export const texts = (v, out = []) => { if (typeof v === "string") out.push(v); else if (v && typeof v === "object") for (const k in v) texts(v[k], out); return out; };
