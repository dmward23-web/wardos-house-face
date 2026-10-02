# Atlas data lane · House Face wall redesign (branch `wall-redesign-atlas`)

Built on top of Wright's `wall-redesign-1` (bcd53ea). **Not wired.** No page loads these files, no cron runs the scripts, nothing deploys. Not for main until Prism plate + Alfred PASS + Dan's last-yes.
Read-only on calendars: the scripts read a calendar JSON dump already on the box. They never create, edit, rename, annotate, or delete an event.

| File | What |
|---|---|
| `scripts/house-mode.mjs` | writes `data/house-mode.json` (house-mode chip) |
| `scripts/pickup-chain.mjs` | writes `data/pickup-chain.json` (strip under NEXT UP) |
| `scripts/house/lib.mjs` | shared pure helpers: CT time, event normalize, kids-home spans, school day, dismissal, Nashville + exclusion, wall-safe scan |
| `scripts/house/wall-state.mjs` | pure helpers for who-home / pack-flags shapes + temps-to-bands for Wright's thermostat light |
| `config/house-mode.config.json` | bedtime 20:00, default dismissal 15:00, pickup cutoff 19:00, who-home reset 03:00, Nashville pattern + date-range exclusion |
| `data/house-mode-temps.json` | per-mode targets, all `null`, note "Awaiting Dan" |
| `data/who-home.json`, `data/pack-flags.json` | data shapes (seeded empty) |
| `data/house-mode-override.json` | **absent by default.** Guest / Quiet only (see below) |
| `scripts/house/tests/*.test.mjs` | `node --test scripts/house/tests/` |

## Run

```
node scripts/house-mode.mjs   [--data-dir data] [--cal-live …] [--events /workspace/cal-dmward23-week.json] [--kids-week …] [--now ISO] [--stdout]
node scripts/pickup-chain.mjs [--data-dir data] [--cal-live …] [--events /workspace/cal-dmward23-week.json] [--kids-week …] [--now ISO] [--stdout]
```

Inputs, in order: the repo's `data/cal-live.json` (if present and `status: "live"`) and `data/kids-week.json`; then the box dump `/workspace/cal-dmward23-week.json` as fallback. cal-live wins when both have the same event id. The dump also fills what cal-live never publishes: `Kids with Dan` spans and events that already started. With no `Kids with Dan` data at all, Kids away is **not evaluated** and a warning says so (never guessed).
Calendar window = cal-live `windowStart..windowEnd` (inclusive), else the dump's first..last event date. If now+7d falls outside it, `warnings[]` says `calendar window A..B does not reach now+7d (date)` in both outputs. Output goes to this repo's `data/`.

## House mode

`data/house-mode.json` = `{mode, label, since, until, asOfIso, generatedAt, source, reason, warnings}`. `mode` is the key; `label` is the chip text.

