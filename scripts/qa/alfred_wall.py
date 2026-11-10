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
  const adjacent = [];
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
  const seen = new Set();
  const targets = [];
  const add = (el) => { if (el && !seen.has(el)) { seen.add(el); targets.push(el); } };
  for (const el of document.querySelectorAll("a, button, [role=button], .chore, .kchip, .saves-bar, .saves-plus, .day, .qtile, .kid-card, .where-card, .tile")) if (vis(el)) add(el);
  for (const el of document.querySelectorAll(".chore-shortcuts .kid-chip")) {
    const c = getComputedStyle(el);
    if (c.display !== "none" && c.visibility !== "hidden") add(el);
  }
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
  for (let i = 0; i < targets.length; i++) {
    for (let j = i + 1; j < targets.length; j++) {
      const A = targets[i], B = targets[j];
      if (A.contains(B) || B.contains(A)) continue;
      const a = A.getBoundingClientRect();
      const b = B.getBoundingClientRect();
      const xOverlap = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const yOverlap = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      let gap = null;
      if (xOverlap > 1 && yOverlap > 1) gap = -Math.min(xOverlap, yOverlap);
      else if (yOverlap > 8 && xOverlap <= 0) gap = Math.max(a.left, b.left) - Math.min(a.right, b.right);
      else if (xOverlap > 8 && yOverlap <= 0) gap = Math.max(a.top, b.top) - Math.min(a.bottom, b.bottom);
      if (gap != null && gap < 15.99) adjacent.push({ gap: Math.round(gap * 100) / 100, a: (A.getAttribute("aria-label") || A.className || A.tagName).toString().slice(0, 40), b: (B.getAttribute("aria-label") || B.className || B.tagName).toString().slice(0, 40) });
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
  return { outside: outside.slice(0, 24), gaps: gaps.slice(0, 24), adjacent: adjacent.slice(0, 24), outsideN: outside.length, gapN: gaps.length, adjacentN: adjacent.length };
}"""

PRESS = r"""() => {
  window.__pressStop = false;
  window.__pressDone = false;
  window.__pressSamples = [];
  const identT = (t) => !t || t === "none" || t === "matrix(1, 0, 0, 1, 0, 0)";
  const plain = (v, ok) => !v || ok.indexOf(v) >= 0;
  function geomOk(c) {
    return identT(c.transform)
      && plain(c.scale, ["none", "1", "1 1"])
      && plain(c.translate, ["none", "0px", "0px 0px"])
      && plain(c.rotate, ["none", "0deg"])
      && plain(c.zoom, ["1", "normal"]);
  }
  function walk(el, bad) {
    let n = el;
    while (n) {
      const c = getComputedStyle(n);
      if (!geomOk(c)) bad.push({ tag: n.tagName, id: n.id || "", cls: String(n.className || "").slice(0, 48), transform: c.transform, scale: c.scale, translate: c.translate, rotate: c.rotate, zoom: c.zoom });
      n = n.parentElement;
    }
  }
  const jar0 = document.querySelector("#sec-jar");
  const rest = jar0 ? jar0.getBoundingClientRect() : null;
  window.__jarRest = rest ? { l: rest.left, t: rest.top, r: rest.right, b: rest.bottom, w: rest.width, h: rest.height } : null;
  window.__pressFrame = function () {
    const cards = [...document.querySelectorAll("#sec-musts .chore")];
    const bad = [];
    const sizes = [];
    for (const el of cards) {
      const r = el.getBoundingClientRect();
      sizes.push([Math.round(r.width * 100) / 100, Math.round(r.height * 100) / 100]);
      walk(el, bad);
    }
    const jar = document.querySelector("#sec-jar");
    let jarBottom = 0;
    if (jar) {
      walk(jar, bad);
      const r = jar.getBoundingClientRect();
      jarBottom = r.bottom;
      const g = window.__jarRest;
      if (g && (Math.abs(r.left - g.l) > 0.5 || Math.abs(r.top - g.t) > 0.5 || Math.abs(r.right - g.r) > 0.5 || Math.abs(r.bottom - g.b) > 0.5 || Math.abs(r.width - g.w) > 0.5 || Math.abs(r.height - g.h) > 0.5)) {
        bad.push({ id: "sec-jar", what: "rect", l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height });
      }
    }
    const rects = cards.map((el) => el.getBoundingClientRect()).sort((a, b) => a.top - b.top);
    let minGap = 999;
    for (let i = 1; i < rects.length; i++) minGap = Math.min(minGap, rects[i].top - rects[i - 1].bottom);
    return { bad, minGap, jarBottom, sizes };
  };
  window.__pressMutate = function () {
    const jar = document.querySelector("#sec-jar");
    jar.style.setProperty("transform", "matrix(0.99, 0, 0, 0.99, 0, 0)", "important");
    const sample = window.__pressFrame();
    jar.style.removeProperty("transform");
    return { flagged: sample.bad.some((row) => row.id === "sec-jar" && String(row.transform || "").indexOf("0.99") >= 0), bad: sample.bad.filter((row) => row.id === "sec-jar").slice(0, 2) };
  };
  function frame() {
    window.__pressSamples.push(window.__pressFrame());
    if (!window.__pressStop) requestAnimationFrame(frame);
    else window.__pressDone = true;
  }
  requestAnimationFrame(frame);
  const row = document.querySelector("#sec-musts .chore");
  const r = row.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}"""

CHEER = r"""() => {
  const card = document.querySelector("section.cheer");
  if (!card) return { missing: true };
  const cr = card.getBoundingClientRect();
  const texts = [];
  for (const el of card.querySelectorAll("*")) {
    const direct = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!direct) continue;
    const range = document.createRange();
    range.selectNodeContents(el);
    for (const r of range.getClientRects()) {
      if (r.width < 1 || r.height < 1) continue;
      texts.push({ t: (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40), l: r.left, t0: r.top, r: r.right, b: r.bottom, cls: String(el.className || el.tagName).slice(0, 40) });
    }
  }
  const controls = [...document.querySelectorAll("a, button, .kid-chip")].filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1;
  }).map((el) => {
    const r = el.getBoundingClientRect();
    return { l: r.left, t0: r.top, r: r.right, b: r.bottom };
  });
  const inside = [];
  const hits = [];
  const overlaps = (a, b) => a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t0 < b.b - 0.5 && b.t0 < a.b - 0.5;
  for (const t of texts) {
    if (t.l < cr.left - 0.5 || t.t0 < cr.top - 0.5 || t.r > cr.right + 0.5 || t.b > cr.bottom + 0.5) inside.push(t);
  }
  for (let i = 0; i < texts.length; i++) {
    for (let j = i + 1; j < texts.length; j++) if (overlaps(texts[i], texts[j])) hits.push({ a: texts[i].t, b: texts[j].t });
    for (const c of controls) if (overlaps(texts[i], c)) hits.push({ a: texts[i].t, b: "control" });
  }
  return {
    card: { l: Math.round(cr.left), t: Math.round(cr.top), r: Math.round(cr.right), b: Math.round(cr.bottom) },
    texts: texts.map((t) => ({ t: t.t, l: Math.round(t.l), t0: Math.round(t.t0), r: Math.round(t.r), b: Math.round(t.b) })),
    outside: inside.map((t) => t.t),
    overlaps: hits
  };
}"""

SHORTCUTS = r"""() => {
  const els = [...document.querySelectorAll("body > .chore-shortcuts .kid-chip, header .kid-chip")];
  return els.map((el) => {
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return {
      name: (el.textContent || "").replace(/\s+/g, " ").trim(),
      l: Math.round(r.left), t: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom),
      w: Math.round(r.width), h: Math.round(r.height),
      own: !!(hit && (hit === el || el.contains(hit))),
      hit: hit ? String(hit.className || hit.tagName).slice(0, 60) : null
    };
  });
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
    elif MODE == "press":
        kids = {}
        for kid in ("ainsley", "hayes", "harris"):
            pg = page_of(ctx, "kid-%s.html" % kid)
            pg.wait_for_timeout(400)
            spot = pg.evaluate(PRESS)
            pg.mouse.move(spot["x"], spot["y"])
            pg.mouse.down()
            pg.wait_for_timeout(150)
            pg.mouse.up()
            pg.mouse.down()
            pg.wait_for_timeout(400)
            pg.mouse.up()
            for _ in range(8):
                pg.mouse.click(spot["x"], spot["y"])
            pg.wait_for_timeout(1100)
            pg.evaluate("() => { window.__pressStop = true }")
            pg.wait_for_function("() => window.__pressDone", timeout=3000)
            samples = pg.evaluate("() => window.__pressSamples")
            def bad_size(s):
                return any(abs(w - 900) > 0.51 or abs(h - 64) > 0.51 for w, h in s.get("sizes") or [])
            bad = [s for s in samples if s["bad"] or s["minGap"] < 16 or s["jarBottom"] > 1032 or bad_size(s)]
            mut = pg.evaluate("() => window.__pressMutate()")
            kids[kid] = {"frames": len(samples), "bad": [{k: v for k, v in s.items() if k != "sizes"} | {"sizes": (s.get("sizes") or [])[:2]} for s in bad[:4]], "badN": len(bad), "spot": spot, "mutation": mut}
            pg.close()
        out["kids"] = kids
    elif MODE == "shortcuts":
        pages = {}
        for route in ("sheet-chores.html", "kid-ainsley.html", "kid-hayes.html", "kid-harris.html"):
            pg = page_of(ctx, route)
            pg.wait_for_timeout(300)
            pages[route] = pg.evaluate(SHORTCUTS)
            pg.close()
        out["pages"] = pages
    elif MODE == "cheer":
        pg = page_of(ctx, "sheet-chores.html")
        pg.wait_for_timeout(400)
        out["cheer"] = pg.evaluate(CHEER)
        pg.close()
    else:
        out["error"] = "unknown mode"
finally:
    if ctx: ctx.close()
    if b: b.close()
    if p: p.stop()
    srv.shutdown()
print(json.dumps(out))
