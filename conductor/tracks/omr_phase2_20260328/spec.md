# Spec: OMR Pipeline Phase 2 — Key Signatures, Rhythm Verification & Grand Staff Tests

## Overview

The OMR pipeline has three areas requiring further development:

1. **Key signature wiring**: `PitchMapper` already contains `detectKeySignature()`, `pairInlineAccidentals()`, and `applyAccidentals()` but none of these are called from `assignPitches()` or `OMREngine.process()`. Sheet music with key signatures currently produces incorrect pitches (e.g. G major produces F natural instead of F#).

2. **Rhythmic output verification**: `DurationMapper` is wired up and already assigns `beats` values, but there are no tests that verify the beats-to-MIDI-ticks conversion end-to-end (e.g. a whole note should produce 1920 ticks at 480 TPQ, a dotted quarter should produce 720 ticks).

3. **Grand staff test coverage**: `PitchMapper._buildClefMap()` (brace/gap/fallback cascade) and the Format 1 two-track MIDI assembly path have no unit tests. Any regression in this code is invisible.

## Functional Requirements

### 1. Key Signature Pipeline
1. `assignPitches()` must call `detectKeySignature()` for each staff group to obtain the active sharps/flats set.
2. `assignPitches()` must call `pairInlineAccidentals()` to detect per-note inline accidentals.
3. `assignPitches()` must call `applyAccidentals()` to adjust MIDI note numbers before returning.
4. `OMREngine.process()` must write a MIDI key signature meta event (FF 59 02) to the track header when a non-empty key signature is detected.

### 2. Rhythmic Output Verification
1. At 480 ticks-per-quarter (the project standard), verified tick mappings:
   - Whole note (4 beats) → 1920 ticks
   - Half note (2 beats) → 960 ticks
   - Quarter note (1 beat) → 480 ticks
   - Dotted quarter (1.5 beats) → 720 ticks
   - Eighth note (0.5 beats) → 240 ticks
   - Sixteenth note (0.25 beats) → 120 ticks
2. Tests must parse the MIDI byte output to confirm actual tick delta values.

### 3. Grand Staff Unit Tests
1. `_buildClefMap()` with a brace symbol spanning two staves → top staff = treble, bottom = bass.
2. `_buildClefMap()` with no brace but gap < 8×staffSpace → top = treble, bottom = bass.
3. `_buildClefMap()` with exactly 2 staves and no brace/gap match → fallback assigns treble+bass.
4. Format 1 MIDI assembly: treble-clef notes appear only in track 1, bass-clef notes only in track 2.
5. Pitch accuracy: a notehead on the bottom treble line maps to MIDI 64 (E4); on the bottom bass line maps to MIDI 43 (G2).

## Acceptance Criteria

1. `test/sheet2midi/PitchMapper.test.js` extended with key signature tests:
   - G major (1 sharp): F note → F# (MIDI +1)
   - D major (2 sharps): F and C → F# and C#
   - Inline sharp overrides key sig flat
   - NATURAL (offset 0) cancels key sig
2. `test/sheet2midi/MidiWriter.test.js` extended with tick-precision tests:
   - Whole note → 1920-tick note-off delta
   - Dotted quarter → 720-tick delta
   - Eighth → 240-tick delta
3. `test/sheet2midi/PitchMapper.test.js` extended with `_buildClefMap` tests (all three detection methods)
4. `test/sheet2midi/OMREngine.test.js` extended with Format 1 two-track assembly tests
5. All 403 existing tests continue to pass

## Out of Scope

- Key signature UI selector in sheet2midi.html
- Multi-measure key signature changes (key changes mid-piece)
- Time signature detection improvements
- Sharp classifier threshold tuning (separate track)
