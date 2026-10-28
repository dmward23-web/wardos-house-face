/* LIVEFIX3 · (1) Ainsley's schedule section (kid-ainsley) shows no digit, time or date (weekday words only), no countdown
   and no away-window end; the header clock is chrome and is left alone; the boys' pages are byte-identical.
   (2) Atlas: the hub (sheet-index, Dan's phone view) gets the narrow away exception (conferences show, practice and
   skate stay hidden); opened from the wall (?from=wall) and on wall.html the strict away law stands.
   Real browser (scripts/qa/livefix3_viewport.py) on synthetic fixtures (Smith/QXS/Jones stand-ins). */
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import { spawnSync, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const browser = spawnSync("python3", ["-c", "import playwright.sync_api"], { encoding: "utf8" }).status === 0 && process.env.QA_NO_BROWSER !== "1";
const SKIP = browser ? {} : { skip: "SKIP no playwright (QA_NO_BROWSER)" };
function run(mode, w = 440, h = 956) {
  const r = spawnSync("python3", [path.join(ROOT, "scripts/qa/livefix3_viewport.py"), mode, String(w), String(h)], { encoding: "utf8", timeout: 240000 });
  assert.equal(r.status, 0, r.stderr);
  const o = JSON.parse(r.stdout.trim().split("\n").pop());
  assert.deepEqual(o.errors, [], mode + " page errors");
  return o;
}

test("Ainsley page at 440 and 1920 (feed via the hub route /api/private/*.json): no digit, date or away-window end outside the header clock", SKIP, () => {
  for (const [w, h] of [[440, 956], [1920, 1080]]) {
    const o = run("ainsley", w, h);
    assert.ok(o.hub_hits > 0, "fed through /api/private/ " + JSON.stringify(o));
    assert.ok(o.state.texts > 3, JSON.stringify(o));
    assert.ok(o.state.readRows > 0, "the 'Read 20 min 3x by 7:30' quest fixture renders (scrubbed) " + JSON.stringify(o));
    assert.deepEqual(o.state.digits, [], w + " " + JSON.stringify(o));
    assert.deepEqual(o.state.endDate, [], w + " " + JSON.stringify(o));
  }
});

test("hub on an away day: conferences show, practice and skate hidden; from the wall and on the wall: nothing", SKIP, () => {
  const hub = run("hub").state;
  assert.ok(hub.conf >= 2, JSON.stringify(hub));
  assert.equal(hub.practice, 0); assert.equal(hub.skate, 0);
  for (const m of ["hubwall", "wall"]) {
    const s = run(m).state;
    assert.equal(s.conf + s.practice + s.skate, 0, m + " " + JSON.stringify(s));
  }
});

/* RESCOPE146 · byte-identical to main 442eb257 once the Halloween theme layer is stripped: the wg-glass link, the wg-assets
   script, and the data-asset* attributes on <body>. Anything else that differs is a real drift and fails. */
/* KIDWORLD1/LIVEWX2 · the theme layer also carries the shared clock + season-gate tags that load ahead of wg-assets, and
   cache tokens (?v=) on scripts the layer changed; only the token is normalized, the file name and tag must still match.
   H1-CB (Alfred P2): the halloween1 range re-tokens every ref to a changed script (?v=HALLOWEEN1), so those names join the list.
   HUBPAIR1 re-tokens house-hub / house-pair the same way (token only).
   KIDCRIT re-tokens house-nomoney / kids-data / house-fresh the same way (token only, ?v=KIDCRIT1).
   JARTAP1 (Atlas 11:51 PM CT, steer A) drops the "$" glyph from exactly three markup lines (grow total, Bal, Week) and the Dad payday prompt line ("dollars");
   JARTAP1_LINES maps those exact base lines to the new ones and nothing else, so any other copy change still fails.
   DAYPKG1 item 2 (expectation refresh, token only): JARTAP1D2 re-tokened house-money-bind + house-saves (?v=JARTAP1D2) and
   HAYESJAR1D re-tokened house-checkoffs (?v=HAYESJAR1D) on the boys' pages; those three names join the token-only list.
   The probe diff (strip(base) vs strip(now)) on 4ff0c680 showed exactly those 3 tags per boy page and nothing else, so the
   old expectation was stale for a token reason only; the file name, tag shape, order and every copy line must still match.
   DAYPKG1 item 4 token bump: house-kid-engage.js (MERGE1C -> DAYPKG1) joins the token-only list; kid-world.css, kids-data,
   house-sfx, house-money-bind and house-checkoffs were already token-normalized. Token only, same tag and order. */
const JARTAP1_LINES = new Map([
  [' <div class="grow-total">$<span data-grow-total>0</span> / $<span data-grow-save-need>0</span></div>', ' <div class="grow-total"><span data-grow-total>0</span> / <span data-grow-save-need>0</span></div>'],
  [' <div class="money-chip"><span class="lab">Bal</span> $<span data-bank-balance>0</span></div>', ' <div class="money-chip"><span class="lab">Bal</span> <span data-bank-balance>0</span></div>'],
  [' <div class="money-chip"><span class="lab">Week</span> +$<span data-bank-week-earn>0</span></div>', ' <div class="money-chip"><span class="lab">Week</span> +<span data-bank-week-earn>0</span></div>'],
  [" \"Dad paid how many $?\\nThis week earn $\" + weekEarn + \" \u2192 balance becomes $\" + after + \" \u2212 paid.\\n0 = keep all as carry into next week.\",", " \"Dad paid how many dollars?\\nThis week earn \" + weekEarn + \" \u2192 balance becomes \" + after + \" \u2212 paid.\\n0 = keep all as carry into next week.\","],
]);
const THEME_TAGS = /(?:<script src="livinghouse\/clock\.js\?v=[A-Z0-9]+"><\/script><script src="livinghouse\/scene-packs\.js\?v=[A-Z0-9]+"><\/script>)?<script src="wg-assets\.js(?:\?v=[A-Z0-9]+)?" defer><\/script>\n?/g;
const THEME_STRIP = (t) => t.replace(/<link rel="stylesheet" href="wg-glass\.css[^"]*" \/>\n?/g, "").replace(THEME_TAGS, "").split("\n")
  .filter((l) => !/^<link rel="stylesheet" href="wg-glass\.css[^"]*" \/>$/.test(l))
  .map((l) => JARTAP1_LINES.get(l) ?? l)
  .map((l) => l.replace(/^(<link rel="stylesheet" href="kid-world\.css)\?v=[A-Z0-9]+"/, '$1?v=V"').replace(/(<script src="(?:kid-world|jar-engine)\.js)\?v=[A-Z0-9]+"/g, '$1?v=V"'))   /* JARTAP1 re-tokens kid-world.css/js + jar-engine (token only) */
  .map((l) => l.replace(/ data-asset(?:-ph|-var|-lit)?="[^"]*"/g, "").replace(/(<script src="(?:house-clock|hayes-loot|private-feed|school-names|house-face-law|away-filter|house-lights|house-hub|house-pair|month-theme\/month-overlay|house-nomoney|kids-data|house-fresh|house-sfx|house-money-bind|house-saves|house-checkoffs|house-kid-engage)\.js)\?v=[A-Z0-9]+"/g, '$1?v=V"'))
  .join("\n");
/* DAYPKG1 v2d · Atlas ruling (Oct 28 12:15 AM CT) A: the kid Paid button and its prompt handler are removed (Dad pays on
   sheet-allowance). Exactly that block, and the one comment left in its place, is cut from both sides; nothing else */
const V2D_STRIP = (t) => {
  t = t.replace(/^ <button type="button" class="got-it" data-got-it hidden>Paid<\/button>\n/m, "");
  const i = t.indexOf('\n var got = document.querySelector("[data-got-it]");');
  if (i >= 0) { const e = ' if (window.HouseSfx) HouseSfx.tap();\n });\n }\n', j = t.indexOf(e, i); assert.ok(j > i, "got-it block end"); t = t.slice(0, i) + "\n" + t.slice(j + e.length); }
  /* DAYPKG1 v2e · Atlas 12:40 AM (2): the Paid sheet is URL only. The three jar anchors point at the board's own jar section
     (#sec-jar) instead of the Paid sheet, house-links.js is re-tokened, and the comment no longer names the page. Exactly those
     three hrefs and that token are folded back; any other change still fails */
  t = t.replace(/^( *<a class="(?:primary-foil|unlock-cta|ftr-chip)"[^>\n]*? href=")#sec-jar(">)/gm, "$1sheet-allowance.html$2")
    .replace(/<script src="house-links\.js\?v=DAYPKG1"><\/script>/, '<script src="house-links.js?v=LINKWEB1"></script>');
  return t.replace(/\n \/\* DAYPKG1 v2d · Atlas ruling \(Oct 28 12:15 AM CT\) A: no Paid button and no prompt on a kid board\. Dad taps Paid on\n    (?:sheet-allowance|the Dad sheet); this board only shows the stored Paid or Jar reset tick \(kids-data\.js renderBank\) \*\/\n/, "\n");
};
/* DAYPKG1 v2h · Atlas (Oct 28 3:48 AM CT): the Jar buttons (primary-foil, footer ftr-chip) are removed, the show Dad CTA is plain
   text in a hidden-when-empty row, plus its 3-rule CSS block. Exactly those are folded back to the v2g markup; anything else fails */
const V2H_FOLD = (t) => t
  .replace("  /* DAYPKG1 v2h · Atlas: nothing dead on kid glass. The jar-full line is plain text (no link, no button look); an empty CTA row is hidden so it leaves no gap */\n  .bank-links .unlock-cta { display:inline-block; font-size:13px; font-weight:800; letter-spacing:0.04em; text-transform:uppercase; cursor:default; }\n  .bank-links[hidden] { display:none !important; }\n", "")
  .replace(' <div class="bank-links" data-cta-row hidden>\n <span class="unlock-cta" data-unlock-cta hidden>Jar full · show Dad</span>\n',
    ' <div class="bank-links">\n <a class="primary-foil" href="#sec-jar">Jar</a>\n <a class="unlock-cta" data-unlock-cta hidden href="#sec-jar">Jar full · show Dad</a>\n')
  .replace(/^( <span>the (?:island|block woods)<\/span>\n)(?! \n)/m, '$1 \n \n <a class="ftr-chip" href="#sec-jar">Jar</a>\n');
test("the boys' pages are byte-identical to main 442eb257 apart from the Halloween theme layer", () => {
  for (const f of ["kid-hayes.html", "kid-harris.html", "kid-hayes-pre-theme.html", "kid-harris-pre-theme.html"]) {
    const base = execFileSync("git", ["show", "442eb25762967d4a1e7de1de70cd0991e15e0426:" + f], { cwd: ROOT }).toString();
    const now = fs.readFileSync(path.join(ROOT, f), "utf8");
    assert.equal(THEME_STRIP(V2D_STRIP(V2H_FOLD(now))), THEME_STRIP(V2D_STRIP(base)), f + " drifted beyond the theme layer");
  }
});
test("the theme strip is not a blanket pass: a copy change still fails", () => {
  assert.notEqual(THEME_STRIP("<p>ALL CLEAR</p>"), THEME_STRIP("<p>ALL DONE</p>"));
  assert.notEqual(THEME_STRIP('<script src="house-clock.js?v=A"></script>'), THEME_STRIP('<script src="house-lights.js?v=A"></script>'), "a swapped script still fails");
  assert.notEqual(THEME_STRIP('<script src="livinghouse/scene-packs.js?v=A"></script>'), "", "a lone season tag is not theme layer");
  /* DAYPKG1 item 2: the three names added token-only still fail on a swapped name, a dropped defer or a moved tag */
  assert.notEqual(THEME_STRIP('<script src="house-saves.js?v=A"></script>'), THEME_STRIP('<script src="house-money-bind.js?v=A"></script>'), "a swapped script still fails");
  assert.notEqual(THEME_STRIP('<script src="house-checkoffs.js?v=A" defer></script>'), THEME_STRIP('<script src="house-checkoffs.js?v=A"></script>'), "a dropped defer still fails");
  assert.equal(THEME_STRIP('<script src="house-checkoffs.js?v=PRIVFEED3" defer></script>'), THEME_STRIP('<script src="house-checkoffs.js?v=HAYESJAR1D" defer></script>'), "token only");
});
