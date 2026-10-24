/* LDAWAY1 + AINSNOSCORE2 · node --test scripts/qa/ldjar.test.mjs
   1. Load day (Alfred Oct 20): kid items on sheet-load-day follow away-filter.js on an away day, like every other board.
      The static pack strip carries no clock time, and a missing feed (no month data) is the normal awake board.
   2. Ainsley's jar (Alfred Oct 20): her hero is EMPTY/TRUSTED only. No number and no tally icon in the default markup,
      before data, with slow data or after data.
   3. Ainsley's rows (Atlas Oct 20): no star glyph and no star or money rate anywhere in her allowance and chore rows,
      in the pre-load markup and the post-load render. The boys' rows keep theirs. Synthetic Smith/QXS stand-ins only. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const PHRASES = new RegExp(...(() => { const m = /export const PHRASES = \/(.*)\/i;/.exec(read("scripts/qa/nocustody.test.mjs")); return [m[1], "i"]; })());
const KID = /\b(?:Hayes|Harris|Ainsley)\b/;
const CLOCK = /\b\d{1,2}:\d{2}\b/;

function packStrip() {
  const h = read("sheet-load-day.html"), i = h.indexOf("data-ld-pack");
  assert.ok(i > 0, "pack strip marked data-ld-pack");
  return h.slice(i, h.indexOf("</section>", i));
}

test("load day markup: the pack strip has no clock time, and every kid item is an away item", () => {
  const s = packStrip();
  assert.equal(CLOCK.test(s.replace(/<[^>]+>/g, " ")), false, "a clock time in the static pack strip");
  const items = s.split('<div class="pack-item').slice(1);
  assert.ok(items.length >= 5);
  for (const it of items) if (KID.test(it.replace(/<[^>]+>/g, " "))) assert.match(it, /^[^>]*data-away-kid/, it.slice(0, 80));
  assert.equal(PHRASES.test(read("sheet-load-day.html")), false, "no custody phrase");
  assert.match(read("sheet-load-day.html"), /packDay\(iso\);var dd=day\(iso\)/, "the shown load day drives the away check");
});

test("away filter: no month data means nothing is away (missing feed is the normal board)", () => {
  const ctx = vm.createContext({ Intl, Date, URLSearchParams });
  ctx.globalThis = ctx;
  vm.runInContext(read("away-filter.js"), ctx);
  const A = ctx.AwayFilter;
  assert.equal(A.hasMonths(), false);
  for (const t of ["2026-10-20T07:30:00-05:00", "2026-10-20T16:00:00-05:00", "2026-10-20T18:15:00-05:00"]) assert.equal(A.isAwayAt(Date.parse(t)), false, t);
  assert.equal(A.isAwayDay("2026-10-20"), false);
  assert.equal(A.keepItem({ c: "kids", l: "Hayes BB gear", _day: "2026-10-20", when: "" }), true);
});

const browser = spawnSync("python3", ["-c", "import playwright.sync_api"], { encoding: "utf8" }).status === 0 && process.env.QA_NO_BROWSER !== "1";
const SKIP = { skip: !browser && "QA_NO_BROWSER=1 or python playwright missing" };
const run = (page, mode, w, h, env = {}) => {
  const r = spawnSync("python3", [path.join(ROOT, "scripts/qa/ldjar_viewport.py"), page, mode, String(w), String(h)], { encoding: "utf8", timeout: 150000, env: { ...process.env, ...env } });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout.trim().split("\n").pop());
};

test("LDAWAY1 (real browser): load day hides kid items and kid times on an away day, at 440 and 390", SKIP, () => {
  for (const [w, h] of [[440, 956], [390, 844]]) {
    const r = run("load-day", "feed", w, h);
    assert.ok(r.hub_hits > 0, JSON.stringify(r));
    assert.equal(r.state.hasMonths, true);
    assert.equal(r.state.kidsAway, true);
    assert.equal(r.state.kidItemsShown, 0, "kid pack items shown on an away day " + JSON.stringify(r));
    assert.deepEqual(r.state.kidTimes, []);
    assert.deepEqual(r.errors, []);
  }
});

test("LDAWAY1 (real browser): a home day with the feed shows the kid items", SKIP, () => {
  const r = run("load-day", "feed", 440, 956, { LDNOW: "2026-10-17T10:00:00-05:00" });
  assert.equal(r.state.hasMonths, true);
  assert.equal(r.state.kidsAway, false);
  assert.equal(r.state.kidItemsShown, r.state.kidItems);
  assert.deepEqual(r.state.kidTimes, []);
});

test("LDAWAY1 (real browser): a missing feed never computes an away day; the normal awake board shows", SKIP, () => {
  for (const [w, h] of [[440, 956], [390, 844]]) {
    const r = run("load-day", "nofeed", w, h);
    assert.equal(r.hub_hits, 0);
    assert.equal(r.state.hasMonths, false);
    assert.equal(r.state.kidsAway, false, "away computed with no feed");
    assert.equal(r.state.hidden, 0, "something hidden with no feed");
    assert.equal(r.state.kidItemsShown, r.state.kidItems);
    assert.deepEqual(r.state.kidTimes, []);
    assert.deepEqual(r.errors, []);
  }
});

test("AINSNOSCORE2 markup: Ainsley's jar hero has no digit and no tally icon", () => {
  const h = read("sheet-allowance.html"), i = h.indexOf('<section class="bank ainsley"');
  const hero = h.slice(h.indexOf('<div class="star-count">', i), h.indexOf('<div class="feed"', i));
  assert.ok(hero.length > 0);
  assert.equal(/\d/.test(hero.replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]+>/g, " ")), false, "a digit in her hero: " + hero);
  assert.equal(/<svg|<use|class="s\b/.test(hero), false, "a tally icon in her hero");
  assert.match(hero, /data-noscore="1"/);
});

test("AINSNOSCORE2 (real browser): no digit in her jar hero with no data, slow data or data", SKIP, () => {
  for (const mode of ["nofeed", "slow", "feed"]) {
    for (const [w, h] of [[440, 956], [390, 844]]) {
      const r = run("allowance", mode, w, h);
      assert.ok(r.samples.length >= 4);
      for (const s of r.samples) {
        assert.equal(s.digit, false, mode + " " + JSON.stringify(s));
        assert.equal(s.icon, false, mode + " " + JSON.stringify(s));
        assert.equal(s.big, "Tour Jar");
      }
      assert.deepEqual(r.errors, []);
      if (mode !== "nofeed") assert.ok(r.hub_hits > 0);
    }
  }
});

const STAR = /[\u2605\u2606\u272d\u2b50]/;
function bankSection(kid) {
  const h = read("sheet-allowance.html"), i = h.indexOf('<section class="bank ' + kid + '"');
  assert.ok(i > 0, kid + " bank");
  return h.slice(i, h.indexOf("</section>", i));
}
test("AINSSTAR1 markup: no star glyph, star rate or digit in Ainsley's allowance and chore rows; boys keep theirs", () => {
  const a = bankSection("ainsley");
  const text = a.replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]+>/g, " ");
  assert.equal(STAR.test(a), false, "a star glyph in her section");
  assert.equal(/\d/.test(text), false, "a digit in her section text");
  assert.equal(/data-stars|data-money|data-jar-goal|data-check="ainsley-star|tap-star|data-bank-(?!kid)/.test(a), false, "a star or money rate binding in her section");
  for (const k of ["hayes", "harris"]) {
    const b = bankSection(k);
    assert.match(b, /data-stars="7" data-money-suffix=" ea wk"/, k + " rows keep their rate");
    assert.match(b, /Musts that earn \u2605 into the jar/, k);
  }
});

test("AINSSTAR1 (real browser): no star glyph or digit in Ainsley's rows before, during or after data", SKIP, () => {
  for (const mode of ["nofeed", "slow", "feed"]) {
    const r = run("allowance", mode, 440, 956);
    for (const s of r.samples) {
      assert.ok(s.bank, "her section rendered");
      assert.equal(s.bank.star, false, mode + " star: " + s.bank.text);
      assert.equal(s.bank.digit, false, mode + " digit: " + s.bank.text);
    }
    assert.deepEqual(r.errors, []);
  }
});

/* ---------- 4. AINSJAR1 (Alfred FOLD Oct 20): her jar is a state under the Tour Jar label, on both of her pages ---------- */
const STATE_EL = /<div class="jar-state" data-jar-state="trusted">TRUSTED<\/div>/;
function kidAinsleyJar() {
  const h = read("kid-ainsley.html"), i = h.indexOf('id="sec-jar"');
  assert.ok(i > 0, "kid-ainsley jar section");
  return h.slice(h.lastIndexOf("<section", i), h.indexOf("</section>", i));
}
test("AINSJAR1 markup: kid-ainsley has no star glyph, no tally or progress count, and her jar shows TRUSTED under Tour Jar", () => {
  const h = read("kid-ainsley.html");
  const body = h.slice(h.indexOf("<body"));
  const visible = body.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "").replace(/<!--[\s\S]*?-->/g, "");
  assert.equal(STAR.test(visible), false, "a star glyph in kid-ainsley markup");
  assert.equal(/data-bank-(?:life|symbol|today|balance|week-earn)|data-grow-(?:total|save-need|pct)|data-progress-meta|data-left-count|data-saves-panel/.test(visible), false, "a count, tally or saves binding");
  const jar = kidAinsleyJar();
  assert.equal(/\d/.test(jar.replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]+>/g, " ")), false, "a digit in her jar");
  assert.match(jar, new RegExp('<div class="bank-title">Tour Jar</div>\\s*' + STATE_EL.source), "TRUSTED right under the Tour Jar label");
  assert.match(h, /<script src="ains-jar-state\.js\?v=AINSJAR2"><\/script>/);
});
test("AINSJAR1 markup: sheet-allowance shows TRUSTED under her Tour Jar label", () => {
  const a = bankSection("ainsley");
  assert.match(a, new RegExp('<div class="star-label">Tour Jar</div>\\s*' + STATE_EL.source));
  assert.equal(/data-saves-panel/.test(a), false);
  assert.match(read("sheet-allowance.html"), /<script src="ains-jar-state\.js\?v=AINSJAR2"><\/script>/);
});
test("AINSJAR1 state (Atlas Oct 20): TRUSTED by default; EMPTY only when kids.ainsley.jarState is set to another value", () => {
  const ctx = vm.createContext({ document: { readyState: "complete", querySelectorAll: () => [] } });
  ctx.window = ctx;
  vm.runInContext(read("ains-jar-state.js"), ctx);
  const S = ctx.AinsJarState.stateOf;
  for (const d of [null, undefined, {}, "x", "{not json", 7, [], { kids: null }, { kids: {} }, { kids: { ainsley: null } }, { kids: { ainsley: {} } },
    { kids: { ainsley: { jarState: "" } } }, { kids: { ainsley: { jarState: "  " } } }, { kids: { ainsley: { jarState: null } } }, { kids: { ainsley: { jarState: 3 } } },
    { kids: { ainsley: { jarState: true } } }, { kids: { ainsley: { jarState: "trusted" } } }, { kids: { ainsley: { jarState: "TRUSTED" } } }, { kids: { ainsley: { jarState: " Trusted " } } },
    { kids: { hayes: { jarState: "empty" } } }, { offline: true, status: "offline" }])
    assert.equal(S(d), "trusted", JSON.stringify(d));
  for (const v of ["empty", "EMPTY", "resting", "paused", "x"]) assert.equal(S({ kids: { ainsley: { jarState: v } } }), "empty", v);
  const src = read("ains-jar-state.js").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.equal(/\d/.test(src), false, "the painter writes no digit");
  assert.equal(/paint\("empty"\)/.test(src), false, "never paints EMPTY without an explicit feed value");
});
const JAR_MODES = { nofeed: "TRUSTED", slow: "TRUSTED", bad: "TRUSTED", feed: "TRUSTED", trusted: "TRUSTED", other: "EMPTY" };
test("AINSJAR1 (real browser): kid-ainsley has no star or count; TRUSTED before data and unless the feed says otherwise, at 440, 390 and wall", SKIP, () => {
  for (const [w, h] of [[440, 956], [390, 844], [1080, 1920]]) {
    for (const [mode, want] of Object.entries(JAR_MODES)) {
      const r = run("kid-ainsley", mode, w, h, { LDNOW: "2026-10-17T10:00:00-05:00" });
      assert.ok(r.samples.length >= 4);
      for (const s of r.samples) {
        const tag = mode + " " + w + " " + JSON.stringify(s);
        assert.deepEqual(s.stars, [], tag); assert.deepEqual(s.jarDigits, [], tag); assert.deepEqual(s.mustsDigits, [], tag);
        assert.equal(s.progress, 0, tag); assert.equal(s.stateUnderLabel, true, tag);
        assert.ok(s.state === "TRUSTED" || s.state === want, tag);
      }
      assert.equal(r.samples[0].state, "TRUSTED", mode + " " + w + " pre-data");
      assert.equal(r.samples[r.samples.length - 1].state, want, mode + " " + w);
      assert.deepEqual(r.errors, []);
    }
  }
});
test("AINSJAR1 (real browser): sheet-allowance shows her TRUSTED or EMPTY state with no star or digit, at 440, 390 and wall", SKIP, () => {
  for (const [w, h] of [[440, 956], [390, 844], [1080, 1920]]) {
    for (const [mode, want] of Object.entries(JAR_MODES)) {
      const r = run("allowance", mode, w, h);
      for (const s of r.samples) {
        assert.equal(s.bank.star, false, mode + " " + s.bank.text); assert.equal(s.bank.digit, false, mode + " " + s.bank.text);
        assert.ok(s.state === "TRUSTED" || s.state === want, JSON.stringify(s));
      }
      assert.equal(r.samples[0].state, "TRUSTED", mode + " " + w + " pre-data");
      assert.equal(r.samples[r.samples.length - 1].state, want, mode + " " + w);
      assert.deepEqual(r.errors, []);
    }
  }
});

