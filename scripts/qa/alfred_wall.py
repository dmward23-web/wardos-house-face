"""Alfred wall checks: hub doors, painted-asset census, cubby rows, safe-area spacing.
   Real Chrome. Viewport 1920x1080. Prints one JSON object."""
import functools, json, os, sys, threading
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pw_chrome import launch_kw

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
MODE = sys.argv[1] if len(sys.argv) > 1 else "doors"

class Q(SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass

srv = ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Q, directory=ROOT))
threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = "http://127.0.0.1:%d/" % srv.server_address[1]

DOORS = [(1191, 378, "kid-ainsley.html"), (1653, 378, "kid-hayes.html"), (1191, 822, "kid-harris.html"), (1653, 822, "sheet-today.html")]
ROUTES = ["sheet-index.html", "sheet-chores.html", "sheet-allowance.html", "month.html", "sheet-today.html", "kid-ainsley.html", "kid-hayes.html", "kid-harris.html"]

DRAW_WRAP = r"""
(() => {
  const bad = [];
  const orig = CanvasRenderingContext2D.prototype.drawImage;
  CanvasRenderingContext2D.prototype.drawImage = function (img) {
    const args = Array.prototype.slice.call(arguments, 1);
    const nw = img ? (img.naturalWidth || img.videoWidth || img.width || 0) : 0;
    const nh = img ? (img.naturalHeight || img.videoHeight || img.height || 0) : 0;
    let sw = nw, sh = nh, dw = nw, dh = nh;
    if (args.length === 4) { dw = args[2]; dh = args[3]; }
    else if (args.length >= 8) { sw = args[2]; sh = args[3]; dw = args[6]; dh = args[7]; }
    if (nw && (Math.round(sw) !== Math.round(dw) || Math.round(sh) !== Math.round(dh))) {
      const src = (img.currentSrc || img.src || img.id || "").toString().split("/").slice(-2).join("/");
      bad.push({ sw: Math.round(sw), sh: Math.round(sh), dw: Math.round(dw), dh: Math.round(dh), src: src.slice(0, 140) });
    }
    return orig.apply(this, arguments);
  };
  window.__drawMismatches = bad;
})();
"""

CENSUS = r"""async () => {
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    if (r.right < 0 || r.bottom < 0 || r.left > innerWidth || r.top > innerHeight) return false;
    let n = el;
    while (n && n.nodeType === 1) {
      const c = getComputedStyle(n);
      if (c.display === "none" || c.visibility === "hidden" || Number(c.opacity) === 0) return false;
      n = n.parentElement;
    }
    return true;
  };
  const imgs = [];
  for (const img of document.querySelectorAll("img")) {
    if (!vis(img)) continue;
    const r = img.getBoundingClientRect();
    imgs.push({ src: (img.currentSrc || img.src || "").split("/").slice(-2).join("/"), natural: [img.naturalWidth, img.naturalHeight], display: [Math.round(r.width), Math.round(r.height)] });
  }
  const urls = new Set();
  const jobs = [];
  const take = (el, pseudo) => {
    const cs = getComputedStyle(el, pseudo);
    if (pseudo && (cs.content === "none" || cs.content === "normal")) return;
    const bg = cs.backgroundImage || "";
    if (!bg || bg === "none" || !bg.includes("url(")) return;
    if (pseudo) {
      const w = parseFloat(cs.width), h = parseFloat(cs.height);
      if (!(w > 1 && h > 1)) return;
    } else if (!vis(el)) return;
    const parts = bg.split(/,(?![^(]*\))/);
    const sizes = (cs.backgroundSize || "auto").split(/,(?![^(]*\))/);
    parts.forEach((part, i) => {
      const m = part.match(/url\(["']?([^"')]+)/);
      if (!m) return;
      const url = m[1];
      urls.add(url);
      jobs.push({ url, size: (sizes[i] || sizes[0] || "auto").trim(), el, pseudo, cs });
    });
  };
  for (const el of document.querySelectorAll("*")) {
    take(el, null);
    take(el, "::before");
    take(el, "::after");
  }
  const intrinsic = {};
  await Promise.all([...urls].map((url) => new Promise((res) => {
    const im = new Image();
    im.onload = im.onerror = () => { intrinsic[url] = [im.naturalWidth || 0, im.naturalHeight || 0]; res(); };
    im.src = url;
  })));
  function boxOf(el, pseudo, cs) {
    if (!pseudo) { const r = el.getBoundingClientRect(); return [r.width, r.height]; }
    const w = parseFloat(cs.width), h = parseFloat(cs.height);
    return [w, h];
  }
  function used(size, bw, bh, iw, ih) {
    const bits = size.split(/\s+/);
    if (size === "auto" || size === "auto auto") return [iw, ih];
    if (size === "cover" || size === "contain") {
      const s = size === "cover" ? Math.max(bw / iw, bh / ih) : Math.min(bw / iw, bh / ih);
      return [iw * s, ih * s];
    }
    const sx = bits[0] === "auto" ? null : parseFloat(bits[0]);
    const sy = bits.length < 2 || bits[1] === "auto" ? null : parseFloat(bits[1]);
    if (sx != null && sy != null) return [sx, sy];
    if (sx != null) return [sx, ih * (sx / iw)];
    if (sy != null) return [iw * (sy / ih), sy];
    return [iw, ih];
  }
  const bgs = [];
  for (const job of jobs) {
    const dim = intrinsic[job.url] || [0, 0];
    const box = boxOf(job.el, job.pseudo, job.cs);
    const u = used(job.size, box[0], box[1], dim[0] || 1, dim[1] || 1);
    bgs.push({ url: job.url.split("/").slice(-2).join("/"), intrinsic: dim, used: [Math.round(u[0]), Math.round(u[1])], spec: job.size, pseudo: job.pseudo || "" });
  }
  const canvas = document.querySelector("canvas.kw-canvas");
  const cv = canvas ? { w: canvas.width, h: canvas.height, css: [Math.round(canvas.getBoundingClientRect().width), Math.round(canvas.getBoundingClientRect().height)] } : null;
  return { imgs, bgs, draws: (window.__drawMismatches || []).slice(0, 12), canvas: cv };
}"""

