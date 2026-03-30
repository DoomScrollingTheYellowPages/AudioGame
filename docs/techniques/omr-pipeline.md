# OMR Pipeline — Technique Reference

## The Problem

Given an image of sheet music, produce accurate MIDI output: correct pitches, correct durations, correct ordering. This document compares our pipeline against production OMR engines and mature renderers to identify gaps and build a roadmap to accurate detection.

---

## Our Pipeline (Current State)

### Stage Map

| Stage | Module | Algorithm | What It Does |
|-------|--------|-----------|-------------|
| 1 | `ImageProcessor` | Otsu / Sauvola adaptive binarization | Load image, convert to grayscale, binarize (auto-selects method based on illumination uniformity) |
| 2 | `OMREngine` | Ink-density grid (16x16) | Crop whitespace borders |
| 3 | `SkewCorrector` | Hough transform (Sobel-Y edges, +/-15 deg) | Detect and correct page rotation via bilinear interpolation |
| 4 | `StaffAnalyzer` | Horizontal projection + run-length | Detect staff line rows, estimate staffSpace and lineThickness |
| 5 | `StaffAnalyzer` | Connectivity-aware removal | Remove staff lines while preserving noteheads/stems that intersect them |
| 6 | `ComponentLabeler` | Two-pass connected-component labeling (Union-Find) | Segment foreground into components, extract features (bbox, centroid, area, fillRatio, aspectRatio, holes) |
| 7 | `SymbolClassifier` | 32 hand-tuned heuristic rules + NCC template matching | Classify each component as a symbol type (notehead, rest, clef, accidental, beam, barline, etc.) |
| 8 | `PitchMapper` | Y-position quantization + clef detection (NCC) + key sig + accidental pairing | Map noteheads to MIDI pitches |
| 9 | `DurationMapper` | Stem/beam/flag/dot proximity attachment | Assign note durations from visual context |
| 10 | `GrammarValidator` | Deduplication, measure beat-sum checks, auto-correction | Enforce musical grammar rules |
| 11 | `OMREngine` + `MidiWriter` | Grand staff assembly + Format 0/1 MIDI | Generate final MIDI output |

### Critical Thresholds (Hardcoded)

These are the magic numbers that control pipeline behavior. Each is relative to `staffSpace` (the detected pixel distance between adjacent staff lines):

**Binarization:** Sauvola K=0.5, R=128, window=15px. Auto-switches from Otsu when quadrant illumination differs by >30.

**Staff Detection:** Line = row with >= 30% width black pixels. Lines group when gap < 1.8x staffSpace. Accepts 4-line groups if spacing is consistent (+/-2px).

**Symbol Classification:** All thresholds relative to staffSpace:
- Filled notehead: AR 0.7-2.5, fill >0.55, width 0.4-2.0ss, height 0.3-1.8ss, 0 holes
- Open notehead: AR 0.7-2.5, fill 0.25-0.75, width 0.6-2.0ss, height 0.5-1.5ss, >=1 hole
- Treble clef: height >=3.0ss, width 0.8-3.5ss, AR 0.15-0.65, >=1 hole
- Sharp: height >=0.08ss (beam), fill <=0.70
- Dot: AR 0.7-1.4, fill >0.7, width 0.15-0.5ss, height 0.15-0.5ss

**Pitch Mapping:** NCC clef template threshold 0.25. Key sig region: 6.0ss from clef. Accidental attach: 1.5ss.

**Duration:** Stem attach: 1.5ss. Beam attach: 0.8ss. Flag attach: 1.2ss. Dot attach: 2.0ss horizontal, 1.0ss vertical.

**Grammar:** Dedup: 1.0ss. Chord grouping: 0.8ss. Beat tolerance: 0.01 beats.

### Known Limitations

1. **No ML** — all classification is heuristic rules. Accuracy degrades on non-standard fonts, sizes, or layouts.
2. **Treble and bass clef only** — no alto, tenor, percussion, or tablature.
3. **No tie/slur detection** — completely absent.
4. **No tuplet detection** — triplets and other irregular groupings ignored.
5. **No grace note detection** — small notes treated as regular or discarded.
6. **No multi-voice** — single voice per staff assumed.
7. **No lyric/text handling** — text below staves may be misclassified as symbols.
8. **No rest detection beyond basic shapes** — complex rest patterns may fail.
9. **Basic duration model** — counts beams/flags but doesn't verify rhythmic consistency per beam group.
10. **Fragile to image quality** — phone photos, low DPI, bleed-through cause failures.

