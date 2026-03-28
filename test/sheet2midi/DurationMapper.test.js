// ─────────────────────────────────────────────
// DurationMapper — unit tests
// ─────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DurationMapper } from '../../src/sheet2midi/DurationMapper.js';
import { SymbolType } from '../../src/sheet2midi/SymbolClassifier.js';
import { MockBus } from '../test-helper.js';

/** Helper: create a fake symbol with a component */
function fakeSymbol(type, cx, cy, w = 10, h = 10) {
  return {
    type,
    component: {
      centroid: { x: cx, y: cy },
      bbox: { x: cx - w / 2, y: cy - h / 2, width: w, height: h }
    }
  };
}

/** Helper: create a note object */
function fakeNote(type, cx, cy) {
  return {
    symbol: fakeSymbol(type, cx, cy),
    staffPos: 0,
    noteName: 'C',
    octave: 4,
    midiNote: 60
  };
}

describe('DurationMapper', () => {

  // ── assignDurations ────────────────────────
  describe('assignDurations', () => {
    it('assigns 4 beats to a whole note', () => {
      const bus = new MockBus();
      const dm = new DurationMapper(bus);
      const notes = [fakeNote(SymbolType.WHOLE_NOTE, 100, 120)];
      const result = dm.assignDurations(notes, [], 10);
      assert.equal(result[0].beats, 4);
      assert.equal(result[0].durationType, 'whole');
    });

    it('assigns 2 beats to a half note (open notehead + stem)', () => {
      const bus = new MockBus();
      const dm = new DurationMapper(bus);
      const notes = [fakeNote(SymbolType.OPEN_NOTEHEAD, 100, 120)];
      const stem = fakeSymbol(SymbolType.STEM, 105, 100, 3, 30);
      const allSymbols = [notes[0].symbol, stem];
      const result = dm.assignDurations(notes, allSymbols, 10);
      assert.equal(result[0].beats, 2);
      assert.equal(result[0].durationType, 'half');
    });

    it('assigns 4 beats to open notehead without stem', () => {
      const bus = new MockBus();
      const dm = new DurationMapper(bus);
      const notes = [fakeNote(SymbolType.OPEN_NOTEHEAD, 100, 120)];
      const result = dm.assignDurations(notes, [], 10);
      assert.equal(result[0].beats, 4);
      assert.equal(result[0].durationType, 'whole');
    });

    it('assigns 1 beat to a quarter note (filled notehead + stem)', () => {
      const bus = new MockBus();
      const dm = new DurationMapper(bus);
      const notes = [fakeNote(SymbolType.FILLED_NOTEHEAD, 100, 120)];
      const stem = fakeSymbol(SymbolType.STEM, 105, 100, 3, 30);
      const allSymbols = [notes[0].symbol, stem];
      const result = dm.assignDurations(notes, allSymbols, 10);
      assert.equal(result[0].beats, 1);
      assert.equal(result[0].durationType, 'quarter');
    });

    it('assigns 0.5 beats to an eighth note (filled + stem + beam)', () => {
      const bus = new MockBus();
      const dm = new DurationMapper(bus);
      const notes = [fakeNote(SymbolType.FILLED_NOTEHEAD, 100, 130)];
      const stem = fakeSymbol(SymbolType.STEM, 105, 110, 3, 30);
      const beam = fakeSymbol(SymbolType.BEAM, 105, 95, 30, 4);
      const allSymbols = [notes[0].symbol, stem, beam];
      const result = dm.assignDurations(notes, allSymbols, 10);
      assert.equal(result[0].beats, 0.5);
      assert.equal(result[0].durationType, 'eighth');
    });

    it('applies augmentation dot (1.5x)', () => {
      const bus = new MockBus();
      const dm = new DurationMapper(bus);
      const notes = [fakeNote(SymbolType.WHOLE_NOTE, 100, 120)];
      const dot = fakeSymbol(SymbolType.DOT, 115, 120, 3, 3);
      const allSymbols = [notes[0].symbol, dot];
      const result = dm.assignDurations(notes, allSymbols, 10);
      assert.equal(result[0].beats, 6); // 4 * 1.5
      assert.equal(result[0].durationType, 'dotted_whole');
    });
  });

  // ── detectRests ────────────────────────────
  describe('detectRests', () => {
    it('detects a quarter rest', () => {
      const bus = new MockBus();
      const dm = new DurationMapper(bus);
      const symbols = [fakeSymbol(SymbolType.REST_QUARTER, 100, 120)];
      const staffGroups = [[100, 110, 120, 130, 140]];
      const rests = dm.detectRests(symbols, staffGroups, 10);
      assert.equal(rests.length, 1);
      assert.equal(rests[0].beats, 1);
      assert.equal(rests[0].durationType, 'quarter_rest');
    });

    it('detects multiple rest types', () => {
      const bus = new MockBus();
      const dm = new DurationMapper(bus);
      const symbols = [
        fakeSymbol(SymbolType.REST_WHOLE, 50, 120),
        fakeSymbol(SymbolType.REST_HALF, 100, 120),
        fakeSymbol(SymbolType.REST_EIGHTH, 150, 120),
      ];
      const staffGroups = [[100, 110, 120, 130, 140]];
      const rests = dm.detectRests(symbols, staffGroups, 10);
      assert.equal(rests.length, 3);
      assert.equal(rests[0].beats, 4);
      assert.equal(rests[1].beats, 2);
      assert.equal(rests[2].beats, 0.5);
    });

    it('ignores non-rest symbols', () => {
      const bus = new MockBus();
      const dm = new DurationMapper(bus);
      const symbols = [
        fakeSymbol(SymbolType.FILLED_NOTEHEAD, 100, 120),
        fakeSymbol(SymbolType.STEM, 105, 110),
      ];
      const rests = dm.detectRests(symbols, [[100, 110, 120, 130, 140]], 10);
      assert.equal(rests.length, 0);
    });
  });
});
