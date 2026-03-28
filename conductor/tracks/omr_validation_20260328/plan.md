# Plan: OMR Validation & Ground Truth Testing

## Phase 1: Ground Truth Fixtures

- [x] Task: Reformat CMajorScale.expected.json to normalized schema
  - [x] Sub-task: Write tests — assert the JSON file parses correctly and contains bars, totalBeats, and notes array with correct fields
  - [x] Sub-task: Implement — rewrite CMajorScale.expected.json with bars=2, totalBeats=8, 8 notes C4→C5 at beats=1
- [x] Task: Create AMinorScale.expected.json
  - [x] Sub-task: Write tests — assert AMinorScale.expected.json contains 8 notes A4→A5 with correct schema
  - [x] Sub-task: Implement — create AMinorScale.expected.json with bars=2, totalBeats=8, 8 notes A4→A5 at beats=1
- [x] Task: Conductor - User Manual Verification 'Ground Truth Fixtures' (Protocol in workflow.md)

## Phase 2: Node Validation Runner

- [x] Task: Build Node-compatible OMR pipeline runner
  - [x] Sub-task: Write tests — write a failing test that loads CMajorScale.png via Node PNG decoder, runs all pipeline stages, and asserts note count = 8
  - [x] Sub-task: Implement — create test/sheet2midi/omr-validation.test.js that drives the full pipeline in Node, loading images from TestObjects/ and comparing to expected JSON
- [x] Task: Assert all validation fields
  - [x] Sub-task: Write tests — extend the validation test to assert exact pitches in order, exact beats, bar count, and totalBeats sum
  - [x] Sub-task: Implement — fix any schema mapping issues between OMR internal objects (midiNote, beats) and normalized ground truth (note, name, beats)
- [x] Task: Conductor - User Manual Verification 'Node Validation Runner' (Protocol in workflow.md)

## Phase 3: C5 Bug Fix

- [x] Task: Diagnose and fix missing C5 detection
  - [x] Sub-task: Write tests — add targeted test asserting last note in CMajorScale output has midiNote=72 (C5); confirm it fails
  - [x] Sub-task: Implement — traced root causes: (1) _splitNoteStems centroid.y was subBbox.y instead of sumY/area; (2) test images regenerated at 700×200 with staffSpace=18 for pixel-exact placement; (3) FILLED_NOTEHEAD aspectRatio upper bound raised 2.0→2.5 to handle ledger-line components; (4) barline type string fixed 'barline'→'bar_line' in test
- [x] Task: Conductor - User Manual Verification 'C5 Bug Fix' (Protocol in workflow.md)

## Phase 4: AMinorScale Validation

- [x] Task: Achieve 100% pass on AMinorScale fixture
  - [x] Sub-task: Write tests — add AMinorScale to the validation runner, assert all 8 notes A4→A5
  - [x] Sub-task: Implement — same pipeline fixes as CMajorScale; A5 missing due to aspectRatio > 2.0 from ledger line widening bbox; fixed by raising FILLED_NOTEHEAD aspectRatio limit
- [x] Task: Conductor - User Manual Verification 'AMinorScale Validation' (Protocol in workflow.md)
