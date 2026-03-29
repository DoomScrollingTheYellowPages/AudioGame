# Spec: SpeedReaderGame Bass Clef & Clef Mode Support

## Overview

`SpeedReaderGame.js` currently only supports treble clef notes (C4–A♯5).
`FlashcardGame.js` already supports treble, bass, and mixed ('both') modes with
a `setClefMode()` method. This track brings the same capability to SpeedReaderGame
so users can practice bass clef note reading and mixed-clef drills at speed.

## Current State

- SpeedReaderGame uses only `TREBLE_NOTES = [60..82]`
- No `setClefMode()` method
- `speed-reader.html` has no clef selector UI
- FlashcardGame already has full clef-mode support as a reference

## Functional Requirements

1. **BASS_NOTES pool**: Add `BASS_NOTES = [36..59]` (C2–B3, matching FlashcardGame)
2. **`setClefMode(mode)`**: Accepts `'treble'`, `'bass'`, `'both'`. Stores `this._clefMode` and immediately calls `nextNote()`.
3. **`_notePool()`**: Returns the correct array based on `this._clefMode`.
4. **`nextNote()` update**: Uses `this._notePool()` instead of hardcoded `TREBLE_NOTES`.
5. **Clef selector in speed-reader.html**: Three-button toggle (Treble / Bass / Both) consistent with flashcard.html styling.
6. **Default**: `'treble'` (unchanged from current behavior).

## Acceptance Criteria

1. `test/flashcard/SpeedReaderGame.test.js` with ≥ 8 passing tests:
   - `setClefMode('treble')` selects treble pool only
   - `setClefMode('bass')` selects bass pool only
   - `setClefMode('both')` selects combined pool
   - Default mode is 'treble'
   - `submitAnswer()` correct answer increments `notesCompleted`
   - `submitAnswer()` wrong answer sets `_firstTry = false`, keeps `notesCompleted` unchanged
   - `_notesPerMin()` returns 0 before any notes
   - `_accuracy()` returns 100 when no notes answered
2. speed-reader.html shows clef selector buttons
3. All 393 existing tests continue to pass

## Out of Scope

- Chromatic-only bass mode (SpeedReaderGame uses all chromatic notes in treble; same for bass)
- Persistent preference storage
- Fingering renderer clef mode (FingeringRenderer doesn't use clef)
