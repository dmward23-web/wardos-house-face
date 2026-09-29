# HUBSCROLL1 · tile scroll · Who’s Up quiet · kid-first schedule · SPECIALS · time pill kill

**When:** 2026-09-28 ~21:25 CT  
**Page:** https://dmward23-web.github.io/wardos-house-face/sheet-index.html

## Shipped

1. **Main board tile scroll** — leave-by layouts, lights grid, kid flip / sheet roster tiles, who’s-up, cmd-panel shells: `overflow-y: auto`, `touch-action: pan-y`, no `overflow:hidden` glue. Leave-by keeps `pan-y` so JS horizontal layout swipe still works.
2. **Who’s Up** — lights only inside active leave window (45m before start → end). Quiet otherwise (`Quiet · No leave window`). Shared leaves name **Hayes + Harris** (Boys → both).
3. **Schedule kid-first** — swim / sports / school prioritized; Hank/Amazon noise deprioritized. Tomorrow list no longer hard-caps kid rows at 4 (swim + flag kept).
4. **Boys daily SPECIAL** — sourced only: Hayes Ms. Allen rotation (Mon Art · Tue Spanish · Wed Music · Thu PE · Fri Art). Harris: Thu PE from Kysa cal notes only (no invented week).
5. **Leave-by time pill kill** — white inset/outline/border/box-shadow on huge `.leaveby-main .time` (and Peek time) removed so digits aren’t cut by a white rect.

## Protected

- `data/sensi-live.json` / `data/nest-live.json` untouched  
- Shared `--cmd-*` tokens only (no second palette)  
- Leave-by horizontal swipe preserved (`touch-action: pan-y` + JS)

## Verified (local headless 1080×1920)

- Time: `background:none`, `box-shadow:none`, `outline:none`  
- Who’s Up Mon 9:19p: Quiet  
- Tomorrow list includes Ainsley swim + Hayes flag  
- `.leaveby-layouts` scrollable (`overflow-y:auto`, glue=false)  
- Hayes board shows Special · Art (Mon) from Ms. Allen source  
