/* Public musts: each kid board shows the same rows as sheet-chores, and a tap checks the same data-check id. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const rd = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

function choresMusts(html) {
  const out = {};
  for (const kid of ["Ainsley", "Hayes", "Harris"]) {
    const start = html.indexOf('aria-label="' + kid + ' chores"');
    const next = html.indexOf('<section class="col"', start + 10);
    const chunk = html.slice(start, next > start ? next : undefined);
    const rows = [];
    const re = /data-check="([^"]+)"[\s\S]*?<div class="what">([^<]*)<\/div>\s*<div class="hint">([^<]*)<\/div>/g;
    let m;
    while ((m = re.exec(chunk))) rows.push({ id: m[1], what: m[2], hint: m[3] });
    out[kid.toLowerCase()] = rows;
  }
  return out;
}

function catalogMusts(src) {
  const block = src.slice(src.indexOf("var PUBLIC_MUSTS"), src.indexOf("function escMust"));
  const out = {};
  for (const kid of ["ainsley", "hayes", "harris"]) {
    const from = block.indexOf(kid + ": [");
    const body = block.slice(from, block.indexOf("\n    ]", from));
    const rows = [];
    const re = /\["([^"]+)", "([^"]+)", "([^"]+)"/g;
    let m;
    while ((m = re.exec(body))) rows.push({ id: m[1], what: m[2], hint: m[3] });
    out[kid] = rows;
  }
  return out;
}

test("each chore icon path is distinct", () => {
  const src = rd("kid-world.js");
  const fn = src.slice(src.indexOf("function choreIcon"), src.indexOf("function plainLabel"));
  const bodies = [...fn.matchAll(/body = '([^']+)'/g)].map((m) => m[1]);
  assert.ok(bodies.length >= 8, "icon branches");
  assert.equal(new Set(bodies).size, bodies.length, "two chores share an icon path");
});

test("kid-board public musts match the chores board per kid", () => {
  const chores = choresMusts(rd("sheet-chores.html"));
  const board = catalogMusts(rd("kid-world.js"));
  for (const kid of ["ainsley", "hayes", "harris"]) {
    assert.ok(chores[kid].length >= 9, kid + " chores " + chores[kid].length);
    assert.deepEqual(board[kid], chores[kid], kid);
  }
});

const NO_BROWSER = process.env.QA_NO_BROWSER === "1";
let pp = null;
if (!NO_BROWSER) {
  for (const base of [import.meta.url, (process.env.WARDOS_DEPS || "/nonexistent") + "/", "/tmp/h1-deps/node_modules/"]) {
    try { pp = createRequire(base)("puppeteer-core"); break; } catch (_) {}
  }
}
const CHROME = ["/usr/local/bin/google-chrome", "/usr/bin/google-chrome"].find((p) => fs.existsSync(p));
const SKIP = NO_BROWSER || !(pp && CHROME);

test("kid board renders the chores musts and a tap checks that same id", { skip: SKIP ? "SKIP no browser" : false, timeout: 90000 }, async () => {
  const chores = choresMusts(rd("sheet-chores.html"));
  const srv = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/^\/+/, "") || "index.html";
    const file = path.join(ROOT, path.normalize(rel).replace(/^(\.\.(\/|\\|$))+/, ""));
    fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200); res.end(buf);
    });
  });
  await new Promise((ok) => srv.listen(0, "127.0.0.1", ok));
  const base = "http://127.0.0.1:" + srv.address().port;
  const b = await pp.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
  try {
    const g = await b.newPage();
    await g.setViewport({ width: 1920, height: 1080 });
    for (const kid of ["ainsley", "hayes", "harris"]) {
      await g.goto(base + "/kid-" + kid + ".html", { waitUntil: "load", timeout: 30000 });
      await g.waitForFunction((id) => document.querySelectorAll("#sec-musts [data-check]").length >= 9, {}, { timeout: 8000 }).catch(() => {});
      const got = await g.evaluate(() => [...document.querySelectorAll("#sec-musts [data-check]")].map((el) => ({
        id: el.getAttribute("data-check"),
        what: (el.querySelector(".what") || {}).textContent || "",
        hint: (el.querySelector(".hint") || {}).textContent || ""
      })));
      /* Prism C2: the kid board shows the short label and no subline. The ids stay the chores sheet's ids. */
      assert.deepEqual(got.map((r) => r.id), chores[kid].map((r) => r.id), kid + " board");
      const empty = await g.evaluate(() => document.body.innerText.includes("Nothing on the list yet."));
      assert.equal(empty, false, kid + " still says the list is empty");
    }
    await g.goto(base + "/kid-ainsley.html", { waitUntil: "load", timeout: 30000 });
    await g.waitForSelector("#sec-musts [data-check='ain-bed'][data-wired='1']");
    await g.evaluate(() => document.querySelector("#sec-musts [data-check='ain-bed']").click());
    const kidDone = await g.$eval("#sec-musts [data-check='ain-bed']", (el) => el.classList.contains("done"));
    assert.equal(kidDone, true, "kid tap checks ain-bed");
    await g.evaluate(() => localStorage.clear());
    await g.goto(base + "/sheet-chores.html", { waitUntil: "load", timeout: 30000 });
    await g.waitForSelector(".chore[data-check='ain-bed'][data-wired='1']");
    await g.evaluate(() => document.querySelector(".chore[data-check='ain-bed']").click());
    const choreDone = await g.evaluate(() => [...document.querySelectorAll("[data-check='ain-bed']")].some((el) => el.classList.contains("done")));
    assert.equal(choreDone, true, "chores tap checks the same ain-bed id");
  } finally {
    await b.close();
    srv.close();
  }
});