---

## External References: How Production Systems Do It

### Audiveris — The Leading Open-Source OMR Engine

**Repo:** https://github.com/Audiveris/audiveris
**Language:** Java
**License:** AGPL-3.0
**Output:** MusicXML 4.0 (primary), `.omr` project files (intermediate), MIDI (derived)
**Handbook:** https://audiveris.github.io/audiveris/_pages/handbook/

#### Hybrid Recognition Approach

Audiveris uses different techniques per symbol type — not one algorithm for everything:
- **Staff lines:** Custom ad-hoc method (projection + run-length)
- **Beams:** Image morphological closing
- **Note heads:** Template matching
- **All other fixed-size symbols (clefs, rests, accidentals, time sigs):** CNN (DL4J-based)
- **Text (titles, lyrics, dynamics):** External OCR (Tesseract)

This is the key architectural insight: a single approach can't handle all symbol types. Our pipeline currently uses heuristic rules for everything — the production approach is to match the algorithm to the symbol type.

#### The 20-Step Pipeline

Each sheet is processed independently through a pipeline of 20 sequential steps:

| Step | What It Does |
|------|-------------|
| **LOAD** | Load the sheet picture (gray) from input file |
| **BINARY** | Binarize to black/white — same approach as us (thresholding) |
| **SCALE** | Compute line thickness, interline distance, beam thickness — our `staffSpace` equivalent |
| **GRID** | Retrieve staff lines, barlines, systems, and parts — builds the structural skeleton |
| **HEADERS** | Retrieve Clef-Key-Time signature from each system header |
| **STEM_SEEDS** | Retrieve stem thickness and candidate seed positions for stems |
| **BEAMS** | Retrieve beams via morphological closing — finds thick horizontal/diagonal ink strokes |
| **LEDGERS** | Retrieve ledger lines — short horizontal strokes beyond staff extremes |
| **HEADS** | Retrieve note heads and whole notes via template matching + CNN |
| **STEMS** | Build stems connected to heads and beams |
| **REDUCTION** | **Critical step** — combine heads+stems+beams into notes; resolve conflicts via SIG |
| **CUE_BEAMS** | Retrieve beams for cue/grace notes |
| **TEXTS** | Retrieve and classify all text (OCR) — titles, part names, lyrics, dynamics |
| **MEASURES** | Detect measure boundaries using barlines |
| **CHORDS** | Build chords from co-located note heads |
| **CURVES** | Detect slurs, ties, and crescendo/decrescendo hairpins |
| **SYMBOLS** | Classify remaining symbols (dots, dynamics, fermatas, ornaments, etc.) |
| **LINKS** | Build relationships between all Inter instances; second SIG reduction |
| **RHYTHMS** | Assign durations; validate rhythmic consistency per measure; resolve tuplets |
| **PAGE** | Aggregate page-level data; finalize score structure |

#### The SIG (Symbol Interpretation Graph)

This is Audiveris's core architectural idea and the most important concept to understand. Every detected symbol is an **Inter** (interpretation). The SIG is a graph where:

- **Vertices = Inter instances** — each is a candidate interpretation of a glyph with a confidence grade (0.0–1.0)
- **Edges = Relations** — connections between Inters, of two types:
  - **Support** — two Inters reinforce each other (e.g., a filled notehead + nearby vertical stem → `HeadStemRelation`). Support raises both Inters' contextual grades.
  - **Exclusion** — two Inters cannot coexist (e.g., two different classifications of the same pixels). The worse-scoring one is eliminated.

There is one SIG per system. At the **REDUCTION** step, the SIG is reduced: all exclusions are resolved by eliminating the lower-grade Inter until no conflicting interpretations remain. The survivors at this point (the "reliable notes") are locked in and never reconsidered by later steps.

A second reduction happens at **LINKS** after all other symbols are attached. This is where cross-symbol relationships (slur endpoints, accidental-to-note pairing, dot-to-note pairing) are validated and weak Inters are pruned.

