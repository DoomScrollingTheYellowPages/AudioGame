# Track: OMR Playback Preview

## Overview

After OMR converts a sheet music image to MIDI notes, users currently have no way to
hear the result without downloading the MIDI file and opening it in a separate app.
This track adds an in-browser "Play" button that synthesizes the detected notes using
the Web Audio API, closing the feedback loop immediately after conversion.

## Functional Requirements

### 1. OMRPlayer Module
- Create `src/sheet2midi/OMRPlayer.js` — a self-contained Web Audio synthesizer.
- `play(notes, bpm)`: schedules all notes sequentially using `AudioContext` scheduling.
  - Each note: sine wave oscillator at MIDI frequency, gain envelope (fast attack/release).
  - Duration per note = `(60 / bpm) * beats` seconds minus a short gap (0.05s).
  - MIDI to frequency: `440 * 2^((midiNote - 69) / 12)`.
- `stop()`: cancels all scheduled nodes immediately.
- `isPlaying`: boolean getter.
- Uses lazy `AudioContext` creation on first `play()` call (after user gesture).

### 2. UI — Play Button
- Add a "▶ Play" button to the results area in `sheet2midi.html`, next to "Download MIDI".
- While playing, the button changes to "■ Stop".
- After playback ends naturally, the button reverts to "▶ Play".
- The button is disabled when no result is available.

### 3. Wire-up in sheet2midi-main.js
- Import `OMRPlayer` and create an instance.
- Store `result.notes` and `bpm` after each successful process.
- Play button click: call `player.play(notes, bpm)` / `player.stop()`.
- Update button label based on playback state.

## Non-Functional Requirements
- Zero new external dependencies — Web Audio API only.
- `OMRPlayer` must not depend on the DOM (pure audio logic).
- Grand staff Format 1 MIDI: notes from both treble and bass tracks are interleaved by
  x-position (time), so all notes play in score order regardless of track.

## Acceptance Criteria
- [ ] `OMRPlayer.play(notes, bpm)` synthesizes notes in order using Web Audio.
- [ ] `OMRPlayer.stop()` halts playback immediately.
- [ ] "▶ Play" button appears in results area after successful OMR conversion.
- [ ] Button toggles to "■ Stop" during playback and reverts when done.
- [ ] Playback uses the BPM value from the BPM input field.
- [ ] Unit tests cover: frequency calculation, play/stop lifecycle.

## Out of Scope
- Polyphonic (simultaneous) note playback.
- Instrument selection / timbre variation.
- Visual note highlighting during playback.
- Playback for grand staff with simultaneous treble+bass (notes play sequentially by x-pos).
