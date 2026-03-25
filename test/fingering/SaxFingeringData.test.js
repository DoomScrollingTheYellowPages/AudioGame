// ─────────────────────────────────────────────
// SaxFingeringData — unit tests
// ─────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SAX_FINGERINGS, getPrimaryFingering } from '../../src/fingering/SaxFingeringData.js';

describe('SaxFingeringData', () => {

  // ── Range coverage ───────────────────────────
  describe('range coverage', () => {
    it('covers every chromatic MIDI note from 49 (Db3) to 81 (A5)', () => {
      for (let midi = 49; midi <= 81; midi++) {
        assert.ok(
          SAX_FINGERINGS[midi],
          `missing fingering for MIDI ${midi}`
        );
        assert.ok(
          SAX_FINGERINGS[midi].length >= 1,
          `MIDI ${midi} has empty array`
        );
      }
    });

    it('has no entries outside the 49–81 range', () => {
      const keys = Object.keys(SAX_FINGERINGS).map(Number);
      for (const k of keys) {
        assert.ok(k >= 49 && k <= 81, `unexpected MIDI key ${k}`);
      }
    });
  });

  // ── getPrimaryFingering ──────────────────────
  describe('getPrimaryFingering', () => {
    it('returns null for out-of-range notes', () => {
      assert.equal(getPrimaryFingering(48), null);
      assert.equal(getPrimaryFingering(82), null);
      assert.equal(getPrimaryFingering(0), null);
    });

    it('returns a non-alt fingering for Db3 (49)', () => {
      const f = getPrimaryFingering(49);
      assert.ok(f);
      assert.equal(f.alt, undefined);
    });

    it('returns a non-alt fingering for Eb3 (51)', () => {
      const f = getPrimaryFingering(51);
      assert.ok(f);
      assert.equal(f.alt, undefined);
    });

    it('returns a non-alt fingering for F3 (53)', () => {
      const f = getPrimaryFingering(53);
      assert.ok(f);
      assert.equal(f.alt, undefined);
    });

    it('returns a non-alt fingering for G3 (55)', () => {
      const f = getPrimaryFingering(55);
      assert.ok(f);
      assert.equal(f.alt, undefined);
    });

    it('returns a non-alt fingering for A3 (57)', () => {
      const f = getPrimaryFingering(57);
      assert.ok(f);
      assert.equal(f.alt, undefined);
    });

    it('returns a non-alt fingering for C4 (60)', () => {
      const f = getPrimaryFingering(60);
      assert.ok(f);
      assert.equal(f.alt, undefined);
    });

    it('returns a non-alt fingering for D4 (62)', () => {
      const f = getPrimaryFingering(62);
      assert.ok(f);
      assert.equal(f.alt, undefined);
    });

    it('returns a non-alt fingering for E4 (64)', () => {
      const f = getPrimaryFingering(64);
      assert.ok(f);
      assert.equal(f.alt, undefined);
    });

    it('returns a non-alt fingering for A5 (81)', () => {
      const f = getPrimaryFingering(81);
      assert.ok(f);
      assert.equal(f.alt, undefined);
    });
  });

  // ── Octave key ───────────────────────────────
  describe('octave key', () => {
    it('Db3 (49) has oct=false (low register)', () => {
      const f = getPrimaryFingering(49);
      assert.equal(f.oct, false);
    });

    it('D4 (62) has oct=true (upper register)', () => {
      const f = getPrimaryFingering(62);
      assert.equal(f.oct, true);
    });

    it('all notes 49–61 have oct=false', () => {
      for (let midi = 49; midi <= 61; midi++) {
        const f = getPrimaryFingering(midi);
        assert.equal(f.oct, false, `MIDI ${midi} should have oct=false`);
      }
    });

    it('all notes 62–81 have oct=true', () => {
      for (let midi = 62; midi <= 81; midi++) {
        const f = getPrimaryFingering(midi);
        assert.equal(f.oct, true, `MIDI ${midi} should have oct=true`);
      }
    });
  });

  // ── Fingering fields ─────────────────────────
  describe('fingering field structure', () => {
    it('every fingering has all required boolean keys', () => {
      const boolKeys = ['oct', 'l1', 'l2', 'l3', 'r1', 'r2', 'r3'];
      for (let midi = 49; midi <= 81; midi++) {
        for (const f of SAX_FINGERINGS[midi]) {
          for (const key of boolKeys) {
            assert.equal(typeof f[key], 'boolean', `MIDI ${midi} .${key} should be boolean`);
          }
        }
      }
    });

    it('every fingering has lPalm, rPinky, lSide, rSide as string or null', () => {
      const strKeys = ['lPalm', 'rPinky', 'lSide', 'rSide'];
      for (let midi = 49; midi <= 81; midi++) {
        for (const f of SAX_FINGERINGS[midi]) {
          for (const key of strKeys) {
            assert.ok(
              f[key] === null || typeof f[key] === 'string',
              `MIDI ${midi} .${key} should be string or null, got ${typeof f[key]}`
            );
          }
        }
      }
    });
  });

  // ── Spot-check specific fingerings ───────────
  describe('spot-check fingerings', () => {
    it('Db3 (49) has all holes closed + low key', () => {
      const f = getPrimaryFingering(49);
      assert.equal(f.l1, true);
      assert.equal(f.l2, true);
      assert.equal(f.l3, true);
      assert.equal(f.r1, true);
      assert.equal(f.r2, true);
      assert.equal(f.r3, true);
      assert.equal(f.rPinky, 'eb');
    });

    it('A3 (57) has all holes open', () => {
      const f = getPrimaryFingering(57);
      assert.equal(f.l1, false);
      assert.equal(f.l2, false);
      assert.equal(f.l3, false);
      assert.equal(f.r1, false);
      assert.equal(f.r2, false);
      assert.equal(f.r3, false);
    });

    it('Bb3 (58) uses bis side key', () => {
      const f = getPrimaryFingering(58);
      assert.equal(f.lSide, 'bis');
    });

    it('A5 (81) uses palm key', () => {
      const f = getPrimaryFingering(81);
      assert.ok(f.lPalm !== null, 'A5 should use a palm key');
    });
  });
});
