# LURE — Build Spec

> A peaceful ocean-dive website. A cute glowing fish guides you down. It's the bait. You followed it.

---

## 0. How to use this spec (instructions for Claude Code)

- Build **one milestone at a time** (Section 13). After each milestone, stop, summarize what was built, and wait for me to test before continuing.
- Do **not** add features that aren't in this spec. Keep changes targeted; don't redesign working parts.
- All tunable numbers (depths, timings, volumes, speeds) live in `js/config.js`, never hard-coded in systems.
- Vanilla HTML/CSS/JS with ES modules. **No frameworks, no build step, no external JS libraries.**
- Run with the VS Code **Live Server** extension (needed for ES modules and loading audio files).
- The experience must work with **zero audio files**: every sound has a procedural fallback built with the Web Audio API. Real files in `assets/audio/` replace the fallback when present.

---

## 1. Concept

A vertical, scroll-driven descent from a sunny ocean surface to the bottom of a trench. No facts, no educational text, no labels. Pure experience.

It starts peaceful and beautiful, slowly becomes wrong, then becomes terrifying. A cute glowing companion fish guides you down the whole way. In the end, it's revealed to be the lure of a giant anglerfish that has been leading you to it.

**Runtime:** about 7 minutes.
**Platform:** desktop browser first (Chrome/Edge/Firefox), mobile supported.

---

## 2. Horror pillars (every feature must serve at least one)

1. **Helplessness.** Scrolling is the player's only power, and the site gradually takes it away (no scrolling up, resistance, auto-drift, locked cinematics).
2. **Never show the monster.** Show pieces only: silhouettes, eyes, a fin, a tentacle. Full reveal only in the final jump scare.
3. **Everything safe turns on you.** The companion, the lullaby, the flashlight. Comforts in Act 1 become threats in Act 4.
4. **The website is in on it.** It breaks rules users trust: the cursor, scrolling, the browser tab, silence.
5. **Dread over jump scares.** Exactly **one** jump scare in the whole experience, at the end.

---

## 3. Tech stack & constraints

- HTML5, CSS3, JavaScript (ES modules).
- Rendering: **Canvas 2D**, one full-screen canvas, `devicePixelRatio` capped at 2.
- Audio: **Web Audio API** (BiquadFilter, ConvolverNode, PannerNode with HRTF, DynamicsCompressor, OscillatorNode, AudioBufferSourceNode).
- Fonts: Google Fonts — `Share Tech Mono` (gauges/UI) and `Special Elite` (scratched messages; drawn on canvas with jitter so it looks carved). Always include fallbacks.
- Target: 60 fps on a mid-range laptop. Degrade particle counts on mobile / low fps.
- All state that persists between visits uses `localStorage`, wrapped in `try/catch`.

---

## 4. File structure

```
lure/
  index.html
  css/
    style.css
  js/
    main.js              # boot, start screen, main loop, pause menu
    config.js            # ALL tunable numbers
    state.js             # global state object
    input/
      scroll.js          # virtual scroll controller
      pointer.js         # pointer tracking, custom cursor, ghost cursor
    render/
      renderer.js        # canvas setup, resize, layer order, world→screen
      palette.js         # color keyframes by depth
      layers/
        background.js    # depth gradient, god rays
        surface.js       # sky, waves, dive splash
        particles.js     # bubbles, marine snow
        fish.js          # boids school
        companion.js     # companion fish state machine
        creatures.js     # whale, silhouettes, eyes, tentacle, giant eye
        props.js         # helmet, diver suit, seafloor flashlight, rope, face rock
        scratches.js     # carved messages
        garden.js        # bioluminescent false-relief garden
        flashlight.js    # darkness mask + isLit()
        effects.js       # grain, vignette, chromatic aberration, cracks, glitch, static, shake
        ui.js            # depth gauge, battery, sonar radar
        mouth.js         # jump scare
    audio/
      engine.js          # context, buses, master chain, loader, duck/silence
      synth.js           # procedural fallback generators for every sound
      music.js           # music box lullaby sequencer + variants
      spatial.js         # HRTF whispers, sounds from below/behind
    beats/
      director.js        # watches depth/time/flags, fires beats once
      beats.js           # beat definitions (Section 7)
    meta/
      browser.js         # tab title, favicon, visibility, persistence, time-of-day line
  assets/
    audio/               # optional real sound files (names in Section 10)
```

