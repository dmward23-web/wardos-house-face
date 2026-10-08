#!/usr/bin/env node
/**
 * GATE 3 — overlap, clip, and ellipsis.
 * Phone: 440×956 CSS pixels, deviceScaleFactor 3 (Dan's iPhone).
 * Wall: 1080×1920.
 * Any hit fails the build. house-face-qa.yml is a different workflow and stays as it is.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

function loadPuppeteer() {
  const roots = [];
  if (process.env.NODE_PATH) roots.push(...process.env.NODE_PATH.split(":"));
  roots.push("/tmp/ori-qa/node_modules", path.join(path.dirname(fileURLToPath(import.meta.url)), "../../node_modules"));
  for (const root of roots) {
    const pkg = path.join(root, "puppeteer-core/package.json");
    if (!fs.existsSync(pkg)) continue;
    return createRequire(pkg)("puppeteer-core");
  }
  throw new Error("puppeteer-core is not installed");
}
const puppeteer = loadPuppeteer();

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PAGES = ["sheet-index.html", "month.html", "sheet-lights.html"];
const PORT = Number(process.env.ORI_QA_PORT || 8773);

function chromePath() {
  const candidates = [
    process.env.CHROME_PATH,
    "/usr/local/bin/google-chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium"
  ].filter(Boolean);
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  throw new Error("Chrome not found. Set CHROME_PATH.");
}

function startServer() {
  const types = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".webp": "image/webp",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf"
  };
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    let rel = decodeURIComponent(url.pathname);
    if (rel.endsWith("/")) rel += "index.html";
    const file = path.join(ROOT, path.normalize(rel).replace(/^(\.\.(\/|\\|$))+/, ""));
    if (!file.startsWith(ROOT)) {
      res.writeHead(403);
      res.end();
      return;
    }
    fs.readFile(file, (err, buf) => {
      if (err) {
        res.writeHead(404);
        res.end("missing");
        return;
      }
      res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" });
      res.end(buf);
    });
  });
  return new Promise((resolve) => server.listen(PORT, "127.0.0.1", () => resolve(server)));
}

const SCAN = `(() => {
  const hits = [];
  function shown(el) {
    if (!el || el.closest("[hidden]")) return false;
    const s = getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden" || Number(s.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width >= 1 && r.height >= 1;
  }
  function ownText(el) {
    let t = "";
    for (const n of el.childNodes) if (n.nodeType === 3) t += n.nodeValue || "";
    return t.replace(/\\s+/g, " ").trim();
  }
  function inView(el) {
    const r = el.getBoundingClientRect();
    return r.bottom > 0 && r.top < innerHeight;
  }
  function plateOpaque(el) {
    let n = el;
    while (n && n !== document.documentElement) {
      const bg = getComputedStyle(n).backgroundColor || "";
      const m = bg.match(/rgba?\\(([^)]+)\\)/);
      if (m) {
        const p = m[1].split(",").map((s) => parseFloat(s));
        const a = p.length >= 4 ? p[3] : 1;
        if (a >= 0.82) return true;
      }
      n = n.parentElement;
    }
    return false;
  }
  function scanHere(tag) {
    const els = document.body.querySelectorAll("*");
    for (const el of els) {
      if (!shown(el)) continue;
      const text = ownText(el);
      if (text && inView(el) && (/\\u2026/.test(text) || /\\.{3}/.test(text))) {
        hits.push(tag + " ellipsis text <" + el.tagName.toLowerCase() + "." + (el.className && el.className.baseVal === undefined ? String(el.className).slice(0, 40) : "") + "> " + text.slice(0, 80));
      }
      if (text && inView(el)) {
        const s = getComputedStyle(el);
        const clamped = s.webkitLineClamp && s.webkitLineClamp !== "none";
        const ell = s.textOverflow === "ellipsis" || clamped;
        if (ell && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)) {
          hits.push(tag + " truncated <" + (el.className && String(el.className).slice(0, 40)) + "> " + text.slice(0, 60));
        }
        const rects = el.getClientRects();
        for (const box of rects) {
          if (box.width < 1 || box.height < 1) continue;
          if (box.bottom < 0 || box.top > innerHeight) continue;
          if (box.left < -1 || box.right > innerWidth + 1) {
            hits.push(tag + " clipped x=" + Math.round(box.left) + ".." + Math.round(box.right) + " vw=" + innerWidth + " <" + String(el.className).slice(0, 40) + "> " + text.slice(0, 60));
            break;
          }
        }
      }
      if (text && inView(el)) {
        let n = el.parentElement;
        while (n && n !== document.body) {
          const s = getComputedStyle(n);
          const oy = s.overflowY === "hidden" || s.overflow === "hidden";
          const ox = s.overflowX === "hidden" || s.overflow === "hidden";
          if ((ox || oy) && n.scrollHeight > n.clientHeight + 4) {
            const er = el.getBoundingClientRect();
            const nr = n.getBoundingClientRect();
            if (er.bottom > nr.bottom + 3 && er.top < nr.bottom) {
              hits.push(tag + " cut off inside <" + String(n.className).slice(0, 40) + "> " + text.slice(0, 60));
              break;
            }
          }
          n = n.parentElement;
        }
      }
    }
    document.querySelectorAll(".day .blk, .ori-ev, .ori-dom").forEach((el) => {
      if (!shown(el)) return;
      const cell = el.closest(".day, .ori-day");
      if (!cell) return;
      const a = el.getBoundingClientRect();
      const b = cell.getBoundingClientRect();
      if (a.right > b.right + 2 || a.left < b.left - 2 || a.bottom > b.bottom + 2) {
        hits.push(tag + " cell overflow <" + String(el.className).slice(0, 24) + "> " + ownText(el).slice(0, 60));
      }
    });
    const pills = [...document.querySelectorAll(".cmd-pill, .light-pad-src, .hub-lights-pill, .sp-pill, .light-pad-state, .hub-sw-stub-pill")].filter(shown);
    const controls = [...document.querySelectorAll(".cmd-rocker, .light-bright, input[type=range]")].filter(shown);
    for (const p of pills) {
      const a = p.getBoundingClientRect();
      for (const c of controls) {
        if (p.contains(c) || c.contains(p)) continue;
        const b = c.getBoundingClientRect();
        const ix = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const iy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (ix > 4 && iy > 4) {
          hits.push(tag + " pill over control " + (ownText(p) || p.className).toString().slice(0, 40));
        }
      }
    }
    const blob = document.body.innerText || "";
    if (/calendar through|empty = unknown|TABLET TEST/i.test(blob)) hits.push(tag + " debug copy still on screen");
  }
  const ys = [0];
  const max = Math.max(0, document.documentElement.scrollHeight - innerHeight);
  if (max > 80) ys.push(Math.round(max * 0.5), max);
  for (const y of ys) {
    scrollTo(0, y);
    scanHere("y" + y);
  }
  scrollTo(0, 0);
  if (document.documentElement.classList.contains("ori-phone") && document.getElementById("hub-cam-deck")) {
    const marks = [];
    ["header.hdr", "#hub-cam-deck", ".leaveby", "#hub-lights-panel", "#hub-spotify-strip", ".who-up"].forEach((sel) => {
      const el = document.querySelector(sel);
      if (!el || !shown(el)) return;
      const r = el.getBoundingClientRect();
      marks.push({ name: sel, t: r.top + scrollY, b: r.bottom + scrollY, l: r.left, r: r.right });
    });
    document.querySelectorAll(".tile-grid > .tile").forEach((el, i) => {
      if (!shown(el)) return;
      const r = el.getBoundingClientRect();
      marks.push({ name: "tile" + i, t: r.top + scrollY, b: r.bottom + scrollY, l: r.left, r: r.right });
    });
    for (let i = 0; i < marks.length; i++) {
      for (let j = i + 1; j < marks.length; j++) {
        const a = marks[i], c = marks[j];
        const ox = Math.min(a.r, c.r) - Math.max(a.l, c.l);
        const oy = Math.min(a.b, c.b) - Math.max(a.t, c.t);
        if (ox > 8 && oy > 8) hits.push("overlap " + a.name + " x " + c.name);
      }
    }
    const canvas = document.querySelector("canvas.ori-path");
    if (canvas) {
      const ctx = canvas.getContext("2d");
      const pr = canvas.getBoundingClientRect();
      document.querySelectorAll(".tile-label, .hub-cam-label, .leaveby-dest, .leaveby .time, .hub-lights-title, .sp-brand, .who-up-name").forEach((el) => {
        if (!shown(el) || plateOpaque(el)) return;
        const r = el.getBoundingClientRect();
        const x = Math.round(r.left + r.width / 2 - pr.left);
        const y = Math.round(r.top + r.height / 2 - pr.top);
        if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return;
        let px;
        try { px = ctx.getImageData(x, y, 1, 1).data; } catch (e) { return; }
        if (px[3] > 12) hits.push("path through " + (ownText(el) || el.className).toString().slice(0, 40));
      });
    }
  }
  return [...new Set(hits)];
})()`;

async function prepare(page, file) {
  if (file.startsWith("sheet-index")) {
    await page.waitForFunction(() => {
      const t = document.querySelector("[data-live='leaveby-main'] .time, [data-live='leaveby-main'] .leaveby-dest");
      return t && (t.textContent || "").trim().length > 1;
    }, { timeout: 20000 }).catch(() => {});
  }
  if (file.startsWith("month")) {
    await page.waitForFunction(() => {
      const b = document.querySelector("[data-month-banner]");
      return b && (b.textContent || "").indexOf("Loading") < 0;
    }, { timeout: 20000 });
  }
  if (file.startsWith("sheet-lights")) {
    await page.waitForFunction(() => document.querySelector(".light-pad"), { timeout: 20000 });
  }
  await new Promise((r) => setTimeout(r, 400));
}

async function main() {
  const server = await startServer();
  const browser = await puppeteer.launch({
    executablePath: chromePath(),
    headless: "new",
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--hide-scrollbars"]
  });
  const failures = [];
  const views = [
    {
      name: "phone",
      width: 440,
      height: 956,
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      phone: true
    },
    {
      name: "wall",
      width: 1080,
      height: 1920,
      deviceScaleFactor: 1,
      isMobile: false,
      hasTouch: false,
      phone: false
    }
  ];
  try {
    for (const view of views) {
      const page = await browser.newPage();
      await page.setViewport(view);
      if (view.phone) {
        await page.evaluateOnNewDocument(() => {
          function arm() {
            var h = document.documentElement;
            if (h && h.classList) h.classList.add("ori-phone");
            var v = document.querySelector('meta[name="viewport"]');
            if (v && v.getAttribute("content") !== "width=device-width, initial-scale=1, viewport-fit=cover") {
              v.setAttribute("content", "width=device-width, initial-scale=1, viewport-fit=cover");
            }
          }
          arm();
          var mo = new MutationObserver(arm);
          mo.observe(document, { childList: true, subtree: true });
          document.addEventListener("DOMContentLoaded", function () { arm(); mo.disconnect(); });
        });
      }
      if (!view.phone) {
        await page.evaluateOnNewDocument(() => {
          var wall = { width: 1080, height: 1920, availWidth: 1080, availHeight: 1920, colorDepth: 24, pixelDepth: 24 };
          try { Object.defineProperty(window, "screen", { configurable: true, get: function () { return wall; } }); } catch (e) {}
        });
      }
      page.on("pageerror", (e) => console.log("PAGE", view.name, e.message));
      for (const file of PAGES) {
        const url = "http://127.0.0.1:" + PORT + "/" + file;
        console.log("check", view.name, file);
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });
        await prepare(page, file);
        const hits = await page.evaluate((src) => (0, eval)(src), SCAN);
        if (hits.length) {
          for (const h of hits) failures.push(view.name + " " + file + " :: " + h);
        } else {
          console.log("  clean", view.name, file);
        }
      }
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  if (failures.length) {
    console.error("GATE 3 FAIL " + failures.length);
    for (const f of failures) console.error(" - " + f);
    process.exit(1);
  }
  console.log("GATE 3 PASS");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
