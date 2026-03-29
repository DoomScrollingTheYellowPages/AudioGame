// ─────────────────────────────────────────────
// SymbolClassifier — unit tests
// ─────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SymbolClassifier, SymbolType } from '../../src/sheet2midi/SymbolClassifier.js';
import { MockBus } from '../test-helper.js';

/** Helper: create a fake component with given features */
function fakeComponent(overrides = {}) {
  return {
    label: 1,
    bbox: { x: 0, y: 0, width: 10, height: 10 },
    centroid: { x: 5, y: 5 },
    area: 100,
    fillRatio: 0.8,
    aspectRatio: 1.35,
    holes: 0,
    widthSS: 1.0,
    heightSS: 1.0,
    ...overrides
  };
}

describe('SymbolClassifier', () => {

  // ── classifyHeuristic ──────────────────────
  describe('classifyHeuristic', () => {
    it('classifies a filled notehead', () => {
      const bus = new MockBus();
      const sc = new SymbolClassifier(bus);
      const c = fakeComponent({
        aspectRatio: 1.35, fillRatio: 0.8, widthSS: 1.0, heightSS: 0.8, holes: 0
      });
      assert.equal(sc.classifyHeuristic(c), SymbolType.FILLED_NOTEHEAD);
    });

    it('classifies an open notehead (has hole)', () => {
      const bus = new MockBus();
      const sc = new SymbolClassifier(bus);
      const c = fakeComponent({
        aspectRatio: 1.3, fillRatio: 0.5, widthSS: 1.0, heightSS: 0.8, holes: 1
      });
      assert.equal(sc.classifyHeuristic(c), SymbolType.OPEN_NOTEHEAD);
    });

    it('classifies a stem', () => {
      const bus = new MockBus();
      const sc = new SymbolClassifier(bus);
      const c = fakeComponent({
        aspectRatio: 0.1, fillRatio: 0.9, widthSS: 0.15, heightSS: 3.0, holes: 0
      });
      assert.equal(sc.classifyHeuristic(c), SymbolType.STEM);
    });

    it('classifies a dot', () => {
      const bus = new MockBus();
      const sc = new SymbolClassifier(bus);
      const c = fakeComponent({
        aspectRatio: 1.0, fillRatio: 0.85, widthSS: 0.3, heightSS: 0.3, holes: 0
      });
      assert.equal(sc.classifyHeuristic(c), SymbolType.DOT);
    });

    it('classifies a bar line (must not match stem)', () => {
      const bus = new MockBus();
      const sc = new SymbolClassifier(bus);
      // Bar line: very thin, very tall, aspect < 0.18, widthSS < 0.35, heightSS >= 3.5
      // Key difference from stem: bar line requires aspectRatio <= 0.18 AND widthSS <= 0.35
      // Stem rule also matches thin tall shapes, but bar line is checked AFTER stem in RULES.
      // Since both match, stem wins (first match). This is expected heuristic behavior.
      // To force bar line, use width outside stem range (widthSS > 0.4 is stem min)
      // Actually bar line widthSS max is 0.35, stem min is 0.05, so they overlap.
      // The rules list has stem before bar_line, so stem wins when both match.
      // This test verifies that bar_line matches when stem does NOT match.
      const c = fakeComponent({
        aspectRatio: 0.02, fillRatio: 0.9, widthSS: 0.08, heightSS: 4.0, holes: 0
      });
      // aspectRatio 0.02 < stem min 0.03, so stem won't match, bar_line will
      assert.equal(sc.classifyHeuristic(c), SymbolType.BAR_LINE);
    });

    it('classifies a beam', () => {
      const bus = new MockBus();
      const sc = new SymbolClassifier(bus);
      const c = fakeComponent({
        aspectRatio: 6.0, fillRatio: 0.8, widthSS: 3.0, heightSS: 0.4, holes: 0
      });
      assert.equal(sc.classifyHeuristic(c), SymbolType.BEAM);
    });

    it('classifies a sharp accidental (small inline)', () => {
      const bus = new MockBus();
      const sc = new SymbolClassifier(bus);
      const c = fakeComponent({
        aspectRatio: 0.35, fillRatio: 0.35, widthSS: 0.6, heightSS: 1.8, holes: 0
      });
      assert.equal(sc.classifyHeuristic(c), SymbolType.SHARP);
    });

    it('classifies a key-sig sharp (larger, previously caught by rest/flag rules)', () => {
      const bus = new MockBus();
      const sc = new SymbolClassifier(bus);
      // Key-sig sharps span ~2 staff spaces; aspectRatio ~0.45, sparse fill ~0.30
      const c = fakeComponent({
        aspectRatio: 0.45, fillRatio: 0.30, widthSS: 0.85, heightSS: 2.1, holes: 0
      });
      assert.equal(sc.classifyHeuristic(c), SymbolType.SHARP);
    });

    it('returns UNKNOWN for unrecognized shape', () => {
      const bus = new MockBus();
      const sc = new SymbolClassifier(bus);
      const c = fakeComponent({
        aspectRatio: 10.0, fillRatio: 0.1, widthSS: 50, heightSS: 50, holes: 5
      });
      assert.equal(sc.classifyHeuristic(c), SymbolType.UNKNOWN);
    });

    // ── Brace ──────────────────────────────────
    it('classifies a grand staff brace (tall narrow curve on left margin)', () => {
      const bus = new MockBus();
      const sc = new SymbolClassifier(bus);
      // Brace: spans both staves, very tall, narrow, low fill (just the curve strokes)
      const c = fakeComponent({
        aspectRatio: 0.08, fillRatio: 0.18, widthSS: 0.6, heightSS: 8.5, holes: 0,
        centroid: { x: 15, y: 200 }
      });
      assert.equal(sc.classifyHeuristic(c), SymbolType.BRACE);
    });

    it('does not classify a bar line as a brace (too short)', () => {
      const bus = new MockBus();
      const sc = new SymbolClassifier(bus);
      const c = fakeComponent({
        aspectRatio: 0.05, fillRatio: 0.9, widthSS: 0.08, heightSS: 4.0, holes: 0
      });
      assert.notEqual(sc.classifyHeuristic(c), SymbolType.BRACE);
    });

    it('does not classify a stem as a brace (too high fill, too short)', () => {
      const bus = new MockBus();
      const sc = new SymbolClassifier(bus);
      const c = fakeComponent({
        aspectRatio: 0.1, fillRatio: 0.9, widthSS: 0.15, heightSS: 3.0, holes: 0
      });
      assert.notEqual(sc.classifyHeuristic(c), SymbolType.BRACE);
    });

    it('does not classify a treble clef as a brace (too short, wrong aspect)', () => {
      const bus = new MockBus();
      const sc = new SymbolClassifier(bus);
      const c = fakeComponent({
        aspectRatio: 0.35, fillRatio: 0.35, widthSS: 1.2, heightSS: 4.5, holes: 1
      });
      assert.notEqual(sc.classifyHeuristic(c), SymbolType.BRACE);
    });
  });

  // ── classify (batch) ───────────────────────
  describe('classify', () => {
    it('classifies multiple components and emits event', () => {
      const bus = new MockBus();
      const sc = new SymbolClassifier(bus);
      const components = [
        fakeComponent({ aspectRatio: 1.35, fillRatio: 0.8, widthSS: 1.0, heightSS: 0.8, holes: 0 }),
        fakeComponent({ aspectRatio: 0.1, fillRatio: 0.9, widthSS: 0.15, heightSS: 3.0, holes: 0 }),
      ];
      const results = sc.classify(components);
      assert.equal(results.length, 2);
      assert.equal(results[0].type, SymbolType.FILLED_NOTEHEAD);
      assert.equal(results[1].type, SymbolType.STEM);
      assert.ok(results[0].confidence > 0);
      assert.equal(bus.getEvents('omr:symbols').length, 1);
    });
  });

  // ── generateNoteheadTemplate ───────────────
  describe('generateNoteheadTemplate', () => {
    it('generates template with correct dimensions', () => {
      const bus = new MockBus();
      const sc = new SymbolClassifier(bus);
      const tpl = sc.generateNoteheadTemplate(10);
      assert.equal(tpl.width, 14); // round(10 * 1.4)
      assert.equal(tpl.height, 10);
      assert.equal(tpl.data.length, 14 * 10);
    });

    it('has black pixels in the center (ellipse)', () => {
      const bus = new MockBus();
      const sc = new SymbolClassifier(bus);
      const tpl = sc.generateNoteheadTemplate(10);
      const cx = Math.floor(tpl.width / 2);
      const cy = Math.floor(tpl.height / 2);
      assert.equal(tpl.data[cy * tpl.width + cx], 0, 'center should be black');
    });
  });

  // ── distanceTransformCenters ───────────────
  describe('distanceTransformCenters', () => {
    it('finds center of a single blob', () => {
      const bus = new MockBus();
      const sc = new SymbolClassifier(bus);
      const w = 20, h = 20;
      const bin = new Uint8Array(w * h).fill(255);
      // Draw a filled circle-ish blob at (10, 10)
      for (let y = 6; y < 14; y++) {
        for (let x = 6; x < 14; x++) {
          bin[y * w + x] = 0;
        }
      }
      const bbox = { x: 6, y: 6, width: 8, height: 8 };
      const centers = sc.distanceTransformCenters(bin, w, bbox);
      assert.ok(centers.length >= 1, `expected at least 1 center, got ${centers.length}`);
    });

    it('finds two centers for two touching noteheads', () => {
      const bus = new MockBus();
      const sc = new SymbolClassifier(bus);
      const w = 50, h = 30;
      const bin = new Uint8Array(w * h).fill(255);
      // Draw two 12x12 blobs connected by a thin 2px bridge
      // Blob 1: x=2..13, y=9..20
      for (let y = 9; y < 21; y++) {
        for (let x = 2; x < 14; x++) bin[y * w + x] = 0;
      }
      // Blob 2: x=18..29, y=9..20
      for (let y = 9; y < 21; y++) {
        for (let x = 18; x < 30; x++) bin[y * w + x] = 0;
      }
      // Connect with a thin bridge at y=14..15
      for (let x = 14; x < 18; x++) {
        bin[14 * w + x] = 0;
        bin[15 * w + x] = 0;
      }
      const bbox = { x: 2, y: 9, width: 28, height: 12 };
      const centers = sc.distanceTransformCenters(bin, w, bbox);
      assert.ok(centers.length >= 2, `expected >= 2 centers for touching noteheads, got ${centers.length}`);
      // The two centers should be in different halves
      const xs = centers.map(c => c.x).sort((a, b) => a - b);
      assert.ok(xs[0] < 16, `first center x=${xs[0]} should be < 16`);
      assert.ok(xs[xs.length - 1] > 16, `last center x=${xs[xs.length - 1]} should be > 16`);
    });
  });
});
