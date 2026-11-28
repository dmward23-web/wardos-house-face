"""r57 · synthetic feed, display script loaded, 1920x1080. Prints one JSON line and saves shots."""
import json
import os
import threading
from PIL import Image
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from zoneinfo import ZoneInfo
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pw_chrome import launch_kw
from playwright.sync_api import sync_playwright

ROOT = Path(os.environ.get("WARDOS_ROOT") or Path(__file__).resolve().parents[2])
OUT = Path(os.environ.get("WARDOS_ARTIFACT_DIR") or "/opt/cursor/artifacts/r57")
CT = ZoneInfo("America/Chicago")
# Frozen Wednesday afternoon so Today still holds the evening rows at any real hour.
now = datetime(2026, 11, 18, 16, 0, tzinfo=CT)
PIN = "now=2026-11-18T16:00:00-06:00&freeze=1"
day = now.strftime("%Y-%m-%d")
start = now.replace(hour=18, minute=0, second=0, microsecond=0).strftime("%Y-%m-%dT%H:%M:%S-06:00")
start2 = now.replace(hour=19, minute=0, second=0, microsecond=0).strftime("%Y-%m-%dT%H:%M:%S-06:00")


def ev(summary, title=None, what=None, when="Tue · 6:00", iso=None, **extra):
    row = {
        "summary": summary,
        "title": summary if title is None else title,
        "what": summary if what is None else what,
        "when": when,
        "startIso": iso or start,
        "start": iso or start,
        "location": "gym",
    }
    row.update(extra)
    return row


HAYES = [
    ev("Skate City Night"),
    ev("costume parade", "Hayes costume parade", "Hayes costume parade", iso=start2),
    ev("Friends Club"),
    ev("basketball"),
    ev("Hayes dentist", "Hayes dentist", "Hayes dentist"),
]
AINSLEY = [
    ev("Picture day"),
    ev("partner dinner"),
    ev("Soccer"),
    ev("Art club"),
    ev("Lantern walk", "Other title", "Third title"),
]
HARRIS = [
    ev("Art club"),
    ev("Harris doctor", "Harris doctor", "Harris doctor"),
    ev("mediation legal", "mediation legal", "mediation legal"),
    ev("H4 yes checkup", "H4 yes checkup", "H4 yes checkup"),
    ev("Raffle", "Raffle", "Raffle", organizer={"displayName": "therapy-token"}),
]
WEEK = {
    "asOfIso": day,
    "kids": {
        "hayes": {"id": "hayes", "name": "Hayes", "today": HAYES, "school": [], "sports": [], "quests": []},
        "ainsley": {"id": "ainsley", "name": "Ainsley", "today": AINSLEY, "school": [], "sports": [], "quests": []},
        "harris": {"id": "harris", "name": "Harris", "today": HARRIS, "school": [], "sports": [], "quests": []},
    },
}
EMPTY = {
    "asOfIso": day,
    "kids": {
        "harris": {
            "id": "harris",
            "name": "Harris",
            "today": [],
            "school": [],
            "sports": [],
            "quests": [],
            "hottest": {
                "what": "NOTHING NEXT ON THE CALENDAR",
                "summary": "NOTHING NEXT ON THE CALENDAR",
                "title": "NOTHING NEXT ON THE CALENDAR",
                "label": "NOTHING NEXT ON THE CALENDAR",
                "text": "NOTHING NEXT ON THE CALENDAR",
                "l": "NOTHING NEXT ON THE CALENDAR",
            },
        }
    },
}
CAL = {
    "status": "live",
    "fetchedAt": datetime.now(CT).isoformat(),
    "asOfIso": day,
    "upcomingLeaves": [dict(r, start=r["startIso"]) for r in HAYES + AINSLEY + HARRIS],
    "boardStrip": {"queue": [dict(summary=r["summary"], what=r["what"], title=r["title"], start=r["startIso"]) for r in HAYES + AINSLEY if "dentist" not in r["summary"].lower()]},
}


