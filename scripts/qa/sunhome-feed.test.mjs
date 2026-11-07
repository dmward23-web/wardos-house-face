/* Isolated synthetic must feed. No private feed, no hub, no secrets.
   Consecutive completions, undo, a failed write, and a refresh that keeps the stored check. */
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const chrome = process.env.CHROME_PATH || "/usr/local/bin/google-chrome";
const skip = process.env.QA_NO_BROWSER === "1" || !fs.existsSync(chrome);

function serve() {
  return new Promise((resolve) => {
    const s = http.createServer((req, res) => {
      const rel = decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/^\/+/, "");
      const file = path.join(ROOT, rel);
      if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
      res.writeHead(200); res.end(fs.readFileSync(file));
    });
    s.listen(0, "127.0.0.1", () => resolve(s));
  });
}

test("synthetic must feed: two completions, an undo, a failed write, and a refresh", { skip }, async () => {
  const pp = createRequire(import.meta.url)("puppeteer-core");
  const s = await serve();
  const port = s.address().port;
  const browser = await pp.launch({ executablePath: chrome, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const page = await browser.newPage();
  await page.goto("http://127.0.0.1:" + port + "/scripts/qa/fixtures/synthetic-must.html", { waitUntil: "domcontentloaded" });
  const label = await page.$eval("[data-fixture-label]", (el) => el.textContent);
  assert.match(label, /SYNTHETIC FEED/);
  await page.click("[data-check=hay-bed]");
  await new Promise((r) => setTimeout(r, 900));
  await page.click("[data-check=hay-room]");
  await new Promise((r) => setTimeout(r, 200));
  let done = await page.evaluate(() => window.__done.slice());
  assert.deepEqual(done, ["hay-bed", "hay-room"]);
  await page.click("[data-check=hay-bed]");
  await new Promise((r) => setTimeout(r, 200));
  done = await page.evaluate(() => window.__done.slice());
  assert.deepEqual(done, ["hay-bed", "hay-room"], "undo does not celebrate");
  assert.equal(await page.evaluate(() => localStorage.getItem("syn-hay-bed")), "0");
  await page.evaluate(() => { window.__fail = true; });
  await new Promise((r) => setTimeout(r, 900));
  await page.click("[data-check=hay-room]");
  await new Promise((r) => setTimeout(r, 200));
  done = await page.evaluate(() => window.__done.slice());
  assert.deepEqual(done, ["hay-bed", "hay-room"], "a failed write does not celebrate");
  assert.equal(await page.evaluate(() => localStorage.getItem("syn-hay-room")), "1");
  await page.reload({ waitUntil: "domcontentloaded" });
  assert.equal(await page.evaluate(() => localStorage.getItem("syn-hay-room")), "1", "refresh keeps the stored check");
  assert.deepEqual(await page.evaluate(() => window.__done), []);
  await browser.close();
  s.close();
});
