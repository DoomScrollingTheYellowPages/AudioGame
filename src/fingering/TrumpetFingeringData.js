// ─────────────────────────────────────────────
// TrumpetFingeringData.js
// Standard Bb trumpet fingerings (concert pitch).
// MIDI 54 (F#3) through MIDI 84 (C6), chromatic.
// Primary fingering listed first; alt:true marks alternatives.
// ─────────────────────────────────────────────

/**
 * @typedef {object} TrumpetFingering
 * @property {boolean}  v1    Valve 1 (index finger, whole step)
 * @property {boolean}  v2    Valve 2 (middle finger, half step)
 * @property {boolean}  v3    Valve 3 (ring finger, step-and-a-half)
 * @property {boolean}  [alt] True = alternative fingering (not shown as primary)
 */

/** MIDI note number → array of fingerings (primary first). */
export const TRUMPET_FINGERINGS = {

  // ── Low register (pedal / 2nd partial) ──────────────────────────────

  54: [  // F#3 / Gb3
    { v1: true,  v2: true,  v3: true  },
  ],
  55: [  // G3
    { v1: true,  v2: false, v3: true  },
  ],
  56: [  // Ab3 / G#3
    { v1: false, v2: true,  v3: true  },
  ],
  57: [  // A3
    { v1: true,  v2: true,  v3: false },
  ],
  58: [  // Bb3 / A#3
    { v1: true,  v2: false, v3: false },
  ],
  59: [  // B3
    { v1: false, v2: true,  v3: false },
  ],
  60: [  // C4 (open — 2nd partial)
    { v1: false, v2: false, v3: false },
  ],

  // ── 3rd partial ─────────────────────────────────────────────────────

  61: [  // C#4 / Db4
    { v1: true,  v2: true,  v3: true  },
  ],
  62: [  // D4
    { v1: true,  v2: false, v3: true  },
  ],
  63: [  // Eb4 / D#4
    { v1: false, v2: true,  v3: true  },
  ],
  64: [  // E4
    { v1: true,  v2: true,  v3: false },
  ],
  65: [  // F4
    { v1: true,  v2: false, v3: false },
  ],
  66: [  // F#4 / Gb4
    { v1: false, v2: true,  v3: false },
  ],
  67: [  // G4 (open — 3rd partial)
    { v1: false, v2: false, v3: false },
  ],

  // ── 4th partial ─────────────────────────────────────────────────────

  68: [  // Ab4 / G#4
    { v1: false, v2: true,  v3: true  },
  ],
  69: [  // A4
    { v1: true,  v2: true,  v3: false },
  ],
  70: [  // Bb4 / A#4
    { v1: true,  v2: false, v3: false },
  ],
  71: [  // B4
    { v1: false, v2: true,  v3: false },
  ],
  72: [  // C5 (open — 4th partial)
    { v1: false, v2: false, v3: false },
  ],

  // ── 5th / 6th partial ──────────────────────────────────────────────

  73: [  // C#5 / Db5
    { v1: true,  v2: true,  v3: false },
  ],
  74: [  // D5 (6th partial, valve 1)
    { v1: true,  v2: false, v3: false },
  ],
  75: [  // Eb5 / D#5
    { v1: false, v2: true,  v3: false },
  ],
  76: [  // E5 (open — 5th partial)
    { v1: false, v2: false, v3: false },
  ],
  77: [  // F5
    { v1: true,  v2: false, v3: false },
  ],
  78: [  // F#5 / Gb5
    { v1: false, v2: true,  v3: false },
  ],
  79: [  // G5 (open — 6th partial)
    { v1: false, v2: false, v3: false },
  ],

  // ── 7th / 8th partial ──────────────────────────────────────────────

  80: [  // Ab5 / G#5
    { v1: false, v2: true,  v3: true  },
  ],
  81: [  // A5
    { v1: true,  v2: true,  v3: false },
  ],
  82: [  // Bb5 / A#5
    { v1: true,  v2: false, v3: false },
  ],
  83: [  // B5
    { v1: false, v2: true,  v3: false },
  ],
  84: [  // C6 (open — 8th partial)
    { v1: false, v2: false, v3: false },
  ],
};

/**
 * Return the primary (non-alt) fingering for a MIDI note, or null.
 * @param {number} midiNote
 * @returns {TrumpetFingering|null}
 */
export function getPrimaryFingering(midiNote) {
  const list = TRUMPET_FINGERINGS[midiNote];
  if (!list) return null;
  return list.find(f => !f.alt) ?? list[0];
}
