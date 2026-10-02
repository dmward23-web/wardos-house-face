# DEADSPACE1 · dead-space + overflow test for wall.html and the boards the press map reaches.
# Method: the viewport is cut into 16px cells. A cell is CONTENT when text, an image/svg/canvas, a control (button,
# input, LED) or an inner box with its own background/border covers it. Two failures:
#   tile-hole  - inside one tile (wall: [data-tile-id] / .mod / .act / .ctl / .seat / .claim / .badge), the largest
#                empty rectangle is more than 2% of the viewport (boards: any card, 3%);
#   gap        - a vertical run (in an empty band 48px+ wide, so a tile gutter is not one) between two tiles (or a tile and the viewport edge, side bars included) longer than
#                24px with nothing in it (boards: area outside every card > 2% of the viewport as one rectangle).
# Plus overflow: no horizontal scroll anywhere; the wall never scrolls vertically in landscape.
# States (wall): real data at a test clock (Playwright clock.install; data/ is never written) plus FIXTURE states
# routed in from scripts/wall/fixtures/*.FIXTURE.json. Heatmaps: red = failing hole/gap, amber = empty cells.
# Usage: python3 scripts/wall/deadspace.py [--wall] [--boards] [--vp WxH ...] [--out DIR]
import sys, os, json, subprocess, time, random, datetime
from playwright.sync_api import sync_playwright
from PIL import Image, ImageDraw
WT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "../.."))
FX = os.path.join(WT, "scripts/wall/fixtures")
args = sys.argv[1:]; do_wall = "--boards" not in args or "--wall" in args; do_boards = "--wall" not in args or "--boards" in args
OUT = args[args.index("--out") + 1] if "--out" in args else "/workspace/plates/2026-10-01/redesign/wright/deadspace"
VPS = [tuple(map(int, args[i + 1].split("x"))) for i, a in enumerate(args) if a == "--vp"] or [(1280, 650), (1366, 768), (1536, 730), (1920, 1080), (2560, 1440)]
os.makedirs(OUT, exist_ok=True)
CELL = 16
BOARDS = ["sheet-index.html", "kid-hayes.html", "kid-harris.html", "kid-ainsley.html", "sheet-today.html", "month.html", "sheet-dan.html",
          "sheet-us.html", "sheet-countdowns.html", "sheet-pack.html", "sheet-weekend.html", "sheet-win.html", "sheet-groceries.html", "sheet-dinner.html",
          "sheet-gallery.html", "sheet-gallery-hero.html", "sheet-load-day.html", "sheet-google-home.html", "sheet-status.html", "sheet-lights.html", "sheet-desk-gate.html"]
def fx(name): return json.load(open(os.path.join(FX, name)))
# (label, clock, {data path: fixture file}, localStorage seed)
def must_done_seed(day):
    return {f"house-checkoffs:{k}:{day}": json.dumps({"must-bed": True, "must-hamper": True, "must-dish": True, "must-floor": True}) for k in ("harris", "hayes", "ainsley")}
