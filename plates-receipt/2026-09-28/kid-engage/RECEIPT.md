# KIDENGAGE1 · kid flip cards · who’s up · claim · streak · SFX

**When:** 2026-09-28 ~20:45 CT  
**Tip:** `72cf272`  
**Page:** https://dmward23-web.github.io/wardos-house-face/sheet-index.html

## Shipped

1. **Kid tile flip cards** — Ainsley / Hayes / Harris tiles on sheet-index become swipeable faces: **Day · Stars · Chores · Leave** (live kids-data + cal-live). Dots + ←→ keys. **OPEN** still jumps to the kid board.
2. **Who’s up spotlight** — bar above Sheet roster: soonest kid leave from live queue (name · time · title · LEAVE countdown). OPEN → that kid board.
3. **Chore / star claim** — Chores face: tap a must → `WardKids.setCheck` → `localStorage` day key (`house-checkoffs:<kid>:<iso>`). Honest LIVE, no DEMO. Kid boards keep existing checkoffs + gain streak/XP glass.
4. **Streak / XP glass** — live consecutive days with all daily musts tapped; XP = today’s musts done/need on tiles + board chores header.
5. **SFX** — `house-sfx.js` tap on flip/OPEN; quest + boom + CLAIMED float on claim.

## Protected

- Cams: no cam-deck swipe · height still 320  
- Leave-by SCHEDLOOK2: swipe/chips untouched · leavebyH 420 · layoutsH ≥140  
- Lights LIGHTDIM1 untouched  
- sensi-live / nest-live JSON not modified  

## How kids use it on the wall

1. See **Who’s up** at the top of the roster — who’s leaving next.  
2. Swipe a kid tile left/right to flip Day → Stars → Chores → Leave.  
3. On **Chores**, tap a row to claim (ding + ✓). Stars face shows jar + streak.  
4. Tap **OPEN** (or Who’s up OPEN) for the full kid board — same claims, louder XP glass.

## Proof (headless CDP, 1080×1920)

See `proof-cdp.json`: 3 flip tiles, who’s up Hayes 8:10, faces day/stars/chores(5 claims)/leave, claim `hay-bed` → localStorage + chip 1/10, leaveby 420 / layouts 241 / cams 320.
