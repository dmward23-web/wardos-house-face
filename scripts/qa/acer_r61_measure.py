"""r61 · hub strip hit-test, offline lights card, Today lines, ahead cue. One JSON line."""
import json
import os
import threading
from datetime import datetime
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from zoneinfo import ZoneInfo
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pw_chrome import launch_kw
from playwright.sync_api import sync_playwright

ROOT = Path(os.environ.get("WARDOS_ROOT") or Path(__file__).resolve().parents[2])
CT = ZoneInfo("America/Chicago")
now = datetime.now(CT)
day = now.strftime("%Y-%m-%d")
start = now.replace(hour=18, minute=0, second=0, microsecond=0).strftime("%Y-%m-%dT%H:%M:%S-06:00")
start2 = now.replace(hour=19, minute=0, second=0, microsecond=0).strftime("%Y-%m-%dT%H:%M:%S-06:00")


def ev(summary, when="Tue · 6:00pm"):
    return {"summary": summary, "title": summary, "what": summary, "when": when, "startIso": start, "start": start}


HAYES = ["Skate City Night", "costume parade", "Art club", "Soccer", "Piano", "Swim", "Library", "Practice"]
AHEAD_ROWS = ["Lane visit %d" % i for i in range(1, 25)]


def ahead_when(i):
    # Wednesday and Thursday of this week, after now, so none are dropped as past.
    if i < 12:
        return "Wed 18 · %d:10pm" % (6 + (i % 5))
    return "Thu 19 · %d:20pm" % (6 + (i % 5))


WEEK = {
    "asOfIso": day,
    "kids": {
        "hayes": {"id": "hayes", "name": "Hayes", "today": [ev(n) for n in HAYES] + [ev(AHEAD_ROWS[i], ahead_when(i)) for i in range(len(AHEAD_ROWS))], "quests": []},
        "ainsley": {"id": "ainsley", "name": "Ainsley", "today": [ev("Picture day"), ev("Soccer")], "quests": []},
        "harris": {"id": "harris", "name": "Harris", "today": [ev("Art club"), ev("basketball")], "quests": []},
    },
}
CAL = {
    "status": "live", "fetchedAt": now.isoformat(), "asOfIso": day,
    "upcomingLeaves": [
        {"summary": "Skate City Night", "title": "Skate City Night", "start": start, "end": start2, "allDay": False},
        {"summary": "Art club", "title": "Art club", "start": start, "end": start2, "allDay": False},
        {"summary": "Picture day", "title": "Picture day", "start": start2, "end": start2, "allDay": False},
        {"summary": "Soccer", "title": "Soccer", "start": start2, "end": start2, "allDay": False},
    ],
}


class H(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=str(ROOT), **k)

    def log_message(self, *a):
        pass

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path.endswith("/kids-week.json"):
            body = json.dumps(WEEK).encode()
        elif path.endswith("/cal-live.json") or path.endswith("/cal-months.json"):
            body = json.dumps(CAL).encode()
        elif path.endswith("/private-names.json"):
            body = b"{}"
        else:
            return super().do_GET()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


HUB = r"""() => {
  const strip = document.querySelector('.leaveby.leaveby--hot');
  const music = document.getElementById('hub-spotify-tile');
  const box = (el) => {
    const r = el.getBoundingClientRect();
    return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height };
  };
  const rows = [...document.querySelectorAll('.leaveby .lb-day-stop, .leaveby .lb-list-row, .leaveby .lb-day-tchip, .leaveby .lb-more')].filter(el => {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 1 && r.height > 1;
  }).map(el => {
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    const inStrip = !!(hit && strip && (hit === strip || strip.contains(hit)));
    const inMusic = !!(hit && music && (hit === music || music.contains(hit)));
    return { t: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40), l: Math.round(r.left), top: Math.round(r.top), b: Math.round(r.bottom), inStrip, inMusic };
  });
  const chips = [...document.querySelectorAll('.leaveby-chip')].map(el => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return { t: (el.textContent || '').trim(), w: r.width, h: r.height, fs: parseFloat(cs.fontSize) || 0 };
  });
  const gaps = [];
  for (let i = 1; i < chips.length; i++) {
    const a = document.querySelectorAll('.leaveby-chip')[i - 1].getBoundingClientRect();
    const b = document.querySelectorAll('.leaveby-chip')[i].getBoundingClientRect();
    if (Math.abs(a.top - b.top) < 8) gaps.push(b.left - a.right);
  }
  const hdr = document.querySelector('.leaveby-mode-label');
  const hs = hdr ? getComputedStyle(hdr) : null;
  const hr = hdr ? hdr.getBoundingClientRect() : null;
  const musicBox = music ? box(music) : null;
  const stripBox = strip ? box(strip) : null;
  let overlap = false;
  if (musicBox && stripBox) {
    const x = Math.min(musicBox.r, stripBox.r) - Math.max(musicBox.l, stripBox.l);
    const y = Math.min(musicBox.b, stripBox.b) - Math.max(musicBox.t, stripBox.t);
    overlap = x > 0.5 && y > 0.5;
  }
  return {
    rows, chips, gaps,
    hdr: hr ? { h: hr.height, fs: parseFloat(hs.fontSize) || 0 } : null,
    overlap, music: musicBox, strip: stripBox
  };
}"""

