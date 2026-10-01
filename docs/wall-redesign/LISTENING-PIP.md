# LISTENING PIP · "Hey Atlas" one-shot · Wright wall keyword kit (plan only, nothing wired)

Law (`grok-share-badge-ownership.txt:129-150`, `board-os/kits/mode-a/06b MODULE HITL wall box handoff.md:2,34`, Atlas profile VOICE LAW):
"Hey Atlas" turns the ears on for **one utterance**, then off. Not "Atlas" by itself. On-device wake on the Beelink. Nothing leaves the column until the phrase hits. Then **one transcript → WardOS Voice Pipe** → mute. Atlas routes. No Voice bot, no rolling mic, no new personality, no hallway people-text. Wright owns the wall keyword kit + Shortcut / VOICE.md.

## States

| State | Shows | Enters on | Leaves on |
|---|---|---|---|
| `idle` | **nothing** (pip `hidden`, no reserved space) | boot; `done` timeout; any error | wake phrase heard |
| `listening` | small amber ring + the word `Listening` | on-device wake fires | end of the utterance (VAD) or a hard cap |
| `thinking` | same pip, dim amber, `Sent` | transcript posted to Voice Pipe | Voice Pipe ack, or timeout |
| `done` | `Got it` for a beat, then fade | ack | fade → `idle` |

Rules: one pip, top band corner, never covers a tile, no sound, no modal, no LED ring change (`06b` "Never" list), `prefers-reduced-motion` = no pulse. **No transcript text on the glass** (no hallway people-text). Errors go silently back to `idle`. No error copy on the wall.
Timings (utterance cap, thinking timeout, done beat): **UNKNOWN.** Dan or Atlas sets them; Wright won't invent them.

## Wiring found

| Piece | Status | Evidence |
|---|---|---|
| WardOS Voice Pipe | **EXISTS** as a Grok automation (task `8321bf3c`), webhook input | `grok-share-badge-ownership.txt:77,97-119` |
| Voice Pipe webhook URL | **UNKNOWN** (not on the box) | `HITL-WALL-HANDOFF.cursor.md:22` |
| On-device wake on the Beelink | **NOT BUILT.** Wall hardware is on HOLD (`WALL-STATION.md` Plumb section) | `06b` module; `SHIP-ARTIFACT-GATE.cursor.md:47` ("off-repo ... UNKNOWN") |
| Repo speech code | **NONE.** No `SpeechRecognition` / `speechSynthesis` in house-face | `SHIP-ARTIFACT-GATE.cursor.md:47` |
| Event into the wall page | **NONE.** Proposal only: the wake helper on the Beelink fires a page event `wardos:pip` with `{state}` (kiosk-local, no network), or the existing house hub serves a read-only `GET /api/pip`. **Either one is a new interface, so it needs Atlas/Dan's yes. Not built** |
| Hub reachability from the Beelink | UNKNOWN | `HITL-WALL-HANDOFF.cursor.md:24` |

## Ship gate

Kid-safe voice → Alfred QAQC PASS before anything spoken or listening is called live (brief + `05-5 Ship artifact gate`). The pip's CSS skeleton lives in `tokens-wall-kiosk27.css` (`.wk-pip[data-state]`), and no page uses it.
