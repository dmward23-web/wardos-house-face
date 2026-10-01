# WALL BUILD · wall.html vs Prism's plate (Wright, Thu Oct 1 2026, branch `wall-redesign-1`)

Render: `plates/2026-10-01/redesign/wright/wall-build-2560.png` (2560x1440, headless, no key), plus `wall-build-2560-key-armed.png` (fake key, hub replies mocked, Travel armed), `wall-build-1920.png`, `wall-build-1080x1920.png`.
Rule: a tile is drawn only when it has a live source. No placeholders. No plate sample data copied.

## Built
| Plate area | wall.html | Source |
|---|---|---|
| Header (tap → `sheet-index.html`) | WardOS mark, live CT clock + date, stale dot (`stale · thermostat, cams` / `feeds fresh`), Main board | browser clock; `staleFeeds()` over present feeds |
| House mode chip | built, **hidden** (no `data/house-mode.json` yet) | `readHouseMode()` |
| NEXT UP | time + the calendar's own words + `ends h:mm` (place only when not already in the words; long text wraps to 2 lines, never cut) | `data/cal-live.json` `nextLeave`, live + ≤ 6 h + `asOfIso` = today, timed, not over |
| House actuator | **I'm home** / **Leaving** (Dan's Kasa scenes) | `HouseLights.setLight`; no key → `NEED KEY`, 0 requests |
| Thermostat actuator (**deviation: not on the plate**) | **Travel / Back home**, arm-then-confirm | THERMO-TRAVEL.md |
| Status lights | thermostat (`73°` · plain, or `Travel · 55–85`), `Laundry NEED TOKEN` | `statusStrip()` |
| Rail | all 22 badges, the plate's names, groups and icons, repo-relative links | static |
| Footer | real as-of stamps (CT) of each loaded feed; modes list with **Kids away** | feed `fetchedAt` / `updatedAt` |

## Hidden (no source or gated)
Pickup chain, Who's home (Atlas files absent), Check in, Chore done, Reward jar (Alfred PASS pending), Dinner vote (no picks), Pack flag (`pack-flags.json` absent), Ask pip (**PARKED**), Open loops (no source → empty → hidden), cams light (`online:null`), doors (no source), Load day (no live source), dragon (never), pond (no source), house-mode chip.
Thermostat light is also hidden whenever `sensi-live.json` is > 30 min old (it was at render time: 5:10 PM CT feed, render ~5:48 PM CT) unless the hub's live reading is available with a key.

## Deviations from the plate
1. Thermostat Travel button added (Dan asked). 2. Actuator band is two 560-px tiles that fill the free height (the plate's 7 columns are mostly hidden). 3. NEXT UP time carries a small AM/PM; text is the calendar's, not the plate's split "who · where". 4. `Laundry` light (owner ruling). 5. Footer lists only feeds wall.html reads. 6. Rail foot reads "Branch build · not live until Alfred PASS + Dan last-yes".

## Checks
scrollWidth = clientWidth at 2560x1440 / 1920x1080 / 1080x1920 (no sideways scroll). No-key run: **0 non-local requests** after forced taps on Leaving and Travel x2. GATE1 (`--file wall.html` too), GATE2, kids-safe voice: PASS.
