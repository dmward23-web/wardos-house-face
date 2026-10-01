# OPEN LOOPS · Wright · 27" wall strip (plan; stub filter + ranker in `house-wall-status.js`)

**Max 3. House objects only. Empty = the strip is hidden** (no "All clear", no placeholder, no empty frame).
An item is "dead" (dropped, never rendered) if it isn't a house object.

## What counts

A loop is a **physical thing at the 147th house** that's in a not-done state: a device, door, light, filter, appliance, yard/lawn item, or fixture.
Each item must carry a machine `object` (the thing) + `state` (what's wrong) from a source feed. No free-typed chat lines.

## Hard excludes (item dropped, never shown)

| Exclude | Why | How the stub catches it (`isHouseLoop`) |
|---|---|---|
| Money | WALL-STATION + brief: no bills, balances, Autopay, Wells, card, `$` | `$` or bill/balance/autopay/wells/card/pay/owe/cost/price/buy/bid/quote/invoice/refund/ledger/cash/budget/dollar |
| People / relationship | No hallway people-text, no Erin legal, no Harbor drafts | person names (Hayes, Ainsley, Harris, Erin, Kristin, Dan, mom, dad, coach...) and text/email/call/reply/legal/court/therapy |
| Kid dollars | Ledger + Alfred PASS lane | jar, gem, star, allowance, payday, reward |
| Not a house object | brief: "dead if not a house object" | `kind !== "house-object"` or no `object` |
| Work detail, 9am Midwest Anxiety item | brief NEVER list | not a house object, plus the people filter |

The people check runs on the item's text **minus its own device name**, so "Harris's Room light offline" (a real Kasa device, `data/lights-live.json`) survives. A device name has to come from a live roster, not typed text.

## Sources (what exists today vs. what's needed)

| Source | Fields | Loop it yields | Status |
|---|---|---|---|
| `data/lights-live.json` | `lights[].name`, `.online`, `fetchedAt` | `Kitchen light offline` when `online === false` | **EXISTS** (all 3 online at 5:14 PM CT Oct 1) |
| `data/sensi-live.json` | `thermostat.online` | covered by the thermostat status light | not duplicated here (one owner per item) |
| `data/nest-live.json` | `cameras[].online` | covered by the cams status light | not duplicated here |
| Garage / door state | open / unlocked | `Garage open`, `Back door unlocked` | **NONE.** NEED CONNECT (`sheet-google-home.html:381-405`) |
| House maintenance list (filters, bulbs, lawn, gutters, tree trim) | `object`, `state`, `due` | `HVAC filter due` | **NONE.** No feed on the box. Tree-trim bids live in the calendar dump (gitignored, not Pages) and are Ledger-gated, so they're out |
| Away-care (Nashville week) | pet / lawn / alarms | | **NONE** (see STATUS-LIGHTS §4) |

So today the only live source is Kasa light offline state. The strip will almost always be **hidden**. That's correct behavior, not a bug.

## Ranking (stable, deterministic)

1. `severity`: `safety` (door/garage/lock/alarm) > `device` (offline device) > `task` (maintenance due)
2. `due` ascending (soonest first; items with no due date go after dated ones)
3. `object` A→Z (tie-break so the order never jitters)

Cut to 3. No "+N more" (the hub sheet holds the full list).

## Stale

Each item carries `asOf` + its feed's fresh window (same constants as STATUS-LIGHTS). Stale item → dropped. Every item stale → strip hidden.

## Render (quiet)

One line per loop, `--cmd-mute` object + `--cmd-amber-hi` state, no icons that scream, no red. Tap → `sheet-google-home.html` (device loops) or the owning sheet. No dead ends.

## Needs

- A house-object feed (maintenance + door/garage state). Owner UNKNOWN. Wright can build the reader once a source exists. Not invented.


## In wall.html (Oct 1)
No loop source is wired yet, so `openLoops([])` is empty and the row is **hidden** (owner ruling: hidden when empty). Plate samples (Tree trim / Garage sale / Cleaners) are not copied.
