#!/usr/bin/env node
/** Kids-safe glass voice. Fail build if banned legal words hit kid/house glass. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BANNED = /\bcustody\b|\bvisitation\b|\bco-?parent(?:ing)?\b|\bparenting time\b/i;
const GLOB = [
  "index.html",
  "sheet-today.html",
  "sheet-load-day.html",
  "sheet-status.html",
  "sheet-weekend.html",
  "sheet-chores.html",
  "sheet-allowance.html",
  "kid-ainsley.html",
  "kid-hayes.html",
  "kid-harris.html",
  "kids-data.js",
  "house-board-strip.js",
  "data/kids-week.json",
];

let bad = [];
for (const rel of GLOB) {
  const fp = path.join(ROOT, rel);
  if (!fs.existsSync(fp)) continue;
  const lines = fs.readFileSync(fp, "utf8").split(/\n/);
  lines.forEach((line, i) => {
    if (BANNED.test(line)) bad.push(`${rel}:${i + 1}: ${line.trim().slice(0, 120)}`);
  });
}
if (bad.length) {
  console.error("KIDS-SAFE VOICE FAIL — banned legal words on glass:");
  bad.forEach((b) => console.error("  " + b));
  process.exit(1);
}
console.log("kids-safe voice: PASS");