**Why this matters for us:** Our `GrammarValidator` does a crude version of this — it deduplicates spatially adjacent symbols and checks beat sums. The SIG approach is much more principled: every symbol has a confidence score, and the graph structure explicitly models which symbols support or exclude each other. A symbol that appears weak in isolation might survive because it has strong supporting evidence from adjacent symbols, or be eliminated despite a decent individual score because it conflicts with a better-supported interpretation.

#### Known Issues from GitHub

The most-discussed open issues reveal systematic failure modes:

| Issue | Problem | Relevance |
|-------|---------|-----------|
| **#279** | Multi-voice and tuplet assignment — voice algorithm fails on complex polyphony | We don't attempt multi-voice at all |
| **#336** | Unassignable tuplets — common notation pattern breaks rhythm parser | We have no tuplet detection |
| **#281** | Grace note handling — size detection unreliable | We have no grace note detection |
| **#50** | Noteheads that stick together — template matching fails on dense passages | Our CCL has same problem |
| **#44** | Chord recognition and wrong MusicXML export | We detect chords but only by x-proximity |
| **#162** | High-quality PDFs fail to process — over-sharpened edges cause binarization failure | Our binarization has similar fragility |
| **#356** | Voice priority in rhythm assignment — ambiguous voice ordering | We ignore voices entirely |

**Pattern:** Even a production Java engine with a neural network struggles with tuplets, grace notes, multi-voice, and touching noteheads. These are fundamental hard problems, not implementation gaps.

---

### VexFlow — What a Mature Renderer Expects

**Repo:** https://github.com/0xfe/vexflow (V4) / https://github.com/vexflow/vexflow (V5)
**Full analysis:** `docs/techniques/vexflow-architecture.md`

VexFlow is a renderer, not a recognizer — but understanding what it expects as input tells us what our OMR needs to produce.

#### Data Model Requirements

| What VexFlow needs | Format | Our current output | Gap? |
|---|---|---|---|
| Pitch | Key string: `"C/4"`, `"F#/5"` | MIDI note number | **Yes** — need enharmonic spelling |
| Duration | Code: `"q"`, `"8"`, `"16d"` | Beats as float (1, 0.5, 0.25) | Minor — simple mapping |
| Clef | String: `"treble"`, `"bass"` | Detected per staff | OK |
| Key signature | String: `"G"`, `"Bb"` | Set of sharp/flat pitch names | Minor — need circle-of-fifths mapping |
| Time signature | String: `"4/4"`, `"3/8"` | User-provided | OK (but not detected from image) |
| Voice assignment | Voice grouping | Not implemented | **Yes** — needed for multi-voice |
| Measure boundaries | Barline positions | Detected | OK |
| Beam groups | Note arrays | Not explicitly grouped | Minor — VexFlow can recompute from durations |

#### Key Architectural Insights

1. **Enharmonic spelling is essential.** MIDI number 61 could be C# or Db — they sit on different staff lines. Our OMR knows the diatonic staff position (we compute `d`), so we can derive the correct spelling. This is not a gap in detection but in output formatting.

2. **Per-stave coordinates.** VexFlow uses independent coordinate spaces per stave (line 0=top, line 4=bottom), with a clef-dependent `line_shift`. No unified grand-staff coordinate. Their approach matches our flashcard system; our rhythm/OMR system's unified `d` is actually more general.

3. **The Formatter handles layout.** If we ever render OMR results back as notation, we don't need to compute spacing — just feed VexFlow correct structured data and let it format.

