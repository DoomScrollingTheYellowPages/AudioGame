# OMR Pipeline Phase 3 — SIG Graph, Pipeline Reordering, and Key Sig State Tracking

## Overview

This track implements three foundational improvements to the OMR pipeline derived
from studying Audiveris, VexFlow, and OSMD. All techniques are classical/rule-based
— no ML required. The work runs on a dedicated branch against which accuracy can be
directly compared to main via existing validation fixtures.

Reference: `docs/techniques/omr-pipeline.md`

## Functional Requirements

### 1. Symbol Interpretation Graph (SIG)

Inspired by Audiveris's core architecture.

- Every detected symbol becomes an **Inter** node with a confidence grade (0.0–1.0)
  derived from how closely it matches its classifier criteria.
- Relationships between symbols are explicit **edges** of two types:
  - **Support** — two symbols reinforce each other (e.g. filled notehead + adjacent
    stem). Support raises both nodes' contextual grades.
  - **Exclusion** — two symbols cannot coexist (e.g. two classifications of the same
    pixels). The lower-grade node is eliminated.
- There is one SIG per staff group.
- At a defined **REDUCTION** point in the pipeline, the SIG is reduced: all exclusions
  are resolved by eliminating lower-grade Inters until no conflicts remain.
- A second reduction runs after all symbol relationships are attached (pitch, duration,
  accidental pairing).
- `PitchMapper`, `DurationMapper`, and `GrammarValidator` all read from the SIG as
  their canonical data source. Existing proximity-based attachment code is removed.

### 2. Pipeline Reordering — Beams and Ledgers Before CCL

Inspired by Audiveris's BEAMS and LEDGERS steps preceding HEADS.

- **Beam detection** runs as an independent step before connected-component labeling.
  Uses morphological closing (already available in ImageProcessor) to find thick
  diagonal/horizontal ink strokes spanning multiple staff spaces. Detected beams are
  labeled and entered into the SIG as beam Inters.
- **Ledger line detection** runs as an independent step before CCL. Scans for short
  horizontal strokes beyond staff extremes at staffSpace intervals. Detected ledgers
  are labeled and entered into the SIG.
- Beam and ledger pixels remain in the binary image — they inform scale measurement
  and are needed as context for notehead isolation. Early detection provides priority
  labels: when CCL produces a component overlapping a known beam or ledger region,
  the early detection result takes precedence over the heuristic classifier.

### 3. Key Signature State Tracking and Enharmonic Spelling

Inspired by VexFlow's KeyManager and OSMD's accidental scope logic.

- A per-measure accidental state map tracks which pitch classes have active accidentals
  from the key signature and from inline accidentals encountered so far in the measure.
- When a note is mapped to a MIDI pitch, its enharmonic spelling is derived from its
  diatonic staff position `d` — not guessed from the chromatic pitch class alone.
  (e.g. a note on the F line with a sharp -> F#, not Gb, because the staff position
  is unambiguous).
- Inline accidentals (sharps, flats, naturals detected visually) update the state map
  for the remainder of the measure and are reset at each barline.
- Key signature accidentals are applied implicitly — notes that match the key sig do
  not require a visible accidental to receive the correct pitch.

## Non-Functional Requirements

- Zero new external dependencies — pure vanilla JS.
- All existing public module interfaces (EventBus events, OMREngine.process() return
  shape) remain unchanged so sheet2midi UI requires no updates.
- The SIG data structure must be serialisable to JSON for debug output.

## Acceptance Criteria

- All existing validation fixtures pass with no regressions:
  - CMajorScale.png — 12/12 assertions
  - AMinorScale.png — 12/12 assertions
  - MixedDurations.png — all duration assertions
  - grandstaffmono1.png — all assertions
  - BassStaffScale.png — all assertions
- `node --test test/sheet2midi/omr-validation.test.js` exits 0.
- New unit tests cover: SIG node insertion, support edge grade propagation, exclusion
  resolution, beam detection step, ledger detection step, key sig state map per
  measure, enharmonic spelling from diatonic position.

## Out of Scope

- Multi-voice detection (depends on SIG but is a separate track)
- Tie/slur curve detection
- Tuplet detection
- Grace note detection
- Any change to the sheet2midi UI
- Accuracy improvements beyond no-regression (new fixture validation is the next track)
- **Grand staff duration detection** — grandstaffmono1 (quarter notes only) processes
  correctly; grandstaffmono2 (which includes open/whole noteheads) exposes that duration
  classification for grand staff images has not been verified. This is a future track
  covering: open notehead vs whole note disambiguation at small scales, stem-notehead
  association for duration inference, and grand-staff-specific duration validation.
