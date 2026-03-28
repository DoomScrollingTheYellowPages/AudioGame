# Spec: OMR Validation & Ground Truth Testing

## Overview

Build an automated validation harness that runs the OMR pipeline against real
sheet music images in Node.js and compares output to ground truth JSON fixtures.
The goal is for Claude (or any developer) to run a single command and get a
pass/fail result without needing a browser.

## Current State

- `TestObjects/CMajorScale.png` and `TestObjects/AMinorScale.png` exist
- `TestObjects/CMajorScale.expected.json` exists but is in a human-readable
  description format — it does not match the OMR pipeline's output schema
- `debug-omr.js` exists as a Node PNG decoder prototype but does not run the
  full pipeline or compare against ground truth
- Existing test suite uses `node:test` with a Node-compatible pipeline shim

## Goals

1. Reformat `CMajorScale.expected.json` to a normalized comparison schema
2. Create `AMinorScale.expected.json` in the same schema
3. Build a Node-based OMR validation runner that loads a real PNG, runs the
   pipeline stages that are Node-compatible, and compares to ground truth
4. Wire the validation into the existing `node:test` suite so it runs with the
   rest of the tests
5. Fix any pipeline bugs discovered during validation (C5 missing is known)
6. Achieve 100% pass on CMajorScale, then 100% on AMinorScale

## Ground Truth Schema

```json
{
  "image": "CMajorScale.png",
  "bars": 2,
  "totalBeats": 8,
  "notes": [
    { "note": 60, "name": "C4", "beats": 1 },
    { "note": 62, "name": "D4", "beats": 1 }
  ]
}
```

Fields:
- `bars` — number of bars (interiorBarlines + 1)
- `totalBeats` — bars × meter numerator (e.g. 2 bars × 4/4 = 8)
- `note` — MIDI note number (integer)
- `name` — pitch name with octave (string, e.g. "C4")
- `beats` — note duration in beats (number)

## Acceptance Criteria

1. `CMajorScale.expected.json` and `AMinorScale.expected.json` are in the normalized schema
2. Running `node --test` produces a pass/fail result for both fixtures
3. Tests assert: exact note count, exact pitches in order, exact beats per note,
   bar count, and sum of note beats equals totalBeats
4. All 8 notes including C5 are detected for CMajorScale — the known C5 bug is fixed
5. All 8 notes A4→A5 are detected for AMinorScale
6. The validation runner requires no browser, no dev server, no manual steps

## Out of Scope

- Additional test fixtures beyond CMajorScale and AMinorScale (deferred)
- MIDI object schema normalization across the full codebase
  (flagged for future review — `note` vs `midiNote` inconsistency exists
  between OMREngine internals and MidiParser/DemoSongs but is not blocking)
- Tolerance-based or fuzzy matching (strict mode only for this track)
- Tie detection, tuplets, multi-page OMR
