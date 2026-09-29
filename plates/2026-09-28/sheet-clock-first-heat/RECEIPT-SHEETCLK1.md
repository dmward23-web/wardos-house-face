# RECEIPT · SHEETCLK1 · Mon 28 Sep 2026 ~10:50p CT

Dan last-yes: House Face heat authorized until midnight CT Sep 28→29.
Chunk: roll clock-first CONTROL PANEL header DNA to sheets still showing WardOS mark + tagline.

## What shipped
- New shared tokens: `tokens-sheet-clock-first-heat.css?v=SHEETCLK1` (HEADER ONLY — cmd-panel body chrome untouched)
- Clock-first headers (`hdr--clockfirst` + `data-live-clock` + micros nav + status/mute tools)
- `house-clock.js?v=SHEETCLK1` on every touched sheet (added where missing on status / load-day / desk-gate)
- Killed `Climate · WardOS` merch → `Sensi · 147th` on `sheet-google-home.html`

## Sheets heated
1. `sheet-lights.html` — clock + Cams/Sheets + NEED TOKEN pill
2. `sheet-sensi.html` — clock + Cams/Sheets + NEED TOKEN pill
3. `sheet-google-home.html` — clock + Home/Week + CLIMATE + CAMS pill · climate title fixed
4. `sheet-chores.html` — clock + Home/Week + mute
5. `sheet-allowance.html` — clock + Home/Week + mute
6. `sheet-status.html` (bonus)
7. `sheet-load-day.html` (bonus)
8. `sheet-desk-gate.html` (bonus)

## Protect (confirmed)
- `data/sensi-live.json` · `data/nest-live.json` · any `data/*.json` — **untouched**
- Lights write proxy / nest webrtc script tags left alone (`house-lights.js` / `house-nest.js` / `house-sensi.js`)
- Jar math body copy left alone (Ainsley Tour Jar $20 · Hayes Victory Jar $10 · Harris Gem Jar as previously on board)
- Hub / kids / dad / today / weekend / us — **not regresssed** (not in this commit)

## Hard-refresh tips
- …/sheet-lights.html?v=SHEETCLK1
- …/sheet-sensi.html?v=SHEETCLK1
- …/sheet-google-home.html?v=SHEETCLK1
- …/sheet-chores.html?v=SHEETCLK1
- …/sheet-allowance.html?v=SHEETCLK1

## Still needs heat next
- Remaining sheets that still carry WardOS mark/tagline in chrome (e.g. sheet-index if not already HUBCLK1-complete, sheet-groceries, sheet-dinner, sheet-pack, sheet-countdowns, sheet-win, sheet-gallery*) — audit + same SHEETCLK1 DNA
- Optional: wire live Wx/Sensi ° into sheet ovals where ambient data already paints (lights/cams)
- Pre-theme kid files — skip (per brief)