| key | label | when |
|---|---|---|
| `guest` / `quiet` | Guest / Quiet | manual only: `data/house-mode-override.json` = `{"mode":"guest","since":ISO?,"until":ISO,"note":"…"}`. `until` is required; expired or missing `until` = ignored. Any other mode in the file = ignored |
| `nashville-week` | Nashville week | an all-day event matching `^Dan( + Kids)? Nashville` covers now, today (CT) is not inside a `nashvilleWeek.excludeDateRanges` entry (Oct 2–12 2026 is excluded per Dan), **and the kids aren't home**. Once a `Kids with Dan` span covers now (handoff Fridays), Nashville week ends |
| `kids-away` | Kids away | no `Kids with Dan` calendar span covers now. Reason is `Kids away · back Fri 3:00` (or just `Kids away` if the return isn't in the data). Kid tiles go quiet; Dad Seat stays |
| `weekend` | Weekend | Sat/Sun. After 8 PM the house is on tomorrow's footing, so Fri 8 PM+ = Weekend |
| `day-off` | Day off | a weekday where every Ward kid has a no-school all-day event (`Ward Kids [AHH No School]`, `Ward Kids — no school …`, `Hayes + Harris — no school …`) and the kids are home. Night before after 8 PM = Day off |
| `after-school` | After school | school day, from dismissal to 8:00 PM bedtime |
| `school-day` | School day | school day before dismissal; also the evening after 8 PM before a school day ("school night") |

Precedence: override > Kids home (ends Nashville week) > Nashville week > Kids away > Day off / Weekend > After school > School day.

**How kids-away is detected:** the calendar's recurring all-week event `Kids with Dan` (Fri 3:00 PM → Fri 3:00 PM, plus one-offs like `Kids with Dan — Christmas morning`). Its `start.dateTime` / `end.dateTime` make the home spans; outside every span = kids away. `data/kids-week.json` → `homeWeek.endIso` is only a cross-check (warning if it disagrees). It can't be the primary signal: `homeWeek.with` is always `"Dad"` and `homeWeek` has no start time, so it can't say when the kids are away.

**Dismissal:** today's `… SRE pickup · 3:40` event, else `kids-week.json` `leaveBys.SRE_pickup` (`"leave 3:15 for 3:40"`), else 3:00 PM (config). LKMS (Ainsley) dismissal isn't in the data.

`since` / `until` are found by scanning the same rules (15 min steps, refined to the minute) inside the calendar dump's date range. `null` = the change is outside the data we have.

## Pickup chain

`data/pickup-chain.json` = `{asOfIso, generatedAt, date, schoolDay, cutoff, source, warnings[], rows[], reason}`.
Row = `{who[], by, what, where, time, timeIso, leaveBy, leaveByIso, gear[], status (now|next), kind (ride|activity), startIso, endIso}`.

- Today (CT) only, school days only, and **empty at/after 7:00 PM CT**.
- Rides: pick up / pickup / drop / drop-off / ride / carpool events naming Hayes, Ainsley, or Harris. Activities: kid sport / practice / game / swim / lesson / homework-help events away from home. In-school info (specials, spirit days, field trips, in-school parties) belongs to Pack/Today, not here.
- Never: Dan-only items, admin (`GET ·`, `REMIND ·`, `Atlas:`), work, health, money, lawyer items, or another family's kids. Every row and the whole file pass the wall-safe scan (`BANNED_PATTERNS` in `scripts/house/lib.mjs`) or the script refuses to write.
- Only rows while the kids are with Dad (a `Kids with Dan` span covers the event start). Kids-away reason: `Kids away · back Fri 3:00`.
- Cancelled events are dropped. Rows whose event already ended are dropped.
- `time` = the time stated in the event title (`· 3:40`, `5:00 practice`, `game 5:30`, `for 8:25`), else the event start.
- `leaveBy` = `leave H:MM` in the title, or the event start when it's earlier than the stated time (repo convention: `kids-week.json` `leaveBys.note` "event START = leave-by"). Never put on a row someone else drives.
- `gear` = gear words in the event title/description (cleats, glove, jersey, goggles, tennis shoes, library book…). Description text is never copied.
- Public JSON never names anyone's parent: parentheticals like `(Riley's …)` are dropped (`Casey's (Riley's …)` → `Casey's`); a row that still hits the banned list is not published.
- Public JSON is sentence case, operational, no exclamation marks. Banned in every public data file: see `BANNED_PATTERNS` in `scripts/house/lib.mjs` (money symbols and amounts, kid-reward words, account words, parent words). The kid-reward tile is off the wall: nothing in this lane reads or writes kid-reward or money data.

## Kid check-in · `data/who-home.json` (shape only, no server)

```json
{ "date": "2026-10-01", "resetsAt": "2026-10-02T03:00:00-05:00",
  "kids": [ {"id":"hayes","name":"Hayes","checkedInAt":null},
            {"id":"ainsley","name":"Ainsley","checkedInAt":null},
            {"id":"harris","name":"Harris","checkedInAt":null} ] }
```

`date` is the house day: the CT date of (now − 3h), so it resets at 3:00 AM CT. A `checkedInAt` from an earlier house day reads as `null` (`whoHomeFor()`). Feeds the top-band who-is-home line.

## Need a ride / gear missing · `data/pack-flags.json` (shape only)

```json
{ "date": "2026-10-01", "clearsAt": "2026-10-02T00:00:00-05:00",
  "flags": [ {"kid":"Hayes","text":"flag 5:30, cleats","createdAt":"2026-10-01T07:10:00-05:00"} ] }
```

Clears at the end of the CT day. `kid` must be one of the three names; `text` max 60 chars and must pass the wall-safe scan (`addPackFlag()` refuses otherwise).

## How a wall tap would write them (not built)

1. Tap on the wall → `checkIn(state, kidId, now)` / `addPackFlag(state, kid, text, now)` (pure, in `scripts/house/wall-state.mjs`; a browser copy would be the same logic).
2. **Today taps are per-device.** The wall would persist to that device's `localStorage` (as `house-checkoffs.js` does for chores). Another screen or phone won't see it.
3. `data/who-home.json` / `data/pack-flags.json` on GitHub Pages are static. A browser can't write them. The JSON files here are the shape plus an empty seed.
4. A shared path would reuse the existing house hub `/api/taps` (`scripts/lights-write-proxy.mjs`, same token + tunnel as TAPSYNC1). Today its `TAP_KEY_RE` only accepts `house-checkoffs:<kid>:<date>` keys, so check-ins/flags would need a new allowlisted key (e.g. `house-whohome:<date>`, `house-packflags:<date>`). That's a hub change (Wright's file) and needs Dan's yes. Not done here.