---

## 5. Depth map & pacing

`depth` runs from **0 m to 11,000 m**. The UI shows meters only, never zone names or facts.

| Act | Depth range | Target time | Mood |
|---|---|---|---|
| 0. Start screen | — | until click | Instruction + warning |
| 1. Paradise | 0 – 200 m | ~90 s | Sunny, cute, safe |
| 2. Something's off | 200 – 1,000 m | ~60 s | Fading light, subtle wrongness |
| 3. The dark | 1,000 – 3,500 m | ~90 s | Flashlight, being watched |
| 3.5 False relief | 3,500 – 4,200 m | ~45 s | Beautiful, warm, then taken away |
| 4. The trauma | 4,200 – 10,900 m | ~120 s | Everything breaks |
| 5. Ending | 10,900 – 11,000 m | ~60 s | Eye, lure, jump scare, loop |

**Pacing rules**
- Each act has `metersPerScrollUnit` in config so the act feels longer or shorter.
- Each act has `minActDuration`. If the player scrolls faster than that, `resistance` rises until the minimum time has passed. Players cannot speed-run past the build-up.
- Act 4 uses heavy resistance plus `autoDrift` so the player is slowly pulled down.

---

## 6. Core systems

### 6.1 Virtual scroll (most important system)

- Native page scroll is disabled (`overflow: hidden`). Wheel, touch drag, arrow keys, Space and PageDown feed into `scroll.velocity`.
- Velocity has inertia and damping, so movement feels like sinking, not jumping.
- Director-controlled modifiers:
  - `allowUp` (bool) — false from 1,500 m onward.
  - `resistance` (0–1) — multiplies input.
  - `autoDrift` (m/s) — positive pulls the player down on its own.
  - `locked` (bool) — ignore all input during cinematic beats.
- When `allowUp` is false and the player scrolls up: no upward movement, a faint metal creak plays, and the view gets a small **downward** nudge.
- Exposes `idleTime` (seconds since last input) and `scrollSpeed` (for audio sync and motion blur).

### 6.2 World → screen

- Every object has a `depth` (m) and `x` (0–1 of screen width) plus a parallax `layer` factor.
- Screen Y = `(obj.depth - camDepth) * pxPerMeter * layer + screenHeight / 2`.
- Objects outside the view by more than one screen height are not updated or drawn.

### 6.3 Layer order (back to front)

1. Background gradient + god rays
2. Far parallax silhouettes
3. Marine snow / bubbles
4. Props, scratches, garden, fish, creatures
5. Companion
6. Darkness mask (flashlight)
7. Glowing things that should show through darkness (eyes, bioluminescence, companion glow)
8. Post FX: grain, vignette, chromatic aberration, cracks, glitch, static
9. UI: depth gauge, battery, radar
10. Custom cursor + ghost cursor

### 6.4 Background & palette

Color keyframes by depth, interpolated smoothly:

| Depth | Top color | Bottom color |
|---|---|---|
| 0 m (sky/surface) | `#9fe1f2` | `#3bb3d6` |
| 50 m | `#3bb3d6` | `#1f7fa8` |
| 200 m | `#1f7fa8` | `#0f3a5c` |
| 1,000 m | `#0b2236` | `#071623` |
| 3,000 m+ | `#060c13` | `#04080d` |

**Never pure black.** Minimum background is `#04080d` plus film grain and drifting marine snow. Pure black looks like a loading screen.

God rays: soft diagonal light shafts that sway, fully visible at 0–80 m, gone by 400 m.

### 6.5 Flashlight

- Enabled at 1,000 m. Darkness overlay covers the screen except a soft radial hole at the cursor (radius ~170 px, feathered edge, slight wobble).
- `isLit(x, y)` lets creatures check whether they're in the light.
- Flicker: brightness dips (never bright white flashes). Flicker frequency increases with depth.
- Battery: 100% at 4,200 m, drains to 0% by 10,000 m. Below 20%, the radius shrinks and flicker is constant.
- On mobile, the light follows the last touch point.

