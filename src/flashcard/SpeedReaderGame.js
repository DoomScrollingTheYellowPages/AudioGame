// ─────────────────────────────────────────────
// SpeedReaderGame.js
// Speed-reading variant of note flashcards.
// Advances immediately on correct answer and
// tracks pace (notes/min) and first-try accuracy.
// ─────────────────────────────────────────────

import { StaffRenderer }                from './StaffRenderer.js';
import { FingeringRenderer, FINGERING_H } from '../fingering/FingeringRenderer.js';
import { pitchClass }                  from '../core/NoteInfo.js';

// All chromatic notes — treble clef C4–A♯5 (MIDI 60–82)
const TREBLE_NOTES = Array.from({ length: 23 }, (_, i) => 60 + i);
// All chromatic notes — bass clef C2–B3 (MIDI 36–59)
const BASS_NOTES   = Array.from({ length: 24 }, (_, i) => 36 + i);

export class SpeedReaderGame {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {EventBus}          bus
   * @param {object}            ui    — { npmEl, notesEl, accuracyEl, streakEl, feedbackEl, timerEl }
   * @param {Synth|null}        synth — optional Synth for note playback on correct answer
   */
  constructor(canvas, bus, ui, synth = null) {
    this._canvas           = canvas;
    this._staffRenderer    = new StaffRenderer(canvas);
    this._fingeringRenderer = new FingeringRenderer(canvas);
    this._mode             = 'staff';
    this.renderer          = this._staffRenderer;
    this.bus               = bus;
    this.ui                = ui;
    this._synth            = synth;

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

    this._clefMode      = 'treble';

    this._advanceTimer  = null;
    this._wrongTimer    = null;
    this._timerInterval = null;

    this._onMidiNote   = ({ note }) => this.submitAnswer(pitchClass(note));
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

    const pool = this._notePool();
    let note;
    do {
      note = pool[Math.floor(Math.random() * pool.length)];
    } while (note === this.currentNote && pool.length > 1);

    this.currentNote = note;
    this.renderer.render(note, 'normal');
    this._setFeedback('', '');
  }

  /** @param {'treble'|'bass'|'both'} mode */
  setClefMode(mode) {
    this._clefMode = mode;
    this.nextNote();
  }

  /** @returns {number[]} */
  _notePool() {
    if (this._clefMode === 'bass') return BASS_NOTES;
    if (this._clefMode === 'both') return [...TREBLE_NOTES, ...BASS_NOTES];
    return TREBLE_NOTES;
  }

  submitAnswer(noteName) {
    if (this._solved || !noteName || this.currentNote === null) return;

    const info = this.renderer.getNoteInfo(this.currentNote);
    if (!info) return;

    if (noteName === pitchClass(this.currentNote)) {
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

  /**
   * Switch between 'staff' and 'fingering' display modes.
   * @param {'staff'|'fingering'} mode
   */
  setMode(mode) {
    if (mode === this._mode) return;
    this._mode    = mode;
    this.renderer = mode === 'fingering' ? this._fingeringRenderer : this._staffRenderer;
    // Resize canvas to match renderer requirements
    this._canvas.height = mode === 'fingering' ? FINGERING_H : 200;
    if (this.currentNote !== null) {
      this.renderer.render(this.currentNote, 'normal');
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
