# Plan: Complete the Sheet2MIDI OMR Pipeline

## Phase 1: Testing Infrastructure & Baseline Coverage

- [x] Task: Set up test framework and test runner for the project d542214
  - [x] Sub-task: Write tests — select a browser-compatible test runner (or lightweight Node-based harness) and configure it for the project's zero-dependency, ES module architecture
  - [x] Sub-task: Implement — create the test runner configuration and a sample test to validate the setup works
- [~] Task: Write baseline unit tests for ImageProcessor
  - [ ] Sub-task: Write tests — test grayscale conversion, Otsu threshold, Sauvola binarization, median filter, and border cropping
  - [ ] Sub-task: Implement — fix any bugs discovered during test writing
- [ ] Task: Write baseline unit tests for StaffAnalyzer
  - [ ] Sub-task: Write tests — test horizontal projection, staff line detection, grouping into 5-line staves, and staff line removal
  - [ ] Sub-task: Implement — fix any bugs discovered during test writing
- [ ] Task: Write baseline unit tests for ComponentLabeler
  - [ ] Sub-task: Write tests — test connected component labeling, Union-Find, feature extraction, and size filtering
  - [ ] Sub-task: Implement — fix any bugs discovered during test writing
- [ ] Task: Write baseline unit tests for SymbolClassifier
  - [ ] Sub-task: Write tests — test heuristic classification rules for all 18 symbol types, confidence scoring
  - [ ] Sub-task: Implement — fix any bugs discovered during test writing
- [ ] Task: Write baseline unit tests for PitchMapper
  - [ ] Sub-task: Write tests — test clef detection, position quantization, pitch calculation for treble and bass clefs, key signature detection, accidental pairing and application
  - [ ] Sub-task: Implement — fix any bugs discovered during test writing
- [ ] Task: Write baseline unit tests for DurationMapper
  - [ ] Sub-task: Write tests — test base duration assignment, beam/flag counting, augmentation dots, rest classification
  - [ ] Sub-task: Implement — fix any bugs discovered during test writing
- [ ] Task: Write baseline unit tests for GrammarValidator
  - [ ] Sub-task: Write tests — test measure completeness checking, temporal ordering, chord detection
  - [ ] Sub-task: Implement — fix any bugs discovered during test writing
- [ ] Task: Conductor - User Manual Verification 'Testing Infrastructure & Baseline Coverage' (Protocol in workflow.md)

## Phase 2: Ledger Line Support

- [ ] Task: Activate ledger line detection in PitchMapper
  - [ ] Sub-task: Write tests — test pitch assignment for notes on ledger lines above treble staff (A5, B5, C6) and below bass staff (C2, B1, A1), and middle C on both staves
  - [ ] Sub-task: Implement — connect the existing ledger line detection code into the pitch assignment pipeline, ensure y-positions beyond staff bounds are correctly quantized
- [ ] Task: Handle ledger line rendering artifacts in StaffAnalyzer
  - [ ] Sub-task: Write tests — test that short horizontal segments near noteheads outside staff bounds are detected as ledger lines, not noise
  - [ ] Sub-task: Implement — add ledger line detection to StaffAnalyzer so they are preserved during staff line removal and available for pitch mapping
- [ ] Task: Conductor - User Manual Verification 'Ledger Line Support' (Protocol in workflow.md)

## Phase 3: Touching Notehead Separation

- [ ] Task: Integrate distance transform for touching noteheads in SymbolClassifier
  - [ ] Sub-task: Write tests — test that two adjacent filled noteheads in a single component are separated into two individual noteheads with correct centroids
  - [ ] Sub-task: Implement — connect the existing distance transform and local maxima code into the classification pipeline, splitting large notehead-like components when multiple peaks are detected
- [ ] Task: Update ComponentLabeler to handle split components
  - [ ] Sub-task: Write tests — test that split components receive correct feature recalculation (bbox, centroid, area)
  - [ ] Sub-task: Implement — ensure split noteheads are re-labeled and feature-extracted correctly before passing downstream
- [ ] Task: Conductor - User Manual Verification 'Touching Notehead Separation' (Protocol in workflow.md)

## Phase 4: Rest Integration & Timing

- [ ] Task: Integrate rests into the note sequence in OMREngine
  - [ ] Sub-task: Write tests — test that rests appear in the output note array at correct time positions with correct durations and zero velocity
  - [ ] Sub-task: Implement — ensure DurationMapper's rest output is merged into the note sequence, with proper start-time offsets based on preceding notes/rests
- [ ] Task: Update MidiWriter to handle rest gaps
  - [ ] Sub-task: Write tests — test that MIDI output contains silence (no noteOn) during rest periods, and subsequent notes start at the correct tick offset
  - [ ] Sub-task: Implement — adjust MIDI assembly to insert appropriate delta-time gaps for rests
- [ ] Task: Conductor - User Manual Verification 'Rest Integration & Timing' (Protocol in workflow.md)

## Phase 5: Grammar Validator Auto-Correction

- [ ] Task: Connect auto-correction to the OMR pipeline
  - [ ] Sub-task: Write tests — test that a measure with a small beat deficit (e.g., missing dot) is auto-corrected by adjusting the lowest-confidence note's duration
  - [ ] Sub-task: Implement — integrate the existing auto-correct skeleton in GrammarValidator so corrections are applied to the note array before MIDI assembly
- [ ] Task: Report corrections to the UI
  - [ ] Sub-task: Write tests — test that correction events are emitted via the EventBus with details (measure number, original vs. corrected duration, confidence)
  - [ ] Sub-task: Implement — emit `omr:correction` events and display them in the corrections log on the sheet2midi UI
- [ ] Task: Conductor - User Manual Verification 'Grammar Validator Auto-Correction' (Protocol in workflow.md)

## Phase 6: End-to-End Integration Testing

- [ ] Task: Create synthetic test images for pipeline validation
  - [ ] Sub-task: Write tests — generate simple sheet music images programmatically (C scale, simple melody with accidentals, piece with rests) using Canvas API
  - [ ] Sub-task: Implement — build a test image generator that creates known-good sheet music images with predictable OMR output
- [ ] Task: End-to-end pipeline test with synthetic images
  - [ ] Sub-task: Write tests — test full pipeline from image → MIDI for each synthetic image, verifying note count, pitches, durations, and rest positions match expected output
  - [ ] Sub-task: Implement — fix any pipeline bugs discovered during end-to-end testing
- [ ] Task: End-to-end pipeline test with real sheet music
  - [ ] Sub-task: Write tests — test pipeline with simple real-world sheet music from docs/zSheet (e.g., Bach Invention No. 01), verify output is reasonable (correct number of notes, plausible pitches)
  - [ ] Sub-task: Implement — fix robustness issues discovered with real sheet music (noise handling, spacing variations, etc.)
- [ ] Task: Conductor - User Manual Verification 'End-to-End Integration Testing' (Protocol in workflow.md)
