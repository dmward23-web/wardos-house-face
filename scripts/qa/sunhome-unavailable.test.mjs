/* SUNHOME unavailable state.
   Prism (RECONCILE_be07, priority 1): an unpaired family hub must not show camera tiles,
   a lights strip, or a pairing prompt. Those controls stay for a paired feed and for the
   Dad recovery pages (sheet-dan, sheet-lights, sheet-google-home, sheet-allowance).
   This file adds that assertion. It does not change PAIRUI1, CAMREST4, CAMREST5, or
   HUBPAIR1. Those older tests still expect the unpaired hub to paint "Needs pairing"
   on the cameras and the lights strip, and HUBPAIR1 still treats sheet-index.html as
   the Dad screen. That conflicts with the Prism directive. Paired-outage and kid-pad
   write coverage in those files is left as it was.
   A data-dad-only attribute is not a login. dadPaid remains in kids-data.js and is not
   called from the public allowance page. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

test("unpaired family hub starts with cameras and lights unavailable", () => {
  const hub = read("sheet-index.html");
  assert.match(hub, /id="hub-cam-deck" hidden/);
  assert.match(hub, /id="hub-lights-panel" hidden/);
  const nest = read("house-nest.js");
  const cam = nest.slice(nest.indexOf("function paintHubCamDeck"), nest.indexOf("function paintHubCamDeck") + 700);
  assert.ok(cam.includes("pairState() === \"paired\""));
  assert.ok(cam.includes("sheet-index"));
  assert.ok(cam.includes("deck.hidden = true"));
  assert.ok(cam.includes("deck.hidden = false"));
  const lights = read("house-lights.js");
  const panel = lights.slice(lights.indexOf("function paintHubPanel"), lights.indexOf("function paintHubPanel") + 700);
  assert.ok(panel.includes("pairState() === \"paired\""));
  assert.ok(panel.includes("sheet-index"));
  assert.ok(panel.includes("panel.hidden = true"));
  assert.ok(panel.includes("panel.hidden = false"));
});

test("pinned private-feed keeps needsPairing; the hub hides the chip in its own stylesheet", () => {
  const pf = read("private-feed.js");
  assert.ok(pf.includes('function needsPairing() { return !forceOffline && pairState() !== "paired" && !kidBoard(); }'));
  assert.equal(pf.includes("function dadRecovery"), false);
  const hub = read("sheet-index.html");
  assert.ok(hub.includes(".pf-flag--pair { display: none !important; }"));
});

test("public allowance page has no Paid control; the pay functions remain and are not a role", () => {
  const h = read("sheet-allowance.html");
  assert.equal((h.match(/data-dad-paid|Hold for Paid|WardKids\.dadPaid\(/g) || []).length, 0);
  assert.match(h, /name="ward-money" content="dad"/);
  const kd = read("kids-data.js");
  assert.match(kd, /function dadPaid\(kidId, data\)/);
  assert.match(kd, /function resetJarCycle\(kidId, paidAmount, data\)/);
  assert.match(kd, /function bindHold\(btn, fire, ms\)/);
  assert.match(kd, /if \(kidScope\(\)\) return ""/);
});
