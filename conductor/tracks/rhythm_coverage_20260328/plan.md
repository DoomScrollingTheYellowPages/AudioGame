# Plan: MidiParser & HitJudge Test Coverage

## Phase 1: MidiParser Tests [checkpoint: ]

### Task 1.1: Write failing MidiParser tests (Red) [x]
Create `test/rhythm/MidiParser.test.js` with 10 tests covering:
- Format 0 parse (note-on/off pair → note array)
- Format 1 multi-track parse
- BPM detection from tempo meta event
- Time signature meta event
- VLQ decoding (1-byte, 2-byte, 4-byte values)
- Running status
- Note-off via velocity=0
- Invalid header → error thrown
- Multiple simultaneous notes
- Track name from FF 03 meta

Run tests → confirm all 10 fail (MidiParser not yet testable from Node without fixes).

### Task 1.2: Fix MidiParser for Node.js testability (Green) [x]
Verify MidiParser uses only `DataView` and `ArrayBuffer` — no DOM/browser APIs.
Build a minimal helper `makeMidiBuffer(tracks, bpm)` in the test file.
Ensure all 10 tests pass.

### Task 1.3: Conductor - User Manual Verification 'Phase 1' (Protocol in workflow.md) [ ]

## Phase 2: HitJudge Tests [checkpoint: ]

### Task 2.1: Write failing HitJudge tests (Red) [x]
Create `test/rhythm/HitJudge.test.js` with 10 tests covering:
- Perfect tier (≤50ms)
- Great tier (≤100ms)
- Good tier (≤200ms)
- Miss (>200ms)
- Wrong pitch → no match
- Pitch-class matching across octaves
- Combo accumulation
- Score multiplier (1 + floor(combo/10), max 4×)
- reset() clears all stats
- pitchName() returns correct chromatic names

Run tests → confirm all fail (HitJudge requires engine mock).

### Task 2.2: Implement HitJudge tests with engine mock (Green) [x]
Build a minimal `MockEngine` that returns a fixed note list and current position.
Ensure all 10 HitJudge tests pass.

### Task 2.3: Conductor - User Manual Verification 'Phase 2' (Protocol in workflow.md) [ ]

## Phase 3: Synth Tests [checkpoint: ]

### Task 3.1: Write Synth unit tests (Red) [x]
Create `test/audio/Synth.test.js` with 4 tests:
- midiToFreq(69) = 440
- midiToFreq(60) ≈ 261.63
- noteOff on unstarted note does not throw
- allNotesOff on empty Synth does not throw
Mock `window.AudioContext` → confirm tests fail first.

### Task 3.2: Implement Synth tests with AudioContext mock (Green) [x]
Provide a lightweight `window.AudioContext` mock via globalThis in the test file.
Ensure all 4 tests pass.

### Task 3.3: Conductor - User Manual Verification 'Phase 3' (Protocol in workflow.md) [ ]
