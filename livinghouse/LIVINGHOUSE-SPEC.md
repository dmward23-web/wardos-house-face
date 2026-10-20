# Living House · spec (layers 1 to 4)

One page, `livinghouse/index.html`, wall (1920x1080) and phone (440x956). The October night plate is the interface.
Laws for every layer: kid-safe and friendly, calm motion (reduced motion holds still), no em dashes, no colour or dress-up
days, never names from the external feed, no kid times or logistics in the away state, no LKMS legs for Ainsley, "Hayes <Surname>" is
never our Hayes. Every kid row and calendar event goes through main's ../house-face-law.js (LIVELAW1, NOCUSTODY1, SEATLAW1: cleanFeed, isCustody, faceText; no copy) before it can be drawn, and a kid row with a dollar figure never shows.
Legibility beats cute. PRIVACY (Atlas): the repo is public; no money, body, photos, kid notes, birthdays, year store or
partner data ever enters git. The away state comes from the per-day flag in data/cal-months.json (kids-week goes stale by evening).
Build bare minimum first: every element of a layer working simply and lawfully before any one is polished. A missing feed draws its quiet default or nothing, and is flagged in FEEDS.md.

## Layer 1 (built)
Moon clock with real phase and arc · kid windows (glow = home with the lamp on, lit = home, dark = away or lamp off) · name plaques (brass fill + warm dot when the kid has something today; tap opens the kid's room on the next item) · plain-glass callout with the kid's next item hanging from their plaque ·
porch candle burning toward Dad's next leave-by (kid trips he drives included, never Ainsley's LKMS; no leave-by = unlit and empty) · tombstones for today and tomorrow, back
stones for days 2 to 6 in deeper fog · scene weather (rain renders rain, cold thickens fog) · cauldron (chore feed missing,
simmers low) · "The Ward's" porch sign · Dad lantern linking to sheet-dan.html · porch lantern in the away state with no words (no state or countdown wording, Atlas + Alfred law).
Debug: `?now=<iso>` pins the clock for stills (it ticks from there; `?freeze=1` or `?rec=1` holds it), `?state=home` renders a labelled PREVIEW of the home-state look.

## Layer 2 (next)
Memory yard (missing chore feed, empty hook) · windowsill creatures (owl Ainsley, cat Hayes, raven Harris; perch when
clear, pace inside 60 min; absent in the away state) · away-state look (lit and alive in the home state, quiet and moonlit when away) ·
fog priority · season arc hooks (leaves, real moon phase, weekly yard element, Halloween mode on Oct 31) · real-house
mirror (Kasa windows, Sensi chimney smoke when heat runs, garage and cam lamp as empty hooks unless a feed exists).

## Layer 3 (plan, then build item by item)
1. Interactions: every tap target 44px or more; taps open the matching page (name plaque = the kid's room); no tap ever writes data.
2. Morning sequence: at sunrise the moon sets and the candle lights for the first real item of the day.
3. Kid-to-kid notes: device-local only (localStorage / IndexedDB), never sent anywhere, never committed.
4. Hidden secrets: small friendly finds (a bat behind the chimney), purely decorative.
5. Dad page view: money and body signs read at runtime from a private source if one exists (never from this public
   repo), otherwise coarse status only ("on track") or an empty hook.
6. Audience mode: kid hours by default; Dan-only mode by an explicit local toggle, never automatic.
7. Halloween countdown: pumpkins on the steps count down the days to Oct 31.
8. Voice (Beelink or iPhone): empty hook tonight, flagged in FEEDS.md.

## Layer 4 (queued; build after layer 3 if time allows, otherwise spec only tonight)
1. Learned rhythm. Local heuristics over calendar history (on device, no new service) find Dan's typical leave time per
   weekday; the path lights a few minutes before it. Storm clouds on historically rough days show ONLY in Dan-only
   audience mode, never in kid hours, and never name or hint at a state change.
2. Rooms as doors. The house is the nav for every existing page. Kitchen window: groceries / Costco as crates. Garage:
   the real cam through a dusty window, only if a cam feed exists (data/nest-live.json `snapshotUrl` or a still in
   data/nest-snaps/), otherwise an empty hook. Page map (one spot per page): front door = index (hub), porch lantern =
   sheet-dan, upper left pane = kid-ainsley, upper right pane = kid-hayes, lower window = kid-harris, moon = month,
   kitchen window = groceries sheet, garage = cam, mailbox = month-chat, cauldron = chores sheet, gate = mercury-run,
   remaining sheet-*.html pages get a grave, lamp or yard spot in the same table (built with layer 4, one row per page
   from wright-scratch/v52-boards.md).
3. Kid pages as their own rooms: Hayes sports, Harris football, Ainsley wallpaper plus earned items.
4. Basement crypt of monthly jars: moments from the calendar and Dan-approved photos ONLY. Atlas ruling: the photo index
   is NOT read at all until a folder allow-list is approved, so the crypt ships as an empty hook. No other photos, and
   no photo ever enters git.
5. Far-hill house (Dan-only mode unless Atlas rules otherwise): a second small house on the far hill with real city-level
   weather from a public forecast, fetched at runtime. The city is runtime config, never committed; no location tracking,
   no schedule data, no personal data in git.
6. Season arc, date-driven: October night, then November harvest, then December snow village.
7. Idle cinema: after 60 s untouched, a slow camera drift around the house that stops instantly on any touch;
   off under reduced motion.

Shipped on this branch (collect and gates only): the crypt shows calendar moments and an empty photo hook,
idle cinema drifts (a video only when caps.json says the proxy has loops), rhythm logs weekday and minute on the
device and never acts, and the season pack follows the clock (count from Oct 24, street mode on Oct 31, empty
November and December plates until art exists). Rooms, the far hill, and Dan-only clouds are not in this track.