STATES = [
    ("FIXTURE-0645", "2026-10-01T06:45:00-05:00", {"data/kid-seats.json": "kid-seats.gen0645.FIXTURE.json", "data/next-up.json": "next-up.gen0645.FIXTURE.json", "data/house-mode.json": "house-mode.gen0645.FIXTURE.json"}, {}),
    ("FIXTURE-1530", "2026-10-01T15:30:00-05:00", {"data/kid-seats.json": "kid-seats.gen1530.FIXTURE.json", "data/next-up.json": "next-up.gen1530.FIXTURE.json", "data/house-mode.json": "house-mode.gen1530.FIXTURE.json"}, {}),
    ("real-2000", "2026-10-01T20:00:00-05:00", {}, {}),
    ("real-2130", "2026-10-01T21:30:00-05:00", {}, {}),
    ("FIXTURE-travel-week", "2026-10-01T20:00:00-05:00", {"data/kid-seats.json": "kid-seats.travel-week.FIXTURE.json"}, {}),
    ("FIXTURE-no-pickups", "2026-10-01T15:30:00-05:00", {"data/pickup-chain.json": "pickup-chain.empty.FIXTURE.json", "data/kid-seats.json": "kid-seats.gen1530.FIXTURE.json", "data/next-up.json": "next-up.gen1530.FIXTURE.json", "data/house-mode.json": "house-mode.gen1530.FIXTURE.json"}, {}),
    ("FIXTURE-all-musts-done", "2026-10-01T20:00:00-05:00", {}, must_done_seed("2026-10-01")),
    ("FIXTURE-choice-claimed", "2026-10-01T20:00:00-05:00", {"data/kid-seats.json": "kid-seats.choice-claimed.FIXTURE.json"}, {}),
    ("FIXTURE-choice-hidden", "2026-10-01T20:00:00-05:00", {"data/kid-seats.json": "kid-seats.choice-hidden.FIXTURE.json"}, {}),
    ("FIXTURE-doorbell-absent", "2026-10-01T20:00:00-05:00", {"data/nest-live.json": "nest-live.no-doorbell.FIXTURE.json"}, {}),
]
PROBE = r"""(o) => {
  const C = o.cell, W = innerWidth, H = innerHeight, cols = Math.ceil(W / C), rows = Math.ceil(H / C);
  const vis = e => { const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) return false; const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1; };
  const grid = new Uint8Array(cols * rows);
  const mark = (r) => { const x0 = Math.max(0, Math.floor(r.left / C)), x1 = Math.min(cols - 1, Math.floor((r.right - 1) / C)), y0 = Math.max(0, Math.floor(r.top / C)), y1 = Math.min(rows - 1, Math.floor((r.bottom - 1) / C)); for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) grid[y * cols + x] = 1; };
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
  while ((n = tw.nextNode())) { if (!n.nodeValue.trim() || !n.parentElement || !vis(n.parentElement)) continue; const rg = document.createRange(); rg.selectNodeContents(n); for (const r of rg.getClientRects()) mark(r); }
  const tiles = o.wall ? [...document.querySelectorAll('[data-tile-id], .mod, .act, .ctl, .seat, .claim, .us-x, .rail .badge')] : [];
  const isTile = new Set(tiles);
  for (const e of document.querySelectorAll('body *')) {
    if (!vis(e)) continue;
    const tag = e.tagName; const cs = getComputedStyle(e);
    if (/^(IMG|SVG|CANVAS|VIDEO|BUTTON|INPUT|SELECT|TEXTAREA|PROGRESS)$/i.test(tag) || e.classList.contains('led') || tag === 'svg') { mark(e.getBoundingClientRect()); continue; }
    if (isTile.has(e) || e.classList.contains('panel') || e.id === 'wall-panel') continue;
    const bg = cs.backgroundColor, img = cs.backgroundImage; const hasBg = (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') || (img && img !== 'none');
    const r = e.getBoundingClientRect();
    if (hasBg && r.width * r.height < W * H * 0.15) mark(r); /* an inner box (chip, track, card) counts; a page-size backdrop does not */
  }
  const boxes = (o.wall ? tiles.filter(vis) : [...document.querySelectorAll('.panel *')].filter(vis).filter(e => { const cs = getComputedStyle(e); const r = e.getBoundingClientRect(); const bg = cs.backgroundColor; return ((bg && bg !== 'rgba(0, 0, 0, 0)') || cs.borderTopWidth !== '0px' || cs.backgroundImage !== 'none') && r.width > 120 && r.height > 60 && r.width * r.height < W * H * 0.6; }))
    .map(t => { const r = t.getBoundingClientRect(); return { id: t.getAttribute('data-tile-id') || (t.className.toString().split(' ')[0]) || t.tagName, l: r.left, t: r.top, r: r.right, b: r.bottom,
      leaf: !o.wall || !t.querySelector('[data-tile-id], .mod, .act, .ctl, .seat, .claim, .us-x, .badge') || t.matches('.seat'), area: r.width * r.height }; })
    .sort((a, b) => b.area - a.area); /* big containers first, so a cell belongs to the smallest tile over it */
  return { cols, rows, grid: Array.from(grid), boxes, sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight, W, H, z: (document.getElementById('wall-panel') || { style: {} }).style.zoom || null };
}"""
def largest_rect(mask, cols, rows):
    """mask[y][x] True = empty & eligible. Returns (area_cells, x, y, w, h)."""
    best = (0, 0, 0, 0, 0); hgt = [0] * cols
    for y in range(rows):
        for x in range(cols): hgt[x] = hgt[x] + 1 if mask[y][x] else 0
        st = []
        for x in range(cols + 1):
            hh = hgt[x] if x < cols else 0; start = x
            while st and st[-1][1] >= hh:
                sx, sh = st.pop(); a = sh * (x - sx)
                if a > best[0]: best = (a, sx, y - sh + 1, x - sx, sh)
                start = sx
            st.append((start, hh))
    return best
