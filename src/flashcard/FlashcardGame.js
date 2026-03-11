// ─────────────────────────────────────────────
// FlashcardGame.js
// Game logic for the music notation flashcard
// game. Manages note selection, answer checking,
// scoring, and communicates results via callbacks.
// ─────────────────────────────────────────────

import { StaffRenderer } from './StaffRenderer.js';

// Natural notes available in the game (treble clef, C4–A5)
const GAME_NOTES = [60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79, 81];

// Pitch-class letter for any MIDI note (naturals + sharps; returns null for accidentals)
const CHROMATIC_LETTERS = ['C', null, 'D', null, 'E', 'F', null, 'G', null, 'A', null, 'B'];

export class FlashcardGame {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {EventBus}          bus     - shared EventBus instance
   * @param {object}            ui      - { scoreEl, streakEl, feedbackEl, nextBtn }
   */
  constructor(canvas, bus, ui) {
    this.renderer    = new StaffRenderer(canvas);
    this.bus         = bus;
    this.ui          = ui;

    this.currentNote = null;
    this.answered    = false;
    this.correct     = 0;
    this.total       = 0;
    this.streak      = 0;

    // Auto-advance timer handle
    this._advanceTimer = null;

    // MIDI input listener
    this._onMidiNote = ({ note }) => this.submitAnswer(this._pitchLetter(note));
    bus.on('midi:noteOn', this._onMidiNote);
  }

  // ── Public API ───────────────────────────────

  start() {
    this.correct = 0;
    this.total   = 0;
    this.streak  = 0;
    this.nextNote();
  }

  nextNote() {
    clearTimeout(this._advanceTimer);
    this.answered = false;
    this._hideNext();

    // Pick a new random note (avoid immediate repeat)
    let note;
    do {
      note = GAME_NOTES[Math.floor(Math.random() * GAME_NOTES.length)];
    } while (note === this.currentNote && GAME_NOTES.length > 1);

    this.currentNote = note;
    this.renderer.render(note, 'normal');
    this._setFeedback('', '');
    this._updateScore();
  }

  submitAnswer(letter) {
    if (this.answered || !letter || !this.currentNote) return;

    const info = this.renderer.getNoteInfo(this.currentNote);
    if (!info) return;

    this.answered = true;
    this.total++;

    if (letter === info.letter) {
      this.correct++;
      this.streak++;
      this.renderer.render(this.currentNote, 'correct');
      this._setFeedback(`Correct!  ${info.name}`, 'correct');
    } else {
      this.streak = 0;
      this.renderer.render(this.currentNote, 'wrong');
      this._setFeedback(`That was ${letter}. Answer: ${info.name}`, 'wrong');
    }

    this._updateScore();
    this._showNext();

    // Auto-advance after a short pause
    this._advanceTimer = setTimeout(() => this.nextNote(), 2000);
  }

  destroy() {
    clearTimeout(this._advanceTimer);
    this.bus.off('midi:noteOn', this._onMidiNote);
  }

  // ── Private helpers ──────────────────────────

  _pitchLetter(midiNote) {
    return CHROMATIC_LETTERS[midiNote % 12] ?? null;
  }

  _updateScore() {
    const pct = this.total > 0 ? Math.round((this.correct / this.total) * 100) : 0;
    this.ui.scoreEl.textContent  = `${this.correct} / ${this.total}  (${pct}%)`;
    this.ui.streakEl.textContent = `streak  ${this.streak}`;
  }

  _setFeedback(text, state) {
    this.ui.feedbackEl.textContent = text;
    this.ui.feedbackEl.dataset.state = state;
  }

  _showNext() {
    this.ui.nextBtn.style.display = 'inline-block';
  }

  _hideNext() {
    this.ui.nextBtn.style.display = 'none';
  }
}