class H(BaseHTTPRequestHandler):
    empty = False

    def log_message(self, *a):
        pass

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path.endswith(".html"):
            H.empty = "empty=1" in self.path
        empty = H.empty or "empty=1" in self.path
        body = None
        if path.endswith("/kids-week.json"):
            body = json.dumps(EMPTY if empty else WEEK).encode()
        elif path.endswith("/cal-live.json"):
            body = json.dumps(CAL).encode()
        elif path.endswith("/private-names.json"):
            body = b"{}"
        if body is not None:
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        rel = path.lstrip("/") or "index.html"
        file = (ROOT / rel).resolve()
        if not str(file).startswith(str(ROOT.resolve())) or not file.is_file():
            self.send_error(404)
            return
        data = file.read_bytes()
        kind = {
            ".html": "text/html",
            ".js": "text/javascript",
            ".css": "text/css",
            ".svg": "image/svg+xml",
            ".png": "image/png",
            ".webp": "image/webp",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
        }.get(file.suffix, "application/octet-stream")
        self.send_response(200)
        self.send_header("Content-Type", kind)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


def text_of(page):
    return page.evaluate("() => document.body ? document.body.innerText : ''")


def hero_of(page):
    return page.evaluate("""() => {
      const el = document.querySelector('.consume-hero-name, .consume-hero-title');
      return el ? el.innerText.replace(/\\s+/g, ' ').trim() : '';
    }""")


