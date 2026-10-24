import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const scene = readFileSync(new URL("../../night/scene.html", import.meta.url), "utf8");
const lh = readFileSync(new URL("../../livinghouse/lh.js", import.meta.url), "utf8");
test("CROW1: countdown near zero asks the scene to lift the crows", () => {
  assert.match(lh, /w\.__fire\("crows"\)/);
});
test("CROW1: scene routes crows to a procedural flock, not the blocked bats matte", () => {
  assert.match(scene, /window\.__fire=n=>n==='crows'\?crowLift\(\):fire\(n\)/);
  assert.match(scene, /function crowLift\(\)\{if\(RM\.matches(\|\|ENV\.rain>\.15\|\|ENV\.snow>\.15)?\)return false;/); /* LIVEWX1: crows also hunker in rain/snow */
  assert.match(scene, /H\.ev\.push\(\{k:'bats',crow:1/);
});
