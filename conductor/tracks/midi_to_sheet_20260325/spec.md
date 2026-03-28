# Spec: MIDI to Sheet Music Export

## Overview

Add the ability to render loaded MIDI files as standard music notation on a canvas/SVG, and export the result as a downloadable SVG or printable page. This bridges the gap between the existing MIDI playback (rhythm game) and traditional sheet music reading.

## Functional Requirements

1. **MidiToNotation module** — takes a parsed MIDI note array (from MidiParser) and converts it to a notation model: measures, beats, note positions on staff, accidentals, rests
2. **SheetRenderer module** — renders the notation model onto a canvas or as SVG:
   - Grand staff (treble + bass) or single staff depending on note range
   - Clef symbols, time signature, key signature
   - Noteheads (filled, open, whole) with stems, beams, flags
   - Rests at correct positions
   - Bar lines and measure numbers
   - Note names optionally displayed below notes
3. **Export button** on the sheet2midi page and rhythm page — generates a downloadable SVG file
4. **Print-friendly layout** — white background, black notation, standard spacing

## Technical Approach

- Pure canvas/SVG rendering, no external libraries
- Reuse existing `MidiParser` output format
- Quantize MIDI ticks to nearest beat subdivision (sixteenth note grid)
- Use the same staff coordinate system as `StaffHighway.js` (diatonic position d, E4=30)
- Theme-aware: read colors from `Theme.current()` for screen display, force black-on-white for export

## Acceptance Criteria

1. Load a MIDI file on the rhythm page → "View Sheet Music" button appears
2. Clicking it renders the full piece as standard notation
3. Notes, rests, time signature, clef, bar lines are all correctly placed
4. SVG export produces a valid downloadable file
5. Simple MIDI files (C scale, Mary Had a Little Lamb) render correctly
6. All new modules have unit tests with >80% coverage

## Out of Scope

- Lyrics or text annotations
- Multi-voice notation (voice 1 / voice 2 on same staff)
- Tuplet notation
- Dynamic markings, articulations
- PDF export (SVG is sufficient; users can print-to-PDF from browser)
