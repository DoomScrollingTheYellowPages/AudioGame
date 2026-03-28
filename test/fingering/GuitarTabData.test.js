// ─────────────────────────────────────────────
// GuitarTabData — unit tests
// ─────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getPrimaryFingering, getAllPositions } from '../../src/fingering/GuitarTabData.js';

describe('GuitarTabData', () => {
  it('returns open string positions', () => {
    // E2 = MIDI 40 = 6th string open
    const e2 = getPrimaryFingering(40);
    assert.equal(e2.string, 6);
    assert.equal(e2.fret, 0);

    // A2 = MIDI 45 = 5th string open
    const a2 = getPrimaryFingering(45);
    assert.equal(a2.string, 5);
    assert.equal(a2.fret, 0);
  });

  it('returns fretted positions', () => {
    // F2 = MIDI 41 = 6th string fret 1
    const f2 = getPrimaryFingering(41);
    assert.equal(f2.string, 6);
    assert.equal(f2.fret, 1);
  });

  it('prefers lower fret positions', () => {
    // D3 = MIDI 50 can be played on A string fret 5 or D string open
    const d3 = getPrimaryFingering(50);
    assert.equal(d3.fret, 0); // open D string preferred
    assert.equal(d3.string, 4);
  });

  it('returns multiple positions via getAllPositions', () => {
    // E4 = MIDI 64 can be played on multiple strings
    const positions = getAllPositions(64);
    assert.ok(positions.length >= 2, `expected multiple positions, got ${positions.length}`);
  });

  it('returns null for notes below guitar range', () => {
    assert.equal(getPrimaryFingering(39), null); // below E2
  });

  it('returns null for notes above guitar range', () => {
    assert.equal(getPrimaryFingering(89), null); // above reasonable range
  });

  it('covers standard guitar range E2-E6', () => {
    // E2 (40) to at least E4 open (64)
    for (let m = 40; m <= 64; m++) {
      assert.ok(getPrimaryFingering(m) !== null, `MIDI ${m} should have tab data`);
    }
  });
});
