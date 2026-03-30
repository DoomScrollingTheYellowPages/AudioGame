# Plan: OMR Pipeline Phase 3 — SIG Graph, Pipeline Reordering, Key Sig State

## Phase 1: Symbol Interpretation Graph Core

- [x] Task: Write tests for SIG data structure (Inter node creation, grade assignment, JSON serialisation)
- [x] Task: Implement SIG class — Inter nodes with confidence grades, addInter/removeInter, toJSON
- [x] Task: Write tests for SIG edge types (Support grade propagation, Exclusion conflict resolution)
- [x] Task: Implement Support and Exclusion relations — addSupport/addExclusion, contextual grade recalculation
- [x] Task: Write tests for SIG reduction (eliminate losing Exclusion nodes, preserve Support-linked nodes)
- [x] Task: Implement SIG reduce() — resolve all Exclusion edges by removing lower-grade Inters
- [x] Task: Conductor - User Manual Verification 'SIG Core' (Protocol in workflow.md)

## Phase 2: Pipeline Reordering — Beam and Ledger Pre-Detection

- [x] Task: Write tests for beam pre-detection (morphological closing identifies beam regions, returns labelled beam Inters)
- [x] Task: Implement BeamDetector — morphological closing on binary image, create beam Inter nodes in SIG
- [x] Task: Write tests for ledger pre-detection (horizontal stroke scan beyond staff extremes, returns labelled ledger Inters)
- [x] Task: Implement LedgerDetector — scan for short horizontal strokes at staffSpace intervals beyond staff, create ledger Inter nodes in SIG
- [x] Task: Write tests for priority label integration (CCL components overlapping known beam/ledger regions inherit the early label)
- [x] Task: Integrate beam and ledger pre-detection into OMREngine pipeline — run before CCL, pass priority labels to SymbolClassifier
- [x] Task: Conductor - User Manual Verification 'Pipeline Reordering' (Protocol in workflow.md)

## Phase 3: Key Signature State Tracking and Enharmonic Spelling

- [x] Task: Write tests for enharmonic spelling from diatonic position d (d=30 -> E4, d=28+sharp -> C#4 not Db4)
- [x] Task: Implement enharmonicSpelling(d, sharp) — derive note name + octave from diatonic position
- [x] Task: Write tests for per-measure accidental state map (key sig init, inline accidental update, barline reset)
- [x] Task: Implement KeySigStateMap — initialise from key sig, apply inline accidentals, reset at barlines
- [x] Task: Write tests for PitchMapper integration (notes get correct MIDI + spelling using KeySigStateMap)
- [x] Task: Integrate KeySigStateMap into PitchMapper — replace current accidental pairing with state-tracked approach
- [x] Task: Conductor - User Manual Verification 'Key Sig State Tracking' (Protocol in workflow.md)

## Phase 4: Full Pipeline Integration and SIG Wiring

- [x] Task: Write tests for SymbolClassifier -> SIG migration (all classified symbols become Inter nodes with grades)
- [x] Task: Refactor SymbolClassifier to output Inter nodes into a SIG instead of plain symbol objects
- [x] Task: Write tests for PitchMapper reading from SIG (Inter nodes with support edges to stems, accidentals)
- [x] Task: Refactor PitchMapper to read from SIG — build HeadStemRelation, AccidentalNoteRelation support edges
- [x] Task: Write tests for DurationMapper reading from SIG (stem->beam->flag chains as support edges)
- [x] Task: Refactor DurationMapper to read from SIG — build StemBeamRelation, DotNoteRelation support edges
- [x] Task: Write tests for GrammarValidator operating on SIG (dedup via Exclusion edges, beat-sum on surviving Inters)
- [x] Task: Refactor GrammarValidator to operate on SIG — replace proximity-based dedup with Exclusion resolution
- [x] Task: Run second SIG reduction after all relationships are built
- [x] Task: Conductor - User Manual Verification 'Full Pipeline Integration' (Protocol in workflow.md)

## Phase 5: Regression Validation

- [x] Task: Run full validation suite — all existing fixtures must pass with no regressions
- [x] Task: Verify debug overlay and JSON export still work with SIG-based data
- [x] Task: Verify sheet2midi UI (process, play, download) works end-to-end with no changes
- [x] Task: Conductor - User Manual Verification 'Regression Validation' (Protocol in workflow.md)
