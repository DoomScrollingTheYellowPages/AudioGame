// ─────────────────────────────────────────────
// OMREngine — unit tests for rest integration,
// note sequence assembly, and Format 1 MIDI
// ─────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MockBus } from '../test-helper.js';
import { MidiWriter } from '../../src/rhythm/MidiWriter.js';

// ── Helpers ────────────────────────────────────

/** Scrape all note-on MIDI note numbers (status 0x90, vel > 0) from raw bytes. */
function scrapeNoteOns(bytes) {
  const notes = [];
  for (let i = 0; i < bytes.length - 2; i++) {
    if (bytes[i] === 0x90 && bytes[i + 2] > 0) notes.push(bytes[i + 1]);
  }
  return notes;
}

/** Extract track N bytes from a Format 1 MIDI ArrayBuffer (0-indexed). */
function extractTrack(midi, trackIndex) {
  const view = new DataView(midi);
  const bytes = new Uint8Array(midi);
  let offset = 14; // skip MThd
  for (let t = 0; t <= trackIndex; t++) {
    const len = view.getUint32(offset + 4);
    if (t === trackIndex) return bytes.slice(offset + 8, offset + 8 + len);
    offset += 8 + len;
  }
  return new Uint8Array(0);
}

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

// ── Format 1 MIDI assembly ─────────────────────

describe('Format 1 MIDI assembly', () => {

  it('treble notes land in track 1, bass notes land in track 2', () => {
    // Simulate OMR grand staff output — notes tagged with clef
    const allEvents = [
      { midiNote: 64, beats: 1, x: 10, clef: 'treble', isRest: false }, // E4
      { midiNote: 67, beats: 1, x: 20, clef: 'treble', isRest: false }, // G4
      { midiNote: 43, beats: 1, x: 10, clef: 'bass',   isRest: false }, // G2
      { midiNote: 47, beats: 1, x: 20, clef: 'bass',   isRest: false }, // B2
    ];

    // Reproduce OMREngine's grand staff MIDI assembly logic
    let currentBeat = 0;
    for (const e of [...allEvents].sort((a, b) => a.x - b.x)) {
      e.startBeat = currentBeat;
      currentBeat += e.beats;
    }

    const trebleMidi = allEvents
      .filter(n => !n.isRest && n.midiNote > 0 && n.clef === 'treble')
      .map(n => ({ note: n.midiNote, beats: n.beats, startBeat: n.startBeat }));
    const bassMidi = allEvents
      .filter(n => !n.isRest && n.midiNote > 0 && n.clef === 'bass')
      .map(n => ({ note: n.midiNote, beats: n.beats, startBeat: n.startBeat }));

    const midi = MidiWriter.buildMultiTrack({ bpm: 120, tracks: [trebleMidi, bassMidi] });

    const t1 = extractTrack(midi, 0);
    const t2 = extractTrack(midi, 1);

    const t1Notes = scrapeNoteOns(t1);
    const t2Notes = scrapeNoteOns(t2);

    assert.ok(t1Notes.includes(64), 'track 1 should have E4 (treble)');
    assert.ok(t1Notes.includes(67), 'track 1 should have G4 (treble)');
    assert.ok(!t1Notes.includes(43), 'track 1 should NOT have G2 (bass)');

    assert.ok(t2Notes.includes(43), 'track 2 should have G2 (bass)');
    assert.ok(t2Notes.includes(47), 'track 2 should have B2 (bass)');
    assert.ok(!t2Notes.includes(64), 'track 2 should NOT have E4 (treble)');
  });

  it('grand staff output is Format 1 with 2 tracks', () => {
    const midi = MidiWriter.buildMultiTrack({
      bpm: 120,
      tracks: [
        [{ note: 60, beats: 1 }],
        [{ note: 43, beats: 1 }],
      ]
    });
    const view = new DataView(midi);
    assert.equal(view.getUint16(8), 1, 'format should be 1');
    assert.equal(view.getUint16(10), 2, 'should have 2 tracks');
  });

  it('empty bass track produces valid (empty) track 2', () => {
    const midi = MidiWriter.buildMultiTrack({
      bpm: 120,
      tracks: [
        [{ note: 60, beats: 1 }],
        [], // no bass notes
      ]
    });
    assert.ok(midi instanceof ArrayBuffer);
    const t2 = extractTrack(midi, 1);
    // Track 2 should exist (has at least the EOT event)
    assert.ok(t2.length >= 4, 'empty track should still have EOT bytes');
    const noteOns = scrapeNoteOns(t2);
    assert.equal(noteOns.length, 0, 'empty track should have no note-ons');
  });
});
