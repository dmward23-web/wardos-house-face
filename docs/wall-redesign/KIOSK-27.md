# KIOSK 27" · wall.html layout (branch `wall-redesign-1`)

## Ruling (redesign owner, Thu Oct 1 2026)
- Hallway panel is **27" landscape, 2560x1440**. This **supersedes `WALL-STATION.md`'s 32" Elo portrait 1080x1920 spec for the hallway wall**.
- **Scroll is allowed, vertical only. Never sideways.**
- Kid and sheet boards must keep working at 1080x1920 portrait and phone sizes. They don't load this CSS, so nothing changes for them (`kid-ioscroll.css` etc. untouched).

## How wall.html fits
- Geometry is the plate's: a 2560-wide panel, columns `1fr 404px`, header 132, footer 30, rail on the right.
- `fit()` sets `zoom = viewport width / 2560` on landscape screens (≥ 1.3:1), so a 1920x1080 or a 2560x1440 panel shows the same layout. Measured: scrollWidth = clientWidth at 2560x1440, 1920x1080 and 1080x1920.
- Portrait / narrow screens get `body.is-stacked`: one column on a 1280 basis (zoom = width / 1280), rail under the main column, vertical scroll.
- Hidden tiles take no space. The actuator band grows to fill the free height so taps stay kid-height (≥112 px; 2 taps fill the band at 2560).
- Scope: every rule is under `body.wall-kiosk`. Only `wall.html` links `tokens-wall-kiosk27.css`.

## Open for Dan
- Panel model: UNKNOWN. Boot URL for the kiosk: UNKNOWN (suggest `wall.html` fullscreen). Hardware HOLD in WALL-STATION.md still applies to purchase.