CUBBY = r"""() => {
  const list = document.querySelector("#sec-musts [data-mount-quests], #sec-musts .chore-list");
  if (!list) return { rows: [], missing: true };
  const lr = list.getBoundingClientRect();
  const rows = [...list.querySelectorAll("[data-check]")].map((row) => {
    const r = row.getBoundingClientRect();
    const cx = Math.round(r.left + r.width / 2);
    const cy = Math.round(r.top + r.height / 2);
    const hit = document.elementFromPoint(cx, cy);
    return {
      id: row.getAttribute("data-check"),
      top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height),
      full: r.top >= lr.top - 0.5 && r.bottom <= lr.bottom + 0.5 && r.height >= 63.5,
      own: !!(hit && (hit === row || row.contains(hit))),
      hit: hit ? (hit.className || hit.tagName).toString().slice(0, 60) : null
    };
  });
  return { list: { top: Math.round(lr.top), bottom: Math.round(lr.bottom), h: Math.round(lr.height) }, rows };
}"""

BOUNDS = r"""() => {
  const SAFE = { l: 48, t: 48, r: 1872, b: 1032 };
  const outside = [];
  const gaps = [];
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    if (r.right < 0 || r.bottom < 0 || r.left > innerWidth || r.top > innerHeight) return false;
    let n = el;
    while (n && n.nodeType === 1) {
      const c = getComputedStyle(n);
      if (c.display === "none" || c.visibility === "hidden") return false;
      n = n.parentElement;
    }
    return true;
  };
  const inSafe = (r) => r.left >= SAFE.l - 0.5 && r.top >= SAFE.t - 0.5 && r.right <= SAFE.r + 0.5 && r.bottom <= SAFE.b + 0.5;
  const targets = [...document.querySelectorAll("a, button, [role=button], .chore, .kchip, .saves-bar, .saves-plus, .day, .qtile, .kid-card, .where-card, .tile")].filter(vis);
  for (const el of targets) {
    const r = el.getBoundingClientRect();
    if (!inSafe(r)) outside.push({ kind: "control", t: (el.getAttribute("aria-label") || el.className || el.textContent || "").toString().trim().slice(0, 40), l: Math.round(r.left), t0: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom) });
  }
  const byParent = new Map();
  for (const el of targets) {
    const p = el.parentElement;
    if (!p) continue;
    if (!byParent.has(p)) byParent.set(p, []);
    byParent.get(p).push(el);
  }
  for (const group of byParent.values()) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i].getBoundingClientRect();
        const b = group[j].getBoundingClientRect();
        const xOverlap = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const yOverlap = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        let gap = null;
        if (yOverlap > 8 && xOverlap <= 0) gap = Math.max(a.left, b.left) - Math.min(a.right, b.right);
        else if (xOverlap > 8 && yOverlap <= 0) gap = Math.max(a.top, b.top) - Math.min(a.bottom, b.bottom);
        else if (xOverlap > 0 && yOverlap > 0) gap = -Math.min(xOverlap, yOverlap);
        if (gap != null && gap < 15.5) gaps.push({ gap: Math.round(gap * 10) / 10, a: (group[i].className || group[i].tagName).toString().slice(0, 40), b: (group[j].className || group[j].tagName).toString().slice(0, 40) });
      }
    }
  }
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const text = node.textContent.replace(/\s+/g, " ").trim();
    if (!text) continue;
    const el = node.parentElement;
    if (!el || !vis(el)) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    for (const r of range.getClientRects()) {
      if (r.width < 1 || r.height < 1) continue;
      if (r.right < 0 || r.bottom < 0 || r.left > innerWidth || r.top > innerHeight) continue;
      if (!inSafe(r)) outside.push({ kind: "text", t: text.slice(0, 40), l: Math.round(r.left), t0: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom) });
    }
  }
  return { outside: outside.slice(0, 24), gaps: gaps.slice(0, 24), outsideN: outside.length, gapN: gaps.length };
}"""

