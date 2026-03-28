# Plan: OMR Note Deduplication

## Phase 1: Deduplication

- [~] Task: Write failing tests for deduplication
  - [ ] Sub-task: Test: two notes at same pitch within 1 staffSpace → one kept
  - [ ] Sub-task: Test: two notes at same pitch > 1 staffSpace apart → both kept
  - [ ] Sub-task: Test: two notes at different pitches within 1 staffSpace → both kept

- [ ] Task: Implement deduplication in GrammarValidator
  - [ ] Sub-task: Add _deduplicateNotes(notes, staffSpace) private method
  - [ ] Sub-task: Call in validate() before returning final note list
  - [ ] Sub-task: Keep note with larger component area when deduplicating
  - [ ] Sub-task: Log deduplicated notes

- [ ] Task: Verify all existing validation tests still pass
  - [ ] Sub-task: node --test test/sheet2midi/omr-validation.test.js

- [x] Task: Conductor - User Manual Verification 'Phase 1: Deduplication' (Protocol in workflow.md)
