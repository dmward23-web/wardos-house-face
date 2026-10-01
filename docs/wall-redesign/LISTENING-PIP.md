# LISTENING PIP · "Hey Atlas" one-shot · **PARKED**

**Status: PARKED** (redesign owner ruling, Thu Oct 1 2026). It's out of the build: no pip CSS in `tokens-wall-kiosk27.css`, no pip rule in `house-wall-status.js`.
It comes back only when **both** are true: (1) a real event path exists from the wall's wake listener to the page, and (2) Dan gives his last-yes. Kid-safe voice also needs Alfred QAQC PASS before anything listening is called live.

## What's known (kept for when it unparks)

Law (`grok-share-badge-ownership.txt:129-150`, `board-os/kits/mode-a/06b MODULE HITL wall box handoff.md:2,34`): "Hey Atlas" = ears on for **one utterance**, then off. On-device wake on the Beelink → one transcript → WardOS Voice Pipe → mute. Atlas routes. No Voice bot, no rolling mic, no new personality, no hallway people-text.

| Piece | Status |
|---|---|
| WardOS Voice Pipe | Exists as a Grok automation (task `8321bf3c`), webhook input (`grok-share-badge-ownership.txt:77,97-119`) |
| Voice Pipe webhook URL | UNKNOWN (`HITL-WALL-HANDOFF.cursor.md:22`) |
| On-device wake | Not built (wall hardware HOLD) |
| Repo speech code | None (`SHIP-ARTIFACT-GATE.cursor.md:47`) |
| Event into the page | **None. This is what's blocking it.** |

Proposed states when unparked: `idle` (hidden) → `listening` → `thinking` → `done` → `idle`. No transcript text, no sound, no modal. Timings UNKNOWN.
