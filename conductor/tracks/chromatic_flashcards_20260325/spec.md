# Spec: Chromatic Flashcard Support

## Overview

Expand the flashcard game from 7 natural notes in treble clef to all 12 chromatic notes (including sharps/flats) across both treble and bass clefs. Add accidental rendering to StaffRenderer and update answer buttons.

## Current State

- Flashcard covers C4–A5 (13 natural notes, treble clef only)
- 7 answer buttons: C D E F G A B
- StaffRenderer only draws natural notes
- No sharps/flats on staff, no bass clef

## Functional Requirements

1. **Note pool expansion**: All 12 chromatic pitch classes (C, C#, D, D#, E, F, F#, G, G#, A, A#, B) across treble and bass clefs
2. **Accidental rendering**: StaffRenderer draws sharp (#) and flat (b) symbols next to noteheads when needed
3. **Bass clef mode**: StaffRenderer can draw bass clef with correct staff positions
4. **12 answer buttons**: Replace 7-button layout with 12 buttons matching the chromatic scale (C C# D D# E F F# G G# A A# B)
5. **Clef selector**: Toggle between treble, bass, or both (random) on flashcard page
6. **Answer matching**: Pitch-class matching (any octave, enharmonic equivalents accepted)

## Acceptance Criteria

1. All 12 chromatic notes appear in flashcard drills
2. Sharps are drawn correctly on the staff next to noteheads
3. Bass clef notes are positioned correctly
4. 12 answer buttons are displayed in chromatic order
5. MIDI input correctly identifies all 12 pitch classes
6. Unit tests cover accidental rendering, bass clef positions, and answer matching

## Out of Scope

- Double sharps/flats
- Key signature display in flashcards
- Enharmonic spelling preferences (always use sharps)
