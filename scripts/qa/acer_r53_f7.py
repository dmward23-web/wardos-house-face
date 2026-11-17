"""Sixty fresh loads of each stage sheet. Prism face must really load, with nothing blocked."""
import asyncio
import json
import os
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pw_chrome import launch_kw
from playwright.async_api import async_playwright

ROOT = Path(os.environ.get("WARDOS_ROOT") or Path(__file__).resolve().parents[2])
SHEETS = [
    "sheet-google-home.html", "month.html", "sheet-allowance.html", "sheet-win.html",
    "sheet-groceries.html", "sheet-index.html", "sheet-lights.html", "sheet-chores.html",
    "sheet-today.html", "nest-webrtc.html", "sheet-spotify.html", "sheet-weekend.html",
]
ASSETS = ("prism-face.css", "prism-face.js", "home-key-light")
PROBE = """() => {
  const nav = performance.getEntriesByType("navigation")[0];
  const dcl = nav && nav.domContentLoadedEventStart;
  if (!dcl) return false;
  const link = document.getElementById("prism-face-css");
  const js = document.getElementById("prism-face-js");
  const img = document.querySelector("img[src*='home-key-light'], img[srcset*='home-key-light']");
  const imgOk = !!(img && (img.getAttribute("src") || img.currentSrc || img.getAttribute("srcset")));
  let cssOk = false;
  try { cssOk = !!(link && link.sheet && link.sheet.cssRules && link.sheet.cssRules.length > 0); } catch (e) { cssOk = false; }
  const entries = performance.getEntriesByType("resource");
  const ready = (bit) => entries.some((e) => e.name.indexOf(bit) >= 0 && e.startTime < dcl && e.responseEnd > 0 && ((e.decodedBodySize || 0) > 0 || (e.transferSize || 0) > 0));
  return cssOk && !!js && imgOk && ready("prism-face.css") && ready("prism-face.js") && ready("home-key-light");
}"""

class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass
    def do_GET(self):
        rel = self.path.split("?", 1)[0].lstrip("/") or "index.html"
        file = (ROOT / rel).resolve()
        if not str(file).startswith(str(ROOT)) or not file.is_file():
            self.send_error(404)
            return
        data = file.read_bytes()
        kind = "text/html" if file.suffix == ".html" else "application/octet-stream"
        if file.suffix == ".js":
            kind = "text/javascript"
        if file.suffix == ".css":
            kind = "text/css"
        if file.suffix == ".svg":
            kind = "image/svg+xml"
        if file.suffix == ".png":
            kind = "image/png"
        self.send_response(200)
        self.send_header("Content-Type", kind)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        try:
            self.wfile.write(data)
        except BrokenPipeError:
            return

httpd = ThreadingHTTPServer(("127.0.0.1", 0), H)
threading.Thread(target=httpd.serve_forever, daemon=True).start()
base = "http://127.0.0.1:%d/" % httpd.server_address[1]

async def once(browser, url):
    ctx = await browser.new_context(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
    page = await ctx.new_page()
    failed = []
    def on_fail(req):
        if any(bit in req.url for bit in ASSETS):
            failed.append(req.url.split("/")[-1])
    page.on("requestfailed", on_fail)
    ok = False
    err = ""
    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=8000)
        ok = bool(await page.evaluate(PROBE))
    except Exception as exc:
        ok = False
        err = type(exc).__name__
    finally:
        try:
            await page.evaluate("() => { try { window.stop(); } catch (e) {} }")
        except Exception:
            pass
        try:
            await asyncio.wait_for(page.close(), 0.4)
        except Exception:
            pass
        try:
            await asyncio.wait_for(ctx.close(), 0.4)
        except Exception:
            pass
    return (ok and not failed), err, failed[:2]

async def one(browser, url):
    ok, err, failed = await once(browser, url)
    if not ok:
        print("miss %s %s %s" % (url.rsplit("/", 1)[-1], err, failed), flush=True)
    return ok

async def run():
    out = {}
    async with async_playwright() as p:
        browser = await p.chromium.launch(**launch_kw(p, headless=True))
        sem = asyncio.Semaphore(4)
        async def job(url):
            async with sem:
                return await one(browser, url)
        try:
            for name in SHEETS:
                tasks = [asyncio.create_task(job(base + name)) for _ in range(60)]
                pending = set(tasks)
                home = missing = done = 0
                while pending:
                    finished, pending = await asyncio.wait(pending, return_when=asyncio.FIRST_COMPLETED)
                    for fut in finished:
                        try:
                            ok = fut.result()
                        except Exception:
                            ok = False
                        done += 1
                        if ok:
                            home += 1
                        else:
                            missing += 1
                        if (not ok) or done % 10 == 0:
                            print("%s %d/60 home %d missing %d" % (name, done, home, missing), flush=True)
                    if missing:
                        for fut in pending:
                            fut.cancel()
                        await asyncio.gather(*pending, return_exceptions=True)
                        pending = set()
                out[name] = {"loads": 60, "missing": missing, "home": home}
                print(name, json.dumps(out[name]), flush=True)
                if missing:
                    break
        finally:
            await browser.close()
    return out

out = asyncio.run(run())
print(json.dumps(out), flush=True)
os._exit(0 if out and all(row["missing"] == 0 and row["home"] == 60 for row in out.values()) and len(out) == len(SHEETS) else 1)
