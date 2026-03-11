// ─────────────────────────────────────────────
// SpeedReaderGame.js
// Speed-reading variant of note flashcards.
// Advances immediately on correct answer and
// tracks pace (notes/min) and first-try accuracy.
// ─────────────────────────────────────────────

import { StaffRenderer } from './StaffRenderer.js';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Natural notes only — treble clef C4–A5
const NATURAL_NOTES = [60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79, 81];

export class SpeedReaderGame {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {EventBus}          bus
   * @param {object}            ui    — { npmEl, notesEl, accuracyEl, streakEl, feedbackEl, timerEl }
   * @param {Synth|null}        synth — optional Synth for note playback on correct answer
   */
  constructor(canvas, bus, ui, synth = null) {
    this.renderer = new StaffRenderer(canvas);
    this.bus      = bus;
    this.ui       = ui;
    this._synth   = synth;

    this.currentNote = null;
    this._solved     = false;
    this._firstTry   = true;
    this._noteStart  = 0;

    // Session stats
    this.notesCompleted  = 0;
    this.firstTryCorrect = 0;
    this.streak          = 0;
    this.maxStreak       = 0;
    this._totalNoteMs    = 0;
    this._sessionStart   = 0;

    this._advanceTimer  = null;
    this._wrongTimer    = null;
    this._timerInterval = null;

    this._onMidiNote   = ({ note }) => this.submitAnswer(NOTE_NAMES[note % 12]);
    bus.on('midi:noteOn', this._onMidiNote);

    this._onAudioPitch = ({ noteName }) => this.submitAnswer(noteName);
    bus.on('audio:pitch', this._onAudioPitch);
  }

  // ── Public API ───────────────────────────────

  start() {
    this.notesCompleted  = 0;
    this.firstTryCorrect = 0;
    this.streak          = 0;
    this.maxStreak       = 0;
    this._totalNoteMs    = 0;
    this._sessionStart   = Date.now();

    clearInterval(this._timerInterval);
    this._timerInterval = setInterval(() => this._tickTimer(), 200);

    this._updateStats();
    this.nextNote();
  }

  nextNote() {
    clearTimeout(this._advanceTimer);
    clearTimeout(this._wrongTimer);
    this._solved   = false;
    this._firstTry = true;
    this._noteStart = Date.now();

    let note;
    do {
      note = NATURAL_NOTES[Math.floor(Math.random() * NATURAL_NOTES.length)];
    } while (note === this.currentNote && NATURAL_NOTES.length > 1);

    this.currentNote = note;
    this.renderer.render(note, 'normal');
    this._setFeedback('', '');
  }

  submitAnswer(noteName) {
    if (this._solved || !noteName || this.currentNote === null) return;

    const info = this.renderer.getNoteInfo(this.currentNote);
    if (!info) return;

    if (noteName === info.letter) {
      this._solved = true;
      const elapsed = Date.now() - this._noteStart;
      this._totalNoteMs += elapsed;
      this.notesCompleted++;

      if (this._firstTry) {
        this.firstTryCorrect++;
        this.streak++;
        if (this.streak > this.maxStreak) this.maxStreak = this.streak;
      } else {
        this.streak = 0;
      }

      this.renderer.render(this.currentNote, 'correct');
      this._setFeedback(info.name, 'correct');
      this._updateStats();

      if (this._synth) {
        const played = this.currentNote;
        this._synth.noteOn(played, 80);
        setTimeout(() => this._synth.noteOff(played), 125);
      }

      // Advance immediately after a brief flash
      this._advanceTimer = setTimeout(() => this.nextNote(), 100);
    } else {
      this._firstTry = false;
      this.renderer.render(this.currentNote, 'wrong');
      this._setFeedback(noteName, 'wrong');

      clearTimeout(this._wrongTimer);
      this._wrongTimer = setTimeout(() => {
        if (!this._solved) {
          this.renderer.render(this.currentNote, 'normal');
          this._setFeedback('', '');
        }
      }, 350);
    }
  }

  destroy() {
    clearTimeout(this._advanceTimer);
    clearTimeout(this._wrongTimer);
    clearInterval(this._timerInterval);
    this.bus.off('midi:noteOn', this._onMidiNote);
    this.bus.off('audio:pitch', this._onAudioPitch);
  }

  // ── Private helpers ──────────────────────────

  _notesPerMin() {
    if (this.notesCompleted === 0) return 0;
    return Math.round(60000 / (this._totalNoteMs / this.notesCompleted));
  }

  _accuracy() {
    if (this.notesCompleted === 0) return 100;
    return Math.round((this.firstTryCorrect / this.notesCompleted) * 100);
  }

  _tickTimer() {
    const s   = Math.floor((Date.now() - this._sessionStart) / 1000);
    const m   = Math.floor(s / 60);
    const sec = s % 60;
    this.ui.timerEl.textContent = `${m}:${sec.toString().padStart(2, '0')}`;
  }

  _updateStats() {
    const npm = this._notesPerMin();
    this.ui.npmEl.textContent      = npm > 0 ? `${npm}` : '—';
    this.ui.notesEl.textContent    = this.notesCompleted;
    this.ui.accuracyEl.textContent = `${this._accuracy()}%`;
    this.ui.streakEl.textContent   = `streak  ${this.streak}`;
  }

  _setFeedback(text, state) {
    this.ui.feedbackEl.textContent   = text;
    this.ui.feedbackEl.dataset.state = state;
  }
}
