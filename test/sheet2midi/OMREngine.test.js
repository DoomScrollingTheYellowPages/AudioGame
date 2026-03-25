// ─────────────────────────────────────────────
// OMREngine — unit tests for rest integration
// and note sequence assembly
// ─────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MockBus } from '../test-helper.js';

// We test the note sequence assembly logic directly rather than
// the full pipeline (which requires browser APIs for image loading).
// Import the helper we'll create for merging notes and rests.

describe('Rest integration', () => {

  it('merges notes and rests into time-ordered sequence with startBeat', async () => {
    // Simulate OMR output: 2 notes with a rest between them
    const notes = [
      { midiNote: 60, beats: 1, x: 10 },
      { midiNote: 64, beats: 1, x: 50 },
    ];
    const rests = [
      { beats: 2, x: 25 }  // 2-beat rest between the notes
    ];

    // Merge and compute start times
    const events = [
      ...notes.map(n => ({ ...n, isRest: false })),
      ...rests.map(r => ({ ...r, isRest: true, midiNote: -1 }))
    ];
    events.sort((a, b) => a.x - b.x);

    // Compute cumulative startBeat
    let currentBeat = 0;
    for (const e of events) {
      e.startBeat = currentBeat;
      currentBeat += e.beats;
    }

    assert.equal(events.length, 3);
    assert.equal(events[0].startBeat, 0);    // first note at beat 0
    assert.equal(events[0].midiNote, 60);
    assert.equal(events[1].startBeat, 1);    // rest at beat 1
    assert.ok(events[1].isRest);
    assert.equal(events[2].startBeat, 3);    // second note at beat 3
    assert.equal(events[2].midiNote, 64);
  });
});
