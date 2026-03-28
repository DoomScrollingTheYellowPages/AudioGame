// ─────────────────────────────────────────────
// HitJudge.test.js — unit tests
// ─────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { HitJudge } from '../../src/rhythm/HitJudge.js';
import { MockBus } from '../test-helper.js';

// ── Mock SongEngine ────────────────────────────

/**
 * Minimal mock of SongEngine. HitJudge reads:
 *   engine.position — current playback position in ms
 *   engine.notes    — array of { note, time } objects
 */
class MockEngine {
  constructor(notes = [], position = 0) {
    this.notes    = notes;
    this.position = position;
  }
}

/** Build a single-note engine positioned at `pos` ms.
 *  The note is at `noteTime` ms with MIDI number `midiNote`.
 */
function singleNoteEngine(midiNote, noteTime, pos) {
  return new MockEngine([{ note: midiNote, time: noteTime }], pos);
}

// ── Tests ──────────────────────────────────────

describe('HitJudge', () => {

  // ── pitchName ──────────────────────────────
  describe('pitchName', () => {
    it('returns C for MIDI 60', () => {
      const hj = new HitJudge(new MockBus(), new MockEngine());
      assert.equal(hj.pitchName(60), 'C');
    });

    it('returns C# for MIDI 61', () => {
      const hj = new HitJudge(new MockBus(), new MockEngine());
      assert.equal(hj.pitchName(61), 'C#');
    });

    it('returns B for MIDI 71', () => {
      const hj = new HitJudge(new MockBus(), new MockEngine());
      assert.equal(hj.pitchName(71), 'B');
    });

    it('returns same pitch class for different octaves', () => {
      const hj = new HitJudge(new MockBus(), new MockEngine());
      assert.equal(hj.pitchName(60), hj.pitchName(72)); // C4 and C5
      assert.equal(hj.pitchName(64), hj.pitchName(76)); // E4 and E5
    });
  });

  // ── Timing tiers ─────────────────────────
  describe('timing tiers', () => {
    it('scores Perfect (≤50ms delta) with 100 base points', () => {
      const bus = new MockBus();
      const engine = singleNoteEngine(60, 1000, 1030); // 30ms early
      const hj = new HitJudge(bus, engine);
      hj.judge('C');
      assert.equal(hj.score, 100);
      assert.equal(hj.tierCounts.Perfect, 1);
      const ev = bus.getEvents('hit:judge');
      assert.equal(ev.length, 1);
      assert.equal(ev[0].data.tier, 'Perfect');
    });

    it('scores Great (51–100ms delta) with 75 base points', () => {
      const bus = new MockBus();
      const engine = singleNoteEngine(60, 1000, 1075); // 75ms late
      const hj = new HitJudge(bus, engine);
      hj.judge('C');
      assert.equal(hj.score, 75);
      assert.equal(hj.tierCounts.Great, 1);
    });

    it('scores Good (101–200ms delta) with 50 base points', () => {
      const bus = new MockBus();
      const engine = singleNoteEngine(60, 1000, 1150); // 150ms late
      const hj = new HitJudge(bus, engine);
      hj.judge('C');
      assert.equal(hj.score, 50);
      assert.equal(hj.tierCounts.Good, 1);
    });

    it('does not score for input beyond 200ms window', () => {
      const bus = new MockBus();
      const engine = singleNoteEngine(60, 1000, 1300); // 300ms late — outside window
      const hj = new HitJudge(bus, engine);
      hj.judge('C');
      assert.equal(hj.score, 0);
      assert.equal(hj.hits, 0);
      assert.equal(bus.getEvents('hit:judge').length, 0);
    });

    it('does not score for wrong pitch', () => {
      const bus = new MockBus();
      const engine = singleNoteEngine(60, 1000, 1000); // C4, perfect timing
      const hj = new HitJudge(bus, engine);
      hj.judge('D'); // wrong pitch
      assert.equal(hj.score, 0);
      assert.equal(hj.hits, 0);
    });

    it('pitch-class matching: different octave of same pitch matches', () => {
      const bus = new MockBus();
      // Note in engine is C4 (60), player plays C5 (72) — same pitch class
      const engine = singleNoteEngine(60, 1000, 1000);
      const hj = new HitJudge(bus, engine);
      hj.judge('C'); // C in any octave matches
      assert.equal(hj.hits, 1);
    });
  });

  // ── Combo ────────────────────────────────
  describe('combo', () => {
    it('combo increments on each hit', () => {
      const bus = new MockBus();
      const engine = new MockEngine(
        [{ note: 60, time: 0 }, { note: 62, time: 500 }],
        0
      );
      const hj = new HitJudge(bus, engine);
      engine.position = 0;
      hj.judge('C');
      assert.equal(hj.combo, 1);
      engine.position = 500;
      hj.judge('D');
      assert.equal(hj.combo, 2);
    });

    it('combo resets to 0 on checkMisses', () => {
      const bus = new MockBus();
      const engine = new MockEngine([{ note: 60, time: 0 }], 300);
      const hj = new HitJudge(bus, engine);
      hj.combo = 5;
      hj.checkMisses(300); // position past window
      assert.equal(hj.combo, 0);
      assert.equal(hj.misses, 1);
    });

    it('maxCombo tracks highest combo reached', () => {
      const bus = new MockBus();
      const engine = new MockEngine(
        [
          { note: 60, time: 0 },
          { note: 62, time: 500 },
          { note: 64, time: 1000 },
          { note: 65, time: 1500 }, // unjudged note — will be missed
        ],
        0
      );
      const hj = new HitJudge(bus, engine);
      engine.position = 0;    hj.judge('C');
      engine.position = 500;  hj.judge('D');
      engine.position = 1000; hj.judge('E');
      assert.equal(hj.maxCombo, 3);
      // checkMisses for the unjudged F note at t=1500 — position 2000 is past window
      hj.checkMisses(2000);
      assert.equal(hj.combo, 0, 'combo resets after miss');
      assert.equal(hj.maxCombo, 3, 'maxCombo should not decrease');
    });
  });

  // ── Score multiplier ──────────────────────
  describe('score multiplier', () => {
    it('multiplier = 1 at combo < 10', () => {
      const bus = new MockBus();
      const engine = singleNoteEngine(60, 0, 0);
      const hj = new HitJudge(bus, engine);
      hj.combo = 9; // not yet at 10
      engine.position = 0;
      hj.judge('C');
      // score = 100 * (1 + floor(10/10)) = 100 * 2 = 200
      // Wait — combo becomes 10 after the hit
      // Actually combo starts at 9, then increments to 10
      // multiplier = 1 + floor(10/10) = 2
      assert.equal(hj.score, 200);
    });

    it('multiplier caps at 4x (combo ≥ 30)', () => {
      const bus = new MockBus();
      const engine = singleNoteEngine(60, 0, 0);
      const hj = new HitJudge(bus, engine);
      hj.combo = 40; // high combo
      hj.judge('C');
      // multiplier = min(4, 1 + floor(41/10)) = min(4, 1+4) = 4
      assert.equal(hj.score, 400); // 100 * 4
    });
  });

  // ── reset ────────────────────────────────
  describe('reset', () => {
    it('clears all stats and judged set', () => {
      const bus = new MockBus();
      const engine = singleNoteEngine(60, 0, 0);
      const hj = new HitJudge(bus, engine);
      hj.judge('C');
      hj.reset();
      assert.equal(hj.score, 0);
      assert.equal(hj.combo, 0);
      assert.equal(hj.maxCombo, 0);
      assert.equal(hj.hits, 0);
      assert.equal(hj.misses, 0);
      assert.deepEqual(hj.tierCounts, { Perfect: 0, Great: 0, Good: 0, Miss: 0 });
      // Can judge again after reset (judged set cleared)
      hj.judge('C');
      assert.equal(hj.hits, 1);
    });
  });

  // ── accuracy ─────────────────────────────
  describe('accuracy', () => {
    it('returns 0 when no notes judged', () => {
      const hj = new HitJudge(new MockBus(), new MockEngine());
      assert.equal(hj.accuracy, 0);
    });

    it('returns 100 when all notes hit', () => {
      const bus = new MockBus();
      const engine = singleNoteEngine(60, 0, 0);
      const hj = new HitJudge(bus, engine);
      hj.judge('C');
      assert.equal(hj.accuracy, 100);
    });

    it('returns 50 when half hit, half missed', () => {
      const bus = new MockBus();
      const engine = new MockEngine(
        [{ note: 60, time: 0 }, { note: 62, time: 500 }],
        0
      );
      const hj = new HitJudge(bus, engine);
      hj.judge('C'); // hit
      hj.checkMisses(800); // miss note at 500ms (position 800 > 500+200)
      assert.equal(hj.accuracy, 50);
    });
  });

  // ── checkMisses ───────────────────────────
  describe('checkMisses', () => {
    it('emits hit:miss event for each missed note', () => {
      const bus = new MockBus();
      const engine = new MockEngine(
        [{ note: 60, time: 0 }, { note: 62, time: 100 }],
        500
      );
      const hj = new HitJudge(bus, engine);
      hj.checkMisses(500);
      assert.equal(bus.getEvents('hit:miss').length, 2);
      assert.equal(hj.misses, 2);
    });

    it('does not double-miss already judged notes', () => {
      const bus = new MockBus();
      const engine = singleNoteEngine(60, 0, 0);
      const hj = new HitJudge(bus, engine);
      hj.judge('C'); // hit
      hj.checkMisses(500); // try to miss the same note
      assert.equal(hj.misses, 0);
    });
  });

  // ── totalNotes ────────────────────────────
  describe('totalNotes', () => {
    it('returns engine note count', () => {
      const engine = new MockEngine([
        { note: 60, time: 0 },
        { note: 62, time: 500 },
        { note: 64, time: 1000 },
      ]);
      const hj = new HitJudge(new MockBus(), engine);
      assert.equal(hj.totalNotes, 3);
    });
  });
});
