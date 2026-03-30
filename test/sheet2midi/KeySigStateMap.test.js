// ─────────────────────────────────────────────
// KeySigStateMap + enharmonicSpelling — unit tests
// ─────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { KeySigStateMap, enharmonicSpelling } from '../../src/sheet2midi/KeySigStateMap.js';

describe('enharmonicSpelling', () => {
  it('derives E4 from diatonic position d=30', () => {
    const result = enharmonicSpelling(30, 0);
    assert.equal(result.noteName, 'E');
    assert.equal(result.octave, 4);
    assert.equal(result.midiNote, 64);
  });

  it('derives C4 from d=28', () => {
    const result = enharmonicSpelling(28, 0);
    assert.equal(result.noteName, 'C');
    assert.equal(result.octave, 4);
    assert.equal(result.midiNote, 60);
  });

  it('derives C#4 from d=28 with sharp', () => {
    const result = enharmonicSpelling(28, 1);
    assert.equal(result.noteName, 'C#');
    assert.equal(result.octave, 4);
    assert.equal(result.midiNote, 61);
  });

  it('derives Bb3 from d=27 with flat', () => {
    // d=27: octave=3, degree=6=B. B3=MIDI 59, Bb3=58
    const result = enharmonicSpelling(27, -1);
    assert.equal(result.noteName, 'Bb');
    assert.equal(result.octave, 3);
    assert.equal(result.midiNote, 58);
  });

  it('derives F#4 from d=31 with sharp (not Gb)', () => {
    // d=31: octave=4, degree=3=F. F4=MIDI 65, F#4=66
    const result = enharmonicSpelling(31, 1);
    assert.equal(result.noteName, 'F#');
    assert.equal(result.octave, 4);
    assert.equal(result.midiNote, 66);
  });

  it('derives G2 from d=18', () => {
    const result = enharmonicSpelling(18, 0);
    assert.equal(result.noteName, 'G');
    assert.equal(result.octave, 2);
    assert.equal(result.midiNote, 43);
  });

  it('derives middle C (C4) from d=28, no accidental', () => {
    const result = enharmonicSpelling(28, 0);
    assert.equal(result.noteName, 'C');
    assert.equal(result.octave, 4);
    assert.equal(result.midiNote, 60);
  });
});

describe('KeySigStateMap', () => {
  describe('initialization from key signature', () => {
    it('starts with no accidentals for C major', () => {
      const map = new KeySigStateMap(new Set(), new Set());
      // D4 (d=29) in C major has no accidental
      assert.equal(map.getAccidental('D'), 0);
      assert.equal(map.getAccidental('F'), 0);
    });

    it('applies key sig sharps (G major: F#)', () => {
      const map = new KeySigStateMap(new Set(['F']), new Set());
      assert.equal(map.getAccidental('F'), 1);
      assert.equal(map.getAccidental('C'), 0);
    });

    it('applies key sig flats (F major: Bb)', () => {
      const map = new KeySigStateMap(new Set(), new Set(['B']));
      assert.equal(map.getAccidental('B'), -1);
      assert.equal(map.getAccidental('E'), 0);
    });

    it('applies multiple sharps (D major: F#, C#)', () => {
      const map = new KeySigStateMap(new Set(['F', 'C']), new Set());
      assert.equal(map.getAccidental('F'), 1);
      assert.equal(map.getAccidental('C'), 1);
      assert.equal(map.getAccidental('G'), 0);
    });
  });

  describe('inline accidental updates', () => {
    it('applies an inline sharp', () => {
      const map = new KeySigStateMap(new Set(), new Set());
      map.applyInlineAccidental('C', 1); // C#
      assert.equal(map.getAccidental('C'), 1);
    });

    it('applies an inline flat', () => {
      const map = new KeySigStateMap(new Set(), new Set());
      map.applyInlineAccidental('E', -1); // Eb
      assert.equal(map.getAccidental('E'), -1);
    });

    it('inline natural cancels key sig sharp', () => {
      const map = new KeySigStateMap(new Set(['F']), new Set());
      assert.equal(map.getAccidental('F'), 1); // F# from key sig
      map.applyInlineAccidental('F', 0); // natural
      assert.equal(map.getAccidental('F'), 0); // cancelled
    });

    it('inline accidental persists within the measure', () => {
      const map = new KeySigStateMap(new Set(), new Set());
      map.applyInlineAccidental('G', 1);
      // Second query should still show G#
      assert.equal(map.getAccidental('G'), 1);
      assert.equal(map.getAccidental('G'), 1);
    });
  });

  describe('barline reset', () => {
    it('resets inline accidentals at barline', () => {
      const map = new KeySigStateMap(new Set(), new Set());
      map.applyInlineAccidental('C', 1);
      assert.equal(map.getAccidental('C'), 1);
      map.resetAtBarline();
      assert.equal(map.getAccidental('C'), 0); // back to natural
    });

    it('preserves key sig accidentals after barline', () => {
      const map = new KeySigStateMap(new Set(['F']), new Set());
      map.applyInlineAccidental('C', 1);
      map.resetAtBarline();
      assert.equal(map.getAccidental('F'), 1); // key sig F# still active
      assert.equal(map.getAccidental('C'), 0); // inline C# reset
    });

    it('resets all inline accidentals, not just the last', () => {
      const map = new KeySigStateMap(new Set(), new Set());
      map.applyInlineAccidental('C', 1);
      map.applyInlineAccidental('D', -1);
      map.applyInlineAccidental('E', 1);
      map.resetAtBarline();
      assert.equal(map.getAccidental('C'), 0);
      assert.equal(map.getAccidental('D'), 0);
      assert.equal(map.getAccidental('E'), 0);
    });
  });

  describe('integration with enharmonicSpelling', () => {
    it('produces correct pitch for F in G major (key sig F#)', () => {
      const map = new KeySigStateMap(new Set(['F']), new Set());
      const accidental = map.getAccidental('F');
      // d=31 = F4, with accidental +1 = F#4
      const result = enharmonicSpelling(31, accidental);
      assert.equal(result.noteName, 'F#');
      assert.equal(result.midiNote, 66);
    });

    it('produces correct pitch for natural F after inline natural in G major', () => {
      const map = new KeySigStateMap(new Set(['F']), new Set());
      map.applyInlineAccidental('F', 0); // natural cancels key sig
      const accidental = map.getAccidental('F');
      // d=31 = F4
      const result = enharmonicSpelling(31, accidental);
      assert.equal(result.noteName, 'F');
      assert.equal(result.midiNote, 65);
    });
  });
});
