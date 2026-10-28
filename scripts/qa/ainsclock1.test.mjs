/* KIDCRIT AINSCLOCK1 (Atlas 1:09 AM CT, amendment to JARTAP1) · node --test scripts/qa/ainsclock1.test.mjs
   The JARTAP1 re-walk found the kid-world HUD clock line ([data-kw-clock], painted by clockLine()) on Ainsley's page showing a
   stale day and time ("Sun · 9:00 PM"). Atlas 1:14 AM CT: the clock comes off because it is stale day/time; there is no no-digits law
   (the law is no "$" on kid boards, hidden DOM included). kid-ainsley.html (and only it) takes that node out of the DOM as soon as
   kid-world builds it, so the text never renders and never sits in the DOM (a CSS hide would leave it there).
   Real kid-world.js clockLine/paintClock + the real AINSCLOCK1 script in a vm with a small DOM; the browser half is the Ainsley re-walk. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const rd = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const AINS = rd("kid-ainsley.html");
const KW = rd("kid-world.js");
const MARK = "AINSCLOCK1";
const STALE = /\b(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat)(?:day)?\s*\u00b7|\b\d{1,2}:\d{2}\b|\b(?:AM|PM)\b/;   // weekday + clock-time patterns only
const fnSrc = (name) => { const i = KW.indexOf("function " + name + "("); assert.ok(i > 0, name); let d = 0, j = KW.indexOf("{", i);
  for (; j < KW.length; j++) { if (KW[j] === "{") d++; else if (KW[j] === "}" && --d === 0) break; } return KW.slice(i, j + 1); };
const inline = () => { const m = AINS.match(/<script>\/\* AINSCLOCK1[\s\S]*?<\/script>/g); assert.equal(m && m.length, 1, "one AINSCLOCK1 script"); return m[0].replace(/^<script>|<\/script>$/g, ""); };

/* a tiny live DOM with querySelectorAll/remove and a MutationObserver that fires after each append (like the microtask) */
function dom() {
  const obs = [];
  const mk = (tag, attrs = {}) => ({ tag, attrs, kids: [], parent: null, textContent: "",
    remove() { if (this.parent) this.parent.kids = this.parent.kids.filter((k) => k !== this); this.parent = null; },
    append(c) { c.parent = this; this.kids.push(c); obs.forEach((f) => f([])); return c; } });
  const root = mk("HTML");
  const walk = (n, out = []) => { n.kids.forEach((k) => { out.push(k); walk(k, out); }); return out; };
  const doc = { documentElement: root, body: { getAttribute: (a) => (a === "data-kid" ? "ainsley" : null) },
    querySelectorAll: (sel) => walk(root).filter((n) => sel === "[data-kw-clock]" && "data-kw-clock" in n.attrs),
    querySelector: (sel) => doc.querySelectorAll(sel)[0] || null };
  class MO { constructor(f) { this.f = f; } observe(t, o) { assert.equal(t, root); assert.ok(o.childList && o.subtree); obs.push(this.f); } }
  return { doc, root, mk, walk, MO };
}
function sunday9pm() { const RealDate = Date; const t = Date.UTC(2026, 9, 26, 2, 0, 0);   /* Sun Oct 25 2026 9:00 PM CT */
  return class extends RealDate { constructor(...a) { super(...(a.length ? a : [t])); } static now() { return t; } }; }

test("the bug is real: kid-world's clock line reads a stale weekday and clock time on a Sunday night", () => {
  const g = { Intl, String, Math, Date: sunday9pm(), document: { body: { getAttribute: () => "ainsley" } } }; g.global = g;
  vm.runInNewContext(fnSrc("kid") + fnSrc("clockLine") + ";this.out = clockLine();", g);
  assert.equal(g.out, "Sun \u00b7 9:00 PM");
  assert.match(KW, /<div class="kw-clock" data-kw-clock><\/div>/, "the HUD clock node AINSCLOCK1 removes still exists under this name");
});

test("Ainsley: the clock node is gone from the DOM as soon as it is built, and paintClock then writes nothing", () => {
  const D = dom(); const g = { document: D.doc, MutationObserver: D.MO, Intl, String, Math, Date: sunday9pm() }; g.global = g;
  vm.runInNewContext(inline(), g);
  const hud = D.root.append(D.mk("HEADER", { class: "kw-hud" }));          /* kid-world builds the HUD */
  hud.append(D.mk("BUTTON", { "data-kw-home": "" }));
  hud.append(D.mk("DIV", { class: "kw-clock", "data-kw-clock": "" }));
  vm.runInNewContext(fnSrc("kid") + fnSrc("clockLine") + fnSrc("paintClock") + ";paintClock();", g);
  assert.equal(D.doc.querySelectorAll("[data-kw-clock]").length, 0, "clock node removed");
  const text = D.walk(D.root).map((n) => n.textContent).join(" ");
  assert.doesNotMatch(text, STALE, "no stale day/time text rendered: " + text);
  hud.append(D.mk("DIV", { "data-kw-clock": "" }));                         /* a rebuilt HUD is caught too */
  assert.equal(D.doc.querySelectorAll("[data-kw-clock]").length, 0);
});

test("kid-ainsley.html: no stale day/time in its rendered strings (markup text, title, alt, aria-label, placeholder) and the new script writes none", () => {
  const body = AINS.replace(/<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>|<!--[\s\S]*?-->/g, "");
  const text = body.replace(/<[^>]+>/g, " ");
  assert.doesNotMatch(text, STALE, "markup text");
  for (const m of body.matchAll(/\s(?:title|alt|aria-label|placeholder)="([^"]*)"/g)) assert.doesNotMatch(m[1], STALE, "attribute " + m[1]);
  const code = inline().replace(/\/\*[\s\S]*?\*\//g, "");
  for (const lit of code.match(/"[^"]*"|'[^']*'/g) || []) assert.doesNotMatch(lit, STALE, "the AINSCLOCK1 script writes no day/time text: " + lit);
  assert.doesNotMatch(code, /textContent|innerHTML|innerText|insertAdjacent/, "the AINSCLOCK1 script only removes, never writes text");
});

test("only Ainsley: no other kid page carries AINSCLOCK1; it loads before kid-world.js; kid-world.js and the boys keep their clock", () => {
  for (const f of fs.readdirSync(ROOT).filter((f) => /^kid-[a-z-]+\.html$/.test(f) && f !== "kid-ainsley.html")) assert.ok(!rd(f).includes(MARK), f);
  assert.ok(AINS.indexOf("<script>/* " + MARK) < AINS.indexOf('<script src="kid-world.js'), "observer is set before kid-world builds the HUD");
  assert.ok(!KW.includes(MARK), "kid-world.js is unchanged by AINSCLOCK1");
  assert.match(AINS, /data-kid="ainsley"/);
});

test("AINSCLOCK1 does not bring back a dollar sign on Ainsley's page (NODOLLAR1 stays green)", () => {
  assert.ok(!AINS.includes(String.fromCharCode(36)));
});
