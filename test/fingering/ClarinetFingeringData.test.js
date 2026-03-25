// ─────────────────────────────────────────────
// ClarinetFingeringData — unit tests
// ─────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CLARINET_FINGERINGS,
  getPrimaryFingering,
} from '../../src/fingering/ClarinetFingeringData.js';

describe('ClarinetFingeringData', () => {

  // ── Range coverage ───────────────────────────
  describe('range coverage', () => {
    it('covers MIDI 52 (E3) through 84 (C6)', () => {
      for (let midi = 52; midi <= 84; midi++) {
        assert.ok(
          CLARINET_FINGERINGS[midi],
          `missing fingering for MIDI ${midi}`
        );
        assert.ok(
          CLARINET_FINGERINGS[midi].length > 0,
          `empty fingering array for MIDI ${midi}`
        );
      }
    });

    it('has no entries below MIDI 52', () => {
      assert.equal(CLARINET_FINGERINGS[51], undefined);
    });

    it('has no entries above MIDI 84', () => {
      assert.equal(CLARINET_FINGERINGS[85], undefined);
    });
  });

  // ── getPrimaryFingering ──────────────────────
  describe('getPrimaryFingering', () => {
    it('returns null for out-of-range notes', () => {
      assert.equal(getPrimaryFingering(40), null);
      assert.equal(getPrimaryFingering(90), null);
    });

    it('returns a fingering object for E3 (52)', () => {
      const f = getPrimaryFingering(52);
      assert.ok(f);
      assert.equal(typeof f.register, 'boolean');
      assert.equal(typeof f.lThumb, 'boolean');
    });

    it('returns a fingering object for G3 (55)', () => {
      const f = getPrimaryFingering(55);
      assert.ok(f);
    });

    it('returns a fingering object for C4 (60)', () => {
      const f = getPrimaryFingering(60);
      assert.ok(f);
    });

    it('returns a fingering object for E4 (64)', () => {
      const f = getPrimaryFingering(64);
      assert.ok(f);
    });

    it('returns a fingering object for B4 (71)', () => {
      const f = getPrimaryFingering(71);
      assert.ok(f);
    });

    it('returns a fingering object for C5 (72)', () => {
      const f = getPrimaryFingering(72);
      assert.ok(f);
    });

    it('returns a fingering object for G5 (79)', () => {
      const f = getPrimaryFingering(79);
      assert.ok(f);
    });
  });

  // ── E3 (52): all main holes closed, chalumeau ─
  describe('E3 (MIDI 52)', () => {
    it('has register = false (chalumeau)', () => {
      const f = getPrimaryFingering(52);
      assert.equal(f.register, false);
    });

    it('has all main holes closed', () => {
      const f = getPrimaryFingering(52);
      assert.equal(f.lThumb, true);
      assert.equal(f.l1, true);
      assert.equal(f.l2, true);
      assert.equal(f.l3, true);
      assert.equal(f.r1, true);
      assert.equal(f.r2, true);
      assert.equal(f.r3, true);
    });
  });

  // ── B4 (71): register key active ──────────────
  describe('B4 (MIDI 71)', () => {
    it('has register = true (clarion)', () => {
      const f = getPrimaryFingering(71);
      assert.equal(f.register, true);
    });

    it('has all main holes closed (overblown E3)', () => {
      const f = getPrimaryFingering(71);
      assert.equal(f.lThumb, true);
      assert.equal(f.l1, true);
      assert.equal(f.l2, true);
      assert.equal(f.l3, true);
      assert.equal(f.r1, true);
      assert.equal(f.r2, true);
      assert.equal(f.r3, true);
    });
  });

  // ── Chalumeau vs clarion register boundaries ──
  describe('register boundaries', () => {
    it('chalumeau notes (52–70) have register = false', () => {
      for (let midi = 52; midi <= 70; midi++) {
        const f = getPrimaryFingering(midi);
        assert.equal(f.register, false, `MIDI ${midi} should be chalumeau`);
      }
    });

    it('clarion / altissimo notes (71–84) have register = true', () => {
      for (let midi = 71; midi <= 84; midi++) {
        const f = getPrimaryFingering(midi);
        assert.equal(f.register, true, `MIDI ${midi} should have register key`);
      }
    });
  });

  // ── Fingering field structure ──────────────────
  describe('fingering field structure', () => {
    it('every entry has all required boolean fields', () => {
      const fields = [
        'register', 'lThumb', 'l1', 'l2', 'l3',
        'r1', 'r2', 'r3', 'rPinky',
      ];
      for (const [midi, list] of Object.entries(CLARINET_FINGERINGS)) {
        for (const fg of list) {
          for (const key of fields) {
            assert.equal(
              typeof fg[key], 'boolean',
              `MIDI ${midi} field "${key}" should be boolean`
            );
          }
        }
      }
    });
  });
});
