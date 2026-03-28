// ─────────────────────────────────────────────
// PianoFingeringData — unit tests
// ─────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getPrimaryFingering, getRange } from '../../src/fingering/PianoFingeringData.js';

describe('PianoFingeringData', () => {
  it('returns key info for C4 (MIDI 60)', () => {
    const f = getPrimaryFingering(60);
    assert.equal(f.noteName, 'C');
    assert.equal(f.octave, 4);
    assert.equal(f.isBlack, false);
  });

  it('identifies black keys correctly', () => {
    assert.equal(getPrimaryFingering(61).isBlack, true);  // C#4
    assert.equal(getPrimaryFingering(63).isBlack, true);  // D#4
    assert.equal(getPrimaryFingering(66).isBlack, true);  // F#4
  });

  it('identifies white keys correctly', () => {
    assert.equal(getPrimaryFingering(60).isBlack, false);  // C4
    assert.equal(getPrimaryFingering(64).isBlack, false);  // E4
    assert.equal(getPrimaryFingering(65).isBlack, false);  // F4
  });

  it('returns null for out-of-range notes', () => {
    assert.equal(getPrimaryFingering(20), null);
    assert.equal(getPrimaryFingering(109), null);
  });

  it('covers full piano range', () => {
    const range = getRange();
    assert.equal(range.min, 21); // A0
    assert.equal(range.max, 108); // C8
    for (let m = range.min; m <= range.max; m++) {
      assert.ok(getPrimaryFingering(m) !== null, `MIDI ${m} should have data`);
    }
  });
});
