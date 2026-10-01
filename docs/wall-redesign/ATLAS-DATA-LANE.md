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
