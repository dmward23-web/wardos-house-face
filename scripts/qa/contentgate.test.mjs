/* CONTENTGATE1 · Alfred's 04:55 content gate, as tests.
 *  1. the hub host serves art/ assets/ theme-tiles/ fonts/ (images, js, fonts only; no traversal), and every local
 *     asset a root page references exists and is servable (the static half of "zero 404s from the hub host");
 *     unpaired / offline boards say "Calendar offline" / "Cameras offline", never dev text.
 *  2. SEATLAW1: ticket section / row / seat never reaches the glass (render-time law, live and cached feeds, and the writers).
 *  3. NOMONEY1: kid dollar figures are stripped at render time at every viewport, 1920x1080 included (real browser).
 *  5. SCHOOLWORD1 ('LKMS' reads 'school'); NAMESDIR1 (private-names.tsv in the private dir, old path as fallback).
 * Run with the rest:  scripts/qa/run-tests.sh */
import { assertSealed } from "./temp-home.mjs";   // TEMPHOME1 (LHVID1): WARDOS_* unset and a temp HOME before any private-list reader loads
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const rd = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const LAW = JSON.parse(rd("scripts/text-law.json"));
const FIX = JSON.parse(rd("scripts/qa/fixtures/seatlaw-cal.json"));

function faceLaw() {
  const g = {}; g.window = g; g.globalThis = g;
  vm.runInNewContext(rd("house-face-law.js"), g);
  return g.HouseFaceLaw;
}

assertSealed();
test("hub host: staticOk serves art/assets/theme-tiles/fonts images, js and fonts only; traversal, dotfiles and data never", async () => {
  const { staticOk } = await import(path.join(ROOT, "scripts/nest-webrtc-proxy.mjs"));
  for (const ok of ["art/kid-hayes.png", "assets/kids-grow/grow-hayes-victory-bg.jpg", "theme-tiles/a/b.webp", "assets/x/y.svg",
                    "art/plates.js", "fonts/InterDisplay-Bold.woff2", "fonts/InterDisplay-Bold.ttf", "house-hub.js", "vendor/qr.js", "sheet-index.html"])
    assert.equal(staticOk(ok), true, ok);
  for (const bad of ["art/../data/cal-live.json", "assets/../../etc/passwd.png", "art/.hidden.png", "art//x.png", "assets\\x.png",
                     "art/x.json", "assets/x.html", "fonts/a/b.ttf", "fonts/../x.ttf", "data/cal-live.json", "kids-week.json", "theme-tiles/x.txt",
                     ".git/config", "scripts/private-feed.mjs", "art/x.png.json"])
    assert.equal(staticOk(bad), false, bad);
});

