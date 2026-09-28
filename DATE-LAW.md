# House Face · DATE LAW (forever · America/Chicago)

**Locked:** 2026-09-27 CT · after Sat-stuck-on-Sun failure

## Root cause (why the board said Sat Sep 26 on Sun Sep 27)

1. **Hardcoded day stamps in HTML/JS** — `sheet-index.html`, `sheet-today.html`, `sheet-dan.html`, and `index.html` FACTS baked `Sat Sep 26` into the leave-by strip / today tile / week header.
2. **Manual restamp workflow** — agents refreshed `kids-week.json` + `kids-data.js` for Sunday, but left the family-home HTML on Saturday. Live Pages served the stale HTML.
3. **Not a GitHub Pages cache bug** — `kids-week.json` was already `Sun Sep 27`; the index never read it for the date label.
4. **Secondary:** `kids-data.js` `DAY_ISO` used the device local calendar (and a hardcoded `2026-09-26` fallback) instead of an explicit `America/Chicago` zone.

Timezone drift (UTC vs CT) was **not** the primary failure this time — pure **stale hardcoded copy**. The forever fix still forces Chicago so overnight UTC devices cannot shift the day.

## Forever fix (do not undo)

| Piece | Role |
|-------|------|
| `house-clock.js` | Single source of “today” · `America/Chicago` via `Intl` · `short` / `long` / `iso` / `dow` / `daypart` |
| `house-board-strip.js` | Paints `[data-live=…]` leave-by + today labels from **clock** + `kids-week.json` `boardStrip` |
| `house-weather.js` | Client Open-Meteo (wttr.in fallback) · Overland Park / 147th · no key · no Atlas cron |
| `kids-week.json` → `boardStrip` | **Facts only** (time / place / detail). **Never** put the calendar day label here for the strip — clock owns the day. |
| `kids-data.js` `DAY_ISO` | Chicago ISO for chore/bank day keys |

### Law for agents

- **Never** hardcode `Sat Sep N` / `Sun Sep N` into house-face HTML again.
- Mark any visible date with `data-live="date-short"` / `leaveby-main` / `today-sub` / `dow`.
- Calendar **content** refresh updates `kids-week.json` (+ embed in `kids-data.js`) and `boardStrip` only.
- Deploy source of truth: edit `/workspace/wardos-house-face` **and** mirror into `/workspace/board-os/house-face` before `house-face-deploy.sh` (deploy copies board-os → repo).

## Weather

Permanent glance card on `sheet-index.html` (+ week board `index.html`). Big temp + condition + today H/L. Kids-safe · no $ · no PIN · light camo.

## Routine note · `house-board-calendar-refresh`

**Report only (Atlas owns arming):** Not found as an armed Notion agent/routine from this box (search returned empty; Notion agent search requires Business plan).  
**Recommendation:** Arm it **yes** for overnight/`kids-week.json` + `boardStrip` fact refresh — but it must **not** restamp HTML dates. Dates are client-live forever. If the routine currently rewrites `sheet-index.html` day strings, strip that step.

## Calendar live (CALFIX1 · 2026-09-28)

Silent day-lagged boardStrip (Sun vanity on Mon glass) is **forbidden**.
Authority: `data/cal-live.json` via `scripts/cal-from-events.mjs` (see **CAL-LIVE.md**).
`house-board-strip.js` fail-closes to **CAL STALE** when cal-live missing / aged >6h / `asOfIso` ≠ Chicago today — never paints lagged kids-week vanity as Next Up.
Past events DROP by calendar clock. No Wright cron — Atlas owns standing refresh / on-arrival.

