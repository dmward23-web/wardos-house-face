# House face — clickable tablet prototype

Kids-safe family board for the KS kitchen tablet test **and** the Overland Park hallway wall. Soft white/grey glass camo. **No money. No PIN.** Facts are mock / known-only — do not invent.

**Wall format law:** [WALL-STATION.md](WALL-STATION.md) — 27" landscape, 1920×1080 kiosk, home is this index. Prism owns the picture. Wright owns the kit. Atlas leave-by only. Ledger / Harbor never paint this glass.

## Open

Forever URL: https://dmward23-web.github.io/wardos-house-face/sheet-index.html

Landscape **1920×1200** design canvas. Wall panel fits **1920×1080** (see WALL-STATION.md).

## Page map

| File | Role |
|------|------|
| `sheet-index.html` | **Home** — family sheets index |
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
| `sheet-load-day.html` | Load day |
| `sheet-desk-gate.html` | Desk · PIN boundary mock · no $ amounts |
| `sheet-status.html` | Status / stack inventory for Dan |
| `sheet-gallery.html` | Phone contact sheet |
| `sheet-gallery-hero.html` | Hero summary |

## Nav contract (inherit this)

1. **Sheets home** (`sheet-index.html`) — every tile is an `<a href>` to its page. Header **Week** → `index.html`.
2. **Every other page** — header **‹ Sheets** → `sheet-index.html`; small **Week** pill → `index.html`.
3. **Week board** (`index.html`) — **Sheets** pill → sheets home; kid chips → `kid-*.html`.
4. **Kid boards** — same Sheets / Week chrome.
5. Relative paths only. Visual lock: soft glass, kids-first, zero homework vibe.
