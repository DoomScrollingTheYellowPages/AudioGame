// ─────────────────────────────────────────────
// TrumpetFingeringData — unit tests
// ─────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  TRUMPET_FINGERINGS,
  getPrimaryFingering,
} from '../../src/fingering/TrumpetFingeringData.js';

describe('TrumpetFingeringData', () => {

  // ── Range coverage ──────────────────────────
  describe('range coverage', () => {
    it('covers every chromatic note from MIDI 54 to 84', () => {
      for (let midi = 54; midi <= 84; midi++) {
        assert.ok(
          TRUMPET_FINGERINGS[midi],
          `missing fingering for MIDI ${midi}`
        );
        assert.ok(
          TRUMPET_FINGERINGS[midi].length > 0,
          `empty fingering array for MIDI ${midi}`
        );
      }
    });

    it('has exactly 31 entries (54 through 84 inclusive)', () => {
      const keys = Object.keys(TRUMPET_FINGERINGS).map(Number);
      assert.equal(keys.length, 31);
      assert.equal(Math.min(...keys), 54);
      assert.equal(Math.max(...keys), 84);
    });
  });

  // ── getPrimaryFingering ─────────────────────
  describe('getPrimaryFingering', () => {
    it('returns null for out-of-range notes', () => {
      assert.equal(getPrimaryFingering(53), null);
      assert.equal(getPrimaryFingering(85), null);
      assert.equal(getPrimaryFingering(0), null);
    });

    it('F#3 (54) — all valves pressed (123)', () => {
      const f = getPrimaryFingering(54);
      assert.equal(f.v1, true);
      assert.equal(f.v2, true);
      assert.equal(f.v3, true);
    });

    it('C4 (60) — open (000)', () => {
      const f = getPrimaryFingering(60);
      assert.equal(f.v1, false);
      assert.equal(f.v2, false);
      assert.equal(f.v3, false);
    });

    it('G4 (67) — open (000)', () => {
      const f = getPrimaryFingering(67);
      assert.equal(f.v1, false);
      assert.equal(f.v2, false);
      assert.equal(f.v3, false);
    });

    it('C5 (72) — open (000)', () => {
      const f = getPrimaryFingering(72);
      assert.equal(f.v1, false);
      assert.equal(f.v2, false);
      assert.equal(f.v3, false);
    });

    it('E5 (76) — open (000)', () => {
      const f = getPrimaryFingering(76);
      assert.equal(f.v1, false);
      assert.equal(f.v2, false);
      assert.equal(f.v3, false);
    });

    it('G5 (79) — open (000)', () => {
      const f = getPrimaryFingering(79);
      assert.equal(f.v1, false);
      assert.equal(f.v2, false);
      assert.equal(f.v3, false);
    });

    it('C6 (84) — open (000)', () => {
      const f = getPrimaryFingering(84);
      assert.equal(f.v1, false);
      assert.equal(f.v2, false);
      assert.equal(f.v3, false);
    });
  });

  // ── Valve field structure ───────────────────
  describe('fingering structure', () => {
    it('every fingering has boolean v1, v2, v3 fields', () => {
      for (const [midi, list] of Object.entries(TRUMPET_FINGERINGS)) {
        for (const f of list) {
          assert.equal(typeof f.v1, 'boolean', `v1 not boolean at MIDI ${midi}`);
          assert.equal(typeof f.v2, 'boolean', `v2 not boolean at MIDI ${midi}`);
          assert.equal(typeof f.v3, 'boolean', `v3 not boolean at MIDI ${midi}`);
        }
      }
    });
  });
});