def analyse(res, wall):
    C = CELL; cols, rows = res["cols"], res["rows"]; g = res["grid"]; W, H = res["W"], res["H"]; area = W * H
    empty = lambda x, y: not g[y * cols + x]
    fails = []; rects = []
    inside = [[None] * cols for _ in range(rows)]
    for bi, bx in enumerate(res["boxes"]):
        x0, x1 = max(0, int(bx["l"] // C)), min(cols - 1, int((bx["r"] - 1) // C)); y0, y1 = max(0, int(bx["t"] // C)), min(rows - 1, int((bx["b"] - 1) // C))
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1): inside[y][x] = bi
    lim = 0.02 if wall else 0.03
    for bi, bx in enumerate(res["boxes"]):
        if not bx.get("leaf", True): continue  # a container's own gutters are not a hole; its child tiles are checked
        mask = [[inside[y][x] == bi and empty(x, y) for x in range(cols)] for y in range(rows)]
        a, x, y, w, h = largest_rect(mask, cols, rows)
        if a * C * C > lim * area: fails.append(f"tile-hole {bx['id']} {w*C}x{h*C}px = {a*C*C/area:.1%}"); rects.append((x, y, w, h))
    out = [[inside[y][x] is None and empty(x, y) for x in range(cols)] for y in range(rows)]
    if wall:
        # a gutter between side-by-side tiles is one or two cells wide; a dead band is wider. Only cells in an
        # empty horizontal run of 3+ cells (48px) count toward a vertical gap.
        band = [[False] * cols for _ in range(rows)]
        for y in range(rows):
            x = 0
            while x < cols:
                if not out[y][x]: x += 1; continue
                x0 = x
                while x < cols and out[y][x]: x += 1
                if x - x0 >= 3:
                    for k in range(x0, x): band[y][k] = True
        for x in range(cols):  # vertical gaps between tiles (columns that cross a tile)
            if all(inside[y][x] is None for y in range(rows)): continue
            run = 0
            for y in range(rows + 1):
                if y < rows and band[y][x]: run += 1; continue
                if run * C > 24: fails.append(f"gap x {x*C}px y {(y-run)*C}-{y*C}px"); rects.append((x, y - run, 1, run))
                run = 0
        for y in range(rows):  # side bars: an empty run from the left / right edge wider than 24px
            l = 0
            while l < cols and out[y][l] and inside[y][l] is None: l += 1
            r = 0
            while r < cols and out[y][cols - 1 - r] and inside[y][cols - 1 - r] is None: r += 1
            if l * C > 24 and l < cols: fails.append(f"side bar left {l*C}px at y {y*C}"); rects.append((0, y, l, 1))
            if r * C > 24 and r < cols: fails.append(f"side bar right {r*C}px at y {y*C}"); rects.append((cols - r, y, r, 1))
        fails = fails[:12] if len(fails) < 40 else fails[:12] + [f"... {len(fails) - 12} more"]
    else:
        a, x, y, w, h = largest_rect(out, cols, rows)
        if a * C * C > 0.02 * area: fails.append(f"outside-cards {w*C}x{h*C}px = {a*C*C/area:.1%}"); rects.append((x, y, w, h))
    if res["sw"] > W: fails.append(f"overflow-x {res['sw']}>{W}")
    if wall and W > H and res["sh"] > H: fails.append(f"wall scrolls {res['sh']}>{H}")
    return fails, rects, out
def heat(png, res, rects, out, path):
    im = Image.open(png).convert("RGBA"); ov = Image.new("RGBA", im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(ov); C = CELL
    for y in range(res["rows"]):
        for x in range(res["cols"]):
            if not res["grid"][y * res["cols"] + x]: d.rectangle([x * C, y * C, x * C + C - 1, y * C + C - 1], fill=(255, 176, 32, 46))
    for (x, y, w, h) in rects: d.rectangle([x * C, y * C, (x + w) * C - 1, (y + h) * C - 1], outline=(255, 40, 40, 255), width=3, fill=(255, 40, 40, 60))
    Image.alpha_composite(im, ov).convert("RGB").save(path)
PORT = random.randint(20000, 40000)
srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"], cwd=WT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(0.8); L = f"http://127.0.0.1:{PORT}/"
summary = []; ok = True
def run(b, page, vw, vh, iso, routes, seed, label, wall):
    global ok
    ctx = b.new_context(viewport={"width": vw, "height": vh}); pg = ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:100]))
    pg.clock.install(time=datetime.datetime.fromisoformat(iso))
    if seed: pg.add_init_script("(s => { for (const k in s) localStorage.setItem(k, s[k]); })(" + json.dumps(seed) + ")")
    def route(r):
        u = r.request.url
        for k, f in routes.items():
            if u.split("?")[0].endswith("/" + k): return r.fulfill(status=200, content_type="application/json", body=json.dumps(fx(f)))
        return r.continue_() if u.startswith(L) else r.abort()
    pg.route("**/*", route)
    pg.goto(L + page); pg.clock.run_for(3000); pg.wait_for_timeout(1300); pg.clock.run_for(1000); pg.wait_for_timeout(300)
    res = pg.evaluate(PROBE, {"cell": CELL, "wall": wall})
    name = f"{page.replace('.html', '')}-{label}-{vw}x{vh}"
    png = os.path.join(OUT, name + ".png"); pg.screenshot(path=png); ctx.close()
    fails, rects, out = analyse(res, wall)
    if errs: fails.append("page error " + errs[0])
    heat(png, res, rects, out, os.path.join(OUT, name + "-heat.png")); os.remove(png)
    summary.append({"page": page, "state": label, "vp": f"{vw}x{vh}", "fails": fails})
    print(("FAIL " if fails else "PASS ") + name + ("  " + " | ".join(fails[:4]) if fails else ""), flush=True)
    ok = ok and not fails
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        if do_wall:
            for vw, vh in VPS:
                for label, iso, routes, seed in STATES: run(b, "wall.html", vw, vh, iso, routes, seed, label, True)
        if do_boards:
            for vw, vh in VPS:
                for page in BOARDS: run(b, page, vw, vh, "2026-10-01T21:30:00-05:00", {}, {}, "real-2130", False)
        b.close()
finally:
    srv.terminate()
json.dump(summary, open(os.path.join(OUT, "deadspace-summary.json"), "w"), indent=1)
print("DEADSPACE", "PASS" if ok else "FAIL", f"({sum(1 for s in summary if not s['fails'])}/{len(summary)} clean)"); sys.exit(0 if ok else 1)
