# Living House · feeds

Every element on livinghouse/index.html, and where its data comes from. REAL means it reads a live file that already exists.
MISSING FEED means there is no source tonight, so the element draws its quiet default (or nothing) and invents nothing.
For stills and clips, the data is a snapshot run through wright-scratch/tools/rec-clean-data.py, plus `data/cal-live.raw.json` (the pre-clean copy, snapshot only) so LeaveBy sees raw text exactly as the live page does. The page itself never writes data. Kid rows and events pass main's face law (../house-face-law.js loaded directly: cleanFeed, faceText, isCustody, the dress-up filter), the school-name strip (../school-names.js), the seat and residue strip, the money drop, and the AWAYLAW1 rules.

## Layer 1

| Element | Status | Source |
|---|---|---|
| Moon clock: time and date etched on it | REAL | device clock, America/Chicago |
| Moon phase (lit shape) | REAL | computed from the date (synodic month, ref new moon 2000-01-06) |
| Moon arc across the sky | REAL | time of night, 6 PM to 6 AM, rests at the ends by day |
| Footage moon veiled by a cloud | n/a | so only one moon shows |
| Kid windows: three photoreal windows (art/ batch 1, one shared outline) at plate x 862 / 950 / 1038 on the upper storey (wall) or on the siding strip (phone); lit when home, glow layer only when home with the room lamp on (Harris's Kasa dimmer; the others have no lamp feed), dark in the away state or lamp off. Something today never changes the window: the name plaque gets a brass fill and a warm dot (LHRules.plaqueState) | REAL | kids-week.json / cal-live.json kid items through AwayFilter.keepItem and LHRules.kidName (a first name followed by another surname is never our kid) |
| Away state (external feed) | REAL | the per-day flag in data/cal-months.json `days[date]` (a real boolean; a missing, empty or junk feed = the normal board). The change minute comes from the feed (`changeMin`, never shown). Without it there is no switch inside a day, and on a switch day (a day whose flag differs from the day before or after) kid items are simply not shown (Atlas 2026-10-17); nothing says why |
| Kid windows: dark in the away state | REAL | away state above |
| Harris's window dark when his light is off (his window in the row of three) | REAL | data/lights-live.json `lights[id=harris-room].on` (Kasa dimmer) |
| Ainsley and Hayes room lights | MISSING FEED | no smart light in those rooms; their windows follow kids-week only |
| Callout with a kid's next item: plain glass hanging from that kid's name plaque (no cartoon ghost, Prism P1); `?kid=` picks the kid, else the kid whose next item comes first. Tapping a plaque opens ../kid-<name>.html?next=<event id> | REAL | the kid's next cal-live.json item through AwayFilter.keepItem (home state only); in the away state windows stay dark, no callout and no per-kid card, only the one lantern. The kid rooms do not read `next` yet (room-side follow-up) |
| Porch candle burning down | REAL | Dad's next LEAVE-BY (LHRules.candlePick, Prism ruling b): the first future timed item in data/cal-live.json `upcomingLeaves[]` whose raw text gives a leave-by, kid trips he drives included, never Ainsley's LKMS (kid items removed on away days). No leave-by anywhere = unlit, empty candle. Leave time from LeaveBy (phone2/leaveby.js, the shared helper copied verbatim from wt-phone) reading the RAW event and its all-day trip parent; display text from the cleaned event. No leave in the raw text = the item's own name and time, never a guessed leave The candle lights only on the leave day; a later leave reads "Tomorrow · Leave 2:10 PM" or "Sat · Leave 2:10 PM" (LHRules.candle). |
| Owl hoot and crows lift near zero | REAL trigger, sound hook | fires the scene's owl and bats when under 10 min; sound stays muted until someone taps |
| Tombstones: today first (all-day items stay all day, timed items until they end), then the next days fogged by days out (the stone fades, the words keep full contrast), max 4 (wall) / 3 (phone) | REAL | data/cal-live.json `upcomingLeaves[]` via LHRules.pickStones; the candle's own item is not repeated; all-day birthdays stay off |
| Weather: rain, snow, wind | REAL | the scene's own live feed (night/scene.html `WX`, Open-Meteo). Nothing drawn if that feed isn't live |
| Cold thickens the fog | REAL when the scene weather is live | `__env().cur.temp` (°C). If the feed isn't live, the fog stays at its base and no weather is claimed |
| Cauldron (chores): fill = daily musts done today / due today, all three kids; rests on away days | REAL when readable | hub tap store (TAPSYNC1, GET /api/taps on the house hub with the device's hub key, read only) over kids-week.json `kids.*.quests[]` cadence daily, LHRules.choreFill. No hub key on the device or no answer: an EMPTY pot labelled "No chore feed yet" (data-feed=missing, data-why) and no demo data |
| "The Ward's" porch sign | static | |
| Dad lantern (the porch lamp), links to sheet-dan.html | static link | |
| Porch lantern (art body + fire loop), no words: no countdown, no state wording (Alfred). Dad has no coarse status feed yet, so it carries nothing | REAL | the away state from cal-months (AwayFilter.isAwayAt) decides only whether the lantern burns; aria-label "Porch lantern" |
| Falling leaves | seasonal decoration | date-driven (October) |

## Layer 2

| Element | Status | Source |
|---|---|---|
| Windowsill creatures (owl Ainsley, cat Hayes, raven Harris) | MISSING ASSET | the logic is wired (home state only; pace inside 60 min) but nothing renders until photoreal perched loops exist; no invented art (Prism P1-3) |
| Away-state look | REAL | away: cooler moonlit wash, dark kid windows, no creatures, the porch lantern (art body + fire loop) with no words under it; home state: warm |
| Fog priority | REAL | stone fog by days out (cal-live.json); text keeps contrast |
| Season arc: leaves | date | October only |
| Season arc: moon phase | REAL | computed |
| Season arc: Halloween glow | date | Oct 31 (or `?halloween=preview`, labelled PREVIEW) |
| Weekly yard element | MISSING FEED | hook `yard()`, needs a shared chore history |
| Memory yard (an item per day of chores done) | MISSING FEED | same hook; chores are device localStorage only |
| Harris's window | REAL | lights-live.json harris-room |
| Kitchen and dining lights | REAL feed, no spot | those rooms aren't visible windows on the plate; mapped in Layer 4 (rooms as doors) |
| Chimney smoke | REAL | sensi-live.json `thermostat`: drawn only while ambient < heatSetpoint in Heat/Auto (tonight 65 vs 55, so none) |
| Eave camera lamp | REAL feed, currently off | nest-live.json: drawn only if a camera reports `online: true` or a snapshot/stream URL (tonight all null, so none) |
| Garage door open / shut | MISSING FEED | no garage door state anywhere |

## Room art ready for the rooms builder (not wired in L1)
| Piece | Status | Where | Notes |
|---|---|---|---|
| Harris room raven (idle loop) | READY, NOT WIRED | Prism art: /workspace/artifacts/livinghouse/art/raven/ (raven-idle-packed-960x640.mp4 packed alpha like owl-packed, raven-idle-480x640.webm VP9 alpha, raven-idle-poster-480x640.png for reduced motion) | Room art: no Harris room view exists in L1, so it is not on the house. Draw it in the Harris room at 380 to 420 px tall, never at sill size. Copy only the final files into the repo when the room ships, and scan them. |

## Layer 3

| Element | Status | Source |
|---|---|---|
| School morning sequence (6:30, Hayes and Harris) | REAL when the calendar feed is loaded | data/cal-live.json timed events for the two boys, through AwayFilter.keepItem, on a weekday that is not a no-school day, from 6:30 until 8:30 (or until the later morning item, never past 10:00). Leave times only from phone2/leaveby.js on the raw event. Away days, switch days that hide kid items, weekends, and no-school days draw no lines. `data-morning` is `on`, `away`, `weekend`, `before`, `after`, `held`, `noschool`, or `missing` |
| School morning when the calendar feed is missing | MISSING FEED | `data-morning=missing` and `data-morning-feed=missing`. No line, no guessed leave, the moon stays on its ordinary arc. A missing cal-months feed is the normal awake board, not an away day |
| Long-press text on the moon, sign, Dad chip, windows, candle, cauldron, and stones | REAL | the line is the object's own lawful text (kid lines only while home). Away days: no window, candle, or stone line. Nothing is written |
| Voice on long-press | MUTED HOOK | text only. `LHLayer3.voice.speak` returns false and speech is not called. Stays muted until the same hook is proven on a Linux Chromium wall and on iOS Safari |
| Audience mode | REAL, device local | default kid hours. Tap the Audience control for the guest view (Dan-only trips and the Dad sheet link hide; the chip still reads Dad). Long-press that control for Dan-only. Saved in localStorage `lh-audience`. `?audience=kids\|guest\|dan` pins a view for a still and does not choose it from the clock |
| Rough-day weather | MISSING FEED | empty hook `#lh-rough`, Dan-only, no words |
| Partner house on the far hill | MISSING FEED | empty hook `#lh-partner`, Dan-only, no name and no place in the page |

## Alfred L1 fixes (Sat Oct 17)
- data/cal-live.raw.json is requested only with ?rec=1 (recording snapshots); live pages never ask for it.
- No away-state feed (cal-months missing): the three windows draw dark, never lit.
- Bracketed tags ("[AB Tag]") are stripped from glass titles; private first names are stripped by SHA-256 match only (no names in git).
- An item naming a kid's first name with another surname belongs to someone else: off the windows, the candle and the stones.

## School token (Alfred ruling 10-17)
The kid school calendar abbreviation never lives in git. LHRules loads it at run time (role `school`): window.WARDOS_PRIVATE_NAMES (hub-injected, not in git), or in node WARDOS_NAMES / WARDOS_PRIVATE_NAMES / ~/.local/share/wardos-private/private-names.tsv / ~/.config/wardos/private-names.tsv. With no token, kid items still match by kid name or kid colour key. Tests use the synthetic token QXS.

Away-state law (Atlas): no away-state wording on the Living House in visible or aria text, and no computed replacement: a row whose text names the arrangement drops whole (LHRules.stateText; the phrase list lives in its regex and tests). AwayFilter.glass rewording is not used here. Alfred extends it: any away, back or return wording (so nothing counts down to a change) drops too; the lantern carries no words.

## Live Pages and the real feeds (Alfred 5b, hard guard)

Living House reads its data feeds only on a local server (127.0.0.1, localhost, ::1, or file:). On live Pages, or any other host,
`LHRules.feedsAllowed()` is false, so every `J()` read resolves to nothing and the board stays feedless (the normal board with the
Calendar offline tag). It does not load private-feed.js and reads no hub private route. Connecting it to the real feeds needs all three:

1. School names load first: ../school-names.js (filled by private-feed.js from the hub's names route) before lh-rules.js and lh.js, and the names in hand before the first paint.
2. The school-token strip on every display path: stones, callout, candle text and candle place (lh.js `school()` inside `face()`), plus any new path added later.
3. Never cache an empty school list: LHRules.schoolTokens() and SchoolNames both keep an empty answer uncached, so names that arrive later are used.

Only then drop the host guard. Partner and co-parent names reach LH through the same runtime path (window.WARDOS_PRIVATE_NAMES roles); the hub route serves the school role only today, and widening it is Atlas's call.
