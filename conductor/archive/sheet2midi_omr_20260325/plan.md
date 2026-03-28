# Plan: Complete the Sheet2MIDI OMR Pipeline

## Phase 1: Testing Infrastructure & Baseline Coverage [checkpoint: cdf2baa]

- [x] Task: Set up test framework and test runner for the project d542214
  - [x] Sub-task: Write tests — select a browser-compatible test runner (or lightweight Node-based harness) and configure it for the project's zero-dependency, ES module architecture
  - [x] Sub-task: Implement — create the test runner configuration and a sample test to validate the setup works
- [x] Task: Write baseline unit tests for ImageProcessor 187d3f3
  - [x] Sub-task: Write tests — test grayscale conversion, Otsu threshold, Sauvola binarization, median filter, and border cropping
  - [x] Sub-task: Implement — fix any bugs discovered during test writing
- [x] Task: Write baseline unit tests for StaffAnalyzer 3a3cdc5
  - [x] Sub-task: Write tests — test horizontal projection, staff line detection, grouping into 5-line staves, and staff line removal
  - [x] Sub-task: Implement — fix any bugs discovered during test writing
- [x] Task: Write baseline unit tests for ComponentLabeler 3a3cdc5
  - [x] Sub-task: Write tests — test connected component labeling, Union-Find, feature extraction, and size filtering
  - [x] Sub-task: Implement — fix any bugs discovered during test writing
- [x] Task: Write baseline unit tests for SymbolClassifier 3a3cdc5
  - [x] Sub-task: Write tests — test heuristic classification rules for all 18 symbol types, confidence scoring
  - [x] Sub-task: Implement — fix any bugs discovered during test writing
- [x] Task: Write baseline unit tests for PitchMapper 3a3cdc5
  - [x] Sub-task: Write tests — test clef detection, position quantization, pitch calculation for treble and bass clefs, key signature detection, accidental pairing and application
  - [x] Sub-task: Implement — fix any bugs discovered during test writing
- [x] Task: Write baseline unit tests for DurationMapper 3a3cdc5
  - [x] Sub-task: Write tests — test base duration assignment, beam/flag counting, augmentation dots, rest classification
  - [x] Sub-task: Implement — fix any bugs discovered during test writing
- [x] Task: Write baseline unit tests for GrammarValidator 3a3cdc5
  - [x] Sub-task: Write tests — test measure completeness checking, temporal ordering, chord detection
  - [x] Sub-task: Implement — fix any bugs discovered during test writing
- [x] Task: Conductor - User Manual Verification 'Testing Infrastructure & Baseline Coverage' (Protocol in workflow.md) cdf2baa

## Phase 2: Ledger Line Support [checkpoint: 18bd063]

- [x] Task: Activate ledger line detection in PitchMapper 99e8cd5
  - [x] Sub-task: Write tests — test pitch assignment for notes on ledger lines above treble staff (A5, B5, C6) and below bass staff (C2, B1, A1), and middle C on both staves
  - [x] Sub-task: Implement — connect the existing ledger line detection code into the pitch assignment pipeline, ensure y-positions beyond staff bounds are correctly quantized
- [x] Task: Handle ledger line rendering artifacts in StaffAnalyzer a1acaad
  - [x] Sub-task: Write tests — test that short horizontal segments near noteheads outside staff bounds are detected as ledger lines, not noise
  - [x] Sub-task: Implement — add ledger line detection to StaffAnalyzer so they are preserved during staff line removal and available for pitch mapping
- [x] Task: Conductor - User Manual Verification 'Ledger Line Support' (Protocol in workflow.md) 18bd063

## Phase 3: Touching Notehead Separation [checkpoint: a93a253]

- [x] Task: Integrate distance transform for touching noteheads in SymbolClassifier 833d66e
  - [x] Sub-task: Write tests — test that two adjacent filled noteheads in a single component are separated into two individual noteheads with correct centroids
  - [x] Sub-task: Implement — connect the existing distance transform and local maxima code into the classification pipeline, splitting large notehead-like components when multiple peaks are detected
- [x] Task: Update ComponentLabeler to handle split components 3ec7ebc
  - [x] Sub-task: Write tests — test that split components receive correct feature recalculation (bbox, centroid, area)
  - [x] Sub-task: Implement — ensure split noteheads are re-labeled and feature-extracted correctly before passing downstream
- [x] Task: Conductor - User Manual Verification 'Touching Notehead Separation' (Protocol in workflow.md) a93a253

## Phase 4: Rest Integration & Timing [checkpoint: 8e7095f]

- [x] Task: Integrate rests into the note sequence in OMREngine 4fcfe82
  - [x] Sub-task: Write tests — test that rests appear in the output note array at correct time positions with correct durations and zero velocity
  - [x] Sub-task: Implement — ensure DurationMapper's rest output is merged into the note sequence, with proper start-time offsets based on preceding notes/rests
- [x] Task: Update MidiWriter to handle rest gaps 4fcfe82
  - [x] Sub-task: Write tests — test that MIDI output contains silence (no noteOn) during rest periods, and subsequent notes start at the correct tick offset
  - [x] Sub-task: Implement — adjust MIDI assembly to insert appropriate delta-time gaps for rests
- [x] Task: Conductor - User Manual Verification 'Rest Integration & Timing' (Protocol in workflow.md) 8e7095f

## Phase 5: Grammar Validator Auto-Correction [checkpoint: a0fba15]

- [x] Task: Connect auto-correction to the OMR pipeline a227b3f
  - [x] Sub-task: Write tests — test that a measure with a small beat deficit (e.g., missing dot) is auto-corrected by adjusting the lowest-confidence note's duration
  - [x] Sub-task: Implement — integrate the existing auto-correct skeleton in GrammarValidator so corrections are applied to the note array before MIDI assembly
- [x] Task: Report corrections to the UI a227b3f
  - [x] Sub-task: Write tests — test that correction events are emitted via the EventBus with details (measure number, original vs. corrected duration, confidence)
  - [x] Sub-task: Implement — emit `omr:correction` events and display them in the corrections log on the sheet2midi UI
- [x] Task: Conductor - User Manual Verification 'Grammar Validator Auto-Correction' (Protocol in workflow.md) a0fba15

## Phase 6: End-to-End Integration Testing [checkpoint: 0547ca4]

- [x] Task: Create synthetic test images for pipeline validation 0bc1438
  - [x] Sub-task: Write tests — generate simple sheet music images programmatically (C scale, simple melody with accidentals, piece with rests) using Canvas API
  - [x] Sub-task: Implement — build a test image generator that creates known-good sheet music images with predictable OMR output
- [x] Task: End-to-end pipeline test with synthetic images 0bc1438
  - [x] Sub-task: Write tests — test full pipeline from image → MIDI for each synthetic image, verifying note count, pitches, durations, and rest positions match expected output
  - [x] Sub-task: Implement — fix any pipeline bugs discovered during end-to-end testing
- [x] Task: End-to-end pipeline test with real sheet music 0bc1438
  - [x] Sub-task: Write tests — test pipeline with simple real-world sheet music from docs/zSheet (e.g., Bach Invention No. 01), verify output is reasonable (correct number of notes, plausible pitches)
  - [x] Sub-task: Implement — fix robustness issues discovered with real sheet music (noise handling, spacing variations, etc.)
- [x] Task: Conductor - User Manual Verification 'End-to-End Integration Testing' (Protocol in workflow.md) 0547ca4
