# Plan: Bass Staff Support (OMR Pipeline)

## Phase 1: Core Pipeline Changes [checkpoint: already-complete]

- [x] Task: Write test fixture — `BassStaffScale.png` + `BassStaffScale.expected.json`
  - [x] Sub-task: Generate PNG with bass staff (5 lines), 8 noteheads (G2–G3), 1 barline
  - [x] Sub-task: Write `TestObjects/BassStaffScale.expected.json` with 8 notes, 2 bars, 8 totalBeats

- [x] Task: Modify `PitchMapper.js`
  - [x] Sub-task: Change `detectClef()` final fallback from `'treble'` to `'bass'`
  - [x] Sub-task: Add `clefOverride = null` parameter to `assignPitches()`
  - [x] Sub-task: Apply override: `clef = clefOverride ?? (clefMap.get(group) ?? this.detectClef(...))`

- [x] Task: Modify `OMREngine.js`
  - [x] Sub-task: Extract `clef` from `options` in `process()`
  - [x] Sub-task: Pass `clef` as 6th argument to `pitchMapper.assignPitches()`

- [x] Task: Conductor - User Manual Verification 'Phase 1: Core Pipeline Changes' (Protocol in workflow.md)

## Phase 2: UI Changes [checkpoint: already-complete]

- [x] Task: Add clef selector to `sheet2midi.html`
  - [x] Sub-task: Add `<div class="setting-group">` with label "Clef" and `<select id="clef-select">`
  - [x] Sub-task: Options: Bass (`bass`, default selected), Treble (`treble`), Auto (``)

- [x] Task: Wire clef selector in `sheet2midi-main.js`
  - [x] Sub-task: Add `const clefSelect = document.getElementById('clef-select')`
  - [x] Sub-task: Pass `clef: clefSelect.value || null` in `engine.process()` options

- [x] Task: Conductor - User Manual Verification 'Phase 2: UI Changes' (Protocol in workflow.md)

## Phase 3: Validation [checkpoint: 592acaa]

- [x] Task: Add bass staff test to `omr-validation.test.js`
  - [x] Sub-task: Add `describe('OMR Validation: BassStaffScale')` block calling `validateFixture('BassStaffScale')`
  - [x] Sub-task: Ensure `runPipeline` passes `clefOverride: 'bass'` (via options or fixture JSON field)

- [x] Task: Run tests — all three fixtures must pass
  - [x] Sub-task: `node --test test/sheet2midi/omr-validation.test.js`
  - NOTE: 25 tests pass across CMajorScale, AMinorScale, BassStaffScale, grandstaffmono1

- [x] Task: Conductor - User Manual Verification 'Phase 3: Validation' (Protocol in workflow.md)