### 6.6 Fish school (boids)

- About 80 small colorful fish in Act 1 (40 on mobile).
- Rules: separation, alignment, cohesion, gentle attraction toward the cursor, scatter when the cursor moves fast.
- Beat `fishFlee` makes every fish rush toward the same screen edge at high speed, then despawn. No fish after this.

### 6.7 Companion (state machine)

Drawn as a small glowing orb-fish with a flicking tail. Warm glow `#ffe9a8`. Follows the cursor with a soft lag and gentle bobbing.

| State | When | Behavior |
|---|---|---|
| `CUTE` | 15 – 250 m | Follows lazily, chirps when the player clicks, does little loops |
| `NERVOUS` | 250 – 2,800 m | Stays closer to the cursor, jittery, glow pulses faster |
| `MIMIC` | 2,800 – 3,300 m | Chirps copy the player's clicks exactly, with a 0.8 s delay |
| `PREEMPT` | 3,300 – 4,200 m | Chirps *before* the player clicks (predict from cursor slowing down) |
| `HAPPY` | false relief | Dances in the garden, glow brighter |
| `GONE` | after first blackout | Removed. A few bubbles rise from its last position |
| `LURE` | ending | Reappears as a warm glow in darkness and drifts toward the camera |

The companion's chirp has a `corruption` parameter (0 → 1) that rises with depth (see Section 10).

### 6.8 Creatures (never fully shown)

All drawn procedurally with dark shapes, gradients and glows. No gore.

- **Whale pass (Act 1, ~150 m):** a huge whale crosses the whole screen slowly, larger than the viewport. Its eye blinks once while passing. This is a moment of wonder, not fear.
- **Edge silhouettes (Act 2):** a huge dark shape appears only at the screen edges for under 1.5 s. Three appearances, each one bigger and closer.
- **Glowing eyes (Act 3+):** pairs of pale eyes (`#cfe8c8`) in the dark. They fade out within 150 ms when lit, then reappear elsewhere, a little closer to the cursor.
- **Weeping-angel rule:** certain creatures move toward the player **only while not lit** and freeze when lit.
- **Tentacle (Act 3):** slides across just outside the flashlight radius, never inside it.
- **Giant eye (ending):** fills the screen, opens extremely slowly, and just watches. The pupil follows the cursor.
- **Mouth (jump scare):** see Section 8.

### 6.9 Props

- **Diver suit (1,300 m):** an empty old diving suit sitting on a ledge, facing the wall. After it has been lit, left the light, and been lit again, it is now **facing the player**. No other change, no sound.
- **Face in the rock (1,600 m):** rock texture with a face shape visible on the first light pass only. On any later pass it's plain rock.
- **Seafloor flashlight (2,000 m):** a flashlight lying on a ledge, still switched on, beam pointing into the dark. Next to it, an abandoned diving helmet.
- **Rope (2,300 m):** a rope hangs down from above, taut, with a faint tension creak. Then it goes slack and falls past the player.

### 6.10 Scratched messages

Carved into rock, low contrast, partly hidden, only readable in the flashlight. Drawn with jittered letters.

| Depth | Text |
|---|---|
| 1,100 m | `turn back` |
| 1,800 m | `don't follow the light` |
| 2,600 m | `it's not a fish` |
| 3,000 m | time-of-day line (Section 6.12) |
| 6,200 m | `it was never a fish` |

### 6.11 Ghost cursor

- The native cursor is hidden. A custom cursor is drawn (small ring with a dot).
- Phase 1 (from 4,300 m): a second, fainter cursor appears and replays the player's movement with a 0.6 s delay.
- Phase 2 (after ~12 s): it **stops mirroring** and holds still. Then it drifts slowly toward the real cursor. If they touch, it vanishes.
- Cursor vanish beat (7,500 m): the player's own cursor disappears for 4 s while the flashlight still moves.

### 6.12 Browser meta (`meta/browser.js`)

