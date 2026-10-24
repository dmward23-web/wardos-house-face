/* HALLOWEEN1 PFROUTE · the Living House reads every data path through the hub's /api/private route (synthetic fixtures
   only) and never 404s; with the hub offline it shows the awake board. Run: th.sh --deps node livinghouse/tests/lh-private-route.browser.mjs */
import fs from "node:fs"; import os from "node:os"; import path from "node:path"; import http from "node:http";
import { createRequire } from "node:module"; import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const FX = path.join(ROOT, "scripts/qa/fixtures/private");
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "lhroute-")); const PRIV = path.join(TMP, "private");
fs.mkdirSync(PRIV, { recursive: true });
for (const n of ["cal-live", "cal-months", "kids-week"]) fs.copyFileSync(path.join(FX, n + ".synthetic.json"), path.join(PRIV, n + ".json"));
for (const n of ["lights-live", "sensi-live", "nest-live"]) { const f = path.join(FX, n + ".synthetic.json"); fs.writeFileSync(path.join(PRIV, n + ".json"), fs.existsSync(f) ? fs.readFileSync(f) : "{}"); }
fs.writeFileSync(path.join(PRIV, "private-names.tsv"), "partner\tSynthpartner\n", { mode: 0o600 });
process.env.WARDOS_PRIVATE_DIR = PRIV;
const { handlePrivate } = await import("../../scripts/private-feed.mjs");
const TOKEN = "test-token-0123456789abcdef";
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webp": "image/webp", ".png": "image/png", ".svg": "image/svg+xml" };
const server = http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname.startsWith("/api/private")) { if (!handlePrivate(req, res, { tokens: [TOKEN], origins: new Set(["http://127.0.0.1:" + server.address().port]), dir: PRIV })) { res.writeHead(404); res.end(); } return; }
  const f = path.join(ROOT, decodeURIComponent(u.pathname));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = "http://127.0.0.1:" + server.address().port;
const pkg = (process.env.NODE_PATH || "").split(":").map((r) => path.join(r, "puppeteer-core/package.json")).find((p) => fs.existsSync(p));
const puppeteer = createRequire(pkg)("puppeteer-core");
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome", args: ["--no-sandbox"] });
let fails = [];
for (const [name, q, vp] of [["wall", "", { width: 1920, height: 1080 }], ["phone", "", { width: 440, height: 956, deviceScaleFactor: 3, isMobile: true }], ["offline", "&pfOffline=1", { width: 1920, height: 1080 }]]) {
  const page = await browser.newPage(); await page.setViewport(vp);
  const bad = [];
  page.on("response", (r) => { if (r.status() === 404) bad.push(r.url().replace(base, "")); });
  await page.evaluateOnNewDocument((t) => { try { localStorage.setItem("wardos-private-feed-token", t); } catch (e) {} }, TOKEN);
  await page.goto(base + "/livinghouse/index.html?pfBase=" + encodeURIComponent(base) + q, { waitUntil: "domcontentloaded" });
  await new Promise((r) => setTimeout(r, 4000));
  const st = await page.evaluate(() => ({ body: document.body.innerText.length, kids: !!document.querySelector("[data-lh-kid],.lh-board"), w: document.documentElement.scrollWidth, iw: innerWidth }));
  if (bad.length) fails.push(name + " 404: " + bad.join(", "));
  if (st.w > st.iw + 1) fails.push(name + " overflows width " + st.w + ">" + st.iw);
  console.log(name, bad.length ? "404s " + bad.length : "no 404", JSON.stringify(st));
  await page.close();
}
await browser.close(); server.close(); fs.rmSync(TMP, { recursive: true, force: true });
if (fails.length) { console.log("PFROUTE FAIL\n - " + fails.join("\n - ")); process.exit(1); }
console.log("PFROUTE PASS");
