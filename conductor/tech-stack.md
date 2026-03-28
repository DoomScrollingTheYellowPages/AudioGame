# Technology Stack

## Language

- **JavaScript (ES2020+)** — Native ES modules (`import`/`export`), no transpilation
- No TypeScript, no JSX, no compile step

## Frameworks & Dependencies

- **None** — Zero external dependencies. No `package.json`, no `node_modules`, no build system.
- All functionality is implemented with browser-native APIs.

## Browser APIs

- **Web Audio API** — Real-time microphone capture, audio analysis, and synthesis
- **Web MIDI API** — Hardware MIDI device input (note on/off, CC, device enumeration)
- **Canvas API** — 2D rendering for all game visuals: staff notation, note highways, piano keyboard, fingering charts, oscilloscope
- **File API** — MIDI file upload and image loading for OMR

## Frontend

- **HTML** — One HTML file per page/game mode
- **CSS** — Inline `<style>` per page, no external stylesheets. Dark theme default with planned theme system.
- **JavaScript** — Vanilla, class-based modules. EventBus pub/sub architecture for all inter-module communication.

## Dev Server

- **Primary:** `dotnet-serve -p 8080` (configured in `.claude/launch.json`)
- **Alternatives:** `python -m http.server 8080`, `npx http-server -p 8080`
- ES modules require HTTP — `file://` protocol will not work

## Version Control

- **Git** — Standard Git workflow, hosted on GitHub

## Constraints

- HTTPS or localhost required for Web MIDI access
- AudioContext must be created after a user gesture (browser security policy)
- No server-side logic — the app is entirely client-side