- **Tab title:** `LURE` by default. When the tab is hidden after 1,000 m, the title changes to `come back`. After 4,200 m it changes to `it's still here`. On return, restore the default after a 1 s delay.
- **Favicon:** drawn on a canvas and swapped by act: small fish → fish with an eye → just an eye.
- **Time-of-day line:** if the local time is between 23:00 and 05:00, the scratch reads `it's {h:mm} am. why are you still awake?`. Otherwise `why are you still here?`.
- **Persistence keys:** `lure.visits` (number), `lure.completed` (bool), `lure.reduceFlashing` (bool).
- **Returning after completion:** the surface is darker and grey, there is no companion, the lullaby is detuned from the start, and the only text on the start screen after clicking is `you came back.`
- **Fullscreen:** requested on the start click; failure is ignored silently.

### 6.13 Post FX (`effects.js`)

- **Film grain:** always on, subtle at the surface, stronger with depth.
- **Vignette:** tightens with depth ("pressure").
- **Chromatic aberration:** cheap fake — draw the glowing layer twice with red/cyan tints offset by a few px; offset grows in Act 4.
- **Cracks:** pre-generated branching crack paths that grow progressively from the screen edges from 6,500 m to 9,000 m, each new segment with a crack sound.
- **Glitch:** horizontal slice offsets for 100–300 ms.
- **Static:** noise frames over the whole screen for short signal-loss moments.
- **Screen shake:** small, only on big audio moments. Disabled with `prefers-reduced-motion`.

### 6.14 UI (diegetic, minimal)

- **Depth gauge** (bottom-left): `0000 m` in Share Tech Mono. Act 4 glitches: random digits flicker, then `ERROR`, then `----`.
- **Battery bar** (bottom-left, below gauge): appears at 4,200 m.
- **Sonar radar** (bottom-right, small circle): appears at 1,000 m. A sweep line pings every 4 s. Shows one slow blip that gets closer through Act 3–4.
- No other text on screen except scratches and the ending lines.

---

## 7. Beat sheet (`beats/beats.js`)

Each beat fires **once**. Format: trigger → actions. The director checks triggers every frame.

