/* CAMREST2 · Alfred's CAMREST1 findings, one test each, plus Prism's tile spec.
   Real browser (scripts/qa/camrest_viewport.py) against a loopback stub hub with synthetic cameras ("Qa Porch" ...);
   every other host or port is answered 503 by the harness, so no real hub, camera proxy or Google is reached. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const browser = spawnSync("python3", ["-c", "import playwright.sync_api"], { encoding: "utf8" }).status === 0 && process.env.QA_NO_BROWSER !== "1";
const SKIP = browser ? {} : { skip: "SKIP no playwright (QA_NO_BROWSER)" };

function run(mode, w = 1920, h = 1080) {
  return new Promise((resolve, reject) => {
    const p = spawn("python3", [path.join(ROOT, "scripts/qa/camrest_viewport.py"), mode, String(w), String(h)]);
    let out = "", err = "";
    const t = setTimeout(() => p.kill("SIGTERM"), 300000);
    p.stdout.on("data", (d) => (out += d)); p.stderr.on("data", (d) => (err += d));
    p.on("close", (code) => {
      clearTimeout(t);
      if (code !== 0) return reject(new Error(mode + " exit " + code + " " + err.slice(-600)));
      try { resolve(JSON.parse(out.trim().split("\n").pop())); } catch (e) { reject(new Error(mode + " bad json " + out.slice(-300))); }
    });
  });
}
let runs = null;
function all() {
  if (!runs) {
    const list = [["still5xx"], ["static5xx"], ["recover"], ["slow"], ["calbad"], ["feed401"], ["feed503"], ["motion"], ["onebad"], ["still5xx", 440, 956]];
    runs = Promise.all(list.map((a) => run(...a))).then((rs) => Object.fromEntries(rs.map((o, i) => [list[i].join("@"), o])));
  }
  return runs;
}
const J = (o) => JSON.stringify(o).slice(0, 1500);
function assertRestingPrivate(snap, label, wantPill = true) {
  assert.ok(snap.deckVisible, label + " deck stays visible " + J(snap));
  assert.equal(snap.tiles.length, 3, label);
  for (const t of snap.tiles) {
    assert.ok(t.visible && t.resting, label + " tile rests " + J(t));
    if (wantPill) { assert.ok(t.restPill, label + " pill shows " + J(t)); assert.equal(t.restWord, "Camera resting"); }
    assert.ok(!t.imgVisible, label + " no broken image " + J(t));
    assert.ok(!t.statusPill, label + " no status pill " + J(t));
    assert.equal(t.names, 0, label + " no camera name while resting");
    assert.equal(t.devIds, 0, label + " no device id while resting");
    assert.ok(!t.camId && !t.pfCam, label + " no data-cam-id / data-pf-cam while resting " + J(t));
    assert.equal(t.href, "sheet-google-home.html", label + " href is the generic page");
    assert.match(t.aria, /^Camera \d camera · resting/, label + " aria is the slot label");
  }
}

test("P2 · a private still that 5xxs rests, stays rested across repaints and 75s of polls, and retries with backoff", SKIP, async () => {
  const o = (await all())["still5xx"];
  assert.deepEqual(o.errors, []);
  for (const k of ["t0", "t_repaint", "t75"]) assertRestingPrivate(o[k], k);
  // 3 cams: first try + retries at ~15s and ~45s (backoff 15 → 30 → 60 …); never once per repaint
  assert.ok(o.hits.still >= 6 && o.hits.still <= 12, "still requests " + o.hits.still);
});

test("P2 · a non-private still path that 5xxs never un-rests on repaint", SKIP, async () => {
  const o = (await all())["static5xx"];
  assert.deepEqual(o.errors, []);
  for (const k of ["t0", "t_repaint", "t75"]) assertRestingPrivate(o[k], k);
});

test("P2 · recovery: a private still that 5xxs twice then heals comes back on its own (new requests, image shown, identity restored)", SKIP, async () => {
  const o = (await all())["recover"];
  assert.deepEqual(o.errors, []);
  for (const t of o.t_after.tiles) {
    assert.ok(!t.resting && t.imgVisible && t.imgOk, "healed " + J(t));
    assert.ok(t.camId, "identity back once live " + J(t));
  }
  assert.ok(o.hits.still_ok >= 3 && o.hits.still >= 9, J(o.hits));
});

test("P2 · the image shows only after it loads (rest while a slow still is in flight)", SKIP, async () => {
  const o = (await all())["slow"];
  assert.deepEqual(o.errors, []);
  for (const t of o.t_loading.tiles) assert.ok(t.resting && !t.imgVisible, "in flight " + J(t));
  for (const t of o.t_loaded.tiles) assert.ok(!t.resting && t.imgVisible && t.imgOk, "loaded " + J(t));
});

test("P2 · one offline feed (calendar 503) does not rest the cameras", SKIP, async () => {
  const o = (await all())["calbad"];
  assert.deepEqual(o.errors, []);
  for (const t of o.t0.tiles) assert.ok(!t.resting && t.imgVisible, J(t));
});

test("P2 · one camera's still failing rests only that tile; the other two stay live", SKIP, async () => {
  const o = (await all())["onebad"];
  assert.deepEqual(o.errors, []);
  const [a, b, c] = o.t0.tiles;
  assert.ok(!a.resting && a.imgVisible && !c.resting && c.imgVisible, J(o.t0));
  assert.ok(b.resting && b.restPill && !b.imgVisible && b.names === 0 && !b.camId, J(b));
});

test("P3 · whole camera feed 401: tiles rest (deck stays) and say needs pairing without WebRTC; 503 rests without pairing", SKIP, async () => {
  const r = await all();
  for (const k of ["t0", "t20"]) {
    assertRestingPrivate(r.feed401[k], "401 " + k);
    for (const t of r.feed401[k].tiles) { assert.equal(t.why, "pair", J(t)); assert.match(t.aria, /needs pairing$/); assert.ok(!/LOCKED|PAIR\b/.test(t.aria)); }
    assertRestingPrivate(r.feed503[k], "503 " + k);
    for (const t of r.feed503[k].tiles) assert.equal(t.why, "", J(t));
  }
  assert.deepEqual(r.feed401.errors, []); assert.deepEqual(r.feed503.errors, []);
});

test("Prism spec · computed pill, art and dot (wall), reduced motion stops the pulse, phone dots stay calm", SKIP, async () => {
  const r = await all();
  const s = r.still5xx.style;
  assert.equal(s.fontPx, 16); assert.equal(s.color, "rgb(255, 226, 176)"); assert.equal(s.radius, "999px");
  assert.match(s.border, /^rgb\(232, 163, 61\)/); assert.equal(s.bg, "rgba(28, 18, 8, 0.82)");
  assert.ok(s.contrastWorst >= 4.5, "AA even over white art " + s.contrastWorst);
  assert.equal(s.artFilter, "brightness(0.8) saturate(1.05) blur(2px)");
  assert.match(s.vignette, /^radial-gradient\(.*55%.*rgba\(10, 6, 2, 0\.45\) 100%/);
  assert.equal(s.dotSize, "6px"); assert.equal(s.dotAnim, "none", "reduced motion: no pulse");
  assert.equal(s.family, '"Inter Display"');
  assert.equal(r.motion.style.dotAnim, "hubCamRestPulse");
  assertRestingPrivate(r["still5xx@440@956"].t75, "phone", false);
});

test("static · spec values in the CSS, word unchanged, no LOCKED · PAIR, cache busted", () => {
  const css = read("tokens-hub-cams.css"), js = read("house-nest.js");
  for (const v of ["rgba(28, 18, 8, 0.82)", "1.5px solid #e8a33d", "999px", "padding: 8px 18px", "padding: 10px 22px", "font-size: 16px", "font-size: 15px",
    "letter-spacing: 0.02em", "#ffe2b0", "0 0 14px rgba(232, 163, 61, 0.45), inset 0 0 8px rgba(232, 163, 61, 0.18)", "2.4s", "prefers-reduced-motion"])
    assert.ok(css.includes(v), v);
  assert.ok(!/brightness\(\.46\)|brightness\(0\.46\)/.test(css), "46% dim dropped");
  assert.ok(js.includes('"Camera resting"'));
  assert.ok(!js.includes("LOCKED · PAIR"));
  const g = read("sheet-google-home.html");
  assert.ok(g.includes("tokens-hub-cams.css?v=CAMREST2") && g.includes("house-nest.js?v=CAMREST2") && /private-feed\.js\?v=(?:CAMREST2|HALLOWEEN1|HUBPAIR1|HUBPAIR1B|HUBPAIR1D)"/.test(g)); /* H1-CB: halloween1 changed private-feed.js and re-tokens it */
  /* sheet-index.html keeps its CAMREST1 busters in this commit: its inherited Atlas deep-link id trips PIIGUARD2 on any
     edit; the bump is a separate one-line change once that line is cleared. The page still loads these same files. */
  assert.ok(/tokens-hub-cams\.css\?v=CAMREST\d/.test(read("sheet-index.html")));
});