TODAY = r"""() => {
  function box(el) {
    const r = el.getBoundingClientRect();
    return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height };
  }
  function hitOk(el) {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + Math.min(8, r.height / 2));
    return !!(top && (top === el || el.contains(top)));
  }
  return [...document.querySelectorAll('.kid-card')].map(card => {
    const lines = [...card.querySelectorAll('.kid-what-line')].filter(el => getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 1).map(el => {
      const b = box(el);
      const cs = getComputedStyle(el);
      return { text: (el.textContent || '').trim(), more: el.classList.contains('kid-more'), l: b.l, top: b.t, r: b.r, b: b.b, fs: parseFloat(cs.fontSize) || 0, lh: parseFloat(cs.lineHeight) || 24 };
    });
    const name = card.querySelector('.kid-name');
    const pill = card.querySelector('.kid-tap');
    const cb = box(card);
    const nb = box(name);
    const pb = box(pill);
    const inside = (a, host) => a.l >= host.l - 0.5 && a.t >= host.t - 0.5 && a.r <= host.r + 0.5 && a.b <= host.b + 0.5;
    return {
      kid: (card.className || '').replace('kid-card', '').trim(),
      card: { b: Math.round(cb.b), h: Math.round(cb.h) },
      name: { inside: inside(nb, cb), hit: hitOk(name), h: Math.round(nb.h) },
      pill: { t: (pill.textContent || '').trim(), inside: inside(pb, cb), hit: hitOk(pill), h: Math.round(pb.h) },
      lines
    };
  });
}"""

AHEAD = r"""() => {
  const box = document.querySelector('.consume-ahead');
  if (!box) return { missing: true };
  const host = box.getBoundingClientRect();
  const rows = [...box.querySelectorAll('.consume-ahead-row')].filter(el => getComputedStyle(el).display !== 'none').map(el => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el.querySelector('.consume-ahead-what') || el);
    const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) || 24;
    return {
      t: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40),
      clipped: r.top < host.top - 0.5 || r.bottom > host.bottom + 0.5 || r.left < host.left - 0.5 || r.right > host.right + 0.5,
      lines: Math.round(r.height / lh),
      h: Math.round(r.height)
    };
  });
  const cue = box.querySelector('.consume-ahead-more');
  const cr = cue ? cue.getBoundingClientRect() : null;
  const cs = cue ? getComputedStyle(cue) : null;
  return {
    n: rows.length,
    all: box.querySelectorAll('.consume-ahead-row').length,
    clipped: rows.filter(r => r.clipped),
    maxLines: rows.reduce((m, r) => Math.max(m, r.lines), 0),
    cue: cue && cs.display !== 'none' && cr.height > 1 ? { t: (cue.textContent || '').trim(), h: Math.round(cr.height) } : null,
    hostH: Math.round(host.height),
    sample: rows.slice(0, 4).map(r => r.t)
  };
}"""


def main():
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), H)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    base = "http://127.0.0.1:%d" % httpd.server_address[1]
    out = {}
    with sync_playwright() as p:
        browser = p.chromium.launch(**launch_kw(p, headless=True))
        ctx = browser.new_context(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
        ctx.add_init_script("try { localStorage.setItem('wardos-private-feed-token', 'qaSyntheticDeviceKey0000'); } catch (e) {}")
        page = ctx.new_page()
        page.goto(base + "/sheet-index.html?pfBase=" + base, wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(1400)
        out["hub"] = page.evaluate(HUB)
        writes = []
        page.on("request", lambda req: writes.append(req.url) if req.method == "POST" and "lights" in req.url else None)
        page.goto(base + "/sheet-lights.html?pfBase=" + base, wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(800)
        card = page.evaluate("""() => {
          const el = document.querySelector('.panel.lights-cmd');
          const r = el.getBoundingClientRect();
          return { offline: document.body.classList.contains('lights-offline'), l: Math.round(r.left), t: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
        }""")
        def tap(sel):
            box = page.evaluate("""(sel) => {
              const el = document.querySelector(sel);
              const r = el.getBoundingClientRect();
              return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
            }""", sel)
            page.mouse.click(box["x"], box["y"])
            page.wait_for_timeout(200)
            return page.evaluate("""() => {
              const el = document.getElementById('lights-offline-say');
              const cs = el ? getComputedStyle(el) : null;
              return { t: el ? (el.textContent || '').trim() : '', shown: !!(el && cs.display !== 'none' && el.getBoundingClientRect().height > 1) };
            }""")
        on = tap("#lights-all-on")
        off = tap("#lights-all-off")
        out["lights"] = {"card": card, "on": on, "off": off, "writes": len(writes)}
        page.goto(base + "/sheet-today.html?pfBase=" + base, wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(1200)
        out["today"] = page.evaluate(TODAY)
        page.goto(base + "/kid-hayes.html?pfBase=" + base, wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(1400)
        out["ahead"] = page.evaluate(AHEAD)
        out["hayesCount"] = len(HAYES) + len(AHEAD_ROWS)
        browser.close()
    httpd.shutdown()
    print(json.dumps(out), flush=True)


if __name__ == "__main__":
    main()
