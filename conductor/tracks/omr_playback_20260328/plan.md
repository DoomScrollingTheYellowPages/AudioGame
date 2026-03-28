# Plan: OMR Playback Preview

## Phase 1: OMRPlayer Module [checkpoint: pending]

- [x] Task: Write failing tests for OMRPlayer
  - [x] Sub-task: Test midiToFreq(69) === 440
  - [x] Sub-task: Test midiToFreq(60) ≈ 261.63 (middle C)
  - [x] Sub-task: Test play() sets isPlaying=true; stop() sets isPlaying=false
  - [x] Sub-task: Test play() with empty notes array completes without error

- [x] Task: Implement OMRPlayer
  - [x] Sub-task: Create src/sheet2midi/OMRPlayer.js
  - [x] Sub-task: Implement midiToFreq static helper
  - [x] Sub-task: Implement play(notes, bpm) with AudioContext scheduling
  - [x] Sub-task: Implement stop() that disconnects all scheduled nodes
  - [x] Sub-task: Implement isPlaying getter

- [x] Task: Conductor - User Manual Verification 'Phase 1: OMRPlayer Module' (Protocol in workflow.md)

## Phase 2: UI Integration [checkpoint: pending]

- [x] Task: Add Play button to sheet2midi.html
  - [x] Sub-task: Add `<button id="play-btn" disabled>&#9654; Play</button>` in results area
  - [x] Sub-task: Style consistently with Download MIDI button

- [x] Task: Wire OMRPlayer in sheet2midi-main.js
  - [x] Sub-task: Import OMRPlayer
  - [x] Sub-task: Create player instance
  - [x] Sub-task: Store notes+bpm after process; enable play-btn
  - [x] Sub-task: play-btn click: toggle play/stop, update button label
  - [x] Sub-task: On new process run, stop any current playback

- [x] Task: Conductor - User Manual Verification 'Phase 2: UI Integration' (Protocol in workflow.md)