def launch():
    p = sync_playwright().start()
    b = p.chromium.launch(**launch_kw(p, args=["--no-sandbox", "--disable-dev-shm-usage"]))
    ctx = b.new_context(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
    return p, b, ctx

def page_of(ctx, path, wrap=False):
    pg = ctx.new_page()
    if wrap:
        pg.add_init_script(DRAW_WRAP)
    pg.goto(BASE + path, wait_until="load", timeout=60000)
    pg.wait_for_timeout(1200)
    return pg

out = {"mode": MODE}
p = b = ctx = None
try:
    p, b, ctx = launch()
    if MODE == "doors":
        hits = []
        pg = page_of(ctx, "sheet-index.html")
        for x, y, dest in DOORS:
            pg.goto(BASE + "sheet-index.html", wait_until="load")
            pg.wait_for_timeout(900)
            hit = pg.evaluate("""([x, y]) => {
              const el = document.elementFromPoint(x, y);
              const door = el && el.closest && el.closest('.tile.ainsley, .tile.hayes, .tile.harris, .tile.dan');
              return { tag: el && el.tagName, cls: el && String(el.className || '').slice(0, 80), door: door ? String(door.className).slice(0, 80) : null, panel: !!(el && el.classList && el.classList.contains('panel')) };
            }""", [x, y])
            pg.mouse.click(x, y)
            try:
                pg.wait_for_url("**/" + dest, timeout=8000)
            except Exception:
                pass
            url = pg.url
            home = None
            home_box = None
            if dest in url:
                pg.wait_for_timeout(400)
                home_box = pg.evaluate("""() => {
                  const els = [...document.querySelectorAll('[data-kw-home], a.hub-home, header[data-hdr-home]')];
                  for (const el of els) {
                    const r = el.getBoundingClientRect();
                    const c = getComputedStyle(el);
                    if (r.width >= 32 && r.height >= 32 && c.display !== 'none' && c.visibility !== 'hidden')
                      return { x: r.x, y: r.y, w: r.width, h: r.height };
                  }
                  return null;
                }""")
                if home_box:
                    pg.mouse.click(home_box["x"] + home_box["w"] / 2, home_box["y"] + home_box["h"] / 2)
                    try:
                        pg.wait_for_url("**/sheet-index.html**", timeout=8000)
                    except Exception:
                        pass
                    home = pg.url
            hits.append({"at": [x, y], "dest": dest, "url": url, "hit": hit, "home": home, "homeBox": home_box, "money": any(bad in url for bad in ("sheet-dan", "sheet-allowance.html"))})
        out["doors"] = hits
    elif MODE == "census":
        pages = []
        for route in ROUTES:
            pg = page_of(ctx, route, wrap=True)
            pg.wait_for_timeout(700)
            info = pg.evaluate(CENSUS)
            bad_img = [i for i in info["imgs"] if i["natural"][0] != i["display"][0] or i["natural"][1] != i["display"][1]]
            bad_bg = [i for i in info["bgs"] if i["intrinsic"][0] != i["used"][0] or i["intrinsic"][1] != i["used"][1]]
            pages.append({"route": route, "badImg": bad_img[:8], "badBg": bad_bg[:8], "draws": info["draws"], "canvas": info["canvas"], "imgN": len(info["imgs"]), "bgN": len(info["bgs"])})
            pg.close()
        out["pages"] = pages
    elif MODE == "cubby":
        kids = {}
        for kid in ("hayes", "harris", "ainsley"):
            pg = page_of(ctx, "kid-%s.html" % kid)
            pg.wait_for_timeout(600)
            kids[kid] = pg.evaluate(CUBBY)
            pg.close()
        out["kids"] = kids
    elif MODE == "bounds":
        pages = []
        for route in ROUTES:
            pg = page_of(ctx, route)
            pg.wait_for_timeout(400)
            info = pg.evaluate(BOUNDS)
            pages.append({"route": route, **info})
            pg.close()
        out["pages"] = pages
    else:
        out["error"] = "unknown mode"
finally:
    if ctx: ctx.close()
    if b: b.close()
    if p: p.stop()
    srv.shutdown()
print(json.dumps(out))
