// ─────────────────────────────────────────────
// SpeedReaderGame.test.js — unit tests
// ─────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SpeedReaderGame } from '../../src/flashcard/SpeedReaderGame.js';
import { MockBus } from '../test-helper.js';

// ── Minimal mocks ─────────────────────────────

/** Mock renderer — no canvas needed. */
class MockRenderer {
  constructor() { this._rendered = []; }
  render(note, state) { this._rendered.push({ note, state }); }
  getNoteInfo(note) { return { name: 'C4' }; }
}

/** Mock canvas with minimal stubs. */
function mockCanvas() {
  return { height: 200, getContext: () => null };
}

/** Build a SpeedReaderGame with mocked canvas and renderer. */
function makeGame(clefMode = null) {
  const bus = new MockBus();
  const canvas = mockCanvas();
  const ui = {
    npmEl:      { textContent: '' },
    notesEl:    { textContent: '' },
    accuracyEl: { textContent: '' },
    streakEl:   { textContent: '' },
    feedbackEl: { textContent: '', dataset: {} },
    timerEl:    { textContent: '' },
  };
  const game = new SpeedReaderGame(canvas, bus, ui, null);

  // Swap renderer so render() is a no-op (avoids canvas dependency)
  game._staffRenderer    = new MockRenderer();
  game._fingeringRenderer = new MockRenderer();
  game.renderer          = game._staffRenderer;

  if (clefMode) game.setClefMode(clefMode);

  return { game, bus };
}

// ── Tests ──────────────────────────────────────

describe('SpeedReaderGame', () => {

  describe('clef mode', () => {
    it('default clef mode is treble', () => {
      const { game } = makeGame();
      assert.equal(game._clefMode, 'treble');
    });

    it('setClefMode treble → pool contains only treble notes (60–82)', () => {
      const { game } = makeGame('treble');
      const pool = game._notePool();
      assert.ok(pool.every(n => n >= 60 && n <= 82),
        'all treble notes should be 60–82');
      assert.equal(pool.length, 23);
    });

    it('setClefMode bass → pool contains only bass notes (36–59)', () => {
      const { game } = makeGame('bass');
      const pool = game._notePool();
      assert.ok(pool.every(n => n >= 36 && n <= 59),
        'all bass notes should be 36–59');
      assert.equal(pool.length, 24);
    });

    it('setClefMode both → pool contains treble + bass (36–82)', () => {
      const { game } = makeGame('both');
      const pool = game._notePool();
      assert.ok(pool.some(n => n < 60), 'should include bass notes');
      assert.ok(pool.some(n => n >= 60), 'should include treble notes');
      assert.equal(pool.length, 47); // 23 treble + 24 bass
    });

    it('setClefMode calls nextNote (sets currentNote)', () => {
      const { game } = makeGame();
      game.setClefMode('bass');
      // After setClefMode, nextNote() should have been called, setting currentNote
      assert.ok(game.currentNote !== null,
        'currentNote should be set after setClefMode');
      // And it should be from bass pool
      assert.ok(game.currentNote >= 36 && game.currentNote <= 59,
        `currentNote ${game.currentNote} should be in bass range`);
    });
  });

  describe('submitAnswer', () => {
    it('correct answer increments notesCompleted', () => {
      const { game } = makeGame('treble');
      game.currentNote = 60; // C4
      game._solved = false;
      game._firstTry = true;
      game._noteStart = Date.now();
      game.submitAnswer('C'); // correct pitch class for MIDI 60
      assert.equal(game.notesCompleted, 1);
    });

    it('wrong answer keeps notesCompleted unchanged', () => {
      const { game } = makeGame('treble');
      game.currentNote = 60; // C4
      game._solved = false;
      game._firstTry = true;
      game.submitAnswer('D'); // wrong
      assert.equal(game.notesCompleted, 0);
    });

    it('wrong answer sets _firstTry to false', () => {
      const { game } = makeGame('treble');
      game.currentNote = 60;
      game._solved = false;
      game._firstTry = true;
      game.submitAnswer('G'); // wrong
      assert.equal(game._firstTry, false);
    });

    it('submitting when already solved is ignored', () => {
      const { game } = makeGame('treble');
      game.currentNote = 60;
      game._solved = true; // already solved
      game.submitAnswer('C');
      assert.equal(game.notesCompleted, 0);
    });
  });

  describe('stats', () => {
    it('_notesPerMin returns 0 before any notes completed', () => {
      const { game } = makeGame();
      assert.equal(game._notesPerMin(), 0);
    });

    it('_accuracy returns 100 when no notes have been answered', () => {
      const { game } = makeGame();
      assert.equal(game._accuracy(), 100);
    });

    it('accuracy is 100% when all first-try correct', () => {
      const { game } = makeGame('treble');
      game.notesCompleted  = 3;
      game.firstTryCorrect = 3;
      assert.equal(game._accuracy(), 100);
    });

    it('accuracy is 50% when half first-try correct', () => {
      const { game } = makeGame('treble');
      game.notesCompleted  = 4;
      game.firstTryCorrect = 2;
      assert.equal(game._accuracy(), 50);
    });
  });

  describe('destroy', () => {
    it('destroy unsubscribes MIDI and audio handlers without error', () => {
      const { game } = makeGame();
      assert.doesNotThrow(() => game.destroy());
    });
  });
});
