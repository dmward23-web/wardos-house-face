/* DAYPKG1 v2h · QA_NO_BROWSER=1, static (node + vm only, no browser). Atlas rulings on v2g (Oct 28 3:48 AM CT):
   (1) the Dad weekly figure on sheet-allowance is confirmed as built (covered in daypkg1v2g).
   (2) nothing dead on kid glass: the Dad tile (sheet-index), the Dad chip (wall, night/scene) and the Jar buttons (primary-foil,
       footer chip) are removed from the markup; 'Jar full · show Dad' stays as plain text (no link, no anchor) with its
       hidden/unlock behaviour; the spots leave no gap (grid / chip rows reflow, an all-hidden CTA row is hidden).
   Kid copy law: no '$', no em dashes or arrows, Ainsley gets no counts. Alfred must still RENDER all 3 kid boards at 440/phone
   and tablet for gaps: these checks are static. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const rd = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const KIDS = ["hayes", "harris", "ainsley"];
const BOARDS = ["kid-hayes.html", "kid-harris.html", "kid-ainsley.html", "kid-hayes-pre-theme.html", "kid-harris-pre-theme.html", "kid-ainsley-pre-theme.html", "mercury-run.html"];
const D = String.fromCharCode(36);
const noComments = (h) => h.replace(/<!--[\s\S]*?-->/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
const body = (h) => { const i = h.search(/<body\b/i); return i < 0 ? h : h.slice(i); };
const anchors = (h) => noComments(body(h)).match(/<a\b[^>]*>[\s\S]*?<\/a>/g) || [];
const textOf = (a) => a.replace(/<[^>]*>/g, "").trim();
const tracked = execFileSync("git", ["ls-files", "*.html"], { cwd: ROOT }).toString().split("\n").filter(Boolean);

test("DAYPKG1 v2h: no Dad tile, Dad chip or Jar button anchor on any kid board (incl. pre-theme stubs, mercury-run) or kid nav page", () => {
  for (const f of BOARDS) {
    const h = noComments(body(rd(f)));
    assert.doesNotMatch(h, /class="[^"]*\b(?:primary-foil|ftr-chip)\b/, f + " Jar button");
    assert.doesNotMatch(h, /class="tile dan\b|data-kid-seed="dad"|id="chip-body"|data-n="Dad"|\bdad-seat\b/, f + " Dad tile / chip");
    for (const a of anchors(rd(f))) {
      assert.doesNotMatch(textOf(a) + " " + (a.match(/aria-label="([^"]*)"/) || [, ""])[1], /\bDad\b/i, f + " Dad anchor " + a.slice(0, 80));
      /* the only Jar link left is the jump rail section pill (scrolls to the Jar card); no Jar button */
      if (/\bJar\b/i.test(textOf(a) + (a.match(/aria-label="([^"]*)"/) || [, ""])[1])) assert.match(a, /class="row [a-z]+ jump-pill" href="#sec-jar"/, f + " Jar anchor " + a.slice(0, 80));
    }
  }
  /* kid nav: every tracked page that is not a Dad sheet or livinghouse carries no Dad tile or chip */
  for (const f of tracked) {
    if (/^(?:sheet-dan|sheet-allowance)\.html$|^livinghouse\/|^scripts\//.test(f)) continue;
    assert.doesNotMatch(noComments(rd(f)), /<[a-z]+ class="tile dan\b|<div class="chip" id="chip-body"/, f + " Dad tile / chip");
  }
  for (const f of ["wall.html", "night/scene.html"]) assert.equal((rd(f).match(/<div class="chip" /g) || []).length, 2, f + " chips: Family, Kids");
});

