# SOUND-CREDITS (v5.1). All sources are CC0 or public domain. Processing was done locally (filter, pitch, reverb, loop crossfade).

| use | source | license | link |
|---|---|---|---|
| wind bed + gust layer, distant "moan" (pitched down, bandpassed) | "Howling wind.ogg", Wikimedia Commons | CC0 | https://commons.wikimedia.org/wiki/File:Howling_wind.ogg |
| distant thunder rumble in bed | "Light Rain Distant Thunder July 5th 2016.wav", Wikimedia Commons | CC0 | https://commons.wikimedia.org/wiki/File:Light_Rain_Distant_Thunder_July_5th_2016.wav |
| low porch creak in bed | "Creaky wooden swivel chair.ogg", Wikimedia Commons | Public domain | https://commons.wikimedia.org/wiki/File:Creaky_wooden_swivel_chair.ogg |
| creak tail on skeleton tap | "LL-Q1860 (eng)-Knites-Sound recording. Door creaks.wav", Wikimedia Commons (Lingua Libre) | CC0 | https://commons.wikimedia.org/wiki/File:LL-Q1860_(eng)-Knites-Sound_recording._Door_creaks.wav |
| candle crackle (bed) + ember crackle (pumpkin tap) | "Dry grass burning in open fireplace.ogg", Wikimedia Commons | Public domain | https://commons.wikimedia.org/wiki/File:Dry_grass_burning_in_open_fireplace.ogg |
| ember whoosh | "LL-Q1860 (eng)-Arlo Barnes-whoosh.wav", Wikimedia Commons | CC0 | https://commons.wikimedia.org/wiki/File:LL-Q1860_(eng)-Arlo_Barnes-whoosh.wav |
| distant low caws (raven, pitched down 25%) | "Yellowstone sound library - Common Raven - 001.mp3", NPS via Wikimedia Commons | Public domain (US Gov) | https://commons.wikimedia.org/wiki/File:Yellowstone_sound_library_-_Common_Raven_-_001.mp3 |
| owl hoot (ambient + tap) | "Tawny Owl #1" (#1763), Joseph Sardin, BigSoundBank | CC0 | https://bigsoundbank.com/tawny-owl-1-s1763.html |
| cat meow (tap) | "Maullido de gata hembra joven.ogg", Wikimedia Commons | CC0 | https://commons.wikimedia.org/wiki/File:Maullido_de_gata_hembra_joven.ogg |
| bone knock (skeleton tap) | "Knocking on wood or door.ogg", Wikimedia Commons | Public domain | https://commons.wikimedia.org/wiki/File:Knocking_on_wood_or_door.ogg |
| wordless breathy whisper (ghost tap, ambient, window) | "Breathing man.ogg", Wikimedia Commons (breath only, bandpassed + airy reverb; no voice/words) | Public domain | https://commons.wikimedia.org/wiki/File:Breathing_man.ogg |
| far howl | "Wolf howls.ogg", Wikimedia Commons (lowpassed, distant reverb, low gain) | Public domain | https://commons.wikimedia.org/wiki/File:Wolf_howls.ogg |
| **synthesized** low drone (41/55/62 Hz sines + filtered brown noise) | generated in src/snd/mk.py | own work | none |
| **synthesized** bat flutter (bandpassed noise, AM at 14-17 Hz) | src/snd/mk.py. I found no CC0/PD bat-wing recording; it's quiet and sits under the visual pass | own work | none |

Master: everything goes through a WebAudio limiter on the board. The clips are loudnorm -16 LUFS, true peak -1.5 dB, with alimiter. There are no stingers.
Note: the great horned owl recordings on Commons are CC BY-SA, so I used a CC0 tawny owl hoot.

## v5.1 additions: fire, ember, weather and day
| Use | Source | License | URL |
|---|---|---|---|
| ember crackle loop (crackleL), gain = ember heat | "crackle.ogg" (listed above), looped and EQ'd | as above | n/a |
| swish on fast ember moves | "whoosh.wav" (listed above), trimmed | as above | n/a |
| fire roar loop, gain = fire mass | crackle.ogg layered with a **synthesized** low rumble (filtered noise) | CC0 + own synth | n/a |
| rain loop (drizzle to heavy, gain = intensity) | "Summer Rain on Terrace" #1019, Joseph Sardin, BigSoundBank | CC0 | https://bigsoundbank.com/summer-rain-on-terrace-s1019.html |
| hail loop | #1019 rain + **synthesized** ice ticks (decaying 2.5 to 6 kHz partials and noise) | CC0 + own synth | n/a |
| thunder (delayed, low-passed, 0.6 s fade-in, ≤ .45 gain) | "Thunder #1" #2718, Joseph Sardin, BigSoundBank | CC0 | https://bigsoundbank.com/thunder-s2718.html |
| day bed (birds and wind, darkened EQ and echo) | "Campaign Morning" #912, Joseph Sardin, BigSoundBank | CC0 | https://bigsoundbank.com/campaign-morning-s0912.html |
| day crows (owl replacement in daylight) | "Crows #2" #956, Joseph Sardin, BigSoundBank | CC0 | https://bigsoundbank.com/search?q=crows |

Image note: the hay-bale still is generated art supplied in the assets folder, keyed in-house.
