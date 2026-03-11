// ─────────────────────────────────────────────
// Synth — Web Audio MIDI sound generation
// ─────────────────────────────────────────────
// Provides an electric piano voice and a
// metronome click using the Web Audio API.
// No external samples — pure synthesis.
//
// Usage:
//   const synth = new Synth();
//   synth.noteOn(60, 100);   // C4 velocity 100
//   synth.noteOff(60);
//   synth.clickMetronome(true);  // accented beat
// ─────────────────────────────────────────────

// ── MIDI note → frequency ─────────────────────
function midiToFreq(note) {
  return 440 * Math.pow(2, (note - 69) / 12);
}

export class Synth {
  constructor() {
    this._ctx = null;
    this._masterGain = null;
    this._metronomeGain = null;
    this._voices = new Map(); // note → { oscs, gain }
    this._masterVolume = 0.5;
    this._metronomeVolume = 0.5;
  }

  // ── Lazy AudioContext (must be after user gesture) ──

  _ensureContext() {
    if (this._ctx) return;
    this._ctx = new (window.AudioContext || window.webkitAudioContext)();

    // Master output for instrument voices
    this._masterGain = this._ctx.createGain();
    this._masterGain.gain.value = this._masterVolume;
    this._masterGain.connect(this._ctx.destination);

    // Separate gain for metronome
    this._metronomeGain = this._ctx.createGain();
    this._metronomeGain.gain.value = this._metronomeVolume;
    this._metronomeGain.connect(this._ctx.destination);
  }

  // ── Volume controls ─────────────────────────

  /** @param {number} v  0.0–1.0 */
  setMasterVolume(v) {
    this._masterVolume = v;
    if (this._masterGain) this._masterGain.gain.value = v;
  }

  /** @param {number} v  0.0–1.0 */
  setMetronomeVolume(v) {
    this._metronomeVolume = v;
    if (this._metronomeGain) this._metronomeGain.gain.value = v;
  }

  // ── Electric Piano voice ────────────────────
  // Two detuned sine oscillators + a quiet second
  // harmonic, shaped by an ADSR envelope.

  /**
   * @param {number} note     MIDI note number
   * @param {number} velocity 0–127
   */
  noteOn(note, velocity = 100) {
    this._ensureContext();
    // Stop any existing voice on the same note
    this.noteOff(note);

    const ctx = this._ctx;
    const now = ctx.currentTime;
    const freq = midiToFreq(note);
    const amp = (velocity / 127) * 0.3;

    // Voice gain (ADSR envelope)
    const voiceGain = ctx.createGain();
    voiceGain.gain.setValueAtTime(0, now);
    voiceGain.gain.linearRampToValueAtTime(amp, now + 0.01);       // attack 10ms
    voiceGain.gain.linearRampToValueAtTime(amp * 0.6, now + 0.15); // decay → sustain
    voiceGain.connect(this._masterGain);

    // Oscillator 1: fundamental sine
    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.value = freq;
    osc1.connect(voiceGain);
    osc1.start(now);

    // Oscillator 2: slight detune for warmth
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = freq * 1.003;
    const osc2Gain = ctx.createGain();
    osc2Gain.gain.value = 0.5;
    osc2.connect(osc2Gain);
    osc2Gain.connect(voiceGain);
    osc2.start(now);

    // Oscillator 3: second harmonic (quiet) for brightness
    const osc3 = ctx.createOscillator();
    osc3.type = 'sine';
    osc3.frequency.value = freq * 2;
    const osc3Gain = ctx.createGain();
    osc3Gain.gain.value = 0.15;
    osc3.connect(osc3Gain);
    osc3Gain.connect(voiceGain);
    osc3.start(now);

    this._voices.set(note, { oscs: [osc1, osc2, osc3], gain: voiceGain });
  }

  /** @param {number} note  MIDI note number */
  noteOff(note) {
    const voice = this._voices.get(note);
    if (!voice) return;

    const ctx = this._ctx;
    const now = ctx.currentTime;

    // Release ramp
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
    voice.gain.gain.linearRampToValueAtTime(0, now + 0.3); // 300ms release

    // Clean up after release
    const oscs = voice.oscs;
    setTimeout(() => {
      for (const o of oscs) {
        try { o.stop(); } catch (_) { /* already stopped */ }
      }
    }, 400);

    this._voices.delete(note);
  }

  // ── Metronome click ─────────────────────────
  // Short pitched ping — higher pitch for accented beats.

  /**
   * @param {boolean} accented  true for beat 1 (downbeat)
   */
  clickMetronome(accented = false) {
    this._ensureContext();
    const ctx = this._ctx;
    const now = ctx.currentTime;

    const freq = accented ? 1200 : 800;
    const duration = 0.03;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.8, now);
    env.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(env);
    env.connect(this._metronomeGain);
    osc.start(now);
    osc.stop(now + duration + 0.01);
  }

  /** Stop all voices with a short release (normal song-end). */
  allNotesOff() {
    for (const [note] of this._voices) this.noteOff(note);
  }

  /** Immediately silence all voices — no release ramp (use for Stop button). */
  hardStop() {
    if (!this._ctx) return;
    const now = this._ctx.currentTime;
    for (const [, voice] of this._voices) {
      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setValueAtTime(0, now);
      for (const o of voice.oscs) {
        try { o.stop(now); } catch (_) { /* already stopped */ }
      }
    }
    this._voices.clear();
  }

  // ── Cleanup ─────────────────────────────────

  destroy() {
    for (const [note] of this._voices) this.noteOff(note);
    if (this._ctx && this._ctx.state !== 'closed') {
      this._ctx.close();
    }
    this._ctx = null;
  }
}
