# Track: Grand Staff OMR Support

## Overview

Extend the OMR pipeline to correctly process grand staff (piano) scores — sheets containing
paired treble and bass staves. Each staff is assigned the correct clef, noteheads on both
staves are mapped to correct pitches, and the output is a two-track MIDI file (treble =
track 1, bass = track 2).

## Functional Requirements

### 1. Clef Selector UI
- Add "Grand Staff (Auto)" as a new option in the clef selector, set as the default selected
  value (replacing the current "Bass" default).
- The existing "Treble", "Bass", and "Auto" options remain.
- When "Grand Staff (Auto)" is selected, the pipeline uses the grand staff detection path
  described below.
- When "Auto" is selected without grand staff, single-staff NCC detection runs as before.

### 2. Grand Staff Pair Detection (cascading priority)
1. **Brace detection (primary):** A tall curved `{` bracket on the left margin that
   vertically spans at least 80% of the distance between the top line of the upper staff and
   the bottom line of the lower staff confirms a grand staff pair.
2. **Gap threshold (secondary):** If no brace is found, two adjacent staves whose vertical
   gap is less than 8× staffSpace are treated as a grand staff pair.
3. **First-two fallback (tertiary):** If only one staff pair candidate exists and neither
   brace nor gap heuristic fires, the first two detected staves are paired.

Brace takes full precedence — if a brace is detected, the gap and fallback methods are
skipped entirely.

### 3. Brace Symbol Classification
- Add `brace` to `SymbolType` in `SymbolClassifier`.
- A brace candidate: heightSS ≥ 6.0, widthSS between 0.3–1.5, fillRatio < 0.35,
  aspectRatio < 0.25, located in the leftmost region of the image (x < 3× staffSpace).

### 4. Clef Assignment for Grand Staff Pairs
- Upper staff of a confirmed pair → treble clef.
- Lower staff of a confirmed pair → bass clef.
- NCC and symbol-based detection are bypassed for paired staves.
- Single unpaired staves continue to use the existing NCC + symbol detection path.

### 5. Pitch Mapping
- Treble staff: bottom line = E4, existing mapping unchanged.
- Bass staff: bottom line = G2, existing mapping unchanged.
- Ledger lines around middle C (C4) must resolve correctly on both staves.

### 6. MIDI Output
- Grand staff scores produce Format 1 MIDI with two tracks:
  - Track 1: treble staff notes (sorted by x-position)
  - Track 2: bass staff notes (sorted by x-position)
- Single-staff scores continue to produce Format 0 (single-track) MIDI.
- `MidiWriter` must be extended to support Format 1 multi-track output.

### 7. Test Fixtures
- User will supply two real photographs of natural notes spanning a grand staff, named
  `grandstaffmono...`. Expected JSON files will be authored once images are provided.
- Fixtures must cover: notes on both staves, correct clef per staff, correct MIDI track
  assignment, and middle C boundary notes.

### 8. Validation Tests
- Add `validateFixture` calls for both grand staff fixtures in `omr-validation.test.js`.
- Tests assert: note count per staff, pitch names, MIDI note numbers, bar count, and
  two-track MIDI output.

## Non-Functional Requirements
- No new external dependencies.
- Brace detection must not degrade existing single-staff test accuracy.
- All brace/pairing logic runs in the existing component-labeling pass.

## Acceptance Criteria
- [ ] `SymbolClassifier` detects and labels `brace` symbols.
- [ ] `PitchMapper._buildClefMap` uses brace → gap → first-two cascade for pairing.
- [ ] Upper/lower staves of a confirmed pair are assigned treble/bass without NCC.
- [ ] `MidiWriter` produces Format 1 two-track MIDI for grand staff input.
- [ ] "Grand Staff (Auto)" is the default clef selector option.
- [ ] Both grand staff photo fixtures pass all pitch and track validation assertions.
- [ ] All existing CMajorScale, AMinorScale, BassStaffScale tests continue to pass.

## Out of Scope
- Multiple grand staff systems per page (multi-system scores).
- Square bracket detection (orchestral instrument groups).
- Three-staff systems (e.g., organ).
- Polyphonic voices within a single staff.
- Quantization or rhythm correction for real photo input.
