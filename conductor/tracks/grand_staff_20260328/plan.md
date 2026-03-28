# Plan: Grand Staff OMR Support

## Phase 1: Brace Symbol Detection

- [ ] Task: Write failing test — `SymbolClassifier` labels a tall left-margin arc as `brace`
  - [ ] Add `brace` case to `SymbolType` enum in `SymbolClassifier.js`
  - [ ] Create synthetic component features matching a brace (heightSS ≥ 6.0, widthSS 0.3–1.5, fillRatio < 0.35, aspectRatio < 0.25, x < 3×staffSpace)
  - [ ] Assert `classify()` returns `type: 'brace'` for that component
  - [ ] Assert existing non-brace symbols are not misclassified as brace
- [ ] Task: Implement `brace` classification rule in `SymbolClassifier`
  - [ ] Add `BRACE` to `SymbolType`
  - [ ] Add rule to `classify()` with the specified feature thresholds
  - [ ] Confirm test goes green
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Brace Symbol Detection' (Protocol in workflow.md)

## Phase 2: Grand Staff Pair Detection

- [ ] Task: Write failing tests — `_buildClefMap` cascade (brace → gap → first-two)
  - [ ] Test: two staves with a brace symbol → paired, brace method used
  - [ ] Test: two staves close vertically, no brace → paired by gap threshold
  - [ ] Test: two staves, no brace, gap too large → paired by first-two fallback
  - [ ] Test: single staff → not paired, falls through to NCC detection
  - [ ] Test: brace present → gap and fallback logic are skipped entirely
- [ ] Task: Implement cascade pairing in `PitchMapper._buildClefMap`
  - [ ] Accept `symbols` as an argument alongside `staffGroups` and `staffSpace`
  - [ ] Primary: scan for `brace` symbol spanning ≥ 80% of combined staff height
  - [ ] Secondary: existing gap < 8×staffSpace heuristic (when no brace found)
  - [ ] Tertiary: first-two-staves fallback (when neither brace nor gap fires)
  - [ ] Brace match sets upper=treble, lower=bass and skips remaining methods
  - [ ] Update `assignPitches` call site to pass `symbols` to `_buildClefMap`
  - [ ] Confirm all tests green
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Grand Staff Pair Detection' (Protocol in workflow.md)

## Phase 3: Multi-Track MIDI Output

- [ ] Task: Write failing test — `MidiWriter` produces Format 1 two-track MIDI
  - [ ] Call `MidiWriter` with two note arrays (treble notes, bass notes)
  - [ ] Parse resulting buffer and assert: format=1, numTracks=2
  - [ ] Assert track 1 contains only treble notes, track 2 contains only bass notes
  - [ ] Assert single-note-array call still produces Format 0 (backward compat)
- [ ] Task: Extend `MidiWriter` to support Format 1 multi-track output
  - [ ] Add `writeTracks(tracksArray, bpm)` method (array of note arrays)
  - [ ] Write Format 1 header chunk (format=1, nTracks=N)
  - [ ] Write one MTrk chunk per track
  - [ ] Keep existing `write(notes, bpm)` as Format 0 path (unchanged)
- [ ] Task: Update `OMREngine` to route grand staff results to `writeTracks`
  - [ ] Detect when `staffInfo` contains a grand staff pair
  - [ ] Split notes by staff group: treble notes → track 1, bass notes → track 2
  - [ ] Pass both arrays to `MidiWriter.writeTracks`
  - [ ] Single-staff path unchanged
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Multi-Track MIDI Output' (Protocol in workflow.md)

## Phase 4: UI — Grand Staff Default

- [ ] Task: Write failing test — clef selector default is "Grand Staff (Auto)"
  - [ ] Assert `clef-select` element has `value = 'grand'` on page load
  - [ ] Assert passing `clef: 'grand'` to `engine.process()` triggers grand staff path
- [ ] Task: Update `sheet2midi.html` clef selector
  - [ ] Add `<option value="grand" selected>Grand Staff (Auto)</option>` as first/default option
  - [ ] Remove `selected` from existing "Bass" option
- [ ] Task: Update `sheet2midi-main.js` to handle `clef === 'grand'`
  - [ ] Pass `clef: 'grand'` to `engine.process()` when selected
- [ ] Task: Update `OMREngine.process()` to handle `clef: 'grand'`
  - [ ] When `options.clef === 'grand'`, set `clefOverride = null` and enable grand staff detection
  - [ ] When `options.clef` is `'treble'` or `'bass'`, use override as before (disables pairing)
  - [ ] When `options.clef` is `null`/`''`/`'auto'`, use single-staff NCC detection
- [ ] Task: Conductor - User Manual Verification 'Phase 4: UI — Grand Staff Default' (Protocol in workflow.md)

## Phase 5: Test Fixtures and Validation

- [ ] Task: Author expected JSON for user-supplied `grandstaffmono` fixture(s)
  - [ ] Receive image files from user
  - [ ] Run pipeline manually / inspect debug output
  - [ ] Write `TestObjects/grandstaffmono1.expected.json` and `grandstaffmono2.expected.json`
  - [ ] Include: `image`, `clef: "grand"`, `notes` array per staff (with track field), `bars`, `totalBeats`
- [ ] Task: Write failing validation tests for both grand staff fixtures
  - [ ] Add `validateFixture('grandstaffmono1')` and `validateFixture('grandstaffmono2')`
  - [ ] Extend `validateFixture` to assert two-track MIDI when `expected.clef === 'grand'`
  - [ ] Confirm tests fail before implementation is complete
- [ ] Task: Tune and verify pipeline passes both fixtures
  - [ ] Run `node --test test/sheet2midi/omr-validation.test.js`
  - [ ] Adjust thresholds if needed (brace size, gap threshold)
  - [ ] All 5 fixtures (CMajorScale, AMinorScale, BassStaffScale + 2 grand staff) pass
- [ ] Task: Conductor - User Manual Verification 'Phase 5: Test Fixtures and Validation' (Protocol in workflow.md)
