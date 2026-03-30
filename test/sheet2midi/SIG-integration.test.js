// ─────────────────────────────────────────────
// SIG Pipeline Integration — unit tests
// Verifies that SymbolClassifier outputs Inters,
// and downstream stages read from the SIG.
// ─────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SIG } from '../../src/sheet2midi/SIG.js';
import { SymbolType } from '../../src/sheet2midi/SymbolClassifier.js';

describe('SIG Pipeline Integration', () => {

  describe('SymbolClassifier → SIG migration', () => {
    it('classified symbols can be converted to Inter nodes', () => {
      const sig = new SIG();
      const symbols = [
        { type: SymbolType.FILLED_NOTEHEAD, component: { centroid: { x: 100, y: 50 }, bbox: { x: 95, y: 47, width: 12, height: 8 } } },
        { type: SymbolType.STEM, component: { centroid: { x: 106, y: 50 }, bbox: { x: 105, y: 30, width: 2, height: 40 } } }
      ];

      for (const s of symbols) {
        const inter = sig.addInter({
          type: s.type,
          grade: 0.8,
          bbox: s.component.bbox,
          data: { symbol: s }
        });
        s._interId = inter.id;
      }

      assert.equal(sig.getAllInters().length, 2);
      assert.equal(sig.getIntersByType(SymbolType.FILLED_NOTEHEAD).length, 1);
      assert.equal(sig.getIntersByType(SymbolType.STEM).length, 1);
    });

    it('support edges connect noteheads to adjacent stems', () => {
      const sig = new SIG();
      const head = sig.addInter({ type: SymbolType.FILLED_NOTEHEAD, grade: 0.8 });
      const stem = sig.addInter({ type: SymbolType.STEM, grade: 0.6 });
      sig.addSupport(head.id, stem.id);

      // Both should have boosted contextual grades
      assert.ok(sig.contextualGrade(head.id) > 0.8);
      assert.ok(sig.contextualGrade(stem.id) > 0.6);
    });

    it('exclusion edges resolve duplicate classifications', () => {
      const sig = new SIG();
      // Same pixels classified as both filled notehead and whole note
      const filled = sig.addInter({ type: SymbolType.FILLED_NOTEHEAD, grade: 0.85 });
      const whole = sig.addInter({ type: SymbolType.WHOLE_NOTE, grade: 0.3 });
      sig.addExclusion(filled.id, whole.id);
      sig.reduce();

      assert.ok(sig.getInter(filled.id), 'higher-grade inter should survive');
      assert.equal(sig.getInter(whole.id), undefined, 'lower-grade inter should be eliminated');
    });
  });

  describe('SIG → downstream stage compatibility', () => {
    it('Inter nodes can be mapped back to symbol objects', () => {
      const sig = new SIG();
      const originalSymbol = {
        type: SymbolType.FILLED_NOTEHEAD,
        component: { centroid: { x: 100, y: 50 }, bbox: { x: 95, y: 47, width: 12, height: 8 } }
      };

      const inter = sig.addInter({
        type: SymbolType.FILLED_NOTEHEAD,
        grade: 0.8,
        data: { symbol: originalSymbol }
      });

      // Downstream can retrieve the original symbol from the Inter
      const retrieved = sig.getInter(inter.id);
      assert.equal(retrieved.data.symbol, originalSymbol);
      assert.equal(retrieved.data.symbol.type, SymbolType.FILLED_NOTEHEAD);
    });

    it('SIG reduction preserves surviving Inter data', () => {
      const sig = new SIG();
      const sym1 = { type: SymbolType.FILLED_NOTEHEAD, component: { centroid: { x: 100, y: 50 } } };
      const sym2 = { type: SymbolType.WHOLE_NOTE, component: { centroid: { x: 100, y: 50 } } };

      const a = sig.addInter({ type: sym1.type, grade: 0.9, data: { symbol: sym1 } });
      const b = sig.addInter({ type: sym2.type, grade: 0.3, data: { symbol: sym2 } });
      sig.addExclusion(a.id, b.id);
      sig.reduce();

      const survivors = sig.getAllInters();
      assert.equal(survivors.length, 1);
      assert.equal(survivors[0].data.symbol, sym1);
    });
  });

  describe('SIG JSON serialisation in pipeline', () => {
    it('full pipeline SIG serialises with inters and edges', () => {
      const sig = new SIG();
      const head = sig.addInter({ type: 'filled_notehead', grade: 0.9, bbox: { x: 10, y: 20, width: 12, height: 8 } });
      const stem = sig.addInter({ type: 'stem', grade: 0.7, bbox: { x: 22, y: 10, width: 2, height: 30 } });
      const beam = sig.addInter({ type: 'beam', grade: 0.8, bbox: { x: 10, y: 10, width: 40, height: 4 } });
      sig.addSupport(head.id, stem.id);
      sig.addSupport(stem.id, beam.id);

      const json = sig.toJSON();
      assert.equal(json.inters.length, 3);
      assert.equal(json.edges.length, 2);
      // Verify round-trip
      const str = JSON.stringify(json);
      const parsed = JSON.parse(str);
      assert.equal(parsed.inters.length, 3);
      assert.equal(parsed.edges.length, 2);
    });
  });
});
