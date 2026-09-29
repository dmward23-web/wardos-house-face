# HUBFMT1 · cam labels · CT times · header date

**When:** 2026-09-28 ~20:50 CT  
**Tip:** `1f4237d` · HUBFMT1 (cam-label / TIMEFMT / header)  
**Page:** https://dmward23-web.github.io/wardos-house-face/sheet-index.html

## Shipped

1. **Cam one status** — Hub deck paints JPEG stills only. Pill = **STILL** (fresh snap), **STALE**, **NEED TOKEN / NEED PROXY / STUB**. Never **LIVE** on hub tiles (LIVE reserved for WebRTC viewer). Foot `.hub-cam-kind` hidden so LIVE+STILL never double-stack.
2. **CT wall times** — `HouseClock.timeLabel` → `8:10 AM`. Board strip leave-by / layouts + who’s up / kid tiles use AM/PM (no bare `8:10`, no ISO/24h).
3. **Header date** — `.hdr-date-dow` ~44px high-contrast; `.hdr-date-long` = `Sep 28, 2026` (no weekday echo) at 20px.
4. **Header ovals** — Weather + Sensi only; Nest/Lights stay `display:none` (KIDSWAP1+HUBFMT1).

## Cams show now (hub deck)

| Cam | Status |
|-----|--------|
| Front door | **STILL** |
| Garage | **STILL** |
| Backyard | **STILL** |

(If snap ages out → STALE; if nest token/proxy missing → NEED TOKEN / NEED PROXY. Never LIVE+STILL.)

## Protected

- `data/sensi-live.json` / `data/nest-live.json` untouched (integrity hashes intact)
- Lights panel / SCHEDLOOK layouts / kid-engage claim path unchanged beyond time format

## Cache bust

`house-clock.js` · `house-board-strip.js` · `house-kid-engage.js` · `house-nest.js` → `?v=HUBFMT1`
