// ─────────────────────────────────────────────
// PianoFingeringData — simple key highlight data
// for piano fingering chart display
// ─────────────────────────────────────────────

// Piano doesn't need a complex fingering map — just the MIDI note
// number maps directly to a key on the keyboard. This module provides
// the interface expected by FingeringHighway for consistency.

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const IS_BLACK = [false, true, false, true, false, false, true, false, true, false, true, false];

/**
 * Get piano key info for a MIDI note.
 * @param {number} midiNote — 21 (A0) to 108 (C8)
 * @returns {{noteName: string, octave: number, isBlack: boolean, keyIndex: number}|null}
 */
export function getPrimaryFingering(midiNote) {
  if (midiNote < 21 || midiNote > 108) return null;
  const semitone = midiNote % 12;
  const octave = Math.floor(midiNote / 12) - 1;
  return {
    noteName: NOTE_NAMES[semitone],
    octave,
    isBlack: IS_BLACK[semitone],
    keyIndex: midiNote - 21, // 0-based from A0
    midiNote,
  };
}

/**
 * Get the range of piano keys.
 * @returns {{min: number, max: number}}
 */
export function getRange() {
  return { min: 21, max: 108 };
}
