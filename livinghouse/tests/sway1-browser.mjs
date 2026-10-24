/* SWAY1 · reduced-motion path is near-still and tap targets stay on the static parent. Run: node sway1-browser.mjs <baseURL> */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const req = createRequire(import.meta.url);
const p = req(process.env.PUPPETEER_PATH || "puppeteer-core");
const base = process.argv[2] || "http://localhost:8835/";
const b = await p.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome", args: ["--no-sandbox"] });
try {
  for (const [w, h, rm] of [[1920, 1080, false], [440, 956, false], [1920, 1080, true], [440, 956, true]]) {
    const g = await b.newPage();
    await g.setViewport({ width: w, height: h, isMobile: w < 800, hasTouch: w < 800 });
    if (rm) await g.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
    await g.goto(base + "livinghouse/index.html?pfOffline=1", { waitUntil: "domcontentloaded", timeout: 90000 });
    await g.waitForSelector("[data-sway] > .wg-sw", { timeout: 90000 });
    const r = await g.evaluate(() => [...document.querySelectorAll("[data-sway]")].map((el) => {
      const sw = el.querySelector(":scope > .wg-sw"), box = el.getBoundingClientRect();
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      const tap = el.closest("a,button");
      return { amp: parseFloat(getComputedStyle(sw).getPropertyValue("--sw-amp")), anim: sw.getAnimations().length,
        aria: sw.getAttribute("aria-hidden"), hitOk: !tap || box.width === 0 || !!(hit && (tap.contains(hit))), pe: getComputedStyle(sw).pointerEvents };
    }));
    assert.ok(r.length >= 5, "sway targets");
    for (const x of r) {
      assert.equal(x.aria, "true"); assert.equal(x.pe, "none"); assert.ok(x.hitOk, "tap lands on the static parent");
      assert.ok(x.anim >= 1, "swinging");
      if (rm) assert.ok(x.amp <= 0.25, "reduced motion near-still"); else assert.ok(x.amp <= 3, "amp cap");
    }
    console.log("ok", w, rm ? "reduced" : "motion", r.length);
    await g.close();
  }
} finally { await b.close(); }
