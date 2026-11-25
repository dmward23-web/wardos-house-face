"""r30 · one shared home stays tappable with the saves sheet open. One JSON line."""
import json
import os
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pw_chrome import launch_kw
from playwright.sync_api import sync_playwright

ROOT = Path(os.environ.get("WARDOS_ROOT") or Path(__file__).resolve().parents[2])

PROBE = r"""() => {
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 8 && r.height > 8 && cs.display !== "none" && cs.visibility !== "hidden" && !el.hidden;
  };
  const homes = [...document.querySelectorAll("a.wardos-home, a.kw-home, a.hub-home")].filter(vis);
  const shared = homes.filter((el) => el.classList.contains("wardos-home"));
  const box = (el) => {
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const hit = document.elementFromPoint(cx, cy);
    const own = !!(hit && (hit === el || el.contains(hit)));
    return {
      left: r.left, top: r.top, right: r.right, bottom: r.bottom, w: r.width, h: r.height,
      hit: own, covered: !own, cls: String(el.className)
    };
  };
  const primary = shared[0] ? box(shared[0]) : null;
  const extras = homes.filter((el) => !shared.includes(el)).map((el) => {
    const b = box(el);
    const s = primary;
    const overlap = !!(s && b.left < s.left + s.w && b.left + b.w > s.left && b.top < s.top + s.h && b.top + b.h > s.top);
    return Object.assign(b, { overlap });
  });
  const bar = document.querySelector("[data-saves-bar]");
  const br = bar ? bar.getBoundingClientRect() : null;
  return {
    modal: !!document.querySelector(".saves-overlay"),
    shared: shared.length,
    home: primary,
    extras,
    bar: br ? { x: br.left + br.width / 2, y: br.top + br.height / 2, w: br.width, h: br.height } : null
  };
}"""


class Q(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=str(ROOT), **k)

    def log_message(self, *a):
        pass


def main():
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), Q)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    base = "http://127.0.0.1:%d/" % httpd.server_address[1]
    out = {"modal": False, "shared": 0, "home": None, "extras": [], "reached": False, "url": ""}
    with sync_playwright() as p:
        browser = p.chromium.launch(**launch_kw(p, headless=True))
        ctx = browser.new_context(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
        page = ctx.new_page()
        page.goto(base + "kid-hayes.html", wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(900)
        bar = page.evaluate("""() => {
          const pick = [...document.querySelectorAll(".prism-jar-plus, [data-saves-bar], [data-saves-plus]")].find((el) => {
            const r = el.getBoundingClientRect();
            const cs = getComputedStyle(el);
            return r.width > 8 && r.height > 8 && cs.display !== "none" && cs.visibility !== "hidden";
          });
          if (!pick) return null;
          const r = pick.getBoundingClientRect();
          return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
        }""")
        if bar and bar["w"] > 8:
            page.mouse.click(bar["x"], bar["y"])
            page.wait_for_timeout(400)
        info = page.evaluate(PROBE)
        out.update(info)
        extras = info.get("extras") or []
        tapped = []
        for i, extra in enumerate(extras):
            hop = ctx.new_page()
            hop.goto(base + "kid-hayes.html", wait_until="domcontentloaded", timeout=30000)
            hop.wait_for_timeout(700)
            again = hop.evaluate("""() => {
              const pick = [...document.querySelectorAll(".prism-jar-plus, [data-saves-bar], [data-saves-plus]")].find((el) => {
                const r = el.getBoundingClientRect();
                return r.width > 8 && getComputedStyle(el).display !== "none";
              });
              if (!pick) return null;
              const r = pick.getBoundingClientRect();
              return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width };
            }""")
            if again and again["w"] > 8:
                hop.mouse.click(again["x"], again["y"])
                hop.wait_for_timeout(300)
            spot = hop.evaluate("""(i) => {
              const vis = (el) => {
                const r = el.getBoundingClientRect();
                const cs = getComputedStyle(el);
                return r.width > 8 && cs.display !== "none" && !el.classList.contains("wardos-home");
              };
              const homes = [...document.querySelectorAll("a.kw-home, a.hub-home")].filter(vis);
              const el = homes[i];
              if (!el) return null;
              const r = el.getBoundingClientRect();
              return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
            }""", i)
            reached = False
            if spot:
                hop.mouse.click(spot["x"], spot["y"])
                for _ in range(20):
                    hop.wait_for_timeout(100)
                    if "sheet-index" in hop.url:
                        reached = True
                        break
            tapped.append(reached)
            hop.close()
        for i, extra in enumerate(out["extras"]):
            extra["reached"] = tapped[i] if i < len(tapped) else False
        home = info.get("home")
        if home:
            page.mouse.click(home["left"] + home["w"] / 2, home["top"] + home["h"] / 2)
            for _ in range(20):
                page.wait_for_timeout(100)
                if "sheet-index" in page.url:
                    out["reached"] = True
                    break
        out["url"] = page.url
        browser.close()
    httpd.shutdown()
    print(json.dumps(out), flush=True)


if __name__ == "__main__":
    main()
