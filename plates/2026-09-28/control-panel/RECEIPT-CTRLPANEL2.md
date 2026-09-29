# CTRLPANEL2 · kid taps + lights STALE + who/quest

**When:** 2026-09-28 ~21:12 CT  
**Base:** HUBKIT1 `1c49f2a` on `main`

## Dan bugs
1. **Lights STALE** — Pages `lights-live.json` fetchedAt aged past 30m gate → pill STALE; `canWrite()` false → kid light rockers disabled.
2. **Who’s up / daily quest** — shells flashed `…` until cal prefetch; looked broken next to STALE.
3. **Kid board taps dead** (hub flips / claim / OPEN) — `enhanceHub` rebound `bindClaims`/`bindDots` on every pass (and once already inside `enhanceTile`) → **double claim handlers toggle twice → claim looks like a no-op**. Flip was swipe-only (≥36px); tap did nothing. OPEN was bare `<a>` after `<a.tile>`→`<div>` replace.

## Fix
- `house-kid-engage.js` CTRLPANEL2: bind-once guards (`data-kf-claims`, `data-kf-dotbind`, `data-kf-open`); tap-to-cycle; OPEN `location.assign`; early `enhanceHub` before cal returns.
- Cache bust `?v=CTRLPANEL2` on hub + kid boards for engage + kids-data.
- Refresh + ship `data/lights-live.json` (write proxy healthy). **sensi / nest untouched.**

## Verify
Local dump: 3× claims/open/dotbind/swipe guards · lights LIVE · who Hayes · quest Hayes · musts.
