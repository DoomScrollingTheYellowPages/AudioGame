# Track: OMR Note Deduplication

## Overview

The `_splitNoteStems` helper can produce sub-components that spatially overlap
with the original component (both classified as filled_notehead). This results in
duplicate notes at the same x-position and pitch in the output, corrupting the MIDI.

The pipeline needs a deduplication step that removes duplicate notes by merging
notes that share the same pitch and are spatially adjacent (within 1 staffSpace
horizontally).

## Functional Requirements

### 1. Deduplication in GrammarValidator
- After the pitch/duration assignment pipeline, add a deduplication pass before
  the final note list is returned.
- Two notes are duplicates if: `|n1.x - n2.x| < staffSpace` AND `n1.midiNote == n2.midiNote`.
- When duplicates are found, keep the one with the larger fill area (better detection).
  If areas are equal, keep the first (leftmost).
- Log deduplicated notes for debugging.

### 2. Unit Tests
- Test: two notes at same pitch within 1 staffSpace → one kept.
- Test: two notes at same pitch but > 1 staffSpace apart → both kept.
- Test: two notes at different pitches within 1 staffSpace → both kept.
- Test: all existing validation fixtures still pass (no valid notes removed).

## Acceptance Criteria
- [ ] GrammarValidator deduplicates overlapping same-pitch notes.
- [ ] All 25+ existing OMR validation tests pass.
- [ ] BMajorScale pipeline produces correct note count without duplicates.
- [ ] Unit tests cover all deduplication scenarios.

## Out of Scope
- Polyphonic deduplication (same x, different pitch).
- Cross-staff deduplication (grand staff).
