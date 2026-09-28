# House face — clickable tablet prototype

Kids-safe family board for the KS kitchen tablet test. Soft white/grey glass camo. **No money. No PIN.** Facts are mock / known-only — do not invent.

## Open

```bash
cd board-os/house-face && python3 -m http.server 8765
# → http://<host>:8765/sheet-index.html
```

Or open any HTML via **Files → Open in Safari** / AirDrop the folder. Portrait **1080×1920** canvas · Elo 3202L.

## Page map

| File | Role |
|------|------|
| `sheet-index.html` | **Home** — 19-tile family sheets index |
| `index.html` | Family **week** board |
| `month.html` | Family **month** calendar |
| `kid-ainsley.html` | Ainsley kid board (purple) |
| `kid-hayes.html` | Hayes kid board (green) |
| `kid-harris.html` | Harris kid board (blue) |
| `sheet-today.html` | Morning TODAY strip |
| `sheet-chores.html` | Chores checkoffs · streaks |
| `sheet-groceries.html` | Groceries / Costco · no $ |
| `sheet-allowance.html` | Allowance **stars only** |
| `sheet-dinner.html` | Dinner vote |
| `sheet-weekend.html` | Weekend fun |
| `sheet-pack.html` | Pack list |
| `sheet-win.html` | Week win cheer |
| `sheet-countdowns.html` | Countdowns |
| `month-chat.html` | Chat companion plate (separate) |
| `sheet-us.html` | Partner / Us sheet · Harbor-safe logistics |
| `sheet-load-day.html` | Load day · Fri Sep 25 loud |
| `sheet-desk-gate.html` | Desk · PIN boundary mock · no $ amounts |
| `sheet-status.html` | Status / stack inventory for Dan |
| `sheet-gallery.html` | Phone contact sheet · all House phone PNGs |
| `sheet-gallery-hero.html` | Hero eight · 1170×731 summary |

## Nav contract (inherit this)

1. **Sheets home** (`sheet-index.html`) — every tile is an `<a href>` to its page. Header **Week** → `index.html`.
2. **Every other page** — header **‹ Sheets** → `sheet-index.html`; small **Week** pill → `index.html`. Eyebrow also → sheets home.
3. **Week board** (`index.html`) — **Sheets** pill → sheets home; Ainsley / Hayes / Harris who-chips + day chips → `kid-*.html`; Sat chores block → `sheet-chores.html`.
4. **Kid boards** — same Sheets / Week chrome; footer **Chores** + **Stars ★** → those sheets.
5. **Sheet bodies** — kid chips / vote chips / treat names link to the matching kid board when present.

Relative paths only. Visual lock: soft glass, kids-first, zero homework vibe.

## Screenshots

| Plate | Size | Path |
|-------|------|------|
| Sheets index · tablet | 1080×1920 | `/workspace/board-os-house-index.png` |
| Sheets index · phone | 1170×731 | `/workspace/board-os-house-index-phone.png` |
| Gallery hero eight · phone | 1170×731 | `/workspace/board-os-house-gallery-phone.png` |
| Gallery full · phone | 1170×2000 | `/workspace/board-os-house-gallery-full-phone.png` |
| Desk · PIN gate · tablet | 1080×1920 | `/workspace/board-os-house-desk-gate.png` |
| Desk · PIN gate · phone | 1170×731 | `/workspace/board-os-house-desk-gate-phone.png` |
| Status stack · tablet | 1080×1920 | `/workspace/board-os-house-status.png` |
| Status stack · phone | 1170×731 | `/workspace/board-os-house-status-phone.png` |

Reference week plate: `/workspace/board-os-house-face.png`.