| ID | Trigger | Actions |
|---|---|---|
| B00 | page load | Start screen: `headphones on. lights off.` Below in small text: `contains horror, flickering light and one loud sound.` A `reduce flashing` toggle. `click to begin`. |
| B01 | start click | Create AudioContext, request fullscreen, fade in sunny surface with waves and gulls. Lullaby starts. |
| B02 | first scroll | Dive: camera plunges through the waves, splash, bubbles burst across the screen. Underwater low-pass filter sweeps on. |
| B03 | 15 m | Companion swims in, does a loop, chirps. State `CUTE`. |
| B04 | 0–200 m | Bubbles pop on hover with tiny pop sounds. Fish school active. |
| B05 | 150 m | Whale pass. Resistance 0.6 for 6 s. Eye blinks. Distant, majestic whale call. |
| B06 | 250 m | **Fish flee.** All fish rush to one edge, whoosh, then **2 s of total silence**, then audio resumes as if nothing happened. Companion → `NERVOUS`. |
| B07 | 300 m → 1,000 m | Lullaby slowly detunes and slows. Low drone fades in. |
| B08 | 450 m, 700 m, 900 m | Edge silhouette #1, #2, #3 (each bigger, closer). Each with a deep, pitched-down groan. |
| B09 | 1,000 m | Darkness. Flashlight click sound, flashlight on. Shepard tone starts. Radar appears. |
| B10 | 1,100 m+ | Scratched messages (Section 6.10). |
| B11 | 1,300 m | Diver suit (Section 6.9). |
| B12 | 1,500 m | `allowUp = false`. |
| B13 | Act 3+, idle > 3 s | All ambience ducks to zero, except close spatial breathing. When input resumes, ambience returns. |
| B14 | 1,600 m | Face in the rock. |
| B15 | 1,600 m+ | Glowing eyes and tentacle begin spawning. |
| B16 | 2,000 m | Seafloor flashlight and helmet. Humming lullaby starts very faintly from **below** and gets closer through Act 4. |
| B17 | 2,300 m | Rope goes slack and falls. |
| B18 | 2,800 m | Companion → `MIMIC`. |
| B19 | 3,300 m | Companion → `PREEMPT`. |
| B20 | 3,500 m | **False relief garden.** Warm pad, chimes, glowing plants (cyan `#5ef2e6`, violet `#9a7bff`). Companion → `HAPPY`. Drone and Shepard tone fade out. Resistance high so the player lingers. |
| B21 | 4,000 m | Garden lights go out **one by one, far to near**, each with a deep thud getting closer. The last one goes out right next to the cursor. Shepard tone returns. Battery bar appears. |
| B22 | 4,300 m | Ghost cursor phase 1 → phase 2. |
| B23 | 4,600 m | **Sonar lies.** Ping → 1 echo. Ping → 3 echoes. Ping → dozens of echoes; the radar fills with blips all around. |
| B24 | 5,000 m, after ≥10 s of near silence | **Three slow knocks** on the helmet glass, close and centered. |
| B25 | 5,500 m | Surface sounds (waves + lullaby) play from **below** via spatial audio. |
| B26 | 6,000 m | Helmet breathing stops. A different breathing continues for 5 s. |
| B27 | 6,500 → 9,000 m | Cracks grow progressively. |
| B28 | 7,000 m | Depth gauge glitches. |
| B29 | 7,500 m | Cursor vanishes for 4 s. |
| B30 | 8,000 m | Radio static burst with a barely audible whisper: `come back`. |
| B31 | 4,200 → 10,000 m | Heartbeat ramps 60 → 140 bpm; breathing gets ragged. |
| B32 | 10,000 m | `locked = true`. Flashlight: `click… click… click-click`. Battery 0. **Blackout.** **8 s absolute silence** (every source stopped, master gain 0). |
| B33 | after B32 | Weak light returns. **Companion is gone.** Bubbles rise from its last position. `locked = false`, battery at 5%, constant flicker. |
| B34 | 10,900 m | Bottom reached. `locked = true`. **Giant eye** opens over ~6 s, pupil follows cursor for 8 s. No sound except a low rumble. Eye closes. |
| B35 | after B34 | Flashlight dies for good. Faint lullaby from close by. A small warm glow appears: companion (`LURE`), chirping softly, drifting toward the camera. Chirp corrupts. |
| B36 | after B35 | **JUMP SCARE** (Section 8). |
| B37 | after B36 | Black. Bottom-right, small: `thank you for following.` Music box winds down note by note; last note hangs. Set `lure.completed = true`. |
| B38 | after B37 | Fade to the sunny surface (start state). Companion waits at 15 m for the next player. |

---

## 8. The jump scare (`mouth.js`)

- Starts from the companion's position.
- The warm glow is revealed to hang from a stalk. Behind it, in ~400 ms, a ring of needle teeth expands from the center to past the screen edges.
- Audio (≈1.5 s total), layered: the chirp pitch-drops into a growl, a screaming whale-like call, and a deep sub boom. Then an **instant cut to silence**.
- Screen shake on impact (unless reduced motion).
- Loudness capped by the master limiter (Section 9.1). It should make people jump, not hurt their ears.
- No blood, no gore.

---

## 9. Audio engine

### 9.1 Master chain

```
sources → buses (ambience, music, sfx, spatial)
        → underwaterFilter (lowpass)
        → reverbSend (convolver, generated impulse response)
        → masterGain (default 0.7)
        → limiter (DynamicsCompressor: threshold −6 dB, ratio 20, fast attack)
        → destination
```

- `underwaterFilter` cutoff: 20,000 Hz above water → 1,400 Hz after the dive → 600 Hz in the deep.
- Reverb wetness increases with depth (bigger, emptier space).
- Overall mix stays fairly quiet so people turn volume up themselves; jump scare peak must stay within the limiter.

### 9.2 Engine functions

