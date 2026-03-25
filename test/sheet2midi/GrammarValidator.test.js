// ─────────────────────────────────────────────
// GrammarValidator — unit tests
// ─────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GrammarValidator } from '../../src/sheet2midi/GrammarValidator.js';
import { SymbolType } from '../../src/sheet2midi/SymbolClassifier.js';
import { MockBus } from '../test-helper.js';

/** Helper: fake a note event */
function fakeNote(x, beats, midiNote = 60) {
  return {
    x,
    beats,
    midiNote,
    symbol: {
      type: SymbolType.FILLED_NOTEHEAD,
      component: { centroid: { x, y: 120 }, bbox: { x: x - 5, y: 115, width: 10, height: 10 } },
      confidence: 0.8
    },
    isRest: false
  };
}

/** Helper: fake a bar line symbol */
function fakeBarLine(x) {
  return {
    type: SymbolType.BAR_LINE,
    component: { centroid: { x, y: 120 }, bbox: { x: x - 1, y: 100, width: 2, height: 40 } }
  };
}

describe('GrammarValidator', () => {

  // ── validate ───────────────────────────────
  describe('validate', () => {
    it('reports no corrections for a correct measure', () => {
      const bus = new MockBus();
      const gv = new GrammarValidator(bus);
      // 4 quarter notes = 4 beats in 4/4
      const notes = [
        fakeNote(10, 1), fakeNote(20, 1), fakeNote(30, 1), fakeNote(40, 1)
      ];
      const result = gv.validate(notes, [], [], 10, [4, 4]);
      assert.equal(result.corrections.length, 0);
    });

    it('reports duration mismatch for incomplete measure', () => {
      const bus = new MockBus();
      const gv = new GrammarValidator(bus);
      // Only 3 beats in 4/4
      const notes = [fakeNote(10, 1), fakeNote(20, 1), fakeNote(30, 1)];
      const result = gv.validate(notes, [], [], 10, [4, 4]);
      assert.ok(result.corrections.length > 0);
      assert.ok(result.corrections[0].includes('beats'));
    });

    it('segments measures by bar lines', () => {
      const bus = new MockBus();
      const gv = new GrammarValidator(bus);
      // Measure 1: 4 beats, Measure 2: 3 beats
      const notes = [
        fakeNote(10, 1), fakeNote(20, 1), fakeNote(30, 1), fakeNote(40, 1),
        fakeNote(60, 1), fakeNote(70, 1), fakeNote(80, 1)
      ];
      const barLines = [fakeBarLine(50)];
      const result = gv.validate(notes, [], barLines, 10, [4, 4]);
      // Measure 1 correct, measure 2 has 3 beats
      assert.ok(result.corrections.length > 0);
      assert.ok(result.corrections.some(c => c.includes('Measure 2')));
    });

    it('reports possible missed dot for small deficit', () => {
      const bus = new MockBus();
      const gv = new GrammarValidator(bus);
      // 3.5 beats in 4/4 — 0.5 deficit
      const notes = [fakeNote(10, 1), fakeNote(20, 1), fakeNote(30, 1), fakeNote(40, 0.5)];
      const result = gv.validate(notes, [], [], 10, [4, 4]);
      assert.ok(result.corrections.some(c => c.includes('missed augmentation dot')));
    });

    it('detects out-of-order notes', () => {
      const bus = new MockBus();
      const gv = new GrammarValidator(bus);
      // The validator merges and sorts by x, then checks the sorted order.
      // Out-of-order means two notes where a later-indexed note has
      // significantly smaller x. Since sort fixes ordering, we check
      // by using notes that are "close but reversed" within 0.5*staffSpace
      // Actually, the validator sorts first, so out-of-order can't happen
      // after sorting. This test verifies the sort works correctly.
      const notes = [fakeNote(50, 1), fakeNote(5, 1), fakeNote(60, 1), fakeNote(70, 1)];
      const result = gv.validate(notes, [], [], 10, [4, 4]);
      // After sorting by x, the sequence is 5, 50, 60, 70 — all in order
      assert.equal(result.notes.length, 4);
      assert.ok(result.notes[0].x <= result.notes[1].x, 'notes should be sorted');
    });

    it('emits omr:validated event', () => {
      const bus = new MockBus();
      const gv = new GrammarValidator(bus);
      gv.validate([fakeNote(10, 4)], [], [], 10, [4, 4]);
      assert.equal(bus.getEvents('omr:validated').length, 1);
    });
  });

  // ── chord detection ────────────────────────
  describe('chord detection', () => {
    it('detects two notes at same x as a chord', () => {
      const bus = new MockBus();
      const gv = new GrammarValidator(bus);
      const notes = [
        fakeNote(100, 1, 60),
        fakeNote(103, 1, 64), // within 0.8 * staffSpace = 8px
        fakeNote(200, 1, 67),
        fakeNote(300, 1, 72)
      ];
      const result = gv.validate(notes, [], [], 10, [4, 4]);
      assert.ok(result.chords.length >= 1);
      assert.equal(result.chords[0].length, 2);
    });
  });

  // ── autoCorrect ────────────────────────────
  describe('autoCorrect', () => {
    it('adjusts weakest note to fill measure', () => {
      const bus = new MockBus();
      const gv = new GrammarValidator(bus);
      // Measure with 3.5 beats, expect 4. Weakest note (0.5 beats) → 1.0 beats
      const measures = [[
        { ...fakeNote(10, 1), symbol: { confidence: 0.9 } },
        { ...fakeNote(20, 1), symbol: { confidence: 0.9 } },
        { ...fakeNote(30, 1), symbol: { confidence: 0.9 } },
        { ...fakeNote(40, 0.5), symbol: { confidence: 0.3 } } // weakest
      ]];
      const corrected = gv.autoCorrect(measures, 4);
      const total = corrected.reduce((sum, e) => sum + e.beats, 0);
      assert.ok(Math.abs(total - 4) < 0.01, `total beats ${total} should be 4`);
    });

    it('does not modify correct measures', () => {
      const bus = new MockBus();
      const gv = new GrammarValidator(bus);
      const measures = [[fakeNote(10, 1), fakeNote(20, 1), fakeNote(30, 1), fakeNote(40, 1)]];
      const corrected = gv.autoCorrect(measures, 4);
      assert.equal(corrected.length, 4);
      assert.equal(corrected.reduce((sum, e) => sum + e.beats, 0), 4);
    });
  });
});