## Thermostat vs mode

`data/house-mode-temps.json` has a `heatSetpoint` / `coolSetpoint` per mode (8 modes incl. `day-off`), all `null` ("Awaiting Dan"). `bandsFromTemps()` turns only non-null targets into Wright's `thermoLight` bands (`bands[mode.id]`), so with all-null targets the light shows `73° · after school` and never flags. Pass `{id: houseMode.mode, label: houseMode.label}` as Wright's `mode`.

## Samples (real box data, `--now` simulated)

`docs/wall-redesign/atlas-samples/`: house-mode + pickup-chain for Thu Oct 1 7:30 AM, Fri Oct 2 7:30 AM (school-day morning), and Mon Oct 5 7:30 AM (inside the excluded trip dates: Kids away, not Nashville week). Simulated future runs carry the expected `calendar dump older than 6h` / `kids-week.json asOfIso is not today` warnings.
`data/house-mode.json` and `data/pickup-chain.json` on this branch are a real-data run pinned to `--now 2026-10-01T17:48:00-05:00` (Wright's wall tests read this snapshot at 5:50 PM CT).

## Kid layer v3 (data + rules only, no UI)

`node scripts/kid-layer.mjs [--data-dir data] [--taps <file>] [--uses data/unlock-uses.json] [--now ISO]` writes `data/kid-seats.json` + `data/unlocks.json`. Rules: `scripts/house/kid-layer-lib.mjs`. Copy + unlock map: `config/kid-layer.config.json`. Tests: `scripts/house/tests/kid-layer.test.mjs`.

**Taps (reused shapes, nothing new):** daily musts `house-checkoffs:<kid>:<YYYY-MM-DD>` → `{<checkId>: true}`, weekly musts `house-checkoffs:<kid>:week:<FriISO>` (house-checkoffs.js / kids-data.js `checkKeyFor`). The hub store (TAPSYNC1 `/api/taps`, `~/.config/wardos/kid-taps.json`) holds the same keys as `{<checkId>: {v, t}}`. Both are read. Default input is the hub store. Taps that never reached the hub (per-device) are invisible here.

**Chore week:** kids-data.js `weekStartIso`, Fri 3:00 PM → next Fri 3:00 PM, tap days Sat..Fri. **Week closed:** Hayes and Ainsley = MUSTGATE1: every daily must tapped on all 7 tap days + every weekly must tapped. Optional add-ons never count. Harris = every home tap day's mission closed (home = a `Kids with Dan` span covers noon; a day outside the calendar window counts as home, so it is never easier; a week with no home days never closes). His weekly musts and other daily musts don't gate his week.

**kid-seats.json** `{asOfIso, generatedAt, week, quiet, seats, usTogether: {lit}, source}`
- Harris: one mission today. `mission {id, word, copy}` is fixed by day of week (`harrisMissionByDow` in the config: Sat Bed, Sun Trash, Mon Dishes, Tue Dishwasher, Wed Gear, Thu Shower, Fri Backpack, his 7 daily musts) and never changes after taps. Copy `Harris. Shower.`. Words come only from `missionWords`. `today.closed` when that one mission is tapped today (daily key); other taps don't close it. Arrival Friday after 3:00 PM is not a tap day: `mission: null`.
- Hayes: `row` Mon–Sun, `mark` = `closed` | `empty` (past day, kids home, not closed) | `ahead` (today or later) | `off` (kids away). No names on marks, no counts. `countdown` = his next real game in the calendar (`Flag · vs Ridley · 3 days`), else `null`.
- Ainsley: `week.closed` only.
- `quiet: true` while kids are away: no mission, row, or countdown.

**unlocks.json** `{asOfIso, generatedAt, week, lit[], source}`; each lit entry `{id, seat, control, tile, choices?, uses: 1, earnedWeek, copy}`. Only lit unlocks are listed; dark or spent = absent.
| closed | unlock id | control | copy |
|---|---|---|---|
| Harris | `harris-dinner-vote` | Vita's dinner vote | `Harris. Week closed. Dinner vote.` |
| Hayes | `hayes-weekend-pick` | Weekend fun pick | `Hayes. Week closed. You pick.` |
| Ainsley | `ainsley-gallery-or-weekend` | gallery photo OR weekend pick (`choices`) | `Ainsley. Week closed. Gallery or weekend, your call.` |
| all three | `house-weekend-pick` (seat `House`) | Weekend fun, house pick | `Us together. Weekend fun, house pick.` |

**Carry-over:** once lit, an unlock stays lit until spent, through the kids-away week and into the next home week. No weekly reset. It clears only when used, or when a newer close of the same kind replaces it (no stacking: always one, `earnedWeek` = the latest closed week of that kind). `house-weekend-pick` = the latest week where all three closed in the same week; kids spending their own unlocks doesn't touch it.

**Spends:** `consumeUnlock(uses, id, layer, now, choice?)` appends `{unlock, weekId, usedAt, choice?}`, `weekId` = the unlock's `earnedWeek`. A spend clears only that earned week's unlock; a later close lights it again. Store: `data/unlock-uses.json`, committed as the empty shape `{"note": "Per-device until a shared write path is approved. …", "uses": []}`. **Per-device until a shared write path is approved** (the hub `/api/taps` only accepts `house-checkoffs` keys), so a spend on one wall is not seen by another device or by this script unless that device's file is passed with `--uses`.

**Never in these files:** money symbols, kid-reward / account / sibling-order / parent words, `!`, stats (done/need/streak/score), a kid name in any miss / dark / empty object, or a list of who kept Us together dark (`usTogether` is `{lit}` only). `computeKidLayer` refuses to write if `scanObject` or `missNameHits` finds anything.

## ATLASLANE6: NEXT UP, logistics taps, school-night strip, display renames (data + rules only, no UI)

None of this is wired: no cron, no deploy, no network. Each CLI takes `--data-dir`, `--events`, `--now ISO`, `--stdout`.

### Shared leave-by (`lib.leaveByMs`)
Used by pickup-chain, next-up and school-night, in this order: (1) title says `leave H:MM`; (2) the event's own leave line in the description (`Leave-by 4:25pm`, `Leave home 4:45`; anything after `Was:` is history and ignored; only the time is read, the text is never published); (3) the event starts earlier than the stated time (kids-week `leaveBys.note`, "event START = leave-by"). No leave when the calendar says `not a leave` or `Leave-by: none`. A leave is Dad's only: a ride someone else drives never gets one. Change vs ATLASLANE5: pickup-chain now also reads (2), so the 6:20 Hayes pickup row has `leaveBy 6:20 PM`.

### NEXT UP: `data/next-up.json` (`node scripts/next-up.mjs`)
`{asOfIso, generatedAt, next, timer: null, source, warnings, reason?}`
- `next = {label, copy, leaveAt, leaveIso, startIso, day}` or `null`. `copy` is exactly `Leave 5:10.` (h:mm, no am/pm, trailing period). `day` = `Today` or the weekday (tomorrow). Window: now through the end of tomorrow; first leave not yet passed.
- Picks kid/family events only (a kid named, ride or activity), kids home at the start, a real place (not Home, phone, Zoom, TBD). Never: GET / BUY / REMIND / Atlas stubs, desk blocks, calls, work, health, money, Dan-only items, school-info rows (specials, spirit days, field trips).
- `label` is rebuilt from kid names + one fixed word (`Hayes pickup`, `Hayes + Harris drop-off`, `Ainsley swim`). No event text, place, or person.
- **Timer slot (Wright owns the state, on the board):** exactly one. This script always writes `timer: null`. Shape `{label, endsAt}`: `label` 1–12 letters/spaces (`Oven`), `endsAt` ISO with offset. Render `Oven 12:00.` = m:ss remaining, rounded up, clamps at `Oven 0:00.` (the timer ends on the board). Reference: `timerCopy()` in `scripts/next-up.mjs`. Anything invalid renders nothing.
- Today (Thu Oct 1, 6:30 PM CT run): `Hayes + Harris drop-off · Leave 8:10. (Fri)`.

### Logistics taps: `data/logistics-taps.json` (`node scripts/logistics-taps.mjs`)
Contract: `docs/wall-redesign/LOGISTICS-TAPS.md`. Four taps (I'm home, Leaving, kid check-in, Running late + chips 5/10/15/20/30), no keyboard, local board state only, nothing sends to a person. Per-device; the shared hub key is documented and OFF (last-yes).

### School-night strip: `data/school-night.json` (`node scripts/school-night.mjs [--pack-flags data/pack-flags.json]`)
- Visible `15:00`–`19:00` CT (`visibleFrom`, `visibleUntil`, plus today's `visibleFromIso` / `visibleUntilIso` so the wall hides at 7:00 even on a stale file). Outside that, or not a school night, the file holds only `{asOfIso, generatedAt, visibleFrom, visibleUntil, visibleFromIso, visibleUntilIso, schoolNight, visible: false}`. No placeholder.
- School night = tonight's house mode is not Day off / Kids away / Nashville week, kids home now and at 7:30 AM tomorrow, and tomorrow is a school day (Sun–Thu unless no school tomorrow; another family's no-school days don't count).
- `pickup[]` from pickup-chain (today, remaining rides that are pickups): `{who, label, time, leaveBy, by, copy}`, e.g. `Harris pickup 3:40. Leave 3:15.`; someone else's pickup names the driver and has no leave (`Hayes pickup 3:40 · Casey.`).
- `gear[]` `{who, items, copy}`: tonight's remaining activities and tomorrow's events (sport bag from the activity, gear the title names, `send X to`), plus today's Pack flags. `Ainsley · swim bag.`
- `form` (omitted unless real): the first kid-named calendar item with form / slip / waiver / due, today after now or tomorrow; GET/BUY stubs never count. `Ainsley · LKMS baby pic due Fri 3:00.`
- `weather: null`, `weatherSource: "source needed"`. Last-yes: there is no field-weather data on the box. The board's own pill (`house-weather.js`) calls Open-Meteo client-side (no key, home coordinates, current + 24h rain); using it for the field means a new fetch path in this lane or Wright reading `HouseWeather` at the field time. Not done; render nothing.

### Display renames (DAN RULING t2812u #2): board only, never the calendar
- Rules: `config/display-rename.json` (one file for JS and Python). Two renames: the grandparents' calendar title becomes `Nonna and Papa` (also the slash form in the same visit's events; evidence quoted in the config), and their birthday title becomes `Nonna birthday` unless the title names another person's parent. Every other name is unchanged.
- Parent-word scrub (standing rule, not a rename): a parenthetical naming a parent is dropped, `Riley's <parent word>` becomes `Riley's`, anything still naming a parent is not published (item dropped).
- Applied at build time, so it carries over when main's refresh routine runs after a merge: `scripts/calendar-refresh.mjs` (kids-week.json, kids-data.js EMBEDDED, board-os mirror), `scripts/cal-from-events.mjs` (cal-live.json, kids-week patch, EMBEDDED), `scripts/cal-months.py` (cal-months.json; also drops dollar amounts from calendar labels), and `lib.publicText` (pickup-chain, next-up, school-night). For already-built files: `node scripts/display-rename.mjs [--check] [--money] <files…>`.
- Test: no parent word anywhere in public wall data (`atlaslane6.test.mjs`).

### Zero dollars, no score (DAN RULING t2812u #1, Alfred KL-05)
- The one allowed dollar string is Ainsley's babysitting rate tag (`moneyScrub.allow` in `config/display-rename.json`); it is never stripped. Every Atlas-lane file has zero dollar strings (`moneyHits`, test).
- Ainsley's seat in `kid-seats.json` is `{name, week: {closed}}` (+ `copy` when closed). No XP, points, counts, streaks, stars. `computeKidLayer` refuses to write if `scoreHits` finds any.

## ATLASLANE7: kid copy fixed at the source, --help print-only

- `scripts/house/kid-copy.mjs` is the one kid-copy pass. `calendar-refresh.mjs` (root copy, data twin, board-os mirror) and `cal-from-events.mjs` (kids-week + kids-data.js EMBEDDED) run `kidCopyDeep(displayDeep(week))` on every write, so the preserved kid sections can never carry the old money copy back.
- Wording follows Wright's KIDPATH1 scrub exactly (an exact-string map). Anything new falls back to generic rules: the old savings-container names become Gems / Victory Coins / Tour goal, a dollar-sign chore amount becomes a star count (`7★ wk`), the old reward-day word becomes "goal day", and the old stored-total word becomes Stars. One extra string versus Wright: the Hayes reward line now reads "Goal with Dad after honest musts".
- Ainsley's babysitting rate tag stays verbatim; it is the only dollar sign in any kids-week copy.
- Ids, keys, hrefs and numbers are left alone (saved state keys off them).
- Apply by hand: `node scripts/display-rename.mjs --kid-copy data/kids-week.json kids-week.json kids-data.js`.
- `--help` / `-h` is print-only on next-up, school-night, logistics-taps, pickup-chain, house-mode, kid-layer and display-rename. It prints usage and exits 0 before reading or writing anything.
- Test: `scripts/house/tests/atlaslane7.test.mjs` regenerates kids-week from the old copy in a temp dir through `calendar-refresh.mjs --no-mirror` and asserts zero dollar signs except the tag (root, data twin, EMBEDDED).
