# VexFlow Architecture Research

**Repo:** https://github.com/0xfe/vexflow (V4 LTS) / https://github.com/vexflow/vexflow (V5 current)
**License:** MIT
**Language:** TypeScript, compiles to ES6
**Renders to:** HTML Canvas and SVG (dual backend)
**Latest:** V5.0.0 (March 2025), V4.2.6 (LTS)

This document captures a thorough analysis of VexFlow's internals — its class hierarchy, data model, rendering pipeline, layout algorithms, coordinate system, and known limitations. The goal is to understand what a mature music renderer expects as input, so our OMR pipeline can produce compatible data structures.

---

## 1. Architecture Overview

### Class Hierarchy

VexFlow has a deep inheritance chain rooted in `Element`:

```
Element
  -> Tickable
       -> Note
            -> StemmableNote
                 -> StaveNote      (standard notation)
                 -> TabNote        (tablature)
                 -> GraceNote      (grace notes)
                 -> GraceTabNote
            -> TextNote
            -> ClefNote           (mid-staff clef changes)
            -> KeySigNote         (mid-staff key changes)
            -> TimeSigNote        (mid-staff time changes)
            -> BarNote            (mid-measure barlines)
            -> GhostNote          (invisible spacer)
       -> GlyphNote
  -> StaveModifier
       -> Clef
       -> KeySignature
       -> TimeSignature
       -> StaveBarline
       -> StaveRepetition
       -> StaveSection
       -> StaveTempo
       -> StaveText
       -> StaveVolta
  -> Modifier
       -> Accidental
       -> Annotation
       -> Articulation
       -> Ornament
       -> Dot
       -> Bend
       -> Vibrato
       -> ChordSymbol
       -> FretHandFinger
       -> StringNumber
       -> Stroke
       -> Parenthesis
       -> Tremolo
       -> GraceNoteGroup
       -> NoteSubGroup
  -> Stave
  -> Beam
  -> Tuplet
  -> StaveTie / TabTie
  -> Curve
  -> StaveLine
  -> StaveConnector
  -> StaveHairpin
  -> PedalMarking
  -> TextBracket
  -> TextDynamics
  -> Voice
  -> System
```

### Key Relationships

- **Element** is the base of everything. It holds a `RenderContext` (SVG or Canvas), an `ElementStyle`, a `BoundingBox`, and a `children[]` array. Every drawable thing inherits from it.
- **Tickable** adds duration semantics: a `Fraction` for ticks, a `TickContext` reference, a `Voice` reference, and pre/post-format hooks. Anything with rhythmic duration is a Tickable.
- **Note** adds pitch semantics: keys, Y positions (`ys[]`), staff line mappings, and modifier attachment points.
- **StemmableNote** adds stem logic: direction, length, flag glyphs, stem X/Y calculation.
- **StaveNote** is the concrete workhorse: builds noteheads, handles displacement for seconds/clusters, calculates auto-stem direction, renders ledger lines.

### Module Count

93 TypeScript source files in `/src`, plus a `/src/fonts` directory containing SMuFL-based music font data. Key files by function:

| Category | Files |
|----------|-------|
| Core data | `note.ts`, `tickable.ts`, `element.ts`, `fraction.ts`, `music.ts`, `tables.ts` |
| Notes | `stavenote.ts`, `notehead.ts`, `stemmablenote.ts`, `gracenote.ts`, `ghostnote.ts`, `textnote.ts` |
| Staff | `stave.ts`, `stavemodifier.ts`, `clef.ts`, `keysignature.ts`, `timesignature.ts`, `stavebarline.ts` |
| Modifiers | `modifier.ts`, `modifiercontext.ts`, `accidental.ts`, `dot.ts`, `articulation.ts`, `ornament.ts`, `annotation.ts` |
| Layout | `formatter.ts`, `tickcontext.ts`, `voice.ts`, `system.ts` |
| Beams/Groups | `beam.ts`, `tuplet.ts`, `stem.ts` |
| Connectives | `stavetie.ts`, `curve.ts`, `staveline.ts`, `staveconnector.ts` |
| Rendering | `renderer.ts`, `rendercontext.ts`, `canvascontext.ts`, `svgcontext.ts`, `glyph.ts` |
| High-level API | `factory.ts`, `easyscore.ts`, `parser.ts` |

---

## 2. Data Model

### Pitch Representation

VexFlow represents pitch as **string keys** like `"C/4"`, `"D#/5"`, `"Eb/3"`. The slash separates note name (with optional accidental) from octave number.

