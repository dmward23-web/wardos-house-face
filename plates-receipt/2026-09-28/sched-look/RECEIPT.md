# SCHEDLOOK2 · leave-by layout switcher fixed

**When:** 2026-09-28 ~20:30 CT  
**Tip:** (filled at commit)  
**Page:** https://dmward23-web.github.io/wardos-house-face/sheet-index.html

## Root cause

LEAVESCRUB2 correctly hid `.leaveby-sched` chrome, and SCHEDLOOK1 added chips + `.leaveby-layouts`.  
But the hero time stayed at `clamp(72–108px)` inside a fixed `--hub-command-h: 420px` tile with `overflow: hidden`.  
Flex gave `.leaveby-layouts` `min-height: 0` + `overflow: hidden`, so the layout body crushed to ~0 height.  
Chips existed in the DOM and handlers wrote `localStorage.wardos.leaveby.layout`, but the detail region was invisible / untappable on the wall.

## Fix (SCHEDLOOK2)

1. Shrink hero when switcher present: time `clamp(42px, 5.5vw, 64px)`, dest 16px (critical `#sched-look2` + CSS).
2. `.leaveby-layouts`: `flex: 1 1 140px`, `min-height: 140px`, `overflow: auto` — LEAVESCRUB2 still hides `.leaveby-sched` only.
3. Chips: `pointer-events: auto`, `pointerdown`+`click` (debounced), min tap 28×44.
4. Visible mode label (`[data-live=leaveby-mode]`) + `Layout · <strong>` banner on paint.
5. **Swipe:** horizontal pointer gesture on `.leaveby` cycles Rail→Who→Peek→Radar→List (left=next, right=prev); chips still work.
6. Cache-bust `?v=SCHEDLOOK2` on strip JS + hotter CSS; critical style id `sched-look2`.

## Protected

Untouched: nest / sensi / lights JS·HTML·docs·proxies.

## Proof (headless CDP, Elo 1920×1080, offsetHeight)

- leave tile height 420; layouts offsetHeight **236** (≥140); sched still `display:none`
- chips visible & ≥28×44; `setLayout` flips Rail/Who/Peek/Radar/List + `wardos.leaveby.layout`
- swipe left list→rail; swipe right rail→list
- chip pointerdown list→peek; mode label + banner update

See `proof-cdp.json` beside this receipt.
