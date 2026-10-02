# WALL BUILD · wall.html vs Prism's plate (Wright, Thu Oct 1 2026, branch `wall-redesign-1`)

Render: `plates/2026-10-01/redesign/wright/wall-build-2560.png` (2560x1440, headless, no key), plus `wall-build-2560-key-armed.png` (fake key, hub replies mocked, Travel armed), `wall-build-1920.png`, `wall-build-1080x1920.png`.
Rule: a tile is drawn only when it has a live source. No placeholders. No plate sample data copied.

## Built
| Plate area | wall.html | Source |
|---|---|---|
| Header (tap → `sheet-index.html`) | WardOS mark, live CT clock + date, stale dot (`stale · thermostat, cams` / `feeds fresh`), Main board | browser clock; `staleFeeds()` over present feeds |
| House mode chip | **shown**: the file's label (`After school` at render); `kids-away` always reads **Kids away**; Nashville week only from the file | `data/house-mode.json` (Atlas, merged @ 4b288a4): `mode` key + `label`, `asOfIso` = today, now inside `since..until` |
| Pickup chain | **shown**: up to 4 cells, `now` / `next` / `later` re-derived from the clock, ended rows dropped; `Dad → Hayes` when `by` is set; leave-by in the tag; gear line only when the file lists gear; "ends 7:00 PM" from `cutoff` | `data/pickup-chain.json`: `asOfIso` + `date` = today, `generatedAt` ≤ 6 h, before `cutoff`, Ward kids only |
| NEXT UP | time + the calendar's own words + `ends h:mm` (place only when not already in the words; long text wraps to 2 lines, never cut) | `data/cal-live.json` `nextLeave`, live + ≤ 6 h + `asOfIso` = today, timed, not over |
| House actuator | **I'm home** / **Leaving** (Dan's Kasa scenes) | `HouseLights.setLight`; no key → `NEED KEY`, 0 requests |
| Thermostat actuator (**deviation: not on the plate**) | **Travel / Back home**, arm-then-confirm | THERMO-TRAVEL.md |
| Status lights | thermostat `73° · after school` (mode label from house-mode.json, no flag while `house-mode-temps.json` targets are null) or `Travel · 55–85`; `Laundry NEED TOKEN` | `statusStrip()` + `bandsFromTemps()` (mirror of Atlas's) |
| Rail | **17 badges** (JAR REMOVED: Reward jar, Chores MUSTS and the 3 kid pages dropped), the plate's names, groups and icons, repo-relative links, `data-owner` per badge | static |
| Footer | real as-of stamps (CT) of each loaded feed; modes list with **Kids away** | feed `fetchedAt` / `updatedAt` |

## Hidden (no source or gated)
- **Who's home**: wired (`whoHome()`), hidden. `data/who-home.json` is Atlas's all-null seed and nothing writes it (check-ins are per-device; no writer built). Shows only once a kid has a real check-in for the current house day (3 AM CT reset); hidden in Kids away.
- **Pack**: wired (`packFlags()`), hidden. `data/pack-flags.json` has no flags. Shows today's flags only (date = today, before `clearsAt`, created today, one of the three kids, ≤ 60 chars). Read-only: no flag button (no writer).
- **Check in**: built as the kid name button (KIDLAYER3.md). Per-device only; **no new key added to the hub `/api/taps` allowlist** (`TAP_KEY_RE` untouched, Dan's last-yes list).
- Reward jar (replaced by Ledger's balance-free jar tile: NICE-ONE.md), Dinner vote (Vita's rail badge only; no kid unlock), Ask pip (**PARKED**), Open loops (no source), cams light (`online:null`), doors (no source), Load day (no live source), dragon (never), pond (no source).
Merged render (Atlas data): `wall-build-2560-merged.png` (~5:56 PM CT). `wall-build-2560-merged-sensi-fresh-mock.png` is the same page with only the Sensi timestamp mocked fresh, to show the `73° · after school` line.
Thermostat light is also hidden whenever `sensi-live.json` is > 30 min old (it was at render time: 5:10 PM CT feed, render ~5:48 PM CT) unless the hub's live reading is available with a key.

## Deviations from the plate
1. Thermostat Travel button added (Dan asked). 2. Actuator band is two 560-px tiles that fill the free height (the plate's 7 columns are mostly hidden). 3. NEXT UP time carries a small AM/PM; text is the calendar's, not the plate's split "who · where". 4. `Laundry` light (owner ruling). 5. Footer lists only feeds wall.html reads. 6. Rail foot reads "Branch build. Not live." (no bot name). 7. FINISH v2 restyle (FINISH-V2.md). 8. Kid band (chore law) + Us together row (KIDLAYER3.md).

## Checks
scrollWidth = clientWidth at 2560x1440 / 1920x1080 / 1080x1920 (no sideways scroll). No-key run: **0 non-local requests** after forced taps on Leaving and Travel x2. GATE1 (`--file wall.html` too), GATE2, kids-safe voice: PASS.

## Known cross-lane mismatch (left as authored)
Atlas's `scripts/house/tests/wall-state.test.mjs` test 26 expects the thermostat text `73°, After school` (Wright's old bcd53ea stub). The owner ruling is `73° · after school`, which is what ships, so that one test fails (25/26). Its second half (Atlas's `{mode:{id,label}, bands}` call shape flags when a target is set) passes against this build. Fix belongs in Atlas's test line 49; not edited here.

## Update Oct 1 ~6:15 PM CT · FINISH v2 + KID LAYER v3 (on Atlas 3bde4a5, then FF to Atlas 1163be5)
- New render: `wall-build-2560-v2.png` (+ `-unlock-MOCK`, `wall-build-1080x1920-v2.png`, `hub-1080x1920-v2.png`).
- **Who's home** now shows once a kid taps their name on this screen. That's a per-device check-in merged with `data/who-home.json`.
- **Pickup chain** and **Open loops** show a one-line honest empty state instead of hiding.
- Check-in is built (KIDLAYER3.md). Reward jar and Chores badges are removed (JAR-REMOVED.md). Cams on the hub are removed (CAMOFF1.md).
- Atlas's wall-state test is fixed upstream in 3bde4a5 (28/28). The "Known cross-lane mismatch" below is closed.

## 2-tap paths
| From | To | Taps |
|---|---|---|
| Hub (`sheet-index.html`) | wall.html, with pickup chain + open loops on its face | 1 (`House panel · pickup · loops · gallery`) |
| Hub | Gallery / Needs photo (wall rail badges) | 2 (hub → wall → badge). Before this the hub had no gallery link at all. |
| wall.html | any rail board / Main board | 1 |

## Update Oct 1 ~6:35 PM CT · FIVE UPGRADES
See FIVE-UPGRADES.md. Old House and Thermostat actuator tiles moved into the top-band control panel. NEXT UP strip adds Atlas's leave-by line (hidden until next-up.json) and the house timer. Grocery tile = Ledger's module. Render: `wall-build-2560-v3.png`.

## Update Oct 1 ~8:40 PM CT · CHORE LAW (CHORELAW2, on Atlas ATLASLANE8 @ 0b1f4f0)
- The kid band follows `CHORE-LAW-2026-10-01.md` (KIDLAYER3.md has the only copy of the rules). Each tile shows its 4 MUSTS taps, the CHOICE claim (first tap owns it, siblings locked, no un-claim), CLOSE inside the 7:30–9:30 PM window, Pack on travel weeks (3 items, dark at the bag) and the Mystery close reveal (hidden until 4/4). All of it is read from `data/kid-seats.json`.
- The old "Chore done" mark, Harris's single weekday mission button, Ainsley's "Week closed" mark and the per-kid dinner-vote/gallery unlocks are removed. The kids-week quest chart is drawn nowhere on the wall or on the hub kid tiles.
- Taps write the existing `house-checkoffs:<kid>:<day>` keys. wall.html now loads `house-tapsync.js` (sync only with a saved key) and `house-sfx.js` (Harris's soft tick only).
- Ledger's jar tile (JAR1–JAR3, 23 tests) shows only `wallDisplay()`. Nice one adds time or picks, never cash (NICE-ONE.md).
