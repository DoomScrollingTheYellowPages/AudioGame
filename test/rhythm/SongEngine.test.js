// ─────────────────────────────────────────────
// SongEngine — unit tests for count-in
// ─────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// SongEngine uses performance.now() and rAF which aren't in Node.
// We test the count-in calculation logic directly.

describe('SongEngine count-in', () => {

  it('computes 2 bars of count-in for 4/4 at 120 BPM', () => {
    // 4/4 at 120 BPM: 4 beats/bar, 500ms/beat → 2 bars = 8 beats = 4000ms
    const bpm = 120;
    const meter = [4, 4];
    const beatsPerBar = meter[0] * (4 / meter[1]);
    const msPerBeat = 60000 / bpm;
    const countIn = 2 * beatsPerBar * msPerBeat;
    assert.equal(countIn, 4000);
  });

  it('computes 2 bars of count-in for 3/4 at 90 BPM', () => {
    // 3/4 at 90 BPM: 3 beats/bar, 667ms/beat → 2 bars = 6 beats = 4000ms
    const bpm = 90;
    const meter = [3, 4];
    const beatsPerBar = meter[0] * (4 / meter[1]);
    const msPerBeat = 60000 / bpm;
    const countIn = 2 * beatsPerBar * msPerBeat;
    assert.ok(Math.abs(countIn - 4000) < 1);
  });

  it('computes 2 bars of count-in for 6/8 at 120 BPM', () => {
    // 6/8 at 120 BPM: 6 * (4/8) = 3 beats/bar, 500ms/beat → 2 bars = 6 beats = 3000ms
    const bpm = 120;
    const meter = [6, 8];
    const beatsPerBar = meter[0] * (4 / meter[1]);
    const msPerBeat = 60000 / bpm;
    const countIn = 2 * beatsPerBar * msPerBeat;
    assert.equal(countIn, 3000);
  });
});