The `Tables.keyProperties(key, clef)` function converts a key string into a `KeyProps` object:

```typescript
interface KeyProps {
  key: string;          // original key string
  octave: number;       // octave number
  line: number;         // staff line position (0 = top line, fractional for spaces)
  int_value: number;    // MIDI-like integer (C/4 = 60 equivalent)
  accidental: string;   // '#', 'b', '##', 'bb', 'n', or ''
  code: string;         // glyph code for the notehead
  displaced: boolean;   // whether this note needs horizontal displacement
  stroke: number;       // stem offset
}
```

The `line` value is clef-dependent. The `clefs` table in `tables.ts` defines a `line_shift` per clef type:
- Treble: shift 0
- Bass: shift 6
- Alto: shift 3
- Tenor: shift varies

This shift is added to the base line calculation, so the same pitch produces different line numbers on different clefs.

### Note Names and Accidentals

The `notesInfo` table maps 35 note spellings to their properties:

| Key | index (diatonic) | int_val (chromatic 0-11) | accidental |
|-----|-------------------|--------------------------|------------|
| C   | 0 | 0 | — |
| C#  | 0 | 1 | # |
| C## | 0 | 2 | ## |
| Cb  | 0 | 11 | b |
| Cbb | 0 | 10 | bb |
| D   | 1 | 2 | — |
| ... | ... | ... | ... |
| B   | 6 | 11 | — |
| B#  | 6 | 0 | # |
| Bb  | 6 | 10 | b |

The `index` field is the diatonic step (0=C through 6=B). The `int_val` is the chromatic pitch class (0-11). This separation is essential: enharmonic spellings like C# and Db share `int_val=1` but have different `index` values (0 vs 1), which places them on different staff lines.

### Duration Representation

Durations are stored as string codes mapped to tick counts via `Tables.durationToTicks`:

| Code | Alias | Ticks (of 16384) |
|------|-------|-------------------|
| `"1"` | `"w"` (whole) | 16384 |
| `"2"` | `"h"` (half) | 8192 |
| `"4"` | `"q"` (quarter) | 4096 |
| `"8"` | — | 2048 |
| `"16"` | — | 1024 |
| `"32"` | — | 512 |
| `"64"` | — | 256 |
| `"128"` | — | 128 |

The resolution of 16384 ticks per whole note allows exact representation of all standard subdivisions including triplets and dotted notes. Dots add half of the current tick value per dot (a dotted quarter = 4096 + 2048 = 6144 ticks). Tuplets apply a `tickMultiplier` fraction (e.g., 2/3 for triplets).

The `Fraction` class handles all tick arithmetic using rational numbers to avoid floating-point errors.

### Key Signatures

Key signatures are stored as a string spec (e.g., `"G"` for G major, `"F"` for F major, `"Bb"` for Bb major). The `Tables.keySignature(spec)` function returns an array of `{acc, line}` pairs specifying which accidental to draw on which staff line.

The `KeyManager` class maintains running accidental state during a measure:
- `scaleMap`: maps each diatonic root (C, D, E, F, G, A, B) to its current accidental state based on the key signature
- `selectNote(note)`: given a note, determines whether an accidental needs to be displayed (because it differs from the key signature expectation)
- Supports enharmonic resolution: if you write Db in the key of C, the KeyManager finds the appropriate spelling

### Time Signatures

Time signatures use string specs: `"4/4"`, `"3/8"`, `"6/8"`, `"C"` (common time), `"C|"` (cut time). The `TimeSignature` class parses these and generates appropriate glyphs. Compound time signatures like `"2/4+5/8"` are supported.

### Voices

