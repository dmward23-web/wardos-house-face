#!/usr/bin/env node
/** Fail if a chore marker or its label overlaps another, or a label is clipped.
    Phone is 440×956 CSS (Dan's 3× viewport). Wall is 1080×1920.
    Calendar World is the day path on each kid. Not wired into house-face-qa. */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sandbox = { console: console };
sandbox.window = sandbox;
sandbox.globalThis = sandbox;

vm.runInNewContext(fs.readFileSync(path.join(ROOT, "art/world-manifest.js"), "utf8"), sandbox, {
  filename: "art/world-manifest.js"
});
vm.runInNewContext(fs.readFileSync(path.join(ROOT, "art/kid-layout.js"), "utf8"), sandbox, {
  filename: "art/kid-layout.js"
});

const week = JSON.parse(fs.readFileSync(path.join(ROOT, "kids-week.json"), "utf8"));
const labels = {};
for (const id of ["hayes", "harris", "ainsley"]) {
  const quests = (week.kids[id] && week.kids[id].quests) || [];
  labels[id] = quests
    .filter((q) => !q.optional && (q.cadence || "daily") === "daily")
    .map((q) => q.what);
  const shown = labels[id].map((s) => sandbox.KidLayout.shortLabel(s));
  console.log(id, shown.join(" | "));
}

const errors = sandbox.KidLayout.audit(labels);
if (errors.length) {
  const uniq = [];
  const seen = new Set();
  for (const e of errors) {
    if (seen.has(e)) continue;
    seen.add(e);
    uniq.push(e);
  }
  console.error("layout check failed:", uniq.length);
  uniq.slice(0, 60).forEach((e) => console.error(" -", e));
  process.exit(1);
}
console.log("layout check ok");
