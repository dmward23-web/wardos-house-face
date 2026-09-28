# House Face · DATE LAW (forever · America/Chicago)

**Locked:** 2026-09-27 CT · after Sat-stuck-on-Sun failure  
**Amended:** 2026-09-28 CT · calendar auto-sync + Next Up live queue (past vanity / soft-miss)

## Root cause (why the board said Sat Sep 26 on Sun Sep 27)

1. **Hardcoded day stamps in HTML/JS** — `sheet-index.html`, `sheet-today.html`, `sheet-dan.html`, and `index.html` FACTS baked `Sat Sep 26` into the leave-by strip / today tile / week header.
2. **Manual restamp workflow** — agents refreshed `kids-week.json` + `kids-data.js` for Sunday, but left the family-home HTML on Saturday. Live Pages served the stale HTML.
3. **Not a GitHub Pages cache bug** — `kids-week.json` was already `Sun Sep 27`; the index never read it for the date label.
4. **Secondary:** `kids-data.js` `DAY_ISO` used the device local calendar (and a hardcoded `2026-09-26` fallback) instead of an explicit `America/Chicago` zone.

Timezone drift (UTC vs CT) was **not** the primary failure this time — pure **stale hardcoded copy**. The forever fix still forces Chicago so overnight UTC devices cannot shift the day.

## Root cause (Mon Sep 28 · past vanity + calendar miss)

1. Standing routine **House board calendar refresh** soft-failed / missed at ~7:41a CT — `kids-week.json` stayed `asOfIso=2026-09-27` with `boardStrip` = Ainsley vanity · Jessy (already over).
2. No durable script — agents hand-edited JSON; soft “already fresh” / partial runs left stale strip.
3. Live dmward23 creates (e.g. Busy `Leave · HD #2209 · return 5-drawer vanity` Wed Sep 30) did not trigger a board rewrite — morning-only agent path, no transform script.
4. Client strip trusted `boardStrip` even when `asOfIso` ≠ clock day — past items stayed on glass.

## Forever fix (do not undo)

| Piece | Role |
|-------|------|
| `house-clock.js` | Single source of “today” · `America/Chicago` via `Intl` · `short` / `long` / `iso` / `dow` / `daypart` |
| `house-board-strip.js` | Paints `[data-live=…]` leave-by + today labels from **clock** + `kids-week.json` `boardStrip` · **queue + startIso/endIso** · drops past items client-side · re-fetches ~5 min |
| `house-weather.js` | Client Open-Meteo (wttr.in fallback) · Overland Park / 147th · no key · no Atlas cron |
| `kids-week.json` → `boardStrip` | **Facts only** (time / place / detail / ISO / queue). **Never** put the calendar day label here for the strip — clock owns the day. |
| `kids-data.js` `DAY_ISO` | Chicago ISO for chore/bank day keys |
| `scripts/calendar-refresh.mjs` | **Durable** dmward23 events dump → rewrite schedule fields + boardStrip queue · preserve jars/quests · hard asOfIso=today |
| `scripts/house-board-calendar-refresh.sh` | Standing routine entry · gate fail if asOf ≠ today or strip head already ended |

### Law for agents

- **Never** hardcode `Sat Sep N` / `Sun Sep N` into house-face HTML again.
- Mark any visible date with `data-live="date-short"` / `leaveby-main` / `today-sub` / `dow`.
- Calendar **content** refresh updates `kids-week.json` (+ embed in `kids-data.js`) and `boardStrip` only — via **`scripts/house-board-calendar-refresh.sh`**, not hand JSON.
- After **any** dmward23 create / update / delete that changes kids or Busy leaves: run the same refresh (dump events → script → deploy). No manual ask.
- Soft-miss forbidden: if `asOfIso` ≠ today CT after the routine, **FAIL** (exit non-zero) — do not leave Sunday vanity on Monday glass.
- Deploy source of truth: edit `/workspace/wardos-house-face` **and** mirror into `/workspace/board-os/house-face` before `house-face-deploy.sh` (deploy copies board-os → repo). Script `--deploy` does this.

## Weather

Permanent glance card on `sheet-index.html` (+ week board `index.html`). Big temp + condition + today H/L. Kids-safe · no $ · no PIN · light camo.

## Routine · `House board calendar refresh`

**Armed:** yes (standing). Weekdays ~6:50 CT / weekends ~7:50 CT — and **on every dmward23 calendar write** (create/update/delete) that touches house/kids/leaves.

**Body (must):**

1. `list_events` dmward23 only · today CT → +7d (never Family).
2. Write dump to a workspace JSON path (not under Pages `data/` public if raw).
3. ` /workspace/wardos-house-face/scripts/house-board-calendar-refresh.sh <dump> --deploy `
4. Confirm Pages 200 + `kids-week.json` `asOfIso` == today + `boardStrip.place` is not a past event.
5. Quiet on success; ping Dan only on hard fail / custody conflict.

Do **not** restamp HTML dates. Dates are client-live forever.
