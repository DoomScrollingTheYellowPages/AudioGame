// ─────────────────────────────────────────────
// SIG (Symbol Interpretation Graph) — unit tests
// ─────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SIG, Inter, RelationType } from '../../src/sheet2midi/SIG.js';

describe('SIG', () => {

  // ── Inter node creation ──────────────────────
  describe('Inter', () => {
    it('creates an Inter with id, type, grade, and bbox', () => {
      const inter = new Inter({
        id: 1,
        type: 'filled_notehead',
        grade: 0.85,
        bbox: { x: 10, y: 20, width: 15, height: 12 }
      });
      assert.equal(inter.id, 1);
      assert.equal(inter.type, 'filled_notehead');
      assert.equal(inter.grade, 0.85);
      assert.deepEqual(inter.bbox, { x: 10, y: 20, width: 15, height: 12 });
    });

    it('defaults grade to 0.0 when not provided', () => {
      const inter = new Inter({ id: 2, type: 'stem' });
      assert.equal(inter.grade, 0.0);
    });

    it('clamps grade to [0.0, 1.0]', () => {
      const hi = new Inter({ id: 1, type: 'stem', grade: 1.5 });
      assert.equal(hi.grade, 1.0);
      const lo = new Inter({ id: 2, type: 'stem', grade: -0.3 });
      assert.equal(lo.grade, 0.0);
    });

    it('stores optional data payload', () => {
      const inter = new Inter({
        id: 1,
        type: 'filled_notehead',
        grade: 0.9,
        data: { staffIndex: 0, diatonic: 30 }
      });
      assert.deepEqual(inter.data, { staffIndex: 0, diatonic: 30 });
    });

    it('serialises to JSON', () => {
      const inter = new Inter({
        id: 1,
        type: 'filled_notehead',
        grade: 0.85,
        bbox: { x: 10, y: 20, width: 15, height: 12 }
      });
      const json = inter.toJSON();
      assert.equal(json.id, 1);
      assert.equal(json.type, 'filled_notehead');
      assert.equal(json.grade, 0.85);
      assert.deepEqual(json.bbox, { x: 10, y: 20, width: 15, height: 12 });
    });
  });

  // ── SIG node management ──────────────────────
  describe('addInter / removeInter', () => {
    it('adds an Inter and retrieves it by id', () => {
      const sig = new SIG();
      const inter = sig.addInter({ type: 'filled_notehead', grade: 0.8 });
      assert.ok(inter.id > 0);
      assert.equal(sig.getInter(inter.id), inter);
    });

    it('assigns unique auto-increment ids', () => {
      const sig = new SIG();
      const a = sig.addInter({ type: 'stem', grade: 0.5 });
      const b = sig.addInter({ type: 'beam', grade: 0.6 });
      assert.notEqual(a.id, b.id);
    });

    it('removes an Inter by id', () => {
      const sig = new SIG();
      const inter = sig.addInter({ type: 'stem', grade: 0.5 });
      sig.removeInter(inter.id);
      assert.equal(sig.getInter(inter.id), undefined);
    });

    it('lists all Inters', () => {
      const sig = new SIG();
      sig.addInter({ type: 'stem', grade: 0.5 });
      sig.addInter({ type: 'beam', grade: 0.6 });
      assert.equal(sig.getAllInters().length, 2);
    });

    it('filters Inters by type', () => {
      const sig = new SIG();
      sig.addInter({ type: 'filled_notehead', grade: 0.9 });
      sig.addInter({ type: 'stem', grade: 0.5 });
      sig.addInter({ type: 'filled_notehead', grade: 0.7 });
      const heads = sig.getIntersByType('filled_notehead');
      assert.equal(heads.length, 2);
    });
  });

  // ── Support relations ──────────────────────
  describe('Support edges', () => {
    it('creates a support edge between two Inters', () => {
      const sig = new SIG();
      const head = sig.addInter({ type: 'filled_notehead', grade: 0.7 });
      const stem = sig.addInter({ type: 'stem', grade: 0.6 });
      sig.addSupport(head.id, stem.id);
      const edges = sig.getEdges(head.id);
      assert.equal(edges.length, 1);
      assert.equal(edges[0].type, RelationType.SUPPORT);
      assert.equal(edges[0].source, head.id);
      assert.equal(edges[0].target, stem.id);
    });

    it('boosts contextual grades of supported Inters', () => {
      const sig = new SIG();
      const head = sig.addInter({ type: 'filled_notehead', grade: 0.7 });
      const stem = sig.addInter({ type: 'stem', grade: 0.6 });
      sig.addSupport(head.id, stem.id);
      // Contextual grade should be higher than intrinsic grade
      assert.ok(sig.contextualGrade(head.id) >= head.grade);
      assert.ok(sig.contextualGrade(stem.id) >= stem.grade);
    });

    it('edges are bidirectional for lookup', () => {
      const sig = new SIG();
      const head = sig.addInter({ type: 'filled_notehead', grade: 0.8 });
      const stem = sig.addInter({ type: 'stem', grade: 0.5 });
      sig.addSupport(head.id, stem.id);
      const fromStem = sig.getEdges(stem.id);
      assert.equal(fromStem.length, 1);
    });
  });

  // ── Exclusion relations ──────────────────────
  describe('Exclusion edges', () => {
    it('creates an exclusion edge between two Inters', () => {
      const sig = new SIG();
      const a = sig.addInter({ type: 'filled_notehead', grade: 0.8 });
      const b = sig.addInter({ type: 'whole_note', grade: 0.4 });
      sig.addExclusion(a.id, b.id);
      const edges = sig.getEdges(a.id);
      assert.equal(edges.length, 1);
      assert.equal(edges[0].type, RelationType.EXCLUSION);
    });

    it('prevents duplicate exclusion edges', () => {
      const sig = new SIG();
      const a = sig.addInter({ type: 'filled_notehead', grade: 0.8 });
      const b = sig.addInter({ type: 'whole_note', grade: 0.4 });
      sig.addExclusion(a.id, b.id);
      sig.addExclusion(a.id, b.id);
      assert.equal(sig.getEdges(a.id).length, 1);
    });
  });

  // ── SIG reduction ──────────────────────
  describe('reduce()', () => {
    it('eliminates the lower-grade Inter in an exclusion pair', () => {
      const sig = new SIG();
      const winner = sig.addInter({ type: 'filled_notehead', grade: 0.9 });
      const loser = sig.addInter({ type: 'whole_note', grade: 0.3 });
      sig.addExclusion(winner.id, loser.id);
      sig.reduce();
      assert.ok(sig.getInter(winner.id));
      assert.equal(sig.getInter(loser.id), undefined);
    });

    it('uses contextual grade (with support) for reduction', () => {
      const sig = new SIG();
      // Low intrinsic grade but supported
      const head = sig.addInter({ type: 'filled_notehead', grade: 0.5 });
      const stem = sig.addInter({ type: 'stem', grade: 0.7 });
      sig.addSupport(head.id, stem.id);
      // Higher intrinsic but unsupported
      const rival = sig.addInter({ type: 'whole_note', grade: 0.55 });
      sig.addExclusion(head.id, rival.id);
      sig.reduce();
      // head should survive because support boosts its contextual grade
      assert.ok(sig.getInter(head.id));
      assert.equal(sig.getInter(rival.id), undefined);
    });

    it('handles chain exclusions — cascading removal', () => {
      const sig = new SIG();
      const a = sig.addInter({ type: 'filled_notehead', grade: 0.9 });
      const b = sig.addInter({ type: 'whole_note', grade: 0.5 });
      const c = sig.addInter({ type: 'open_notehead', grade: 0.3 });
      sig.addExclusion(a.id, b.id);
      sig.addExclusion(b.id, c.id);
      sig.reduce();
      assert.ok(sig.getInter(a.id));
      assert.equal(sig.getInter(b.id), undefined);
      // c survives — its exclusion partner (b) was removed
      assert.ok(sig.getInter(c.id));
    });

    it('preserves Inters with no exclusion edges', () => {
      const sig = new SIG();
      const head = sig.addInter({ type: 'filled_notehead', grade: 0.9 });
      const stem = sig.addInter({ type: 'stem', grade: 0.6 });
      sig.addSupport(head.id, stem.id);
      sig.reduce();
      assert.ok(sig.getInter(head.id));
      assert.ok(sig.getInter(stem.id));
    });

    it('cleans up edges referencing removed Inters', () => {
      const sig = new SIG();
      const a = sig.addInter({ type: 'filled_notehead', grade: 0.9 });
      const b = sig.addInter({ type: 'whole_note', grade: 0.3 });
      sig.addExclusion(a.id, b.id);
      sig.reduce();
      assert.equal(sig.getEdges(a.id).length, 0);
    });
  });

  // ── JSON serialisation ──────────────────────
  describe('toJSON()', () => {
    it('serialises full SIG to JSON', () => {
      const sig = new SIG();
      const head = sig.addInter({ type: 'filled_notehead', grade: 0.9 });
      const stem = sig.addInter({ type: 'stem', grade: 0.6 });
      sig.addSupport(head.id, stem.id);
      const json = sig.toJSON();
      assert.ok(Array.isArray(json.inters));
      assert.equal(json.inters.length, 2);
      assert.ok(Array.isArray(json.edges));
      assert.equal(json.edges.length, 1);
    });

    it('round-trips through JSON', () => {
      const sig = new SIG();
      sig.addInter({ type: 'filled_notehead', grade: 0.9 });
      sig.addInter({ type: 'stem', grade: 0.6 });
      const json = JSON.stringify(sig.toJSON());
      const parsed = JSON.parse(json);
      assert.equal(parsed.inters.length, 2);
    });
  });
});
