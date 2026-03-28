// ─────────────────────────────────────────────
// NoteInfo.js
// Canonical note metadata for all renderers and game logic.
// Every module that needs note names, staff positions, or clef
// assignments should import from here — never maintain its own map.
// ─────────────────────────────────────────────

// Chromatic pitch-class names (sharps only)
const _PITCH_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Diatonic step within an octave (C=0 … B=6).
// Chromatic pitches share the step of their lower natural neighbor.
const _DIATONIC = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];

/**
 * @typedef {object} NoteInfo
 * @property {number}          midiNote  MIDI note number (source of truth)
 * @property {string}          letter    Natural letter name: C D E F G A B
 * @property {number}          octave    Scientific octave number (C4 = MIDI 60)
 * @property {string}          name      Display name, e.g. 'C4' or 'F#5'
 * @property {boolean}         sharp     True if the note has an accidental (chromatic)
 * @property {number}          staffPos  Diatonic staff-line position:
 *                                         treble — 0 = E4 (bottom line); +1 per step up
 *                                         bass   — 0 = G2 (bottom line); +1 per step up
 * @property {'treble'|'bass'} clef      Natural clef for this note (boundary: MIDI 60)
 */

/**
 * Build a NoteInfo for any MIDI note.
 * Works for any integer MIDI value; no range restrictions.
 *
 * Staff positions are computed algorithmically:
 *   treble: staffPos = diatonicStepsFromC4 − 2   (E4 is 2 steps above C4 → pos 0)
 *   bass:   staffPos = diatonicStepsFromC4 + 10  (G2 is −10 steps from C4 → pos 0)
 *
 * @param {number} midiNote
 * @returns {NoteInfo}
 */
export function getNoteInfo(midiNote) {
  const pitchClass = midiNote % 12;
  const octave     = Math.floor(midiNote / 12) - 1;
  const chromatic  = _PITCH_NAMES[pitchClass];
  const sharp      = chromatic.length > 1;
  const letter     = sharp ? chromatic[0] : chromatic;
  const name       = `${chromatic}${octave}`;

  // Diatonic steps above/below C4 (MIDI 60)
  const stepsFromC4 = (octave - 4) * 7 + _DIATONIC[pitchClass];

  const clef     = midiNote >= 60 ? 'treble' : 'bass';
  const staffPos = clef === 'treble'
    ? stepsFromC4 - 2    // E4 (+2 from C4) anchors at 0
    : stepsFromC4 + 10;  // G2 (-10 from C4) anchors at 0

  return { midiNote, letter, octave, name, sharp, staffPos, clef };
}

/**
 * Return the chromatic pitch-class name for a MIDI note.
 * E.g. pitchClass(60) → 'C',  pitchClass(61) → 'C#'.
 * Useful when matching raw MIDI note-on events against answer letters.
 * @param {number} midiNote
 * @returns {string}
 */
export function pitchClass(midiNote) {
  return _PITCH_NAMES[midiNote % 12];
}