A `Voice` is a container of `Tickable` objects representing a single melodic/rhythmic line. Key properties:
- `time`: the time signature as `{num_beats, beat_value, resolution}`
- `totalTicks`: expected total ticks for the voice based on time signature
- `ticksUsed`: accumulated ticks from added tickables
- `mode`: STRICT (must fill exactly), SOFT (no restriction), FULL (can't exceed)
- `resolution_multiplier`: dynamically adjusted for LCM alignment across voices

### Staves

A `Stave` represents a horizontal staff. Key properties:
- `x`, `y`, `width`: position and extent
- `num_lines`: number of staff lines (default 5)
- `spacing_between_lines_px`: pixel distance between lines (default from `Tables.STAVE_LINE_DISTANCE`)
- `space_above_staff_ln`: headroom above staff (default 4 line-spaces)
- `modifiers[]`: clefs, key signatures, time signatures, barlines
- `start_x`, `end_x`: boundaries where notes can be placed (after modifiers)

---

## 3. Rendering Pipeline

The full path from data to pixels follows this sequence:

### Step 1: Create Objects

Using either the Factory/EasyScore high-level API or the native API:

```
Factory -> Stave, StaveNote, Voice, Beam, etc.
```

Each created object receives a `RenderContext` (SVG or Canvas backend).

### Step 2: Attach Notes to Staves

`note.setStave(stave)` triggers Y-position calculation. For each key in the note:
1. `Tables.keyProperties(key, clef)` converts the key string to a line number
2. `stave.getYForNote(line)` converts the line to a pixel Y coordinate:
   ```
   Y = stave.y + (line * spacing) + (headroom * spacing)
   ```
3. The note stores these Y values in its `ys[]` array

### Step 3: Create Voices and Add Notes

Notes are added to `Voice` objects, which track tick accumulation and validate against the time signature.

### Step 4: Format

The `Formatter` is the layout engine. It runs this pipeline:

**4a. Create TickContexts** (`createTickContexts`)
- Scans all voices and groups tickables by their tick position
- Each unique tick position gets a `TickContext` object
- Multiple voices sharing the same tick position share the same TickContext

**4b. Create ModifierContexts**
- Groups modifiers (accidentals, dots, articulations) that appear at the same tick on the same stave
- Each group gets a `ModifierContext` that manages their relative positioning

**4c. PreFormat** (`preFormat`)
- Each TickContext calculates its minimum width by aggregating the widths of all its tickables plus their modifiers
- Assigns preliminary X positions by accumulating widths left to right
- Calculates a "softmax" proportional spacing factor based on note durations

**4d. Justify**
- Distributes remaining horizontal space proportionally
- Uses a cost-minimization algorithm that balances:
  - Proportional spacing (longer notes get more space)
  - Minimum collision avoidance (notes can't overlap)
  - Duration entropy across voices (smooths uneven spacing)
- Iterative: the `tune()` method can run multiple passes to refine

**4e. PostFormat**
- Finalizes modifier positions within each ModifierContext
- Processes modifiers in a specific order: StaveNote -> Parenthesis -> Dot -> FretHandFinger -> Accidental -> Stroke -> GraceNoteGroup -> NoteSubGroup -> StringNumber -> Articulation -> Ornament -> Annotation -> ChordSymbol -> Bend -> Vibrato
- Each modifier type has its own static `format()` method that implements category-specific positioning logic

### Step 5: Draw

Every element's `draw()` method renders to the context. The typical call order:
1. `stave.draw()` — staff lines, clef, key sig, time sig, barlines
2. `voice.draw()` — iterates tickables, each calling their own draw
3. `beam.draw()` — beam lines connecting note stems
4. `tie.draw()` — tie curves between notes
5. Other decorations (tuplets, curves, dynamics, etc.)

The `Factory.draw()` method orchestrates all of this automatically.

---

## 4. Layout / Formatting Engine Details

### Horizontal Spacing Algorithm

The Formatter uses a **softmax-based proportional spacing** algorithm:

1. Each TickContext has a tick duration (the maximum tick value of its tickables)
2. The softmax function converts durations to spacing weights:
   - Longer notes receive proportionally more space
   - The distribution is smoothed by an exponential function
3. The total available width (stave width minus modifier space) is distributed according to these weights
4. Minimum widths from preFormat serve as constraints — no context can be narrower than its content

The justification loop iterates, adjusting positions while respecting:
- Non-collision constraints (adjacent contexts can't overlap)
- Minimum padding requirements
- Freedom metrics that track how much each context can move

### Vertical Positioning

Vertical layout is stave-relative, not absolute. Each stave defines its own coordinate space:

- Line 0 = top line of the staff
- Line 4 = bottom line (for a 5-line staff)
- Half-lines (0.5, 1.5, etc.) = spaces between lines
- Lines below 0 or above 4 = ledger line territory

The formula for Y:
```
Y = stave.y + (line * spacing_between_lines_px) + (space_above_staff_ln * spacing_between_lines_px)
```

The `space_above_staff_ln` (default 4) creates headroom above the staff for ledger lines, accidentals, and other markings.

### Multi-Voice Layout

When multiple voices share a stave:
1. The Formatter creates shared TickContexts for aligned tick positions
2. Unaligned tick positions (one voice has a note, another doesn't) get extra padding
3. Stem directions are typically forced: voice 1 up, voice 2 down
4. Noteheads at the same pitch in different voices may be displaced horizontally

### Beam Grouping

The `Beam.generateBeams()` static method implements automatic beam grouping:

1. Takes an array of notes and beat group fractions (e.g., `[new Fraction(2, 8)]` for grouping by quarter-note beats)
2. Accumulates notes into groups until tick targets are reached
3. Splits groups at rests (unless `beam_rests` is enabled)
4. Handles tuplets with adjusted tick requirements

Beam slope calculation uses a cost-minimization approach:
- Iterates through candidate slopes between -0.25 and 0.25
- Calculates stem extension cost at each slope
- Weights toward an "ideal slope" (half the slope between first and last notes)
- Selects the slope with minimum total cost

Stem direction for beamed groups: sums `(line - 3)` across all notes. If non-negative, stems go down; otherwise up.

### Stem Direction

Auto-stemming in `StaveNote.calculateOptimalStemDirection()`:
- Calculates `(minLine + maxLine) / 2`
- If this average is at or above line 3 (middle line), stems go down
- Otherwise, stems go up

For chords, this means the majority pitch position determines direction.

---

## 5. Staff Coordinate System

### Per-Stave Line Numbers

VexFlow uses **per-stave line numbers** — there is no unified cross-stave coordinate. Each stave has its own line space where line 0 is the top and line 4 is the bottom (for standard 5-line staves).

The line number for a given pitch depends on the clef. The `Tables.keyProperties()` function computes line positions using:

1. A base table mapping note names to octave-relative positions
2. A clef-specific `line_shift` value added to the result:
   - Treble clef: shift 0 (reference)
   - Bass clef: shift 6 (pushes notes 6 half-spaces down to account for the different pitch range)
   - Alto clef: shift 3
   - Tenor, soprano, mezzo-soprano, etc. have their own shifts

This means middle C (C/4):
- On treble clef: line 5 (one ledger line below the staff)
- On bass clef: line -1 (one ledger line above the staff)

### Ledger Lines

Notes outside the 0-4 line range trigger ledger line drawing. The `NoteHead` class detects when `line > 5` or `line < 0` and renders appropriate ledger line glyphs. The `Stave.getYForNote(line)` method works for any line value, positive or negative, extending the coordinate space infinitely in both directions.

### Grand Staff

VexFlow handles grand staff by creating **two separate Stave objects** positioned vertically:

```javascript
const trebleStave = new Stave(x, y, width);
trebleStave.addClef('treble');

const bassStave = new Stave(x, y + 120, width);  // offset below
bassStave.addClef('bass');

// Connect them visually
const connector = new StaveConnector(trebleStave, bassStave);
connector.setType(StaveConnector.type.BRACE);
```

There is no built-in concept of a grand staff as a single entity. Cross-stave coordination is the caller's responsibility.

### Cross-Staff Notes

Issue #434 (open since 2016) requests cross-staff chord support. The architectural challenge: a StaveNote assumes all its noteheads belong to the same stave. To render a chord spanning treble and bass, you would need noteheads referencing different staves, with a stem connecting across the stave gap.

Issue #1373 (closed) added partial support for voices spanning staves via `setStave()` on individual notes after stave Y-positions are calculated. This allows notes in a single voice to appear on different staves, but cross-staff chords (single StaveNote with heads on different staves) remain unsupported.

### The System Class

The `System` class provides higher-level grand staff management:
- Manages collections of staves (`partStaves`) with configurable spacing (default 12 stave-spaces between staves)
- Adds connectors (braces, brackets, barlines) between first and last staves
- Formats voices across all staves simultaneously using a shared Formatter
- Auto-calculates width and applies justification globally

---

## 6. Modifier and Accidental Placement

### ModifierContext

The `ModifierContext` groups all modifiers at a single tick position on a single stave. It maintains:
- `left_shift`, `right_shift`: accumulated horizontal displacement in pixels
- `text_line`, `top_text_line`: vertical text positioning state

Modifiers are processed in a strict order during postFormat (see Section 3, Step 4e). Each modifier type's `format()` method reads the current shift state, positions itself, and updates the state for the next type.

### Accidental Placement Algorithm

`Accidental.format()` implements a sophisticated collision-avoidance algorithm:

1. **Sort accidentals** by staff line from top to bottom
2. **Calculate clearance** requirements: flats need 2.5 line-spaces, sharps/naturals need 3.0
3. **Check collisions** between consecutive accidentals vertically
4. **Assign columns**: for groups of 6 or fewer conflicting accidentals, use a lookup table for optimal column assignment. For larger groups, use a parallel ascending pattern.
5. **Normalize widths** per column using the widest accidental in each column
6. **Calculate total left shift** from the accumulated column widths

### Automatic Accidental Calculation

`Accidental.applyAccidentals(voices, keySignature)` processes all notes across voices:

1. Maps tickables by position across voices
2. Maintains a `scaleMap` based on the key signature (via `Music.createScaleMap()`)
3. For each note, compares its accidental against the scale expectation
4. Adds an `Accidental` modifier only when the note differs from the key signature
5. Updates the scaleMap so subsequent notes in the same measure reflect courtesy/cancellation logic

---

## 7. Known Issues and Limitations

### Architectural Limitations

**ModifierContext Complexity (Issue #409, open)**
The ModifierContext mixes horizontal (pixel) and vertical (staff-space) units, duplicates some Formatter responsibilities, and has grown complex. A proposed simplification to use staff-spaces everywhere (matching SMuFL/MusicXML conventions) has not been implemented.

**Formatting Order Circular Dependency (Issue #522, open)**
The formatting pipeline has a fundamental circular dependency: modifier vertical positions depend on stem tips, which depend on beam slopes, which depend on X positions, which depend on modifier widths. The current implementation works around this with a fixed processing order, but the ideal solution (direction-based formatting rather than element-type-based) has not been implemented.

**Cross-Staff Chords (Issue #434, open since 2016)**
Single chords spanning two staves are not supported. The StaveNote class assumes all noteheads belong to one stave. Workaround: use two separate notes on different staves with a manual stem connector (not easy).

**Voice-Stave Binding**
Originally, all notes in a voice had to be on the same stave. Issue #1373 (closed) added support for notes in a voice appearing on different staves, but this requires calling `setStave()` on individual notes after layout, which is fragile.

### Beam Issues

**Mixed Subdivisions (Issue #1589, open)**
`generateBeams()` produces incorrect results when notes have mixed subdivisions (e.g., eighth + sixteenth in the same group).

**Beam Slope (Issue #1579, open)**
Beam slope calculation can produce suboptimal angles.

**Wide Spacing (Issue #485, open since 2016)**
Widely-spaced beamed notes produce incorrect beam slopes due to the slope optimization algorithm's limited range (-0.25 to 0.25).

### Accidental Issues

**Spacing of 2nds with Accidentals (Issue #1578, closed)**
Accidentals on notes a second apart had spacing problems. Fixed.

**Alignment Between Staves with Different Key Signatures (Issue #1389, closed)**
Key signatures of different widths caused misalignment between staves. Fixed.

### Formatter Issues

**Modifier Misplacement on Staves with Different startX (Issue #1609, closed)**
When staves had different starting X positions (e.g., different key signatures), modifiers were placed incorrectly. Fixed.

**SVG Scaling (Issue #1587, open)**
SVGContext has scaling issues in 4.2.2.

### Missing Features

**Slurs/Phrase Marks (Issue #1423, open)**
VexFlow lacks a proper slur/phrase curve type distinct from ties.

**Non-Standard Key Signatures (Issue #328)**
Limited support for key signatures outside the standard major/minor circle of fifths.

---

## 8. Version History: 3.x vs 4.x vs 5.x

### VexFlow 3.x
- Pure JavaScript
- CommonJS modules
- `Vex.Flow` namespace pattern
- Helper methods on StaveNote: `addAccidental()`, `addArticulation()`, `addDot()`

### VexFlow 4.x (Breaking Changes)
- **Full TypeScript rewrite** — typed interfaces, strict null checks, better IDE support
- **ES6 module output** — both ESM and CJS builds available
- **Removed helper methods** — `StaveNote.addAccidental()`, `addArticulation()`, `addAnnotation()`, `addDot()` removed. Use `note.addModifier(modifier, index)` instead
- **Naming standardization** — CATEGORY properties switched to singular UpperCamelCase
- **Font architecture overhaul** — SMuFL-based font system, lazy-loading support, flexible `setFont()` API accepting CSS shorthand
- **MusicXML test suite compliance** — many fixes driven by the unofficial MusicXML test suite
- **ES6 target** — no longer supports pre-ES6 environments

### VexFlow 5.x (Current)
- Moved to new repository: `github.com/vexflow/vexflow`
- Published as `vexflow` on NPM (V4 is `vexflow4`)
- Exports a single `VexFlow` object instead of `Vex.Flow`
- Maintained by Ron Yeh and Rodrigo Vilar
- 5.0.0 released March 2025
- Further naming convention changes planned (camelCase everything, Issue #1166)

---

## 9. Implications for OMR Pipeline Output

### What VexFlow Expects as Input

To feed OMR output to VexFlow (or any VexFlow-compatible renderer), the OMR pipeline must produce:

1. **Pitch as key strings**: `"C/4"`, `"F#/5"`, `"Bb/3"` — note name + accidental + octave. Not MIDI numbers. VexFlow needs the enharmonic spelling to place notes on the correct staff line.

2. **Duration as code strings**: `"q"`, `"8"`, `"16d"` (dotted sixteenth) — or as tick counts that map to these codes.

3. **Clef context**: Which clef applies to each note, since the same pitch maps to different staff lines depending on clef.

4. **Key signature**: The key signature string, so `Accidental.applyAccidentals()` can determine which accidentals to display vs. suppress.

5. **Time signature**: Needed for voice validation and beam grouping.

6. **Voice assignment**: Which notes belong to the same melodic line (important for beam grouping, stem direction, and collision avoidance).

7. **Beam groupings**: Either explicit beam groups or enough rhythmic context for `Beam.generateBeams()` to compute them.

8. **Stave breaks**: Where systems start and end, since VexFlow lays out one system at a time.

### What VexFlow Does NOT Need from OMR

- **Pixel coordinates** — VexFlow calculates all positions from the data model
- **Glyph identifiers** — VexFlow selects glyphs from duration/pitch/clef
- **Stem directions** — auto-calculated (though can be overridden)
- **Spacing** — the Formatter handles all horizontal layout

### Data Structure Alignment

Our OMR pipeline currently produces note objects with MIDI note numbers and pixel-based bounding boxes. To be VexFlow-compatible, we would need to add:

| OMR needs to produce | VexFlow field | Our current state |
|----------------------|---------------|-------------------|
| Enharmonic spelling (C# vs Db) | `key` string | We detect sharps/flats but don't spell them |
| Duration code | `duration` string | We detect note head fill + flags/beams |
| Clef type | `clef` parameter | We detect clef glyphs |
| Key signature | `keySpec` string | We detect key signature accidentals |
| Time signature | `timeSpec` string | Not yet implemented |
| Voice assignment | Voice grouping | Not yet implemented |
| Measure boundaries | Stave/system breaks | We detect barlines |

### The Enharmonic Spelling Problem

This is the hardest gap. When our OMR detects a note on a staff line and identifies it as chromatic pitch 1 (C#/Db), we must choose the correct spelling. VexFlow's `Music.getRelativeNoteName()` can help — given a target root note (from the staff position) and a chromatic value, it returns the correctly-spelled name. But we need to get the diatonic position right first, which requires knowing the clef and counting lines/spaces from the clef reference point.

---

## 10. Key Takeaways

1. **VexFlow is a renderer, not a data format.** It has no file format, no serialization, no import/export. It expects pre-structured JavaScript objects. Any OMR pipeline must construct these objects explicitly.

2. **Enharmonic spelling is essential.** MIDI note numbers are insufficient. VexFlow needs to know if a note is C# or Db because they occupy different staff positions. Our OMR pipeline must resolve this from the visual staff position.

3. **Per-stave coordinates, not unified.** VexFlow has no single coordinate system spanning a grand staff. Each stave is independent. This matches how our OMR processes staves individually but means cross-stave relationships need explicit handling.

4. **The Formatter is the hard part.** VexFlow's proportional spacing algorithm with softmax weighting, multi-voice alignment, and iterative tuning is sophisticated. We don't need to replicate it — we just need to produce data that feeds into it correctly.

5. **The accidental system is context-dependent.** Whether an accidental renders depends on the key signature, previous accidentals in the measure, and the note's position in the voice. Our OMR must detect accidental glyphs visually, but the *meaning* of those accidentals depends on musical context that VexFlow's `Accidental.applyAccidentals()` already handles.

6. **Beam grouping is algorithmically determined.** VexFlow can generate beam groups from note durations and time signatures. Our OMR detects beams visually, but for rendering, we may only need to provide the durations and let VexFlow recompute the beams.

7. **VexFlow V5 is the future.** The V4 LTS at `0xfe/vexflow` is stable but the active development has moved to `vexflow/vexflow`. Any integration work should target V5's API.
