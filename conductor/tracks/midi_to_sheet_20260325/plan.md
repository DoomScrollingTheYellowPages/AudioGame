# Plan: MIDI to Sheet Music Export

## Phase 1: Notation Model

- [ ] Task: Create MidiToNotation module for MIDI-to-notation conversion
  - [ ] Sub-task: Write tests — test tick quantization, note-to-staff-position mapping, rest insertion, measure segmentation, beam grouping
  - [ ] Sub-task: Implement — src/notation/MidiToNotation.js: quantize ticks to beat grid, assign staff positions, detect rests, segment into measures, group beams
- [ ] Task: Conductor - User Manual Verification 'Notation Model' (Protocol in workflow.md)

## Phase 2: Sheet Music Renderer

- [ ] Task: Create SheetRenderer for canvas-based notation display
  - [ ] Sub-task: Write tests — test staff line drawing, clef placement, notehead rendering at correct positions, stem/beam/flag drawing, rest symbols, bar lines
  - [ ] Sub-task: Implement — src/notation/SheetRenderer.js: draw grand staff, clefs, time sig, noteheads, stems, beams, flags, rests, bar lines, measure numbers
- [ ] Task: Conductor - User Manual Verification 'Sheet Music Renderer' (Protocol in workflow.md)

## Phase 3: SVG Export & UI Integration

- [ ] Task: Add SVG export from rendered notation
  - [ ] Sub-task: Write tests — test that SVG output contains expected elements (staff lines, noteheads, clefs), valid SVG structure
  - [ ] Sub-task: Implement — src/notation/SvgExporter.js: convert notation model to SVG string with black-on-white print styling
- [ ] Task: Add "View Sheet Music" button and export UI to rhythm page
  - [ ] Sub-task: Write tests — test button appears after MIDI load, sheet view toggles, download triggers SVG blob
  - [ ] Sub-task: Implement — add UI elements to rhythm.html, wire to SheetRenderer and SvgExporter
- [ ] Task: Conductor - User Manual Verification 'SVG Export & UI Integration' (Protocol in workflow.md)
