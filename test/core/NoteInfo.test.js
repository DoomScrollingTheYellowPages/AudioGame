// ─────────────────────────────────────────────
// NoteInfo — unit tests
// ─────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getNoteInfo, pitchClass } from '../../src/core/NoteInfo.js';

describe('NoteInfo', () => {

  describe('pitchClass', () => {
    it('returns all 12 chromatic names', () => {
      const expected = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
      for (let i = 0; i < 12; i++) {
        assert.equal(pitchClass(60 + i), expected[i]);
      }
    });
  });

  describe('getNoteInfo', () => {
    it('returns correct info for C4 (MIDI 60)', () => {
      const info = getNoteInfo(60);
      assert.equal(info.letter, 'C');
      assert.equal(info.octave, 4);
      assert.equal(info.sharp, false);
      assert.equal(info.clef, 'treble');
      assert.equal(info.staffPos, -2); // C4 is 2 below E4
    });

    it('returns correct info for E4 (MIDI 64)', () => {
      const info = getNoteInfo(64);
      assert.equal(info.staffPos, 0); // E4 = bottom treble line
      assert.equal(info.clef, 'treble');
    });

    it('identifies sharps correctly', () => {
      assert.equal(getNoteInfo(61).sharp, true);  // C#4
      assert.equal(getNoteInfo(63).sharp, true);  // D#4
      assert.equal(getNoteInfo(66).sharp, true);  // F#4
    });

    it('assigns bass clef for notes below C4', () => {
      const info = getNoteInfo(55); // G3
      assert.equal(info.clef, 'bass');
    });

    it('assigns treble clef for notes at C4 and above', () => {
      assert.equal(getNoteInfo(60).clef, 'treble');
      assert.equal(getNoteInfo(72).clef, 'treble');
    });

    it('computes bass staff positions correctly', () => {
      // G2 = MIDI 43, should be staffPos 0 in bass
      const g2 = getNoteInfo(43);
      assert.equal(g2.staffPos, 0);
      assert.equal(g2.clef, 'bass');
    });
  });
});