/* ---------- 5. AINSCHORE1 (Alfred Oct 20): her rows on sheet-chores carry no star or rate; the boys keep theirs ---------- */
function choresSection(label) {
  const h = read("sheet-chores.html"), i = h.indexOf('<section class="col" aria-label="' + label + ' chores">');
  assert.ok(i > 0, label);
  return h.slice(i, h.indexOf("</section>", i));
}
test("AINSCHORE1 markup: Ainsley's chore rows have no star glyph, star-earn or rate binding; boys keep theirs", () => {
  const a = choresSection("Ainsley");
  assert.equal(STAR.test(a), false, "a star glyph in her rows");
  assert.equal(/star-earn|data-stars|data-money/.test(a), false, "a star or money binding in her rows");
  assert.equal(/g2-star|class="streak"|class="star /.test(a), false, "a star icon or streak in her rows");
  assert.equal(/\d/.test(a.replace(/<[^>]+>/g, " ")), false, "a digit in her rows");
  assert.ok((a.match(/class="chore /g) || []).length >= 9);
  for (const k of ["Hayes", "Harris"]) assert.match(choresSection(k), /class="star-earn[^"]*" data-stars="\d+"/, k + " rows keep their rate");
});
test("AINSCHORE1 (real browser): no star or digit in Ainsley's chore rows with no, slow, real or junk data, at 440, 390 and wall", SKIP, () => {
  for (const [w, h] of [[440, 956], [390, 844], [1080, 1920]]) {
    for (const mode of ["nofeed", "slow", "feed", "bad"]) {
      const r = run("chores", mode, w, h);
      for (const s of r.samples) {
        assert.ok(s.rows >= 9, JSON.stringify(s));
        assert.equal(s.starIcons, 0, mode + " " + w + " star icon");
        assert.deepEqual(s.star, [], mode + " " + w + " " + JSON.stringify(s));
        assert.deepEqual(s.digit, [], mode + " " + w + " " + JSON.stringify(s));
      }
      assert.deepEqual(r.errors, []);
      if (mode !== "nofeed") assert.ok(r.hub_hits > 0, mode);
    }
  }
});
test("AINSJAR1 feed path: ains-jar-state reads kids-week through the same wrapped fetch as house-money-bind", () => {
  const call = 'fetch("kids-week.json", { cache: "no-store" })';
  assert.ok(read("house-money-bind.js").includes(call));
  assert.ok(read("ains-jar-state.js").includes(call));
  for (const f of ["kid-ainsley.html", "sheet-allowance.html"]) {
    const h = read(f), j = h.indexOf('<script src="ains-jar-state.js');
    assert.ok(j > 0, f);
    assert.ok(h.indexOf('<script src="private-feed.js') > -1 && h.indexOf('<script src="private-feed.js') < j, f + ": private-feed.js first");
    const af = h.indexOf('<script src="away-filter.js'); assert.ok(af > -1 && af < j && /data-away-install/.test(h.slice(af, af + 80)), f + ": away-filter.js installed first");
  }
});
