// ─────────────────────────────────────────────
// OMRPlayer.js — in-browser Web Audio synthesizer
// for OMR-detected note sequences
// ─────────────────────────────────────────────

const NOTE_GAP = 0.05;     // silence (s) between notes
const ATTACK   = 0.01;     // gain ramp-up time (s)
const RELEASE  = 0.05;     // gain ramp-down time (s)

export class OMRPlayer {
  /**
   * @param {AudioContext} [audioContext] - injected for testing; created lazily if null
   */
  constructor(audioContext = null) {
    this._ctx = audioContext;
    this._gainNodes = [];
    this._playing = false;
    this._endTimer = null;
  }

  /** Convert MIDI note number to frequency in Hz. */
  static midiToFreq(midiNote) {
    return 440 * Math.pow(2, (midiNote - 69) / 12);
  }

  get isPlaying() { return this._playing; }

  /**
   * Play all notes sequentially at the given BPM.
   * Notes are sorted by their array order (caller is responsible for ordering).
   * @param {Array<{midiNote: number, beats: number}>} notes
   * @param {number} bpm
   */
  play(notes, bpm) {
    this.stop();

    if (!this._ctx) {
      this._ctx = new AudioContext();
    }

    if (notes.length === 0) return;

    const beatDuration = 60 / bpm;
    let startTime = this._ctx.currentTime + 0.05; // small scheduling buffer

    this._gainNodes = [];
    this._playing = true;

    for (const note of notes) {
      const noteDuration = Math.max(0.05, beatDuration * note.beats - NOTE_GAP);
      const freq = OMRPlayer.midiToFreq(note.midiNote);

      const osc = this._ctx.createOscillator();
      const gain = this._ctx.createGain();

      osc.type = 'sine';
      osc.frequency.value = freq;

      // Gain envelope
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.4, startTime + ATTACK);
      gain.gain.setValueAtTime(0.4, startTime + noteDuration - RELEASE);
      gain.gain.linearRampToValueAtTime(0, startTime + noteDuration);

      osc.connect(gain);
      gain.connect(this._ctx.destination);
      this._gainNodes.push(gain);

      osc.start(startTime);
      osc.stop(startTime + noteDuration);

      startTime += beatDuration * note.beats;
    }

    // Auto-reset isPlaying when all notes have finished
    const totalDuration = startTime - (this._ctx.currentTime + 0.05);
    this._endTimer = setTimeout(() => {
      this._playing = false;
      this._gainNodes = [];
    }, totalDuration * 1000 + 100);
  }

  /** Stop all playback immediately. */
  stop() {
    if (this._endTimer) {
      clearTimeout(this._endTimer);
      this._endTimer = null;
    }
    for (const g of this._gainNodes) {
      try { g.disconnect(); } catch (_) { /* already disconnected */ }
    }
    this._gainNodes = [];
    this._playing = false;
  }
}
