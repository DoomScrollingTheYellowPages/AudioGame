// ─────────────────────────────────────────────
// ClarinetFingeringData.js
// Bb clarinet fingering patterns (concert pitch).
// MIDI 52 (E3) through MIDI 84 (C7), chromatic.
// Primary fingering listed first; alt:true marks alternatives.
// ─────────────────────────────────────────────

/**
 * @typedef {object} ClarinetFingering
 * @property {boolean} register  Register (speaker) key
 * @property {boolean} lThumb    Left thumb hole
 * @property {boolean} l1        Left index hole
 * @property {boolean} l2        Left middle hole
 * @property {boolean} l3        Left ring hole
 * @property {boolean} r1        Right index hole
 * @property {boolean} r2        Right middle hole
 * @property {boolean} r3        Right ring hole
 * @property {boolean} rPinky    Right pinky key (Eb/C)
 * @property {boolean} [alt]     True = alternative fingering (not shown as primary)
 */

/** Helper: build a fingering object. */
function f(register, lThumb, l1, l2, l3, r1, r2, r3, rPinky, alt) {
  const obj = { register, lThumb, l1, l2, l3, r1, r2, r3, rPinky };
  if (alt) obj.alt = true;
  return obj;
}

/** MIDI note number → array of fingerings (primary first). */
export const CLARINET_FINGERINGS = {

  // ── Chalumeau register (E3–Bb4): register = false ──────────────────────

  52: [  // E3 — all holes closed
    f(false, true, true, true, true, true, true, true, true),
  ],
  53: [  // F3 — open r3
    f(false, true, true, true, true, true, true, false, true),
  ],
  54: [  // F#3 / Gb3 — open r2, r3
    f(false, true, true, true, true, true, false, false, true),
  ],
  55: [  // G3 — open r1, r2, r3
    f(false, true, true, true, true, false, false, false, false),
  ],
  56: [  // Ab3 / G#3 — open l3, r1, r2, r3
    f(false, true, true, true, false, false, false, false, true),
  ],
  57: [  // A3 — open l2, l3, r1, r2, r3
    f(false, true, true, false, false, false, false, false, false),
  ],
  58: [  // Bb3 / A#3 — open l1, l2, l3, r1, r2, r3 (lThumb still closed)
    f(false, true, false, false, false, false, false, false, false),
  ],
  59: [  // B3 — open lThumb too
    f(false, false, false, false, false, false, false, false, false),
  ],
  60: [  // C4 — "throat tone" open register area
    f(false, false, false, true, false, false, false, false, false),
  ],
  61: [  // C#4 / Db4
    f(false, false, false, false, true, false, false, false, false),
  ],
  62: [  // D4
    f(false, true, false, false, false, true, true, true, false),
  ],
  63: [  // Eb4 / D#4
    f(false, true, false, false, false, true, true, false, false),
  ],
  64: [  // E4
    f(false, true, false, false, false, true, false, false, false),
  ],
  65: [  // F4
    f(false, true, false, false, false, false, false, false, false),
  ],
  66: [  // F#4 / Gb4
    f(false, true, false, false, false, false, false, false, true),
  ],
  67: [  // G4
    f(false, true, true, false, false, false, false, false, false),
  ],
  68: [  // Ab4 / G#4
    f(false, true, true, false, false, false, false, false, true),
  ],
  69: [  // A4
    f(false, true, true, true, false, false, false, false, false),
  ],
  70: [  // Bb4 / A#4
    f(false, true, true, true, false, false, false, false, true),
  ],

  // ── Clarion register (B4–C6): register = true ──────────────────────────
  // Overblows a 12th above chalumeau (same fingering + register key)

  71: [  // B4 — register + all closed (like E3 + register)
    f(true, true, true, true, true, true, true, true, true),
  ],
  72: [  // C5 — register + open r3 (like F3 pattern)
    f(true, true, true, true, true, true, true, false, true),
  ],
  73: [  // C#5 / Db5 — register + open r2, r3
    f(true, true, true, true, true, true, false, false, true),
  ],
  74: [  // D5 — register + open r1, r2, r3
    f(true, true, true, true, true, false, false, false, false),
  ],
  75: [  // Eb5 / D#5
    f(true, true, true, true, false, false, false, false, true),
  ],
  76: [  // E5
    f(true, true, true, false, false, false, false, false, false),
  ],
  77: [  // F5
    f(true, true, false, false, false, false, false, false, false),
  ],
  78: [  // F#5 / Gb5
    f(true, false, false, false, false, false, false, false, false),
  ],
  79: [  // G5
    f(true, false, false, true, false, false, false, false, false),
  ],
  80: [  // Ab5 / G#5
    f(true, false, false, false, true, false, false, false, false),
  ],
  81: [  // A5
    f(true, true, false, false, false, true, true, true, false),
  ],
  82: [  // Bb5 / A#5
    f(true, true, false, false, false, true, true, false, false),
  ],
  83: [  // B5
    f(true, true, false, false, false, true, false, false, false),
  ],

  // ── Altissimo register (C6–C7) ─────────────────────────────────────────

  84: [  // C6
    f(true, true, false, false, false, false, false, false, false),
  ],
};

/**
 * Return the primary (non-alt) fingering for a MIDI note, or null.
 * @param {number} midiNote
 * @returns {ClarinetFingering|null}
 */
export function getPrimaryFingering(midiNote) {
  const list = CLARINET_FINGERINGS[midiNote];
  if (!list) return null;
  return list.find(f => !f.alt) ?? list[0];
}