def main():
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), H)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    base = "http://127.0.0.1:%d" % httpd.server_address[1]
    OUT.mkdir(parents=True, exist_ok=True)
    shots = {
        "sheet-index.html": "hub-1920.png",
        "sheet-today.html": "today-1920.png",
        "sheet-weekend.html": "sheet-weekend-1920.png",
        "kid-hayes.html": "kid-hayes-1920.png",
        "kid-harris.html": "kid-harris-1920.png",
        "kid-ainsley.html": "kid-ainsley-1920.png",
    }
    out = {}
    with sync_playwright() as p:
        browser = p.chromium.launch(**launch_kw(p, headless=True))
        ctx = browser.new_context(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
        ctx.add_init_script("try { localStorage.setItem('wardos-private-feed-token', 'qaSyntheticDeviceKey0000'); } catch (e) {}")
        page = ctx.new_page()

        def open_page(path):
            page.goto(base + path + ("&" if "?" in path else "?") + "pfBase=" + base + "&" + PIN, wait_until="load", timeout=60000)
            page.wait_for_timeout(1200)
            page.evaluate("() => { if (window.HouseBoardStrip && window.HouseBoardStrip.boot) window.HouseBoardStrip.boot(); }")
            page.wait_for_timeout(800)

        open_page("/sheet-index.html")
        page.screenshot(path=str(OUT / shots["sheet-index.html"]))
        out["strip"] = page.evaluate("""() => {
          const el = document.querySelector("[data-live='leaveby-layouts']") || document.querySelector('.leaveby');
          if (!el) return '';
          const show = getComputedStyle(el).display + ' ' + getComputedStyle(el).visibility;
          return show + ' ' + (el.textContent || '').replace(/\\s+/g, ' ').trim();
        }""")
        out["hub"] = text_of(page) + "\n" + (out["strip"] or "")
        out["stripBlank"] = not any(word in (out["strip"] or "") for word in ("Skate City Night", "costume parade", "Friends Club", "basketball", "Picture day"))
        out["harrisTile"] = page.evaluate("() => (document.querySelector('a.tile.harris') || {}).innerText || ''")
        out["harrisAllDone"] = "All done" in out["harrisTile"]
        titles = page.evaluate("""() => {
          const D = window.HouseEventDisplay;
          if (!D) return {};
          const same = D.summarize({ summary: 'Skate City Night', title: 'Skate City Night', what: 'Skate City Night', location: 'gym' }, 'shared');
          const diff = D.summarize({ summary: 'Lantern walk', title: 'Other title', what: 'Third title', location: 'gym' }, 'shared');
          return { same: same && same.title, different: diff && diff.title };
        }""")
        out["same"] = titles.get("same")
        out["different"] = titles.get("different")

        open_page("/sheet-today.html")
        page.screenshot(path=str(OUT / shots["sheet-today.html"]))
        out["today"] = page.evaluate("() => document.body ? document.body.textContent : ''")
        out["todayFit"] = page.evaluate("""() => {
          const panel = document.querySelector('section.today-day');
          const hdr = panel && panel.querySelector('.sec-hdr');
          const list = document.querySelector("[data-live='leaveby-today']");
          const rail = document.querySelector("nav[aria-label='Musts Jar Days']");
          const box = (el) => {
            if (!el) return null;
            const r = el.getBoundingClientRect();
            return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height };
          };
          const hit = (a, b) => !!(a && b && a.w > 0 && b.w > 0 && a.l < b.r - 0.5 && a.r > b.l + 0.5 && a.t < b.b - 0.5 && a.b > b.t + 0.5);
          const chips = [...document.querySelectorAll('a.kchip')].map((el) => ({ name: (el.textContent || '').replace(/\\s+/g, ' ').trim(), ...box(el) }));
          const hb = box(hdr);
          const rows = list ? [...list.querySelectorAll('li.leaveby-row:not([hidden])')] : [];
          const moreEl = list && list.querySelector('.leaveby-more');
          const moreText = moreEl ? moreEl.textContent.trim() : '';
          const more = moreText ? parseInt(moreText.replace(/[^0-9]/g, ''), 10) : 0;
          const fully = (el, edge) => {
            const r = box(el);
            if (!r || r.h < 1 || !edge) return false;
            return r.t >= edge.t - 0.5 && r.b <= edge.b + 0.5 && r.l >= edge.l - 0.5 && r.r <= edge.r + 0.5;
          };
          const shown = list ? [...list.querySelectorAll('li.leaveby-row:not([hidden]), li.leaveby-more')] : [];
          const texts = list ? [...list.querySelectorAll('.leaveby-row-title, .leaveby-row-time, .leaveby-more')].filter((el) => !el.closest('[hidden]')).map((el) => ({
            t: (el.textContent || '').trim().slice(0, 48), sw: el.scrollWidth, cw: el.clientWidth
          })) : [];
          const imgs = [...document.querySelectorAll('img')].map((img) => ({ src: img.getAttribute('src') || '', w: img.naturalWidth || 0, h: img.naturalHeight || 0 }));
          const textBox = (el) => {
            if (!el) return null;
            const range = document.createRange();
            range.selectNodeContents(el);
            const r = range.getBoundingClientRect();
            return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height };
          };
          const title = list && list.querySelector('li.leaveby-row:not([hidden]) .leaveby-row-title');
          const time = list && list.querySelector('li.leaveby-row:not([hidden]) .leaveby-row-time');
          const row = title && title.closest('li');
          const titleCs = title ? getComputedStyle(title) : null;
          const lb = box(list), pb = box(panel), rb = box(rail);
          const clipped = shown.filter((el) => {
            const r = box(el);
            const inList = fully(el, lb);
            const inPanel = fully(el, pb);
            const above = !rb || (r && r.b <= rb.t + 0.5);
            return !(inList && inPanel && above);
          }).map((el) => (el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 40));
          return {
            overlaps: chips.filter((c) => hit(hb, c)).map((c) => c.name),
            listInside: !!(lb && pb && lb.t >= pb.t - 0.5 && lb.l >= pb.l - 0.5 && lb.r <= pb.r + 0.5 && lb.b <= pb.b + 0.5),
            aboveRail: !!(lb && rb && lb.b <= rb.t + 0.5 && pb && pb.b <= rb.t + 0.5),
            rows: rows.length,
            more: Number.isFinite(more) ? more : null,
            total: list ? list.getAttribute('data-today-total') : null,
            scrollOk: !!(list && list.scrollHeight <= list.clientHeight + 1),
            scrollHeight: list ? list.scrollHeight : 0,
            clientHeight: list ? list.clientHeight : 0,
            clipped,
            texts, imgs, hb, lb, pb, rb,
            slab: {
              titleBg: titleCs ? titleCs.backgroundColor : "",
              titleBox: box(title),
              rowBox: box(row),
              timeX: textBox(time) ? textBox(time).l : null,
              moreX: textBox(moreEl) ? textBox(moreEl).l : null,
              rowX: box(row) ? box(row).l : null,
              padL: row ? getComputedStyle(row).paddingLeft : "",
              rowBoxes: [...document.querySelectorAll('.today-day li.leaveby-row:not([hidden])')].map((el) => ({
                isNext: el.classList.contains('is-next'),
                rowBox: box(el),
                titleBox: box(el.querySelector('.leaveby-row-title'))
              }))
            }
          };
        }""")
        fit = out["todayFit"]
        slab = fit.get("slab") or {}
        im = Image.open(OUT / shots["sheet-today.html"]).convert("RGB")
        iw, ih = im.size

        def at(x, y):
            xi = max(0, min(iw - 1, int(round(x))))
            yi = max(0, min(ih - 1, int(round(y))))
            return list(im.getpixel((xi, yi)))

        tb = slab.get("titleBox") or {}
        rb = slab.get("rowBox") or {}
        ink = None
        ink_l = -1
        x0, x1 = int(tb.get("l") or 0), int(tb.get("r") or 0)
        y0, y1 = int(tb.get("t") or 0), int(tb.get("b") or 0)
        for y in range(max(0, y0), min(ih, max(y0, y1) + 1)):
            for x in range(max(0, x0), min(iw, max(x0, x1) + 1), 2):
                p = im.getpixel((x, y))
                L = 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2]
                if L > ink_l:
                    ink_l = L
                    ink = list(p)
        slab["ink"] = ink
        slab["chip"] = at((rb.get("l") or 0) + 6, ((rb.get("t") or 0) + (rb.get("b") or 0)) / 2)

        def brightest(box):
            best = None
            best_l = -1
            x0, x1 = int(box.get("l") or 0), int(box.get("r") or 0)
            y0, y1 = int(box.get("t") or 0), int(box.get("b") or 0)
            for yy in range(max(0, y0), min(ih, max(y0, y1) + 1)):
                for xx in range(max(0, x0), min(iw, max(x0, x1) + 1), 2):
                    p = im.getpixel((xx, yy))
                    L = 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2]
                    if L > best_l:
                        best_l = L
                        best = list(p)
            return best

        rows_out = []
        for item in slab.get("rowBoxes") or []:
            tbox = item.get("titleBox") or {}
            rbox = item.get("rowBox") or {}
            rows_out.append({
                "ink": brightest(tbox),
                "chip": at((rbox.get("l") or 0) + 6, ((rbox.get("t") or 0) + (rbox.get("b") or 0)) / 2),
                "isNext": bool(item.get("isNext")),
            })
        slab["rows"] = rows_out
        slab.pop("rowBoxes", None)
        fit["slab"] = slab

        open_page("/kid-hayes.html")
        page.screenshot(path=str(OUT / shots["kid-hayes.html"]))
        out["hayes"] = text_of(page)
        out["hayesHero"] = hero_of(page)

        open_page("/kid-harris.html")
        page.screenshot(path=str(OUT / shots["kid-harris.html"]))
        out["harris"] = text_of(page)

        open_page("/kid-ainsley.html")
        page.screenshot(path=str(OUT / shots["kid-ainsley.html"]))
        out["ainsley"] = text_of(page)

        open_page("/kid-harris.html?empty=1")
        empty = page.evaluate("""() => {
          const el = document.querySelector('.consume-hero');
          const title = document.querySelector('.consume-hero-title, .consume-hero-name');
          const text = title ? title.innerText.replace(/\\s+/g, ' ').trim() : '';
          const r = el ? el.getBoundingClientRect() : { left: 0, right: 0 };
          const n = (text.match(/NOTHING NEXT ON THE CALENDAR|Nothing next/g) || []).length;
          return { text, count: n, left: r.left, right: r.right };
        }""")
        out["empty"] = empty

        open_page("/sheet-weekend.html")
        page.screenshot(path=str(OUT / shots["sheet-weekend.html"]))
        out["weekend"] = page.evaluate("""() => {
          const boxes = [];
          const sel = 'a.wardos-home, .name-accent, .live-clock, .live-clock-host, .cheer-label, header.hdr';
          document.querySelectorAll(sel).forEach((el) => {
            const r = el.getBoundingClientRect();
            if (r.width < 2 || r.height < 2) return;
            boxes.push({ name: el.className || el.tagName, left: r.left, right: r.right, top: r.top, bottom: r.bottom, text: (el.innerText || '').slice(0, 40) });
          });
          const home = boxes.find((b) => /wardos-home/.test(b.name));
          const ideas = boxes.find((b) => /name-accent/.test(b.name));
          function hit(a, b) {
            if (!a || !b) return false;
            const x = Math.min(a.right, b.right) - Math.max(a.left, b.left);
            const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
            return x > 1 && y > 1;
          }
          const clock = boxes.find((b) => /live-clock/.test(b.name) && !/host/.test(b.name));
          const clipped = !!(clock && (clock.right > 1872 || clock.left < 48 || clock.bottom > 1032));
          return { boxes, overlap: hit(home, ideas), leftOf: boxes.filter((b) => b.left < 48).length, clockClipped: clipped, clock };
        }""")
        out["page"] = (out.get("hub") or "") + (out.get("today") or "") + (out.get("hayes") or "")
        page.close()
        browser.close()
    httpd.shutdown()
    print(json.dumps(out), flush=True)


if __name__ == "__main__":
    main()