test("DAYPKG1 v2h: 'Jar full · show Dad' is plain text with no href, not focusable or a link; its hidden/unlock behaviour is kept", () => {
  for (const kid of KIDS) {
    const f = "kid-" + kid + ".html", h = rd(f);
    const m = h.match(/<span class="unlock-cta" data-unlock-cta hidden>Jar full · show Dad<\/span>/g) || [];
    assert.equal(m.length, 1, f + " one plain CTA");
    assert.doesNotMatch(h, /<a\b[^>]*data-unlock-cta|data-unlock-cta[^>]*\b(?:href|tabindex|role)=/, f + " CTA not a link / focusable");
    assert.match(h, /\[data-unlock-cta\]\[hidden\][\s\S]*?display:\s*none !important/, f + " [hidden] still beats the CTA display");
    assert.match(h, /\.bank-links \.unlock-cta \{[^}]*cursor:default/, f + " no pointer, no button look");
  }
  const kd = rd("kids-data.js");
  assert.match(kd, /root\.querySelectorAll\("\[data-unlock-cta\]"\)\.forEach\(function \(el\) \{[\s\S]{0,700}el\.hidden = !full;/, "unlock toggle kept");
  assert.match(kd, /\? "JAR FULL · show Dad" :/, "kid pages: no amount in the CTA");
});

test("DAYPKG1 v2h: no empty grid cells or leftover chip separators (static): CTA row, kid footers, wall/night chips, index roster", () => {
  /* CTA row: starts hidden, hidden by CSS, and renderBank hides it whenever every item in it is hidden */
  for (const kid of KIDS) {
    const h = rd("kid-" + kid + ".html");
    assert.match(h, /<div class="bank-links" data-cta-row hidden>/, kid + " CTA row starts hidden");
    assert.match(h, /\.bank-links\[hidden\] \{ display:none !important; \}/, kid + " hidden row takes no space");
    const f = h.match(/<footer class="ftr"[^>]*>([\s\S]*?)<\/footer>/);
    assert.ok(f, kid + " footer");
    assert.doesNotMatch(f[1], /ftr-chip|·|\||<a\b/, kid + " footer: no chip, separator or link left");
  }
  const kd = rd("kids-data.js");
  const i = kd.indexOf('root.querySelectorAll("[data-cta-row]")');
  assert.ok(i > 0, "cta row sync in renderBank");
  const snip = kd.slice(i, kd.indexOf("});", i) + 3);
  const row = (states) => ({ hidden: true, children: states.map((h) => ({ hidden: h })) });
  for (const [states, want] of [[[true, true], true], [[false, true], false], [[true, false], false], [[true], true]]) {
    const r = row(states);
    vm.runInNewContext(snip, { root: { querySelectorAll: () => [r] } });
    assert.equal(r.hidden, want, JSON.stringify(states));
  }
  /* wall / night: 2 chips, desktop grid has exactly 2 columns, phone grid has 2 columns (even, no lone chip) */
  for (const f of ["wall.html", "night/scene.html"]) {
    const h = rd(f), n = (h.match(/<div class="chip" /g) || []).length;
    assert.match(h, new RegExp("\\.wall #chips\\{bottom:62px;grid-template-columns:repeat\\(" + n + ",200px\\)\\}"), f + " desktop columns = chips");
    assert.match(h, /\.phone #chips\{bottom:44px;grid-template-columns:repeat\(2,176px\)/, f);
    assert.equal(n % 2, 0, f + " phone rows full");
    assert.match(h, /\.phone #chips \.chip:last-child:nth-child\(odd\)\{grid-column:1\/-1;justify-self:center;width:calc\(50% - 8px\)\}/, f + " odd rule kept for safety");
  }
  /* sheet-index roster: 3 columns x 4 rows, every row filled (a lone last tile spans its row) */
  const ix = rd("sheet-index.html");
  const nav = ix.slice(ix.indexOf('<nav class="tile-grid tile-grid--cams"'), ix.indexOf("</nav>", ix.indexOf('<nav class="tile-grid tile-grid--cams"')));
  const tiles = noComments(nav).match(/\n <(?:a|div) class="tile [^"]*"/g) || [];
  assert.equal(tiles.length, 10, "10 tiles: " + tiles.join(","));
  assert.equal(Math.ceil(tiles.length / 3), 4, "4 rows, none empty");
  if (tiles.length % 3 === 1) assert.match(ix, /\.tile-grid > \.tile:last-child:nth-child\(3n\+1\) \{ grid-column: 1 \/ -1 !important; \}/, "lone last tile spans its row");
  assert.notEqual(tiles.length % 3, 2, "no 2-of-3 last row");
});

test("DAYPKG1 v2h: kid copy law on the changed kid markup: no '$', no em dash or arrow; Ainsley's jar card shows no count", () => {
  for (const f of BOARDS) {
    const h = body(rd(f)).replace(/<script\b[\s\S]*?<\/script>/g, "").replace(/<style\b[\s\S]*?<\/style>/g, "");
    const vis = noComments(h).replace(/<[^>]*>/g, " ");
    assert.ok(!vis.includes(D), f + " '$'");
    assert.doesNotMatch(vis, /[\u2014\u2192\u2190\u21d2\u27a1]|->/, f + " em dash / arrow");
  }
  const a = rd("kid-ainsley.html"), card = a.slice(a.indexOf('id="sec-jar"'), a.indexOf("</section>", a.indexOf('id="sec-jar"')));
  assert.doesNotMatch(noComments(card).replace(/<[^>]*>/g, " "), /\d/, "Ainsley jar card: no digits");
});
