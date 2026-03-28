# Spec: MidiParser & HitJudge Test Coverage

## Overview

Two production modules central to the rhythm game — `MidiParser.js` and `HitJudge.js` —
have zero unit test coverage. This track adds comprehensive tests for both, anchoring
game-critical logic against regressions and serving as documentation.

## Current State

- `MidiParser.js`: parses SMF Format 0 and Format 1 `.mid` files from `ArrayBuffer`.
  Used by the rhythm game's "upload MIDI" feature. Zero tests.
- `HitJudge.js`: timing windows (Perfect ≤50ms, Great ≤100ms, Good ≤200ms), combo
  multiplier, score calculation, pitch matching. Zero tests.
- `Synth.js`: Web Audio synthesizer used by flashcard and rhythm game. Zero tests.

## Functional Requirements

### MidiParser Tests
1. Parse a minimal Format 0 MIDI file with a note-on/note-off pair → correct note array
2. Parse Format 1 (multi-track) → notes merged + per-track arrays returned
3. Detect BPM from tempo meta event (µs/beat → BPM conversion)
4. Detect time signature from meta event
5. Variable-length quantity (VLQ) decoding: single byte, two bytes, four bytes
6. Running status: note-on followed by data-only event reuses the previous status byte
7. Note-off via velocity=0 note-on: `0x90 note 0x00` closes the note
8. Error thrown for non-MIDI buffer (wrong header)
9. Multiple notes at same tick time → all included with same time offset
10. Track name from `FF 03` meta event → appears in tracks[].name

### HitJudge Tests
1. Input within ±50ms → `Perfect` tier, 100 base points
2. Input within ±100ms → `Great` tier, 75 base points
3. Input within ±200ms → `Good` tier, 50 base points
4. Input outside 200ms window → miss; note marked and score unchanged
5. Wrong pitch → no match (different pitch class = no hit)
6. Correct pitch-class in any octave → matches
7. Combo accumulates on consecutive hits; resets on miss
8. Score multiplier: `1 + floor(combo/10)`, capped at 4×
9. `reset()` clears all stats
10. `pitchName(midiNote)` returns correct chromatic name

### Synth Tests (lightweight — no Web Audio context needed)
1. `midiToFreq(69)` = 440 Hz (A4)
2. `midiToFreq(60)` ≈ 261.63 Hz (C4)
3. Calling `noteOff` on a note that was never started does nothing (no throw)
4. Calling `allNotesOff` on an empty synth does nothing

## Non-Functional Requirements

- All tests must run in Node.js (`node:test`) without a browser or DOM
- Build synthetic MIDI buffers programmatically (no `.mid` file fixtures needed)
- For Synth, mock `window.AudioContext` where needed, or test only non-audio methods

## Acceptance Criteria

1. `test/rhythm/MidiParser.test.js` with ≥ 10 passing tests
2. `test/rhythm/HitJudge.test.js` with ≥ 10 passing tests
3. `test/audio/Synth.test.js` with ≥ 4 passing tests
4. All 319 existing tests continue to pass
5. Each test is self-contained: builds its own input data, needs no external files

## Out of Scope

- Testing Highway.js, StaffHighway.js, FingeringHighway.js (canvas-dependent)
- Testing SongEngine.js (requestAnimationFrame-dependent)
- Real `.mid` file fixtures (not needed for unit tests)
