// ─────────────────────────────────────────────
// OboeFingeringData.js
// Standard oboe (Conservatory system) fingering patterns.
// MIDI 58 (Bb3) through MIDI 81 (A5), chromatic.
// Primary fingering listed first; alt:true marks alternatives.
// Only primary fingerings are shown in the game display.
// ─────────────────────────────────────────────

/**
 * @typedef {object} OboeFingering
 * @property {boolean}     oct    Octave key (left thumb)
 * @property {boolean}     l1     Left index hole
 * @property {boolean}     l2     Left middle hole
 * @property {boolean}     l3     Left ring hole
 * @property {boolean}     r1     Right index hole
 * @property {boolean}     r2     Right middle hole
 * @property {boolean}     r3     Right ring hole
 * @property {boolean}     lowBb  Low Bb key (right pinky)
 * @property {string|null} lSide  Left side key ('eb'|'gs'|'b'|null)
 * @property {string|null} rSide  Right side key ('cs'|'f'|'bb'|null)
 * @property {boolean}     [alt]  True = alternative fingering (not shown as primary)
 */

/** MIDI note number → array of fingerings (primary first). */
export const OBOE_FINGERINGS = {

  // ── Low register (no octave key) ─────────────────────────────────────

  58: [  // Bb3 / A#3
    { oct: false, l1: true,  l2: true,  l3: true,  r1: true,  r2: true,  r3: true,  lowBb: true,  lSide: null, rSide: null },
  ],
  59: [  // B3
    { oct: false, l1: true,  l2: true,  l3: true,  r1: true,  r2: true,  r3: true,  lowBb: false, lSide: null, rSide: null },
  ],
  60: [  // C4
    { oct: false, l1: true,  l2: true,  l3: true,  r1: true,  r2: true,  r3: false, lowBb: false, lSide: null, rSide: null },
  ],
  61: [  // C#4 / Db4
    { oct: false, l1: true,  l2: true,  l3: true,  r1: true,  r2: false, r3: false, lowBb: false, lSide: null, rSide: 'cs' },
  ],
  62: [  // D4
    { oct: false, l1: true,  l2: true,  l3: true,  r1: false, r2: false, r3: false, lowBb: false, lSide: null, rSide: null },
  ],
  63: [  // Eb4 / D#4
    { oct: false, l1: true,  l2: true,  l3: false, r1: false, r2: false, r3: false, lowBb: false, lSide: 'eb', rSide: null },
  ],
  64: [  // E4
    { oct: false, l1: true,  l2: true,  l3: false, r1: false, r2: false, r3: false, lowBb: false, lSide: null, rSide: null },
  ],
  65: [  // F4 — fork F (primary)
    { oct: false, l1: true,  l2: false, l3: true,  r1: false, r2: false, r3: false, lowBb: false, lSide: null, rSide: null },
    { oct: false, l1: true,  l2: false, l3: false, r1: false, r2: false, r3: false, lowBb: false, lSide: null, rSide: 'f',  alt: true },
  ],
  66: [  // F#4 / Gb4
    { oct: false, l1: true,  l2: false, l3: false, r1: false, r2: false, r3: false, lowBb: false, lSide: null, rSide: null },
  ],
  67: [  // G4
    { oct: false, l1: false, l2: true,  l3: true,  r1: false, r2: false, r3: false, lowBb: false, lSide: null, rSide: null },
  ],
  68: [  // G#4 / Ab4
    { oct: false, l1: false, l2: true,  l3: true,  r1: false, r2: false, r3: false, lowBb: false, lSide: 'gs', rSide: null },
  ],
  69: [  // A4
    { oct: false, l1: false, l2: false, l3: false, r1: false, r2: false, r3: false, lowBb: false, lSide: null, rSide: null },
  ],
  70: [  // Bb4 / A#4
    { oct: false, l1: false, l2: false, l3: false, r1: false, r2: false, r3: false, lowBb: false, lSide: null, rSide: 'bb' },
  ],
  71: [  // B4 — side B key (primary)
    { oct: false, l1: true,  l2: true,  l3: false, r1: false, r2: false, r3: false, lowBb: false, lSide: 'b',  rSide: null },
    { oct: true,  l1: true,  l2: true,  l3: true,  r1: true,  r2: true,  r3: true,  lowBb: false, lSide: null, rSide: null, alt: true },
  ],

  // ── Upper register (octave key active) ───────────────────────────────

  72: [  // C5
    { oct: true,  l1: true,  l2: true,  l3: true,  r1: true,  r2: true,  r3: false, lowBb: false, lSide: null, rSide: null },
  ],
  73: [  // C#5 / Db5
    { oct: true,  l1: true,  l2: true,  l3: true,  r1: true,  r2: false, r3: false, lowBb: false, lSide: null, rSide: 'cs' },
  ],
  74: [  // D5
    { oct: true,  l1: true,  l2: true,  l3: true,  r1: false, r2: false, r3: false, lowBb: false, lSide: null, rSide: null },
  ],
  75: [  // Eb5 / D#5
    { oct: true,  l1: true,  l2: true,  l3: false, r1: false, r2: false, r3: false, lowBb: false, lSide: 'eb', rSide: null },
  ],
  76: [  // E5
    { oct: true,  l1: true,  l2: true,  l3: false, r1: false, r2: false, r3: false, lowBb: false, lSide: null, rSide: null },
  ],
  77: [  // F5 — fork F (primary)
    { oct: true,  l1: true,  l2: false, l3: true,  r1: false, r2: false, r3: false, lowBb: false, lSide: null, rSide: null },
    { oct: true,  l1: true,  l2: false, l3: false, r1: false, r2: false, r3: false, lowBb: false, lSide: null, rSide: 'f',  alt: true },
  ],
  78: [  // F#5 / Gb5
    { oct: true,  l1: true,  l2: false, l3: false, r1: false, r2: false, r3: false, lowBb: false, lSide: null, rSide: null },
  ],
  79: [  // G5
    { oct: true,  l1: false, l2: true,  l3: true,  r1: false, r2: false, r3: false, lowBb: false, lSide: null, rSide: null },
  ],
  80: [  // G#5 / Ab5
    { oct: true,  l1: false, l2: true,  l3: true,  r1: false, r2: false, r3: false, lowBb: false, lSide: 'gs', rSide: null },
  ],
  81: [  // A5
    { oct: true,  l1: false, l2: false, l3: false, r1: false, r2: false, r3: false, lowBb: false, lSide: null, rSide: null },
  ],
};

/**
 * Return the primary (non-alt) fingering for a MIDI note, or null.
 * @param {number} midiNote
 * @returns {OboeFingering|null}
 */
export function getPrimaryFingering(midiNote) {
  const list = OBOE_FINGERINGS[midiNote];
  if (!list) return null;
  return list.find(f => !f.alt) ?? list[0];
}
