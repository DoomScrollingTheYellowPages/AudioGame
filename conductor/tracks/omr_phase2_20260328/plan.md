# Plan: OMR Pipeline Phase 2 — Key Signatures, Rhythm Verification & Grand Staff Tests

## Phase 1: Key Signature Pipeline Wiring [checkpoint: ]

### Task 1.1: Write failing key signature tests (Red) [x] ee2595a
Extend `test/sheet2midi/PitchMapper.test.js` with tests for:
- G major (1 sharp): F note → F# (midiNote +1)
- D major (2 sharps): F and C both raised
- Inline accidental overrides key sig
- NATURAL cancels key sig
Tests will fail because `assignPitches()` does not call key sig methods yet.

### Task 1.2: Wire key sig detection into assignPitches (Green) [x] ee2595a
In `src/sheet2midi/PitchMapper.js` `assignPitches()`:
- Call `detectKeySignature()` per staff group
- Call `pairInlineAccidentals()` on the result
- Call `applyAccidentals()` before returning

### Task 1.3: Add MIDI key signature meta event [x] ee2595a
In `src/sheet2midi/OMREngine.js` `process()`:
- After pitch assignment, if key sig is non-empty, write FF 59 02 meta event into MidiWriter output.
- Update `MidiWriter.build()` / `buildMultiTrack()` to accept an optional `keySig` parameter and emit the meta event at tick 0.

### Task 1.4: Conductor - User Manual Verification 'Phase 1' (Protocol in workflow.md) [ ]

---

## Phase 2: Rhythmic Output Verification [checkpoint: ]

### Task 2.1: Write failing rhythmic tick tests (Red) [ ]
Extend `test/sheet2midi/MidiWriter.test.js` with tick-precision tests:
- Whole note (4 beats) → 1920-tick note-off delta
- Half note (2 beats) → 960-tick delta
- Dotted quarter (1.5 beats) → 720-tick delta
- Eighth note (0.5 beats) → 240-tick delta
- Sixteenth note (0.25 beats) → 120-tick delta
Tests parse MIDI bytes to verify actual delta values.

### Task 2.2: Fix tick conversion if tests fail (Green) [ ]
If any tick tests fail, correct the beats-to-ticks formula in `MidiWriter.build()`.
If all pass immediately, mark complete and move on.

### Task 2.3: Conductor - User Manual Verification 'Phase 2' (Protocol in workflow.md) [ ]

---

## Phase 3: Grand Staff Unit Tests [checkpoint: ]

### Task 3.1: Write failing _buildClefMap tests (Red) [ ]
Add tests to `test/sheet2midi/PitchMapper.test.js`:
- Brace spanning two staves → top=treble, bottom=bass
- No brace, gap < 8×staffSpace → top=treble, bottom=bass
- No brace, no gap, exactly 2 staves → fallback assigns treble+bass
- Single staff → no clef assigned via grand staff logic

### Task 3.2: Write failing Format 1 assembly tests (Red) [ ]
Extend `test/sheet2midi/OMREngine.test.js`:
- Treble notes (clef='treble') appear only in track 1 of Format 1 output
- Bass notes (clef='bass') appear only in track 2
- Mixed treble+bass produces correct two-track note distribution

### Task 3.3: Fix any failures (Green) [ ]
Address any failures found in Tasks 3.1–3.2.
If all pass immediately, mark complete.

### Task 3.4: Conductor - User Manual Verification 'Phase 3' (Protocol in workflow.md) [ ]
