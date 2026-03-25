# Spec: Complete the Sheet2MIDI OMR Pipeline

## Overview

The Sheet2MIDI module is an optical music recognition (OMR) engine that converts scanned sheet music images (PNG, JPG, BMP, PDF) into playable MIDI files. The pipeline has 11 processing stages, from raw image loading through MIDI assembly. Several stages are fully implemented, but key features remain incomplete or disconnected from the main pipeline.

## Current State

### Fully Implemented
- Image loading and grayscale conversion
- Binarization (Otsu global + Sauvola adaptive, auto-select)
- Median filter and border cropping (preprocessing)
- Skew correction (Hough transform + bilinear rotation)
- Staff line detection, grouping, and smart removal
- Connected component labeling with Union-Find and feature extraction
- Symbol classification via heuristic rules (18 symbol types)
- Basic pitch mapping (notehead position → MIDI via clef context)
- Key signature detection and inline accidental pairing
- Duration mapping (notehead type + stem/beam/flag/dot)
- Grammar validation (measure completeness, beam groups, ordering)
- MIDI assembly via MidiWriter
- Full UI with PDF.js support, progress tracking, and download

### Incomplete / Not Connected
1. **Ledger line detection** — code exists in PitchMapper but is not called in the pipeline. Notes above/below the staff cannot be pitched.
2. **NCC template matching** — code exists in SymbolClassifier but is not used. All classification relies on heuristic rules only.
3. **Distance transform for touching noteheads** — code exists but is not called. Touching noteheads may be classified as a single component.
4. **Auto-correction** — GrammarValidator detects measure errors but does not apply fixes. Auto-correct skeleton exists but is not integrated.
5. **Tie detection** — not implemented. Tied notes will be treated as separate notes.
6. **Tuplets** — not implemented (triplets, quintuplets, etc.).
7. **Time signature symbol detection** — not implemented; requires manual input.
8. **Rest integration** — rests are classified but may not be fully integrated into the note sequence timing.

## Goals

### Primary Goals (This Track)
1. Activate ledger line support so notes above/below the staff are correctly pitched
2. Integrate the distance transform to separate touching noteheads
3. Connect the grammar validator's auto-correction to the pipeline
4. Ensure rests are properly integrated into note sequencing and timing
5. End-to-end testing with real sheet music images to validate the full pipeline
6. Fix any bugs discovered during integration testing

### Out of Scope (Future Tracks)
- Tie detection and slur interpretation
- Tuplet recognition
- Time signature symbol detection from the image
- Articulation marks (staccato, accent, etc.)
- NCC template matching (heuristic rules are sufficient for initial release)
- Double/triple sharps and flats
- Tempo and expression marks
- Multi-page OMR (process one page at a time for now)

## Acceptance Criteria

1. A simple single-staff sheet music image (e.g., C scale, simple melody) produces a correct MIDI file with accurate pitches and durations
2. Notes on ledger lines above and below the staff are correctly identified
3. Key signatures and inline accidentals are correctly applied
4. Rests appear as silence in the MIDI output at the correct positions
5. Touching noteheads are separated and individually classified
6. The grammar validator reports and auto-corrects minor measure discrepancies
7. The UI displays meaningful progress, results, and any correction warnings
8. All modules have unit tests with >80% code coverage
