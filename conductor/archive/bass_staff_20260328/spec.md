---
title: Bass Staff Support (OMR Pipeline)
type: feature
status: in_progress
---

# Spec: Bass Staff Support (OMR Pipeline)

## Overview

Add bass clef support to the Sheet2MIDI OMR pipeline. The pipeline currently defaults to treble clef when no clef symbol is detected. This track changes the default to bass clef, adds a UI clef selector (defaulting to bass), and validates the output against a ground truth bass staff test fixture.

## Functional Requirements

### FR1 — Clef Override Parameter
`PitchMapper.assignPitches()` must accept an optional `clefOverride` parameter (`'treble'|'bass'|null`). When non-null, it bypasses symbol-based clef detection and applies the specified clef to every staff group.

### FR2 — Default Clef Change
The `detectClef()` fallback (no detectable clef symbol) must return `'bass'` instead of `'treble'`.

### FR3 — Engine Clef Option
`OMREngine.process()` must accept a `clef` option (`'treble'|'bass'|null`) and pass it to `PitchMapper.assignPitches()` as the `clefOverride`.

### FR4 — Clef Selector UI
`sheet2midi.html` must include a clef selector in the settings row:
- Label: "Clef"
- Options: "Bass" (value `'bass'`), "Treble" (value `'treble'`), "Auto" (value `''`)
- Default selection: **Bass**

### FR5 — UI Wiring
`sheet2midi-main.js` must read the clef selector value and pass it to `engine.process()` as `{ clef }`.

### FR6 — Bass Staff Pitch Mapping (Reference)

Bass clef bottom line = G2 (MIDI 43). Staff positions:

| StaffPos | Position | Note | MIDI |
|----------|----------|------|------|
| 0 | Line 1 (bottom) | G2 | 43 |
| 1 | Space 1 | A2 | 45 |
| 2 | Line 2 | B2 | 47 |
| 3 | Space 2 | C3 | 48 |
| 4 | Line 3 (middle) | D3 | 50 |
| 5 | Space 3 | E3 | 52 |
| 6 | Line 4 | F3 | 53 |
| 7 | Space 4 | G3 | 55 |
| 8 | Line 5 (top) | A3 | 57 |

The anchor note (4th line from bottom) is F3 (MIDI 53), which is the "F clef" reference note.

### FR7 — Ground Truth Test Fixture
A bass staff test fixture PNG (`TestObjects/BassStaffScale.png`) must be created and validated with a matching `BassStaffScale.expected.json`. The fixture must contain:
- 8 quarter notes: G2, A2, B2, C3, D3, E3, F3, G3 (no accidentals, all within staff)
- 2 bars of 4/4 time
- 1 interior barline

### FR8 — Validation Test
`test/sheet2midi/omr-validation.test.js` must include a test suite for `BassStaffScale` that passes all assertions (note count, pitches, names, beats, bar count).

## Acceptance Criteria

- [ ] `assignPitches()` accepts and applies `clefOverride`
- [ ] `detectClef()` final fallback returns `'bass'`
- [ ] `process()` accepts `clef` option and passes through
- [ ] Clef selector present in UI, defaults to Bass
- [ ] `BassStaffScale.png` and `BassStaffScale.expected.json` exist
- [ ] OMR validation tests pass for `BassStaffScale`, `CMajorScale`, and `AMinorScale`

## Out of Scope

- Grand staff (treble + bass on same page) rendering in the UI
- Automatic clef symbol classification improvements
- Key signature detection for bass clef
