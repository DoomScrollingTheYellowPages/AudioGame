// ─────────────────────────────────────────────
// GuitarTabData — guitar tablature fingering data
// Maps MIDI notes to string/fret positions
// ─────────────────────────────────────────────

// Standard tuning: E2=40, A2=45, D3=50, G3=55, B3=59, E4=64
const OPEN_STRINGS = [40, 45, 50, 55, 59, 64]; // low to high (6th to 1st)
const STRING_NAMES = ['E', 'A', 'D', 'G', 'B', 'e'];
const MAX_FRET = 22;

/**
 * Guitar tab fingering map.
 * Built dynamically from open string tuning.
 */
const GUITAR_TAB = {};

// Build tab data: for each MIDI note, find the best string/fret combo
for (let midi = 40; midi <= 88; midi++) {
  const positions = [];
  for (let s = 0; s < 6; s++) {
    const fret = midi - OPEN_STRINGS[s];
    if (fret >= 0 && fret <= MAX_FRET) {
      // Guitar convention: string 6 = low E, string 1 = high E
      positions.push({ string: 6 - s, fret, stringName: STRING_NAMES[s] });
    }
  }
  if (positions.length > 0) {
    // Prefer lower fret positions (easier to play)
    positions.sort((a, b) => a.fret - b.fret);
    GUITAR_TAB[midi] = positions;
  }
}

export { GUITAR_TAB };

/**
 * Get the primary (lowest fret) tab position for a MIDI note.
 * @param {number} midiNote
 * @returns {{string: number, fret: number, stringName: string}|null}
 */
export function getPrimaryFingering(midiNote) {
  const positions = GUITAR_TAB[midiNote];
  if (!positions || positions.length === 0) return null;
  return positions[0];
}

/**
 * Get all possible positions for a MIDI note.
 * @param {number} midiNote
 * @returns {Array<{string: number, fret: number, stringName: string}>}
 */
export function getAllPositions(midiNote) {
  return GUITAR_TAB[midiNote] || [];
}
