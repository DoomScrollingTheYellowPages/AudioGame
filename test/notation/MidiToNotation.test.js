// ─────────────────────────────────────────────
// MidiToNotation — unit tests
// ─────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MidiToNotation } from '../../src/notation/MidiToNotation.js';

// Helper: create a simple note
function n(time, note, duration, velocity = 100) {
  return { time, note, velocity, duration };
}

describe('MidiToNotation', () => {

  describe('convert', () => {
    it('converts a C scale to notation model', () => {
      const bpm = 120;
      const meter = [4, 4];
      // 8 quarter notes at 120 BPM = 500ms each
      const notes = [
        n(0, 60, 450),     // C4
        n(500, 62, 450),   // D4
        n(1000, 64, 450),  // E4
        n(1500, 65, 450),  // F4
        n(2000, 67, 450),  // G4
        n(2500, 69, 450),  // A4
        n(3000, 71, 450),  // B4
        n(3500, 72, 450),  // C5
      ];
      const model = MidiToNotation.convert(notes, { bpm, meter });
      assert.ok(model.measures.length >= 2, `expected >= 2 measures, got ${model.measures.length}`);
      assert.equal(model.clef, 'treble');
      assert.deepEqual(model.meter, [4, 4]);
      // First measure should have 4 quarter notes
      assert.equal(model.measures[0].events.length, 4);
      // Check first note is C4
      assert.equal(model.measures[0].events[0].midiNote, 60);
      assert.equal(model.measures[0].events[0].noteName, 'C');
      assert.equal(model.measures[0].events[0].octave, 4);
    });

    it('inserts rests for gaps between notes', () => {
      const bpm = 120;
      const meter = [4, 4];
      // Note at beat 0 (1 beat), gap of 2 beats, note at beat 3
      const notes = [
        n(0, 60, 450),      // C4, quarter
        n(1500, 64, 450),   // E4, quarter at beat 3
      ];
      const model = MidiToNotation.convert(notes, { bpm, meter });
      const events = model.measures[0].events;
      // Should have note, rest(s), note
      const restEvents = events.filter(e => e.isRest);
      assert.ok(restEvents.length >= 1, 'should have at least 1 rest');
      const totalBeats = events.reduce((s, e) => s + e.beats, 0);
      assert.ok(totalBeats >= 3, `total beats should be >= 3, got ${totalBeats}`);
    });

    it('assigns correct staff positions for treble clef', () => {
      const model = MidiToNotation.convert(
        [n(0, 64, 450)], // E4 = bottom line of treble staff
        { bpm: 120, meter: [4, 4] }
      );
      const note = model.measures[0].events[0];
      assert.equal(note.staffPos, 0, 'E4 should be staffPos 0 in treble');
    });

    it('detects whole notes from long durations', () => {
      const bpm = 120;
      const model = MidiToNotation.convert(
        [n(0, 60, 1950)], // ~4 beats at 120bpm
        { bpm, meter: [4, 4] }
      );
      const note = model.measures[0].events[0];
      assert.equal(note.beats, 4, 'should quantize to 4 beats (whole note)');
      assert.equal(note.durationType, 'whole');
    });

    it('detects half notes', () => {
      const bpm = 120;
      const model = MidiToNotation.convert(
        [n(0, 60, 950)], // ~2 beats
        { bpm, meter: [4, 4] }
      );
      assert.equal(model.measures[0].events[0].beats, 2);
    });

    it('detects eighth notes', () => {
      const bpm = 120;
      const model = MidiToNotation.convert(
        [n(0, 60, 230)], // ~0.5 beats
        { bpm, meter: [4, 4] }
      );
      assert.equal(model.measures[0].events[0].beats, 0.5);
    });

    it('uses bass clef when notes are low', () => {
      const model = MidiToNotation.convert(
        [n(0, 40, 450), n(500, 43, 450)], // E2, G2
        { bpm: 120, meter: [4, 4] }
      );
      assert.equal(model.clef, 'bass');
    });

    it('handles empty note array', () => {
      const model = MidiToNotation.convert([], { bpm: 120, meter: [4, 4] });
      assert.equal(model.measures.length, 0);
    });
  });
});
