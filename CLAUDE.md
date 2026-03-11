# AudioGame

Zero-dependency browser app for music education — flashcards, music games, and audio/MIDI monitoring. Pure HTML/JS/CSS with native ES modules, Web Audio API, and Web MIDI API. No build system, no package.json.

## Dev Server

```bash
dotnet-serve -p 8080 -o --mime .js=application/javascript
```

ES modules require HTTP (not `file://`). Config lives in `.claude/launch.json`. Alternatives: `python -m http.server 8080`, `npx http-server -p 8080`.

## Architecture

**EventBus is the backbone.** Every module communicates through `bus.emit()` / `bus.on()`. No globals, no singletons. Each HTML page creates its own EventBus + input instances in its `*-main.js` entry point.

**Page wiring pattern** (every page follows this):
1. Create `EventBus`
2. Create input modules (`AudioInput`, `MIDIInput`)
3. Create UI/game modules, passing `bus` to each
4. Wire DOM event listeners
5. Subscribe to bus events
6. Call `midiInput.init()`

**Module contracts:**
- Constructors take `(bus)` or `(element, bus)` — never reach for globals
- Input modules emit events; UI/game modules subscribe
- No direct coupling between sibling modules

## Event Names

Use `namespace:action` kebab format. Key events:

| Event | Payload |
|---|---|
| `audio:frame` | `{ timeDomain, rms, peak, sampleRate }` |
| `audio:state` | `{ active, error? }` |
| `audio:pitch` | `{ freq, midiNote, noteName, octave, cents }` |
| `midi:noteOn` | `{ note, velocity, channel }` |
| `midi:noteOff` | `{ note, channel }` |
| `midi:state` | `{ supported, access, error? }` |
| `midi:devices` | `{ inputs: [{id, name}] }` |
| `song:tick` | `{ position, notes }` |
| `song:end` | `{}` |
| `hit:judge` | `{ noteIndex, tier, points, combo, delta }` |
| `hit:miss` | `{ noteIndex }` |

## Code Style

- **2-space indent**, no tabs
- **Named exports only** — never `export default`
- **Always use `.js` extension** in import paths
- **Private fields**: `_camelCase` prefix (e.g., `this._bus`, `this._running`)
- **Constants**: `UPPER_CASE` at module scope
- **Classes**: PascalCase. **Functions/methods**: camelCase
- **Comments**: section headers use `// ── Section Name ──`, file headers use dash-line blocks
- **JSDoc** on public methods: `/** @param {Type} name */`

## Canvas Conventions

All canvas modules follow:
- Store `this._canvas` and `this._ctx` in constructor
- `draw(data)` or `render(data)` redraws the full frame each call (no incremental updates)
- Use module-level `const COLORS = {...}` for the palette
- Rounded rectangles via `quadraticCurveTo`, note heads via `ctx.ellipse()`

## CSS Conventions

- Inline `<style>` per page — no external stylesheets
- Dark theme: `#0d0d0d` bg, `#e0e0e0` text, `#00ff88` accent, `#ff4444` error
- Font: `'Courier New', monospace` everywhere
- Score tier colours: Perfect `#00ff88`, Great `#88cc44`, Good `#ccaa22`, Miss `#ff4444`
- Buttons/inputs: `#1a1a1a` bg, `#2a2a2a` border, hover transitions `0.2s`

## Game Design Rules

- **Natural notes only** — no sharps/flats in any game mode
- **Pitch matching is pitch-class only** — any octave of the correct letter counts
- Music game note buttons and highway lanes: **C D E F G A B ascending** (C at bottom)
- Keyboard mapping: `a=C s=D d=E f=F g=G h=A j=B`
- Hit windows: Perfect ≤50ms, Great ≤100ms, Good ≤200ms
- Combo multiplier: `1 + floor(combo/10)`, max 4x

## Staff Notation Coordinates

Two systems coexist:

**Flashcard** (`StaffRenderer.js`): `staffPos` where 0 = E4 (bottom treble line), +1 per diatonic step up. Canvas Y = `bottomLineY - staffPos * HALF_STEP`.

**Rhythm** (`StaffHighway.js`): Diatonic position `d` where E4 = 30. Grand staff (treble + bass). Canvas Y = `REF_Y - (d - 30) * STEP_PX`. Treble lines: d 30-38, bass lines: d 18-26, middle C: d 28.

## Gotchas

- **Web MIDI requires HTTPS or localhost** — Chrome blocks it on plain HTTP
- **AudioContext must be created after user gesture** — `AudioInput.start()` handles this
- **Canvas `width`/`height` attributes set resolution; CSS `width`/`height` set display size** — they must match or graphics blur
- **SongEngine adds a 2-second count-in** to all note times — account for this offset when comparing positions
- **MidiParser handles both Format 0 and Format 1** — Format 1 merges tracks by sorting on tick
- **Unicode music glyphs** (U+1D11E treble, U+1D122 bass) require `serif` font in canvas; not all systems render them identically
- **PitchDetector uses IIR smoothing** (0.75 old + 0.25 new) with a stability gate (3 consecutive matching frames) — latency is intentional to avoid jitter

## File Map

```
index.html                    Main nav (3 game cards)
input-config.html             Audio + MIDI monitor
flashcard.html                Note identification game
rhythm.html                   Guitar Hero-style music game
src/
  main.js                     Entry: input-config
  flashcard-main.js           Entry: flashcard
  rhythm-main.js              Entry: rhythm
  core/
    EventBus.js               Pub/sub backbone
    utils.js                  noteName(), timestamp()
    PitchDetector.js          Autocorrelation pitch detection + bus bridge
  input/
    AudioInput.js             Mic capture → audio:frame, audio:state
    MIDIInput.js              Web MIDI → midi:noteOn/Off/cc/raw/state/devices
  ui/
    Oscilloscope.js           Waveform canvas
    Tuner.js                  Pitch/note display
    KeyboardDisplay.js        Piano keyboard C2–C7
    CCDisplay.js              CC bar display
    MIDILog.js                Scrolling event log
  flashcard/
    FlashcardGame.js          Game logic + scoring
    StaffRenderer.js          Treble clef staff canvas
  rhythm/
    SongEngine.js             rAF playback clock → song:tick/end
    Highway.js                Piano-roll 7-lane renderer
    StaffHighway.js           Grand staff notation renderer
    HitJudge.js               Timing windows + scoring → hit:judge/miss
    DemoSongs.js              6 built-in songs + MIDI export
    MidiParser.js             Parse .mid Format 0 & 1
    MidiWriter.js             Generate .mid Format 0
```