4. **Cross-staff chords are unsupported** (Issue #434, open since 2016). Even VexFlow can't handle this cleanly, so we shouldn't prioritize it.

5. **Known beam issues.** Mixed subdivisions in beam groups (Issue #1589), wide-spacing slope errors (Issue #485). If we render with VexFlow, we'll hit these too.

#### Circular Dependencies in Layout

VexFlow's formatter has a known circular dependency (Issue #522): modifier positions depend on stem tips, which depend on beam slopes, which depend on X positions, which depend on modifier widths. They work around this with a fixed processing order. This is relevant if we ever build our own renderer.

---

### OpenSheetMusicDisplay (OSMD) — MusicXML Rendering Pipeline

**Repo:** https://github.com/opensheetmusicdisplay/opensheetmusicdisplay
**Language:** TypeScript
**Built on:** VexFlow (rendering layer)
**Output:** SVG or Canvas (browser + Node.js)
**By:** PhonicScore, Vienna

OSMD is "the missing link between MusicXML and VexFlow" — it parses MusicXML into an internal data model, computes layout, then delegates pixel rendering to VexFlow.

#### Three-Layer Architecture

```
MusicXML input
      ↓
MusicSheetReader  → MusicSheet (logical model)
      ↓
VexFlowMusicSheetCalculator  → GraphicalMusicSheet (layout model)
      ↓
VexFlowMusicSheetDrawer  → SVG/Canvas output (via VexFlow)
```

#### Stage 1: Parsing (MusicSheetReader)

Entry point: `createMusicSheet(xmlRoot, path)`

1. Extract global attributes (measure widths, default spacing)
2. Read sheet metadata — title, composer, copyright
3. Parse `<part-list>` to identify instruments/parts
4. Create one `InstrumentReader` per part
5. Iterate measures sequentially — each InstrumentReader processes its XML measures in order
6. Build `SourceMeasure` objects → `SourceStaffEntry` → `VoiceEntry` hierarchy
7. Handle tied notes (track ties across measure boundaries)
8. `checkIfRhythmInstructionsAreSetAndEqual()` — harmonize time signatures across staves
9. `setSourceMeasureDuration()` — reconcile durations with active time signature

**Output:** `MusicSheet` — a complete logical model of the score with measures, parts, voices, and notes.

#### Stage 2: Layout (VexFlowMusicSheetCalculator)

Entry point: `updateGraphic()` → `VexFlowMusicSheetCalculator`

1. `calculateMeasureXLayout()` — formats VexFlow voices, calculates minimum staff entry widths via `formatter.preCalculateMinTotalWidth()`
2. `formatMeasures()` — finalizes beam rendering across measures
3. `calculateElongationFactorFromStaffEntries()` — expands measure widths for lyrics/chord symbols (capped by `MaximumLyricsElongationFactor`)
4. `joinVoices()` — voices on the same staff share a VexFlow formatter context for alignment
5. `VexFlowStaffEntry.calculateXPosition()` — repositions staff entries post-formatting
6. Handles pickup (anacrusis) measures: scale proportionally by `Duration.RealValue / ActiveTimeSignature.RealValue`

**Output:** `GraphicalMusicSheet` — every note has computed X/Y pixel positions.

#### Stage 3: Rendering (VexFlowMusicSheetDrawer)

Iterates the `GraphicalMusicSheet` and calls VexFlow draw methods per stave, voice, beam, tie, and dynamic. SVG or Canvas backend is swapped at this layer only.

#### What OSMD Tells Us About Our Pipeline

OSMD separates concerns cleanly into three independent layers. Our OMR pipeline conflates some of these — pitch mapping, duration assignment, and grammar validation all happen in sequence but without a clean intermediate data model. If we ever want to render OMR output as notation, building a clean `LogicalNote` → `GraphicalNote` separation would make that tractable.

**Key gap relevant to us:** OSMD handles multi-voice via VoiceEntry objects — each beat position in a measure can have multiple voices, each with independent notes, stems, and beams. Our pipeline assumes one voice per staff. Multi-voice is where OSMD's MusicXML parsing is most complex and where most real piano music lives.

---

### oemer — Deep Learning Hybrid OMR

**Repo:** https://github.com/BreezeWhite/oemer
**Full analysis:** `docs/techniques/omr-landscape.md`

A 9-stage hybrid pipeline: two UNet segmentation models for staff/symbol separation, three SVM classifiers for symbol identification, then rule-based rhythm analysis and MusicXML construction.

**Key insight for us:** oemer replaces binarization + staff detection with learned segmentation but still uses classical rules for rhythm and grouping. The "last mile" (assembling symbols into valid music) is rule-based even in ML systems.

**Limitations:** Typeset only, no handwritten. 3-5 min/page with GPU. No published accuracy benchmarks. Not viable for browser deployment.

---

### The Academic Landscape

**Full analysis:** `docs/techniques/omr-landscape.md`

#### The Definitive Survey

Calvo-Zaragoza, Hajic Jr., Pacha. "Understanding Optical Music Recognition." ACM Computing Surveys, 2020.
**arXiv:** https://arxiv.org/abs/1908.03608

Defines the canonical OMR pipeline:
1. Image preprocessing
2. Staff detection and removal
3. Music symbol detection
4. Music symbol classification
5. Notation reconstruction

Our pipeline follows this structure exactly. The survey's key finding: step 5 (reconstruction) is where most systems fail, because assembling detected symbols into valid musical semantics requires understanding relationships that visual detection alone can't provide.

#### State of the Art (2024-2025)

**Sheet Music Transformer++ (SMT++)** — arXiv 2405.12105
Autoregressive transformer, full-page polyphonic OMR. Best benchmark results. Not browser-deployable.

**Key datasets:**
- DeepScores V2: 151M symbol instances, 135 classes, oriented bounding boxes
- MUSCIMA++: 91,255 symbols with pixel masks AND a notation graph (directed edges between primitives)
- PrIMuS: 87K monophonic incipits for end-to-end training

**For our project:** Deep learning requires Python backends. We are browser-only, zero-dependency. Classical approaches are our only option. However, understanding what ML systems get right tells us where to focus our rule tuning.

---

## Universal Failure Modes

These problems affect every OMR system ever built, including ours:

### Tier 1 — Fundamental (affect pitch/rhythm accuracy)

| Problem | Why It's Hard | Our Status |
|---------|-------------|-----------|
| **Overlapping/touching symbols** | After staff removal, stems+noteheads+beams may merge into single components | Partial — `_splitNoteStems()` handles some cases |
| **Slur vs. tie** | Visually identical curves; requires knowing connected pitches first | **Not implemented** |
| **Multi-voice on single staff** | Opposite-stem notes at same x-position; voice assignment is a grouping problem | **Not implemented** |
| **Tuplets** | May lack visible number/bracket; implicit triplets common | **Not implemented** |
| **Accidental scope** | Key sig accidentals are implicit; courtesy accidentals add visual noise | Partial — key sig detected, inline accidentals paired |

### Tier 2 — Quality (affect robustness)

| Problem | Why It's Hard | Our Status |
|---------|-------------|-----------|
| **Image quality** | Phone photos, low DPI, bleed-through, uneven lighting | Sauvola helps; Hough deskew helps; but fragile |
| **Dotted note vs. staccato** | Position differs by a few pixels | Basic dot detection by proximity |
| **Grace notes** | Small noteheads; size variation | **Not implemented** |
| **Key/time sig changes mid-line** | Dense accidental region with cancellation naturals | **Not implemented** |
| **Complex page layout** | Lyrics, chord symbols, multiple systems, headers | No layout analysis |

### Tier 3 — Advanced (nice to have)

| Problem | Our Status |
|---------|-----------|
| Cross-staff beaming | Not implemented |
| Ornaments/trills | Not implemented |
| Dynamics/articulations | Not implemented |
| Repeat signs/codas/segno | Not implemented |
| Second endings (volta brackets) | Not implemented |

---

## Gap Analysis: Our Pipeline vs. Production Systems

### What We Do Well

1. **Staff detection** — horizontal projection + run-length is the standard classical approach. Our implementation works for clean typeset scores.
2. **Clef detection** — NCC template matching is more robust than pure heuristic classification. This is a good approach.
3. **Coordinate system** — our unified `d` system (E4=30, G2=18) matches the MusicXML standard diatonic formula. Two of three renderers already use it.
4. **Grand staff pairing** — brace detection + gap heuristic + fallback cascade is reasonable.
5. **Key signature detection** — counting accidentals in the clef-to-first-note region with circle-of-fifths mapping.

### What We're Missing (Priority Order)

**P0 — Required for basic accuracy:**
1. **Better symbol classification** — 32 heuristic rules are fragile. Audiveris uses a neural network for non-notehead symbols. We can't use ML, but we can:
   - Add more test fixtures and tune thresholds systematically
   - Use distance-transform-based notehead detection more aggressively
   - Add shape context or Hu moment features to supplement AR/fill/size
2. **Relationship building** — We attach stems/beams/dots by proximity, but don't build a proper graph. Audiveris builds an explicit SIG (Symbol Interpretation Graph) where every symbol is a node and relationships are edges. We should formalize our attachment logic into a graph structure.
3. **Rhythm verification** — Our grammar validator checks measure totals but doesn't verify beam group consistency. We should check that beamed groups sum to the expected beat subdivision.

**P1 — Required for real-world scores:**
4. **Tie/slur detection** — detect curved lines between noteheads. Ties connect same-pitch notes (extend duration); slurs connect different pitches (phrasing only, no MIDI effect). For MIDI output, only ties matter.
5. **Multi-voice detection** — when two voices share a staff, stems point opposite directions. Detect stem-direction conflicts at the same x-position as a voice-split signal.
6. **Tuplet detection** — look for the number "3" (or bracket) above/below beam groups. Check if a beam group's beat total doesn't match standard subdivisions.
7. **Rest detection improvement** — our classifier has basic rest shapes but they're undertested.

**P2 — Quality improvements:**
8. **Time signature detection** — currently user-provided. Detect from the image by looking for stacked numerals after the key signature.
9. **Grace note detection** — small noteheads (significantly below staffSpace size) near regular notes.
10. **Augmentation dot vs. staccato disambiguation** — dots to the right of noteheads at line/space height = augmentation. Dots directly above/below = staccato.
11. **Second pass reconciliation** — after initial pitch/rhythm assignment, re-examine low-confidence symbols using musical context (e.g., a note that makes the measure too long might actually be a rest).

**P3 — Advanced features:**
12. **Cross-staff beaming**
13. **Mid-line clef/key/time changes**
14. **Dynamics, articulations, ornaments** (not needed for MIDI pitch/rhythm, but nice for MusicXML export)
15. **Multi-system page layout detection** (detecting where one system ends and the next begins)

---

## Roadmap: Path to Accurate Detection

### Phase 1 — Solidify Foundations (Current)
- Expand test fixtures to cover all validated images
- Systematic threshold tuning via fixture-driven testing
- Fix known detection failures (C5 in CMajorScale, beam threshold issues)
- Unify coordinate system to `d` everywhere

### Phase 2 — Relationship Graph
- Formalize symbol relationships into an explicit graph (stem→notehead, beam→stem, dot→note, accidental→note)
- Use graph structure for rhythm verification (beam group beat sums)
- Improve deduplication using graph connectivity

### Phase 3 — Ties and Multi-Voice
- Detect curved lines (connected component with high aspect ratio, low fill, spanning multiple notes)
- Classify as tie (same pitch endpoints) vs. slur (different pitch endpoints)
- Detect voice splits via stem direction analysis
- Assign notes to voices

### Phase 4 — Robust Detection
- Tuplet detection (number/bracket search + beat-sum anomaly)
- Time signature detection from image
- Grace note detection (sub-staffSpace noteheads)
- Improved rest classification
- Better image preprocessing for phone photos

### Phase 5 — Renderer Integration
- VexFlow or OSMD integration for rendering OMR results as notation
- Enharmonic spelling from diatonic position
- Round-trip: image → OMR → render → visual comparison

---

## Key References

| Resource | URL | Relevance |
|----------|-----|-----------|
| Audiveris | https://github.com/Audiveris/audiveris | Production OMR pipeline reference |
| VexFlow | https://github.com/vexflow/vexflow | Renderer data model requirements |
| OSMD | https://github.com/opensheetmusicdisplay/opensheetmusicdisplay | MusicXML rendering reference |
| oemer | https://github.com/BreezeWhite/oemer | Hybrid ML/classical OMR |
| SMT++ | https://github.com/antoniorv6/SMT | State-of-the-art transformer OMR |
| MUSCIMA++ | https://github.com/OMR-Research/muscima-pp | Notation graph dataset |
| DeepScores V2 | https://zenodo.org/records/4012193 | Large-scale detection benchmark |
| OMR Survey | https://arxiv.org/abs/1908.03608 | Definitive field overview |
| OMR Datasets | https://github.com/apacha/OMR-Datasets | Dataset catalog |
| MusicXML 4.0 | https://www.w3.org/2021/06/musicxml40/ | Output format spec |
| OMR Eval Framework | https://github.com/ufal/omreval | Standardized evaluation |

---

*This document will be updated when OSMD and Audiveris research completes.*
