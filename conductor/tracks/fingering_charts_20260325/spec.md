# Spec: Multi-Instrument Fingering Charts

## Overview

Expand the instrument fingering system beyond oboe to support flute, clarinet, trumpet, saxophone, piano key charts, and guitar tablature. Each instrument gets its own data file and renderer following the existing FingeringRenderer pattern.

## Instruments to Add

### Wind/Brass (same hole/key rendering pattern as oboe)
1. **Flute** — open-hole system, 3+3 main keys plus trill/thumb keys. Range: C4–C7.
2. **Clarinet** — Boehm system, tone holes + register key. Range: E3–C7.
3. **Alto Saxophone** — similar to clarinet, octave key + palm keys. Range: Db3–A5 (concert).
4. **Trumpet** — 3 valves only. Range: F#3–C6.

### Keyboard
5. **Piano** — highlight keys on a keyboard diagram. Reuse KeyboardDisplay rendering approach. Range: full 88 keys.

### String
6. **Guitar Tab** — 6-string fretboard diagram showing fret numbers per string. Range: E2–E6.

## Technical Approach

- Each instrument gets: `src/fingering/<Name>FingeringData.js` (note→fingering map) and optionally a custom renderer if the oboe pattern doesn't fit
- Wind/brass instruments reuse FingeringRenderer with instrument-specific layout configs (number of holes, positions, labels)
- Piano uses a simplified KeyboardDisplay-style renderer
- Guitar uses a fretboard grid renderer
- FingeringHighway already supports any instrument via duck-typing — just needs the data

## Acceptance Criteria

1. Each instrument has a complete fingering data file covering its practical range
2. FingeringRenderer (or instrument-specific renderer) displays correct fingerings
3. Each data file has unit tests verifying primary fingering for at least 10 representative notes
4. Instruments are selectable from a dropdown on the rhythm page

## Out of Scope

- Alternate/trill fingerings (only primary)
- Microtonal fingerings
- Bowing techniques for strings
