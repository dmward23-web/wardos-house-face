# JAR REMOVED · nothing reachable from the wall shows $ (Wright, Thu Oct 1 2026, branch `wall-redesign-1`)

Ruling: no jar, balance, $x/$goal, payout or per-chore $ on the hallway panel. No hidden jar widget and no replacement money tile. **No jar control anywhere.**

## $ scan (headless render of each wall rail target + the hub, 1080x1920, Oct 1 ~6:00 PM CT)
| Page | `$` shown | "jar" shown |
|---|---|---|
| kid-ainsley, kid-harris, kid-hayes, sheet-allowance, sheet-chores | **yes** | |
| sheet-today | no | "Musts · Jar · Days on board" |
| sheet-weekend | no | "LIVE jar" (the ideas jar) |
| sheet-index (hub) | no | "Jars · payday with Dad" tile → sheet-allowance |
| month, countdowns, dan, desk-gate, dinner, gallery-hero, gallery, google-home, groceries, load-day, pack, status, us, win | no | no |

## Dropped from the wall rail (22 → 17 badges)
Reward jar (`sheet-allowance.html`), Chores MUSTS (`sheet-chores.html`), Ainsley / Hayes / Harris (`kid-*.html`). People is now Dad Seat and Us together. The kid layer lives on the wall face instead (KIDLAYER3.md). `build_wall.py` filters these out, and `wall-guards.test.mjs` fails if any comes back.

## Still reachable (gaps, not my files or not in scope)
- Hub: the "Show me the Money · Jars" tile, plus links to sheet-allowance and the kid pages.
- Second hop: sheet-today links to allowance, chores and the kid pages.
- "jar" wording on sheet-today, sheet-weekend and the hub.
- Prism's `TILE-INVENTORY.md` still lists the Reward jar (Prism's file; not edited).
