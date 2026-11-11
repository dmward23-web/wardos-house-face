#!/usr/bin/env python3
"""1920x1080@1 boxes for the four round-31 defects. Prints one JSON object."""
import json, threading, sys
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pw_chrome import launch_kw
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
DAY = "2026-11-10T12:30:00-06:00"
NIGHT = "2026-11-10T21:00:00-06:00"


def serve():
    class Q(SimpleHTTPRequestHandler):
        def log_message(self, *a):
            pass
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), lambda *a, **k: Q(*a, directory=str(ROOT), **k))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, "http://127.0.0.1:%d/" % httpd.server_address[1]


def box(page, sel):
    return page.evaluate("""(sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return {x: b.x, y: b.y, w: b.width, h: b.height, r: b.right, b: b.bottom};
    }""", sel)


def text_box(page, sel):
    return page.evaluate("""(sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const range = document.createRange();
      range.selectNodeContents(el);
      const b = range.getBoundingClientRect();
      return {x: b.x, y: b.y, w: b.width, h: b.height, r: b.right, b: b.bottom, t: el.textContent};
    }""", sel)


def clock(page):
    return page.evaluate("""() => {
      const clock = document.querySelector('[data-live-clock]');
      const host = document.querySelector('.live-clock-host');
      const rb = (el) => {
        if (!el) return null;
        const b = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return {x: b.x, y: b.y, w: b.width, h: b.height, r: b.right, b: b.bottom,
          bg: cs.backgroundColor, bw: cs.borderTopWidth, shadow: cs.boxShadow};
      };
      const range = document.createRange();
      range.selectNodeContents(clock);
      const t = range.getBoundingClientRect();
      const lines = [];
      for (const el of document.querySelectorAll('header.hdr, header.hdr *')) {
        const b = el.getBoundingClientRect();
        if (b.height >= 1 && b.height <= 4 && b.width > 80 && b.top < 160) lines.push({w: b.width, h: b.height, x: b.x, y: b.y});
      }
      return {clock: rb(clock), host: rb(host), text: {x: t.x, y: t.y, w: t.width, h: t.height, r: t.right, b: t.bottom}, lines};
    }""")


def main():
    httpd, base = serve()
    out = {}
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(**launch_kw(p, args=["--no-sandbox", "--disable-dev-shm-usage"]))
            ctx = browser.new_context(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
            page = ctx.new_page()
            page.goto(base + "kid-hayes.html?now=%s&freeze=1" % DAY, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(1000)
            page.evaluate("""() => { var b = document.querySelector('.prism-jar-plus, .saves-plus, [data-saves-plus]'); if (b) b.click(); }""")
            page.wait_for_timeout(300)
            out["d1"] = page.evaluate("""() => {
              const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return {x:b.x,y:b.y,w:b.width,h:b.height,r:b.right,b:b.bottom}; };
              const home = document.querySelector('.saves-home');
              const img = home && home.querySelector('img');
              let text = null;
              if (home) {
                const range = document.createRange();
                range.selectNodeContents(home);
                const b = range.getBoundingClientRect();
                text = {x:b.x,y:b.y,w:b.width,h:b.height,t:(home.textContent||'').trim()};
              }
              const name = r(document.querySelector('.saves-add-name'));
              const need = r(document.querySelector('.saves-add-need'));
              const save = r(document.querySelector('.saves-add-save'));
              return {home: r(home), img: r(img), text, name, need, save};
            }""")
            clocks = {}
            for label, now in (("day", DAY), ("night", NIGHT)):
                for route in ("sheet-today.html", "month.html"):
                    page.goto(base + route + "?now=%s&freeze=1" % now, wait_until="domcontentloaded", timeout=30000)
                    page.wait_for_timeout(900)
                    clocks["%s-%s" % (route.replace(".html", ""), label)] = clock(page)
            out["d2"] = clocks
            page.goto(base + "sheet-today.html?now=%s&freeze=1" % DAY, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(900)
            out["d3"] = page.evaluate("""() => {
              const r = (el) => { const b = el.getBoundingClientRect(); return {x:b.x,y:b.y,w:b.width,h:b.height}; };
              const boxes = [...document.querySelectorAll('.where-card, section.today-day, .qtile, .kid-card, nav.tap-rail a')].filter(el => {
                const b = el.getBoundingClientRect();
                return b.width > 8 && b.height > 8;
              }).map(el => ({c: (el.className||'').toString().slice(0,48), ...r(el)}));
              const pills = [...document.querySelectorAll('.qtile-tap, .kid-tap')].map(el => {
                const b = el.getBoundingClientRect();
                const row = el.closest('a, button');
                const rb = row ? row.getBoundingClientRect() : null;
                const inside = rb && b.left >= rb.left - 1 && b.right <= rb.right + 1 && b.top >= rb.top - 1 && b.bottom <= rb.bottom + 1;
                return {t: (el.textContent||'').trim(), h: b.height, rowH: rb ? rb.height : 0, own: el.matches('a, button'), inside};
              });
              return {boxes, pills};
            }""")
            page.goto(base + "sheet-chores.html?now=%s&freeze=1" % DAY, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(1400)
            def icons():
                return page.evaluate("""() => {
                  const r = (el) => { const b = el.getBoundingClientRect(); return {x:b.x,y:b.y,r:b.right,b:b.bottom,w:b.width,h:b.height}; };
                  return [...document.querySelectorAll('section.col .chore')].filter(el => el.getBoundingClientRect().height > 8).slice(0, 6).map(card => {
                    const ico = card.querySelector('.chore-ico');
                    const svg = card.querySelector('.chore-ico svg');
                    const icon = svg || ico;
                    return {card: r(card), icon: icon && r(icon)};
                  });
                }""")
            folded = icons()
            page.evaluate("""() => {
              document.querySelectorAll('section.col').forEach(function (col) { col.setAttribute('data-show-all', '1'); });
              if (window.fitChoreColumns) window.fitChoreColumns();
            }""")
            page.wait_for_timeout(300)
            out["d4"] = {"folded": folded, "more": icons()}
            browser.close()
    finally:
        httpd.shutdown()
    print(json.dumps(out))


if __name__ == "__main__":
    main()
