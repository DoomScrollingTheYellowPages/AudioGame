# Plan: Grand Staff OMR Support

## Phase 1: Brace Symbol Detection

- [x] Task: Write failing test — `SymbolClassifier` labels a tall left-margin arc as `brace`
  - [x] Add `brace` case to `SymbolType` enum in `SymbolClassifier.js`
  - [x] Create synthetic component features matching a brace (heightSS ≥ 6.0, widthSS 0.3–1.5, fillRatio < 0.35, aspectRatio < 0.25, x < 3×staffSpace)
  - [x] Assert `classify()` returns `type: 'brace'` for that component
  - [x] Assert existing non-brace symbols are not misclassified as brace
- [x] Task: Implement `brace` classification rule in `SymbolClassifier`
  - [x] Add `BRACE` to `SymbolType`
  - [x] Add rule to `classify()` with the specified feature thresholds
  - [x] Confirm test goes green
- [x] Task: Conductor - User Manual Verification 'Phase 1: Brace Symbol Detection' (Protocol in workflow.md)

## Phase 2: Grand Staff Pair Detection

- [x] Task: Write failing tests — `_buildClefMap` cascade (brace → gap → first-two)
  - [x] Test: two staves with a brace symbol → paired, brace method used
  - [x] Test: two staves close vertically, no brace → paired by gap threshold
  - [x] Test: two staves, no brace, gap too large → paired by first-two fallback
  - [x] Test: single staff → not paired, falls through to NCC detection
  - [x] Test: brace present → gap and fallback logic are skipped entirely
- [x] Task: Implement cascade pairing in `PitchMapper._buildClefMap`
  - [x] Accept `symbols` as an argument alongside `staffGroups` and `staffSpace`
  - [x] Primary: scan for `brace` symbol spanning ≥ 80% of combined staff height
  - [x] Secondary: existing gap < 8×staffSpace heuristic (when no brace found)
  - [x] Tertiary: first-two-staves fallback (when neither brace nor gap fires)
  - [x] Brace match sets upper=treble, lower=bass and skips remaining methods
  - [x] Update `assignPitches` call site to pass `symbols` to `_buildClefMap`
  - [x] Confirm all tests green
- [x] Task: Conductor - User Manual Verification 'Phase 2: Grand Staff Pair Detection' (Protocol in workflow.md)

## Phase 3: Multi-Track MIDI Output

- [x] Task: Write failing test — `MidiWriter` produces Format 1 two-track MIDI
  - [x] Call `MidiWriter` with two note arrays (treble notes, bass notes)
  - [x] Parse resulting buffer and assert: format=1, numTracks=2
  - [x] Assert track 1 contains only treble notes, track 2 contains only bass notes
  - [x] Assert single-note-array call still produces Format 0 (backward compat)
- [x] Task: Extend `MidiWriter` to support Format 1 multi-track output
  - [x] Add `buildMultiTrack({ bpm, tracks, ... })` static method (array of note arrays)
  - [x] Write Format 1 header chunk (format=1, nTracks=N)
  - [x] Write one MTrk chunk per track
  - [x] Keep existing `build(notes, bpm)` as Format 0 path (unchanged)
- [x] Task: Update `OMREngine` to route grand staff results to `buildMultiTrack`
  - [x] Detect when clef='grand' and pitchMapper._lastPairingMethod is set
  - [x] Split notes by clef: treble notes → track 1, bass notes → track 2
  - [x] Pass both arrays to `MidiWriter.buildMultiTrack`
  - [x] Single-staff path unchanged
- [x] Task: Conductor - User Manual Verification 'Phase 3: Multi-Track MIDI Output' (Protocol in workflow.md)

## Phase 4: UI — Grand Staff Default

- [x] Task: Write failing test — clef selector default is "Grand Staff (Auto)"
  - [x] Assert `clef-select` element has `value = 'grand'` on page load (verified via HTML)
  - [x] Assert passing `clef: 'grand'` to `engine.process()` triggers grand staff path
- [x] Task: Update `sheet2midi.html` clef selector
  - [x] Add `<option value="grand" selected>Grand Staff (Auto)</option>` as first/default option
  - [x] Removed `selected` from existing "Bass" option; added "Single Staff (Auto)" for NCC-only path
- [x] Task: Update `sheet2midi-main.js` to handle `clef === 'grand'`
  - [x] Existing `clef: clefSelect.value || null` passes 'grand' through correctly — no change needed
- [x] Task: Update `OMREngine.process()` to handle `clef: 'grand'`
  - [x] When `options.clef === 'grand'`, clefOverride=null and grandStaffMode=true
  - [x] When `options.clef` is `'treble'` or `'bass'`, override as before (disables pairing)
  - [x] When `options.clef` is `null`/`''`, single-staff NCC detection (grandStaffMode=false)
- [x] Task: Conductor - User Manual Verification 'Phase 4: UI — Grand Staff Default' (Protocol in workflow.md)

## Phase 5: Test Fixtures and Validation

- [x] Task: Author expected JSON for user-supplied `grandstaffmono` fixture(s)
  - [x] Receive image files from user
  - [x] Run pipeline manually / inspect debug output
  - [x] Write `TestObjects/grandstaffmono1.expected.json`
  - [x] Include: `image`, `clef: "grand"`, `notes` array per staff (with track field), `bars`, `totalBeats`
  - NOTE: `grandstaffmono2.png` deferred — image is 358×68px, too low-res for staff detection even after 3× upscale
- [x] Task: Write failing validation tests for both grand staff fixtures
  - [x] Add `validateFixture('grandstaffmono1')`
  - [x] Extend `validateFixture` to assert two-track MIDI when `expected.clef === 'grand'`
  - [x] Fix `runPipeline` to treat `clef: 'grand'` as `clefOverride = null`
- [x] Task: Tune and verify pipeline passes both fixtures
  - [x] Run `node --test test/sheet2midi/omr-validation.test.js`
  - [x] Clef-region filter (x < 4×staffSpace) eliminates false positives; no threshold tuning needed
  - [x] All 4 fixtures (CMajorScale, AMinorScale, BassStaffScale + grandstaffmono1) pass — 25 tests total
  - [x] C4 (middle C) inter-staff detection fixed: pre-compute inter-staff zone before main loop to prevent bass staff from claiming the notehead
  - [x] Fixture updated to 21 notes (added C4 midi=60 track=1 between B3 and D4)
- [x] Task: Conductor - User Manual Verification 'Phase 5: Test Fixtures and Validation' (Protocol in workflow.md)
