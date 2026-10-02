# Wall press map (PRESSMAP1)

Every visible thing on `wall.html` that takes a press is in `scripts/wall/press-map.json`. The test
`scripts/wall/press-map.py WxH [...] [--out file.json]` loads the wall at each size, finds every visible tappable
(links, buttons, `[data-go]`, `[role=button]`, `[tabindex]`, inputs), and fails if one is not matched by an entry.
Then it presses each one in a fresh browser context:

- **go**: the press must land on the mapped page (HTTP 200), the `#anchor` must exist and be in view after the
  landscape reflow (`house-landscape.js` re-lands on the hash), the page must have a way back to the wall or the
  Main board, and it must not be blank.
- **in place**: the press must change something on the wall (MutationObserver hit) and the URL must not change.
- The wall itself never reaches off the box during a press. A destination board's public GET (weather) is aborted,
  not counted; any non-GET off the box fails.

Last run (Thu Oct 1, 10:40 PM CT): 1920x1080 and 2560x1440, 103 presses each (47 go, 56 in place), 0 FAIL.

## Calls made in the map

- Kid name = **check in** (in place). It is not a link to the kid board; the seat body and the week row go to the kid board.
- Jar = **in place** (shows the rule). There is no jar explainer page yet; that is a gap.
- Thermostat - / + = **in place**: without the hub key it says it needs Dan's OK and draws dim. NEED KEY is never painted.
- Rail badges go to anchored pages (`page.html#anchor`), not page tops.
- Status lights go to their feed's page with an anchor (`PAGE_ANCHOR` map in `wall.html`); the lights head goes to `sheet-lights.html#lights-pad-grid`.
- The Desk gate is reached only through the Dad Seat (`sheet-dan.html#ds-desk`), never straight from the wall.
- Dates in the countdown frame / date line go to `month.html#d-YYYY-MM-DD` (pattern `month.html#d-*`).

## Entries

| id | kind | lands on | what |
|---|---|---|---|
| `header-home` | go | `sheet-index.html#hub-home` | Header bar = Main board |
| `clock` | go | `sheet-today.html#today-now` |  |
| `date` | go | `month.html#d-*` | today's cell on Month |
| `house-mode` | go | `sheet-today.html#today-now` |  |
| `stale-dot` | go | `sheet-status.html#status-feeds` |  |
| `next-up` | go | `sheet-today.html#today-now` |  |
| `timer-label` | inplace | feedback on the wall | picks the timer label |
| `timer-min` | inplace | feedback on the wall | starts the house timer (local) |
| `timer-stop` | inplace | feedback on the wall |  |
| `temp-head` | go | `sheet-google-home.html#sensi-hero` |  |
| `temp-read` | go | `sheet-google-home.html#sensi-hero` |  |
| `temp-step` | inplace | feedback on the wall | says Needs Dan's OK (setpoint writes off) |
| `travel` | inplace | feedback on the wall | without the hub key: says Needs the hub key; with it: Travel / Back home |
| `lights-head` | go | `sheet-lights.html#lights-pad-grid` |  |
| `light-chip` | inplace | feedback on the wall | without the hub key: Needs the hub key |
| `doorbell` | go | `sheet-google-home.html#cam-next-step` |  |
| `doors` | go | `sheet-google-home.html#sensi-hero` |  |
| `scene` | inplace | feedback on the wall | I'm home / Leaving (lights only with the hub key) |
| `checkin-hint` | inplace | feedback on the wall | lights up the seat names |
| `running-late` | inplace | feedback on the wall |  |
| `who-pill` | inplace | feedback on the wall | kid check-in (who's home pill and seat name) |
| `status-kick` | go | `sheet-status.html#status-feeds` |  |
| `status-light` | go | `*` |  |
| `school-night` | go | `sheet-today.html#today-day` |  |
| `pickup` | go | `sheet-today.html#today-day` |  |
| `must` | inplace | feedback on the wall | the kid's MUSTS tap (local, honest) |
| `close` | inplace | feedback on the wall |  |
| `week-row` | go | `*` | the kid's board |
| `countdown-frame` | go | `month.html#d-*` |  |
| `trusted` | go | `kid-ainsley.html#kid-board` |  |
| `hire` | go | `kid-ainsley.html#kid-board` |  |
| `nice-one` | inplace | feedback on the wall | says Ask a parent (parent-only) |
| `pack` | inplace | feedback on the wall |  |
| `us-together` | go | `sheet-us.html#us-board` |  |
| `week-win` | go | `sheet-win.html#win-board` |  |
| `choice-head` | go | `sheet-dan.html#ds-next` | CHOICE closed / Dad Seat exception |
| `choice-claim` | inplace | feedback on the wall |  |
| `groc-kick` | go | `sheet-groceries.html#groc-list` |  |
| `groc-filter` | inplace | feedback on the wall |  |
| `groc-add` | inplace | feedback on the wall |  |
| `groc-more` | inplace | feedback on the wall |  |
| `jar` | inplace | feedback on the wall | the jar tile is its own explainer (no jar page exists): lights the rule lines |
| `rail-badge` | go | `*` |  |
| `source-chip` | go | `sheet-status.html#status-feeds` |  |
