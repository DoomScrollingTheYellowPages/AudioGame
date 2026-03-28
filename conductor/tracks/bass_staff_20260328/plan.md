# Plan: Bass Staff Support (OMR Pipeline)

## Phase 1: Core Pipeline Changes

- [ ] Task: Write test fixture — `BassStaffScale.png` + `BassStaffScale.expected.json`
  - [ ] Sub-task: Generate PNG with bass staff (5 lines), 8 noteheads (G2–G3), 1 barline
  - [ ] Sub-task: Write `TestObjects/BassStaffScale.expected.json` with 8 notes, 2 bars, 8 totalBeats

- [ ] Task: Modify `PitchMapper.js`
  - [ ] Sub-task: Change `detectClef()` final fallback from `'treble'` to `'bass'`
  - [ ] Sub-task: Add `clefOverride = null` parameter to `assignPitches()`
  - [ ] Sub-task: Apply override: `clef = clefOverride ?? (clefMap.get(group) ?? this.detectClef(...))`

- [ ] Task: Modify `OMREngine.js`
  - [ ] Sub-task: Extract `clef` from `options` in `process()`
  - [ ] Sub-task: Pass `clef` as 6th argument to `pitchMapper.assignPitches()`

- [ ] Task: Conductor - User Manual Verification 'Phase 1: Core Pipeline Changes' (Protocol in workflow.md)

## Phase 2: UI Changes

- [ ] Task: Add clef selector to `sheet2midi.html`
  - [ ] Sub-task: Add `<div class="setting-group">` with label "Clef" and `<select id="clef-select">`
  - [ ] Sub-task: Options: Bass (`bass`, default selected), Treble (`treble`), Auto (``)

- [ ] Task: Wire clef selector in `sheet2midi-main.js`
  - [ ] Sub-task: Add `const clefSelect = document.getElementById('clef-select')`
  - [ ] Sub-task: Pass `clef: clefSelect.value || null` in `engine.process()` options

- [ ] Task: Conductor - User Manual Verification 'Phase 2: UI Changes' (Protocol in workflow.md)

## Phase 3: Validation

- [ ] Task: Add bass staff test to `omr-validation.test.js`
  - [ ] Sub-task: Add `describe('OMR Validation: BassStaffScale')` block calling `validateFixture('BassStaffScale')`
  - [ ] Sub-task: Ensure `runPipeline` passes `clefOverride: 'bass'` (via options or fixture JSON field)

- [ ] Task: Run tests — all three fixtures must pass
  - [ ] Sub-task: `node --test test/sheet2midi/omr-validation.test.js`

- [ ] Task: Conductor - User Manual Verification 'Phase 3: Validation' (Protocol in workflow.md)
