// ─────────────────────────────────────────────
// FlashcardGame.js
// Game logic for the music notation flashcard
// game. Manages note selection, answer checking,
// scoring, and communicates results via callbacks.
// ─────────────────────────────────────────────

import { StaffRenderer } from './StaffRenderer.js';

// All 12 chromatic pitch names (sharps)
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// ── Note pools by clef ────────────────────────
// Treble: C4 (60) through A♯5 (82)
const TREBLE_NOTES = Array.from({ length: 23 }, (_, i) => 60 + i);
// Bass: C2 (36) through B3 (59)
const BASS_NOTES   = Array.from({ length: 24 }, (_, i) => 36 + i);

export class FlashcardGame {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {EventBus}          bus
   * @param {object}            ui     — { scoreEl, streakEl, feedbackEl, nextBtn }
   * @param {Synth|null}        synth  — optional Synth instance for note playback
   */
  constructor(canvas, bus, ui, synth = null) {
    this.renderer    = new StaffRenderer(canvas);
    this.bus         = bus;
    this.ui          = ui;
    this._synth      = synth;

    // 'treble' | 'bass' | 'both'
    this._clefMode   = 'treble';

    this.currentNote = null;
    this.answered    = false;
    this.correct     = 0;
    this.total       = 0;
    this.streak      = 0;

    this._advanceTimer  = null;
    this._playbackTimer = null;

    // MIDI input
    this._onMidiNote   = ({ note }) => this.submitAnswer(this._pitchName(note));
    bus.on('midi:noteOn', this._onMidiNote);

    // Audio pitch (noteName already includes # from PitchDetector)
    this._onAudioPitch = ({ noteName }) => this.submitAnswer(noteName);
    bus.on('audio:pitch', this._onAudioPitch);
  }

  // ── Public API ───────────────────────────────

  /**
   * Switch clef mode and immediately show a new note.
   * @param {'treble'|'bass'|'both'} mode
   */
  setClefMode(mode) {
    this._clefMode = mode;
    this.nextNote();
  }

  start() {
    this.correct = 0;
    this.total   = 0;
    this.streak  = 0;
    this.nextNote();
  }

  nextNote() {
    clearTimeout(this._advanceTimer);
    clearTimeout(this._playbackTimer);
    this._stopPlayback();
    this.answered = false;
    this._hideNext();

    const pool = this._notePool();
    let note;
    do {
      note = pool[Math.floor(Math.random() * pool.length)];
    } while (note === this.currentNote && pool.length > 1);

    this.currentNote = note;
    this.renderer.render(note, 'normal');
    this._setFeedback('', '');
    this._updateScore();
  }

  submitAnswer(noteName) {
    if (this.answered || !noteName || !this.currentNote) return;

    const info = this.renderer.getNoteInfo(this.currentNote);
    if (!info) return;

    this.answered = true;
    this.total++;

    const correct = noteName === info.letter;

    if (correct) {
      this.correct++;
      this.streak++;
      this.renderer.render(this.currentNote, 'correct');
      this._setFeedback(`Correct!  ${info.name}`, 'correct');
    } else {
      this.streak = 0;
      this.renderer.render(this.currentNote, 'wrong');
      this._setFeedback(`That was ${noteName}. Answer: ${info.name}`, 'wrong');
    }

    // Play back the correct note after a short pause
    this._schedulePlayback(this.currentNote);

    this._updateScore();
    this._showNext();
    this._advanceTimer = setTimeout(() => this.nextNote(), 2200);
  }

  destroy() {
    clearTimeout(this._advanceTimer);
    clearTimeout(this._playbackTimer);
    this._stopPlayback();
    this.bus.off('midi:noteOn', this._onMidiNote);
    this.bus.off('audio:pitch', this._onAudioPitch);
  }

  // ── Private helpers ──────────────────────────

  _notePool() {
    if (this._clefMode === 'treble') return TREBLE_NOTES;
    if (this._clefMode === 'bass')   return BASS_NOTES;
    return [...TREBLE_NOTES, ...BASS_NOTES];
  }

  /** Convert MIDI note number to its pitch name (e.g. 'C', 'C#'). */
  _pitchName(midiNote) {
    return NOTE_NAMES[midiNote % 12];
  }

  /** Play the current note immediately (for manual replay button). */
  playCurrentNote() {
    if (this.currentNote !== null) this._schedulePlayback(this.currentNote);
  }

  /** Play the note via Synth ~120ms after calling (allows feedback to render first). */
  _schedulePlayback(midiNote) {
    if (!this._synth) return;
    clearTimeout(this._playbackTimer);
    this._playbackTimer = setTimeout(() => {
      this._synth.noteOn(midiNote, 80);
      setTimeout(() => this._synth.noteOff(midiNote), 900);
    }, 120);
  }

  _stopPlayback() {
    if (this._synth && this.currentNote !== null) {
      this._synth.noteOff(this.currentNote);
    }
  }

  _updateScore() {
    const pct = this.total > 0 ? Math.round((this.correct / this.total) * 100) : 0;
    this.ui.scoreEl.textContent  = `${this.correct} / ${this.total}  (${pct}%)`;
    this.ui.streakEl.textContent = `streak  ${this.streak}`;
  }

  _setFeedback(text, state) {
    this.ui.feedbackEl.textContent   = text;
    this.ui.feedbackEl.dataset.state = state;
  }

  _showNext() { this.ui.nextBtn.style.display = 'inline-block'; }
  _hideNext() { this.ui.nextBtn.style.display = 'none'; }
}