- `duck(bus, toGain, seconds)` — smooth volume changes.
- `absoluteSilence(seconds)` — stop every source and set master to 0 (used in B06 and B32).
- `playFrom(name, position)` — spatial playback (below, behind, left, right) via HRTF `PannerNode`.
- `load(name)` — try `assets/audio/{name}.mp3`, else use the synth fallback.
- AudioContext is created only on the start click.

### 9.3 Music box lullaby (`music.js`)

An 8-bar melody in C major, about 84 bpm, music-box timbre (sine + quiet triangle partial, fast decay, slight shimmer):

```
C5 E5 G5 E5 | F5 A5 G5 – | E5 G5 C6 B5 | A5 G5 E5 – |
D5 F5 A5 F5 | E5 G5 C5 – | D5 E5 F5 D5 | C5 –  –  –
```

Controlled by parameters:
- `tempo` (multiplier) — slows from 1.0 to ~0.7 through Act 2.
- `detune` — random per-note cents, growing with depth.
- `dropout` — probability a note is skipped.
- `position` — can be played from "below" via spatial audio.
- `hummed` — same melody as a human-like hum (sawtooth through two formant bandpass filters + vibrato).
- `windDown()` — tempo slides toward zero, last note sustains and fades.

---

## 10. Sound list

Each has a procedural fallback in `synth.js`. Real files can be added later from Freesound.org (CC0), Pixabay sounds, or self-recorded.

| Name | Where | Description | Fallback idea |
|---|---|---|---|
| `waves` | surface | Gentle waves loop | Filtered noise with slow amplitude swells |
| `gulls` | surface | Distant gulls | Short pitch-swept sine chirps |
| `splash` | dive | Big splash | Noise burst, quick lowpass sweep down |
| `bubble_pop` | Act 1 | Tiny pop | Very short sine with fast pitch rise |
| `chirp` | companion | Cute rising "pwip" | Sine glide 1,200 → 1,800 Hz, 90 ms |
| `chirp_corrupt` | companion | Same chirp, degraded | Add waveshaper distortion, pitch drop, bit-crush feel by `corruption` |
| `whale_call` | B05 | Majestic call | Slow sine glides with vibrato, heavy reverb |
| `whoosh` | B06 | Fish rushing away | Bandpass noise sweep |
| `drone_low` | Act 2+ | Deep constant drone | Two detuned low sines (~45 Hz, 47 Hz) |
| `groan` | silhouettes | Huge distant groan | Low sawtooth glide, lowpass, long reverb |
| `shepard_down` | Act 3–4 | Endless falling tone | Shepard–Risset glissando: stacked octave sines gliding down with bell-shaped amplitude |
| `creak` | Act 3+ | Metal stress | Short resonant filtered noise + low sine clicks |
| `breath_helmet` | Act 3+ | Player breathing loop | Filtered noise in/out envelope, speed tied to `scrollSpeed` and heart rate |
| `breath_other` | B13, B26 | Someone else breathing | Same as above, different pitch, spatial |
| `heartbeat` | Act 3–4 | Thump-thump | Two short low sine thumps, rate from config |
| `sonar_ping` | radar | Ping with echo tail | Sine 1,000 Hz + feedback delay |
| `whisper` | Act 3+ | Unintelligible whispers circling head | Bandpassed noise with fast random formant movement, HRTF orbit |
| `hum_lullaby` | Act 3–4 | Human hum of the lullaby | `music.js` hummed mode |
| `warm_pad` | garden | Warm soft chords | Detuned triangle chord, slow attack |
| `chime` | garden | Underwater chimes | Bell-like FM sines |
| `thud` | B21 | Deep footstep-like thud | Low sine drop + noise click |
| `knock` | B24 | Knock on glass | Short bandpassed click with glassy resonance |
| `glass_crack` | cracks | Sharp crack | Noise burst through highpass + short metallic ring |
| `radio_static` | B30 | Static burst | White noise, bandpassed |
| `flashlight_click` | B09, B32 | Switch click | Very short click |
| `growl` | jump scare | Deep growl | Low sawtooth + fast amplitude modulation |
| `scream` | jump scare | Screaming call | Pitch-swept detuned saws, distorted |
| `sub_boom` | jump scare | Chest-hit boom | Sine 60 → 30 Hz, fast decay |
| `rumble` | giant eye | Very low rumble | Lowpassed brown noise |

