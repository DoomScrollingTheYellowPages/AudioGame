// ─────────────────────────────────────────────
// SaxFingeringData.js
// Alto saxophone fingering patterns (concert pitch).
// MIDI 49 (Db3) through MIDI 81 (A5), chromatic.
// Primary fingering listed first; alt:true marks alternatives.
// ─────────────────────────────────────────────

/**
 * @typedef {object} SaxFingering
 * @property {boolean}     oct     Octave key (left thumb)
 * @property {boolean}     l1      Left index hole
 * @property {boolean}     l2      Left middle hole
 * @property {boolean}     l3      Left ring hole
 * @property {boolean}     r1      Right index hole
 * @property {boolean}     r2      Right middle hole
 * @property {boolean}     r3      Right ring hole
 * @property {string|null} lPalm   Left palm key ('d'|'eb'|'f'|null)
 * @property {string|null} rPinky  Right pinky / low keys ('c'|'eb'|'bb'|null)
 * @property {string|null} lSide   Left side key ('bis'|'ta'|null)
 * @property {string|null} rSide   Right side key ('e'|'c'|null)
 * @property {boolean}     [alt]   True = alternative fingering (not shown as primary)
 */

/** MIDI note number → array of fingerings (primary first). */
export const SAX_FINGERINGS = {

  // ── Low register (no octave key) ─────────────────────────────────────

  49: [  // Db3 / C#3  — lowest practical note, all closed + low keys
    { oct: false, l1: true,  l2: true,  l3: true,  r1: true,  r2: true,  r3: true,  lPalm: null, rPinky: 'eb', lSide: null, rSide: null },
  ],
  50: [  // D3
    { oct: false, l1: true,  l2: true,  l3: true,  r1: true,  r2: true,  r3: true,  lPalm: null, rPinky: null, lSide: null, rSide: null },
  ],
  51: [  // Eb3 / D#3
    { oct: false, l1: true,  l2: true,  l3: true,  r1: true,  r2: true,  r3: false, lPalm: null, rPinky: null, lSide: null, rSide: null },
  ],
  52: [  // E3
    { oct: false, l1: true,  l2: true,  l3: true,  r1: true,  r2: false, r3: false, lPalm: null, rPinky: null, lSide: null, rSide: null },
  ],
  53: [  // F3
    { oct: false, l1: true,  l2: true,  l3: true,  r1: false, r2: false, r3: false, lPalm: null, rPinky: null, lSide: null, rSide: null },
  ],
  54: [  // F#3 / Gb3
    { oct: false, l1: true,  l2: true,  l3: false, r1: false, r2: false, r3: false, lPalm: null, rPinky: null, lSide: null, rSide: null },
  ],
  55: [  // G3
    { oct: false, l1: true,  l2: false, l3: false, r1: false, r2: false, r3: false, lPalm: null, rPinky: null, lSide: null, rSide: null },
  ],
  56: [  // G#3 / Ab3
    { oct: false, l1: true,  l2: false, l3: false, r1: false, r2: false, r3: false, lPalm: null, rPinky: null, lSide: null, rSide: 'e' },
  ],
  57: [  // A3
    { oct: false, l1: false, l2: false, l3: false, r1: false, r2: false, r3: false, lPalm: null, rPinky: null, lSide: null, rSide: null },
  ],
  58: [  // Bb3 / A#3  — bis key (primary), side Bb (alt)
    { oct: false, l1: true,  l2: false, l3: false, r1: false, r2: false, r3: false, lPalm: null, rPinky: null, lSide: 'bis', rSide: null },
    { oct: false, l1: false, l2: false, l3: false, r1: false, r2: false, r3: false, lPalm: null, rPinky: null, lSide: 'ta',  rSide: null, alt: true },
  ],
  59: [  // B3
    { oct: false, l1: true,  l2: false, l3: false, r1: false, r2: false, r3: false, lPalm: null, rPinky: null, lSide: null, rSide: null },
  ],
  60: [  // C4
    { oct: false, l1: false, l2: false, l3: false, r1: false, r2: false, r3: false, lPalm: null, rPinky: null, lSide: null, rSide: null },
  ],
  61: [  // C#4 / Db4
    { oct: false, l1: false, l2: false, l3: false, r1: false, r2: false, r3: false, lPalm: null, rPinky: null, lSide: null, rSide: 'c' },
  ],

  // ── Upper register (octave key active) ───────────────────────────────

  62: [  // D4
    { oct: true,  l1: true,  l2: true,  l3: true,  r1: true,  r2: true,  r3: true,  lPalm: null, rPinky: null, lSide: null, rSide: null },
  ],
  63: [  // Eb4 / D#4
    { oct: true,  l1: true,  l2: true,  l3: true,  r1: true,  r2: true,  r3: false, lPalm: null, rPinky: null, lSide: null, rSide: null },
  ],
  64: [  // E4
    { oct: true,  l1: true,  l2: true,  l3: true,  r1: true,  r2: false, r3: false, lPalm: null, rPinky: null, lSide: null, rSide: null },
  ],
  65: [  // F4
    { oct: true,  l1: true,  l2: true,  l3: true,  r1: false, r2: false, r3: false, lPalm: null, rPinky: null, lSide: null, rSide: null },
  ],
  66: [  // F#4 / Gb4
    { oct: true,  l1: true,  l2: true,  l3: false, r1: false, r2: false, r3: false, lPalm: null, rPinky: null, lSide: null, rSide: null },
  ],
  67: [  // G4
    { oct: true,  l1: true,  l2: false, l3: false, r1: false, r2: false, r3: false, lPalm: null, rPinky: null, lSide: null, rSide: null },
  ],
  68: [  // G#4 / Ab4
    { oct: true,  l1: true,  l2: false, l3: false, r1: false, r2: false, r3: false, lPalm: null, rPinky: null, lSide: null, rSide: 'e' },
  ],
  69: [  // A4
    { oct: true,  l1: false, l2: false, l3: false, r1: false, r2: false, r3: false, lPalm: null, rPinky: null, lSide: null, rSide: null },
  ],
  70: [  // Bb4 / A#4
    { oct: true,  l1: true,  l2: false, l3: false, r1: false, r2: false, r3: false, lPalm: null, rPinky: null, lSide: 'bis', rSide: null },
  ],
  71: [  // B4
    { oct: true,  l1: true,  l2: false, l3: false, r1: false, r2: false, r3: false, lPalm: null, rPinky: null, lSide: null, rSide: null },
  ],
  72: [  // C5
    { oct: true,  l1: false, l2: false, l3: false, r1: false, r2: false, r3: false, lPalm: null, rPinky: null, lSide: null, rSide: null },
  ],
  73: [  // C#5 / Db5
    { oct: true,  l1: false, l2: false, l3: false, r1: false, r2: false, r3: false, lPalm: null, rPinky: null, lSide: null, rSide: 'c' },
  ],

  // ── High register (palm keys) ───────────────────────────────────────

  74: [  // D5
    { oct: true,  l1: true,  l2: true,  l3: true,  r1: true,  r2: true,  r3: true,  lPalm: 'd',  rPinky: null, lSide: null, rSide: null },
  ],
  75: [  // Eb5 / D#5
    { oct: true,  l1: true,  l2: true,  l3: true,  r1: true,  r2: true,  r3: true,  lPalm: 'eb', rPinky: null, lSide: null, rSide: null },
  ],
  76: [  // E5
    { oct: true,  l1: true,  l2: true,  l3: true,  r1: true,  r2: true,  r3: true,  lPalm: 'eb', rPinky: null, lSide: 'ta',  rSide: null },
  ],
  77: [  // F5
    { oct: true,  l1: true,  l2: true,  l3: true,  r1: true,  r2: true,  r3: true,  lPalm: 'f',  rPinky: null, lSide: null, rSide: null },
  ],
  78: [  // F#5 / Gb5
    { oct: true,  l1: true,  l2: true,  l3: true,  r1: true,  r2: false, r3: false, lPalm: 'f',  rPinky: null, lSide: null, rSide: null },
  ],
  79: [  // G5
    { oct: true,  l1: true,  l2: true,  l3: true,  r1: false, r2: false, r3: false, lPalm: 'f',  rPinky: null, lSide: null, rSide: null },
  ],
  80: [  // G#5 / Ab5
    { oct: true,  l1: true,  l2: true,  l3: false, r1: false, r2: false, r3: false, lPalm: 'f',  rPinky: null, lSide: null, rSide: null },
  ],
  81: [  // A5
    { oct: true,  l1: true,  l2: false, l3: false, r1: false, r2: false, r3: false, lPalm: 'f',  rPinky: null, lSide: null, rSide: null },
  ],
};

/**
 * Return the primary (non-alt) fingering for a MIDI note, or null.
 * @param {number} midiNote
 * @returns {SaxFingering|null}
 */
export function getPrimaryFingering(midiNote) {
  const list = SAX_FINGERINGS[midiNote];
  if (!list) return null;
  return list.find(f => !f.alt) ?? list[0];
}
