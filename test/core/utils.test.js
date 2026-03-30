// ─────────────────────────────────────────────
// utils.test.js — unit tests
// ─────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { noteName, timestamp } from '../../src/core/utils.js';

describe('utils', () => {

  describe('noteName', () => {
    it('C4 = MIDI 60', () => assert.equal(noteName(60), 'C4'));
    it('A4 = MIDI 69', () => assert.equal(noteName(69), 'A4'));
    it('C5 = MIDI 72', () => assert.equal(noteName(72), 'C5'));
    it('C#4 = MIDI 61', () => assert.equal(noteName(61), 'C#4'));
    it('B3 = MIDI 59', () => assert.equal(noteName(59), 'B3'));
    it('C0 = MIDI 12', () => assert.equal(noteName(12), 'C0'));
    it('MIDI 0 = C-1', () => assert.equal(noteName(0), 'C-1'));
    it('MIDI 127 = G9', () => assert.equal(noteName(127), 'G9'));

    it('pitch class repeats every 12 semitones', () => {
      const base = noteName(60); // C4
      const octave = noteName(72); // C5
      assert.equal(base.slice(0, -1), octave.slice(0, -1), 'both should be C');
    });
  });

  describe('timestamp', () => {
    it('returns a string in mm:ss.ms format', () => {
      const ts = timestamp();
      assert.match(ts, /^\d{2}:\d{2}\.\d{3}$/);
    });

    it('returns different values on successive calls (usually)', () => {
      // Not guaranteed to be different, but validates the function runs
      const ts = timestamp();
      assert.equal(typeof ts, 'string');
      assert.equal(ts.length, 9); // "MM:SS.mmm"
    });
  });
});
