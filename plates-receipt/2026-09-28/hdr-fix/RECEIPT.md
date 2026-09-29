# HDRFIX1 · hub header hierarchy · high-contrast date

**When:** 2026-09-28 ~21:00 CT  
**Tip:** `TIPSHA` · HDRFIX1  
**Base:** HUBTOK1 (`f98caa8`) shared tokens untouched  
**Page:** https://dmward23-web.github.io/wardos-house-face/sheet-index.html

## Before → After

| | Before (phone) | After |
|--|----------------|-------|
| Brand | WARDOS · HOUSE FACE stacked over truncated `The War…` | Full **The Ward's** gold, no clip |
| Tagline | Low-contrast / buried under Week pill | **Mission hub · tap a sheet** readable |
| Week | Overlapped name | Own lane, no overlap |
| Date | Dark ink on heat-v3 dark glass (Alfred P0 fail) | **TODAY** amber · **Mon** 44px white · **Sep 28, 2026** bright on dark plate |
| Ovals | Weather+Sensi (kept) | Weather+Sensi only (Nest/Lights still force-hidden) |

## Shipped

1. `#hdr-fix1` style block after kid-engage (loads after heat-v3) — solid gold name (kills transparent clip ghost), brighter tagline, brand `min-width: max-content` so flex can’t crush “The Ward’s”.
2. Date P0 — light high-contrast ink on dark glass; DOW stays **44px**; kicker amber; long line white; subtle dark plate behind date.
3. Weather cond max-width bumped (P2) so condition breathes.
4. **No token dual-DNA** — `tokens-hub-command-deck-*.css?v=HUBTOK1` links unchanged; no `tokens-ctrlpanel.css`.

## Protected

- Cams / leave-by / lights panel untouched
- `data/sensi-live.json` / `data/nest-live.json` not modified
- HUBTOK1 shared+hotter token files not modified

## Proof

- `plates/2026-09-28/hdr-fix/hub-header-after.png`
- `plates/2026-09-28/hdr-fix/hub-header-crop.png`
