/* KIDCRIT JARTAP1 NODOLLAR1 (steer A, 11:52 PM CT) · node --test scripts/qa/nodollar1.test.mjs
   The 12 hidden "$" nodes (1 Ainsley, 4 Harris, 4 Hayes in assert-kcB, plus the bare markup glyphs) were lone dollar signs
   before an empty number span: house-nomoney only rewrote "$" + digit, so a lone "$" survived (hidden, but in the kid DOM).
   Now: no "$" in any kid html file at all, and on a kid page the scrub removes every "$" left in text or the scrubbed attributes.
   Dad pages (sheet-*) keep their old behaviour. Real house-nomoney.js in a vm; the browser half is the JARTAP1 re-walk. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const rd = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const D = String.fromCharCode(36);
const KID_HTML = fs.readdirSync(ROOT).filter((f) => /^kid-[a-z-]+\.html$/.test(f));

function nm(pathname) {
  const g = { location: { pathname } }; g.window = g; g.globalThis = g; g.addEventListener = () => {};
  g.document = { readyState: "loading", addEventListener() {} };
  vm.runInNewContext(rd("house-nomoney.js"), g);
  return g.HouseNoMoney;
}
/* a tiny DOM: element(tag, attrs, ...kids) / text(v) */
const T = (v) => ({ nodeType: 3, nodeValue: v });
function E(tag, attrs, ...kids) {
  const el = { nodeType: 1, tagName: tag, attrs: { ...attrs }, childNodes: kids, classList: { contains: (c) => (attrs.class || "").split(" ").includes(c) },
    getAttribute(a) { return a in this.attrs ? this.attrs[a] : null; }, setAttribute(a, v) { this.attrs[a] = v; } };
  kids.forEach((k, i) => { k.nextSibling = kids[i + 1] || null; k.parentNode = el; });
  el.firstChild = kids[0] || null; el.removeChild = (c) => { el.childNodes = el.childNodes.filter((x) => x !== c); };
  return el;
}
function allText(n, out = []) { if (n.nodeType === 3) out.push(n.nodeValue); else if (n.nodeType === 1) { Object.values(n.attrs).forEach((v) => out.push(v)); n.childNodes.forEach((c) => allText(c, out)); } return out; }
const board = () => E("BODY", {},
  E("DIV", { class: "grow-total", hidden: "" }, T(D), E("SPAN", {}, T("0")), T(" / " + D), E("SPAN", {}, T("0"))),
  E("DIV", { class: "money-chip", style: "display:none" }, E("SPAN", { class: "lab" }, T("Bal")), T(" " + D), E("SPAN", {}, T("0"))),
  E("DIV", { class: "money-chip", "aria-label": "Week +" + D }, T(" +" + D), E("SPAN", {}, T("0"))),
  E("P", { title: "Jar " + D + "5" }, T("Babysitting " + D + "12/hr")),
  E("SCRIPT", {}, T("var re = /" + D + "/;")));

test("no kid html file carries a '$' anywhere (markup, scripts, hidden blocks; live and pre-theme)", () => {
  assert.ok(KID_HTML.length >= 6, KID_HTML.join(","));
  for (const f of KID_HTML) assert.equal(rd(f).split(D).length - 1, 0, f);
});

test("DAYPKG1 v2d (Atlas Oct 28 12:15 AM CT A): no payday prompt on the kid pages at all (Dad pays on sheet-allowance)", () => {
  for (const k of ["harris", "hayes", "ainsley"]) { const h = rd("kid-" + k + ".html"); assert.ok(!/Dad paid how many|window\.prompt\(|<button[^>]*data-got-it/.test(h), k); }
});

for (const k of ["harris", "hayes", "ainsley"]) {
  test("kid-" + k + ": the scrub leaves no '$' in text or scrubbed attributes, hidden nodes included (script text untouched)", () => {
    const N = nm("/kid-" + k + ".html"), b = board();
    N.scrub(b);
    const seen = allText(b).filter((s) => s.includes(D));
    assert.deepEqual(seen, ["var re = /" + D + "/;"], seen.join(" | "));   /* only the SCRIPT text, which the scrub never touches */
    assert.equal(N.text("Babysitting " + D + "12/hr"), "Babysitting \u2605");
    assert.equal(N.text(D), "");
    assert.equal(N.text(" / " + D), " / ");
  });
}

test("Dad pages keep the old behaviour: a lone '$' stays, figures still turn into stars", () => {
  for (const p of ["/sheet-allowance.html", "/sheet-chores.html", "/sheet-index.html", "/sheet-weekend.html", "/"]) {
    const N = nm(p);
    assert.equal(N.text(D), D, p);
    assert.equal(N.text("Bal " + D), "Bal " + D, p);
    assert.equal(N.text("Babysitting " + D + "12/hr"), "Babysitting \u2605", p);
  }
});

test("the kid-page switch is the page path only (no viewport gate)", () => {
  const src = rd("house-nomoney.js");
  assert.match(src, /var KIDPAGE = !!\(g\.location && \/\\\/\(\?:kid-\[a-z\]\+\|mercury-run\)\(\\\.html\)\?\$\/\.test\(g\.location\.pathname \|\| ""\)\);/); /* DAYPKG1 v2d · extensionless path too. DAYPKG1 v2f D2 · mercury-run is a kid page */
  assert.doesNotMatch(src, /innerWidth|matchMedia/);
});