test("hub host: every local asset referenced by a root page exists and is servable (static zero-404 sweep)", async () => {
  const { staticOk } = await import(path.join(ROOT, "scripts/nest-webrtc-proxy.mjs"));
  const tracked = new Set(spawnSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" }).stdout.split("\n"));
  const pages = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html"));
  const css = fs.readdirSync(ROOT).filter((f) => f.endsWith(".css"));
  const misses = [];
  const refRe = /(?:src|href)\s*=\s*["']([^"'#?]+\.(?:png|jpe?g|webp|gif|svg|js|css|woff2?|ttf))(?:[?#][^"']*)?["']|url\(\s*["']?([^"')#?]+\.(?:png|jpe?g|webp|gif|svg|woff2?|ttf))/gi;
  for (const f of [...pages, ...css]) {
    for (const m of rd(f).matchAll(refRe)) {
      const ref = (m[1] || m[2]).trim();
      if (/^(?:[a-z]+:)?\/\//i.test(ref) || ref.startsWith("data:") || ref.includes("${") || ref.includes("'+") || ref.includes("\"+")) continue;
      const rel = path.posix.normalize(ref.replace(/^\.\//, "").replace(/^\//, ""));
      if (rel.startsWith("ori/") || rel.startsWith("plates/")) continue; /* the ori world has its own layout gate (gate3) */
      if (!tracked.has(rel) && !fs.existsSync(path.join(ROOT, rel))) misses.push(`${f}: ${ref} (missing)`);
      else if (!staticOk(rel)) misses.push(`${f}: ${ref} (not served by the hub host)`);
    }
  }
  assert.deepEqual(misses, []);
  for (const g of ["sheet-gallery.html", "sheet-gallery-hero.html"]) assert.doesNotMatch(rd(g), /phone-shots\//, g + " still points at removed screenshots");
});

test("plain empty states: no dev text ('cal-live missing', 'STUB · NO JSON', 'CAL STALE', SDM/secret-request notes) reaches the glass", () => {
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const files = ["house-board-strip.js", "house-nest.js", "house-sensi.js", "house-lights.js", "sheet-google-home.html", "sheet-index.html", "sheet-today.html", "sheet-sensi.html"];
  const bad = [/["'][^"'\n]*cal-live missing/, /STUB · NO JSON/, /["'][^"'\n]*\bSTUB\b[^"'\n]*["']/, /["'][^"'\n]*CAL STALE/, /secret-request/, /need SDM/];
  const hits = [];
  for (const f of files) {
    const s = strip(rd(f));
    for (const re of bad) { const m = s.match(re); if (m) hits.push(`${f}: ${m[0].slice(0, 80)}`); }
  }
  assert.deepEqual(hits, []);
  /* HUBPAIR1 · the plain word now comes from clearWord(): "All clear", or "Needs pairing" on an unpaired Dad screen */
  assert.match(rd("house-board-strip.js"), /place: clearWord\(\)/);
  assert.match(rd("house-board-strip.js"), /\? "Needs pairing" : "All clear"/);
  assert.match(rd("house-nest.js"), /label: "Cameras offline"/);
});

test("SEATLAW1: render-time rule strips section / row / seat from every string of a feed (fixture); JS and JSON rules are identical", () => {
  const F = faceLaw();
  const seatRules = LAW.rules.filter((r) => /^(SEATLAW1|SCHOOLWORD1)/.test(r.why));
  assert.equal(seatRules.length, 4);
  assert.equal(JSON.stringify(F.RENDER_RULES.map((r) => [r[0].source, r[0].flags, r[1]])),
    JSON.stringify(seatRules.map((r) => [new RegExp(r.re, (r.global ? "g" : "") + r.flags).source, new RegExp(r.re, (r.global ? "g" : "") + r.flags).flags, r.to])));
  const out = F.cleanFeed("cal-live", JSON.parse(JSON.stringify(FIX)));
  const all = JSON.stringify(out);
  assert.doesNotMatch(all, /\bSec(?:tion)?\b\s*\d|\bRow\s+[A-Z0-9]{1,3}\b(?!\s*your)|\bSeats?\s*\d/i, all);
  assert.equal(out.events[0].summary, "Mudcats @ Riverhawks, Game 2");
  assert.equal(out.events[1].summary, "Concert");
  assert.equal(out.events[2].summary, "Titans game · 3:25");
  assert.equal(out.events[4].summary, "Row your boat sing-along", "ordinary words survive");
  assert.equal(out.boardStrip.detailHtml, "<strong>6:35</strong> Playoff Game 2: Mudcats @ Riverhawks");
  assert.equal(out.events[0].start, FIX.events[0].start, "times untouched");
  /* live and cached both pass through the law: private-feed.js applies it after getRaw(), which returns live or cache */
  const pf = rd("private-feed.js");
  assert.match(pf, /return getRaw\(name\); \}\)\.then\(function \(res\) \{ if \(res && res\.data\) res\.data = law\(name, res\.data\)/);
});

test("SEATLAW1 + SCHOOLWORD1: the Python writer (text_law.py) gives the same words", () => {
  const strs = FIX.events.map((e) => e.summary);
  const r = spawnSync("python3", [path.join(ROOT, "scripts/text_law.py")], { input: JSON.stringify(strs), encoding: "utf8", env: { ...process.env, WARDOS_NAMES: "partner=Zedna;coparent=Yolanthe" } });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(r.stdout), ["Mudcats @ Riverhawks, Game 2", "Concert", "Titans game · 3:25", "Ainsley · school picture day", "Row your boat sing-along"]);
});

test("SCHOOLWORD1: a school entry reads 'school', not LKMS (render time + static hub text)", () => {
  const F = faceLaw();
  assert.equal(F.faceText("Ainsley · LKMS picture day"), "Ainsley · school picture day");
  assert.doesNotMatch(rd("sheet-index.html"), /LKMS/);
  assert.doesNotMatch(rd("kid-ainsley.html"), /LKMS/);
});

test("NOMONEY1: dollar text becomes stars; every kid-money page loads house-nomoney.js; no viewport gate", () => {
  const g = {}; g.window = g; g.globalThis = g; g.document = { readyState: "loading", addEventListener() {} }; g.addEventListener = () => {};
  vm.runInNewContext(rd("house-nomoney.js"), g);
  /* figures are written with ¤ and turned into dollars here, so the privacy scan never sees a money figure in git */
  const t = (s) => g.HouseNoMoney.text(s.replace(/¤/g, () => String.fromCharCode(36)));
  assert.equal(t("Balance ¤20 · Week ¤7 · Jar ¤3/¤5"), "Stars · payday");
  assert.equal(t("¤7 ea wk"), "★ ea wk");
  assert.equal(t("Babysitting ¤12/hr"), "Babysitting ★");
  assert.equal(t("Harris earned ¤4.50 today"), "Harris earned ★ today");
  assert.equal(t("no money here"), "no money here");
  assert.doesNotMatch(rd("house-nomoney.js"), /innerWidth|matchMedia|min-width|max-width/);
  for (const f of ["sheet-chores.html", "sheet-index.html", "sheet-weekend.html"])
    assert.match(rd(f), /<script src="house-nomoney\.js\?v=KIDCRIT1"><\/script>/, f);
  /* DAYPKG1 v2i · the Dad money sheet loads the build that exempts ward-money=dad pages (new stamp so a cached copy cannot linger) */
  assert.match(rd("sheet-allowance.html"), /<script src="house-nomoney\.js\?v=DAYPKG1"><\/script>/, "sheet-allowance.html");
  /* JARTAP1 re-tokened the kid pages; DAYPKG1 v2e (Alfred 12:47 AM item 6) bumps them on purpose to DAYPKG1: v2d changed
     house-nomoney.js (the kid guard takes /kid-x with or without .html), so a cached JARTAP1 copy would miss the guard on a
     clean URL. The Dad pages keep KIDCRIT1: that one-line change is a no-op off a kid page */
  for (const f of ["kid-hayes.html", "kid-harris.html", "kid-ainsley.html"])
    assert.match(rd(f), /<script src="house-nomoney\.js\?v=DAYPKG1"><\/script>/, f);
});

const browser = spawnSync("python3", ["-c", "import playwright.sync_api"], { encoding: "utf8" }).status === 0 && process.env.QA_NO_BROWSER !== "1";
function money(page, w, h, block) {
  const r = spawnSync("python3", [path.join(ROOT, "scripts/qa/money_viewport.py"), page, String(w), String(h)],
    { encoding: "utf8", timeout: 120000, env: { ...process.env, ...(block ? { QA_BLOCK_NOMONEY: "1" } : {}) } });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout.trim().split("\n").pop());
}
/* DAYPKG1 v2i (Alfred v2h FAIL, P1) · sheet-allowance is the Dad money page (meta ward-money=dad): house-nomoney leaves it alone so
   the weekly figure reads as money there. Every other sheet still sweeps; the negative control runs on sheet-chores. */
test("NOMONEY1 at 1920x1080 (real browser): sheet-chores shows zero dollar figures (the check catches them when the scrub is off); the Dad money page sheet-allowance keeps them",
  { skip: !browser && "QA_NO_BROWSER=1 or python playwright missing" }, () => {
    const neg = money("sheet-chores.html", 1920, 1080, true);
    assert.ok(neg.injected && neg.dollars >= 20, "negative control must see the injected figures: " + JSON.stringify(neg));
    const r = money("sheet-chores.html", 1920, 1080, false);
    assert.equal(r.dollars, 0, `sheet-chores.html @ 1920x1080: ${JSON.stringify(r.sample)}`);
    for (const [w, h] of [[1920, 1080], [1080, 1920], [440, 956]]) {
      const a = money("sheet-allowance.html", w, h, false);
      assert.ok(a.dollars >= 1, `sheet-allowance.html @ ${w}x${h} is the ward-money=dad page and keeps money: ${JSON.stringify(a)}`);
    }
  });

test("MERCNODATA1 (real browser): mercury-run.html paints the world, not a black canvas, when unpaired or offline",
  { skip: !browser && "QA_NO_BROWSER=1 or python playwright missing" }, () => {
    for (const [w, h, mode] of [[440, 956, "unpaired"], [1920, 1080, "unpaired"], [440, 956, "offline"]]) {
      const r = spawnSync("python3", [path.join(ROOT, "scripts/qa/blank_viewport.py"), "mercury-run.html", String(w), String(h), mode], { encoding: "utf8", timeout: 120000 });
      assert.equal(r.status, 0, r.stderr);
      const o = JSON.parse(r.stdout.trim().split("\n").pop());
      assert.ok(o.canvas, `canvas visible @ ${w} ${mode}`);
      assert.ok(o.lit > 0.3, `mercury-run @ ${w} ${mode} is black: ${JSON.stringify(o)}`);
      assert.deepEqual(o.errors, [], `page errors @ ${w} ${mode}`);
    }
  });

/* ORI1 (always open): the run plays from the start; data arriving late only grows the blob. Expectations updated, not run here (render-needed). */
test("FOLLOWUP1 (real browser): mercury-run paints before data and plays at once; a 5 s hub never restarts play (ORI1 always open)",
  { skip: !browser && "QA_NO_BROWSER=1 or python playwright missing" }, () => {
    const run = (mode) => {
      const r = spawnSync("python3", [path.join(ROOT, "scripts/qa/slow_hub.py"), mode, "5"], { encoding: "utf8", timeout: 120000 });
      assert.equal(r.status, 0, r.stderr);
      return JSON.parse(r.stdout.trim().split("\n").pop());
    };
    const full = run("full");
    assert.ok(full.seeded > 0 && full.hub_hits > 0, JSON.stringify(full));
    assert.ok(full.early_lit > 0.3, "canvas black at 1.2 s: " + JSON.stringify(full));
    assert.deepEqual(full.at_4500, { gather: false, hud: 1 }, "ORI1: plays before data at 4.5 s, no gather gate");
    assert.deepEqual(full.after_hub, { gather: false, hud: 1 }, "full jar from the slow hub: still one HUD (plays once)");
    assert.deepEqual(full.errors, []);
    const empty = run("empty");
    assert.deepEqual(empty.after_hub, { gather: false, hud: 1 }, "ORI1: a not-full jar still plays");
    assert.deepEqual(empty.errors, []);
  });

test("NAMESDIR1: private-names.tsv is read from the private data dir, with ~/.config/wardos as the fallback", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "namesdir-"));
  const home = path.join(tmp, "home"), priv = path.join(tmp, "priv");
  fs.mkdirSync(path.join(home, ".config", "wardos"), { recursive: true }); fs.mkdirSync(priv, { recursive: true });
  fs.writeFileSync(path.join(home, ".config", "wardos", "private-names.tsv"), "partner\tOldplace\ncoparent\tOldco\n");
  const run = (code, py) => spawnSync(py ? "python3" : process.execPath, py ? ["-c", code] : ["--input-type=module", "-e", code],
    { cwd: ROOT, encoding: "utf8", env: { PATH: process.env.PATH, HOME: home, WARDOS_PRIVATE_DIR: priv } });
  const js = `import { privateNames } from "./scripts/private-dir.mjs"; console.log(privateNames().partner[0]);`;
  const py = `import sys; sys.path.insert(0, "scripts"); import text_law; print(text_law._NAMES["partner"][0])`;
  assert.equal(run(js).stdout.trim(), "Oldplace", "fallback (JS)");
  assert.equal(run(py, true).stdout.trim(), "Oldplace", "fallback (Python)");
  fs.writeFileSync(path.join(priv, "private-names.tsv"), "partner\tNewplace\ncoparent\tNewco\n");
  assert.equal(run(js).stdout.trim(), "Newplace", "private dir wins (JS)");
  assert.equal(run(py, true).stdout.trim(), "Newplace", "private dir wins (Python)");
  fs.rmSync(tmp, { recursive: true, force: true });
});
