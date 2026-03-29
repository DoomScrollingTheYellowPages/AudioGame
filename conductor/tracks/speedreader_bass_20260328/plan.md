# Plan: SpeedReaderGame Bass Clef & Clef Mode Support

## Phase 1: Tests & Implementation [checkpoint: 24a4390]

### Task 1.1: Write failing SpeedReaderGame tests (Red) [x]
Create `test/flashcard/SpeedReaderGame.test.js` with 8 tests.
Tests will fail because `setClefMode()` and `_notePool()` don't exist yet.

### Task 1.2: Add bass clef support to SpeedReaderGame (Green) [x]
Modify `src/flashcard/SpeedReaderGame.js`:
- Add `BASS_NOTES = Array.from({ length: 24 }, (_, i) => 36 + i)`
- Add `this._clefMode = 'treble'` in constructor
- Add `_notePool()` method
- Add `setClefMode(mode)` method
- Update `nextNote()` to use `this._notePool()`

### Task 1.3: Add clef selector to speed-reader.html [x]
Add three-button toggle (Treble / Bass / Both) matching flashcard.html pattern.
Wire buttons to `game.setClefMode()` in `src/speed-reader-main.js`.

### Task 1.4: Conductor - User Manual Verification 'Phase 1' (Protocol in workflow.md) [x]
