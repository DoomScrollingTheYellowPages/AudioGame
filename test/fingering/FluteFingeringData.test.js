// ─────────────────────────────────────────────
// FluteFingeringData — unit tests
// ─────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FLUTE_FINGERINGS, getPrimaryFingering } from '../../src/fingering/FluteFingeringData.js';

describe('FluteFingeringData', () => {

  // ── Coverage ─────────────────────────────────
  describe('range coverage', () => {
    it('has entries for every MIDI note from 60 to 96', () => {
      for (let midi = 60; midi <= 96; midi++) {
        assert.ok(
          FLUTE_FINGERINGS[midi],
          `missing fingering for MIDI ${midi}`
        );
        assert.ok(
          Array.isArray(FLUTE_FINGERINGS[midi]),
          `MIDI ${midi} should map to an array`
        );
        assert.ok(
          FLUTE_FINGERINGS[midi].length >= 1,
          `MIDI ${midi} should have at least one fingering`
        );
      }
    });
  });

  // ── getPrimaryFingering ──────────────────────
  describe('getPrimaryFingering', () => {
    const testNotes = [
      { midi: 60, name: 'C4' },
      { midi: 62, name: 'D4' },
      { midi: 64, name: 'E4' },
      { midi: 65, name: 'F4' },
      { midi: 67, name: 'G4' },
      { midi: 69, name: 'A4' },
      { midi: 71, name: 'B4' },
      { midi: 72, name: 'C5' },
      { midi: 74, name: 'D5' },
      { midi: 84, name: 'C6' },
    ];

    for (const { midi, name } of testNotes) {
      it(`returns an object for ${name} (MIDI ${midi})`, () => {
        const f = getPrimaryFingering(midi);
        assert.ok(f, `getPrimaryFingering(${midi}) should not be null`);
        assert.equal(typeof f.l1, 'boolean');
        assert.equal(typeof f.l2, 'boolean');
        assert.equal(typeof f.l3, 'boolean');
        assert.equal(typeof f.r1, 'boolean');
        assert.equal(typeof f.r2, 'boolean');
        assert.equal(typeof f.r3, 'boolean');
        assert.equal(typeof f.lThumb, 'boolean');
        assert.equal(typeof f.rPinky, 'boolean');
        assert.equal(typeof f.trill1, 'boolean');
        assert.equal(typeof f.trill2, 'boolean');
      });
    }

    it('returns null for out-of-range notes', () => {
      assert.equal(getPrimaryFingering(59), null);
      assert.equal(getPrimaryFingering(97), null);
      assert.equal(getPrimaryFingering(0), null);
    });
  });

  // ── First-octave fingering correctness ───────
  describe('first-octave fingerings', () => {
    it('C4 has all main holes closed', () => {
      const f = getPrimaryFingering(60);
      assert.equal(f.l1, true, 'l1 closed');
      assert.equal(f.l2, true, 'l2 closed');
      assert.equal(f.l3, true, 'l3 closed');
      assert.equal(f.r1, true, 'r1 closed');
      assert.equal(f.r2, true, 'r2 closed');
      assert.equal(f.r3, true, 'r3 closed');
      assert.equal(f.lThumb, false, 'no thumb key in first octave');
    });

    it('D4 opens r3 only', () => {
      const f = getPrimaryFingering(62);
      assert.equal(f.l1, true);
      assert.equal(f.l2, true);
      assert.equal(f.l3, true);
      assert.equal(f.r1, true);
      assert.equal(f.r2, true);
      assert.equal(f.r3, false, 'r3 open for D4');
    });

    it('E4 opens r2 and r3', () => {
      const f = getPrimaryFingering(64);
      assert.equal(f.r1, true);
      assert.equal(f.r2, false, 'r2 open for E4');
      assert.equal(f.r3, false, 'r3 open for E4');
    });

    it('F4 opens r1, r2, r3', () => {
      const f = getPrimaryFingering(65);
      assert.equal(f.l1, true);
      assert.equal(f.l2, true);
      assert.equal(f.l3, true);
      assert.equal(f.r1, false, 'r1 open for F4');
      assert.equal(f.r2, false, 'r2 open for F4');
      assert.equal(f.r3, false, 'r3 open for F4');
    });

    it('G4 opens l3, r1, r2, r3', () => {
      const f = getPrimaryFingering(67);
      assert.equal(f.l1, true);
      assert.equal(f.l2, true);
      assert.equal(f.l3, false, 'l3 open for G4');
      assert.equal(f.r1, false);
      assert.equal(f.r2, false);
      assert.equal(f.r3, false);
    });

    it('A4 opens l2, l3, r1, r2, r3', () => {
      const f = getPrimaryFingering(69);
      assert.equal(f.l1, true);
      assert.equal(f.l2, false, 'l2 open for A4');
      assert.equal(f.l3, false, 'l3 open for A4');
      assert.equal(f.r1, false);
      assert.equal(f.r2, false);
      assert.equal(f.r3, false);
    });

    it('B4 opens l1, l2, l3, r1, r2, r3', () => {
      const f = getPrimaryFingering(71);
      assert.equal(f.l1, false, 'l1 open for B4');
      assert.equal(f.l2, false);
      assert.equal(f.l3, false);
      assert.equal(f.r1, false);
      assert.equal(f.r2, false);
      assert.equal(f.r3, false);
      assert.equal(f.lThumb, false, 'no thumb key for B4');
    });
  });

  // ── Octave distinctions ──────────────────────
  describe('octave distinctions', () => {
    it('C5 has different fingering than C4 (thumb key)', () => {
      const c4 = getPrimaryFingering(60);
      const c5 = getPrimaryFingering(72);
      assert.notDeepStrictEqual(c4, c5, 'C4 and C5 must differ');
      assert.equal(c4.lThumb, false, 'C4 has no thumb key');
      assert.equal(c5.lThumb, true, 'C5 uses thumb key');
    });

    it('D5 uses thumb key while D4 does not', () => {
      const d4 = getPrimaryFingering(62);
      const d5 = getPrimaryFingering(74);
      assert.equal(d4.lThumb, false);
      assert.equal(d5.lThumb, true);
    });

    it('second-octave notes all have lThumb true', () => {
      for (let midi = 72; midi <= 83; midi++) {
        const f = getPrimaryFingering(midi);
        assert.equal(f.lThumb, true, `MIDI ${midi} should have lThumb true`);
      }
    });
  });
});
