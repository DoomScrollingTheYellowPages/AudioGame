# Staff Notation Coordinates

## The Problem

To draw a note on a canvas, you need to convert a musical position — a pitch like G4 or F#3 — into a Y pixel coordinate on a staff. This requires answering three questions:

1. Which diatonic step is this note on? (lines and spaces, ignoring accidentals)
2. Which staff does it belong to? (treble, bass, or grand staff spanning both)
3. What is the pixel height of one step on this canvas?

The design decision is: **what is the coordinate space?** Do you use one number line spanning all pitches, or separate spaces per clef?

---

## Known External Approaches

### VexFlow
**Repo:** https://github.com/0xfe/vexflow

VexFlow is the most widely used JavaScript music notation library. It assigns each note a "key" string (e.g. `"G/4"`) and maps it to a stave using a lookup table of absolute Y offsets per note name per octave, anchored to the stave's top-left origin. Each stave is an independent object with its own coordinate space — there is no unified cross-stave position number. Grand staff is handled by creating two separate `Stave` objects and positioning them independently in the layout engine.

**Trade-off:** Very flexible for complex layout (multiple systems, different clef combinations), but cross-stave relationships (e.g. middle C ledger lines) require manual coordination between the two stave objects.

### OpenSheetMusicDisplay (OSMD)
**Repo:** https://github.com/opensheetmusicdisplay/opensheetmusicdisplay

OSMD parses MusicXML and uses a layout engine derived from MuseScore's approach. Pitches are stored as `<step>` + `<octave>` (the MusicXML standard) and converted to absolute diatonic positions for layout. It uses a unified diatonic integer — essentially the same as our `d` system below — to compute vertical position across staves before scaling to pixels.

**Trade-off:** Full MusicXML support, handles complex engraving rules, but large dependency surface.

### MusicXML Standard
**Spec:** https://www.w3.org/2021/06/musicxml40/

MusicXML stores pitch as `<step>C–B</step>` + `<alter>±1</alter>` + `<octave>0–9</octave>`. For rendering, it computes an absolute diatonic position: `octave × 7 + diatonicStepWithinOctave` (C=0, D=1, … B=6). This is the most widely adopted standard for interchange. Our `d` system below is directly equivalent to this formula.

### LilyPond
**Docs:** https://lilypond.org/doc/v2.24/Documentation/internals/staff-symbol-referencer

LilyPond uses a "staff position" that is 0 at the center line of each staff and increases by 1 per half-step (line or space) upward — making the middle line = 0. Each staff has its own independent coordinate space, similar to the split-`staffPos` approach below. Cross-staff beaming and grand staff layout are handled by its engraving engine as special cases.

---

## Our Implementations

### System A — `staffPos` (Flashcard, `NoteInfo.js` + `StaffRenderer.js`)

Two independent coordinate spaces, one per clef:

```
Treble: staffPos 0 = E4 (bottom treble line), +1 per diatonic step up
Bass:   staffPos 0 = G2 (bottom bass line),   +1 per diatonic step up
```

Canvas Y formula: `Y = bottomLineY - staffPos × 10`

Each clef resets to zero independently. A note's `staffPos` number says nothing about where it sits relative to the other clef. Middle C (C4) has `staffPos = -2` in treble and `staffPos = 10` in bass — two different numbers for the same pitch.

**Where used:** `src/core/NoteInfo.js`, `src/flashcard/StaffRenderer.js`, `src/flashcard/FlashcardGame.js`, and all OMR debug output / test fixture JSON.

**Similar to:** LilyPond's per-staff coordinate space (though LilyPond centers at the middle line rather than the bottom).

### System B — `d` (Rhythm, `StaffHighway.js`)

One unified number line spanning both clefs:

```
d = octave × 7 + diatonicStepWithinOctave   (C=0, D=1, … B=6)

E4 = d 30    (treble bottom line)
G2 = d 18    (bass bottom line)
C4 = d 28    (middle C — same number whether approached from treble or bass)
```

Canvas Y formula: `Y = 124 - (d - 30) × 8`

Any note — regardless of clef — has exactly one `d` value. Middle C is always 28. Cross-staff relationships are implicit in the numbers.

**Where used:** `src/rhythm/StaffHighway.js`

**Equivalent to:** The MusicXML diatonic position formula and OSMD's internal layout coordinate.

### System C — `d` (OMR, `PitchMapper.js`)

Independently implements the same unified `d` system:

```js
const TREBLE_BASE_DIATONIC = 4 * 7 + 2; // E4 = 30
const BASS_BASE_DIATONIC   = 2 * 7 + 4; // G2 = 18
```

Note Y positions from the image are converted to `d` by measuring pixel distance from the known staff baseline, dividing by the detected staff space size (pixels per diatonic step), and rounding to the nearest integer. This `d` value is then used to compute the MIDI note number.

**Where used:** `src/sheet2midi/PitchMapper.js`

---

## Current State and Inconsistency

Two of three systems use the unified `d` approach (StaffHighway, PitchMapper). The flashcard system (`NoteInfo.js`, `StaffRenderer.js`) uses the split `staffPos` approach and is the outlier.

The conversion between systems is trivial:
```
d = staffPos + 30    (treble notes)
d = staffPos + 18    (bass notes)
```

The flashcard renderer was built before bass clef support was added. It now renders both treble and bass clef (as of early 2026), but still uses the split coordinate system internally.

---

## Intended Comparison

Before deciding whether to unify to `d` everywhere, the following questions are worth researching against the external implementations listed above:

- Does VexFlow or OSMD expose any benefit to per-staff coordinate spaces (e.g. for layout reflow, system breaks) that would apply to this app?
- LilyPond centers its staff coordinate at the middle line (0 = B4 in treble). Is there a rendering advantage to centering vs. bottom-anchoring?
- MusicXML's `d` formula is `octave × 7 + step` — identical to ours. Does their choice of C0=0 as the absolute anchor (vs. E4=30 as a relative anchor) matter for any computation we do?

The working hypothesis is: **unify to `d`** — rename `staffPos` in `NoteInfo.js` to `d`, update `StaffRenderer.js` to use it, and keep the pixel-scaling math local to each renderer. This aligns with MusicXML, OSMD, and our own OMR and rhythm implementations.
