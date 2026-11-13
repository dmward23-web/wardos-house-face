/* Round 40b. The kid world stays centered and inside a short browser window. */
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const browser = spawnSync("python3", ["-c", "import playwright.sync_api"], { encoding: "utf8" }).status === 0 && process.env.QA_NO_BROWSER !== "1";
const SKIP = browser ? {} : { skip: "SKIP no playwright (QA_NO_BROWSER)" };

const PY = String.raw`
import json, threading
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from playwright.sync_api import sync_playwright
import sys
sys.path.insert(0, "scripts/qa")
from pw_chrome import launch_kw
root = Path(".").resolve()
class Q(SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
httpd = ThreadingHTTPServer(("127.0.0.1", 0), lambda *a, **k: Q(*a, directory=str(root), **k))
threading.Thread(target=httpd.serve_forever, daemon=True).start()
base = "http://127.0.0.1:%d/" % httpd.server_address[1]
views = [(1920,1080,1),(1920,1040,1),(1920,1000,1),(1920,969,1),(1920,960,1),(1536,864,1.25),(1536,816,1.25),(1536,730,1.25)]
kids = ["kid-ainsley.html","kid-hayes.html","kid-harris.html"]
JS = """() => {
  const nodes = [...document.querySelectorAll('.kw-canvas,.panel,.kw-hud')].filter(el => {
    const r = el.getBoundingClientRect();
    return r.width > 8 && r.height > 8;
  });
  let L=1e9,T=1e9,R=-1e9,B=-1e9;
  for (const el of nodes) {
    const r = el.getBoundingClientRect();
    L=Math.min(L,r.left); T=Math.min(T,r.top); R=Math.max(R,r.right); B=Math.max(B,r.bottom);
  }
  return {
    dx: (L+R)/2 - innerWidth/2,
    dy: (T+B)/2 - innerHeight/2,
    clip: Math.max(0, -L, R-innerWidth, -T, B-innerHeight)
  };
}"""
bad = []
with sync_playwright() as p:
    browser = p.chromium.launch(**launch_kw(p, headless=True))
    for w,h,dpr in views:
        ctx = browser.new_context(viewport={"width":w,"height":h}, device_scale_factor=dpr)
        page = ctx.new_page()
        for kid in kids:
            page.goto(base+kid+"?clock=2026-11-10T12:30:00-06:00", wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(700)
            m = page.evaluate(JS)
            if abs(m["dx"]) > 2 or abs(m["dy"]) > 2 or m["clip"] > 1:
                bad.append("%s %s dx=%.1f dy=%.1f clip=%.1f" % (kid, "%dx%d"%(w,h), m["dx"], m["dy"], m["clip"]))
        ctx.close()
    browser.close()
httpd.shutdown()
print(json.dumps({"bad": bad}))
`
test("r40b kid boards stay centered and inside every window", SKIP, () => {
  const r = spawnSync("python3", ["-c", PY], { cwd: ROOT, encoding: "utf8", timeout: 180000 });
  assert.equal(r.status, 0, (r.stderr || "").slice(-500));
  const o = JSON.parse(r.stdout.trim().split("\n").pop());
  assert.deepEqual(o.bad, [], o.bad.join("\n"));
});
