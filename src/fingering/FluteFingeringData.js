// ─────────────────────────────────────────────
// FluteFingeringData.js
// Standard Boehm flute fingering patterns.
// MIDI 60 (C4) through MIDI 96 (C7), chromatic.
// Primary fingering listed first; alt:true marks alternatives.
// Only primary fingerings are shown in the game display.
// ─────────────────────────────────────────────

/**
 * @typedef {object} FluteFingering
 * @property {boolean}  lThumb  Bb thumb key (left thumb)
 * @property {boolean}  l1      Left index finger
 * @property {boolean}  l2      Left middle finger
 * @property {boolean}  l3      Left ring finger
 * @property {boolean}  r1      Right index finger
 * @property {boolean}  r2      Right middle finger
 * @property {boolean}  r3      Right ring finger
 * @property {boolean}  rPinky  D# key (right pinky)
 * @property {boolean}  trill1  First trill key
 * @property {boolean}  trill2  Second trill key
 * @property {boolean}  [alt]   True = alternative fingering (not shown as primary)
 */

/** MIDI note number → array of fingerings (primary first). */
export const FLUTE_FINGERINGS = {

  // ── First octave (C4–B4) ─────────────────────────────────────

  60: [  // C4
    { lThumb: false, l1: true,  l2: true,  l3: true,  r1: true,  r2: true,  r3: true,  rPinky: false, trill1: false, trill2: false },
  ],
  61: [  // C#4 / Db4
    { lThumb: false, l1: true,  l2: true,  l3: true,  r1: true,  r2: true,  r3: true,  rPinky: true,  trill1: false, trill2: false },
  ],
  62: [  // D4
    { lThumb: false, l1: true,  l2: true,  l3: true,  r1: true,  r2: true,  r3: false, rPinky: false, trill1: false, trill2: false },
  ],
  63: [  // D#4 / Eb4
    { lThumb: false, l1: true,  l2: true,  l3: true,  r1: true,  r2: true,  r3: false, rPinky: true,  trill1: false, trill2: false },
  ],
  64: [  // E4
    { lThumb: false, l1: true,  l2: true,  l3: true,  r1: true,  r2: false, r3: false, rPinky: false, trill1: false, trill2: false },
  ],
  65: [  // F4
    { lThumb: false, l1: true,  l2: true,  l3: true,  r1: false, r2: false, r3: false, rPinky: false, trill1: false, trill2: false },
  ],
  66: [  // F#4 / Gb4
    { lThumb: false, l1: true,  l2: true,  l3: false, r1: false, r2: true,  r3: false, rPinky: false, trill1: false, trill2: false },
  ],
  67: [  // G4
    { lThumb: false, l1: true,  l2: true,  l3: false, r1: false, r2: false, r3: false, rPinky: false, trill1: false, trill2: false },
  ],
  68: [  // G#4 / Ab4
    { lThumb: false, l1: true,  l2: true,  l3: false, r1: false, r2: false, r3: true,  rPinky: false, trill1: false, trill2: false },
  ],
  69: [  // A4
    { lThumb: false, l1: true,  l2: false, l3: false, r1: false, r2: false, r3: false, rPinky: false, trill1: false, trill2: false },
  ],
  70: [  // A#4 / Bb4
    { lThumb: false, l1: true,  l2: false, l3: false, r1: true,  r2: false, r3: false, rPinky: false, trill1: false, trill2: false },
    { lThumb: false, l1: true,  l2: false, l3: true,  r1: false, r2: false, r3: false, rPinky: false, trill1: false, trill2: false, alt: true },
  ],
  71: [  // B4
    { lThumb: false, l1: false, l2: false, l3: false, r1: false, r2: false, r3: false, rPinky: false, trill1: false, trill2: false },
  ],

  // ── Second octave (C5–B5) ────────────────────────────────────

  72: [  // C5
    { lThumb: true,  l1: true,  l2: true,  l3: true,  r1: true,  r2: true,  r3: true,  rPinky: false, trill1: false, trill2: false },
  ],
  73: [  // C#5 / Db5
    { lThumb: true,  l1: true,  l2: true,  l3: true,  r1: true,  r2: true,  r3: true,  rPinky: true,  trill1: false, trill2: false },
  ],
  74: [  // D5
    { lThumb: true,  l1: true,  l2: true,  l3: true,  r1: true,  r2: true,  r3: false, rPinky: false, trill1: false, trill2: false },
  ],
  75: [  // D#5 / Eb5
    { lThumb: true,  l1: true,  l2: true,  l3: true,  r1: true,  r2: true,  r3: false, rPinky: true,  trill1: false, trill2: false },
  ],
  76: [  // E5
    { lThumb: true,  l1: true,  l2: true,  l3: true,  r1: true,  r2: false, r3: false, rPinky: false, trill1: false, trill2: false },
  ],
  77: [  // F5
    { lThumb: true,  l1: true,  l2: true,  l3: true,  r1: false, r2: false, r3: false, rPinky: false, trill1: false, trill2: false },
  ],
  78: [  // F#5 / Gb5
    { lThumb: true,  l1: true,  l2: true,  l3: false, r1: false, r2: true,  r3: false, rPinky: false, trill1: false, trill2: false },
  ],
  79: [  // G5
    { lThumb: true,  l1: true,  l2: true,  l3: false, r1: false, r2: false, r3: false, rPinky: false, trill1: false, trill2: false },
  ],
  80: [  // G#5 / Ab5
    { lThumb: true,  l1: true,  l2: true,  l3: false, r1: false, r2: false, r3: true,  rPinky: false, trill1: false, trill2: false },
  ],
  81: [  // A5
    { lThumb: true,  l1: true,  l2: false, l3: false, r1: false, r2: false, r3: false, rPinky: false, trill1: false, trill2: false },
  ],
  82: [  // A#5 / Bb5
    { lThumb: true,  l1: true,  l2: false, l3: false, r1: true,  r2: false, r3: false, rPinky: false, trill1: false, trill2: false },
  ],
  83: [  // B5
    { lThumb: true,  l1: false, l2: false, l3: false, r1: false, r2: false, r3: false, rPinky: false, trill1: false, trill2: false },
  ],

  // ── Third octave (C6–B6) ─────────────────────────────────────

  84: [  // C6
    { lThumb: true,  l1: true,  l2: true,  l3: false, r1: false, r2: false, r3: true,  rPinky: false, trill1: false, trill2: false },
  ],
  85: [  // C#6 / Db6
    { lThumb: true,  l1: true,  l2: true,  l3: false, r1: true,  r2: false, r3: true,  rPinky: false, trill1: false, trill2: false },
  ],
  86: [  // D6
    { lThumb: true,  l1: true,  l2: true,  l3: true,  r1: true,  r2: true,  r3: false, rPinky: true,  trill1: false, trill2: false },
  ],
  87: [  // D#6 / Eb6
    { lThumb: true,  l1: true,  l2: true,  l3: true,  r1: true,  r2: false, r3: false, rPinky: true,  trill1: false, trill2: false },
  ],
  88: [  // E6
    { lThumb: true,  l1: true,  l2: true,  l3: true,  r1: true,  r2: false, r3: false, rPinky: false, trill1: true,  trill2: false },
  ],
  89: [  // F6
    { lThumb: true,  l1: true,  l2: true,  l3: true,  r1: false, r2: true,  r3: false, rPinky: false, trill1: true,  trill2: false },
  ],
  90: [  // F#6 / Gb6
    { lThumb: true,  l1: true,  l2: true,  l3: false, r1: false, r2: true,  r3: true,  rPinky: false, trill1: true,  trill2: false },
  ],
  91: [  // G6
    { lThumb: true,  l1: true,  l2: true,  l3: false, r1: true,  r2: false, r3: false, rPinky: false, trill1: true,  trill2: false },
  ],
  92: [  // G#6 / Ab6
    { lThumb: true,  l1: true,  l2: true,  l3: false, r1: true,  r2: false, r3: true,  rPinky: false, trill1: true,  trill2: false },
  ],
  93: [  // A6
    { lThumb: true,  l1: true,  l2: false, l3: true,  r1: true,  r2: false, r3: false, rPinky: false, trill1: true,  trill2: false },
  ],
  94: [  // A#6 / Bb6
    { lThumb: true,  l1: true,  l2: false, l3: true,  r1: false, r2: true,  r3: false, rPinky: false, trill1: true,  trill2: false },
  ],
  95: [  // B6
    { lThumb: true,  l1: true,  l2: false, l3: false, r1: true,  r2: true,  r3: false, rPinky: false, trill1: true,  trill2: true  },
  ],

  // ── Top of range ──────────────────────────────────────────────

  96: [  // C7
    { lThumb: true,  l1: true,  l2: true,  l3: false, r1: false, r2: false, r3: true,  rPinky: false, trill1: true,  trill2: true  },
  ],
};

/**
 * Return the primary (non-alt) fingering for a MIDI note, or null.
 * @param {number} midiNote
 * @returns {FluteFingering|null}
 */
export function getPrimaryFingering(midiNote) {
  const list = FLUTE_FINGERINGS[midiNote];
  if (!list) return null;
  return list.find(f => !f.alt) ?? list[0];
}
