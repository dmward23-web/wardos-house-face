# HUBSCROLL2 · hide ALL scrollbar chrome · restore kid tap/OPEN → board

**When:** 2026-09-28 ~21:40 CT  
**Page:** https://dmward23-web.github.io/wardos-house-face/sheet-index.html

## Shipped

1. **Hide scrollbar chrome — ENTIRE House Face** — `html`, `body`, and `*` (`scrollbar-width: none`, `-ms-overflow-style: none`, `::-webkit-scrollbar { width:0; height:0; display:none }`). Lives in `house-engage.css` (every sheet), `tokens-ctrlpanel.css`, `kid-ioscroll.css`, plus early inline on hub `sheet-index.html`. Overflow scroll (touch + wheel) kept; Windows grey bar gone on Play sheet / OPEN tiles / leave-by / lights / kid chores / page.
2. **Kid tap/OPEN → board** — Ainsley / Hayes / Harris: tap (no drag) or **OPEN** → `kid-*.html`. Horizontal swipe still flips Day·Stars·Chores·Leave. Claims / dots unchanged. Removed tile `setPointerCapture` (stole pan-y + swallowed OPEN). Kid shell `overflow:hidden` so foot/OPEN stay hittable; `.kf-stage` still scrolls.

## Protected

- `data/sensi-live.json` / `data/nest-live.json` untouched  
- Shared `--cmd-*` tokens only  
- Leave-by horizontal swipe preserved  
- Flips + claims preserved  

## Cache bust

`house-engage.css?v=HUBSCROLL2` · `tokens-ctrlpanel.css?v=HUBSCROLL2` · `house-kid-engage.js?v=HUBSCROLL2` · `kid-ioscroll.css?v=HUBSCROLL2`
