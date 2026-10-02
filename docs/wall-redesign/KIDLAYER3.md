# KID LAYER · chore law on wall.html + the hub kid tiles (Wright, branch `wall-redesign-1`)

**The law:** `plates/2026-10-01/redesign/CHORE-LAW-2026-10-01.md`, locked by Dan Thu Oct 1 2026 8:01 PM CT. It replaces every older wall chore-chart rule (the "Chore done" mark, the one Harris mission by weekday, the per-kid week-closed unlocks). This file is the only Wright copy of how the wall follows it.
**Data:** Atlas's `data/kid-seats.json` (ATLASLANE8 @ 0b1f4f0, `docs/wall-redesign/ATLAS-DATA-LANE.md` "Chore law"). Every id, word and window on the kid tiles comes from that file. The wall writes no copy of its own for chores.
**Code:** `house-wall-kid.js` (UMD `HouseWallKid`, pure rules) · `wall.html` kid band · `house-kid-engage.js` (hub kid tiles, Chores face) · `config/wall-kid.config.json` (hall flash only).
**Tests:** `node scripts/wall/kid-layer.test.mjs` (26) · `node scripts/wall/wall-guards.test.mjs` (30).

## When the tiles show anything
Only when `kid-seats.json` has `asOfIso` = today (CT), `generatedAt` ≤ 24 h old, and `quiet !== true`. If any of those fails, the tile shows the kid's name (check-in) and nothing else. Nothing is ever inferred. The kid band is hidden in **Kids away**. Seat order is fixed (Ainsley · Hayes · Harris in the markup) and never sorted by results. **No leaderboard.**

## Controls (each kid on their own tile)
| Control | Rule on the wall | Key written (`true`) |
|---|---|---|
| **MUSTS** | Atlas's four `seats.<kid>.musts[]` (Bed made / Hamper in / Dish to the sink / Own floor clear). Binary: a tap closes it and a second tap changes nothing. Capped at 4: a fifth entry is never drawn. **Dragon fed** replaces Hayes's fourth only when Atlas's data swaps it in (`musts.dragon.inHouse`, off now). | `house-checkoffs:<kid>:<day>` → `must-bed` / `must-hamper` / `must-dish` / `must-floor` / `must-dragon` |
| **CHOICE** | One shared job (`choice.job.word`). While nobody owns it and it's before `choice.lockAt` (5:00 PM), each tile shows the job with "First tap owns it." (Atlas's wording). The first tap owns it, and every sibling's claim button disappears. A sibling's tap writes nothing. **There is no un-claim.** Atlas's `claimedBy` (a claim from another device) wins. The owner then sees the job as a done tap. Unclaimed at 5:00 PM = Atlas's Dad Seat exception, so no kid tile shows it. | `choice-claim`, then `choice-done` (owner only) |
| **CLOSE** | Shown only inside Atlas's window (`close.opensAt`–`close.closesAt`, 7:30–9:30 PM) and only for kids in `close.kids` (home tonight). Each tap writes only that kid's key. The law's "90 seconds at the wall" is the routine, not a timer. | `close` |
| **Pack** | Only when `pack.travelWeek` is true and `pack.dark` is false. At most 3 items, using Atlas's words and ids (`pack-dragon` / `pack-bag` / `pack-charger`); any other id is not drawn. It goes **dark on every seat** once `pack-bag` is tapped (Atlas: any kid). | `house-checkoffs:<kid>:week:<Sunday>` → `pack-*` |
| **Mystery close** | Only when Atlas puts `seats.<kid>.mystery` on that kid's seat (one Mon–Thu day a week). It stays hidden until that kid's 4 MUSTS are closed, both on this screen and in Atlas's data (`hidden:false` + `copy`). It is time and picks, never money. | none (a reveal only) |

Keys are the **existing** hub keys (`house-tapsync.js` `KEY_RE`), with the house day that resets at 3:00 AM CT. `wall.html` now loads `house-tapsync.js`, so the taps go to the hub when a key is saved on the screen. With no key it shows "taps: this device only" and sends nothing. `TAP_KEY_RE` / the hub allowlist is unchanged. The wall never writes `house-bank:*`, any jar key, or anything with money in it.

## Age changes the reward, not the standard
- **Harris:** the tile fill (`data-law-fill`, a quarter per MUST) updates in the same paint as the tap, so it fills in the same minute. A tap that closes a MUST also plays the **existing** soft tick from `house-sfx.js` (`HouseSfx.tap`: one 40 ms tick at about 0.04 gain, honours the house mute, ambient stays off). No other seat makes a sound. His run comes from Atlas's `streak.days` in Atlas's wording ("3 days."). A miss **pauses** the run (`paused`); there is no reset or miss copy.
- **Hayes:** his run (`streak.days`, same wording), plus "Captain tonight." when `captainTonight` is true. His Mon–Sun row and Atlas's `countdown.copy` stay.
- **Ainsley:** no stars, no counts, no fill, no sound. Her seat shows only Atlas's `trustedWith[]` and her rare `line` when Atlas sets one.

## Hub kid tiles (one chore copy)
On `sheet-index.html`, the kid flip tile's **Chores** face lists the same 4 law MUSTS, plus the CHOICE claim/done, from `kid-seats.json` via `HouseWallKid`. It writes the same keys. The tile's Musts count and run come from the law too. The old `kids-week.json` quest chart is no longer drawn on the wall or on those tiles. **The quest data is not deleted** (Atlas retires it at merge). The kid boards (`kid-*.html`) still show their own quest lists (gap).

## Kept from the earlier kid layer
- **Name button = check-in.** Writes Atlas's who-home shape to localStorage `wardos-wall-whohome` (per device, 3:00 AM reset) and merges it with `data/who-home.json`.
- **Hall flash:** the existing Kasa client only (`HouseLights.setLight`). It inverts each listed light for 2000 ms and then restores its captured prior state. A light with an unknown prior is skipped. Debounced for 15 s. No key → zero requests. `harris-room` is never flashed. It fires once, when a kid's fourth MUST closes. **`hallFlashLightIds: []`: no hall light has been confirmed**, so nothing flashes until Dan names one in `config/wall-kid.config.json`.
- **Weekend fun:** the only unlock control left (`CONTROL = {weekend-pick}`), from Atlas's `data/unlocks.json` `house-weekend-pick` (Us together, 10 of 12 closes). One use per earned week, per device (`wardos-wall-unlock-uses`). The old per-kid dinner-vote and gallery unlocks are gone.
- **Jar:** Ledger's tile (`HouseJar.wallDisplay()`: rule, names, sync). It shows no numbers. See NICE-ONE.md.