**Headphone-only effects:** whispers circling the head, sounds from behind/below. The start screen recommends headphones for this reason.

---

## 11. Visual style

- Procedural drawing only (canvas paths, gradients, glows). No image assets required.
- Soft, slightly painterly shapes in Act 1; harsher, sparser, grainier in Act 4.
- Glow colors: companion `#ffe9a8`, eyes `#cfe8c8`, bioluminescence `#5ef2e6` / `#9a7bff`.
- Start screen: near-black background, small lowercase text, centered, Share Tech Mono.
- Motion is **slow**. Huge things move slowly. Fast movement only for fleeing fish and the jump scare.

---

## 12. Safety & accessibility

- Start screen states: horror, flickering light, one loud sound. Headphones recommended.
- **Photosensitivity:** no full-screen flashes. Flicker uses dimming, never white flashes, and never more than 3 flashes per second. `reduce flashing` toggle disables flicker entirely (light just dims).
- `prefers-reduced-motion`: no screen shake, reduced glitch.
- Master limiter always on.
- **Esc** opens a pause menu: Resume, Restart, Mute. The experience never blocks Esc.
- Mobile: touch input, fewer particles and fish, flashlight follows touch.

---

## 13. Build milestones

Stop after each milestone and let me test.

1. **Skeleton** — `index.html`, CSS, start screen (B00), canvas loop, virtual scroll with inertia, depth gauge, background colors by depth, config file. *Test: scroll 0 → 11,000 m and watch colors change.*
2. **Audio core** — engine, buses, underwater filter, reverb, limiter, loader with fallbacks, `waves`, `splash`, `bubble_pop`, `chirp`, lullaby sequencer.
3. **Act 1** — surface, dive (B02), god rays, particles, fish boids, companion `CUTE`, bubble popping, whale pass.
4. **Act 2** — fish flee + 2 s silence, lullaby detune, drone, edge silhouettes, companion `NERVOUS`, pacing (`minActDuration`, resistance).
5. **Act 3** — flashlight + `isLit`, radar, Shepard tone, scratches, diver suit, face rock, eyes, tentacle, no scrolling up, idle silence, breathing, spatial whispers, humming from below, rope, seafloor flashlight, companion `MIMIC` / `PREEMPT`.
6. **False relief** — garden, warm audio, companion `HAPPY`, lights going out far to near.
7. **Act 4** — battery, ghost cursor, sonar lies, knocks, surface from below, other breathing, cracks, gauge glitch, cursor vanish, static whisper, heartbeat ramp, blackout + 8 s silence, companion gone.
8. **Ending** — giant eye, companion `LURE`, jump scare, end text, wind-down, loop to surface, persistence, tab title, favicon, time-of-day line, returning-visitor version.
9. **Polish** — pause menu, reduce flashing, mobile, performance, tune all numbers in config.

---

## 14. Acceptance checklist

- [ ] Works with zero audio files (all fallbacks audible).
- [ ] Full run takes roughly 6–8 minutes even if the player scrolls fast.
- [ ] Player cannot scroll up after 1,500 m.
- [ ] Exactly one jump scare.
- [ ] The monster is never fully visible before the jump scare.
- [ ] No facts, labels or educational text anywhere.
- [ ] Background is never pure black.
- [ ] 8 s absolute silence at B32 is truly silent.
- [ ] Tab title changes when switching tabs after 1,000 m.
- [ ] Returning after completion shows the `you came back.` version.
- [ ] Esc pause menu works at all times.
- [ ] Reduce-flashing toggle removes all flicker.
- [ ] 60 fps on a mid-range laptop; usable on a phone.

---

## 15. Do not

- Do not add facts, zone names, or educational info.
- Do not show gore, blood, or human bodies (only the empty diving suit).
- Do not add more than one jump scare.
- Do not use pure black backgrounds.
- Do not add external libraries or frameworks without asking.
- Do not block Esc or the pause menu.
- Do not autoplay audio before the start click.
