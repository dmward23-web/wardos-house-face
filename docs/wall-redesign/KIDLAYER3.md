# KID LAYER v3 · wall.html (Wright, Thu Oct 1 2026 ~6:15 PM CT, branch `wall-redesign-1`)

Brief: `BRIEF.md` "KID LAYER v3". Code: `house-wall-kid.js` (UMD `HouseWallKid`), `config/wall-kid.config.json`, wall.html kid band. Tests: `node scripts/wall/kid-layer.test.mjs` (20), `node scripts/wall/wall-guards.test.mjs` (11).

## Kid tiles (the name is the button)
- One tile per kid (Ainsley · Hayes · Harris), in the actuator band. Hidden in **Kids away**. No kid colors (name + small mark only).
- **Name button = check-in.** Writes Atlas's who-home shape `{date, kids:[{id,name,checkedInAt}]}` to localStorage `wardos-wall-whohome` (per device; house day resets 3:00 AM CT). Merged with `data/who-home.json` for the Who's home row. **No writer to the file, no new `/api/taps` key** (`TAP_KEY_RE` untouched).
- **Chore done** fills today's mark: localStorage `wardos-wall-mark:<kid>:<CT date>`. Wall-only. **Never writes `house-checkoffs:*` or `house-bank:*`** (that book banks stars toward the jar). So wall marks are **not synced** to the MUSTS book (gap).
- The first mark of the day calls the hall flash once; repeat taps don't.

## Hall flash
- Uses the **existing** Kasa client only: `HouseLights.setLight(id,{on})` → existing lights proxy. No new scene, no per-kid pattern, no color.
- Pattern (shared): capture each listed light's prior on/off from `HouseLights.effectiveLights()`, invert it, and after **2000 ms** set each back to its captured prior. A light with an unknown prior (`on:null`) is skipped, never guessed.
- **Debounce:** no new flash while one runs, or within `flashCooldownMs` (15 s) of the last restore. Taps during that time return `debounced` and send nothing.
- **No key → zero requests, no flash** (`NEED KEY`). Lights client can't write → `lights offline`, nothing sent.
- `harris-room` is **never** flashed, even if listed (`NEVER_FLASH`).
- **Lights used: NONE. `hallFlashLightIds: []`. No hall light confirmed.** Evidence:
  - `WALL-STATION.md:16`: the panel is on the "Hallway column … Not the kitchen. Not a tabletop." It doesn't say which room lights can be seen from there.
  - `data/lights-live.json` roster `where` values are just the room names: "Dining Room", "Harris's Room", "Kitchen". Nothing says any of them is in view of the hall.
  - `SCENES.md` / the lights notes: no hall light, and no Google Home or Kasa scene exists. The brief (line 92) asks for "a 2-second, already-owned light flash in the hall"; no such owned flash or scene exists, so nothing is recalled.
  - To turn the flash on: Dan confirms which of `dining-room` / `kitchen` can be seen from the hall, and its id is added to `config/wall-kid.config.json`. No code change needed.

## Seats (Atlas `data/kid-seats.json`, ATLASLANE4/5 @ 1163be5, read only)
Valid only when `asOfIso` = today (CT), `generatedAt` ≤ 24 h, and `quiet !== true`. Otherwise the tile is just the name and Chore done.
- **Harris:** Atlas's one mission for today (`mission.word`, e.g. "Shower") becomes his Chore done button label, in large type. The mark fills from Atlas's `today.closed` or from this screen's mark.
- **Hayes:** his week row (Mon–Sun). `closed` = filled; `empty` = an empty mark (never red, no name); `ahead` = dashed; `off` = dim. Atlas's `countdown.copy` sits beside it (e.g. "Flag · vs Ridley · 3 days").
- **Ainsley:** a small "Week closed" mark, only when `week.closed === true`. Nothing else, and no score.

## One-use unlocks (Atlas owns the data: `data/unlocks.json`)
Read only from Atlas's **`data/unlocks.json`** (on this branch since FF to 1163be5; `lit: []` today, so nothing shows). If the file is missing, not today's (`asOfIso`), more than 24 h old (`generatedAt`) or has no `lit[]`, every unlock is hidden. The wall never infers a close (not from MUSTS, the bank, the calendar or `kids-week.json`). Us together shows only when Atlas lists `house-weekend-pick`.

Schema the wall reads (Atlas's):
```json
{
  "asOfIso": "2026-10-01",
  "generatedAt": "2026-10-01T18:14:00-05:00",
  "week": { "id": "2026-09-25", "startsAt": "2026-09-25T15:00:00-05:00", "endsAt": "2026-10-02T15:00:00-05:00" },
  "lit": [
    { "id": "ainsley-gallery-or-weekend", "seat": "Ainsley", "control": "gallery-or-weekend", "tile": "Gallery or Weekend fun",
      "choices": ["gallery-photo", "weekend-pick"], "uses": 1, "earnedWeek": "2026-09-25",
      "copy": "Ainsley. Week closed. Gallery or weekend, your call." }
  ],
  "source": "…"
}
```
Fields the wall needs: `id`, `seat` ∈ Harris | Hayes | Ainsley | House, `control` or `choices[]` ∈ dinner-vote | weekend-pick | gallery-photo (anything else is not drawn), `earnedWeek`, and `copy` (shown as written).

| Atlas id | Seat | Control | Opens |
|---|---|---|---|
| `harris-dinner-vote` | Harris | Dinner vote | `sheet-dinner.html` (Vita) |
| `hayes-weekend-pick` | Hayes | Weekend fun | `sheet-weekend.html` |
| `ainsley-gallery-or-weekend` | Ainsley | Gallery photo **or** Weekend pick (one use between them) | `sheet-gallery-hero.html` / `sheet-weekend.html` |
| `house-weekend-pick` | House (Us together row; the rail badge lights) | Weekend fun | `sheet-weekend.html` |

- **One use each.** A spend appends Atlas's unlock-uses record `{unlock, weekId: earnedWeek, usedAt, choice?}` to localStorage `wardos-wall-unlock-uses`, using the shape `{note, uses[]}` of `data/unlock-uses.json`. The control then goes dark (disabled, "Used"). A newer `earnedWeek` lights it again (Atlas: no stacking).
- **Per device** for now. A spend on this screen is not seen by Atlas's script or by any other device until a shared write path is approved.
- **No jar control anywhere.**
