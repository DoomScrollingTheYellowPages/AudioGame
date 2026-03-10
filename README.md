# AudioGame

A browser-based audio/MIDI input monitor for building music learning games. Real-time pitch detection and MIDI device input with a clean, modular EventBus architecture.

## Features

- **Audio Input** — Microphone capture with live oscilloscope visualization and RMS/peak metering
- **MIDI Input** — Web MIDI API support for keyboard devices with visual feedback
- **Piano Keyboard Display** — Interactive visualization of held notes (C2–C7)
- **CC Monitoring** — Dynamic Control Change bars with real-time value tracking
- **Message Log** — Scrolling log of all MIDI events (Note On/Off, CC, raw)
- **Zero Global State** — All modules communicate through an injected EventBus; perfect for embedding

## Architecture

```
src/
├── core/
│   ├── EventBus.js          Lightweight pub/sub (30 lines)
│   └── utils.js             Shared utilities
├── input/
│   ├── AudioInput.js        Web Audio API microphone capture
│   └── MIDIInput.js         Web MIDI API device management
└── ui/
    ├── Oscilloscope.js      Waveform display with zero-crossing stabilization
    ├── KeyboardDisplay.js   Piano keyboard with held note visualization
    ├── CCDisplay.js         Dynamic CC control bars
    └── MIDILog.js           Scrolling event message log

main.js                       Wiring (only file that imports everything)
```

## Getting Started

### Prerequisites
- Modern browser (Chrome, Edge, Firefox, Opera)
- For MIDI support: macOS/Windows/Linux with USB MIDI devices
- For audio input: microphone access

### Run Locally

```bash
# Using dotnet-serve (included in .claude/launch.json)
dotnet-serve -p 8080

# Or any static file server (Python, Node, etc)
# ES modules require HTTP—file:// won't work
```

Then open `http://localhost:8080` in your browser.

**MIDI Permissions:** Your browser will prompt you to allow MIDI access on first use. Grant it to see connected devices.

**Audio Permissions:** Click "Enable Microphone" to request mic access.

## Design Patterns

### Event-Driven Architecture
All communication flows through an `EventBus` instance. Inputs publish events; UI modules and future game logic subscribe.

```javascript
// Input emits
bus.emit('audio:frame', { timeDomain, rms, peak });
bus.emit('midi:noteOn', { note, velocity, channel });
bus.emit('midi:cc', { cc, value, channel });

// UI subscribes
bus.on('audio:frame', (data) => oscilloscope.draw(data));
bus.on('midi:noteOn', (data) => keyboard.highlightNote(data.note));
```

### Dependency Injection
Every module receives its container element and EventBus in the constructor. No DOM queries, no global singletons.

```javascript
const bus = new EventBus();
const oscilloscope = new Oscilloscope(document.getElementById('audio-panel'), bus);
const keyboard = new KeyboardDisplay(document.getElementById('keyboard-wrap'), bus);
```

### ES Modules Without Build Step
Native ES module support in modern browsers. Zero npm dependencies. Add a bundler later if needed.

## Instrument Profiles

The architecture is designed to support instrument-specific pitch detection constraints:

| Instrument | Frequency Range | Notes |
|---|---|---|
| Voice | 80–1175 Hz | Monophonic |
| Flute | 262–2349 Hz | Monophonic, low harmonic content |
| Clarinet | 147–2093 Hz | Monophonic, suppresses even harmonics |
| Alto Sax | 233–1480 Hz | Monophonic, rich harmonics |
| Guitar | 82–700 Hz | Polyphonic (future) |
| Bass | 41–300 Hz | Polyphonic (future) |

Pitch detection is handled separately from this monitor. See `src/input/AudioInput.js` for where to integrate a pitch detector.

## Future

- **Pitch Detection** — YIN algorithm for monophonic instruments
- **Game Engine** — Score player performance based on accuracy
- **MIDI File Upload** — Parse and display note sequences
- **Display Modes** — Piano roll, guitar tab, standard notation
- **Custom Note Skins** — User-uploaded images as note representations
- **Multi-instrument Support** — Chord detection for polyphonic instruments
- **Mobile Support** — Responsive design and Capacitor for native MIDI on iOS

## Technology Stack

- **Web Audio API** — Real-time audio capture and analysis
- **Web MIDI API** — Hardware MIDI device input
- **Canvas API** — Oscilloscope and keyboard rendering
- **Vanilla JavaScript** — No frameworks, ES modules only
- **CSS Grid/Flexbox** — Responsive layout

## Browser Support

| Browser | Web Audio | Web MIDI | Status |
|---|---|---|---|
| Chrome/Edge | ✅ | ✅ | Full support |
| Firefox | ✅ | ✅ | Full support (Web MIDI since v109) |
| Safari | ✅ | ❌ | Audio only; use Jazz-Soft plugin for MIDI |
| Mobile (Android) | ✅ | ⚠️ | Experimental; Capacitor recommended |
| Mobile (iOS) | ✅ | ❌ | Audio only; no Web MIDI support |

## License

MIT

## Contributing

Contributions welcome. This is the foundation for a larger music game project—all modules are designed to be extended without breaking existing code.

---

**Running the dev server:** `dotnet-serve -p 8080` from the project root.

**Next steps:** Integrate a YIN-based pitch detector into `AudioInput`, wire it to the event bus, and build a scoring engine that compares detected pitches against a parsed MIDI file.
