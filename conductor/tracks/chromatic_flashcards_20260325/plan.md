# Plan: Chromatic Flashcard Support

## Phase 1: StaffRenderer Accidental & Bass Clef Support

- [ ] Task: Add accidental rendering to StaffRenderer
  - [ ] Sub-task: Write tests — test that sharp symbol is drawn at correct position relative to notehead, test flat symbol rendering
  - [ ] Sub-task: Implement — extend StaffRenderer._drawNote to accept accidental parameter and draw # or b symbol
- [ ] Task: Add bass clef rendering to StaffRenderer
  - [ ] Sub-task: Write tests — test bass clef symbol drawing, test note positions on bass staff (G2=bottom line, B3=top line)
  - [ ] Sub-task: Implement — extend StaffRenderer to support clef='bass' with correct Unicode glyph and staff position mapping
- [ ] Task: Conductor - User Manual Verification 'StaffRenderer Accidental & Bass Clef Support' (Protocol in workflow.md)

## Phase 2: FlashcardGame Chromatic Expansion

- [ ] Task: Expand note pool to 12 chromatic notes across both clefs
  - [ ] Sub-task: Write tests — test that note pool includes all 12 pitch classes, test random note selection covers sharps, test bass clef notes included when mode is 'bass' or 'both'
  - [ ] Sub-task: Implement — update FlashcardGame note pool, add clef mode (treble/bass/both), expand MIDI pitch-class matching to handle sharps
- [ ] Task: Update flashcard UI with 12 answer buttons and clef selector
  - [ ] Sub-task: Write tests — test that 12 buttons exist in chromatic order, test clef selector toggles mode
  - [ ] Sub-task: Implement — update flashcard.html with 12 buttons (C C# D D# E F F# G G# A A# B), add clef selector dropdown
- [ ] Task: Conductor - User Manual Verification 'FlashcardGame Chromatic Expansion' (Protocol in workflow.md)
