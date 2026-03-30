// ─────────────────────────────────────────────
// KeySigStateMap — per-measure accidental state
// tracking with barline reset. Enharmonic spelling
// from diatonic staff position.
// ─────────────────────────────────────────────

// ── Constants ──────────────────────────────────

// Diatonic semitones from C within an octave: C=0, D=2, E=4, F=5, G=7, A=9, B=11
const DIATONIC_SEMITONES = [0, 2, 4, 5, 7, 9, 11];
const DIATONIC_NAMES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

// ── enharmonicSpelling ────────────────────────

/**
 * Derive note name, octave, and MIDI number from a diatonic staff position
 * and an accidental modifier. The staff position unambiguously determines
 * the letter name; the accidental determines the chromatic alteration.
 *
 * @param {number} d - absolute diatonic position (C0=0, D0=1, ..., E4=30, G2=18)
 * @param {number} accidental - semitone offset: +1 sharp, -1 flat, 0 natural
 * @returns {{noteName: string, octave: number, midiNote: number}}
 */
export function enharmonicSpelling(d, accidental) {
  const octave = Math.floor(d / 7);
  const degree = ((d % 7) + 7) % 7; // 0=C, 1=D, ..., 6=B

  let noteName = DIATONIC_NAMES[degree];
  const baseMidi = (octave + 1) * 12 + DIATONIC_SEMITONES[degree];
  const midiNote = baseMidi + accidental;

  if (accidental === 1) noteName += '#';
  else if (accidental === -1) noteName += 'b';

  return { noteName, octave, midiNote };
}

// ── KeySigStateMap ────────────────────────────

/**
 * Tracks per-measure accidental state. Initialises from the key signature,
 * allows inline accidentals to override for the remainder of the measure,
 * and resets at barlines back to the key signature state.
 */
export class KeySigStateMap {
  /**
   * @param {Set<string>} keySharps - pitch class names affected by key sig sharps
   * @param {Set<string>} keyFlats - pitch class names affected by key sig flats
   */
  constructor(keySharps, keyFlats) {
    /** @type {Map<string, number>} base accidentals from key signature */
    this._keySigState = new Map();
    for (const name of DIATONIC_NAMES) {
      if (keySharps.has(name)) this._keySigState.set(name, 1);
      else if (keyFlats.has(name)) this._keySigState.set(name, -1);
      else this._keySigState.set(name, 0);
    }

    /** @type {Map<string, number>} inline overrides for current measure */
    this._inlineState = new Map();
  }

  /**
   * Get the current accidental for a pitch class, considering both
   * key signature and any inline overrides in the current measure.
   * @param {string} pitchClass - e.g. 'C', 'F', 'B'
   * @returns {number} +1 sharp, -1 flat, 0 natural
   */
  getAccidental(pitchClass) {
    if (this._inlineState.has(pitchClass)) {
      return this._inlineState.get(pitchClass);
    }
    return this._keySigState.get(pitchClass) ?? 0;
  }

  /**
   * Apply an inline accidental encountered in the score. This overrides
   * the key signature for the remainder of the current measure.
   * @param {string} pitchClass - e.g. 'C', 'F'
   * @param {number} accidental - +1 sharp, -1 flat, 0 natural
   */
  applyInlineAccidental(pitchClass, accidental) {
    this._inlineState.set(pitchClass, accidental);
  }

  /**
   * Reset at a barline — clear all inline accidentals so only
   * key signature accidentals remain active.
   */
  resetAtBarline() {
    this._inlineState.clear();
  }
}
